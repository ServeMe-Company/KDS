import { apiFetch } from "./client";

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  tableId?: string;
  tableNumber?: number;
  tableName?: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
  total: number;
  status: string;
  notes?: string;
  createdAt?: string;
}

// Fetch kitchen orders with multi-endpoint fallback
export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  try {
    return await apiFetch<KitchenOrder[]>("/api/kitchen/orders");
  } catch {
    try {
      return await apiFetch<KitchenOrder[]>("/api/orders");
    } catch {
      return await apiFetch<KitchenOrder[]>("/orders");
    }
  }
}

export async function getKitchenOrderById(orderId: string): Promise<KitchenOrder> {
  try {
    return await apiFetch<KitchenOrder>(`/api/kitchen/orders/${encodeURIComponent(orderId)}`);
  } catch {
    return await apiFetch<KitchenOrder>(`/orders/${encodeURIComponent(orderId)}`);
  }
}

// Update order status with universal (PATCH / PUT / POST) multi-endpoint adapter
export async function updateKitchenOrderStatus(
  orderId: string,
  status: string,
): Promise<KitchenOrder> {
  const encId = encodeURIComponent(orderId);
  const body = JSON.stringify({ status });

  const routes = [
    `/api/kitchen/orders/${encId}/status`,
    `/orders/${encId}/status`,
    `/api/orders/${encId}/status`
  ];

  const methods = ["PATCH", "PUT", "POST"];

  for (const route of routes) {
    for (const method of methods) {
      try {
        return await apiFetch<KitchenOrder>(route, { method, body });
      } catch {
        // Try next method/route variant
      }
    }
  }

  throw new Error(`Failed to update status for order ${orderId}`);
}
