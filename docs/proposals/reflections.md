# Proposal: the Reflections, a minimal pose-copying system

**Status:** for approval. Nothing is built.

**The plan (bible §9.7):**
- Document the Reflections now as planned content.
- Prototype **one** Reflection in the Movement Lab only after the first two-fracture expedition works.
- Verify on a real body, in the creator's room, that copying poses is satisfying and reliably recognized, before building more.

**Written:** 2026-09-26.

---

## 1. What it has to do

- **Show a pose,** have the player copy it, and hold it with control for a few seconds. Then the next pose.
- **A Reflection resolves by mirroring,** not by an HP bar. Losing balance **pauses** the hold; it never deals damage.
- **Allow variations** (a supported balance, a shorter stance) and **alternatives** for inaccessible poses.
- **Reuse what exists:**
  - the pose tracker;
  - the hold machinery (the plank, wall sit and side plank detectors already time a valid position, pause when it breaks, and cap per-frame time);
  - calibration;
  - the guided-routine demonstrations;
  - the interlude scenes.
- **Stay small.** It is not a general yoga recognizer.

---

## 2. The system: pose templates checked with simple angle rules

### A pose is data

```ts
interface PoseTemplate {
  id: string;                    // 'warrior2', 'mountain', 'tree_supported'
  name: string;                  // "Warrior II"
  view: 'front' | 'side';        // where the phone should be
  holdS: number;                 // seconds of controlled hold that count as "matched"
  checks: PoseCheck[];           // all must pass (with tolerances)
  cue: string;                   // what to say ("Arms out long; bend the front knee")
  demo: DemoKind;                // the looping figure shown
  easier?: string;               // id of an accessible variant (e.g. 'tree_supported' → 'tree_toes_down')
}

type PoseCheck =
  | { kind: 'angle'; joint: 'knee' | 'elbow' | 'hip' | 'shoulder'; side: 'left' | 'right' | 'either' | 'both'; min: number; max: number }
  | { kind: 'level'; from: LandmarkName; to: LandmarkName; maxTilt: number }    // e.g. arms horizontal
  | { kind: 'above'; a: LandmarkName; b: LandmarkName }                        // e.g. wrists above head
  | { kind: 'stance'; minWidth: number };                                       // feet apart, in hip widths
```

Every check is a **2D angle or position rule** of the kind the existing detectors already use (`angle`, `inclineFromHorizontal`, `mid`, visibility gating), with a generous tolerance.

**What is left out on purpose:**
- no machine-learned pose classifier;
- no scoring of how pretty a pose is;
- no depth-dependent rules, since the camera's depth estimate is unreliable, as the punch test showed.

### One detector plays a sequence

A `PoseSequenceDetector` implements the existing `ExerciseDetector` interface as a **hold** (the same SETUP → HOLDING ⇄ PAUSED machine as the plank):

- **It holds while** every check of the *current* pose passes, after a short settle (≈0.5 s). Once `holdS` is reached, the pose is matched and the next one begins.
- **It pauses** when a check fails or tracking is lost. Accumulated hold time is kept; losing balance never costs anything.
- **It reports** per-pose matched time and which check is failing, so the cue can say *"lower your arms to shoulder height"* instead of a vague "not quite".
- **Variants:** at any time the player can switch the current pose to its `easier` version, by voice, the controller, or after about 20 s without settling. It's recorded, never penalized.

Because it is a hold, the rest comes for free:
- Connected Play: the phone runs it and streams the hold, validated by the existing gate and remote set;
- pause and resume, and manual fallback ("I did it"; recorded as manual);
- workout records and the workout-time categories.

### The encounter

A Reflection encounter is a **node kind** (`reflection`) that can replace one eligible ordinary fight, keeping the fight's place in the budget.

1. The Reflection's introduction: full the first time, short after (§8).
2. A sequence of **3–4 poses**, each demonstrated by the Reflection's figure. Each one matched resolves a quarter of the encounter.
3. A short closing line, and a modest reward (a blessing choice, like a won fight).

**Time:** about 2–3 minutes. It counts as **core** workout time, since it replaces a fight.

**No HP loss, no dodging, no enemy turn.**

---

## 3. The prototype (once the two-fracture expedition works)

**One Reflection:** the **Medieval knight of stillness**, with 3 poses:
- **Mountain** (front view): standing tall, arms by the sides, shoulders level. An easy calibration pose.
- **Warrior II** (front view): feet wide, front knee bent 90–130°, the other leg straight, arms level at shoulder height.
- **Supported tree** (front view): standing on one leg with a hand on a wall or chair, the other foot resting at the ankle or calf.
  - Its check is only "one foot off the floor, hips level".
  - Its easier variant is toes down.

**Where:** the Movement Lab, under a new *Pose test*:
- try each pose on its own, with live check readouts (which rule passes or fails, and the angles);
- then the three-pose sequence;
- then the encounter as it would appear in a fracture.

**Validation questions for the physical test:**
1. Does each pose register within a couple of seconds of getting into it?
2. Does it stay registered while you're genuinely still, without flicker pausing the hold?
3. Does a clearly wrong pose stay unregistered?
4. Is copying a figure's pose *fun*, compared with a set of squats?
5. Is the front view workable in your room at your usual phone distance?

**Only if those answers are good** would a second Reflection, or the random replacement in expeditions, follow.

**Cost:** small to medium. It needs a pose-template file, the sequence detector with synthetic tests, the Lab pose test, one figure (the knight), and an introduction scene. It needs no new tracker, calibration or network messages.

---

## 4. Decisions for later

- **Appearance chance** once built. It starts modest, is capped at one per expedition, and is never a miniboss or main boss (bible §9.7).
- **Hold length per pose.** 5–10 s is proposed; it's physically tuned.
- **Whether a Reflection has a failure state at all.** Proposed: no. It always resolves, just more slowly if poses are hard. The player can use the easier variants or "I did it".
- **The family's shared visual motif** (for example a mirrored silver outline on each era's figure) and its musical motif.
