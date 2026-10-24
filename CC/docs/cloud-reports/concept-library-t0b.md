# Concept library T0b — the contract's follow-ups, the colour at play, the chart row (cloud report)

**Worker:** `concept-library-t0b` (Opus build slice, cloud fan-out, 2026-09-30).
**Branch (harness-designated):** `claude/concept-library-t0b-7jf8wi`. The harness only pushes to this branch, so the brief's local name `concept-library-t0b` was not used.
**Started from:** `cdbf8fe9` (origin/main, the SHA the brief expected). **Code head:** `252b57ec`. This report is the commit after it.

| D | Commit | Verdict |
|---|---|---|
| D1 the contract's gaps | `a037ed37` | PASS |
| D2 the colour at play | `f255d0f9` | PASS |
| D3 the concepts survive a rebuild | `142b3a0c` | PASS. The brief's premise was partly wrong (see D3) |
| D4 the chart row P6 | `f6078c60` | PASS. One wording choice made (see D4) |
| D5 records | `252b57ec`, then this report | PASS |

## W0: BEFORE and AFTER

| Gate | BEFORE (`cdbf8fe9`) | AFTER (`252b57ec`) |
|---|---|---|
| `md5sum frontend/presets/*/*/*_rules.json \| md5sum` | `58820064449a5afa2441d34466fcb20a` | identical (also checked after every D) |
| **rebuild hash** (see below) | `ALL 78e9931ac226e5a5ce7a0450165f7eb2` (43 lines) | identical (also checked after D1, D2, D3 and D4) |
| `generate-procgen-reference.mjs --check` | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` | same line |
| bounded vitest, the brief's W0 list | `Test Files 33 passed (33)` / `Tests 957 passed (957)` | `33 passed (33)` / `978 passed (978)` |
| bounded vitest, every other touched suite (`conceptRebuild`, `procgenPipelineUI.test`, `sphereSteps`, `topDownSteps`, `procgenPipelineEngine.test`, `presetRun.test`, `mazeRoom/`, `jsonSchemaCheck`, `apworldEditor/documentKeys`, `apworldEditor/sidecarForm`) | — | `43 passed (43)` / `1950 passed (1950)` |
| `check-sidecar-fields.mjs` | — | `ALL PASS — 1419 entries over 8 substrates · 0 issue(s), 2 warning(s), 16 not-checked notice(s)` |
| `check-procgen-docs.mjs` | — | `ALL CHECKS PASSED` |
| `generate-docs-index.mjs --check` | — | `OK: … is current (154 docs, 8 sections, 11 categories)` |

**The rebuild hash.** This is a scratch vitest file, not committed. It combines two things:

- **T1's preset loop** (`presetDefs.generate.slow.test.js`): every non-heavy `SHIPPED_PRESETS` entry, built through `buildRunFromState` → `runPresetHeadless`, md5 of its `rulesJson`.
- **A real rebuild.** For every sphere-driver world among those, and for every committed `procgen_metadata` sphere preset: `rebuildEnvelopeFromRulesJson` → md5 of `serializeEnvelope(env)` → `runStep('compile')` → md5 of the rebuilt `rulesJson`. Where the rebuild refuses (zone substrates, multi-root), the md5 of the refusal is hashed instead.

Measured values:
- 22 shipped presets and 20 committed documents.
- Run twice at W0: identical (deterministic).
- No shipped preset names a concept, and no line moved at any D.

## D1: the contract's gaps (`a037ed37`)

**What landed** (`procgenCore/concepts.js`, `procgenPipeline/conceptSelection.js`):

- **(a) `CONCEPT_ITEMS_FEATURE = 'concept_items'`**, carried by `sword` and `swim`. `itemTagsImpliedBy(maze)` is now `['concept_items']`. T1's pin was `[]`; it is flipped and renamed. `concepts.table.test`'s DOUBLE row now reads `[concept_items, colored_doors_and_keys]`.
- **(b) `realisationsOf(entry | {conceptRealisations} | realisations)`**, one normaliser.
  - An object that carries `conceptRealisations` gives that field.
  - A non-empty object whose every value is `{tier, …}` gives itself.
  - Anything else gives `{}`, so an entry that realises nothing stays nothing.
  - `candidatesFor`, `selectRealisation`, `decorationsFor`, `conceptsRealisedBy` and `itemTagsImpliedBy` all read through it.
  - **Retired:** the maze's `REALISER` view and the text adventure's `REALISING_ENTRY`. Both now pass their realisations object straight to the public API.
- **(c) `conceptOfItem(apName, concepts)`**, the reverse of `itemIdOfNeed`, for unparameterised item concepts only (`key_red` → null). T2's `realisedItemConcept` now calls it.
- **(d) `markConceptRow(row, id)`** (adds `concept` last) and **`isConceptRow(row)`**.

**Gate rows:**
- `concepts.test`: feature, `conceptOfItem` round trip and nulls, `realisationsOf` both ways and its `{}` cases, the marker.
- `conceptSelection.test`: `candidatesFor`, `selectRealisation` and `decorationsFor` each pinned equal for the entry and for its realisations.
- `procgenPipelineUI.test`: the picker rows below.
- Result: 16 files / 336 green.

**Mutant (a): the normaliser accepts only entries.**
- Predicted: the two `realisationsOf` rows, the three both-ways rows, ≥2 of T2's text-adventure rows, and several maze and D4-world rows.
- **Measured: 15 red over 5 files.** T2's caller row reds by name: *"a guardian-gated exit's payload carries BOTH messages, a water-gated one its own, a plain rule none"*.
- Restored; `cmp` identical.

### D1(a): the item picker, measured

`groupLibraryByFeature` (`procgenPipelineUI.js:177`) makes a selected entry a supporter of a row only when the entry lists the row's `def.feature` in `supportedFeatures`. The panel feeds it `mergedItemLib`.

- **Before (W0):** the table's concept rows carried no `feature`, so `includes(undefined)` is false for every entry. The row fell into **`unsupported`**, which is hidden behind the *Show unsupported* toggle.
- **With the feature alone:** still `unsupported` (pinned). **Finding: grouping by feature alone would force every realising entry to list `concept_items` in `supportedFeatures`.** That would also move the chart's P5.
- **Chosen instead:** a row that `isConceptRow` recognises is also supported by every selected entry that **realises its concept** (`realisationsOf(entry)`). No entry lists the tag.
  - Pinned: maze + text adventure → **common**; maze + a non-realising entry → **"maze only"**; a non-realiser alone → unsupported.
- **Why the marker and not the name.** Seedling's `libraryItems` already holds its own `Progressive Sword` row (feature `seedling_items`). Matching by `conceptOfItem(name)` would regroup that row under the maze in seedling mixes that name no concept. An unmarked row of the same name is grouped by its feature alone (pinned).

## D2: the colour at play (`f255d0f9`)

**What landed:** T1's three-line patch, maze only.
- `presetRun.mergedItemLib` adds each concept row as `markConceptRow(row, cid)`.
- `serializeMazeWorld` keeps an `itemLib` row when `!(id in baseItemLib) || isConceptRow(def)`.
- `deserializeMazeWorld` already merges `sidecar.itemLib` over `DEFAULT_ITEMS`.
- The `TILE_GRID_SIDECAR_FIELDS.itemLib` description says so.

**Gate rows** (`conceptWorld.test.js` § *T0b D2*, T1's D4 world):
- The control's payload `itemLib` extras are `{}` in every region.
- The concept world's payloads each carry exactly `{Progressive Sword, Progressive Swim}` as the marked table rows, colour included.
- `getItemRenderHints('Progressive Sword', deserializeMazeWorld(payload).itemLib)` is `{color: '#c0a040', label: 'star'}`. The control's deserialized world draws `hsl(…)`.
- T1's pinned finding row (`itemLib` `{}` in the concept world) is removed; the new describe replaces it.
- `conceptSeam`'s `mergedItemLib` row now expects the marked rows, and asserts that no row of the concept-less library is marked.

**Mutant (b): the marker dropped** (`merged[row.id] = row`).
- Predicted: 3 red (the two colour rows and the `mergedItemLib` row).
- **Measured: 3, all named.** Restored.

⚠ **An operator error, recovered, in this D.** I mis-typed a command that ran `git checkout origin/main -- .`, which reset every tracked file to main's content.
- D1 was already committed, so nothing of it was lost.
- D2's four edited files were uncommitted. I restored the tree to HEAD (`git checkout HEAD -- .`), copied `presetRun.js` back from the mutant's scratch backup, and re-ran the same scripted edits for the other three.
- I then re-ran the D2 suites, 49 files / 1731 green, and re-checked the md5 and the rebuild hash (both identical) before committing. The mutant ran on the same content before the reset.
- Nothing was pushed in between.

## D3: the concepts survive a rebuild (`142b3a0c`)

### Where the params are recorded and read (measured)

- **Callers of `rebuildEnvelopeFromRulesJson`.** There are exactly two, both through `importSphereEnvelope` or directly:
  1. The pipeline panel's `_applyImportedEnvelope` (`procgenPipelineUI.js:4514`). It passes `{itemLib: DEFAULT_ITEMS, obstacleLib: DEFAULT_OBSTACLES, playerId}` and **no `regionParams`**.
  2. `scripts/procgen/sphere-step.js append`. It passes `substrateQuotas` and `maxItemsPerRegion`, and **no `regionParams`**.
  - Neither the hub nor `presetRun` calls it. The only other mention is a comment in `sidecarRuleAgreement.js`.
  - So `config.regionParams` was always `{}` after a rebuild.
- **Where a sphere world's build params are recorded.** `sphereSteps.stepCompile` passes `procgenMetadata: {driver, stop_reason, sphere_plan, edits?, sphere_tree}`. `buildRulesJson` adds `region_count` and `grid_dims` and writes it per slot (`{[playerId]: block}`). `topDownSteps` compile writes `{driver, source_game, source_counts, stop_reason, edits?, sphere_tree?, sphere_plan?}`. No region param was recorded.
- **What a rebuild actually loses.** Measured on T1's D4 world at `f255d0f9`, before D3:

| | gates |
|---|---|
| the compiled world | `region_2_2:water_gate_0`, `region_2_3:guardian_gate_0` |
| rebuild → `runStep('compile')` | the same. **They come off the payloads**; a plain rebuild re-places nothing |
| rebuild → `appendSphere({items: ['Progressive Swim']})` | **`region_2_2:logic_gate_0`, `region_2_2:logic_gate_1`**. The append re-realises the kept region with `regionParams: {}` |

### What landed

- `recordedConceptsOf(regionParams)` returns `{concepts: [...]}` when the list is non-empty, else `{}`. It is spread into the slot block by both compiles.
- `rebuildRegionParams(meta, opts.regionParams)` lays the recorded list *under* the caller's params. With nothing recorded it returns exactly `opts.regionParams ?? {}`.
- `rules.schema.json` declares the slot block's `concepts`.

**Gate rows** (`conceptRebuild.test.js`, 9 rows):
- the helpers' empty cases (they return the caller's own object) and their copy semantics;
- the concept world records `concepts` and the control has no key;
- the rebuild reads it back, and the control's `regionParams` stay `{}`;
- a plain rebuild + compile keeps both gates;
- **an append realises `region_2_2:water_gate_0`, `region_2_2:guardian_gate_1`** (the control: two `logic_gate`s);
- the appended world still records the list, so a second rebuild keeps it.

**The text-adventure half.** The mixed world builds headless: `{maze: 2, text_adventure: 99}`, rooted at `text_adventure`, oracle `[]`.
- `region_2_2` is a text-adventure room that carries `prose`; the control's has none.
- After rebuild + append, the re-realised `region_2_2`'s exit prose carries both the guardian's and the water's `blocked` message. The control's has no `prose`.

`conceptWorld.test.js`'s two "the rules.json outside the sidecars is the control's" rows now strip `procgen_metadata[slot].concepts` and assert it by name. It is the one metadata difference a concept makes.

**Mutant (c): the read-back dropped** (`regionParams: opts.regionParams ?? {}`).
- Predicted: 4 red (read back, maze append, second rebuild, TA append prose).
- **Measured: 4, all named.** Restored.

## D4: the chart row (`f6078c60`)

**What landed:** `P6`, group `play`, statement **exactly** *It can show the library's concepts in its own way*, `fields: ['conceptRealisations']`.
- Its answer reads `conceptsRealisedBy(e, CONCEPTS)`. `substrateCapabilities.js` imports `concepts.js`, which is browser-safe and nameless.
- ✗ when the list is empty; else ✓ with `N concepts: <first LIST_PREVIEW>, …` and the whole list on `list` (the `itemTypesCell` idiom).
- New `CELL_WORDING` words: `concepts`, `conceptTier`, `conceptsPreview`.
- The file stays nameless: test (v) reads the source.

**The chart row as rendered** (`docs/json/features/procgen-substrates.md`):

```
| P6 | It can show the library's concepts in its own way | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ 4 concepts: sword (mechanic), swim (mechanic), guardian (skin), … | ✗ | ✗ | ✓ 4 concepts: sword (mechanic), swim (mechanic), guardian (mechanic), … |
```

The maze card reads *Play — It can show the library's concepts in its own way: 4 concepts: sword (mechanic), swim (mechanic), guardian (skin), …*. The text adventure's card reads the same with `guardian (mechanic)`.

**Regenerated:**
- `generated/capabilities.js` and the page region: `29 statements × 9 substrates, 37 fields read, 44 not yet read`.
- `concepts.table.test`'s "no chart statement reads `conceptRealisations`" flips to "exactly `P6`".

**The registry panel's Plain mode** is generic over `CAPABILITY_STATEMENTS`. A new `plainOf` row renders `✓ 2 concepts: sword (mechanic), water (skin)` for a realising double and `✗` for one that realises nothing.

**Gate rows** (`substrateCapabilities.test`, typed oracle): maze and text adventure ✓ with the literal lists; the seven other entries ✗ (none declares the field); a one-concept list shows no ellipsis. The chart suites: 20 files / 781 green.

**Mutant (d): the tier dropped from the cell.**
- Predicted: 4 red.
- **Measured: 5.** I missed procgenDocs' own "`--check` exits 0" row. The maze text pin reds by name.
- Restored.

## D5: records (`252b57ec`)

**`concepts.md`:**
- every reader takes an entry or its realisations object;
- § *Item concepts* (the feature and `conceptOfItem`);
- the marked rows (colour at play, the picker);
- a new § *A rebuilt world keeps its concepts*;
- § *What the chart reads* now describes P6.

`substrate-registry.md` is unchanged: the field's meaning did not change. It only gained a reader.

**Both generators were run**, and the regenerated README index and `docsIndex.js` are committed. The Quick Launch index regenerates to the same bytes (154 docs).

**Link census 319 → 320** (`doc` 245, `same-doc` 16 → 17: § *Selection* → § *The two halves*). The delta is summed in both pin comments (`docLinks.test`, `docsRender.test`). `procgenDocs` + `quickLaunch`: 15 files / 600 green.

## What the brief got wrong (measured)

1. **"`rebuildEnvelopeFromRulesJson` re-runs `placeFromRules` from the document"** (T2's residue, repeated in §1). A plain rebuild re-places nothing: it deserializes each payload, so the skins and prose survive it unchanged. The loss is on the regions an **append** (or anything that re-realises) places. D3's rows are written against that.
2. **"Where its callers get `regionParams` (the hub, `presetRun`, the panel)."** Neither the hub nor `presetRun` calls the rebuild. The callers are the panel and `sphere-step.js append`, and neither passes `regionParams`.
3. **The chart cell's example text** (`guardian (skin), water (skin), sword, swim`) and the D4 spec (`name (tier)` per concept, `LIST_PREVIEW` then `…`) cannot both hold.
   - I printed the tier on every concept, so the text adventure's four `mechanic`s are visible, in the entry's declared order.
   - With `LIST_PREVIEW = 3`, the maze's preview shows `sword`, `swim` and `guardian`, and `water (skin)` is only on `list`. **If the user wants skins first, or `mechanic` left unprinted, that is a one-line wording change in `conceptTier`/`conceptsCell`.**
4. **Mutant (d) "⇒ the maze row's text pin reds"** is true, but 5 rows red, not the 4 I predicted.
5. **The D4 world's "the rules.json outside the sidecars is the control's"** no longer holds byte for byte after D3, by design: the concept world's metadata records its list. The rows now name that one difference.

## Residue

- **Every maze region of a concept world carries both marked rows** in its payload `itemLib`, including regions that hold no pickup. That is two rows per region, and inert for a concept-less world. Trimming it to the regions that place the item would need the serializer to read `world.items`; I did not widen for it.
- **A world that mixes `flash_seedling_gen` keeps Seedling's own `Progressive Sword` / `Progressive Swim` rows.** `mergedItemLib` never writes over a library's row, so those rows are unmarked. They draw Seedling's colour in a maze region (Seedling's `GATE_ITEM_COLORS`, which is not necessarily the table's) and group by `seedling_items`. Whether a concept row should win there is a design question.
- **The text adventure has no item colour to carry.** D2 is maze-only, as the brief bounded it. Bounce, runner and other `libraryItems` rows still do not travel in maze payloads (T1's generalisation). Only concept rows are marked.
- **The top-down compile records `concepts` too** (`env.opts.regionParams`). No row builds a top-down concept world, so that producer is covered only by the byte gates: every shipped top-down preset and every committed `procgen_topdown` rebuild is unmoved.
- **The picker's new grouping is unit-pinned only.** No browser run was made.
- **Not run here:** the CI vitest suite number for `252b57ec` (⚖ ruling 52). No pytest and no unfiltered vitest were run. No `git stash` was used, and nothing under a submodule, F1b's files, `package.json`, any committed preset or `libraryItems` was touched.
- The scratch harness (`zzScratchPresetHash.test.js`) and the D3 probe were never committed and are removed from the tree.
