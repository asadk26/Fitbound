# Proposal: Heart of Haze, revised narrative and expedition structure

- **Status:** proposal for the creator's approval. Nothing here is implemented, and nothing here is canon until approved.
- **Replaces, once approved:** design bible §5 to §8, parts of §9, §12, §18, §19 and §33, plus the canon lines in `CLAUDE.md`.
- **Unchanged:** the principles in §3, the fitness rules in §10 to §17, and the special encounters in §21 to §26.
- **Written:** 2026-09-26, from the creator's brief and an audit of the code at commit `3425496` onward.

Sections 1 to 10 follow the order of the brief. The one exception is **section 4**. It covered short expeditions, and the creator has since removed them, so it now explains how shorter sessions work instead.

---

## 0. What changed in this revision, and one contradiction resolved

The brief arrived with a note that overrides part of it: **the short route is removed entirely.** There is one canonical expedition:

> Sanctuary → fracture 1 (random) → its miniboss → fracture 2 (random) → its main boss → reignite the Spark.

The longer brief still mentions a one-fracture short expedition in several places: §2, §7, and the 12 to 15 minute target in §11. **This proposal follows the override** and drops all of it: no short-route bosses, no short-route rewards, and no second pacing target. A shorter workout is simply part of a standard expedition, stopped and resumed later (section 4).

---

## 1. The core premise (rewritten)

> Time is the blood of reality, and it flows through the Heart.
>
> The Heart has lost its Spark. Without it, its rhythm is failing. Time is coming apart at the seams: eras collide, and the Haze seeps through the fractures between them.
>
> The Heart has rebuilt you and sends you out, again and again, through the fractured ages toward the end of time, where the Spark still burns. Reach it, and rekindle the Heart.
>
> Each time you do, a little more order returns. Not all at once. But it returns.

That is the whole story engine: *the Heart has lost its Spark, time is falling apart, get moving and rekindle it.*

**What the premise deliberately does not have:**
- time-travel paradoxes;
- competing timelines;
- rules for how the Haze works;
- a theory of the hero's consciousness.

Eras collide because time is unstable. That is the only explanation the game ever needs.

**The emotional metaphor stays under the surface.** A world without its Spark is a world that has stopped moving. Each expedition is effort that gets it moving again, a little at a time.

No character ever names what this stands for. Guardrails for all story text:

- Never use *depression*, *depressed*, *motivation*, *lazy*, *cure*, *heal yourself*, *therapy*, or similar in dialogue, UI or lore.
- The Spark is never "willpower" and the Haze is never "sadness". They are things in the world.
- Restoration is always partial and always earned by effort. It never arrives as a reward for suffering.
- Stillness is not a sin. Havens, rest and stopping are part of the rhythm, and the game never shames them.

---

## 2. The cast and the world (rewritten)

### The Heart

- An ancient presence that keeps the order of existence: the engine of reality. Nobody built it.
- It is **benevolent**. It is trying to keep time flowing, and nothing about it is secretly sinister.
- It has no voice. It speaks through light, pulse and what it reconstructs.
- It **remembers across every expedition, won or lost.** That is how it rebuilt the hero, and how discoveries, fractures and traces persist.
- It recovers gradually. Each reignition makes its pulse a little steadier, which the ritual and the Sanctuary show.

### The Spark

- The Heart's missing rhythm.
- It lies at the far end of time, beyond the fractures. It is the distant light seen from the Sanctuary in the opening.
- Reaching it rekindles the Heart **for now.** It flares and settles, and each rekindling holds a little longer.
- This is why winning never ends the game (existing §6), stated simply: recovery is gradual.

### The Haze

- What seeps through when time fractures: fog, distortion, corrupted reconstructions.
- It does not care what is historical, literary or legendary. That is why Abraham Lincoln, the Raven and a dragon can all exist in it.
- Everyone the hero fights is a **Haze reconstruction**, not the real person or creature. This matters for the historical figures (section 5).
- It should stay mysterious and sometimes beautiful (existing §5.3), but it has no rules to learn.

### The fractures

