# Headless procgen scripts

Node ESM scripts for running procgen pipelines outside the browser.
Useful for engine-only debugging where booting the frontend would
add noise.

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
libraries are imported for the registry side-effects but no UI or
state-manager wiring runs.

Output shape:

- `config` — echoed inputs
- `startCell`, `stats` (incl. `substrateCounts`, `stopReason`)
- `regions[]` — `{ id, substrate, cell, exits[] }` per built region;
  each exit includes `targetRegion`, `isBackExit`, `isTeleporter`
- `rulesJson` — full compiled rules.json

The script imports modules that schedule background timers (the
state-manager proxy etc.), so it force-exits after writing. Errors
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

## verify-jta-locations-roundtrip.mjs

Phase 1 round-trip check for the jta zone-locations channel (plan §2b).
Generates a jta-locations world through the full toolchain — JS pipeline
→ `world_generator` → `Generate.py` — in a throwaway world/preset and
asserts that the task locations, their sidecar payload fields
(`ap_locations`, `jtaZone`), and the sphere log survive into the exported
rules.json + sphere log + spoiler (Pass B's inputs). Self-cleaning.
Requires the repo Python env.

```
node scripts/procgen/verify-jta-locations-roundtrip.mjs
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
`dump-sphere-growth.js` for the same flags; `compile` exits non-zero on a
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

## dump-spiral-byteidentity.mjs

Self-checking byte-identity guard for the stepped spiral pipeline: asserts
the four steps reproduce monolithic `arrangeShuffledSpiral` + `buildRulesJson`
byte-for-byte, both in-process and with a serialize→deserialize round-trip
between every step, across jta-only, maze-only, and mixed maze+jta walks
(the mixed case proves the ①→③ rng threading). Exits non-zero on any
mismatch. Sibling of `dump-sphere-byteidentity.mjs` / `verify-topdown-steps.mjs`.

```
node scripts/procgen/dump-spiral-byteidentity.mjs
```

## verify-bounce-embed.mjs

Playwright driver for the Bounce Demo in-app round-trip (plan step 8b).
Needs the dev server on :8000. Loads
`?game=bounce_worldgen&seed=1`, lets zone 0's real physics
auto-collect the first check (the no-input spawn-column climb), then
drives the rest of the spiral chain through `__swfBridge`
sendLocation/sendExit calls, asserting stateManager
checkedLocations/inventory after every check and the iframe's
reconfigure after every region move, through Victory.

```
node scripts/procgen/verify-bounce-embed.mjs
```

## verify-preset-panel-click.mjs

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
node scripts/procgen/verify-preset-panel-click.mjs
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

## verify-atlas-sphere-roundtrip.mjs

End-to-end gate for atlas placement in sphere growth: sorts the committed
Seedling pool into a plan, grows a world, and runs it through world_generator
and `Generate.py`. The independent stratum is AP's own fill (it emits a sphere
log only for a completable world); what it cannot see — whether a placed region
is physically enterable — is checked structurally here and walked for real by
the in-app leg `seedling-atlas-sphere-placed-region`.

Needs the repo Python env; runs in a throwaway world/preset and cleans up.

```
node scripts/procgen/verify-atlas-sphere-roundtrip.mjs
```
