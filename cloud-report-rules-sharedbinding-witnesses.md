# cloud report — rules-sharedbinding-witnesses

Branch `claude/rules-sharedbinding-witnesses-er71b3`. `git merge-base HEAD origin/main` = **0885fec4b3642634e011cfe2e090a301c8c45d0e** (R-A3).
Planner: `seedling-rules-planning-5`. ⚖ user 2026-11-04 "(c) after R-A3 lands"; rules-4's R-A3 ruling (c).

## Verdict

- **Witnessed:** all three bindings on the game, p4g (the default build), headless logic-only, **8/8 per arm**.
- **Re-admitted:** two of the three rows.
  - `L76 → L71 r0c6` (L71 flag 2).
  - `@L63 flag 1` at `L61 r0c10`.
- **STOPPED: the third row, `L65 r0c2 → L63 r10c2` (L63 flag 6).**
  - Its binding IS witnessed.
  - Admitting the row moved AP_1's bytes (details below), which the brief stops on.
  - It is held out as a named `TABLE_EXCLUSIONS` entry, with its reason, pending a ruling.
- **No binding was wrong.** No producer event-layer defect was found.
- **Byte identity:** AP_1, the playthrough atlas, the partition, `worlds/seedling_playthrough/`, the seed-1 preset (sphere log, spoiler, rules, `.archipelago`) and the maze preset are all **byte-identical to main**.

## 1. Witnesses (game first)

House pattern: `probe-seedling-cleartag.mjs` gets a new set, `--set=bindings`, beside `--set=crossroom`.
- Each witness is the solver's own `clear-tag` plan on the event's flag, with the event's own obstacle and presser.
- Each runs as three arms on fresh pages:
  - the solve;
  - the cut at the model's write tick T;
  - the cut at T+1.
- New check per arm: the **event-layer** flags in the game's `persistence_cleared` must be EXACTLY `[the bound event]` after the write, and `[]` before it. The layer is the compiled `seedling_playthrough` AP_1, `flag:L<l>:<t>` event ids.
- New `--repeat=N`: every arm runs N times, each on a fresh page.

Run: `node scripts/procgen/probe-seedling-cleartag.mjs --set=bindings --repeat=8 --record=frontend/modules/seedlingDemo/fixtures/binding-witness/oracle.json`
→ **360 PASS / 0 FAIL, ALL CHECKS PASSED** (6 m 28 s).