- Fractures are **eras**: prehistoric, medieval fantasy, the 1800s, modern, futuristic.
- Each is a compact, handcrafted place with its own enemies, mood, a few NPCs, discoveries and **two bosses**, one per role (section 5).
- The Heart assembles each expedition from the fractures it currently knows (section 6).

### The Sanctuary

- A still point where time holds.
- Home: where the ritual happens, where you prepare, and where the world visibly recovers.
- **It rains until the first reignition,** and the rain never returns. The game never explains why.
- Each later reignition leaves one small, visible change (section 9, stage 5).

### Elara, the Keeper

- She keeps the Sanctuary and tends the Heart.
- She is warm and dry-humoured. She is a person, not a tutorial.
- **She knows more than she says.**
- **After the second reignition, she is gone.** The hero arrives to an empty Sanctuary.
  - Traces of her turn up across later expeditions, won or lost.
  - What happened to her, and how the story resolves, stays open (section 10).
  - She stays sympathetic, never a simple traitor.
  - Her lines are never spoken by the synthetic voice.
- The old bible's idea that she suppresses memories is **not carried forward as canon.** It moves to the open questions as one possibility among others (section 10).

### The hero

- Rebuilt by the Heart in the Sanctuary. That is the whole origin, as far as the game says.
- **Memories come in fragments:** a sword, a road, a street, a song. These are atmosphere and mystery, not a puzzle with an answer the game owes the player.
- The loadout changes between expeditions because the Heart rebuilds the hero imperfectly each time. The existing §12 line stays: *different physical loadouts are different reconstructed possibilities.*
- **Simplified from the old bible:**
  - no original "anchor";
  - no theory of consciousness;
  - no plan for other reconstructed heroes.

  The word **"Echo" is kept out of player-facing text** (decision D3). That also fixes the early reveals the audit found (section 8).

---

## 3. The standard expedition

### Structure

| Part | What happens | Encounters (ordinary fight = ⚔) |
|---|---|---|
| **Sanctuary** | Ritual, then readiness and loadout | none |
| **Fracture 1**, first role | Arrival line, 2 × ⚔, a blessing, an optional discovery spot, then the **miniboss** | 3 combat encounters |
| **The crossing** | A short fold through the Haze, the natural checkpoint ("a good place to stop"), and the Mirror | none |
| **Fracture 2**, second role | Arrival line, 2 × ⚔, a blessing, a **Haven**, then the **main boss** (can be staged) | 3 combat encounters |
| **Reignition** | A short scene at the Spark, then return and the ritual | none |

**This is the same size as today's standard route,** which has 5 fights plus the Warden, 3 blessings, a Mirror and a Haven. The miniboss takes the place of an ordinary fight; it is not added on top. Encounter count and planned volume (about 21 sets today) stay the same, so the 20 to 25 minute target is unchanged. That target is still unvalidated on a real body (§31).

### Two bosses without more exercise

In today's code, a fight lasts until the enemies' HP is gone. `plannedSets` is only a display figure; nothing enforces it. Adding bosses naively would therefore add sets. The proposal is to make the budget real:

- **Every expedition has one set budget,** set once at the start by the Workout Director: today's ~21, adjusted by readiness. Resuming never resets or refills it.
- **Every combat encounter has a set allowance** from that budget. A boss's allowance is about the same as an ordinary fight plus one or two sets, not doubled.
- **Enemy HP follows the allowance,** not the other way round. HP is tuned so that ordinary play at the player's current targets finishes the fight within its allowance. A boss is harder through patterns, telegraphs, group behaviour and tactics, never through HP padding (§3.3, §14).
- **Safety valve (decision D8).** If a boss outlasts its allowance by more than a set, it staggers into a *finishing window*: the next set, even a partial one, ends the fight. The player is never pushed past the plan to win.

### What "complete" means

| | Workout session | Expedition |
|---|---|---|
| **What it is** | One sitting: from arriving (or resuming) to stopping | The narrative run, from the Sanctuary to reignition or its end; can span days |
| **Completes when** | You stop, for any reason. Every session is complete | Reignition, falling-and-ending, or choosing to end it |
| **Has its own** | Readiness check, calibration, sets, volume, time, check-in, progression, Journal row | Route plan, loadout, HP, blessings, battle state, discoveries this run |
| **Summary says** | "Session complete: 11 sets, 14 min" | "Expedition: fracture 1 of 2 · saved at the crossing" |

