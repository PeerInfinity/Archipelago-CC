# Content sets C3: a world names its content stack (as built)

Branch `content-c3`, based on `origin/content-c2` (`d52f55a140`). `origin/main` did not yet contain `d52f55a140`
when this slice began. There are three code commits, one per part, and this report:

| Commit | Part |
|---|---|
| `a9af338a0b` | `procgenPipeline/worldContent.js`: the param, the effective-stack rule, the load, the channel, the record, the rebuild, the re-attach; the tests; `rules.schema.json` |
| `68af6d7908` | the entry points: the pipeline panel, `sphere-step` / `topdown-step` / `spiral-step`, `check-procgen-presets`, the two `make-*-preset` producers |
| `5cfbb33466` | docs: `concepts.md` § A world's content stack, the registry's `defaultContentPack` paragraph, the regenerated index, the link census pins |

No substrate reads the content yet, no pack is added, no registry entry declares a default pack, and the panel has
no content control. This slice builds the channel only.

## 1. Exported surface

### `frontend/modules/procgenPipeline/worldContent.js` (new; browser-safe)

- `RECORDED_CONTENT_KEY` = `'content'`. It is the key for `params.content`, for `regionParams.content` and for
  `procgen_metadata[p].content`.
- `CONTENT_SET_KEY` = `'contentSet'`: the `regionParams` key the loaded set travels on. It is runtime only.
- `DEFAULT_CONTENT_PACK_FIELD` = `'defaultContentPack'`, the registry-entry field.
- `CONTENT_LAYERS` = `concepts`, `text`. These are the only layers the load reads; art and sound are never fetched.
- `WorldContentError`. Every refusal begins `world content: `.
- `contentParamRefusal(list)` / `assertContentParam(list)`. Absent or null is allowed (it means `[]`). Otherwise
  the value must be a list of distinct pack ids (`PACK_ID_PATTERN`). The refusals are: not a list, an id that is not
  a pack id, and an id named twice.
- `contentListOf(value)` turns a command line's `--param content=a,b` string into a list. Any other value is
  returned unchanged.
- `defaultContentPackOf(entry)` returns the entry's default pack id or null. A malformed value is refused, naming
  the entry.
- **`effectiveContentStack({substrateIds, content, registry?})` is THE rule.** It takes the default packs of the
  substrates in the mix, in REGISTRY order (`substrateRegistry.getAll()`, which sorts by id), without duplicates.
  It then adds `content` in its own order. A pack that the defaults already named keeps its first position.
- `EMPTY_CONTENT_SET` and `isContentSet(x)` (a brand held in a `WeakSet`).
- `browserPackIo({win?, base?})` returns `{base, readJson}` over `fetch` and `packsBaseUrl()`.
- **`loadContentSet(stack, {base, readJson, concepts?})`** first runs `assertPresents` against `CONCEPTS`. It then
  returns a frozen `{ids, concepts: createPackConcepts(loaded), text: createTextLibrary(loaded)}`. An empty stack
  returns `EMPTY_CONTENT_SET` **without calling `readJson`**. The set has a non-enumerable `toJSON` that answers
  `undefined`, so `JSON.stringify` omits it.
- `contentRegionParams({params, contentSet, substrateIds})` returns the keys that `assembleRegionParams` adds:
  `{content, contentSet}`, or `{}` when the stack is empty. If the stack is not empty and no loaded set holds it,
  the call is refused by name.
- `assertContentLoaded(params, substrateId, registry?)` is the engine's region seam. A region needs its entry's
  default pack plus `params.content`. If the set handed to it does not hold those packs, the region is refused.
- `recordedContentOf(regionParams)` returns `{content: [...]}` only when the list is non-empty.
- `attachContentSet(regionParams, {substrateIds, ...io})` returns a new `regionParams` with the set added, or the
  same object when the stack is empty.
- `envelopeSubstrateIds(env)` and **`attachEnvelopeContent(env, io)`**. The second loads a resumed or rebuilt
  envelope's stack and sets the set **in place** on its `regionParams`. Every alias then sees it: `env.opts`, and the
  panel's `growConfig`. It is a no-op when the stack is empty or the set already holds it.

