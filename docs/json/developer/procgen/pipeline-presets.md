# Pipeline Presets

The Procgen Pipeline panel's **Preset** drop-down applies a shipped configuration (mode, seed, substrates, knobs and item pool) so that Generate builds a world demonstrating one feature. CI generates every preset that names no heavy substrate headless, twice, and requires the two runs to be byte-identical.

| File | Role |
|------|------|
| `frontend/modules/procgenPipeline/presetDefs.js` | `SHIPPED_PRESETS`, `PRESET_GROUPS`, `PRESET_GROUP_ORDER`, `groupShippedPresets`, apply/capture helpers, the user-preset store. |
| `frontend/modules/procgenPipeline/presetRun.js` | Turns a preset into the run a mode's runner consumes (`buildRunFromState`) and runs it (`runPresetHeadless`). The panel's Generate and the headless test both call it. |
| `procgenPipelineUI.js` | `_renderPresetBar` / `_applyPreset`: the drop-down. |
| `presetDefs.test.js` | Shape, groups, and one pin per preset. |
| `presetDefs.generate.slow.test.js` | The headless generation test (below). |
| `scripts/procgen/check-procgen-presets.mjs` | Browser gate: applies and generates every shipped preset through the panel and requires the panel's world to equal the headless one. |

## The drop-down

The list starts with `Custom`, then one group per pipeline mode that has a shipped preset, in `PRESET_GROUP_ORDER` (Sphere growth, Shuffled spiral, Grid growth, Top-down), then **User**. User presets are saved with *Save as…* and kept only in `localStorage` (`LS_PRESETS_KEY`).

Hovering an option shows its description: what it demonstrates and where to look. Selecting one overwrites the panel setup and clears any stepped-pipeline state. The next edit switches the selection back to `Custom`. A restored session whose preset no longer exists comes back as `Custom`.

## The shipped presets

Each preset's full description, with where to look in the panel, is its `description` in `presetDefs.js`. Ids below omit the `shipped:` prefix.

### Sphere growth

| id | substrates | demonstrates |
|---|---|---|
| `maze-sphere-demo` | maze | The plan-then-grow driver: sphere plan, waves, filler regions and revisits. |
| `text-adventure-sphere-demo` | text_adventure | A sides-only substrate: compass exits instead of wall openings. |
| `maze-ta-sphere-mix` | maze + text_adventure | Two procedural substrates in one world, with key gates crossing between them. |
| `maze-bounce-sphere-mix` | maze + bounce | Maze keys gate bounce exits and bounce abilities gate maze regions. |
| `maze-hazards-loop-demo` | maze, loop mode | Maze hazards and the `loop_costs` sidecar. |
| `bounce-sphere-demo` | bounce | Bounce alone: the free-arrow start and gated exits. |
| `runner-sphere-demo` | runner | Runner alone. |
| `runner-placement-demo` | runner | The runner's jitter, split and ceiling knobs. |
| `seedling-sphere-room-demo` | maze + flash_seedling | A real Seedling room as a leaf behind a maze exit gated on `key_blue`. |
| `seedling-generated-leaf-demo` | maze + flash_seedling_gen | A generated Seedling room as a leaf, holding the victory item on its goal cell. |
| `seedling-generated-host-demo` | maze + flash_seedling_gen | A generated Seedling room as the start, hosting a maze child behind a gate the host enforces. |
| `seedling-atlas-host-demo` | maze + flash_seedling | A real Seedling room hosting gated children, with rules read from the logic's static data. |
| `seedling-atlas-location-demo` | maze + flash_seedling | A real Seedling room's own chest collected as an Archipelago check. |

The two leaf presets set `seedlingAtlasHostChildren: false` / `seedlingGenHostChildren: false`; without that knob a Seedling room hosts children.

### Shuffled spiral

| id | substrates | demonstrates |
|---|---|---|
| `jta-zone-demo` | jta | One region per Journey to Ascension zone, laid out from the centre. |
| `content-spiral-mix` | maze + jta + bounce | Procedural rooms, a zone table and physics zones in one world. |
| `omsi-loop-demo` | jta + omsi, loop mode | Two idle games sharing one loop-mode mana pool. |
| `library-spiral-demo` | Demo Maze Pack + Demo Bounce Pack | Pre-built regions from served region libraries as the only content. |
| `runner-library-spiral-demo` | Demo Maze Pack + Demo Runner Pack | Runner rooms taken from a library, so no generate-and-test is needed. |
| `seedling-spiral-room-demo` | maze + flash_seedling | A real Seedling room as the start region, its two doors bound to spiral exits. |
| `seedling-generated-room-demo` | maze + flash_seedling_gen | Two generated Seedling rooms among maze rooms, with the generator's knobs applied. |

