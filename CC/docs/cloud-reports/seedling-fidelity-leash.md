# Seedling fidelity LEASH: the walker's crossing took a hit, and the bait waited for a body pinned on a wall

| | |
|---|---|
| Session | `seedling-fidelity-leash` (wave 12, model coverage; planner `seedling-fidelity-planning-6`) |
| Start SHA | **`dd6ae2e379`** (`dd6ae2e3797b6ee0a6372318d9cae5116515f25e`), the brief's base, not rebased |
| Harness branch | `claude/seedling-chaser-leash-pez4mp` (the harness branch IS the slice branch) |
| Commits | D1 `1ce0310` · D2 `524d8b5` · D3 records `bd7556b` · this report (the head) |
| Dev server | `serve-nocache.py 9632` |
| Verdicts | **W0 PASS · D1 PASS (the brief's premise for 622 is refuted on the game) · D2 PASS for 629, behind `CONTACT_FIDELITY.baitForecast` (OFF); 622/624/772 get no pricing change, with the measured reason · D3 PASS** |

## The one thing to know first

**Leg 622 is not a pricing gap: on the game, the walker's crossing is hit.**
- From the L73 arrival, `lavarunner@72,24` is diagonally adjacent. It starts moving at t2, and the game bills the player's hit at t2 (`hits` 0 → 1). This was recorded with the probe's new `--player-hits`.
- The walker "crosses" because the walker does not price damage.
- Every two-tick prefix of moves, sword and secondary item takes that hit: 441 sequences at depth 2, and 462 measured at depth 3.
- No hitless crossing exists, so the solver's refusal is the game's.
- Solving 622 needs a ruling that the solver may take a hit when every input sequence takes one (a question for the user).

**The leg this slice fixes is 629** (L74's Darkshield, arriving from L75).
- The bait stance's lavarunner pins on a wall corner and never leaves the world (game witness).
- With `baitForecast` ON, the derivation refuses that stance and the leg solves.
- On the page it is **done in 278 t** (bait, kill, walk) with no divergence.
- In node it solves in 307 t, and that plan is bit-exact on the game.

## W0 (at `dd6ae2e379`)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | **quoted** (⚖ ruling 32 A): the head equals `standing-values.json`'s `measuredAt` `ea71810f9a` plus two bank-only commits (ENEMY `afdc6d1a`, r9-campaign `712f0ead`) | maze `246dfbce`*, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated `OK` |
| six `--check`s | quoted | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead` |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json`; md5 over sorted `status\tfullName` | **605** pairs, all pass, **`70c1a2d1baa27a2df4102e381914b303`** |
| bounded vitest BEFORE | 56 files (the list below) | **1,702 / 1,702**. The first run was 1,701 + 1 red `boxLock`, caused by my untracked scratch probe in `scripts/procgen/` (a box taker). With it moved out of the tree, `boxLock.test.js` is 26/26 at the base. |
| surface / constants | `seedlingSolverSurface.test.js` / `census-seedling-constants --check` | green / PASS 5,623 literals |
| roster | `fixtures/tapes/index.json` | 274 (unchanged; no roster tape added) |

\* **The bank's maze row is stale, and the move is not mine.** This container gives `57e07d213c90523b1b38d792c55a6a15` at my head and also in a pristine worktree at `dd6ae2e379`. The dump reads the `shared` submodule, which was bumped to `e662040` (`33d8606`) after the row's `measuredAt` (`b3407678`).

**The bounded set**, 56 files, plus `fidelityLeash` after D1:
- the brief's list;
- every `rg -a` hit for what I touch (`deriveBaitStance`, `runDwell`, bait, `BAIT_SLACK`, the contact switches): `arrowTrap`, `crusher`, `fidelityCrusher`, `fidelityFrontier3`, `fidelityL14`, `jsRuntimeSolveService`, `jsRuntimeSolver`, `procgenNestedOpeners`, `procgenSeedlingElementsCertify`, `procgenWeigh`, `r8Acceptance`, `solverBot`, `solverPrefix`, `arrivalCompositesLegs`;
- `fidelityLavaRunner`, `fidelityBulb`, `fidelityBulbPlacement`, `killLockBodiesHook`, `contactFidelityHook`, `fidelityEncounters2`;
- the JS arc's pins: `jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, `jsRuntimeWalker`, `wasmArrival`, `jsRuntimeDeclarations` (read-only);
- the surface and constants tests.

The file list is in `…-evidence/vitest-summaries.txt`'s run, and the scratch list is `/tmp`-only.

## D1: measured on the game (PASS); the brief's premise was the thing refuted

All game runs below are p4f, headless logic-only, port 9632, using `probe-seedling-chaser-mobiles.mjs`.

**The leash and the trigger are the game's.**
- The game's leash is `Bob.runRange` 80 (LavaRunner extends Bob) and `Jellyfish.runRange` 160. The chase is unconditional on line of sight. The census carries the same values as `ENEMY_CLASSES[tag].aggro.range`.
- Standing at the L73 arrival, the model's lavarunner is the game's at 0 px: 116 comparisons. The chase begins at t1 and the body first moves at t2, on both sides.

**622 (L73 → L74, `lavarunner@72,24`).**

| what was played | the game's player hits | lavarunner rows |
|---|---|---|
| the walker's crossing: `up` 4 ticks into teleporter@64,0 | **0 → 1 at t2** (hits_timer 19), knocked toward the teleporter, then L74 at t4 | 0 px |
| the solver's corridor prefix (`right`, then `primary`: the opportunistic strike turns to face the body and swings, stepping 0.8 px into it) | 0 → 1 at t2 | 0 px |
| standing still | the shield bump kicks the body, and the player is still pushed into the teleporter | 0 px (116) |

- The committed witness is **`leash-l73-622-up-lavarunner`**: 4 samples, the player plus the body, with the game's `hits` per sample.
- The model bills the same hit (`playerHits[0]` is t2 from `lavarunner@72,24`).
- An exhaustive search from the arrival found no hitless crossing:
  - every two-tick prefix over 21 held sets (the 8 directions + none, ×sword, ×secondary) takes the hit by t2: 441 sequences, pinned in `fidelityLeash`;
  - depth 3 with the page's exact staging (slots `[0,1,3,2]`, `hitsMax` 3) gives the same result: 462 sequences, 0 hitless.
- The body's centre (80,32) is 8 px right of and 8 px below the player's (72,24). It moves (−0.88, −0.88) at t2. The player's first tick moves at most 0.8 px on either axis, so the 4×5 box cannot clear the 12×12 box.

**624 (L74 → L75 from L73, `lavarunner@208,96`).**
- The solver's own refused corridor, played on the game: the player reaches (232.2, 119.6) at t86 and **the game bills the hit at t87**, exactly where the forecast priced it. The lavarunner agrees at 0 px over 194 comparisons. Evidence: `game-l74-624-corridor-player.json` and the tape.
- The body's centre (216,104) sits on tile (13,6), part of the room's one-tile path.
- The transit pricing is exact. The ladder's choice is what blocks the leg: see "For the hammer arc".
- The player's t2 Δy −1.35 in that replay is the known L74 arrival-frame residue (the button / fallrock contact capture, leg 626's divergence). The walk reconverges.

**772 (L104 → L103, `jellyfish@72,40`).**
- At this base the page **SOLVES** it: the `dashless` pass, 366 t, 182 of 640 work units, no divergence, so the game played the plan.
- My node driver refuses it, with or without the budget. The page's staging (persistence, save) is not my scratch driver's. I did not chase that difference.
- The brief's refusal came from sweep-4 at `70b01d7666`. Between that SHA and this base came the rules arc's L37 delivery change, C1-ON and the contact hook.

**629 (L74 → the Darkshield, from L75).**
- The page refusal reproduces in node, word for word apart from the solver's name prefix.
- The solve's first bait works: the Bulb drowns in the lava at t~74–82.
- The second bait, for `lavarunner@24,56`, is the player's own arrival cell (24,136), with an 84-tick bound (`ceil(63 / 1.5) + fade + 30`).
- On the game, standing at (24,136), the lavarunner chases and **pins on the wall corner of tile (2,5) at (30.906↔31.362, 73.062) from t10 through t160**. That is 322 comparisons, worst |Δ| 0, with the player unhit. Witness **`leash-l74-629-pin-lavarunner`**.
- So the bound is not the short term: the body never comes. And the region the straight line crosses is lava, which does not kill a lavarunner (`LavaRunner.dieInLava = false`). `bodyKillRegions` is class-blind.

**629: the input that separates the page from BULB's node solve is `hasDarkSword`.**
- Survey step 162's staging (`r8-solve-11`'s block) holds the Dark Sword (Progressive Sword ×2, survey step 142).
- The page's leg at sphere 7.3 holds the plain sword.
- The page's staging plus `hasDarkSword` SOLVES in 241 t; without it, it refuses. Pinned in `fidelityLeash`.

