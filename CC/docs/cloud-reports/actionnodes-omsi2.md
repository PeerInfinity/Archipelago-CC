# AN-OMSI-2 — omsi-loops' first town as a playable ActionNodes graph and preset (as-built)

Session `actionnodes-omsi2` (Opus), 2026-11-24, for planner `concept-library-content-planning-5`. Branch `an-omsi2`,
based on `origin/an-omsi1` `6e51634ff6` (AN-OMSI-1, frozen, queued to land). Code commit `00000c593e`;
this report is the commit after it.

**Robert's rulings.** The town's numbers, Q1–Q5 as recommended (2026-11-24, just before 17:22:27Z). Q6, commit the
preset, which lands alone. The slice: "AN-OMSI-2: graph + preset (Recommended)" (just before 19:04:09Z). AN-OMSI-3
(rows) waits for a replan. This slice adds no hand-written row.

## 1. The graph, and the fixture decision

`frontend/modules/actionNodes/graphs/omsi-first-town.json` (`graph_id` `omsi-first-town`, name `Beginnersville`)
has 20 nodes: the start, 18 checks and the goal Start Journey. It also has 5 stats, 3 resources, and 18 items
(8 boosts + 10 Soulstones).

- **Numbers.** The nodes and boons are the AN-OMSI-D draft as ruled: `gen_graph.py SUPPLIES=6`. They were compared
  node for node against the draft and match exactly.
- **Provenance.** It is in the graph's own block, because no omsi content pack was asked for.
  - `omsi` (`game`, `PeerInfinity/omsi-loops` @ `a636e9a410`).
  - `an-omsi-d` (`model`, the mapping, with the Q1–Q6 approval).
  - `left-out` (the six omsi actions left out, and what was dropped).
  - `buy-supplies-6` (Q5) and `haggle-folded` (C4), cited by those two nodes' `src`.
- **Description.** The format has no description field. `TOP_FIELDS` is fixed, and adding one would be a format
  change, so the left-out list lives in the `left-out` provenance note. It is also in `action-nodes.md` § *The omsi
  town*. Nothing references `NewDocs/`.
- **Format.** No format change. C1–C6 were not needed, as the design said.

**The fixture: DELETED, so there is one copy.** `actionNodesTownScale.slow.test.js` now loads `graphs/omsi-first-town.json`.

Why delete it rather than keep a frozen copy with a pin:
- A frozen twin would let the town-scale pins (the cone budget, the fill retry) measure a graph that no longer ships.
- The only differences were `graph_id`, `name`, provenance and two `src` tags, and none of them feeds the search or
  the fill. Measured: the fixture and the shipped graph, compiled at seed 3, have equal `canonical_placements` and an
  equal `sphere_log`.
- So every AN-OMSI-1 pin carries over unchanged. The slow file passes: 11 tests, including seed 1 recording
  `fill: {attempt: 2}`, 6 of 20 seeds filling on attempt 1, and the bot at 7 and 8 loops.

## 2. The preset

- **Recipe.** It is the example's recipe (the compile CLI, no Generate.py; minimal-spoilers does not enter):
  `node scripts/procgen/action-nodes-compile.mjs frontend/modules/actionNodes/graphs/omsi-first-town.json -o frontend/presets/action_nodes_omsi_town/AP_3/AP_3_rules.json --seed 3`
- **Seed 3** fills on the **first attempt**, so `action_logic.fill` is absent. The other first-attempt seeds in 1–20
  are 4, 11, 12, 18 and 20.
- **What it compiles to.** 1,188 item combinations, at most 10,554 states each (budget 200,000). 8 spheres, ending
  Buy Supplies → Start Journey. 410,533 bytes.
- **Registered** in `preset_files.json` as `action_nodes_omsi_town`, name "Action Nodes Omsi Town", folder `AP_3`,
  `seed: 3`. The `seed` field is what `?seed=` matches. `findRulesFileFromGameSeed(index, 'action_nodes_omsi_town', '3')`
  returns its own path, and the example still resolves to its own.
