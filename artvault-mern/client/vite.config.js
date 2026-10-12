import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';

const certificateKey = './certs/localhost-key.pem';
const certificateFile = './certs/localhost.pem';
const localHttps = process.env.ARTVAULT_OFFLINE !== 'true' && existsSync(certificateKey) && existsSync(certificateFile)
  ? { key: readFileSync(certificateKey), cert: readFileSync(certificateFile) }
  : undefined;

export default defineConfig({
  plugins: [react(), {
    name: 'artvault-offline-html',
    transformIndexHtml(html) {
      return process.env.ARTVAULT_OFFLINE === 'true'
        ? html.replace(/^\s*<link data-online-only[^>]*>\s*$/gm, '')
        : html;
    },
  }],
  server: {
    port: 5173,
    ...(localHttps ? { https: localHttps } : {}),
    proxy: {
      '/api': {
        // Keep the local API HTTP behind Vite HTTPS. 127.0.0.1 avoids
        // Windows resolving localhost to IPv6 (::1) while Node listens on
        // IPv4, which causes intermittent ECONNRESET/ECONNREFUSED errors.
        target: `http://127.0.0.1:${process.env.ARTVAULT_OFFLINE === 'true' ? (process.env.ARTVAULT_OFFLINE_API_PORT || '5500') : '5000'}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
