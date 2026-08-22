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

// Fetch kitchen orders with multi-endpoint fallback for vendor.serveme.in
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

// Update order status with multi-endpoint fallback for vendor.serveme.in
export async function updateKitchenOrderStatus(
  orderId: string,
  status: string,
): Promise<KitchenOrder> {
  try {
    return await apiFetch<KitchenOrder>(
      `/api/kitchen/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    );
  } catch {
    try {
      return await apiFetch<KitchenOrder>(
        `/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
    } catch {
      return await apiFetch<KitchenOrder>(
        `/api/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
    }
  }
}
