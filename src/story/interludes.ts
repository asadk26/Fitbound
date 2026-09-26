/**
 * Short scenes inside a fight: a boss's introduction, or what happens
 * between the stages of a staged boss. Each has a full version, played the
 * first time, and a short one for every time after (bible §8: skipping
 * counts as seeing; losing never resets it). Enemy lines may use the
 * synthetic voice; Elara never appears here.
 */
export interface InterludeLine {
  /** Speaker's name, or '' for narration. */
  who: string;
  text: string;
}

export interface Interlude {
  id: string;
  full: InterludeLine[];
  short: InterludeLine[];
}

export const INTERLUDES: Record<string, Interlude> = {};

export function registerInterludes(list: Interlude[]): void {
  for (const i of list) INTERLUDES[i.id] = i;
}

/** The lines to play: the full scene the first time, the short one after. */
export function interludeLines(id: string, seen: readonly string[]): InterludeLine[] {
  const i = INTERLUDES[id];
  if (!i) return [];
  return seen.includes(id) ? i.short : i.full;
}
