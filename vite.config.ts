import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS=1 serves over a self-signed certificate so a phone on the same Wi-Fi
// can use the camera (browsers only allow getUserMedia on secure origins).
const https = process.env.HTTPS === '1';

/**
 * Production pages may only open network connections to their own origin.
 * The pose model and WASM are served locally, so this changes nothing for the
 * game — but it blocks the usage telemetry that MediaPipe's library posts to
 * Google every minute (it has no switch to turn it off). Dev builds skip it so
 * hot reload's websocket keeps working.
 */
const csp: Plugin = {
  name: 'fitbound-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="connect-src 'self'" />`),
};

export default defineConfig({
  plugins: [react(), csp, ...(https ? [basicSsl()] : [])],
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
