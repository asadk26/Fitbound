import type { Beat, Line, Script } from './cinema';

/**
 * The cinematic scripts. Canon notes (see docs/design-bible.md §5):
 * time flows through the Heart, which has lost its Spark; the Heart is
 * benevolent; it reconstructs the protagonist, and that is all we say about
 * his origin. Elara knows more than she says, so a few of her lines should
 * read differently later ("How much do you remember?", "Not yet.").
 * The Spark lies at the far end of time.
 *
 * The Sanctuary has been under a soft, persistent rain for a very long time.
 * It stops after the first reignition and never returns. Nothing here
 * explains why.
 */

const elara = (n: number, text: string, offscreen = false): Line => ({ id: `opening.elara.${String(n).padStart(2, '0')}`, who: 'elara', text, offscreen });
const hero = (n: number, text: string, mood?: Line['mood']): Line => ({ id: `opening.hero.${String(n).padStart(2, '0')}`, who: 'hero', text, mood });

export const OPENING: Script = {
  id: 'opening',
  beats: [
    // Darkness. Rain first, then a heartbeat beneath it.
    { set: 'dark', sound: { rain: 0.45, muffled: false, heart: 0, heartVol: 0, music: null }, ms: 3200 },
    { cues: ['heart-glow'], sound: { heart: 50, heartVol: 0.45 }, ms: 5200 },

    // Moments from somewhere in time, in fragments.
    { set: 'memory', cues: ['mem-square'], sound: { music: 'opening', heartVol: 0.3 }, ms: 2000 },
    { line: elara(1, 'It didn’t end all at once. It faded.', true) },
    { line: elara(2, 'A street. A name. A song.', true) },
    { cues: ['mem-towers'], ms: 2600 },
    { cues: ['mem-field'], ms: 2000 },
    { line: elara(3, 'Everything that ever was still runs through the Heart.', true) },

    // The Heart. The rain is far above now.
    { set: 'heart', cues: ['heart-wake'], sound: { muffled: true, rain: 0.4, heart: 54, heartVol: 0.85 }, ms: 3600 },
    { cues: ['heart-gather'], ms: 2600 },
    { line: elara(4, 'It remembers everything it can. And it keeps trying.', true) },
    { cues: ['heart-flare'], ms: 1500 },

    // The Sanctuary, in the rain. He forms on the stone; she is waiting by the well.
    { set: 'sanctuary', cues: ['flash', 'sanct-open'], sound: { muffled: false, rain: 0.5, heart: 0, music: 'sanctuary' }, ms: 3000 },
    { cues: ['hero-form'], ms: 3000 },
    { cues: ['hero-rise'], ms: 2600 },
    { cues: ['elara-stand', 'two-shot'], ms: 1800 },
    { line: elara(5, 'You’re awake. Good.') },
    { line: elara(6, 'How much do you remember?') },
    { line: hero(1, '…A sword. A road. The Spark.') },
    { line: elara(7, 'That’s enough to start with.') },
    { line: hero(2, 'Did I reach it?', 'wonder') },
    { cues: ['elara-look-away'], ms: 1100 },
    { line: elara(8, 'Not yet.') },
    { cues: ['elara-look-back'], ms: 500 },
    { line: elara(9, 'I’m Elara. I keep the Sanctuary. I’ll keep it for you, while you’re out there.') },

    // The Spark, far off.
    { cues: ['to-spark'], ms: 4200 },
    { line: elara(10, 'That’s the Spark. All the way at the end of time. The Heart can’t reach it anymore.') },
    { line: elara(11, 'The Heart will give you what it remembers.') },
    { line: elara(12, 'It may not be what you remember.') },
    { cues: ['from-spark'], ms: 2600 },
    { line: elara(13, 'Come. Let’s see what the Heart has remembered of you.') },
    { cues: ['settle'], ms: 700 },
  ],
};

/** Why the hero is being gathered back into the Sanctuary. */
export type RitualReason = 'firstRestoration' | 'victory' | 'fell' | 'ended' | 'suspended' | 'return' | 'longAway';

const RITUAL_LINES: Record<RitualReason, string[]> = {
  // The first restoration: the rain has stopped. She doesn't say why.
  firstRestoration: ['Listen.', 'Do you hear that? …Nothing at all.'],
  victory: ['It’s holding. For now.', 'The Spark is still burning. I can feel it from here.', 'You came back brighter than you left.'],
  fell: ['There you are. The Heart found the pieces.', 'Rest a moment. Then we try again.', 'It let you fall. It never lets you go.'],
  ended: ['Back already? That’s all right.', 'The path will keep.'],
  suspended: ['The path will wait where you left it.', 'Rest. It will still be there.'],
  return: ['There you are.', 'The Heart kept your place.', 'You’re awake. Good.'],
  longAway: ['It’s been a while. The Heart kept listening for you.', 'You were gone a long time. Everything held.'],
};

export function ritualLine(reason: RitualReason, count: number): string {
  const pool = RITUAL_LINES[reason];
  return pool[Math.abs(count) % pool.length];
}

/**
 * The short reconstruction ritual (about ten seconds, skippable): a
 * heartbeat, light gathering over the stone, the hero forming, and one line
 * from Elara that fits how he left.
 */
export function ritualScript(reason: RitualReason, count: number): Script {
  const say = (i: number): Beat => ({ line: { id: `ritual.${reason}.${i}`, who: 'elara', text: RITUAL_LINES[reason][i] } });
  // The first restoration is the one ritual with a pause in it: she listens first.
  const lines = reason === 'firstRestoration' ? [say(0), { cues: ['elara-look-away'], ms: 1400 }, say(1)] : [say(Math.abs(count) % RITUAL_LINES[reason].length)];
  const beats: Beat[] = [
    { set: 'sanctuary', cues: ['ritual-open'], sound: { muffled: false, heart: 50, heartVol: 0.5, music: null }, ms: 1400 },
    { cues: ['ritual-form'], ms: 3200 },
    { cues: ['elara-glance'], ms: 700 },
    ...lines,
    { cues: ['settle'], sound: { heart: 0 }, ms: 500 },
  ];
  return { id: `ritual-${reason}`, beats };
}

/** Which ritual fits: how the last run ended, or how long the player has been away. */
export function ritualReason(o: { outcome?: 'victory' | 'defeat' | 'ended' | 'suspended'; firstRestoration?: boolean; fell?: boolean; daysAway?: number }): RitualReason {
  if (o.outcome === 'victory') return o.firstRestoration ? 'firstRestoration' : 'victory';
  if (o.outcome === 'defeat' || o.fell) return 'fell';
  if (o.outcome === 'ended') return 'ended';
  if (o.outcome === 'suspended') return 'suspended';
  return (o.daysAway ?? 0) >= 4 ? 'longAway' : 'return';
}
