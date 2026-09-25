import { describe, expect, it } from 'vitest';
import { ControllerGate } from '../src/net/gate';
import { LatencyStats } from '../src/net/latency';
import { parseCtrlMsg, parseGameMsg } from '../src/net/protocol';

describe('measuring phone → PC delay', () => {
  it('estimates the clock offset from pings and the travel time of stamped messages', () => {
    const l = new LatencyStats();
    // Phone clock runs 5000 ms ahead of the PC; each way takes 20 ms (one noisy ping).
    for (const [t, oneWay] of [
      [1000, 20],
      [4000, 20],
      [7000, 90],
    ])
      l.pong(t, t + oneWay + 5000, t + 2 * oneWay);
    expect(l.offset()).toBeCloseTo(5000);
    // A dodge reading sent at PC time 8000 (phone 13000) arrives 35 ms later.
    l.event('dodge', 13_000, 8035);
    l.event('dodge', 13_100, 8130);
    const s = l.summary();
    expect(s.rtt).toMatchObject({ median: 40, n: 3 });
    expect(s.events.dodge.median).toBeGreaterThanOrEqual(30);
    expect(l.text()).toContain('round trip 40 ms');
    expect(l.text()).toContain('dodge readings arrive');
  });

  it('ignores nonsense and says nothing before any ping', () => {
    const l = new LatencyStats();
    l.event('rep', 100, 200);
    expect(l.summary().events).toEqual({});
    expect(l.text()).toBe('');
    l.pong(1000, 5, 900);
    expect(l.summary().rtt).toBeNull();
  });

  it('the wire format is validated, and a pong is harmless in any mode', () => {
    expect(parseGameMsg({ type: 'PING', id: 3, t: 1234.5 })).toEqual({ type: 'PING', id: 3, t: 1234.5 });
    expect(parseGameMsg({ type: 'PING', id: -1, t: 1 })).toBeNull();
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'PONG', id: 3, t: 1, at: 2 })).toMatchObject({ type: 'PONG', at: 2 });
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'PONG', id: 3, t: 1, at: 'soon' })).toBeNull();
    // A malformed stamp is dropped, the message itself still counts.
    const d = parseCtrlMsg({ seq: 2, epoch: 0, type: 'DODGE_STATUS', tracking: 'good', baseline: true, ducking: false, duck: 0, hops: 0, at: -5 });
    expect(d).not.toBeNull();
    expect(d && 'at' in d).toBe(false);
    const gate = new ControllerGate();
    gate.bind('s1');
    const pong = parseCtrlMsg({ seq: 5, epoch: 9, type: 'PONG', id: 1, t: 1, at: 2 })!;
    expect(gate.check('s1', pong, { mode: 'exercise', epoch: 1 } as never).ok).toBe(true);
  });
});
