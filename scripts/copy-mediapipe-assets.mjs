// Copies MediaPipe's WASM runtime out of node_modules into public/ so the app
// serves it from its own origin. Nothing is fetched from a CDN at runtime,
// and camera frames never leave the device.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dest = join(root, 'public/mediapipe/wasm');

if (!existsSync(src)) {
  console.error('MediaPipe wasm not found; run npm install first.');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('Copied MediaPipe wasm to public/mediapipe/wasm');
