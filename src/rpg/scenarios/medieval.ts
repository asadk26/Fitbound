import { registerInterludes } from '../../story/interludes';
import type { Scenario } from '../fractures';
import { STORY } from '../story';

/**
 * Medieval, role A: the first-fracture scenario, built from the existing
 * medieval content and ending with its miniboss, the Green Knight (from the
 * medieval legend). He is fought in two stages: the blow lands, his head
 * rolls, and he picks it up and carries on — which is his whole game.
 */
export const MEDIEVAL_A: Scenario = {
  id: 'medieval.A',
  fracture: 'medieval',
  role: 'A',
  title: 'Medieval: the Green Knight',
  plannedSets: 14,
  nodes: [
    { kind: 'fight', title: 'The Training Yard', at: 'dummyStop', pool: [['echo_dummy']], cues: 'obvious', early: true, leg: STORY.legs['The Training Yard'] },
    { kind: 'fight', title: 'Rusted Causeway', at: 'signStop', pool: [['iron_husk']], cues: 'obvious', leg: STORY.legs['Rusted Causeway'] },
    { kind: 'blessing' },
    { kind: 'fight', title: 'The Bone Field', at: 'skeleton', pool: [['bone_charger']], cues: 'clear', leg: STORY.legs['The Bone Field'] },
    { kind: 'blessing' },
    {
      kind: 'boss',
      title: 'The Green Crossroads',
      at: 'forkC',
      cues: 'clear',
      leg: 'At the crossroads someone is laughing: a big, warm laugh, far too cheerful for the Haze.',
      intro: 'medieval.A.knight.intro',
      stages: [{ enemies: ['green_knight'] }, { enemies: ['green_knight_headless'], interlude: 'medieval.A.knight.rise' }],
    },
  ],
};

registerInterludes([
  {
    id: 'medieval.A.knight.intro',
    full: [
      { who: '', text: 'At the crossroads a knight waits for you: green armour, green skin, a beard like new leaves. A holly bough in one hand, a great axe in the other.' },
      { who: 'The Green Knight', text: 'A traveller! Good. I have a game for you.' },
      { who: 'The Green Knight', text: 'Strike me one blow, and in a year and a day I return it.' },
      { who: 'The Green Knight', text: 'Time is broken here, so a year is whatever I say it is. Strike!' },
    ],
    short: [{ who: 'The Green Knight', text: 'Back for the game? You strike first, as always.' }],
  },
  {
    id: 'medieval.A.knight.rise',
    full: [
      { who: '', text: 'The blow lands. The great green head tumbles into the grass.' },
      { who: '', text: 'The body stoops, lifts the head by its leafy hair — and the head opens its eyes.' },
      { who: 'The Green Knight', text: 'A fair blow! Now, as agreed: my turn.' },
    ],
    short: [
      { who: '', text: 'He picks up his head again.' },
      { who: 'The Green Knight', text: 'My turn.' },
    ],
  },
]);
