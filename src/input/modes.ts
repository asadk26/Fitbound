/**
 * The one table of what each input mode allows. The game (the PC in
 * Connected Play) owns the mode; everything that produces input — the local
 * camera, the phone controller, keyboard and touch — is filtered through it.
 *
 *  - calibration: the setup checklist reads motion; gestures and footsteps
 *                 count toward it; nothing moves.
 *  - explore:     march moves, a lean turns, gestures act.
 *  - dialogue:    a lean moves the highlighted answer, gestures choose/back.
 *  - menu:        like dialogue (pause, rewards, between sets).
 *  - exercise:    only the active exercise detector counts; the only other
 *                 command is pause, so a jumping jack can't be read as
 *                 "pause" and a squat can't be read as a step.
 *  - off:         nothing.
 */
export type InputMode = 'off' | 'calibration' | 'explore' | 'dialogue' | 'menu' | 'exercise';

export const INPUT_MODES: readonly InputMode[] = ['off', 'calibration', 'explore', 'dialogue', 'menu', 'exercise'];

export type CommandType = 'move' | 'turn' | 'nav' | 'confirm' | 'back' | 'pause' | 'step';

const ALLOWED: Record<InputMode, readonly CommandType[]> = {
  off: [],
  calibration: ['confirm', 'back', 'step'],
  explore: ['move', 'turn', 'confirm', 'back', 'pause', 'step'],
  dialogue: ['nav', 'confirm', 'back', 'pause'],
  menu: ['nav', 'confirm', 'back', 'pause'],
  exercise: ['pause'],
};

export function commandAllowed(mode: InputMode, type: CommandType): boolean {
  return ALLOWED[mode].includes(type);
}

/** In menus a lean (or arrow key) moves the selection instead of turning. */
export function isMenuMode(mode: InputMode): boolean {
  return mode === 'menu' || mode === 'dialogue';
}

/** Which detectors a controller should run in each mode. */
export interface DetectorSet {
  march: boolean;
  lean: boolean;
  gestures: boolean;
  exercise: boolean;
  calibration: boolean;
}

export function detectorsFor(mode: InputMode): DetectorSet {
  return {
    march: mode === 'explore' || mode === 'calibration',
    lean: mode === 'explore' || isMenuMode(mode) || mode === 'calibration',
    gestures: mode === 'explore' || isMenuMode(mode) || mode === 'calibration',
    exercise: mode === 'exercise',
    calibration: mode === 'calibration',
  };
}
