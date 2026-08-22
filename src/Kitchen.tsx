import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { API_URL, WS_URL } from './config';
import { getKitchenOrders, updateKitchenOrderStatus, KitchenOrder } from './api/orders';
import './kds.css';




// ─── Helper: format elapsed time in MM:SS or Hh MMm ──────────────────────────
function formatElapsed(createdAt?: string, now: number = Date.now()) {
  if (!createdAt) return '';
  const dateStr = createdAt.endsWith('Z') ? createdAt : `${createdAt}Z`;
  const diffMs = now - new Date(dateStr).getTime();
  if (isNaN(diffMs) || diffMs < 0) return '00:00';
  const diffSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;

  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${String(remMins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ─── Urgency tier based on age + status ──────────────────────────────────────
function getAgeMinutes(createdAt?: string, now: number = Date.now()) {
  if (!createdAt) return 0;
  const dateStr = createdAt.endsWith('Z') ? createdAt : `${createdAt}Z`;
  return Math.floor((now - new Date(dateStr).getTime()) / 60000);
}

function getUrgencyClass(status: string, ageMinutes: number) {
  const s = (status || '').toLowerCase();
  if (s !== 'pending' && s !== 'accepted' && s !== 'preparing' && s !== 'cooking') return '';
  if (ageMinutes >= 10) return 'urgency-critical';
  if (ageMinutes >= 5) return 'urgency-high';
  return '';
}

// ─── Status Helper Function ──────────────────────────────────────────────────
function getNextStatus(status: string) {
  const normalized = (status || '').toLowerCase();

  if (normalized === 'pending') {
    return {
      label: 'Accept Order',
      status: 'Accepted',
    };
  }

  if (normalized === 'accepted') {
    return {
      label: 'Start Preparing',
      status: 'Preparing',
    };
  }

  if (normalized === 'preparing' || normalized === 'cooking') {
    return {
      label: 'Mark Ready',
      status: 'Ready',
    };
  }

  if (normalized === 'ready') {
    return {
      label: 'Mark Served',
      status: 'Completed',
    };
  }

  return null;
}

// ─── Web Audio Chime Notification ──────────────────────────────────────────────
function playOrderChime(volume = 0.5) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const notes = [
      { freq: 523.25, time: 0, duration: 0.25 },
      { freq: 659.25, time: 0.1, duration: 0.35 },
      { freq: 783.99, time: 0.2, duration: 0.45 }
    ];
    notes.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.setValueAtTime(0.2 * volume, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    });
  } catch (e) {
    console.error('Audio error:', e);
  }
}

