# FITBOUND

A mobile-first pixel-art fantasy RPG you play with real bodyweight exercises. Your phone's camera watches you through MediaPipe Pose, and every counted repetition becomes an attack, a shield or a spell.

## Motion Trial (TV-first playtest)

The main mode. **The phone stays in one place, you are the controller, and the TV is the screen.**

1. Place the phone once (see *Phone placement*), mirror it to your TV, tap **Motion Trial · TV → Start**. After that tap you don't need to touch the phone.
2. **Calibration** runs hands-free: full body in view → both hands up (checks there's room) → stand still (records your neutral pose) → raise right hand (confirm test) → march in place → lean left → lean right → **floor check** (get into push-up position sideways; left hand skips it) → stand back up.
3. **Part 1: exploration** on a tabletop-diorama meadow. March to the banner, steer to the training dummy and strike it (right hand), then read the signpost and accept the trial (right hand).
4. **Part 2: combat.** Walk up to each guardian: Skeleton (push-ups), Stone Golem (squats), Shadow Mage (jumping jacks), then the Dungeon Warden (push-ups → squats → jumping jacks). After each guardian, pick a reward by leaning and raising your right hand.
5. A summary shows camera-verified reps per exercise, marching steps, gestures used and tracking losses.

### Body controls

| Action | Where | How it's detected |
|---|---|---|
| **March in place → walk** | Exploration | Alternating difference in the height of the two knees and feet (normalised by thigh length). Both legs moving together (jumps, squats, bobbing, stepping toward the camera) cancels out and never registers. It takes two alternating steps to start and stops 0.9 s after the last step. |
| **Lean → turn** | Exploration | Torso angle (hip-centre → shoulder-centre) relative to your calibrated neutral, with a 5° dead zone, smoothing, and full turn at 16°. The hero walks where it faces ("tank" steering), which needs only one body axis and stays predictable from a fixed camera. |
| **Raise RIGHT hand → confirm / interact** | Exploration, menus | Wrist above your nose, held 0.45 s. Hands must come down before the next gesture. |
| **Raise LEFT hand → back / more rest / skip** | Menus, between sets | Same, left side. |
| **Both hands up → pause** | Exploration, menus | Held 0.8 s. |
| **Lean left/right → move selection** | Menus | Discrete lean with hysteresis; holding repeats every 0.9 s. |

Left and right are your *anatomical* sides, so the controls are correct whether or not the camera mirrors. Keyboard equivalents for desktop testing: ↑/W march, ←/→ turn, Enter confirm, Esc back, P pause.

### Input modes

`src/input/InputHub.ts` decides what counts at any moment:

- **calibration**: motion is read for the setup checklist.
- **explore**: march/lean move the hero; confirm, back and pause gestures fire.
- **menu**: lean moves the selection; confirm, back and pause gestures fire; marching moves nothing.
- **exercise**: *all motion input is off.* Only the active exercise detector sees frames, so a jumping jack can't pause the game and a squat can't walk the hero. Pause during a set is by keyboard/touch only, because "both hands up" is part of a jumping jack.

Every mode change resets motion history and disarms gestures, so hands still raised from the last exercise must come down before they count.

### Battles in the trial

Hands-free. Each guardian has a plan of sets. For each set: a **Next exercise** card (with spoken cue) tells you how to face the phone and gives a 5–8 s rest (right hand = start now, left hand = more rest). The camera then waits until you're in the start position, counts down 3-2-1, and counts reps. When the set completes, the enemy responds and the next phase starts automatically. The trial never ends in a knockout.

Rep targets default to **5 push-ups, 10 squats, 10 jumping jacks, and a 3/6/8 boss**. Change them in *Trial settings* on the setup screen, or with a URL parameter such as `?reps=pushup:3,squat:5,jumping_jack:5,bossPushup:2,bossSquat:3,bossJack:4`.

Audio cues: exercise start chord, a rep blip that climbs in pitch, set-complete fanfare, next-exercise chime and spoken instruction, a tracking-lost warning plus spoken "step back into view", victory and defeat stings. Sound and voice toggles are on the setup screen and in the classic Menu.

### Phone placement (one position for everything)

- **Landscape**, on something steady at about **knee height** (low shelf, chair, stack of books), **2.5–3 m** from where you stand, on a clear floor.
- Standing exploration, squats and jumping jacks: **face** the phone.
- Push-ups: stay where you are, **turn sideways** to the phone and get down. Your body then lies across the frame in profile, which is what the push-up detector needs.
- Knee height is a compromise: high enough to see you standing head-to-feet with hands raised, low enough that a body on the floor isn't hidden or foreshortened. The calibration floor check tests exactly this.
- Optional: *Trial settings → Camera → Back* uses the rear camera (usually wider and sharper); point the back of the phone at yourself and watch the TV.

**Known limit of a single placement:** if the floor check fails, push-ups probably won't track from that spot. The trial warns you, and after 20 s without progress a *Count manually* touch fallback appears, clearly labelled as not camera-verified. Moving the phone lower or farther away usually fixes it. This has not been verified with a real body on a real phone (see *Testing done*).

### Diorama look

The trial and all battles now use a toy-miniature style, painted procedurally at runtime with no external assets:

- **Figures:** glossy chibi figurines on round painted bases (hero, skeleton, stone golem, shadow mage, warden, training dummy).
- **World:** a felt-flocked meadow board with a cut-away soil edge sitting on a wooden table. It has a dirt trail, a pond with lily pads, a cottage, a campfire and a flagstone arena.
- **Props:** shaded trees, pines, bushes, rocks, mushrooms and crystals, each with a soft contact shadow.
- **Tilt-shift cues:** a warm haze at the top of the screen, darker foreground, and a vignette.
- **Battles:** a round tabletop stage in front of a soft-focus backdrop.

Everything is laid out for landscape 16:9. Text and numbers are sized relative to screen height (body ≥3.4% of height, the rep counter about 24%) so they stay readable when mirrored to a TV. The classic village/dungeon keeps its pixel-art style.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (desktop; the camera works on localhost)
npm test             # 96 automated tests
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build
```

Node 20+ is recommended (developed on Node 22). `npm run dev`/`build` first copy MediaPipe's WASM runtime from `node_modules` into `public/mediapipe/`. The pose models (`public/models/*.task`) and the pixel font are committed.

**Privacy:** camera frames are processed on the device and never stored or sent anywhere. MediaPipe's library also has built-in usage telemetry (task type, timings; no images or landmarks) that it posts to Google every minute and that can't be switched off. Production builds block it with a `connect-src 'self'` Content-Security-Policy (a meta tag, plus a header on Vercel), so the app makes no third-party requests. This was verified in a browser: the pose model runs and the telemetry POST is refused. `npm run dev` omits the policy so hot reload works.

## Play on an iPhone + TV

Browsers only allow the camera on secure (HTTPS) origins, so plain `http://<your-ip>:5173` will not work on a phone. Pick one of these:

1. **Deploy (recommended).** Import this repository into Vercel (Add New → Project → `asadk26/Fitbound`, default settings). `vercel.json` sets the build command (`npm run build`) and output (`dist`). Open the HTTPS URL in Safari.
2. **Local HTTPS.** Run `npm run dev:https`, then on the iPhone (same Wi-Fi) open `https://<your-computer-ip>:5173`. Safari will warn about the self-signed certificate; choose *Show Details → visit this website*.
3. **Tunnel.** Run `npm run dev` plus any HTTPS tunnel (e.g. `cloudflared tunnel --url http://localhost:5173`).

Tip: in Safari use *Share → Add to Home Screen* for a full-screen, app-like experience.

**TV:** turn the phone to landscape, open Control Centre → **Screen Mirroring** → your Apple TV / AirPlay TV. Then place the phone (see *Phone placement*) and tap **Motion Trial · TV → Start**. Keep the phone plugged in if you can: the camera and pose model run continuously during the trial.

## Classic adventure (touch)

The original portrait, touch-driven adventure is still available from the title screen (*Classic adventure*).

1. Create a hero and choose Beginner, Intermediate or Advanced (you can change this any time in Menu).
2. Tap to walk around Maplebrook village and tap people to talk. **Coach Ilse** runs the training dummy, the best place to find a good phone position before the dungeon.
3. Walk north into the cave (the Hollow Deep). Stepping next to a monster starts a battle.
4. Pick an ability. The camera view opens with positioning steps; once it sees you in the start position, it counts down 3-2-1 and starts counting reps. Each rep animates an attack, damage number and sound, and effects get bigger as the set nears completion. Finishing the set adds a finisher.
5. Beat the Skeleton, Stone Golem and Shadow Mage to open the gate, then beat the Dungeon Warden. Each of its three phases needs a different exercise, with a 15-second repositioning break between phases.
6. Gain XP and gold. **Level 2 unlocks Iron Bulwark (plank)**. Spend gold with Bruna the Smith on stat upgrades. Progress saves automatically.

Combat notes: switching exercises between sets gives a ×1.25 **combo**. The Golem telegraphs a big slam, so raise a shield first. The Mage's *Shadow Veil* weakens whichever exercise you used last. Damage per *set* is the same at every fitness level: difficulty changes your workout, not your power. Losing a battle costs nothing, and retreating is always allowed.

## Camera positions (classic mode)

The classic mode lets you reposition the phone per exercise; the Motion Trial uses the single placement described above.

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
src/input/      motion controls (march / lean / gestures, calibration) and the InputHub mode switch
src/trial/      Motion Trial config: rep targets, encounter plans, rewards
src/testing/    synthetic pose generators shared by tests and the ?debug browser hook
src/exercise/   detectors (pure TS), registry (data-driven), session controller (setup → countdown → active → complete)
src/pose/       camera + MediaPipe PoseLandmarker (GPU with CPU fallback), frame conversion
src/combat/     CombatEngine (pure rules → CombatEffects), enemies & boss phases
src/game/       progression, save (localStorage, validated), store, audio (WebAudio synth + speech), event bus
src/phaser/     diorama/ painted figurines, props, board and battle stages; pixel art & tiles for classic;
                Boot / Diorama (trial) / World (classic) / Battle scenes
src/ui/         React UI: TrialRun, Calibration, AutoBattle, gesture menus & motion HUD (TV); classic battle, dialogs, loadout
src/lab/        Detector Lab
```

Saved automatically: level/XP, gold, upgrades, unlocked and equipped abilities, defeated enemies, dungeon clears, location, settings and lifetime totals. **Menu → Reset save** wipes everything.

## Testing done

- **Automated (`npm test`, 96 passing):**
  - Exercise state machines on synthetic landmark sequences: one count per valid rep (push-up, squat front and side view, jumping jack), partial reps, holding the bottom, noise, tracking loss, low confidence, standing arm curls, hip hinges, too-fast reps, plank pauses.
  - Motion controls (new): idle standing never marches (with noise); deliberate marching starts within ~1 s and stops when you stop; jumping, bobbing, stepping toward the camera and jumping jacks never march; lean steering has a dead zone, doesn't jitter with sway or noise, holds direction with hysteresis and respects a calibrated neutral; right hand confirms once per raise; quick flicks don't count; left hand = back; both = pause; hands already up when reading starts don't fire; a hand raised right after calibration still confirms.
  - Input modes (new): exercise mode ignores all motion (no movement, no gestures, even through marching, hand raises and jumping jacks); menu mode never moves; raised arms carried over from an exercise don't confirm in the next menu; keyboard follows the same rules.
  - Exercise transitions (new): each detector counts nothing during the other exercises; a new push-up set awards nothing while the player stands, marches, gets down or waits out the countdown.
  - Trial rules (new): finishing each guardian's planned sets wins; stopping halfway doesn't; boss order; URL rep overrides.
  - Combat, session → combat events, save/load, maps and sprites (as before).
- **Browser automation (headless Chromium, 1280×720 "TV" and 844×390 phone landscape).** A synthetic body drives the real app through the tracker's test hook (only enabled with `?debug`). It completed the whole Motion Trial with no screen touches after *Start*:
  - calibration, including the floor check
  - marching and leaning (an autopilot steers by leaning toward each objective)
  - striking the dummy and accepting the trial by raising the right hand
  - all four battles, counted from simulated reps by the real detectors
  - a reward choice by gesture, and the summary

  The classic touch adventure was re-run end to end and still works. The real MediaPipe path was also exercised with Chromium's fake camera: the model loads and runs, and correctly sees no body in the test pattern.
- **Not done: real bodies and real devices.** Nothing here has been run on an iPhone, mirrored to a TV, or used by a person in front of a camera. Motion controls and rep counting are validated only against synthetic landmarks, which are cleaner than MediaPipe's output on a real person. Expect to tune thresholds (they're in `MOTION_DEFAULTS` and each detector's config) during the first physical playtest. The Detector Lab (`/lab.html`) shows the underlying numbers live.

## Known limitations

- **Single camera placement** is plausible but unproven: push-ups are the weak point (a body lying on the floor, seen side-on from ~3 m). The floor check and the manual fallback exist for this reason.
- Marching detection uses leg-height differences; a very gentle "heel-lift" march may fall under the 0.12 threshold. Lower `stepThreshold` in `MOTION_DEFAULTS` if so.
- Pause during an exercise set is touch/keyboard only (both-hands-up is part of a jumping jack).
- The camera runs continuously during the trial: expect battery drain and warmth; keep the phone on a charger.
- AirPlay mirroring adds some latency to what you see on the TV; counting happens on the phone and isn't affected.

- **Unverified on real devices:** see above. Push-up tracking of a body lying horizontally is the most likely to need tuning, because pose models are trained mostly on upright people.
- **iOS Safari:** the camera needs HTTPS. The first spoken cue and audio need a tap first (handled on the first tap). Screen wake-lock needs iOS 16.4+. Keep the page in the foreground, since Safari pauses the camera in the background. Performance on older iPhones may need the *Fast* tracking model (Menu).
- Front camera only (so you can see yourself). Rear-camera support is not implemented.
- Reverse lunges and mountain climbers have no detectors yet.
- The game does not judge exercise form and makes no medical claims.
- One dungeon, with a "patrol again" option afterwards. Content scope is prototype-sized.
