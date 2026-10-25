# Seedling fidelity L40REREC — the L40 witness tapes re-recorded on the game at the shipped defaults, their INTERIM pins retired

| | |
|---|---|
| Session | `seedling-fidelity-l40rerec` (planner `seedling-fidelity-planning-13`, wave 31, model coverage after R7) |
| Start SHA | `89da08f355` (= `fidelity-harvest/w30`: main `cfc681a566` + W30 flipped ON, 77 default-ON keys; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/l40-tape-rerecord-2m84xl` |
| Commits | D1 `be2af1d` · D2 `74a4ee0` · evidence `d17cbe0` · reference `7628b19` · bot log `c93554f` · D1 re-pin + evidence `74b5157` · this report |
| Verdicts | **W0 PASS · D1 PASS (both tapes re-recorded, now DAMAGE ON) · D2 PASS (drive re-recorded game-true; the control is byte-identical and was not re-recorded)** |
| Licence | ⚖ user 2026-10-24: *"Queue a re-record slice"*, *"Re-record via CORPSEBUMP"* |

**The one thing to know first.** No solver or model code moved. The diff is two producers, their tapes and oracle
streams, and the rows that read those tapes. `l40button-l4{1,2}-part0` lost their `noDamage` flag: the default solver
paces the hold out of `bombpusher@112,128`'s blasts, and p4g plays it with damage on, 0 hits, 0 px. That makes them
**R8-bridge-exposed tapes** (+2 in `exposedAdded`). The JS arc reviews that change of the roster's exposure at harvest.

## W0 — at the base (`89da08f355`)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| `plan-seedling-l40button-witness.mjs --check` (with the pins) | | **green**: 1,543 t / 1,597 t, byte-identical (`evidence/w0-l40button-check.txt`) |
| `plan-seedling-r5-l40-part5.mjs --check` (with the pin) | | **green**: 14/14 claims, both tapes `same` (`evidence/w0-r5part5-check.txt`) |
| the tapes' game agreement | `SEEDLING_PORT=9735 check-seedling-bot-differential.mjs --only=<the 4>` (p4g) | **95 PASS / 0 FAIL**, every tape "live game matches the committed oracle stream" (`evidence/differential-before.txt`) |
| identity block | `identity-block.sh .` in a detached worktree of the base | log md5 `d75db45e…` (`evidence/identity-before.txt`) |
| six `--check`s | in the block | `405d9c4b a591fa9d 6460d60d 35456fbc 6cd35fe1 27478177`, all exit 0 |
| surface / constants / entities / profile | the four `--check`s | GREEN **353** · **6,938** literals, 0 drift · PASS **566** · PASS **138** ×2 (`evidence/censuses.txt`) |
| roster | `fixtures/tapes/index.json` | **289** |
| bounded vitest BEFORE | 89 files (`evidence/bounded-set.txt`), json reporter, md5 over sorted `status\tfile > name` | **3,289 tests, all green**, md5 `82a715a7b898bbee6ad60992c0086bf9` (`evidence/vitest-rows-before.txt`) |
| tapeRunner rows | the `tapeRunner` lines of that set | 638 rows, md5 `9c2d210b7c4d8f03223c86e75d083982`, all pass |

The bounded set is the brief's standing list, plus every test file that names one of the four tapes (`grep -a`): `iceTurret`,
`r5Totem`, `levelRun`, `solveProgress`, `solveProgressHeartbeat`, `stringPullFast`, `seedlingEffectSkin`,
`seedlingHazardSkin`, `fidelityFirePush`, `fidelityFireMove`, `fidelityWandHold`, `fidelityBombPusher`,
`hammerRefugeCut`, `hammerPressBombs`, `fidelityCorpseBump`, `fidelityTurretCircle`, `fidelityL40Res`, `tapeRunner`,
`tapeFormat`, `r5Acceptance`. There is no `apReportBosses.test.js`: its module is tested by `fidelityApFlip` and
`solverEncounter`, which are both in the set. The slow `fidelityL32ArenaPrefix` was run by itself under the slow config:
5/5 after.

## D1 — `l40button-l41-part0` / `l40button-l42-part0` (PASS)

**Measurement.** With the `PINNED_FIDELITY` table emptied, the solve is the default solver's own:

| tape | before (pinned) | pins OFF, strike floor still pinned OFF | pins OFF, floor at its default (ON) — **recorded** |
|---|---|---|---|
| `l41-part0` (leg 378) | 1,543 t | 1,601 t | **1,601 t** (byte-equal to the floor-OFF arm) |
| `l42-part0` (leg 381) | 1,597 t | 1,667 t | **1,663 t** |

The tick counts at the defaults are WANDHOLD's paced witnesses: `brave, kill puncher@816,128, hold, break, hold,
collect` and `brave, hold, kill spinner@192,128, break, hold, collect`.

**Change** (`scripts/procgen/plan-seedling-l40button-witness.mjs`):
- `PINNED_FIDELITY` is deleted, and `main()` runs at the defaults. The docblock says why each pin's retirement condition
  is met: `movingWait` + `bombBlastBody` pace the hold, and `bombBlastBody` is ON.
- `withStrikeEtaFloor(false)` is removed too. Its stated reason was "re-recording ON would rewrite a game-witnessed tape
  from the model alone", which a game re-record removes. **The brief did not name this pin. I retired it because "the
  base's defaults" include the floor.** It moves l42 by 4 t (table above).
- The witness is `noDamage: false`, with `DAMAGE_ON_SENTENCE` in its description; `BOMB_REFUTED` is kept as the history.
- The model check now also asserts 0 player hits.

**Witness.** `SEEDLING_PORT=9735 check-seedling-bot-differential.mjs --record --only=l40button-l41-part0,l40button-l42-part0`
on p4g (headless, logic-only):
- **ALL CHECKS PASSED**: the game's `hits` is 0 and `hits_timer` is 0 at the seam on both.
- "THE MODEL REPRODUCES THE RECORDING IT JUST MADE": 1,602 and 1,664 observations.
- Max |Δ| between the model and the recording over every observation: **0 px** on both tapes.
- `--check` is green afterwards.

**Consumers re-pinned, by name:**
- `r8Acceptance.js` `R8_ENEMY_BRIDGE.exposedAdded` gains `l40button-l41-part0` and `l40button-l42-part0` (levels [40]).
  The bridge named both the first time the suite ran, because a tape that retires `noDamage` in a bridged room is
  exposed. The `l40button-l42-part0` roster row's text also gains the re-record sentence.
- `r8Acceptance.test.js`: the re-derivation row's list (91 → 93) and its synthetic mirror io (the "mirror rule").
- `fixtures/skin-goldens/effect-bombpusher-L40.txt` and `hazard-bombpusher-L40.txt` (`UPDATE_SKIN_GOLDENS=1`): their
  fixture is `l40button-l41-part0`, so the frames follow the new walk. The other goldens in both files are byte-equal.
  **These goldens are the JS arc's (G2 skin): please review.**
- `fidelityL40Button.test.js` D3 now asserts `noDamage === false`, so its no-hit row is a claim rather than the gate.
- `fixtures/tapes/index.json` is regenerated (tick counts only; still 289 tapes).
- Read and left unchanged:
  - `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance` and `tapeIndexManifest`: green, because they pin
    counts, not ticks.
  - `fixtures/dead-frame-observations.json`: the recording measured the same dead frames (170 = 150 + 20).
  - `fixtures/bomb-witness/*`: they embed their own tape copies.

## D2 — `r5-l40-part5` (+ its control) (PASS)

**Measurement.** The game-true second bump is FIREPUSH's: from (488,424). Only the second press moves. The first press
from (488,440) reaches the corpse on the game.

**Change** (`scripts/procgen/plan-seedling-r5-l40-part5.mjs`):
- The `CONTACT_FIDELITY.fireLiveTurretReach = false` pin is deleted.
- `BUMP_STANCES = [STANCE, (488,424)]` gives each bump its stance.
- The drive's description says where the second press stands.
- The claim "the arms are byte-identical for the whole control" is **restated**. The arms now part at **t1798**, where the
  drive walks north for its second press, after the shared first press at t1756. The check asserts exactly that.
- Every other claim stands: 3 hits from 3 presses, the corpse latches solid, kill-lock ledger nil, 2 presses, t2 open,
  no transition, no spinner write, `40:12` the only clear, the control kills the same turret, t2 never opens in the
  control, t3 latches in both, both end in one cell, the same two blast freezes [1614 1722].

**Witness:**
- The drive is 1,978 → **2,018 t**. Its held inputs equal `fidelityFirePush.firePushPrefixTape(0, { route: false })`
  **on every tick**, the prefix FIREPUSH's witness played at 0 px.
- Recorded with `--record --only=r5-l40-part5` on p4g: model = game, **0 px** over 2,019 observations.
- The control's tape is **byte-identical**, so it was not re-recorded. Its oracle stays, and the staleness pass is green.
- **The tape's own claim, checked on the game** (`evidence/probe-r5-pair-corpse.mjs`, p4g, `evidence/r5-pair-corpse-game.txt`):
  the drive's corpse sits on `button@480,384` {t 2} **from t1838 and stays there**, ending at (487.5,392). The control's
  corpse ends at **(488,407.5)**, one tile short, and is never on the button.
- `botMobiles` does not list Activators, so the corpse's position is the game's evidence, as in FIREPUSH.
- Before the change, the old drive also matched the game at 0 px, because the oracle stream holds positions only. Its
  corpse never reached the button on the game (FIREPUSH measured it). That is the trap candidate below.

## Mutants (predicted first; copy + edit + run + restore; `evidence/mutants.txt`)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | the retired three-key table restored around `main()` (floor still default) | both `--check`s DRIFT | l41 DRIFT (back to 1,543 t). **l42 THROWS instead**: *"a totempart ceremony began in level 40 while the chaser bob@272,112 is DYING"*. The pins OFF with the floor ON is a combination never run before, and my prediction was wrong for l42 |
| m2 | `BUMP_STANCES[1] = STANCE` (the old stance, the pin not restored) | the second bump reaches nothing; the synthesis refuses | as predicted: *"target 5 fire: iceturret@472,400 reports SETTLED 10 tick(s) after the press, i.e. it never started moving"* |
| m3 | `noDamage` flipped back to true in the committed `l40button-l41-part0` | r8 exposure rows red + the fidelityL40Button l41 row red; tapeRunner l41 green | as predicted, plus one r8 row I did not predict (*"reds when the ROOMS move"*, which runs the same re-derivation). tapeRunner l41 stayed green |

## Movers

| row | result |
|---|---|
| bounded vitest AFTER, re-pins included (89 files) | **3,289/3,289**, md5 **`82a715a7…` = BEFORE** (`evidence/vitest-rows-after.txt`). Before the re-pins, 4 were red: r8 ×2, the two skin goldens (`evidence/vitest-rows-after-unpinned.txt`) |
| the import reach's extra tests (`reach-seedling-change.mjs --range=89da08f355..HEAD`; 38 more non-slow files, mostly through `r8Acceptance.js`) | **605/605** (`evidence/vitest-rows-reach-extra.txt`) |
| tapeRunner rows | 638 rows, md5 `9c2d210b…` before = after. The four tapes' differential and stepping rows pass |
| `ci-producer-checks.mjs --jobs=3` | **93 run, 0 red**, 1 named skip (`plan-seedling-r7-ends-meet`, a browser arm) (`evidence/producer-checks-after.txt`) |
| identity block AFTER | every data row equal (`evidence/identity-*.txt`). Differences are environmental only: "generated set" (worktree: no venv; head: the venv's playwright 1.56 vs the 1.63 pin) and the reference (base worktree 4 DIFFER from its symlinked submodules; head 1 DIFFER = `instruments.js` from my producer docblock, regenerated in `7628b19`; `--check` then reports ALL MATCH) |
| censuses AFTER | identical to BEFORE |
| differential staleness AFTER (the 4 tapes, p4g) | **95 PASS / 0 FAIL** (`evidence/differential-after.txt`) |
| probes standard (local, a server on :8000; these probes hardcode it) | **11/11 ALL CHECKS PASSED**, arrival-composites included (`evidence/probe-battery-standard.txt`) |
| `fidelityL32ArenaPrefix.slow` | 5/5 |
| JavaScript Unit Tests (CI) | read at the report head; see the last section |

**Survey and sweep rows: none move, by construction.** The route survey and the divergence sweep run the solver
against stagings built from the atlas and the sweep's legs. Neither reads these four tapes or the two producers, and no
solver, model, walker or `contactFidelity` default changed. No switch was added. (`l40buttonStaging`, which other tests
import, is unchanged.) Before → after: no row moves.

**Dispatches for the planner (optional confirmation):**
1. `seedling-probe.yml -f battery=standard` on `claude/l40-tape-rerecord-2m84xl`. Expected: 11/11, as measured locally.
2. The differential's full tier on this branch (the workflow that runs `check-seedling-bot-differential.mjs --tier=full`).
   Expected: the four tapes green against their new oracles.
3. No survey or sweep A/B is owed (no switch). To check that, `seedling-survey.yml through=end route=full` against
   39496129402 should equal it by (level, goal, boot) wherever the base already did.

## The JS arc's pins that move, and what it must wire

- **Roster:** four oracle recordings changed (`expectations/l40button-l4{1,2}-part0.json`, `r5-l40-part5.json`), and
  three tapes (the control is unchanged). Tick counts: 1,543 → 1,601; 1,597 → 1,663; 1,978 → 2,018.
- **Exposure:** two tapes leave `noDamage`, so the R8 bridge now prices L40's chasers on them (`exposedAdded` 91 → 93).
- **Skin goldens:** `effect-bombpusher-L40.txt` and `hazard-bombpusher-L40.txt` regenerated (the G2 renderer is
  untouched).
- **Nothing to wire:** no new staging/result field, no new `SolverRefusal.obstacle.kind`, no `run.*` field changed.

## Handed to the hammer arc

Nothing is edited in its region. **One observation (m1):** the l42 staging with `bombPusherLive`, `strikeIframeLapse`
and `spinnerLockLag` OFF and `STRIKE_ETA_FLOOR` ON throws *"a totempart ceremony began in level 40 while the chaser
bob@272,112 is DYING"*. It is not a default combination, so it is only information.

## What the brief got wrong (measured)

- **"three" pins:** the producer carried a fourth, `withStrikeEtaFloor(false)` (hammer SFF's inertia pin). It moved l42
  by 4 t, and it is retired here with the others.
- **"`--check` costs two ~16-minute solves":** each arrival solves in about 7 s at the base. The docblock is corrected.
- **"t2 opens" as the claim to re-check "on the game":** the oracle stream cannot see it, because it holds positions
  only, and the old tape already passed it at 0 px while its claim was false. It needed a separate game read of the
  corpse (`evidence/probe-r5-pair-corpse.mjs`).
- **The pair's "control is a prefix of the whole drive" claim cannot survive a game-true drive:** the second press's
  stance is a different cell. The claim is restated (they part at t1798) rather than kept by moving the control.
- **The `fireLiveTurretReach` pin only affected the drive:** the control's tape is byte-identical with the pin gone.

## Trap candidates

- A position-only oracle at 0 px is not evidence for a tape's claim about the world. The old `r5-l40-part5` matched the
  game while its corpse never reached the button.
- Retiring `noDamage` is an exposure change. The R8 bridge names the tape, and the test's mirror lists owe it too
  (`exposedAdded`, the 91 → 93 list, the synthetic io).
- A pin-restoring mutant can throw instead of drifting when the other defaults have moved past the combination the pin
  was written for.

## Residue

- `iceTurret.js:990` (`confirmedBy: … 1,966 ticks in BOTH arms`), `iceTurret.js:967`, `r5Totem.js:2941` ("1,965
  ticks"), `r5Totem.js:3201` and the bot log's §3848 describe slice 21's withdrawn recordings. They are history and
  were left alone (not my region).
- `levelRun.js:13864`'s comment cites `l40button-l42-part0` at t972 from the old walk. It is a comment in `levelRun`
  (not my region), and it is now stale.
- The l40button producer's header still says `STANCE_ROCKS` "ships OFF" (it has shipped ON since wave 12). That is
  pre-existing.
- The bot-log commit was made with `BOX_LOCK_COMMIT_ANYWAY=1` while my own probe battery held the lock (a docs-only
  commit; the battery's frozen head `7628b19` differs from it by `seedling-bot-log.md` alone).

## Byte-inertia

- Every identity row, census, producer `--check`, tapeRunner row name and status, and bounded-vitest row is equal to
  the base. The exceptions are the licensed moves: three tapes, three oracles, two goldens, the index, and the r8 rows.
- Default switches and solver output are byte-identical (no code path changed).

## Rows to BANK

- roster 289; `R8_ENEMY_BRIDGE` exposed **93**
- `l40button-l41-part0` 1,601 t, damage on, p4g 0 px, 0 hits
- `l40button-l42-part0` 1,663 t, damage on, p4g 0 px, 0 hits
- `r5-l40-part5` 2,018 t, p4g 0 px, corpse on t2 from t1838; `-control` 1,937 t unchanged, corpse at (488,407.5)
- bounded vitest md5 `82a715a7b898bbee6ad60992c0086bf9` (89 files / 3,289)
- producer battery 93/0 red

## CI

- **Run 40225369466 at `74b5157` was RED, and my own commits caused it.** All four red jobs had one root: the generated
  procgen reference was stale.
  - I regenerated it at `7628b19`, BEFORE writing the bot-log entry. The entry's new heading moves `docsIndex.js` /
    `README.md`'s heading count (1185 → 1186; bot-log slugs 694 → 695).
  - The evidence probe `probe-r5-pair-corpse.mjs` is enrolled in `instruments.js`.
  - The red rows: vitest shard 3/3 (`docsRender` ×2), shard 2/3 (`generated.test.js --check`), headless gates shard 1
    (`identity: generate-procgen-reference.mjs`, UNEXPECTED-RED), and the browser gate shard (`procgen-reference`).
  - Every other row was green: shard 1/3, the slow battery 268/268, and the vitest suite 22,863 passed / 3 failed, all
    three of them this cause.
- **The fix**: the reference is regenerated after the last doc edit (`--check`: ALL MATCH; `procgenDocs/` 493/493
  locally). It is pushed with this report, and the run at that head is quoted in the session's final message.
- **Trap candidate**: regenerate the procgen reference AFTER the last markdown edit (the bot log counts), not after the
  last code edit. A docs-only change can move it.