## D2: the bait is verified on the chaser forecast (PASS for 629; `CONTACT_FIDELITY.baitForecast`, OFF)

**Where it lives.**
- `contactFidelity.js` gains the key `baitForecast: false` (a union-friendly row), and `solverBot.BAIT_FORECAST.enabled` reads it.
- So the page, its solve worker and the sweep's `contact_fidelity=` set it with no JS-arc wiring. The CONTACT hook is generic over `CONTACT_FIDELITY_KEYS`, and `contactFidelityHook` is green with the new key.
- In node: `SEEDLING_BAIT_FORECAST=1` (or the comma list), or `withBaitForecast` in a test.

**What it changes (`solverBot.deriveBaitStance`, my region).**
- Each candidate that plans a corridor is previewed on one chaser forecast:
  - `previewWalk`'s standing tail, stood as `runDwell` stands a bait: no keys, the strike disarmed;
  - the ceiling is 2 × the straight line's bound;
  - at most 32 previews.
- A stance is offered only where the body leaves the world. The dwell's bound is then the forecast's removal past the arrival, plus `BAIT_SLACK`.
- Rejected by name:
  - a body still in the world at the ceiling (the pin);
  - a removal by the arrival (the dwell would have nothing to wait for);
  - a dangerous wait;
  - a walk the model refuses to price.
