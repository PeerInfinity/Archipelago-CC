# Seedling HAMMER-PHASE — slice SF: an admissible strike floor plus the measured ETA

Slice `seedling-hammer-sf` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-14): *"Build
STRIKE_ETA_FLOOR"*. One new switch, **OFF**. Its flip is a tape move and the user's call: this slice measured and
re-recorded nothing.

| | |
|---|---|
| Start SHA | **`aba341d358`** (= `origin/main` at the fetch: fidelity's wave-16 harvest r4, with the DD flip merged) |
| Head | the commit carrying this report. Before it: W0 `6acb653`, D1 `f7e5f3e` + witness `f969794`, D2 `adf5e85`, D3 `fabca1f`, D4 `4e360d2` |
| Branch | `claude/seedling-hammer-sf-mdfpvc` (the harness names it; the brief's `seedling-hammer-sf`). Nothing went to `main` |
| Defaults at the base | `REFUGE_ETA_CUT` **ON**, `PRESS_KILL_DONE_ON_WALK` **ON**, `waypointSlide` and `ceremonyShove` ON (wave 16). Every measurement below ran at these defaults |
| Dev servers | `serve-nocache.py 9586` (the primary tree, PID 764) and `9587` (the base worktree, PID 1862), both killed by PID at the end |
| Verdict | **D1 PASS · D2 PASS (no STOP: ON loses no strike OFF finds) · D3 DONE (movers listed, nothing re-recorded) · D4 PASS** |

## The one thing to know first

**The measured ETA is the fix, and the floor is the smaller half.** Over SC's 20,640 derivations the ON scan loses
no strike OFF finds. It recovers all 470 that the admissible floor alone loses, and it finds a strike in 6,373
derivations where OFF refuses. End to end it kills staging A's spinner 1,418 t sooner (sword) and 498 t sooner (ghost),
and it shortens C2's ghost staging on all 45 residues (336 → 328 t; SC's floor-only made it +28 %). The game witnesses
it tick for tick. **But the flip is large.** It moves:
- three committed producers (`r8-solve-18` gets **longer**, 363 → 467 t);
- six witness producers, whose `--check`s fail on premises and not only on bytes;
- 23 gate rows in 12 files and four identity rows.

It also makes the L18 sweep 1.53× slower. The table the planner takes to the user is in D3.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main`; branch reset to `origin/main` = **`aba341d358`**. `REFUGE_ETA_CUT_DEFAULT = true`, `PRESS_KILL_DONE_ON_WALK_DEFAULT = true` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`, node v22.22.0. **Six** submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` each |
| identity block | at a pristine detached worktree of the base with its own server (`evidence/identity-w0.txt`): maze `57e07d21`, acceptance `933c14f7`, empty c3 `4937da80` / c6 `430573e9`, carved c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 (= SC's) |
| reference | the primary tree at the base: **ALL 7 + 5 MATCH**. ⚠ In the worktree, 4 DIFFER (the substrate registry / capabilities rows). That is a worktree artifact (submodules symlinked from the primary), not the base |
| surface / constants / entities / profile | GREEN **294** · PASS **5,882** · PASS **566** · PASS **138** (`evidence/censuses-w0.txt`) |
| roster | **277** |
| tapeRunner pairs | `status\tfullName` sorted, from the run's JSON: **611 `75a3c41f`** at the base and at the head (= RE's and DD's) |
| bounded vitest BEFORE | 20 files: every non-slow file naming `deriveStrike` / `minTicksBetween` / `STRIKE_SCAN_COST` / `strikeScanBox` / `STRIKE_CANDIDATES`, plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `solveProgress*` (`evidence/vitest-files.txt`), at the base worktree: **400 / 400** |
| SC's census base rows | re-run at this base with the defaults as they are: staging A `7c279226` / `b3b38f55`, 397 `4720caab`, 414 `489a9482`, L18 `864ab175`, the ghost staging `1ca7eed5`, killgate as above. **Every one equals SC's.** Wave 16 (`waypointSlide` included) moved none of SC's workloads |

⚠ My first W0 runs read the primary tree while I was already editing it, so I discarded them. W0 was re-run at a
pristine detached worktree of `aba341d358` with its own server.

## D1 — the switch, OFF (PASS)

**Where it lives.** `STRIKE_ETA_FLOOR` (`{ enabled }`), `STRIKE_ETA_FLOOR_DEFAULT = false`, `withStrikeEtaFloor`
(through `solverBot`'s `withSwitch`, so it restores on a throw too), and `SEEDLING_STRIKE_ETA_FLOOR=1`. It sits in
`solverBot.js` beside `minTicksBetween`, not in `pressKillCost.js`. Its readers, `deriveStrike` and the floor map
`strikeScanBox` reads, are both `solverBot`'s, and nothing in `levelRun.js`'s import closure reads it, so the door
(`solverView.js`) does not need it. That is DD's `PRESS_KILL_DONE_ON_WALK` precedent. The door gained two
reads: `SLIDING_SPEED` (`playerPhysicsV1`) and `hazardFlagsFor` (`playerPhysicsV2`).

**ON, half 1: the floor.** `strikeEtaFloorOf(run)` returns `(cell) => ticks`:

    ceil( max(0, reach − DEFAULT_TOLERANCE) / max(cap, |vx|, |vy|) ),   reach = max(|dx|, |dy|)

- **The cap.** It is 2·`WALK_SPEED` (1.6). It is 2·`SLIDING_SPEED` (2.0) when the room's walkable tiles hold an ice
  tile or the sticky `onIce` flag is set.
  - The terrain is **read**: every walkable tile through `hazardFlagsFor`, the one transcription of the state setter,
    memoised per world object.
  - "A tile anywhere in the room" is a superset of "the walk can reach ice", so it is admissible. The corridor is not
    known before the preview.
  - Water (0.45 + 0.25 burst) and stairs (0.4) are under ground's 0.8.
- **A waterfall room bounds the horizontal axis only** (`reach = |dx|`). The waterfall push adds 0.8 to `v.y` after
  the threshold add, past any cap.
- `|vx|`, `|vy|` honour a knocked-back start; `DEFAULT_TOLERANCE` is `hasArrived`'s, on both axes.
- **No measured room has ice or a waterfall.** Read from the terrain: L40 has 1,839 walkable tiles, 0 ice, 0
  waterfall; L18 has 64, 0 and 0. The sticky flag was never set at any of the 20,640 derivations. So 1.6 was the live
  cap everywhere, by the terrain and not by inference.

**ON, half 2: the measured ETA. Two shapes were built and measured** (D2 has the full table):

| shape | what the bounded pass does | lost vs OFF | found where OFF refuses | scan s inside the derivations (L18 / ghost staging; OFF 69 / 58) |
|---|---|---|---|---|
| **a: interleaved collection, forty kept PAIRS** (built) | a cell is previewed (`walkTo`, the continuation's cache) at its first opportunity; a pair whose cell's walk is truncated, transit-unsafe or later than its aim tick (`known.eta > i − 1`, the continuation's test) is skipped and never takes one of the forty; previews are not capped, at most one per cell | **0** | 6,373 | **169 / 71** |
| b: forty distinct CELLS previewed (the continuation's budget) | the same skip, with the pass stopping when a new cell would be the 41st preview | **0** | 8,639 | 2,064 / 3,310 |

**Shape a is built.** Both lose nothing. Shape b finds more strikes, but it scans to the horizon whenever fewer than
forty cells are ever opportunities, and the executor asks it on every refuge tick. That is the continuation's own
warning (*"a 640-tick scan per tick"*): 30× OFF on L18 and 57× on the ghost staging. Shape a costs 2.4× and 1.2×.

**`strikeScanBox` stays consistent ON.**
- It reads the very `floor` map the full-list arm reads, so `unreachableAt(i)` counts the live floor's skips ON and
  OFF.
- The measured skips are not floor skips. They are counted apart: a refusal ON carries `scanned` (cells previewed by
  the bounded pass) and `etaSkipped`. So `unreachable` keeps its meaning.
- The floor still filters first, before the measured ETA is asked, in both arms.

**OFF is byte-inert.** The same floor is computed (`minTicksBetween`, called as before) and every call happens in the
same order. The `walks` / `walkTo` declaration moved above the bounded pass, which OFF never calls. Measured:
- the primary tree OFF equals the pristine base on all six solve workloads in every timing round;
- the identity block OFF equals W0 row for row (`evidence/identity-off.txt`);
- tapeRunner 611 `75a3c41f`.

**The docblocks**, corrected regardless of the switch (true at OFF):
- `STRIKE_CANDIDATES`' paragraph and `minTicksBetween`: no clamp, the axis runs at 2·`moveSpeed`, and the tolerance
  makes the walk shorter. The OFF floor is now named as NOT a lower bound;
- `STEP_LOOKAHEAD`: "a little over two" is the diagonal vector, 1.6·√2; per axis it is under 1.6.

**The gate: `hammerStrikeEtaFloor.test.js`, 13 rows.**

| rows | what they assert |
|---|---|
| 1–2 | ships OFF (skipped when the env sets it); `withStrikeEtaFloor` sets and restores, also on a throw |
| 3–7 | the floor's edges on a hand-built run: (161,0) → 100 and (161.1,0) → 101; within 1 px → 0, 2.6 px → 1, 2.61 → 2; `vx` 3 → 54, `vy` −2.5 → 64, an under-cap start unchanged; an ice tile or the `onIce` flag → 80, water → 100; a waterfall → `|dx|` only |
| 8 | G1's committed walk at **t190**: OFF presses `(728,680)` at 497 (ETA 201); ON presses **`(744,728)` at 432** (ETA 241), 65 ticks earlier. That pair's `i − 1` is under OFF's floor, and ON's floor admits it |
| 9 | the same walk at **t160 / t240 / t330**: the floor alone refuses at each; ON keeps OFF's strike at t160 and t330 and an earlier one at t240 |
| 10–13 | the game witness (below): the walk's landings and hits; it is G1's OFF walk for exactly 602 ticks; the game's 1,624 rows of the killed body equal the model's; the ON solve's executed prefix IS the tape, key for key (~100 s, 900 s timeout) |

| mutant (in place, restored by md5 `2613bf60`) | measured |
|---|---|
| M1 floor-only (the measured ETA off) | **caught**: rows 8, 9 and 13 (3 failed) |
| M2 `WALK_SPEED` for 1.6 | **caught**: 5 edge rows |
| M3 the tolerance dropped | **caught**: 5 edge rows |
| M4 `v0` ignored | **caught**: the `v0` row |

M2–M4 leave the witness solve unchanged. On this walk the floor's exact value matters less than the measured ETA.

**About the `shouldStop` cap.** A never-tripping `shouldStop` is consulted **once** in the whole witness solve
(measured), so it cannot cap a loop inside the press kill. None was added. All four mutants terminate (101–198 s each)
and fail.

**The game witness: `hammer-sf-l40-strikefloor`.** It is authored by `plan-seedling-hammer-sf-strikefloor.mjs`
(author and `--check`, green) and kept in `fixtures/hammer-sf-strikefloor-witness/`, not the roster.
- **The staging.** Staging A with the ghost sword (the sword kept: G1's witness staging), ON.
- **The model.** The walk is G1's OFF walk for 602 ticks, then the strikes move:

  | | landings on `spinner@880,848` | the kill |
  |---|---|---|
  | ON | t501 · **t1583** · **t1616** | **t1616** |
  | OFF (G1's walk) | t501 · t2078 · t2114 | t2114 |

  The chaser's three hits (t658 / 747 / 778, the third a death) are shared.
- **The game** (p4f, headless logic-only):
  - the drained player stream is the model's, **1,630 / 1,630** observations;
  - `Bot.slashTests` equals the model's at every sampled tick (1,620);
  - the Spinner rows (all five L40 bodies): **8,124 comparisons, worst |Δ| 0**, the clock at shift [0]. The one
    disagreement is the known removal fencepost (the game drops the body at sample t1628, the model at t1629; G1's
    residue, fidelity's).
- **Why not the sword.** The sword's ON plan (kill t1682 against OFF's t3100) parts from the game at **t658**, before
  its strikes move. The model lands a `bob@736,752` contact there (knockback dy −3.0) that the game does not make: the
  game's player walks on unhit (`evidence/d1-game/sword-plan-dash-window.txt`). That is the chaser's contact, not the
  press, so it is a hand-over (residue 2).

## D2 — the census, ON vs OFF vs floor-only (PASS; no STOP)

**The lab.** SC's lab, re-cut (`evidence/make-lab.py` applied to a scratch worktree copy of the switch's tree):
- every derivation runs four variants, in rotating order: OFF, the admissible floor alone, shape a and shape b;
- the run follows OFF; the instrument counts of the shadow variants are restored;
- every previewed walk's ETA is checked against both floors.

**Proof the lab is inert:** every census answer equals the base worktree's (staging A `7c279226` / `b3b38f55`, 397
`4720caab`, 414 `489a9482`, L18 `864ab175`, the ghost staging `1ca7eed5`, killgate `006b0639 / 7d4cb820 /
49e23d85`, the three producers exit 0). The sink rides `NODE_OPTIONS`, so a producer's child processes are censused
too (SC's residue 2).

| workload | derivations (OFF refuses) | floor alone: earlier · **lost** · found · other | a: earlier · **lost** · found · other | b: earlier · **lost** · found · other | floor-only's lost, under a / b | arrived previews · beat OFF's floor (worst) · **beat SF's** | scan s: OFF / floor / a / b |
|---|---|---|---|---|---|---|---|
| staging A, sword | 1,329 (1,315) | 2 · **5** · 0 · 0 | 3 · **0** · 1,138 · 0 | 3 · **0** · 1,222 · 0 | 5: same 4, earlier 1 / same 4, earlier 1 | 38,715 · 26,214 (141) · **0** | 75 / 71 / 285 / 538 |
| staging A, ghost | 1,085 (1,071) | 0 · **3** · 0 · 0 | 1 · **0** · 945 · 0 | 1 · **0** · 1,067 · 0 | 3: same 2, earlier 1 (both) | 34,483 · 24,035 (102) · **0** | 65 / 63 / 242 / 452 |
| leg 397, ghost | 1,154 (1,144) | 0 · **2** · 0 · 0 | 0 · **0** · 622 · 0 | 0 · **0** · 894 · 0 | 2: same 2 (both) | 43,636 · 30,360 (67) · **0** | 56 / 53 / 250 / 321 |
| leg 414, ghost | 1,256 (1,244) | 0 · **4** · 0 · 0 | 2 · **0** · 632 · 0 | 2 · **0** · 884 · 0 | 4: same 2, earlier 2 (both) | 47,022 · 32,364 (100) · **0** | 57 / 57 / 290 / 368 |
| L18 sweep (45) | 10,086 (6,783) | 1,395 · **261** · 9 · 42 | 1,521 · **0** · 2,826 · 81 | 1,485 · **0** · 4,263 · 189 | 261: earlier 162, same 96, other 3 / earlier 159, same 93, later 6, other 3 | 268,848 · 245,355 (46) · **0** | 69 / 52 / 169 / 2,064 |
| C2's L18 ghost staging (45) | 4,596 (1,680) | 402 · **159** · 0 · 0 | 561 · **0** · 60 · 6 | 561 · **0** · 60 · 138 | 159: earlier 159 (both) | 113,838 · 93,627 (52) · **0** | 58 / 41 / 71 / 3,310 |
| `r9-campaign --check` | 315 (231) | 21 · **6** · 0 · 0 | 21 · **0** · 96 · 3 | 21 · **0** · 171 · 3 | 6: same 3, earlier 3 (both) | 8,592 · 7,968 (46) · **0** | 1.9 / 1.5 / 4.2 / 46 |
| `r8-l18 --check` | 135 (81) | 21 · **6** · 0 · 0 | 24 · **0** · 18 · 0 | 24 · **0** · 30 · 3 | 6: same 3, earlier 3 (both) | 3,279 · 3,066 (46) · **0** | 1.0 / 0.7 / 3.3 / 33 |
| `r8-d2-chain --check` | 135 (81) | 21 · **6** · 0 · 0 | 24 · **0** · 18 · 0 | 24 · **0** · 30 · 3 | as `r8-l18` | 3,279 · 3,066 (46) · **0** | 0.9 / 0.6 / 3.0 / 31 |
| killgate s2 | 180 (108) | 9 · **9** · 0 · 0 | 18 · **0** · 0 · 0 | 9 · **0** · 0 · 18 | 9: earlier 9 (both) | 1,152 · 891 (39) · **0** | 0.7 / 0.4 / 1.1 / 5.8 |
| killgate s5 | 180 (126) | 9 · **0** · 0 · 0 | 9 · **0** · 18 · 0 | 9 · **0** · 18 · 0 | — | 576 · 423 (40) · **0** | 4.0 / 0.3 / 0.9 / 1.1 |
| killgate s9 | 189 (108) | 27 · **9** · 0 · 0 | 27 · **0** · 0 · 0 | 27 · **0** · 0 · 9 | 9: same 9 / later 9 | 1,944 · 1,593 (41) · **0** | 3.8 / 0.5 / 0.9 / 8.3 |
| **total** | **20,640** | **470 lost** | **0 lost** · 6,373 found | **0 lost** · 8,639 found | **470 recovered by each** | **565,364 · 468,962 (141) · 0** | |

How to read the categories, each against OFF's choice in the same derivation:
- **earlier**: presses sooner;
- **lost**: OFF found a strike and the variant refuses;
- **found**: OFF refused and the variant found one;
- **other**: a later press, or the same tick at another cell. Every "later" pick of a and b (42 and 318) is the same
  case: OFF returned the UNCERTIFIED escape fallback (`HAMMER_ESCAPE_FALLBACK`) and the variant found a later strike
  whose escape is CERTIFIED (`evidence/d2-census-records.tar.gz`).

**Reading it:**
- **The admissible floor is never beaten and it is tight:** 0 of 565,364 arrived previews arrive under it, and the
  least `ETA − floor` is 0 on every workload. OFF's floor is beaten by 83 % of them, by up to 141 ticks (staging A
  sword).
- **The floor alone reproduces SC's trap exactly:** 470 strikes lost (SC: 470).
- **Both measured-ETA shapes close the trap:** 0 lost anywhere, and each recovers all 470 (by the same strike or an
  earlier one).
- **The scan cost.** Inside the derivations: shape a costs 2.4× OFF on L18, 3–5× on staging A and the legs (where
  OFF's bounded pass refuses ~99 % of the time and ON now finds strikes), and 1.2× on the ghost staging. Shape b costs
  up to 57×. Previews: OFF 76,882, the floor alone 88,358, shape a 271,077, shape b 620,481.

## D3 — end to end, ON: the movers (nothing re-recorded)

**The solve workloads** (`evidence/d3-answers.txt`, `d3-outs/`). Answers are compared with the wall clock stripped
(RE's `norm.py`). OFF equals the base on every one, and each answer is byte-stable over four rounds in both modes.

| workload | OFF (md5) | ON (md5) | what moves |
|---|---|---|---|
| staging A, sword | REFUSED t3113 on `bob@736,752`; spinner hit 511, 1770, 1985, 2960, 3062, killed **3100**; 6 player hits (`7c279226`) | REFUSED **t1695** on `bob@736,752`; hit 511, 1609, 1649, killed **1682**; 3 player hits (`35c9a3be`) | the kill −1,418 t; the refusal tick |
| staging A, ghost | REFUSED t2195; spinners killed 2114 and 2182; 3 hits (`b3b38f55`) | REFUSED **t1629**; `spinner@880,848` killed **1616**; `@816,848` not fought; 3 hits (`3549733c`) | the kill −498 t |
| leg 397, ghost | refused on `bob@736,752` (`de067efc`) | refused on **`bobsoldier@880,832`** (`9461e0a1`) | the obstacle |
| leg 414, ghost | refused on `bob@736,800` (`585ba9b3`) | refused on **`bob@736,752`** (`56400d8b`) | the obstacle |
| L18 sweep (45) | 45 SOLVE, Σ 19,545 t (`864ab175`) | **45 SOLVE**, every residue moves: 24 shorter, 21 longer, Σ **19,558** t (`7efe7059`) | no SOLVE gained or lost |
| C2's L18 ghost staging (45) | 45 SOLVE at 336 t (r5 390, r6 340), Σ 15,178 (`1ca7eed5`) | **45 SOLVE at 328 t each**, Σ **14,760** (`0a9504dc`) | all 45 shorter |
| `r8-l18 --check` | exit 0 | **exit 1**: `r8-solve-18` and its trace drift; **363 → 467 t** (`{18,0}` at 305 → 419), 0 hits | longer |
| `r8-d2-chain --check` | exit 0 | **exit 1**: `r8-d2` and its trace drift; the headline **1,669 → 1,773 t**; its prefix-equality row fails at tick 11 | longer |
| `r9-campaign --check` | exit 0 | **exit 1**: `r9-solve-18` and its trace drift, **518 → 476 t**; Σ 10,931 → **10,889**; `r9-solve-19`'s free oracle misses (seam.time 10478 vs 10436) | shorter |
| killgate s2 / s5 / s9 | `660869bc` / `504396f1` / `a63cbb18` (`md5(rows)`) | `4926635b` / `69f421d4` / `02445c34` | `md5(rows)` only; the printed table is unchanged |

**The identity block, ON** (`evidence/identity-on.txt` against `identity-off.txt` = W0):

| row | OFF (= W0) | ON |
|---|---|---|
| maze byte-identity | `57e07d21` | = |
| **acceptance batch** | `933c14f7` | **`9fbd9304`** |
| **empty pairs c3 / c6** | `4937da80` / `430573e9` | **`c4a58671` / `5d06a8b0`** |
| **carved pairs c4** | `b9d2185d` | **`1efcc4b9`** |
| **ENEMY census** | `afdc6d1a` | **= (does not move)** |
| guard / AREA / levels / generated set | as W0 | = |
| **killgate s2 / s5 / s9** | `006b0639 / 7d4cb820 / 49e23d85` | **`7c15ed57 / 47116405 / 4d3bbf17`** |
| `r8-battery`, `r8-tail`, `r9-l3 --check` | exit 0 | = (byte-equal) |
| **`r8-d2-chain`, `r8-l18`, `r9-campaign --check`** | exit 0 | **exit 1** (above) |
| reference | ALL 7 + 5 MATCH | = |

### The flip's re-record table (for the planner to take to the user)

A flip of `STRIKE_ETA_FLOOR_DEFAULT` to `true` would re-record or re-pin all of this. **None of it was touched here.**

| kind | what | measured ON |
|---|---|---|
| committed tapes + traces (producers) | `r8-solve-18` (`solve-seedling-r8-l18`) | 363 → 467 t |
| | `r8-d2` (`solve-seedling-r8-d2-chain`), whose headline embeds `r8-solve-18` | 1,669 → 1,773 t; the `{18,0}` declaration 305 → 419 |
| | `r9-solve-18` (`solve-seedling-r9-campaign`), and `r9-solve-19`'s declared seam.time (its free oracle) | 518 → 476 t; Σ 10,931 → 10,889 |
| witness producers (each `--check` fails ON on a **premise**, not only on bytes) | `plan-seedling-f1c-l18-phase` (`f1c-l18-phase42`) | *"the solve STALLED for the hammer's phase at least once — []"* |
| | `plan-seedling-hammer-a-escape` (`hammer-a-l18-escape15`, `-escape21`) | *"with the switch OFF this staging REFUSES HAMMER_SAFETY — it solved"* |
| | `plan-seedling-hammer-b1-approach` (`hammer-b1-l18-approach40`) | OFF no longer 476 t; ON 654 t, not shorter |
| | `plan-seedling-hammer-b2-fight` | OFF no longer 476 t |
| | `plan-seedling-hammer-g1-ghostkill` (`hammer-g1-l40-ghostkill`) | the second spinner is no longer killed (the solve refuses at t1629) |
| | `plan-seedling-hammer-bw-bombstand` | OFF's stand no longer takes `#7` on t1157; ON stops on `#9`'s blast at t1248 |
| identity rows | acceptance batch; empty pairs c3, c6; carved pairs c4; killgate s2, s5, s9 | md5s above |
| gate rows (bounded set run ON: 23 failed in 12 files, `evidence/d3-vitest-on.txt`) | `hammerApproach` (2), `hammerEscape` (2), `hammerFight` (1), `hammerFightFallback` (2), `hammerGhostKillRung` (1), `hammerGhostSpinner` (2), `hammerPressBombs` (1, leg 381 t1099), `pressKillCost` (1, staging A's kill-start derivation), `procgenScratchPersistence` (3), `solveProgress` (3), `solverBot` (1, R9 12d′ L18's fade), `solverSpinnerKill` (4: F2's rooms still SOLVE, lengths 515 → 490, 264 → 197, 269 → 238, 210 → 229) | |
| this slice's own rows | `hammerStrikeEtaFloor`'s "ships OFF" row; the gate rows say OFF / ON explicitly, so they hold either way | |
| not moved | ENEMY census, maze, guard, AREA, levels, generated set, `r8-battery`, `r8-tail`, `r9-l3`; the other 83 `plan-seedling-*` producers (they never reach `deriveStrike`: `evidence/d3-producer-reach.txt`) | |

**Page legs.** The page cannot see this switch: `globalThis.process` is absent in the browser, so it reads OFF there,
and `seedling-divergence-sweep.yml` has no input that reaches it. At the default (OFF) no page leg moves. **A flip moves
page legs that derive strikes**: at least the L40 legs whose solves do (SC: 397 and 414 with the ghost; the five sword
legs derive none). The keys to measure a flip on a scratch branch with the default ON: `seedling-divergence-sweep.yml`,
`mode=inv`, `producer=solver`, `page=seedling_bot_ap_p4f`, `shards=1` (or 10 for the full 843). Compare by key against
a `main` run of the same inputs.

### Timings (`evidence/d3-timings.md`)

Each workload ran end to end, OFF and ON in the primary tree, in three interleaved rounds (each pair runs side by
side, the order alternating by round). Every wall carries the 1-minute load at its start. The box has 4 cores.

| workload | OFF walls s [load] (rounds 2 / 3 / 4) | ON walls s [load] | OFF median / min | ON median / min | ON ÷ OFF |
|---|---|---|---|---|---|
| staging A, sword | 124.0 [2.5], 131.7 [3.7], 118.9 [2.3] | 59.2 [2.5], 59.7 [4.7], 56.1 [2.2] | 124.0 / 118.9 | 59.2 / 56.1 | **0.48×** |
| staging A, ghost | 97.8 [3.4], 110.9 [5.7], 100.5 [2.3] | 58.1 [3.6], 59.6 [5.8], 56.1 [2.1] | 100.5 / 97.8 | 58.1 / 56.1 | **0.58×** |
| L18 sweep | 105.6 [4.4], 115.1 [4.3], 106.6 [2.9] | 161.8 [3.3], 163.5 [3.5], 167.7 [3.6] | 106.6 / 105.6 | 163.5 / 161.8 | **1.53×** |
| C2's ghost staging | 80.1 [4.2], 80.5 [3.3], 82.7 [2.6] | 82.3 [4.9], 84.8 [3.4], 84.3 [2.6] | 80.5 / 80.1 | 84.3 / 82.3 | 1.05× |
| leg 397, ghost | 140.9 [4.8], 137.1 [0.5], 134.6 [2.7] | 123.5 [3.7], 112.3 [0.5], 113.6 [2.5] | 137.1 / 134.6 | 113.6 / 112.3 | 0.83× |
| leg 414, ghost | 156.1 [4.4], 147.8 [2.3], 155.2 [2.5] | 126.8 [4.6], 127.2 [2.2], 124.5 [2.9] | 155.2 / 147.8 | 126.8 / 124.5 | 0.82× |

On staging A and the legs ON is faster end to end: it kills sooner, so the executor spends far fewer refuge ticks
re-deriving. L18 is the one workload ON makes slower.

⚠ **Four of these runs were re-done.** My second mutant batch edited `solverBot.js` in place while timing round 3–4
was running. Four ON runs (397 and 414 in round 3, staging A sword and ghost in round 4) started inside that window
and loaded a mutant. The round-3 397 run reproduced SC's floor-only answer (`eba8e51c`, 401 s). The mutants touch only
ON paths, so the OFF runs were clean. The four were moved aside (`scratchpad/contaminated/`) and re-run paired with
an OFF. The table and the stability claim are from the re-runs.

## D4 — records (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling hammer-phase SF — an admissible strike floor plus the measured ETA` (W0, the switch, the census table, the end-to-end table, the witness, three lessons) |
| `seedling-bot.md` | the `STRIKE_ETA_FLOOR` paragraph, after RE's (beside P2's and RE's) |
| surface | `--write`: **296** rows. `SLIDING_SPEED` was classed physics / constant and `hazardFlagsFor` seedling / function, each with its why. `--check` GREEN. The door's block comments were updated: V1 physics 11 → 12, V2 seedling 1 → 2 |
| constants | `--write` / `--check`: **5,882**, 0 new literals (the `2 ·` factor is not a counted literal), so no `--profile-rows` was needed |
| entities / profile / roster | PASS **566** · PASS **138** · **277** |
| reference | `generate-procgen-reference.mjs` (the new `plan-` instrument: 433 → 434 instruments; `instruments.js`, architecture's table, the README word count), then `--check`: **ALL 7 + 5 MATCH**. `generate-docs-index.mjs`: 176 docs |
| bounded vitest AFTER | the W0 set + `hammerStrikeEtaFloor` + `boxLock`, `seedlingConstantsCensus`, `procgenDocs/{generated, docLinks, docsRender}`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`, `checkProcgenHelp`: **30 files, 686 / 687**. The one failure is `boxLock`'s *"lets a QUEUED taker die on SIGTERM"* (`'ALIVE'` vs `'SIGTERM'`), under a load of ~4. Re-run alone it gives **26 / 26** (`evidence/vitest-after.txt`) |
| `check-procgen-help.mjs` | the new producer: **HELP ok, IMPORT ok**. The instrument as a whole reports 26 FAILs, all other scripts' import side effects; none names a file this slice touched (`evidence/check-procgen-help-fails.txt`) |
| full-solve rows | the witness's ON solve row has a 900 s timeout. A `shouldStop` cap is not available at that seam (D1) |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, rebase or force-push, nothing to `main`, no AS3, wasm, gitlink or rules edit |
| files | `solverBot.js` (the switch, the floor, the bounded pass, three docblocks), `solverView.js` (two door exports, two comments), `hammerStrikeEtaFloor.test.js`, `plan-seedling-hammer-sf-strikefloor.mjs`, `fixtures/hammer-sf-strikefloor-witness/` (tape + game rows), `seedling-solver-surface.json`, the two docs, the generated reference/index. `previewWalk`'s body, `deriveRefuge` / `refugeNow`, the chaser-arm seam, the climb ladder, `chooseBodyToRemove` and fidelity's files are untouched |

**CI for the planner** (dispatch returns 403 from the cloud):
- `JavaScript Unit Tests` at the head: `node scripts/procgen/ci-vitest-summary.mjs <head> --wait` (the suite number
  comes from CI, ⚖ 52).
- No divergence sweep is needed at OFF (no page leg can move). A flip needs the sweep on a scratch branch with the
  default ON (D3).

## The deltas

| measure | before (base) | after (head, OFF) | ON |
|---|---|---|---|
| identity block | W0 | **= W0, every row** | 4 identity rows + killgate + 3 producers move (D3) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead` | = | `r8-d2-chain` `f5490519`, `r8-l18` `3c81acbe`, `r9-campaign` `8475fa2a` (exit 1) |
| tapeRunner pairs | 611 `75a3c41f` | 611 `75a3c41f` | — |
| surface / constants / entities / profile / roster | 294 / 5,882 / 566 / 138 / 277 | **296** / 5,882 / 566 / 138 / 277 | — |
| bounded vitest | 400 / 400 (20 files) | 686 / 687 (30 files; `boxLock` 26 / 26 alone) | 385 / 409, 23 failed (the flip table) |

## What the brief got wrong (measured)

1. **The branch.** The harness names it `claude/seedling-hammer-sf-mdfpvc`, not `seedling-hammer-sf`.
2. **"`waypointSlide` changes `previewWalk`'s arrival on ice, so ice ETAs differ from SC's numbers: re-measure."** I
   re-measured. SC's census answers are byte-identical at this base, and no workload touches ice: L40 and L18 hold
   no ice or waterfall tile, and the sticky `onIce` flag was never set at a derivation. The ice cap is exercised only
   by the edge rows.
3. **"Staging A is the obvious one" for the game witness.** With the sword it is not: the ON plan parts from the game
   at t658 on a chaser contact the model lands and the game does not. That is before the strike moves, and it is
   fidelity's. With the ghost sword it works tick for tick.
4. **"A `shouldStop` cap if a mutant could loop."** The solve consults `shouldStop` once (measured), so it cannot cap
   the press kill. All four mutants terminate on their own.
5. **"77 % of arrived strike previews beat the floor."** Over this census (all four variants' previews, 565,364)
   it is **83 %**, the worst 141 ticks (SC: 100). The population differs: ON previews many more cells.
6. **"Once a cell has been previewed, the bounded pass uses its measured ETA *instead of* the floor."** ON uses both:
   the admissible floor filters first, and the measured ETA filters what the floor admits. It must be both, or
   `strikeScanBox`'s `unreachable` count would lose its meaning.
7. **The two shapes are not equal in cost.** The brief offered "interleave, or count the budget in distinct cells …
   as the continuation counts it" as alternatives. The second is the continuation's budget for a reason: asked on every
   refuge tick it costs up to 57× OFF.
8. **"Re-run SC's census base rows … the defaults may have moved them."** They did not: every row equals SC's.
9. **The bootstrap left six submodules uninitialised** after `READY` (the brief said five; `swfRecompilerPanel/browser`
   is the sixth).
10. **My own D2 commit message** says 569,446 arrived previews. The measured total is **565,364** (this report and the
    log carry the measured number).

## Residue

1. **For the user: the flip.**
   - D2 shows no strike lost, and D3 shows faster kills, a shorter ghost staging and 45 / 45 L18 SOLVEs.
   - It also lengthens `r8-solve-18` (+104 t), reshapes 21 L18 residues longer, and costs 1.53× on the L18 sweep.
   - It breaks the premises of six witness producers, so their witnesses would have to be re-derived, not just
     re-recorded.
   - The re-record table is in D3.
2. **Hand-over to fidelity: a chaser contact the game does not make.**
   - Where: staging A with the sword, ON (`evidence/d1-game/sword-plan-dash-window.txt`). At t658 the model's
     `bob@736,752` hits the player (`playerHits`: dy −2.999 knockback). The game's player continues unhit, to (744.26,
     742.49) against the model's (743.45, 739.99).
   - The same chaser's hit at t658 in the ghost plan IS the game's, so the difference is in the approach geometry.
   - Fidelity owns `contactFidelity` / the chaser.
3. **The L18 sweep's cost ON** (1.53×). Shape a previews up to every opportunity cell once per derivation. A cheaper
   variant (for example a per-derivation preview cap) was not measured.
4. **Shape b finds 2,266 more strikes than shape a** (8,639 vs 6,373 where OFF refuses). Asked only at the admission
   (as the continuation is), its cost might be acceptable. Not measured.
5. **Admissibility limits, by name.**
   - A mid-walk impulse (a knockback during the walk) could beat the floor; none did in 565,364 arrived previews.
   - The waterfall rule and the ice cap are unit-tested only.
   - Pushers, ropes and pits that move the player are not bounded by the floor.
6. **Eleven `plan-seedling-*` producers fail `--check` at the base, OFF**, with 0 derivations, so unrelated to this
   switch: `axe-witness`, `f1-l5-open-lock`, `l40button-witness`, `ladder2-witness`, `r5-conch`, `r5-feather`,
   `r6-shieldboss`, `r7-ends-meet`, `r9-l0-sword-dash`, `r9-l6-sword-dash-hit`, `stance-witness` (drift, a
   `buildTape` pins error, solver refusals; `evidence/d3-producer-reach.txt` and the lab's outputs).
7. **`check-procgen-help.mjs` reports 26 FAILs**, all import side effects of older scripts (pre-existing, not this
   slice's).
8. **`boxLock`'s SIGTERM row is load-sensitive.** It failed once in the AFTER run at load ~4 and passed alone.
9. **Tree hygiene.**
   - The two scratch worktrees (`<scratchpad>/base`, `<scratchpad>/lab`) were removed by name with
     `git worktree remove`.
   - The two servers were killed by PID.
   - The mutants restored `solverBot.js` by md5 (`2613bf60`) each time.

## Evidence (`seedling-hammer-sf-evidence/`)

- **W0:** `identity-w0.txt`, `censuses-w0.txt`, `vitest-before.txt`, `vitest-files.txt`.
- **D1:**
  - `mutants/` (`mt.py` and the four runs);
  - `probe-rows.mjs` and `d1-probe-g1.jsonl` (the G1 walk sampled every 10 ticks under the four variants: where the
    gate rows' ticks came from);
  - `d1-game/`:
    - `dash-window.txt` and `spinner-rows.txt` (the witness on the game);
    - `sword-plan-dash-window.txt` (the sword plan's t658 parting);
    - `producer-check.txt`;
    - `witness-model.mjs`, `mktape.mjs`, `part.mjs`, `cap.mjs` (the `shouldStop` count).
- **D2:** `make-lab.py`, `sink.mjs`, `sf-run.sh`, `queue.sh`, `sf-census.py`, `sf-table.py`;
  `d2-census-records.tar.gz` (every derivation's four results), `d2-census-summary.jsonl`, `d2-census-table.md`,
  `d2-census-answers.txt`. RE's `g1-solve.mjs`, `d1-leg.mjs`, `ghost-sweep.mjs`, `norm.py` and SC's `sweep-cmp.py`
  were used unchanged. `sf-run.sh`'s `on-a` / `on-b` / `floor` modes read a lab knob that only the census copy
  carried; the built tree has `on` / `off`.
- **D3:**
  - `identity-on.txt`, `identity-off.txt`, `d3-answers.txt`, `d3-outs/`;
  - `d3-plans.txt` and `d3-plans/` (the six producers ON), `d3-producer-reach.txt` (`count-all.sh`), `plans.sh`;
  - `d3-vitest-on.txt`, `d3-timings.md`.
- **D4:** `censuses-after.txt`, `vitest-after.txt`, `vitest-after-files.txt`, `check-procgen-help-fails.txt`.