### Elsewhere

- `presetRun.js`:
  - `DEFAULT_PARAMS.content = []`.
  - `buildRunFromState(bundle, {…, contentSet})` puts `contentSet` on `state`, and the four builders pass
    `state.contentSet` to `assembleRegionParams`.
  - `worldContentSubstrateIds(state, {resolvedLibraries})` covers the positive entries of the mode's dict, the
    start substrate and the library substrates. That is a superset of every builder's `activeIds`.
  - `worldContentStackOf(state, opts)`.
  - **`prepareRunFromState(bundle, {io, ...opts})`** is the async entry: it loads the set, then calls
    `buildRunFromState`.
- `sphereConfigHooks.assembleRegionParams({…, contentSet})` merges `contentRegionParams` after the concepts line.
- `procgenPipelineEngine.js`:
  - `assertContentLoaded` runs at the top of `generateRegionProcedural` and of `buildSubstrateRegion`. Those are
    the only two callers of `generateRegionCore`.
  - `rebuildRegionParams` reads back `content` the way it reads back `concepts`, and a caller's own value wins.
- `sphereSteps.js` / `topDownSteps.js` compile `...recordedContentOf(...)` beside `recordedConceptsOf`.
- `contentPacks.js` exports `PACK_ID_PATTERN`.
- New: `contentPacks/nodePackIo.js` (node only), `nodePackIo({base?})` returns `{base: packsBaseUrl(), readJson}`
  over `node:fs`.
- `rules.schema.json` has a `procgen_metadata[p].content` entry: a list of unique pack ids, `minItems: 1`.

## 2. Generation entry points (measured by grep over `frontend/modules` and `scripts`)

**They await the load, or re-attach it:**

| Entry point | What it does now |
|---|---|
| Pipeline panel `_runGeneration` (Generate, all four modes) | `await this._loadWorldContent()` first. It sets `this.contentSet` (the builders read it as `state.contentSet`) and calls `attachEnvelopeContent` on any `_stepState` / `_tdState` / `_spiralState` already in flight, which includes an imported envelope or rules.json |
| Panel `_runSphereStepNext`, `_runSpiralStepNext`, `_runTopDownStepNext` | the same, before the step |
| Panel `_appendSphere` | the same, before `appendSphere`. This covers the append from an imported rules.json |
| `presetRun.prepareRunFromState` | new; the async form of `buildRunFromState` |
| `scripts/procgen/sphere-step.js` | `plan` / `run` from scratch: `buildConfig(args, await loadArgsContent(args))`. `-i` resume and `append` (from an envelope or a bare rules.json): `attachEnvelopeContent`. `build()` likewise. `--param content=a,b` names the world's own stack |
| `scripts/procgen/topdown-step.js` | the same: a fresh `buildEnv(args, {contentSet})`, and `-i` resume and `build()` re-attach |
| `scripts/procgen/spiral-step.js` | its own worlds pass `regionParams: {}` and cannot name content. `-i` resume and `build()` re-attach, for an envelope the panel saved |
| `scripts/procgen/check-procgen-presets.mjs` | `prepareRunFromState(preset.state, {…ctx, io: nodePackIo()})` |
| `scripts/procgen/make-seedling-spiral-room-preset.mjs`, `make-seedling-er-preset.mjs` | `prepareRunFromState(…, {io: nodePackIo()})` |
| the tests' harness | `worldContent.test.js` goes through `prepareRunFromState`. The other suites keep `buildRunFromState`, which is synchronous and correct for an empty stack |

**Not migrated. They are synchronous, or build from their own fixed configs that name no content.** A non-empty stack
is refused by name in `assembleRegionParams` or at the region seam, so none of them can silently build a world without
its content:

