# Seedling fidelity KNOCKBACK376 (wave 37c) — leg 376: the game does not follow a planned hit's knockback

Session `seedling-fidelity-knockback376` (planner `seedling-fidelity-planning-18`). ⚖ The user, 2026-11-05: *"Launch it now
(Recommended)"*; ⚖ 2026-10-12: model the interaction.

- **Start SHA** `028da05be18305750007269b4a941b47f1c984f6` (= `origin/fidelity-flip/w37b`, 113 ON of 125).
- **Head** — the last commit on the harness branch **`claude/seedling-fidelity-wave-37c-0ppd4u`** (this report). Code:
  `43a80dbb` (D1, first cut), `9f0a529d` (records), `c2a3df1d` (D1 rework — the shipped mechanism), then this report.
- **New key** `CONTACT_FIDELITY.rockGoneFencepost` — **OFF**, last in the defaults (126 keys, 113 ON);
  `SEEDLING_ROCK_GONE_FENCEPOST=0|1` (in `SOLVER_ENV_NAMES`).
- Evidence: `CC/docs/cloud-reports/seedling-fidelity-knockback376-evidence/`.

| part | verdict |
|---|---|
| W0 | **DONE — the brief's premise was wrong twice.** The planned hit is a **Bomb's Explosion** (`bombpusher@112,128#9`), not `spinner@192,160`; and the **knockback is exact** (game = model on x, y, vx, vy, hits, hits_timer through t1255). The first differing field is **`player.x` at t1256**: a broken `breakablerock@176,128`'s CELL opened two observations early in the model |
| D1 | **PASS.** `brokenRockIds` lags the solid past `goneAt` by 2 (`ROCK_GONE_FENCEPOST_TICKS`) behind the key, OFF byte-identical. Three game witnesses on p4g at 0 px (two short tapes + the leg's own 1259-tick play); two more independent ones already on main (ARRIVAL's L0 oracles) agree. 3/3 mutants as predicted (twice: first cut and rework) |
| D2 | **PASS.** Key ON: leg 376's failing seams solve a **1622 t** plan (the same one planned bomb hit at t1248); on the page, ON, seams **5312 / 5314 / 5315** → `done`, 1 hit, **no divergence**; 5/5 ON page runs `done`. Seams 5319 / 5327 (and 5260 / 5280 / 5283) plan exactly as OFF |
| movers | local survey (the 32 steps in rock levels): **27 SOLVED / 5 REFUSED both arms**; step 95 (L41) 2110 → 2112 t, step 78 (L53) refusal text only. Bounded set ON: 3 L41 rows (+2 t), 4 env-vs-default artifacts, 0 hammer pins (§ 5). Producers ON: **`plan-seedling-ghostsword` drifts 2 tapes** (L3, 43 → 45 t). Identity block ON = OFF = base on every row |

## 1. W0 — the trace

**Re-capture.** `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g
--ids=376 --capture-requests=…` at port 9776 captured a request at seam 5282 (a passing seam). The failing seams were then
**staged in node** (`replay-seedling-solve-request.mjs --seam-time-sweep=31..32`, `atSeamTime`): 5313 and 5314 give exactly
hammer-3's L40-CENSUS numbers — dashless refused at 106 units, full SOLVED at 294 (work 400), the 1565 t plan. The leg key
at my base is unchanged: id **376**, `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`.

**The game's rows** came from the per-tick compare probe (`probe-seedling-contact-divergence.mjs --capture`, run from a
scratch copy whose only change is the leg budget 90 s → 400 s: at 90 s it timed out at ~1134 sampled ticks, before the
hit). Run 4 of a loop drew seam **5271** — the same plan class (1565 t, full pass, one hit at 1248) — and diverged:

