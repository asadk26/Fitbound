import { EXERCISES, isClassicPlayable, isUnlocked, MAX_LOADOUT } from '../exercise/registry';
import type { Difficulty } from '../exercise/types';
import { levelForXp, type Upgrades } from './progression';
import { DEFAULT_TARGETS, type TrialTargets } from '../trial/config';
import type { Sensitivity } from '../input/motion';
import { DEFAULT_PREFS, SORE_AREAS, SORE_TTL_MS, type Calibrations, type DayPrefs } from '../rpg/loadout';
import type { WorkoutRecord } from '../rpg/workout';
import type { ProgressState } from '../rpg/progression';

export const SAVE_KEY = 'fitbound.save.v1';
export const SAVE_VERSION = 1;

export interface Settings {
  sound: boolean;
  voice: boolean;
  showSkeleton: boolean;
  /** 'full' is more accurate, 'lite' is faster on older phones. */
  model: 'full' | 'lite';
  difficulty: Difficulty;
  /** Per-exercise +/- adjustment to the difficulty's rep/second target. */
  targetAdjust: Record<string, number>;
  /** Motion Trial rep targets. */
  trialTargets: TrialTargets;
  /** Which phone camera watches the player. */
  cameraFacing: 'user' | 'environment';
  /** Body-controller tuning: degrees per lean, and how easily a lean / step registers. */
  motion: MotionSettings;
  /** Voice commands through this computer's microphone. */
  voiceCommands: boolean;
  /** Attack cues: 'adaptive' fades from obvious to body language over a run; 'obvious' always spells it out. */
  attackCues: 'adaptive' | 'obvious';
}

export interface MotionSettings {
  turnStep: 45 | 90;
  lean: Sensitivity;
  march: Sensitivity;
  /** 'guided': follow the trail, choose at forks. 'freeroam': older lean-to-turn steering (experimental). */
  navigation: 'guided' | 'freeroam';
  /** Guided only: march to move ('active') or use a gamepad/keyboard to roam ('assisted'). */
  traversal: 'active' | 'assisted';
  /** Show why reps weren't counted after each set. */
  diagnostics: boolean;
}

export interface SaveData {
  version: number;
  created: boolean;
  heroName: string;
  xp: number;
  gold: number;
  upgrades: Upgrades;
  unlocked: string[];
  loadout: string[];
  defeated: string[];
  /** Times the full dungeon has been cleared. */
  clears: number;
  location: { map: 'village' | 'dungeon'; x: number; y: number } | null;
  settings: Settings;
  /** Lifetime totals, split by how they were verified. */
  totals: { cameraReps: number; manualReps: number; holdSeconds: number; battlesWon: number };
  /** Expedition setup remembered from last time. */
  expeditionPrefs: DayPrefs;
  /** Your own target per exercise (reps, per side, or seconds); defaults from the library. */
  exerciseTargets: Record<string, number>;
  /** Movements you've checked in the Movement Lab (makes beta ones eligible). */
  calibrations: Calibrations;
  /** Recent sessions, for varying the workout. */
  workouts: WorkoutRecord[];
  /** Story progress that outlives any one run. */
  story: StoryState;
  /** Per-movement target progression: streaks and past changes. */
  progress: Record<string, ProgressState>;
}

export interface StoryState {
  /** The opening has been seen (or skipped): it never plays again by itself. */
  openingSeen: boolean;
  /** At least one reignition (the Sanctuary's rain has stopped, for good). Kept equal to reignitions > 0. */
  restored: boolean;
  /** Expeditions that reignited the Spark (bible §6: the story's beats follow this count). */
  reignitions: number;
  /** Scenes seen (or skipped), by id, so first-time scenes never replay by themselves. */
  seen: string[];
  /** Reconstruction rituals so far (varies Elara's line). */
  rituals: number;
  /** When the player last arrived at the Sanctuary. */
  lastVisit: number;
}

export const DEFAULT_STORY: StoryState = { openingSeen: false, restored: false, reignitions: 0, seen: [], rituals: 0, lastVisit: 0 };

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    created: false,
    heroName: 'Hero',
    xp: 0,
    gold: 0,
    upgrades: { atk: 0, def: 0, mag: 0 },
    unlocked: ['pushup', 'squat', 'jumping_jack'],
    loadout: ['pushup', 'squat', 'jumping_jack'],
    defeated: [],
    clears: 0,
    location: null,
    settings: {
      sound: true,
      voice: true,
      showSkeleton: true,
      model: 'full',
      difficulty: 'beginner',
      targetAdjust: {},
      trialTargets: { ...DEFAULT_TARGETS },
      cameraFacing: 'user',
      motion: { turnStep: 45, lean: 'normal', march: 'normal', navigation: 'guided', traversal: 'active', diagnostics: true },
      voiceCommands: false,
      attackCues: 'adaptive',
    },
    totals: { cameraReps: 0, manualReps: 0, holdSeconds: 0, battlesWon: 0 },
    expeditionPrefs: { ...DEFAULT_PREFS },
    exerciseTargets: {},
    calibrations: {},
    workouts: [],
    story: { ...DEFAULT_STORY },
    progress: {},
  };
}

