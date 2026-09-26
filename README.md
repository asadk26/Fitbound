# FITBOUND: Heart of Haze

A fitness roguelite you play with real exercises. A phone camera watches you through MediaPipe Pose, and each set you do powers one of four magical abilities. You choose the ability, do the movement, watch it land, then duck or hop when the enemy strikes back.

The design vision, story canon and roadmap are in the **[design bible](docs/design-bible.md)**. This README covers how to run, play and test the game.

Ways to play:

| Mode | Screen | Controller | When to use it |
|---|---|---|---|
| **Expedition · PC + phone** (the main game) | A PC's browser, shown on the TV over HDMI | Your phone as the camera controller, plus a gamepad, keyboard or your voice | The full game: randomised four-family loadouts, exercise-powered combat, dodging, blessings, the Mirror, a Haven, the Warden. |
| **Expedition · phone only** | The phone (optionally mirrored) | The same phone's camera | No PC available. |
| **Tutorial trial** (PC + phone, or phone only) | as above | Marching, leaning and hand gestures | The original four-encounter demo: guided trail, push-ups, squats, jumping jacks. |
| **Classic adventure** | The phone, portrait | Touch, plus the camera for battles | The original touch RPG. |

All modes share one input system, one exercise library, one progression system and one save. Expeditions use their own combat engine (`src/rpg/`); the tutorial trial and classic mode keep the original one.

## Heart of Haze: expeditions

*The Heart is a failsafe built to save a kingdom consumed by corruption. It keeps reconstructing you — an Echo of someone it lost — and sends you through the Haze toward the Spark. Each expedition you come back a little different.*

### Start one

1. Double-click **`Play FITBOUND.bat`** on the laptop (or run `npm run play`). The browser opens the game.
2. Choose **Expedition · PC + phone**. Pair the phone as before (QR code, then *Start … camera* on the phone).
3. **Continue to the Sanctuary.** You don't need to be in view yet. Menus, choices, the path and the Haven all work from the couch with a gamepad, keyboard or mouse.
   - **The first time**, the opening plays (see *The opening and the ritual* below). It plays once. It is marked as seen even if you skip it, and it never repeats by itself. *Replay the opening* is on the title screen.
   - **After that**, a short reconstruction ritual (about 10 seconds, skippable) plays whenever you arrive at the Sanctuary. That covers arriving from the title screen and coming back from an expedition.
4. In **the Sanctuary** (setup, about 20 seconds; the screen sits in the rainy garden):
   - say whether you have **dumbbells** today, and a **chair or bench** for rows;
   - say **how you feel** (Take it easy, Normal or Strong). This scales your own targets and nothing else;
   - pick a **route**: Full (about 20–25 min, 6 fights) or Short (about 12–15 min, 4 fights);
   - review the **four-movement loadout**. Use *Swap* for one movement, or *Reroll all*;
   - optionally: rest a movement today, adjust your per-exercise targets, include experimental movements, and switch **voice commands** on.
5. **Begin.** The camera checks you just before the first fight (a quick "stand tall"), not before.

A saved run shows **Resume expedition · Phase N** on the title screen.

### The opening and the ritual

Cinematics are staged in the engine, in the same painted diorama style as the rest of the game. They are not videos.

**The opening** has four stages:

1. **Darkness.** Soft rain, then a heartbeat rising beneath it.
2. **The kingdom, in fragments.** Three illustrated memories fade in and out: a festival square with nobody in it, towers coming apart stone by stone, and a wheat field greying from the edges. Elara, not yet seen, speaks over them.
3. **The Heart.** A crystal heart in a cavern of roots, with brass rings turning around it. The rain is muffled here, as if heard through stone. Light pulls a sword, a cape and a hand out of the dark.
4. **The Sanctuary.** A walled garden on a floating island above a sea of haze, in the rain. The hero forms on a stone slab and rises. Elara waits beside a well that glows with the Heart's warm light, and the light shows in the wet stone and the puddles. Later she walks to the garden's edge, and the camera finds the Spark on a far rise.

It ends on "Come. Let's see what the Heart has remembered of you." and goes straight into the Sanctuary setup screen.

**How it plays:**

- **Lines wait for you.** Press A, Enter or Space, click, or raise your right hand. The first press finishes the text; the next moves on.
- **Skipping:** press B or Esc twice, or use the **Skip** button.
- **No camera needed.** You can watch from the couch.
- **Sound:** music, rain and the heartbeat, with no synthetic voice. The browser's robotic voice is never used for Elara, anywhere in the game.
- **Recorded voice later:** every line has an id (e.g. `opening.elara.05`). A recorded file can be added per line in `VOICE_LINES` (`src/story/cinema.ts`).

**The reconstruction ritual** is about 10 seconds and skippable. There's a heartbeat, light gathers, the hero forms, and Elara says one line that fits the moment:

- after a victory;
- after a fall;
- after ending or saving early;
- after a few days away;
- or simply "There you are."

**The rain.** The Sanctuary has been raining for a long time. After the first expedition that reaches the Spark, the rain stops, and the garden is dry and sunlit from then on. Nothing explains why.

**For development:**

- Scripts are data in `src/story/scripts.ts`: stages, staging cues, the soundscape, and lines.
- The stage is `src/phaser/scenes/CinemaScene.ts`.
- Its art is `src/phaser/diorama/cinemaArt.ts`. It's painted the first time it's needed, not at boot.
- Elara's figure and her dialogue portrait come from one painter in `src/phaser/diorama/figures.ts`, so they always match.
- Script time comes from the scene's clock, so staging and dialogue stay in step even on a slow machine.

