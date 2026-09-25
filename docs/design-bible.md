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
- A mysterious fantasy world reconstructed from fragmented memories.
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
3. Choose an expedition or another unlocked training mode.
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

### 5.1 The foundational premise

Long ago, a kingdom faced a mysterious corruption that threatened to consume its world.

Its inhabitants created the Heart, an extraordinary preservation mechanism intended to save the kingdom.

The Heart was not designed to rule, punish, or conquer.

It was created as a last resort.

Its purpose was to preserve the world, reconstruct what was lost, and discover a way to overcome the catastrophe.

But the Heart’s original solution did not hold.

The kingdom could be reconstructed, yet the corruption repeatedly returned.

Over time, the Heart began testing different possibilities.

Different configurations of the world.

Different circumstances.

Different abilities.

Different decisions.

Different attempts to reach the source of the problem.

The Heart’s repeated reconstructions gave rise to the world now known as the Haze.

The protagonist is part of the Heart’s final contingency: a recurring adventurer sent into the unstable world to discover a solution.

Every expedition is another possibility.

### 5.2 The Heart

The Heart is fundamentally benevolent.

It is trying to save the world.

Its tragedy is not that it secretly wants to destroy the kingdom, but that the problem it was built to solve is more complicated than its original purpose accounted for.

It can reconstruct possibilities.

It can preserve knowledge.

It can learn from the protagonist’s expeditions.

But it does not necessarily understand what constitutes an acceptable future.

The Heart should gradually change as the player progresses.

Examples include:

- Previously corrupted areas becoming partially restored.
- Changes to Sanctuary.
- New encounter types becoming possible.
- The Heart preserving unexpected discoveries.
- Reconstructions behaving in ways Elara has never witnessed.
- New possibilities becoming available after successful expeditions.

The Heart must not be casually rewritten as an evil machine or a manipulative final boss.

A later conflict with the Heart could arise from incomplete instructions, incompatible goals, or difficult choices without making its original purpose malicious.

#### Central thematic question

> Can a system created to preserve a world learn that saving its people may require allowing that world to become something new?

### 5.3 The Haze

The Haze is the unstable reconstructed world through which the protagonist ventures.

It consists of fragments of places, histories, memories, and possibilities.

A familiar environment may recur with different encounters or altered meaning.

The Haze should not simply be generic purple corruption.

It should feel mysterious, sometimes beautiful, sometimes unsettling, and occasionally contradictory.

Its inhabitants may remember conflicting versions of events.

Some places may contain evidence of previous reconstructions.

An early discovery may gain a completely different meaning after the player recovers later information.

This premise provides the narrative justification for replayable expeditions without requiring substantial geographical expansion.

### 5.4 The protagonist

At the beginning, the protagonist awakens in Sanctuary without a clear understanding of his identity.

He believes he has been brought back to continue an important mission.

He initially understands himself as the original hero or anchor connected to the Heart.

The long-term revelation is that he is an Echo: a reconstructed consciousness connected to the original anchor.

He is not necessarily merely a disposable copy.

Through repeated expeditions, relationships, decisions, and discoveries, he develops an independent identity.

The gameplay reinforces this theme.

His abilities may change between reconstructions, but his accumulated knowledge and experiences persist.

The question gradually shifts from:

> “How do I fulfill the mission I was created for?”

to:

> “Who am I, and what future do I choose to help create?”

Do not reveal the Echo truth in the opening or early tutorial.

It should emerge through conflicting evidence, character interactions, and accumulated discoveries.

Do not establish that every failed run creates another permanently abandoned, suffering consciousness unless that is deliberately developed as a major plot point. That interpretation would create significant narrative consequences and is not currently canon.

### 5.5 The original anchor and the Spark

The original anchor was connected to the creation or operation of the Heart.

He may have volunteered to become part of the kingdom’s preservation system.

The Spark remains central to the Heart’s original mission and the protagonist’s early objective.

The relationship between the original anchor, the Spark, and the Heart should be revealed gradually.

One promising direction is that the original consciousness has been resisting the Heart’s attempts at restoration because he understands something the Heart does not.

That is a potential long-term revelation, not a requirement to disclose or fully settle during the first story implementation.

Preserve room for nuance.

### 5.6 Elara

Elara is the protagonist’s guide and one of the emotional centers of the narrative.

She is associated with Sanctuary and the Heart’s reconstruction process.

Initially, she provides reassurance, context, and guidance.

She should feel like a person rather than a tutorial interface.

Her relationship with the protagonist should become more complicated as the story develops.

She knows more than she initially reveals.

A major proposed revelation is that she has participated in suppressing or erasing memories because she believes doing so is necessary for the Heart’s mission or the protagonist’s continued existence.

Her motivations should be sympathetic and understandable, even when her actions are questionable.