**The current code treats these as one thing.** A resumed expedition keeps a single workout record across days. Progression runs only when the whole expedition ends, over every day's sets at once, using day one's readiness. A suspended session writes no history row at all. Section 8 covers the change.

### Stopping and resuming

**Where you can stop:**
- **Between encounters, anywhere:** on the trail, at the crossing, at a blessing, on the path view. The crossing is the *suggested* checkpoint.
- **Mid-fight, at a safe point:** the command menu between turns. Not during a set, the countdown before one, a dodge, or the enemy's action.

  If you stop during a set, it ends as a partial set (verified work kept) and the save happens at the next safe point. The existing "Finish set" semantics apply.

  *Today, "Leave expedition" mid-fight saves the run "as it was before this fight." On resume you replay the whole fight, which adds sets. That breaks the "no extra sets for resuming" rule and has to change (section 8).*

**What resuming keeps:**
- the loadout, HP, blessings, the Mirror's changes;
- the exact battle state (enemy HP, statuses, cooldowns, turn);
- the fracture plan, discoveries found this run;
- boss progress, including whether its intro has been seen.

**On returning another day:**
- a **fresh readiness check** (intensity and soreness);
- a **quick calibration** before anything physical. Calibration already happens on every resume.

A same-day return skips the readiness check but still calibrates.

**Readiness on return can change targets, not the plan.**
- "Take it easy" or sore-gentle lowers the per-set targets for the rest of the expedition.
- It never adds sets.
- If a sore family is now marked *rest* but its movement is in the saved loadout, the Mirror offers a swap for that one slot (decision D6). The rest of the loadout stays as saved.

---

## 4. Shorter sessions without a short route

A shorter workout is **the same expedition, stopped earlier.**

**The natural stopping points:**
- **After fracture 1:** about 10 to 12 minutes, the miniboss defeated, and a clear sense of a chapter finished.
- **Anywhere earlier,** at any safe point.

**Why nothing is lost by stopping:**
- The session is complete and counts in full: sets, Journal row, progression.
- Story still moves on a stopped session. Discoveries, traces, first-time boss scenes and fracture unlocks all persist the moment they happen, not at expedition end (section 6).

A miniboss defeat is **not** a reignition. The Sanctuary's big changes and the Elara arc follow reignitions only, which keeps each reignition meaningful.

**Migrating existing short-route saves** is covered in section 8.

---

## 5. The fracture template

Every fracture is designed once, with two roles. The place and most assets are shared. The encounters, drama and boss differ.

### Template

| | **Role A: first fracture** | **Role B: second fracture** |
|---|---|---|
| **Place** | The fracture's board: a compact diorama trail with about 5 stops, its battle backdrop, palette and ambience | The same board, from a different angle, time of day or state (for example night, or Haze-choked), and a different stop subset |
| **Tone** | Arrival, strangeness, discovery, lighter | Escalation, the fracture's darkest or most dramatic side |
| **Ordinary enemies** | Pool A: 3 or 4 enemies; 2 are drawn per run | Pool B: 3 or 4 different enemies; 2 are drawn per run |
| **NPC / discovery** | 1 NPC moment and 1 optional discovery spot | 1 NPC moment and 1 optional discovery spot |
| **Boss** | **Miniboss:** a personality fight, often a group or a gimmick. Intro about 20 s the first time, then one line | **Main boss:** the fracture's climax, possibly staged (fight → scene → fight). Full scene the first time, then about 5 s |
| **Set allowance** | Miniboss ≈ an ordinary fight + 1 set | Main boss ≈ an ordinary fight + 2 sets, **shared across all its stages** |

**Every enemy needs:**
- a figure;
- readable **high/low telegraph stances** (§16: read from the body, never announced);
- an ability kit;
- one tip line.

**No enemy may hide or fake its telegraph.** Fear, darkness and trickery are expressed through other mechanics.

### Worked example: the 1800s

*Conceptual only. All names are working titles.*

