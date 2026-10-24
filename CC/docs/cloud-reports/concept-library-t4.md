# Concept library T4′ — the joined world: maze + text adventure, shipped and played (cloud report)

**Worker:** `concept-library-t4` (Opus build slice, cloud fan-out, 2026-09-30).
**Branch (harness-designated):** `claude/concept-library-t4-suppug`. The harness only pushes this branch, so the brief's local name `concept-library-t4` was not used.
**Started from:** `94cd9cb` (origin/main, the SHA the brief expected). **Code head:** `1dfa28a`. This report is the commit after it.

| D | Commit | Verdict |
|---|---|---|
| D1 the state and the shipped row | `bba91cc`, revised by `3cd3e8c` | PASS, with a changed START and seed (measured; see D1 and D2) |
| D2 the committed world | `fec463c` | PASS |
| D3 the play gate | `58d72c4` | PASS. It found a play defect, which is fixed in the same commit (the `text_adventure` entry's `iframeId`) |
| D4 the in-app row | `17959d4` | PASS |
| D5 records | `1dfa28a`, then this report | PASS |

**The one thing to know first:** the brief's world (a MAZE start at seed 1) cannot be committed. Every text-adventure room behind a gate fails `check-sidecar-fields`' rule agreement, because the TA payload's `exitGates` omits the gated back-exit. This is pre-existing and not a concept effect: the shipped `maze-ta-sphere-mix` and `text-adventure-sphere-demo` fail the same way, but they were never committed. So the committed world starts in the text adventure, at seed 8.

## W0: BEFORE and AFTER

| Gate | BEFORE (`94cd9cb`) | AFTER (`1dfa28a`) |
|---|---|---|
| `md5sum frontend/presets/*/*/*_rules.json \| md5sum` | `58820064449a5afa2441d34466fcb20a` | `2cbdcc658124225a40c9e3b12d187fdc`, the new file included. Without `concept_trial`: `58820064…`, identical |
| **rebuild hash** (scratch `rebuildHash.mjs`, T0b's recipe as a node script; see below) | `ALL 50f2236c463357b0678f59bcd82f8953` (44 lines) | `ALL 69b9cae9…` (46 lines): the 2 new lines are `concept_trial`'s own. **The other 44 lines are byte-identical** (diffed after D1, D2 and at the end) |
| `check-sidecar-fields.mjs` | `ALL PASS — 1419 entries over 8 substrates · 0 issue(s), 2 warning(s), 16 not-checked notice(s)` | `ALL PASS — 1422 entries …` (same issue, warning and notice counts) |
| `generate-procgen-reference.mjs --check` | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` | same line |
| `generate-docs-index.mjs --check` | `OK: … is current (154 docs, 8 sections, 11 categories).` | same line |
| bounded vitest, the brief's W0 list | `Test Files 28 passed (28)` / `Tests 808 passed (808)` | W0 list + `conceptTrialWorld` + `procgenPlayer` + `boxLock`/`gateRoster`/`ciGatePlan`: `34 passed (34)` / `991 passed (991)` |
| `check-procgen-docs.mjs` | — | `ALL CHECKS PASSED` |
| `npm test -- --port=8740 --mode=test-substrates --batch=fast` (whole batch, at `1dfa28a`) | — | `totals: 72 run · 72 passed · 0 failed · 72 enabled · 0 not run` |

My rebuild-hash line count differs from T0b's (43 lines). My script prints a line for each HEAVY-skipped preset and hashes differently, so its `ALL` values are its own. BEFORE and AFTER were both measured with the same script, and it was run twice at W0 with the same result.

## D1: the state and the shipped row

**What landed** (`presetDefs.js`):
- `CONCEPT_TRIAL_STATE`: sphere growth, `seed: 8`, `startSubstrate: 'text_adventure'`, `sphereCount: 3`, `fillerCount: 0`, `params.concepts: ['sword', 'guardian', 'swim', 'water']`, scenario `{Progressive Sword: 1, Progressive Swim: 1, victory: 1}`, quotas `{maze: 2, text_adventure: 2}`.
- `shipped:concept-trial-demo`, label *Concept trial (maze + text adventure)*. The description says what to look at: the guardian's prose, the painted water gate (dimmed once cleared), and that the compiled logic is the control's.

**The seed measurement** (quotas maze 2 + text adventure 2, 3 spheres, no filler):

| start | seeds realising one gate per substrate | the gates | census rule agreement |
|---|---|---|---|
| maze (the brief's) | 1, 2, 5 | seed 1: maze START `water_gate_0` + TA `region_2_3`'s guardian prose. Seeds 2 and 5 are the same shape | FAIL: every one has a TA room behind a gate |
| maze | 3, 4, 6 | both gates on the maze START (`water_gate_0`, `guardian_gate_1`), no TA prose | — |
| text adventure | 1, 7, 8, 9, 10, 11, 12 | TA START (or room) guardian prose + maze `water_gate_0` | **PASS only at 8 and 9**; the others put a TA room behind a gate |

The wider sweep with a maze start (seeds 1–12 × quotas {2/2, 3/2, 3/3, 2/1, 3/1} × spheres {3, 4} × filler {0, 1, 2}) found 99 worlds with one gate per substrate, and **0 passed the census**. All 162 disagreements were TA back-exits.

**Seed 8's world:**
- The TA START `region_2_2` holds the sword. Its exit to the maze `region_2_3` is guarded (sword).
- The maze holds the swim at (4,1), next to its entrance at (4,0). Its exit at (0,1) into `region_1_3` is `water_gate_0`.
- `region_1_3` holds victory.

**Rows** (`conceptTrialWorld.test.js`):
- oracle clean, and the region → substrate map;
- **every TA exit the document gates is in `exitGates`** (the census's rule agreement, in the suite);
- the maze's `water_gate_0` (concept, rule, colour, symbol), where the control has `logic_gate_0`;
- the START's guardian prose and the sword in its location, where the control has no prose;
- **"the compiled logic is the control's"** (the document minus sidecars and `procgen_metadata[slot].concepts`) + the recorded list;
- the marked concept rows in `mergedItemLib` (`#c0a040`, `#40b0c0`);
- a `presetDefs.test.js` "IS the committed preset's state" row.

`presetDefs.generate.slow.test.js` (slow config) passes with the new row: `shipped:concept-trial-demo · sphereGrowth · 4 regions · 10 ms / 8 ms`, `26 passed`. **The "names scenario items no library declares" row is green without any change to the row:** the world's own concept list declares the items (T1 D2's `mergedItemLib`).

**Mutants:**
- concepts dropped: predicted 5 red, measured 5.
- the brief's maze-start seed 1 restored: predicted 5 red (shape, layout, agreement, gate, prose), measured 5.

## D2: the committed world

**The producer is generic.** `make-seedling-spiral-room-preset.mjs` writes no `flash_panel` block itself; a Seedling preset's comes out of its substrates' compile (`procgenPipelineEngine` / `regionAtlasCompiler`). So the smallest path is one `PRESETS` row, `'concept-trial': {CONCEPT_TRIAL_STATE, concept_trial}`, plus its docblock.
- `--state=concept-trial --check` → `OK: frontend/presets/concept_trial/AP_1/AP_1_rules.json matches a fresh build — 3 regions (region_2_2:text_adventure, region_2_3:maze, region_1_3:maze), start region_2_2, built in 30 ms`.
- `register-preset.py --game-id concept_trial …` → `Add new preset_files entry: 'concept_trial'`.
- Siblings: none. The other JS-pipeline presets (`seedling_generated_swim`, …) carry only `AP_1_rules.json`.

**Rows** (`conceptTrialWorld.test.js` § D2):
- the committed text equals a fresh build byte for byte;
- `items['1']` names `Progressive Sword` and `Progressive Swim`;
- `procgen_metadata['1'].concepts`;
- the maze sidecars' concept gates are exactly `[water_gate_0, water, #2f6fd0]`, and every maze payload's `itemLib` has the swim in `#40b0c0`;
- the TA sidecar's `prose.exits` is `['exit']`.

**The enrolment sweep, before the commit (each roster before → after):**

| roster | before → after |
|---|---|
| `check-sidecar-fields` census | 1419 → **1422** entries (219 documents). **FAILed first** on the maze-start world; see *What the brief got wrong* 1 |
| `preset_files.json` entries | 134 → 135 |
| `preserved-dev-presets.txt` lines | 49 → 50 |
| `presetDefs.SHIPPED_PRESETS` (slow row) | 25 → 26 tests green |
| `check-procgen-presets.mjs` (browser, every shipped preset) | `All 169 preset drop-down checks passed`; 6 of them are the new preset's, including *the panel's world is the headless world presetRun builds* |
| the 23 vitest files that read the preset corpus (`ls-files` / `readdirSync` / `preset_files`) + `locationCapacity.slow` | green except 2 environmental reds that read no preset: `mapDocumentPath` (wasm `builds.json` absent before I initialised the submodule) and `standingValues`' process-group kill fixture (a sandbox zombie reads alive) |
| `check-worldgen-package-sidecars.mjs` | `ALL CHECKS PASSED` |

## D3: the play gate (`check-concept-trial-play.mjs`)

This is a headless logic-only Chromium run, under the box lock, with `--host=` and `--game=`. It reuses `seedlingRoomPlay.js`'s generic hands (`check`, `waitFor`, `mazeKeyPlan`, `pressKeys`, `mazePlayer`, `mazeHasKeys`) and no Seedling ones. It takes no `@ci-box` tag: CI's browser shards check out submodules recursively, so it becomes a CI browser row.

**Phases** (predicted 23 rows; 25 landed, because two rows were added on measurement):

| phase | the row |
|---|---|
| static (5) | START is a TA room whose gated exit carries prose; the gate is the sword concept's item and the sword lies in the START; `water_gate_0` stands on the maze's exit into `region_1_3` and needs the swim concept's item; every maze path from the entrance to the gate crosses the swim's cell; the completion condition names victory |
| A (3) | boots in `region_2_2`; the message watcher is installed; the exit is `tae-link-inaccessible` and no sword is held |
| T (2) | a real click shows the guardian's BLOCKED prose, not the generic line; the player stays 2000 ms |
| K (1) | a real click on the location: the sword is held, and the sword's check prose is shown |
| O (2) | the exit is accessible; a click moves the player into the maze with the PASSED-WITH prose |
| P (2) | the maze world's concept item colours are `{Progressive Sword: #c0a040, Progressive Swim: #40b0c0}`; `water_gate_0`'s def has concept water, `#2f6fd0`, `~`, placement gate |
| B (2) | before the swim the renderer's clearance (`isObstacleCleared` + the panel's evaluator, what `drawWorld` hands `paintConceptGate`) paints the gate CLOSED; `whyBlocked` from (0,2) north → `"water_gate_0 is shut — its clear_rule is not satisfied"` |
| K2 (2) | the MAZE panel has the keyboard after the move (no click); real keys collect the swim |
| O2 (2) | the same read paints it cleared (dimmed) and `whyBlocked` is null; real keys cross into `region_1_3` |
| V (2) | before V, completion does NOT hold; real keys onto the victory cell, and victory is held |
| C (1) + page errors (1) | `completion_condition` holds on the live snapshot; 0 page errors |

