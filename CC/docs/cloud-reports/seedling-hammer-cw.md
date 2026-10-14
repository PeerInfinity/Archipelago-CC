# Seedling HAMMER-PHASE — slice CW: the L40 chaser wall after the ghost kill (measure-first)

Slice `seedling-hammer-cw` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-14): *"Both, in
parallel"* — this slice beside RE. CW diagnoses first and builds only where the measurement says the wall is the hammer
arc's.

| | |
|---|---|
| Start SHA | **`3a53894a9a`** (= `origin/main` at the fetch; ≥ the brief's floor) |
| Head | the commit carrying this report (D1 evidence `fb0bc23`, D4 records `4a0cee0`, then this report) |
| Branch | `claude/seedling-hammer-cw-pjoaeg` (the harness names it; the brief's `seedling-hammer-cw`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9583` (`SEEDLING_PORT=9583`), PID 1754, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS → STOP** (the wall is fidelity's: (c), behind a (b) layer with no verdict value alone; and (d) on the sword staging) **· D2 / D3 not run (STOP) · D4 PASS** (records only) |

## The one thing to know first

**The L40 chest is guarded, and nothing in the hammer arc's region can get past the guard.** The chest stance's tile
lies inside `bobsoldier@880,832`'s live volume, so no corridor reaches the aim while it stands. The empty chooser list
that every refusal shows is only the first layer: hypothesise the right bodies away (scratch) and every workload walks
on, kills `bob@736,752` (and `bob@736,800`) with the chaser arm, and then stops on the bobsoldier, because **no
chaser-arm stance derives for it** (*"it does not reach this stance inside its own travel time plus three kill
windows"*: the guard never comes to the player). That arm is fidelity's. Separately, **staging A's sword prefix parts
from the game at t1801**: a live spinner stops `bob@736,752` in the game and not in the model.

## W0 — the base, and the reproduction (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-cw-pjoaeg origin/main` | `3a53894a9a`; `merge-base --is-ancestor 3a53894a9a origin/main` yes |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five submodules `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine): `git submodule update --init` each |
| identity block | `SEEDLING_PORT=9583 bash scripts/procgen/identity-block.sh .` (venv) | every value row = G1's banked AFTER (`seedling-hammer-g1-evidence/identity-after-off.txt`, non-`#` md5 `77080c2e`): maze `57e07d21`, acceptance batch `933c14f7`, empty pairs c3 `4937da80` / c6 `430573e9`, carved c4 `b9d2185d`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639` / `7d4cb820` / `49e23d85`, levels pre/post-sword `e28c1e5d` / `fb1a59e5`, generated set OK (`evidence/identity-w0.txt`). ⚠ The reference row read *"3 … DIFFER"*: the block ran while I appended this slice's bot-log section, and the three were the docs index's word counts. At a pristine worktree of the base the docs-index region PASSES (its registry / capabilities rows differ there only through the symlinked submodules, G1's artefact); after D4's regeneration the main tree reads ALL 7 + 5 MATCH |
| six `--check`s | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0 (= G1, = BW) |
| ENEMY census | the block | `afdc6d1a` (= G1) |
| tapeRunner pairs | `vitest --reporter=json` over `tapeRunner.test.js`; `status\tfullName`, sorted, `\n`-joined (G1's `pairs.py`) | **611**, `75a3c41f` (= G1) |
| surface / constants / entities / profile | each `--check` (`evidence/censuses-w0.txt`) | GREEN **288** · PASS **5,846** · PASS **558** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 32 files: every non-slow test naming `chooseBodyToRemove`, `KILL_ARM_POLICY`, `execKillByPress`, `GHOST_KILL_RUNG` or `deriveKillByChaser` (`rg -a`), plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `solveProgress*` (`--maxWorkers=2`) | **932 / 932** (`evidence/vitest.txt`) |

### The refusal on `bob@736,*`, reproduced

The driver is `evidence/cw-solve.mjs`: G1's `g1-solve.mjs` plus `--atlas=1` (a leg's page staging mapped onto the tape
schema and booted on the ATLAS, G1's `rt.mjs`), a per-tick trail of the player and the three watched bodies, the
refusal's ladder rows, and bomb counters. One `solveSegment`, `dashMode: 'all'`, goal the chest (880,816). Leg list
`seedling-divergence-legs.mjs` (843 legs, the ids are G1's); the page's delivered set from
`probe-seedling-divergence-sweep.mjs --mode=inv --ids=400 --dump=…`. Rows: `evidence/rows/w0-*.json`.

| workload (staging) | lapse | verdict | t | `trace.obstacle` (+ `sources`) | player at t | `bob@736,752` / `bob@736,800` at t | hits (deaths) | keys | msg |
|---|---|---|---|---|---|---|---|---|---|
| A sword (atlas, P1's boot view) | OFF | REFUSED | 3113 | `bob@736,752` [`chaser:bob@736,752`] | (727.7, 663.9) | (744,760) / (744,808) | 6 (2) | `af47d35d` | `42df6d55` |
| A sword | ON | REFUSED | 3113 | the same | the same | the same | 6 (2) | `af47d35d` | `d9532c9b` |
| A ghost (atlas) | OFF | REFUSED | 2195 | `bob@736,752` [`chaser:bob@736,752`] | (728.1, 680.0) | (744,760) / (744,808) | 3 (1) | `b762a2e6` (= G1's witness) | `9e5c7ff1` |
| A ghost | ON | REFUSED | 2195 | the same | the same | the same | 3 (1) | `b762a2e6` | `6eee0349` |
| 397 ghost (page) | OFF | REFUSED | 1305 | `bob@736,752` [`chaser:bob@736,752`] | (743.8, 776.3) | (745.5,805.8) / (744.0,814.0) | 0 | `bb5dbff7` | `e286b2c0` |
| 397 ghost (page) | ON | REFUSED | 1305 | **`bobsoldier@880,832`** [`chaser:bobsoldier@880,832`] (its sword) | the same | the same | 0 | `bb5dbff7` | `b2791a27` |
| 414 ghost (page) | OFF | REFUSED | 1379 | `bob@736,800` [`chaser:bob@736,800`] | (743.6, 744.2) | (742.0,769.2) / (744.0,798.3) | 0 | `27923b0a` | `615de76c` |
| 414 ghost (page) | ON | REFUSED | 1379 | the same (danger point 0.4 px south) | the same | the same | 0 | `27923b0a` | `f0d87e84` |
| 397 ghost (atlas) | OFF | REFUSED | 2336 | `bob@736,800` [`chaser:bob@736,800`] | (728.7, 665.3) | (744,760) / (744,808) | 3 (1) | `938cfaa5` | `5a257344` |
| 397 ghost (atlas) | ON | REFUSED | 2336 | `bob@736,752` [`chaser:bob@736,752`] | the same | the same | 3 (1) | `938cfaa5` | `036f7b65` |
| 414 ghost (atlas) | OFF | **THREW** at t2439 | — | — (inside the press kill) | (331.7, 647.9) | (744,760) / (744,808) | 6 (2) | — | — |
| 414 ghost (atlas) | ON | **THREW**, the same | — | — | the same | the same | 6 (2) | — | — |

Every refusal is the same climb, word for word in shape:
- **avoid:** *"A\* goal tile (55,52) [(55,51) on the page] … for (888,834) — is not walkable:
  danger:bobsoldier@880,832 (a stepped bobsoldier at its LIVE position) at (868,822)"*;
- **time:** the aim is 148–234 px away (TIME is last-mile only);
- **bait:** *"NO LIVE BODY's removal admits a corridor — the danger on this corridor is [chaser:bob@736,…]"*;
- **kill:** *"the danger on this corridor is not a body this run can watch die"* (no target);
- **detour:** *"0 candidate corridor(s) previewed … 152 / 154 candidate(s) left unasked"*.

**Which rung was climbing, and was the press kill still running?** On every row the kill rung's press arm ran the
climb before the refusal (climb 1 at t0 on `spinner@880,848`; staging A ghost also climb 2 at t2127 on
`spinner@816,848`). The press kill had **exited**: it is lock-less, so it returns on the tick its body leaves
`spinnerBodies` (`solverBot.js` `execKillByPressOnce`, the `!resolved.lock` return), and the refusing climb is the next
walk's, on that same tick (t = the removal tick on every row). At the refusal the nearer chaser is 82–98 px from the player
on the atlas (both bobs back at their homes) and 25–30 px on the page; the probe meets them on the corridor ahead. **The hits are
the press kill's**, while it was still running: every chaser hit (staging A 972 / 1184 / 1216 ghost, 972 … 2080 sword;
atlas 397 1179 / 1213 / 1239) falls inside climb 1's kill, from `bob@736,752`. The page legs take none (nearest approach
5.8 / 5.6 px at t1260 / t1338).

**414 on the atlas** now throws inside `execKillByPress` → `deriveStrike` → `walkTo` → `previewWalk` → the chaser
forecast: *"whether bob bob@736,752 is on screen depends on where inside `Game.shake`'s jiggle the camera landed …"*
(after two deaths, t1202 and t2395). G1 measured REFUSED 5672 with 14 hits there; something since `11e113e2fe` moved
it. Not this slice's region (the forecast's camera band is fidelity's).

## D1 — diagnose (PASS → STOP)

### 1. Whose wall is it?

**(b) first, then (c): the chooser cannot speak, and past it the chaser arm cannot kill the guard.**

The call site: `climbLadderUnder` (`solverBot.js`): `chooseBodyToRemove(goal, aim, …)` returns `[]`, C1's
`hitSourceBodies` admits nothing (the only source is a chaser, never admitted by design), so `body` / `target` is
`null` → BAIT's *"NO LIVE BODY"* → the kill rung's `!target` branch → DETOUR (every source a chaser) → `refuse(…
EXHAUSTED …)`.

Why the list is empty, measured (an instrumented chooser in a scratch worktree, `CW_CHOOSER_LOG`, at staging A's boot,
aim (888,834)): the aim's tile is covered by exactly one volume, `bobsoldier@880,832`'s. Each of the 20 candidates
alone → `reach=false`. Then jointly with the cover body:

| hypothesised absent together | a corridor? |
|---|---|
| `bobsoldier@880,832` | no |
| `bobsoldier@880,832` + `bob@736,752` | no |
| `bobsoldier@880,832` + `bob@736,800` | no |
| **`bobsoldier@880,832` + `bob@736,752` + `bob@736,800`** | **yes** |

So the chest needs three removals, one of which (the guard) covers the aim itself. A single-removal chooser can never
answer, and DETOUR cannot either (its legs all end on the unwalkable goal tile: 0 previewed).

Not (a): the press kill's exit is the lock-less return on the removal tick, and AVOID's refusal is the goal tile, which
does not depend on where the kill ended. Not (d) on the ghost stagings (2 below).

### 2. Would the game agree? (wasm p4f, headless logic-only)

| prefix (tape) | probe | result |
|---|---|---|
| staging A ghost, 2195 t (G1's committed witness; `cw-tape.mjs` rebuilds it byte-equal from W0's keys) | `probe-seedling-u9-shield-mobiles --class=Bob` | clock [0]; **Bob rows 20,772 comparisons, worst \|Δ\| 0** (G1: the player stream 2196/2196, every Spinner row equal) |
| 397 on the atlas, 2336 t (`w0-l40-atlas397-ghost-prefix.tape.json`) | the same | clock [0]; **28,044, worst 0** |
| D1.3's override, staging A ghost, 2320 t (through the chaser arm's walk) | the same | clock [0]; **27,828, worst 0** |
| **staging A sword, 3113 t** (`handover-l40-A-sword-prefix.tape.json`) | `--class=Bob`; `--class=Spinner --upto=2016`; `probe-seedling-chaser-mobiles --camera` | **FAIL: Bob first parts at t1801**; the player at t2016 (game (745.16,789.91), model (743.74,792.27)); worst \|Δ\| 32.0. Spinners equal through 2016 (10,075, worst 0). The camera equals the model's exact (661,604) through 2015 (the witness parts only at 2016, after the player) |
| the page legs (397 / 414) | — | not replayable: they stage the AP-delivered levels and a tape boots the atlas (G1) |

**Where and why the sword prefix parts** (`evidence/handover-t1801-parting.txt`): at t1801 the game stops
`bob@736,752` dead at (743.929, 753.416), velocity still written, while `spinner@880,848` passes 6.4 px north of it
heading south; the model walks the bob on (753.195, 752.974, …). The model's chaser sweep walls a chaser with
`chaserStaticEnemyBoxesNow()`: static census "Enemy" bodies and ice turrets, **no live Spinner**. A Spinner's type is
"Enemy" (`levelRun.js`, the slash line-of-sight note) and Bob's solids include "Enemy". A scratch wall (live
`spinnerRectsNow()` appended to that list, `d1-scratch-spinner-wall.diff`) freezes the bob at the game's exact
(743.929, 753.416) from t1801; replayed against the game's rows, the first parting moves to **t1989** (worst 8.8 px;
so the scratch is not the whole fix). This is **(d), the model, fidelity's** (`levelRun.js`). STOP for fidelity on the
sword staging.