**The place.** A gaslit city folding into a riverbank and a theatre. It uses one board: fog, cobbles, a river landing, a playhouse facade.
- **Role A** plays it at dusk: the lamps are lit, the Haze drifts and the mood is literary.
- **Role B** plays it at night: the theatre is lit and the streets are empty.

**Role A: "The Ink-Stained City", ending with the Three Authors**

- **Ordinary enemies (pool A):**
  - **The Raven:** a flying enemy whose strikes come mostly from above. It still telegraphs honestly: wings raised means high, a swoop to the ground means low.
  - **Huckleberry Finn:** raft-pole sweeps (low), a slingshot (high). Evasive and cheeky.
  - **Ebenezer Scrooge:** a miser who *hoards*. He can take the hero's shield onto his ledger, and it comes back to the hero when he's staggered.
  - **Period creations (pick one or two):** the Headless Horseman (1820, a charging rider), the Jabberwock (1871), a Haze-wrought automaton.
- **Miniboss: the Three Authors, one group battle.** Three separate enemies acting in rotation, each with a literary personality:
  - **Charles Dickens:** the serialist. His attacks arrive *in installments*, a clearly counted multi-turn charge, and he can "revise" a fallen ally back to a sliver of HP once.
  - **Edgar Allan Poe:** dread. He builds a *dread* counter that strengthens the others. Breaking his ward resets it. His telegraphs stay fully readable; the dread shows as a visible meter.
  - **Mark Twain:** the tall tale. He taunts, drawing the hero's next single-target ability onto himself. His big blows are loudly and honestly telegraphed.
  - **The group mechanic:** when one author falls, the survivors *rewrite* themselves and gain one new trait. So the order you defeat them in is a real decision.

    This needs one small engine addition, an "on ally defeated" hook. Multi-enemy fights already exist (the three Haze Wisps).
  - **The first time,** a 15 to 20 s intro: three figures at a writing desk in the fog, arguing over whose story the hero belongs to. **After that,** one line.

**Role B: "The Last Act", ending with Booth, then Corrupted Lincoln**

- **Ordinary enemies (pool B):**
  - **Haze-corrupted Confederate soldiers:** a rank of 2 or 3 that fire volleys (high) and fix bayonets (low).
  - **Champ Ferguson:** an ambusher who acts before the hero's first turn. His real history is brutal; the game shows none of it and keeps him a menacing fighter.
  - **Robert E. Lee:** a commander who strengthens his ranks. Defeat him and the others lose their order.
- **The climax, staged as one boss encounter with one shared set allowance:**
  1. **Scene, first time only (about 45 s, skippable):** a Haze reconstruction of Ford's Theatre in diorama style.
     - The stage lamps gutter. A flash and a puff of Haze from the presidential box. Lincoln slumps.
     - Booth leaps to the stage, as history records.
     - No blood and no wound shown. Stylised, dramatic, and consistent with the art.
  2. **Fight: John Wilkes Booth.** A duellist who uses the stage: he retreats to "the wings", gaining a turn of cover you must break.
  3. **Scene, first time only (about 20 s):** Lincoln rises from the box, wreathed in Haze, in visible agony. Pain is conveyed through pose and light, not gore.
  4. **Main boss: Corrupted Abraham Lincoln.** A Haze reconstruction, openly absurd in the way the creator intends, and never presented as a claim about the real man. Abilities and transformations are designed with the fracture.
  5. **On later visits:** Booth enters with one line. After Booth falls, a 3 s rise. Then Lincoln.

**Tone guardrails for real history:**
- Everyone is a Haze reconstruction.
- Confederate figures are enemies, never glamorised or given Lost-Cause framing.
- The assassination is shown as tragedy, not spectacle.
- Lincoln's absurdity comes from the Haze, not from mocking the man.

### The medieval fracture, from today's content

The existing content becomes the first fracture with almost no new art.

