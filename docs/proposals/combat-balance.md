# Proposal: partial-set rules and boss balancing

**Status:** for the creator's approval before any combat change. Nothing described here as "proposed" has been changed in the game.

**What exists:**
- A balance harness, `src/rpg/sim.ts` and `tests/balance.test.ts`, that plays fights through the real engine with scripted players.
- An experiment-only hook that lets the harness try other partial-set curves. The game never uses it.

**Written:** 2026-09-26.

---

## 1. What the harness shows today

**How it measures:**
- Each encounter of today's route is played 400 times per player type, with random one-ability-per-family loadouts, from full HP, without blessings.
- **The players:**

  | Player | Share of each set done | Dodges | Picks abilities |
  |---|---|---|---|
  | careful | full sets | 85% | reads the hints |
  | partial | 70% | 80% | reads the hints |
  | tired | 40% | 70% | reads the hints |
  | careless | full sets | 60% | at random |

- Numbers are **sets to win** (median / 90th percentile).
- Regenerate the full table with `BALANCE_OUT=out.md npm test -- balance`.

| Encounter | careful | partial 70% | tired 40% | careless |
|---|---|---|---|---|
| Training Yard (dummy) | 2 / 2 | 2 / 2 | 2 / 3 | 2 / 3 |
| Rusted Causeway (Iron Husk) | 5 / 7 | 6 / 8 | 7 / 10 | 6 / 9 |
| Bone Field (Bone Charger) | 4 / 4 | 4 / 5 | 6 / 6 | 4 / 6 |
| Drifting Hollow (3 Wisps) | 2 / 5 | 2 / 5 | 3 / 6 | 4 / 6 |
| Veiled Stair (Hollow Acolyte) | 5 / 8 | 7 / 11 | 10 / **17** | 7 / 11 |
| **Before the Spark (Warden)** | **10 / 17** | 12 / **24** | 17 / **26** (80% wins) | 16 / **28** |

**What it means:**
- **A careful player needs about 28 sets for the whole route,** against a plan of about 21. The headless run with a synthetic body took 19, but it had blessings and good luck. This is the volume trap you were worried about, measured.
- **The Warden is the problem.** A median of 10 sets is already a lot, and the tail is long: 17 to 28 sets at the 90th percentile.
  - Its summoned Wisps, its reforged armour and its shroud keep undoing progress.
  - The fix is its mechanics, not a finishing rule.
- **The Acolyte's re-woven ward** hurts tired players most: 17 sets at the 90th percentile.
- **The 35% floor matters most exactly where it should:**
  - With a plain linear curve, a tired player beats the Warden only **40%** of the time and needs 26 to 36 sets. With today's curve it's 80% and 17 to 26 sets.
  - So the floor isn't a free gift. It is what stops fatigue from turning into a spiral of more and more sets.

---

## 2. Partial-set rules (proposed)

### The curve for numeric effects (damage, shield, heal)

Replace today's `0.35 + 0.65 × share` with:

> **Full effect from 90% of the target.** Below that: **25% for any verified work, plus 75% of the share done** (of the 90%).

| Share of target done | Today | Proposed |
|---|---|---|
| 1 rep of 10 (10%) | 42% | 33% |
| half (50%) | 68% | 67% |
| 70% | 81% | 83% |
| 90% (e.g. 9 of 10) | 94% | **100%** |

**Why these changes:**
- **The 90% band** absorbs a missed rep or two, so a tracking hiccup (or a rep the camera doubted) doesn't cost the full effect. This is the "detector failure isn't physical failure" rule, applied to combat.
- **The lower floor (25%)** still recognises any verified effort. It makes a token single rep worth less than now, so the RPG never rewards doing as little as possible. And it keeps enough value that a genuinely tired player isn't pushed into a long tail.
  - In simulation, together with the HP changes in §3, the tired player's Warden fights stay about where they are today, while careful play gets shorter.