### 3. Is there a plan? (scratch override of the deciding rung)

`CW_JOINT=1` (`d1-scratch-chooser.diff`, scratch worktree only): where the list is still empty and the aim's tile lies
in a live chaser's volume, hypothesise the cover bodies and the hit's chasers absent together, growing the set by one
live body at a time until a corridor exists; the set (hit first) becomes the removable list.

| workload | lapse | ends | what happened | hits |
|---|---|---|---|---|
| staging A ghost | OFF | REFUSED 2320 on `bobsoldier@880,832` | t2195: set {`bob@736,752`, bobsoldier, `bob@736,800`}; BAIT refuses `bob@736,752`; kill rung, **chaser arm** on `bob@736,752` (stance found), walk; t2320: the walk's probe meets the bobsoldier's sword → BAIT and the chaser arm refuse it | 3 (= OFF) |
| staging A sword | OFF | REFUSED 3334 on `bobsoldier@880,832` | the chaser arm **kills `bob@736,752`** (3113→3262) and **`bob@736,800`** (3262→3334), then the bobsoldier | 6 (= OFF) |
| 397 ghost (page) | OFF | REFUSED 1351 on `bobsoldier@880,832` | the chaser arm on `bob@736,752`, then the bobsoldier | 0 |
| 397 ghost (page) | ON | REFUSED 1305 on `bobsoldier@880,832` | the lapse's probe names the bobsoldier first; the arm has no stance | 0 |
| 414 ghost (page) | OFF | **THREW** at 1469 | the walk to `bob@736,800`'s stance killed both bobs; the arm's dwell then throws *"… is ALREADY TRUE before a tick is spent, so waiting for it proves nothing"* | 0 |

