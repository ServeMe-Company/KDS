const getBackendUrls = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  
  // On Vercel preview/production domains (*.vercel.app), backend routes are served on same origin via vercel.json
  if (hostname.includes('vercel.app')) {
    const wsProto = protocol === 'https:' ? 'wss' : 'ws';
    return {
      api: window.location.origin,
      ws: `${wsProto}://${hostname}`
    };
  }

  if (envApiUrl) {
    const secure = envApiUrl.startsWith('https');
    const wsProto = secure ? 'wss' : 'ws';
    const cleanHost = envApiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return {
      api: envApiUrl,
      ws: import.meta.env.VITE_WS_URL || `${wsProto}://${cleanHost}`
    };
  }

  if (hostname.includes('serveme.in')) {
    return {
      api: 'https://vendor.serveme.in',
      ws: 'wss://vendor.serveme.in'
    };
  }

  const apiScheme = protocol === 'https:' ? 'https:' : 'http:';
  const wsScheme = protocol === 'https:' ? 'wss:' : 'ws:';

  return {
    api: `${apiScheme}//${hostname}:8000`,
    ws: `${wsScheme}//${hostname}:8000`
  };
};


const urls = getBackendUrls();

export const API_URL = urls.api;
export const WS_URL = urls.ws;
export const QR_MENU_BASE_URL = 'https://qr-menu.serveme.in';
export const VENDOR_BASE_URL = 'https://vendor.serveme.in';
export const IS_MISSING_CONFIG = false;


