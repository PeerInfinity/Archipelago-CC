# region-block-double-class: Regions panel double class + removing unsupported presets

Local slice, coordinator `seedling-js-planning-15` (js-15). Base `efbeb33501`. Branch `region-block-double-class`.

⚖ **Robert, 2026-11-01** (verbatim, relayed by js-15): *"I want to launch a session to fix it, and also to remove the
presets for games that we can't support, like Zillion.  We should also add them to the template exclude list if
they're not there already."*

## Part 1: the double class

**Cause.** `frontend/modules/regions/regionBlockBuilder.js` carried `evaluateRule(...)` straight through `&&`. For an
UNDETERMINED rule that value is `undefined`, and `classList.toggle('accessible', undefined)` is a plain toggle under the
DOM spec (an omitted/undefined `force`). So a fresh row got `accessible` from the toggle *and* `inaccessible` from
`!undefined`. The row's own status text (`Locked` / `Blocked`), red border and click gating already read `undefined` as
falsy. Only the class pair disagreed.

**Presentation chosen: undetermined = "rule not met" → exactly `inaccessible`.** This matches the Locations panel
(`locationUI.js` `doesLocationRuleEffectivelyPass = result === true`) and the spoiler comparison (`comparisonEngine.js`,
`=== true`). The Exits panel's gray `unknown-accessibility` state was the one alternative. It would have been a new row
state for this panel (CSS, text and colorblind glyph), so it was rejected. js-15 accepted this choice at the handshake.

**Fix.** A new exported `ruleMet(result) => result === true` wraps the four evaluation sites (entrance, return exit,
exit, location), so every flag that reaches `classList.toggle` is a real boolean. No per-game code.

**Colorblind.** The rows carry no colorblind glyph of their own. The ✓/✗ on a row's region link comes from region
reachability, not the rule verdict, so the change cannot draw a wrong symbol. No assertion was added; there is nothing
on the row to assert.

### Pins
`frontend/modules/regions/regionBlockBuilder.undetermined.test.js` (7 rows). It builds rows through the REAL
`addEntrances` / `addExits` / `addLocations`, with rules going through the REAL `evaluateRule` + `createSnapshotInterface`.
The DOM is a stand-in whose `classList.toggle` follows the spec, `force === undefined` included; a control row pins that
the old expression gives both classes on it. The fixture has an undetermined, a met and a not-met exit and location,
plus an undetermined entrance.

| Mutant | Result |
|---|---|
| all four sites back to `x = evaluateRule(...)` | 4 red |
| entrance site only | 2 red |
| exit site only | 2 red |
| location site only | 2 red |
| return-exit site only | 0 red: **equivalent**. `returnExitAccessible` feeds only `if` / `&&` reads (status text, border, clickability), never a toggle, so `undefined` and `false` render the same. `ruleMet` stays there for consistency. |

### Census (before / after)
- Every committed `frontend/presets/**/AP_*_rules.json` (**224 files**), every player in each, at **empty** inventory
  (as loaded) and **full** inventory (every item placed for that player added). That is **472 runs, 0 errors**.
- Method: a real `StateManager` + `getStaticGameData` + `createSnapshotInterface`. Every region goes through the real
  builder methods, once with the base (`efbeb33501`) `regionBlockBuilder.js` and once with the fix, and the census
  counts `<li>` rows that carry both classes.

| | double-class rows |
|---|---|
| before (`efbeb33501`) | **763** across 13 preset folders |
| after (this branch) | **0** |

Before, by preset folder (max over players and inventories): lingo 155 (62 at empty) · zillion 147 · smz3 50 · alttp ×3
seeds 20 each · alttp_vanilla 20 · procgen_topdown AP_7 / AP_8 / AP_9 20 each · pokemon_rb 4 · multiworld
AP_01043188731678011336 3 / AP_84719271504320872445 1.

This census renders rows; js-14's 2026-10-31 scan evaluated rules. Their counts differ for that reason. Zillion's 147
agrees exactly. This census also counts entrance rows, and found lingo and pokemon_rb, which js-14 did not list. It did
not find alttp_worldgen / alttp_vanilla_worldgen, which js-14 did.

