# Headless procgen scripts

Node ESM scripts for running procgen pipelines outside the browser.
Useful for engine-only debugging where booting the frontend would
add noise.

## Scripting the pipeline drivers

The six pipeline drivers — `sphere-step.js`, `spiral-step.js`,
`topdown-step.js`, `dump-sphere-growth.js`, `dump-shuffled-spiral.js` and
`dump-grid-growth.js` — are scriptable: node-only, seeded and
byte-deterministic. They share these conventions:

- **stdout is the data channel.** Progress, hints, the dumps' `Wrote …` /
  summary lines and the frontend's own load-time logging all go to stderr.
  stdout is empty unless you ask for data on it: `-o -` on a `*-step.js`
  driver writes the envelope there and nothing else, so it pipes into
  `JSON.parse` / `jq`. (The `Worker is not defined` stack trace on stderr is
  expected; see below.)
- **Exit codes** (`cliRun.js`):

  | code | outcome | when |
  |---|---|---|
  | 0 | `ok` | |
  | 1 | `usage` | bad or unknown flag / value (a non-integer `--seed`, `--quota maze=x`, a flag with no value), a substrate that is not registered or that the driver's layout cannot place, missing or unknown subcommand, a step without `-i` — refused before any work |
  | 2 | `oracle_mismatch` | the world was built and its outputs written, but the sphere oracle disagrees with the plan (`sphere-step` compile/run/append, `dump-sphere-growth`). This was exit 1 before 2026-10-18 |
  | 3 | `input` | an input file (`-i`, `--config`, `--source`, `--params`, `--sphere-log`, `--atlas`, `--jta-dataset-file`) is missing, is not JSON, fails its schema (`--config`), or is an envelope of another kind / a newer version |
  | 4 | `internal` | anything else thrown while the pipeline ran |

  A crash while a module is still loading exits 1 (Node owns that exit).
- **`--json-status PATH`** writes one JSON object when the run ends, failures
  included (`-` = stdout; refused as usage when `-o -` already owns stdout):
  `status_version` (1), `tool`, `subcommand`, `ok`, `exit_code`, `outcome`,
  `error` (`{message}` or null), `completed` / `next` (step names, step
  drivers only), `outputs` (`envelope` / `rules` / `dump` → absolute paths, or
  `<stdout>`), `oracle` (`{checked, errors}` where there is an oracle, else
  null), `summary` (seed plus the driver's counts) and `config` (the parsed
  flags after `--config`, or null when the run failed before parsing).
- **One argv parser** (`cliFlags.js`). Each driver declares the flags it
  takes as a table keyed by the flag (`'--seed': W.seed`), and `parseFlags`
  checks every value once: integers are integers, `WxH` is two integers,
  `id=N` needs both halves, and `--param key=value` turns a plain decimal into
  a number and leaves anything else a string on every driver. The parse result
  is the object a dump echoes as its `config`, key order included.
- **`--config PATH`** reads a JSON object of the same keys the parser
  produces (a dump's `config` is one; so is a `--json-status` `config`), then
  applies the flags on top: a flag always wins, a repeatable map flag
  (`--quota`, `--items`, `--param`) merges into the file's map per id, and a
  list flag (`--atlas`) appends. Paths inside it resolve against the current
  directory, like the flags. The file is checked against a schema derived
  from the driver's own flag table — `--config-schema` prints it (JSON Schema
  2020-12, each key with its `x-flags` and `default`) — and an unknown key, a
  wrong type, a missing file or bad JSON exits 3. A dump fed its own `config`
  rebuilds the same dump.
- **`--help` (or `-h`)** prints the driver's usage, flag table and the flags
  derived from its parser, then exits 0 without running anything.
- **Format stamp.** Envelopes open with `kind` (`sphere-envelope`,
  `spiral-envelope`, `topdown-envelope`) and `envelope_version` (1). Dumps
  carry `kind` `sphere-growth-dump` / `shuffled-spiral-dump` /
  `grid-growth-dump` with the same `envelope_version`. Reading `-i` refuses
  another mode's envelope or a newer version by name. An unstamped envelope
  (written before the stamp, or by hand) still loads. The panel's envelope
  download and Load envelope use the same stamp.
- **Envelope schemas.** `frontend/schema/envelopes/<kind>.schema.json`
  describes every top-level field of an envelope, generated from the mode's
  field table (`node scripts/procgen/generate-envelope-schemas.mjs`, `--check`
  to gate). Fields marked `"x-visibility": "internal"` (`rng`, `regionsRng`,
  `batchStart`, `nodes`, the tagged `grid`, …) are resume state: carry them
  through untouched and do not read them; their shape may change without a
  version bump.