- `check-cloudberry-sphere.mjs` and `check-cloudberry-embed.mjs` (fixed `STATE`s).
- `dump-sphere-growth.js` takes `--param`, so `content=` would be refused there. Likewise `check-cli-sphere-config.mjs`,
  `dump-sphere-byteidentity.mjs`, `check-spiral-byteidentity.mjs`, `check-topdown-steps.mjs`,
  `check-atlas-sphere-roundtrip.mjs`, `check-region-library-sphere-roundtrip*.mjs`, `check-grid-growth-ui.mjs`,
  `check-sphere-growth-ui.mjs`, `check-jta-*.mjs`, `check-rule-gated-portals.mjs` and `check-region-step-editing.mjs`.
- ⚠ **The APWorld editor** (`apworldEditor/regionGenerationFlow.js`, `regionRegenerate.js`, `slotInitialise.js`)
  regenerates regions from a document's params bag through `assembleRegionParams`, and it was not restructured. Once
  a substrate declares a default pack, the seam refuses those regions by name. But a world whose content is **only**
  its own `params.content` reaches that editor with a bag that carries no `content` key. That regenerate would place
  without the set and would not be refused. No world names content today. **The R slice whose substrate first reads
  the set** must route the editor's regenerate through `attachContentSet` (its callers are async event handlers;
  that was not measured here).
- The panel's re-roll and region editor (`growConfig`) read the same `regionParams` object as the envelope. They see
  the set after any Generate, step or append in the session. After a reload they have to generate first; until then
  the seam refuses them by name.

## 3. The append path

