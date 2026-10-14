# Seedling fidelity LAPSECOST: the lapse's L40 cost was a wider walk meeting an expensive rung, and leg 773 was a Flyer's drop

Slice `seedling-fidelity-lapsecost` (Opus, cloud), planner `seedling-fidelity-planning-7`, WAVE 16 (model coverage).

| | |
|---|---|
| Start SHA | **`3a53894a9a`** (main: wave 15 + hammer G1 + BW; not rebased) |
| Head | the commit carrying this report. Code: `af582f7` D1 v1 → `8ce29e3` D1 v2 → `18df63b` D1 v3; `faa6f3f` D2, `70ba9c7` D2b; `8be1fc1` records |
| Branch | `claude/seedling-lapse-cost-xtr3hu` (the harness's). Nothing went to `main` |
| Dev servers | `serve-nocache.py 9670` (main tree), 9671 (base worktree), 9672 (flip worktree); killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS (the 11 L40 pit legs solve ON in node with OFF's plan; no ON survey row moves) · D2 PASS with a STOP inside (the t103 divergence is a Flyer's drop: modelled behind `flyerLive`, game-witnessed at 0 px; the BeamTower's drifting Solid, met next, is handed over) · D3 PASS (flip re-measured, HELD; refreshed patch)** |

## The one thing to know first

**The lapse does not make any site more expensive.** It widens the walk's strike admissions, and the wider walk is a
*different* walk:

- on L40's pit corridor it walks the player into a re-armed bob;
- AVOID, TIME, BAIT and KILL then refuse cheaply;
- DETOUR's via lattice spends the whole page budget.

A new conditional ladder rung, **NARROW**, sits between KILL and DETOUR. It walks the same corridor with the pre-lapse
admissions. On the pit legs that gives back OFF's plan, key for key; everywhere else the ON answers are unchanged.

Leg 773 is not the lapse at all. A **Flyer** drops on the player at t103, and the model had never stepped a Flyer.
It is now modelled behind `contactFidelity.flyerLive` (OFF) and game-witnessed.

## W0: the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B … 3a53894a9a` | `3a53894a9a`; bootstrap `READY`, node v22.22.0. The five non-wasm submodules were uninitialised (`git submodule update --init` each, for the reference row) |
| identity block | `SEEDLING_PORT=… bash scripts/procgen/identity-block.sh .`, at a base worktree and at head `8be1fc1` (default OFF) | **Every value row equal** (`w0/identity-base.txt`, `identity-final-head.txt`): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY **`afdc6d1a`**, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`. At head the generated set is OK and the reference is ALL 7 + 5 MATCH. In the base worktree those two rows were environment-only (no venv; symlinked submodules) |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign **`712f0ead`**, all exit 0, base and head |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` | **611**, `86af85259c2ab3a51b1f0ebb409743f4`, before and after |
| surface / constants / entities | `census-seedling-solver-surface --check`, `census-seedling-constants --check`, `seedlingEntityWitness.test.js` | Surface 288 → **289** GREEN (+ `chaserDropOf`, classified). Constants 5,846 → **5,864** literals PASS (+5 classified CHASERS rows). Entities 558 → **566** leaves (`chasers.flyer`, measured, below), md5 `74dbffa2` → `fe5051f6` |
| roster | `fixtures/tapes/index.json` | **277**, unchanged. The new game witness is a `chaser-witness` fixture, not a roster tape |
| bounded vitest BEFORE | 87 files at base: the brief's list + `strikePolicy`/`solverBot`/`fidelityF1c`/`twoPassSolve`/`tapeRunner`/`fidelityDash`/`seedlingRobust`, surface + constants, and every test naming a function or table D1/D2 touch (`rg -al` over `strikeIframeLapse`, `strikePolicyFor`, `strikeCandidates`, `planSwordDash`, `probeCorridor`, `KILL_ARM_POLICY`, `CORPSE_COUNTING`, `R8_STRATEGY_EXECUTORS`, `KNOWN_STRATEGY_VERBS`, `chaserForecast`, `chaserDanger`, `SOLIDS_BY_MOVER`, `MODELLED_ENEMY_CLASSES`, `chaserStep`, `isBridgedChaser`, `flyer`) | **3,366 rows, 0 failed** (`w0/bounded-before.rows`, md5 `bd4b4463` for the first 60 files). `seedlingSolverSurface`'s 36 rows read "skipped" under load (a 10 s hook timeout); solo at base they are 36/36 |
| bounded vitest AFTER | the same 87 + `fidelityLapseCost.test.js`, at head | **3,381 / 3,381** (`w0/bounded-after.rows`, md5 `8dd32458`): BEFORE + 15 new rows (13 in `fidelityLapseCost`; the per-switch `contactFidelityHook` row and the per-class `entityRecords.agreement` row for the new key and record), 0 gone, 0 changed except the 36 surface rows, skipped → passed |

## D1: the L40 pit cost (PASS)

**Measurement.** No capture existed, so I made one. A local sweep with `--capture-requests`, ON (the default-ON keys
plus `strikeIframeLapse`), captured all 11 pit legs and leg 773. All of them failed or timed out locally, reproducing
CI. Leg 403's request (seam 5085, budget 640) was replayed in node, with each work unit accounted by its `shouldStop`
site and a stack signature (`d1/leg-403-requests.jsonl.gz`):

| | answer | work | by site |
|---|---|---|---|
| OFF | SOLVED 776 t | 48 + 39 | walk 75, sword-dash 14 |
| ON | refused, `deadline: detour` | 641 + 1 (at 2,560: 2,561 + 1) | **detour 2,542** (`deriveChaserDetour` ← `climbLadderUnder`), walk 21 |

**What the lapse multiplies.** Nothing per site. The first corridor probe flags danger with the lapse ON and is clean
OFF. The two walks part at t246:

- **t247:** the ON policy aims at and presses `puncher@128,624` on its lapsing i-frame. The press lands nothing,
  because the walker leaves the swing rect before the lapse test.
- **t507:** it presses `bob@208,448` at reading 5. The kill lands at t512, one tick after the body's i-frame lapsed
  against the overlapping player at t511 (`Enemy.update` steps above the player). The probe flags "inside leash 80
  (d=4.6)" at t511.
- **The ladder:** AVOID (no path), TIME (167 px, past `MOVER_RANGE`), BAIT (no removal admits a corridor) and KILL (no
  watchable target) all refuse cheaply. DETOUR then spends the budget on L40's via lattice.
- **OFF:** the same corridor is clean, because the bob's i-frame is 8 ticks out of phase.

**Change (`solverBot`, `strikePolicy`; all behind `strikeIframeLapse`).**

- `strikeCandidates` / `vetoedInRect` / `createStrikePolicy` / `strikePolicyFor` / `planSwordDash` / `probeCorridor`
  carry an optional `iframeLapse: false`, the walk's permission to admit a lapsing body.
- A conditional ladder rung **NARROW**, between KILL and DETOUR, re-probes the corridor the walk planned with the
  lapse admissions withheld:
  - it is asked only when the walk has a strike policy at all;
  - it is certified only if the preview arrives (`requireArrival`: not a stall, a wall or a stop);
  - when it is clean, the dash planner and the drive take the same permission (⚖ ruling 30(c)).
- Bookkeeping:
  - `LAPSE_NARROW_RETRY` (`SEEDLING_LAPSE_NARROW_RETRY=0` for an A/B);
  - `R8_STRATEGY_EXECUTORS.ladder` and `KNOWN_STRATEGY_VERBS` gain `narrow` (above `pace`, which MOVINGWAIT pins last);
  - a segment result carries `lapseNarrowWalks` only when the rung walked.
- With the lapse OFF the rung is absent: no row, byte-identical.

**Three cuts, each measured** (all on captured requests, in node):

1. **v1, before the ladder.** The 11 pit legs solve, but leg 265 changes. Its narrow walk is OFF's failing one (three
   wallflyer hits the preview never priced, a death, a 400-t stall), while ON-base's corridor crosses in 215 t.
2. **v2, a rung between KILL and DETOUR.** The 11 pit legs solve, and the 8 lapse-gained legs keep their ON answers.
3. **v3, only where the walk strikes.** Under the flip, `fidelityL14`'s swordless arrival escalated through NARROW.
   With no strike policy the narrow walk *is* the walk.

**Result at head** (`d1/node-replay-table.tsv`; answer hashes from `replay-seedling-solve-request.mjs`):

| legs | OFF | ON, rung off | **ON, head** |
|---|---|---|---|
| 11 pit legs (385 386 387 402 403 404 406 407 408 410 412) | all SOLVED (621–1,087 t, ~87 units) | all refused at budget (642) | **all SOLVED with OFF's answer hash, 86–91 units** |
| 8 gained legs (110 111 265 624 633 750 768 772) | 4 refused, 4 solved | as CI ON | **same answer as ON-base on all 8** |
| 773 | 373 t | 382 t | 382 t (unchanged; D2) |

**Game evidence.** The ON plans for the pit legs are OFF's plans key for key, and CI's OFF sweep plays those to
`done` (38323814554; ×2 in 38329997411 / 38330016107). No new game witness is needed for an unchanged plan.

**The route survey ON** (local, `--through=end --route=full`, with the lapse ON): with the head it equals ON-at-base row
for row, **0 movers** (`d3/survey-on-fix-vs-on-base.txt`). Against CI 38332251781 (OFF): **SOLVED 169 → 170, none lost**.
The movers are STRIKELAPSE's own: 50 → 413, 62 → 748, 147 → 504, plus the length movers in
`d3/survey-on-fix-vs-ci-off.txt`.

- Steps 156 and 187 read TIMEOUT under a loaded box. Solo (`--only=156,187`) they REFUSE with CI's text.
- The ON-at-base control was the same tree with `SEEDLING_LAPSE_NARROW_RETRY=0`. Its later steps imported D2's
  OFF-inert code; that is inert by construction (no Flyer bridged).

**Test** (`fidelityLapseCost.test.js`, D1 rows): the permission at `strikeCandidates`, the companion's default, leg 403
(776 t, OFF's keys), leg 265 not shadowed (215 t, equal to ON-base), and the companion-off mutant (refused at
`detour`).

**Mutants** (predicted first, copy + restore):

| mutant | predicted | measured |
|---|---|---|
| M1 / M1′: the retry or rung never asked | the 403 row red | 403 red only |
| M2: `strikeCandidates` ignores the permission | the permission row and the 403 row red | exactly those |
| M3: the drive not handed the permission | the 403 row red (preview and drive part) | 403 red only |
| v1's placement (before the ladder) | the 265 row red | measured as v1 itself (above) |

## D2: leg 773 (PASS, with a STOP inside)

**Measurement.** I built a tape from the ON plan (`d2/tape-773-on.json`, 382 t) and played it on p4f, headless, on
port 9670 (`probe-seedling-chaser-mobiles`, plus a scratch copy that dumps `botStatus`/`botMobiles` per tick;
`d2/game-773-*`).

- The game's `hits` go 0 → 2 at t103, with Δv (−0.06, +0.82) decaying.
- The push points from **`flyer@104,8`**, which hovers at (135.10, 47.02) from t96, to the player.
- The jellyfish the model has nearby matches the game at Δ 0, so it is not the cause.

`Flyer.as`:

- `p = collidePoint("Player", x, y + 10)`; if `p`, it plays "fall" (19 frames at 30).
- While "fall" plays: `v = 0`, `hitUpdate()`, and no `super.update()`.
- On frame 10 (index 6, the 7th update), a `p` still there takes `p.hit(null, dropForce 1, (x, y), damage 2)`.
- `hitPlayer()` is EMPTY, and `solids = new Array()`.
- Off the fall, it runs Bob's chase to the player + (0, −10) at moveSpeed 1.

The model never stepped a Flyer: the danger map priced it as a static body at its placement (112, 16). This is a
**model gap, not the lapse**. The lapse's different plan merely walked under a Flyer that OFF's plan avoided.

**Change: `contactFidelity.flyerLive` (OFF; `SEEDLING_FLYER_LIVE=0|1`).**

- **`chasers.CHASERS.flyer`:** `freezeSkipsUpdate`; Bob's `dieAnim`; `solidsMover: 'none'`; `contactHits: false`;
  `terrainFromCensus`; and the `drop` block (+ `dropPoint`, `dropPointCovered`, `createDropFallAnim`, `chaserDropOf`,
  `chaserContactHits`).
- **Rows added to shared tables:**
  - `spinner.MODELLED_ENEMY_CLASSES.Flyer` and `levelWorld.SOLIDS_BY_MOVER.none`;
  - `enemyDamage.CORPSE_COUNTING.Flyer`, `KILL_SIDE_WRITES.Flyer`, and `KILL_ARM_POLICY.Flyer` as a getter (OFF it
    reads the old row byte for byte);
  - `r8Acceptance.R8_ENEMY_BRIDGE.pendingSwitchScope.flyer`.
- **`levelRun`:**
  - the run's drop branch and `dropNow`, plus the graphic half's "fall" Spritemap;
  - the forecast's drop (reported as `drop`, never billed);
  - the solid-free sweep (both paths) and no contact billing;
  - census terrain;
  - `stepContactsNow` skips a bridged Flyer, like the Bulb;
  - `assertChaserSolidsBound` exempts an empty list.
- **`dangerMap.chaserDanger`:** a Flyer is priced by its drop, timed. It has no i-frame gate, since the drop has none.
  Untimed, it is priced as a column from its body to the drop point.
- **Door:** `solverView` re-exports `chaserDropOf` (surface 289).
- With the switch OFF the Flyer is not bridged and every new branch is unreachable: identity, `--check`s, tapeRunner
  and the bounded set are unchanged.

**Game witness** (p4f; `probe-seedling-chaser-mobiles --class=Flyer --player-hits --record`): the tape truncated at its
crossing (t381), so `lapsecost-l105-773-on-flyer` is in `fixtures/chaser-witness/` and not in the roster.

- With `flyerLive`, the model reproduces the game's player at 1e-9 on all 382 ticks.
- Both Flyers' position, velocity, hits and i-frame match at Δ 0 (614 comparisons). The jellyfish matches too (307, Δ 0).
- With `flyerLive` OFF the model parts first at t103.
- The forecast reports the drop on t103 and the transit danger arm prices it.
- At t382, the first L104 tick after the crossing, the game bills a hit the model does not. That is outside the leg
  (residue 3).

**STOP inside D2: the BeamTower's drifting Solid.** Under `flyerLive`, the solver's own leg-773 plan is 381 t with no
hit in the model (`d2/tape-773-flyerlive-plan.json`). On the game it parts at **t205**:

- The game's player holds `left` and is blocked at x 66.04, y 24.28 (`d2/game-773-flyer-plan-status-t203-207.log`).
- The only solid there is `beamtower@48,40`, whose `BeamTower.update` drifts its own `y` by `0.3·sin(worldFrame(100,2)…)`
  every unfrozen frame. Its 16×32 Solid moves with it (about 4.7 px up is enough to reach the player's box at y 22.28).
- The model holds the tower at its placement.

That is a second, separate model gap. It is named and measured here, not fixed. The game still crosses into L104 on
that plan (t299, 0 hits in L105), so a sweep would likely read `done` through recovery.

**Survey (Flyer levels only):** Flyers sit in L100, L101, L103 and L105, and nothing else can move. Steps
203/204/206/208/210/215 with `flyerLive` OFF vs ON (`d3/survey-flyer-levels-on-vs-off.txt`):

- none lost;
- 208: 264 → **240 t**;
- 204's refusal text moves (still the spinning axe).

The first ON run refused 208 at the sword press's `genericHit` arm. That is why `KILL_ARM_POLICY.Flyer` is modelled ON.

**Sweep (local, 12 Flyer-room legs, lapse ON + `flyerLive`, one sample each;
`d3/sweep-flyer-legs-lapse-on-flyer-on.jsonl`):**

- 773 **done** (CI ON: failed);
- 754 **done** (CI ON and default: failed);
- 765 failed (as in CI);
- 768 failed, where CI ON had it done. Decided in node: at the captured seam (5332) both `flyerLive` settings solve
  (577 t), and at the sweep's seam (+21) both refuse on the spinning axe. **Seam time, not the switch.**

**Entity witness:** `witness-seedling-entities.mjs --only=<the 8 chasers.flyer leaves>` (16 runs, 211-tape fast tier,
a superset of the file's 183): all corpus-blind, 0 moved and 0 threw at both magnitudes, control stable. Merged with a
`partialRemeasure.lapsecost` note.

**`flyerLive` ON over the whole bounded set** (the wave-10 lesson): 6 reds.

- Three were substantive and are fixed in D2b, OFF byte-identical:
  - `stepContactsNow` priced a bridged Flyer at its placement;
  - `pendingSwitchScope.flyer` was missing;
  - the controls that ask "every switch OFF" now name it, and `r4Swim` exempts an empty solids list.
- Three remain: `r8Acceptance`'s roster pins of the DEFAULT state (the declared and derived bridged list, the
  untranscribed control's list, the stepped-partition tally). A `flyerLive` flip re-pins them with `flyer`, and the
  `contactFidelity` defaults pin skips under the env.

**Mutants** (predicted first):

| mutant | predicted | measured |
|---|---|---|
| M4: `hitIndex` 6 → 5 | the row-facts, W1-0px, run-bill and forecast rows red | exactly those 4 |
| M5: the danger map's drop arm prices nothing | the forecast/danger row red | exactly that row |
| M7: no `v = 0` in the run's fall branch | W1 and the run-bill row red | **not caught at first**: the falling Flyer does not move, so a stale `v` shows only in its own rows after the fall. I added the Flyer-rows-vs-game row, and M7 then reds it alone |

## D3: the flip, re-measured (PASS, HELD; the default stays OFF)

**At head `18df63b`, in a scratch worktree.** I applied STRIKELAPSE's `flip-candidate.patch` with `--3way`. There was
one conflict: `contactFidelity.test.js`'s defaults pin, resolved to "the lapse ON; `arrivalButtonArm`,
`unbilledDamageGate` and `flyerLive` OFF". I added the brief's CI-only mover: `procgenRoam` "rooms s10 post-sword
COSTS", `[127,69]` → **`[101,69]`**, with its label (`lintGateLabels` green).

| row | result |
|---|---|
| `solve-seedling-r9-campaign --check` on the flip tree | **`6b1bf15c` exit 0**, STRIKELAPSE's candidate digest exactly: the NARROW rung moves no campaign window |
| bounded set with the flip: 150 files (my 88 ∪ STRIKELAPSE's 126) | before v3 and the re-pin, 4,997 / 4,999. The reds were `fidelityL14` (NARROW in a swordless room, fixed by v3) and `procgenRoam` (the mover). **After: 4,999 / 4,999** (`d3/bounded-flip.rows`, md5 `7b74e0d6`) |
| identity block on the flip tree | `d3/identity-flip.txt`, rc 0. It differs from this head on exactly three rows: ENEMY census `afdc6d1a` → **`36b59445`** and r9-campaign `712f0ead` → **`6b1bf15c`** (both STRIKELAPSE's expected flip digests), and the reference reports 5 modules/regions DIFFER. That is expected: the patch leaves regeneration to the landing step. Every other row equals this head |
| local survey ON | equals the flip (the flip only sets the default): **170 SOLVED, none lost** |
| sweep legs in node by key | the 11 lost now solve with OFF's plan; the 8 gained keep their ON answers; 773 is D2's (above) |

**The refreshed patch.** `seedling-fidelity-lapsecost-evidence/flip-candidate.patch` (md5
`21d4d9ef06c26d53d42af2576ff9733a`; 41 files = STRIKELAPSE's 40 + `procgenRoam.test.js`; `git apply --check` clean at
`18df63b` and at this head). To land it: `git apply`, fill `<the licence>` in `contactFidelity.js` and
`contactFidelity.test.js`, regenerate the reference, and run the identity block.

## The survey and sweep rows this moves (before → after)

**With the lapse OFF (the default): nothing moves.** That is the identity block and the bounded set above.

**Lapse ON, survey (local).** STRIKELAPSE's ON movers against CI OFF are unchanged by this slice, and against
ON-at-base there are **0 movers**:

- 50: 460 → 413;
- 62: 386 → 748;
- 147: REFUSED → 504;
- 16/24/35: 98 → 103;
- 69: 103 → 117;
- 26/37: 688 → 655;
- …, as in `d3/survey-on-fix-vs-ci-off.txt`.

**Lapse ON, sweep (by key; node replay of captured requests):**

| key | CI ON (38323806364) | head ON |
|---|---|---|
| the 11 `level_40__r23c29 <- … -> exit:out_pit_*` | failed (×2) | **SOLVED in node with OFF's plan** (OFF is game-done) |
| `level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144` (773) | failed | unchanged with `flyerLive` OFF. With `flyerLive`: **done** locally (one sample) |
| 110, 111, 265, 624, 633, 750, 768, 772 (the gains) | done | same answer as ON-base (633 refuses at the local seam 5230, ON either way; OFF solves it there) |

**`flyerLive` (lapse ON), local:** 773 failed → done; 754 failed → done; 768 is seam time; 765 is unchanged.

## CI dispatches for the planner

Cloud sessions get 403, so the planner runs these. All on ref **`claude/seedling-lapse-cost-xtr3hu`** unless a flip
branch is named.

1. **Sweep A/B on the 19 keys D1 measured** (cheap; confirms D1 on the game). `seedling-divergence-sweep.yml`:
   - `mode=inv`, `producer=solver`;
   - `keys=` the 12 lost keys and the 8 gained:
     - 773: `level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144`;
     - the 11 pit legs: `level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_13_20`, `level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_14_20`, `level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_5_20`, `level_40__r23c29 <- in_L43_176_464 -> exit:out_pit_13_20`, `level_40__r23c29 <- in_L43_176_464 -> exit:out_pit_13_21`, `level_40__r23c29 <- in_L43_176_464 -> exit:out_pit_14_20`, `level_40__r23c29 <- in_L43_176_464 -> exit:out_pit_14_21`, `level_40__r23c29 <- in_L43_176_464 -> exit:out_pit_5_20`, `level_40__r23c29 <- in_L43_176_464 -> exit:out_pit_5_21`, `level_40__r23c29 <- in_L43_176_464 -> exit:out_pit_5_22`, `level_40__r23c29 <- in_L43_176_464 -> exit:out_pit_5_23`;
     - the 8 gained: `level_12__r0c19 <- in_L0_304_176 -> location:L12 flag 4: bosslock@416,240 cleared`, `level_12__r0c19 <- in_L0_304_176 -> location:L12 flag 5: bosslock@432,240 cleared`, `level_22 <- in_L29_0_224 -> exit:out_teleporter_96_192`, `level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144`, `level_75 <- in_L74_16_144 -> exit:out_teleporter_64_224`, `level_98 <- in_L99_112_112 -> location:Level 098 - Chest`, `level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144`, `level_104 <- in_L105_224_64 -> exit:out_teleporter_144_128`;
   - `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,fallRockPostFall,forecastSpeedByTerrain,strikeIframeLapse`;
   - run it **twice** (×2) with `capture_requests=true`.

   Expect: the 11 pit legs `done` (OFF's plans), the 8 gained `done` as CI ON (seam permitting: 633 and 768 are
   seam-sensitive), and 773 failed (the Flyer; dispatch 4).
2. **The full sweep, ON vs default.** `seedling-divergence-sweep.yml`, `keys=` empty, once with the ON
   `contact_fidelity` above and once with it empty. Then a ×2 repeat (`keys=`) on any key that is `done → failed` in
   the ON run and not in the default.
3. **Survey on a flip branch.** Make a scratch branch from this head, `git apply
   CC/docs/cloud-reports/seedling-fidelity-lapsecost-evidence/flip-candidate.patch`, commit, push. Then
   `seedling-survey.yml` with its defaults (`--through=end --route=full`). Expect 170 SOLVED, 50/62/147 = 413/748/504,
   and no step lost against 38332251781. On the same branch run:
   - the **full tier**;
   - **`seedling-probe.yml battery=standard`**;
   - its **push JSUT**, which is the unfiltered vitest with the flip. FLIP14 found 9 rows only CI caught.
4. **`flyerLive` A/B (D2).** `seedling-divergence-sweep.yml` with `keys=` the 12 Flyer-room legs:
   `level_100__r2c3 <- in_L99_48_96 -> exit:out_stairsdown_48_96|level_101__r4c2 <- in_L100_288_96 -> exit:out_stairsup_48_96|level_101__r4c2 <- in_L102_64_96 -> exit:out_stairsup_48_96|level_101__r4c9 <- in_L102_160_96 -> exit:out_stairsup_144_96|level_103 <- in_L102_0_96 -> exit:out_teleporter_0_64|level_103 <- in_L102_0_96 -> exit:out_teleporter_304_144|level_103 <- in_L104_144_128 -> exit:out_teleporter_0_64|level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144|level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144|level_105 <- in_L104_0_16 -> exit:out_teleporter_224_64|level_105 <- in_L106_256_0 -> exit:out_teleporter_80_144|level_105 <- in_L106_256_0 -> exit:out_teleporter_224_64`.
   Run it twice: with `contact_fidelity=` the ON set above **plus `,flyerLive`**, and with the ON set alone. Then ×2 on
   any mover. A survey with `flyerLive` needs a measurement commit (`flyerLive: true` in `contactFidelity.js`):
   `seedling-survey.yml -f only=203,204,206,208,210,215`. Expect 208 at 240 t and none lost.

## The JS arc's pins and what it must wire

- **No signature or contract change** to `solveSegment`, `twoPassSolve`, `PendingDeclaration` or
  `createRunForStaging`. No new staging field.
- **One optional result field:** `lapseNarrowWalks` on a segment result, present only when the NARROW rung walked
  (lapse ON). No new `SolverRefusal.obstacle.kind`. A climb's trace may carry the new rung verb `narrow`.
- **One new contact switch, `flyerLive`.** The page's settings derive from `CONTACT_FIDELITY_KEYS`, so
  `flashPanel.seedlingContactFlyerLive` exists with no wiring (`contactFidelityHook` row green). The sweep's
  `contact_fidelity=` accepts it, and `all` now includes it.
- **The chaser forecast's projection** gains `drop` (null or `{point, hitsPlayer}`) for a bridged Flyer, ON only.
- **The walker (`botDriverV2`)** is not touched. No `producer:walker` row was run or moved.

## Handed to the hammer arc

- None of its functions were edited. `strikePolicy.js`'s `strikeCandidates` is fidelity's; `deriveStrike` and
  `pressKillCost` are untouched.
- One of its tables gained a switch-gated row: `KILL_ARM_POLICY.Flyer` is now a getter, `modelled` with `flyerLive` ON
  and byte-identical OFF. Its SandTrap and Turret rows are untouched.
- The flip patch carries its pins as FLIP14 and STRIKELAPSE measured them: `fidelityF1c` 40 → 12, `playthroughWalk`
  {18,0} `removedAt` 306, 12b′ ×4 and `solverDeadline`. They are all green under the flip at this head.

## Deltas (base → head)

- **Code:**
  - `strikePolicy.js`: the permission;
  - `solverBot.js`: the NARROW rung, `LAPSE_NARROW_RETRY`, `requireArrival`, the threading;
  - `chasers.js`: `CHASERS.flyer` + 6 helpers;
  - `levelRun.js`: the Flyer's run/forecast/contact/terrain arms;
  - `dangerMap.js`: the drop pricing;
  - `contactFidelity.js`: `flyerLive`;
  - `enemyDamage.js`: three Flyer rows;
  - `levelWorld.js`: `SOLIDS_BY_MOVER.none`;
  - `spinner.js`: a roster row;
  - `solverView.js`: the door;
  - `r8Acceptance.js`: the ladder row and `pendingSwitchScope.flyer`;
  - `decisionTrace.js`: the verb.
- **Tests:**
  - new: `fidelityLapseCost.test.js` (18 rows);
  - re-pinned with a reason each: `contactFidelity`, `r8Acceptance` (rosters, ladder), `spinner`, `entityRecords` md5,
    `combatVerbs`' untranscribed example (flyer → drill);
  - made switch-explicit: `enemyDamage`, `fidelityKillLock`, `r4Swim`.
- **Fixtures:** `chaser-witness/lapsecost-l105-773-on-flyer.json` (not the roster).
- **Records:**
  - surface 289; constants census + fields (+5); entity witnesses (+8);
  - `seedling-bot-log.md` LAPSECOST entry with trap candidates; the `seedling-bot.md` as-built paragraph;
  - the reference regenerated (ALL MATCH).
- **Evidence:** `seedling-fidelity-lapsecost-evidence/` (`w0`, `d1`, `d2`, `d3`, `flip-candidate.patch`).

## What the brief got wrong (measured)

1. ***"Find what the lapse multiplies"* (a site's cost).** It multiplies nothing per site. It changes which walk is
   walked, and on L40 a flagged probe sends the ladder to DETOUR, whose L40 lattice is the expensive part, ON or OFF.
2. ***"D2: a press admitted on a lapsing i-frame whose consequence the model mis-steps?"*** No. The t103 divergence is a
   **Flyer's drop**, a class the model never stepped. The lapse only chose the plan that walks under it.
3. **The fix placement.** "Fix behind the lapse switch" read naturally as "before the ladder". That shadowed a lapse
   gain (leg 265). It had to be a rung.
4. ***"The 11 legs … OFF they solve in ~20–32 s"*** holds in node too (~4 s). With the narrow rung, ON costs the same
   units as OFF (86–91).
5. **The brief's lost-key list is 12 keys:** 11 pit legs + 773. "The 11 `level_40__r23c29` pit exits" counts right; the
   list's first key is 773.
6. **Bootstrap `READY` again left five non-wasm submodules uninitialised.** The reference row needs them.

## Residue

1. **The BeamTower's drifting Solid** (D2's STOP). `y += 0.3·sin(worldFrame(100,2)/100·2π)` per unfrozen frame moves the
   tower's 16×32 Solid; the model holds the placement. Measured on the `flyerLive` plan for leg 773 at t205
   (`d2/game-773-flyer-plan-status-t203-207.log`). Next: a game-witnessed drift model (the worldFrame clock is the
   staging's seam time).
2. **`flyerLive` stays OFF.** Its flip owes three `r8Acceptance` roster re-pins, the CI dispatches 4 above, and a survey
   with it on (`only=` the six Flyer-level steps).
3. **An L104 arrival hit at t382** in the leg-773 witness (the first L104 tick after the crossing: the game's y −4.3,
   `hits` 1; the model none). It is outside the leg and not investigated.
4. **Leg 633 at the local seam 5230:** ON (rung on or off) refuses at budget while OFF solves it (449 t). CI had it done
   ON. It is seam-sensitive; the ×2 in dispatch 1 decides.
5. **The flip itself is held.** It needs the user's licence plus dispatches 2–3.
6. **`requireArrival` has no row that exercises it:** no captured leg's narrow preview truncates. It is the
   conservative side; its effect is to refuse the rung.

## Byte-inertia (OFF)

What did not move at head with the defaults:

- every identity row and the six `--check`s;
- tapeRunner (611, `86af8525`);
- the roster (277);
- every committed tape, expectation and trace;
- the bounded set: 3,366 rows identical, plus 15 new.

The surface gained one import row and the entity records gained the Flyer row; both are re-censused and pinned.

CI on the code head:

- At `70ba9c7` (D2b), the unfiltered suite finished before the newer push cancelled the job: **801 files / 20,274
  passed / 0 failed**.
- At `8be1fc1`: run 38630598631 **success**: unfiltered **801 files / 20,274 passed / 0 failed**; slow battery 18 files / 253 passed / 0 failed.

## Rows to BANK

- **Code:**
  - the NARROW rung (`LAPSE_NARROW_RETRY`, `strikePolicyFor`'s `iframeLapse`, `probeCorridor`'s `requireArrival`), the
    lapse ON only;
  - `contactFidelity.flyerLive` (OFF) with `CHASERS.flyer`.
- **Node, the lapse ON:**
  - the 11 L40 pit legs SOLVED with OFF's plan (86–91 units against 640);
  - the 8 gains unchanged;
  - the route survey 170 SOLVED, 0 movers against ON-at-base.
- **Game witness:** `lapsecost-l105-773-on-flyer` (p4f): the player at 1e-9 on 382 ticks; the Flyers at Δ 0 (614); the
  jellyfish at Δ 0 (307).
- **`flyerLive` survey (Flyer levels):** none lost; 208 → 240.
- **The flip candidate:** `flip-candidate.patch` `21d4d9ef` (41 files); r9-campaign `6b1bf15c` exit 0; bounded 150
  files 4,999 / 4,999; identity on the flip tree equals this head except ENEMY `36b59445`, r9-campaign `6b1bf15c` and the reference, which is regenerated at landing (`d3/identity-flip.txt`).
- **W0 / identity OFF:** unchanged. Surface 289, constants 5,864, entities 566 (`fe5051f6`).
- **Mutants:** M1′, M2, M3, M4, M5, M7, each red exactly where predicted (M7 after one added row).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no
  force-push.
