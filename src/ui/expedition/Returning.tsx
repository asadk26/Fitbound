import { useEffect, useState } from 'react';
import { FAMILIES, FAMILY_INFO, getExercise, targetLabel, type Family } from '../../exercise/registry';
import { audio } from '../../game/audio';
import { getSave } from '../../game/store';
import { input } from '../../input/InputHub';
import type { ExpeditionState } from '../../rpg/expedition';
import { alternatives, eligibility, restingSore, setTarget, SORE_AREAS, type DayPrefs, type ExLoadout, type Soreness } from '../../rpg/loadout';
import { useInputEvents } from '../motionUi';

/**
 * Back on another day: a fresh readiness check before anything physical
 * (bible §18). The expedition itself is untouched — the same loadout, fight
 * and progress — but today's feel and soreness set today's targets, and a
 * family you're resting sits out. A single slot can be swapped for another
 * movement of the same family without rerolling the whole build.
 */
export function Returning({ x, onDone }: { x: ExpeditionState; onDone: (prefs: DayPrefs, loadout: ExLoadout) => void }) {
  const [prefs, setPrefsState] = useState<DayPrefs>(() => ({ ...x.prefs, intensity: 'normal', sore: {}, soreAt: undefined }));
  const [loadout, setLoadout] = useState<ExLoadout>(x.loadout);
  const setPrefs = (fn: (p: DayPrefs) => void) =>
    setPrefsState((p) => {
      const n = structuredClone(p);
      fn(n);
      return n;
    });
  useEffect(() => input.setMode('menu'), []);
  const blocked = (f: Family) => {
    const id = loadout[f]?.exerciseId;
    return !!id && eligibility(getExercise(id), prefs, getSave().calibrations).tier === 'blocked';
  };
  const done = () => {
    audio.gesture();
    // A movement today's equipment rules out is swapped for one that fits (or sits out if none does).
    const l = { ...loadout };
    for (const f of FAMILIES)
      if (blocked(f)) {
        const alts = alternatives(f, l[f]?.exerciseId, prefs, getSave().calibrations);
        l[f] = alts.length ? { exerciseId: alts[Math.floor(Math.random() * alts.length)].id, firstCheck: false } : null;
      }
    onDone(prefs, l);
  };
  useInputEvents((e) => {
    if (e.type === 'confirm') done();
  });
  const swap = (f: Family) => {
    const alts = alternatives(f, loadout[f]?.exerciseId, prefs, getSave().calibrations);
    if (!alts.length) return audio.error();
    const pick = alts[Math.floor(Math.random() * alts.length)];
    setLoadout((l) => ({ ...l, [f]: { exerciseId: pick.id, firstCheck: false } }));
    audio.select();
  };
  const seg = <T extends string>(value: T, opts: [T, string][], set: (v: T) => void) => (
    <div className="seg">
      {opts.map(([v, l]) => (
        <button key={v} className={`btn btn-sm ${value === v ? '' : 'btn-ghost'}`} onClick={() => set(v)}>
          {l}
        </button>
      ))}
    </div>
  );
  const custom = getSave().exerciseTargets;
  return (
    <div className="title-screen in-garden">
      <div className="title-card setup-card sanctuary">
        <h2>A new day</h2>
        <p className="muted">Your expedition waits exactly where you left it. How do you feel today?</p>
        <div className="sanct-grid">
          <div className="toggle-row">
            <span>Dumbbells today</span>
            {seg(
              prefs.dumbbells ? 'yes' : 'no',
              [
                ['no', 'No'],
                ['yes', 'Yes'],
              ],
              (v) => setPrefs((p) => void (p.dumbbells = v === 'yes')),
            )}
          </div>
          <div className="toggle-row">
            <span>How do you feel?</span>
            {seg(
              prefs.intensity,
              [
                ['easy', 'Take it easy'],
                ['normal', 'Normal'],
                ['strong', 'Strong'],
              ],
              (v) => setPrefs((p) => void (p.intensity = v)),
            )}
          </div>
          <div className="toggle-row sore-row">
            <span>Sore today?</span>
            <div className="sore-grid">
              {SORE_AREAS.map((a) => (
                <div key={a} className="sore-area">
                  <small>{FAMILY_INFO[a].name}</small>
                  {seg<'no' | Soreness>(
                    prefs.sore?.[a] ?? 'no',
                    [
                      ['no', 'No'],
                      ['gentle', 'Go gentle'],
                      ['rest', 'Rest it'],
                    ],
                    (v) =>
                      setPrefs((p) => {
                        const sore = { ...(p.sore ?? {}) };
                        if (v === 'no') delete sore[a];
                        else sore[a] = v;
                        p.sore = sore;
                        p.soreAt = Date.now();
                      }),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="loadout">
          {FAMILIES.map((f) => {
            const slot = loadout[f];
            const ex = slot ? getExercise(slot.exerciseId) : null;
            return (
              <div key={f} className="lo-card" style={{ ['--fam' as string]: FAMILY_INFO[f].color }}>
                <small>{FAMILY_INFO[f].name}</small>
                {ex && !restingSore(f, prefs) ? (
                  <>
                    <b>{ex.name}</b>
                    <span className="lo-target">{blocked(f) ? 'Not possible today: it will be swapped' : `${targetLabel(ex, setTarget(ex, prefs, custom))} per set today`}</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => swap(f)}>
                      Swap
                    </button>
                  </>
                ) : (
                  <>
                    <b>Resting today</b>
                    <span className="lo-role">{ex ? `${ex.name} sits out today; it’s back next time.` : 'No movement in this slot.'}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="safety">Nothing you already did is asked again. Stop any time; your progress is kept.</p>
        <div className="row">
          <button className="btn btn-big focus" onClick={done}>
            Continue the expedition
          </button>
        </div>
      </div>
    </div>
  );
}