### A run

```
Phase 1  The Training Yard (Straw Echo) → Rusted Causeway (Iron Husk) → a blessing
Phase 2  The Bone Field (Bone Charger) → the Mirror of Unlived Lives → Drifting Hollow (Haze Wisps) → a blessing
Phase 3  A Quiet Haven → The Veiled Stair (Hollow Acolyte) → a blessing → Before the Spark (Warden of the Haze)
```

- **You march between encounters.** Each encounter stands at its own spot on the diorama trail: straw at the yard, the Husk by the signpost, the Charger past the ward-gate, the Mirror at the crossroads fork, the Wisps by the quarry, the Haven's campfire under the tower, the Acolyte on the new Veiled Stair, and the Warden at the end. Marching in place carries the hero there (the guided trail, at about a third of a Trial's pace so each leg is a short stretch), with a line of story as the leg begins. Walking into the marker starts the encounter.
  - **Mossy Shrine:** the fork on the way to the Bone Field offers a detour that heals 30 HP once per run.
  - **Between fights** (Sanctuary) chooses *March* or *Gamepad* travel. Mid-leg, Select on the gamepad, **T**, or the pause menu switches between them. Gamepad travel doesn't count as activity. The pause menu can also recalibrate, or save and stop.
  - Out of view, the hero simply stops. There's no penalty.
  - Blessings appear straight after the fight that earns them, so there's no march to them.
- At a phase boundary, **the path** shows where you are first. Continue, or **Save and stop here**.
- **Stopping and resuming.** An expedition can span several sittings, and each sitting is its own **workout session**.
  - **Where you can stop:** *Save and stop here* on the path, the trail's pause menu, or **Pause → Save and leave in the middle of a fight**.
  - **A fight is saved exactly where it stands.** That can be your turn, "stand when ready", or strikes still to come. In the middle of a set, the set ends with what was counted, its ability lands, and the fight is saved right after. Resuming continues the same fight: same enemy HP, same turn. Nothing you already did is asked again.
  - **Each session gets its own summary, check-in, Journal row and target changes** ("Next time"), judged on that session's sets and that day's readiness, even when the expedition isn't finished.
  - **Back on another day,** *A new day* asks how you feel (and whether you have dumbbells) before anything physical.
    - Today's targets follow your answer.
    - A family you're resting sits out today but keeps its slot for later.
    - *Swap* changes one movement without rerolling the rest.
    - A movement today's equipment rules out is swapped for you.
  - **Suspending isn't losing.** If the app closes unexpectedly, that session is recorded when you resume.
- Enemy HP is sized so a full route is about 20 sets. The marches add a few minutes of low-intensity movement between them. They're tallied as steps in the summary and never count as sets.

### The four families and the loadout

Every run has the same four ability slots. The movement in each slot changes between runs, and can change mid-run at the Mirror.

| Family | Combat role | Movements (ability) |
|---|---|---|
| **Upper body** | Heavy single-target hits, armour breaking, disruption | Push-ups (Sundering Strike), Dumbbell rows (Reaping Hook), Bicep curls (Twin Fang) |
| **Legs** | Area hits, stagger, some guard | Squats (Quake Stomp), Reverse lunges (Stone Stride) |
| **Cardio** | Elemental hits that chain or burn; builds Storm Charge | Jumping jacks (Arc Lightning), High knees (Ember Rush), Mountain climbers (Gale Flurry) |
| **Core** | Shields, heals, counterattacks | Plank (Aegis Ward), Dead bugs (Mending Tide), Standing cross crunches (Riposte Stance) |

**How the loadout is chosen** (`src/rpg/loadout.ts`):

1. A movement is never picked if it needs equipment you didn't confirm, if you rested it today, or if it's experimental and you didn't opt in.
2. Movements must be **checked on your setup** to be picked normally:
   - *stable* movements (push-ups, squats, jumping jacks, all physically playtested) always qualify;
   - *beta* movements qualify once you've passed a quick check in the **Movement Lab** ("did the count match what you did?").
3. If a family has nothing checked, the most reliable beta movement is used and marked **First-time check**. Plank is the usual case for core.
4. Movements that were demanding in your last session or two are picked less often. A reroll never returns the same pick when there's an alternative.
5. If a family has nothing at all (e.g. you rested every upper-body movement), that slot **rests**, and the other three abilities still win fights.

Targets are yours (Sanctuary → *Rest a movement today · targets*), scaled only by how you feel. They never rise with enemy difficulty.

### Combat

The player turn and the enemy turn stay separate:

The battle is staged side-on, in the style of a turn-based JRPG. The hero stands front-left; foes stand on a diagonal back-right, each with its name, HP bar, ward and armour pips, and its **intent** (ATTACK, ATTACK ×2, WINDING UP, WARD, HARDEN, SUMMON, STAGGERED) in the scene above it. The party panel (bottom-left) shows your HP, shield and Storm Charge. The camera pushes in on each exchange: the hero dashes in to strike, and a foe charges across to swing.

1. **Choose an ability** from the command menu (bottom-right). Each line shows the ability, ★ when it's especially effective right now, or *recharging*. The selected line also shows:
   - the movement and target;
   - the ability's role;
   - the hint, e.g. *Breaks armour*, *Cancels the charge*, *Hits all foes*, *Overloads the ward*.

   Choose with the gamepad d-pad and A, the arrow keys and Enter, a lean and a raised right hand, or a click. No body tracking is needed to choose.
