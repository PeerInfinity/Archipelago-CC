# Seedling hammer-phase FADE-MOVE — move during latched fades (`FADE_MOVE`, `FADE_MOVE_ATTACK`, both OFF)

Session `seedling-hammer-fade-move` (Opus, cloud), planner `seedling-hammer-phase-planning-10`. ⚖ The user approved the
design on 2026-11-16 (*"Approve design, build after flip (Recommended)"*, *"Launch when flip lands (Recommended)"*).
No follow-up from the planner arrived; the scope is the brief's.

## 1. Start, head, branch

| | |
|---|---|
| Start SHA | `ff4077ff2fe99a3a247b1a6f428c1ca78cc1fab4` (origin/main, train 132; WALLFLYER kill-arm flip landed) |
| Commits | phase 1 `2d6a6a32` · phase 2 `2b54fdcb` · solver-surface census `e69e9e4f` · kill-lock decline `58a025ea` (the code head) · evidence commits · this report (last) |
| Branch | `seedling-hammer-fade-move` (the brief's) |
| Switches | `solverBot.FADE_MOVE` (`SEEDLING_FADE_MOVE=1`, `withFadeMove`) and `solverBot.FADE_MOVE_ATTACK` (`SEEDLING_FADE_MOVE_ATTACK=1`, `withFadeMoveAttack`; needs FADE_MOVE). Both OFF (`*_DEFAULT = false`), both in `SOLVER_ENV_NAMES`. Decisions run on the **solve worker** thread (no main-thread mapper reads them) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-fade-move-evidence/` (`w0/` base page rows, `node/` replays, `game/` p4g witness rows, `survey/`, `census/`, `tools/`) |
| Environment | bootstrap `--seedling`; node v22.23.4; 4 cores; `:8000` `serve-nocache.py` started by this session. The container restarted once, near the end; only the ATTACK survey arm was lost, and it was re-run |

## 2. The answer first

**The one thing to know first:** on the L12 keylock legs, the mouth of the door IS the stance. The key line sits
under the lock, so "move toward where you will want to be" has nowhere to go. What makes them hitless is moving *away*:
**a hitless refuge in the room, found on the segment's fork, stood at until the fade ends.** The lock opens on the
same tick, and the plan length is unchanged.

| | OFF (= base) | `FADE_MOVE` ON |
|---|---|---|
| L12 keylock legs 127/128/160/161/171/172, model | 6 × 2 punches | **5 hitless** (127, 128, 161, 171, 172) at OFF's exact tick counts; 160 keeps its 2 |
| the same, **p4g game** (page sweep, `--solver-env=SEEDLING_FADE_MOVE=1`) | 6 × 2 hits (`exact`, the model's ticks) | **5 × 0 game hits**, 0 divergences, `done`, flag cleared; 160: 2 |
| route survey `--through=end` | 224 SOLVED / 26 REFUSED | 224 / 26, **0 movers, no step gains a hit** |
| acceptance md5 | `391322d681b7aa0229d94b3f6906d024` | — (OFF at head: `391322d681b7aa0229d94b3f6906d024`) |

- **160:** its full pass latches with `puncher@416,256` 10 px away, and no ring cell is hitless. The dashless pass does
  find one (680 t, hitless), but `betterAnswer` keeps the shorter 632 t punched plan. That is the JS arc's ranking,
  the same as L30's key 308 (§3).
- **Phase 2 (`FADE_MOVE_ATTACK`):** built. On the target rows it ships nothing new. It killed the puncher hitless once,
  in 172's dashless pass, which is not the shipped plan. Its survey arm is in §5.

## 3. The reproduction (measured)

**Page, at base** (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g
--keys=<the six> --capture-requests`). Leg ids at this SHA = W44's. Rows are in `w0/rows-base.jsonl`.

| leg (key) | plan | game hits (t, x) |
|---|---|---|
| 127 `level_12__r0c19 <- in_L35_32_64 -> location:L12 flag 4: bosslock@416,240 cleared` | 494 t | 433 (428.40), 474 (445.88) |
| 128 `… <- in_L35_32_64 -> … flag 5: bosslock@432,240 …` | 541 t | **493 (445.25), 520 (445.92)** = W44 |
| 160 `… <- in_L95_624_64 -> … flag 4 …` | 632 t | 575, 615 |
| 161 `… <- in_L95_624_64 -> … flag 5 …` | 610 t | 562, 589 |
| 171 `… <- in_L95_624_80 -> … flag 4 …` | 672 t | 610, 652 |
| 172 `… <- in_L95_624_80 -> … flag 5 …` | 675 t | 627, 654 |