- **The producer `--check` (enrolled).** The CLI's no-graph mode recompiles **every committed ActionNodes preset by
  its own recorded recipe**, so it now covers both presets.
  - The roster is derived, not listed. It is every `preset_files.json` folder whose game is Action Nodes. For each one,
    the rules file supplies `procgen_metadata[p].graph_path`, `generation_seed` and `provenance[p].exists`.
  - A rules file with no compiler recipe is a red, not a skip.
  - `ci-producer-checks.mjs` enrols the CLI by name (a 4th glob entry). The workflow comment is updated, including the
    one submodule its import closure needs: `shared/`, measured, already checked out by that job.
  - `-o`/`--seed`/`--exists` without a graph are refused, because the roster mode uses each preset's own recipe.
  - The default-tier pins in `actionGraphCompiler.test.js`:
    - the roster derives the example's recipe exactly;
    - the set of rosters' graphs equals the set of `graphs/*.json`;
    - each preset is byte-identical to its recipe;
    - each preset's `preset_files.json` seed equals its compiled seed and its folder is `AP_<seed>`.
- **Byte identity at the tip:**
  - `node scripts/procgen/action-nodes-compile.mjs --check`: OK, both presets byte-identical. `--fill-attempts 1`: OK too.
  - `ci-producer-checks.mjs --only=action-nodes-compile`: rc 0, 3.6 s.
  - `action_nodes_example` is byte-identical and not in the diff.

## 3. The roster delta, base (`6e51634ff6`) → tip

**How it was measured.** The sweep ran at the tip with the preset staged. The sweep was the memory's grep sweep,
`scripts/**/*.test.js` whole, `procgenPipeline/` and `actionNodes/` whole, and `sidecarFieldsRegistry.test.js`:
428 default-tier files.

The base was emulated the same way: the preset was unstaged and moved aside, and `preset_files.json` was put back to
the base. Test names and statuses were then diffed. ⚠ My first base emulation left the preset in the index, and
7 files that walk `git ls-files` hit ENOENT. Those 7 were re-run against a true base (unstaged).

