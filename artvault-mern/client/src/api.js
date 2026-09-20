import axios from 'axios';

// Local development goes through Vite's proxy. Deployed builds call Render
// directly. This keeps one checked-out client working in both environments,
// even if an old Vercel variable accidentally contains comma-separated URLs.
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const hostname = window.location.hostname;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
const deployedApiUrl = 'https://artvault-art-gallery-management.onrender.com/api';
const apiBaseUrl = isLocal
  ? '/api'
  : (configuredApiUrl && !configuredApiUrl.includes(',') ? configuredApiUrl : deployedApiUrl);

const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('artvault_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