2. **Do the set.** Counting starts when the camera sees you in position ("Step into view when ready"); floor movements have no countdown. **Enemies never act during a set.**
3. The ability resolves.
4. **Ready check.** Stand tall with arms relaxed, or press *I'm ready* / A / Enter. After a floor exercise you're told to take your time getting up, and the first strike gets extra wind-up.
5. **Enemy turn.** Foes act on the *intent* they showed before you chose: attacks, wind-ups, wards, armour, summons. Attacks become strikes to dodge.

**Recharge and variety:**

- An ability can't be used two turns in a row. At least three are always ready.
- Switching families from your last turn gives +10%.
- Cardio builds **Storm Charge**; your next non-cardio ability spends it for +15% per charge.
- No enemy needs one specific movement. Stagger also cracks armour, so even without upper-body work every fight is winnable (a test checks the boss with legs, cardio and core only).

**Enemy archetypes** (`src/rpg/enemies.ts`):

| Enemy | Mechanic | Answer |
|---|---|---|
| Straw Echo | Warm-up (26 HP): one gentle HIGH or LOW swing | Any two attacks (one set of push-ups); core cards defend and deal no damage |
| Iron Husk | Armour (each stack −18% damage) and *Harden* | Upper body breaks armour; stagger cracks it |
| Bone Charger | Winds up a two-strike *Horn Charge* | Disrupt it (Reaping Hook) or stagger it before it lands |
| Haze Wisps ×3 | A pack; weak to lightning and wind | Area (legs) and chains (cardio) |
| Hollow Acolyte | A ward that drinks damage and reweaves; resists fire | Lightning overloads wards ×2 |
| Warden of the Haze | Armour, summons wisps, winds up a three-strike *Cataclysm*, shrouds itself, reforges | All of the above |

**Blessings** (`src/rpg/blessings.ts`) are fragments of techniques from other lives, offered three at a time after certain fights and leaning toward your loadout. There are 13; some combine:

- *Tempered Edge* plus push-ups shreds armour;
- *Static Mantle* plus a shield plus Storm Charge throws blocked hits back as lightning;
- *Full Circle* rewards using all four families;
- *Echo of Resolve* makes partial sets work at 70% or more;
- *Second Wind* and *Mirror Step* turn dodges into recharge and charge.

### Finishing a set early

Say **"Finish set"**, press **F** or gamepad **Y**, tap *Finish set* on the TV or the phone, or choose *Finish this set* in the pause menu. The verified reps (or whole seconds held) resolve as a **partial ability**:

- strength = 35% + 65% × (done ÷ target);
- 5 of 8 push-ups ≈ 76%;
- even one rep is worth 40%;
- sided exercises credit each side up to its target, so a lopsided set can't count double;
- a set with no verified work fizzles, and the ability isn't used up.

Pausing, hesitating or losing tracking never ends a set by itself. Reaching the target still completes it automatically. Nothing invents reps. Exhaustion never costs HP; only missed dodges do.

### Dodging (read the attack: duck or hop)

- **Fights are read visually. Nothing is spoken and no text names the height.** A HIGH swing means **duck** (a quick squat); a LOW sweep means **a small hop**.
- **Reading the attack.** Foes always show it in their body: **rearing up and back, with a glint above the head = HIGH**, and **dropping into a crouch and leaning in, with a glint at the feet = LOW**. The foe holds that stance as it charges across to you, then swings: an arc at head height, or a sweep along the floor. How much *else* shows it depends on the fight:
  - *obvious* (Training Yard, Iron Husk): a dashed line at head or foot height, plus a ▲ or ▼ marker;
  - *clear* (Bone Charger, Wisps): the dashed line only;
  - *subtle* (Acolyte, Warden): only the stance and the glint.

  The Training Yard adds one tip line: "Rearing up → duck. Crouching low → a small hop." The Sanctuary's **Attack cues** setting switches between *Learn as you go* (the default) and *Always obvious*.