Do not make her a simplistic traitor.

Ideally, the player should be able to revisit early dialogue after major revelations and hear it differently.

Elara’s visual identity, voice, personality, and recurring dialogue are important creative assets. Preserve consistency once established.

---

## 6. Narrative Structure: Why Winning Does Not End the Game

FITBOUND is a roguelite.

Its story must accommodate repeated successful expeditions, not merely repeated deaths.

A successful run should produce a real achievement.

However, reaching the Spark or defeating an important guardian does not permanently resolve the corruption.

The Heart can discover a way to restore or stabilize part of the kingdom without discovering a lasting solution for the entire world.

The first major victory should demonstrate that success is possible.

The protagonist reaches the Spark.

The Haze recedes.

Part of the world is restored.

Sanctuary and its inhabitants respond.

The player experiences an authentic accomplishment.

Then the story reveals that the restoration is incomplete or unstable.

Further expeditions are necessary to understand why the solution does not last.

Victory reveals the larger problem. It does not invalidate the victory.

### Suggested long-form progression

#### Act I — Reach the Spark

Introduce the Heart, Sanctuary, Elara, the Haze, and the reconstruction cycle.

The protagonist’s apparent mission is to reach the Spark and defeat the corruption.

The first successful expedition achieves meaningful partial restoration.

#### Act II — Understand the reconstruction

Subsequent expeditions reveal:

- Conflicting histories of the catastrophe.
- The original anchor’s role.
- Elara’s incomplete explanations.
- The existence and significance of Echoes.
- The Heart’s changing attempts to find a solution.
- Why earlier restorations failed or proved insufficient.

#### Act III — Determine what salvation means

The protagonist eventually learns enough to question the Heart’s original definition of success.

Preserving the original kingdom exactly may conflict with preserving the independent people and identities that now exist.

The central mystery should culminate in a meaningful choice or resolution rather than an arbitrary final battle.

The precise endings are not yet locked.

Earlier possible directions include:

- Continuing as a guardian of the Heart.
- Freeing or rescuing those dependent on its reconstruction system.
- Establishing a form of shared continuity in which the reconstructed world and its inhabitants can develop independently.

These should remain thematic possibilities rather than predetermined good, bad, and true endings.

---

## 7. Postgame Narrative

The central story should eventually have a genuine conclusion.

However, the protagonist should retain a reason to undertake expeditions after that conclusion.

One promising direction:

The Heart and protagonist establish a more sustainable future for Sanctuary, but fragments of the lost kingdom remain beyond its reach.

The protagonist can voluntarily venture into the remaining Haze to recover people, memories, and possibilities.

The loop changes from an obligation into a choice.

This provides a natural long-term premise for additional characters, encounters, bosses, blessings, and exercise types without repeatedly undoing the player’s achievements.

The game should not depend on endless new story revelations to remain enjoyable.

The narrative provides meaning.

Replayable combat, builds, mastery, and fitness provide longevity.

---

## 8. Art, Presentation, and Tone

### Art direction

The preferred visual direction is a charming, handcrafted fantasy diorama.

General qualities:

- Miniature-world presentation.
- Warm and readable lighting.
- Distinct silhouettes.
- Expressive small environments.
- Magical atmospheric effects.
- A contrast between comforting Sanctuary spaces and mysterious Haze environments.

The general appeal of compact, tactile fantasy diorama games is relevant, but do not copy another game’s characters, environments, or proprietary visual identity.

The game should feel visually cohesive across exploration, combat, menus, and cutscenes.

Avoid replacing the current successful art direction merely because new assets or techniques become available.

### Narrative tone

The story should be mysterious, emotionally grounded, and hopeful without being simplistic.

Balance:

- Wonder.
- Melancholy.
- Discovery.
- Occasional humor.
- Recurring character relationships.
- Genuine accomplishment.

Avoid excessive exposition.

Not every encounter must reveal a world-changing secret.

Small, memorable character moments are important.

### Cutscenes

Prefer scripted in-engine cinematics using the existing visual style.

A full animated movie is not required.

Camera movement, character staging, particles, dialogue portraits, music, and environmental effects can create effective scenes.

The opening should be relatively brief and establish emotional intrigue rather than explaining the entire cosmology.

A promising opening structure:

- Darkness and a faint heartbeat.
- Glimpses of the ruined kingdom.
- The Heart activates.
- The protagonist awakens in Sanctuary.
- Elara greets him.
- The distant Spark is revealed.
- The player receives control.

The reconstruction sequence should also become a recognizable recurring ritual after expeditions.

Later versions can be shortened, varied, and skippable.

---

## 9. Core Roguelite Structure

FITBOUND is primarily an encounter-driven roguelite, not an exploration-heavy RPG.

