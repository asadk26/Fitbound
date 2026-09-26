/**
 * Narrative text, light and non-spoiling. Canon (design bible §5): time is
 * the blood of reality and flows through the Heart, which has lost its
 * Spark; eras collide and the Haze spreads. The Heart (benevolent) rebuilds
 * the protagonist and sends him toward the end of time to reignite the
 * Spark; each reignition restores some order, for now. Elara keeps the
 * Sanctuary and knows more than she says. Loadouts are imperfect
 * reconstructions of his abilities; blessings are techniques the Heart
 * recalls; the Mirror of Unlived Lives offers another configuration. The
 * metaphor (stagnation → momentum) is never spoken.
 *
 * Rule: nothing is revealed while the player is concentrating on a movement.
 * Haven memories come after the stretches end.
 */
export const STORY = {
  sanctuaryGreeting: 'Tell me what you have to work with today.',
  loadoutNote: 'Each expedition the Heart rebuilds you a little differently. Four kinds of strength; the forms they take will change.',
  departure: 'The path to the Spark is open for now. I’ll be here when you come back. …Try to come back.',
  blessingIntro: 'A fragment surfaces — a technique from some other version of you. The Heart offers it. Take one.',
  mirrorIntro: 'A mirror stands where no mirror should. In it you move differently — another way you might have lived. The Heart offers it without explanation.',
  mirrorKept: 'You look away. This is who you are today.',
  mirrorChanged: 'The reflection steps forward, and you step back into it. Your body remembers new things. Everything you’ve already done stays done.',
  havenIntro: 'A quiet hollow the Haze hasn’t touched. Rest here. Nothing will find you while you breathe.',
  havenMemory:
    'As your breath slows, something surfaces: a courtyard in the morning, a voice counting with you — one, two, three — patient, fond. You almost know the voice. Then it’s gone.',
  havenElara: 'Elara, when you tell her later, is quiet for a moment. “Hold on to that,” she says. “The Heart doesn’t give those back easily.”',
  bossIntro: 'Beyond the last rise the Spark burns, small and stubborn. Between you and it: the Warden of the Haze.',
  victory: 'You touch the Spark. It catches. Somewhere, time finds its beat again — for now.',
  victoryElara: '“It’s holding,” Elara says when you return. “It won’t hold forever. But you did this.” She doesn’t say what happens when it fades.',
  fallen: 'Your form scatters into the Haze, and the Heart gathers you home. This expedition is over. What your body did out there stays done.',
  fallenEnd: 'The Heart gathers you back to the Sanctuary. What your body did out there, it did — that stays.',
  suspended: 'You rest at the edge of the path. It will wait for you.',
  shrine: 'The Mossy Shrine hums as you pass. Some of your strength returns.',
  crossingFirst: 'The ground thins under your feet. Through the Haze, another age is waiting — close enough to touch, and nothing like this one.',
  crossing: 'The Haze thins. Another age waits on the other side.',
  stillpointFirst: 'The fighting falls away. The Heart has opened a quiet place between the ages: no wind, no Haze, only a slow warm pulse underfoot. Rest here. The next age can wait.',
  stillpoint: 'The Stillpoint again: quiet between the ages. Rest, if you like.',
  /** A line as each march begins, keyed by the destination's title. */
  legs: {
    'The Training Yard': 'The Sanctuary gate opens onto a meadow the Haze has only half remembered. Somewhere ahead, straw rustles.',
    'Rusted Causeway': 'The path narrows toward an old signpost. Iron grinds against iron — something is guarding the way.',
    'The Bone Field': 'Past the ward-gate the grass turns grey. Hooves of bone scrape on stone.',
    'The Mirror of Unlived Lives': 'At the crossroads, the light gathers into something like glass.',
    'Drifting Hollow': 'The air thickens by the quarry. Faint shapes drift between the stones.',
    'A Quiet Haven': 'A campfire burns in the tower’s shadow, somehow untouched by the Haze.',
    'The Veiled Stair': 'Crystals hum along the stair. Someone is weaving the Haze into a wall.',
    'Before the Spark': 'The last rise. The Spark flickers — and something vast stands before it.',
  } as Record<string, string>,
};
