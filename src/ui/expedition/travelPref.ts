import { getSave, updateSave } from '../../game/store';
import { toggleTraversal } from '../TrialRun';

/**
 * How the hero gets between expedition encounters: controller-first (bible
 * §27), with guided marching as an option. Expeditions remember their own
 * choice (`settings.expeditionTravel`); the Motion Trial keeps the shared
 * `motion.traversal` it has always used. While an expedition is open the
 * live setting follows the expedition's choice, and it's handed back after.
 */
let trialTravel: 'active' | 'assisted' | null = null;

export function enterExpeditionTravel(): void {
  const s = getSave();
  trialTravel = s.settings.motion.traversal;
  updateSave((d) => void (d.settings.motion.traversal = d.settings.expeditionTravel));
}

export function leaveExpeditionTravel(): void {
  const back = trialTravel;
  trialTravel = null;
  updateSave((d) => {
    d.settings.expeditionTravel = d.settings.motion.traversal;
    if (back) d.settings.motion.traversal = back;
  });
}

/** Set the expedition's travel (Sanctuary choice). */
export function setExpeditionTravel(t: 'active' | 'assisted'): void {
  updateSave((d) => {
    d.settings.expeditionTravel = t;
    d.settings.motion.traversal = t;
  });
}

/** Switch marching ⇄ controller mid-expedition (Select, T, or the pause menu). */
export function toggleExpeditionTravel(): void {
  toggleTraversal();
  updateSave((d) => void (d.settings.expeditionTravel = d.settings.motion.traversal));
}
