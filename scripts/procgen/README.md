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