**No leg solves.** Every one ends on the guard with:

> chaser arm: no stance derives for bobsoldier@880,832 on level 40: … 76 cell(s) inside its 80 px leash, 7 of those
> reachable and with a corridor onward, and 7 of THOSE refused by the forecast [(824,856): bobsoldier@880,832 is still
> standing after the whole 115-tick ceiling — it does not reach this stance inside its own travel time plus three kill
> windows; …]

and BAIT: *"no stance within bobsoldier@880,832's leash (80) both pulls its straight line through a kill region and is
itself danger-free: 35 cell(s) in leash, 8 of them crossing a region, none of those reachable"*. The chaser arm's
premise is stand-and-wait, and this guard stays at (888,840) for the whole of every run (nearest approach to the player
149–173 px). That is **(c)**: fidelity's chaser arm and BAIT. The chooser layer alone buys no verdict: it moves the
refusal from "no target" to "no stance", with the same hits.

### 4. The lapse (`SEEDLING_STRIKE_IFRAME_LAPSE=1`)

**It changes none of the answers.** Every prefix is byte-identical ON (keys, hits, deaths, the refusal tick, the
player's and the chasers' positions) on all six workloads. Only the refusal TEXT moves: the walk's strike policy
changes the probe's samples, so 397 (page) meets the bobsoldier's sword first, 397 (atlas) names `bob@736,752`
instead of `bob@736,800`, and 414 (page) moves the danger point 0.4 px. 414 on the atlas throws identically. Under the
override, the lapse only makes 397 reach the guard 46 ticks sooner (no chaser-arm walk). The lapse does not reach the
guard or the chest stance.

