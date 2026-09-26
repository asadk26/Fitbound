# Proposals: fracture architecture, bosses and the workout, the Test of Resolve, Anachronisms

- **Status:** for the creator's approval. Nothing here is built yet. The design bible stays canon; where this document suggests something, the bible's open questions (§34) still apply until approved.
- **Written:** 2026-09-26, against the code after the session/resume work (sessions per sitting, fights saved at safe points).

---

## 1. Fracture architecture

### What it has to do

- Run **independently implemented A and B scenarios**, drawn at random.
- Keep **persistent flags** per scenario and per scene.
- Include a **temporal crossing** between the two fractures.
- Work with an **incomplete roster** during development, and never invent placeholder content.
- Keep old saves finishing on the routes they started on.

### Content is data

The code would sit in `src/rpg/fractures/`, one file per era.

```ts
interface Fracture {
  id: string;              // 'medieval', 'prehistoric', '1800s', 'modern', 'future', … (open-ended)
  name: string;
  board: string;           // which diorama board it plays on
  backdrop: string;        // battle backdrop
  introductory?: boolean;  // available from the start (Medieval, Prehistoric, Modern)
  unlockAt?: number;       // reignitions needed (1800s: 1, Future: 2); absent = introductory
}

interface Scenario {
  id: string;              // 'medieval.A', '1800s.B', …
  fracture: string;
  role: 'A' | 'B';
  title: string;
  nodes: NodeTemplate[];   // the scenario's route: fights, a blessing, a Haven, discovery spots…
  boss: BossDef;           // A: the miniboss; B: the main boss
}

type NodeTemplate =
  | { kind: 'fight'; pool: string[][]; at: string; cues?: Cues } // one enemy group drawn from the pool
  | { kind: 'blessing' | 'haven' | 'mirror' }
  | { kind: 'discovery'; at: string };                            // optional spot (section 4)

interface BossDef {
  at: string;
  stages: ({ fight: string[] } | { scene: string })[]; // e.g. Booth → scene → Lincoln
  intro: { full: string; short: string };              // scene ids (first time / every other time)
  allowance: number;                                   // set allowance for the whole encounter (section 2)
}
```

**Availability:**
- A scenario exists only if it has been built. The registry simply lists the implemented ones.
- **Development** can play any implemented scenario. A `?allScenarios` debug flag, or a Lab option, ignores story unlocks.
- **Player-facing unlocks** are derived, not stored:
  - introductory fractures are always available;
  - `unlockAt` is compared with `story.reignitions`.

  This keeps "implemented" and "unlocked" separate.

### An expedition is materialised when it starts

A new expedition records its two scenario ids. It also writes out **the concrete node list**: the chosen enemy groups, with the crossing and the reignition in between.

```text
ExpeditionState v2 = { v: 2, plan: ['medieval.A', 'prehistoric.B'], nodes: ExNode[], index, battle?, … }
```

A saved run carries its own route. Editing a scenario later can't break it or shift its index; this is the route versioning. Validation checks the nodes (known enemies, known stops). A node that no longer resolves is skipped with a note, and the run is never discarded.

