# AN-TIME-4: The Same Monday, the first timed ActionNodes preset (as-built)

Session `actionnodes-time4` (Opus), 2026-11-25, for planner `concept-library-content-planning-5`. Branch `an-time4`, base
`origin/an-time2` `72e73ccaeb` (AN-TIME-1 + AN-TIME-2, frozen). Code commit `6bd1d42021`; this report is the commit
after it, then the one merge of main (§ 8).

## 1. Robert's rulings and the mystery owner's answers

**Robert, 2026-11-25** (asked in this session; mystery-planning also asked and heard the same answers):
- Names: *"Yes, case names (Recommended)"*. The preset may be called The Same Monday and carry the case's visit
  labels and paper titles. Robert said the same to mystery-planning: *"Yes to names in the preset."*
- Items: the papers shuffled (mystery-planning's recommendation, agreed). Robert then asked: *"Would it make sense for
  this to be a configurable setting?"* I said each value can be built today as its own graph, but a switch between
  them is a format addition. He ruled *"Shuffled now, setting later (Recommended)"*: one preset with the papers
  shuffled, and the other value, *each visit keeps its paper*, in a follow-up slice with its own design check.

**mystery-planning** (uds `718286.sock`), quoted:
- On names: *"They have not been asked about a preset under the case's own name … I will not stretch a yes given
  for the fixture to the preset."* (Answered by Robert, above.)
- On structure: *"Unit: hour, whole units, no minutes. Day: 3 hours; in the story it runs from nine to noon on a
  Monday. No time windows at all in this version."* The five visits (id, label, cost, `after`, `needs.read`), as built
  in `cases/miniatures/same-monday/world/case.json`:
  - office: *Look over the harbour office*, 1 h;
  - inn: *Ask at the Ship inn*, 1 h;
  - watch: *Wake the night watchman at the ropewalk*, 2 h, after `[[inn]]` the same day, needs read inn;
  - pilot: *Ask the pilot about his key*, 1 h, needs read office;
  - chandler: *Call on Silas Finch at the chandler's*, 1 h, needs read pilot.
- On the goal: *"the one question, 'Who took the chart from the harbour office?' … What the answer needs, as papers:
  office AND inn AND watch."*
- On items: *"the unit that travels is the PAPER (the whole scene), not a fact. So: items = the five papers … each
  visit made = a location check, the five papers = the items, and the question solved = the goal location."* And:
  *"5 visit locations (plus the goal) and 5 papers, so there is no room for filler."*

I checked the case file myself at mystery-clue-game `7a9ae373c5`. The repository is public (`gh api` `private:
false`). Its five `files[].visit` entries and `delivery: {day: 3, unit: "hour"}` match the answer exactly.

## 2. The graph, and the copy decision

`frontend/modules/actionNodes/graphs/same-monday.json` (`graph_id` `same-monday`, name *The Same Monday*):

| Part | As built |
|---|---|
| Time | `clock` 09:00 at 60 min a unit; `pool: {name: "Time", unit: "h"}`; `loop.mana` 3 (nine to noon). Region XP off (the timed default) |
| Nodes | `monday` (start, *Monday Morning*); five checks, one per visit, with the case's labels and costs; the goal `question`, *Who took the chart from the harbour office?*, 0 h |
| `after` | `watch` after `[["inn"]]` (same day); every other node after the start |
| Gates | *needs read X* = `requires.stats: {X: 1}`; the stat `X` (*Read: <paper title>*) comes from the boon `paper-X` |
| Items | five boons, one per paper, named by the paper's title, `gives.mana: 0`; no filler, no extra hour |
| Provenance | `case` (the case file at `7a9ae373c5`), `an-time4` (the mapping, with Robert's approval) |

- **The format.** Only existing fields. The gate list's additions (`window`, `clock`, `knowledge`, `pool`,
  `substrate_state`): `clock` and `pool` are used. The case has no windows, and with the papers shuffled a gate is an
  item, not a knowledge flag. So **no `wait` and no knowledge gate occur in this world**. That overturns brief § Build
  4's *"a wait and a knowledge gate work"*. AN-TIME-2's rows still cover both on the fixtures (all green, § 5). For
  this preset the row proves the item gate instead.
- **The copy decision: keep `fixtures/visits-day.json`.** It is not a duplicate. It is the same case structure in the
  OTHER form: each visit teaches its own paper as a knowledge flag (a locked `Knows:` event), which is the
  *keeps its paper* value of Robert's setting. It pins the knowledge path that `an-time-knowledge-gate` and
  `actionTime*.test.js` exercise, and this graph does not. The two compile to different rules: the fixture's answer
  is `Has(Knows: Paper C)` with every visit `True`; here the checks are item-gated. Deleting either would lose a form.
  The AN-OMSI-2 precedent (delete the twin) applied there because the twin fed the same search. Here it doesn't.

## 3. The preset

- **Recipe** (the compile CLI; minimal-spoilers does not enter):
  `node scripts/procgen/action-nodes-compile.mjs frontend/modules/actionNodes/graphs/same-monday.json -o frontend/presets/action_nodes_same_monday/AP_1/AP_1_rules.json --seed 1`
- **Seed 1** fills on the **first attempt** (`action_logic.fill` absent). Seeds 1–8 all fill on attempt 1 with
  `--fill-attempts 1`.
- **What it compiles to.** 32 item combinations, at most 32 states each; 30,541 bytes. Rules:
  - the office and the inn: `True`;
  - the watchman: `Has(At the Ship inn)`, witness inn → watchman, 0 h left;
  - the pilot: `Has(The harbour office)`;
  - the chandler: `Has(The pilot)`;
  - the goal: `Has(The harbour office) & Has(At the Ship inn) & Has(The night watchman)`.

  Five spheres. The placements (seed 1): office → *At the Ship inn*, watchman → *The harbour office*, pilot →
  *The pilot*, chandler → *The night watchman*, inn → *At the chandler's* (useful, not progression).
- **Byte identity.** Compiling twice gives the same bytes (`cmp`), and the committed file is the recipe's output.
  The roster mode `--check` arrives with the merge (§ 8). Pre-merge `--check` (the example): byte-identical.
- **Registered** in `preset_files.json` as `action_nodes_same_monday`, name *Action Nodes The Same Monday*, folder
  `AP_1`, `seed: 1`.

## 4. The roster delta, before the merge

Measured at `6bd1d42021`, with the preset staged and committed. The full base → tip delta is measured after the
merge (§ 8), as the brief asks.

| Roster | Base (`72e73ccaeb`) → tip |
|---|---|
| `preset_files.json` | +1 key `action_nodes_same_monday`; nothing else moved (19 inserted lines) |
| `check-sidecar-fields.mjs` | documents 228 (59 with sidecars) → **229 (60)**; entries 2,433 → **2,440** (`action_nodes` 10 → 17); 0 issues, 38 warnings, 20 notices both sides |
| Substrates rows | +1 `an-same-monday-clock` (category ActionNodes → batch `fast`) |
| Spoiler / regression rows | none: the spoiler game comes from `--game`, and the regression config names no preset |
| Shipped / preserved-dev lists (`presetDefs.js`) | none: no pipeline preset def |
| Docs census | `action-nodes.md` gains `### The Same Monday` with no link, so the link census is unmoved (`procgenDocs/` green in the sweep). `README.md` and `docsIndex.js` regenerated |
| `presetDefs` | none |
| Producer `--check` roster | arrives with the merge (§ 8) |

**The sweep:** 453 default-tier files: the memory's grep sweep, plus `scripts/**/*.test.js`, `actionNodes/`,
`procgenPipeline/`, `procgenDocs/`, `quickLaunch/` and `tests/` whole, plus `sidecarFieldsRegistry.test.js`.
8,619 tests: 8,571 passed, 8 failed, in 19 files, none from this slice:
- 11 files: ENOENT on `flashPanel/wasm/builds.json` (this worktree has no `--with-wasm`), the known pattern;
- 8 files red under the parallel run, on a box at load 20–47. Re-run alone, 6 of the 8 passed. The other 2,
  `mapDocumentPath` and `probeSeedlingErRetarget`, need the same wasm `builds.json`, as AN-OMSI-2 and AN-TIME-1
  recorded.

## 5. The proofs

- **Spoiler.** `npm test -- --port=8130 --mode=test-spoilers --game=action_nodes_same_monday --seed=1`: **PASSED**.
  `sourceName: ./presets/action_nodes_same_monday/AP_1/AP_1_rules.json (source: urlOverride)`; `detailedResults`
  `passed: true`, `processedEvents 6 / totalEvents 6`, `testLogPath …AP_1_rules.json#sphere_log`.
- **Play.** `node scripts/procgen/action-nodes-play.mjs frontend/presets/action_nodes_same_monday/AP_1/AP_1_rules.json`:
  rc 0, 0.2 s. **3 loops** on every path (XP scale 1, XP scale 0, the live bot path):
  - loop 1: office, inn (the attempt at the watchman runs out of time);
  - loop 2: inn → watchman;
  - loop 3: pilot → chandler → the question, with 1 h left.

  The case's own shortest play is 2 days. The bot takes the most new checks per loop (A17), as AN-TIME-1 recorded on
  the fixture.
- **In the app** (served from this worktree on port 8130, which had no owner before and was stopped after):
  - the world loads in Loop mode, and the pool is **3 / 3**, not 100: AN-TIME-2 § 6's `loop.mana` fix holds on a
    committed preset;
  - the Resources line reads *Time: 09:00 · 3 h left · the day ends 12:00*, and the Loops bar *Time: 3/3*;
  - after one visit (the harbour office): *Time: 10:00 · 2 h left · the day ends 12:00*, the pool is exactly 2, and the
    queue is complete;
  - the cards show each paper gate (*needs Read: The harbour office 1 (has 0)*).
- **The row** `an-same-monday-clock` **PASSED**. It reads every number and name from the preset:
  - max pool = `loop.mana`;
  - the Time line at the start and after one visit;
  - the start gate refuses a paper-gated visit one hop from the start, naming *Read: The harbour office*;
  - the pool paid exactly the visit's time.

  My first version of the row picked the watchman, whose same-day `after` refuses first. That was the test's mistake,
  not a defect.
- **Every enabled `an-*` row plus `an-bot-plays-to-goal`: 18/18 PASSED.** That is the 17 existing rows, none of which
  changed status, plus the new one. `an-click-performs-once` logged a soft `STUCK` poll (*"the Map holds the row's
  click actions"*) and still passed. That poll is not in this slice's code.

## 6. Screenshots

`actionnodes-time4-shots/`, beside this file. `shots.mjs` re-shoots them: `node shots.mjs <worktree> <port> <outdir>`,
loading `?game=action_nodes_same_monday&seed=1`.

| File | What |
|---|---|
| `1-same-monday-at-load.png` | At load: the Resources Time line at 09:00, the Loops bar Time 3/3, the Region Graph with the start's six neighbours as cards (office and inn ready, green; pilot, chandler and the question blocked on their papers, orange; the watchman `???`) |
| `2-same-monday-mid-day.png` | After one visit: the Time line at 10:00 · 2 h left, the Loops bar 2/3, *Queue complete*, the harbour office card checked (1/1) |

## 7. Gates (local, before the merge)

- Gitlinks in the diff: 0.
- Closure ∩ diff = ∅: the maze engine closure is 43 lines, sha256 prefix `a3565f4e6866438e`, the same as AN-OMSI-2.
- `generate-procgen-reference --check`: all 7 modules and 5 regions match. `check-procgen-docs`: ALL CHECKS PASSED.
  `check-sidecar-fields`: ALL PASS (§ 4).
- Bounded vitest: the 453-file sweep (§ 4). No local unfiltered run (ruling 52). pytest was not run, so there was no dirt.

## 8. The merge of main

(pending the planner's main SHA: the merge, the producer `--check` roster at 3 presets, the base → tip delta, and the
CI at the final tip.)

## 9. Not in this slice; next

- **The setting** *each visit keeps its paper* (Robert: *"setting later"*). The knowledge form is the `visits-day`
  fixture's. Choosing between the two forms is a format or compiler addition and needs its own design check.
- **The mystery page's bridge** (mystery-planning, 2026-11-25, after Robert made connecting visits the priority):
  - it wants `slot_data.mystery = {story, version, case, goal, locations, items}` on this world;
  - it wants a version hash from a generated case export;
  - it wants `loop` in `mystery:state`.

  The ActionNodes compiler writes no `slot_data` today, so all three are a follow-up slice. Facts I gave them:
  - the goal IS an ordinary location (id 40000005, locked, holding *Victory*);
  - the five paper item names;
  - the runtime's `loopNumber`.
