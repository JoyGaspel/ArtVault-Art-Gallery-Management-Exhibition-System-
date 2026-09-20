import axios from 'axios';

// Local development goes through Vite's proxy. Deployed builds call Railway
// directly. This keeps one checked-out client working in both environments,
// even if an old Vercel variable accidentally contains comma-separated URLs.
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const hostname = window.location.hostname;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
// Keep a production fallback so an accidentally missing Vercel variable does
// not silently send image/API requests to the retired Render service.
const deployedApiUrl = 'https://artvault-art-gallery-management-exhibition-syste-production.up.railway.app/api';
const configuredIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(configuredApiUrl);
// Production must always use the live Railway backend. This prevents a stale
// Vercel VITE_API_URL (for example an old Render or localhost value) from
// breaking artwork image requests while the rest of the API still appears to load.
const apiBaseUrl = isLocal ? '/api' : deployedApiUrl;

const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('artvault_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