### BW — does `bombpusher@112,128` reach any CW workload?

**No.** `SEEDLING_PRESS_KILL_BOMBS=1` on all six workloads (`evidence/rows/bw-*.json`): the lobber is in the room's
roster on every one, **no bomb is ever live** (0 ticks), the switch's asks refuse nothing (strike 5–14 asked, refuge
6,864–12,768 asked, 0 refused), and every row is byte-identical to OFF (keys, message, end state; 414-atlas throws the
same).

## The STOP and the hand-over

D1 says (c) on the ghost stagings and (d) on the sword staging, so there is **no switch, no D2, no D3**. Nothing in
`solverBot.js`, `levelRun.js` or any tracked code changed.

**For fidelity (a wave-17 item, beside CORRIDOR BODY PRICING):**
1. **(c) The chest's guard.** `bobsoldier@880,832` covers the chest stance's tile and never approaches. The chaser arm
   (`deriveKillByChaser`) refuses every in-leash stance because the guard does not reach it inside the forecast's
   ceiling, and BAIT finds no reachable lure stance. An approach-and-strike stance (the player goes to the body), or a
   ceiling that admits a body that waits at home, is the missing tool. The state: G1's committed witness
   (`fixtures/hammer-g1-ghostkill-witness/hammer-g1-l40-ghostkill.tape.json`, 2195 t, ends at the refusal), or this
   slice's `handover-l40-A-ghost-override-prefix.tape.json` (2320 t, game-exact, ends with the bobs' stance walk done
   and the guard next).
