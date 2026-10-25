# Seedling fidelity SHAKEEXACT — a split run's camera shake stepped exactly; the band stays where the model cannot know it

Wave 31, planner `seedling-fidelity-planning-13`. The ruling (⚖ user, 2026-10-25, "Exact for split"): *"Should the model
compute the shake jiggle exactly for split runs, keeping the band only for split-off tapes and the fade-length / reboot
cases?"* → **"Exact for split"**.

| | |
|---|---|
| Start | `fidelity-harvest/w30` **`89da08f355`** (main `cfc681a566` + W30 flipped ON; 77 default-ON keys) |
| Head | the commit carrying this report (before it: D1 `46bbf68b`, D2 `a9d3fe9f` + boxLock roster `d466f1a6`, censuses `4cf87fa8`, records `57a4791a` + `8e2ec3d3`) |
| Harness branch | `claude/seedling-shakeexact-camera-1kc500` (local name `seedling-fidelity-shakeexact`) |
| New key | **`shakeExactSplit`, OFF** (`SEEDLING_SHAKE_EXACT_SPLIT=0\|1`) |
| Verdicts | W0 PASS · D1 PASS · D2 PASS · D3 PASS (dormant on split runs) · movers: STOP with the list (licence question below) |

Evidence: `seedling-fidelity-shakeexact-evidence/`.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B seedling-fidelity-shakeexact 89da08f355`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `identity-block.sh .` in a detached worktree of the base, venv active (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `7e1497c4`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5` |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `a591fa9d` · l18 `6460d60d` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `27478177`, all exit 0 |
| reference / generated set | in the block | 4 DIFFER (the known box artifact); generated set not measured (my D2 probe held the box at that moment) |
| surface / constants / entities / profile | each `--check` (`censuses-w0.txt`) | GREEN **353** · PASS **6,938** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` (`tape-runner-pairs-w0.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 105 files (`vitest-files.txt`, less my new test): the brief's list, `fidelityLavaRunner`/`fidelityF7`/`camera`/`finalBossRng`/`tapeRunner`/`levelRunDigestRead`, the apReportBosses importers, and every test naming `stepCamera*`, `onScreenUnderShake`, `cameraNow`, `shakeBandMoot`, `cameraWitness`, `shakeJiggle`, `SHAKE_WRITERS`, `shakeAcrossLoad`, `rebootShake`, `isShakeBandThrow`, `PRESS_KILL_SHAKE_GUARD`, `PRESS_KILL_GUARD_COUNTS`, `CONTACT_FIDELITY_KEYS`, `.shake`, `jiggle` (`rows-before.txt`) | **3,510 / 3,510** |

**The census (W0).** Where the band is born and read (`w0-band-sites.txt`, 105 lines):
- **Born:** `levelRun.stepCameraNow` (live `view()`), the `rebootShake` settle in `settleCameraForLoad`, the chaser
  forecast's `advanceCamera` (`chaserForecastNow`), and the corridor-body forecast's (`corridorBodyForecastFrom`).
  `shakeAcrossLoad` refuses at a load. `stepCamera` throws when it is given a shake.
