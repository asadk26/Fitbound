import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS=1 serves over a self-signed certificate so a phone on the same Wi-Fi
// can use the camera (browsers only allow getUserMedia on secure origins).
const https = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  build: {
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      input: { main: 'index.html', lab: 'lab.html' },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
