import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';

const certificateKey = './certs/localhost-key.pem';
const certificateFile = './certs/localhost.pem';
const localHttps = existsSync(certificateKey) && existsSync(certificateFile)
  ? { key: readFileSync(certificateKey), cert: readFileSync(certificateFile) }
  : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    ...(localHttps ? { https: localHttps } : {}),
    proxy: {
      '/api': {
        // Keep the local API HTTP behind Vite HTTPS. 127.0.0.1 avoids
        // Windows resolving localhost to IPv6 (::1) while Node listens on
        // IPv4, which causes intermittent ECONNRESET/ECONNREFUSED errors.
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