**Pass line** (at `1dfa28a`; also 3 consecutive runs at `58d72c4`): `OK: the concept trial plays — the guardian barred the text adventure's exit and fell to the sword, the maze's water gate stood closed until the swim, and the victory completed the world` / `ALL CHECKS PASSED`.

**Phase B is read, not walked, and that is measured.** The maze is a corridor from (4,0) through the swim's cell (4,1), so no player reaches the gate without the swim. This is the same shape the swim gate measured, and the static row pins it.

**FINDING, fixed in D3: a TA START never showed its prose.**
- First run: Phase T got `"You can't go that way: exit (to region_2_3)."`, and Phase K showed no check prose.
- Cause: `procgenPlayer` re-publishes the active region's `loadRegion` on `iframe:appReady` only for entries that declare `iframeId`, and `text_adventure` declared none (its comment even says TA is "unaffected"). The START's `loadRegion` lands before the iframe bridge subscribes, so `captureRegionProse` never saw the start room. Its exit sides were lost the same way.
- Fix: one field, `iframeId: 'textAdventureSubstrateWrapper'` (the panel's `IFRAME_ID`). Only `procgenPlayer` reads `entry.iframeId`.
- **Mutant (the line removed): predicted 3 red (T, K, O), measured 3.**
- The regenerated registry table's `iframeId` row gains the column.

**Measured on the way:**
- The engine's log is re-rendered on every state change and emptied on a room change. A count-based `.tae-msg` slice lost the check and passed-with lines, so a MutationObserver records every added line.
- One run lost its first maze key, pressed before the maze panel owned the keyboard. The gate now waits for it (and checks it as a row).

**Enrolment:**
- `boxLock.test.js`' guarded list (+1, with the sentence);
- instruments 288 → 289 (`check-` 97 → 98, browser 85 → 86 total and 59 → 60 among `check-`; with-flags 209 → 210; `--help` 284 → 285; `--wait-for-box` 106 → 107; cited-by-a-doc 119 → 120 after D5), all in the regenerated `architecture.md` / `instruments.js`.

`check-procgen-help.mjs` does not list the new gate. It reports 5 reds, all other files: `census-seedling-atlas-doors`, `census-seedling-solver-surface`, `measure-seedling-solver-surface`, `migrate-per-player-blocks`, `probe-seedling-hold`. I did not investigate them.

## D4: the in-app row (`concept-trial-plays`)

**What it does:**
- It fetches and loads the committed `concept_trial` and never changes it.
- **Identity waits:** the game + region set, then procgenPlayer's warehouse is this document's (its region set) and holds the gate.
- It asserts:
  - the maze region's deserialized world holds `water_gate_0` (concept, colour, symbol, rule) and stands it;
  - the concept items are in the table's colours;
  - without the sword the START's exit is inaccessible, the guardian's blocked prose shows (not the generic line), and the player stays 2000 ms;
  - with the sword granted through the state manager, the exit opens, a click moves the player into the maze, and the passed-with prose shows.
- The sword is removed and the observer disconnected in `finally`.
- Its row is in `playwright_tests_config-substrates.json` beside T2's.

**Pass line:** `npm test -- --port=8740 --mode=test-substrates --batch=fast --test=concept-trial-plays` → `[PROGRESS 1/1] concept-trial-plays PASSED 2.8s` · `totals: 1 run · 1 passed · 0 failed`. It also passed:
- with T2's three neighbours (4/4);
- with the fast batch's first nine rows (9/9);
- in the whole fast batch (72/72).

It reads 15 conditions.

**Measured on the way:**
- `pollForCondition` answers a boolean, not the value polled.
- **Inside the batch the row failed at first** (`STUCK` on the mount). The region was right but the room had **no exit link**: after the earlier wrapper rows, the room must be explored first. It now uses T2's `exploreUntil`.

**Mutants:**
- the bridge's prose lookup returns the per-game file only: predicted 3 red, measured 3 (STUCK);
- **the `iframeId` removal does NOT red this row.** In-app the iframe is mounted before the document loads. Only the fresh-boot box gate witnesses D3's fix.

## The trial table (as in `concepts.md` § *The trial world*)

| concept | substrate | placement | effect | what the player sees |
|---|---|---|---|---|
| `guardian` | text adventure | `gate`, START → maze, `Has(Progressive Sword)` | `requires` sword | the blocked prose on a refused move; the passed-with prose on the move |
| `sword` | text adventure | the START's location | item | the sword's check prose |
| `water` | maze | `gate`, maze → victory maze, `Has(Progressive Swim)` | `requires` swim | `water_gate_0` painted blue with `~`, dimmed once cleared |
| `swim` | maze | a pickup | item | the pickup in `#40b0c0` |

**Result:** the compiled logic equals the control's (`conceptTrialWorld.test.js`, *the compiled logic is the control's*).

