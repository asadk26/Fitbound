# FITBOUND

A fantasy RPG you play with real bodyweight exercises. A phone camera watches you through MediaPipe Pose: marching walks your hero, a lean turns them, raised hands pick options, and every counted repetition becomes an attack, a shield or a spell.

There are three ways to play:

| Mode | Screen | Controller | When to use it |
|---|---|---|---|
| **Connected Play** (recommended) | A PC's browser, shown on the TV over HDMI | Your phone, propped up in one place, as a motion controller | Living-room play on a TV. No AirPlay lag. |
| **Motion Trial · phone only** | The phone (optionally mirrored to a TV) | The same phone's camera | No PC available. |
| **Classic adventure** | The phone, portrait | Touch, plus the camera for battles | The original touch RPG. |

All three share one input system, one combat engine, one progression system and one save.

## Connected Play

**The phone is the motion controller, the PC runs the game, and the TV shows the PC.** The phone runs the camera and all pose detection locally and sends only small, interpreted events ("turn left", "a squat rep"), never video, images or landmarks. The PC decides what those events are worth.

```
 phone (Safari/Chrome)                     PC                                     TV
 ┌───────────────────────┐   wss://LAN    ┌──────────────────────┐   HDMI  ┌─────────┐
 │ camera → MediaPipe    │  ───────────▶  │ relay (node, :8443)  │         │         │
 │ march / lean / hands  │  small JSON    │   ↕ ws://localhost   │         │  game   │
 │ exercise detectors    │  events only   │ game in the browser  │ ──────▶ │         │
 │ status dashboard      │  ◀───────────  │ (Phaser, combat,     │         │         │
 └───────────────────────┘  mode, set     │  saves, audio)       │         └─────────┘
                            progress      └──────────────────────┘
```

### Launch, connect, play

1. **On the PC** (Node 20+), in this folder:
   ```bash
   npm install
   npm run play            # builds, then starts the relay
   ```
   It prints two addresses: `http://localhost:8080` for the PC and `https://<PC-LAN-IP>:8443/controller.html` for the phone.
2. **TV:** connect the PC to the TV with HDMI and open **http://localhost:8080** in Chrome, Edge or Firefox on the PC. Press F11 for full screen. Turn the PC's sound on; the PC is the audio source.
3. Choose **Connected Play · PC + phone**. A QR code, the phone address and a 6-digit code appear.
4. **Phone** (same Wi-Fi as the PC): scan the QR code with the camera app and open it in Safari or Chrome. Alternatively, open the phone address and type the code.
   - The first time, the browser warns that the connection isn't private, because the PC uses its own certificate. On iPhone choose *Show Details → visit this website → Visit Website*. On Chrome choose *Advanced → Proceed*. See *Networking and HTTPS* to remove the warning.
5. Place the phone (see *Phone placement*), tap **Start camera** and allow camera access. The TV ticks off *Phone connected → Camera allowed → Pose tracking ready → The phone can see you*, then starts calibration by itself after 5 s (or click **Start calibration**).
6. From here it's hands-free. Calibration, exploration, dialogue, rewards and battles all run from your body, with instructions, voice and sound on the TV.

The phone shows a high-contrast status dashboard: connection, camera, tracking, the game's current mode, the current exercise and rep progress, and the last recognised move. The camera preview is shown only while setting up or when you're out of view, and repaints at 10 fps to save battery. **Touch controls** (turn, walk, interact, back, choose) and a **Pause** button are always available as a fallback.

### What each device does

| Phone (`controller.html`, no game rendering) | PC (`index.html`) |
|---|---|
| Camera and MediaPipe Pose Landmarker, locally | Phaser rendering, movement, collisions |
| March, lean and hand-gesture detection | Input-mode authority: tells the phone which detectors to run |
| Exercise rep detection (only the exercise the PC asked for) | Combat, HP, rewards, progression and saves |
| Calibration checks (the TV shows the same checklist) | Validates every controller message |
| Connection/tracking/mode/progress dashboard, touch fallback | Audio: music, effects and voice (the phone is silent by default) |

### How the phone and PC talk

`src/net/protocol.ts` defines every message and validates it field by field.