- **The Echo of Resolve blessing** keeps its meaning: partial sets never below 70%.

### Effects by ability type

| Effect | Rule |
|---|---|
| Damage, shield, heal | The curve above |
| **Holds** (e.g. plank, wall sit) | The same curve on seconds held. For split holds (side plank), the share is the *weaker side's*, as target progression already uses |
| **Binary effects:** disrupt/interrupt, armour break, burn, Storm Charge | Trigger at **half the target or more**, unscaled. Below half, only the numeric part lands |
| Stagger build-up | Full at half or more; none below half. Stagger decides whether a charge is cancelled, so it needs a clear threshold |
| Counter stance | Its reflected fraction scales with the curve |
| Sided sets | Per-side credit, each side capped at the target, then averaged (as today) |
| No verified work | Fizzles and **isn't spent** (as today): there's never pressure to push on |

### Tracking failures

- **Manual reps** from the fallback power abilities exactly like camera reps. The history labels them "manual".
- **Proposed:** after a tracking stall, *Finish set* offers **"I did them — count the target"** (recorded as manual). The player is never short-changed by the camera.
- **A lost camera** never makes a set count *against* the player, and never counts as a failed dodge.

### Fatigue shaping tactics, without penalties

- The Workout Director already knows each family's sets this session.
- **Proposed:** after about 3 sets of a family in one fight, its card shows *"You've worked this a lot — another family might feel better"*. It's information only: no damage penalty, and no blocking.

---

## 3. Boss balancing (proposed approach)

### Targets, not limits

| Encounter | Careful player (median) | Partial 70% (90th percentile) |
|---|---|---|
| Ordinary fight | 3–4 sets | ≤ 7 |
| Miniboss | about 5 | ≤ 8 |
| Main boss (all stages) | 6–7 | ≤ 10 |
| **Whole expedition** | **about 21–24** | — |

**The tired player:**
- wins bosses at least 75% of the time within 12 sets at the 90th percentile;
- otherwise uses suspend or concede, which already work.

The allowances are **balancing targets**: nothing stops a fight at them, and nothing wins it for you.

### How to hit them: mechanics first, then HP

1. **Phases.** A boss's HP is split into 2 or 3 phases. Each phase break:
   - changes the pattern visibly;
   - ends that phase's tricks (for example, its summons leave and its shroud drops);
   - is a natural safe point.

   Progress never undoes itself: no heals, no re-armouring beyond a phase's own trick. This removes the Warden's long tail.
2. **Openings.** A staggered or disrupted boss takes **+50% from the next hit**. Good reads shorten fights; volume doesn't.
3. **Caps on self-repair.** Ward and armour regrowth are capped per phase. Today's re-woven ward is what makes the Acolyte drag for tired players.
4. **Only then, HP.** Tune until the harness bands pass. In simulation with the curve above, a first pass looks like this: the Husk ×0.8, the Acolyte ×0.85 and the Warden ×0.65 bring the route to about **24 sets** for a careful player and the Warden to 7 / 12. The Warden's tail stays long until it gets phases, which is why phases come first.
5. **The harness becomes a regression test.** Each new encounter must land in its band before it ships. The weights and players stay tunable as real playtests come in.

### What doesn't change

- No automatic victory.
- No finishing window.
- No higher rep targets for harder enemies.
- Physical failure never becomes RPG death by itself.

---

## 4. Proposed order (after approval)

1. The new curve and per-type effect rules in `engine.ts`, with tests.
2. The phase support and "opening" rule in the engine. Each is used by the Green Knight's two stages and by future bosses.
3. The Warden and Acolyte mechanics fixes, then the HP tuning against the bands, with the balance bands asserted in `tests/balance.test.ts`.
4. *"I did them — count the target"* after a stall.

None of this can be judged from simulation alone. The harness says whether the numbers fit the plan. Only a real playtest says whether the fights *feel* fair when you're tired.
