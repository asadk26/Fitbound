# FITBOUND: Heart of Haze — Living Game Design Bible

- **Project identity:** Personal fitness-powered fantasy roguelite RPG
- **Working title:** FITBOUND: Heart of Haze
- **Primary creator and intended player:** Asad
- **Development approach:** AI-assisted, iterative, playtest-driven
- **Document purpose:** Preserve the creative vision, narrative direction, mechanical principles, fitness philosophy, and future development priorities.

> **Maintaining this document.** The creator owns the vision sections. At the end of each development pass, Claude updates **§32 Current Development Status** and **§34 Open Questions**, and proposes (rather than silently makes) any other change. Revisions are listed in the [revision log](#revision-log) at the end.

---

## 1. The Vision

FITBOUND: Heart of Haze is a fantasy roguelite RPG in which the player performs real physical exercises to power magical combat abilities.

Its primary purpose is to make consistent exercise enjoyable for someone who likes games but struggles to enjoy conventional gym workouts.

FITBOUND should feel like a genuinely engaging game that happens to deliver a worthwhile workout—not an exercise application with decorative RPG elements.

The game combines:

- Turn-based tactical combat powered by real exercises.
- Randomized exercise loadouts that change the physical workout between runs.
- Roguelite blessings, builds, enemy interactions, and permanent progression.
- A world of fractured eras colliding in time, restored a little with every reignition.
- A recurring Sanctuary and emotionally meaningful characters.
- Occasional alternate encounter types, including timed calisthenics circuits and rhythm-based boxing.
- Personalized physical difficulty that respects fatigue and recovery.
- A compact, replayable expedition structure suitable for regular workouts.

The intended emotional experience is:

> “I want to play another expedition, and completing it means I’ve exercised.”

The game should remain engaging even after the player knows the entire story.

---

## 2. The Most Important Development Philosophy

### Build for the creator first

FITBOUND is primarily a personal project.

It may eventually have potential as a small Steam game, but commercialization is not currently the development objective.

Prioritize the creator’s actual experience over hypothetical mass-market requirements.

Do not introduce substantial engineering complexity solely to accommodate speculative future players, hardware configurations, accessibility systems, or commercial infrastructure.

Examples:

- Recalibrating the camera every session is acceptable and desirable.
- Getting up to use a physical control occasionally is acceptable.
- The current laptop, phone, TV, and local Wi-Fi arrangement is sufficient.
- A small number of reliable exercise detectors is preferable to an enormous library that barely works.
- We do not need a sprawling procedurally generated world.
- We do not need a fully simulated boxing game.
- We do not need a sophisticated physiological model to personalize exercise.

However, avoid unnecessarily coupling core gameplay to one device or one room when a simple separation would preserve future flexibility.

Build the game the creator wants to keep playing.

---

## 3. Non-Negotiable Design Principles

### 3.1 The gameplay must be genuinely enjoyable

Fitness is the reason for building FITBOUND, but engaging gameplay is what will sustain it.

The player should make meaningful tactical decisions, discover interesting ability combinations, encounter varied challenges, and experience satisfying progression.

Do not assume motion controls alone are sufficient to make combat fun.

### 3.2 Physical exhaustion is not RPG failure

The character may lose an expedition through combat.

The player should not lose because they cannot complete another push-up.

Physical performance may shape how well abilities work (§17), but running out of physical energy is never, by itself, a defeat.

The game must allow rest, partial sets, appropriate substitutions, and voluntary session termination.

Never create incentives to exceed comfortable physical capacity.

### 3.3 RPG difficulty and workout difficulty are different

RPG difficulty should increase through:

- Enemy mechanics.
- Timing and defensive patterns.
- Tactical choices.
- Ability interactions.
- Encounter combinations.
- Optional challenge modifiers.

Workout difficulty should reflect:

- The player’s selected readiness.
- Calibrated exercise capacity.
- Appropriate exercise volume.
- Recent activity.
- Recovery.
- Gradual physical progression.

Do not make harder bosses automatically require more repetitions.

### 3.4 A run should be a worthwhile exercise session

A 25-minute expedition containing five minutes of actual exercise is not sufficient.

Likewise, a long series of repetitive exercise sets with minimal gameplay is not the intended experience.

Workout and adventure pacing are equally important.

### 3.5 Expand through depth before geography

The world should feel rich because of its characters, encounters, mysteries, choices, and mechanics—not because it has an enormous map.

Revisit familiar locations with different situations and changing narrative context.

A handful of excellent handcrafted environments is preferable to an elaborate procedural landscape system.

### 3.6 The game must respect the player’s time

Avoid meaningless travel, repetitive setup, unnecessarily long dialogue, artificially inflated boss HP, or padding intended solely to meet a duration target.

Allow the player to suspend and resume expeditions.

### 3.7 Keep the systems reusable

Exercises, magical abilities, enemy definitions, blessings, encounters, story prerequisites, and expedition structure should be sufficiently modular to support future additions.

A new exercise should not require rewriting combat.

A new character should not require a new biome.

A new encounter type should not require rebuilding the progression system.

---

## 4. The Player Experience

A typical session should feel approximately like this:

1. Launch FITBOUND.
2. Place the phone and calibrate.
3. Start or resume an expedition, or choose another unlocked training mode.
4. Indicate equipment availability and physical readiness.
5. Receive a randomized exercise loadout.
6. Explore or navigate brief narrative encounters using a controller or available motion controls.
7. Step into camera view when physical combat begins.
8. Choose magical abilities and perform exercise sets.
9. Dodge enemy attacks and make tactical decisions.
10. Acquire temporary blessings and develop a run-specific build.
11. Encounter occasional unusual events.
12. Complete a Haven recovery sequence.
13. Reach the expedition’s climax.
14. Return to Sanctuary.
15. Receive both RPG progression and a separate workout summary.

A player should be able to sit on the couch during narrative and exploration sections.

The camera only needs to see the player when the current mechanic requires physical tracking.

---

## 5. World and Narrative

*Approved 2026-09-26. Replaces the earlier kingdom-and-corruption premise, the original anchor and the Echo revelation.*

### 5.1 The premise

> Time is the blood of reality. It flows through the Heart, an ancient, benevolent entity that maintains the order of existence.
>
> But the Heart has lost its Spark. Its rhythm falters, time fractures, historical eras collide, and the Haze spreads through the disorder.
>
> The Heart reconstructs the protagonist, who journeys again and again through fractured time toward the end of time to reignite the Spark.
>
> Each successful expedition restores some order. Recovery is gradual, not instantaneous.

In one line: **the Heart has lost its Spark. Time is coming apart. Get moving and reignite it.**

Keep it that simple. There are no multiverses, competing histories, time-travel paradoxes, or theory of the protagonist's consciousness. Eras collide because time is unstable; that is all the explanation the game needs.

### 5.2 The quiet metaphor

The lost Spark stands for stagnation, disconnection and lost momentum. Repeated effort gradually brings movement and life back. Let that meaning emerge through play; no character states it.

- Never frame the game as being about depression, and never present exercise as a cure for any condition.
- Keep words like *depression*, *motivation*, *lazy*, *cure* and *therapy* out of story text and UI.
- Rest, Havens and stopping are natural, positive parts of the rhythm. The game never shames them.
- Restoration is always earned by effort and always partial, never a reward for suffering.

### 5.3 The Heart

- Ancient, benevolent, and nobody built it. It keeps time flowing. **It is not secretly evil**, and must not become a hidden villain or a final boss.
- It has no voice; it speaks through light, pulse and what it reconstructs.
- It **remembers across every expedition, won or lost**: discoveries, encounters, scenes, traces.
- It recovers gradually. Each reignition steadies its rhythm a little.

### 5.4 The Spark

- The Heart's lost rhythm. It lies at the literal **end of time**, and it is the distant light seen from the Sanctuary in the opening.
- Reaching it and reigniting it restores order **for now**: each reignition holds a little longer. This is why winning never ends the game.

### 5.5 The Haze and the fractures

- The Haze seeps through where time breaks. It reconstructs people, creatures and legends without caring whether they came from history, literature or myth.
- Every figure the hero fights is a **Haze reconstruction**, not the real person. The word "Echo" may be used generically for such reconstructions.
- Eras become **fractures**: compact places that can collide and leak into one another (§9).

### 5.6 The Sanctuary

- Home, outside the ordinary flow of time. The game never explains how.
- It is where the reconstruction ritual happens and where the world's recovery shows.
- **It rains until the first reignition, and the rain never returns.** The game never explains why.
- Later reignitions each leave a small, visible change.

### 5.7 Elara

- The Keeper of the Sanctuary: warm and slightly dry-humoured. A person, not a tutorial interface.
- She knows more than she says, but she is not a villain or a simple traitor.
- **After the second reignition she disappears.** Her absence should be felt, yet the Sanctuary and the ritual keep working without her. The Sanctuary's text becomes neutral and the ritual is quiet.
- The protagonist finds **traces** of her across later expeditions, won or lost. How her story resolves is not decided (§34).
- Her lines are never spoken by a synthetic voice.
- Her visual identity and voice are important assets. Keep them consistent.

### 5.8 The protagonist

- The Heart reconstructs him in the Sanctuary. That is all the player needs to know at first.
- He carries fragmented memories (a sword, a road, a street, a song) as atmosphere and mystery. They are not a puzzle the game owes an answer to.
- There is no original anchor and no special Echo identity. Don't overexplain his reconstruction.
- His loadout changes between expeditions because each reconstruction is imperfect (§12).

---

## 6. Why Winning Does Not End the Game

A **reignition** is the victory of a complete expedition: the second fracture's main boss falls and the Spark is reignited. It is a real achievement, and the world visibly recovers. But recovery is gradual, so there is always a reason to set out again.

| Reignition | What changes |
|---|---|
| First | The Sanctuary's rain stops for good. The 1800s fracture becomes reachable (§9.4). |
| Second | Elara disappears. The Future fracture becomes reachable. Her traces begin to appear. |
| Later | Each leaves a small, visible restoration in the Sanctuary. |

Failed expeditions still matter. Discoveries, first encounters, scene flags, traces and quest progress persist (§17). Only reignitions drive the Sanctuary's restoration and the story beats above.

The story's eventual conclusion, Elara's resolution and any postgame are **not designed yet** (§34). The direction stays: the narrative gives meaning, while replayable combat, builds, mastery and fitness give longevity. After any conclusion, venturing into the fractures should remain a choice worth making.

---

## 7. (Merged into §6)

The earlier postgame section described the superseded kingdom premise. Its lasting direction is kept in §6.

---

## 8. Art, Presentation, and Tone

### Art direction

The preferred visual direction is a charming, handcrafted fantasy diorama:

- a miniature-world presentation;
- warm, readable lighting;
- distinct silhouettes;
- expressive small environments;
- magical atmospheric effects;
- a contrast between the comforting Sanctuary and the mysterious fractures.

**Each fracture gets its own visual identity within that same diorama language.**

Don't copy another game's characters, environments or visual identity, and don't replace the current successful art direction merely because new assets or techniques become available.

### Narrative tone

Mysterious, emotionally grounded and hopeful, with room for wonder, melancholy, discovery, humor (including deliberate absurdity from the Haze), recurring relationships and genuine accomplishment.

Avoid excessive exposition. Not every encounter needs a revelation; small, memorable character moments matter.

**Real historical figures** appear only as fictional Haze reconstructions, never as claims about the real people:

- Real tragedies are handled sincerely and without gore.
- Figures from oppressive causes (for example Confederate soldiers and commanders) are never glorified or given Lost Cause framing.

### Cutscenes

Prefer scripted in-engine cinematics in the existing style. Cutscenes are data-driven and skippable, and dialogue is player-paced.

**The opening** keeps its current staging:

1. darkness and rain, then a heartbeat;
2. glimpses of fractured moments;
3. the Heart's cavern;
4. the protagonist forms in the rainy Sanctuary, and Elara greets him;
5. the distant Spark is revealed (the end of time);
6. the player receives control.

The opening establishes intrigue; it does not explain the cosmology. It plays once and can be replayed from the title screen.

**The reconstruction ritual** recurs after every expedition. It is short and skippable, and becomes quiet once Elara is gone.

**Boss introductions** are tracked per scenario:

- The first time a player reaches a boss scenario, it plays its full introduction. Every later time, it plays a much shorter entrance.
- Skipping counts as seeing, and losing never resets the flag.
- A staged boss, for example Booth then Lincoln, keeps its stage when an expedition is suspended.
- Ordinary encounters don't get cutscenes.

---

## 9. Expeditions and Fractures

FITBOUND is an encounter-driven roguelite, not an exploration-heavy RPG. Variety comes from eras, encounters, combat, loadouts and optional discoveries, not from large procedural geography.

### 9.1 Fractures

A **fracture** is an era: a compact, handcrafted environment with its own visual identity, encounters, NPCs, optional discoveries and bosses.

The current roster is **Prehistoric, Medieval fantasy, the 1800s** (historical and literary figures mixed), **Modern** and **the Future**. This roster is not a limit: more eras, or unusual temporal places, can be added later. Fractures are not linear campaign chapters.

### 9.2 Two roles per fracture

Each fracture eventually has two independent **scenarios**:

- **Role A, first-fracture scenario:** ends with that era's **miniboss**.
- **Role B, second-fracture scenario:** ends with that era's **main boss**.

The two scenarios can share the environment and assets, but their encounters, drama and bosses are meaningfully different. **The roles are independently discoverable.** A player may meet corrupted Lincoln (1800s B) long before the Three Authors (1800s A). That is no contradiction, because time is fractured.

During development a fracture may have only one role implemented. The game must work without placeholder bosses.

### 9.3 The expedition

There is one canonical structure (the short route is retired for new expeditions):

> Sanctuary → **the Awakening** (warm-up) → first fracture (a role-A scenario) → its miniboss → **the Stillpoint** (the crossing) → second fracture (a role-B scenario) → its main boss → reignite the Spark → *(optional)* **the Heart's Rest** (cooldown).

- **The Stillpoint** is the recommended stopping place after the first fracture, not the only place to stop (§18, §20).
- **Havens** may also turn up as occasional randomized discoveries in either fracture (§20).
- **The Reflections** may occasionally replace one ordinary fight (§9.7).
- **Selection:**
  - two different eras per expedition, drawn from **implemented and player-available** scenario roles;
  - favor variety with protection against repeats, without becoming a predictable rotation;
  - newly available content appears promptly;
  - the precise weighting is open (§34).
- **Implemented content vs story unlocks:** what exists in the build and what the player has unlocked are separate. During development, simply choose among the implemented combinations.

### 9.4 Fracture availability (the complete game)

- **At the start:** Medieval, Prehistoric and Modern are available.
  - The **introductory expedition** starts in Medieval.
  - Its second fracture is a surprise drawn from the other introductory eras, which gives the first crossing a real reveal.
  - After that, both positions are randomized normally.
  - Losing the introductory expedition never locks the player into repeating it: all three introductory eras stay available.
- **First reignition:** unlocks the 1800s. Its absurdity should feel like an escalation.
- **Second reignition:** unlocks the Future, and Elara disappears.

These are player-facing rules. They do not stop development from building and testing any era earlier.

### 9.5 Discoveries, Anachronisms and exploration

- Exploration is controller-first, with optional guided marching for extra activity (§27).
- Environments are compact and handcrafted, with meaningful NPC moments, lore, secrets and optional discoveries.
- **Optional content can be missed,** for example by guided marching, and it is offered again on a later expedition.
- Required story progression never sits behind optional exploration, and never becomes inaccessible.
- **Anachronisms (planned concept):**
  - because time is fractured, people and objects sometimes turn up in the wrong era, for example a Victorian clock in a prehistoric jungle;
  - most are environmental details;
  - a few may become lightweight optional quests that persist across expeditions and don't need the relevant eras in the same run;
  - no large inventories, dialogue trees or scheduling systems;
  - **architecture (approved 2026-09-26):**
    - a registry of small entries per fracture, placed at a scenario's discovery spots, linked only by persistent flags;
    - collected objects are named flags listed in the Journal;
    - quest steps can appear in either role of their era;
    - a missed step is simply offered again;
  - **starting scope:** one small quest and a few environmental details, when that stage comes.

### 9.6 What the roguelite randomizes

In rough priority order:

1. exercise loadouts;
2. abilities and temporary blessings;
3. fracture scenarios and encounter selection;
4. enemy behavior and tactical situations;
5. narrative opportunities and optional discoveries.


### 9.7 The Reflections (planned special encounters)

**Status:** planned. It is documented and a minimal system is proposed. Prototype **one** in the Movement Lab only once the first two-fracture expedition works, and verify physically that copying poses is satisfying and reliably recognized before building more.

**What they are:**
- A recurring family of unusual figures scattered across the eras. They may be siblings or otherwise connected, with shared visual features, a recurring musical motif, and the odd line acknowledging their relatives.
- Each era can eventually have one, appearing in either of that era's roles. Starting ideas, not final designs:
  - **Prehistoric:** grounded and animal-inspired.
  - **Medieval:** a knight who challenges through stillness and balance.
  - **1800s:** an impeccably dressed, theatrical gentleman of composure.
  - **Modern:** a recognizable yoga practitioner.
  - **Future:** a holographic figure obsessed with perfect form.

**How an encounter works:**
- It isn't turn-based exercise combat. The Reflection assumes a sequence of yoga poses or controlled mobility positions, for example Warrior II, Mountain Pose and a supported balance.
- The player resolves the encounter by mirroring them. Control and appropriate holds matter; rushing doesn't.
- Losing balance pauses the hold. It never deals RPG damage.
- Reasonable variations and alternatives exist for inaccessible poses.
- It should feel different from a battle, a Haven or the warm-up.

**When one appears:**
- There is a modest chance of replacing one eligible **ordinary** fight, at most one per expedition to begin with.
- Many expeditions have none.
- It never replaces a miniboss or main boss, and it never adds exercise volume; it takes the replaced fight's place in the budget.
- Each Reflection has a full first-encounter introduction, then abbreviated repeats (§8).
- The appearance probability is tuned after testing.

---

## 10. Four Exercise Families

Every ordinary expedition has four physical exercise disciplines:

| Family | General purpose |
|---|---|
| Upper body | Pushing, pulling, and upper-body resistance |
| Legs | Lower-body strength and movement |
| Cardio | Sustained or repeated whole-body activity |
| Core | Trunk strength, stability, and controlled movement |

The exercise assigned to a family can change between expeditions.

Dumbbell exercises belong within these existing families.

Do not introduce a fifth dumbbell-specific combat slot.

A movement, an exercise family, and a magical RPG ability are separate concepts.

A movement powers an ability.

It does not have to define that ability’s entire identity.

---

## 11. Exercise Library

### Existing and planned movements

| Family | Movements |
|---|---|
| Upper body | Push-ups, dumbbell rows, bicep curls; overhead press as a possible future addition |
| Legs | Squats, reverse lunges; glute bridges and other variations as candidates |
| Cardio | Jumping jacks, high knees, mountain climbers |
| Core | Plank, dead bugs, standing cross crunches; side planks, bird dogs, and reverse crunches as future candidates |

Do not interpret this table as requiring every exercise to be immediately available in regular expeditions.

Differentiate:

- Previously physically tested movements.
- Newly implemented movements awaiting validation.
- Experimental detectors with known tracking limitations.
- Future candidate exercises.

Experimental movements should not silently enter ordinary randomization.

### Current experimental concerns

Dumbbell rows may require changing body orientation to keep the rowing arm visible.

Mountain climbers and dead bugs may suffer from overlapping landmarks when viewed from the side.

These are practical detector concerns, not reasons to abandon the movements outright.

Favor actual physical testing over conclusions based solely on synthetic poses.

### Upper-body balance

Push-ups alone are not a complete upper-body program.

Dumbbell rows are especially valuable because they introduce substantial pulling work.

Bicep curls offer another upper-body alternative but should not be treated as equivalent to rows for back training.

Across multiple sessions, aim for reasonable movement balance rather than assuming every randomized expedition must train all muscles equally.

---

## 12. Exercise Randomization

A run begins by selecting one eligible movement per family.

Eligibility depends on:

- Equipment availability.
- Player exclusions.
- Calibration and detector reliability.
- Workout readiness.
- Recent activity where appropriate.

Examples:

| Family | Run A | Run B |
|---|---|---|
| Upper body | Push-ups | Dumbbell rows |
| Legs | Squats | Reverse lunges |
| Cardio | Jumping jacks | High knees |
| Core | Plank | Standing cross crunches |

Randomized movements are a major source of replayability.

The player should not know exactly what physical workout they will receive every time they enter the Haze.

However, randomization should not override the player’s recovery needs or explicitly excluded exercises.

The selected loadout should be previewable, with a practical reroll or swap mechanism.

### Narrative explanation

The Heart remembers the protagonist’s capabilities imperfectly.

Each reconstruction expresses those remembered abilities differently.

Different physical loadouts are different reconstructed possibilities.

This is an important thematic connection between fitness and narrative.

---

## 13. The Mirror of Unlived Lives

A reusable expedition encounter allows the player to change their exercise configuration.

The Mirror reflects different versions of the protagonist.

The player can:

- Preserve the current configuration.
- Replace one exercise with another eligible movement.
- Reroll the broader loadout.

The player should preview proposed changes before accepting.

Never introduce unavailable equipment or excluded movements.

Do not reroll during an active set.

A reroll must preserve all completed physical work and respect the remaining workout budget.

The Mirror may acquire new narrative meaning as the story develops.

---

## 14. Standard Turn-Based Combat

The core combat loop is:

> Select magical ability → perform associated exercise → resolve ability → prepare for defense → enemy acts.

The player chooses among four equipped abilities corresponding to the exercise families.

Abilities should be tactically distinct.

Potential identities:

| Family | Potential role |
|---|---|
| Upper body | Heavy attacks, armor breaking, disruption |
| Legs | Area effects, stagger, defense |
| Cardio | Elemental effects, charge, chained attacks |
| Core | Shields, wards, counterattacks, sustained effects |

These are starting identities, not permanent restrictions on future ability design.

### Important combat principles

- No exercise should be universally optimal.
- Ability recharge should encourage variety.
- No enemy should require exactly one physical exercise.
- A different movement in the same family should remain combat-viable.
- Blessings should create interesting combinations.
- Bosses should test understanding of the player’s build.
- Enemy HP should not be inflated merely to increase workout duration.
- Exercise animations and set transitions should not feel needlessly repetitive.

The player should sometimes choose an ability because its secondary effect matters more than its raw damage.

---

## 15. Full Sets and Partial Sets

Exercise detection and exercise completion must be separate.

A full target can complete automatically.

The player can also explicitly end a set early.

Supported interaction concepts include:

- Voice command: “Finish set.”
- Phone button.
- Keyboard.
- Gamepad.

Pausing, standing still, or briefly losing tracking must not accidentally complete a set.

Partial sets should use verified work.

A partial attack may be somewhat less effective than a full one, but should not create a strong incentive to exercise beyond comfortable capacity.

Zero-repetition handling should remain sensible and should not trap the player in an exercise state.

**Partial-set effects (approved 2026-09-26 as the initial balancing approach; constants tunable after physical playtesting):**

| Effect | Rule |
|---|---|
| Numeric (damage, shield, heal) | **Full effect from 90% of the target.** Below that: **25% for any verified work, plus 75% of the share done** (of the 90%). |
| Binary effects (disrupt/interrupt, armour break, burn, Storm Charge, stagger build-up) | Trigger at **half the target or more**, unscaled; below half, only the numeric part lands. |
| Timed holds | The same curve on seconds held. For split holds (side planks), the weaker side decides. |
| Sided movements | Each side is credited up to the target, then the two are averaged. |
| No verified work | The ability fizzles and **is not spent**. |

**Tracking errors:**
- When the camera missed repetitions, the player can **enter how many it missed**, whether a partial correction or a one-tap "count the full target".
- Corrections are recorded as **manual** work, always distinguishable from camera-counted work in the history.

---

## 16. Defensive Combat

Normal enemies use telegraphed attacks.

The initial physical dodge vocabulary is:

- HIGH: Duck or squat.
- LOW: Small hop.

The game should use generous timing and readable visual telegraphs. Fights are read primarily from the enemy’s movement: its stance, wind-up, and the direction of its swing. Sound may signal that an attack is coming, but should not call out which height it is.

Later challenge can introduce:

- Delayed strikes.
- Multi-strike patterns.
- Unusual enemy rhythms.
- More complicated tactical consequences.

Do not demand unsafe reaction speeds.

### Readiness rules

Never attack during an active exercise set.

After floor exercises, give the player time to stand and prepare.

Do not begin defensive timing until the player is ready.

Do not count tracking loss as a confirmed missed dodge.

A failure to recognize the player is not proof that the player failed to move.

Controller/touch fallbacks should remain available.

---

## 17. Physical Performance and RPG Outcomes

*Revised 2026-09-26. Physical performance and RPG success are no longer treated as completely separate.*

### Performance can shape the fight

FITBOUND is a fitness game and an RPG. A boss victory should never become automatic just because an exercise allowance has run out.

- A fully completed set produces its ability's intended effect.
- A partial set produces a reduced or otherwise adjusted effect, and it always recognizes the verified effort.
- Genuine fatigue can shape tactics. When one family is spent, the player may choose a different ability.
- Poor decisions or weakened abilities can contribute to defeat.

**Physical failure is never RPG death by itself.** A detector failure is never physical failure: reps done correctly but missed by tracking need reasonable handling (the manual fallback, tracking diagnostics, and never counting a tracking loss against the player).

Different ability types (rep-based, holds, shields, interrupts and other non-damage effects) have their own partial-set rules (§15). There is no universal "50% of reps = 50% effect" rule.

### Boss balancing (approved direction, 2026-09-26)

- **Difficulty sources:**
  - meaningful **phases**;
  - tactical **openings** (a staggered or disrupted foe takes more from the next hit);
  - **distinct mechanics** per boss;
  - self-repair (healing, armour or ward regrowth) that is **limited and interruptible**.
- **What difficulty never comes from:** HP padding, or extra prescribed repetitions just because an enemy is a boss. HP is tuned only after the mechanics.
- **Set allowances** are balancing targets, never hard limits, and never automatic victory.
- **Enemy healing and armour regeneration aren't banned.** They are good mechanics when they create decisions without repeatedly undoing the player's physical effort.
- The goal is satisfying difficulty, not making every boss easy.
- **Validation:** a balance simulator checks each encounter against its band. Eventually it should model **whole expeditions**: carried HP, blessings, cooldowns, randomized loadouts and varying physical performance. Nobody should be assumed to reach the final boss at full HP or with unlimited capacity left.

### Falling ends the expedition

When the protagonist's HP reaches zero, **the expedition ends** and no reignition happens. Death matters as an RPG consequence. The player keeps:

- all verified exercise;
- persistent discoveries;
- fracture encounters and first-time scene flags;
- earned progression;
- Elara's traces and optional quest progress.

A failed expedition is still a useful workout, and it can still reveal new content.

### Test of Resolve (first version approved; not built yet)

After **every** failed expedition, the Heart offers an **optional** Test of Resolve: *"The expedition is over. Your resolve remains."*

The player can go back to the Sanctuary and finish, or take a short exercise challenge to earn **one modest advantage for the next newly started expedition**.

- **Scale to the session.** The Test scales to the appropriate activity still remaining in **today's** real workout session: today's verified work and readiness, not the expedition's progress. If the player has already reached an appropriate limit, the game doesn't press them to continue.
- **Respect the body.** It respects soreness, exclusions, equipment and per-movement targets, and never makes a tired player repeat the family that just exhausted them.
- **One challenge, one reward.** There are no volume tiers. Only one reward can be held at a time, and it never applies to an already suspended expedition.
- **Strengthening, not punishment.** The Test should feel like the hero strengthening his spirit, never like extra exercise for losing.

**First version (approved 2026-09-26):**
- An optional challenge of 2 to 4 sets, scaled to today's remaining appropriate workout volume.
- It accommodates soreness and limited eligible movements.
- It is never offered as pressure. After a full session, it isn't offered at all.
- It earns one non-stacking reward for the next new expedition. The starting candidates:
  - lock one eligible movement into the loadout;
  - a starting blessing chosen from three;
  - a starting shield.

### Fitness completion

Whatever the RPG result, track verified reps, hold time, per-exercise volume, left/right work, genuine activity, session duration, recent sessions and the player's feedback. **Fitness history is never erased by losing.**

### Fatigue

If the player is tired, they can:

- rest;
- finish a set early;
- substitute;
- suspend and resume later (even mid-boss);
- concede the expedition;
- or continue if they are able and want to.

Exhaustion is never turned into hidden HP loss or a hidden game over. Ordinary turn-based combat has no exercise time limits.

---

## 18. Workout Time and Pacing

### The target

About **20 minutes of core workout time per complete expedition, plus or minus 5**, **including the warm-up**. This is a design target to measure and physically validate, not a timer.

Time is kept in six categories:

| Category | What it is | Counts toward |
|---|---|---|
| **1. Warm-up** | The Awakening | The **core** target |
| **2. Core combat and physical recovery** | Sets and holds (exercise time, also measurable on its own), dodging, normal recovery between sets, physical setup and transitions | The **core** target |
| **3. Optional Haven yoga/mobility** | Voluntary stretches at a Haven or the Stillpoint | Total physical activity, shown separately |
| **4. Optional cooldown** | The Heart's Rest | Total physical activity, shown separately |
| **5. Other physical activity** | Optional guided marching, while actually marching | Total physical activity, shown separately |
| **6. Passive adventure** | Controller exploration, dialogue, cutscenes, menus, inactive pauses | Not workout time |

**Optional activity (3–5)** never shrinks the core combat budget, and it never makes a balanced expedition look overlong.

It is not 20 minutes of continuous exertion, and **total adventure time is not capped.** An expedition with 21 minutes of workout and 15 minutes of exploration and story is fine. Exploration should be meaningful, not cut short to hit a total.

**No automatic increase in exercise volume** may come from adding a second boss or a longer narrative encounter. Encounters are balanced around expected exercise volume, with **set allowances as balancing targets, never hard limits or automatic victory triggers.** The exact partial-set and boss-balancing rules await approval (§34). Boss difficulty comes from mechanics, tactics, phases and decisions, not HP padding or higher rep targets.

### Sessions and expeditions

An **expedition** is one continuous RPG attempt. It can span several real **workout sessions** (sittings). This is provisionally settled; revisit it after real playtesting.

- **Each session has its own** readiness and soreness check, calibration when required, sets, workout time, volume, adaptive progression and Journal entry.
- **The expedition keeps** its fracture scenarios, loadout, blessings, HP and combat resources, encounter and boss progress, discoveries, and any suspended battle state.
- **Returning another day** means a fresh readiness check and calibration. Sore families can swap their slot without rerolling the whole build.
- **Stopping and resuming:**
  - the player can stop anywhere that isn't an unsafe or unfinished exercise state;
  - stopping mid-set ends the set with its verified work kept;
  - the temporal crossing is the natural checkpoint, but never the only one;
  - no completed physical work is ever repeated because of a save.
- **A shorter workout** is simply part of the same expedition, finished in another sitting. There is no separate short expedition.
- **Splitting across two sittings never means two full expedition-sized workouts.** The expedition's combat volume is shared by its sessions. Each session gets its own warm-up, which is small and counted.

### The Awakening (warm-up)

About **five minutes** of gentle dynamic warm-up at the start of each real workout session. It is **strongly encouraged but never mandatory.**

- **In the story,** the hero is getting used to a reconstructed body. After the ritual, Elara says something like *"Take a moment. You haven't worn this body before."* Her line is text, never the synthetic voice. Coordination returns as the player follows along.
- **The movements** are accessible: marching, arm circles, torso rotations, hip mobility, leg swings, easy squats or steps. These are examples, not a fixed sequence.
- **It adapts** to soreness, movement limits and space.
- **It can be skipped or shortened.**
- **It is not an exhausting circuit and not a fight.**
- **Recording:** participation and duration are kept separately from combat. The time counts toward the core target.
- **Resuming on another day:** a fresh warm-up is offered after the readiness check and calibration, with a brief presentation rather than the full reconstruction story.
- **First implementation:** guided, timed movements with clear demonstrations and simple controls. It is not a new detector project.

### The shape of the budget (reconciliation, 2026-09-26)

**The problem:** four ordinary fights, a miniboss and a main boss at the earlier per-encounter bands (3–4, about 5, and 6–7 sets) add up to about 25 sets. With the warm-up inside the ~20-minute core, that is more than intended.

**Working assumption,** to be replaced by measurement: each set costs about **1 to 1.25 minutes of core time** once you count setup, the set itself, recovery and the enemy turn. The workout-time measure (§32) will show the real figure after the first physical playtest.

**Proposed budget** (awaiting the creator's decision, §34):
- the warm-up (~5 min);
- about **12–16 sets** of combat for the whole expedition, for example about 4 ordinary fights at ~2–2½ sets each, a miniboss at ~3–4 and a main boss at ~4–5;
- **or** fewer ordinary fights, so bosses keep more room.

Bosses keep their distinct mechanics either way. What shrinks is HP and the number of ordinary fights, not their depth.

---

## 19. Workout Director

A simple, transparent system that coordinates physical work. It is not a coaching AI. It considers:

- the loadout;
- comfortable per-movement targets;
- work already done in this session;
- recent history;
- today's readiness and soreness;
- the encounters ahead;
- the expedition's remaining plan.

Rules:

- Targets and progression are judged **per real session**, using that day's readiness.
- It avoids needless repetition, such as more heavy push-up sets after enough pushing work.
- Physical progression is gradual.
- A change in RPG difficulty never silently changes the exercise prescription.

---

## 20. Havens and Recovery

**Havens are part of the RPG's recovery.** They are peaceful pockets the Haze cannot reach, and **the hero recovers HP there** (clarified 2026-09-26).

- **Where they appear:** occasionally, as randomized discoveries in either fracture, and always at the Stillpoint.
- **Resting needs no yoga.** The HP recovery never depends on completing a routine.
- **The yoga is voluntary.** Optional yoga, static stretching or gentle mobility are extra. Completing them may earn a **modest** additional benefit, never one so strong that players feel they must stretch at every Haven.
- **Memories come after,** never while holding a pose.

### The Stillpoint (the guaranteed midpoint Haven)

After the first fracture's miniboss, the Heart opens a quiet space between the ages. This replaces the plain crossing. There, the player can:

- **rest:** recover HP through the Haven system;
- do an optional gentle yoga or mobility session;
- review their build and discoveries;
- look into the Mirror (the crossing's Mirror is kept);
- **save and return later**;
- or continue into the second fracture.

**Rest and Save and return later are not exclusive.** You can rest, then save.

It marks the accomplishment of the first fracture and makes splitting an expedition across days feel natural. A small, atmospheric diorama is enough; it is not a new explorable environment. It is the recommended stopping place, never the only one.

### The Heart's Rest (optional cooldown; working name)

After the reignition, the Sanctuary offers a short, optional yoga or static-stretching cooldown.

- It is a voluntary epilogue. The victory and the story payoff never wait on it.
- Its time is tracked separately from the core workout, but included in total physical activity (§18).

### Haven movements

Havens can include gentle yoga, stretching, and mobility sequences.

Examples:

- Child’s pose.
- Cat-cow.
- Gentle standing mobility.
- Other comfortable guided movements.

Recovery does not require the same strict detection architecture as combat.

Timed guidance or explicit completion may be sufficient.

The goal is a calming transition, not another scoring challenge.

Do not interrupt the recovery sequence with major story revelations.

A recovered memory or character interaction may occur after the movement sequence finishes.

Narratively, the relative stillness of a Haven allows memories to surface more clearly.

---

## 21. Hazy Chaos

**Status:** Settled future design; not necessarily implemented yet.

Hazy Chaos is an optional, timed calisthenics circuit encountered during ordinary expeditions.

It becomes available after the first reignition.

The Heart’s breakthrough allows more unstable and demanding combinations of reconstructed abilities to appear.

Hazy Chaos is intentionally different from ordinary turn-based combat.

The player enters a chamber and attempts a randomized circuit using eligible exercises.

### Core rules

- Participation is optional.
- The circuit is timed.
- The player attempts prescribed movements before the timer expires.
- Success grants a valuable perk or reward.
- Failure does not end the expedition.
- Failure does not automatically reduce HP.
- The player continues along the route after either outcome.
- Completed physical work always counts toward fitness history.

The room represents a risk/reward decision.

A powerful reward is available, but it is not guaranteed.

The challenge timer should be calibrated with realistic movement and transition requirements.

Do not reward sloppy repetitions, unsafe rushing, or ignoring discomfort.

The game should provide safe ways to stop.

### Relationship to workout pacing

Hazy Chaos should consume part of the expedition’s planned workout budget.

It should replace or reduce other exercise volume where appropriate rather than being an unlimited extra workload added on top of an already complete session.

Later, optional extra-long sessions can deliberately allow additional challenge volume.

---

## 22. Punch Away

**Status:** Settled future design; not necessarily implemented yet.

Punch Away is a short, real-time coordination challenge available during certain combat opportunities.

It is not an unrestricted punching flurry.

When an enemy is stunned or otherwise vulnerable, the player may receive a Punch Away opportunity.

The player is shown a randomized sequence of left/right punch indicators.

Examples:

- LEFT → RIGHT → LEFT → RIGHT
- RIGHT → RIGHT → LEFT → RIGHT

The player performs controlled punches corresponding to the indicated sequence.

A recognized correct punch advances the pattern.

Completed combinations produce bonus damage.

### Design rules

- Initial target: approximately 10 seconds of active challenge.
- The timer begins only after the player is standing and ready.
- The challenge is optional.
- Failure to complete the full pattern is not an automatic combat defeat.
- Correct, controlled movements matter more than frantic punch frequency.
- Require a meaningful punch and return toward guard.
- Use the player’s actual left/right perspective, not a mirrored screen interpretation.
- Begin with simple straight punches.
- Do not require professional boxing technique classification.
- Do not claim to measure punching force.

Punch Away should remain occasional enough to feel exciting.

It should not automatically follow every stagger.

---

## 23. The Unbound

**Status:** Settled future design; not necessarily implemented yet.

The Unbound is a recurring unusual fighter encountered during normal expeditions.

He challenges the Heart’s ordinary combat structure.

Instead of fighting through conventional turns, the encounter becomes a short rhythm-based movement battle.

A possible introduction:

> “You always wait your turn.”
>
> “No more turns. Let’s fight.”

The ability interface disappears and a beat begins.

The player responds to rhythmic combinations involving:

- Left punches.
- Right punches.
- Ducks.
- Potentially lateral slips.

The Unbound should feel like a character with a distinct personality, not just an explanation for an alternate combat mode.

He can recur during later expeditions.

He may develop different patterns and dialogue as the player progresses.

### Technical and gameplay philosophy

The Unbound is not intended to be a fully realistic boxing simulation.

It is a controlled rhythm-conditioning encounter.

It should emphasize:

- Timing.
- Coordination.
- Recognizable movement patterns.
- Moderate sustained activity.
- Alternating offense and defense.

Do not use extremely narrow timing windows.

Account for camera and local-network latency.

Do not require increasingly frantic movements as the only form of difficulty.

A reliable small movement vocabulary is sufficient.

---

## 24. The Unbound Gauntlet

**Status:** Settled future mode; not necessarily implemented yet.

Defeating the Unbound for the first time unlocks the Unbound Gauntlet.

This is an alternate training mode accessible outside ordinary expeditions.

The Unbound continues to appear in the regular expedition encounter pool after this unlock.

### Narrative premise

The Unbound introduces the protagonist to other unconventional fighters.

These Echoes participate in rhythmic fighting tournaments outside the Heart’s ordinary combat rules.

The Gauntlet can feature opponents with different rhythmic identities.

Examples include fighters emphasizing:

- Alternating combinations.
- Repeated-hand sequences.
- Defensive movement.
- Offbeat attacks.
- Changing tempos.
- Longer or more complicated patterns.

### Gameplay premise

Progress through increasingly challenging rhythmic opponents.

Track:

- Highest round reached.
- Personal records.
- Completed conditioning time.
- Accuracy and recognized movements.
- Other appropriate nonpunitive fitness statistics.

The Gauntlet is intended to provide an alternative cardio/conditioning-focused session.

Possible session formats:

- Short training.
- Standard conditioning session.
- Endless or record-chasing Gauntlet.

The player should be able to stop safely regardless of their score.

Increasing challenge should emphasize pattern complexity, timing variety, and tactical demands rather than endlessly increasing physical speed.

Boxing still uses the upper body; it should not automatically be treated as a recovery workout for sore chest or shoulders.

The Gauntlet should remain enjoyable after the main narrative has concluded.

---

## 25. Break the Rhythm — The Unbound’s Reward

**Status:** Settled future item; not necessarily implemented yet.

Defeating the Unbound during a normal expedition grants a special item.

Working name: **Break the Rhythm**.

The item allows the player to activate Punch Away without first stunning an enemy.

This can enable the player to finish an ordinary encounter without spending another conventional exercise set.

### Initial rules

- Awarded after defeating the Unbound.
- One use per expedition in the initial implementation.
- Activates a standard patterned Punch Away challenge.
- Does not guarantee a kill.
- Can be used against ordinary enemies.
- Does not work on bosses.
- Does not require an existing stagger.
- Does not erase or invalidate previously completed workout volume.

The item trades one kind of physical challenge for another.

It creates an interesting decision about when to spend a limited resource.

Narratively, it demonstrates that the Unbound has taught the protagonist to act outside the Heart’s ordinary combat rhythm.

---

## 26. The Three Primary Ways to Train

FITBOUND should eventually support three distinct physical gameplay experiences.

| Mode or encounter | Physical emphasis | Game identity |
|---|---|---|
| Standard Expedition | Varied strength, cardio, and core activity | Tactical fantasy roguelite |
| Hazy Chaos | Timed calisthenics circuit | Optional risk/reward challenge |
| Unbound Gauntlet | Rhythm boxing and conditioning | Unlockable alternative training mode |

Punch Away and the recurring Unbound encounter provide additional variety within standard expeditions.

These systems should share appropriate technology without becoming mechanically indistinguishable.

---

## 27. Exploration and Controls

Exploration is secondary to encounters, combat, story, and fitness.

The game should not require lengthy walking sections to feel like an adventure.

Supported or considered navigation approaches include:

- Assisted controller exploration.
- Guided marching routes.
- Brief meaningful free exploration within compact environments.

**Decided (2026-09-26): controller-first exploration, with optional guided marching** for players who want extra activity. Camera controls are mainly for exercise and defensive combat. Controller movement never counts as physical activity.

Guided marching may skip optional content; that content is offered again on a later expedition, and nothing required is ever lost by marching. Keep both paths working, and don't build features that only work with one of them.

Do not insist on motion-controlled travel merely because the project began with that idea.

### Couch play

When using a gamepad, the player may be completely outside the camera frame during:

- Sanctuary.
- Exploration.
- Dialogue.
- Menus.
- Blessing selection.
- Narrative encounters.
- Other nonphysical states.

This is expected behavior.

Do not display intrusive tracking-lost warnings during these states.

When physical activity begins, ask the player to enter view and become ready.

Camera connection and body visibility are separate concepts.

---

## 28. Camera, Calibration, and Hardware

### Intended setup

- Phone acts as the motion controller.
- MediaPipe or the existing pose system runs on the phone.
- Interpreted movement events are transmitted over local Wi-Fi.
- Laptop or PC runs the game.
- TV can display the game through HDMI.
- Gamepad is optional but useful for conventional RPG navigation.

The existing QR-code pairing flow is successful and should be preserved.

### Calibration

Recalibrating every play session is acceptable.

The phone is physically placed and repositioned each time.

Do not prioritize persistent room profiles unless a compelling practical need emerges.

The creator has tested the game in both a spacious basement and a smaller bedroom.

Wide-angle camera selection can make the smaller room playable, although furniture may obscure some movements.

Calibration should account for the current camera arrangement.

Changing the phone’s physical placement may require recalibration.

Leaving the camera frame during couch play should not.

### Tracking reliability

Do not invent repetitions.

Do not mistake missing landmarks for incorrect physical performance.

Provide useful diagnostics for tracking failures.

Experimental movements should be identified honestly.

Exercise detectors should work with the realistic constraint of a single fixed phone camera, without requiring constant repositioning between exercises whenever reasonably possible.

---

## 29. Privacy and Networking

Local processing is an intentional part of FITBOUND’s identity.

The design goal is:

> Camera footage stays on the player’s device.

The phone should transmit interpreted movement data, not raw video, to the local PC.

The game should not require an external video-processing service, cloud relay, or persistent account simply to play.

The local QR-pairing architecture should be preserved.

### Important voice-recognition exception

Voice commands currently use the laptop microphone through supported browser speech-recognition functionality.

Browser speech recognition may use remote services unless on-device recognition is explicitly supported and active.

Do not describe the game as fully offline or claim all audio is local without verifying the actual implementation.

Local-only recognition is preferable when practical.

Remote speech recognition must not be silently introduced under the assumption that it follows the same privacy model as the camera.

Voice commands should remain optional, with usable alternatives.

---

## 30. Technical Architecture Principles

The existing working game uses a browser-based game, a phone controller, and a local relay.

Preserve functioning systems wherever possible.

The current implementation has already established foundational systems for:

- Exercise definitions and detectors.
- Exercise state management.
- Explicit set completion.
- Voice commands.
- Four-ability combat.
- Enemy mechanics.
- Blessings.
- High/low dodging.
- Randomized exercise loadouts.
- The Mirror.
- Haven recovery.
- Expedition progression.
- Saves and resumability.
- Workout records.
- Movement Lab.
- Connected Play.
- Couch-based navigation.

Do not rebuild these from scratch merely to implement future narrative features.

Prefer data-driven content for:

- Exercises.
- Abilities.
- Blessings.
- Enemies.
- Encounter types.
- Dialogue.
- Story prerequisites.
- Permanent progression.

The exact implementation architecture is Claude’s engineering responsibility, subject to preserving actual working gameplay.

---

## 31. Testing Philosophy

Automated tests are valuable and should continue.

However, synthetic pose data and headless browser tests cannot establish real-person motion-recognition reliability.

Distinguish clearly between:

1. Implemented.
2. Automated-test validated.
3. Physically playtested.
4. Reliable enough for normal randomized play.

The creator prefers substantial cohesive implementation passes followed by a small number of comprehensive physical playtests.

Avoid unnecessary approval checkpoints or breaking every milestone into multiple tiny deliveries.

At the same time, do not claim real-world reliability from simulated tests.

Use the Movement Lab to make individual detectors and commands easy to test without replaying an entire dungeon.

Preserve existing successful behavior, especially pairing, calibration, camera settings, gamepad controls, pause, and tracking-state transitions.

---

## 32. Current Development Status

*Maintained by Claude at the end of each development pass. Last updated: 2026-09-26.*

The expanded expedition build has been implemented and pushed, but its newest systems still require the creator’s physical playtesting.

The previous four-encounter tutorial was physically played and found enjoyable.

The expanded expedition build includes:

- Four-family randomized loadouts.
- New exercise detectors.
- Partial-set completion.
- Voice-command support.
- Ability recharge and tactical combat.
- Multiple enemy archetypes.
- Temporary blessings.
- Physical high/low dodging.
- Mirror rerolls.
- Haven recovery.
- Workout tracking.
- Resumable expeditions.
- Movement Lab.
- Game-state-aware camera requirements.

Since then, the following have also been implemented (not yet physically playtested):

- **Marching between encounters.** Each encounter stands at its own spot on the diorama trail, and the player marches in place to reach it. Each leg opens with a short story line. A Mossy Shrine detour heals once per run. Steps are tallied in the workout summary, separate from sets. Controller traversal remains available from the pause menu and is not counted as activity. Since 2026-09-26 (later), expeditions **default to controller travel** (§27); marching is the optional choice.
- **Visual-first battle staging.** Battles are staged side-on in the style of a simple turn-based JRPG. The hero stands front-left, and enemies stand on a diagonal with in-scene HP, armor, ward, and intent. The camera pushes in on each exchange, and a command menu replaces the ability cards.
- **Visual-only attack cues.** Enemies telegraph HIGH or LOW through their stance, a glint, and the direction of their swing. Early fights add a guide line and marker; late fights show only the stance. Spoken height calls were removed (see §16).
- **Free-standing battle figures.** In battles, figures stand without their tabletop bases, with shadows that stay on the ground. The board keeps the based pieces.
- **Playtest aids.**
  - A *Between fights: March / Gamepad* choice in the Sanctuary, to compare navigation for §27.
  - A time breakdown in the summary: sets, between sets, marching, Haven, menus.
  - An optional post-run check-in on effort, fun and pacing, saved with the history. This is the first "player feedback" from §17.
  - A copyable plain-text playtest report per run.

- **The opening cinematic and the reconstruction ritual (first version).** These run on a reusable in-engine cinematic system; the scripts are data.
  - **Elara's first visual identity:** a young, doll-like woman; long wavy silver-grey hair; ivory and deep-teal robes; a thin thread of the Heart's warm amber light. Her figure and dialogue portrait share one painter.
  - **The opening:** darkness and rain, then the heartbeat; illustrated memory fragments; the Heart's cavern, where the rain is muffled; the rainy Sanctuary, where the hero forms on the stone and Elara waits by the well; and the distant Spark.
  - **Presentation:** player-paced dialogue; no synthetic voice for Elara anywhere in the game; line ids ready for recorded voice.
  - **Playback:** the opening plays once, can be skipped, and can be replayed from the title screen.
  - **The ritual:** about 10 s, skippable, with a context-sensitive line from Elara.
  - **Rain motif:** the Sanctuary rains until the first reignition, then is dry and sunlit. This is not explained on screen.

- **The refined hero (first version).**
  - **Proportions:** still chibi, with a slightly smaller head.
  - **Hair and face:** tousled brown hair with an asymmetric fringe, and a curious neutral face; the rosy cheeks and permanent smile are gone.
  - **Outfit:** muted burgundy, deep teal, weathered leather and brass; a mantle over a linen collar; a slimmer sword.
  - **The Heart's crystal:** a small amber crystal at his collar, the shared motif with Elara. It glows in cinematics and flares during reconstruction.
  - **Faces:** blinks, plus wince, soft, wonder and blink expressions, used in gameplay, cinematics and portraits.
  - **Fallback:** the original design is kept as `heroClassic`.

- **Training features (first version).**
  - **Sore today?** in the Sanctuary: go gentle (about 60% targets) or rest a family (§12, §19).
  - **Target progression:** learned from full, early and short sets and pace, plus the optional check-in. Slow to go up, quick to come down, applied between sessions, with a one-tap "keep".
  - **A read-only Journal.**
  - **Passive phone-to-PC lag measurement** in the playtest report.
  - **Eight new movements**, all beta or experimental, each with its own ability: overhead press, lateral raises, goblet squats, sumo squats, glute bridges, skaters, butt kicks and Russian twists.
  - **A Lab-only punch test**, facing the phone and side-on, as a feasibility check for Punch Away and the Unbound (§22–§23).
  - **Two Lab-only experimental holds:** the wall sit (side-on) and the side plank (facing the phone, on your side). The side plank's target is split evenly between the sides, and one side can't finish the set alone.
    Each side-plank set saves the time held on each side, and target progression judges it by the weaker side.

- **The foundation for the approved direction (2026-09-26):**
  - **Workout sessions within expeditions (§18):**
    - each sitting is its own session, with its own summary, check-in, Journal row (tagged with its expedition) and target progression, judged on that day's readiness;
    - resuming on another day asks *A new day* questions first (feel, soreness, dumbbells): a resting family sits out without losing its slot, and single slots can be swapped;
    - an interrupted session is recorded when you resume.
  - **Fights saved at safe points:**
    - *Pause → Save and leave* saves a fight exactly where it stands: your turn, "stand when ready", or strikes still to come;
    - mid-set, it ends the set with what was counted and lands its ability first;
    - resuming continues the same fight, and nothing already done is asked again. (Previously, leaving replayed the whole fight.)
  - **A fall ends the expedition (§17)** with no reignition. Every set, dodge and step is kept. The Test of Resolve is designed in `docs/proposals/foundation.md`, not built.
  - **Narrative text:**
    - two opening lines now fit the premise: "Everything that ever was still runs through the Heart." and "That's the Spark. All the way at the end of time. The Heart can't reach it anymore.";
    - the victory text is revised;
    - the fall screen is now "You fall…" (the premature "The Echo fades…" is gone), and the README intro is corrected.
  - **Reignitions are counted in the save.** Older saves derive the count from their victories. The save also records a list of seen scenes.
  - **The short route is retired** for new expeditions. Runs already saved on it still finish on it.
  - **Proposals awaiting approval** in `docs/proposals/foundation.md`: fracture architecture, bosses and the workout, the Test of Resolve, and Anachronisms.

- **Controller-first travel, workout time, a balance harness, the fracture architecture, and Medieval A (2026-09-26, later):**
  - **Travel:** expeditions default to controller travel; marching is optional. Expeditions remember their own choice, and the Motion Trial keeps its own.
  - **Workout time (§18)** is measured per session: sets and holds, dodging, recovery between sets, physical setup, marching you chose, and the Haven. Controller travel, choosing, dialogue, cutscenes, menus and paused time are excluded. Exercise time is kept separate. It shows in the summary, the playtest report and the Journal.
  - **A balance harness** (`src/rpg/sim.ts`) plays fights through the real engine with scripted players.
    - Today's route takes a careful player about **28 sets**, against a plan of about 21, and the Warden has a long tail.
    - The combat rules themselves are unchanged. The exact partial-set and boss-balancing rules are proposed in `docs/proposals/combat-balance.md`.
  - **The fracture architecture (§9):**
    - scenarios are data;
    - selection is weighted and tunable, and keeps content that has been built separate from what the player has unlocked;
    - each expedition's route is saved with the run and survives content edits;
    - staged bosses have scenes between stages;
    - first-encounter scene flags;
    - per-scenario flags record met, boss reached and boss defeated;
    - the Crossing checkpoint.
  - **Medieval A (content stage A):** the existing medieval fights, ending with the **Green Knight**.
    - He is a two-stage miniboss: the head rolls, he picks it up, and fights on warded by its words. No gore.
    - He has new painted figures, an introduction and a between-stage scene.
    - In the harness, a careful player beats him in a median 5 sets (7 at p90).
    - It is playable as a development **scenario preview** from the Movement Lab. New expeditions still use the legacy route until Prehistoric B exists.

Validation to date:

- **Automated:** 368 passing unit tests. These include the new detectors, soreness, progression, the Journal, the lag measurement, the refined hero's faces and fallback, the cinematic runner, the opening's agreed lines and staging rules, the ritual's length and lines, and story progress in the save.
- **Headless browser:** the full opening (every line in order), the ritual on the next launch (the opening does not repeat), skip, the Sanctuary screen over the garden, and the dry garden after restoration. Screenshots were reviewed; the visuals are a first version for the creator to evaluate.
- **Headless browser runs through the local relay with a scripted synthetic body:**
  - a full standard expedition (19 sets, all march legs, the shrine detour, and victory);
  - a short expedition (before its retirement);
  - the tutorial trial;
  - **2026-09-26:**
    - saving and leaving mid-fight and mid-set, then resuming "the next day" (a new session, *A new day*, the same turn and enemy HP, no set repeated, the fight continuing to victory);
    - the new opening lines;
    - the Sanctuary without a route choice;
    - a fall ending the expedition, with its session recorded as a defeat;
  - **2026-09-26 (later):**
    - the Sanctuary defaulting to controller travel;
    - switching to marching mid-leg, remembered for expeditions while the Trial's own setting is handed back;
    - workout time recorded per session, split by kind;
    - the legacy save-and-resume run again (unchanged);
    - **the Medieval A preview start to finish:** both of the Green Knight's scenes, a save at his second stage resuming at that stage with no scene replayed, *Scenario preview complete* with no reignition, and the scenario's flags and seen scenes recorded;
    - the Green Knight figures and the scene overlay were reviewed in screenshots.

These are implementation milestones, not proof that every movement and interaction works reliably with the creator’s real body and hardware.

The next task is to collect physical playtest observations and refine the integrated experience. The README’s *Physical playtest checklist* lists what to try.

---

## 33. Development Roadmap

These are priorities, not a rigid schedule. Keep the game playable at every milestone, run the regression suite, keep saves compatible where practical, and always say what has passed synthetic tests versus a physical playtest.

### Foundation (before new eras)

1. **Documentation:** this revision.
2. **Session and resume reliability:**
   - separate workout sessions from expeditions;
   - per-session Journal entries and progression;
   - correct readiness on multi-day returns;
   - mid-battle saves at safe points;
   - no repeated work on resume;
   - compatibility with existing saves and history.
3. **Foundational narrative:**
   - opening, victory and fall text;
   - reignition tracking;
   - a fall ends the expedition;
   - no short route for new expeditions.
*Items 1–3 are built (2026-09-26), and so is the fracture architecture from item 4. Only headless and synthetic tests have been run, with no physical validation.*

4. **Proposals for approval before building:**
   - fracture architecture (independent A/B scenarios, selection, encounter flags, the crossing);
   - how bosses fit the workout, and physical-failure rules;
   - the first Test of Resolve and its reward pool;
   - a lightweight Anachronism architecture.

### Next, in order (creator's sequence, 2026-09-26)

1. **The approved combat-balance changes,** with regression tests: the partial-set curve and per-effect rules, the missed-rep correction, phases, openings, limited and interruptible self-repair, and HP tuned after mechanics.
2. **Keep the session and resume work stable.**
3. **The Awakening:** a lightweight, guided warm-up.
4. **The Stillpoint:** the crossing becomes a Haven-like stop, with HP recovery, the Mirror, optional yoga and save-and-leave.
5. **Prehistoric role B,** for the first complete Medieval A → Prehistoric B expedition.

**Later:**
- the Heart's Rest cooldown;
- a whole-expedition balance simulator;
- one Reflection prototyped in the Movement Lab, once the two-fracture expedition works;
- Anachronisms and the Test of Resolve, as approved.

### Validate the current build

Physically test the expanded combat, movements, voice, partial sets, dodging, loadouts, blessings, Mirror, Haven, marching, and the real workout time of an expedition.

### Fracture content, one role at a time

| Stage | Scenario |
|---|---|
| A | Medieval role A: the existing setting, ending with the **Green Knight**. *Built 2026-09-26 as a Lab preview; synthetic tests only.* |
| B | Prehistoric role B: ending with a dinosaur main boss. **This makes the first complete canonical expedition, Medieval A → Prehistoric B → Spark, for physical and narrative validation.** |
| C | 1800s role A: the literary scenario and the **Three Authors** group miniboss |
| D | 1800s role B: the historical scenario, **Booth → Corrupted Lincoln** |
| E | Medieval role B: complete the scenario around the existing **Warden of the Haze** |
| F | Prehistoric role A |
| G, H | Modern role A, then Modern role B |
| I | Future roles A and B |

Legacy expedition content stays available during development. Player-facing unlocks (§9.4) can be enforced separately from building content.

### Later milestones

- **Hazy Chaos and Punch Away:** fit them to the workout budget and physical readiness.
- **The Unbound, then Break the Rhythm:** validate punch recognition, guard recovery, timing and latency first.
- **The Unbound Gauntlet.**
- **Deeper narrative:** Elara's traces and resolution, Anachronism quests, and an eventual conclusion.

---

## 34. Open Questions

These are not settled canon or final specifications. Resolve them through proposals, implementation and playtesting.

### Narrative

- What happened to Elara, and how her story resolves.
- What lies at the end of time; the story's eventual conclusion and any postgame.
- The Heart's fate once its rhythm is restored.
- Exact cutscene scripts beyond the opening and ritual, and per-scenario boss introductions.

### Gameplay

- **The budget's shape (§18).**
  - How many ordinary fights an expedition has, and each encounter's set band, so that ~12–16 sets plus the warm-up fit the ~20-minute core.
  - It depends on the real minutes per set, which the first physical playtest will measure.
- **Tuning the partial-set constants** (90% band, 25% floor, half-target binary threshold) from physical playtesting.
- **The Awakening:** its exact movements, how it adapts to space and limitations, and whether a resumed session's short version is 2 or 3 minutes.
- **The Haven yoga bonus:** what "modest" means in play.
- **The Stillpoint:** its diorama's look.
- **The Reflections:** appearance probability, pose vocabulary, and whether the camera recognizes poses reliably. That needs a physical prototype first.
- **Tuning the selection weights and repeat protection** once several scenarios exist. The starting values are deliberately tunable.
- **Test of Resolve** and **Anachronisms:** approved in outline, not built yet.
- The real workout time of an expedition, measured physically.
- The long-term shape of multi-day expeditions, to revisit after playtesting.
- Final targets and progression rates (a first rule set exists; tune after weeks of use).
- Final HP, damage and cooldown balance; dodge timing windows; how often unusual encounters appear.
- Which detectors are reliable in the creator's rooms (the Lab-only and experimental movements especially).
- Whether straight punches read reliably, before Punch Away and the Unbound.
- Hazy Chaos duration and limits; Punch Away and Unbound tuning; Gauntlet progression.

### Presentation

- Refinements to Elara's and the protagonist's first designs.
- Voice casting and production.
- Soundtrack and audio direction.
- Each fracture's visual identity.

Claude may propose answers, but must not overwrite settled principles or present speculative lore as established fact.

---

## 35. What FITBOUND Must Not Become

FITBOUND should not become:

- A fitness tracker disguised as an RPG.
- A repetitive rep-counting application with enemies.
- A conventional RPG with insignificant exercise interruptions.
- A game that punishes exhaustion.
- A game requiring maximum-effort exercise to defeat ordinary enemies.
- An enormous procedural-world project.
- A story that becomes meaningless after its first ending.
- A system where the Heart is secretly evil simply because a villain is needed.
- A game where every narrative event is a massive revelation.
- A technical showcase that is unpleasant to play.
- A commercial platform built at the expense of the creator’s actual needs.

Do not optimize away the game’s personality.

Do not add complexity merely because it is technically possible.

---

## 36. The North Star

FITBOUND: Heart of Haze is about a person becoming stronger through repeated attempts to save a world that cannot be fixed all at once.

The Heart tries another possibility.

The protagonist ventures into the Haze.

He fights, learns, fails, succeeds, and returns.

The world gradually changes.

The protagonist gradually changes.

And outside the game, the player becomes fitter because returning to this world is something he genuinely enjoys.

The ideal outcome is that six months after finishing the central story, the creator still voluntarily launches FITBOUND several times a week because the combat is fun, the randomized workouts stay fresh, and each session leaves him feeling that he accomplished something.

That is the experience every major design decision should serve.

> Every expedition is another possibility.
>
> Every workout is progress.

**Direction, not permission.** This bible establishes direction, not permission to implement every future feature immediately. The Unbound, the Gauntlet, Hazy Chaos, and Punch Away are settled concepts, but the latest combat build should be validated before they are layered in.

---

## Revision log

- **2026-09-25:** First version added to the repository, from the creator’s draft. Changes agreed with the creator:
  - **§16:** telegraphs are visual; sound may say that an attack is coming, never which height.
  - **§27:** the navigation method is marked TBD until after the next playtest.
  - **§32:** status brought up to date (marching legs, visual battle staging, visual-only cues, free-standing battle figures, 280 tests).
  - **§34:** navigation added to the open questions.
- **2026-09-25 (later):** §32 updated with the playtest aids.
- **2026-09-25 (later):** §32 updated with the opening cinematic, the ritual, Elara's first visual identity, and the Sanctuary rain motif. §34 notes that Elara's look has a first version.
- **2026-09-25 (later):** §32 updated with the refined hero; §34 notes his design has a first version.
- **2026-09-25 (later):** §32 updated with soreness, target progression, the Journal, the lag measurement, eight new movements and the punch test. §34 adds sets scaling and punch readability as open questions.
- **2026-09-25 (later):** §32 adds the Lab-only wall sit and side plank (338 tests). §34 adds their reliability, and notes the proposed premise revision is under discussion (§5–§8 unchanged).
- **2026-09-26:** §32 adds per-side side-plank records (342 tests). §34 points to the revised narrative and expedition proposal, which awaits approval; no vision section is changed yet.
- **2026-09-26 (approval):** the creator approved the revised narrative, with changes. Changes:
  - **§5–§9 rewritten:** the time premise, the fractures with independent A/B roles, one canonical two-fracture expedition, availability rules, discoveries and Anachronisms. The anchor, the Echo identity and Elara's memory suppression are retired; the old postgame text is folded into §6.
  - **§3.2, §15 and §17:** performance may shape outcomes, a fall ends the expedition, and the Test of Resolve is added.
  - **§18–§19:** workout time is 20 ± 5 minutes, excluding passive play, and sessions are distinct from expeditions.
  - **§27:** navigation is controller-first with optional marching.
  - **§33:** the roadmap is now foundation, then content stages A–I.
  - **§34:** the open questions are rewritten.
- **2026-09-26 (later):** §32 updated: sessions within expeditions, fights saved at safe points, a fall ends the expedition, the revised opening and victory text, reignition tracking, the short route retired (352 tests). The proposals for fracture architecture, bosses and the workout, the Test of Resolve, and Anachronisms are in `docs/proposals/foundation.md`.
- **2026-09-26 (later still):** the approved foundation is folded in:
  - **§9.5:** Anachronisms architecture and starting scope;
  - **§17:** the first version of the Test of Resolve;
  - **§18:** workout time includes optional marching, excludes inactive pauses, and keeps exercise time separate; allowances are targets, not limits;
  - **§34:** the exact partial-set and boss rules await `combat-balance.md`, and the selection weights stay tunable;
  - **§32:** controller-first travel, workout time, the balance harness, the fracture architecture, and Medieval A with the Green Knight (368 tests).
- **2026-09-26 (combat, warm-up, recovery):** the creator's decisions are folded in.
  - **§15:** partial-set rules and missed-rep corrections, approved and tunable.
  - **§17:** the approved boss-balancing direction; self-repair is allowed when it creates decisions.
  - **§18:** six time categories; the warm-up counts inside the core ~20 minutes; sittings share one expedition's volume; the Awakening; a budget reconciliation, awaiting a decision.
  - **§20:** Havens keep HP recovery without requiring yoga; the Stillpoint and the Heart's Rest are added.
  - **§9.3 and §9.7:** the session shape, and the Reflections as planned content.
  - **§33:** the build sequence.
  - **§34:** new open questions.