| Role | Encounters (existing) | Boss |
|---|---|---|
| **A** | Training Yard (Straw Dummy), Rusted Causeway (Iron Husk), Bone Field (Bone Charger) | **New miniboss** (the only essential new medieval content). Suggestion: *the Green Knight*, from medieval legend and public domain. Mechanic: he offers an exchange of blows and taunts you into letting him strike back. Alternatives: a Haze-bound Mordred, a young dragon |
| **B** | Drifting Hollow (Haze Wisps), the Veiled Stair (Hollow Acolyte) | **Warden of the Haze** (existing). A dragon or a Haze-corrupted King Arthur can replace it later, when that art exists |

**Other medieval changes:**
- Both roles use the existing meadow board: role A on its western stops, role B on its eastern ones.
- The dummy is renamed to drop "Echo" (for example *Straw Squire*).
- The dummy's warm-up fight stays only while fewer than 3 expeditions have been played. After that, a pool-A enemy takes the slot.

---

## 6. Fracture selection and discovery

### Selection rules

These are simple and easy to state to the player.

1. **Two different fractures per expedition.**
2. **One-fracture exception.** While the Heart knows only one fracture (today: medieval), both halves come from it, using its two roles. This is not repetition, because the roles have different encounters and bosses. It is also the content that has to be built anyway. The rule takes effect as soon as a second fracture exists.
3. **New fractures arrive; they aren't drawn.** When a new fracture becomes available (arrival rule below), it **joins the next expedition** as fracture 1, in role A. Luck can't hide it.
4. **Role B unlocks after role A.** A fracture enters the draw for the second position only after its miniboss has been *reached* once. That way you meet the Authors before you ever see Ford's Theatre, and the main-boss scene can never play before its fracture has been introduced.
5. **Least-recently-seen first.** Each position takes the eligible fracture with the most expeditions since it last appeared; ties are broken at random. This prevents one fracture from being overrepresented and keeps the rotation predictable.
6. **Role balance.** When a fracture can take either position, prefer the role it has played less often.

What the player might be told: *"The Heart favours what you haven't seen lately, and always shows you something new when it finds it."*

**Arrival rule.** A new fracture arrives on the expedition after a reignition, or after 3 expeditions without one, whichever comes first. So effort, not just victory, brings new content, and a new era arrives at most every few sessions. There is no more than one arrival at a time.

The very first arrival (the second fracture ever) comes after the first reignition, alongside the rain stopping: *the Heart can reach further now.*

**Future destination choice** (later, not now): pick a known fracture for either position, or "let the Heart choose". This fits the rules above without changing them.

### The discovery ladder

Each fracture has five milestones. All of them persist the moment they happen, whether the run is later won, lost, ended or suspended.

| Milestone | How you get it | What it gives |
|---|---|---|
| **1. Discovered** | Setting foot in the fracture, which means entering its first scene on its arrival expedition | A Journal entry. It survives even if you lose one fight later |
| **2. Unlocked** | The next time you return to the Sanctuary after discovering it, whatever the outcome. The ritual shows a new facet in the Heart | It joins the random pool: role A at once, role B after milestone 3 |
| **3. Boss reached** (per role) | Reaching the miniboss or main boss scenario. Its intro plays in full once | Later visits get the short entrance. Reaching the miniboss also opens role B |
| **4. Boss defeated** (per role) | Defeating it. This counts even if the hero fell earlier in the run | A small keepsake in the Journal. No stat reward, so there's no pressure to over-exert |
| **5. Reignition** | Defeating the main boss at the end of fracture 2 without having fallen this run (see D5) | The victory: Sanctuary restoration, the Elara arc, and arrivals |

**How this reads for a new player who loses in the prehistoric fracture:** that run discovered it (1). The Heart unlocks it (2) back at the Sanctuary, and it is in the pool for next time. If they reached the miniboss before falling (3), its role B is open too.

**Optional discoveries** (a lore object, an NPC aside) and **Elara's traces** are per-fracture flags:
- A missed one stays in that fracture's pool until found. Guided marching can skip it, and a later visit offers it again.
- No required progression ever sits in an optional spot.
- At most **one trace per expedition,** found at a scripted discovery spot, so they arrive at a steady pace.

**Story repetition:** each fracture's NPC moments carry a "seen" flag. A seen moment waits until the unseen ones are exhausted, and never repeats on two consecutive visits.

---

## 7. Cutscenes and first-encounter flags

