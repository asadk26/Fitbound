import { useEffect, useMemo, useState } from 'react';
import { awakeningSequence, sequenceSeconds } from '../../exercise/warmup';
import { audio } from '../../game/audio';
import { input } from '../../input/InputHub';
import type { DayPrefs } from '../../rpg/loadout';
import { GestureMenu } from '../motionUi';
import { Guided } from './Guided';

export interface WarmupResult {
  length: 'full' | 'short' | 'skipped';
  ms: number;
  completed: boolean;
}

/**
 * The Awakening (bible §18): a strongly encouraged, never mandatory warm-up
 * at the start of each real workout session — the hero getting used to a
 * body he hasn't worn before. It adapts to soreness and space and can be
 * shortened or skipped. A resumed session gets a brief presentation instead
 * of the reconstruction story. Elara's words are text only, never spoken
 * by the synthetic voice.
 */
export function Awakening({ prefs, resumed, elara, onDone }: { prefs: DayPrefs; resumed: boolean; elara: boolean; onDone: (r: WarmupResult) => void }) {
  const [phase, setPhase] = useState<'offer' | 'moving' | 'done'>('offer');
  const [length, setLength] = useState<'full' | 'short'>(resumed ? 'short' : 'full');
  const [smallSpace, setSmallSpace] = useState(false);
  const [result, setResult] = useState<WarmupResult | null>(null);
  const seq = useMemo(() => awakeningSequence(prefs, { length, smallSpace }), [prefs, length, smallSpace]);
  const full = useMemo(() => awakeningSequence(prefs, { length: 'full', smallSpace }), [prefs, smallSpace]);
  const short = useMemo(() => awakeningSequence(prefs, { length: 'short', smallSpace }), [prefs, smallSpace]);
  const minutes = (s: number) => Math.max(1, Math.round(s / 60));
  useEffect(() => input.setMode('menu'), []);

  if (phase === 'moving')
    return (
      <Guided
        seq={seq}
        label="The Awakening"
        onDone={(ms, completed) => {
          const r: WarmupResult = { length, ms, completed };
          setResult(r);
          setPhase('done');
          audio.say(completed ? 'Coordination returns. You are ready.' : 'That will do. You are ready.');
        }}
      />
    );

  if (phase === 'done' && result)
    return (
      <div className="tv-overlay">
        <GestureMenu
          title="Awake"
          text={result.completed ? 'Your hands close and open. The body answers — yours now, for today.' : 'Enough to begin. Your body will remember the rest.'}
          options={[{ id: 'go', label: 'Set out', icon: 'star' }]}
          onChoose={() => onDone(result)}
        />
      </div>
    );

  const sore = Object.keys(prefs.sore ?? {}).length > 0;
  const intro = resumed
    ? 'A new session. Your body remembers some of it — a short Awakening before you carry on?'
    : elara
      ? '“Take a moment,” Elara says. “You haven’t worn this body before.”'
      : 'Take a moment. You haven’t worn this body before.';
  return (
    <div className="tv-overlay">
      <GestureMenu
        title="The Awakening"
        text={`${intro}\n\nA gentle warm-up: marching, arm circles, turns, hips${sore ? ' — adjusted for what’s sore today' : ''}. No camera needed. It counts toward today’s workout.`}
        options={[
          { id: 'go', label: `Begin (about ${minutes(sequenceSeconds(length === 'full' ? full : short))} min)`, detail: length === 'full' ? 'The full Awakening' : 'The short version', icon: 'heart' },
          { id: 'length', label: length === 'full' ? `Short version (${minutes(sequenceSeconds(short))} min)` : `Full version (${minutes(sequenceSeconds(full))} min)`, icon: 'wind' },
          { id: 'space', label: smallSpace ? 'Little room: on' : 'Little room around me', detail: smallSpace ? 'Knee lifts instead of leg swings' : 'Swaps leg swings for knee lifts', icon: 'shield' },
          { id: 'skip', label: 'Skip for today', detail: 'Strongly encouraged, never required', icon: 'lock' },
        ]}
        onChoose={(id) => {
          if (id === 'go') setPhase('moving');
          else if (id === 'length') setLength((l) => (l === 'full' ? 'short' : 'full'));
          else if (id === 'space') setSmallSpace((v) => !v);
          else onDone({ length: 'skipped', ms: 0, completed: false });
        }}
      />
    </div>
  );
}