**Node replay of the captured requests** (`tools/replay.mjs`, the worker's own dispatch). OFF gives the same plans
and the same hit ticks, all `punch` from `puncher@416,256`. The census (below) counts one keylock wait per pass on
each leg: the key line latches (128: t461 in the dashless pass, t491 in the full one), and ~80 ticks of empty
input follow in punch reach. The brief's "≈80 t idle in reach" is confirmed.

**L30 key 308** (`level_30__r2c10 <- in_L31_160_384 -> location:L30 flag 0: bosslock@64,32 cleared`), captured on the
page (`w0/rows-308.jsonl`: 191 t, game hits t151, t171). **It IS a fade wait.** The page row's `verbs` reads
`['walk']`, but the solver's own census counts the keylock wait in both passes: the full pass latches at t111, and
`bobsoldier@48,80` lands t151 (body), t171 and t191 (sword, the death) inside the fade. ON, the fork finds no hitless
move. The attack dwell is hit at dwell tick 39. Every refuge on 16-64 px rings is hit, or has no corridor.
The hitless plan is the dashless pass's 255 t. `betterAnswer` (`jsRuntimeSolver.js`, plan length only) keeps the
191 t dying one. ⇒ **js gate (js-20), report only**, as the brief anticipated. FADE_MOVE does not reach it.

## 4. Design and change; OFF identity

**Census first** (`FADE_MOVE_COUNTS.waits`, a pure counter that counts OFF too and changes no output). It has one row
per covered wait reached: `keylock` (`execKeylock`, at the tick the key line latches), `latched` (`execHold`'s
`room = -1` group arm), `killlockChaser` and `killlockPress` (before each arm's fade loop).

**Phase 1, `fadeMoveTry`.** It is asked where today's empty-input loop starts.

Every option is played on the **segment's fork** (`ctx.fork`) with the exact model and its billed hits, never by
pricing alone:
1. **The still wait**, on a fork, until the executor's own open test holds, inside the wait's bound.
2. **The mouth**: `preLockStance`, ⚖47's "tile before the lock". It is a target only when the route to `ctx.aim` does
   not plan with the activator shut, and only if it is nearer the opening than where the player already stands.
3. **The refuges** (only when the still wait is hit, which is L12's case). These are free cells on rings of
   16/24/32/48/64 px round the mouth, or round the player when there is no mouth. Cells whose step heads away from
   the body that hit the still wait go first, each ring farthest-from-it first. A cell with no corridor costs no fork.
   At most 12 forks.

Acceptance, per the design's rules:
- **(1) hitless:** any fork hit or death refuses the candidate.
- **(2) on the level:** any crossing refuses it. In this game one level is one room (`FP.world`), so caveat A is this
  check.
- **(3) the open test holds by the bound:** the stand after the walk must see the executor's own `until`.
- **(4) a hitless still wait:** it is beaten only by a strictly sooner arrival at the mouth. A hit still wait is beaten
  by any hitless candidate.

The accepted keys are replayed on the live run. The live run must agree (no new hit, open test true; the test is read
only), or the executor throws a `SolverRefusal` naming FADE_MOVE. With nothing found it returns `null`, and the
executor stands still exactly as before. MOVING_WAIT's paced hold stays the fallback: in `execHold` the move is asked
before `pacedHoldPlan`.

**Other phase 1 changes:**
- `ctx.aim` is plumbed only ON, at three sites: frontier-apply (`walkToUnder`'s `aim`), clear-tag (`goal.at`) and
  placement-blocker (`goal.placement`).
- The stale MOVING_WAIT docblock ("OFF") now says ON by default and that FADE_MOVE is asked first.

**Phase 2, `FADE_MOVE_ATTACK`:**
- **When it fires:** the still wait was hit by a live chaser, and no kill-lock (`KILL_LOCK_TAGS`, `tset == -1`)
  stands in the level, since a kill-lock's count is the "reads" a later goal has.
- **The candidate:** the kill rung's own dwell (`guardedChaserDwell`: the one strike policy, guard steps, any hit
  refusing by name), run on a fork inside the window, then the stand until the open. It is ranked before the refuges.
- **Ranking:** only the body that hit the still wait is attacked. No other kill is inserted.

**OFF identity.** `fadeMoveTry` returns before reading anything, and `aim` is absent. Acceptance md5: base
`391322d681b7aa0229d94b3f6906d024` (at `ff4077ff`, before any edit), head (`58a025ea`, OFF)
`391322d681b7aa0229d94b3f6906d024`. Equal. The OFF survey ran twice, before and after the last code change:
0 differing steps.

## 5. Rows and bounded vitest

- **`hammerFadeMove.test.js` (new, 7 rows).** It reuses CLEARTAG-STAND's committed captures (legs 127 and 105).
  1. Both switches: default OFF, in `SOLVER_ENV_NAMES`, and the `with*` wrappers restore them, also on a throw.
  2. Leg 127 OFF: punched at t433/t474. The census counts the latched keylock and nothing moves.
  3. Leg 127 ON: 0 hits, OFF's length, and every move's still wait was a puncher hit.
  4. Leg 105 (the puncher killed first): ON = OFF byte for byte.
  5. ATTACK alone = OFF.
  6. Both switches ON: leg 127 hitless at OFF's length.
- **Bounded vitest: 103 files, 3010 / 3010 passed** (`--maxWorkers=2`; file list `vitest-bounded-files.txt`, log
  `vitest-bounded.txt`). The set is every non-slow/train/calib test in `seedlingDemo/` naming keylock, kill-lock,
  latched waits, MOVING_WAIT, `execHold` or the env channel. It ran on the phase-2 head. The later kill-lock decline
  only narrows ON; `hammerFadeMove.test.js` was re-run on it, 7/7.
- **Survey `--through=end`** (each step a child process; the census comes from `tools/census-preload.mjs`):
  - OFF vs FADE_MOVE ON: **0 movers, no step gains a hit** (`survey/compare-off-on.txt`).
  - FADE_MOVE + ATTACK: see the line below.
  - Before the kill-lock decline, ON moved 4 steps. See §8.
- Regenerated: `census-seedling-solver-surface.mjs --write` (line numbers only) then `--check` GREEN. Constants census
  `--check` PASS. `generate-procgen-reference.mjs` and `generate-docs-index.mjs` were run and changed nothing. No docs
  under `docs/json/developer/procgen/` were edited.
- Not run (the brief's boundaries): full sweeps, pytest, unfiltered vitest, `standing-values`, the train tier.

## 6. Game witness (p4g, design §6 item 4)

Page sweep at p4g with `--solver-env=SEEDLING_FADE_MOVE=1`, run on the phase-1 code. Keylock behaviour is unchanged by
the later commits. Rows: `game/rows-on.jsonl`, `game/summary.txt`.

| leg | end | plan | game hits | divergences | game end = model end |
|---|---|---|---|---|---|
| 127 | done, flag cleared | 494 t | **0** | 0 | (423.91, 274.5) = node |
| **128** | done, flag cleared | 541 t | **0** | 0 | (440.84, 281.99) = node |
| 160 | done | 632 t | 2 (575, 615) | 0 | as OFF |
| 161 | done | 610 t | **0** | 0 | (440.82, 282.07) |
| 171 | done | 672 t | **0** | 0 | (423.53, 274.72) |
| 172 | done | 675 t | **0** | 0 | (440.87, 282.83) |

**Key 128, against design §6 item 4:**
- The door opens on the model's tick: the plan is the same 541 t, and the game leg ends `done` with the flag written
  at the end.
- Game ledger: 0 hits.
- **The player is NOT at the mouth when the door opens.** It is at the refuge 24 px below the key line, because the
  mouth is the punched stance itself (§8).

## 7. Census: what the change can move, and why

**Survey (measured, the solver's counters, per step):** 30 covered waits on 26 route steps.

| wait kind | count | where (step, level, lock) | ON |
|---|---|---|---|
| keylock | 17 waits / 16 steps | 28 L19, 31/62/68/130/145/162 L12 `bosslock@432,240`, 45 L12 (`@416,240`, `@80,656`), 37 L31, 38/40 L30, 109 L56, 158 L66, 183 L68, 185/213 L12 `@32,864` | all declined: still wait hitless, no route needs the opening |
| latched | 2 | 134 L40 `wandlock@480,560`, 149 L40 `wandlock@208,128` | 149: one mouth move (88 t), verdict, ticks and hits unchanged. 134: the mouth walk outlasts the bound |
| kill-lock chaser | 8 waits / 4 steps | 78 L53, 120 L60, 227 L98, 228 L99 | declined (two-pass, §8) |
| kill-lock press | 3 | 27 L18 `lock@144,112` | declined (two-pass) |

**Divergence-sweep legs.** The sweep runs on the page, so a per-leg count of the solver's counters needs captured
requests. The full ON-arm capture sweep is the planner's.
- **Measured** on the 7 captured legs: the six L12 legs (5 move to hitless) and 308 (a fade wait; no hitless move).
- **The static superset** (`census/sweep-legs-static.txt`), whose goals are an activator a covered wait opens:
  - 35 `bosslock` legs, which always reach the key fade;
  - 8 `wandlock`, 6 `lock` and 3 `rocklock` legs, which reach a covered wait only if kill-lock or latched;
  - exits through those levels, which can too (frontier arm).

**Which legs phase 1 can move, and why.** Only legs whose latched still wait is **hit**: a hitless still wait moves only
for a strictly sooner mouth, and that happened once on the survey (step 149). On seed 1 that is the L12 puncher family
(the six above, and the other L12 bosslock legs only if their route leaves the puncher alive) and 308 (no hitless move
exists). Kill-lock legs cannot move (§8).

## 8. What the brief got wrong (measured)

1. **"The target is the door mouth" does not reach L12.** For the clear-tag keylock legs:
   - the aim is the lock itself (`goal.at`);
   - the stance is on the key line under it;
   - ⚖47's tile-before-the-lock is *farther* from the opening than the player.

   So the mouth is the punched stance. On leg 105 (hitless) the first build even made a pointless 6-tick "mouth" walk,
   now prevented by the "nearer than the player" rule. The L12 fix is the refuge: the hitless place to wait, as the
   design's rule 4 anticipated ("the hitless move wins regardless of ticks"). For the same reason, witness item 4's
   "player at the mouth" does not hold.
2. **The kill-lock fades are not movable as designed.** Their open is a v9 **declaration** (`PendingDeclaration`), not
   the model's own.
   - ON, survey steps **27 (L18), 120 (L60) and 227 (L98)** went SOLVED → REFUSED, with "the two-pass loop … pass 1
     and pass 2 DISAGREE at tick 320/230/382". The measuring pass never sees the open, so it stands; the declared
     pass sees it and moved.
   - Both kill-lock arms now decline by name (`58a025ea`), so ⚖47's early walk is not absorbed.
   - Covering them needs an open test both passes share. The arithmetic clear tick is known (`last.t + opensOnTick`),
     but the fork's walk after the declared removal can still differ between passes. Hand-over.
3. **L30 key 308 is a fade wait, not only a ranking case**, but no hitless move or attack exists from its latch (§3).
   The hitless answer is the dashless pass, which `betterAnswer` drops. The brief's "→ js gate" stands.
4. **"Room" in caveat A is the level.** Seedling builds one `FP.world` per level, so "in the activator's room until
   tOpen" is the no-crossing check.

## 9. Residue / hand-overs

- **JS arc (js-20):**
  - L30 308: dashless 255 t hitless vs full 191 t dying.
  - L12 160 ON: dashless 680 t hitless vs full 632 t punched.

  `betterAnswer` ranks by length only. A hit-aware tie-break would ship both hitless.
- **Hammer (next):**
  - kill-lock fade moves need a pass-shared open (§8.2);
  - 160's full pass and 308 have no hitless move from the latch. Earlier action is needed: killing the body before
    the key line, which is CLEARTAG-STAND's route (`CLEARTAG_STAND`, OFF), or choosing a later latch.
- **Planner:**
  - The landing sweeps: an OFF + ON pair, edge arm, with capture on the ON arm.
  - Predicted from this slice: the L12 L35/L95 legs except 160 go roomHits 2 → 0 at unchanged ticks, kill-lock legs
    unchanged, and every keylock leg whose still wait is hitless unchanged.
  - `FADE_MOVE_ATTACK` adds no shipped change on the measured rows. Its sweep is optional.
- **Not measured:**
  - per-leg counts over all 923 sweep legs (needs the capture sweep);
  - phase 2 against a body other than the puncher and the bobsoldier;
  - the refuge rings are a bounded search (12 forks), not a proof that no hitless refuge exists.