## D5: records

- `concepts.md` § *The trial world*: the table, the result, and the two measurements.
- `pipeline-presets.md`: the preset's row and § *The committed concept preset*.
- Both generators run, and the regenerated files are committed.
- Link census 320 → **322** (`doc` 245 → 247, `same-doc` 17), summed in both pin comments.
- `procgenDocs` + `quickLaunch`: 15 files / 600 green. `check-procgen-docs.mjs`: `ALL CHECKS PASSED`.

## What the brief got wrong (measured)

1. **"`startSubstrate: 'maze'`; Phase A: the START is the maze."** No maze-start world that realises one gate per substrate passes the census: 0 of 99. The cause is a pre-existing gap: TA `exitGates` carry forward gates only, while sphere growth gates back-exits too. It is not a concept effect: the control, `maze-ta-sphere-mix` and `text-adventure-sphere-demo` fail the same way. **Fixing the TA placer would move those shipped presets' bytes**, so I did not widen for it. The world starts in the text adventure instead, and Phase A reads that.
2. **"seeds 1–6":** with the TA start, the first passing seed is 8. I measured 1–12.
3. **"The text adventure narrates it" held only for rooms entered after boot.** A TA START's prose never reached the bridge (D3's finding, fixed).
4. **"Phase B: the gated maze exit refuses without the item":** it is not walkable. The only path to the gate crosses the swim's cell. B reads the renderer's clearance and `whyBlocked` instead.
5. **"The producer is Seedling-flavoured … may write a `flash_panel` block":** it writes none itself. A maze + TA state went through it unchanged.
6. **"A `guardian_gate_*` or `water_gate_*` in a maze sidecar":** only `water_gate_0` appears. The guardian is the text adventure's in this world. Seeds where the maze holds both gates realise no TA prose.