It is built and pinned. `rebuildEnvelopeFromRulesJson` is synchronous, and it reads the record back into
`regionParams.content`. **Every caller of the append is async**: the panel's `_appendSphere`, and `sphere-step
append`. So the caller awaits `attachEnvelopeContent(env, io)` between the rebuild and `appendSphere`.

The substrates come from the rebuilt nodes plus the quotas and start. `worldContent.test.js` measures four things:

- the rebuild returns `{content: ['trial']}`;
- an append without the re-attach is **refused** at the region seam (`WorldContentError`);
- with the re-attach, the append runs, keeps `procgen_metadata[p].content`, and its logic equals the control's append;
- a saved envelope keeps the list but not the set, and a re-attach restores the set.

## 4. Byte-equality evidence

- **The concept trial world.** The world is `CONCEPT_TRIAL_STATE` with `content: ['trial']`, over an in-memory
  `readJson`. Its pack's concept presents `guardian`, and the pack also lists an `art` layer, which is never fetched.
  It compiles to a `rules.json` that is **string-equal** to its control's once `procgen_metadata[p].content` is
  removed.
- **The control.** It is built through `prepareRunFromState`, read nothing, and is byte for byte the committed
  `frontend/presets/concept_trial/AP_1/AP_1_rules.json`.
- **The placers received the set.** The registry entries are frozen, so for that one build the test replaces the maze
  and text-adventure entries with wrappers that call the real hooks. Every `generateRegionCore` and `placeFromRules`
  call of both substrates received the same loaded set object. Its `ids` are the world's list, and its
  `concepts.presenting('guardian')` is the fixture's Gate. The `placeFromRules` call count is at least the region
  count.
- **The fixture stack was read once**, before generation: one `pack.json`.
- **The run's `regionParams`** serialize with `content` and without `contentSet`.
- **The CLIs against main**, measured in this session. Each command ran in this tree and in the primary tree
  (main `ce81ee811a`), and `cmp` found the outputs equal:
  - `sphere-step run --seed 3 --quota maze=4 --quota text_adventure=2 --start text_adventure`: rules and envelope;
  - a maze-only `sphere-step run` and its `append` from the bare rules.json: rules and envelope;
  - `spiral-step run --seed 2 --quota maze=4`: rules.
- **From disk**: `sphere-step run --param content=archipelago,seedling` loaded the committed packs and recorded
  `["archipelago","seedling"]`, and `content=absent` was refused naming `frontend/packs/absent/pack.json`.

## 5. Tests

- New: `frontend/modules/procgenPipeline/worldContent.test.js`. Nothing in it is hard-coded: expectations come from
  the fixture, the registry and the state.
- Updated: `procgenDocs/docLinks.test.js` and `docsRender.test.js` (the link census, 397 → 399, `doc` 297 → 299).
- The bounded local run passed. It was `npx vitest run` over:
  - `worldContent.test.js`, `conceptTrialWorld.test.js`, `conceptRebuild.test.js`, `conceptWorld.test.js`,
    `conceptSeam.test.js`, `presetDefs.test.js`, `presetRun.test.js` and `procgenPipelineUI.test.js`;
  - `procgenCore/contentRoles.test.js`, `procgenCore/jsonSchemaCheck.test.js`, `apworldEditor/documentKeys.test.js`,
    `frontend/modules/contentPacks`, `frontend/modules/procgenDocs` and `scripts/procgen/lintGateLabels.test.js`.
- `lint-gate-labels.mjs` reports nothing in `worldContent.test.js`.
- `generate-procgen-reference.mjs` reports 0 findings.
- **Panel save and reload**: no browser row was needed. The panel persists `params` whole (`_saveToLocalStorage`,
  `capturePresetState`), and `worldContent.test.js` pins two things: `content` survives capture, JSON and
  `applyPresetState` in order, and a bundle that predates the param reloads with `[]`. Generate with an empty stack
  in the browser makes no request; it runs in CI's on-push batches as before (`fast`, where the pipeline panel's rows
  live).

## 6. What the code overturned or added

1. **The set cannot ride in a serializable config as it stands.** The sphere and top-down configs are "the
   (serialisable) resolved config block": the CLIs `JSON.stringify` envelopes, `structuredClone` their `-i` input,
   and the panel saves envelopes. The brief's set holds reader functions. `structuredClone` of it throws
   `DataCloneError` (measured), and `JSON.stringify` would leave behind `{}` readers that crash on resume.
   - So the set is runtime state. It carries a non-enumerable `toJSON` that answers `undefined`, a saved envelope
     keeps only `regionParams.content`, and every resume path re-attaches the set (`attachEnvelopeContent`).
   - ⚠ `structuredClone` of a LIVE envelope that holds a set would still throw. No caller does that today: the CLIs
     clone serialized input only.
2. **A guard in place of "every entry point".** A refusal by name sits at `assembleRegionParams` and at the region
   seam, so an entry point that was not migrated (§2) fails loudly instead of building a world without its content.
3. **`--param` gives strings.** `contentListOf` lets `--param content=a,b` name a list.
4. **The record is written by sphere growth and top-down only**, the same drivers that record `concepts`. The spiral
   and grid-growth compiles record neither. Those drivers cannot be rebuilt, but a spiral or grid world that names
   content does not say so in its document. The ruling (Q4) says "recorded beside concepts", which this matches.
   Recording it on those two drivers as well is a one-line change each, if it is wanted.
5. The default-pack rule uses `getAll()`, which orders by **id**: the registry's only stable order.

## 7. CI

All CI rows are at the code tip `5cfbb33466`. The report commit after it changes only `CC/docs/`.

- `JavaScript Unit Tests` run **42907547647**: success, every job, including the browser gate shards, the
  headless procgen gates and the producer `--check`s.
- `unittests` run **42907547610**: success.

`node scripts/procgen/ci-vitest-summary.mjs 5cfbb33466 --wait` printed:

```
  job "JavaScript Unit Tests (Vitest shard 1/3)"  completed success  398/9204
  job "JavaScript Unit Tests (Vitest shard 2/3)"  completed success  397/9130
  job "JavaScript Unit Tests (Vitest shard 3/3)"  completed success  397/8218
  job "JavaScript Unit Tests (slow Vitest)"  completed success  34/431
  suite: vitest (unfiltered)  1192/26552   (26552 passed | 0 skipped | 0 failed)
  slow battery                34/431   (431 passed | 0 failed)
```

The train tier was skipped, because nothing this slice touched is a train path. The on-push substrate batches do not
run on a slice branch.

## Next slice

R1 (text adventure) and R2 (maze) are independent. The first substrate to declare `defaultContentPack` and
`contentRoles` reads `params.contentSet` in its placer. It moves both registry paragraphs into build-time table rows,
regenerates, and adds the census lines. It also routes the APWorld editor's regenerate through `attachContentSet`
(§2 ⚠).