- **One substrate set, read from the registry.** Every driver loads the
  libraries `frontend/modules/procgenCore/substrateLibraries.js` lists (the
  same list the matrix generator and the regenerate worker read), so every
  substrate the app registers can be named, Seedling and noiz2sa included.
  Loading happens when the run starts, not on `--help`. Whether a substrate
  fits a given driver is decided by its layout (`pipelineLayoutsOf`: sphere,
  spiral, grid or topdown): a zone substrate on the grid-growth driver is refused by
  name, not reported as "not registered".
- **`list-substrates.js`** prints that registry: one line per substrate
  (label, layouts, how many capability statements it answers yes, the
  library that registered it), or with `--json` a `substrate-list` object
  (`list_version` 1) carrying each entry's `layouts`, `realiser`,
  `defaultProcgenParams` and every capability statement with its answer.
  `--layout spiral` keeps the ones a layout can place, `--id ID` picks
  substrates, and `--json --fields` adds every field the entry declares.

## dump-grid-growth.js

Runs `growMaze` + `buildRulesJson` and writes the resulting grid,
stats, region-level exit table, and full rules.json to a JSON file.

```
node scripts/procgen/dump-grid-growth.js \
    --seed 1 \
    --grid 3x3 \
    --quota maze=2 --quota text_adventure=2 \
    --start maze \
    --items key_red=4 --obstacles door_red=4 \
    -o /tmp/dump.json
```

`--help` lists every flag. Use `--mix id=W` instead of `--quota id=N`
to drive weighted-mix mode. The script stays headless — substrate
libraries are imported for their registry entries but no UI or
state-manager wiring runs.

Output shape:

- `config` — echoed inputs
- `startCell`, `stats` (incl. `substrateCounts`, `stopReason`)
- `regions[]` — `{ id, substrate, cell, exits[] }` per built region;
  each exit includes `targetRegion`, `isBackExit`, `isTeleporter`
- `rulesJson` — full compiled rules.json

The script imports modules that schedule background timers (the
state-manager proxy etc.), so it force-exits after writing (with the exit
codes above). Errors
during import (e.g. "Worker is not defined") are expected and
harmless in a Node context.

## dump-shuffled-spiral.js

Sibling of dump-grid-growth.js for the shuffled-spiral layout; same
output shape. If any quota'd substrate declares a `victoryItem` on its
registry entry (e.g. `bounce`), it's passed to `buildRulesJson` as the
completion-condition item, mirroring the pipeline UI.

```
node scripts/procgen/dump-shuffled-spiral.js --seed 1 --quota bounce=4 -o /tmp/spiral.json
```

`--jta-locations` turns on the jta zone-locations channel (Phase 1
skeleton) so jta regions emit their tasks as AP locations; off by
default (byte-identical to prior jta dumps).

## check-jta-locations-roundtrip.mjs

