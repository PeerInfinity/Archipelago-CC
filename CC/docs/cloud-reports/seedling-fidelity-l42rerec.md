# Seedling fidelity L42REREC — `l40button-l42-part0` re-recorded on the game at the defaults; the `dashSpinnerForecast` INTERIM pin retired

| | |
|---|---|
| Session | `seedling-fidelity-l42rerec` (planner `seedling-fidelity-planning-14`, wave 32, model coverage after R7) |
| Start SHA | `1e17f44738` (= main, W31 landed, 85 default-ON keys; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/seedling-l42-rerec-adi774` |
| Commits | D1 `fb6058f7` · evidence + bot log `78b64d2a` · this report |
| Verdicts | **W0 PASS · D1 PASS (l42 re-recorded game-true at the defaults; l41 byte-identical, not re-recorded)** |
| Licence | ⚖ user 2026-10-26: *"Yes, re-record"* |

**The one thing to know first.** No solver or model code moved, and no switch was added. The diff is:
- the producer, which loses `PINNED_FIDELITY` and its `withContactFidelity` wrapper;
- one tape and its oracle stream;
- the tape index (`tickCount` 1663 → 1665);
- two row TEXTS in `r8Acceptance.js`.

`l40button-l42-part0` is now **1,665 t**. The game (p4g, damage on) plays it with 0 hits and collects the part. The model
reproduces it at 0 px. The bounded vitest set is byte-identical before and after (md5 `0bb126bb…`), and no row needed a
re-pin to stay green.

## W0 — at the base (`1e17f44738`)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY` |
| producer `--check`, with the pin | `node scripts/procgen/plan-seedling-l40button-witness.mjs --check` | **green**: l41 1,601 t, l42 1,663 t, both byte-identical (`evidence/w0-check-pinned.txt`) |
| producer `--check`, pin OFF | the same, with the pin deleted | **l41 byte-identical**; **l42 DRIFT**: 1,663 t → **1,665 t** (`evidence/w0-check-pin-off.txt`) |
| the moved span | input-row diff of the two l42 tapes + both arms' plan records (`evidence/l42-records.mjs`, `evidence/d1-records.txt`) | the first 122 input rows are equal, and the held inputs part at **t1310**. The verbs are identical: `brave, hold, kill spinner@192,128, break, hold, collect`. The kill is identical too: from t1112 for 156 t, so it ends at t1268. The divergence is on the walk to the break: its record starts at t1336 OFF and t1337 ON, and both arms press at t1337. The second hold then stops at (168.6,135.1) OFF and (168.0,136.4) ON. `collect` starts at t1656 OFF and t1659 ON |
| game agreement of the base tapes | `SEEDLING_PORT=9745 check-seedling-bot-differential.mjs --only=l40button-l41-part0,l40button-l42-part0` (p4g, headless) | **53 PASS / 0 FAIL** (`evidence/differential-before.txt`) |
| identity block | `SEEDLING_PORT=9746 identity-block.sh /tmp/claude-0/base` (detached worktree of the base, its own server) | `evidence/identity-before.txt`; see Byte-inertia |
| roster | `fixtures/tapes/index.json` | **289** |
| bounded vitest BEFORE | 94 files (`evidence/bounded-set.txt`), json reporter, md5 over sorted `status\tfile > name` | **3,348 tests, all green**, md5 `0bb126bb567c2527315e4d8cab263315` (`evidence/vitest-rows-before.txt`) |
| tapeRunner rows | the `tapeRunner` lines of that set | 635 rows, md5 `2c250a93a2184d817c0c74284cb38505`, all pass |

The bounded set is three lists joined:
- L40REREC's 89 files;
- the brief's standing list, where the file exists. `apReportBosses`, `jsRuntimeSolverEventGoal` and a few others
  have no `.test.js` of that name; their modules are covered by `fidelityApFlip` and `solverEncounter`, both in the set;
- every `.test.js` that names `l40button`, the producer, `bomb-witness/` or `shake-witness/` (`grep -a`), plus
  `seedlingConstantsCensus` and `seedlingSolverSurface`.

## D1 — `l40button-l42-part0` (PASS)

**Change** (`scripts/procgen/plan-seedling-l40button-witness.mjs`): `PINNED_FIDELITY` and its `withContactFidelity`
wrapper are deleted, and `main()` runs at the defaults. The docblock records the retirement and the measurement.
`l40buttonPlan` (imported by other tests) is unchanged.

**Witness.**
- `SEEDLING_PORT=9745 check-seedling-bot-differential.mjs --record --only=l40button-l42-part0` on p4g (headless,
  logic-only) reports **ALL CHECKS PASSED (recording mode)** (`evidence/d1-record.txt`):
  - the game's `hits` and `hits_timer` are 0 at the seam (latched t1665);
  - `hasTotemPart` is [true,false,false,false,false], game = model, so the part was collected on the game;
  - `hasKey` agrees;
  - the latched `save.time` is 10422 on both;
  - 0 dialogue;
  - the dead frames are accounted for (170 = 150 pickup + 20 residue);
  - "THE MODEL REPRODUCES THE RECORDING IT JUST MADE": 1,666 observations.
- Max |Δ| between model and game is **0 px** on 1,666 of 1,666 observations, with 0 level mismatches and 0 model hits
  (`evidence/delta-model-vs-game.mjs`, `evidence/d1-delta.txt`). l41 is also 0 px on 1,602 of 1,602.
- The producer `--check` afterwards is **all checks green** and both tapes are byte-identical (`evidence/d1-check-after.txt`).
- The differential afterwards, both tapes against their committed oracles, is **53 PASS / 0 FAIL**
  (`evidence/differential-after.txt`).
- L40REREC's trap is that a position-only oracle cannot see a corpse. This tape claims "latches t0 and t1, breaks,
  collects the part", and the game's own `hasTotemPart` is the evidence for the collect. No corpse claim is involved.

**l41-part0: confirmed unmoved.** With the pin gone its solve is byte-identical (1,601 t), so it was **not
re-recorded**. Its tape and oracle are untouched.

**Consumers (grep `-a` for the tape name; every hit read):**

| consumer | action |
|---|---|
| `fixtures/tapes/index.json` | regenerated (`generate-tape-index.mjs`): `tickCount` 1663 → 1665; still 289 tapes |
| `fixtures/expectations/l40button-l42-part0.json` | re-recorded (the game's stream) |
| `r8Acceptance.js` `R8_ENEMY_BRIDGE.exposedAdded` row `l40button-l42-part0` | `ticks` 1663 → 1665, `addedBy`/`why` gain the L42REREC sentence. The field is descriptive (no row asserts it), but it was stale |
| `r8Acceptance.js` `R8_D2_SHIELD` roster row `l40button-l42-part0` | its `why` gains the L42REREC re-record sentence |
| `r8Acceptance.test.js` (exposure list, mirror io) | unchanged: the tape was already exposed (L40REREC), and the exposure did not move |
| `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest` | green unchanged: they pin counts and fields, which the index carries |
| `fixtures/dead-frame-observations.json` | unchanged: the recording measured the same 170 dead frames (150 + 20) |
| `fixtures/bomb-witness/*-l42-part0-damage.json`, `fixtures/shake-witness/shakeexact-l42-bombs-reboot.json` | unchanged: they embed their own tape copies (their own witnesses) |
| skin goldens (`effect-`/`hazard-bombpusher-L40`) | unchanged: their fixture is `l40button-l41-part0`, which did not move |
| `fidelityL40Button.test.js` | green unchanged: it replays the committed tapes |
| `levelRun.js:13925` comment (`l42-part0` at t972) | not my region; stale since L40REREC (residue) |
| `fidelityWandHold.test.js:168` comment ("leg 371's solve is 1663 ticks") | WANDHOLD's own pinned solve and witnesses, not this tape; left alone (residue) |

## Mutants (predicted first; copy + edit + run + restore; `evidence/mutants.txt`)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | `withContactFidelity({ dashSpinnerForecast: false }, main)` restored | l41 byte-identical, l42 DRIFT (1,663 t) | as predicted: l41 byte-identical; l42 1,663 t, **DRIFT** |
| m2 | the base's l42 oracle stream under the new tape | tapeRunner's `fixture differential l40button-l42-part0` red, nothing else | as predicted: 1 failed (that row) / 3 passed |
| m3 | `index.json` `tickCount` back to 1663 | `tapeIndexManifest`'s l42 row red | as predicted: 1 failed / 291 passed |

## Movers

| row | result |
|---|---|
| bounded vitest AFTER, before any re-pin (94 files) | **3,348/3,348**, md5 `0bb126bb…` = BEFORE (`evidence/vitest-rows-after-unpinned.txt`) |
| bounded vitest AFTER, with the row texts (94 files) | **3,348/3,348**, md5 `0bb126bb…` = BEFORE (`evidence/vitest-rows-after.txt`) |
| tapeRunner pairs | 635 rows, md5 `2c250a93…` before = after. The l42 rows (differential, stepping face) pass |
| the import reach's extra tests (`reach-seedling-change.mjs --range=1e17f44738..HEAD`; 38 more non-slow files) | **606/606**; the 3 slow files in reach or in the brief (`fidelityL32ArenaPrefix`, `fidelityLights`, `jsRuntimeSolverForkRun`, slow config): **11/11** (`evidence/vitest-slow.txt`) (`evidence/vitest-rows-reach-extra.txt`) |
| `ci-producer-checks.mjs --jobs=3` | **93 run, 0 red**, 1 named skip (`plan-seedling-r7-ends-meet`, a browser arm), 0 known-red (`evidence/producer-checks-after.txt`) |
| reference | `generate-procgen-reference.mjs --check`: ALL 7 MODULES + 5 REGIONS MATCH (the producer's leading docblock is unchanged) |
| probes standard (local, `--host=http://localhost:9745`, p4g) | **11/11 ALL CHECKS PASSED**, arrival-composites included (`evidence/probe-battery-standard.txt`) |
| JavaScript Unit Tests (CI) | read at the report head; see the last section |

**Survey and sweep rows: none move, by construction.** The route survey and the divergence sweep solve stagings built
from the atlas and the sweep's legs. Neither reads this producer, its tapes or `r8Acceptance.js`'s row texts. No solver,
model, walker or `contactFidelity` default changed, and no switch was added. Before → after: no row moves.

**Dispatches for the planner (optional confirmation):**
1. `seedling-probe.yml -f battery=standard` on `claude/seedling-l42-rerec-adi774`. Expected: 11/11, as measured locally.
2. The differential's full tier on this branch. Expected: `l40button-l42-part0` green against its new oracle.
3. No survey or sweep A/B is owed, because there is no switch.

## The JS arc's pins that move, and what it must wire

- **Roster:** one tape moved (`l40button-l42-part0`, 1,663 → 1,665 t) and one oracle recording
  (`expectations/l40button-l42-part0.json`). Roster 289, unchanged. Exposure is unchanged: the tape was already
  `R8_ENEMY_BRIDGE`-exposed since L40REREC, so `exposedAdded` stays 93.
- **Nothing to wire:** no new staging/result field, no new `SolverRefusal.obstacle.kind`, no `run.*` field changed.

## Handed to the hammer arc

Nothing. No code in its region was edited. `dashSpinnerForecast` (its hand-over 368) is exercised at its default, and
the game agrees with the walk it produces here at 0 px.

## What the brief got wrong (measured)

- **"l42-part0 1,663 t" is only the pinned walk.** At the defaults it is 1,665 t: +2, a small move, parting at t1310.
- **The identity block's "six `--check`s" are not six greens at the base.** At `1e17f44738`, four of them exit 1:
  `solve-seedling-r8-battery`, `-r8-d2-chain`, `-r8-l18` and `-r9-campaign`. For example, `-r8-l18`'s trace drifts
  (467 t solve). Their md5s are identical before and after, so they are base state and not this slice's.
  `ci-producer-checks.mjs` does not run them, so its "93 / 0 red" does not cover them.

## Trap candidates

- The identity block's producer rows can be red at a clean base (above). Diff the md5 before and after; do not read
  "exit 1" as your own red.
- `identity-block.sh <worktree>` needs a server for THAT tree on `SEEDLING_PORT` (default 8000). Without one it stops
  at its first browser row and prints only the first rows. The first BEFORE here had to be re-run.

## Residue

- `levelRun.js:13925`'s comment cites `l40button-l42-part0` at t972 from a walk two re-records old. It is not my region.
- `fidelityWandHold.test.js:168`'s comment describes WANDHOLD's own pinned leg-371 solve as 1663 ticks. With
  `dashSpinnerForecast` at its default that solve may now differ, but that row pins its own fidelity and floor and is
  green. It is not my region.
- The four base-red identity producers (above).

## Byte-inertia

- **Identity block.** Every data row is equal before and after (`evidence/identity-before.txt` vs
  `evidence/identity-after.txt`): maze, acceptance, pairs c3/c6/c4, ENEMY/guard/AREA censuses, killgate s2/s5/s9,
  levels pre/post-sword, and the six producer md5s with their exits. The differences are environmental only:
  - "generated set": the worktree has no venv; the head's venv has playwright 1.56 against the 1.63 pin;
  - the reference: the base worktree's symlinked submodules make 4 regions DIFFER, while the head reports ALL MATCH.
- **Bounded vitest:** md5 equal before and after.
- **Producer battery:** 0 red.
- **Default switches and solver output:** byte-identical, because no code path changed.
- **Licensed moves:** one tape, one oracle, one index row, and two row texts.

## Rows to BANK

- `l40button-l42-part0` **1,665 t**, damage on, p4g 0 px over 1,666 observations, 0 hits, part collected on the game
- `l40button-l41-part0` 1,601 t, unchanged (byte-identical at the defaults)
- roster 289; `R8_ENEMY_BRIDGE` exposed 93 (unchanged)
- bounded vitest md5 `0bb126bb567c2527315e4d8cab263315` (94 files / 3,348)
- tapeRunner rows md5 `2c250a93a2184d817c0c74284cb38505` (635)
- producer battery 93 / 0 red

## CI

This report is the LAST commit. It is read at its own head with `node scripts/procgen/ci-vitest-summary.mjs <head>
--wait`, and the result is in the session's final message.
