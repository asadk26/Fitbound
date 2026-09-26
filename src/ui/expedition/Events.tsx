import { useEffect, useRef, useState } from 'react';
import { FAMILIES, FAMILY_INFO, getExercise, targetLabel, type Family } from '../../exercise/registry';
import { havenSequence, heartsRestSequence, recoveryDuration, type RecoveryMove } from '../../exercise/recovery';
import { audio } from '../../game/audio';
import { getSave, updateSave } from '../../game/store';
import { input } from '../../input/InputHub';
import { host } from '../../net/host';
import { ability } from '../../rpg/abilities';
import { blessing, offerBlessings, type BlessingDef } from '../../rpg/blessings';
import { routeNodes, type ExpeditionState, type NodeKind } from '../../rpg/expedition';
import { alternatives, rerollAll, type ExLoadout } from '../../rpg/loadout';
import { STORY } from '../../rpg/story';
import { playtestReport } from '../../rpg/report';
import { applyProposals, propose } from '../../rpg/progression';
import { expeditionSets, hasWork } from '../../rpg/session';
import { completion, pacing, totals, workingSets, workoutTime, type Feedback } from '../../rpg/workout';
import { GestureMenu, useInputEvents } from '../motionUi';
import { Guided } from './Guided';

const NODE_ICON: Record<NodeKind, string> = { fight: '⚔', blessing: '✦', mirror: '◈', haven: '❀', boss: '☼', crossing: '≈' };