| t | game x | game y | game vx | game vy | model x | model y | note |
|---|---|---|---|---|---|---|---|
| 1247 | 199.753784 | 152.275 | −3.285767 | −2.281169 | = | = | the Explosion's hit: hits 1, hits_timer 20 (both sides) |
| 1248 | 196.673377 | 150.136404 | −3.080407 | −2.138596 | = | = | the plan's `primary` — a DASH (`slashTimer` > 0; `knockback(2, …)`) |
| 1249 | 194.673377 | 146.999796 | −4.517930 | −3.136608 | = | = | x pinned on the rocks' east face; vx kept (`Mobile.friction`/`moveX` never zero a blocked `v`, `Mobile.as:73-118`, `Player.as:1723-1751`) |
| 1250–1255 | 194.673377 | 144.006 → 131.174 | −4.31 → −3.29 | −2.99 → −2.28 | = | = | every field equal |
| **1256** | **194.673377** | 130.174183 | −3.080407 | −2.138596 | **191.592970** | 130.174183 | **first difference: player.x** — the model moved −3.08 through `@176,128`'s cell |
| 1257 | 194.673377 | 130.174183 | −2.875046 | −1.996023 | 188.718 | 130.174 | the game is still pinned |
| 1258 | **192.003691** | 130.174183 | −2.669686 | −1.853450 | 186.048 | 130.174 | the game's cell opens: x moves by that tick's vx |

(`evidence/w0/game-rows-5271.txt`, `evidence/w0/model-rows-5313-off.txt`; the model's rows are identical at 5271 and 5313.)
`replay-seedling-contact-capture.mjs --file=<capture>` on the base: *"FAIL — 1259 game tick(s) compared, worst |Δ| 5.955 px;
first differs at t1256: x game 194.673 model 191.593"*.

**Why.** The dash's first test (t1249) breaks `breakablerock@160,144`, `@176,128`, `@176,144` (`rocksBroken`: hitTick 1249,
goneAt 1256). From t1249 to t1255 the player's box overlaps the `@176,144`/`@176,128` column, so x is blocked while the stored
knockback `vx` decays; the box leaves `@176,144` at y 131.17 and is then blocked in x by `@176,128` alone. The model freed
`@176,128` for the move on t1256 (= `goneAt`), the game on t1258. Not a collision box, direction, magnitude or per-tick decay
of the knockback (all bit-equal), not the hit's tick; it is **a wall's removal time**.

**The game's rule** (`Puzzlements/BreakableRock.as:56-72`, `net/flashpunk/World.as:47-61, 118-124`,
`net/flashpunk/Engine.as:69-78`, `Spritemap.as:70-101`). `goneAt` = `fired + HIT_TO_GONE_TICKS` (7) is the update that runs
`endAnim` — CLEARTAG's cut witnesses pin `endAnim`'s persistence write exactly there on the game (cut after `goneAt` ticks:
unwritten; after `goneAt + 1`: written). The CELL outlives it by two fenceposts on the query side:
1. **The query.** `brokenRockIds(…, ticksCompleted + 1)` — the bridges' observation convention — calls the rock gone on the
   update entering at `goneAt − 1`, the frame BEFORE `endAnim` runs. SLOTS D4a measured this same off-by-one for the burnable
   tree and moved the tree's query to `ticksCompleted`; the rocks' query kept its `+ 1` with the note *"nothing here measured
   it"*.
2. **The removal.** `endAnim`'s `FP.world.remove(this)` only queues; `Engine.update` runs `updateLists` after `World.update`,
   so `endAnim`'s own frame still collides with the rock. The cell is free from the update entering at `goneAt + 1`.

⇒ the move first enters the cell on observation `goneAt + 2` = `fired + 9`. Every committed rock leg waits
`WAIT_AFTER_PRESS_TICKS` (20) after its press, which is why no witness walked into the cell on the fencepost until a
knocked-back player did.

**Census.** The brief asked for the legs/steps "whose plan carries a planned spinner hit"; that class is not this defect's
(the hit is a bomb and the hit is modelled right). The class that CAN diverge is a plan that moves into a broken rock's cell
within two observations of `goneAt`. Rock levels: L0, 3, 15, 16, 30, 40, 41, 53, 73, 92, 100, 101 (atlas). Survey: **32
steps** there (§ 4). Sweep: **171 legs** in those levels; only a keyed sweep can say which move (§ 6).