- Each strike has a 2.6 s wind-up. The foe charges across during the last 0.65 s before impact.
- A correct move counts from 1 s before impact to 0.4 s after. Sequences (e.g. the Warden's LOW–HIGH–LOW) pause about a second between strikes.
- **Nothing counts until the phone has a still, standing baseline.** Standing up after push-ups can never be a dodge.
- **Out of view, the attack waits** ("Step into view — the attack waits for you"). If the camera loses you during the swing itself, the result is *unclear*: no damage. It is never counted as a failed dodge.
- **Couch fallback:** *Pause → Dodge with a controller* uses the gamepad d-pad ▼ (duck) and ▲ or A (hop), the keyboard (↓, and ↑ or Space), or the phone's Duck/Hop touch buttons.
- A missed dodge costs HP; shields absorb it first. If HP reaches 0 the character falls (see below).

### Voice commands

| Say | Does | Also on |
|---|---|---|
| **"Pause"** | Pauses gameplay and any set in progress | Start button, P, both hands up (standing), phone Pause |
| **"Resume"** | Leaves the pause menu | A / Enter, right hand |
| **"Finish set"** | Ends the current set now; verified work counts | Y, F, phone and TV buttons |
| **"Recalibrate"** | Quick camera recalibration; nothing is lost | Pause menu |

A few natural variants work: "okay pause", "finish the set", "I'm done", "continue", "re-calibrate". A command only fires when it's the **whole utterance**, give or take a filler word; "we should pause for a sec" does nothing.

Each utterance fires once. The same command is ignored for 2.5 s, and any command for 0.9 s. **Nothing is accepted while the game's narrator is speaking**, or for 0.7 s after, so the TV can't trigger itself.

Commands are mode-aware:

- "Finish set" exists only mid-set or in the pause menu, and can't advance dialogue or move the hero;
- "Resume" only works in menus;
- a command that doesn't apply shows "— not available right now" and does nothing else.

**Where it runs, and the privacy tradeoff.** Voice uses the **laptop's** microphone and the browser's speech recognition. Switch it on in the Sanctuary; the choice is remembered.

- **Chrome 139+** can recognise speech **on the device** once its English pack is installed. The game asks for that first, and the Sanctuary says *"Recognised on this computer"* when it's active.
- **Otherwise Chrome sends the audio to Google, and Edge to Microsoft, while listening.** That needs the internet and is not offline. The Sanctuary says so when this applies.
- **Firefox** has no speech recognition.
- Only matched commands are used. The game doesn't store or send transcripts itself.

**Why not the phone:** Safari's speech recognition is known to break down or stall alongside an active camera or video on iOS. The camera is the one thing that must never stop, so voice stays on the laptop. A fully offline recogniser (e.g. Vosk WebAssembly with a ~40 MB model) remains a possible follow-up.

### The Mirror of Unlived Lives

A node between fights. You can:

- keep your loadout;
- **change one movement** (pick a family and see its alternative);
- **step into another life** (reroll all four).

The change is always previewed before you commit. It follows the same eligibility rules, never happens mid-set or mid-fight, and leaves the workout done so far untouched.

### Haven

- The Haven fully restores HP.
- It then offers a few minutes of guided recovery: standing side reach or shoulder rolls, then cat-cow and child's pose.
- The movements are timed and spoken, with a soft synthesised ambient pad. Nothing is scored and no camera is needed.
- Raise your right hand (or press A) to move on; Start or P pauses.
- The memory fragment and Elara's line come **after** the movements end.

### Workout versus RPG

These are separate outcomes:

- **RPG defeat:** HP hits 0 from missed dodges. The character falls. **Reform and carry on** continues the workout at 60% HP (the Spark can't be restored this run); **End the session** goes to the summary.
- **Fitness completion:** sets done against about 20 planned.

Nothing physical is ever lost: every set is saved the moment it ends, through defeat, rerolls, quitting or reloading. The summary shows the two side by side:

- **Workout:** camera-verified reps per movement (left and right for sided movements), hold seconds, manual reps labelled separately, sets, Haven time, and steps marched between fights (controller travel isn't counted).
- **Where the time went:** in sets, between sets (choosing, dodging, rests, enemy turns), marching, Haven, and menus and story.
- **Expedition:** result, dodges (dodged, hit, unseen), loadout and blessings.

After a finished run, a quick **check-in** asks how the workout felt (too easy, about right, too hard), how much fun it was, and how the pacing was. Every question can be skipped, and the answers are kept with the session history.

**Playtest report** (on the summary) shows a plain-text account of the run: every set with reps against target, whether it was full or finished early, and how long it took; the time breakdown; each strike by height and cue level; the loadout; blessings; and the check-in. **Copy** or **Save .txt** it. It stays on this computer unless you do.

The last 60 sessions are kept (per-movement sets and volume, minutes, soreness, the check-in) so the loadout director can vary your workout and the Journal can show your training.

### Sore days, targets that adapt, and the Journal

**Sore today?** (Sanctuary) For upper body, legs and core, choose No, *Go gentle* or *Rest it*:

- *Go gentle* drops that family's targets to about 60% for the day.
- *Rest it* sits the family out; its ability rests and the other three carry the fights.
- Sore legs also ease cardio to 80%, since cardio is mostly legs.
- It's forgotten after a day.

**Targets adapt, without surveys.** Your per-set targets change slowly, between sessions, from what you actually did:

- **Up one step** after two sessions in a row where every set of that movement was full and your pace held. One session is enough if you answered "too easy" in the check-in.
- **Down one step** after a session where half or more of a movement's sets ended early or short, or you said "too hard" and it showed.
- **Otherwise it holds.**
- Sore days and *Take it easy* days never raise a target, and *Strong* days never lower one.

A step is one rep (two above 12), or 5 s for holds, always within the movement's range. The summary lists any changes under **Next time**, each with a one-tap *Keep*, and there's a *Keep my targets as they are* option for the gamepad. The only explicit question is the optional end-of-run check-in. Targets can still be set by hand in the Sanctuary.

*Sets per session* aren't scaled yet: they come from the route (about 12 short, 20 full). That belongs to the future workout director, once the playtests say how long runs really take.

**Journal** (Sanctuary) shows:

- the days you played in the last two weeks;
- sets per family over the last two weeks;
- each movement's current target and its last change, with the reason;
- recent sessions: outcome, sets, minutes, steps, how it felt, and soreness.

It's read-only.

**Phone lag, measured.**

- Every few seconds the PC pings the phone, and the phone timestamps its dodge readings and reps.
- From that, the playtest report states the real round trip and how long movements take to arrive over your Wi-Fi.
- This is a measurement only: dodge timing is unchanged.

### Movement Lab

Reached from the Sanctuary.

- **Movements:** try any movement for a short set. Afterwards you confirm whether the count matched what you did; *Yes* marks it checked for your setup.
- **Dodge practice:** four practice strikes, with the body or a controller.
- **Voice test:** status, engine, and the last command heard with its verdict.
- **Encounter select:** jump straight into any fight, a blessing, the Mirror or the Haven with your current loadout. It never touches a saved run.

### Camera tracking follows the game state

- The **body is only required when a mechanic needs it:** the camera check before the first fight, sets, the ready check and dodging.
- In the Sanctuary, on the path, in choices, blessings, the Mirror and the Haven there are no tracking warnings. The phone stops sending "what the camera sees" in menus and dialogue.
- In the tutorial trial with **Gamepad or keyboard** traversal, the "Tracking lost" banner and voice cue are gone, and the phone status says *Controller mode*.
- Camera connection and body visibility are separate: "Phone connected / Camera on" isn't an error just because nobody is in view.
- The camera and MediaPipe keep running through menus; nothing restarts.
- If you leave the frame between sets, the next set and any strike simply wait. There is no HP penalty and no failed dodge.

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

### Voice commands

Built in this round: see *Heart of Haze → Voice commands*. It runs on the laptop, and works in the tutorial trial too (pause, resume, finish set, recalibrate).

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

- **Figures:** glossy chibi figurines (hero, Elara, skeleton, stone golem, shadow mage, warden, training dummy).
  - **The hero** is a quiet, curious miniature adventurer: a big head (a little smaller than before), a tousled brown fringe swept to one side, and a neutral, attentive face with the faintest cheek colour.
  - His outfit is a muted burgundy tunic, a deep-teal cloak and short mantle over a linen collar, weathered leather and warm brass, and a slim sword with a brass guard.
  - At his collar is a small amber crystal, the Heart's light, which he shares with Elara's thread. In cinematics it glows softly, flares as he is reconstructed, and pulses with the heartbeat.
  - He blinks everywhere (trail, battles, cinematics), winces when hit, smiles a little on victory, and shows wonder at key story moments; his dialogue portrait uses the same faces.
  - The original bright mascot is kept as `heroClassic`; set `HERO_STYLE = 'classic'` in `src/phaser/diorama/figures.ts` to switch back.
  - Figures are separate sprites, never painted into backgrounds, so one design serves gameplay and cinematics. On the board they stand on round painted bases like game pieces. In battles they stand free, with a soft shadow that stays on the ground as they rear up, hop or charge.
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
npm test             # 275 automated tests
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

| Movement | Family | Equipment | View | Reliability | Detector and signal |
|---|---|---|---|---|---|
| Push-ups | Upper | — | side-on, floor | **stable** (playtested) | `PushupDetector`: elbow angle, adaptive top, debounce |
| Dumbbell rows | Upper | dumbbells + chair/bench | side-on, bent over | **experimental** | `RowDetector`: elbow angle plus wrist lift per arm; the body must be bent over with the legs standing (so push-ups can't count) |
| Bicep curls | Upper | dumbbells | facing | beta | `CurlDetector`: wrist from below to well above the elbow per arm; torso swing over 14° or a raised elbow rejects the rep |
| Squats | Legs | — | facing or side | **stable** | `SquatDetector`: thigh rise |
| Reverse lunges | Legs | — | facing | beta | `LungeDetector`: hips drop ≥ 0.32 thigh with the knees split ≥ 0.28 thigh; the side is the lower (back) knee; level knees (a squat) don't count |
| Jumping jacks | Cardio | — | facing | **stable** | `JumpingJackDetector` |
| High knees | Cardio | — | facing | beta | `HighKneesDetector`: each knee to within half a thigh of hip height; marching never gets there |
| Mountain climbers | Cardio | — | side-on, floor | **experimental** | `ClimberDetector`: shoulder–hip–knee angle per leg from a plank |
| Plank (hold) | Core | — | side-on, floor | beta | `PlankDetector`: straight, horizontal, supported line; now also over Connected Play |
| Dead bugs | Core | — | side-on, lying | **experimental** | `DeadBugDetector`: leg extension from tabletop, arms up |
| Standing cross crunches | Core | — | facing | beta | `CrossCrunchDetector`: knee drive plus the opposite elbow within 0.55 torso of the knee |
| Overhead press | Upper | dumbbells | facing | beta | `OverheadPressDetector`: both wrists from shoulder height to ≥ 1.75 upper arms above the shoulders (the lower hand counts). Mid-set pause needs a 3 s still hold, since the press itself ends hands-up |
| Lateral raises | Upper | dumbbells | facing | beta | `LateralRaiseDetector`: both arms from hanging (≤ 30°) out to about shoulder height (≥ 72°) |
| Goblet squats | Legs | dumbbells | facing | beta | `SquatDetector`, holding a dumbbell at the chest |
| Sumo squats | Legs | — | facing | beta | `SquatDetector`, wide stance |
| Glute bridges | Legs | — | side-on, lying | beta | `GluteBridgeDetector`: shoulder–hip–knee from ≤ 145° to a line (≥ 162°), lying with knees bent |
| Skaters | Cardio | — | facing | beta | `SkaterDetector`: hips bound ≥ 0.8 shoulder widths from your average centre, per side (anatomical axis, so mirroring can't swap sides) |
| Butt kicks | Cardio | — | facing | **experimental** | `ButtKickDetector`: heel to within 0.3 shin of the knee while the knee stays low (a high knee doesn't count). Experimental: the heel is behind the leg |
| Russian twists | Core | — | seated, facing | beta | `TwistDetector`: hands together travel ≥ 1.1 hip widths to each side, per side |
| Punch test (facing / side-on) | — | — | both | Lab only | `PunchDetector`: see *Punch test* below |
| Wall sit (hold) | Legs | a wall | side-on, standing | **experimental**, Lab only | `WallSitDetector`: knee 65–120° (beginner up to 140°), thigh within 28° of level (beginner 48°), back and shins upright. The camera can't see the wall, so a free-standing hold of the same shape also counts |
| Side plank (hold) | Core | — | facing, on your side | **experimental**, Lab only | `SidePlankDetector`: the lower shoulder tells which side you rest on; shoulders stacked, hips lifted into a line (≥ 150°, beginner 140° and knees allowed). The target is the total, half per side (see below) |

All the new movements start as **beta** (or experimental): they're eligible for random loadouts once you've checked them in the Movement Lab, and each has its own ability (Skyfall Hammer, Wingclip, Bastion Stomp, Rootbreaker, Upheaval, Slipstream, Cinder Kick, Whirling Ward).

**Punch test** (Movement Lab, not in fights). This checks whether one phone can read straight punches and tell left from right before Punch Away or the Unbound are designed around it. There are two stances:

- **Side-on, like push-ups.** The punch is a big, clear movement across the image. The catch is that the far arm is half-hidden, so left and right depend on the pose model keeping the labels straight.
- **Facing the phone.** Both arms stay visible, but the punch goes *toward* the camera, so it's read from the model's rough depth plus the elbow rising to shoulder height.

A punch counts for the arm that threw it, only once that fist comes back toward guard. To try it, throw a known sequence and compare the left and right counts.

**Wall sits and side planks** are timed holds, like the plank. The clock runs only while the position is valid; breaking it pauses the clock and keeps your time, and losing the camera never adds time. Both start the moment you're in position, with no 3-2-1. For the side plank, the target is the total, split evenly: once one side has held its half, holding that side adds nothing and the cue says *Switch sides*, so only the other side can finish the set. In Connected Play the PC tells the phone the target (a validated `holdTargetMs` on `EXERCISE_BEGIN`), because the phone is where the sides are told apart. The phone also reports the time credited to each side, and each saved set keeps it, so an uneven side plank shows up in the Lab result (*left 15 s, right 6 s*) and in target progression, which judges a side plank by its weaker side. Both are Lab-only until you've tried them for real.

**Sided movements** (rows, curls, lunges, cross crunches, skaters, Russian twists) count each side separately. The target is per side, and a set completes only when both sides reach it; unbalanced work never completes a set. Both arms curling together count once per arm.

**Why some are experimental**, with practical alternates:

- **Rows:** from a side view the far arm is hidden, so the rowing arm must be nearest the phone, and you turn around to switch sides. The anatomical side labels from a side view still need checking. Alternates: bicep curls, or push-ups.
- **Mountain climbers:** the two legs overlap from the side and blur at speed. Alternate: high knees, which are facing the phone like marching (proven).
- **Dead bugs:** lying side-on, the legs overlap, and only leg extensions are checked (the opposite arm isn't). Alternates: plank, or standing cross crunches.

**Adding a movement** means a registry entry and a detector. `src/exercise/detectors/limbCycle.ts` handles the common "limb goes out and back" pattern, so a new detector is mostly its measurements (see `movements.ts`). Combat needs no changes if it reuses an ability; a test checks that every family always has an equipment-free stable or beta option.

**Recovery** (`src/exercise/recovery.ts`) is a separate, unscored library for Havens: standing side reach, shoulder rolls, cat-cow and child's pose.

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
src/combat/       CombatEngine for the tutorial trial and classic mode
src/rpg/          expedition engine (abilities, enemies, blessings, turns, strikes), dodge reader + strike timing,
                  loadout director, workout records, expedition state/persistence/routes, story text
src/ui/expedition/ Sanctuary, path, RpgBattle, blessings, Mirror, Haven, summary, Movement Lab, set runner, dodge source
src/game/         progression, save (localStorage, validated), store, audio (WebAudio synth + speech), event bus
src/phaser/       diorama/ figurines, props, board, trail graph & walker, steering & collisions; pixel art & tiles for classic; scenes
src/ui/           React UI: TrialRun, Calibration, AutoBattle, Connected (pairing, remote calibration, controller status), gesture menus; classic UI
src/lab/          Detector Lab
```

Saved automatically: level/XP, gold, upgrades, abilities, defeated enemies, dungeon clears, location, settings (including turn step and sensitivities) and lifetime totals.

## Combat architecture: the earlier notes, resolved

The five obstacles listed last round were addressed like this:

1. **Ability is separate from exercise.** `rpg/abilities.ts` defines abilities per family, and each movement names its variant (`rpgAbility`).
2. **Enemies no longer prescribe exercises.** Weaknesses are multipliers and hints.
3. **Run state** lives in `rpg/expedition.ts`: loadout, blessings, HP, node, and the workout.
4. **Enemy attacks** are intent → wind-up → strikes → dodge window → resolve (`rpg/engine.ts`, `rpg/dodge.ts`), in their own `dodge` input mode.
5. **Battle pacing** is a small stage machine in `ui/expedition/RpgBattle.tsx` on pausable timers.

The notes below are kept for history.

## Toward the combat overhaul (architecture notes, previous round)

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

- **Marching between fights and visual battles (this round):**
  - **Automated:** `npm test`, **280 passing**. New tests check that:
    - every encounter on both routes sits at a real trail stop, in order and not shared;
    - board markers match the route;
    - the hero resumes from the last visited stop;
    - marching is tallied apart from sets.
  - **Headless Chromium, PC + phone through the real relay** (a scripted synthetic body):
    - **full standard route, start to finish:** the marched legs to all eight encounters, with the Mossy Shrine detour taken at the fork; 19 sets; strikes read from the foes' stance (7 of 9 dodged; the harness reacted late to the first two); victory; the march tally in the summary; no page errors;
    - **short route:** victory in 11 sets.
  - Screenshots were checked for the command menu (no longer covering foes), wind-ups, approaches and a leg's objective card.
  - **Not tested with a real person.** In particular: whether the stances read at TV distance, and how long a leg feels to march (about 40–90 s with the synthetic marcher).

- **Heart of Haze milestone (this round):**
  - **Automated:** `npm test`, **275 passing** (20 files), 73 of them new:
    - **Movements** (`tests/movements.test.ts`):
      - curls count per arm (both arms together = one each); swinging the body or raising the elbows is rejected; a half curl is partial;
      - rows count the rowing arm by side; the supporting arm, push-ups and standing curls never count;
      - lunges count by the leg that stepped back; squats and shallow dips never count;
      - high knees count knee drives; marching doesn't;
      - cross crunches need the opposite elbow;
      - mountain climbers and dead bugs count from their floor positions and not from standing;
      - every family has an equipment-free stable or beta movement; entries are well-formed; push-ups count exactly as before.
    - **Sets** (`tests/sets.test.ts`):
      - 5 of 8 push-ups then *Finish set* resolves exactly 5, and nothing counts afterwards;
      - pausing, 10 s out of view and 10 s holding still never end a set;
      - reaching the target still auto-completes;
      - finishing a plank resolves the whole seconds held;
      - sided sets complete only when both sides reach the target (3 left + 1 right doesn't);
      - Connected Play: sided reps need a side and both arms may land together; hold time can't run faster than real time or while paused; the phone's Finish button is validated and routed to the active set only; the phone bridge streams plank hold totals and lunge sides.
    - **Voice** (`tests/voice.test.ts`):
      - the four commands and variants match; commands buried in sentences don't;
      - one utterance fires once across interim and final results;
      - debounce works, and nothing is accepted while the narrator speaks;
      - *Finish set* is refused in exploration, dialogue, ready, dodge and calibration; *Resume* only works in menus;
      - dodge mode only takes a duck, a hop or a pause.
    - **Combat** (`tests/rpg.test.ts`):
      - effectiveness scaling, including sided credit and the Echo of Resolve floor;
      - recharge (never two turns running; three abilities always ready);
      - a zero-rep set fizzles without using the ability; partial vs full damage;
      - armour blunts until broken, and stagger cracks it;
      - a charge lands unless disrupted; area and chain hit a pack; lightning overloads wards and fire is resisted;
      - **the boss is beatable without any upper-body movement**;
      - blessing interactions: Tempered Edge, Aftershock, Static Mantle, Full Circle, Quickened Heart, Second Wind;
      - missed dodges cost HP (shield first) while dodged or unclear cost nothing; defeat only comes from missed dodges.
    - **Dodge reading and timing:**
      - no baseline while rising from a squat, so standing up is never a dodge;
      - a quick squat is a duck and a small hop is a hop; marching is neither;
      - a hop too early doesn't count;
      - out of view the strike waits; lost mid-swing is *unclear*, never a hit;
      - the controller fallback works.
    - **Loadouts and records** (`tests/expedition.test.ts`):
      - 200 random loadouts respect equipment, exclusions, experimental opt-in and families;
      - rows need a support;
      - only checked movements are picked normally, with a first-time check otherwise;
      - a fully excluded family sits out;
      - rerolls change the pick when possible;
      - demanding recent movements are picked less often;
      - targets never scale with enemies;
      - a reroll keeps the sets done; defeat and victory both keep the record;
      - suspend and resume restore the node, HP, blessings, targets and workout; a corrupted run is dropped;
      - the main save keeps setup, targets, checks and history.
    - **Tracking follows the game state** (`tests/tracking_state.test.ts`):
      - gamepad exploration, menus and the ready check work with nobody in view;
      - the phone sends no "camera sees" warnings in menus or dialogue, but does in dodge mode;
      - a set doesn't start and strikes don't run until you're tracked;
      - camera loss mid-strike costs no HP.
  - **Headless Chromium, PC + phone through the real relay** (a scripted synthetic body on the phone):
    - **A full short expedition, start to finish:**
      - pairing and the Sanctuary with nobody in view; the path; the camera check before the first fight;
      - 14 sets (push-ups, squats, jumping jacks, cross crunches counted L 8 / R 8);
      - a blessing; the Mirror (a full reroll, previewed: Cross Crunches → Plank);
      - the Haven stretches with calm audio and the memory after them;
      - victory over the Warden;
      - the summary and history were recorded;
      - no page errors.
    - **A Movement Lab encounter (Iron Husk):**
      - voice *pause* mid-set → paused; *resume* → back; *finish set* → resolved with the reps so far;
      - three strikes (LOW, HIGH, LOW) all **dodged** by the phone's duck/hop reading over the network.
    - **Dodge practice:** 4 of 4 dodged.
    - The tutorial-trial regression (guided trail, four battles, pause and recalibrate) passes.
  - **Not verified:** everything physical. See the checklist below.

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

## Physical playtest checklist (Heart of Haze)

**New this round:**

- **Movement Lab:** try the new movements (overhead press, lateral raises, goblet and sumo squats, glute bridges, skaters, butt kicks, Russian twists) and answer *Did the count match?*.
- **Punch test, both stances:** do the left and right counts match what you threw?
- **Sore today?** Use it the next time you're sore.
- **After a couple of expeditions:** do the *Next time* changes feel right? Check the Journal.
- **Playtest report:** read the *Connection* line.

**The opening (new).** Watch it on the TV from the couch:
- Are the lines readable at your distance?
- Does the pacing feel right when you press on at your own speed?
- Is the rain audible but never covering the music or the heartbeat?
- Does Elara feel approachable?

Then note how the ritual feels on your second and third visits.

**Nothing in the expedition has been tried by a real person yet.** Suggested order for one or two sessions. After each expedition, open **Playtest report** on the summary and copy it into your notes.

1. **Voice (laptop, Chrome or Edge):** Sanctuary → *Voice commands on* → allow the mic.
   - The Sanctuary says whether recognition is on this computer or online.
   - From your play spot with game audio on, say "Pause" on the path; the chip should show *Pause — not available right now* (nothing to pause there).
   - In a set, say "Pause", then "Resume", then "Finish set".
   - Note misses and false triggers (TV speech, the narrator, conversation).
2. **Movement Lab → Movements:** try each movement you might use, and answer *Did the count match?* honestly. In particular:
   - reverse lunges: does it report the correct side?
   - bicep curls: does a clean curl count, and does a swing get rejected?
   - high knees and cross crunches;
   - plank from your wall/floor placement;
   - rows, if you have a bench: does the rowing arm need to face the phone as described?
   - mountain climbers and dead bugs: expect trouble; note what happens.
3. **Movement Lab → Dodge practice** with your body: is a quick squat enough for HIGH? Is a small hop enough for LOW? Is the 2.6 s wind-up generous or too slow?
4. **A Short expedition** (about 12–15 min), then a **Full** one on another day:
   - finish at least one set early on purpose;
   - after push-ups, check that nothing attacks until you stand and say you're ready;
   - leave the frame between sets (the next strike should wait) and during a swing (*unseen — no damage*);
   - try *Pause → Dodge with a controller* from the couch;
   - pause and recalibrate mid-fight;
   - save and stop at a phase boundary, close the browser, then resume from the title screen;
   - **Pause → Save and leave** in the middle of a fight, and once in the middle of a set; resume (ideally the next day) and check that it continues the same turn, with no set repeated;
   - on a new day, check that *A new day* appears, that a *Rest it* family sits out, and that the Journal shows one row per sitting;   - check that the summary's workout numbers match what you did.
5. **Marching and reading foes:** do the legs between fights feel like pacing or like padding? Can you tell rearing (duck) from crouching (hop) on the *subtle* fights without any text?
6. **Couch check:** in the tutorial trial with *Gamepad or keyboard* traversal, sit out of view. There should be no tracking warnings while exploring.

## Needs physical testing (earlier rounds; still not verified)

The earlier playtest scenarios:

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

## Known limitations and suggested follow-ups

- **Voice:** online unless Chrome's on-device pack is installed. Follow-up: a small offline keyword spotter (Vosk WASM) on the laptop if the online path is unreliable or unwanted.
- **Experimental detectors:** rows, mountain climbers and dead bugs are built from single-view geometry and need real footage in the Detector Lab. Follow-up: record a few sets with the Lab's video mode and tune thresholds.
- **Dodge thresholds** (duck = shoulders drop a third of a torso; hop = both ankles and the hips lift) are guesses until tried; the timing constants live in `rpg/dodge.ts`.
- **Balance:** enemy HP, blessing values and the "about 20 sets" route are first-pass numbers.

- Connected Play needs the relay running on the PC (`npm run play`). It isn't available from a static deployment such as Vercel.
- One controller per game. Multiplayer is out of scope.
- The phone's calibration is kept only for that browser tab. If the tab is closed, re-pair and recalibrate (*Pause → Recalibrate*).
- The first connection to a self-signed certificate shows a browser warning. Use mkcert to avoid it.
- **Single camera placement** is plausible but unproven for push-ups. The floor check and manual fallback exist for this reason.
- Mid-set pause gestures need a body in view. On the floor, say "Pause" (laptop voice), or use touch, keyboard or gamepad.
- Voice needs Chrome or Edge on the laptop and, unless Chrome's on-device pack is available, an internet connection (see Voice commands).
- Expedition content is a test route: two fixed routes, six enemy types and 13 blessings. There is no procedural map and no full story yet.
- In the expedition, only the first fight and later physical nodes check the camera; a Lab encounter also checks it first.
- Experimental movements (rows, mountain climbers, dead bugs) and all beta movements need a check on the real setup.
- Guided traversal uses one hand-built trail for the meadow. New areas need their own trail graphs.
- Roll correction only undoes sideways tilt. Pitch and perspective from a phone leaning against a wall are not corrected.
- The camera runs continuously; expect battery drain and warmth. Keep the phone on a charger.
- **iOS Safari:** the camera needs HTTPS. Screen wake-lock needs iOS 16.4+. Keep the page in the foreground. Older iPhones may need the *Fast* tracking model.
- The game does not judge exercise form or joint loading and makes no medical claims. Form cues (e.g. "keep your body still") are about what the camera needs to count.
