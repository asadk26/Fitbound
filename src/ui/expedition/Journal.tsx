import { useEffect } from 'react';
import { FAMILIES, FAMILY_INFO, getExercise, targetLabel } from '../../exercise/registry';
import { input } from '../../input/InputHub';
import { summarize } from '../../rpg/journal';
import { useInputEvents } from '../motionUi';
import { useSave } from '../useSave';

const OUTCOME: Record<string, string> = { victory: 'Spark reached', defeat: 'Fell', ended: 'Ended early', suspended: 'Saved', 'in-progress': '—' };
const FEEL: Record<string, string> = { easy: 'felt easy', right: 'felt right', hard: 'felt hard' };

/**
 * The Journal: your training at a glance, from what the game already records.
 * Days you played, how the four families have been worked lately, each
 * movement's current target and its last change, and recent sessions.
 * Read-only; nothing here asks you anything.
 */
export function Journal({ onBack }: { onBack: () => void }) {
  const save = useSave();
  const j = summarize(save.workouts, save.exerciseTargets, save.progress);
  const maxFam = Math.max(1, ...FAMILIES.map((f) => j.families[f].sets));
  useEffect(() => input.setMode('menu'), []);
  useInputEvents((e) => {
    if (e.type === 'back' || e.type === 'confirm') onBack();
  });
  const date = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="title-screen in-garden">
      <div className="title-card setup-card journal">
        <h2>Journal</h2>
        {!save.workouts.length ? (
          <p className="muted">Nothing here yet. Finish an expedition and it appears here.</p>
        ) : (
          <>
            <div className="jr-days" aria-label="The last 14 days">
              {j.days.map((n, i) => (
                <span key={i} className={`jr-day ${n ? 'on' : ''}`} title={`${13 - i} days ago`}>
                  {n > 1 ? n : ''}
                </span>
              ))}
            </div>
            <p className="muted small">
              {j.activeDays} active day{j.activeDays === 1 ? '' : 's'} in the last two weeks
              {j.sinceLast !== null && ` · last session ${j.sinceLast === 0 ? 'today' : j.sinceLast === 1 ? 'yesterday' : `${j.sinceLast} days ago`}`}
            </p>

            <h3>The last two weeks, by family</h3>
            <div className="jr-fams">
              {FAMILIES.map((f) => (
                <div key={f} className="jr-fam" style={{ ['--fam' as string]: FAMILY_INFO[f].color }}>
                  <small>{FAMILY_INFO[f].name}</small>
                  <span className="jr-bar">
                    <i style={{ width: `${(j.families[f].sets / maxFam) * 100}%` }} />
                  </span>
                  <b>{j.families[f].sets} sets</b>
                </div>
              ))}
            </div>

            <h3>Movements</h3>
            <table className="sum-table jr-moves">
              <tbody>
                {j.movements.map((m) => {
                  const ex = getExercise(m.id);
                  return (
                    <tr key={m.id}>
                      <th>{ex.name}</th>
                      <td>{m.sets} sets (4 weeks)</td>
                      <td>target {targetLabel(ex, m.target)}</td>
                      <td className="muted">{m.last ? `${m.last.to > m.last.from ? '▲' : '▼'} ${m.last.from} → ${m.last.to} · ${m.last.why}` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3>Recent sessions</h3>
            <table className="sum-table jr-sessions">
              <tbody>
                {j.sessions.map((r) => (
                  <tr key={r.id}>
                    <th>{date(r.at)}</th>
                    <td>{OUTCOME[r.outcome] ?? r.outcome}</td>
                    <td>
                      {r.sets ?? Object.values(r.volume).reduce((a, v) => a + v.sets, 0)} sets{r.minutes ? ` · ${r.minutes} min` : ''}
                      {r.steps ? ` · ${r.steps} steps` : ''}
                    </td>
                    <td className="muted">
                      {[
                        r.feedback?.effort && FEEL[r.feedback.effort],
                        r.sore?.length ? `sore: ${r.sore.join(', ')}` : '',
                        r.intensity && r.intensity !== 'normal' ? (r.intensity === 'easy' ? 'took it easy' : 'strong day') : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="row">
          <button className="btn btn-big" onClick={onBack}>
            Back to the Sanctuary
          </button>
        </div>
      </div>
    </div>
  );
}
