# Seedling fidelity CORRIDOR — the walk corridor prices the live wallflyers and drills

Session `seedling-fidelity-corridor` (Opus build, cloud), planner `seedling-fidelity-planning-8`, wave 17 (model coverage).

| | |
|---|---|
| Start SHA | `e967758748` (main: wave 16 + the lapse flip + hammer DD / RE / SF) |
| Head | the commit that adds this CI row (docs only), on `0a492bb` (CI 38825812541 green); last code head `f5c2267` |
| Harness branch | `claude/seedling-corridor-pricing-6h3swc` |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (switch built, OFF; STOP for the flip) · D3 PASS (contact geometry, not pricing; already closed at the defaults) · gate flip STOP** |

## The one thing to know first

**ON, the route survey carries no unbilled hit at all, and the gate then has nothing left to refuse.** `corridorBodyPricing`
forecasts the room's wallflyers and drills along every previewed walk. The forecast holds every body at 0 px against the
drive, and lands its contacts on the game's own ticks. Survey step 53 stops dying (406 t, 6 hits and 2 deaths → 126 t, 0
hits). Step 170 walks clean, and step 100 goes REFUSED → SOLVED. Steps 47 and 114, whose walks the game really hits,
refuse by name instead. Survey ON is **169 SOLVED** (base 170) with **0 unbilled hits**. ON with `unbilledDamageGate` too
equals ON on all 222 rows.

The second thing to know: **the cost is solve time.** In node, the sweep legs that move take 4–30 s ON, against 0.4–1 s
OFF. The page budget may cut some of them, so the sweep A/B below must be read with `leg_budget_ms`.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | the harness branch at `e967758748` | bootstrap `READY`, node v22.22.0. Server PID 563 on port 9683; a base worktree at `/home/user/base-wt`, served on 9684 |
| CI baselines | `survey-seedling-shards.mjs --fetch=38778265493`; `gh run download 38778270309 -n divergence-merged` | both fetched. The local base survey `--through=end --route=full` **equals CI 38778265493 on all 222 rows** (170 / 50 / 1 / 1), compared by level, goals, boot and occurrence (ticks and hits included) |
| identity block (venv on) | `SEEDLING_PORT=9684 bash scripts/procgen/identity-block.sh .` in the base worktree | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, **ENEMY `36b59445`**, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | the same block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · **r9-campaign `6b1bf15c`**, all exit 0 |
| surface / constants | `census-seedling-solver-surface.mjs --check`, `census-seedling-constants.mjs --check` | GREEN **296** · PASS **5,882** |
| bounded vitest BEFORE | 154 files: the brief's standing list, plus every non-slow test naming `previewWalk`, `dangerAt(`, `dangerDuringTransit`, `chaserDanger`, `chaserForecast`, `CONTACT_FIDELITY_KEYS`, `climbLadder`, `planSwordDash`, `wallFlyers` or the surface/constants (`evidence/w0/bounded-files.txt`) | 5,299 passed / 3 failed / 10 skipped, rows md5 `ae8744f5`. The 3 reds are artifacts: `boxLock` (8 simultaneous takers) under load, `loopBlockBuilder` and `generated --check` in the worktree (symlinked submodules). All three pass at head |
| hammer workloads | RE's lab drivers (`evidence/hammer/`) | staging A sword `82834f24`, ghost `fcac3f47`; legs 397 `b90f7720`, 414 `314c6324`; L18 sweep `de6f6e4e`; C2's ghost staging `1ca7eed5` |

⚠ The ENEMY census and the r9-campaign `--check` read differently from the values earlier reports published
(`afdc6d1a`, `712f0ead`). Both are this base's own values (wave 16 + the lapse flip). Head OFF equals them.

## D1 — the census at the base (PASS)

The instrument is UNBILLEDGATE's census window (`UNBILLED_DAMAGE_TRACE.sink`, through the preload in
`evidence/drivers/census-preload.mjs`).

**The survey** (`evidence/d1/survey-census-base.jsonl`, 171 segment successes): **4 steps** carry unbilled hits.