// ─── Recipe / Notes Modal Component ──────────────────────────────────────────
function RecipeModal({ item, onClose }: { item: any; onClose: () => void }) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="recipe-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="recipe-modal"
            initial={{ opacity: 0, scale: 0.88, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } }}
            exit={{ opacity: 0, scale: 0.92, y: 20, transition: { duration: 0.2 } }}
            onClick={e => e.stopPropagation()}
          >
            <div className="recipe-modal-header">
              <div className="recipe-modal-title-area">
                <span className="recipe-modal-icon">🍳</span>
                <h2 className="recipe-modal-title">{item.name}</h2>
              </div>
              <button className="recipe-modal-close" onClick={onClose}>✕</button>
            </div>
            <div className="recipe-modal-body">
              {item.notes || item.recipe_instructions ? (
                <div className="recipe-content">
                  <p className="recipe-label">Preparation & Special Notes</p>
                  <div className="recipe-text">{item.notes || item.recipe_instructions}</div>
                </div>
              ) : (
                <div className="recipe-empty">
                  <span className="recipe-empty-icon">📋</span>
                  <p>No special preparation instructions registered for this dish.</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Kitchen Component ───────────────────────────────────────────────────
export default function Kitchen() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'ready'>('pending');
  const [now, setNow] = useState(Date.now());
  const [recipeItem, setRecipeItem] = useState<any>(null);

  const [soundEnabled, setSoundEnabled] = useState(() => {
    const s = localStorage.getItem('serveme_kitchen_sound');
    return s !== null ? JSON.parse(s) : true;
  });
  const [volume, setVolume] = useState(() => {
    const v = localStorage.getItem('serveme_kitchen_volume');
    return v !== null ? Number(v) : 0.5;
  });

  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Clock tick every second for high-precision timer display
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pendingUpdatesRef = useRef<Map<string, string>>(new Map());

  // Poll orders with optimistic status lock preservation
  const loadOrders = useCallback(async () => {
    try {
      const data = await getKitchenOrders();
      let rawList: KitchenOrder[] = [];
      if (Array.isArray(data)) {
        rawList = data;
      } else if (data && typeof data === 'object' && Array.isArray((data as any).orders)) {
        rawList = (data as any).orders;
      } else if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
        rawList = (data as any).data;
      }

      // Apply locks from pendingUpdatesRef so background fetches never revert optimistic state!
      const lockedOrders = rawList.map(order => {
        const orderIdStr = String(order.id);
        if (pendingUpdatesRef.current.has(orderIdStr)) {
          const lockedStatus = pendingUpdatesRef.current.get(orderIdStr)!;
          return { ...order, status: lockedStatus };
        }
        return order;
      }).filter(order => {
        const orderIdStr = String(order.id);
        if (pendingUpdatesRef.current.has(orderIdStr)) {
          const lockedStatus = pendingUpdatesRef.current.get(orderIdStr)!;
          if (lockedStatus.toLowerCase() === 'completed') return false;
        }
        return true;
      });

      setOrders(lockedOrders);
      setError(null);

    } catch (err) {
      console.warn("Backend fetch failed, waiting for connection:", err);
      setError(null);
    } finally {
      setLoading(false);
    }

  }, []);

  useEffect(() => {
    loadOrders();

    const intervalId = window.setInterval(loadOrders, 1500);

    let socket: ReturnType<typeof io> | null = null;
    try {
      socket = io(WS_URL, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 2,
        timeout: 3000,
      });

      socket.on('connect', () => {
        socket?.emit('join_restaurant', { restaurant_id: 1 });
      });
      socket.on('order_update', () => {
        loadOrders();
      });
      socket.on('connect_error', () => {
        // Silent disconnect if WebSocket endpoint returns 404, fallback to REST polling
        socket?.disconnect();
      });
    } catch {
      // Quiet fallback to REST polling
    }

    return () => {
      window.clearInterval(intervalId);
      if (socket) socket.disconnect();
    };
  }, [loadOrders]);

  // Audio chime when a new order is received
  useEffect(() => {
    if (orders.length === 0) return;
    const currentIds = orders.map(o => String(o.id));

    if (isInitialLoadRef.current) {
      currentIds.forEach(id => seenOrderIdsRef.current.add(id));
      isInitialLoadRef.current = false;
      return;
    }

    const hasNewOrder = currentIds.some(id => !seenOrderIdsRef.current.has(id));
    currentIds.forEach(id => seenOrderIdsRef.current.add(id));

    if (hasNewOrder && soundEnabled) {
      playOrderChime(volume);
    }
  }, [orders, soundEnabled, volume]);

  const toggleSound = () => {
    setSoundEnabled((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('serveme_kitchen_sound', JSON.stringify(next));
      if (next) playOrderChime(volume);
      return next;
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    localStorage.setItem('serveme_kitchen_volume', String(v));
    playOrderChime(v);
  };

  // Instant 0ms Lock-Protected Order Status Update
  async function handleStatusChange(
    orderId: string,
    nextStatus: string,
  ) {
    const orderIdStr = String(orderId);

    // 1. Lock status to prevent background poll from reverting UI
    pendingUpdatesRef.current.set(orderIdStr, nextStatus);

    // 2. Instantly update UI state locally (0ms lag!)
    setOrders(prevOrders => {
      if (nextStatus.toLowerCase() === 'completed') {
        return prevOrders.filter(o => String(o.id) !== orderIdStr);
      }
      return prevOrders.map(o => {
        if (String(o.id) === orderIdStr) {
          return { ...o, status: nextStatus };
        }
        return o;
      });
    });

    // 3. Perform network sync in background
    try {
      await updateKitchenOrderStatus(orderId, nextStatus);
    } catch (error) {
      console.error('Optimistic status update failed, reloading', error);
      pendingUpdatesRef.current.delete(orderIdStr);
      loadOrders();
    } finally {
      setTimeout(() => {
        pendingUpdatesRef.current.delete(orderIdStr);
      }, 500);
    }
  }



  // Column mapping with normalized status matching
  const pendingOrders = orders.filter((order) => {
    const s = (order.status || '').toLowerCase().trim();
    return (
      s === 'pending' ||
      s === 'accepted' ||
      s === 'order received' ||
      s === 'received' ||
      s === 'placed' ||
      s === 'new' ||
      s === 'created' ||
      (!['preparing', 'cooking', 'in progress', 'ready', 'ready for pickup', 'cooked', 'completed', 'cancelled'].includes(s))
    );
  });

  const preparingOrders = orders.filter((order) => {
    const s = (order.status || '').toLowerCase().trim();
    return s === 'preparing' || s === 'cooking' || s === 'in progress';
  });

  const readyOrders = orders.filter((order) => {
    const s = (order.status || '').toLowerCase().trim();
    return s === 'ready' || s === 'ready for pickup' || s === 'cooked';
  });


  const getTableLabel = (order: KitchenOrder): string | null => {
    if (order.tableName) return order.tableName;
    if (order.tableNumber !== undefined && order.tableNumber !== null) {
      return `Table ${order.tableNumber}`;
    }
    if (order.tableId) return `Table ${order.tableId}`;
    return null;
  };


  const cardVariants = {
    initial: { opacity: 0, scale: 0.92, y: 15 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
    exit: { opacity: 0, x: -50, scale: 0.95, transition: { duration: 0.2 } }
  };

  const renderOrderCard = (order: KitchenOrder) => {
    const nextAction = getNextStatus(order.status);
    const statusLower = (order.status || '').toLowerCase();
    const ageMinutes = getAgeMinutes(order.createdAt, now);
    const elapsedStr = formatElapsed(order.createdAt, now);
    const urgencyClass = getUrgencyClass(order.status, ageMinutes);
    const tableLabel = getTableLabel(order);
    const displayNum = order.orderNumber ? String(order.orderNumber).replace(/^ORD-/, '') : String(order.id);

    return (
      <motion.div
        key={order.id}
        layout
        variants={cardVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`order-card-glass status-${statusLower} ${urgencyClass}`}
      >
        {/* Glowing top edge status bar */}
        <div className={`card-edge edge-${statusLower}`} />

        {/* Card Header */}
        <div className="order-card-header">
          <div className="order-id-area">
            <span className="order-number">#{displayNum}</span>
            {tableLabel && (
              <span className="table-badge" style={{
                fontSize: '12px',
                background: 'rgba(255,255,255,0.12)',
                padding: '2px 8px',
                borderRadius: '12px',
                color: '#e2e8f0',
                fontWeight: 600,
                marginLeft: '8px'
              }}>
                {tableLabel}
              </span>
            )}
            {elapsedStr && <span className="order-age">⏳ {elapsedStr}</span>}
          </div>
          <div className={`status-led-group status-${statusLower}`}>
            <span className={`status-led ${urgencyClass ? 'led-urgent' : ''}`} />
            <span className="status-label">{order.status}</span>
          </div>
        </div>

        {/* Items List */}
        <ul className="order-items-list">
          {order.items?.map((item, idx) => (
            <li key={item.productId || idx}>
              <div className="order-item-line">
                <span className="item-qty">{item.quantity}×</span>
                <div className="order-item-info">
                  <button
                    className="item-name-btn"
                    onClick={() => setRecipeItem({
                      name: item.name,
                      notes: item.notes
                    })}
                    title="Click to view instructions"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#cbd5e1',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {item.name}
                  </button>
                  {item.notes && (
                    <span className="item-notes">📝 {item.notes}</span>
                  )}
                </div>
                <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, marginLeft: 'auto' }}>
                  ₹{item.price * item.quantity}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* Order level notes */}
        {order.notes && (
          <div className="order-notes-box" style={{
            fontSize: '12px',
            color: '#fde047',
            background: 'rgba(253, 224, 71, 0.08)',
            padding: '8px 12px',
            borderRadius: '8px',
            borderLeft: '3px solid #fde047',
            margin: '8px 0 12px 0'
          }}>
            📝 <strong>Order Notes:</strong> {order.notes}
          </div>
        )}

        {/* Card Footer with Total & Next Action Button */}
        <div className="order-card-footer" style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '12px'
        }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Total</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>₹{order.total}</span>
          </div>

          {nextAction && (
            <button
              onClick={() =>
                handleStatusChange(order.id, nextAction.status)
              }
              className={`btn-pill btn-${nextAction.status.toLowerCase()}`}
              style={{
                background:
                  statusLower === 'pending' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
                    statusLower === 'accepted' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' :
                      statusLower === 'preparing' || statusLower === 'cooking' ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                        'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '24px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span className="btn-icon">
                {statusLower === 'pending' ? '📥' :
                  statusLower === 'accepted' ? '🔥' :
                    statusLower === 'preparing' || statusLower === 'cooking' ? '✅' : '🤝'}
              </span>
              <span className="btn-text">{nextAction.label}</span>
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="kitchen-container">
      {/* Recipe Modal */}
      <RecipeModal item={recipeItem} onClose={() => setRecipeItem(null)} />

      {/* Header */}
      <header className="kitchen-header">
        <div className="kitchen-title-area">
          <h1>Kitchen Dashboard</h1>
          <span className="live-indicator">Polling (3s)</span>
        </div>

        {/* Aggregate Stats */}
        <div className="kitchen-stats">
          <div className="stat-chip pending">
            <span className="stat-dot dot-pending" />
            <span className="label">Pending</span>
            <span className="value">{pendingOrders.length}</span>
          </div>
          <div className="stat-chip cooking">
            <span className="stat-dot dot-cooking" />
            <span className="label">Preparing</span>
            <span className="value">{preparingOrders.length}</span>
          </div>
          <div className="stat-chip ready">
            <span className="stat-dot dot-ready" />
            <span className="label">Ready</span>
            <span className="value">{readyOrders.length}</span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="kitchen-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="sound-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`sound-toggle-btn ${!soundEnabled ? 'muted' : ''}`}
              onClick={toggleSound}
              title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
              style={{ fontSize: '16px', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            {soundEnabled && (
              <input
                type="range" min="0" max="1" step="0.1"
                value={volume} onChange={handleVolumeChange}
                className="volume-slider" title="Adjust Volume"
                style={{ width: '80px', cursor: 'pointer' }}
              />
            )}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '12px 20px',
          borderRadius: '12px',
          margin: '0 20px 20px 20px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => loadOrders()}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Mobile Kanban Tabs Bar */}
      <div className="mobile-kanban-tabs">
        <button
          className={`kanban-tab-btn tab-pending ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <span className="tab-dot dot-pending" />
          <span>Pending ({pendingOrders.length})</span>
        </button>
        <button
          className={`kanban-tab-btn tab-cooking ${activeTab === 'preparing' ? 'active' : ''}`}
          onClick={() => setActiveTab('preparing')}
        >
          <span className="tab-dot dot-cooking" />
          <span>Preparing ({preparingOrders.length})</span>
        </button>
        <button
          className={`kanban-tab-btn tab-ready ${activeTab === 'ready' ? 'active' : ''}`}
          onClick={() => setActiveTab('ready')}
        >
          <span className="tab-dot dot-ready" />
          <span>Ready ({readyOrders.length})</span>
        </button>
      </div>

      {/* 3-Column Kanban Board View */}
      {loading && orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⌛</div>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>Loading kitchen orders...</p>
        </div>
      ) : (
        <div className="kitchen-board-columns">
          {/* 1. Pending Column (Pending + Accepted) */}
          <div className={`kanban-column column-pending ${activeTab === 'pending' ? 'mobile-visible' : 'mobile-hidden'}`}>
            <div className="column-header">
              <h3>Pending Orders</h3>
              <span className="column-count-badge">{pendingOrders.length}</span>
            </div>
            <div className="column-cards-container">
              {pendingOrders.map(order => renderOrderCard(order))}
              {pendingOrders.length === 0 && (
                <div className="column-empty-state">
                  <p>No pending orders</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Cooking / Preparing Column */}
          <div className={`kanban-column column-cooking ${activeTab === 'preparing' ? 'mobile-visible' : 'mobile-hidden'}`}>
            <div className="column-header">
              <h3>Cooking / Preparing</h3>
              <span className="column-count-badge">{preparingOrders.length}</span>
            </div>
            <div className="column-cards-container">
              {preparingOrders.map(order => renderOrderCard(order))}
              {preparingOrders.length === 0 && (
                <div className="column-empty-state">
                  <p>No active cooking items</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Ready Column */}
          <div className={`kanban-column column-ready ${activeTab === 'ready' ? 'mobile-visible' : 'mobile-hidden'}`}>
            <div className="column-header">
              <h3>Ready for Pickup</h3>
              <span className="column-count-badge">{readyOrders.length}</span>
            </div>
            <div className="column-cards-container">
              {readyOrders.map(order => renderOrderCard(order))}
              {readyOrders.length === 0 && (
                <div className="column-empty-state">
                  <p>No orders ready yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