2. **(c) The chaser arm's dwell after a walk that already killed.** Under the override on 414, the walk to the stance
   killed both bobs with the opportunistic strike policy, and `runDwell` then threw *"ALREADY TRUE before a tick is
   spent"* (`evidence/rows/d1-j-p414-ghost-L0.json`). The arm should treat an already-dead target as done.
3. **(d) A live Spinner does not wall a chaser in the model.** `chaserStaticEnemyBoxesNow()` has no live spinners; the
   game stops `bob@736,752` against `spinner@880,848` at t1801 on staging A's sword prefix
   (`handover-l40-A-sword-prefix.tape.json`, `handover-t1801-parting.txt`). The scratch wall moves the first parting
   to t1989, so the exact rule (which box, which side, the spinner's own reflection) is still to be read off the game.
4. **The forecast's camera band on 414 (atlas)**: the press kill's strike preview throws *"… depends on where inside
   `Game.shake`'s jiggle the camera landed"* at t2439 after two deaths. New since G1's REFUSED 5672.

**For the hammer arc (if fidelity's arm lands):** the chooser needs a joint hypothesis where the aim lies in a body's
volume (measured: three bodies at staging A). C1's "never a chaser" stands for the single-body list; this case is
different because the aim itself is covered, so DETOUR can never solve it (the L16 trap C1 measured does not apply
here). `d1-scratch-chooser.diff` is the measured shape. It is worth a switch only once the guard can be killed.

## D4 — records (PASS)

- `seedling-bot-log.md`: § *Seedling hammer-phase CW — the L40 chaser wall* (the diagnosis; no switch).
- `seedling-bot.md`: no paragraph (no switch ships).
- Surface / constants: no code changed, so `--check` only: GREEN 288 · PASS 5,846 · PASS 558 · PASS 138 (`evidence/censuses-after.txt`). No `--profile-rows`, no `--write`.
- Reference: regenerated after the log (`generate-procgen-reference.mjs`: the docs index's word counts, `README.md`'s region and `procgenDocs/generated/docsIndex.js`), then `--check` **ALL 7 + 5 MATCH**, 0 findings (the log cites the evidence by folder, so the instruments index gains no finding). `scripts/quicklaunch/generate-docs-index.mjs`: current (164 docs).
- Bounded vitest AFTER: **41 files, 1206 / 1206** (`--maxWorkers=3`): W0's 32 plus `boxLock`, `seedlingConstantsCensus`, `procgenDocs/generated`, `procgenDocs/docLinks`, `procgenDocs/docsRender`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface` and `checkProcgenHelp` (`evidence/vitest-files.txt`). No row was added, so no new solve row needs a timeout.

## Deltas (base → head)

- **New:** this report; `CC/docs/cloud-reports/seedling-hammer-cw-evidence/` (the drivers `cw-solve.mjs`,
  `cw-run.sh`, `cw-tape.mjs`, `cam.mjs`, `cmpbob.mjs`, `sum.js`; the rows `rows/{w0,d1,bw}-*.json`; the game summaries
  `game-*.txt`; the hand-over tapes and the t1801 excerpt; the two scratch diffs, which are evidence, not code).
- **Changed:** `seedling-bot-log.md` (one section); `docs/json/developer/procgen/README.md` and `frontend/modules/procgenDocs/generated/docsIndex.js` (the regenerated word counts).
- **Untouched:** every `.js` module, the chaser arm, BAIT, `dangerMap`, `levelRun.js`, `strikePolicy.js`,
  `contactFidelity.js`, `deriveRefuge` / `refugeNow` / `pressKillCost.js` (RE's), `ghostSpinnerPress.js`,
  `jsRuntime*` / the worker / `flashPanel/*`; no AS3, wasm, gitlink or rules edit; every identity row, producer and
  committed tape.

| | before | after |
|---|---|---|
| identity block | = G1's AFTER, every value row (`evidence/identity-w0.txt`) | the same tree code (docs only) |
| surface / constants / entities / profile | 288 / 5,846 / 558 / 138 | the same |
| roster | 277 | 277 |
| tapeRunner pairs | **611**, `75a3c41f` (= G1) | the same |

## What the brief got wrong (measured)

1. **"every L40 chest-side workload now ends on the same chaser"**: five of six do (`bob@736,752` or `bob@736,800`),
   but the chaser is not the wall. The aim lies inside `bobsoldier@880,832`'s volume, and three bodies have to go
   together; past the bobs, the guard is where every workload stops.
2. **"414 … REFUSE on `bob@736,800`"** holds on the page. On the atlas, 414 now **throws** in the chaser forecast's
   camera band at t2439 (G1: REFUSED 5672, 14 hits).
3. **"staging A's ghost … dies once on the way"** and **"the sword's staging A … lands six times, kills at t3100"**:
   both reproduce (keys `b762a2e6`, `af47d35d`). But the sword's prefix is **not** game-faithful past t1801 (the
   spinner-walls-a-chaser defect), so its later hits (2025 / 2057 / 2080) and its refusal tick are the model's, not the
   game's.
4. **"If your wall is the chaser arm, leash pricing or BAIT, it is fidelity's"**: yes, but the first layer is the
   chooser's (b), which the hammer arc owns. It has no verdict value alone (measured by the override), so it is not
   built here.
5. **"Measure whether `bombpusher@112,128` reaches any CW workload"**: it never lobs a bomb at any of them (0 live-bomb
   ticks), and BW ON is byte-identical.

## Residue

1. **For fidelity:** hand-over items 1–4 above. The lapse's effect for LAPSE-COST: none on these workloads (prefixes
   byte-identical; only the refusal's first-named danger moves). It does not touch the 11 `level_40__r23c29` PIT exits
   here because none of these runs walks to one.
2. **For the planner / CI** (dispatch returns 403 from the cloud): `JavaScript Unit Tests` on
   `claude/seedling-hammer-cw-pjoaeg` at the head (`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`). No
   divergence-sweep keys: nothing ships, so no row can move. For a later re-measure of the page legs:
   `-f mode=inv -f producer=solver -f shards=1 -f keys="level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest|level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Chest"`.
3. **No route leg grants the ghost in L40** (unchanged); the page rows 397 / 414 run the sword on the page.
4. **The bobsoldier on the game**: the mobiles probe reads `Bob|Puncher|Spinner|WallFlyer` only, so the guard's own
   rows were not compared. The model keeps it at (888,840) for every run; `probe-seedling-chaser-mobiles
   --class=BobSoldier` is the instrument if fidelity wants it.
5. **Tree hygiene:** the two scratch worktrees (`$SCRATCH/mut`, the scratch diffs' home; `$SCRATCH/base`, the pristine reference check) were removed by name; the identity block left no tracked dirt; no `pytest`, no `git stash`.

## Rows to BANK

- No switch. Surface **288**; constants **5,846**; entities 558; profile 138; roster **277**; tapeRunner pairs
  **611**, `75a3c41f` (= G1); identity block = G1's AFTER-OFF (`77080c2e`) row for row; reference ALL 7 + 5 MATCH at the head.
