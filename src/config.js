const getBackendUrls = () => {
  const hostname = window.location.hostname;
  
  const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

  if (envApiUrl) {
    const secure = envApiUrl.startsWith('https');
    const wsProto = secure ? 'wss' : 'ws';
    const cleanHost = envApiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return {
      api: envApiUrl,
      ws: import.meta.env.VITE_WS_URL || `${wsProto}://${cleanHost}`
    };
  }

  // If running locally on localhost, connect to local dev server 8000
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return {
      api: 'http://localhost:8000',
      ws: 'ws://localhost:8000'
    };
  }

  // Default production fallback for standalone KDS (points to live Vendor backend)
  return {
    api: 'https://vendor.serveme.in',
    ws: 'wss://vendor.serveme.in'
  };
};

const urls = getBackendUrls();

export const API_URL = urls.api;
export const WS_URL = urls.ws;
export const QR_MENU_BASE_URL = 'https://qr-menu.serveme.in';
export const VENDOR_BASE_URL = 'https://vendor.serveme.in';
export const IS_MISSING_CONFIG = false;