- **The chaser forecast has no terrain switch.** `levelRun.chaserForecastNow` steps only `chaserStep`; the run's `stepChasersNow` drowns bodies separately.
  - The first cut therefore refused the Bulb's own lava bait. It solved 629 only by a 228-tick detour.
  - So `baitForecastOf` reads the terrain death off the forecast's positions:
    - `terrainKillsTag` checks the tile under the body's centre against `ENEMY_CLASSES[tag].terrain` (lavarunner `{water: dies, lava: survives, pit: falls}`; jellyfish survives all three);
    - the fade (`MOBILE_DEATH_FADE`, the line's own term) starts there;
    - the corpse is dropped from the wait's danger question.
  - The forecast itself is unchanged.
- `deriveBaitStance` and `terrainKillsTag` are now exported (for the test). The call site passes the ladder's `{allowTeleporter, tolerance, dashMode}`.

**Result.**
- 629 OFF refuses on the 84-tick dwell.
- 629 ON SOLVES 307 t (node): bait the Bulb into the lava, collect, kill the pinned lavarunner (the chaser arm), walk. It takes 1.4 s, against 0.5 s for the refusal.
- **Played on the game** (fixture `leash-l74-629-on-plan-game`):
  - the player matches at all 307 ticks, 0 hits;
  - 548 LavaRunner and 82 Bulb comparisons at 0 px;
  - the game ends with `hasDarkShield` true and L74 tag 0 cleared.
  - The probe's own calibration line FAILs on the known first-sample straddle at the pickup ceremony (BULB residue 4). The fixture keeps every sample per tick, and the test accepts a tick when any sample agrees.
- **On the page** (the sweep with `--contact-fidelity=<the ON defaults>,baitForecast`): **done, 278 t**, bait + kill + walk. No divergence, the end equals the expected end, 0 deaths, 128 of 640 work units.

**Mutants** (predicted first, made by copy + edit + restore; `cmp` restored, `grep -c MUTANT` = 0).

| mutant | predicted | measured |
|---|---|---|
| M1: a pinned body is accepted (`removedAt: bound`) | the derivation-ON row and the 629-ON row red | exactly those 2 red |
| M2: `terrainKillsTag` ignores the class flags | green (the pinned lavarunner sits on ground; no row asked the class gate) | green, and so a unit row was added: lavarunner `[water, lava, pit]` = `[true, false, true]`, jellyfish all false, bob all true |
| M3: no terrain read (forecast removals only) | the 629-ON row red (back to the 228 t collect + detour) | exactly that row red |

## D3: witnesses and census (PASS)

**Game witnesses (0 px).**
- `leash-l73-622-up-lavarunner`: 622's walker crossing, hit at t2.
- `leash-l74-629-pin-lavarunner`: 629's bait stance, the pin.
- `leash-l74-629-on-plan-game`: 629's ON plan, played.
- All three are replayed by `fidelityLeash.test.js` (11 rows). They are not roster tapes.

**Legs, before → after** (the page, this base; `inv` mode, one leg per page, the p4f AP build):

| leg | key | base (defaults) | `baitForecast` ON | why |
|---|---|---|---|---|
| 622 | `level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0` | refused: ladder EXHAUSTED, `lavarunner@72,24`, nested under `bait (lavarunner@72,24) stance` | refused: ladder EXHAUSTED, the same danger, no longer nested under a bait (the bait is refused up front) | forced hit (D1) |
| 624 | `level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144` | refused: `lavarunner@208,96` (d 9.3) | unchanged | the corridor is hit on the game; the ladder targets the Bulb |
| 626 | `level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield` | timeout: diverged at t=2, Δy −1.35 (the arrival frame) | unchanged | the L74 arrival-frame residue (JS arc's) |
| 628 | `level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144` | refused: skirt stance waypoint 2 stalls at (24, 109.75) | unchanged | not reached by this switch (the node run ON first moved to a kill-rung hit, then back once the terrain read landed) |
| **629** | `level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield` | refused: the 84-tick bait dwell | **done, 278 t** | D2 |
| 772 | `level_104 <- in_L105_224_64 -> exit:out_teleporter_144_128` | **done, 366 t** (dashless) | unchanged | already solved at this base |

**Survey steps on L73/L74/L104** (CI 38107331670 has two: **162** L74 Darkshield → L75, **207** L104 → L105).

| step | CI 38107331670 | local OFF | local ON |
|---|---|---|---|
| 162 | SOLVED 321 | SOLVED 321 | SOLVED 321 |
| 207 | SOLVED 268 | SOLVED 268 | SOLVED 268 |

## Byte-inertia (OFF, the shipped default) and the ON mover list

| row | OFF (shipped) | ON (`SEEDLING_BAIT_FORECAST=1`) |
|---|---|---|
| tapeRunner | 605, `70c1a2d1…` (= base) | 605, **`70c1a2d1…`** |
| identity block (head; `…-evidence/identity-head-*.txt`) | every row = the bank; the maze row's `57e07d21` is the base's in this container (above); reference: 4 DIFFER, the container's substrate rows | **identical to OFF on every row**, the six producer `--check`s included (`405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0) |
| bounded vitest (57 files) | **1,713 / 1,713** | 1,707 + **6 red** (below) |
| surface census | GREEN after `--write` (site counts only; plus levelRun line numbers that were already stale at the base, which the test ignores) | — |
| constants census | PASS 5,623, 0 drift | — |

**The ON reds, as a licence list:**
1. `contactFidelity` "the shipped defaults": `baitForecast: false` pinned. This is the flip's own re-pin.
2. Three rows of `fidelityLeash`'s own OFF assertions ("ships OFF", the derivation's OFF half, the 629 OFF half). These are re-pins at a flip.
3. `arrivalCompositesLegs` "residue L45": the refusal no longer goes through `bait (jellyfish@224,176) stance -> burn`. A jellyfish survives every terrain (`water/lava: survives, pit: refuses`), so ON refuses its terrain bait. It is still a refusal; the wording moves.
4. `solverDeadline` "`time` in a solve: bare L6 from (208,32)": ON, the bait stance for `bob@112,48` is (120,24), where OFF used (136,24). The nested climb's aim is 51 px away, so the TIME rung's search (the site that test trips) is not reached. Still `BAIT_REENTRY`, still a refusal; the test's premise moves.

No committed tape, producer digest or identity row moves.

## CI dispatches for the planner (I cannot dispatch)

1. **The sweep, ON, no code edit:** `seedling-divergence-sweep.yml`
   - ref `claude/seedling-chaser-leash-pez4mp`;
   - `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast`;
   - `ids=622,624,626,628,629,772` (sweep-4 numbering = this leg list's; keys above).
   - Expect **629 done** and the rest as the table.
   - For the whole-sweep mover list, the same `contact_fidelity` with no `ids`, against the default run.
2. **The sweep at the defaults (inertia):** the same workflow and ref, `contact_fidelity` empty, the same `ids`. Expect = the base column (772 done 366, the rest as sweep-4).
3. **The survey, OFF inertia:** `seedling-survey.yml`
   - ref `claude/seedling-chaser-leash-pez4mp`, `through=end`, `route=full`;
   - `only=162,207`, `base_run=38107331670`;
   - expect both = 38107331670.
   - The survey takes no switch input. The ON half was measured locally (identical), so it is optional on CI.
4. **The witnesses on CI** (if wanted): `seedling-probe.yml`
   - `probes=probe-seedling-chaser-mobiles.mjs`;
   - `args=--class=LavaRunner --player-hits --witness=leash-l73-622-up-lavarunner` (and `--witness=leash-l74-629-pin-lavarunner`);
   - expect PASS, worst 0.

## For the JS arc

- **No JS-arc file was edited.** `jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js` and the worker are only imported, by the test. No contract moved: `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched.
- **New:**
  - the `CONTACT_FIDELITY` key **`baitForecast`**, which the hook already carries (setting `seedlingContactBaitForecast`, `?contactFidelity=…,baitForecast`);
  - the solver exports `deriveBaitStance`, `terrainKillsTag`, `BAIT_FORECAST`, `withBaitForecast`;
  - the derivation's result may carry `forecast` / `forecastRejected` (an optional field);
  - the probe flag `--player-hits`.
- **Nothing to wire.** No new `SolverRefusal.obstacle.kind`.
- **Pins:** the JS arc's pins in the bounded set are green both ways. CANCROSS's `solverStamp` moves (`solverBot.js` and `contactFidelity.js` changed), so derived rules read STALE until re-derived.

## For the hammer arc (hand-over, not done)

**624's ladder hands the kill rung `bulb@48,112`, while the corridor's hit is `lavarunner@208,96`.**
- The source is `chooseBodyToRemove` (the hammer arc's since C1), measured on the page refusal and in node.
- `CHOOSER_HIT_SOURCES` is ON but not in `mode: 'order'`, so the hit's sources are prepended only when the chooser's list is empty.
- The lavarunner sits on the room's one-tile path at tile (13,6). It is a sword kill (`hitsMax` 2, `KILL_ARM_POLICY` modelled under K2).
- The leg needs the chaser arm aimed at the lavarunner. That is a chooser policy question, in the hammer arc's region.
- Measurement: the solver's corridor on the game (`…-evidence/tape-l74-624-corridor.json`, `game-l74-624-corridor-player.json`) is hit at t87.

## What the brief got wrong (measured)

1. *"the walker CROSSES it: a PROVEN gap; the model's live-lavarunner pricing is more conservative than the game"*: the walker's crossing is hit at t2 on the game, and no hitless crossing exists. The gap is the walker's (it does not price damage), not the model's.
2. *"fix … (the leash/trigger the game actually uses)"*: the leash (80 / 160) and the trigger (the chase from t1, the move from t2) are the game's at 0 px. No leash or trigger term over-forbids on these legs.
3. *"the bait dwell's bound (the derived 84 t vs the game's actual time to leave the world)"*: the game's time is never. The body pins on a wall, and lava would not kill it anyway. The fix is refusing the stance, not lengthening the bound; the bound becomes the forecast's removal where one exists.
4. *"L104 leg 772 … refused against `chaser:jellyfish@72,40`"*: at this base the page solves it (366 t, played).
5. *"BULB's own node run … SOLVED this leg → either K2/bait interplay, or the node survey's staging differs"*: it is the staging, and the one input is `hasDarkSword` (survey 162 holds the Dark Sword; the page's leg the plain one).
6. The brief's survey framing ("any survey step on L73/L74/L104"): CI 38107331670 has exactly two (162, 207), and neither moves.
7. The bank's `maze byte-identity` (`246dfbce`) is stale at this base (`57e07d21` at the pristine base, after the `shared` bump `33d8606`).

## Residue (ranked)

1. **622 needs a damage ruling.** No hitless crossing exists from the L73 arrival. The solver's standard (no hits) refuses it, honestly. A "take the one unavoidable hit" policy is the user's call.
2. **The chaser forecast drowns nobody.** `chaserForecastNow` has no terrain switch. The bait now reads terrain deaths off the forecast's positions, but every other forecast consumer (detour previews, kill arms, the danger probe) still sees a body walk across lava or water it would die in. A forecast-side terrain switch would be a model change behind its own flag.
3. **The TIME rung's WAIT bound has no one-tick lag.** `chaserDanger` grows a live body by `speed × horizon` from plan time. On 622 every tick-1 state was forbidden, though a body standing still cannot move on its first tick (`friction(v₀)` then move). The bound is also a square, not a disc. With the lag, 622 still has no path (above), so this was named, not changed.
4. **The opportunistic strike walks into the body it aims at.** On 622 the corridor's first two keys are `right` (to face) and `primary`, which put the player into contact at t2. The game agrees: it is hit. On this leg it changes nothing, since every path is hit, but the strike policy does not price its own turn.
5. **628's stall at (24, 109.75)** (v (−0.31, 1.90) while aiming up) is unexplained here; 0 blocks.
6. **626's t=2 Δy −1.35** is the L74 arrival frame (JS arc / contact capture), as BULB found.
7. **`bodyKillRegions` stays class-blind**; only the bait reads the class, through `terrainKillsTag`. No other consumer exists today.
8. **The probe's calibration straddle at a pickup ceremony** (BULB residue 4) is still the committed rule. The 629 ON fixture carries every sample per tick instead.

## Deltas

**New:**
- `fidelityLeash.test.js` (11 rows);
- fixtures `chaser-witness/leash-l73-622-up-lavarunner.json`, `leash-l74-629-pin-lavarunner.json`, `leash-l74-629-on-plan-game.json`;
- the evidence directory `CC/docs/cloud-reports/seedling-fidelity-leash-evidence/`.

**Changed:**
- `solverBot.js`: `BAIT_FORECAST`, `withBaitForecast`, `terrainKillsTag`, `baitForecastOf`, `deriveBaitStance`'s forecast arm and its call site's parameters;
- `contactFidelity.js`: the `baitForecast` key and `SEEDLING_BAIT_FORECAST`;
- `contactFidelity.test.js`: the defaults pin, + `baitForecast: false`;
- `probe-seedling-chaser-mobiles.mjs`: `--player-hits`;
- `seedling-solver-surface.json`: `--write`.

**Records:**
- `seedling-bot-log.md`: the LEASH entry and four trap candidates;
- `seedling-bot.md`: the bait-forecast paragraph;
- the reference: the docs index, and the instruments index for `--player-hits`;
- `check-procgen-docs`: ALL PASS;
- `check-procgen-help --only=probe-seedling-chaser-mobiles.mjs`: ALL PASS;
- `boxLock`: no new box-taking instrument;
- roster: unchanged at 274.

## CI (`JavaScript Unit Tests`)

Read at the last head: see the chat message. Earlier pushes' runs are cancelled by design.

## Rows to BANK

- tapeRunner **605** pairs, `70c1a2d1baa27a2df4102e381914b303` (base = head, OFF = ON).
- The identity block at the head = the bank, except maze **`57e07d213c90523b1b38d792c55a6a15`**, which re-banks independent of this slice (the `shared` bump).
- Bounded vitest 1,713 / 1,713 (57 files).
- Constants 5,623 PASS; surface GREEN (265 rows).
- `CONTACT_FIDELITY.baitForecast` (OFF).
- Witnesses `leash-l73-622-up-lavarunner`, `leash-l74-629-pin-lavarunner`, `leash-l74-629-on-plan-game`.
- Licence question for the user:
  - **flip `baitForecast`**: 629 done on the page; movers are the 4 pins plus the L45 / L6 wording rows above;
  - separately, **a damage budget for unavoidable hits** (622).