A run should contain a combination of:

- Combat.
- Temporary blessings.
- Meaningful choices.
- Character encounters.
- Recovered information.
- Occasional unusual challenges.
- Recovery.
- A final encounter.
- Persistent progression.

The encounter library should be reusable and expandable.

The player should sometimes encounter familiar locations or characters under different circumstances.

Avoid making all variation depend on randomized dungeon layouts.

### Procedural generation priorities

Prioritize randomization in this approximate order:

1. Exercise loadouts.
2. Magical abilities and temporary blessings.
3. Encounter selection and combinations.
4. Enemy behavior and tactical situations.
5. Narrative opportunities and optional discoveries.
6. Limited route variation.

Large-scale procedural geography is not a priority.

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

The Mirror may acquire new narrative meaning as the protagonist learns more about Echoes and the original anchor.

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

## 17. RPG Failure Versus Fitness Completion

These are separate systems.

### RPG failure

The protagonist loses the expedition when HP reaches zero through combat.

HP damage should arise primarily from:

- Missed defensive responses.
- Tactical mistakes.
- Enemy abilities.
- Combat-specific consequences.

### Fitness completion

The player can achieve a worthwhile workout regardless of RPG victory.

Track:

- Verified repetitions.
- Hold duration.
- Exercise-specific volume.
- Left/right work when applicable.
- Actual physical activity.
- Session duration.
- Recent sessions.
- Player feedback.

Fitness history should never be erased by losing a run.

### Fatigue and recovery

If the player is physically tired, allow:

- Rest.
- Partial-set completion.
- Appropriate substitution.
- Voluntary termination.

Do not convert exhaustion into automatic HP loss.

Do not impose exercise time limits in ordinary turn-based combat.

---

## 18. Expedition Duration and Pacing

The initial target is:

**Full expedition:** approximately 20–25 minutes.

A **Short expedition** is also desirable, approximately 12–15 minutes.

These are design targets to validate through physical playtesting, not rigid timers.

A standard expedition should deliver a worthwhile amount of exercise while leaving room for tactical decisions, narrative, and recovery.

Do not count the entirety of combat time as continuous aerobic activity.

Measure verified movement separately.

### Proposed pacing structure

A full expedition may contain approximately three resumable phases:

#### Phase I — The Approach

Early encounters, first blessings, introductory narrative opportunities.

#### Phase II — Into the Haze

More developed combat situations, unusual encounters, meaningful choices, and recovery.

#### Phase III — The Spark

Final encounter, expedition outcome, and return to Sanctuary.

The exact encounter count and phase timing should be adjusted using real-person playtest results.

### Resumability

The player should be able to suspend an expedition and resume later.

A voluntary suspension is not the same as undoing combat defeat.

If returning after a substantial break, offer appropriate preparation before immediately demanding physical activity.

---

## 19. Workout Director

FITBOUND should eventually coordinate physical workload across the entire expedition.

It should consider:

- The selected exercise loadout.
- Comfortable exercise targets.
- Completed work during the current run.
- Recent exercise history.
- Recovery and readiness.
- Encounter selection.
- Remaining planned workout volume.

The purpose is not to build an elaborate fitness coaching AI.

A simple, transparent system is sufficient.

The Workout Director should prevent avoidable situations such as demanding repeated heavy push-up sets after the player has already completed an appropriate amount of upper-body pushing work.

Physical progression should be gradual.

A change in RPG difficulty should not silently change the player’s exercise prescription.

---

## 20. Havens and Recovery

Havens provide deliberate changes of pace.

They can include gentle yoga, stretching, and mobility sequences.

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

It becomes available after the player’s first successful expedition.

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

**Status: navigation method TBD.** After the next physical playtest, the creator will decide between marching navigation, hybrid navigation, or primarily controller-driven navigation. Marching adds physical activity; controller navigation may better serve future exploration options.

The current build marches between expedition encounters by default. Controller traversal is available from the pause menu, and it is not counted as physical activity. Keep both paths working until this is decided, and do not build features that only work with one of them.

The creator is increasingly comfortable treating controller movement as the primary exploration method and using camera controls mainly for exercise and defensive combat.

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

*Maintained by Claude at the end of each development pass. Last updated: 2026-09-25.*

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

- **Marching between encounters.** Each encounter stands at its own spot on the diorama trail, and the player marches in place to reach it. Each leg opens with a short story line. A Mossy Shrine detour heals once per run. Steps are tallied in the workout summary, separate from sets. Controller traversal remains available from the pause menu and is not counted as activity (see §27: the navigation method is still TBD).
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
  - **The opening:** darkness and rain, then the heartbeat; illustrated memory fragments of the kingdom; the Heart's cavern, where the rain is muffled; the rainy Sanctuary, where the hero forms on the stone and Elara waits by the well; and the distant Spark.
  - **Presentation:** player-paced dialogue; no synthetic voice for Elara anywhere in the game; line ids ready for recorded voice.
  - **Playback:** the opening plays once, can be skipped, and can be replayed from the title screen.
  - **The ritual:** about 10 s, skippable, with a context-sensitive line from Elara.
  - **Rain motif:** the Sanctuary rains until the first restoration, then is dry and sunlit. This is not explained on screen.

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