Phase 1 round-trip check for the jta zone-locations channel (plan §2b).
Generates a jta-locations world through the full toolchain — JS pipeline
→ `world_generator` → `Generate.py` — in a throwaway world/preset and
asserts that the task locations, their sidecar payload fields
(`ap_locations`, `jtaZone`), and the sphere log survive into the exported
rules.json + sphere log + spoiler (Pass B's inputs). Self-cleaning.
Requires the repo Python env.

```
node scripts/procgen/check-jta-locations-roundtrip.mjs
```

## dump-bounce-level.js

Dumps a single Bounce (Doodle-Jump-style) level: the generated platform
geometry, physics config, and compiled rules.json for one bounce region.

```
node scripts/procgen/dump-bounce-level.js --seed 1 -o /tmp/bounce-level.json
```

## dump-bounce-region.js

Emits the per-platform requirement data and region report for a gated
bounce braid (verified-vs-authored minimal item sets per row), surfacing
the `deriveAccessRules({includePlatforms:true})` output.

```
node scripts/procgen/dump-bounce-region.js --seed 1 -o /tmp/bounce-region.json
```

## topdown-step.js

Per-step driver for the top-down stepped pipeline (Layout → Realise →
Finalize → Compile), the top-down analogue of `sphere-step.js`. Runs ONE
step (or a contiguous range), reading the prior step's envelope JSON and
writing the next.

```
node scripts/procgen/topdown-step.js run --from layout --to compile --seed 1 --rules-out rules.json
```

## sphere-step.js

Per-step driver for the stepped sphere-growth pipeline. Runs ONE step
(or a contiguous range) of `plan → allocate → topology → items →
regions → compile`, reading the prior step's "envelope" JSON and writing
the next. Hand-edit the envelope between invocations to author each step.
Shares the step wiring with the Procgen Pipeline panel via
`frontend/modules/procgenPipeline/sphereSteps.js`, so the CLI and the
panel can't drift.

```
# six steps, each its own process:
node scripts/procgen/sphere-step.js plan     --seed 1 --quota maze=6 --start maze \
    --items key_red=1 --items victory=1 --spheres 2 --victory victory -o s1.json
node scripts/procgen/sphere-step.js allocate -i s1.json  -o s2a.json
node scripts/procgen/sphere-step.js topology -i s2a.json -o s2b.json
node scripts/procgen/sphere-step.js items    -i s2b.json -o s2c.json
node scripts/procgen/sphere-step.js regions  -i s2c.json -o s3.json
node scripts/procgen/sphere-step.js compile  -i s3.json  -o env.json --rules-out rules.json

# or a range in one process:
node scripts/procgen/sphere-step.js run --from plan --to compile <world flags> --rules-out rules.json
```

`plan`/`run` take the same world flags as `dump-sphere-growth.js`; the
envelope carries the resolved config so later steps need only `-i`.
`--params FILE` merges a JSON object over the carried config (override
knobs mid-pipeline). The unedited chain is byte-identical to
`dump-sphere-growth.js` for the same flags; `compile` exits 2 on a
sphere-oracle mismatch. The grown grid crosses the boundary in a
structural (tagged) form — edit the pipeline at `plan`/`allocate`/
`topology`/`items`, not the grown grid by hand.

## spiral-step.js

Per-step driver for the stepped shuffled-spiral pipeline. Runs ONE step
(or a contiguous range) of `arrange → content → regions → compile`,
reading the prior step's envelope JSON and writing the next. Shares the
step wiring with the Procgen Pipeline panel via
`frontend/modules/procgenPipeline/spiralSteps.js`, so the CLI and the
panel can't drift.

```
# four steps, each its own process:
node scripts/procgen/spiral-step.js arrange --seed 1 --quota jta=5 --start jta -o s1.json
node scripts/procgen/spiral-step.js content -i s1.json -o s2.json
node scripts/procgen/spiral-step.js regions -i s2.json -o s3.json
node scripts/procgen/spiral-step.js compile -i s3.json -o env.json --rules-out rules.json

# or the whole pipeline in one process:
node scripts/procgen/spiral-step.js run --quota maze=4 --quota jta=4 --start maze \
    --items key_red=2 --rules-out rules.json
```

`arrange`/`run` take the same world flags as `dump-shuffled-spiral.js`.
② `content` is a no-op for every current substrate (byte-identical); it's
the seam JtA's per-zone dataset lands on. The unedited chain is
byte-identical to `dump-shuffled-spiral.js` for the same flags (plus the
panel's `procgen_metadata` enrichment). Edit ① `arrange` (reorder
`sequence`, tweak `cells`) then re-run from `regions`; the grown grid
crosses the boundary in structural form — don't hand-edit it.

## check-spiral-byteidentity.mjs

Self-checking byte-identity guard for the stepped spiral pipeline: asserts
the four steps reproduce monolithic `arrangeShuffledSpiral` + `buildRulesJson`
byte-for-byte, both in-process and with a serialize→deserialize round-trip
between every step, across jta-only, maze-only, and mixed maze+jta walks
(the mixed case proves the ①→③ rng threading). Exits non-zero on any
mismatch. Sibling of `dump-sphere-byteidentity.mjs` / `check-topdown-steps.mjs`.

```
node scripts/procgen/check-spiral-byteidentity.mjs
```

## check-bounce-embed.mjs

Playwright driver for the Bounce Demo in-app round-trip (plan step 8b).
Needs the dev server on :8000. Loads
`?game=bounce_worldgen&seed=1`, lets zone 0's real physics
auto-collect the first check (the no-input spawn-column climb), then
drives the rest of the spiral chain through `__swfBridge`
sendLocation/sendExit calls, asserting stateManager
checkedLocations/inventory after every check and the iframe's
reconfigure after every region move, through Victory.

```
node scripts/procgen/check-bounce-embed.mjs
```

## check-preset-panel-click.mjs

The Presets-panel CLICK gate. Every suite loads presets via URL params or
`files:jsonLoaded`, so the panel's own click path had no witness — a
ReferenceError (`folderId is not defined`, introduced `0033a0dab`, fixed
`d52cac101`) broke every panel click for two days while all gates stayed
green. Needs the dev server on :8000. Activates the Presets tab, clicks
through to a standard procgen preset plus the three atlas presets (three
different rules.json shapes through one path), and asserts the EFFECT:
detail view rendered, no "Error Loading Preset", auto-load status reports
the rules loaded, no ReferenceError-shaped page errors.

```
node scripts/procgen/check-preset-panel-click.mjs
```

## region-atlas-pool.mjs

Builds a game's **region-atlas sphere pool** — the document sphere growth reads
when it is asked to place pieces of a real game's map into a world it grows
(`CC/docs/plans/region-atlas-plan.md`, Phase 6). It is the Phase-5b maze
projection plus, per exit, the atlas's own authored access rule, so the pool
carries payload AND rules (the third capture contract; see
`frontend/modules/procgenPipeline/regionAtlasPool.js`).

Derived, not authored: the committed pool is a build artifact with an exact
`--check` regeneration gate, and its `pool_id` ends in a content hash.

```
node scripts/procgen/region-atlas-pool.mjs \
    frontend/modules/flashPanel/atlases/seedling.json \
    -o frontend/atlas-pools/seedling-atlas-pool.json [--check] [--quiet]
```

The run prints the requirement census — for each region, the way in the sorter
would use and what the real game charges for it, or why the region is declined.

To grow with one, see `dump-sphere-growth.js --atlas` /
`--atlas-placement sorter|quota`.

## check-atlas-sphere-roundtrip.mjs

End-to-end gate for atlas placement in sphere growth: sorts the committed
Seedling pool into a plan, grows a world, and runs it through world_generator
and `Generate.py`. The independent stratum is AP's own fill (it emits a sphere
log only for a completable world); what it cannot see — whether a placed region
is physically enterable — is checked structurally here and walked for real by
the in-app leg `seedling-atlas-sphere-placed-region`.