## 2. D1 — the model (`rockGoneFencepost`, OFF)

**Change** (`c2a3df1d`). `breakableRocks.brokenRockIds(state, observation, { lag = 0 })` — gone when `observation >= goneAt +
lag`; `ROCK_GONE_FENCEPOST_TICKS = 2` with the derivation above. `levelRun.brokenRockIdsNow` passes `{ lag:
ROCK_GONE_FENCEPOST_TICKS }` when the key is ON; OFF the call is the base's. `goneAt`, `hitRock`, the write (`rockFlags`),
`rocksBroken`, `earnedClears` and every reader of them are unchanged. One call site feeds the collision set, the planner's
`brokenRocks` and the solver's live opts, so a preview, a plan and the run agree.

⚠ **The first cut (`43a80dbb`) shifted `goneAt` itself by 2** (`hitRock`'s count 7 → 9). It reproduced all three witnesses at
0 px, but ON it reddened every CLEARTAG cut witness (7 rows) — the write is on `goneAt` and must not move — and moved
`breakableRocks.test.js`' run row and the solids-skin goldens. The rework separates the two clocks; with it those rows are
green ON.

**Witnesses** (p4g, headless, port 9776; `fixtures/rockgone-witness/`; module `fidelityRockGone.js`):

| witness | recorded by | game | ON | OFF |
|---|---|---|---|---|
| `rockgone-l40-plain` — L40 entity (200,136), `noDamage`, hold `left` (pinned on `@176,128` at x 194.5), `primary` on input 10 | `probe-seedling-rock-gone.mjs --record` | first swing test on obs 12 (`Bot.slashTests`, 4 hits) = model `hitTick` 11 + 1; cell opens obs **20** | 20, = game at 0 px on all 40 | 18 |
| `rockgone-l40-dash` — same pocket: `right` + `primary` on input 1 (reaches nothing), `left` from 2, the DASH press on 8 | same | first test obs 10; opens obs **18** | 18, 0 px | 16 |
| `rockgone-leg376-play` — the leg's 1565 t plan at seam 5271, request (Maps/Sets tagged) + plan + 1259 game player rows, replayed on the committed atlas | the W0 capture | — | = game on all **1259** ticks (x, y, vx, vy, hits, hits_timer) | first diff **t1256 player.x** (194.673 vs 191.593) |
| ARRIVAL `L0-from-L12` / `L0-from-L1` `-HELD-press-sword` (already on main, `fixtures/arrival-oracle.json`) | fidelity ARRIVAL | first move obs **10** | 10 | 8 (pinned there as "residue": *"the model frees it 2 ticks early"*) |

`probe-seedling-rock-gone.mjs` (rework): ALL CHECKS PASSED (`evidence/d2/probe-rockgone-rework.txt`).

**Test** `fidelityRockGone.test.js` (14): the switch (OFF, last; env name), the lag (7 + 2; `brokenRockIds` with and without
`lag`), each short witness (the recorded tape is the module's; ON = game at 0 px and opens on the game's observation, which
is `goneAt + 2`; OFF opens 2 early), the expected numbers, the leg witness (identity; ON 1259/1259; OFF t1256 player.x).

**Mutants** (predicted, then copy + restore; rework): M1 `ROCK_GONE_FENCEPOST_TICKS = 1` → **5** red (the lag constant, the
lag row, plain ON, dash ON, leg ON) ✓; M2 `levelRun` ignores the key → **3** (the three ON rows) ✓; M3 `brokenRockIds` ignores
`lag` → **4** (the lag row + the three ON rows) ✓. (First cut: 5 / 3 / 4, also as predicted.)

## 3. D2 — key ON, leg 376

**Node** (`evidence/d2/node-seam-census.txt`, the captured request staged at each seam, `tools/census376.mjs`):

| seam | OFF | ON |
|---|---|---|
| 5271, 5313, 5314 | full pass 1565 t, 1 hit (bomb, t1248), rocks gone 1256 | full pass **1622 t**, the same hit, rocks `goneAt` 1256 (cell free 1258); work 400 → 410 |
| 5280, 5319 | full 1736 t, hitless | identical plan |
| 5260, 5283, 5327 | dashless 1866 / 1888 t, hitless | identical plan |
| 5243, 5333 | refused at the 640 deadline (`crusher-fork`; the bomb rung — hammer's) | identical |

The ON plan at 5313/5314 is byte-identical between the first cut and the rework.

**Page** (`probe-seedling-divergence-sweep.mjs --contact-fidelity=<113 defaults + rockGoneFencepost> --leg-budget-ms=400000`,
`evidence/d2/page-sweep-on.txt`; the stamp reads 126 keys, `rockGoneFencepost: true`):

| run | seam | plan | room hits | divergences | end |
|---|---|---|---|---|---|
| 1 | 5315 | 1622 t, dashless refused, full | 1 @ t1248 | none | **done** |
| 2 | 5299 | 1757 t, full | 2 (t1340, t1386) | none | done |
| 3 | 5306 | 1866 t, dashless | 0 | none | done |
| 4 | 5312 | 1622 t, full | 1 @ t1248 | none | **done** |
| 5 | **5314** | 1622 t, full | 1 @ t1248 | none | **done** |

The game tracks the ON plan through t1256 and past it, and the leg finishes with the one planned hit. (A per-tick compare run
ON drew a 1757 t full plan, `done`, no divergence, too.) Seams 5319/5327 are unchanged by construction (identical plans).
⚠ An earlier OFF/ON page loop at the default leg budget ended `timeout` on 3 of 4 runs while I loaded the CPU with census
runs (`evidence/d2/page-sweep-first-loop.txt`); not a verdict.

## 4. The survey (local, ON vs OFF)

Only a run that breaks a `BreakableRock` sees the key, so the arms ran the **32 route-survey steps in rock levels**
(`--through=end --route=full --only=1,3,12,14,16,20,23,24,26,30,38,40,55,58,61,66,67,78,82,94,95,96,98,135,148,159,198,215,216,222,227,230`):

| arm | SOLVED | REFUSED | movers |
|---|---|---|---|
| OFF | 27 | 5 | — |
| ON | 27 | 5 | **step 95 (L41) SOLVED 2110 → 2112 t** (0 hits both; the walk waits for the cell); **step 78 (L53)** REFUSED by the same rung, its text's puncher position 115.6 → 115.9 |

## 5. The bounded set

`evidence/bounded-files.txt`: the brief's header list + every test file `grep -a` finds for `hitRock`, `HIT_TO_GONE_TICKS`,
`rocksBroken`, `brokenRocks`, `breakableRocks`, `goneAt`, `rockGoneFencepost`, `SOLVER_ENV_NAMES`, the defaults' order pins,
the census/surface tests, + `levelRunDigestRead`, `r6AnimClock`, `breakVerb`, `fidelityBurn`, `dashShape`,
`dashOnlyWindow`, `jsRuntimeSolverShouldStop` — **178 files** (174 fast, 3 slow, `fidelityL40Bk2.train`).

| arm | fast (174) | slow (3) | train (1) |
|---|---|---|---|
| OFF at head | first run 3 files red, all my bookkeeping (the docs index after my log entry; FROZENPRESS's "followed only by wave-37b keys" pin) — fixed; then **174/174** | 3/3 | 1/1 |
| ON (rework) | **169/174**: 4 rows in 3 files are env-vs-default artifacts (`contactFidelity` defaults pin, `dashOnlyWindow` ×2, `dashShape` — the same 4 red under an unrelated key's env, `SEEDLING_CEREMONY_PRESS_FORECAST=1`); **3 real movers in 2 files, all L41 +2 t**: `fidelityCrusherPress` "the solver still plans the recorded tape" 1021 → 1023, `fidelityL41Totem` D1 plan 2189 → 2191 and D3 idles W 229 → 231 | 3/3 | 1/1 |

**Hammer** (listed for hammer-3 whether or not they move; key ON): the 41 fast `hammer*` / `solveProgress` / `strikePolicy` /
`pressKill*` / `ghostSpinner*` / `pressEscape*` files **41/41**; slow `hammerBk2Combat`, `hammerDashShape`,
`hammerEscapeExact`, `hammerEscapeGenerated` **4/4 files green**; train (8 files) **5 of 8 green so far** (`hammerGhostKillRung`, `hammerChooserPair`, `hammerSouthDoor`, `hammerLatchWeigh`, `hammerTurretApproach`; the other 3 still running at this commit — see the follow-up). **No hammer pin moves.**

Pins the first cut moved and the rework does not: CLEARTAG's 7 game-witness rows, `breakableRocks.test.js`' run row, the
solids-skin goldens (`L3-rock-breaks`, `L3-ghost-rock-breaks`), ARRIVAL's 2 residue rows (they pin the recorded oracle and
`goneAt`, both unchanged). ⚠ On a flip ARRIVAL's 2 rows are STALE by meaning ("the model frees it 2 ticks early" is then
false): re-word them to "the model = the game" (observation 10 both sides).

## 6. Identity, producers, engine closure

| row set | base `028da05be1` | head OFF | head ON |
|---|---|---|---|
| identity block (`identity-block.sh`: maze `57e07d21`, acceptance **`abb206c8`**, c3 `d356fc8a`, c6 `483c791e`, c4 `e83b066d`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK) | `evidence/identity-base.txt` | **= base, every row** (`identity-head.txt`) | **= base, every row** (`identity-head-on.txt`) |
| the six producer `--check`s (`7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`) | all exit 0 | = base | = base |
| `ci-producer-checks.mjs --jobs=3` | — | **97 run, 0 red, 1 skipped** (`r7-ends-meet`, the standard browser-arm skip; `producers.txt`) | **97 run, 2 red**: `plan-seedling-ghostsword` — `ghostsword-l3-rock` and `ghostsword-l3-rockghost` DRIFT, each **43 → 45 t**, same 3 inputs (measured by letting the producer write and restoring with `git checkout`; `producers-on.txt`, `ghostsword-on.txt`). A flip re-records both and re-witnesses them on the game (their `Bot.slashTests` witness is unaffected: the press and its 7 tests do not move; the walk into the cell waits 2 more) |
| reference | ALL 7 MODULES + 5 REGIONS MATCH | same | same |

**Engine closure** (`seedlingDerivedRuleTable.js --print-engine-closure`, engineMd5 `27f1948f191cc152ae53c9b53b5d6db2`, 42
files) ∩ my diff = **∅**.

## 7. The CI dispatches the planner should run

The ON arm is the 113 default-ON keys + `rockGoneFencepost`, built from `contactFidelity.js` at `028da05be1` (114 keys,
comma-joined; `evidence/on-plus.txt`). OFF = the 113 (`evidence/on-default.txt`).

1. **Survey A/B** — `seedling-survey.yml` on branch `claude/seedling-fidelity-wave-37c-0ppd4u`, `route=full`,
   `through=end`, once with `contact_fidelity=<OFF list>` and once with `<ON list>` (or env `SEEDLING_ROCK_GONE_FENCEPOST=1`
   if the workflow takes it). Expected: only steps 95 (+2 t) and 78 (text) move; 204/32 both arms.
2. **Keyed sweep of the 64 L40 legs ×2 per arm** — `seedling-divergence-sweep.yml`, `keys=<evidence/l40-keys.txt>` (64 keys,
   `|`-separated, derived at `028da05be1`), `contact_fidelity=<ON list>` and `<OFF list>`, `leg_budget_ms=400000`,
   `capture_requests=true`. Expected: leg 376 `failed` → `done` on its failing seams; no other L40 leg moves except through a
   rock walk.
3. **Full sweep ×2 per arm** — the same workflow, no `keys`, `contact_fidelity` as above. The 171 rock-level legs are the only
   candidates; a ~20-leg `crossed`↔`done` swap each way is run noise (re-key it ×2).
4. **Probes standard** — `seedling-probe.yml battery=standard` on the branch, both arms (it is the battery that caught DRILL's
   arrival-composites mover).

## 8. For the JS arc / the hammer arc

- **JS arc:** nothing to wire. No staging/result field, no new refusal kind; the collision set the page's run and the worker's
  run read is the same `brokenRockIdsNow`. The sweep producer, the contact capture and `seedlingHitTicks.js` were read, not
  edited (a scratch copy of the capture probe with a 400 s leg budget was used; ⚠ its hardcoded 90 s budget cannot capture a
  plan this long — a `--leg-budget-ms` like the sweep's would help).
- **Hammer arc:** nothing handed over. The fix is not in the spinner forecast, the strike, the escape, the chooser or the
  press-kill walk. No hammer pin moved ON (§ 5).

## 9. What the brief got wrong (measured)

1. *"ONE planned hit from `spinner@192,160` at t1247/1248"* — the planned hit is **`bomb:bombpusher@112,128#9`** (`playerHits`,
   force 4, `Explosion.as:60`). `spinner@192,160` is what the *recovery re-plan* refused on (and that spinner is the one the
   plan killed earlier, `destroy: true` at t1244).
2. *"The game then leaves the plan at t1256 (the knockback rows)"* — the knockback rows are exact; the divergence is the rock
   cell's removal tick. The region is `breakableRocks.js` + `levelRun.brokenRockIdsNow`, not `playerDamage.js` / the hit
   response — still the fidelity arc's, not hammer's or the JS arc's.
3. *"113 default-ON keys of 125"* is right at the base; the brief's later "110 ON of 122" paragraph is stale (it predates W37b).
4. The census leg id (376) and key are unchanged at the base.

## 10. Residue, byte-inertia, rows to BANK

- **Residue.** The persistence write's LEDGER row (`rockFlags`) is stamped at the hit tick, not `goneAt` (pre-existing; nothing
  here measured it). The flip's movers are named in § 4–5; the flip itself is the user's call.
- **Byte-inertia (OFF).** The identity block, the six `--check`s and the 97 producers at head OFF = the base on every row; the 14 new rows are the only new tests; the defaults pin, CEREMONY126's and FROZENPRESS's order pins are bookkeeping for the appended key.
- **Roster:** unchanged (293). No tape moved and no producer digest moved. The witnesses are game samples, not tapes.
- **New files:** `fidelityRockGone.js`, `fidelityRockGone.test.js` (14), `fixtures/rockgone-witness/` (3),
  `scripts/procgen/probe-seedling-rock-gone.mjs` (box-taking; in `boxLock.test.js`' guarded list).
- **Flip licence ask (for the user, via the planner):** flipping `rockGoneFencepost` ON re-records `ghostsword-l3-rock` /
  `-rockghost` (+2 t each, re-witnessed on p4g), re-pins `fidelityCrusherPress` (1021 → 1023) and `fidelityL41Totem` (2189 →
  2191; idle W 229 → 231), re-words ARRIVAL's two residue rows, and moves survey step 95 by +2 t — after the CI dispatches of
  § 7 confirm no other mover.
- **Rows to BANK:** the 14 rows; the three witnesses; § 3's node census and the 5 ON page runs; § 4's survey pair; the two
  ARRIVAL oracles as independent agreement.
- **Records:** `seedling-bot-log.md` entry (3 trap candidates); the constants census (one new rule literal, the lag default),
  the solver surface, the reference + docs index regenerated; bookkeeping pins: the contact defaults, CEREMONY126's last-keys
  pin (now order + place), FROZENPRESS's trailing-keys pin (admits wave 37c).
- **CI** (`JavaScript Unit Tests` at my last head): `c2a3df1d` (the rework): **success** — unfiltered vitest 25656 passed / 0 failed (1144 files), slow battery 372/372.
