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

   **Windows shortcut:** double-click **`Play FITBOUND.bat`** in the repo folder. It installs anything new, builds, starts the relay and opens `http://localhost:8080` in your browser. Keep its window open while you play and close it to stop. With GitHub Desktop, click *Fetch origin* → *Pull* first to get the latest version.
2. **TV:** connect the PC to the TV with HDMI and open **http://localhost:8080** in Chrome, Edge or Firefox on the PC. Press F11 for full screen. Turn the PC's sound on; the PC is the audio source.
3. Choose **Connected Play · PC + phone**. A QR code, the phone address and a 6-digit code appear.
4. **Phone** (same Wi-Fi as the PC): scan the QR code with the camera app and open it in Safari or Chrome. Alternatively, open the phone address and type the code.
   - The first time, the browser warns that the connection isn't private, because the PC uses its own certificate. On iPhone choose *Show Details → visit this website → Visit Website*. On Chrome choose *Advanced → Proceed*. See *Networking and HTTPS* to remove the warning.
5. Place the phone (see *Phone placement*), pick **Front** or **Back** on the phone's Camera card, tap **Start … camera** and allow camera access. The TV shows which camera is in use. The TV ticks off *Phone connected → Camera allowed → Pose tracking ready → The phone can see you*, then starts calibration by itself after 5 s (or click **Start calibration**).
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

