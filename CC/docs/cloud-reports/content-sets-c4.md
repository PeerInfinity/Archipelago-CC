# Content sets C4: the default packs are available to the synchronous builders (as built)

Branch `content-c4`, based on `origin/content-c3` (`51aac5ad6e`). `origin/main` did not contain `51aac5ad6e` when
this slice began. No substrate declares a default pack and no pack is added: every test uses a fixture registry
entry and an in-memory `readJson`, or a committed pack declared by a fixture entry.

| Commit | Part |
|---|---|
| `a19d3877c0` | 1. the process-level cache (`preloadDefaultContent`), the cache path in `contentRegionParams` and at the region seam, the tests |
| `1861eb37cc` | 3. the APWorld editor's regenerate (`DEFER_CONTENT_SET`, `attachJobContent`, the document's list in `regenerateRegionEntry`, the worker's own preload) |
| `febf8a0559` | 2. the callers: the boot, the vitest `setupFiles` hook, the scripts; `defaultContentPreloadCalls`; the in-app row |
| `0e8f4f54d6` | 4. the record on the spiral and grid-growth compiles; `spiral-step --param content=` |
| `179f214d31` | 2. (fix) the script helper is a library `.js`, not an instrument `.mjs` |
| `b3db5d4e0b` | 6. docs: `concepts.md` § A world's content stack; the regenerated docs index |
| `f6ea09d6a0` | the probe's findings (§2.1): the vitest hook preloads every committed pack BEFORE collection (`ids` option); `serializeEnvelope` drops the live set; the docs follow |
| `9de3e32287` | round 2's finding: a test that calls `vi.resetModules()` preloads in its new graph (`buildRulesJsonLoopCosts`); the docs sentence |

## 1. Exported surface

### `frontend/modules/procgenPipeline/worldContent.js`