- **Phone → PC:** `MOVE_START {intensity}` (refreshed every 0.4 s while marching) and `MOVE_STOP`; `TURN_LEFT`, `TURN_RIGHT`, `NAV {dir}`, `INTERACT`, `BACK`, `PAUSE`, `STEP`; `CALIBRATION {step, progress, hint}`; `EXERCISE_STATUS {setId, stage, tracking, guidance…}`; `EXERCISE_REP {setId, exerciseId, index, source}`; `MANUAL_MODE`; `STATUS {camera, model, calibrated, tracking}`; `TELEMETRY` (display-only meters, 10 Hz); `HEARTBEAT` (1 Hz).
- **PC → phone:** `MODE {mode, epoch}`, `SETTINGS`, `EXERCISE_BEGIN/PROGRESS/CONTROL/END`, `GAME` (objective text for the dashboard), `ACK`.
- **Sequence numbers and epochs:** every phone message carries a sequence number that only increases, plus the *epoch* of the input mode it was produced in.

**The PC is authoritative.** `src/net/gate.ts` accepts a phone message only if:

1. it is well-formed, with unknown fields stripped;
2. it comes from the paired session;
3. its sequence number is new (duplicates and replays are dropped);
4. it fits the moment. Movement and turns are accepted only while exploring; menu navigation only in menus or dialogue; calibration updates only while calibrating; exercise events only during an exercise. Gestures and movement must also carry the current epoch, so an "interact" made while exploring can't pick a dialogue answer that opened a moment later. Pause and stop are always accepted.

Exercise reps are checked again by `src/net/remoteSet.ts`. A rep counts only if all of these hold:

- it is for the active set and the active exercise (a push-up rep during squats is ignored);
- it is newer than every rep already accepted, so resends after a reconnect are ignored;
- the set is live: not paused, not finished, and the phone reports it active;
- it is no faster than 0.3 s after the previous rep;
- it is marked manual only if manual counting was switched on.

Accepted reps become the same `ExerciseEvent`s that single-device play produces, so the combat engine and progression are unchanged. Reps are resent after a reconnect until the PC acknowledges them.

### Pairing and security

- The relay (`server/relay.mjs`) serves the PC page on **127.0.0.1 only**, and only a loopback client may create a game.
- The QR code carries a **128-bit single-use token that expires after 2 minutes**. It sits in the URL fragment, so it never reaches server logs, and the phone removes it from the address bar on arrival. The 6-digit code has the same lifetime.
- Wrong codes are limited to 5 a minute per device. An offer is withdrawn after 20 wrong guesses from anywhere, and the TV then shows a new one.
- **One controller per session.** A paired phone gets a session id and a secret resume key (kept in that browser tab) so it can reconnect after a Wi-Fi blip. *Pair a different phone* revokes it.
- WebSocket upgrades whose `Origin` isn't the relay's own page are refused, so other websites can't connect. Messages are capped at 16 KB, and floods are dropped.
- The pages' Content-Security-Policy allows network connections only to their own origin and relay socket. That also keeps blocking MediaPipe's built-in telemetry.
- Nothing is uploaded or stored: no video, frames or landmarks leave the phone. There are no accounts, cloud services or API keys.

### Discrete turning

Continuous "tank" steering was imprecise in the first playtest, so turning is now discrete:

- **One lean = exactly one turn**, 45° by default (8 directions) or 90° (4 directions) under *Controls → Turn per lean*.
- **Holding a lean never repeats.** The torso must come back inside the neutral band (4°) for 0.12 s to re-arm.
- A lean registers at 8° from your calibrated neutral. Low, Normal and High sensitivity use 11°, 8° and 6°.
- Smoothing, a 0.35 s cooldown, and disarming on tracking loss mean marching sway, posture noise and wobbles don't turn you. Smoothing is time-based, so a phone that only manages a few pose frames a second turns just as reliably.
- **You can turn while standing still.** The hero turns to face the new direction at once and walks straight along it, diagonals included.
- **Collisions work on the grid:** you slide round trees and rocks, even walking straight at one. Pushing into the fence right next to the open gateway steers you into the gap.
- The big rotating ground wheel is gone. A small chevron above the hero's head shows the facing direction.
- Menus use the same rule: one lean moves the highlight one step. Keyboard ←/→ is one turn per press.

