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

// Fetch kitchen orders from /api/kitchen/orders
export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  return await apiFetch<KitchenOrder[]>("/api/kitchen/orders");
}

export async function getKitchenOrderById(orderId: string): Promise<KitchenOrder> {
  return await apiFetch<KitchenOrder>(`/api/kitchen/orders/${encodeURIComponent(orderId)}`);
}

// Update order kitchen status at /api/kitchen/orders/:orderId/status
export async function updateKitchenOrderStatus(
  orderId: string,
  status: string,
): Promise<KitchenOrder> {
  return await apiFetch<KitchenOrder>(
    `/api/kitchen/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}
