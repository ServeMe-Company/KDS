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

export function getKitchenOrders() {
  return apiFetch<KitchenOrder[]>("/api/kitchen/orders");
}

export function getKitchenOrderById(orderId: string) {
  return apiFetch<KitchenOrder>(`/api/kitchen/orders/${encodeURIComponent(orderId)}`);
}


export function updateKitchenOrderStatus(
  orderId: string,
  status: string,
) {
  return apiFetch<KitchenOrder>(
    `/api/kitchen/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}
