import { useEffect, useRef, useState } from 'react';
import { FAMILIES, FAMILY_INFO, getExercise, targetLabel, type Family } from '../../exercise/registry';
import { havenSequence, recoveryDuration, type RecoveryMove } from '../../exercise/recovery';
import { audio } from '../../game/audio';
import { getSave } from '../../game/store';
import { input } from '../../input/InputHub';
import { ability } from '../../rpg/abilities';
import { blessing, offerBlessings, type BlessingDef } from '../../rpg/blessings';
import { ROUTES, type ExpeditionState, type NodeKind } from '../../rpg/expedition';
import { alternatives, rerollAll, type ExLoadout } from '../../rpg/loadout';
import { STORY } from '../../rpg/story';
import { activity, completion, totals, workingSets } from '../../rpg/workout';
import { GestureMenu, useInputEvents } from '../motionUi';

const NODE_ICON: Record<NodeKind, string> = { fight: '⚔', blessing: '✦', mirror: '◈', haven: '❀', boss: '☼' };

/** The route so far and what's next. Menus only: no camera needed. */
export function PathView({ x, onContinue, onStop }: { x: ExpeditionState; onContinue: () => void; onStop: () => void }) {
  const nodes = ROUTES[x.route].nodes;
  const next = nodes[x.index];
  const boundary = x.index > 0 && next && nodes[x.index - 1].phase !== next.phase;
  useEffect(() => input.setMode('menu'), []);
  return (
    <div className="tv-overlay">
      <div className="gmenu path">
        <h2>{boundary ? `Phase ${next.phase} of 3` : 'The path to the Spark'}</h2>
        <ol className="path-nodes">
          {nodes.map((n, i) => (
            <li key={i} className={`${i < x.index ? 'done' : i === x.index ? 'now' : ''} phase-${n.phase}`}>
              <span>{NODE_ICON[n.kind]}</span> {n.title}
            </li>
          ))}
        </ol>
        <p className="gmenu-text">
          ♥ {x.hp}/{x.maxHp} · {workingSets(x.workout)} sets done{x.fallen ? ' · the Spark is out of reach this run' : ''}
          {boundary ? ' · A good place to stop if you need to — the run will wait.' : ''}
        </p>
        <GestureMenu
          title=""
          options={[
            { id: 'go', label: next ? `Continue: ${next.title}` : 'Finish', icon: 'star' },
            { id: 'stop', label: 'Save and stop here', detail: 'Resume later from this point', icon: 'lock' },
          ]}
          onChoose={(id) => (id === 'go' ? onContinue() : onStop())}
        />
      </div>
    </div>
  );
}

export function BlessingPick({ held, loadout, onPick }: { held: string[]; loadout: ExLoadout; onPick: (id: string) => void }) {
  const [offer] = useState<BlessingDef[]>(() =>
    offerBlessings(
      held,
      FAMILIES.map((f) => loadout[f])
        .filter(Boolean)
        .map((s) => ability(getExercise(s!.exerciseId).rpgAbility)),
      Math.random,
    ),
  );
  useEffect(() => {
    input.setMode('menu');
    audio.say(STORY.blessingIntro);
  }, []);
  return (
    <div className="tv-overlay">
      <GestureMenu title="A Fragment Remembered" text={STORY.blessingIntro} options={offer.map((b) => ({ id: b.id, label: b.name, detail: b.text, icon: b.icon }))} initial={1} onChoose={onPick} />
    </div>
  );
}

/**
 * The Mirror of Unlived Lives: keep the loadout, replace one movement, or
 * reroll them all — always previewed before committing. Only between fights;
 * the workout done so far is untouched.
 */
