import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Pairing and session bookkeeping for the Connected Play relay — no I/O, so
 * it can be unit-tested.
 *
 *  - The game (host) opens a room and gets a short-lived pairing offer: a
 *    128-bit token (carried in the QR code) and a 6-digit code (typed by
 *    hand). Both expire after PAIRING_TTL_MS and are single-use.
 *  - A phone that presents a valid token or code becomes the room's one
 *    controller and receives a session id plus a secret resume key, so it
 *    can reconnect after a network blip without pairing again.
 *  - Wrong codes are rate-limited per client address, and each offer dies
 *    after MAX_CODE_FAILURES wrong guesses, so the 6-digit code can't be
 *    brute-forced from the LAN.
 */
export const PAIRING_TTL_MS = 2 * 60_000;
export const MAX_CODE_FAILURES = 20;
export const IP_FAILURES_PER_MIN = 5;
export const HOST_GRACE_MS = 2 * 60_000;

const token = (bytes = 16) => randomBytes(bytes).toString('base64url');
const code6 = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export class Rooms {
  constructor({ now = () => Date.now(), makeToken = token, makeCode = code6 } = {}) {
    this.now = now;
    this.makeToken = makeToken;
    this.makeCode = makeCode;
    /** @type {Map<string, any>} */
    this.rooms = new Map();
    /** @type {Map<string, number[]>} */
    this.failures = new Map();
  }

  createRoom() {
    const room = { id: this.makeToken(), hostKey: this.makeToken(), pairing: null, controller: null, hostOnline: true, hostLeftAt: null };
    this.rooms.set(room.id, room);
    this.newPairing(room);
    return room;
  }

  /** A fresh pairing offer. Revokes the current controller: one controller per session. */
  newPairing(room) {
    let code;
    do code = this.makeCode();
    while ([...this.rooms.values()].some((r) => r.pairing?.code === code));
    room.pairing = { token: this.makeToken(), code, expiresAt: this.now() + PAIRING_TTL_MS, failures: 0 };
    const old = room.controller;
    room.controller = null;
    return old;
  }

  resumeHost(roomId, hostKey) {
    const room = typeof roomId === 'string' ? this.rooms.get(roomId) : undefined;
    if (!room || !same(room.hostKey, hostKey)) return null;
    room.hostOnline = true;
    room.hostLeftAt = null;
    return room;
  }

  hostLeft(room) {
    room.hostOnline = false;
    room.hostLeftAt = this.now();
  }

  /** @returns {{ ok: true, room: any, sid: string, key: string } | { ok: false, error: 'rate' | 'invalid' | 'expired' | 'busy' }} */
  join({ token: tok, code }, ip = 'unknown') {
    const now = this.now();
    const recent = (this.failures.get(ip) ?? []).filter((t) => now - t < 60_000);
    this.failures.set(ip, recent);
    if (recent.length >= IP_FAILURES_PER_MIN) return { ok: false, error: 'rate' };

    let room = null;
    for (const r of this.rooms.values()) {
      if (!r.pairing) continue;
      if ((tok && same(r.pairing.token, tok)) || (code && typeof code === 'string' && /^\d{6}$/.test(code) && same(r.pairing.code, code))) {
        room = r;
        break;
      }
    }
    if (!room) {
      recent.push(now);
      // Every open offer counts wrong codes; too many and it is withdrawn.
      if (code) for (const r of this.rooms.values()) if (r.pairing && ++r.pairing.failures >= MAX_CODE_FAILURES) r.pairing = null;
      return { ok: false, error: 'invalid' };
    }
    if (now > room.pairing.expiresAt) {
      room.pairing = null;
      return { ok: false, error: 'expired' };
    }
    if (room.controller) return { ok: false, error: 'busy' };
    // Single use.
    room.pairing = null;
    room.controller = { sid: this.makeToken(12), key: this.makeToken(), online: true };
    return { ok: true, room, sid: room.controller.sid, key: room.controller.key };
  }

  resumeController(sid, key) {
    for (const room of this.rooms.values()) {
      const c = room.controller;
      if (c && same(c.sid, sid) && same(c.key, key)) {
        c.online = true;
        return room;
      }
    }
    return null;
  }

  controllerLeft(room, sid) {
    if (room.controller && room.controller.sid === sid) room.controller.online = false;
  }

  /** Drop rooms whose host has been gone too long, and stale offers. */
  sweep() {
    const now = this.now();
    for (const [id, r] of this.rooms) {
      if (!r.hostOnline && r.hostLeftAt !== null && now - r.hostLeftAt > HOST_GRACE_MS) this.rooms.delete(id);
      else if (r.pairing && now > r.pairing.expiresAt) r.pairing = null;
    }
    for (const [ip, ts] of this.failures) if (!ts.some((t) => now - t < 60_000)) this.failures.delete(ip);
  }
}
