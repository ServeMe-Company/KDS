import { API_URL } from "../config";

const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL = (envUrl && !envUrl.includes('localhost'))
  ? envUrl
  : (API_URL || 'https://vendor.serveme.in');

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  const url = `${baseUrl}${endpoint}`;
  const method = (options?.method || 'GET').toUpperCase();

  const headers: Record<string, string> = {
    "Accept": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };

  if (method !== 'GET' && method !== 'HEAD') {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}