This extends the existing cinema system (`src/story/cinema.ts`), which already handles skippable, player-paced, data-driven scripts.

**Data:**
- **`story.seen`**: a set of scene ids, for example `opening`, `m.miniboss.intro`, `1800.b.theatre`, `1800.b.lincolnRises`, `elara.gone`.
- **Each boss scenario names two scripts:**
  - `full`: first time. A miniboss intro is at most about 20 s; a main-boss climax at most about 60 to 90 s in total.
  - `short`: every other time, at most about 5 s. One line and an entrance.

**Rules:**
- **When a scene counts as seen:** the moment it finishes *or is skipped*. It is written to the permanent save straight away, not to the expedition, so losing the fight, quitting or resuming never replays it. The Journal can offer "replay scenes" later.
- **Staged bosses** (Booth → scene → Lincoln):
  - the node has ordered stages, and the battle snapshot records which stage you're on;
  - resuming mid-sequence continues from that stage, with one recap line;
  - the between-stage scene plays in full only the first time.
- **When you lose to a boss:** its `full` scene is already seen, so the next attempt uses `short`.
- **Main-boss scenes can only play in role B,** because the scenario only exists there. Role A cannot trigger them.
- **Ordinary encounters never get cutscenes.** They keep today's one intro line.
- **Physical-state rules:**
  - scenes are not physical states, so there are no tracking warnings (couch play);
  - readiness for combat is checked after the scene, as today.
- **Elara:** her lines are never spoken by the synthetic voice, and the line ids are ready for recorded voice.
- **Enemy lines** (Lincoln, the Authors) may use the synthetic voice as enemy intros do today (decision D9).

**Narrative beats keyed to the reignition count:**

| Reignition | Beat |
|---|---|
| 1st | The rain stops (as today). The first new fracture arrives next |
| 2nd | On the next arrival: *the Sanctuary without Elara*, about 30 s. The rain stays gone. From then on the Sanctuary UI uses neutral text and the ritual is quiet: pulse, light, no line |
| Later | Each leaves one visible keepsake in the Sanctuary from its main-boss fracture (the medieval banner, a lamp from the theatre), and the Heart's pulse grows steadier. There is no scripted Elara resolution yet |

---

## 8. Impact on today's code, saves and combat

### Narrative text (small)

- **Opening, `src/story/scripts.ts`:** keep the staging. Change two lines:
  - `elara3` "So they built something to remember it." → *"Everything that ever was still runs through the Heart."*
  - `elara10` "That's the Spark. The Heart believes it matters. So do I." → *"That's the Spark. Or where it went. The Heart can't reach it anymore."*

  The tested lines don't change. Replay it from the title screen to see it; there's no version flag.
- **`src/rpg/story.ts`:**
  - victory text: *"You touch the Spark. It catches. Somewhere, time finds its beat again — for now."*;
  - march-leg and Haven lines per fracture role;
  - neutral variants for when Elara is gone.
- **Echo leaks:** "The Echo fades…" in `src/ui/expedition/Events.tsx` → *"You fall…"*; also the README intro, the Straw Echo name, and the blessings "Echo of Resolve" and "Bulwark Echo" (suggest *Resolve Remembered*, *Bulwark Memory*).
- **Header comments** in `story.ts` and `CinemaScene.ts` that say "kingdom".
- **Bible and `CLAUDE.md`** canon lines (D3).

### Data model (medium, independent of new content)

- **Separate sessions from expeditions:**
  - one `WorkoutData` per sitting;
  - on stopping, write the session's `WorkoutRecord` and run progression on **that session's sets** with **that day's readiness**;
  - the expedition keeps a list of its session ids and its own set budget.
- **Battle snapshots at safe points:** enemy HP, ward, statuses, cooldowns, turn, stage, the hero's shield and charges. This replaces "saves your run as it was before this fight."
- **`ExpeditionState` v2:**
  - `plan: [{ fracture, role }, { fracture, role }]`, plus a `contentVersion`;
  - the index moves to a node id within the plan, so edited routes don't break saved runs;
  - `battle?` (the snapshot), `found` (discoveries this run), `setBudget`, `sessionIds`.
