# Seedling hammer-phase L40C: the combined L40 measurement (five OFF switches on every L40 leg, MEASUREMENT ONLY)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-l40-combined` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `480c2aa4` (origin/main; it contains LWEIGH's `4e41360463`) |
| Head | W0 `af70e11b`; M `63e1cbab` and `875bf425`; this report (with the bisection files) is the last commit on the branch |
| Branch | `claude/seedling-l40-combined-measure-xusatn`. This is the harness's designated branch; the brief's `seedling-hammer-l40-combined` name was not used |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-l40-combined-evidence/` (instruments under `tools/`) |
| Product code | **none committed**. Two env-gated scratch knobs were in `solverBot.js` during M; they were removed by `git checkout` before this commit and are kept as `tools/scratch.patch` |
| Scope messages | none arrived mid-run |
| `turretSnapPricing` | **not on main** (only on `fidelity-harvest/turretsnap` / `fid11-on/turretsnap`), so **arm A6 was not run** |

## 2. The answer first

**The one thing to know first:** Boss Key 2 solves in the model in two places, and **neither is an L40 arrival**:
- **ICEST's pocket boot (480,456), in every arm including the defaults:** 4495 t, the same answer in all 12 arms;
- **the L40LATCH latch staging, under SCRATCH only:** 4138 t, game-modelled on a fresh replay (`collected` keyType 2 at
  t4138). The smallest arm that does it is CPAIR-3 + `LATCH_WEIGH_FIRST` + **the LWEIGH approach guard off** + **the
  strategy bound at 5**. The plan takes **one non-fatal hit**: the t917 blast the guard exists to refuse.

From the two Boss Key 2 arrivals (legs 860 ← L39 and 861 ← L43), **no arm solves**. That includes A5, the deadline lifted
4×, and every scratch knob. The first wall on 860 in the best arm is **`spinner@816,848`**, and it holds whether ICEST is
on or off.

| # | question | answer |
|---|---|---|
| 1 | Does Boss Key 2 solve from any L40 arrival, in any arm? | **No.** 0 of 2 BK2 legs in all 12 arms (A0–A5 and the six ablations), and 0 of 2 under every scratch arm tried (guard off, bound 5/8, deadline ×4). It solves only from the pocket boot (every arm) and the latch staging (SCRATCH, guard off + bound ≥ 5, with a hit) |
| 2 | Per goal: best arm, and its wall | table below |
| 3 | Load-bearing / inert / worse | **Load-bearing:** CPAIR-3 (+3 legs, the L43 pits 5_21/22/23); `orbitFreeAim` (Chest ← L43, and leg 860 past `bobsoldier@880,832`); OPP (decides WHICH Chest leg solves). **Moves text only on L40:** LWF (`hold`→`weigh stance`), SBD (the 4-strategy bound), ICEST (861/1's wall; inert on the latch chain without LWF). **Worse anywhere:** no solve lost in any arm on any workload. But A5's latch chain refuses at CORPSEBUMP where A4 reached t1245; CPAIR-3 reds 2 L40 hammer producer pins; and OPP roughly doubles the cost of L40 survey steps 67/95 (87–117 s against a 120 s cap, one load-induced TIMEOUT) |
| 4 | Ready to flip? | **No arm and no switch is ready.** The closest is **CPAIR-3 alone**: it solves something new (3 legs, 6 requests, hitless, game-modelled), loses nothing (61 requests, 240 survey rows, r9, latch, pocket), and its pins are named (§5). It still needs the planner's game witness for the three pits and the re-record of 2 producers + 4 test rows. Every other switch solves nothing alone. The rows each flip moves: CPAIR-3 4 (+2 producers), OPP 6, LWF 5, `orbitFreeAim` 1, ICEST 0, SBD 0 |
| 5 | The ranked next slice | **1. `spinner@816,848` on leg 860's walk west** (the press kill's hammer-line corner at t2763, or the combat ladder at (721.9,680.6) without ICEST). **2. CORPSEBUMP**: `orbitFreeAim` (which the arrival legs need) and the corpse weigh (which the latch needs) cannot both run today. **3. The approach volley together with a 5th order**: SCRATCH proved these two finish the chain from the latch staging. Detail in §6 |

**Per L40 goal** (a leg's verdict is its LAST captured request; `h` = the solve carries a non-fatal hit):

| goal | legs | A0 | best arm | the best arm's wall (named, not fixed) |
|---|---|---|---|---|
| **Boss Key 2** | 2 | 0 | none (A5 gets furthest) | **860 ← L39:** at the captured budget, `weigh stance (wandlock@448,432)` waypoint 6 (472,440) not reached within 400 ticks (stalled at (472.8,674.2)). With the deadline lifted (SCRATCH), **`kill (spinner@816,848) by press`**: "every key set … lands the player box on a body's 7x7 rect or on the 13 px hammer line … at (770.96,860.99)", 19 t after the landing at t2744 (HAMMER_PHASE_RUNG). **861 ← L43:** the anytime deadline at the `walk` site, even at 10240 work units |
| **Chest** | 2 | 0 | **A5: 1h** (399 ← L43, 1914 t, a hit at t801 by `bob@736,800`). A5 minus OPP: 1h (382 ← L39 instead, 1321 t, a hit at t701 by `bob@736,752`) | A5's 382: the anytime deadline; lifted (SCRATCH), `bobsoldier@880,832`'s sword at (887.5,853.2). A5-OP's 399: the press kill death at t800 (`bob@736,752`, PRESS_KILL_REBOOT_GUARD). No arm solves both |
| L40 flag 8 (`bosslock@480,352` cleared) | 2 | 0 | none | every arm: `'keylock' could not be resolved … no REACHABLE stance on bosslock@480,352's key line` (from (488,904) and (328,600)); work 20 |
| Totem Part 64,144 | 2 | 1 | = A0 | leg 366: the break stance (`breakablerock@176,128`) meets `bombpusher@112,128`'s bomb blast at (232–258,130); A3+ adds the anytime deadline to request 0 |
| Totem Part 160,640; L39 72,40; L41 240,144; L42 184,152; L43 Totem of Lacste; L43 Wand | 2,1,1,1,1,1 | all | A0 | — |
| exits `out_pit_5_21/22/23` | 2 each | 1 each | **A1** (CPAIR-3): 2 each | — (legs 374/378/380 ← L39 solve, 955/938/909 t, hitless) |
| exits `out_pit_13_21`, `out_pit_14_21` | 2 each | 1 each | = A0 | legs 375/376 ← L39: the anytime deadline (2562 work). Lifted (SCRATCH, 7054 work): `chaser:bob@192,480` at (216.5,504.6), the combat ladder exhausted |
| every other exit (17 legs) | | all | A0 | — |

