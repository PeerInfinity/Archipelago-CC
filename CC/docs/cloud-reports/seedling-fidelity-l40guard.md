# Seedling fidelity L40GUARD — the chest's guard on the game, and four OFF switches

Slice `seedling-fidelity-l40guard` (Opus, cloud), planner `seedling-fidelity-planning-9`, post-wave 19.
⚖ The user (2026-10-19): *"L40 guard stance"*, i.e. hammer LB's hand-over #1, with #3, #6 and #7 folded in.

| | |
|---|---|
| Start SHA | **`e686f0b6e6`** (= main: watcherTalkVerb ON) |
| Head | the commit carrying this report. Before it: D1 `d22b2694`, D2 `6214a4f0`, D3 `4cb14a65`, D4 `60bb4050`, records `af853555`, gate fix `6d4bd88e` |
| Branch | `claude/l40-guard-stance-3ob72q` (the harness's; the brief's `seedling-fidelity-l40guard`, local). Nothing went to `main` |
| Dev servers | `serve-nocache.py 9697` (primary, PID 605) and `9698` (the base worktree, PID 2894), both killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS** (no model gap: three game witnesses, worst \|Δ\| 0) **· D2 PASS** (`guardApproachStance`, OFF; built, refuses by name, never asked on the live legs) **· D3 PASS** (`coveredGoalRefusal`, OFF) **· D4 PASS for #7, PASS for #6's moot class, STOP for 414's own #6 instance → hammer** **· D5 PASS** (no seam solves; the chooser is the wall) |

## The one thing to know first

