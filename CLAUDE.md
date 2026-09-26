# FITBOUND: Heart of Haze

A personal fitness-powered fantasy roguelite. Real exercises, counted by a phone camera, power turn-based combat on a PC or TV.

## Read first

**`docs/design-bible.md`** is the design bible. Read it before any design, gameplay, story, art or pacing work. It records the creator's vision, principles and canon, and it outranks earlier habits of this codebase. Pay most attention to:

- §3, the non-negotiable principles;
- §5 and §6, the narrative canon, including what must not be revealed early;
- §31, the testing levels;
- §34, the open questions. Don't treat anything there as settled.
- The final note, "Direction, not permission": future features are settled concepts, not a to-do list.

`README.md` is the player and technical manual: how to run, play and test, and what has been verified.

## Keeping the bible alive

- The creator owns the vision sections. Propose changes to them; don't make them silently.
- At the end of each development pass, update **§32 Current Development Status** and **§34 Open Questions**. Add a line to the revision log at the end of the bible.
- If a creator decision contradicts the bible, point out the mismatch and propose the edit.
- Story text must follow the canon (§5–§9), and speculative lore must never be presented as settled:
  - The Heart has lost its Spark, and time is coming apart. Keep it that simple: no multiverses, paradoxes or consciousness theory.
  - The Heart is benevolent, never a hidden villain.
  - The protagonist is simply reconstructed by the Heart. There is no anchor and no special "Echo" identity; "Echo" may only name ordinary Haze reconstructions.
  - Elara is warm and knows more than she says, but she is never a villain. Her lines are never spoken by the browser's synthetic voice. She disappears after the second reignition, and her resolution is undecided, so don't write one.
  - The Sanctuary rains until the first reignition and the rain never returns. Never explain why.
  - Keep the metaphor (stagnation → momentum) unspoken. Never present exercise as a cure for anything.
  - Real historical figures are fictional Haze reconstructions: no gore, and no glorifying or Lost Cause framing of Confederate figures.
- `docs/proposals/` holds proposals. They are not canon until folded into the bible.

## Honesty about testing

Use the bible's four levels:

1. implemented;
2. passing automated tests;
3. physically playtested;
4. reliable for normal play.

Synthetic poses and headless browser runs never count as a physical playtest. Never claim that a real person has tested something unless the creator reported it.

## Invariants (don't break these)

- **Privacy.** Camera video never leaves the phone; only interpreted movement data is sent. Don't store or record video. Don't add cloud speech recognition without stating the privacy tradeoff. Never describe browser speech recognition as guaranteed offline.
- **Controller messages.** Validate every incoming controller message by its type, values, session and current game state. This happens in `src/net/gate.ts` and `remoteSet.ts`.
- **Exercise and combat safety:**
  - Never trigger an enemy attack during an exercise set.
  - Don't start dodge timing until the player is ready.
  - Losing camera tracking is never a failed dodge.
  - Exhaustion is never a hidden game-over. Voice is never the only way to pause.
- **Sessions and expeditions:**
  - Each real sitting is its own workout session, with its own readiness, record, Journal entry and progression. An expedition may span several sessions.
  - Resuming never repeats completed physical work. Saves happen only at safe points, never mid-set or mid-dodge.
  - A second boss or a longer story never adds exercise volume by itself.
- **Falling** ends the expedition, with no reignition, but it never erases workout history, discoveries, scene flags, traces or quest progress.
- **Counting:**
  - Controller-driven movement never counts as physical activity.
  - Never invent reps.
  - Harder enemies never mean more reps.
  - Losing a run never erases workout history.
- **Couch play.** No tracking-lost warnings in states that don't need the body.

## Commands

- `npm test`: Vitest unit tests.
- `npm run build`: type-checks, then builds.
- `npm run typecheck`
- `npm run play`: builds, then starts the local relay (`server/relay.mjs`). The PC is on :8080 and the phone controller on :8443 over HTTPS.

Headless end-to-end checks drive a PC page and a phone page through the real relay with Playwright. The phone page gets a scripted synthetic body; `src/testing/poses.ts` has pose helpers. Those scripts are kept outside the repo.

## Map

- `src/exercise/`: the exercise library (`registry.ts`, with stable, beta and experimental tiers), detectors, and set sessions.
- `src/controller/`: the phone app. It runs pose tracking and streams interpreted events.
- `src/net/`: the PC side of Connected Play: the host, the message gate, and remote sets.
- `src/input/`: InputHub modes and commands (keyboard, gamepad, voice).
- `src/rpg/`: combat engine, abilities, enemies, blessings, dodge reading, expedition routes (the retired short route stays only for old saves), loadouts, workout sessions and records, and story text (`story.ts`).
- `src/ui/expedition/`: Sanctuary, travel, battle, events (Mirror, Haven, blessings, summary), and the Movement Lab.
- `src/phaser/`: scenes and procedurally painted diorama art. `RpgScene` stages expedition battles; `DioramaScene` is the trail board.
- `src/story/`: cinematics. `cinema.ts` holds the script format and runner, plus the voice-line hook. `scripts.ts` holds the opening and the ritual.
- `src/phaser/scenes/CinemaScene.ts` and `src/phaser/diorama/cinemaArt.ts`: the cinematic stage and its art (the Sanctuary, the Heart, the memories). `src/ui/Cinema.tsx`: the dialogue overlay.
- `src/trial/`: the tutorial Motion Trial.
- `tests/`: unit tests.