| step | level | unbilled (run tick, body) | class | what failed |
|---|---|---|---|---|
| 47 | L22 | t84 `wallflyer@64,80` | wallflyer | **forecast**: the map priced only the flyer's `.oel` placement (`staticEnemyDanger`) |
| 53 | L22 | t40 `@144,112`, t67/t99† `@48,112`, t144 `@48,112`, t172/t235† `@144,112` | wallflyer | **forecast** (as 47) |
| 114 | L88 | t48, t110 `drill@128,160` | drill | **forecast**: placement only |
| 170 | L77 | t17 `lavarunner@112,256` | chaser | **timing inside the tick**: the chaser forecast holds the body at 0 px and puts the contact at t17. But the danger map read the body's `hitsTimer` (29) after the dark shield's bump (the Player's update, later that tick) set it, so `plannerContactFree` waived the hit. The gate itself read 0 (measured, `evidence/drivers/chaser-step.mjs`) |

**The sweep's UNBILLED-HIT legs** (`summary.txt` of 38778270309, 21 legs; plus 140 / 141). Each was re-run in node with
`inv-leg.mjs` (the sweep row's inventory, `ANYTIME_PASSES`, no budget), matched by KEY; every id equals the sweep's.

| legs | node at base | unbilled hits on the RETURNED plan | class |
|---|---|---|---|
| 703, 696, 698 (L88) | ok 213 / 476 / 379 t | drill t53; t48 + t110; t48 + t114 | drill, forecast |
| 262 (L22), 283 / 290 (L25), 302 (L27) | ok 229 / 182 / 128 / 126 t | `@128,80` t58; `@48,48` t80; `@64,48` t60; `@192,48` t16 | wallflyer, forecast |
| 265, 257 (L22), 288 (L25) | ok 103 / 120 / 106 t | none: only the dashless candidate is hit | — |
| 633, 635 | ok | none: model gaps (UNBILLEDGATE's hand-over) | — |
| 773 (L105) | ok | none: the Flyer's drop (`flyerLive` OFF, LAPSECOST's gap) | — |
| 768 (L103) | refused (the ladder) | — | not reproduced |
| 130, 131, 140, 141, 160, 161, 171 (L12), 322, 328 (L30) | refused (`keylock cannot act on bosslock`) | — | not reproduced: `inv-leg.mjs` does not stage the page's key state |

**Seen-but-not-charged** (pricing) is not the failure for any of them. Every wallflyer and drill hit is the forecast:
neither class had any live arm in the danger map. The one chaser hit is the i-frame read at the wrong moment of the tick.

## D2 — the pricing (PASS; STOP for the flip)

**The switch.** `CONTACT_FIDELITY.corridorBodyPricing`, OFF. It is a `CONTACT_FIDELITY` row like the gate, so the
page's `?contactFidelity=`, the flashPanel setting, the worker's stamp and the sweep's `contact_fidelity=` input all
derive from it. Node: `SEEDLING_CORRIDOR_BODY_PRICING=0|1`.

**The change** (each in a function of its own; OFF every path is `null` or absent):
- `levelRun.corridorBodyForecastNow` / `run.corridorBodyForecast()`. It clones this room's wallflyers and drills and
  steps them, one `step(playerPos, {slashing})` per tick, with the live steppers (`stepWallFlyer` + graphic,
  `stepDrill` + graphic). It uses the run's solid / probe / tile context frozen once, and its own camera seeded from the
  live one. The shield bump comes from `shieldBumpNow`'s W7 arm under `wallFlyerShieldBump`. The player's i-frame is
  run down per tick and re-armed (`hitsTimerMax − 1`) by a landing contact.
  - Each tick returns `{kind, id, x, y, rect, contact, hitsPlayer, uncertain?}`. `contact` is the class's own
    `hitPlayer` gate against the player's start-of-tick box. `hitsPlayer` is that contact landing through the i-frame.
  - `swing(playerPos, inSwing)` applies one sword test of the preview's own window: line of sight, then
    `hitWallFlyer` / `hitDrill`.
- `previewWalk`: each sample carries `corridorBodies` (walk, stall and dwell loops). Each fired sword test of the
  preview's window also hits them (`corridorSwing`, through the chaser arm's two gates).
- `dangerMap.corridorBodyDanger` and `dangerAt`'s new `corridorBodies` option (transit only). A landing contact or an
  `uncertain` on-screen verdict is a `chaser` source with `body` set. `dangerDuringTransit` gains an optional 8th
  argument, and only `probeSamples` passes it, so `deriveStrike`, `planPacedWait` and the kill/bait forecasts are untouched.
- `chaserForecastNow` projects `contactHitsTimer`, the timer the body's own contact gate read before the Player's update.
  `chaserDanger` asks `plannerContactFree` with it.
- The ladder, for a hit made only of these sources:
  - DODGE searches it (bounded: `CORRIDOR_DODGE.window` 32 ticks before the hit, each preview stopped at its first danger).
  - `walkTo` and AVOID first ask the dashed walk (`corridorDashRescue`). It also plans a dash chain as before the
    forecast and certifies the WHOLE dashed walk with the full predicate, because `planSwordDash` admits windows one at
    a time and no 1-window prefix of step 45's chain is clean.
  - A corridor-body hit met two climbs deep (`CORRIDOR_LADDER_NEST`) refuses by name. Without that guard, step 45
    re-entered the KILL rung's stance walk more than 30 climbs deep and never answered.

**Witnesses** (`fixtures/corridor-witness/`, `fidelityCorridorBody.test.js`, 8 rows). The survey's walks for steps 47
and 114 were played on p4f headless by UNBILLEDGATE D1 (clock shift [0]). Driven on the model, with the forecast stepped
against the drive's own player and the drive's own landed sword tests:

| walk | worst body Δ | forecast contacts | model hits | game `hits` rises |
|---|---|---|---|---|
| step 47 (L22, 201 t) | **0 px** | t84 | t84 | t84 |
| step 114 (L88, 476 t) | **0 px** | t48, t110 | t48, t110 | t48, t110 |
| step 53 (L22, 406 t; scratch) | 0 px until the t99 death reset | t40, t67, t99, t144 | t40, t67, t99, t144, … | t40, t67, t144, t172 |

The other rows:
- ships OFF;
- `corridorBodyDanger` and `dangerAt`'s transit-only pricing;
- step 53 OFF dies twice, ON walks 126 t clean;
- step 45 keeps its 6-window dash chain (113 t, clean) ON;
- step 170 OFF 475 t with the t17 hit, ON 491 t clean.

**Mutants** (predicted, then made by copy and restore, `evidence/drivers` + the table):

| mutant | predicted red | measured |
|---|---|---|
| M1 `corridorBodyDanger` returns `[]` | the unit row, the `dangerAt` row, step 53 | exactly those 3 |
| M2 `swing` does nothing | the step-47 witness | 47, **and** 114 (its drill is sword-struck) and 45 (the chain's presses turn the flyers): 3 |
| M3 `chaserDanger` ignores `contactHitsTimer` | step 170 | exactly that 1 |
| M4 no i-frame on a landing contact | the step-114 witness | exactly that 1 |
| M5 no whole-chain certification | step 45 | exactly that 1 |
| M6 no nesting guard | **blind** (no row nests the climb two deep once M5's rescue holds) | blind |

### The movers, ON (the bounded set and every workload)

| row | OFF (head) | ON | ON + `unbilledDamageGate` |
|---|---|---|---|
| route survey, local, `--through=end --route=full` | = base on all 222 (170 / 50 / 1 / 1) | **169 / 51 / 1 / 1**, by step: 53 SOLVED 406 → **126** (0 hits) · 170 SOLVED 475 → **491** (0 hits) · **100 REFUSED → SOLVED 192** · 47 SOLVED 201 → REFUSED (ladder: `wallflyer@48,112`) · 114 SOLVED 476 → REFUSED (ladder: `drill@128,160`) | **= ON on all 222** |
| survey census, unbilled hits | 4 steps | **0** | 0 |
| sweep legs in node (`evidence/d2/legs-on.jsonl`) | = base | 703 213 → **142** t · 262 229 → **207** · 283 182 → **156** · 290 128 → **110** · 288 106 → 109 · 265 103 → 128 · 257 120 → 134: all clean · **696, 698, 302 → refused by name** (drill, drill, wallflyer) · 635 / 773 / 633 / 768 and the L12/L30 keylock legs unchanged | (the gate refuses none: no ON plan carries an unbilled hit) |
| sweep legs, solve time in node | 0.4–1.0 s | 4–30 s on the 10 legs that move | — |
| identity block | **= base on every value row** (`evidence/w0/identity-head-off.txt`) | **ENEMY `36b59445` → `11b47aeb`**: the `drill` corridor-chamber row 155 → 171 t (it walks round the drill). Every other row = OFF | ENEMY as ON, plus **c3 `a6b02e2e`, c6 `40688be9`, c4 `caa8cda2`**: the gate's own generated-spinner movers (UNBILLEDGATE D3's values exactly) |
| six `--check`s | = base, exit 0 | unchanged, exit 0 | unchanged, exit 0 |
| hammer: staging A sword / ghost, 397, 414, L18 sweep, C2 ghost staging | = base | **= base** (`evidence/hammer/answers.txt`); wall times within run noise | — |
| bounded vitest (155 files: W0's 154 + this file) | 5,661 / 5,662: `generated --check` red until the reference was regenerated, then green | **5,655 passed, 5 red, 2 env-skipped** (below) | 5,652 passed, 5 red (the same 5), 3 env-skipped |

**The 5 bounded reds ON** (every one an L22 flyer room whose plan the switch changes; none is a byte artifact):
1. `fidelityLapseCost` "leg 265 (L22) solves with or without the rung (215 t)": that captured request now refuses.
2. `fidelityUnbilledGate` "OFF: step 47 SOLVES with the unbilled hit": step 47 now refuses by name.
3. `fidelityUnbilledGate` "ON: step 47 is REFUSED … unbilled-damage": it is refused by the ladder before the gate.
4. `fidelityUnbilledGate` "ON: a hit inside a replayed PREFIX …": the same witness.
5. `seedlingCanCross` "cannot: L22 from L25 toward L29": still `cannot`; its cause now names the wallflyer obstacle
   instead of a stall.

The flip owes those rows a re-pin:
- The three gate rows pin `corridorBodyPricing` OFF (their witness is a walk the gate refuses, so they need the hit).
- The LAPSECOST leg-265 row pins it OFF, or re-pins the new answer.
- `seedlingCanCross`'s cause re-pins.
- The defaults pins (`contactFidelity.test.js`, `fidelityCorridorBody.test.js`).

**No committed tape moves and no producer `--check` digest moves**, ON or ON + gate.

### STOP — the two flips

- **`corridorBodyPricing`**: `evidence/flip/corridorBodyPricing-flip.patch`. It sets the default and its two defaults
  pins; with it applied, `contactFidelity` + `fidelityCorridorBody` read 70 / 70. Its whole bounded set is the ON column
  above: 5 reds, re-pins named.
- **`unbilledDamageGate`**: `evidence/flip/unbilledDamageGate-flip.patch` (the default and its pin). **Flip it with or
  after `corridorBodyPricing`, not before.**
  - With the pricing ON it moves no survey row and no sweep plan, and in the bounded set nothing beyond the pricing's
    5 reds.
  - It does move the identity block's c3 / c6 / c4: generated spinner rooms, which the pricing does not touch.
  - Alone, it is UNBILLEDGATE's flip: survey 47 / 53 / 114 / 170 → REFUSED.

### The CI dispatches the planner should run

1. **Survey ON.** `seedling-survey.yml` has no `contact_fidelity` input, so use a flip branch: this branch plus
   `corridorBodyPricing-flip.patch`. Inputs: `through=end route=full`. Expected 169 / 51 / 1 / 1, with steps 47, 53,
   100, 114 and 170 moving as above, compared by level, goals and boot. Cheaper: `only=45,47,53,100,114,170 route=full
   through=end base_run=38778265493`. Step 45 is in the list because it was the measured loss before the nesting guard.
2. **Survey ON + gate**: the same flip branch plus `unbilledDamageGate-flip.patch`. Expected = (1) on all 222.
3. **Sweep A/B** (`seedling-divergence-sweep.yml`, branch `claude/seedling-corridor-pricing-6h3swc`, `mode=inv
   producer=solver`, `leg_budget_ms` as in 38778270309). Three runs:
   - `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,corridorBodyPricing`;
   - the same plus `,unbilledDamageGate`;
   - the default (empty) as the control. A ×2 repeat on any key that moves.

   Expected: the UNBILLED-HIT rows for 703, 262, 696, 698, 283, 290, 302, 265, 257 and 288 disappear. 696, 698 and 302
   become solver refusals; the others play clean. 633, 635 and 773 do not move (model gaps). ⚠ Watch the `timeout` /
   budget column: ON solves are 4–30 s in node.
4. **Probe battery**: `seedling-probe.yml battery=standard` on this branch. Default OFF, so it should equal main's.

## D3 — G2, contact witness 269 (PASS: contact geometry, not pricing)

`replay-seedling-contact-capture.mjs --file=fixtures/contact-witness/269.json` (the fixture and its row read, not edited):

| switches | result |
|---|---|
| the shipped defaults | PASS, 73 ticks, worst 0.000 px |
| the defaults + `corridorBodyPricing` | PASS, 0.000 px |
| `none` (the capture's own) | FAIL at t70: model `hits` 1, game 0; Δ 4.676 px |
| `none` + `corridorBodyPricing` | the same FAIL at t70, byte-identical |
| `collideLinePointsExact` alone | PASS, 0.000 px |

**The t70 hit is contact geometry.** In the all-OFF model, `wallflyer@48,48` stands at (56,79) at t70 while the game's
is at (56,75): the inexact trigger ray (W1) launches it a tick early, and its box meets the player. Pricing cannot move a
fixed plan's run, so the switch changes nothing in the replay. `collideLinePointsExact` closes it, and that switch is ON
at the defaults. **Handed to L40CONTACT's region as information only**: nothing is left to fix at the defaults.

The leg's live solve, re-solved from the capture's request (today's id is **288**, same key), at the defaults:
- OFF: 106 t. The dashless candidate takes t71 `wallflyer@48,48`; the full pass is clean.
- ON: 109 t, and no pass carries an unbilled hit.

## The JS arc's pins and wiring

- **No JS-arc pin moves with the switch OFF.** The flashPanel setting and the page query derive the new key from
  `CONTACT_FIDELITY_KEYS` (`seedlingContactSettings.js`); no edit was needed, and `contactFidelityHook` is green at head.
- **New optional fields**, all absent OFF:
  - `previewWalk` sample `corridorBodies`;
  - `dangerAt` option `corridorBodies`;
  - `dangerDuringTransit`'s optional 8th argument;
  - the chaser forecast projection's `contactHitsTimer`;
  - `run.corridorBodyForecast()`.
- **No new `SolverRefusal.obstacle.kind`.** A by-name refusal ON is the ladder's existing `danger` refusal; the source
  is `chaser` with `body: 'wallflyer' | 'drill'`. The nesting refusal's message starts `… CORRIDOR — the corridor meets`.
- `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are unchanged. The walker
  (`botDriverV2`) is not touched, so **no `producer:walker` sweep row can move**.

## Handed over

- **To the hammer-phase arc** (information; nothing in its region was edited):
  - The KILL rung's chaser arm re-enters `walkTo` for its stance. A stance corridor that needs the ladder again
    recursed without bound when wallflyers were priced (survey step 45: more than 30 climbs). This slice bounds it at
    the call site behind the switch; a guard in the kill arm itself would be the arm's call.
  - Its `deriveKillByChaser` / `scoreAll` previews now carry the forecast rows (cost only); its answers are unchanged.
  - For step 47 the chooser picks `bob@96,144`, not the wallflyer the corridor names.
- **To whoever owns the drill and wallflyer kill arms.** Steps 47 and 114 and legs 696 / 698 / 302 refuse because no
  rung removes the body. The KILL rung says the drill "is not a body this run can watch die", and the wallflyer is never
  chosen. A kill arm for either class is what turns these by-name refusals into SOLVED.
- **Solve-time cost.** In node the moving legs go from 0.4–1 s to 4–30 s, mostly DETOUR's 300 previews and the dash
  rescue's scans, now carrying the forecast. If the sweep's budget cuts them, the planner may want a cheaper DETOUR
  certify for corridor bodies.

## What the brief got wrong (measured)

1. *"survey steps 19, 47, 53, 114, 170"*: at `e967758748` step 19 carries no unbilled hit (the lapse flip moved it);
   the base census has 47, 53, 114 and 170.
2. *"sweep legs 262, 265, 283, 302, 696, 698, 703"*: 265's **returned** plan is clean at the base; only its dashless
   candidate is hit. 290 belongs on the list (`wallflyer@64,48` t60 on the returned plan).
3. *"a chaser (`bob@96,144` at 265 t111)"*: not on the base plan of 265. The base's only chaser hit is step 170's
   lavarunner, and its failure is the tick's ordering, not the forecast.
4. *"the six L12 bosslock legs"*: they still refuse in node at `keylock cannot act`, as do L12's 171 and L30's 322 / 328
   (all on the UNBILLED-HIT list). This census, like UNBILLEDGATE's, cannot stage the page's key state.
5. *G2 "On today's plan … the model takes a hit at t70"*: only with every switch OFF (the capture's own setting). At the
   defaults the capture reproduces at 0 px.
6. The base's published identity values: ENEMY and r9-campaign `--check` read `36b59445` / `6b1bf15c` at this base, not
   the `afdc6d1a` / `712f0ead` earlier reports carry.

## Residue

- The placement arm still prices a wallflyer's or drill's `.oel` cell. It is additive and kept, so ON only ever forbids
  more (trap 157's cost on a launched flyer's empty placement).
- The forecast does not carry the player's knockback after a contact (the probe stops at the first danger), the dark
  suit's retaliation into a drill, or a ghost-sword swing (the preview models the sword, as its chaser arm does).
- M6 (the nesting guard) has no row that reaches it once the dash rescue holds. Step 45's recursion is measured in the
  evidence, not pinned.
- `uncertain` on-screen verdicts are priced as danger. No measured route meets one.
- 633, 635 and 773 (UNBILLEDGATE / LAPSECOST model gaps) are untouched.

## Byte-inertia

OFF:
- `run.corridorBodyForecast()` is `null`, so no sample carries `corridorBodies` and no projection carries `contactHitsTimer`.
- Every ladder addition reads the switch first.
- The local survey at head OFF equals the base on all 222 rows, and the identity block at head OFF equals the base on
  every value row.
- The bounded rows at head OFF change status only where the base worktree had artifacts (pass at head) or files that did
  not load there.

## Rows to BANK

- survey OFF 170 SOLVED (= CI 38778265493); ON **169** (−47, −114, +100; 53 → 126 t, 170 → 491 t; 0 unbilled); ON + gate = ON.
- identity OFF = base (ENEMY `36b59445`, campaign `6b1bf15c`, the rest as W0); ON ENEMY `11b47aeb`; ON + gate also c3
  `a6b02e2e`, c6 `40688be9`, c4 `caa8cda2`.
- surface GREEN **297** (`--write`, `run:corridorBodyForecast` classified seedling / forecast); constants PASS **5,894**.
- bounded vitest: 155 files; OFF 5,661 / 5,662 before the reference regeneration (`generated --check`), green after;
  ON 5 named reds; ON + gate the same 5.
- `fidelityCorridorBody.test.js` 8 / 8; mutants M1–M5 caught, M6 blind.
- roster unchanged (no tape added); hammer answers unchanged.

- CI (`JavaScript Unit Tests`) at `e94b863`: run 38820570851, **3 red**, all this slice's own: the log entry landed after
  the reference was regenerated (`generated --check`, two `docsRender` heading rows). Regenerated at `0a492bb`: run
  **38825812541 success**, vitest (unfiltered) **20,415 / 20,415**, slow battery **253 / 253**.

Not run: `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, rebase or force-push.