## Residue

- **The TA back-exit gap is open.** `placeTextAdventureRules` omits gated back-exits from `exitGates`. Consequences:
  - any sphere-growth TA room behind a gate fails the census;
  - the two shipped TA sphere presets could not be committed as they stand;
  - a hub re-derive of such a room drops the back-exit's gate.
  
  The fix belongs in the TA placer (T2's module) and moves shipped bytes, so it needs a ruling.
- **What the Seedling leg (T3) needs to join this world:**
  1. A `flash_seedling_gen` (or `flash_seedling`) realisation of `water` / `guardian`. Seedling's water is physics, so the certification is the generator's `require` differential (the swim world's pattern).
  2. Resolve T0b's residue that Seedling's own unmarked `Progressive Sword` / `Progressive Swim` rows win over the marked concept rows in a mix. In a joined world the maze would draw Seedling's colour.
  3. A seed search like D1's with the census as a constraint: a Seedling room behind a gate is AUTHORED (door `exitGates`), so the back-exit question applies there too.
  4. The play gate becomes `@ci-box`, because it needs the wasm.
- **The in-app row cannot witness the `iframeId` fix;** only the box gate does. A fresh-boot in-app row would need a page reload the runner does not offer.
- **The `text_adventure` entry's comment in `procgenPlayer/index.js`** (*"Substrates without an iframeId field (maze, textAdventure) are unaffected"*) is now half stale for the wrapper. It is not my file's comment to rewrite unasked.
- **Not run here:** the CI vitest suite number for `1dfa28a` (⚖ ruling 52), pytest, and the unfiltered vitest. No `git stash` was used. There is no edit under a submodule path; submodules were only initialised read-only from `/root/CC/mirrors/`, which changes `.git/config` only. No edit to T0's modules, F1b's files, `package.json`, `concepts.js`, `conceptSelection.js`, or any existing committed preset. The scratch harnesses (`rebuildHash.mjs`, `seedProbe.mjs`, `search*.mjs`) live in the session scratchpad and were never committed.