- **Read (three-valued):** `onScreenNow` / `assertWitnessCamera` (live, with a replay's camera witness), the chaser
  forecast's `onScreenAt`, which throws *"whether X is on screen depends on where inside `Game.shake`'s jiggle"*. Also the
  corridor forecast (`uncertain: true` rows), `bossShotOnScreenVerdict` → `combat` / `bossTotemFight` (an uncertain verdict
  is a refusal), the IGNEOUS render (a refusal), the cull (`cullCam`), the totem's camera contest and `shakeBandMoot`
  (L40GUARD).
- **Consumers in solverBot:** `PRESS_KILL_SHAKE_GUARD` at two catch sites (`isShakeBandThrow`), plus the refusal texts.
- **Tapes by split flag** (`tape-census.txt`, all 289): **169** split:false with no counting clock, **65** split:false
  with a clock, **3** split with no clock (`r6-owl-control`, `r6-owl-kill`, `r8-solve-1`: *"the boot block declares no
  `save.time`"*), and **52** split with a clock. Of the 52, three shake: `u14-moonrock-beam`, `u15-turret-spit` and
  `r9-solve-0-v3` (its L0 moonrock).
- **Every committed camera witness is split:false**: the 12 bomb / bombblast / hammer-bw fixtures, and the three
  `k2prep-l75-*` lavarunner fixtures, including the 10-10 witness `k2prep-l75-grenade-lavarunner`. So no game evidence in
  the tree spoke to a split camera.

## D1 — the exact jiggle on split runs (PASS; behind `shakeExactSplit`, OFF)

**The game.** `Game.update` runs `… view(); time += timeRate;` (`Game.as:889-890`). Under `Rng.split`, `view()` adds
`shake * shakeJiggle(Game.time, axis) - shake/2` after the clamp and before the round (`:2004-2011`), and `shakeJiggle` is
`(floor(t)*2531 + axis*1777) % 4093 / 4093` (`:1956-1960`). Unsplit, the jiggle is `Rng.cos()`, which is `Math.random()`.

**The change.**
- `camera.stepCameraSplit(cam, player, world, {shake, time, cameraTarget})` is `stepCameraJiggled` at
  `finalBossRng.shakeJiggle(time, 0|1)`, the one spelling of the jiggle. It refuses a non-finite time.
- `camera.SHAKE_BAND_KEPT` names the cases where the band stays: `unsplit`, `noClock`, `bandAlready`, `acrossLoad` and
  `rebootSettle`. It is data, not a refusal.
- `levelRun`:
  - `exactJiggleTime(viewTime)` is the time when the key is ON, `rng.split === true` and the time is finite.
  - `stepCameraNow(player, worldRec, viewTime)` steps exactly while the camera is still a point, and otherwise bands as
    before.
  - The time each call site passes:
    - main tick and frozen tick: `clock.now() − 1` (`viewTimeAfterTick`, after `clock.tick()`);
    - moonrock dead span and release frame: `now() + frames − 1` (`viewTimeInSpan`, before `spendFrozen`);
    - FallRock frozen frame: `now() + i − 1`.
  - The reboot settle keeps the band.
  - The chaser and corridor forecasts carry `fviewTime` (seeded `clock.now()`, +1 per advance, copied by `fork()`) and
    take the same arm.
  - New getter: `run.shakeExactCounts` → `{exactViews, bandOpens, split}`, a witness counter.
- No new per-visit map. The counters are run-scoped `let`s that no reach reads, and `levelRunStateDigest` /
  `levelRunDigestRead` stay green both ways.
- OFF is byte-identical by construction (`exactJiggleTime` returns null), and the bounded set agrees (below).

**New contract field (for the JS arc):** `run.shakeExactCounts` (a read-only getter). No `solveSegment` /
`createRunForStaging` contract change.

## D2 — the witness (PASS; p4g, headless, port 9734)

`scripts/procgen/probe-seedling-shake-exact.mjs` (a browser instrument, on boxLock's roster):
- It plays a tape on the game and polls `botStatus()` (camera `{x, y, shake}`, `game_time`, the player, `hits`). It keeps
  every distinct (tick, game_time) poll.
- It replays the model with the key forced ON (or OFF with `--off`) and joins each tick on the poll whose `game_time` is
  the model's clock.
- The checks: clock equal, walk equal, point camera equal at 0 px, and a band contains the game's camera.

| run | split | shaking frames (sampled) exact = game | exact views | band ticks (kept case) | verdict |
|---|---|---|---|---|---|
| `u14-moonrock-beam` (committed) | yes | — (the 60 jiggles are dead frames) | **60** | 0 | PASS, 20/20 at 0 px |
| `u14-moonrock-beam --off` | yes | — | 0 | 19 (holds the game) | PASS |
| `u15-turret-spit` (committed) | yes | **4 / 4** | 5 | 0 | PASS, 100/100 |
| `r9-solve-0-v3` (committed) | yes | — (moonrock span) | 60 | 0 | PASS, 313/313 |
| `rebootshake-l42-part0-damage --split` | re-declared | **10 / 10** | 11 | 17 (`rebootSettle`) | PASS, 1,597 |
| `rebootshake-l41-part0-damage --split` | re-declared | **10 / 10** | — | 31 (`rebootSettle`) | PASS, 1,541 |
| `bombpusher-l41-part0-damage --split` | re-declared | **10 / 10** | — | 31 | PASS, 1,540 |
| `bombpusher-l42-part0-damage --split` | re-declared | **10 / 10** | — | 17 | PASS, 1,596 |
| `k2prep-l75-grenade-lavarunner --split` (the 10-10 witness) | re-declared | **4 / 4** | — | 0 | PASS, 197 |
| `k2prep-l75-chain-lavarunner --split` | re-declared | **12 / 12** | — | 0 | PASS, 378 |
| `bombblast-l40-bw-idle --split` | re-declared | **10 / 10** | 10 | 102 (one band, a kept case) | PASS, 1,533 |
| `movingwait-l42-381-pace --split` | re-declared | 0 (no hit) | 0 | 0 | PASS, 1,148 |
| `wandhold-l42-371-paced --split`, `wandhold-l41-368-paced --split` | re-declared | 0 (no hit) | 0 | 0 | 1 miss each, on the **tape's final tick**: identical with `--off` and pre-existing (the committed witnesses stop at `upto` = tick_count − 1 for it). PASS `--upto=1666` |

(`d2-committed.txt`, `d2-batch.txt`.) **0 px on every shaking frame of every split run.** Every band left on a split run is
a kept case: the death reboot's settle; the load clears it.

**Committed** (`fixtures/shake-witness/`, recorded only on a PASS): `shakeexact-u14-moonrock` (20 samples),
`shakeexact-u15-spit` (100), `shakeexact-l42-bombs-reboot` (1,239; `--split --upto=1240`). `fidelityShakeExact.test.js`
(13 rows) pins:
- ships OFF;
- `stepCameraSplit` ≡ `stepCameraJiggled` at `shakeJiggle`;
- the kept-case names;
- u14 / u15: ON every tick is a point (60 / 5 exact views), OFF a band;
- a **clocked** split:false tape (`prox-l40-turret-contact`) is unchanged ON;
- the committed **unsplit** L42 game witness stays banded ON, with the band holding the game. Two rows are pinned by
  name, the same OFF: t1221 (the reboot) and t1238 (the load), where the game's sample is polled before the new world's
  settle (K2PREP D2's `camFresh`);
- each game witness: ON a point at 0 px or a kept band, OFF the band holding the game.

**Mutants** (predicted, then made by copy + restore; `levelRun.js` byte-restored after each):

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | `viewTimeAfterTick` → `now()` | u15 + L42 witness ON rows fail | **2 failed** (exactly those) |
| m2 | `viewTimeInSpan` → `now() + frame` | u14 fails | **SURVIVED**: the moonrock span ends at shake 0, and the lerp and round erase a one-frame shift by the first sampled tick. The witness cannot see the span's clock (residue) |
| m3 | drop the split check | the split:false row fails | **SURVIVED** first: `r6-contact-pair-live` is clockless, so `noClock` held the band. Re-pinned on a clocked tape and on the unsplit game witness → **2 failed** |
| m4 | ignore the key | the OFF rows fail | **5 failed** |

## D3 — the consumers (PASS: dormant on split runs; hammer's functions not edited)

- **LB's leg 414** (`level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Chest`). Committed request `i=0`,
  `replay-seedling-solve-request.mjs --seam-time-sweep=-10..10`, one fresh process per seam, the key by env
  (`census-414.md`, `c414-{off,on}.jsonl.gz`):
  - OFF has **3** live-run shake throws (5121–5123: *"whether bob bob@736,800 is on screen at tick 690 depends on where
    inside `Game.shake`'s jiggle"*). ON has **0**: those three seams become the REBOOT guard's death refusal (*"the
    player died at t801/t799 (chaser bob@736,752) while pressing spinner@880,848"*), like 5124–5131.
  - The other 18 seams are identical (class and units). No ON message mentions the band. Nothing solves either way.
- **Leg 397** (`level_40__r23c29 <- in_L39_144_0 -> … Chest`). LB's rebuilt request, the same census
  (`census-397.md`, `c397-{off,on}.jsonl.gz`): **OFF = ON on all 21 seams**, class and units: 18 EXHAUSTED, 3
  HAMMER_SAFETY. No row mentions the band at this base. LB's 5119 / 5132 forecast throws were measured at an older base
  and no longer appear OFF either.
- **`PRESS_KILL_SHAKE_GUARD` / PKB's refuge catch.** No bounded row moves ON: `hammerRefugeCut` and `hammerPressBombs`
  replay split:false witnesses, so they keep the band (`unsplit`). On live (split) stagings the catch has nothing left to
  catch wherever the clock counts. That is the 414 census above. I did not edit hammer's functions.
- **Leg 371:** the 371 walk re-declared split takes no hit, so it never shakes (`wandhold-l42-371-paced`: 0 shaking frames
  ON). Its band phases come from the solver's hammer phases, so **hand-over: hammer-2's 371 census re-run** with the key
  ON (by env in node, or by a default flip on the page).
- **Band-text pins.** All stay green ON:
  - `fidelityArrowLane` — its staging keeps the band;
  - `fidelityLavaRunner` — the k2prep witnesses are split:false;
  - `fidelityF7` — its controls stay banded;
  - `f7-reentry-oracle.json` — read by `fidelityF7` only.
- **Bounded set with the key ON** (`SEEDLING_SHAKE_EXACT_SPLIT=1`, 106 files, `rows-on.txt`): **3,522 / 3,523**. The one
  red is the defaults pin, `contactFidelity.test.js` "the shipped defaults", which a flip re-pins
  (`shakeExactSplit: true`); the "ships OFF" row skips under the env. tapeRunner pairs md5 is unchanged
  (`88fc7df4…`).

## Movers (STOP with the list)

| measurement | OFF | ON | moved |
|---|---|---|---|
| committed tapes (289), observation md5 | — | — | **0** |
| committed tapes, camera md5 | — | — | **3** (band → point): `u14-moonrock-beam`, `u15-turret-spit`, `r9-solve-0-v3` |
| route survey, full (local, `--through=end --route=full`, `survey-full-{off,on}.rows.txt`) | 241 rows: 188 SOLVED / 52 REFUSED / 1 TIMEOUT | the same | **0 rows** (byte-equal with the ms stripped) |
| leg 414 seam census | 3 shake throws | 0 | 3 seams (refusal → refusal) |
| leg 397 seam census | 18 EXHAUSTED / 3 HAMMER_SAFETY | the same | 0 |
| bounded vitest | 3,510 / 3,510 | 3,522 / 3,523 | 1 (the defaults pin) |
| probes standard (a worktree of head with `shakeExactSplit: true`, served on 8000; `probe-battery-standard-on.txt`) | — | **11 / 11 ALL CHECKS PASSED** (`arrival-composites` included) | 0 |

**Not measured here (needs CI; I cannot dispatch):**
1. **Full sweep A/B ×1** (the camera is everywhere): `seedling-divergence-sweep.yml` on branch
   `claude/seedling-shakeexact-camera-1kc500`, mode/producer as the wave-20 baseline (39496135591), with
   `contact_fidelity=<arm-A.txt>` (the 77 defaults) and `contact_fidelity=<arm-B.txt>` (the same + `shakeExactSplit`).
   ⚠ The sweep turns every unlisted key OFF, so pass the full list; `env` does not reach the page's worker.
2. **Keyed ×2** on the legs the full A/B moves, plus legs 414 and 397 by key: `keys=level_40__r23c29 <- in_L43_176_464 ->
   location:Level 040 - Chest|level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest`, both arms,
   `capture_requests=true`.
3. **Survey on CI**: `seedling-survey.yml` on the branch, both arms, to confirm the local A = B.
4. **Probes**: `seedling-probe.yml battery=standard` with arm B, to confirm the local 11/11. That needs a branch commit
   flipping the default, or the planner's harvest flip, because the page reads no env.

**The licence question for the user:** flip `shakeExactSplit` ON? Measured: 0 committed tape observations and 0 survey
rows move. 3 tapes' camera bands become points, each game-confirmed at 0 px. LB's leg-414 shake throws vanish, and those
seams refuse on a death instead. Probes standard pass 11/11 ON. The one re-pin a flip owes is the defaults pin in `contactFidelity.test.js` (and
`fidelityShakeExact`'s "ships OFF" row, which becomes "ships ON").

## The JS arc

- New getter `run.shakeExactCounts`; no contract change. No `producer:walker` code touched.
- Pins that move ON: only `contactFidelity.test.js`'s defaults pin. `jsRuntimeSolverEventGoal` / `jsRuntimeDeclarations`
  stay green ON.
- The page needs nothing wired: the key is a `CONTACT_FIDELITY` default like any other.

## Handed to the hammer arc

- The 371 census re-run with the key ON (hammer-2, at landing).
- The PKSG / PKB band catches, once the key is ON: on split live stagings with a counting clock they are dormant (414).
  What still feeds them is the kept cases, the **death-reboot settle** above all. After a shaken death the band persists
  until the next load (L42: 17 ticks; bombblast L40: 102). That band, not the jiggle, is now the guards' only source on
  live stagings.

## Deltas / what the brief got wrong (measured)

- *"Every live tape declares SHIPPED_RNG split TRUE"* holds for the shipped (page) tapes, but **every committed camera
  witness is split:false**, and 234 of the 289 roster tapes are too. The game evidence for split had to be recorded fresh.
- *"`levelRun.stepCameraNow` (~line 4895)"*: it is at ~5206 at the base.
- The time `view()` reads is not one expression. After a tick it is `clock.now() − 1`, because every call site follows
  `clock.tick()`. Inside a dead span it is `now() + f − 1`, because the span is paid after its loop.
- The Owl tapes (`r6-owl-*`) are split but clockless (no `save.time`), so they keep the band by `noClock`, although
  `shakeJiggle` was measured on the Owl (174/174 on p4f). A clocked Owl staging would take the exact arm.
- *"the forecast's … throws"*: on 414 the throw that went away was the **live run's** (`levelRun: whether …`), not the
  forecast's.

## Residue

- m2: the dead-span time (`viewTimeInSpan`) is not pinned by a witness. The moonrock span ends at shake 0, so the camera
  after it is the same either way. A FallRock span (L28, `drillTimedPass`) under split would test it; I did not record
  one.
- IGNEOUS's `help`-span render (`stepIgneousSpan`) still refuses under any shake, even exact. The key is OFF there, and
  this is noted only.
- The final-tick camera miss on the wandhold walks (1 px y, key-independent) predates this slice.

## Byte-inertia

- OFF: tapeRunner pairs md5 `88fc7df4…` = W0. The bounded AFTER at defaults is 3,523 green + 1 `STACK_TRACE_ERROR` in
  `fidelityLapseCost` under load, which re-ran solo 13/13 (`rows-after.txt`). The censuses are re-written for the getter
  and the line moves, and are green at head.
- Identity at head: CI's headless gate shard 1 at `4cf87fa8` prints the block, and every row equals W0: maze
  `57e07d21`, acceptance `cf54cdf7`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate
  `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, all exit 0. The `plan-seedling-r7-attribution --check`
  row is exit 0.
- No committed tape and no producer `--check` digest moves, ON or OFF. No AS3, wasm, gitlink or rules edit.

## CI

`JavaScript Unit Tests` at `8e2ec3d3` (run 40226067564): **success**.
- Vitest (unfiltered) 22,880 / 22,880; slow battery 268 / 268.
- Producer `--check`s and headless gate shards 0/1 green.
- The browser gate shards were skipped (a docs-only push). At `4cf87fa8` / `57a4791a` their one red, like the vitest
  shard-2 and headless shard-1 reds, was the generated reference (my new instrument and log words), fixed by `57a4791a` +
  `8e2ec3d3`.

The commit carrying this report touches only `CC/docs/`.

## Rows to BANK

- `shakeExactSplit` (OFF) + `camera.stepCameraSplit` + `camera.SHAKE_BAND_KEPT` + `run.shakeExactCounts`.
- `fidelityShakeExact.test.js` (13) + `fixtures/shake-witness/` (3, p4g).
- `probe-seedling-shake-exact.mjs` (on boxLock's roster).
- Movers: survey 0, tapes 0 observation / 3 camera, leg 414 3 seams (shake throw → death refusal), bounded 1 (defaults pin).
