#!/usr/bin/env node
/**
 * FITBOUND Connected Play relay.
 *
 * One small process on the PC that:
 *   - serves the built game to the PC browser at http://localhost:8080
 *     (loopback only; localhost is a secure context, so no certificate
 *     warning on the PC),
 *   - serves the same build over HTTPS on the LAN (default :8443) so the
 *     phone's browser is allowed to use its camera,
 *   - relays small JSON messages between the game and the one paired phone
 *     over WebSockets (ws:// on loopback, wss:// on the LAN).
 *
 * No camera images ever pass through here — the phone only sends interpreted
 * movements and exercise events. Only a loopback client may host a game; a
 * phone must present the short-lived pairing token or code; and WebSocket
 * upgrades from any other web origin are refused.
 *
 *   npm run play            build, then start this server
 *   npm run relay           start it with the existing build
 *
 * Environment:
 *   FITBOUND_PORT=8080          PC (loopback) port
 *   FITBOUND_HTTPS_PORT=8443    phone (LAN) port
 *   FITBOUND_CERT / FITBOUND_KEY  PEM files to use instead of the built-in
 *                               self-signed certificate (e.g. from mkcert);
 *                               certs/cert.pem + certs/key.pem are picked up
 *                               automatically.
 *   FITBOUND_PUBLIC_URL         an extra phone URL to offer (e.g. a tunnel)
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Rooms } from './rooms.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(process.env.FITBOUND_DIST ?? path.join(ROOT, 'dist'));
const LOCAL_PORT = Number(process.env.FITBOUND_PORT) || 8080;
const HTTPS_PORT = Number(process.env.FITBOUND_HTTPS_PORT) || 8443;
const PUBLIC_URL = process.env.FITBOUND_PUBLIC_URL?.replace(/\/+$/, '') || null;
const MAX_MSG_BYTES = 16 * 1024;

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error(`No build found in ${DIST}. Run "npm run build" first (or use "npm run play").`);
  process.exit(1);
}

// ── Addresses ─────────────────────────────────────────────────────────────
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // Skip common virtual adapters (Docker, VirtualBox, WSL) where we can tell.
      if (/^(docker|br-|veth|vbox|vmnet|virbr)/i.test(name)) continue;
      out.push(a.address);
    }
  }
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return out.sort((a, b) => rank(a) - rank(b));
}

function phoneUrls() {
  const urls = lanAddresses().map((ip) => `https://${ip}:${HTTPS_PORT}/controller.html`);
  if (PUBLIC_URL) urls.unshift(`${PUBLIC_URL}/controller.html`);
  return urls;
}

const isLoopback = (ip) => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

// ── TLS ───────────────────────────────────────────────────────────────────
async function tlsOptions() {
  const pick = (a, b) => (a && b && fs.existsSync(a) && fs.existsSync(b) ? { cert: fs.readFileSync(a), key: fs.readFileSync(b), kind: `certificate from ${a}` } : null);
  const own = pick(process.env.FITBOUND_CERT, process.env.FITBOUND_KEY) ?? pick(path.join(ROOT, 'certs/cert.pem'), path.join(ROOT, 'certs/key.pem'));
  if (own) return own;
  // A self-signed certificate, generated once and cached (never committed).
  const { getCertificate } = await import('@vitejs/plugin-basic-ssl');
  const pem = await getCertificate(path.join(ROOT, '.certs'), 'fitbound.local', ['localhost', ...lanAddresses()], 90);
  return { cert: pem, key: pem, kind: 'self-signed certificate (your phone will show a warning once)' };
}

// ── Static files ──────────────────────────────────────────────────────────
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};

const hostHeader = (req) => {
  const h = String(req.headers.host ?? '');
  return /^[A-Za-z0-9.\-:[\]]{1,255}$/.test(h) ? h : null;
};

function serveStatic(req, res, secure) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  if (pathname === '/controller') pathname = '/controller.html';
  const file = path.resolve(DIST, '.' + pathname);
  if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const headers = {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=()',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
  };
  if (ext === '.html') {
    const host = hostHeader(req);
    if (!host) {
      res.writeHead(400).end();
      return;
    }
    // Allow exactly this origin's own relay socket, nothing else.
    const ws = `${secure ? 'wss' : 'ws'}://${host}`;
    const html = fs.readFileSync(file, 'utf8').replace(`connect-src 'self'`, `connect-src 'self' ${ws}`);
    headers['Content-Security-Policy'] = `connect-src 'self' ${ws}; frame-ancestors 'none'`;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : html);
    return;
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
}

// ── Relay ─────────────────────────────────────────────────────────────────
const rooms = new Rooms();
const hosts = new Map(); // roomId → ws
const ctrls = new Map(); // sid → ws
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG_BYTES });

const send = (ws, obj) => ws && ws.readyState === 1 && ws.send(JSON.stringify(obj));
const pairingInfo = (room) => (room.pairing ? { code: room.pairing.code, token: room.pairing.token, expiresAt: room.pairing.expiresAt, urls: phoneUrls() } : null);

function onUpgrade(secure) {
  return (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const host = hostHeader(req);
    const origin = req.headers.origin;
    // Only pages served by this relay may open a socket (blocks other sites
    // in the same browser from talking to it).
    if (url.pathname !== '/relay' || !host || origin !== `${secure ? 'https' : 'http'}://${host}`) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.ip = req.socket.remoteAddress ?? 'unknown';
      ws.loopback = isLoopback(ws.ip);
      ws.alive = true;
      ws.budget = { at: Date.now(), n: 0 };
      wss.emit('connection', ws, req);
    });
  };
}

wss.on('connection', (ws) => {
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', (data, binary) => {
    if (binary) return;
    // Simple flood guard: ~60 messages a second is far more than a controller sends.
    const now = Date.now();
    if (now - ws.budget.at > 1000) ws.budget = { at: now, n: 0 };
    if (++ws.budget.n > 120) {
      if (ws.budget.n > 600) ws.close(4008, 'rate');
      return;
    }
    let m;
    try {
      m = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!m || typeof m !== 'object' || Array.isArray(m)) return;
    if (typeof m.relay === 'string') handleRelay(ws, m);
    else if (typeof m.type === 'string' && m.type.length <= 32) forward(ws, m);
  });
  ws.on('close', () => {
    if (ws.role === 'host' && hosts.get(ws.room.id) === ws) {
      hosts.delete(ws.room.id);
      rooms.hostLeft(ws.room);
      const c = ws.room.controller && ctrls.get(ws.room.controller.sid);
      send(c, { relay: 'host', state: 'offline' });
    }
    if (ws.role === 'ctrl' && ctrls.get(ws.sid) === ws) {
      ctrls.delete(ws.sid);
      rooms.controllerLeft(ws.room, ws.sid);
      send(hosts.get(ws.room.id), { relay: 'peer', state: 'left', sid: ws.sid });
    }
  });
});

function attachHost(ws, room) {
  const old = hosts.get(room.id);
  if (old && old !== ws) old.close(4002, 'replaced');
  ws.role = 'host';
  ws.room = room;
  hosts.set(room.id, ws);
  const c = room.controller;
  send(ws, { relay: 'room', room: room.id, key: room.hostKey, pairing: pairingInfo(room), controller: c ? { sid: c.sid, online: ctrls.has(c.sid) } : null });
  if (c) send(ctrls.get(c.sid), { relay: 'host', state: 'online' });
}

function handleRelay(ws, m) {
  switch (m.relay) {
    case 'host':
    case 'host-resume': {
      if (!ws.loopback) return send(ws, { relay: 'error', code: 'not-local', message: 'The game must run on the same computer as the relay.' });
      const room = (m.relay === 'host-resume' && rooms.resumeHost(m.room, m.key)) || rooms.createRoom();
      return attachHost(ws, room);
    }
    case 'repair': {
      if (ws.role !== 'host') return;
      const old = rooms.newPairing(ws.room);
      if (old) ctrls.get(old.sid)?.close(4001, 'replaced');
      return send(ws, { relay: 'pairing', pairing: pairingInfo(ws.room) });
    }
    case 'join': {
      if (ws.role) return;
      const res = rooms.join({ token: m.token, code: m.code }, ws.ip);
      if (!res.ok) {
        send(ws, { relay: 'error', code: res.error, message: joinError(res.error) });
        // Too many wrong codes withdraw an offer: tell its game so it can show a new one.
        for (const [id, h] of hosts) {
          const room = rooms.rooms.get(id);
          if (room && !room.pairing && !room.controller) send(h, { relay: 'pairing', pairing: null });
        }
        return;
      }
      ws.role = 'ctrl';
      ws.room = res.room;
      ws.sid = res.sid;
      ctrls.set(res.sid, ws);
      send(ws, { relay: 'joined', sid: res.sid, key: res.key });
      send(ws, { relay: 'host', state: hosts.has(res.room.id) ? 'online' : 'offline' });
      send(hosts.get(res.room.id), { relay: 'peer', state: 'joined', sid: res.sid });
      send(hosts.get(res.room.id), { relay: 'pairing', pairing: null });
      return;
    }
    case 'resume': {
      if (ws.role) return;
      const room = rooms.resumeController(m.sid, m.key);
      if (!room) return send(ws, { relay: 'error', code: 'session', message: 'This controller session has ended. Scan the new code on the TV.' });
      const old = ctrls.get(m.sid);
      if (old && old !== ws) old.close(4002, 'replaced');
      ws.role = 'ctrl';
      ws.room = room;
      ws.sid = m.sid;
      ctrls.set(m.sid, ws);
      send(ws, { relay: 'resumed', sid: m.sid });
      send(ws, { relay: 'host', state: hosts.has(room.id) ? 'online' : 'offline' });
      send(hosts.get(room.id), { relay: 'peer', state: 'resumed', sid: m.sid });
      return;
    }
  }
}

function joinError(code) {
  return (
    {
      rate: 'Too many wrong codes. Wait a minute and try again.',
      invalid: 'That code isn’t valid. Check the code on the TV.',
      expired: 'That code has expired. The TV will show a new one.',
      busy: 'A controller is already connected to this game.',
    }[code] ?? 'Could not join.'
  );
}

function forward(ws, m) {
  if (ws.role === 'host') {
    const c = ws.room.controller;
    if (c) send(ctrls.get(c.sid), { relay: 'msg', msg: m });
  } else if (ws.role === 'ctrl' && ws.room.controller?.sid === ws.sid) {
    send(hosts.get(ws.room.id), { relay: 'msg', sid: ws.sid, msg: m });
  }
}

// Liveness: drop sockets that stop answering pings, and expire old rooms.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
  rooms.sweep();
}, 5000).unref();

// ── Servers ───────────────────────────────────────────────────────────────
const local = http.createServer((req, res) => serveStatic(req, res, false));
local.on('upgrade', onUpgrade(false));
local.listen(LOCAL_PORT, '127.0.0.1');

const tls = await tlsOptions();
const lan = https.createServer({ cert: tls.cert, key: tls.key }, (req, res) => serveStatic(req, res, true));
lan.on('upgrade', onUpgrade(true));
lan.listen(HTTPS_PORT, '0.0.0.0');

const urls = phoneUrls();
console.log(`
  FITBOUND Connected Play
  ───────────────────────
  On this PC (show it on the TV):  http://localhost:${LOCAL_PORT}
  Phone controller:                ${urls[0] ?? '(no network address found — is Wi-Fi connected?)'}
${urls
  .slice(1)
  .map((u) => `                                   ${u}`)
  .join('\n')}
  HTTPS uses a ${tls.kind}.
  Choose "Connected Play" on the PC and scan the QR code with the phone.
  Press Ctrl+C to stop.
`);