| event | entity / verb | witness | solve | cut T | cut T+1 | other writes |
|---|---|---|---|---|---|---|
| L71 flag 2 | `shieldlock@288,256`, shield touch (the CLEARTAG witness `L71-2-from-L80`) | boot L71 (224,288) | 8/8 | cut-164 8/8 | cut-165 8/8 | none |
| L63 flag 6 | `lightpole@48,272`, one Spear thrust E (`inRoomPoleThrust`, plan-only) | boot [2,16] (32,256) | 8/8 | cut-18 8/8 | cut-19 8/8 | none |
| L63 flag 1 | L61 `buttonroom@176,40` {room 63, tset 1}, cross-room press | L62→L61 landing (160,16) | 8/8 | cut-16 8/8 | cut-17 8/8 | `{61,1}` (the button's own tag; no event of the layer reads it) |

Every run's game stream equals the model's (worst 0 px), and its transitions match.

The L63 f6 witness boots at the pole's north side, not at the L65 arrival [2,18]:
- From the arrival the pole is out of reach. `probe-seedling-l63-darktrap.mjs`'s `left-arrival-thrust-e` already measured this, and the solver also refuses there (darktrap@32,272 on the corridor).
- The binding question is "does lighting this pole write {63,6}", and that is answered from [2,16].
- Consistent with this, the derivation labels `@L63 flag 6` at `r10c2` as **arrival-dependent**, so it is not exact and not admitted.

`plan-seedling-binding-witness.mjs` (new) writes the tapes (`fixtures/binding-witness/<key>.json`) and the **ledger** `scripts/procgen/seedling-binding-witnesses.json` from the recording.
- Each ledger entry gives: the event, the flag, the entity, the verb, the witness script/key/tape, and the recorded build, repeat, write tick, runs per arm and unbound writes.
- `--check` does four things, and exits 1 on any drift:
  - re-solves each tape and requires it byte-identical;
  - replays the committed tape in the model and requires that it writes exactly the bound event;
  - holds every recorded run to the model's stream;
  - re-derives the ledger byte-for-byte.
- Result: **all checks green.**
- The tapes are kept out of `fixtures/tapes/` so that they do not enroll in the differential's tiers.

## 2. Re-admission mechanism (DATA)

Files touched, beyond the new witness files (`fidelityBindings.js` + test, `plan-seedling-binding-witness.mjs`, the ledger, `fixtures/binding-witness/`).

**`frontend/modules/mazeRoom/tileSpike/derivedRuleRows.js`** (27 diff lines; ⚠ designer review):
- `labelDerivedRows(rows, {…, witnessed = []})`:
  - An element ALL of whose events have a ledger entry gets `bindingWitnessed: {by: 'gameWitnessLedger', events}` instead of `sharedBinding`.
  - A ledger event that the document does not place throws `(stale)`.
  - With no ledger, nothing is re-admitted.
  - No level literals.
- `summarizeDerivedRows` gains `bindingWitnessed` (a count).
- `derivedRuleTable`:
  - An admitted EVENT-location row carries `event: true`. This was found by running the producers: `@L63 flag 1` is the first event location the table has ever admitted, and `applyDerivedRuleTableToAtlas` refused it, because event locations are minted by the event layer at compile time and have no atlas row.
- ⚠ This file is NOT in the certifier's import closure, so `engineMd5` is unchanged (`0855f01173…`).

**`scripts/procgen/seedlingDerivedRuleTable.js`:**
- `WITNESS_LEDGER` and `readBindingWitnesses()`.
- `tableInputs` gains `witnessMd5`, so a ledger edit stales the table (guard 3, `derivedRuleTableFresh.test.js`).
- `applyDerivedRuleTableToAtlas` skips `row.event` rows. The compiled-document override stays strict and holds them. A plain location row that the atlas lacks is still refused.

**`scripts/procgen/probe-seedling-derived-rules.mjs`:**
- Reads the ledger. A `--levels` run keeps only the entries its document places.
- One new named `TABLE_EXCLUSIONS` entry (§4).

**`fidelityClearTag.js`:** `clearTagSolve` honours a witness's planning switches (`w.fidelity`, via `withContactFidelity`). No solver, levelRun or `CONTACT_FIDELITY` change.

**Pins in `derivedRuleOverride.test.js`:**
- re-admission;
- the mutant that drops the ledger restores the exclusion;
- an element with one witnessed and one unwitnessed event stays excluded and names both;
- a stale ledger entry throws;
- an event-location row carries `event: true`;
- the atlas pass skips an event row and refuses a plain missing row.

## 3. Regenerate and re-pin

Table regenerated by `probe-seedling-derived-rules.mjs`, run **locally** (whole game, `--shards=3`; the box has 4 vCPU and 15 GB). It was not run through the CI dispatch.
- Final run at 75f4cfd8cc: `PASS: the derived-rule table matches …` and `PASS: every pinned count matches …`. The certifier is unchanged (1 problem / 17 accepted / 0 threw, 731 rows).
- The planner may dispatch `seedling-probe.yml -f probes=probe-seedling-derived-rules.mjs` to confirm it on CI.

Table: rows **127 → 129**, excluded **12 → 10**, regions 60 → 60.
- ADDED rows: `level_76|level_76 -> level_71__r0c6` and `level_61__r0c10|@L63 flag 1: lightpole@64,88 cleared` (`event: true`).
- REMOVED or CHANGED rows: none.
- `inputs`: `payloadMd5` and `engineMd5` unchanged; `witnessMd5` added.

Every drifted count of `seedling-derived-rules-expected.json`, with its reason:
- `sharedBinding` **141 → 127**: 14 elements name only the three witnessed events. Of those 14:
  - 3 are exact: the 2 rows above and the 1 named exclusion in §4;
  - the other 11 are not exact (all with `bindingWitnessed`; none was a table row):
    - arrival-dependent: L63 r0c1 ×4, L63 r10c2 → L61 r13c12, @L63 flag 6, L71 r16c19 → L76;
    - path-vs-edge pairs: L71 r0c6 / r13c7 > r16c19;
    - derived but not overridable: L63 r10c2 → L65 r0c2, @L71 flag 2.
- `bindingWitnessed` **14** (new key, pinned).
- `table.rows` **127 → 129**.
- `table.excluded` **12 → 10**: 3 elements left sharedBinding, and 1 named exclusion was added.
- Every other pinned count is unchanged.

Producers re-run in order:
1. `make-seedling-playthrough-rules.mjs`
2. `make-seedling-subregion-partition.mjs`
3. world_generator (`-o worlds/seedling_playthrough --game-name "Seedling Playthrough" --force --canonical-seed 1`)
4. Generate.py seed 1 (minimal-spoilers)
5. `make-seedling-playthrough-maze.mjs`

md5 before and after, all identical:

| file | md5 |
|---|---|
| AP_1_rules.json | `e4020557666fd52463451a666cda70c4` |
| seedling-playthrough.json (atlas) | `45f28a9ffc9aa1f0a59aa304d3fe9a1a` |
| seedling-subregion-partition.json | `9510bc4beb8221437bbde75805a8060e` |
| seed-1 sphere_log.jsonl | `16480af092fc97aafecf55392d45e821` |
| seed-1 Spoiler.txt | `3480e98e5bf7f60e48149d747e368bc1` |
| seed-1 rules.json | `e405d50b663cb338e91dffd43d33bacd` |
| seed-1 .archipelago | `912e6216409ba3723c6203e043f13e06` |
| maze preset AP_1_rules.json | `c7fbeefa8e2c0c0e83608d28c7123696` (no diff at all: the preset embeds neither the table nor its md5) |
| worlds/seedling_playthrough/* | all identical |

## 4. ⛔ STOP — `level_65__r0c2 -> level_63__r10c2` (L63 flag 6)

With this row admitted, AP_1 moved by 2 lines.
- The table writes the derived `And` in the derivation's child order, `(Ghost Spear, Ghost Sword Fusion, Progressive Sword)`. The composition's order is `(Ghost Sword Fusion, Ghost Spear, …)`.
- The two are truth-table equal: `compareRules` returns `equal`, which is why the row is EXACT.
- The same move shows up in `worlds/seedling_playthrough/Rules.py` as `HasAll('Ghost Spear', 'Ghost Sword Fusion', 'Progressive Sword')` (reordered).
- **Measured with the row admitted:** all 4 seed-1 files byte-identical.
- I reverted those bytes and named the row in `TABLE_EXCLUSIONS` with the reason.

Options for the ruling:
- **(a) Accept the reorder.** Drop the exclusion, then regenerate the table, AP_1, the world and the maze. AP_1 moves 2 lines, Rules.py moves 1 line, and seed 1 is identical.
- **(b) Have the override keep the composed bytes when `compareRules` returns `equal`.** This is a `seedlingDerivedRuleTable.js` change that affects every row, so it needs designer review.

## Gates

- **Bounded vitest: 95 files, 1699 passed.** The files:
  - every test I touched;
  - every default-tier test that reads the playthrough atlas, the maze preset, AP_1, the partition, the table or the derived-rules modules;
  - `boxLock.test.js`, `noNewDocsReferences.test.js`, `checkProcgenHelp.test.js`, `seedlingConstantsCensus.test.js`, `derivedRuleTableFresh.test.js`, `derivedRulesProbe.test.js`, `fidelityClearTag.test.js`, `fidelityCrossRoom.test.js`, `fidelityLightPole.test.js`.
- `census-seedling-constants.mjs --write`: no change. Its census test passes.
- `generate-procgen-reference.mjs`, then `--check`: **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH** (525 instruments after the new script).
- Producer `--check`, all exit 0: `make-seedling-playthrough-rules.mjs`, `make-seedling-subregion-partition.mjs`, `make-seedling-playthrough-maze.mjs` and `plan-seedling-binding-witness.mjs`.
- Dirt: Generate left `preset_files.json` and `frontend/presets/apquest/` untouched. No pytest was run.
- Not touched: `worlds/seedling/`, `vendor/seedling`, `.github/`, any submodule pointer, and any `NewDocs` string.

## Notes

- The bootstrap's `pip` step FAILED (`bsdiff4 1.4.1` vs `==1.2.6` VersionConflict in `ModuleUpdate`). world_generator and Generate.py still ran fine.
- `tile-l12-one-world` also regenerates this table. Whichever slice lands second must re-run the probe; this slice's three verdicts are independent of L12.