### Marching

- It still takes two alternating steps to start moving, so a single weight shift never moves you. Jumping, bobbing, squatting or stepping toward the camera still never count.
- Changes, measured on synthetic data:
  - The step threshold dropped from 0.12 to 0.11 thigh-lengths. A knee lift about 20% smaller now registers (about 40% smaller on *High*).
  - Movement stops about 165 ms sooner after you stop.
  - The hero speeds up and slows down faster.
  - Smoothing is time-based.
- Speed follows your cadence between 55% and 100% of normal walking speed. It is capped, so marching faster never makes the game faster than a normal walk.
- *Controls → March sensitivity* (Low, Normal, High) is on the Connected Play and trial setup screens.

### Disconnects

If the phone disconnects, or goes silent for 3 s (locked, backgrounded, Wi-Fi drop):

- movement stops at once, and movement also stops by itself if no fresh `MOVE_START` arrives for 1.2 s;
- exploration pauses, and a *Controller disconnected — reconnecting…* banner appears on the TV;
- during a battle the current set pauses and reps can't count. The encounter, HP and set progress are kept, and the rest timer freezes;
- the phone reconnects by itself (backoff from 0.5 s to 5 s) and resumes its session.

**Resume** stays disabled until the phone is back with its camera running, still calibrated and able to see you. Then raise your right hand or click *Resume*. Touch pause works on the phone and the PC. Pause is an ordinary command, so a future voice "pause" only needs to call `input.command({ type: 'pause' }, …)`.

### Networking and HTTPS