Validation to date:

- **Automated:** 326 passing unit tests. These include the new detectors, soreness, progression, the Journal, the lag measurement, the refined hero's faces and fallback, the cinematic runner, the opening's agreed lines and staging rules, the ritual's length and lines, and story progress in the save.
- **Headless browser:** the full opening (every line in order), the ritual on the next launch (the opening does not repeat), skip, the Sanctuary screen over the garden, and the dry garden after restoration. Screenshots were reviewed; the visuals are a first version for the creator to evaluate.
- **Headless browser runs through the local relay with a scripted synthetic body:**
  - a full standard expedition (19 sets, all march legs, the shrine detour, and victory);
  - a short expedition;
  - the tutorial trial.

These are implementation milestones, not proof that every movement and interaction works reliably with the creator’s real body and hardware.

The next task is to collect physical playtest observations and refine the integrated experience. The README’s *Physical playtest checklist* lists what to try.

---

## 33. Development Roadmap

This roadmap describes priorities, not an inflexible production schedule.

### Milestone A — Validate expanded combat

Physically test:

- New exercises.
- Voice commands.
- Partial sets.
- Dodging.
- Random loadouts.
- Combat tactics.
- Blessings.
- Mirror.
- Haven.
- Short and full expedition pacing.

Fix meaningful friction based on consolidated feedback.

### Milestone B — First complete narrative adventure

Implement:

- Elara’s opening cutscene.
- Sanctuary as a narrative home.
- The Heart’s reconstruction ritual.
- A cohesive first expedition.
- Meaningful NPC encounters.
- Interconnected story fragments.
- A memorable first major victory.
- Real partial restoration.
- The revelation that the Heart’s solution is incomplete.
- Repeatable expeditions with additional discoveries.

The opening story implementation should foreshadow the larger mystery without exhausting it.

### Milestone C — Hazy Chaos and Punch Away

Add the timed circuit encounter and patterned punching opportunity.

Ensure that both fit the established workout budget and respect physical readiness.

### Milestone D — The Unbound

Implement the recurring rhythm-combat rival.

Validate punch recognition, guard recovery, timing, and defensive movements.

Introduce Break the Rhythm as an expedition reward.

### Milestone E — The Unbound Gauntlet

Build the dedicated rhythm-conditioning mode using the proven movement and sequence systems.

### Milestone F — Deeper narrative and postgame

Expand the Heart’s mystery through additional characters, discoveries, and evolving Sanctuary states.

Preserve reasons for repeated expeditions after the central narrative reaches a satisfying resolution.

Future expansions should favor meaningful new gameplay and story experiences over gratuitous world size.

---

## 34. Open Questions

The following matters should not be silently treated as fully settled canon or final mechanical specifications.

They should be resolved through implementation and playtesting.

### Narrative

- The exact origin and nature of the corruption.
- The original anchor’s complete history.
- The Spark’s precise relationship to the Heart.
- What Elara knows and when she learned it.
- The ultimate fate of the Heart.
- The exact final narrative choices.
- Whether and how the protagonist can establish independent existence.
- The ultimate status of other Echoes.

### Gameplay

- Final exercise targets and progression rates. A first set of rules exists (§32); tune them after a few weeks of real sessions.
- How sets per session should scale (currently fixed by route), which belongs to the Workout Director (§19).
- Whether straight punches read reliably, facing the phone or side-on (the Lab punch test), before Punch Away and the Unbound are designed around them.
- Precise full-run encounter count.
- Final HP, damage, and cooldown balance.
- Ideal timing windows for dodging.
- How frequently unusual encounters appear.
- Which exercise detectors are reliable in the creator’s rooms.
- Hazy Chaos circuit duration and time limits.
- Punch Away combination length and damage balance.
- The Unbound’s final rhythmic movement vocabulary.
- Gauntlet round lengths and difficulty progression.
- Navigation between encounters: marching, hybrid, or primarily controller (§27).

### Presentation

- Elara’s finalized visual identity. A first version exists (§32); it is open to refinement.
- The protagonist’s final character design. A refined first version exists (§32); it is open to refinement.
- Character voice casting and production.
- Exact cutscene scripts.
- Final soundtrack and audio direction.

Claude may propose solutions to these questions, but should not overwrite settled principles or present speculative lore as established fact.

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