/** Minimal Storage interface so tests can pass an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function store(s?: KeyValueStore): KeyValueStore | null {
  if (s) return s;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSave(s?: KeyValueStore): SaveData {
  const st = store(s);
  if (!st) return defaultSave();
  try {
    const raw = st.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return sanitize(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData, s?: KeyValueStore): boolean {
  const st = store(s);
  if (!st) return false;
  try {
    st.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function resetSave(s?: KeyValueStore): SaveData {
  store(s)?.removeItem(SAVE_KEY);
  return defaultSave();
}

/** Merge an untrusted parsed save over defaults and repair invariants. */
export function sanitize(input: unknown): SaveData {
  const d = defaultSave();
  if (!input || typeof input !== 'object') return d;
  const o = input as Partial<SaveData>;
  const num = (v: unknown, f: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : f);
  const strs = (v: unknown, f: string[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : f);
  const known = new Set(EXERCISES.map((e) => e.id));

  const out: SaveData = {
    version: SAVE_VERSION,
    created: o.created === true,
    heroName: typeof o.heroName === 'string' && o.heroName.trim() ? o.heroName.slice(0, 16) : d.heroName,
    xp: num(o.xp, 0),
    gold: num(o.gold, 0),
    upgrades: {
      atk: Math.min(3, num(o.upgrades?.atk, 0)),
      def: Math.min(3, num(o.upgrades?.def, 0)),
      mag: Math.min(3, num(o.upgrades?.mag, 0)),
    },
    unlocked: strs(o.unlocked, d.unlocked).filter((id) => known.has(id)),
    loadout: strs(o.loadout, d.loadout).filter((id) => known.has(id)),
    defeated: strs(o.defeated, []),
    clears: num(o.clears, 0),
    location:
      o.location && (o.location.map === 'village' || o.location.map === 'dungeon')
        ? { map: o.location.map, x: num(o.location.x, 0), y: num(o.location.y, 0) }
        : null,
    settings: {
      ...d.settings,
      ...(o.settings ?? {}),
      targetAdjust: { ...(o.settings?.targetAdjust ?? {}) },
      trialTargets: { ...DEFAULT_TARGETS, ...(o.settings?.trialTargets ?? {}) },
      motion: { ...d.settings.motion, ...(o.settings?.motion ?? {}) },
    },
    totals: { ...d.totals, ...(o.totals ?? {}) },
    expeditionPrefs: sanitizePrefs(o.expeditionPrefs, known),
    exerciseTargets: Object.fromEntries(Object.entries(o.exerciseTargets ?? {}).filter(([k, v]) => known.has(k) && typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 600).map(([k, v]) => [k, Math.round(v as number)])),
    calibrations: Object.fromEntries(Object.entries(o.calibrations ?? {}).filter(([k, v]) => known.has(k) && v && typeof v.at === 'number' && typeof v.reps === 'number')),
    workouts: Array.isArray(o.workouts) ? o.workouts.filter((w) => w && typeof w.id === 'string' && typeof w.at === 'number' && w.volume && typeof w.volume === 'object').slice(-60) : [],
    progress: sanitizeProgress(o.progress, known),
    story: {
      openingSeen: !!o.story?.openingSeen,
      ...reignitionsOf(o.story, Array.isArray(o.workouts) ? o.workouts : []),
      seen: strs(o.story?.seen, []).slice(0, 500),
      rituals: Number.isInteger(o.story?.rituals) && o.story!.rituals >= 0 ? o.story!.rituals : 0,
      lastVisit: typeof o.story?.lastVisit === 'number' && Number.isFinite(o.story.lastVisit) ? o.story.lastVisit : 0,
    },
  };
  if (typeof out.settings.voiceCommands !== 'boolean') out.settings.voiceCommands = false;
  if (out.settings.attackCues !== 'obvious') out.settings.attackCues = 'adaptive';
  if (!['beginner', 'intermediate', 'advanced'].includes(out.settings.difficulty)) out.settings.difficulty = 'beginner';
  if (out.settings.model !== 'lite' && out.settings.model !== 'full') out.settings.model = 'full';
  if (out.settings.cameraFacing !== 'environment') out.settings.cameraFacing = 'user';
  const mo = out.settings.motion;
  if (mo.turnStep !== 90) mo.turnStep = 45;
  const sens = ['low', 'normal', 'high'];
  if (!sens.includes(mo.lean)) mo.lean = 'normal';
  if (!sens.includes(mo.march)) mo.march = 'normal';
  if (mo.navigation !== 'freeroam') mo.navigation = 'guided';
  if (mo.traversal !== 'assisted') mo.traversal = 'active';
  if (typeof mo.diagnostics !== 'boolean') mo.diagnostics = true;
  for (const k of Object.keys(DEFAULT_TARGETS) as (keyof TrialTargets)[]) {
    const v = Number(out.settings.trialTargets[k]);
    out.settings.trialTargets[k] = Number.isFinite(v) && v >= 1 && v <= 50 ? Math.round(v) : DEFAULT_TARGETS[k];
  }
  return reconcileUnlocks(out);
}

/**
 * Reignitions, from the save; saves from before the count existed derive it
 * from their victories (at least one if the rain had already stopped).
 */
function reignitionsOf(story: Partial<StoryState> | undefined, workouts: Partial<WorkoutRecord>[]): Pick<StoryState, 'restored' | 'reignitions'> {
  let n = Number.isInteger(story?.reignitions) && story!.reignitions! >= 0 ? story!.reignitions! : null;
  if (n === null) {
    const wins = workouts.filter((w) => w && w.outcome === 'victory').length;
    n = story?.restored ? Math.max(1, wins) : wins;
  }
  return { restored: n > 0, reignitions: n };
}

function sanitizePrefs(v: unknown, known: Set<string>): DayPrefs {
  const p = (v && typeof v === 'object' ? v : {}) as Partial<DayPrefs>;
  return {
    dumbbells: p.dumbbells === true,
    support: p.support === true,
    exclude: Array.isArray(p.exclude) ? p.exclude.filter((x): x is string => typeof x === 'string' && known.has(x)) : [],
    intensity: p.intensity === 'easy' || p.intensity === 'strong' ? p.intensity : 'normal',
    experimental: p.experimental === true,
    ...sanitizeSore(p),
  };
}

function sanitizeProgress(v: unknown, known: Set<string>): Record<string, ProgressState> {
  const out: Record<string, ProgressState> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!known.has(id) || !raw || typeof raw !== 'object') continue;
    const r = raw as Partial<ProgressState>;
    const history = Array.isArray(r.history)
      ? r.history.filter((h) => h && typeof h.at === 'number' && typeof h.from === 'number' && typeof h.to === 'number' && typeof h.why === 'string').slice(-12)
      : [];
    out[id] = { streak: Number.isInteger(r.streak) && r.streak! >= 0 && r.streak! < 10 ? r.streak! : 0, history };
  }
  return out;
}