- **`StoryState` additions:**
  - `reignitions` (replaces the boolean `restored`, which is kept as a derived value);
  - `seen`;
  - `fractures: {id → {discovered, unlocked, reached: {a, b}, defeated: {a, b}, lastSeen, roleCounts}}`;
  - `found`;
  - `traces`;
  - `elara: 'present' | 'gone'`.

  Everything is sanitized with safe defaults. Flags are only ever added, never cleared.
- **`clears`** stays for classic mode only. Reignitions get their own counter.

### Migration of existing saves

- **In-progress v1 runs, short or standard, finish exactly as they were.** The current `ROUTES` table stays frozen in code as the legacy routes, and a v1 save plays out on them.
- A legacy victory counts as a reignition: it ended at the Warden, so it's legitimate under the old rules.
- **No run is discarded.** One that can't be read is set aside with a message, and its sets are written to history first.
- **The short-route option disappears from the Sanctuary for new expeditions only.**
- **Workout history is untouched.** Records keep their shape; later session records add a link to their expedition.
- **Story migration:** `reignitions` = the number of victory records in history, at least 1 if `restored` is true.
  - `medieval` is marked discovered and unlocked.
  - If a victory exists, its main boss is marked reached and defeated.
  - The opening stays seen.

### Encounter sequencing (medium)

- Routes become per-fracture **role templates**: node lists with enemy pools, a discovery spot and a boss, plus a shared crossing and a reignition step.
- An expedition is built by the selection rules from two templates.
- Boss nodes gain **stages** and `full`/`short` intro ids.
- The board shows one fracture at a time. The crossing switches boards: for medieval → medieval, the same board with a different stop subset.

### Combat (small to medium)

- **Set allowance** per encounter, HP tuned to it, and the finishing window (section 3).
- **Group hooks:** "on ally defeated", and rotation or order for groups like the Authors.
- **Nothing changes in dodging, readiness, partial sets or couch play.**
- The invariants hold: never attack during a set, readiness before dodge timing, lost tracking is not a failed dodge, and harder bosses never mean more reps.

### Art and enemy content (the real cost)

| Item | Effort |
|---|---|
| One medieval miniboss: figure, stances, kit, intro scene | Medium |
| A new fracture: board, backdrop, ~7 or 8 enemies (two pools), 2 bosses, 2 or 3 scenes | Large |
| Corrupted Lincoln on his own | Medium to large |

**Today's enemy art is five painted base figures** (dummy, golem, skeleton, mage, warden) with tints. Historical and literary figures need new figure painters. The existing `figures.ts` approach (procedural, expression-aware) scales, but each figure is real work.

### Future expansion (not now)

- Prehistoric, modern and futuristic fractures.
- Destination choice.
- Journal "Scenes" replay.
- Elara's resolution.
- Hazy Chaos, Punch Away, the Unbound and the Gauntlet, following their own milestones.

These fit anywhere: they're anomalies that cross fractures. The Unbound in particular reads naturally as someone who walks *between* eras, outside the Heart's rules.

---

## 9. Staged plan, starting from the medieval content

Each stage is shippable on its own and keeps the game playable.

| Stage | What | Size | Needs art? |
|---|---|---|---|
| **0** | Approve this proposal. Fold it into the bible (§5–§9, §12, §18, §19, §33, §34) and `CLAUDE.md` | Medium (writing) | No |
| **1** | **Narrative text:** the opening lines, victory text, the Echo leaks, neutral Elara-gone variants (dormant), comments, README | Small | No |
| **2** | **Sessions, not expeditions:** per-session records, readiness, progression and summary; battle snapshots at safe points; expedition v2 with legacy v1 routes; short route removed for new runs; story state additions and migration | Medium | No |
| **3** | **Fracture sequencing:** role templates, selection rules (tested with made-up fractures), crossing checkpoint, set allowance and finishing window, staged boss nodes, `full`/`short` intro flags, the discovery ladder. Medieval split into A and B, with the Warden as main boss and a placeholder miniboss drawn from existing figures | Medium | No |
| **4** | **The medieval miniboss** (for example the Green Knight): figure, stances, kit, intro. This completes the canonical structure with real content | Medium | Yes |
| **5** | **The Elara arc:** the second-reignition scene, the neutral Sanctuary, the quiet ritual, trace spots in the medieval roles, Traces in the Journal, keepsakes per reignition | Medium | A little |
| **6** | **The 1800s fracture:** board, backdrop, pools A and B, the Authors (group hooks), Booth → Lincoln (staged, two scenes). Arrivals go live | Large | Yes |
| **7+** | Further fractures; later, destination choice | Large each | Yes |