**v1 saves** (today's standard and short routes) keep playing on the frozen legacy `ROUTES` until they finish.

### New node kinds

- **`crossing`:**
  - It saves automatically, shows a short Haze transition (full the first time, a few seconds after that), and switches board.
  - It offers "a good place to stop" and the Mirror.
  - It is only a suggested stop; stopping elsewhere keeps working as it does now.
- **`discovery`:** an optional spot for Anachronisms and Elara's traces (section 4). Guided marching can walk past it.
- **Staged boss:**
  - The battle save gains `stage`.
  - Scenes between stages play in full only the first time.
  - Resuming mid-sequence continues at the saved stage with one recap line.

### Selection

The rules are simple and weighted, so the order isn't predictable.

1. **Candidates:** implemented and player-available A scenarios for the first position, and B scenarios for the second. **The two must be different eras.**
2. **Introductory expedition:**
   - The first expedition takes `medieval.A` if it's implemented.
   - Its second position is drawn from the other introductory fractures' B scenarios.
   - A loss doesn't repeat it: the next expedition is normal.
3. **Weights:**
   - base 1;
   - a scenario never met gets **×3**, so new content appears promptly;
   - played in the last expedition, **×0.25**; two expeditions ago, **×0.5** (repeat protection);
   - a fracture with a pending optional quest step gets **×1.5** (section 4).
4. **Incomplete rosters:**
   - If no valid two-era pair exists, use the pair that does exist.
   - During development only, allow the same era's A and B together.
   - If nothing qualifies, fall back to the legacy standard route.
   - There are never placeholders.

**How content availability changes the game:**

| Content available | What new expeditions use |
|---|---|
| Nothing new (today) | The legacy route |
| After stage B (Medieval A + Prehistoric B) | The one canonical pair |
| From stage C onward | Real variety |

### Persistent flags, in the save

```text
story.reignitions: number                     // replaces the boolean `restored` (kept as reignitions > 0)
story.seen: string[]                          // scene ids: 'opening', '1800s.B.theatre', 'crossing', …
story.scenarios: { [id]: { met, bossReached, bossDefeated, lastExpedition } }
story.found: string[]                         // discoveries, Anachronism and trace flags (section 4)
story.elara: 'present' | 'gone'
```

- **When they're written:** the moment the event happens, not when the expedition ends. A scene counts as seen when it finishes or is skipped. This way failures, quits and resumes never lose them.
- **Additive only:** flags are only ever added.

### Cost, and the order to build it in

1. Scenario types, the generator and its tests, using made-up scenarios in tests. **Medium.**
2. Expedition v2 (the materialised nodes, crossing and discovery kinds, and staged boss saves) alongside the v1 legacy path. **Medium.**
3. A board for each fracture in `DioramaScene`. Today there is one meadow board. This is the first step that needs art: **medium for the first extra board.**

Steps 1 and 2 can be built and tested before stage A. Stage A (Medieval A and the Green Knight) is the first content to use them.

---

## 2. Bosses, the workout, and physical failure

### The problem

Today a fight lasts until HP runs out, and nothing links boss HP to how many sets it takes.

The goal is a boss that is a real achievement and still fits about 20 minutes of workout. That rules out padding HP and letting a boss die automatically at a budget.

### Proposal: allowances in turns, validated by simulation, with difficulty from mechanics

1. **Every combat encounter has a set allowance, measured in turns.**
   - Ordinary fights: about 3 turns.
   - Minibosses: about 4.
   - Main bosses: about 5, shared across all stages.

   Together that is about 21 sets per expedition, today's plan. HP is tuned so that competent play, with mostly full sets, finishes near the allowance.

   **This doesn't depend on the player's targets.** A set's effect is relative to its own target (`effectiveness` uses done ÷ target), so lower targets on a sore day don't make fights longer.
2. **A balance harness,** in `tests/balance.test.ts`.
   - It plays each encounter thousands of times with scripted players: a careful one, a sloppy one, one doing 70% partial sets, and one with poor dodging.
   - Tests assert, for example, that the median careful player wins a main boss in 4 to 6 turns, and a partial-set player in no more than about 8.
   - That turns "don't create exercise-volume traps" into something the test suite checks, instead of a hope.
3. **Difficulty comes from mechanics:**
   - **Phases:** each has its own HP and a visible change of pattern. They also make natural safe points.
   - **Openings:** a boss that is staggered or disrupted takes bonus damage from the next ability. This rewards decisions, not volume.
   - **Group behaviour,** such as the Authors rewriting themselves.
   - **Telegraphs that stay honest.**
4. **No automatic kill at the allowance, and no higher rep targets.** An over-long fight means the balance is wrong. The harness catches it before the player feels it.

### Partial sets by ability type

This refines today's single curve, `0.35 + 0.65 × done/target`, with a floor for any verified work.

| Ability part | Partial-set rule |
|---|---|
| Damage, shield, heal | Keep today's curve. Any verified work does something; a full set does it all. |
| Hold-powered abilities | The same curve, on seconds held. |
| **Binary effects:** disrupt/interrupt, stagger thresholds, armour break | Trigger at **half the target or more**, not scaled. Below half, only the numeric part lands, reduced. |
| Storm Charge | Build it at half the target or more. |

### Tracking failure is not physical failure

- The manual fallback already exists: after a stall, the player can count the rest by hand.
- Manual reps power abilities exactly like camera reps, and they're labelled "manual" in the history.
- A tracking loss never reduces an effect beyond what was counted, and never counts as a failed dodge.
- **Proposed addition:** "Finish set" after a tracking stall offers **"I did them — count the target"**. This is the same as the manual fallback in one step, and it's recorded as manual.

### Exhaustion mid-boss

Three choices, all possible now or with small additions:
- **Suspend:** this now works mid-fight, at safe points, including staged bosses once they exist.
- **Concede:** the expedition ends as a failed attempt, which offers the Test of Resolve.
- **Continue.**

### Measuring workout time

Measuring it properly is part of this proposal.

- **Workout time:** sets, dodge windows, standing up to get ready, and rest between sets inside fights, per bible §18.
- **Excluded:** menus, scenes, marching when it's controller-driven, and dialogue.
- The existing pacing buckets need one split: fight time into *physical* and *choosing*.
- It appears in the summary and the playtest report.

This is the number the ~20 minute target will be tuned against after a real playtest.

---

## 3. Test of Resolve: a small first version

**Offered** on the summary after **every failed expedition**: *"The expedition is over. Your resolve remains."*

The two choices:
- *Take the Test of Resolve*
- *Return to the Sanctuary* (default, no pressure)

### Sizing: today's session, not the expedition

- **Today's appropriate session:** about 21 working sets, scaled by today's readiness (Take it easy ×0.7, Strong ×1.15).
- **Remaining** = today's appropriate total − working sets done **this session**.
- **Test length:** 2 sets if about 2 to 5 remain; 3 if 6 to 9 remain; 4 if 10 or more remain.
- **Fewer than 2 remaining:** not offered. Instead: *"You've done a full session today. Rest well."*

### The challenge

- A short, calm sequence of prescribed sets, not a fight.
- Movements come from today's eligible pool: soreness, exclusions, equipment and calibration all respected.
- **It never uses the family worked most this session**, the one that tired you.
- Targets are today's normal targets. There is no timer and no scoring.
- **It succeeds when every set has some verified work** (camera or manual). Finishing a set early is fine.
- If you stop partway, your work is kept, with no reward and no penalty.

### The reward

You pick it **before** starting, so it's clear what you're going for:

| Reward | What it does in the next new expedition |
|---|---|
| **Chosen Movement** | Lock one eligible movement into its family's slot; the other slots stay random |
| **Kindled Blessing** | Start with one blessing, chosen from three |
| **Warded Start** | Start the first fight with a 20-point shield (the existing shield mechanic) |

**Holding a reward:**
- It's held in `save.resolve`: **one at a time.** A new Test offers to replace the held reward, and the player decides.
- It's used up at the **next newly started** expedition, never a suspended one.
- There are no tiers or stacking. A weapon reward isn't proposed, because there is no weapon system to attach it to.

### Cost

Small to medium: one screen, a sizing function with tests, the three reward hooks in `begin()` and in the engine's opening shield, and the save field. It depends on "a fall ends the expedition", which is already built.

---

## 4. Anachronisms: the smallest reusable architecture

### One registry of entries, one set of flags

```ts
interface Anachronism {
  id: string;                    // 'clockmaker.stranded'
  fracture: string;              // where it can appear
  role?: 'A' | 'B';              // either, if omitted
  kind: 'detail' | 'npc' | 'item';
  requires?: string[];           // flags that must be held
  grants?: string[];             // flags set on interaction (the step is done once all are held)
  lines: string[];               // a few short lines; no dialogue trees
  priority?: number;             // quest steps above plain details
}
```

**Where they appear:**
- Each scenario has one or two **discovery spots** (`discovery` nodes on its board).
- When a scenario is played, each spot shows the highest-priority entry for that fracture whose `requires` are held and whose `grants` aren't all held yet.
- A plain environmental detail is the default.

**What is saved:**
- Flags go in `story.found` the moment the player interacts.
- Collected objects are just flags with names, listed in the Journal under **Curiosities**. There's no inventory screen.

### The clockmaker, as the worked example

| Step | Where | Requires | Grants |
|---|---|---|---|
| A Victorian clockmaker stranded among ferns asks for his watch mechanism | Prehistoric, either role | none | `clockmaker.met` |
| His workshop, fogbound, with the mechanism on the bench | 1800s, either role | `clockmaker.met` | `watch.mechanism` |
| He's still there; you hand it over, and he leaves a ticking pocket watch in the Sanctuary | Prehistoric, either role | `watch.mechanism` | `clockmaker.done` |

### The guarantees

- **Missed via marching:** nothing is set, so the spot offers the same step next time.
- **No waiting forever:**
  - a step can appear in **either role** of its era;
  - selection gives a ×1.5 weight to fractures with a pending step;
  - a step for a fracture the player hasn't unlocked yet simply waits, and the Journal says *"somewhere you haven't been yet."*
- **Never mandatory:** nothing required for reignitions or the story sits in a discovery spot.
- **Reuse:** Elara's traces use the same entries (kind `item`, a `trace.*` flag) and the same spots, with at most one trace per expedition.

### Cost

Small once the fracture architecture exists: a registry, a lookup function with tests, one interaction overlay, and a Journal list. Content grows era by era.

---

## 5. Conflicts to flag

1. **Controller-first vs today's default.** The bible now says exploration is controller-first, with guided marching optional. The build still **defaults to marching** between encounters (`settings.motion.traversal = 'active'`). Suggestion: make controller travel the default once you've done the next playtest. Or, if you'd like, switch it now. I haven't changed it silently.
2. **Two different eras vs today's content.** Until Prehistoric B exists, new expeditions use the legacy standard route. This matches "legacy content can remain available", but it means no real crossing yet.
3. **The workout-time target can't be checked yet.** The measure in section 2 is needed first.
4. **A fall now ends the expedition,** as you decided. The Test of Resolve isn't built yet, so the defeat summary for now offers only the return to the Sanctuary.