Command (the script is kept in scratch, not committed, on js-15's instruction): copy `census.test.js` into
`frontend/modules/regions/zz-census.local.test.js`, write the base builder next to it with `git show
efbeb33501:frontend/modules/regions/regionBlockBuilder.js > frontend/modules/regions/regionBlockBuilder.census-before.js`,
then run `npx vitest run frontend/modules/regions/zz-census.local.test.js` (21 s). It writes `census.json`. Delete both
temporary files afterwards.

## Part 2: removals

### Zillion (ruled by name)
- Deleted `frontend/presets/zillion/AP_14089154938208861744/` (5 files).
- Removed the `zillion` entry from `frontend/presets/preset_files.json` and `preset_files.live.json`.
- **Added `Zillion.yaml` to `generation_exclude_list`.** It was already on `main_test_exclude_list` (spoiler and
  multiclient tests, and worldgen generation) and in conftest's `UPSTREAM_WORLDS`. But base preset generation
  (`generate_all_templates.sh:436`) applies only `exclude_list` + `generation_exclude_list`, so a preset regen would
  have recreated it. Verified: `list-template-files.py --exclude generation_exclude_list` no longer lists it.
- Untouched: `worlds/zillion`, its `world-mapping.json` entry (the upstream world), docs and test-results history, and
  `generate_full_multiworld.sh` (it already excludes Zillion).
- Derived rosters: no test config, roster or workflow names zillion (`grep -a` over `frontend/test-configs`,
  `scripts/test`, `frontend/modules/tests`, `.github`, `test`). The suites that enumerate presets by directory or index
  are green after the removal: ruleKindCensus, presetIndexGuard, presetResolver, presetUI, sidecarFieldsRegistry,
  presetRun, tutorialPresetsLive, standingValues, check-worldgen-package-sidecars, applyPostPresetMerge,
  messageHandler.connect / serverBuild, plus `test/test_python_tests_needed.py`.

### Other candidates: Robert's ruling
The measured list went to `user-decisions-liaison`. ⚖ **Robert, 2026-11-01**, relayed verbatim:
- (a) SMZ3: *"Remove SMZ3, and either retire the test or find a better preset to use for it."* He typed this himself
  rather than choosing "remove, keep as fixture", so SMZ3's rules.json was **not** re-homed as a fixture.
- (b) everything else: *"Keep all (Recommended)"*.

| Game | Undetermined rows | Evidence | Outcome |
|---|---|---|---|
| Zillion | 147 (empty and full) | upstream; zilliandomizer logic; already on main_test_exclude_list | **removed** (named in the brief) |
| SMZ3 | 50 (empty and full) | upstream; Progression model, no port (ruling 2026-10-21); spoiler fails at sphere 0; on main_test + ut_fuzz excludes | **removed** (ruling a) |
| Lingo | 155 (62 at empty) | spoiler-minimal + multiclient pass 156/156; on worldgen_test_exclude_list only | kept (b) |
| ALTTP ×3 + alttp_vanilla | 20 each, full inventory only | flagship; its spoiler test gates CI | kept (b) |
| procgen_topdown AP_7/8/9 | 20 each, full inventory only | our procgen world | kept (b) |
| Pokemon Red and Blue | 4, full inventory only | excluded from main tests for slowness only; an apworld test corpus | kept (b) |
| multiworld ×2 | 3 / 1 (player 2, full) | multiworld presets | kept (b) |

### SMZ3
- Deleted `frontend/presets/smz3/AP_14089154938208861744/` (5 files) and both `preset_files` entries.
- **Added `SMZ3.yaml` to `generation_exclude_list`**. Same reason as Zillion: it was on `main_test_exclude_list`, which
  base preset generation does not apply.
- **The stale-progression row is RE-CORED, not retired.**
  - `apworld-a-stale-progression-member-is-shown-and-removable` now loads `procgen_topdown/AP_7`.
  - A scan of every committed preset's `progression_mapping` found four documents with stale members: smz3 (12) and
    procgen_topdown AP_7/8/9 (10 each).
  - AP_7's stale members are the same shape smz3's were. They are progressive entries whose level members name resolved
    forms the slot's `items` does not hold (`Progressive Sword` → `Fighter Sword`…), and every one sits in a card with
    another member, which the row's removal step needs.
  - So the row drives the same editor path: draw and mark, count, remove as one op, undo, keep-edit accepted, and the op
    refusing an added unknown name. Its expectation is derived from the document.
  - AP_7 is the same size as smz3's (1.9 MB) and no other row uses it.
  - The row's comment, its description and the config `_comment` now say AP_7 / 10 members.
- What only smz3 had: the 13 committed members carrying `provides`. No committed preset now carries one. The
  round trip of `provides` stays pinned by the hand fixture in `rulesDocOps.test.js`, which never read the preset.
- Stale prose, left as history: `hubExits.test.js` quotes smz3's H2 byte size (a literal, no file read), and
  `docs/json/modules/apworldEditor.md` describes the I2 corpus with smz3's counts.
- Untouched: `worlds/smz3`, its `world-mapping.json` entry, and `smz3Logic.js`.
- `list-template-files.py --exclude generation_exclude_list` lists neither Zillion nor SMZ3.

## Bounded vitest
`frontend/modules/regions/` 7/7. At the final tip, the preset-enumerating set above plus `apworldEditor/hubExits`,
`apworldEditor/rulesDocOps` and `frontend/modules/tests/`: 21 files, 541 tests, green. ruleKindCensus shows no gap drift.
`seedlingPlaythroughExportLoad.test.js` fails to load because `flashPanel/wasm/builds.json` is missing. That is the
known red in a worktree created without `--with-wasm`; this change does not cause it.

## CI
All runs below are at code tip **`0ef02ce14b`** (headSha verified). The report commit after it is docs-only.

| Run | Id | Result |
|---|---|---|
| JSUT (push) | 41352683382 | ✅ |
| unittests (push) | 41352683405 | ✅ |
| fresh TT (dispatch) | 41352682400 | ✅ (all 9 jobs, including the apworld batch, which the on-push path filter ran) |
| substrates manual, `batch=apworld` | 41352684695 | ✅ |

`apworld-a-stale-progression-member-is-shown-and-removable` PASSED on AP_7 in both apworld legs (1.4 s and 2.8 s).

The first tip `2bbe105d9a` (fix + Zillion) had JSUT 41352140412 / ut 41352140440 / TT 41352139291. The SMZ3 push
superseded them: concurrency cancelled the first two, and I cancelled the stale TT.

Branch: ff from `efbeb33501`, **0 gitlinks** (160000 count 0). Main moved to `166a15274d` (so-12). `git merge-tree
--write-tree origin/main HEAD` gives rc=0, and so-12's 8 files are disjoint from this branch.

## Landing
_(after it lands)_
