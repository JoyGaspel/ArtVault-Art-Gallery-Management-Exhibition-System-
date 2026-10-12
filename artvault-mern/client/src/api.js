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

// Fail predictably when the API is offline instead of leaving pages on an
// indefinite loading state.
const api = axios.create({ baseURL: apiBaseUrl, timeout: 12000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('artvault_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((response) => {
  const method = (response.config?.method || 'get').toLowerCase();
  const path = response.config?.url || '';
  // A successful content change refreshes the open page and other tabs.
  // Auth and notification read receipts do not change displayed collections.
  if (['post', 'put', 'patch', 'delete'].includes(method)
    && /^\/(artworks|artists|exhibits|exhibit-entries|archives|likes|admin-profiles)(\/|\?|$)/.test(path)) {
    window.dispatchEvent(new Event('artvault:data-changed'));
    try { localStorage.setItem('artvault:data-version', `${Date.now()}:${Math.random()}`); } catch { /* Storage is optional. */ }
  }
  return response;
});

export default api;
