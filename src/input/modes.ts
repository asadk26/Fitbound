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
 *  - exercise:    only the active exercise detector counts, plus a pause
 *                 gesture chosen per exercise so ordinary reps can't trigger
 *                 it (see exercisePause.ts); nothing else.
 *  - ready:       between a finished set and the enemy's turn: the game
 *                 waits for the player to stand tall with hands relaxed
 *                 (or a Continue press). Only "ready" and pause count, so
 *                 standing up after push-ups can't be read as anything else.
 *  - dodge:       the enemy's attack: only a duck or a hop (from the body, or
 *                 a controller fallback) and pause count.
 *  - off:         nothing.
 *
 * Voice commands ride the same table: "finish set" exists only in exercise
 * mode and in the pause menu (a set paused mid-way), "resume" only in menus,
 * so no voice command can advance dialogue or move the hero.
 */
export type InputMode = 'off' | 'calibration' | 'explore' | 'dialogue' | 'menu' | 'exercise' | 'ready' | 'dodge';

export const INPUT_MODES: readonly InputMode[] = ['off', 'calibration', 'explore', 'dialogue', 'menu', 'exercise', 'ready', 'dodge'];

export type CommandType = 'move' | 'turn' | 'nav' | 'confirm' | 'back' | 'pause' | 'step' | 'ready' | 'finish' | 'resume' | 'recalibrate' | 'duck' | 'hop';

const ALLOWED: Record<InputMode, readonly CommandType[]> = {
  off: [],
  calibration: ['confirm', 'back', 'step'],
  explore: ['move', 'turn', 'confirm', 'back', 'pause', 'step', 'recalibrate'],
  dialogue: ['nav', 'confirm', 'back', 'pause', 'recalibrate'],
  menu: ['nav', 'confirm', 'back', 'pause', 'resume', 'finish', 'recalibrate'],
  exercise: ['pause', 'finish', 'recalibrate'],
  ready: ['ready', 'pause', 'recalibrate'],
  dodge: ['duck', 'hop', 'pause', 'recalibrate'],
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
  /** The standing-neutral "ready" check. */
  neutral: boolean;
  /** Duck / hop reading for dodging. */
  dodge: boolean;
}

export function detectorsFor(mode: InputMode): DetectorSet {
  return {
    march: mode === 'explore' || mode === 'calibration',
    lean: mode === 'explore' || isMenuMode(mode) || mode === 'calibration',
    gestures: mode === 'explore' || isMenuMode(mode) || mode === 'calibration' || mode === 'ready',
    exercise: mode === 'exercise',
    calibration: mode === 'calibration',
    neutral: mode === 'ready',
    dodge: mode === 'dodge',
  };
}