- **`preloadDefaultContent({base, readJson, registry?, concepts?, ids?})`** is async. It loads the `concepts` and
  `text` layers (`CONTENT_LAYERS`) of every default pack that `registry`'s entries declare, and keeps them in a
  process-level cache.
  - `ids` names the packs to preload **instead** of the declarations. The vitest hook uses it to preload every
    committed pack (§2).
  - Packs load one at a time in the order named, so the cache's order is deterministic.
  - A pack already in the cache is not read again, so a second call is a no-op.
  - A later call, made after more entries registered, loads only the new packs.
  - Two concurrent calls read each pack once (each pack's load in flight is shared).
  - With no entry declaring a default pack it calls `readJson` **zero** times.
  - Each pack is held to the mechanic table (`assertPresents`) as it loads, so a bad pack is refused here, by name,
    and is not cached.
  - It returns the preloaded ids.
  - With no `readJson` it uses `browserPackIo()`.
- `declaredDefaultContentPacks(registry?)`: the ids `preloadDefaultContent` loads (registry order, once each).
- `preloadedDefaultContentPacks()`: the cache's ids.
- `defaultContentPreloadCalls()`: how many preloads this process has completed. This is how the boot's reach is read
  in the running app.
- `resetDefaultContentCache()`: for tests.
- **`defaultContentSetOf(stack)`** builds a content set **synchronously** from the cache.
  - It gives the same readers over the same loaded rows as `loadContentSet`.
  - One stack always gives the same set object.
  - A pack that is not in the cache is refused by name: `world content: the default content pack(s) [x] were not
    preloaded (preloaded: [...]): this process builds a world synchronously, so it must await preloadDefaultContent
    (after its substrate libraries register) before it builds`.
- **`contentRegionParams`** (and so `assembleRegionParams`):
  - A stack made **only of default packs**, with no set handed in (`contentSet` null), builds the set from the
    cache.
  - A stack that names `params.content` still needs the awaited load (C3's path, unchanged).
  - `contentSet: DEFER_CONTENT_SET` composes the world's own list only, with no set and no refusal (§3).
- **`assertContentLoaded(params, substrateId, registry?)`** (the region seam) now **returns** the params the region
  is built with.
  - It returns `params` itself when nothing is needed or the set is there.
  - It returns `{...params, contentSet}` from the cache when the region needs only its entry's default pack and was
    handed no set.
  - The engine's two call sites (`buildSubstrateRegion`, `generateRegionProcedural`) use the returned params.
- `DEFER_CONTENT_SET`: a frozen sentinel (§3).
- `withoutContentSet(regionParams)`: `steppedPipeline.serializeEnvelope` now drops the live set from
  `config.regionParams` / `opts.regionParams` (§2.1).
- `documentContentOf(doc, player)` returns the validated `procgen_metadata[p].content` (⚠ a per-player map), or `[]`.

### Elsewhere

- `apworldEditor/regionGenerationRun.js`:
  - `attachJobContent(args, io?)`;
  - `runRegenerateJob` and `runRegenerateOnPage` take `attachContent` (default `attachJobContent`).
- `scripts/procgen/preloadContent.js`: `preloadScriptContent()` = `preloadDefaultContent(nodePackIo())`. It is NODE
  only.
- `scripts/test/vitestDefaultContentSetup.js`: the `setupFiles` hook.
- `spiral-step --param content=a,b`.

### The equality pin

The same stack gets the same set by either path: equal `ids` and equal reader answers. The answers compared are
every concept key with its entry, `presenting(m)` for every presented mechanic, and every text key with its string,
list and pack. This is pinned in `worldContent.test.js` for a two-pack fixture stack.

For whole worlds, the concept trial world is built with its maze and text-adventure entries declaring a fixture
default pack:

- The synchronous `buildRunFromState` is refused by name before the preload.
- After the preload it builds:
  - every placer call of both substrates received the one cached set;
  - nothing more was read;
  - the document is **byte for byte the committed preset**.
- The awaited path (`prepareRunFromState`) gives an equal set (different object, same answers) and an equal document.

## 2. Where the preload is called, and how each is shown to be reached

| Process | Where | How it is reached, and the evidence |
|---|---|---|
| **The app** (unbundled and bundled) | `app/initialization/index.js`: `await preloadBootContent(logger)` right after `profiler.end('phase5:loadModules')`, which is after every module's `register()` (where substrate entries register) and before phase 6 (data), phase 9 (initialise) and phase 10. Again right after a module that is enabled after boot registers. A failure is logged, not fatal; a world that needs the pack is then refused by name | `init.js` and `init-bundled.js` both call `initializeApplication` from this module. Three pieces of evidence: (1) `bootPreloadsDefaultContent.test.js` pins the order in the source (the `settingsModeBeforeModules.test.js` precedent) and pins that both entries call it; (2) **the bundle**: `npm run build` in this tree emits `…end("phase5:loadModules"),await Qtt(t),…start("phase6:applyDataToModules")…`, where `Qtt` is the minified `preloadBootContent` (it carries its unique log string); (3) the in-app row `procgen-pipeline-boot-preloaded-default-content` (category `procgenPipeline` → **`fast`**, which also runs bundled on push) reads `defaultContentPreloadCalls() ≥ 1` and that every declared pack is preloaded. The on-push substrate batches do not run on a slice branch, so the row first runs at landing |
| **The APWorld editor's worker** | `regionRegenerateWorker.js` `loadLibraries`: after the libraries import, `await preloadDefaultContent()` over its own registry. A failure is reported in `failed` | The worker is a separate realm with an empty registry, so the page's preload does not reach it. Its regenerate (and an initialise's `initialiseKnobs`) build synchronously in it. The worker shell is not run headless; `runRegenerateJob` (the worker's body) is pinned in node (§3) |
| **vitest, every config** | `setupFiles: ['scripts/test/vitestDefaultContentSetup.js']` in `vitest.config.js`, `vitest.slow.config.js`, `vitest.train.config.js` and `vitest.calib.config.js`. At the setup file's TOP LEVEL, which runs in each test file's module graph before the file's imports, it calls `preloadDefaultContent({...nodePackIo(), ids: <every pack in packs.json>})`. This is a superset of any default pack, so it is ready even for a world built during collection. (The first version asked the registry in a `beforeAll`; the probe overturned that, §2.1) | `contentPreloadSetup.test.js` (default tier) and `contentPreloadSetup.slow.test.js` (slow tier) register, at COLLECTION time, a fixture entry declaring a committed pack (the first in `packs.json`). They assert the pack is preloaded already at collection, and again when the tests run. **Control**: with `setupFiles` removed from a copy of each config, both probes FAIL (measured, for both versions of the hook). The default probe also pins that every config named in `package.json` lists the hook. Cost: the one file measured cold reported `setup 312ms`, transforms included; a worker reuses those across files |
| **The pipeline drivers** | `scripts/procgen/registerPipelineSubstrates.js` `loadPipelineSubstrates()` awaits `preloadScriptContent()` after the libraries import. That covers `sphere-step`, `topdown-step`, `spiral-step`, `entrance-step`, `dump-sphere-growth`, `dump-grid-growth`, `dump-shuffled-spiral`, `runPipeline`, `list-substrates`, `make-seedling-er-preset` and `check-cloudberry-sphere` | The probe run below (§2.1) |
| **Scripts that register their own libraries** | one line, `await preloadScriptContent()`, after the last library registers: at the top level after the static imports, or inside `main` after the dynamic imports | The probe run below (§2.1) |

The scripts given the line are C3's list (§2 there):

- `check-cloudberry-embed`, `check-cli-sphere-config`, `dump-sphere-byteidentity`, `check-spiral-byteidentity`,
  `check-topdown-steps`, `check-atlas-sphere-roundtrip`, `check-region-library-sphere-roundtrip(-maze)`,
  `check-sphere-growth-ui` (its node half), `check-rule-gated-portals` (its node half), `check-region-step-editing`,
  `check-jta-dataset-pipeline-preset` and `check-jta-locations-roundtrip`.
- **Measured beyond that list** (these scripts also build worlds synchronously in node): `check-region-library-roundtrip`,
  `dump-topdown-byteidentity`, `make-demo-bounce-pack`, `scripts/utils/generate-procgen-rules.js`,
  `scripts/utils/generate-topdown-preset.js`, and the seven `scripts/test/generate-{jta,noiz2sa,omsi}-*-preset.mjs`
  producers.

Not given it:

- the browser-only checks (`check-grid-growth-ui`, `check-jta-dataset-url-boot`, `check-region-library-ui`,
  `check-spiral-steps-ui`), which load `/frontend/`, so the app's boot preloads;
- the JtA dataset scripts that build no world (`check-jta-cost-hooks`, `-dataset-load`, `-dataset-transfer`,
  `-generated-dataset`, `-managed-zone-skip`, `-balance-pass`).

### 2.1 The probe: a substrate really declares a default pack

To measure reach rather than infer it, maze and text adventure were made to declare a committed pack (`archipelago`)
as their `defaultContentPack`. This was locally uncommitted, and also pushed as the throwaway branch
**`content-c4-probe`** (`8903223e5a` = this slice's code tip + those two lines; not for landing).

Locally, with the declaration:

- The four C3 byte-equality CLI commands (§4) still give output `cmp`-equal to `origin/content-c3`'s.
- `dump-sphere-byteidentity`, `dump-topdown-byteidentity`, `check-topdown-steps`, `check-cli-sphere-config`,
  `check-spiral-byteidentity`, `check-region-step-editing`, `check-region-library-sphere-roundtrip(-maze)`,
  `check-jta-locations-roundtrip` and `check-jta-dataset-pipeline-preset` all PASS, with no refusal.
- `check-region-library-roundtrip` (a `Generate.py` FillError) and `check-atlas-sphere-roundtrip` (its
  `dump-sphere-growth --quota atlas:seedling=10` subprocess) fail. They fail **identically without the declaration,
  and the atlas one on `origin/content-c3` too**, so these are not C4's (measured; logs in this session's scratchpad).

**CI on the probe, round 1** (`content-c4-probe` at `8903223e5a` = code tip `0e8f4f54d6` + the declaration; run
**42925371963**): the unfiltered vitest gave `26354 passed | 31 skipped | 43 failed`, and the slow battery ran
403 of 432. The census, by error:

- **`… were not preloaded (preloaded: [])`** in about twenty world-building files: `regionIntroduced`,
  `regionHeldItems`, `pipelineRoomEdit`, `goalCapability`, `sphereZoneSpecs`, `buildRulesJsonLoopCosts`,
  `concept{World,TrialWorld,Rebuild}`, `textAdventure{Room,BackExitGates}`, `seedlingGen{RoomDoors,RoomGrowth}`,
  `seedlingGeneratedSet`, `seedling{Generated,Atlas}Arm`, `flashSeedlingAtlasKnob`, `seedlingWasmPlayback`,
  `regionRederiveTaBackExit`, `regionGenerationFlow`, `slotInitialise` and `sphereAtlas.slow`.
  - **This overturned the first hook.** `preloaded: []` means the `beforeAll` hook saw an empty registry. Those
    files register their libraries in their own `beforeAll`, inside a `describe`, or build at collection, all of
    which is after the hook's `beforeAll` or before it. The hook now preloads every committed pack at the setup
    file's top level (`f6ea09d6a0`).
- **`DataCloneError: (key) => entries.has(key) could not be cloned`** in `scripts/procgen/runPipeline.test.js`.
  `runPipeline` hands the envelope a step CLI's `build` returned (`serializeTDEnvelope`, a SHALLOW copy) to the next
  `build`, which `structuredClone`s it. With a default pack declared, the awaited load puts a set on
  `regionParams`, so C3 §6.1's "no caller does that today" stopped being true. Fixed in
  `steppedPipeline.serializeEnvelope`: a serialized envelope keeps `regionParams.content` and drops the set, and a
  resume re-attaches it (`f6ea09d6a0`, pinned in `worldContent.test.js`).
- **Expected on the probe, and owned by the first declarer:**
  - `procgenDocs/generated.test.js`: the undocumented `maze.defaultContentPack` field, and the instruments row of
    the round-1 `preloadContent.mjs` (since renamed).
  - The four exact-shape assertions in `presetRun.test.js`, whose expected `regionParams` now gain a `contentSet`
    key.
  - `worldContent.test.js` and `regionJobContent.test.js`, which pin that no registered entry declares a pack today
    and use the real maze entry as their no-default control.

**CI on the probe, round 2** (`content-c4-probe2` at `69014d5775` = code tip `f6ea09d6a0` + the declaration):
run **42928790236**. The unfiltered vitest gave `26526 passed | 0 skipped | 16 failed`, and the slow battery was
**432/432**. The failures dropped from 43 to 16, and all but one is the first declarer's to own:

- **One more reach gap:** `buildRulesJsonLoopCosts.test.js` (`preloaded: []`). It calls `vi.resetModules()` and
  re-imports, so it gets a fresh `worldContent` instance with an empty cache. It now preloads after the re-import
  (`9de3e32287`). Locally, with the declaration, it is green.
- **Expected on the probe** (an assertion about a world with no default pack, now made under one):
  - `presetRun.test.js` (4): exact-shape `regionParams` expectations, which now gain `contentSet`.
  - `regionGenerationFlow.test.js` (1): `composeRegenerateArgs`' `regionParams` equals a plain `assembleRegionParams`.
    The args now DEFER the set (§3), so the expectation becomes `assembleRegionParams({…, contentSet:
    DEFER_CONTENT_SET})`.
  - `procgenDocs/generated.test.js` (2): the registry field's doc row.
  - `worldContent.test.js` (1) and `regionJobContent.test.js` (8): they use the real maze entry as the
    no-default-pack control, and their in-memory io holds no `archipelago`.

  None of these is a refusal from a builder that the preload failed to reach.

## 3. The APWorld editor's routes (C3 report §2 ⚠)

**What the code overturned in the brief.** The brief said to route the regenerate through `attachContentSet`. But
the editor's regenerate runs in a **module worker** (`runRegenerateInWorker` → `postMessage({type:'run', args})`),
and a set cannot cross `postMessage`: its readers are functions, and `structuredClone` throws (C3 §6.1).
`composeRegenerateArgs` is also called synchronously **during render** (the free-items sentence). So the set is
attached **where the job runs**, not where the args are composed:

- `composeRegenerateArgs` composes `regionParams` with `contentSet: DEFER_CONTENT_SET`. The args carry no set, so
  they clone and they record cleanly in the `set-region-sidecar` provenance, and composing never refuses.
  - The first draft built the cached set and then stripped it. A render without a preload threw, and the test caught
    it.
- **`attachJobContent(args, io)`** (async) takes the world's own list from the args' `regionParams.content`, or else
  from the document's `procgen_metadata[p].content`. It loads the list with `attachContentSet` over the target's mix,
  and returns the job with `regionParams` carrying both the list and the set. Its callers:
  - `runRegenerateJob` (the worker's body, already async), between `ready` and the regenerate;
  - `runRegenerateOnPage` (the page finishing a job the worker flagged `pendingGeneration`), once before the first
    ask.

  It returns the args **themselves**, with no read, when the document names no content: a default-only stack comes
  from the process's cache at the region seam.
- **Not attached:**
  - An initialise. `initialiseOpRefusal` refuses a slot that already carries a `procgen_metadata` block, so no
    document list can exist. Its knobs (`initialiseKnobs` → `assembleRegionParams`) take the default packs from the
    cache of the process it runs in.
  - A zone source and a library source. Neither reaches a placer: a library entry is instantiated whole.
- **`regenerateRegionEntry` reads the document's list** when its params name none. So the caller that is
  **synchronous all the way up** gets `params.content` and is **refused by name at the seam**. That caller is the
  `regenerate-region-sidecar` op replayed by `applyRulesDocOp` with no inlined result, and it no longer places
  without the set. The UI records `set-region-sidecar` with the entry inlined, so a replay of the UI's own ops never
  regenerates.

Pinned in `apworldEditor/regionJobContent.test.js`, on `multiworld/AP_05594871498841892311`, player 3,
`region_1_0` → maze:

- no content: no read, and the same args;
- content: the job carries the list and the set, the composed args carry neither and clone, and the attached job
  does not clone;
- the synchronous regenerate of a content-naming document is refused (`world content: … [trial]`);
- with the set attached it lands, and the entry is byte-equal to the control's;
- `runRegenerateJob` and `runRegenerateOnPage` attach before they regenerate, and every posted message clones;
- an unloadable pack is the job's refusal, by name;
- a target declaring a default pack (a fixture entry):
  - not preloaded: composing works and the regenerate is refused naming `preloadDefaultContent`;
  - preloaded: the composed args carry no set, there is no read, the regenerate lands, and the entry equals the
    control's;
  - an initialise's knobs take the cached set.

## 4. The record on every driver, and byte-equality

- `spiralSteps.stepCompile` and `presetRun.compileGridRun` each gain one line,
  `...recordedContentOf(<the run's regionParams>)`, written only when `params.content` is non-empty. Pinned in
  `worldContent.test.js` for both modes:
  - the list is recorded;
  - the control has no key;
  - apart from the record, the document is the control's.
- `spiral-step --param content=a,b` loads the stack onto a fresh envelope's `regionParams` (`attachArgsContent`).
  - Measured: `--param content=archipelago,seedling` recorded the list, and the rules were otherwise equal to the run
    without it.
  - `--param seed=3` is refused as usage (`spiral-step reads only --param content=…`).
  - `content=absent` is refused naming `frontend/packs/absent/pack.json`.
- **`cmp` against `origin/content-c3`.** Each command ran in this tree and in the `content-c3` tree at `51aac5ad6e`,
  and the outputs are equal:

  | Command | Outputs equal |
  |---|---|
  | `sphere-step run --seed 3 --quota maze=4 --quota text_adventure=2 --start text_adventure` | rules, envelope |
  | `sphere-step run --seed 2 --spheres 2` | rules, envelope |
  | `sphere-step append --items key_red=1`, from that envelope and from its bare rules.json | rules, envelope (both) |
  | `spiral-step run --seed 2 --quota maze=4` | rules |

  - ⚠ An append with `--items gem=1` (or `key_purple`, or `Progressive Sword`) from a `--quota maze=4 --start maze`
    world throws `TypeError … reading 'find'` in `buildNodeRealiserSpecs`, **identically on `content-c3`**. It is
    not C4's; the default world was used instead.
  - The same commands are equal again with the probe's default-pack declaration (§2.1).
- No new key: an empty stack still adds nothing to `regionParams`, the envelope or the document. Every existing C3
  pin of that still passes.

## 5. Tests

New:

- `procgenPipeline/worldContent.test.js` gains the C4 blocks: the cache, the equality pin, the whole-world cache
  path, the seam, `DEFER_CONTENT_SET` and `documentContentOf`, and the spiral and grid records. C3's seam assertion
  now expects the not-preloaded refusal for a default-only region handed no set.
- `apworldEditor/regionJobContent.test.js`.
- `procgenPipeline/contentPreloadSetup.test.js`, `contentPreloadSetup.slow.test.js` and `contentPreloadSetupProbe.js`.
- `app/initialization/bootPreloadsDefaultContent.test.js`.
- The in-app row `procgen-pipeline-boot-preloaded-default-content` (**fast**).

The bounded local run was `npx vitest run` over:

- `worldContent`, `conceptTrialWorld`, `frontend/modules/procgenDocs`, `contentPreloadSetup`,
  `bootPreloadsDefaultContent`, `regionJobContent`, `presetRun`, `cliFlags`, `cliContract`, `substrateLibraries` and
  `lintGateLabels`: 18 files, 660 tests, all passed;
- the nine editor suites over the touched modules (`regionGenerationFlow`, `-Run`, `regionRegenerate`,
  `-Pending`, `initialise*`, `slotInitialise`, `regionRegenerateLibrary`, `-EntryGate`): 489 tests, all passed.

`generate-procgen-reference.mjs --check` passes and `check-procgen-docs.mjs` passes. `lint-gate-labels.mjs` reports
nothing in the new files.

## 6. What the code overturned, and what is left for R1/R2

1. **The editor's set cannot be attached on the page** (§3). It is attached in the worker, and the posted args
   defer it.
2. **The editor's worker is its own process**, so it preloads for itself. The brief named the page boot only.
3. **The vitest hook cannot ask the registry.** A test file registers its substrates in its imports, in its own
   `beforeAll`, or in a `describe`, and some build during collection. So no hook point both follows every
   registration and precedes every build. The probe measured about twenty files that a registry-driven `beforeAll`
   missed. The hook therefore preloads every committed pack before the file loads, which is a superset of any
   default pack (§2).
4. **`serializeEnvelope` was not JSON-safe once a set exists** (§2.1). In-process `runPipeline` chains `structuredClone`
   it.
5. **The script census is wider than C3's list** (§2): eleven drivers through `loadPipelineSubstrates`, and twelve
   more scripts that build in node.
6. `scripts/procgen/*.mjs` is an instrument, so the helper is `preloadContent.js`.
7. `procgenDocs/generated.test.js` reds on the probe branch for the undocumented registry field. That is the
   expected first-declarer red (plan §4), and the R slice that declares the field adds the doc row.

## 7. CI

All CI rows are at the **code tip `9de3e32287`**. The report commit after it changes only `CC/docs/`.

- `JavaScript Unit Tests` run **42931639678**: success, every job.
- `unittests` run **42931639593**: success.

`node scripts/procgen/ci-vitest-summary.mjs 9de3e32287 --wait` printed:

```
  job "JavaScript Unit Tests (Vitest shard 1/3)"  completed success  399/9217
  job "JavaScript Unit Tests (Vitest shard 2/3)"  completed success  398/9142
  job "JavaScript Unit Tests (Vitest shard 3/3)"  completed success  398/8232
  job "JavaScript Unit Tests (slow Vitest)"  completed success  35/432
  suite: vitest (unfiltered)  1195/26591   (26591 passed | 0 skipped | 0 failed)
  slow battery                35/432   (432 passed | 0 failed)
```

- **The `setupFiles` hook's cost.** Shard wall times against C3's tip run 42907547647 were 864 / 958 / 1037 s
  against 859 / 902 / 1069 s, and the slow job 913 s against 941 s. That is within run-to-run noise.
- **Earlier tips.**
  - `f6ea09d6a0` was green: run 42928768202, 26591/26591.
  - `b3db5d4e0b` had ONE red: `scripts/procgen/boxLock.test.js` "lets a QUEUED taker die on SIGTERM" (`'ALIVE'`
    vs `'SIGTERM'`), a child-process timing test that touches no content code. It passed 3/3 locally on that tree
    and is green at every later tip, so it is read as a flake.
- **The probe branches** `content-c4-probe` and `content-c4-probe2` are throwaway measurements (§2.1), not for
  landing. They can be deleted at the next branch-retention review.
- **Dispatches at the report tip.** The plain `unittests_frontend.yml` and the `train_only=true` train tier
  (C4 edits generator code). Their run ids are in the REPORT BACK message, not in a further commit.

## Next slice

R1 (text adventure) and R2 (maze), as planned. Each declares `defaultContentPack` and its pack. The first declarer:

- moves the registry paragraphs into table rows;
- updates the exact-shape `regionParams` assertions the round-2 probe lists (`presetRun` ×4,
  `regionGenerationFlow` ×1);
- adds `preloadDefaultContent` after any other `vi.resetModules()` that builds a world;
- turns the "no entry declares a pack today" pins in `worldContent.test.js` and `regionJobContent.test.js` into
  fixture-registry pins.

The APWorld editor's regenerate, the boot, the vitest tiers and the scripts need nothing more.