Needs the repo Python env; runs in a throwaway world/preset and cleans up.

```
node scripts/procgen/check-atlas-sphere-roundtrip.mjs
```

## check-procgen-maze-recipe.mjs

Re-runs the `procgen_maze` section of `scripts/utils/generate_all_templates.sh`
(rendered in its `--script` mode, exactly as the Generate Presets workflow
renders it) into a temp dir and compares each output with the committed
`frontend/presets/procgen_maze/AP_<n>/AP_<n>_rules.json`, byte for byte. A
difference is reported by shape (the top-level keys, the regions changed, the
location counts). Red means the next release would re-record a preset. It was
written in `scripts/utils/` while AP_3 was red by design and enrolled here
once AP_3 was re-recorded from the recipe; it runs in CI's headless gates step.

```
node scripts/procgen/check-procgen-maze-recipe.mjs [--seeds 1,2] [--keep]
```

## check-worldgen-package-sidecars.mjs

Does every worldgen package (`worlds/<pkg>/_worldgen_sidecars.json`) carry exactly the sidecars its committed presets carry?
`Generate.py` copies a package's sidecars into `preset_sidecars[<slot>]`, so a package that drifts from its presets makes a
re-record by command change them (measured 2026-09-29: +56 exit `x`/`y` over four presets, after the 2026-09-12 strip reached
the presets but not the packages). Pairs are derived: the package's game from its `archipelago.json`, the documents from
`frontend/presets/preset_files.json` (every slot of that game); key order is ignored. A package no committed document carries
sidecars for is named, not passed. No `Generate.py` run — milliseconds.

Since 2026-10-15 (rules-produced-blocks) the same pairing also holds `_worldgen_flash_panel.json` and
`_worldgen_region_atlas.json` against the `flash_panel` / `region_atlas` slot blocks. A last section holds every committed
copy of the Seedling wiring equal to its one source, `frontend/modules/procgenPipeline/flashPanelWiring.json`. A copy is a
`flash_panel` block in any preset, or a package's `_worldgen_flash_panel.json`, whose `config` is the wired game's. A build
bump that misses a copy is red by name. A block no wiring entry names is listed as hand-kept: today only `robotkitty_tilemap`'s.

```bash
node scripts/procgen/check-worldgen-package-sidecars.mjs
```