/** Soreness is about today: an old answer is dropped. */
function sanitizeSore(p: Partial<DayPrefs>): Pick<DayPrefs, 'sore' | 'soreAt'> {
  const at = typeof p.soreAt === 'number' && Number.isFinite(p.soreAt) ? p.soreAt : 0;
  if (!p.sore || typeof p.sore !== 'object' || Date.now() - at > SORE_TTL_MS) return { sore: {} };
  const sore: DayPrefs['sore'] = {};
  for (const a of SORE_AREAS) {
    const v = (p.sore as Record<string, unknown>)[a];
    if (v === 'gentle' || v === 'rest') sore[a] = v;
  }
  return { sore, soreAt: at };
}

/** Ensure unlocks match the level and the loadout holds only playable, unlocked exercises. */
export function reconcileUnlocks(s: SaveData): SaveData {
  const level = levelForXp(s.xp);
  const unlocked = new Set(s.unlocked);
  for (const ex of EXERCISES) if (isUnlocked(ex, level)) unlocked.add(ex.id);
  s.unlocked = EXERCISES.filter((e) => unlocked.has(e.id)).map((e) => e.id);
  const loadout = [...new Set(s.loadout)].filter((id) => {
    const ex = EXERCISES.find((e) => e.id === id);
    return ex && unlocked.has(id) && isClassicPlayable(ex);
  });
  s.loadout = loadout.slice(0, MAX_LOADOUT);
  if (s.loadout.length === 0) s.loadout = ['pushup', 'squat', 'jumping_jack'];
  return s;
}