**Why this order:**
- Stages 1 and 2 are safe to do before the physical playtest, and stage 2 fixes real problems today (multi-day records, replayed fights).
- Stages 3 to 5 need no new era.
- Stage 6 is where content cost begins.

**Tests that change:**
- the line assertions in `tests/cinema.test.ts` (only if lines they pin change);
- the ritual's Elara-line rule (the quiet variant);
- `tests/expedition.test.ts`, which iterates both routes and builds short runs, moves to the legacy table plus new template tests;
- new tests for selection, the ladder, migration, the session split and the set allowance.

**The tutorial trial doesn't change.** The tutorial regression must pass after every stage.

---

## 10. Contradictions and decisions needed before coding

**Contradictions found:**

1. **Short expeditions.** The brief both describes them and removes them. This proposal removes them per the override. Bible §18 and Milestone A in §33 ("Short and full expedition pacing") need editing to match.
2. **The old premise, §5–§7:**
   - the kingdom built the Heart;
   - the original anchor;
   - the Echo revelation;
   - Act III's question about what salvation means;
   - the postgame's "lost kingdom".

   All of these are superseded if you approve. **§36, the North Star,** still fits almost word for word: *a world that cannot be fixed all at once.*
3. **The Echo canon in `CLAUDE.md`** says the Echo truth must not be revealed early. If the Echo mythology is dropped, that line becomes "don't explain the hero's origin beyond reconstruction".
4. **Longer runs make the fall rule harsher.** Falling currently means "the Spark can't be restored this run", and with two fractures that can mean 15 minutes left that can't win. See D5.
5. **Mid-fight "Leave" replays the fight today.** It conflicts with "no extra sets for resuming" and is fixed in stage 2.
6. **Multi-day expeditions today are judged as one session with day one's readiness.** This conflicts with per-session volume, soreness and progression, and is fixed in stage 2.

**Decisions for you:**

- **D1:** Approve the core premise (section 1) and the cast (section 2) as the new §5.
- **D2:** Is the Spark literally *at the end of time*, the far light in the opening? Proposed: yes.
- **D3:** Drop "Echo" from player-facing text and from canon, keeping only "reconstructed"? Proposed: yes.
- **D4:** Elara's memory-suppression idea: keep as an open possibility (proposed), or retire it?
- **D5:** The fall rule. Proposed:
  - a fall still ends the chance of reignition this run, but you continue for the workout;
  - bosses defeated, discoveries and traces still count;
  - **and the crossing offers "end here and bank your session"** without it counting as a loss.

  Alternative: a fall in fracture 1 costs only that fracture's reward, and reignition stays possible.
- **D6:** On a return day, if a saved-loadout family is marked *rest*: offer a one-slot swap (proposed), or keep the loadout and make that family's sets optional?
- **D7:** The medieval miniboss: the Green Knight, a Haze-bound Mordred, or a young dragon?
- **D8:** The boss finishing window after the set allowance: approve, or prefer HP tuning alone?
- **D9:** Synthetic voice for enemy lines, including Lincoln and the Authors: OK?
- **D10:** The arrival cadence: after a reignition, or after 3 expeditions without one?
- **D11:** Retire the warm-up dummy after 3 expeditions?
- **D12:** The hero's pronoun. The bible says "he", the brief says "them". Which should story text use?
- **D13:** Classic mode's Maplebrook story: leave it, or retire it?
- **D14:** Tone check on the 1800s role B (Confederate figures, the assassination scene): happy with the guardrails in section 5?

---

*Everything above is a proposal. Once approved, it is folded into the bible's vision sections with a revision-log entry. Until then the current §5–§8 remain canon.*
