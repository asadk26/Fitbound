import { FAMILIES, getExercise } from '../exercise/registry';
import { blessing } from './blessings';
import { ROUTES, type ExpeditionState } from './expedition';
import { pacing, totals, workoutTime, type Feedback, type SetRecord } from './workout';

/**
 * A plain-text account of one expedition, for playtest notes: what was done,
 * where the time went, how each strike went, and the player's check-in. It
 * stays on this computer unless the player copies or saves it.
 */
export function playtestReport(x: ExpeditionState, fb: Feedback | undefined, ctx: { travel: string; cues: string; when?: Date; next?: string[]; latency?: string }): string {
  const w = x.workout;
  const p = pacing(w);
  const min = (ms: number) => `${(ms / 60000).toFixed(1)} min`;
  const outcome =
    w.outcome === 'victory' ? 'Victory' : x.status === 'suspended' ? `Saved at node ${x.index + 1}` : x.fallen ? 'Fell; the expedition ended' : w.outcome === 'defeat' ? 'Defeat' : 'Ended early';
  const out: string[] = [];
  out.push(`FITBOUND playtest report · ${(ctx.when ?? new Date()).toLocaleString()}`);
  out.push(`Route: ${ROUTES[x.route].name} · Outcome: ${outcome}${x.fallen && w.outcome === 'victory' ? ' (fell once)' : ''}`);
  out.push(`Settings: travel ${ctx.travel} · attack cues ${ctx.cues} · intensity ${w.intensity}`);
  out.push('');
  const wt = workoutTime(w);
  out.push(`Workout time: ${min(wt.total)} (exercising ${min(wt.exercise)} · dodging ${min(wt.dodge)} · recovery between sets ${min(wt.recovery)} · setup ${min(wt.setup)} · marching ${min(wt.march)} · Haven ${min(wt.haven)})`);
  out.push(`Time: ${min(p.total)} total`);
  out.push(`  sets ${min(p.sets)} · between sets (choosing, dodging, rests, enemy turns) ${min(p.between)} · marching ${min(p.march)} · Haven ${min(p.haven)} · menus and story ${min(p.other)}`);
  out.push('');
  out.push(`Sets (${w.sets.length}):`);
  w.sets.forEach((s, i) => out.push(`  ${i + 1}. ${setLine(s)}`));
  out.push('Totals:');
  for (const t of totals(w)) {
    const ex = getExercise(t.exerciseId);
    const work = ex.kind === 'hold' ? `${Math.floor(t.holdMs / 1000)} s held` : ex.sided ? `L ${t.left} · R ${t.right}` : `${t.camera} reps`;
    out.push(`  ${t.name}: ${work}${t.manual ? ` (+${t.manual} manual)` : ''} in ${t.sets} set${t.sets === 1 ? '' : 's'}`);
  }
  if (w.march) out.push(`Marching: ${w.march.steps} steps`);
  out.push('');
  out.push(`Dodges: ${w.dodges.dodged} dodged · ${w.dodges.hit} hit · ${w.dodges.unclear} unseen`);
  for (const line of dodgeLines(w.dodgeLog ?? [])) out.push(`  ${line}`);
  out.push('');
  out.push(`Loadout: ${FAMILIES.map((f) => (x.loadout[f] ? getExercise(x.loadout[f]!.exerciseId).name : '—')).join(' · ')}`);
  if (x.blessings.length) out.push(`Blessings: ${x.blessings.map(blessingName).join(', ')}`);
  out.push('');
  out.push(`Check-in: effort ${fb?.effort ?? '—'} · fun ${fb?.fun ?? '—'} · pacing ${fb?.pacing ?? '—'}`);
  if (ctx.next?.length) out.push(`Next time: ${ctx.next.join(' · ')}`);
  const sore = Object.entries(x.prefs.sore ?? {});
  if (sore.length) out.push(`Sore today: ${sore.map(([a, v]) => `${a} (${v})`).join(', ')}`);
  if (ctx.latency) out.push(`Connection: ${ctx.latency}`);
  out.push('Notes:');
  return out.join('\n');
}

function setLine(s: SetRecord): string {
  const ex = getExercise(s.exerciseId);
  const done =
    ex.kind === 'hold'
      ? `${Math.floor(s.holdMs / 1000)}/${s.target} s`
      : ex.sided
        ? `L ${s.left} R ${s.right} / ${s.target} per side`
        : `${s.camera}/${s.target}${s.manual ? ` +${s.manual} manual` : ''}`;
  const how = s.full ? 'full' : s.finishedEarly ? 'finished early' : 'partial';
  return `${ex.name} ${done} · ${how} · ${Math.round(s.activeMs / 1000)} s`;
}

/** Results grouped by height and cue level, e.g. "LOW · subtle: 1 dodged, 2 hit". */
function dodgeLines(log: { h: string; cues: string; o: string }[]): string[] {
  const by = new Map<string, Record<string, number>>();
  for (const d of log) {
    const k = `${d.h.toUpperCase()} · ${d.cues}`;
    const r = by.get(k) ?? {};
    r[d.o] = (r[d.o] ?? 0) + 1;
    by.set(k, r);
  }
  return [...by.entries()].map(([k, r]) => `${k}: ${['dodged', 'hit', 'unclear'].filter((o) => r[o]).map((o) => `${r[o]} ${o === 'unclear' ? 'unseen' : o}`).join(', ')}`);
}

function blessingName(id: string): string {
  try {
    return blessing(id).name;
  } catch {
    return id;
  }
}
