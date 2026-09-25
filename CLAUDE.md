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
- Story text must follow the canon, and speculative lore must never be presented as settled:
  - the Heart is benevolent;
  - the Echo truth is not revealed early;
  - Elara is sympathetic, never a simple traitor.

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
- `src/rpg/`: combat engine, abilities, enemies, blessings, dodge reading, expedition routes, loadouts, workout records, and story text (`story.ts`).
- `src/ui/expedition/`: Sanctuary, travel, battle, events (Mirror, Haven, blessings, summary), and the Movement Lab.
- `src/phaser/`: scenes and procedurally painted diorama art. `RpgScene` stages expedition battles; `DioramaScene` is the trail board.
- `src/trial/`: the tutorial Motion Trial.
- `tests/`: unit tests.
