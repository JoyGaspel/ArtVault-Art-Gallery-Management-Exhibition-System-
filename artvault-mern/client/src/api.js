import axios from 'axios';

// In local development Vite proxies /api to the Express server. On Netlify,
// point VITE_API_URL at the deployed Express API (for example https://api.example.com/api).
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('artvault_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