## 3. W0: the baselines and the capture

| row | result |
|---|---|
| base | `git fetch origin main` → `480c2aa4`; `session_bootstrap.sh --seedling` → READY, node v22.22.0; every non-wasm submodule initialised |
| identity block (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`; the six producer `--check`s exit 0 (r9 campaign `be9c19c8`); reference **ALL 7 MODULES AND 5 REGIONS MATCH**. **Every row equals LWEIGH's published values.** The generated-set row was refused by the box lock the capture held; re-run after it, **OK** |
| `ci-producer-checks --jobs=4` at the defaults (`producer/producer-A0.txt`) | **97 run, 0 red, 1 skipped** (`plan-seedling-r7-ends-meet`, CI's browser arm), 439 s. Main now has 97 producers; LWEIGH had 95 |
| the leg list | `seedling-divergence-legs.mjs` at the base: 919 legs. **Every L40 leg KEY is LWEIGH's 52; none is new** (`l40-leg-keys.txt`: the id at this SHA, then the key) |
| the capture | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --keys=<the 52> --capture-requests`, this tree on :8000. 52 legs: **39 done, 12 failed, 1 timeout; 61 requests**. The capture (32 MB) is not committed; `capture-legs.tsv` (leg, end, seam, request count, key) and `capture-index.tsv` (one row per request: id, i, seam, prefix, goal, the page's verdict) are |
| the BK2 legs | **860** = `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29` (seam 5950); **861** = the same `<- in_L43_176_464` (seam 5425). Both failed on the page; 2 requests each |
| the determinism control | A0 replayed in node (`tools/arms.mjs`, the worker's own `solveAnytime` dispatch) **equals the page's answer on 61/61 requests** (verdict and work units). 41/61 solved; every solved plan is game-modelled and hitless |

**The 30(c) check** (`tools/arms.mjs` `modelled`): every SOLVED plan's keys are replayed on a fresh run from the
request's own staging and prefix, row by row against the plan's `expected` (level, x, y, deaths), with every hit and
death counted. Every solve in every arm passes it. The only solves that carry a hit are the two Chest plans (§2).

## 4. M: the arms

### 4.1 The arm × request table

Full table: `arm-request-table.txt` (one row per request per arm). Per-goal: `arm-goal-table.txt`. Raw rows, one jsonl
per arm, gzipped: `req/`. The increments (`increments.txt`, by answer digest):

| step | movers | solved | what moves |
|---|---|---|---|
| A0 → A1 (+CPAIR-3) | 9 | 41 → **47** | the L43 pits 5_21/22/23 (374/378/380, both requests each) **SOLVE**; 382/0 Chest moves to the anytime deadline; 860/1 and 861/1 move from the x≈744 bob to **`bobsoldier@880,832`'s sword** |
| A1 → A2 (+ICEST) | **0** | 47 | nothing (61/61 byte-identical) |
| A2 → A3 (+OPP) | 4 | 47 | 366 (Totem 64,144) and 399 (Chest ← L43) move to the anytime deadline (399 was the t800 press-kill death); 861/1 refusal text |
| A3 → A4 (+LWF) | 2 | 47 | 860/1, 861/1: `hold stance (wandlock@448,432)` → `weigh stance (wandlock@448,432)`, the rest equal |
| A4 → A5 (+`orbitFreeAim` +SBD) | 3 | 47 → **48** | **399/0 Chest ← L43 SOLVES** (1914 t; a non-fatal hit at t801 by `bob@736,800`; verbs `bait`, `kill`); 860/1 passes the bobsoldier and stalls on the weigh stance's walk; 861/1 → the anytime deadline |

### 4.2 The ablation from A5 (`ablation-vs-A5.txt`)

| arm | movers vs A5 | solved | what the switch carries in the full stack |
|---|---|---|---|
| A5 − CPAIR-3 | 9 | 48 → **42** | **load-bearing**: the three pits (6 requests) are lost; 860/1 and 861/1 fall back to the x≈744 bobs |
| A5 − ICEST | 1 | 48 | 861/1: deadline → the combat ladder on `spinner@816,848` at the weigh stance's walk. Inert on every solve |
| A5 − OPP | 4 | 48 | **a trade**: 382/0 Chest ← L39 **solves** (1321 t, a hit at t701 by `bob@736,752`), and 399/0 Chest ← L43 is lost (the t800 press-kill death); 366 refusal text |
| A5 − LWF | 1 | 48 | 860/1: the weigh-stance walk stall → the anytime deadline. Inert on every solve |
| A5 − `orbitFreeAim` | 3 | 48 → **47** | **load-bearing**: 399/0 is lost (deadline); 860/1 and 861/1 fall back to `bobsoldier@880,832`'s sword |
| A5 − SBD | 2 | 48 | 860/1, 861/1: refused by the 4-strategy bound `[shove, weigh(448,432), burn(872,784), weigh(448,432)]`. Inert on every solve |

### 4.3 The latch chain and the pocket boot (`latch/`)

| arm | latch chain (L40LATCH's `latch-boot.json`, (888,776)) | pocket boot (480,456) |
|---|---|---|
| A0, A1 | `hold stance (wandlock@448,432)` → `bob@736,800`, t271 | SOLVED 4495 |
| A2, A3 | `kill (iceturret@472,400)`: ICEST's arm, no hitless try (490 forks: 98 approach hits, 392 blasts while circling), t833 | SOLVED 4495 |
| **A4** | `weigh (wandlock@448,432)`: the reordered corpse weigh took the **t917 blast** on the approach to the kill stance (488,445); refused at t1245 (LWEIGH's guard) | SOLVED 4495 |
| **A5** | `weigh (corpse bump 2, iceturret@472,400)`: *"iceturret@472,400 is ALREADY on (30,24)"* (**CORPSEBUMP**; a BotDriverV2Error, so no perTick) | SOLVED 4495 |
| A5 − CPAIR-3 | `weigh stance` → `bob@736,800`, t351 | SOLVED 4495 |
| A5 − ICEST / − OPP / − SBD | = A5 (CORPSEBUMP) | SOLVED 4495 |
| A5 − LWF | `hold stance` → `kill (iceturret@472,400)`, no hitless try, t879 | SOLVED 4495 |
| A5 − `orbitFreeAim` | = A4 (the t917 blast, t1245) | SOLVED 4495 |

The pocket answer is the same in all 12 arms (`pocket-*.txt`, byte-identical but for `ms`). Every arm reproduces
LWEIGH's latch rows, and CORPSEBUMP is exactly LWEIGH's § 2 item 4.

### 4.4 The off-L40 radius per arm

| workload | A0 | A1 | A2 | A3 | A4 | A5 | ablations |
|---|---|---|---|---|---|---|---|
| route survey, 240 rows (`survey/`) | 203 SOLVED / 37 REFUSED | **0 movers** | **0 movers** | 2 movers | 2 movers | 2 movers | not run (subsets of A5; A5 moves nothing off L40) |
| the movers | — | — | — | steps 67, 95 (both L40): the press-kill death at t780 → `bobsoldier@880,832` COVERED GOAL at the chest stance (later in the chain) | the same; step 95 printed TIMEOUT (120 s) under load, and re-run alone it REFUSES on the same wall in 88.8 s | steps 67, 95: the press-kill death → the chest's proximity hazard at (887.8,835.4) | — |
| L40 steps 67/95 cost (ms, under load) | 58,864 / 41,032 | 50,609 / 40,045 | 48,539 / 42,144 | 91,400 / 116,768 | 106,586 / TIMEOUT | 102,765 / 87,437 | — |
| r9 campaign `--check` (`r9-per-arm.txt`) | `be9c19c8`, green | = | = | = | = | = | **all six =** |
| producer roster `--jobs=4` | 97 run, 0 red | — | — | — | — | **97 run, 2 red** (§5) | — |

**Off L40 nothing moves in any arm**: 0 survey rows outside L40, and the r9 campaign is byte-identical in all 12 arms.
The two producer reds are L40 pins. The one cost finding: with OPP ON, the two L40 survey rows run near the survey's
120 s per-step cap. This was measured under load, so it is an upper bound, but a CI runner slower than this box would
TIMEOUT them.

## 5. Flip readiness and the pins each flip moves

**The pins.** At the defaults, the producer roster has 0 red (97 run) and the bounded set (LWEIGH's 38 fast files,
`bounded-files.txt`) is **421/421**. Under A5 the roster has **2 red** and the bounded set **12 failed / 408 passed /
1 skipped** (`bounded-A5.txt`). Each was bisected by single switch (`producer/pins-single-switch.txt`, `producer/bounded8-*.txt`):

| switch | producer pins it reds | bounded rows it moves |
|---|---|---|
| CPAIR-3 | **`plan-seedling-hammer-g1-ghostkill`** (DRIFT of `hammer-g1-l40-ghostkill`) and **`plan-seedling-hammer-sf-strikefloor`** (3 checks: its OFF and ON asserts expect "refuses on the chaser bob@736,752"; the run now REFUSES at t2317 / t1796 on `bobsoldier@880,832`; plus DRIFT) | 4: `hammerChooserPair` "853 at 5172…" and "the measurement arm that asks triples too…"; `hammerGhostKillRung` "ON: the rung asks the press kill…"; `hammerStrikeEtaFloor` "ON: the solve's executed prefix IS the witness…" |
| ICEST | none | **none** (69/69) |
| OPP | none | 6: `fidelityL40Bk2` "ON: the chain walks the south door's links…", `fidelityL40Res` "ON: the re-entry passes to the chest…", `hammerChooserPair` "853 at 5196…", `hammerPressKillChasers` "step 67: OFF the kill walks into bob@736,752 and dies…", `hammerPressKillGuards` "HO2 OFF: the press kill carries on past the death at t788" and "HO2 ON: the press kill is refused by name…" |
| LWF | none | 5: `fidelityL40Bk2` "ON: the chain walks the south door's links…", `fidelityL40Res` "OFF: survey step 93…" and "ON: the re-entry passes to the chest…" (LWEIGH's three), and `hammerChooserPair` "853 at 5196…" and "853 at 5172…" (the `hold`→`weigh stance` text) |
| `orbitFreeAim` | none | 1: `fidelityL40Latch` "candidate 1, driven from the latch boot in the model, kills bobsoldier@880,832 by t184 and is never hit" |
| SBD | none | **none** (69/69) |

The union of the single-switch rows is exactly A5's 12 (some rows move under two switches: "853 at 5172" under CPAIR-3
and LWF, "853 at 5196" under LWF and OPP, the two L40Bk2/L40Res ON rows under LWF and OPP). The 8 files of the 12 rows
were re-run per switch (`producer/bounded8-*.txt`); the other 30 files pass under A5 already. These rows read the process env, so
a flip that does not pin them OFF moves them. The fidelity rows are fidelity's
files: the planner gets them signed.

**Readiness** (ready = it solves something new or moves a refusal later; it loses no solve on the survey, r9, the roster
or any L40 request; and its pins are named):

| candidate | new solve or later refusal | loses a solve? | pins | verdict |
|---|---|---|---|---|
| **CPAIR-3 alone** (A1) | **3 legs / 6 requests** (the L43 pits 5_21/22/23), hitless, game-modelled; 860/1 and 861/1 move from the x≈744 bob to the bobsoldier | **no** (61 requests, 240 rows, r9, latch, pocket) | 2 producers + 4 rows, above | **closest to ready.** Missing: the planner's game witness of the three pits (TT; CPAIR's own hand-over), and the re-record of the named pins. The switch's shipped `size` is 2; this verdict is for `SEEDLING_CHOOSER_PAIR_SIZE=3` |
| ICEST alone | none on L40 (A1 → A2: 0 movers) | no | none | not ready: inert here |
| OPP alone | refusals move (Chest, Totem 64,144) but nothing solves | no | 6 rows | not ready. It also doubles the cost of L40 survey steps 67/95 |
| LWF alone | refusal text only | no | 5 rows | not ready (LWEIGH's verdict, unchanged) |
| `orbitFreeAim` + SBD | needs CPAIR + OPP to solve the Chest leg | — | fidelity's | fidelity's to weigh; not a hammer flip |
| A4 (stack) | = A1 on every solve | no | CP's + OP's + LW's | not ready: nothing beyond A1 |
| **A5 (stack)** | A1's 3 legs + **Chest ← L43 with a hit** | no solve lost; but the latch chain refuses at CORPSEBUMP where A4 reached t1245 | 2 producers + 12 rows | **not ready**: its only new solve carries a non-fatal hit (the bait's), and it breaks the latch path at CORPSEBUMP |

## 6. The ranked next slice (with its scratch measurements)

**The scratch arms** (SCRATCH, not shipped; the knobs are `tools/scratch.patch`: `L40C_SCRATCH_NOGUARD=1` skips LWEIGH's
approach-hit refusal, `L40C_SCRATCH_BOUND=N` sets `MAX_STRATEGIES_PER_GOAL`; `L40C_BUDGET_WORK=N` raises the captured
request's `budgetWork` inside `tools/arms.mjs` only):

| scratch arm | workload | result |
|---|---|---|
| A4 + guard off | latch | `wandlock@800,400` opens t3416, then the 4-strategy bound at `pushableblock@576,560`, t3502 (LWEIGH's, reproduced) |
| **A4 + guard off + bound 5** (and bound 8) | latch | **SOLVED 4138 t**. A fresh replay (`scratch/latch-A4ngb5-replay.txt`): turret dead t966, corpse (30,26)→(30,25)→(30,24), `wandlock@448,432` open t1245, `wandlock@800,400` t3416, **Boss Key 2 collected t4138**, hits = **[t917 blast `iceturret@472,400#2.2`]**, 0 deaths |
| **CPAIR-3 + LWF + guard off + bound 5** | latch | **SOLVED 4138 t**: the smallest arm (ICEST and OPP are not needed) |
| A5 − `orbitFreeAim` + guard off + bound 8 | latch | SOLVED 4138 t |
| A5 + guard off + bound 8 | latch | CORPSEBUMP (`orbitFreeAim` breaks the chain before the guard is asked) |
| A4 / A5 + guard off + bound 8 | 860, 861 | unchanged: A4 stops on `bobsoldier@880,832`'s sword, A5 = A5 |
| **A5, deadline 10240** (4× the retry's 2560) | 860 | **reaches `kill (iceturret@472,400)` → staging (up) → `kill (spinner@816,848) by press`: the hammer-line corner at (770.96,860.99), 19 t after the t2744 landing**, work 2832 |
| A5, deadline 10240 | 861 | the deadline again at 10240 (the `walk` site) |
| A5 − ICEST, deadline 10240 (± guard off + bound 8) | 860, 861 | `weigh stance (wandlock@448,432)`: the combat ladder exhausted on **`spinner@816,848`'s body at (718.6,682.8)** (horizon 380); 861 the same at (599.1,678.5) |
| A5 + guard off + bound 8 + deadline 10240 | 860, 861 | = A5 at 10240 (the spinner corner comes first) |
| A0 / A5, deadline 10240 | pits 13_21/14_21 (375/376) | `chaser:bob@192,480` at (216.5,504.6), work 7054 (both arms) |
| A0 / A5, deadline 10240 | Chest 382 | A0: the x≈744 bob (work 88); A5: `bobsoldier@880,832`'s sword at (887.5,853.2) |
| A0 / A5, deadline 10240 | Totem 366 | `bombpusher@112,128`'s blast at the break stance (both) |

**The ranking.** No single wall fix unlocks an L40 goal from a captured arrival. This was measured: every knob alone and
together leaves 860/861 refused. Ordered by how much of the BK2 chain each one gates:

1. **`spinner@816,848` on leg 860's walk west**: the press kill's hammer-line corner (with ICEST), or the combat ladder
   on its body near (720,680) (without). This is the FIRST wall on the only BK2 arrival leg that gets past the
   bobsoldier, it stands in both ICEST arms, and nothing behind it is reachable until it falls. It is the brief's wall 2
   (the "861 hammer-line/hold window"), now measured on 860, and the hammer arc's own (HAMMER_PHASE_RUNG). The
   recommended next slice.
2. **CORPSEBUMP** (fidelity's `execCorpseWeigh` rest read vs `runFire`'s entity tile). The arrival legs need
   `orbitFreeAim` to pass `bobsoldier@880,832`, and with `orbitFreeAim` the corpse's second bump is refused. So a chain
   from an arrival cannot both pass the bobsoldier and weigh with the corpse today. It is on the critical path after
   item 1. It is fidelity's to fix.
3. **The approach volley + a 5th order, together.** SCRATCH proves these two are all that stand between the latch staging
   and Boss Key 2 (4138 t). Neither alone suffices: guard off alone ends on the bound at t3502, and the bound alone never
   gets past the guard at t1245. The volley fix must make the approach hitless (a turret-clock entry), not just admit
   the hit. A 5th order is a bound change (⚖ the bound is named rather than generous).
4. **The anytime deadline on 861 and on the pits 13_21/14_21.** 861 still trips at 4× the budget. The pits are only
   hidden by it: `bob@192,480` stands behind.
5. **The 860 sword line** (`bobsoldier@880,832`): already passed by `orbitFreeAim` on 860 in A5. It is the wall only where
   `orbitFreeAim` is off, and on the Chest ← L39 behind the deadline.

The two Chest legs are a separate, smaller lever. OPP decides which one solves (← L43 with OPP, ← L39 without), and both
solves take a hit from an x≈744 bob during the bait. A press kill that survives both arrivals' chasers would give the
Chest both ways.

## 7. What the brief got wrong (measured)

- *"turretSnapPricing … include it as an arm only if it is [on main]"*: it is not, so there is no A6.
- *"The walls named so far … 2. Leg 'BK2 from L43' (854 → 861): … the player died at t745 … At main `9dadbdfc4b` … the
  13 px hammer line at (739.26,683.90)"*: at this SHA 861's walls are the x≈744 bob (A0), the bobsoldier's sword (A1–A4)
  and the anytime deadline (A5, even at 10240). **The hammer-line corner is on 860** (← L39), at (770.96,860.99) in the
  `spinner@816,848` press kill, and only once the deadline is lifted.
- *"3. Leg 'BK2 from L39' (853 → 860): the combat ladder against bobsoldier@880,832's sword line"*: true for A1–A4.
  In A5 `orbitFreeAim` passes it, and 860's wall moves to the weigh-stance walk and, past the deadline, to
  `spinner@816,848`.
- *"4. The Chest leg from L43 … the same press-kill death, at t834"*: at this SHA it is leg 399, and the death is at
  **t800** (`bob@736,752`) in A0–A2. A5 solves it (with a hit).
- *"5. Past the approach hit … the 4-strategy bound … strategyBoundDistinct does not lift it"*: reproduced. Measured
  further: a bound of 5 is enough, and the chain then collects Boss Key 2 at t4138.
- *"CPAIR … size 3 solves legs 367/371/373"*: at this SHA they are **374/378/380** (the pits 5_21/22/23 ← L39), as
  KEYS the same legs.
- The brief's leg ids 853/854 are **860/861** at this SHA; the brief already said so.
- *"Fidelity also shipped turretSnapPricing"*: shipped to a harvest branch, not main.
- The brief does not mention that **CPAIR-3 reds two hammer producer pins**. CPAIR's own roster run was at size 2.

## 8. Residue and hand-overs

- **To the planner (dispatches).** The game witness for the three CPAIR-3 pit solves (374/378/380). The page's worker has
  no `process`, so a TT or wasm probe needs a build or flag that sets `CHOOSER_PAIR` size 3. The sweep A/B with the
  inputs `keys` = the 52 L40 keys in `l40-leg-keys.txt`, `capture_requests` on, under each arm's node env
  (`tools/armenv.sh`). Also, if wanted, a CI survey of A3/A4 on a CI runner, to see whether L40 steps 67/95 TIMEOUT
  there.
- **To the hammer arc (next slice):** `spinner@816,848`'s press kill on 860's walk west (§6 item 1). The witness: A5 +
  `L40C_BUDGET_WORK=10240` on request 860/0 or 860/1 of the capture, work 2832, the landing at t2744.
- **To fidelity:** CORPSEBUMP under `orbitFreeAim` (latch chain, A5), unchanged from LWEIGH's hand-over and now on the
  critical path. Also the rows a flip moves (§5).
- **To whoever weighs the Chest:** both Chest solves carry a non-fatal hit (t801 `bob@736,800` ← L43; t701 `bob@736,752`
  ← L39). Whether a bait's hit is admissible is the planner's call. No other solve in this set carries one.
- **Not measured here:** game witnesses (wasm/TT); the survey for the six ablations (each is a subset of A5, which moves
  nothing off L40); the unfiltered vitest (⚖ 52).
- **Load caveat:** the box ran up to 7 processes on 4 cores. Every solver answer here is bounded by work units, not wall
  time, so the answers are load-independent: the A0 replay equals the page's answers. The survey's per-step 120 s cap
  is wall time, which is why A4's step 95 printed TIMEOUT once.
- **Not committed:** the capture (32 MB), the survey JSONs and the latch keys files, except `scratch/latch-A4ngb5.keys.json`
  (the SCRATCH BK2 solve).