/** The route so far and what's next. Menus only: no camera needed. */
export function PathView({ x, onContinue, onStop }: { x: ExpeditionState; onContinue: () => void; onStop: () => void }) {
  const nodes = routeNodes(x);
  const next = nodes[x.index];
  const boundary = x.index > 0 && next && nodes[x.index - 1].phase !== next.phase;
  const parts = x.nodes ? 2 : 3;
  useEffect(() => input.setMode('menu'), []);
  return (
    <div className="tv-overlay">
      <div className="gmenu path">
        <h2>{boundary ? (x.nodes ? 'The Crossing' : `Phase ${next.phase} of ${parts}`) : 'The path to the Spark'}</h2>
        <ol className="path-nodes">
          {nodes.map((n, i) => (
            <li key={i} className={`${i < x.index ? 'done' : i === x.index ? 'now' : ''} phase-${n.phase}`}>
              <span>{NODE_ICON[n.kind]}</span> {n.title}
            </li>
          ))}
        </ol>
        <p className="gmenu-text">
          ♥ {x.hp}/{x.maxHp} · {expeditionSets(x)} sets done{x.battle?.index === x.index ? ' · a fight is waiting, just as you left it' : ''}
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

/**
 * The Stillpoint (bible §20): after the first fracture's miniboss, the Heart
 * opens a quiet space between the ages. Rest (HP, through the Haven
 * system), optional gentle stretches, a look at the build, the Mirror, and
 * "Save and return later" — none of them exclusive. It's the recommended
 * place to stop, never the only one.
 */
export function Stillpoint({
  x,
  firstTime,
  onSeen,
  onRest,
  onStretch,
  onContinue,
  onStop,
  onLoadout,
}: {
  x: ExpeditionState;
  firstTime: boolean;
  onSeen: () => void;
  onRest: () => void;
  onStretch: (ms: number) => void;
  onContinue: () => void;
  onStop: () => void;
  onLoadout: (l: ExLoadout | null) => void;
}) {
  const [view, setView] = useState<'menu' | 'mirror' | 'stretch' | 'review'>('menu');
  // Remember whether this is the first visit as it was on arrival (marking it seen mustn't change the text).
  const [first] = useState(firstTime);
  const [seq] = useState<RecoveryMove[]>(() => havenSequence(Math.random, 'short'));
  const rested = x.hp >= x.maxHp;
  useEffect(() => {
    input.setMode('menu');
    onSeen();
    audio.calm(true);
    audio.say(first ? STORY.stillpointFirst : STORY.stillpoint);
    return () => audio.calm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (view === 'mirror')
    return (
      <Mirror
        x={x}
        onDone={(l) => {
          onLoadout(l);
          setView('menu');
        }}
      />
    );
  if (view === 'stretch')
    return (
      <div className="stillpoint">
        <Guided
          seq={seq}
          label="The Stillpoint"
          onDone={(ms) => {
            onStretch(ms);
            setView('menu');
          }}
        />
      </div>
    );
  if (view === 'review')
    return (
      <div className="stillpoint">
        <div className="tv-overlay">
          <GestureMenu
            title="Your build"
            text={[
              `♥ ${x.hp}/${x.maxHp} · ${expeditionSets(x)} sets across the expedition so far`,
              `Loadout: ${FAMILIES.map((f) => (x.loadout[f] ? `${FAMILY_INFO[f].name}: ${getExercise(x.loadout[f]!.exerciseId).name} (${ability(getExercise(x.loadout[f]!.exerciseId).rpgAbility).name})` : `${FAMILY_INFO[f].name}: —`)).join(' · ')}`,
              `Blessings: ${x.blessings.length ? x.blessings.map((b) => blessingName(b)).join(', ') : 'none yet'}`,
              `Ahead: ${routeNodes(x)
                .slice(x.index + 1)
                .filter((n) => n.kind === 'fight' || n.kind === 'boss')
                .map((n) => n.title)
                .join(' → ') || 'the Spark'}`,
            ].join('\n')}
            options={[
              { id: 'back', label: 'Back', icon: 'star' },
              { id: 'mirror', label: 'Look into the Mirror', detail: 'Change a movement or reroll', icon: 'wind' },
            ]}
            onChoose={(id) => setView(id === 'mirror' ? 'mirror' : 'menu')}
          />
        </div>
      </div>
    );
  return (
    <div className="stillpoint">
      <div className="tv-overlay">
        <GestureMenu
          title="The Stillpoint"
          text={`${first ? STORY.stillpointFirst : STORY.stillpoint} ♥ ${x.hp}/${x.maxHp}.`}
          initial={rested ? 4 : 0}
          options={[
            rested ? { id: 'rested', label: 'Rested ✓', icon: 'heart' } : { id: 'rest', label: 'Rest', detail: 'Recover your HP', icon: 'heart' },
            { id: 'stretch', label: 'Stretch (optional)', detail: 'A few calm minutes', icon: 'wind' },
            { id: 'review', label: 'Your build & the Mirror', icon: 'shield' },
            { id: 'stop', label: 'Save, return later', detail: 'Back to the Stillpoint', icon: 'lock' },
            { id: 'go', label: 'Continue', detail: 'Into the next age', icon: 'star' },
          ]}
          onChoose={(id) => {
            if (id === 'rest') {
              audio.heal();
              onRest();
            } else if (id === 'stretch') setView('stretch');
            else if (id === 'review') setView('review');
            else if (id === 'mirror') setView('mirror');
            else if (id === 'stop') onStop();
            else if (id === 'go') onContinue();
          }}
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
  const done = useRef(0);

  useEffect(() => {
    input.setMode('menu');
    audio.say(STORY.havenIntro);
  }, []);

  if (phase === 'intro')
    return (
      <div className="tv-overlay">
        <GestureMenu
          title="A Quiet Haven"
          text={`${STORY.havenIntro} You’re fully restored — resting is enough. If you like, a few gentle minutes: ${seq.map((x) => x.name).join(', ')} (about ${Math.round(seq.reduce((a, x) => a + recoveryDuration(x), 0) / 60)} min). No camera needed.`}
          options={[
            { id: 'go', label: 'Begin the stretches (optional)', icon: 'heart' },
            { id: 'skip', label: 'Just rest and move on', icon: 'star' },
          ]}
          onChoose={(id) => {
            if (id === 'skip') return onDone(0);
            setPhase('move');
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
  return (
    <Guided
      seq={seq}
      label="A Quiet Haven"
      onDone={(ms) => {
        done.current = ms;
        // Memories come after the movements, never while holding a pose. The narrator reads it; Elara's part is only ever read.
        setPhase('memory');
        window.setTimeout(() => audio.say(STORY.havenMemory), 1200);
      }}
    />
  );
}

export function Fallen({ onEnd }: { onEnd: () => void }) {
  useEffect(() => {
    input.setMode('menu');
    audio.say(STORY.fallen);
  }, []);
  return (
    <div className="tv-overlay">
      <GestureMenu title="You fall…" text={STORY.fallen} options={[{ id: 'end', label: 'Return to the Sanctuary', detail: 'See your workout summary', icon: 'heart' }]} onChoose={onEnd} />
    </div>
  );
}

/** RPG result and workout, side by side and kept separate. */
const CHECKIN: { key: keyof Feedback; title: string; options: { id: string; label: string; icon: string }[] }[] = [
  { key: 'effort', title: 'How did the workout feel?', options: [ { id: 'easy', label: 'Too easy', icon: 'wind' }, { id: 'right', label: 'About right', icon: 'star' }, { id: 'hard', label: 'Too hard', icon: 'bolt' } ] },
  { key: 'fun', title: 'How much fun was it?', options: [ { id: 'meh', label: 'Meh', icon: 'wind' }, { id: 'good', label: 'Good', icon: 'star' }, { id: 'great', label: 'Great', icon: 'heart' } ] },
  { key: 'pacing', title: 'How was the pacing?', options: [ { id: 'slow', label: 'Dragged', icon: 'wind' }, { id: 'right', label: 'About right', icon: 'star' }, { id: 'rushed', label: 'Rushed', icon: 'bolt' } ] },
];

export function Summary({ x, onAgain, onExit, onFeedback, onCooldown }: { x: ExpeditionState; onAgain: () => void; onExit: () => void; onFeedback: (fb: Feedback) => void; onCooldown?: (ms: number) => void }) {
  const w = x.workout;
  const pace = pacing(w);
  // A quick check-in after every session that did some work (a saved one too); every question can be skipped.
  const [step, setStep] = useState(hasWork(x) ? 0 : CHECKIN.length);
  const [fb, setFb] = useState<Feedback>({});
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const openReport = () => {
    const save = getSave();
    setCopied('');
    setReport(
      playtestReport(x, fb, {
        travel: save.settings.motion.traversal === 'assisted' ? 'gamepad' : 'march',
        cues: save.settings.attackCues,
        latency: host.latency.text(),
        next: plan.proposals.map((p) => `${getExercise(p.exerciseId).name} ${p.from} → ${kept[p.exerciseId] ? `${p.from} (kept)` : p.to} (${p.why})`),
      }),
    );
  };
  const copy = () =>
    navigator.clipboard
      ?.writeText(report ?? '')
      .then(() => setCopied('Copied'))
      .catch(() => setCopied('Copy failed — select the text instead'));
  // B / Escape / a raised left hand closes the report.
  useInputEvents((e) => {
    if (report && e.type === 'back') setReport(null);
  });
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([report ?? ''], { type: 'text/plain' }));
    a.download = `fitbound-playtest-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  // Targets for next time, from what this session's sets showed (and the check-in, if answered).
  // Every session is judged on its own, with that day's readiness, even mid-expedition.
  const plan = propose(w, x.prefs, getSave().exerciseTargets, getSave().progress, fb);
  const [kept, setKept] = useState<Record<string, boolean>>({});
  const committed = useRef(false);
  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    updateSave((s) => {
      s.progress = plan.progress;
      applyProposals(
        s.exerciseTargets,
        s.progress,
        plan.proposals.filter((p) => !kept[p.exerciseId]),
      );
    });
  };
  const leave = (then: () => void) => {
    commit();
    then();
  };
  const rows = totals(w);
  const won = w.outcome === 'victory';
  // The Heart's Rest (bible §20): an optional cooldown after a reignition, never before the payoff.
  const [cooling, setCooling] = useState(false);
  const [cooled, setCooled] = useState(0);
  const [coolSeq] = useState<RecoveryMove[]>(() => heartsRestSequence());
  useEffect(() => {
    input.setMode('menu');
    audio.say(won ? STORY.victory : x.status === 'suspended' ? STORY.suspended : STORY.fallenEnd);
  }, [won, x.status]);
  const mins = (ms: number) => Math.max(0, Math.round(ms / 60000));
  if (cooling)
    return (
      <Guided
        seq={coolSeq}
        label="The Heart’s Rest"
        onDone={(ms) => {
          setCooling(false);
          setCooled(ms || 1);
          onCooldown?.(ms);
        }}
      />
    );
  return (
    <div className="tv-overlay">
      <div className="gmenu summary exp-summary">
        <h2>{x.preview && !x.fallen && x.status !== 'suspended' ? 'Scenario preview complete' : won ? 'The Spark is reignited — for now' : x.status === 'suspended' ? 'Expedition saved' : 'Back to the Sanctuary'}</h2>
        {cooled > 0 && <p className="muted small">The Heart’s Rest: {Math.max(1, Math.round(cooled / 60000))} min of gentle stretching, counted apart from the workout.</p>}
        <p className="gmenu-text">{won ? STORY.victoryElara : x.fallen ? 'You fell, and the expedition is over. Everything you did physically is kept.' : x.status === 'suspended' ? STORY.suspended : 'The expedition ended here. Everything you did physically is kept.'}</p>
        <div className="sum-cols">
          <div>
            <h3>{x.earlier?.sessions.length ? 'This session' : 'Workout'}</h3>
            <p>
              {x.earlier?.sessions.length
                ? `${workingSets(w)} sets this session · ${expeditionSets(x)} of ~${w.plannedSets} across the expedition`
                : `${workingSets(w)} of ~${w.plannedSets} planned sets (${Math.round(completion(w) * 100)}%)`}
            </p>
            {workoutTime(w).total > 0 && (
              <p className="sum-pace">
                <b>Workout {mins(workoutTime(w).core)} min</b>
                {workoutTime(w).warmup ? ` · warm-up ${mins(workoutTime(w).warmup)}` : ''} · exercising {mins(workoutTime(w).exercise)} · dodging {mins(workoutTime(w).dodge)} · recovery between sets {mins(workoutTime(w).recovery)}
                {workoutTime(w).total > workoutTime(w).core
                  ? ` · plus ${[workoutTime(w).optional ? `yoga ${mins(workoutTime(w).optional)}` : '', workoutTime(w).cooldown ? `cooldown ${mins(workoutTime(w).cooldown)}` : '', workoutTime(w).march ? `marching ${mins(workoutTime(w).march)}` : ''].filter(Boolean).join(', ')} min of other activity`
                  : ''}
              </p>
            )}
            {pace.total > 0 && (
              <p className="sum-pace">
                {mins(pace.total)} min: {mins(pace.sets)} in sets · {mins(pace.between)} between sets · {mins(pace.march)} marching{pace.haven ? ` · ${mins(pace.haven)} Haven` : ''} · {mins(pace.other)} menus and story
              </p>
            )}
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
                {w.march && w.march.steps > 0 && (
                  <tr>
                    <th>Marching between fights</th>
                    <td>{w.march.steps} steps</td>
                    <td>≈ {Math.round(w.march.active * (1.7 / 104))} m of trail</td>
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
            <p>{won ? 'Victory: the Warden fell and the Spark was reignited.' : x.status === 'suspended' ? `Saved at: ${routeNodes(x)[x.index]?.title ?? 'the end'}` : x.fallen ? 'You fell. No reignition this time.' : 'Ended early.'}</p>
            <p>
              Dodges: {w.dodges.dodged} dodged · {w.dodges.hit} hit · {w.dodges.unclear} unseen (no damage)
            </p>
            <p>Loadout: {FAMILIES.map((f) => (x.loadout[f] ? `${getExercise(x.loadout[f]!.exerciseId).name}` : '—')).join(' · ')}</p>
            {x.blessings.length > 0 && <p>Blessings: {x.blessings.map((b) => blessingName(b)).join(', ')}</p>}
          </div>
        </div>
        {step >= CHECKIN.length && plan.proposals.length > 0 && (
          <div className="next-time">
            <b>Next time</b>
            {plan.proposals.map((p) => {
              const ex = getExercise(p.exerciseId);
              const keep = !!kept[p.exerciseId];
              return (
                <span key={p.exerciseId} className={`nt-item ${keep ? 'kept' : p.verdict}`}>
                  {ex.name}: {keep ? targetLabel(ex, p.from) : `${targetLabel(ex, p.from)} → ${targetLabel(ex, p.to)}`} <small>{keep ? 'unchanged' : p.why}</small>
                  <button className="btn btn-sm btn-ghost" onClick={() => setKept((k) => ({ ...k, [p.exerciseId]: !keep }))}>
                    {keep ? 'Change it' : 'Keep'}
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {step < CHECKIN.length ? (
          <GestureMenu
            key={step}
            title={CHECKIN[step].title}
            options={[...CHECKIN[step].options, { id: 'skip', label: 'Skip', icon: 'lock' }]}
            onChoose={(id) => {
              if (id !== 'skip') {
                const next = { ...fb, [CHECKIN[step].key]: id };
                setFb(next);
                onFeedback(next);
              }
              setStep(step + 1);
            }}
          />
        ) : (
          <GestureMenu
            title=""
            active={!report}
            options={[
              { id: 'again', label: 'Back to the Sanctuary', icon: 'star' },
              ...(won && onCooldown && !cooled ? [{ id: 'cool', label: 'The Heart’s Rest (optional)', detail: 'A few minutes of gentle stretching to close the session', icon: 'heart' }] : []),
              ...(plan.proposals.length
                ? [{ id: 'keepall', label: plan.proposals.every((p) => kept[p.exerciseId]) ? 'Use the new targets' : 'Keep my targets as they are', detail: 'Changes to next time’s targets', icon: 'heart' }]
                : []),
              { id: 'report', label: 'Playtest report', detail: 'Copy or save a text summary of this run', icon: 'shield' },
              { id: 'title', label: 'Title screen', icon: 'lock' },
            ]}
            onChoose={(id) => {
              if (id === 'again') leave(onAgain);
              else if (id === 'cool') setCooling(true);
              else if (id === 'keepall') {
                const all = plan.proposals.every((p) => kept[p.exerciseId]);
                setKept(Object.fromEntries(plan.proposals.map((p) => [p.exerciseId, !all])));
              } else if (id === 'report') openReport();
              else leave(onExit);
            }}
          />
        )}
      </div>
      {report && (
        <div className="tv-overlay report-overlay">
          <div className="gmenu report">
            <h2>Playtest report</h2>
            <textarea readOnly value={report} onFocus={(e) => e.currentTarget.select()} />
            <div className="report-actions">
              <button className="btn" onClick={copy}>
                Copy
              </button>
              <button className="btn" onClick={download}>
                Save .txt
              </button>
              <button className="btn btn-ghost" onClick={() => setReport(null)}>
                Close
              </button>
              {copied && <span className="muted">{copied}</span>}
            </div>
            <p className="muted small">Stays on this computer unless you copy or save it.</p>
          </div>
        </div>
      )}
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
