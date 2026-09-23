# FITBOUND

A mobile-first pixel-art fantasy RPG you play with real bodyweight exercises. Your phone's camera watches you through MediaPipe Pose, and every counted repetition becomes an attack, a shield or a spell.

> **Repository note.** This project lives on the orphan branch `claude/fitbound-fitness-rpg-14fzez` of `asadk26/The_Town`. It shares no history or files with The Town, and nothing here touches `main` or the Pages deploy. To move it into its own repository, create an empty repo and run
> `git push <new-remote> claude/fitbound-fitness-rpg-14fzez:main`.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (desktop; the camera works on localhost)
npm test             # 61 automated tests
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build
```

Node 20+ is recommended (developed on Node 22). `npm run dev`/`build` first copy MediaPipe's WASM runtime from `node_modules` into `public/mediapipe/`. The pose models (`public/models/*.task`) and the pixel font are committed, so the app makes **no third-party network requests** at runtime.

## Play on an iPhone

Browsers only allow the camera on secure (HTTPS) origins, so plain `http://<your-ip>:5173` will not work on a phone. Pick one of these:

1. **Deploy (recommended).** Import the repo/branch into Vercel. `vercel.json` sets the build command (`npm run build`) and output (`dist`). Open the HTTPS URL in Safari.
2. **Local HTTPS.** Run `npm run dev:https`, then on the iPhone (same Wi-Fi) open `https://<your-computer-ip>:5173`. Safari will warn about the self-signed certificate; choose *Show Details → visit this website*.
3. **Tunnel.** Run `npm run dev` plus any HTTPS tunnel (e.g. `cloudflared tunnel --url http://localhost:5173`).

Tip: in Safari use *Share → Add to Home Screen* for a full-screen, app-like experience.

## How to play

1. Create a hero and choose Beginner, Intermediate or Advanced (you can change this any time in Menu).
2. Tap to walk around Maplebrook village and tap people to talk. **Coach Ilse** runs the training dummy, the best place to find a good phone position before the dungeon.
3. Walk north into the cave (the Hollow Deep). Stepping next to a monster starts a battle.
4. Pick an ability. The camera view opens with positioning steps; once it sees you in the start position, it counts down 3-2-1 and starts counting reps. Each rep animates an attack, damage number and sound, and effects get bigger as the set nears completion. Finishing the set adds a finisher.
5. Beat the Skeleton, Stone Golem and Shadow Mage to open the gate, then beat the Dungeon Warden. Each of its three phases needs a different exercise, with a 15-second repositioning break between phases.
6. Gain XP and gold. **Level 2 unlocks Iron Bulwark (plank)**. Spend gold with Bruna the Smith on stat upgrades. Progress saves automatically.

Combat notes: switching exercises between sets gives a ×1.25 **combo**. The Golem telegraphs a big slam, so raise a shield first. The Mage's *Shadow Veil* weakens whichever exercise you used last. Damage per *set* is the same at every fitness level: difficulty changes your workout, not your power. Losing a battle costs nothing, and retreating is always allowed.

## Camera positions

| Exercise | View | Phone placement |
|---|---|---|
| Push-ups | **Side** | On the floor or a low shelf, ~2 m to your side, ideally landscape. Head, arms and hips visible. |
| Plank | **Side** | Same as push-ups; shoulders to ankles visible. |
| Squats | **Front** (side also works) | Waist height, 2–3 m away, whole body head-to-feet in view. |
| Jumping jacks | **Front** | 2.5–3 m away, whole body *including raised hands* in view. |

The camera view shows the live feed (mirrored) with the detected skeleton, a tracking indicator (Tracking / Weak / Lost plus a confidence meter), and plain-language cues such as *Move farther from the camera*, *Your legs are not visible*, *Turn sideways for push-ups*, *Stand fully upright to begin* and *Camera tracking lost*. Optional spoken cues count reps aloud and announce the next exercise.

If detection keeps failing (12 s stuck in setup, 15 s without a counted rep, 3 tracking losses, or no camera at all), a clearly labelled **Count manually** button appears. Manual reps are tagged `source: 'manual'` in the event system. They show a *MANUAL COUNT · not camera-verified* badge, the victory screen reports camera-verified and manual reps separately, and a set with any manual rep is never reported as camera-verified.

## Exercises

| Exercise | Ability | Camera detector | Status |
|---|---|---|---|
| Push-ups | Sword Slash | ✅ `PushupDetector` | Starting ability |
| Squats | Shield Stance | ✅ `SquatDetector` | Starting ability |
| Jumping jacks | Arcane Burst | ✅ `JumpingJackDetector` | Starting ability |
| Plank (hold) | Iron Bulwark | ✅ `PlankDetector` | Unlocks at Lv 2 |
| Reverse lunges | Gale Step | ❌ none yet | Unlocks at Lv 3, **cannot be equipped** |
| Mountain climbers | Flurry Strikes | ❌ none yet | Unlocks at Lv 4, **cannot be equipped** |

Exercises without a detector are shown as *Camera detector in development*. They are never equipped and never routed to another exercise's detector.

### How detection works

Each detector is a state machine over MediaPipe landmarks, converted to isotropic image coordinates so angles are true angles:

- **Push-up:** elbow angle (shoulder–elbow–wrist) with hysteresis. `STARTING_POSITION → LOWERING → BOTTOM_POSITION → RISING → COMPLETED_REPETITION`. The torso must stay roughly horizontal, so arm bends while standing never count. Reps that don't reach the bottom are reported as partial with a *go lower* cue.
- **Squat:** *thigh rise* = vertical hip-to-knee distance ÷ standing thigh length (≈1 standing, ≈0 at parallel). This works from the front, where the 2D knee angle barely changes, and from the side. Bending over at the hips does not count.
- **Jumping jack:** a rep needs hands above the shoulders **and** feet apart at the same time, then back to closed. Arms-only or legs-only movements never count. Distances are normalised by body size.
- **Plank:** time accumulates only while the shoulder–hip–ankle line is straight and horizontal and supported on the arms. Breaking form pauses the clock without resetting it.

Common safeguards: confidence thresholds, EMA smoothing, minimum rep duration, stable-frame readiness checks, and a tracking-loss gate that tolerates brief dropouts but discards any half-finished rep after sustained loss. All thresholds are in per-exercise config objects with Beginner/Intermediate/Advanced variants.

### Detector Lab (`/lab.html`)

A companion page runs the real detectors against the **live camera** or a **recorded video** (analysed frame by frame, deterministic, never uploaded). It shows phase, tracking, confidence, raw metrics (elbow angle, thigh rise, arm lift, leg spread, body line) and a log of counted and ignored reps. Use it to check phone placement and tune thresholds on a real iPhone.

## Adding an exercise detector

1. Create `src/exercise/detectors/myExercise.ts` implementing `ExerciseDetector` from `src/exercise/types.ts`: `update(frame | null, now)` returns a `DetectorUpdate` with `repCompleted: true` on exactly one frame per rep (or `holdMs` for holds). Reuse `TrackingGate`, `StableCounter`, `Ema` and the geometry helpers.
2. Add synthetic-landmark tests in `tests/detectors.test.ts` (generators live in `tests/fixtures/poses.ts`): one full rep counts once, partial reps don't, holding the end position doesn't repeat, noise doesn't multi-count, and tracking loss awards nothing.
3. Set `createDetector` on the exercise's entry in `src/exercise/registry.ts` (or add a new entry with id, name, ability, targets, unlock level, camera instructions and animation). If you add a new `AbilityEffect`, handle it in `CombatEngine.handle`.

The combat engine only sees `ExerciseEvent`s (`rep`, `holdTick`, `setComplete`, `setEnded`), so it needs no changes for a new detector that reuses an existing effect.

## Architecture

```
src/exercise/   detectors (pure TS), registry (data-driven), session controller (setup → countdown → active → complete)
src/pose/       camera + MediaPipe PoseLandmarker (GPU with CPU fallback), frame conversion
src/combat/     CombatEngine (pure rules → CombatEffects), enemies & boss phases
src/game/       progression, save (localStorage, validated), store, audio (WebAudio synth + speech), event bus
src/phaser/     procedural pixel art & tiles, maps, Boot/World/Battle scenes
src/ui/         React UI: battle orchestration, camera panel, dialogs, loadout, settings
src/lab/        Detector Lab
```

Saved automatically: level/XP, gold, upgrades, unlocked and equipped abilities, defeated enemies, dungeon clears, location, settings and lifetime totals. **Menu → Reset save** wipes everything.

## Testing done

- **Automated (`npm test`, 61 passing):** detector state machines on synthetic landmark sequences (full reps count once in front and side view, partial reps don't count, holding the bottom doesn't repeat, noisy data doesn't multi-count, tracking loss awards nothing, low confidence counts nothing, standing curls and hip hinges don't count, impossibly fast reps are ignored, plank pauses without resetting), session → combat integration (camera reps become damage, reps during the countdown are ignored, manual reps are tagged manual), combat rules (damage, finishers, shields, resistances, combos, boss phases, victory), save/load round-trip and corruption recovery, map reachability, and sprite validity.
- **Browser automation (headless Chromium, iPhone 13 portrait and landscape):** full playthrough from title → village → dungeon → all four fights → boss phase transitions → level-ups → Plank unlock → reload with progress intact. MediaPipe loads and runs on Chromium's fake camera, correctly reports *No body detected* and counts nothing. The camera-denied path falls back to manual counting.
- **Not done: real-body camera testing.** I had no camera or recorded footage of a person, so the detectors are only verified against synthetic landmarks. **Rep counting has not been validated on an iPhone or on real people.** Expect to tune thresholds with the Detector Lab.

## Known limitations

- **Unverified on real devices:** see above. Push-up tracking of a body lying horizontally is the most likely to need tuning, because pose models are trained mostly on upright people.
- **iOS Safari:** the camera needs HTTPS. The first spoken cue and audio need a tap first (handled on the first tap). Screen wake-lock needs iOS 16.4+. Keep the page in the foreground, since Safari pauses the camera in the background. Performance on older iPhones may need the *Fast* tracking model (Menu).
- Front camera only (so you can see yourself). Rear-camera support is not implemented.
- Reverse lunges and mountain climbers have no detectors yet.
- The game does not judge exercise form and makes no medical claims.
- One dungeon, with a "patrol again" option afterwards. Content scope is prototype-sized.
