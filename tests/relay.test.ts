import { describe, expect, it } from 'vitest';
import { IP_FAILURES_PER_MIN, MAX_CODE_FAILURES, PAIRING_TTL_MS, Rooms } from '../server/rooms.mjs';

function rooms() {
  let t = 1_000_000;
  let n = 0;
  const r = new Rooms({ now: () => t, makeToken: () => `tok${++n}`, makeCode: () => String(100000 + n) });
  return { r, advance: (ms: number) => (t += ms) };
}

describe('relay pairing', () => {
  it('a phone pairs with the QR token, and the token works only once', () => {
    const { r } = rooms();
    const room = r.createRoom();
    const tok = room.pairing!.token;
    const a = r.join({ token: tok }, '10.0.0.2');
    expect(a.ok).toBe(true);
    expect(room.pairing).toBeNull();
    expect(r.join({ token: tok }, '10.0.0.3')).toEqual({ ok: false, error: 'invalid' });
  });

  it('a phone can pair with the 6-digit code instead', () => {
    const { r } = rooms();
    const room = r.createRoom();
    expect(r.join({ code: room.pairing!.code }, '10.0.0.2').ok).toBe(true);
  });

  it('pairing offers expire', () => {
    const { r, advance } = rooms();
    const room = r.createRoom();
    advance(PAIRING_TTL_MS + 1);
    expect(r.join({ token: room.pairing!.token })).toEqual({ ok: false, error: 'expired' });
  });

  it('one controller per session: a new offer revokes the old controller', () => {
    const { r } = rooms();
    const room = r.createRoom();
    const first = r.join({ token: room.pairing!.token });
    expect(first.ok).toBe(true);
    const old = r.newPairing(room);
    expect(old?.sid).toBe(first.ok ? first.sid : '');
    expect(first.ok && r.resumeController(first.sid, first.key)).toBeNull();
    expect(r.join({ token: room.pairing!.token }).ok).toBe(true);
  });

  it('a paired phone can resume only with its secret key', () => {
    const { r } = rooms();
    const room = r.createRoom();
    const j = r.join({ token: room.pairing!.token });
    if (!j.ok) throw new Error('join failed');
    r.controllerLeft(room, j.sid);
    expect(r.resumeController(j.sid, 'wrong')).toBeNull();
    expect(r.resumeController(j.sid, j.key)).toBe(room);
  });

  it('wrong codes are rate-limited per device and eventually withdraw the offer', () => {
    const { r } = rooms();
    const room = r.createRoom();
    for (let i = 0; i < IP_FAILURES_PER_MIN; i++) expect(r.join({ code: '000000' }, '10.0.0.9').ok).toBe(false);
    // Even the right code is refused from a device that has been guessing.
    expect(r.join({ code: room.pairing!.code }, '10.0.0.9')).toEqual({ ok: false, error: 'rate' });
    // Many devices guessing together kill the offer.
    for (let i = 0; i < MAX_CODE_FAILURES; i++) r.join({ code: '000001' }, `10.1.${i}.1`);
    expect(room.pairing).toBeNull();
  });

  it('only the host key resumes a room', () => {
    const { r } = rooms();
    const room = r.createRoom();
    r.hostLeft(room);
    expect(r.resumeHost(room.id, 'nope')).toBeNull();
    expect(r.resumeHost(room.id, room.hostKey)).toBe(room);
  });
});