- **Why HTTPS:** phone browsers only allow the camera on a secure origin. `http://192.168.x.x` does **not** qualify; only `localhost` does. The relay therefore serves the phone page over HTTPS and its socket over WSS.
- **Certificate:** by default the relay creates a self-signed certificate once, caches it in `.certs/` (git-ignored), and the phone shows a one-time warning. To avoid the warning, use [mkcert](https://github.com/FiloSottile/mkcert). It's free and local:
  ```bash
  mkcert -install
  mkcert -key-file certs/key.pem -cert-file certs/cert.pem <PC-LAN-IP> localhost 127.0.0.1
  ```
  Then install mkcert's root CA on the phone. On iPhone: AirDrop `rootCA.pem` (find it with `mkcert -CAROOT`), then *Settings → Profile Downloaded → Install*, then *Settings → General → About → Certificate Trust Settings → enable full trust*. `certs/` is git-ignored. `FITBOUND_CERT` / `FITBOUND_KEY` can point elsewhere.
- **Firewall:** allow incoming connections to Node on **private** networks the first time. Windows shows a Defender prompt; on macOS use *System Settings → Network → Firewall → allow node*. On Linux, open TCP 8443 on the LAN, e.g. `sudo ufw allow 8443/tcp`. Port 8080 is bound to localhost and never needs opening.
- **Wi-Fi:** the phone and PC must be on the same network. Guest networks and some mesh or office Wi-Fi isolate clients from each other, and the phone then can't reach the PC. If the printed address doesn't load on the phone, that is the most likely cause.
- **Local network permission:** Safari doesn't ask. Chrome on iOS may ask to "find devices on your local network"; allow it. On Android there's nothing to allow.
- **Ports and addresses:** `FITBOUND_PORT` (8080) and `FITBOUND_HTTPS_PORT` (8443) change the ports. If the PC has several network adapters, the pairing screen lists every address.
- **Tunnel (fallback, not tested):** if the LAN blocks device-to-device traffic, a free no-account tunnel can front the HTTPS port, e.g. `cloudflared tunnel --url https://localhost:8443 --no-tls-verify`. Start the relay with `FITBOUND_PUBLIC_URL=https://<name>.trycloudflare.com` so the QR code uses it. Traffic then goes via the internet (only the small JSON events and the app files, never video), and latency will be higher than on the LAN.

## Motion Trial · phone only

The same trial played on the phone alone: its camera, its screen, optionally mirrored to a TV with AirPlay. AirPlay adds noticeable latency, which is why Connected Play exists.

1. Place the phone (see *Phone placement*), choose **Motion Trial · phone only → Start**, and don't touch the phone again.
2. **Calibration** runs hands-free:
   - whole body in view;
   - both hands up (checks there's room);
   - stand still (records your neutral pose);
   - right hand up (confirm test);
   - march in place, lean left, lean right;
   - **floor check**: get into push-up position sideways (left hand skips it);
   - stand back up.
3. **Part 1, exploration** on a tabletop-diorama meadow: march to the banner, steer to the training dummy and strike it (right hand), then read the signpost and accept the trial.
4. **Part 2, combat:** Skeleton (push-ups), Stone Golem (squats), Shadow Mage (jumping jacks), then the Dungeon Warden (push-ups → squats → jumping jacks). Pick a reward after each guardian.
5. A summary lists camera-verified reps per exercise, marching steps, gestures used and tracking losses.

Connected Play runs exactly the same trial.

### Body controls

| Action | Where | How it's detected |
|---|---|---|
| **March in place → walk** | Exploration | Alternating difference in the height of the two knees and feet, normalised by thigh length. Both legs moving together cancels out. Two alternating steps start you; you stop 0.75 s after the last step. |
| **Lean → one turn** | Exploration | Torso angle relative to your calibrated neutral. One lean past 8° gives one 45° (or 90°) turn. Hold it and nothing more happens; come back to neutral to re-arm. |
| **Raise RIGHT hand → confirm / interact** | Exploration, menus, dialogue | Wrist above your nose, held 0.45 s. Hands must come down before the next gesture. |
| **Raise LEFT hand → back / more rest / skip** | Menus, dialogue, between sets | Same, left side. |
| **Both hands up → pause** | Exploration, menus | Held 0.8 s. |
| **Lean left/right → move selection** | Menus, dialogue | One lean = one step. |

Left and right are your *anatomical* sides, so the controls are correct whether or not the camera mirrors. Keyboard equivalents: ↑/W walk (hold), ←/→ one turn per press, Enter confirm, Esc back, P pause.

### Input modes

`src/input/modes.ts` is the single table of what each mode allows. `InputHub` applies it to every input source (local camera, phone controller, keyboard, touch):

- **calibration:** the setup checklist reads motion; nothing moves.
- **explore:** march moves, a lean turns, and confirm, back and pause gestures fire.
- **dialogue / menu:** a lean moves the highlight and gestures choose, go back or pause. Marching moves nothing.
- **exercise:** *all motion input is off*, and only the active exercise detector sees frames, so a jumping jack can't pause the game and a squat can't walk the hero. Pause during a set is touch or keyboard only.

Every mode change resets motion history, disarms gestures and turns, and bumps the epoch. In Connected Play the PC sends each mode change to the phone, which switches detectors to match.

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
npm run play         # Connected Play: build + relay (PC http://localhost:8080, phone https://<LAN-IP>:8443)
npm run relay        # the relay alone, using the existing build
npm run dev          # http://localhost:5173 (single-device play; the camera works on localhost)
npm run dev:https    # the same, over HTTPS on the LAN, for a phone
npm test             # 153 automated tests
npm run build        # type-check + production build into dist/ (game, controller, detector lab)
```

Node 20+ is recommended (developed on Node 22). `npm run dev`/`build` first copy MediaPipe's WASM runtime from `node_modules` into `public/mediapipe/`. The pose models (`public/models/*.task`) and the pixel font are committed.

**Privacy:** camera frames are processed on the device and never stored or sent anywhere. In Connected Play only interpreted events cross the network. MediaPipe's library also has built-in usage telemetry that it posts to Google every minute and that can't be switched off. Production builds block it with a `connect-src` Content-Security-Policy that allows only the page's own origin (plus, when served by the relay, its own socket). `npm run dev` omits the policy so hot reload works.

## Phone-only play on an iPhone + TV

Browsers only allow the camera on secure (HTTPS) origins. Pick one of these:

1. **Deploy.** Import this repository into Vercel (`vercel.json` sets the build and output), then open the HTTPS URL in Safari. Connected Play needs the local relay, so it isn't available from a Vercel deployment.
2. **Local HTTPS:** run `npm run dev:https` and open `https://<your-computer-ip>:5173` on the phone.
3. **Tunnel:** `npm run dev` plus any HTTPS tunnel.

**TV:** Control Centre → **Screen Mirroring**, then **Motion Trial · phone only → Start**. Keep the phone on a charger.

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
server/           Connected Play relay: static HTTPS/HTTP server + WebSocket relay (relay.mjs), pairing/rooms (rooms.mjs)
controller.html   phone controller entry (no Phaser)
src/controller/   phone controller: ControllerBridge (detectors → messages), CtrlLink (pairing, resume, resend), dashboard UI
src/net/          protocol + validation, ControllerGate (session/sequence/mode checks), RemoteSet (authoritative reps), HostLink (PC side)
src/input/        MotionReader (march / discrete turns / gestures), CalibrationFlow, modes table, InputHub (one command path for all sources)
src/trial/        Motion Trial config: rep targets, encounter plans, rewards
src/testing/      synthetic pose generators shared by tests and the ?debug browser hooks
src/exercise/     detectors (pure TS), registry, session controller (setup → countdown → active → complete)
src/pose/         camera + MediaPipe PoseLandmarker (GPU with CPU fallback), frame conversion
src/combat/       CombatEngine (pure rules → CombatEffects), enemies & boss phases
src/game/         progression, save (localStorage, validated), store, audio (WebAudio synth + speech), event bus
src/phaser/       diorama/ figurines, props, board, steering & collisions; pixel art & tiles for classic; Boot / Diorama / World / Battle scenes
src/ui/           React UI: TrialRun, Calibration, AutoBattle, Connected (pairing, remote calibration, controller status), gesture menus; classic UI
src/lab/          Detector Lab
```

Saved automatically: level/XP, gold, upgrades, abilities, defeated enemies, dungeon clears, location, settings (including turn step and sensitivities) and lifetime totals.

## Testing done

- **Automated (`npm test`, 153 passing):**
  - **Discrete turning:**
    - one lean gives exactly one turn in the right direction;
    - holding a lean for 10 s never repeats;
    - coming back to neutral re-arms, but easing off without reaching neutral doesn't;
    - idle standing, posture noise and marching sway never turn;
    - you can turn while marching (and keep marching) and while standing still;
    - the cooldown stops wobbles from double-turning, and tracking loss disarms;
    - sensitivity presets change the threshold, and turning still works at 4 pose frames a second.
  - **Heading grid and collisions:**
    - 45° mode gives 8 headings and 90° mode gives 4, both wrapping round;
    - switching modes snaps to the grid;
    - diagonals move at full speed;
    - you slide round obstacles, including head-on;
    - the closed fence blocks and the open gate lets you through, with the gateway funnel.
  - **Marching:** idle standing never marches, even at *High* sensitivity; deliberate marching starts and stops; smaller knee lifts register; jumps, bobbing, stepping forward and jumping jacks never march.
  - **Connected Play pipeline** (phone bridge → validation gate → PC input hub), on synthetic poses:
    - idle standing sends no movement;
    - marching moves the hero, and one lean turns it once;
    - leaning in a menu sends navigation, never turns;
    - in exercise mode the phone sends only that exercise's reps: no movement or gestures, and jumping jacks during a push-up set count nothing;
    - messages never contain frames or landmarks.
  - **Validation:**
    - malformed messages, unknown types and out-of-range values are rejected, and extra fields are stripped;
    - other sessions are ignored and duplicate sequence numbers are dropped;
    - exercise events are rejected outside exercise mode, and movement, turns and interaction are rejected during it;
    - commands from a previous mode (stale epoch) are dropped, except pause.
  - **Authoritative reps:**
    - duplicate reps are ignored;
    - reps are rejected for the wrong set or wrong exercise, when too fast, before the set is live, after it ends, or while paused;
    - manual reps count only after opting in, and stay labelled manual;
    - remote reps drive the combat engine to exactly the same result as local reps.
  - **Disconnects (PC link, with a fake socket):** a disconnect stops movement at once, a silent phone is declared lost within about 3 s, and the game only reports *ready* again once the phone is back with camera, calibration and tracking. Every rep is acknowledged, but only valid ones count.
  - **Relay pairing:**
    - tokens are single-use and expire;
    - codes work, and wrong codes are rate-limited and withdraw the offer;
    - there is one controller per session;
    - resuming needs the secret key.
  - Existing suites still pass: exercise detectors, gestures, input modes, trial rules, combat, saves, maps and art.
- **Browser, end to end:** headless Chromium ran both pages against the real relay, over real HTTP/WS and HTTPS/WSS:
  - The PC page showed the QR code. The phone page paired with the token, started Chromium's fake camera and loaded the real MediaPipe model; a synthetic body then drove the phone's pose tracker.
  - Calibration on the TV page was driven entirely by the phone. One held lean produced exactly one -45° turn. Standing still moved the hero 0 px.
  - Closing the phone's socket mid-march paused the game and showed the disconnect banner; the hero moved 0 px while the phone kept marching. The phone reconnected by itself, and the game resumed only after a right-hand raise.
  - The phone steered the hero (by lean pulses) to the dummy and the signpost. PC and phone both switched to dialogue mode. All four battles were won from reps counted on the phone and validated on the PC (9 camera-verified reps), ending at the summary.
  - The phone page never loaded Phaser. The only console errors were the intended CSP blocks of MediaPipe telemetry.
  - The relay refused WebSockets from foreign or missing origins, refused bad codes, served 404 for path traversal, and set the security headers.
- **Latency:**
  - The relay's own round trip is **0.19 ms median** (loopback, 40 messages).
  - Phone-event → PC-input measured in the browser was about 180–210 ms. That figure is dominated by this sandbox rendering the PC page in software at 7–13 fps; on a real PC with a GPU at 60 fps expect far less, but it has not been measured.
- **Regressions:** the phone-only Motion Trial and the classic touch adventure (all four fights, level-ups, save and reload) were re-run end to end in the browser and still work.

## Needs physical testing (not verified)

Nothing in Connected Play has been run on real devices. It has only been exercised with synthetic bodies in headless Chromium on one machine. Specifically unverified:

- An iPhone (Safari) pairing with a real PC over Wi-Fi: the self-signed certificate warning flow, camera permission, the MediaPipe frame rate and battery/heat over a session, and wake-lock keeping the screen on.
- The mkcert trust flow, the Windows/macOS firewall prompts, networks that isolate clients, and the tunnel fallback.
- Real end-to-end latency (phone → Wi-Fi → PC → HDMI → TV) and whether it feels responsive.
- Discrete turning and the new marching thresholds with a real body: whether 8° is a comfortable deliberate lean, whether marching sway ever reaches it, and whether the smaller knee lift triggers from real pose data.
- Every exercise from the single fixed phone position, especially push-ups (a body lying side-on on the floor). If push-ups don't track from your placement, the floor check will say so and a clearly labelled manual count is offered. Nothing is ever counted as camera-verified unless the camera saw it.
- Reconnecting after a real Wi-Fi drop, a phone lock or Safari backgrounding. Safari may stop the camera in the background, and the phone then needs *Start camera* again.

## Known limitations

- Connected Play needs the relay running on the PC (`npm run play`). It isn't available from a static deployment such as Vercel.
- One controller per game. Multiplayer is out of scope.
- The phone's calibration is kept only for that browser tab. If the tab is closed, re-pair and recalibrate (*Pause → Recalibrate*).
- The first connection to a self-signed certificate shows a browser warning. Use mkcert to avoid it.
- Hold exercises (plank) are only in the classic mode and aren't supported by the remote exercise protocol yet.
- **Single camera placement** is plausible but unproven for push-ups. The floor check and manual fallback exist for this reason.
- Pause during an exercise set is touch or keyboard only (both-hands-up is part of a jumping jack).
- The camera runs continuously; expect battery drain and warmth. Keep the phone on a charger.
- **iOS Safari:** the camera needs HTTPS. Screen wake-lock needs iOS 16.4+. Keep the page in the foreground. Older iPhones may need the *Fast* tracking model.
- Reverse lunges and mountain climbers have no detectors yet. The game does not judge exercise form and makes no medical claims.
