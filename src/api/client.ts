import { API_URL } from "../config";

const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
export const API_BASE_URL =
  (envUrl && !envUrl.includes(':3000') && !envUrl.includes('localhost'))
    ? envUrl
    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : window.location.origin;

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

  // Do not send Content-Type header on GET/HEAD requests to prevent CORS preflight blocks
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