### Grid growth

| id | substrates | demonstrates |
|---|---|---|
| `grid-growth-demo` | maze + text_adventure | The legacy pool-driven grower, where the region count is emergent. |

### Top-down

A top-down preset realises the world the app has loaded; it cannot name a source. Load a game's preset first (a plain page load has Adventure loaded). The panel's *Use currently-loaded rules.json* and *Use currently-loaded sphere log* options (both on by default) pass that world to the pipeline, so region count and substrate split depend on what is loaded.

| id | substrates | demonstrates |
|---|---|---|
| `topdown-maze-ta-demo` | maze + text_adventure | An existing game's region graph realised as procgen regions, keeping its access rules. |
| `topdown-zones-demo` | maze + bounce | Physics zones realising source regions, with bounce abilities granted as starting items. |

### Committed Seedling presets

Each Seedling preset's state is a named constant in `presetDefs.js` (for example `SEEDLING_SPHERE_ROOM_STATE`). The same state is also committed as a preset under `frontend/presets/` and played in the Seedling wasm by a matching `scripts/procgen/check-seedling-*-play.mjs` gate. Seedling room hosting itself is documented in [Flash substrate](./flash.md).

**Note on timings:** to time a preset, run it through `buildRunFromState` then `runPresetHeadless`, the headless test's own path. Most presets generate in well under a second; the two runner sphere presets take several seconds and vary with machine load.

## What a preset carries

A preset's `state` is the same bundle the panel auto-saves: `mode`, `params`, `scenario` (items and obstacles), `substrateQuotas`, `substrateMix`, `substrateMode`, and `libraries` (the region-library selection).

`params` is sparse. `applyPresetState` merges it over the panel defaults and every registered substrate's `defaultProcgenParams`, so a preset pins only what its demonstration needs. A quota or mix entry naming an unregistered substrate is dropped. Served region libraries are carried by reference; the panel fetches them when it generates.

A preset does not carry session state: the composite map's interaction mode, the topology view, hand edits, or a top-down source.

## Adding a preset

1. Add an entry to `SHIPPED_PRESETS`: an id under `shipped:`, a label naming the substrates, `group: PRESET_GROUPS[<mode>]`, a description of what it demonstrates and where to look, and a sparse `state`.
2. Add one row to `presetDefs.test.js` pinning the knob that is the demonstration, so the row fails if the preset stops showing it.
3. The headless test iterates `SHIPPED_PRESETS`, so the new preset is enrolled automatically. It must pass the checks below.
4. The browser gate `check-procgen-presets.mjs` also reads `SHIPPED_PRESETS`, so it covers the new preset too.

The headless test requires each preset to:

- generate twice, byte-identically, within `PRESET_HEADLESS_BUDGET_MS`;
- produce at least one region besides `Menu`, and at least one region of every substrate it names;
- pass sphere growth's plan-versus-world oracle;
- name only registered substrates, and only items that the shared item library or one of its substrates declares;
- name only obstacles in `DEFAULT_OBSTACLES`;
- carry each served library's current `library_id` from `region_library_files.json`.

**Warning:** several mistakes still produce a green-looking world, which is why the test checks them. An unknown obstacle is dropped silently. A stale `library_id` only warns, and the world is built from the current file. A top-down preset with an empty mix, or with quotas instead of a mix, realises an all-maze world without an error.

A preset naming a substrate whose registry entry declares `generationCost: 'heavy'` (currently the runner) is skipped by the headless test, which prints why. It must be listed in `PRESETS_SKIPPED_AS_HEAVY`; the test requires the skipped set to equal that list, so a preset cannot drop out silently. Heavy presets are covered by the browser gate instead.

## Limits

- **No named top-down source.** A top-down preset uses whatever world is loaded.
- **No region-atlas pool.** Sphere growth can draw on a region-atlas content pool (`procgenPipeline/regionAtlasPool.js`), but the panel has no atlas picker, so a preset cannot select one. Individual Seedling rooms do reach presets through `flash_seedling` and `flash_seedling_gen`.
- **No JtA or omsi `substrateConfig`** (a JtA dataset, emitted zone locations, an omsi region split). The engine accepts one, but the panel builds none, so a preset has nowhere to carry it. This is why the omsi preset's single region is the whole town.
- **No generic `flash`.** The generic Flash substrate declares no build-time hook, so no mode can generate it. `flash_seedling` places rooms of the real map rather than generating them; `flash_seedling_gen` generates Seedling rooms.
