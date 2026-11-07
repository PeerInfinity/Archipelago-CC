# Seedling fidelity CEREMONY126 (wave 37b) — the Ghostspear's ceremony: a strike swallowed by its freeze, and the walk it unmasked

Session `seedling-fidelity-ceremony126` (planner `seedling-fidelity-planning-18`, wave 37b; ⚖ the user's GO 2026-11-04).

- **Start SHA:** `26ed405d3f` (= `origin/main`, 110 ON of 122). **Head:** see the final commit of the harness branch
  **`claude/seedling-fidelity-wave-37-zkfeav`** (the brief's `seedling-fidelity-ceremony126` name was not used: the
  harness pushes to its own branch).
- Two new keys, both **OFF** at the end of the defaults (124 keys, 110 ON): `ceremonyPressForecast` (D1),
  `ceremonyWalkHandoff` (D2). Env: `SEEDLING_CEREMONY_PRESS_FORECAST=0|1`, `SEEDLING_CEREMONY_WALK_HANDOFF=0|1` (both in
  `solverEnvChannel.SOLVER_ENV_NAMES`).

| D | Verdict |
|---|---|
| W0 | **DONE.** Reproduced at the base (it is route-survey step **125** here, not 126). Named the stall: it is the ceremony itself. Census below |
| D1 | **PASS** (OFF, byte-identical). The strike stands down where a pickup ceremony would swallow its thrust. Game-witnessed (p4g, 0 px) |
| D2 | **PASS** (OFF, byte-identical). The collect goal's stance walk hands a ceremony it started to the verb. Both keys ON: **step 125 SOLVED 150 t, 0 hits, 0 re-plans**, game-witnessed at 0 px |
| D3 | **READY to flip, with ONE hammer pin family LISTED** (`solveProgress.test.js` ×5, the L40 kill rung, 679 → 675 t, D1's). All other ON reds are env-vs-default artifacts or were mine and fixed |

## 1. W0 — the trace

**Reproduction** (`node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=125`): step 125
`L64 visit 1, collect-placement(Level 064 - Ghostspear) then reach-exit(teleporter@32,96 → L62)` REFUSES with
`FROZEN_TICK_PRESS`: *"a sword press at tick 43 would fire its rect on a FROZEN tick (a pickup ceremony)…"*. The brief's
"step 126" is the L62 visit 2 at this base (237 → 236 rows; ids shifted by one) — match by (level, goal), as the brief says.

**The game** (`vendor/seedling` at the pin):
- `Pickup.update` → `collide("Player", x, y)` → `pick_up()` (`Pickups/Pickup.as:78-83`); a `special` pickup raises
  `Game.freezeObjects = true` in that same update (`Pickup.as:95`). Pickups update from the position the previous tick
  left (`levelRun.pickupUnderfoot`'s docblock), so the touch tick is the ceremony's first frozen frame.
- `Player.update` still runs `slash()` (`Player.as:560-563`); only `Mobile.mobileUpdate`'s friction/input/move is gated
  (`Mobile.as:35-41`). `slash()` runs its tests while `slashing`, and every landing goes through `genericHit`, which
  returns at its first line under the freeze (`Player.as:1075-1078`). ⇒ **a press pending at t43 fires on t44 and hits
  nothing: LOST** (it does not fire after the ceremony: the five tests run on the frozen frames and the animation ends).
  The model's `FROZEN_TICK_PRESS` throw (kept, the game's rule) refuses to author it.

**The stall FROZENPRESS's prototype unmasked** (prototype applied by copy + restore, uncommitted): *"collect (72,24) stance
waypoint 0 (72,24): not reached within 400 ticks; stalled at (72.958,34.784) v=(−0.35,−1.49)"*. Named:
- `ghostspear@72,24`'s rect is [74,86)×[30,34) (`GhostSpear` pickup dims, origin (6,2)); the collect stance is the
  placement (72,24) itself, NORTH of the rect, and the walk comes from the south (boot (32,80)). No static solid anywhere
  in x 56..92, y 18..44 (measured, `collidesSolid` per pixel).
- The box at the stall point (70.96..74.96 × 32.78..37.78) **already overlaps** the rect. Instrumented: the ceremony
  STARTS at t44 at exactly (72.958, 34.784). So the "stall" is the player frozen in the ceremony while `drive` holds
  movement keys toward (72,24) — the dialogue pages only on X releases (`NPC.talk`, `Input.released`), which a walk never
  sends. Velocity is non-zero because a frozen `Mobile` keeps `v`.
- Planner step: the corridor walk's first attempt actually dies on `drive`'s avoid-volume detector (*"the route entered a
  pickup — ghostspear at (72,24)"*, `botDriverV2.js` ~5785) — the goal's own pickup is an avoid volume; the re-plan then
  walks from INSIDE the ceremony and stalls. It is a walker/stance-hand-off defect (the fidelity arc's region by the
  walker exception), not hammer's, not a model gap: the game would let the player through (the ceremony ends, the
  item is taken) — witnessed below.
- With the press present (the OFF arm), the strike's press at t43 is a slash-DASH (within `slashTimerMax` 20 of the t37
  strike press), which is the "coast" FROZENPRESS saw; it throws before the walk can stall.

**Census** (local surveys, 236 steps; sweep: FROZENPRESS measured sweep 12 = 0 rows, unchanged code since):

| arm | rows refused by a ceremony-frozen press | rows stalled on a collect stance walk |
|---|---|---|
| base `26ed405d3f` | 125 | 54 (L49), 183 (L79) |
| head, keys OFF | 125 | 54, 183 |
| head, both ON | — | 54 |

183 (L79 Darksuit) is D2's class; 54 (L49 conch) is NOT (stalls 0.15 px short of the stance (40,72), its box nowhere near
the conch's rect [36,44)×[84,92)) — residue.

## 2. D1 — `ceremonyPressForecast`

**Change.** `levelRun.freezeForecastNow` (a pure read; DIGESTREAD holds — `levelRunDigestRead.test.js` green) also returns
`pickupGap` **only with the key ON**: the least Chebyshev gap from the player's box to a pickup `pickupUnderfoot` would test
(same skips: collected, the Wand's gate, a tree-seed; `pickupUnderfoot(onTouch)` takes an optional visitor, default null =
today's). `strikePolicy.ceremonyGuard(state, freeze, aheadTicks)` refuses within `aheadTicks × oneTickTravelBound`: the
press half (1), a scheduled press (1), an aim (2) — dropped like the talk guard (`owed` untouched),
`CEREMONY_PRESS_COUNTS`. It rides FROZENPRESS's `strikeDecideOpts` (needs `frozenPressForecast`, ON). The preview
(`previewWalk`) gets no forecast, as FROZENPRESS's.

⚠ **The bound is conservative, not exact** (it can stand down where the next tick would not touch). That is what moves
the D1-only tick rows below (141 −8, 221 +27, 236 +1, all 0 hits) and hammer's L40 kill-rung pin. An exact one-tick
forecast (step the press tick's held set and test the overlap) is the refinement if the planner wants those rows still.

**Witness** (`scripts/procgen/probe-seedling-ceremony126.mjs --record`, p4g headless, port 9773; fixtures
`fixtures/ceremony126-witness/`): `ceremony126-lost` = the solved tape without the strike's t37 press (so the next press
is a plain swing, not a dash) plus `primary` on input 43, whose thrust fires on input 44 = the ceremony's first frozen
frame. The model refuses to author it (`FROZEN_TICK_PRESS`); **the game equals the model of the tape WITHOUT it, 151/151
ticks at 0 px** (level, position from the bot's own `botDrain` observations, hits, frozen timer), finishing in L62. ⚠ What
this witnesses is "the press changes nothing observable"; L64 has no hittable body in reach, so it cannot show a hit
being swallowed — the AS3 lines above are the argument for that part.

**Test** `fidelityCeremony126.test.js` (11): the switches (OFF, last two, env names), `ceremonyGuard`'s arithmetic, the
policy's drop and recovery, OFF shape (`pickupGap` absent) vs ON (0.27 px at obs 43), the model's spans, both game
witnesses vs the model. **Mutants** (predicted, then copy + restore): see § 6.

## 3. D2 — `ceremonyWalkHandoff`

**Change.** `drive` takes `endOnCeremony` (`{x,y}` of the goal's own pickup, default null): it lets that pickup's avoid
volume through (the detector still refuses any OTHER pickup) and returns, like an arrival, once `inCeremony` is up.
`walkTo` takes `ceremonyEnds` and passes it to every waypoint's drive; only the collect goal's stance walk asks it (key
ON, `resolved.strategy === 'collect'`). `execCollect` → `runCollect` then finds `inCeremony` up (its approach loop already
exits on it) and pages the dialogue with `ceremonyCadenceStep`. A textless ceremony (one advance) is unchanged:
`collectedInPassing` already handled it.

**Step 125, four arms** (local, `--only=125`): OFF·OFF `FROZEN_TICK_PRESS` t43; D1 only: the stall; D2 only:
`FROZEN_TICK_PRESS`; **both: SOLVED 150 t, 3 decisions, 0 re-plans, 0 hits** (a first cut without the avoid-volume
exemption solved with 1 re-plan). Ceremony obs 45..73, `collected` `{t74, L64, spear}`, exit to L62 at t150.

**Witness** `ceremony126-solved`: the solver's tape (`fixtures/ceremony126-witness/step125-solved-tape.json`) on p4g =
the model, **151/151 ticks at 0 px**, finishing in L62. ⚠ Found on the way: the probe's first cut read position from the
live `botStatus` poll, which saw t74 (the first live tick after the ceremony) while the game's post-ceremony dead frames
were still running and read the frozen position (1 tick off, t75+ agreed). The probe reads the bot's own per-tick
observations (`botDrain`, `Bot.as:3234`) instead — a trap candidate.

## 4. Movers (measured locally) — the survey rows this moves

Local full surveys (`survey-seedling-route.mjs --through=end --route=full`, 236 steps): **base 202 SOLVED / 34 REFUSED;
head OFF 202 / 34, identical to the base on EVERY row** (verdict, ticks, refusal text, re-plans, trace rows); **head both
ON 204 / 32.**

| step | room / goal | OFF (= base) | D1 only | D2 only | both ON |
|---|---|---|---|---|---|
| 125 | L64 Ghostspear (+exit L62) | REFUSED `FROZEN_TICK_PRESS` t43 | REFUSED (the stance stall) | REFUSED `FROZEN_TICK_PRESS` | **SOLVED 150 t, 0 hits** |
| 183 | L79 Darksuit (+exit L78) | REFUSED (collect stance stall at (54.40,152.37)) | REFUSED | SOLVED 97 t | **SOLVED 102 t, 0 hits** |
| 141 | L67 | SOLVED 957 | 949 | 957 | 949 |
| 221 | L106 | SOLVED 185 | 212 | 185 | 212 |
| 236 | L115 The Seed | SOLVED 173 | 174 | 173 | 174 |

All ON rows 0 hits. **CI dispatches for the planner** (branch `claude/seedling-fidelity-wave-37-zkfeav`):
- Survey A/B: `seedling-survey.yml` full route at the branch, once at the defaults and once with
  `SEEDLING_CEREMONY_PRESS_FORECAST=1 SEEDLING_CEREMONY_WALK_HANDOFF=1` (or `only=125,141,183,221,236` for the movers).
- Full sweep ×2 per arm: `seedling-divergence-sweep.yml`, `contact_fidelity` = the 110 default-ON keys (OFF arm) and the
  110 + `ceremonyPressForecast|ceremonyWalkHandoff` (ON arm). Keyed, with `capture_requests`: `keys=level_64 <-
  in_L62_112_64 -> location:Level 064 - Ghostspear|level_64 <- in_L62_112_64 -> exit:out_teleporter_32_96|level_79__r8c4 <-
  in_L78_32_0 -> location:Level 079 - Darksuit|level_79__r8c4 <- in_L78_32_0 -> exit:out_teleporter_64_224` (keys derived at
  this base, `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, 930 legs).
- Probes: `seedling-probe.yml battery=standard` at the branch, both arms.

## 5. D3 — flip readiness (keys ON = both env vars)

| gate | OFF (head) | ON |
|---|---|---|
| bounded fast vitest, 152 files (the brief's list + every `grep -a` hit for freezeForecast / pickupGap / freezeObjects / ceremony / FROZEN_TICK_PRESS / dashShape / dashOnlyWindow / jsRuntimeSolverShouldStop / endOnCeremony / strikeDecideOpts / collectStandWalk / avoidVolumesAt / pickupUnderfoot) | 150/152 files; the 2 reds were MINE (a parse error in my FROZENPRESS title edit; the new probe missing from `boxLock.test.js`'s guarded-takers list) — both fixed and green in `c7d107a4` | 146/152 files. Reds: the same 2 (fixed); `contactFidelity` defaults row, `dashShape` + `dashOnlyWindow` "the default adds no field" ×3 — env-vs-default artifacts (off-default keys stamp `contactFidelity` into the request; a real default flip re-pins the defaults row and stamps nothing); **`solveProgress.test.js` ×5 — HAMMER's** |
| slow / train tier (`fidelityL32ArenaPrefix`, `hammerEscapeExact`, `jsRuntimeSolverCalibration` slow; `fidelityL40Bk2` **train**) | slow 3/3 files (12 tests), train 1/1 | **slow 3/3 (12), train 1/1** — hammer's 860 pins and the L40 window-84/85 rows unmoved |
| six producer `--check`s | battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · campaign `be9c19c8`, all exit 0 (= the published base values) | **identical**, all exit 0 |
| acceptance batch md5 | `abb206c88de25e7ba1874510d493ce85` (= the brief's main value) | **identical** |
| `jsRuntimeSolverShouldStop` / `dashOnlyWindow` / `dashShape` (L4's 1-unit margin) | green | green except the env-stamp rows above — the L4 window rows did not move |
| `seedlingDerivedRuleTable.js --print-engine-closure` ∩ diff | ∅ (the closure has 42 files, none in seedlingDemo) | — |
| `generate-procgen-reference --check` | regenerated for the new probe; ALL 7 MODULES AND 5 REGIONS MATCH | — |
| solver surface / constants census | `census-seedling-solver-surface --write` (371 rows; the `freezeForecast` progress fold and the new sites) and `census-seedling-constants --write` (7063 rows; line shifts + the new literals in my files only); both `--check` GREEN/PASS, their tests 60/60 | — |
| `check-procgen-help.mjs` / `check-procgen-docs.mjs` | ALL PASS (525 instruments) / ALL CHECKS PASSED | — |

**Hammer pins LISTED for hammer-3 (not re-pinned):** `solveProgress.test.js` — PR *"L40 kill rung (the totem part at
(160,640)): the answer, shouldStop and the asks are W0's…"*, RK ×2, TC2 ×2. D1 alone moves them, D2 alone none: the L40
kill rung's solve goes **679 → 675 ticks** (still solved) — the strike stands down near `totempart@160,640` (the
conservative bound, § 2), and the W0 byte/ask counts move with it.

**Not run:** `ci-producer-checks.mjs --jobs=3` (time; the six producers above were run directly, both arms) and the full
identity block (my baseline run was stopped at its 30-min background limit after maze `57e07d21`, acceptance `abb206c8`,
c3 `d356fc8a`, c6 `483c791e`; it competed with a survey for 4 cores). The planner should run both at the head.

## 6. Mutants (predicted, copy + restore; in a scratch worktree at the head)

| mutant | predicted | measured |
|---|---|---|
| M1 `ceremonyGuard` always `null` | 2 red (the guard row, the drop row) | 2 red ✓ |
| M2 `pickupGap` returned with the key OFF | 1 red (the OFF shape row) | 1 red ✓ |
| M3 `drive` never ends on `endOnCeremony` | unit file green (no D2 unit row); step 125 back to the stance stall | 11/11 green; step 125 REFUSED *"collect (72,24) stance … not reached within 400 ticks"* ✓ |

⚠ D2 has no vitest row of its own: its guards are the survey row (M3) and the `ceremony126-solved` game witness. A
solve-level row (stage step 125, assert SOLVED 150 t) is the cheap addition if the planner wants one in CI.

## 7. Boundaries, hand-overs, JS arc

- **JS arc:** no contract change. `drive` (the walker exception) takes one optional option; `walkTo` one optional option;
  `freezeForecast` gains an optional field only with D1 ON. Sweep rows to read with ON: `producer:walker` rows in L64 and
  L79 (the keyed dispatch above). Nothing for the JS arc to wire.
- **Hammer:** the `solveProgress` pins above. No hammer-owned code touched (`execKillByPress`, chooser, escapes,
  `planWaypoints`, `stateDigest` untouched). No new per-visit run map (`pickupGap` is computed on read).
- Not touched: the three `FROZEN_TICK_PRESS` throws, `REFUSAL_BY_NAME`, `runChest`, any AS3/wasm/gitlink/rules, any
  committed tape or producer digest.

## 8. Late measurements

- Slow/train tier, both arms: § 5 (green).
- CI `JavaScript Unit Tests` at the last pushed head: § 12.

## 9. What the brief got wrong (measured)

- "step 126" is **step 125** at `26ed405d3f` (126 is L62 visit 2).
- "the walk stall it unmasks" is not a walk-geometry defect: at the stall point the pickup is already touched and the
  ceremony is up (t44); the walk's arrival test never sees a frozen player arrive.
- "110 ON of 122" holds at the base; with this slice 124 keys, 110 ON.

## 10. Residue

- **Step 54 (L49 conch)**: a collect-stance stall of a different class (0.15 px short of (40,72), pushing up at
  v −1.52, the box ~10 px from the conch). Not this slice.
- D1's bound is conservative (§ 2); an exact one-tick overlap forecast would likely retire the 141/221/236 tick moves and
  the hammer pin move.
- The `ceremony126-lost` witness cannot show a hit being swallowed (no body in reach in L64).

## 11. Rows to BANK

- survey step 125 L64: OFF REFUSED `FROZEN_TICK_PRESS` → ON SOLVED 150 t 0 hits (game-witnessed 0 px).
- survey step 183 L79: OFF REFUSED (collect stance stall) → ON SOLVED 102 t 0 hits.
- head OFF survey = base survey on all 236 rows.
- acceptance md5 `abb206c88de25e7ba1874510d493ce85` both arms; six producers identical both arms.

## 12. CI (`JavaScript Unit Tests`)

- At `c7d107a4` (run `41963131241`): shard 2/3 and the slow battery (372/372) green; **3 reds, all mine and records-only**:
  `seedlingSolverSurface.test.js` (i) + (vii) and `seedlingConstantsCensus.test.js` (b) — the surface contract and the
  constants census had not been re-written for the new code. Fixed by the `--write`s above (local tests 60/60) in the
  records commit; read CI again at the final head (the chat message quotes it).
- Train tier not run by a slice push: `fidelityL40Bk2.train.test.js` was run locally, both arms, green (§ 5).