**The guard is modelled exactly, and it is not the wall any more: the chooser is.** On the game `bobsoldier@880,832`
DOES approach. It chases inside 80 px, but it stands in the 16-px pocket under the chest (the chest stance's tile), and
the pocket's west wall holds it. A sword press lands on it from d 20.5, outside its blade. With all four switches ON,
414's ten `deadline` seams become named EXHAUSTED refusals at 128–372 units (D3), and both swing throws are gone (D4).
Nothing solves. Even at the seams where the corridor's only named danger is the guard itself (414 at 5124 and 5125),
BAIT reads *"NO LIVE BODY's removal admits a corridor"* and KILL gets no target. The chaser arm, old or new, is never
asked about the guard. That is CW's joint 3-body chooser (hammer's #2), and it is next.

## W0 — the base (PASS)

Measured at a pristine detached worktree of `e686f0b6e6` (`$SCRATCH/base`, submodules and `node_modules` symlinked from
the primary, its own server on 9698). The edits started before W0 ran, so every BEFORE row below is from that worktree.

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Seven submodules were not initialised after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, shared, swfRecompilerPanel/browser, textAdventureEngine): `git submodule update --init` each, at their recorded gitlinks |
| identity block | `SEEDLING_PORT=9698 bash scripts/procgen/identity-block.sh .` (venv) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639` / `7d4cb820` / `49e23d85`, levels `e28c1e5d` / `fb1a59e5`, generated set OK. Value rows md5 **`ec4a04c4`** (`evidence/w0/identity-w0.txt`). The reference row reads *4 DIFFER* at the worktree: the symlinked submodules' artefact that earlier slices name; the primary tree reads ALL 7 + 5 MATCH |
| six `--check`s | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `3d41b9fb`, all exit 0 (= LB's W0) |
| the three RED producers | — | r5-conch, r5-feather, r6-shieldboss: pre-existing on main per the brief, hammer bisecting. Banked as pre-existing, not run |
| tapeRunner pairs | `vitest --reporter=json` over `tapeRunner.test.js`; `status\tfullName` sorted (HB's `pairs.py`) | **621 `fceca579`**, 0 non-pass |
| surface / constants / entities / profile / roster | each `--check` | GREEN **314** · PASS **6,041** · PASS 566 · PASS 138 · **282** |
| bounded vitest BEFORE | 84 files (`evidence/w0/vitest-files.txt`: the brief's standing list, plus every non-slow test naming `deriveKillByChaser`, `deriveChaserDetour`, `FORCED_HITS`, `stepChaserEntity`, `onScreenNow`, `assertSpinnerLineOfSight`, `spinnerPressHits`, `CONTACT_FIDELITY_KEYS`, `contactsSuppressed`, `climbLadderUnder`, `.chaserForecast`, `rg -a`), `--maxWorkers=2` | **2,274 / 2,274**. Six more gates that enumerate the switch set (`fidelityBulb`, `fidelityDarkTrap2`, `fidelityHousekeepWalker`, `fidelityLavaChainPlayer`, `fidelityWatcherTalk`, `fidelityWaypointSlide`) were found after W0: 50 / 50 at the base too |
| 414 at the captured seam | `replay-seedling-solve-request.mjs --requests=…/requests-414.jsonl --i=0 --n=1` | deadline `668f4ca7`, 643 units: LB's row at their base `008215fa`, exactly |

## D1 — the guard on the game (PASS: no model gap)

The game: p4f, headless logic-only, port 9697, `probe-seedling-bobsoldier-mobiles` (the guard's position, velocity,
`hits`, `hits_timer`, presence, per sampled tick, clock calibrated on the player's x). Each tape is 414's atlas boot
view (`fixtures/hammer-lb-hx/boot-414.json`, plain sword) re-booted in the corridor under the guard (`tools/mktape.mjs`).

**The room.** The chest is a Solid at (880..896, 816..832). The guard's entity point (888,840) is in the 16 × 16 pocket
directly below it, which opens south onto a 16-px corridor (y 848..864, x 736..912). That pocket is the chest stance
(the aim (888,834)). The corridor is fed from the west by the shaft that holds `bob@736,752` and `bob@736,800`, and
`spinner@816,848` / `spinner@880,848` roam it, the pocket included, and climb the shaft.

| witness | ticks | what it shows | game vs model |
|---|---|---|---|
| `l40guard-walk-east` (hold right) | 161 | **leash**: the chase starts at t37, d 78.5 ≤ 80 (`BobSoldier.as:92`). **The wall**: the box is held at x 884.0 (its left edge against the pocket's west wall) and slides out only as `vy` allows (y 840 → 856 over t41–t129). **The spin**: begins at t77, d 29.0 < 33 (`:114`, `d:int`). **The reach**: the sword lands at t91, t111, t131 (d ≈ 15–18; the blade is 8–16 px out, `:165-166`), the third is the death; the reboot puts it back at (888,840) | **161 comparisons, worst \|Δ\| 0** |
| `l40guard-diag-strike` (right to t82, sword at t83) | 121 | **a strike lands from a cell the blade does not cover**: hits 0 → 1 at t85, d 20.5 (the plain sword's rect is 16 along × 32 across, `Player.as:929-950`); the knockback puts it back in the pocket (891.4, 842.0); no blade hit on the player | **121, worst 0** |
| `l40guard-leash-retreat` (right to t64, left to t120) | 201 | **no return-to-post**: out of leash (t101 on) the chase writes nothing and friction stops it at (884.02, 842.12), where it stays | **201, worst 0** |

**The model at 0 px:** `bobSoldier.js` and `chasers.js` match the game in all three. Nothing to fix.

**What the brief's premise missed:** the guard does approach. The chaser arm cannot use it for two reasons:
- **Travel.** The ceiling's travel term is the straight line at `moveSpeed`, and the wall-held guard never arrives
  inside it.
- **Kill.** The ceiling's kill term is `3 × killWindowTicks(tag)`, and `killWindowTicks` is `1 + deathTicks`, a DEATH
  window. That is 78 ticks for a Bob and **3 for a BobSoldier**, which has no die animation. The docblock beside it
  says "three landed hits through the receiver's i-frames".

## D2 — `guardApproachStance` (PASS; OFF)

**The change** (`solverBot.js`, my functions; `contactFidelity.js` one key at the end):
- `deriveKillByChaser` gains one block before its refusal. When both of its scans priced nothing and the switch is ON,
  it calls `deriveGuardApproach`.
  - If that finds a stance, the stance is returned in the arm's own shape, with `approachStance: true`, and walked and
    dwelt by the existing executor.
  - If not, its refusal is appended to the arm's (`why` gains it; a new optional result field `approach` carries it).
- `deriveGuardApproach` asks two kinds of candidate:
  - the lattice cells within `SLASH_REACH` (16) of the body's box: the player goes to the body;
  - the leash cells the scan already found reachable.

  Each must plan from here and onward to the aim. Each is previewed by the arm's own instrument: `previewWalk` under
  the one strike policy, the standing tail, and `dangerDuringTransit` per sample on the one forecast. The ceiling is
  travel + `hits` × `KILL_PRESS_CADENCE` + `killWindowTicks` + `HOLD_SLACK`. Candidates are scored as the arm scores
  (soonest kill, then shortest approach, most cleared, y, x).
- **The refusal names which failed**, counted:
  - **REACH**: in-reach cells with no corridor here or onward, and walks that did not settle or plan;
  - **TIMING**: the body outlives the ceiling, or it lands on the player first;
  - **LEASH**: another body reaches the player.

  It reads *"GUARD APPROACH (guardApproachStance): no approach stance for … REACH: … TIMING: … LEASH: …"*, and classes
  `exhausted` (`progressKind`; no mapping needed).
- OFF: the block is never entered, and the arm's result is byte-identical (the `approach` field is absent, the `why`
  unchanged). `SEEDLING_GUARD_APPROACH_STANCE=0|1`.

**Measured** (the arm asked directly, `tools/d2sweep.mjs`, from the witnessed corridor states):
- At the boot, and every 5 ticks along walk-east to t85: OFF refuses as before. ON appends LEASH 6–7 of 6–7 asked: the
  corridor's `spinner@880,848` reaches every wait.
- Beside the guard (walk-east t90): ON reads TIMING 7, LEASH 0. The blade lands before three hits can.
- Idle at the corridor's west end (t0–1500), and with the ghost sword: LEASH throughout. After the first spinner hit,
  the forecast's own band throw (`chaserForecast: whether bobsoldier … is on screen`) ends the derivation. That is the
  forecast's camera band, the same shape as HO1, and not mine to catch.
- Spinner-free corridor windows exist (t379–1394 with the player away), but the spinners are player-coupled (they
  bounce off the player), so no boot opens into one.

**So no positive state exists on L40 while the spinners live.** The live legs never ask the arm about the guard (D5):
the chooser offers no target first.

**This is a model of the game, not an avoidance.** The new pass asks the game's own question (a press from inside the
sword's reach, the body's own clock), with the model's own kill as the certificate. It is not an interim.

## D3 — `coveredGoalRefusal` (PASS; OFF; a second switch)

**The change.**
- `coveredGoalOf(run, aim, allowTeleporter, opts)` is the planner's own goal-tile test (`planTilePath`:
  `isWalkableTile` at the goal node with no clearance, then `plannerObstacleAt`), under AVOID's options with the danger
  map's volumes forbidden. A `danger` obstacle whose id is a live chaser counts as a covered goal.
- In `climbLadderUnder`, after AVOID:
  - **DETOUR**: when the goal is covered and every reason is a chaser, the rung writes its row (`coveredGoal: <id>`,
    `previews: 0`, `planned: 0`) and refuses with *"COVERED GOAL (coveredGoalRefusal): the aim's own tile … lies inside
    the live body …'s volume …"* (kind `danger`).
  - **The forced-hit rung**: writes its row with `coveredGoal` and asks no proof.
- OFF: `coveredGoalOf` is never called. `SEEDLING_COVERED_GOAL_REFUSAL=0|1`.

**Why a second switch:** its movers are not D2's. It refuses where D2 would build, so the two need separate A/Bs.

**Measured** (414, `lb-prof.mjs`):

| arm | seam 5131 @640 | unbounded |
|---|---|---|
| OFF | deadline `668f4ca7`, 643 | (LB) EXHAUSTED 11,908 = 5,954 a pass |
| D3 ON | **EXHAUSTED `bde7a26a`, 196** (= 98 a pass, LB's prediction) | **EXHAUSTED `bde7a26a`, 196** |
| D2 + D3 ON | the same 196 | the same |

⚠ **The risk a flip must weigh:** DETOUR plans its candidates without the danger volumes and certifies them by preview.
So in principle it can solve a goal whose covering chaser walks off it (a chaser chases). D3 refuses such a goal
outright. On L40 the guard is wall-held and that cannot happen. The sweep A/B is the arbiter: in the baseline sweep
(`39153416627`) only legs 85 and 201 carry a covered-goal AVOID text, and both name non-chasers (a static sandtrap, an
armed arrow lane), so D3 does not fire on them.

## D4 — `levelRun`'s two throws (#7 PASS; #6 moot class PASS, 414's instance STOP → hammer)

**#7, the swing through a Solid (`spinnerSwingLineOfSight`, OFF).**
- The game: `Player.as:917` calls `genericHit` only when `!collideLine("Solid", x, y, v.x, v.y)`, or the ghost sword,
  or a Solid / Rope / Flyer target. A Spinner is `"Enemy"`, so for the plain sword the line is consulted.
- The model: `assertSpinnerLineOfSight` THREW. The drill's and the wallflyer's arms already model the miss.
- **Witness** (`l40guard-spinner-los`, 2,200 t): the player at (728, 685) against the shaft's corner tile, the sword at
  t2166, `spinner@816,848` one tile into the shaft.
  - OFF the model throws *"the swing at (728, 685) reaches spinner@816,848's rect but `collideLine("Solid", …)` finds
    tile:Blue Wall at (734, 688)"*.
  - The game: the first test (t2167) misses, the second (t2168) lands: `hits_timer` 30 at sample 2169.
  - ON, the model is the game: **Spinner 10,995 comparisons, worst \|Δ\| 1.1e-13** (float noise, under the probe's 1e-9).
- **The change**: `spinnerSwingBlockedNow(sp)` is consulted before the assertion. ON, a blocked test is a `landed:
  false` `spinnerPressHits` row (*"collideLine("Solid") meets tile:Blue Wall at …"*). OFF it returns null and the
  assertion throws as before. The two bosses' assertions are untouched (no witness).

**#6, the live band throw (`shakeBandMoot`, OFF).**
- The mechanism: `Enemy.update`'s off-screen return skips only friction and the move, the terrain switch, the i-frame
  tick and the contact. The chase below runs either way.
- So for a body that is at rest (`v` exactly 0), has no i-frames, does not overlap the player, stands on no terrain arm,
  and is alive and not falling, both branches are the identity. `shakeBandMootNow` steps it (as off screen; either label
  is the game's) and ledgers it in **`run.shakeBandMoots`** (a new getter, `[]` OFF). Any other body under an uncertain
  band still throws by name. ⚖ The jiggle is still not modelled.
- **Witness** (`l40guard-band-moot`, 1,000 t idle at (688,672)): `spinner@880,848` hits the player at t877.
  - OFF the model throws *"whether bob bob@736,752 is on screen at tick 878"*.
  - ON it steps through (2,122 moot rows by t3000), and **the game agrees: Bob 11,988 comparisons, worst 0**.
- **414's own instance is NOT moot: STOP.** 414 seam 5123's throw at t1569 is `bob@736,800` at home (744, 808) with
  `v` = (0.152, −0.476). That is a stale impulse built while it was off screen, so on screen it moves and off screen it
  does not: the jiggle genuinely decides. The throw is raised inside `execKillByPressOnce`'s `advance`. A
  refusal-by-name there is the press kill's (hammer's) region. Hand-over below.
- A negative row holds the line: ON, walk-east's t169 band over the moving guard still throws.

## D5 — movers (PASS)

### The seam census (`replay-seedling-solve-request.mjs --seam-time-sweep=-10..10`, one process per seam; ON = all four switches)

CENSUS_TABLES

### The survey (L39 / L40 / L41, local, `--through=end --route=full --only=77,78,107,108,109,110,112`)

| step | level | OFF | ON |
|---|---|---|---|
| 77 | 39 | REFUSED (rope) | = |
| 78 | 40 | REFUSED (pushable fire block) | = |
| 107 | 39 | REFUSED (rope) | = |
| 108 | 40 | REFUSED (totem part, ladder-routed) | = |
| 109 | 41 | REFUSED (crusher bait) | = |
| 110 | 40 | SOLVED, 70 t | = |
| 112 | 40 | REFUSED (buttonroom) | = |

Every row is byte-identical ON (verdict, refusal, ticks). No L39–L41 step reaches the guard; no refusal names a
BobSoldier. The CI survey (`39153361080`) holds the same seven verdicts.

### The bounded set ON, and the other ON rows

| measure | OFF | ON (all four) |
|---|---|---|
| identity block (value rows) | **= W0** (`ec4a04c4`), reference ALL 7 + 5 MATCH | **one row moves: carved pairs c4 `b9d2185d` → `ebb9e743`**, bisected to `spinnerSwingLineOfSight` alone. The one pair: `winding post-sword seed=7` THREW the LOS assertion OFF and runs to `stop=SATURATED attempts=24` ON (`evidence/d4/c4-*.txt`). Every other row = W0 |
| six producer `--check`s | = W0 | = W0 |
| tapeRunner pairs | 621 `fceca579` | **621 `fceca579`** |
| bounded vitest (91 files: W0's 84, the gate, the six switch-set gates) | **2,337 / 2,337** | **2,335 passed, 2 skipped** (the two "ships OFF" rows, mine and `contactFidelity.test.js`'s), **0 red** |

### What the movers say

- **No seam solves**, in either leg, in either arm, ON or OFF.
- **414**: ON turns every `deadline` row into a named EXHAUSTED refusal inside the budget (D3), and removes both
  swing-through-Solid throws (D4 #7):
  - 5134 runs on to the press kill's HAMMER_SAFETY corner;
  - 5132 runs on to a live band throw at t2082 that is not moot.
- **The chooser (#2) is the wall.** At 414 5124/5125 ON the walk reaches the corridor under the guard, and the corridor's
  only named danger is `chaser:bobsoldier@880,832` (its sword). BAIT: *"NO LIVE BODY's removal admits a corridor"*; KILL:
  no target. So no rung asks the chaser arm about the guard. At the other EXHAUSTED seams the corridor danger is a
  shaft bob (`bob@736,800` or `bob@736,752`). That is CW's three-body set: {bobsoldier, `bob@736,752`, `bob@736,800`}.
- **397** stops on the press kill's HAMMER_SAFETY corner at its captured seam (156 units, `5a55f5b8`) ON and OFF: the
  press kill comes before the guard.

## The CI dispatches the planner should run

1. **A keyed sweep A/B on the L40 keys** (40 legs; the keys are `evidence/l40-keys.txt`, `|`-joined):
   `seedling-divergence-sweep.yml` on `claude/l40-guard-stance-3ob72q`, `mode=inv`, `producer=solver`,
   `capture_requests=true`, `keys=<evidence/l40-keys.txt>`:
   - (a) `contact_fidelity` omitted (the defaults: OFF);
   - (b) `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,watcherTalkVerb,guardApproachStance,coveredGoalRefusal,shakeBandMoot,spinnerSwingLineOfSight`
     (the defaults' ON keys + my four);
   - then a `×2` repeat on any key that moves, with `seam_census=-3..3` on 397 / 414.
2. **The full sweep A/B** with (b), because `shakeBandMoot` and `spinnerSwingLineOfSight` can reach any level with a
   shake band or a spinner behind a wall. The baseline (`39153416627`) carries no live band throw and no swing-through-
   Solid throw in any row's text, so the predicted movers are L40's only. Compare with (a) by KEY.
3. **The survey**: `seedling-survey.yml`, `--through=end --route=full`, on this branch at the defaults (expected =
   `39153361080`: 165 / 45 / 1 / 1). An ON survey needs a scratch commit flipping the four defaults, because the
   workflow has no switch input; the local L39–L41 run above is byte-identical.

## For the JS arc (pins that move, and what to wire)

- **No JS-arc pin moves OFF.** The new optional fields:
  - `deriveKillByChaser`'s result `approach` (string, ON only) and `approachStance: true` (ON, when the approach stance
    is chosen);
  - the trace rows' `coveredGoal` (DETOUR, forced-hit; ON only);
  - `spinnerPressHits` rows with `landed: false` and a `collideLine` `why` (ON only);
  - `run.shakeBandMoots` (a new getter, `[]` OFF).
- No `SolverRefusal.obstacle.kind` is new. `seedlingSkinRenderer.test.js` is in the bounded set and green both ways
  (no `run.*` field was renamed or reshaped).
- The settings schema (`seedlingContactSettings.js`) derives from `CONTACT_FIDELITY_KEYS`, so the four
  `seedlingContact<Key>` booleans appear with no edit. The `contact_fidelity` input takes the keys as they are.

## Handed to the hammer arc

| # | what | where | measurement |
|---|---|---|---|
| H1 | **The joint chooser** (LB #2, CW item 1): the wall now | `climbLadderUnder`'s chooser (`chooseBodyToRemove` / `hitSourceBodies`) | 414 ON at 5124/5125: the corridor's only named danger is the guard's sword and BAIT/KILL still have no target; elsewhere the shaft bobs. CW's three-body set {bobsoldier, `bob@736,752`, `bob@736,800`}. When it names the guard, the arm (with `guardApproachStance` ON) is the derivation that will be asked |
| H2 | **414 seam 5123's live band throw is not moot** (LB #6's instance) | `execKillByPressOnce`'s `advance` (its live run) | t1569, `bob@736,800` at (744, 808), `v` (0.152, −0.476), hitsTimer 0, no overlap, the player at (743.6, 725.1): stepping it on vs off screen differs, so only the jiggle decides. A refusal by name at that `advance` (kind `unmodelled`, as HO1's) would be the press kill's. With `spinnerSwingLineOfSight` ON, 414 5132 meets the same shape at t2082 |
| H3 | **The press kill's HAMMER_SAFETY corner** stays the first refusal on 397 at its captured seam, and on 414 at 5129 / 5134 / 5138 / 5140 ON | `execKillByPress` | unchanged by these switches (`5a55f5b8`, 156 units on 397) |

## Deltas (base → head)

- **New:**
  - this report and `CC/docs/cloud-reports/seedling-fidelity-l40guard-evidence/` (`d1/` the three witness tapes and
    their game rows, `d4/` the two D4 tapes and the c4 dumps, `d5/` the profiles, replays, survey A/B and census,
    `w0/`, `after/`, `tools/`);
  - `frontend/modules/seedlingDemo/fidelityL40Guard.test.js` (9 rows) and `fixtures/l40guard-witness/` (four tapes,
    three game-row files).
- **Changed:**
  - `contactFidelity.js`: four keys at the end, and their env lines;
  - `solverBot.js`: `deriveGuardApproach` and `coveredGoalOf` (new), one block in `deriveKillByChaser`, two rung
    branches in `climbLadderUnder`;
  - `levelRun.js`: `shakeBandMootNow` and `spinnerSwingBlockedNow` (new), one line in `stepChaserEntity`, one branch in
    the spinner press arm, the `shakeBandMoots` ledger and getter;
  - `contactFidelity.test.js`: the defaults pin, four rows;
  - the surface and constants censuses (re-recorded);
  - `seedling-bot.md` (a paragraph), `seedling-bot-log.md` (a section), and the regenerated reference.
- **Untouched:** hammer's list (`execKillByPress`, `deriveStrike`, `deriveRefuge`, the chooser, the escape…),
  `jsRuntime*`, the walker, `flashPanel/*`, `planWaypoints`, `stateDigest`. No AS3, wasm, gitlink or rules edit. No
  committed tape, producer `--check` or tapeRunner pair moves.

| | before (W0) | after (head, OFF) |
|---|---|---|
| identity block (value rows) | `ec4a04c4` | `ec4a04c4` (ON: c4 moves, above) |
| six `--check`s | as W0 | = |
| reference | (worktree artefact) | ALL 7 + 5 MATCH |
| tapeRunner pairs | 621 `fceca579` | 621 `fceca579` (ON too) |
| surface / constants / entities / profile / roster | 314 / 6,041 / 566 / 138 / 282 | 314 (re-recorded) / 6,046 (+5) / 566 / 138 / 282 |
| bounded vitest | 84 files, 2,274 / 2,274 (+ 6 files, 50 / 50) | 91 files, 2,337 / 2,337 (ON: 2,335 + 2 skipped, 0 red) |
| CI `JavaScript Unit Tests` | — | at `6d4bd88e`: vitest unfiltered **21,267 / 21,267**, slow battery **254 / 254** (run `39337276266`); at the report's head: `node scripts/procgen/ci-vitest-summary.mjs <head> --wait` |

## Byte-inertia

All four switches OFF:
- every identity value row, the six producers, the reference, the tapeRunner pairs and the bounded set are W0's;
- the arm's result object is the BEFORE one: no `approach` key, the same `why`;
- `run.shakeBandMoots` is `[]`.

The OFF code paths read nothing new:
- `coveredGoalOf` is not called;
- `shakeBandMootNow` returns at its first line;
- `spinnerSwingBlockedNow` returns null before `collideLineSolid`;
- the ladder's branches are the same `if` with the original condition.

## Mutants (`tools/mutants.py`, a scratch worktree, each restored by md5)

| mutant | predicted | measured |
|---|---|---|
| M1 LEASH ↔ TIMING swapped in the classification | D2 row | D2 row red |
| M2 the arm's hook ignores its switch | D2 row (OFF carries `approach`) | D2 row red |
| M3 `coveredGoalOf` never sees a `danger` obstacle | D3 row | D3 row red |
| M4 the moot ignores `v` | "a MOVING body still throws" | that row red |
| M5 the moot ignores its switch | "OFF throws at t878" | that row red |
| M6 the LOS miss ignores its switch | "OFF the press at t2166 throws" | that row red |

## What the brief got wrong (measured)

1. **"A guard that never approaches."** It approaches: it chases inside 80 px, from t37 of walk-east. What stops it is
   the pocket's west wall, and the arm's ceiling. That ceiling's travel term is the straight line, and its kill term is
   three death windows: 3 ticks for a BobSoldier.
2. **"414 unbounded ends EXHAUSTED … on bobsoldier"; "a stance that WAITS for a chaser cannot exist."** True of the
   refusal's words, but the arm is never the rung that fails on the live legs. The chooser hands it no target, even
   where the guard is the only named danger (414 ON 5124/5125).
3. **"#6: witness it on the game, then model it."** Half of it can be modelled: the moot class, witnessed at worst 0.
   414's own instance genuinely depends on the jiggle (a body with a stale `v`), and ⚖ forbids modelling the jiggle.
   It is a refusal at the press kill's `advance`, which is hammer's.
4. **"#7 … already handed over by L40CONTACT"** to fidelity: it was a plain assertion where the drill and wallflyer arms
   already model the miss. It is one branch, and witnessed.
5. **"If 414 or 397 now SOLVES, record a game witness."** Neither solves; no witness is owed.
6. **The bootstrap** left seven submodules uninitialised after `READY` (as for LB, CW and L40CONTACT).

## Residue

1. **The flips are the user's.** The measured movers:
   - `coveredGoalRefusal` and `guardApproachStance`: 414's ten `deadline` seams (→ EXHAUSTED) and nothing else
     measured here;
   - `spinnerSwingLineOfSight`: identity c4 (one pair, THREW → SATURATED) and 414 5132 / 5134 (throws → a band throw /
     HAMMER_SAFETY);
   - `shakeBandMoot`: nothing on the legs (414's instances are not moot) and nothing in the bounded set.

   Before any flip: the dispatches above. Then re-record c4 (its value is a hash of the dump).
2. **D3's risk** (above): a covering chaser that walks off the goal. The sweep A/B answers it; nothing in this slice's
   evidence shows such a leg.
3. **The forecast's own band throw** (`chaserForecast: whether …`) ends D2's derivation in a shaken room. It is HO1's
   shape and already hammer's HX guard where the press kill asks. In the arm, nothing catches it (by design today).
4. **Measured under load** (two to four solves at once on four cores): the walls are relative only. The units,
   answers, digests and ticks are box-independent.
5. **Tree hygiene:** the scratch worktrees (`$SCRATCH/base`, `$SCRATCH/mut`) are removed by name, and both servers are
   killed by PID. The seven submodules initialised in W0 stay at their recorded gitlinks. The `.cache/seedling-survey`
   directory holds the fetched CI survey (untracked).

## Rows to BANK

- `CONTACT_FIDELITY.guardApproachStance` / `coveredGoalRefusal` / `shakeBandMoot` / `spinnerSwingLineOfSight`, all OFF;
  `SEEDLING_GUARD_APPROACH_STANCE`, `SEEDLING_COVERED_GOAL_REFUSAL`, `SEEDLING_SHAKE_BAND_MOOT`,
  `SEEDLING_SPINNER_SWING_LOS`; gate `fidelityL40Guard.test.js` (9 rows); fixtures `fixtures/l40guard-witness/`.
- Game witnesses, worst |Δ| 0 unless named:
  - `l40guard-walk-east` (161), `l40guard-diag-strike` (121), `l40guard-leash-retreat` (201): the guard;
  - `l40guard-band-moot`: Bob 11,988;
  - `l40guard-spinner-los`: Spinner 10,995, worst 1.1e-13.
- Surface **314** (re-recorded); constants **6,046**; entities 566; profile 138; roster **282**; tapeRunner pairs
  **621 `fceca579`**; identity value rows `ec4a04c4` (OFF; ON moves c4 to `ebb9e743`).
- 414 @ seam 5131: OFF deadline `668f4ca7` 643; D3 ON EXHAUSTED `bde7a26a` 196 (98 a pass), at any budget.
