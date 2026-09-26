import { useEffect, useMemo, useRef, useState } from 'react';
import { EXERCISES, FAMILIES, FAMILY_INFO, getExercise, targetLabel, type Family } from '../../exercise/registry';
import { audio } from '../../game/audio';
import { getSave, updateSave } from '../../game/store';
import { input } from '../../input/InputHub';
import { iconDataUrl } from '../../phaser/art';
import { ability } from '../../rpg/abilities';
import type { RouteId } from '../../rpg/expedition';
import { alternatives, eligibility, generateLoadout, rerollAll, restingSore, setTarget, SORE_AREAS, type DayPrefs, type ExLoadout, type Soreness } from '../../rpg/loadout';
import { STORY } from '../../rpg/story';
import { useInputEvents } from '../motionUi';
import { useSave } from '../useSave';
import { VoiceToggle } from '../VoiceUi';

/**
 * The Sanctuary: a short pre-run setup (no long questionnaire). Say what
 * you have today, how you feel, review the four-family loadout the Heart
 * rolled for you, reroll or swap, then set off. Couch-friendly: nothing here
 * needs the camera.
 */
export function Sanctuary({ connected, onBegin, onLab, onJournal, onBack }: { connected: boolean; onBegin: (prefs: DayPrefs, loadout: ExLoadout, route: RouteId) => void; onLab: () => void; onJournal: () => void; onBack: () => void }) {
  const save = useSave();
  const prefs = save.expeditionPrefs;
  // One canonical expedition (bible §9.3). The retired short route stays only for older saved runs.
  const route: RouteId = 'standard';
  const [loadout, setLoadout] = useState<ExLoadout>(() => generateLoadout(prefs, save.calibrations, save.workouts));
  const [focus, setFocus] = useState(0);
  const focusRef = useRef(0);
  const setPrefs = (fn: (p: DayPrefs) => void) => updateSave((s) => void fn(s.expeditionPrefs));

  // Changing what's available re-rolls only the slots that are no longer allowed.
  const key = JSON.stringify(prefs) + JSON.stringify(save.calibrations);
  useEffect(() => {
    const s = getSave();
    setLoadout((l) => {
      const keep: Partial<Record<Family, string>> = {};
      for (const f of FAMILIES) {
        const id = l[f]?.exerciseId;
        if (id && eligibility(getExercise(id), s.expeditionPrefs, s.calibrations).tier !== 'blocked') keep[f] = id;
      }
      return generateLoadout(s.expeditionPrefs, s.calibrations, s.workouts, Math.random, keep);
    });
  }, [key]);

  useEffect(() => {
    input.setMode('menu');
  }, []);

  const actions = useMemo(
    () => [
      { id: 'begin', run: () => onBegin(getSave().expeditionPrefs, loadout, route) },
      { id: 'reroll', run: () => reroll() },
      { id: 'lab', run: onLab },
      { id: 'journal', run: onJournal },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadout, route],
  );
  useInputEvents((e) => {
    if (e.type === 'nav') {
      focusRef.current = (focusRef.current + e.dir + actions.length) % actions.length;
      setFocus(focusRef.current);
      audio.select();
    } else if (e.type === 'confirm') {
      audio.gesture();
      actions[focusRef.current].run();
    } else if (e.type === 'back') onBack();
  });

  const reroll = () => {
    const s = getSave();
    setLoadout((l) => rerollAll(l, s.expeditionPrefs, s.calibrations, s.workouts));
    audio.select();
  };
  const swap = (f: Family) => {
    const s = getSave();
    const alts = alternatives(f, loadout[f]?.exerciseId, s.expeditionPrefs, s.calibrations);
    if (!alts.length) return audio.error();
    const i = Math.floor(Math.random() * alts.length);
    setLoadout((l) => ({ ...l, [f]: { exerciseId: alts[i].id, firstCheck: false } }));
    audio.select();
  };
  const unchecked = FAMILIES.map((f) => loadout[f]).filter((s) => s?.firstCheck);
  const seg = <T extends string>(value: T, opts: [T, string][], set: (v: T) => void) => (
    <div className="seg">
      {opts.map(([v, l]) => (
        <button key={v} className={`btn btn-sm ${value === v ? '' : 'btn-ghost'}`} onClick={() => set(v)}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="title-screen in-garden">
      <div className="title-card setup-card sanctuary">
        <h2>The Sanctuary</h2>
        <p className="elara">
          <b>Elara:</b> {STORY.sanctuaryGreeting}
        </p>

        <div className="sanct-grid">
          <div className="toggle-row">
            <span>Dumbbells today</span>
            {seg(prefs.dumbbells ? 'yes' : 'no', [['no', 'No'], ['yes', 'Yes']], (v) => setPrefs((p) => void (p.dumbbells = v === 'yes')))}
          </div>
          {prefs.dumbbells && (
            <div className="toggle-row">
              <span>A sturdy chair or bench (for rows)</span>
              {seg(prefs.support ? 'yes' : 'no', [['no', 'No'], ['yes', 'Yes']], (v) => setPrefs((p) => void (p.support = v === 'yes')))}
            </div>
          )}
          <div className="toggle-row">
            <span>How do you feel?</span>
            {seg(prefs.intensity, [['easy', 'Take it easy'], ['normal', 'Normal'], ['strong', 'Strong']], (v) => setPrefs((p) => void (p.intensity = v)))}
          </div>
          <div className="toggle-row sore-row">
            <span>Sore today?</span>
            <div className="sore-grid">
              {SORE_AREAS.map((a) => (
                <div key={a} className="sore-area">
                  <small>{FAMILY_INFO[a].name}</small>
                  {seg<'no' | Soreness>(prefs.sore?.[a] ?? 'no', [['no', 'No'], ['gentle', 'Go gentle'], ['rest', 'Rest it']], (v) =>
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
          {Object.keys(prefs.sore ?? {}).length > 0 && (
            <p className="muted small sore-note">
              Go gentle: that family's targets drop to about 60% today. Rest it: its ability sits out and the other three carry you.{prefs.sore?.legs ? ' Sore legs ease cardio a little too.' : ''} It's forgotten by tomorrow.
            </p>
          )}
          <div className="toggle-row">
            <span>Attack cues</span>
            {seg(save.settings.attackCues, [['adaptive', 'Learn as you go'], ['obvious', 'Always obvious']], (v) => updateSave((s) => void (s.settings.attackCues = v)))}
          </div>
          <div className="toggle-row">
            <span>Between fights</span>
            {seg(save.settings.motion.traversal, [['active', 'March'], ['assisted', 'Gamepad']], (v) => updateSave((s) => void (s.settings.motion.traversal = v)))}
          </div>
        </div>

        <p className="muted small">{STORY.loadoutNote}</p>
        <div className="loadout">
          {FAMILIES.map((f) => {
            const slot = loadout[f];
            const ex = slot ? getExercise(slot.exerciseId) : null;
            const a = ex ? ability(ex.rpgAbility) : null;
            return (
              <div key={f} className="lo-card" style={{ ['--fam' as string]: FAMILY_INFO[f].color }}>
                <small>{FAMILY_INFO[f].name}</small>
                {ex && a ? (
                  <>
                    <b>{ex.name}</b>
                    <span className="lo-target">{targetLabel(ex, setTarget(ex, prefs, save.exerciseTargets))} per set</span>
                    <span className="lo-ability">
                      <img src={iconDataUrl(a.icon)} alt="" className="pix-icon" /> {a.name}
                    </span>
                    <span className="lo-role">{a.role}</span>
                    {slot?.firstCheck && <span className="lo-badge">First-time check</span>}
                    {ex.reliability === 'experimental' && <span className="lo-badge exp">Experimental</span>}
                    <button className="btn btn-sm btn-ghost" onClick={() => swap(f)}>
                      Swap
                    </button>
                  </>
                ) : (
                  <>
                    <b>Resting today</b>
                    <span className="lo-role">{restingSore(f, prefs) ? 'Sore — resting it. The other three abilities carry you.' : 'Nothing eligible — the other three abilities carry you.'}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {unchecked.length > 0 && (
          <p className="warn-text small">
            {unchecked.map((s) => getExercise(s!.exerciseId).name).join(', ')} hasn’t been checked on your setup yet. Its first set doubles as the check — or try it in the Movement Lab first.
          </p>
        )}

        <details className="setup-settings">
          <summary>Rest a movement today · targets · experimental</summary>
          <p className="muted small">Tap a movement to rest it today. Targets are yours to set; they never rise with enemy difficulty.</p>
          <div className="ex-chips">
            {EXERCISES.filter((e) => e.createDetector).map((e) => {
              const el = eligibility(e, { ...prefs, exclude: [] }, save.calibrations);
              const resting = prefs.exclude.includes(e.id);
              return (
                <div key={e.id} className={`ex-chip ${resting ? 'off' : ''} ${el.tier}`}>
                  <button className="btn btn-sm btn-ghost" onClick={() => setPrefs((p) => void (p.exclude = resting ? p.exclude.filter((x) => x !== e.id) : [...p.exclude, e.id]))}>
                    {resting ? '💤 ' : ''}
                    {e.name}
                  </button>
                  <span className="ex-target">
                    <button className="btn btn-sm btn-ghost" onClick={() => updateSave((s) => void (s.exerciseTargets[e.id] = Math.max(e.range.min, (s.exerciseTargets[e.id] ?? e.range.default) - (e.kind === 'hold' ? 5 : 1))))}>
                      −
                    </button>
                    <b>{targetLabel(e, save.exerciseTargets[e.id] ?? e.range.default)}</b>
                    <button className="btn btn-sm btn-ghost" onClick={() => updateSave((s) => void (s.exerciseTargets[e.id] = Math.min(e.range.max, (s.exerciseTargets[e.id] ?? e.range.default) + (e.kind === 'hold' ? 5 : 1))))}>
                      +
                    </button>
                  </span>
                  {el.tier !== 'ready' && <small className="muted">{el.reason}</small>}
                </div>
              );
            })}
          </div>
          <div className="toggle-row">
            <span>Include experimental movements (after a Lab check)</span>
            {seg(prefs.experimental ? 'yes' : 'no', [['no', 'No'], ['yes', 'Yes']], (v) => setPrefs((p) => void (p.experimental = v === 'yes')))}
          </div>
        </details>

        <VoiceToggle phoneOnly={!connected} />

        <p className="safety">Move within your limits. Finish any set early — say “Finish set” or press F / Y — and the reps you did still count. Resting never costs you health.</p>
        <div className="row">
          <button className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
          <button className={`btn ${focus === 3 ? 'focus' : 'btn-ghost'}`} onClick={onJournal}>
            Journal
          </button>
          <button className={`btn ${focus === 2 ? 'focus' : 'btn-ghost'}`} onClick={onLab}>
            Movement Lab
          </button>
          <button className={`btn ${focus === 1 ? 'focus' : 'btn-ghost'}`} onClick={reroll}>
            Reroll all
          </button>
          <button className={`btn btn-big ${focus === 0 ? 'focus' : ''}`} onClick={() => onBegin(getSave().expeditionPrefs, loadout, route)}>
            Begin the expedition
          </button>
        </div>
      </div>
    </div>
  );
}