- **Phone → PC (while tracking is poor):** `VIEW {parts, box}`, words-only "what the camera sees" (which body parts are visible, 0/1/2 sides, and the body's box in the frame), about twice a second; and `PEEK {image}`, the opt-in tiny preview (see *What the camera sees*). Both are display-only; the gate accepts them in any mode and they never affect gameplay.
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
- Nothing is uploaded or stored. By default no video, frames or landmarks leave the phone. The one exception is the **opt-in** tiny preview below, which goes only to your PC over the paired link and is never saved. There are no accounts, cloud services or API keys.

### What the camera sees (when tracking is lost)

If the phone stops seeing you — say the back camera is blocked by a chair leg while you're on the floor — the TV now shows a **What the camera sees** panel in place of the phone status, until tracking has been good again for a second:

- **Always on, no images:** a small frame with a dashed box where your body is, and plain words: *"Can't see your hands, feet — something may be blocking them"*, *"You're at the edge of the picture"*, or *"The camera can't find you"*. The phone sends only which body parts it can see and where (a few numbers), twice a second, and only while tracking is poor. It also appears on the Connected Play setup screen, next to the name of the camera in use.
- **Opt-in tiny preview:** a checkbox on the phone, *Show a tiny camera preview on the TV when it can't see you*, **off by default** and remembered on that phone. When on, the phone also sends a 128-pixel-wide, low-quality JPEG (about 1–5 KB) **once a second, only while tracking is lost**. It goes over the same paired, origin-checked link to your PC only. The PC shows it and keeps only the latest one in memory; it is cleared when tracking recovers, the phone disconnects, or you switch it off. Nothing is written to disk and nothing goes to the internet.
- **Privacy tradeoff:** the original Connected Play rule was "no camera images leave the phone". The preview relaxes that, only when you choose to. It's a real picture of your room, even at 128 px, so anyone who can see the TV or the PC's memory could see it. The PC validates every preview: it must be a `data:image/jpeg;base64` string of at most 14,000 characters, anything else is dropped. Leave it off and you still get the words-only panel. This isn't video streaming: tracking still runs on the phone, and one tiny still a second adds no lag. It's only there to help you spot what's blocking the view.

### Getting around: guided trail (default)

Physical playtesting showed that steering, even with clean 45° turns, was navigation work on top of a workout. Exploration now follows the trail:

- **Active traversal (default):** marching in place walks the hero along the trail toward the current objective. Every bend is followed automatically, so there's no steering and no arrow to read. Stop marching and the hero stops within a moment. Marching speed follows your cadence, but even a gentle march gets you there.
- **Route choices:** at a fork the hero stops and two cards appear, one on each side of the screen. Lean toward the one you want. Marching alone never takes you past a fork, and a lean only counts after you've come back to upright. The meadow has two forks:
  - after the dummy: the *Forest path*, or a detour to the *Mossy Shrine*, where raising your right hand restores your HP;
  - after the Skeleton: the *Moonlit Tower* (the Mage first) or the *Stone Quarry* (the Golem first).
- **Stops:** the trail pauses by itself at the dummy and the signpost for you to interact (raise your right hand), and briefly at the shrine. Encounters start as you walk up to each guardian.
- **Assisted traversal (optional):** a gamepad's left stick or d-pad, or the keyboard arrows/WASD, moves the hero freely around the same meadow, with the same collisions, interactions and encounters.
  - Connect the gamepad to the computer running the game (USB or Bluetooth), not to the phone, and press a button once so the browser notices it.
  - To switch, press *Select* on the gamepad or *T* on the keyboard, or use the pause menu, whenever you like; the run and its rewards are unaffected.
  - Switching back to Active walks the hero to the nearest reachable bit of trail, without teleporting, and carries on from there.
  - Controller movement is never counted as exercise: the summary reports trail travelled by marching and by controller separately.
  - Battles still use the camera.
- **Free roam (experimental):** the previous lean-to-turn steering (below) is still available under *Controls → Getting around*, so the two can be compared.

Where things are: the trail network, fork definitions and routing live in `src/phaser/diorama/trailGraph.ts` (pure, tested). The scene only draws where the walker says the hero is.

### Free roam steering (experimental)

- **One lean = exactly one turn**, 45° (8 directions) or 90° (4 directions) under *Controls → Turn per lean*.
- **Holding a lean never repeats.** The torso must come back inside the neutral band (4°) for 0.12 s to re-arm.
- A lean registers at 8° from your calibrated neutral; Low, Normal and High sensitivity use 11°, 8° and 6°. A 0.35 s cooldown and time-based smoothing stop wobbles.
- You can turn while standing still. You slide round trees and rocks, and pushing into the fence beside the open gateway steers you into the gap. A small chevron above the hero shows the facing direction.

### Marching

- It still takes two alternating steps to start moving, so a single weight shift never moves you. Jumping, bobbing, squatting or stepping toward the camera still never count.
- Changes, measured on synthetic data:
  - The step threshold dropped from 0.12 to 0.11 thigh-lengths. A knee lift about 20% smaller now registers (about 40% smaller on *High*).
  - Movement stops about 165 ms sooner after you stop.
  - The hero speeds up and slows down faster.
  - Smoothing is time-based.
- Speed follows your cadence between 55% and 100% of normal walking speed. It is capped, so marching faster never makes the game faster than a normal walk.
- *Controls → March sensitivity* (Low, Normal, High) is on the Connected Play and trial setup screens.

### Pausing and recalibrating

You can pause from every phase without walking to the phone or laptop:

| How | Works during |
|---|---|
| **Both hands up**, held 0.8 s | Exploration, dialogue, menus, rewards, between sets, the "stand tall" step |
| **Squat sets:** both hands high, held 1 s | Squats (they never raise the hands that high) |
| **Jumping-jack sets:** feet together, both hands high, held still 1.5 s | Jumping jacks (a jack's arms-up moment has the feet apart and lasts a fraction of a second) |
| **Push-up sets:** stand up, then both hands high, held 1 s | Push-ups (can't happen on the floor; standing up alone doesn't pause) |
| Touch **Pause** (phone or TV page), **P** on the keyboard, **Start** on a gamepad | Everything, including when tracking is lost |

Each mid-set gesture is checked against its own exercise's movements in the tests, so ordinary reps don't trigger it. A pause freezes everything: the set, the rest timer, the enemy's turn and the timers between them. A gesture needs a body in view, so while tracking is lost use touch, keyboard or gamepad.

**Recalibrate** is in the exploration pause menu and in the battle pause menu. It runs a quick version that takes a few seconds:

1. stand in view;
2. stand still (lean baseline and camera roll are re-measured);
3. done.

In a battle it keeps the enemy's HP, your HP, the reps already counted in the set and the fight's progress. The set resumes where it was: it isn't restarted and no reps are awarded.

**Voice ("pause", "resume", "recalibrate") is researched but not built.** See *Voice commands* below.

### Standing ready between sets

After each set, the enemy waits until you signal you're ready:

- Stand tall with your arms relaxed at your sides. It takes about half a second, and brief wobbles don't restart the hold. You don't have to freeze.
- The TV shows a progress bar, plus a *Continue* button (or Enter, or gamepad A) as a fallback.
- Standing up after push-ups can't trigger anything else: in this "ready" mode only *ready* and *pause* count.
- The enemy never attacks before you're ready, and nothing advances while paused or while you're out of view.
- The check only runs at this point in combat, never in story scenes or menus.

### Disconnects

If the phone disconnects, or goes silent for 3 s (locked, backgrounded, Wi-Fi drop):

- movement stops at once, and also stops by itself if no fresh `MOVE_START` arrives for 1.2 s;
- the game pauses and a *Controller disconnected — reconnecting…* banner appears on the TV;
- in a battle the set pauses and reps can't count. The encounter, HP and set progress are kept, and every timer freezes;
- the phone reconnects by itself (backoff from 0.5 s to 5 s) and resumes its session.

**Resume** stays disabled until the phone is back with its camera running, still calibrated and able to see you.

### Push-up reliability and rep diagnostics

**No countdown for push-ups:** counting starts as soon as the camera sees you in push-up position (a quarter-second check, down from a 0.7 s hold plus a 3 s countdown), so you don't hold a plank waiting. Squats and jumping jacks keep their *3-2-1*.

Every condition in the push-up state machine was reviewed. These could stop a rep from counting:

| Condition | Before | Now |
|---|---|---|
| Arm and torso landmarks visible (confidence ≥ 0.5) | Required | Same, and reported as *elbow/wrist* or *shoulder/hip not visible* |
| Body within 45° of horizontal (image-relative) | Required | Same, measured in a frame corrected for camera roll |
| Side-on to the camera | Required | Same |
| Hips not piked (shoulder–hip–knee ≥ 115°) | Required | Same |
| **Any single frame failing the above, mid-rep** | Threw the rep away | Must fail for 0.3 s before the rep is discarded |
| **Arms "extended" = elbow ≥ 150°** to start and to finish every rep | Fixed | If straight arms hold steady at a lower 2D angle (never below 135°), that becomes your top. The **required depth is unchanged** (the drop from top to bottom), so reps aren't easier. |
| Depth (bottom ≤ 100–110° by difficulty), return to the top, minimum 0.45 s per rep | Required | Same |

The two bold rows are the likely culprits for real, low-camera push-ups: 2D elbow angles from a floor-level phone often never read 150°, and MediaPipe's landmarks on a lying body are jittery. Neither was simply loosened. Thresholds are unchanged, a sustained problem still discards the rep, and the synthetic tests that check shallow reps, standing arm curls and hip hinges still fail to count.

**Diagnostics** (numbers only, kept on the device running the detector, never uploaded):

- While a set can't start, the TV explains why after a few seconds, e.g. *"Not starting: Starting pose not detected — arms not straight at the top"* or *"Elbow or wrist landmarks not visible"*. The phone dashboard shows the same line.
- After each set, a *Camera notes* box separates two kinds of miss. **Incomplete reps** the camera saw: *lowering depth not reached*, *return to starting position not detected*, *too fast*. **Attempts it could not assess**: *tracking lost mid-rep*, *left the push-up position mid-rep*. It also names the main reason if the set struggled to begin.
- To turn the notes off: *Controls → Rep diagnostics*.
- The Detector Lab (`/lab.html`) also shows each check's numbers live, now including the learned top and bottom angles.
- The labelled manual-count fallback is unchanged. Manual reps are never reported as camera-verified.

### Camera placement, tilt and lens

- **Placement:** landscape, low down (a low shelf, or leaning against a wall near the floor), 2.5–3 m away. Stand facing it for standing exercises; turn sideways and get down in the same spot for push-ups. You shouldn't need to move the phone during a workout.
- **Tilt (roll):** detectors now see each frame rotated to undo the phone's sideways tilt. The tilt is measured from you during calibration (a standing torso is vertical), not from the phone's motion sensor. Turning sensor data into "down in this video frame" depends on how iOS rotates and mirrors camera frames and on sign conventions that differ between browsers; getting that wrong would *double* the tilt. Tilts over 25° aren't corrected.
- **Pitch and perspective** (a phone leaning back against a wall) can't be undone from a single 2D view. The ±45° body check is tolerant of it, and the learned top angle absorbs its effect on elbow angles.
- **"Phone moved" warning:** the phone's motion sensor (iOS asks permission when you tap *Start camera*) watches only the angle between gravity now and at calibration. That comparison is independent of axis conventions. It must be over 6° for 1.5 s, with heavy smoothing, so footsteps, thumps and sensor noise don't trigger it. If the phone moved, the TV and phone say so and suggest *Pause → Recalibrate*. Without sensor permission, this warning simply doesn't appear.
- **Choosing a camera:** the phone's Start screen has a **Camera** card with big *Front (selfie)* / *Back (sharper)* buttons. The start button says which one will start, and the choice is remembered on the phone. The dashboard has the same card, with *Restart camera with this choice*. The PC setup screen shows the name of the camera in use.
- **Lens:** the phone's Camera card (*More cameras and zoom*) lists the cameras the browser exposes. The names appear once the camera has been allowed; on recent iPhones Safari may list an *Ultra Wide* camera. A *widest zoom* option applies the lowest zoom a camera reports (e.g. 0.5×) if it offers one. Neither is guaranteed across iPhone models or iOS versions; the default camera always works. Wider views make you smaller in the picture, which can reduce tracking reliability, so compare push-ups with each.

### Voice commands (researched, deferred)

A spoken "pause" that works on the floor is the right long-term answer. It isn't built, because a reliable, private version is a separate piece of work:

- **Cloud recognition is ruled out as the default.** The browser's built-in speech recognition (Chrome, Edge; Safari's `webkitSpeechRecognition`) sends audio to Google, Microsoft or Apple for transcription. Newer Chrome versions have an on-device option, but it is experimental and not something to rely on yet.
- **Recommended: a small offline keyword spotter running on the laptop:**
  - either Vosk's WebAssembly build with a small English model (about 40 MB), restricted to the words *pause, resume, recalibrate*;
  - or a tiny keyword-spotting model (TensorFlow.js *speech-commands* style) trained on those words.
  - Why the laptop, not the phone:
    - the phone already runs the camera and MediaPipe, and adding continuous audio inference there costs heat and battery;
    - iOS Safari only reliably runs camera and microphone together while the page stays in the foreground, and suspends audio processing when it's backgrounded;
    - on the laptop, Chrome's echo cancellation (`getUserMedia({ audio: { echoCancellation: true } })`) can remove the game's own sound, which comes from the same page, before recognition.
- **Things that need testing in the room:**
  - microphone distance (a laptop 3 m away beside the TV);
  - TV speakers playing other audio, e.g. an AV receiver, which in-browser echo cancellation may not cover;
  - a one-time microphone permission prompt;
  - automatic restart after the browser suspends audio;
  - false triggers from the game's spoken cues. A short confirm tone, plus ignoring recognition while the game is speaking, would help.
- **Voice will never be the only way to pause.** It would plug into the existing command path as one more input source (`input.command({ type: 'pause' }, source)` with a new `'voice'` source), obeying the same mode rules.

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
3. **Part 1, exploration** on a tabletop-diorama meadow: march along the trail to the banner and the training dummy (strike it with your right hand), choose a path at the fork, then read the signpost and accept the trial.
4. **Part 2, combat:** the Skeleton (push-ups). Then the Stone Golem (squats) and the Shadow Mage (jumping jacks), in whichever order you choose at the fork. Last, the Dungeon Warden (push-ups → squats → jumping jacks). Pick a reward after each guardian.
5. A summary lists camera-verified reps per exercise, marching steps, gestures used and tracking losses.

Connected Play runs exactly the same trial.

### Body controls

| Action | Where | How it's detected |
|---|---|---|
| **March in place → walk** | Exploration | Alternating difference in the height of the two knees and feet, normalised by thigh length. Both legs moving together cancels out. Two alternating steps start you; you stop 0.75 s after the last step. |
| **Lean → choose a route** | Forks on the trail (and free-roam turning) | Torso angle relative to your calibrated neutral. One lean past 8° picks the route on that side. Holding it does nothing more; come back to upright to re-arm. |
| **Stand tall, arms relaxed → ready** | Between sets | Upright, hands below mid-torso, feet together, not marching, held about 0.5 s (forgiving). |
| **Raise RIGHT hand → confirm / interact** | Exploration, menus, dialogue | Wrist above your nose, held 0.45 s. Hands must come down before the next gesture. |
| **Raise LEFT hand → back / more rest / skip** | Menus, dialogue, between sets | Same, left side. |
| **Both hands up → pause** | Exploration, menus, between sets | Held 0.8 s. During sets, the per-exercise variants in *Pausing and recalibrating*. |
| **Lean left/right → move selection** | Menus, dialogue | One lean = one step. |

Left and right are your *anatomical* sides, so the controls are correct whether or not the camera mirrors. Keyboard: ↑/W walk (hold; counted as controller movement), ←/→ choose a route or one turn per press, Enter confirm/continue, Esc back, P pause, T switch Active/Assisted traversal. Gamepad: stick/d-pad move (Assisted), d-pad ◀ ▶ choose, A confirm, B back, Start pause, Select switch traversal.

### Input modes

`src/input/modes.ts` is the single table of what each mode allows. `InputHub` applies it to every input source (local camera, phone controller, keyboard, touch):

- **calibration:** the setup checklist reads motion; nothing moves.
- **explore:** march moves along the trail (or free roam), a lean chooses a route (or turns), and confirm, back and pause gestures fire.
- **dialogue / menu:** a lean moves the highlight and gestures choose, go back or pause. Marching moves nothing.
- **exercise:** only the active exercise's detector and its own pause gesture read frames, so a jumping jack can't pause the game and a squat can't walk the hero.
- **ready:** between a set and the enemy's turn, only *ready* (standing tall) and pause count.

Every mode change resets motion history, disarms gestures and turns, and bumps the epoch. In Connected Play the PC sends each mode change to the phone, which switches detectors to match.

### Battles in the trial

Hands-free. Each guardian has a plan of sets. For each set: a **Next exercise** card (with spoken cue) tells you how to face the phone and gives a 5–8 s rest (right hand = start now, left hand = more rest). The camera then waits until you're in the start position, counts down 3-2-1, and counts reps. When the set completes, you stand tall to signal you're ready, the enemy responds, and the next phase starts. The trial never ends in a knockout.

Rep targets default to **5 push-ups, 10 squats, 10 jumping jacks, and a 3/6/8 boss**. Change them in *Trial settings* on the setup screen, or with a URL parameter such as `?reps=pushup:3,squat:5,jumping_jack:5,bossPushup:2,bossSquat:3,bossJack:4`.

Audio cues: exercise start chord, a rep blip that climbs in pitch, set-complete fanfare, next-exercise chime and spoken instruction, a tracking-lost warning plus spoken "step back into view", victory and defeat stings. Sound and voice toggles are on the setup screen and in the classic Menu.

### Phone placement (one position for everything)

- **Landscape**, low down: on something steady at about **knee height**, or leaning against a wall near the floor. Place it **2.5–3 m** from where you stand, on a clear floor.
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
npm test             # 195 automated tests
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
src/input/        MotionReader (march / turns / gestures / ready), exercise-safe pause gestures, CalibrationFlow (full + quick),
                  modes table, InputHub (one command path for all sources), gamepad, tilt watcher
src/trial/        Motion Trial config: rep targets, encounter plans, rewards
src/testing/      synthetic pose generators shared by tests and the ?debug browser hooks
src/exercise/     detectors (pure TS), rep diagnostics, roll levelling, registry, session controller (setup → countdown → active → complete)
src/pose/         camera + MediaPipe PoseLandmarker (GPU with CPU fallback), frame conversion
src/combat/       CombatEngine (pure rules → CombatEffects), enemies & boss phases
src/game/         progression, save (localStorage, validated), store, audio (WebAudio synth + speech), event bus
src/phaser/       diorama/ figurines, props, board, trail graph & walker, steering & collisions; pixel art & tiles for classic; scenes
src/ui/           React UI: TrialRun, Calibration, AutoBattle, Connected (pairing, remote calibration, controller status), gesture menus; classic UI
src/lab/          Detector Lab
```

Saved automatically: level/XP, gold, upgrades, abilities, defeated enemies, dungeon clears, location, settings (including turn step and sensitivities) and lifetime totals.

## Toward the combat overhaul (architecture notes)

The planned direction:

- turn-based exercise attacks, with no interruptions mid-set;
- selectable abilities, and several abilities per detector;
- recharge, weaknesses and roguelite upgrades;
- high/low enemy attacks dodged with a squat or a hop.

These parts of today's code would make that unusually hard:

1. **Ability = exercise.** `CombatEngine.handle` looks up `getExercise(id).ability.effect` and switches on it, so each exercise has exactly one ability. Selectable and shared abilities need an `AbilityDef` of its own (effect, damage profile, recharge), and a set that starts with an ability id, not an exercise id.
2. **Enemies prescribe exercises.** `trial/config.encounterPlan` fixes which exercise each set uses, and boss phases gate damage on `phase.required`. Choosing your own abilities needs plans that describe what's *allowed or favoured*. Weaknesses become multipliers on ability tags, not hard requirements.
3. **No per-ability or run state.** Recharge counters and temporary upgrades have nowhere to live: `BattleState` only holds HP and phase, and trial boons are ad-hoc bonuses in `TrialRun`. A small `RunState` (upgrades, recharge) passed into the engine would fix this.
4. **Enemy attacks resolve instantly.** `enemyTurn()` applies damage at once, with no attack type (high/low), wind-up or response window. Dodges need a telegraph → response-window → resolve step, plus short "reaction" detectors (crouch, hop). Those differ from rep counters and would use their own input mode.
5. **Battle pacing lives in React timeouts.** This build moved them onto pausable timers and added an explicit "ready" step. The next step is a small battle phase machine (player turn → ready → enemy telegraph → dodge window → resolve) that owns the timing, which `AutoBattle` then renders.

Already in place and reusable:

- `SetDriver`: local or remote sets feeding one engine.
- The PC-authoritative rep validation.
- The mode table, which can take new *reaction* and *ready* modes.
- The mid-set pause policies, keyed by exercise.
- Pausable timers.
- The "ready" neutral-pose recognition.

## Testing done

- **Playtest-3 fixes (this round):**
  - **What was fixed or added:**
    - the narrator now says "push ups" (it was spelling out "U-P-S");
    - push-ups have no countdown;
    - *How will you explore?* (March in place / Gamepad or keyboard) is on the setup screens;
    - camera choice is up front on the phone;
    - the "What the camera sees" panel and the opt-in preview;
    - the `Play FITBOUND.bat` launcher.
  - **Automated:** `npm test`, 202 passing, 7 new:
    - pronunciation;
    - push-ups go straight from position to counting, and other exercises keep the countdown;
    - the view summary names hidden parts;
    - VIEW, PEEK and camera-label validation (rejects non-JPEG or oversized images, `javascript:` URLs, bad part values, out-of-range boxes);
    - the gate accepts them in any mode;
    - the phone sends VIEW about twice a second only while lost, and clears it after;
    - no preview unless opted in; about once a second when opted in; cleared on recovery.
  - **Headless Chromium, PC + phone through the real relay:**
    - the traversal cards switch the setting;
    - the phone's Front/Back buttons change the start button;
    - the PC shows the camera label;
    - losing tracking shows the panel on setup and in calibration;
    - turning the preview on sends a ~1.3 KB JPEG that the PC displays;
    - the panel and preview clear once tracking is back;
    - after switching the preview off, none are sent;
    - no console errors.
  - **Not verified:** the `.bat` launcher on a real Windows PC (it was written for `cmd.exe` but couldn't be run here), and the preview and camera labels on a real iPhone.

- **Playtest-2 build (this round):**
  - **Automated:** `npm test`, 195 passing, of which 42 are new:
    - **Guided trail:**
      - every segment is connected and smooth, and only the gate crosses the fence;
      - marching alone reaches the banner and stops;
      - with no movement input the hero stays put, and bends are followed without choices;
      - the hero stops at a fork, waits even while marching, and one choice takes that route (the shrine detour lingers, then continues);
      - the direct route skips the shrine, and the closed gate stops the trail until it opens;
      - after the Skeleton, either order reaches the other guardian, then the Warden;
      - a fork is only offered when both options still lead somewhere;
      - rejoining picks trail on the same side of a closed gate.
    - **Pause gestures:**
      - jumping jacks, squats and push-ups never trigger their own pause gesture;
      - each exercise's pause pose does;
      - hands already raised don't count;
      - the hub fires pause only in exercise mode.
    - **Ready:**
      - fires once after standing up from push-ups, and a brief wobble doesn't restart it;
      - never fires while marching, with hands raised, or out of view;
      - in ready mode a raised hand can't confirm, while keyboard, touch and gamepad *Continue* can;
      - the phone sends READY only in ready mode, and the gate only accepts it there.
    - **Push-ups:**
      - one noisy frame no longer loses a rep, but a sustained break still does (and is reported);
      - a learned top counts real reps whose straight arms read 142°, while shallow reps still don't count;
      - bent arms never become the top, and standing arm movements never count;
      - diagnostics report no-return, lost-mid-rep, hidden landmarks, a set that couldn't begin, and incomplete reps.
    - **Camera and tilt:**
      - calibration measures camera roll, and levelling restores a tilted frame;
      - push-ups count from a 25°-tilted phone;
      - the tilt watcher ignores noise and thumps, flags a 12° move and clears when the phone is put back.
    - **Other:**
      - gamepad buttons fire once per press and follow mode rules, and the stick dead zone works;
      - stick and keys never add up;
      - pausable timers hold the enemy's turn;
      - the new protocol fields are validated;
      - quick recalibration is body → neutral → done.
  - **Browser, end to end:** Connected Play with a guided trail, PC and phone pages through the real relay, driven by a synthetic body:
    - Marching only, with no lean, reached the banner. After marching stopped, the hero drifted 19 px while decelerating.
    - Keyboard Assisted traversal moved the hero, and switching back walked it onto the trail to the dummy.
    - Marching at a fork moved the hero 0 px, and one lean chose the shrine; there, a right hand restored HP.
    - At the second fork, one lean chose the Mage first.
    - Mid jumping-jack set, the feet-together pause pose paused the game at 1/3. A quick recalibration ran from the battle pause menu, and after resuming the count was still 1/3.
    - All four battles were won, and the Warden fight used the "stand tall" ready step, whose *Camera notes* box also showed.
    - No page errors.
  - **Regressions:**
    - the phone-only Motion Trial on the guided trail: all four fights;
    - the legacy free-roam steering through Connected Play, including disconnect and reconnect;
    - the classic touch adventure (four fights, save and reload).
    - All pass.
- **Automated, previous round (`npm test`, 153 passing then):**
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

**Nothing in this round has been tried by a real person on a real device.** The playtest scenarios to try next:

1. March through the meadow without steering.
2. Stop marching and check the hero stops promptly.
3. Choose a route with one deliberate lean.
4. Complete all four battles without moving the phone.
5. Pause and recalibrate mid-battle without losing progress.
6. Stand tall after a set without triggering anything else.
7. Recover from brief tracking loss.

Specifically unverified:

- Whether a real body's push-ups count from the wall/floor placement. If they don't, the *Camera notes* now say which check failed. Please note what they say.
- The mid-set pause gestures with a real body, especially the feet-together hold after jacks. Also whether standing up and raising both hands feels natural mid push-ups.
- The ready step: whether about 0.5 s of standing tall feels responsive, and whether it ever misfires.
- The iPhone motion-sensor permission prompt, and whether the *phone moved* warning is quiet in normal play.
- Which cameras Safari lists on your iPhone (Ultra Wide?), whether the widest-zoom option does anything, and how push-up tracking compares.
- A Bluetooth/USB gamepad on the laptop's browser (Chrome/Edge should support standard pads).

Earlier items, still unverified:

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
- Mid-set pause gestures need a body in view. Lying on the floor you must stand first, or use touch, keyboard or gamepad (voice is deferred).
- Guided traversal uses one hand-built trail for the meadow. New areas need their own trail graphs.
- Roll correction only undoes sideways tilt. Pitch and perspective from a phone leaning against a wall are not corrected.
- The camera runs continuously; expect battery drain and warmth. Keep the phone on a charger.
- **iOS Safari:** the camera needs HTTPS. Screen wake-lock needs iOS 16.4+. Keep the page in the foreground. Older iPhones may need the *Fast* tracking model.
- Reverse lunges and mountain climbers have no detectors yet. The game does not judge exercise form and makes no medical claims.