export function Mirror({ x, onDone }: { x: ExpeditionState; onDone: (l: ExLoadout | null) => void }) {
  const [step, setStep] = useState<'choose' | 'family' | 'preview'>('choose');
  const [preview, setPreview] = useState<ExLoadout | null>(null);
  const s = getSave();
  useEffect(() => {
    input.setMode('menu');
    audio.say(STORY.mirrorIntro);
  }, []);
  const options = FAMILIES.filter((f) => alternatives(f, x.loadout[f]?.exerciseId, x.prefs, s.calibrations).length);
  if (step === 'choose')
    return (
      <div className="tv-overlay">
        <GestureMenu
          title="The Mirror of Unlived Lives"
          text={STORY.mirrorIntro}
          options={[
            { id: 'keep', label: 'Keep who you are', detail: 'Your current movements', icon: 'shield' },
            ...(options.length ? [{ id: 'one', label: 'Change one movement', detail: 'Pick a family, see the alternative', icon: 'star' }] : []),
            { id: 'all', label: 'Step into another life', detail: 'Reroll all four (previewed first)', icon: 'wind' },
          ]}
          onChoose={(id) => {
            if (id === 'keep') {
              audio.say(STORY.mirrorKept);
              onDone(null);
            } else if (id === 'one') setStep('family');
            else {
              setPreview(rerollAll(x.loadout, x.prefs, s.calibrations, s.workouts));
              setStep('preview');
            }
          }}
        />
      </div>
    );
  if (step === 'family')
    return (
      <div className="tv-overlay">
        <GestureMenu
          title="Which strength?"
          options={options.map((f) => ({ id: f, label: FAMILY_INFO[f].name, detail: `Now: ${getExercise(x.loadout[f]!.exerciseId).name}`, icon: FAMILY_INFO[f].icon }))}
          onChoose={(f) => {
            const alts = alternatives(f as Family, x.loadout[f as Family]?.exerciseId, x.prefs, s.calibrations);
            setPreview({ ...x.loadout, [f]: { exerciseId: alts[Math.floor(Math.random() * alts.length)].id, firstCheck: false } });
            setStep('preview');
          }}
          onBack={() => setStep('choose')}
        />
      </div>
    );
  return (
    <div className="tv-overlay">
      <div className="gmenu">
        <h2>In the mirror…</h2>
        <table className="sum-table">
          <tbody>
            {FAMILIES.map((f) => {
              const a = x.loadout[f];
              const b = preview?.[f];
              const changed = a?.exerciseId !== b?.exerciseId;
              return (
                <tr key={f} className={changed ? 'changed' : ''}>
                  <th>{FAMILY_INFO[f].name}</th>
                  <td>{a ? getExercise(a.exerciseId).name : '—'}</td>
                  <td>{changed ? '→ ' : ''}{b ? `${getExercise(b.exerciseId).name} · ${ability(getExercise(b.exerciseId).rpgAbility).name}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <GestureMenu
          title=""
          options={[
            { id: 'take', label: 'Take this life', detail: 'Your workout so far is kept', icon: 'star' },
            { id: 'keep', label: 'Keep your own', icon: 'shield' },
          ]}
          onChoose={(id) => {
            if (id === 'take') {
              audio.say(STORY.mirrorChanged);
              onDone(preview);
            } else {
              audio.say(STORY.mirrorKept);
              onDone(null);
            }
          }}
        />
      </div>
    </div>
  );
}

/**
 * A Haven: full rest, then a short guided recovery sequence with calm audio.
 * Timed and spoken, nothing scored; skip any step. The memory fragment comes
 * only after the movements end, never while you're concentrating.
 */
export function Haven({ onDone }: { onDone: (recoveryMs: number) => void }) {
  const [seq] = useState<RecoveryMove[]>(() => havenSequence(Math.random, 'standard'));
  const [phase, setPhase] = useState<'intro' | 'move' | 'memory'>('intro');
  const [m, setM] = useState(0);
  const [st, setSt] = useState(0);
  const [left, setLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const done = useRef(0);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    input.setMode('menu');
    audio.say(STORY.havenIntro);
    return () => audio.calm(false);
  }, []);

  useEffect(() => {
    if (phase !== 'move') return;
    const step = seq[m]?.steps[st];
    if (!step) return;
    audio.say(step.say);
    setLeft(step.s);
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      done.current += 1000;
      setLeft((x) => x - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, m, st, seq]);

  useEffect(() => {
    if (phase === 'move' && left <= 0 && seq[m]?.steps[st]) {
      const t = window.setTimeout(advance, 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  function advance() {
    const move = seq[m];
    if (st + 1 < move.steps.length) return setSt(st + 1);
    if (m + 1 < seq.length) {
      setM(m + 1);
      setSt(0);
      audio.say(`Next: ${seq[m + 1].name}. ${seq[m + 1].position}`);
      return;
    }
    audio.calm(false);
    setPhase('memory');
    window.setTimeout(() => audio.say(`${STORY.havenMemory} ${STORY.havenElara}`), 1200);
  }

  useInputEvents((e) => {
    if (phase !== 'move') return;
    if (e.type === 'confirm') advance();
    if (e.type === 'pause' || e.type === 'back') setPaused((p) => !p);
    if (e.type === 'resume') setPaused(false);
  });

  if (phase === 'intro')
    return (
      <div className="tv-overlay">
        <GestureMenu
          title="A Quiet Haven"
          text={`${STORY.havenIntro} You’re fully restored. A few gentle minutes: ${seq.map((x) => x.name).join(', ')} (about ${Math.round(seq.reduce((a, x) => a + recoveryDuration(x), 0) / 60)} min). No camera needed.`}
          options={[
            { id: 'go', label: 'Begin the stretches', icon: 'heart' },
            { id: 'skip', label: 'Just rest and move on', icon: 'star' },
          ]}
          onChoose={(id) => {
            if (id === 'skip') return onDone(0);
            audio.calm(true);
            setPhase('move');
            audio.say(`${seq[0].name}. ${seq[0].position}`);
          }}
        />
      </div>
    );
  if (phase === 'memory')
    return (
      <div className="tv-overlay">
        <GestureMenu title="A memory" text={`${STORY.havenMemory}\n\n${STORY.havenElara}`} options={[{ id: 'on', label: 'Carry on', icon: 'star' }]} onChoose={() => onDone(done.current)} />
      </div>
    );
  const move = seq[m];
  const step = move.steps[st];
  return (
    <div className="haven">
      <small>
        {move.name} · {m + 1} of {seq.length}
      </small>
      <b>{step?.say}</b>
      <span className="haven-pos">{move.position}</span>
      <div className="haven-timer">{paused ? '❚❚' : Math.max(0, left)}</div>
      <span className="muted small">Raise your right hand or press A to move on · Start / P to pause</span>
    </div>
  );
}

export function Fallen({ onReform, onEnd }: { onReform: () => void; onEnd: () => void }) {
  useEffect(() => {
    input.setMode('menu');
    audio.say(STORY.fallen);
  }, []);
  return (
    <div className="tv-overlay">
      <GestureMenu
        title="The Echo fades…"
        text={`${STORY.fallen} Everything you did physically is kept either way.`}
        options={[
          { id: 'reform', label: 'Reform and carry on', detail: 'Keep working out; the Spark can’t be restored this run', icon: 'heart' },
          { id: 'end', label: 'End the session', detail: 'See your workout summary', icon: 'lock' },
        ]}
        onChoose={(id) => (id === 'reform' ? onReform() : onEnd())}
      />
    </div>
  );
}

/** RPG result and workout, side by side and kept separate. */
export function Summary({ x, onAgain, onExit }: { x: ExpeditionState; onAgain: () => void; onExit: () => void }) {
  const w = x.workout;
  const act = activity(w);
  const rows = totals(w);
  const won = w.outcome === 'victory';
  useEffect(() => {
    input.setMode('menu');
    audio.say(won ? `${STORY.victory} ${STORY.victoryElara}` : x.status === 'suspended' ? STORY.suspended : STORY.fallenEnd);
  }, [won, x.status]);
  const mins = (ms: number) => Math.max(0, Math.round(ms / 60000));
  return (
    <div className="tv-overlay">
      <div className="gmenu summary exp-summary">
        <h2>{won ? 'The Spark is restored — for now' : x.status === 'suspended' ? 'Expedition saved' : 'Back to the Sanctuary'}</h2>
        <p className="gmenu-text">{won ? STORY.victoryElara : x.fallen ? 'The character fell during this run, but the workout carried on.' : STORY.suspended}</p>
        <div className="sum-cols">
          <div>
            <h3>Workout</h3>
            <p>
              {workingSets(w)} of ~{w.plannedSets} planned sets ({Math.round(completion(w) * 100)}%) · about {mins(act.activeMs)} min moving of {mins(act.sessionMs)} min
            </p>
            <table className="sum-table">
              <tbody>
                {rows.map((t) => {
                  const ex = getExercise(t.exerciseId);
                  return (
                    <tr key={t.exerciseId}>
                      <th>{t.name}</th>
                      <td>{ex.kind === 'hold' ? `${Math.floor(t.holdMs / 1000)} s held` : `${t.camera} camera-verified`}</td>
                      <td>
                        {ex.sided ? `L ${t.left} · R ${t.right}` : ''}
                        {t.manual ? ` · ${t.manual} manual` : ''} · {t.sets} set{t.sets === 1 ? '' : 's'}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td>No sets yet.</td>
                  </tr>
                )}
                {w.recoveryMs > 0 && (
                  <tr>
                    <th>Haven recovery</th>
                    <td>{Math.round(w.recoveryMs / 1000)} s</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Expedition</h3>
            <p>{won ? 'Victory: the Warden fell and the Spark flared.' : x.status === 'suspended' ? `Saved at: ${ROUTES[x.route].nodes[x.index]?.title ?? 'the end'}` : x.fallen ? 'Defeated — reformed by the Heart.' : 'Ended early.'}</p>
            <p>
              Dodges: {w.dodges.dodged} dodged · {w.dodges.hit} hit · {w.dodges.unclear} unseen (no damage)
            </p>
            <p>Loadout: {FAMILIES.map((f) => (x.loadout[f] ? `${getExercise(x.loadout[f]!.exerciseId).name}` : '—')).join(' · ')}</p>
            {x.blessings.length > 0 && <p>Blessings: {x.blessings.map((b) => blessingName(b)).join(', ')}</p>}
          </div>
        </div>
        <GestureMenu
          title=""
          options={[
            { id: 'again', label: 'Back to the Sanctuary', icon: 'star' },
            { id: 'title', label: 'Title screen', icon: 'lock' },
          ]}
          onChoose={(id) => (id === 'again' ? onAgain() : onExit())}
        />
      </div>
    </div>
  );
}

/** A movement's target, for display. */
export function targetText(x: ExpeditionState, id: string): string {
  const ex = getExercise(id);
  return targetLabel(ex, x.targets[id] ?? ex.range.default);
}

function blessingName(id: string): string {
  try {
    return blessing(id).name;
  } catch {
    return id;
  }
}