| Roster | Base → tip |
|---|---|
| `preset_files.json` | +1 game key `action_nodes_omsi_town` (folder `AP_3`, seed 3). No other entry moved |
| committed presets read by `jsonSchemaCheck.test.js` | "all **227** of them" → "all **228** of them" (the only test whose NAME moved) |
| `actionGraphCompiler.test.js` (this slice's own pins) | +5 tests in a new describe: the roster row, then byte identity and the seed field for each of the 2 presets. The example's older rows are unchanged |
| `check-sidecar-fields.mjs` | documents 227 (58 with sidecars) → 228 (59); entries 2,424 → 2,444, `action_nodes` 10 → 30; 0 issues, 38 warnings, 20 notices both sides |
| `sidecarFieldsRegistry.test.js`, `ruleItemNames`, `ruleTreeSlots`, `slotInitialise`, `sidecarRuleAgreement`, `menuMarker`, `textAdventureRegionRoundTrip` (walk `git ls-files` presets) | read the new preset; test count and status unchanged (249 tests, 0 failed, both sides) |
| Producer --checks (`ci-producer-checks.mjs`) | +1 row `action-nodes-compile` (it was not enrolled at base: its `--check` ran only as the vitest pin) |
| Shipped / preserved-dev pipeline preset lists (`presetDefs.js`) | none: no pipeline preset def added. `procgenPipeline/` whole and `presetDefs.generate.slow` are green |
| test-all-templates rows | none: ActionNodes has no template or world-mapping row |
| Spoiler / regression rows | none in any config. `playwright_tests_config-spoilers.json` is the one panel row, and the game comes from `--game`. The regression config does not name presets |
| Substrates rows (`playwright_tests_config-substrates.json`) | none. No `an-*` row changed status or count; the in-app ActionNodes rows load the example by path |
| In-app preset walkers (`apworldEditorTests.js`) | none. `p1bTwoSlotSubject` takes multi-game folders only. The bare-preset picker at line 12479 skips any preset with `preset_sidecars`, and this one has them |
| Docs census | `action-nodes.md` gains § *The omsi town* (one new heading + an in-page link). `generate-procgen-reference.mjs` regenerated `README.md`, `docsIndex.js` and `instruments.js` (the CLI's help text). `--check`: all 7 modules + 5 regions match. `check-procgen-docs.mjs`: all passed. The link census pins moved **452 → 453** (`same-doc` 46 → 47) in `docLinks.test.js` and `docsRender.test.js`, each with its line of history. My sweep did not include `procgenDocs/`; the first run there caught both (the known `feedback_bounded_vitest_misses_docs_pins` trap) |
| Fixture | `frontend/modules/actionNodes/fixtures/omsi-first-town.json` deleted (the directory with it) |

**Reds in the sweep, all environmental (none from this slice):**
- 13 files need `frontend/modules/flashPanel/wasm/builds.json`: the worktree was made without `--with-wasm`, the known
  pattern. They are red at base and at tip.
- 2 files hit `STACK_TRACE_ERROR` under the parallel run: `seedlingLogicalLinks`, `certifyEventLocations`. Each was
  green alone (53 passed).
- Base-only flakes that were green at the tip: `provenance`, `seedlingMountKeyLevelSet`, `topDownStartShape` and
  `mazeInputOutputSplit`.

## 4. Gates (local)

- Closure ∩ diff = ∅. The maze engine closure is 43 lines, sha256 prefix `a3565f4e6866438e`, the same as AN-OMSI-1.
- Gitlinks: 0.
- `ci-producer-checks.mjs`, the whole battery: see § 7.
- `check-sidecar-fields.mjs`: ALL PASS.
- `generate-procgen-reference.mjs --check`: match.
- `check-procgen-docs.mjs`: all passed.
- Bounded vitest: the 428-file sweep above (including `actionNodes/` whole); the slow `actionNodesTownScale` +
  `presetDefs.generate` (38 passed); `procgenDocs/` (497 passed after the census pins); `quickLaunch/`,
  `ciDocsOnly.test.js` and `actionNodes/` again after the last edit (20 files, 290 passed). No local unfiltered run (ruling 52).
- pytest was not run, so there was no dirt.

## 5. The spoiler and play proofs

**Spoiler.** `npm test -- --port=8130 --mode=test-spoilers --game=action_nodes_omsi_town --seed=3` PASSED.
- It loaded the right preset: `sourceName: ./presets/action_nodes_omsi_town/AP_3/AP_3_rules.json (source: urlOverride)`.
- `detailedResults`: `passed: true`, `processedEvents 20 / totalEvents 20`, `testLogPath …AP_3_rules.json#sphere_log`
  (the embedded log).

**Play.** `node scripts/procgen/action-nodes-play.mjs frontend/presets/action_nodes_omsi_town/AP_3/AP_3_rules.json`
ran at the default budget: rc 0, 12.9 s.

| | Loops to Start Journey |
|---|---|
| XP scale 1 | **7** (the design measured 7) |
| XP scale 0 | **8** (the design measured 8) |
| Live bot path (`playLiveToGoal`, the real runtime gate) | 7 |

At XP scale 0, the last loop is Wander → Pick Locks ×2 → Meet People → Short Quest ×2 → Buy Supplies → Start Journey,
with 67 mana left.

## 6. Screenshots

These are in `actionnodes-omsi2-shots/`, beside this file. The app was served from this worktree on port 8130 (no
owner before; stopped after) and loaded with `?game=action_nodes_omsi_town&seed=3`. They show the Region Graph panel
at full viewport. There were 0 page errors.

| File | What |
|---|---|
| `1-town-at-load.png` | The first load. Beginnersville and its 7 neighbours with their cards: Wander and Smash Pots ready (green); Fight Monsters, Heal The Sick, Small Dungeon, Haggle and Buy Supplies blocked (orange). `???` marks the rest |
| `2-town-all-revealed.png` | Every node revealed |
| `3-loop-midway.png` | One loop mid-way: Wander, Smash Pots ×3, Pick Locks, Buy Glasses, Meet People and Short Quest done. Train Strength shows "not enough mana" and Investigate "needs Met 1 (has 0)". The items from those checks are counted (Combat 1) |
| `4-card-buy-supplies.png` | The exit cluster's card: needs Combat 2, Magic 2, Gold 6; "needs Combat 2 (has 1)" |
| `4-card-warrior-lessons.png` | A card not reached yet (Investigate not cleared this loop) |

## 7. CI at the tip

PENDING (filled in by the next commit's text, or the planner's report back; a commit cannot quote its own runs).

## Next

AN-OMSI-3 (an in-app row on the town, and a Playback Bot row pinned at 7 loops), after the replan.
