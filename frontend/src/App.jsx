import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import { API_URL, IS_MISSING_CONFIG } from './config';
import { io } from 'socket.io-client';

function App() {
  if (IS_MISSING_CONFIG) {
    return (
      <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Backend Connection Required</h2>
        <p style={{ margin: '15px 0' }}>The application is deployed, but the backend API URL has not been configured.</p>
        <p style={{ fontSize: '14px', color: '#888' }}>
          Please add the <code>VITE_API_URL</code> environment variable in your site configuration settings pointing to your backend URL (e.g. <code>https://your-backend-url.com</code>).
        </p>
      </div>
    );
  }

  const [restaurant, setRestaurant] = useState(null);
  const [error, setError] = useState('');
  const [cart, setCart] = useState({});
  const [orderNumber, setOrderNumber] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(1);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const RESTAURANT_ID = Number(params.get('restaurant_id')) || 1;

  // Filter categories to only those containing items matching the search query
  const filteredCategories = useMemo(() => {
    if (!restaurant) return [];
    return restaurant.categories.map((category) => ({
      ...category,
      menu_items: category.menu_items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter((category) => category.menu_items.length > 0);
  }, [restaurant, searchQuery]);

  const DEFAULT_RESTAURANT = {
    id: 1,
    name: "Serve Me",
    categories: [
      {
        id: 1,
        name: "Starter",
        menu_items: [
          { id: 1, name: "French Fries", price: 400.0, image_url: "/images/french_fries.png", is_veg: true, is_spicy: false, tags: "Special", is_available: true, is_active: true, category_name: "Starter" },
          { id: 2, name: "Peri Peri French Fries", price: 180.0, image_url: "/images/french_fries.png", is_veg: true, is_spicy: false, is_available: true, is_active: true, category_name: "Starter" },
          { id: 6, name: "Chilli Paneer", price: 450.0, image_url: "/images/pakoda.png", is_veg: true, is_spicy: false, tags: "Special", is_available: true, is_active: true, category_name: "Starter" },
          { id: 14, name: "Special Garlic Bread", price: 250.0, image_url: null, is_veg: true, is_spicy: false, stock: 10, is_available: true, is_active: true, category_name: "Starter" }
        ]
      }
    ]
  };

  const fetchMenu = useCallback(() => {
    fetch(`${API_URL}/restaurants/${RESTAURANT_ID}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Restaurant ${RESTAURANT_ID} was not found`);
        return res.json();
      })
      .then((data) => {
        setError('');
        if (data && data.categories && data.categories.length > 0) {
          data.categories = data.categories.map(category => ({
            ...category,
            menu_items: category.menu_items.map(item => ({
              ...item,
              category_name: category.name
            }))
          }));
          setRestaurant(data);
          setActiveCategory(data.categories[0].id);
        } else {
          setRestaurant(DEFAULT_RESTAURANT);
          setActiveCategory(1);
        }
      })
      .catch((err) => {
        console.warn("Using fallback menu data:", err.message);
        setError('');
        setRestaurant(DEFAULT_RESTAURANT);
        setActiveCategory(1);
      });
  }, [RESTAURANT_ID]);


  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const [activeOrderId, setActiveOrderId] = useState(() => localStorage.getItem('serveme_active_order_id') || null);
  const [activeOrderDetails, setActiveOrderDetails] = useState(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(true);

  // Poll current order status for live tracking
  const fetchOrderStatus = useCallback(async () => {
    if (!activeOrderId) return;
    try {
      const res = await fetch(`${API_URL}/api/kitchen/orders/${activeOrderId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveOrderDetails({
          ...data,
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
      }
    } catch (err) {
      console.error("Error fetching order status", err);
    }
  }, [activeOrderId]);

  useEffect(() => {
    fetchOrderStatus();
    const interval = setInterval(fetchOrderStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchOrderStatus]);

  useEffect(() => {
    const socket = io(API_URL, {
      path: '/socket.io'
    });

    socket.on('connect', () => {
      console.log('Connected to Socket.io backend');
      socket.emit('join_restaurant', { restaurant_id: RESTAURANT_ID });
    });

    socket.on('menu_update', (data) => {
      if (data === 'UPDATE_MENU') {
        console.log('Real-time menu update received. Refreshing menu.');
        fetchMenu();
      }
    });

    socket.on('order_update', () => {
      console.log('Real-time order status update received. Refreshing active order.');
      fetchOrderStatus();
    });

    return () => {
      socket.disconnect();
    };
  }, [RESTAURANT_ID, fetchMenu, fetchOrderStatus]);

  const handleCheckout = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);

    const params = new URLSearchParams(window.location.search);
    const qrToken = params.get('qr') || 'cfUmnVwm9GB1gD-2YS9e-mdLxgzvdtCh';

    const orderItems = Object.values(cart).map((item) => ({
      menu_item_id: item.id,
      quantity: item.quantity,
      notes: item.notes || null,
    }));

    try {
      const response = await fetch(`${API_URL}/restaurants/${RESTAURANT_ID}/orders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems,
          qr_token: qrToken,
          table_number: 1,
          table_name: 'Table 1'
        }),
      });

      if (!response.ok) {
        throw new Error("Could not submit order. Please try again.");
      }
      const data = await response.json();
      setOrderNumber(data.order_number);
      setActiveOrderId(data.id);
      localStorage.setItem('serveme_active_order_id', String(data.id));
      setCart({});
      setIsCartOpen(false);
      setIsTrackingModalOpen(true);
    } catch (error) {
      console.error("Checkout failed", error);
      alert(error.message || "Place order failed. Check server connection.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Calculate Cart Totals
  const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Determine current active step index for order tracking (1 to 5)
  const getStepIndex = (statusStr) => {
    const s = (statusStr || '').toLowerCase();
    if (s === 'completed') return 5;
    if (s === 'ready') return 4;
    if (s === 'preparing' || s === 'cooking') return 3;
    if (s === 'accepted') return 2;
    return 1; // pending / received
  };

  const currentStep = activeOrderDetails ? getStepIndex(activeOrderDetails.status) : 1;

  const trackingSteps = [
    { step: 1, title: 'Order Received', desc: 'Order received and sent to kitchen' },
    { step: 2, title: 'Accepted', desc: 'Restaurant accepted your order.' },
    { step: 3, title: 'Preparing', desc: 'Chef is preparing your food.' },
    { step: 4, title: 'Ready', desc: 'Your order is ready. A waiter is bringing it to your table.' },
    { step: 5, title: 'Completed', desc: 'Order served' },
  ];

  const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const formattedOrderBadge = activeOrderDetails?.orderNumber
    ? `#SM-${dateTag}-${String(activeOrderDetails.orderNumber).replace(/^ORD-/, '')}`
    : (orderNumber ? `#SM-${dateTag}-${String(orderNumber).padStart(4, '0')}` : '#SM-ORDER');

  // Show Live Order Tracking modal if active
  const renderTrackingModal = () => {
    if (!activeOrderId || !isTrackingModalOpen) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div style={{
          background: '#ffffff',
          color: '#1e293b',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setIsTrackingModalOpen(false)}
                style={{
                  background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  fontSize: '16px', color: '#64748b'
                }}
              >
                ←
              </button>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Live Order Tracking</h2>
            </div>
            <span style={{
              background: '#ef4444', color: '#ffffff', fontSize: '11px', fontWeight: 800,
              padding: '6px 12px', borderRadius: '20px', letterSpacing: '0.5px'
            }}>
              {formattedOrderBadge}
            </span>
          </div>

          {/* Dine-in Table & Estimated Time Banner */}
          <div style={{
            background: '#0f172a', borderRadius: '16px', padding: '16px 20px', color: '#ffffff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                DINE-IN TABLE
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#facc15', marginTop: '2px' }}>
                {activeOrderDetails?.tableName || (activeOrderDetails?.tableNumber ? `Table #${String(activeOrderDetails.tableNumber).padStart(2, '0')}` : 'Table #01')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                ESTIMATED TIME
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ⏱️ 20–30 min
              </div>
            </div>
          </div>

          {/* Vertical Stepper */}
          <div style={{ position: 'relative', paddingLeft: '8px', marginBottom: '24px' }}>
            {trackingSteps.map((s, idx) => {
              const isPast = s.step < currentStep;
              const isCurrent = s.step === currentStep;
              const isLast = idx === trackingSteps.length - 1;

              return (
                <div key={s.step} style={{ display: 'flex', position: 'relative', paddingBottom: isLast ? '0' : '28px' }}>
                  {/* Vertical Line Connector */}
                  {!isLast && (
                    <div style={{
                      position: 'absolute',
                      left: '19px',
                      top: '36px',
                      bottom: 0,
                      width: '2px',
                      background: isPast ? '#ef4444' : '#e2e8f0'
                    }} />
                  )}

                  {/* Step Icon / Circle */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '14px',
                    zIndex: 2,
                    marginRight: '16px',
                    flexShrink: 0,
                    background: isCurrent ? '#ef4444' : (isPast ? '#ef4444' : '#f8fafc'),
                    color: (isCurrent || isPast) ? '#ffffff' : '#94a3b8',
                    border: (isCurrent || isPast) ? 'none' : '2px solid #e2e8f0',
                    boxShadow: isCurrent ? '0 0 16px rgba(239, 68, 68, 0.4)' : 'none'
                  }}>
                    {isCurrent ? '🔥' : (isPast ? '✓' : s.step)}
                  </div>

                  {/* Step Content */}
                  <div style={{ flex: 1, paddingTop: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 800,
                        color: (isCurrent || isPast) ? '#0f172a' : '#94a3b8'
                      }}>
                        {s.title}
                      </h4>
                      {isCurrent && (
                        <span style={{
                          background: '#fef2f2', color: '#ef4444', fontSize: '10px',
                          fontWeight: 800, padding: '2px 8px', borderRadius: '12px',
                          border: '1px solid #fca5a5'
                        }}>
                          IN PROGRESS
                        </span>
                      )}
                    </div>
                    <p style={{
                      margin: '4px 0 0 0',
                      fontSize: '13px',
                      color: isCurrent ? '#475569' : (isPast ? '#64748b' : '#cbd5e1'),
                      lineHeight: 1.4
                    }}>
                      {s.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '8px'
          }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🔄 Updated at {activeOrderDetails?.updatedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={() => setIsTrackingModalOpen(false)}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
              }}
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="loading">
        {error}. Try <strong>?restaurant_id=1</strong> or create this restaurant first.
      </div>
    );
  }

  if (!restaurant) return <div className="loading">Loading Menu...</div>;

  return (
    <div className="app-container">
      {/* Live Order Tracking Modal */}
      {renderTrackingModal()}

      {/* Header */}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>{restaurant.name}</h1>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '2px', fontWeight: 500 }}>
            ✨ Table Service
          </p>
        </div>
        {activeOrderId && (
          <button
            onClick={() => setIsTrackingModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '20px',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔥 Track Order
          </button>
        )}
      </header>


      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="🔍  Search delicious dishes..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      <div className="main-content-layout">
        {/* Horizontal/Vertical Categories Menu */}
        <div className="categories-nav">
          {restaurant.categories.map((cat) => (
            <a
              key={cat.id}
              href={`#category-${cat.id}`}
              className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={(e) => handleCategoryClick(e, cat.id)}
            >
              {cat.name}
            </a>
          ))}
        </div>

        {/* Menu Items List */}
        <main className="menu-list">
          {restaurant.categories
            .filter((category) => category.id === activeCategory)
            .map((category) => {
              const matchingItems = category.menu_items.filter((item) =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
              );
              
              return (
                <div key={category.id} className="category-section">
                  <h2 className="category-title">{category.name}</h2>
                  {category.menu_items.length === 0 ? (
                    <div className="empty-category-state" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#94a3b8'
                    }}>
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="#0070c0" style={{ marginBottom: '8px' }}>
                        <rect x="1" y="4" width="13" height="11" rx="1" />
                        <path d="M14 7h4.5a1.5 1.5 0 0 1 1.2.6l2.1 2.8c.2.3.3.6.3 1v3.6h-8.1V7z" />
                        <rect x="15.5" y="8.5" width="4.5" height="3" rx="0.5" fill="#94a3b8" />
                        <circle cx="5" cy="17" r="2.5" fill="#0070c0" />
                        <circle cx="5" cy="17" r="0.9" fill="#ffffff" />
                        <circle cx="17" cy="17" r="2.5" fill="#0070c0" />
                        <circle cx="17" cy="17" r="0.9" fill="#ffffff" />
                      </svg>
                      <p style={{ fontSize: '13px', fontWeight: 600 }}>This category is empty</p>
                      <p style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>No items listed in this category yet</p>
                    </div>
                  ) : matchingItems.length === 0 ? (
                    <div className="empty-category-state" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#94a3b8'
                    }}>
                      <span style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</span>
                      <p style={{ fontSize: '13px', fontWeight: 600 }}>No items matching "{searchQuery}"</p>
                      <p style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Try searching in another category or clear the query</p>
                    </div>
                  ) : (
                    <div className="menu-items-grid">
                      {matchingItems.map((item) => (
                        <div key={item.id} className="menu-item-card">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="item-thumbnail" />
                          ) : (
                            <div className="item-thumbnail placeholder-thumbnail">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: '#64748b' }}>
                                <path d="M3 18h18" />
                                <path d="M5 18a7 7 0 0 1 14 0H5z" fill="rgba(100, 116, 139, 0.1)" />
                                <circle cx="12" cy="10" r="1" />
                              </svg>
                            </div>
                          )}
                          <div className="item-details">
                            <div className="item-title-row">
                              {item.is_veg !== undefined && (
                                <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`}>
                                  <span className="dot"></span>
                                </span>
                              )}
                              <h3 className="item-name">{item.name}</h3>
                              {item.is_spicy && <span className="spicy-icon" title="Spicy">🌶️</span>}
                            </div>
                            <p className="item-price">₹{item.price}</p>
                            {item.description && <p className="item-desc">{item.description}</p>}
                            
                            {item.stock !== undefined && item.stock !== null && item.stock > 0 && item.stock <= 5 && (
                              <p className="low-stock-warning">⚠️ Only {item.stock} left!</p>
                            )}
                            {item.stock !== undefined && item.stock !== null && item.stock <= 0 && (
                              <p className="out-of-stock-warning">🚫 Out of stock</p>
                            )}

                            {cart[item.id] && !(item.category_name && (item.category_name.toLowerCase() === 'drinks' || item.category_name.toLowerCase() === 'beverages')) && (
                              <div className="instructions-area">
                                <div className="quick-notes-container">
                                  {['🌶️ Spicy', '🚫 No Onion', '🚫 No Garlic', '🧀 More Cheese', '🧂 Less Salt'].map((option) => {
                                    const isSelected = (cart[item.id].notes || '').includes(option);
                                    return (
                                      <button
                                        key={option}
                                        className={`quick-note-chip ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleQuickNote(item.id, option)}
                                      >
                                        {option}
                                      </button>
                                    );
                                  })}
                                </div>
                                <input
                                  type="text"
                                  className="cart-item-notes-input"
                                  placeholder="Or type other instructions..."
                                  value={cart[item.id].notes || ''}
                                  onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                          
                          <div className="item-action-area">
                            {item.stock !== undefined && item.stock !== null && item.stock <= 0 ? (
                              <button className="add-btn out-of-stock" disabled>
                                Out of Stock
                              </button>
                            ) : cart[item.id] ? (
                              <div className="quantity-control">
                                <button className="qty-btn" onClick={() => removeFromCart(item.id)}>-</button>
                                <span className="qty-text">{cart[item.id].quantity}</span>
                                <button 
                                  className="qty-btn" 
                                  onClick={() => addToCart(item)}
                                  disabled={item.stock !== undefined && item.stock !== null && cart[item.id].quantity >= item.stock}
                                >+</button>
                              </div>
                            ) : (
                              <button className="add-btn" onClick={() => addToCart(item)}>
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </main>
      </div>

      {/* Sticky Cart Footer with Collapsible Drawer */}
      {totalItems > 0 && (
        <>
          {isCartOpen && (
            <div className="cart-drawer-overlay" onClick={() => setIsCartOpen(false)} style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 90
            }}>
              <div className="cart-drawer" onClick={(e) => e.stopPropagation()} style={{
                position: 'fixed',
                bottom: '108px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'calc(100% - 32px)',
                maxWidth: '560px',
                background: '#ffffff',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 -10px 30px rgba(0,0,0,0.1), 0 20px 40px rgba(0,0,0,0.2)',
                border: '1px solid rgba(0,0,0,0.05)',
                zIndex: 95,
                maxHeight: '60vh',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f5f5f4', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Review Your Order</h3>
                  <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#a8a29e', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.values(cart).map((item) => (
                    <div key={item.id} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid #faf9f6', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="quantity-control" style={{ height: '30px' }}>
                            <button className="qty-btn" style={{ width: '28px' }} onClick={() => removeFromCart(item.id)}>-</button>
                            <span className="qty-text" style={{ fontSize: '12px' }}>{item.quantity}</span>
                            <button className="qty-btn" style={{ width: '28px' }} onClick={() => addToCart(item)} disabled={item.stock !== undefined && item.stock !== null && item.quantity >= item.stock}>+</button>
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>₹{item.price * item.quantity}</span>
                      </div>
                      {!(item.category_name && (item.category_name.toLowerCase() === 'drinks' || item.category_name.toLowerCase() === 'beverages')) && (
                        <div className="instructions-area">
                          <div className="quick-notes-container">
                            {['🌶️ Spicy', '🚫 No Onion', '🚫 No Garlic', '🧀 More Cheese', '🧂 Less Salt'].map((option) => {
                              const isSelected = (item.notes || '').includes(option);
                              return (
                                <button
                                  key={option}
                                  className={`quick-note-chip ${isSelected ? 'selected' : ''}`}
                                  onClick={() => toggleQuickNote(item.id, option)}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                          <input
                            type="text"
                            className="cart-item-notes-input"
                            placeholder="Or type other instructions..."
                            value={item.notes || ''}
                            onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="sticky-footer" onClick={() => setIsCartOpen(!isCartOpen)}>
            <div className="cart-summary">
              <span>{totalItems} Item{totalItems > 1 ? 's' : ''} • {isCartOpen ? 'Tap to Close' : 'Tap to Review'}</span>
              <span>₹{totalPrice}</span>
            </div>
            <button
              className="checkout-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleCheckout();
              }}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
