# seedling_er

The Seedling playthrough with its **stairs entrance-randomized** (ENTRANCE RANDOMIZATION E4b): the
`entranceShuffle` pipeline mode (`frontend/modules/procgenPipeline/entranceShuffleSteps.js`) run headless over
the committed playthrough atlas (`frontend/modules/flashPanel/atlases/seedling-playthrough.json`) at seed 1.

- **What moves** (⚖ user 2026-11-01): stairs only (Q1), coupled (Q2) — the 26 stairs pairs less the PIN-CHAIN pair
  (`L0:out_stairsdown_256_272`, which the L110 pit chain fires, and its reverse `L2:out_stairsup_48_16`): 25 pairs,
  50 exits. Screen edges, pits and warps are out of scope. Seed 1's draw happens to place one pair at its own
  reverse, so 48 of the 50 exits land somewhere new.
- **Items are vanilla** (Q4): every collectible is where the game put it.
- **The logic is re-derived**: the placements rewrite the atlas's connections (a stair placed beside stair E lands on
  the arrival exit beside E, so every room keeps its landing tiles) and the playthrough producer
  (`make-seedling-playthrough-rules.mjs` `compilePlaythroughRules`) compiles the shuffled doc. The derived-rule
  table applies by atlas endpoint and skips, by name, the rows of the exits the shuffle moved.
- **What the doc carries**: `er` on the 52 classified exits (`shuffle: false` on the pinned pair) and
  `entrance_randomization["1"]` = `{algorithm: 'ger', coupled: true, target_group_lookup, seed, source: {atlas_id},
  placements}` (each placement names the AP exit and the AP exit it lands beside). Its game is
  `Seedling Playthrough ER` (no world package of the vanilla game generates it).
- **Which atlas it names**: the shuffled graph is a different document, so it is restamped and the compile's
  `provenance` names THAT id; every play-time reference (`region_atlas`, each sidecar's `atlas_ref`) names the
  AUTHORED atlas, `source.atlas_id` too — every room, sub-region and tile is the authored atlas's
  (`compileRegionAtlas` `roomsAtlasId` refuses otherwise), so the runtime's partition and bindings apply.
- **Checked when it is made**: E2's validator (coupled mirror included); the layout is beatable under its own
  rules (the sphere walk collects every location and The Seed); Seedling's checks (sphere 0 no smaller than
  vanilla's; no moved stair lands on an at-risk permissive binding).
- **Played as a shuffle through the level data (E5)**: the randomized load delivers the level set with every moved
  stairs' exit rewritten to its shuffled destination (`frontend/modules/seedlingDemo/entranceRetarget.js`, applied by
  `flashPanel/seedlingRandomizerWiring.js` after the AP item rewrite), so the game itself loads the shuffled room: no
  vanilla room in between (Q3's flash is zero) and no redirect in the region binding. A load that does not deliver
  those rooms (a build without the capabilities, a refused delivery) is refused BY NAME as an entrance-randomized
  world left on vanilla rooms. Witness: `node scripts/procgen/probe-seedling-wasm-er-retarget.mjs`. The Playback Bot
  and the JS substrate's own runtime on this world are E6.
- **Gated as a world (E4c)**, with nothing committed beside it:
  - the **whole-game maze certifier** has an ER arm with its own baseline: `node scripts/procgen/probe-seedling-whole-game-certify.mjs
    --source=er` rebuilds this preset's shuffled atlas (`make-seedling-er-preset.mjs` `buildSeedlingErSource`, refused unless it
    compiles to this file), projects it into the maze (`make-seedling-playthrough-maze.mjs` `buildPlaythroughMaze({source})`) and
    holds the verdict against `scripts/procgen/seedling-er-whole-game-certify-expected.json`;
  - the **Python reachability** checks run over a world package generated from this file into a temp dir
    (`test/test_seedling_er_reachability.py`, the package recipe `scripts/lib/worldgen_recipe.py`): no package under `worlds/`.
  - The shuffled atlas, by hand: `node scripts/procgen/make-seedling-er-preset.mjs --atlas-out=er-atlas.json`, then
    `node scripts/procgen/make-seedling-playthrough-maze.mjs --source=er-atlas.json --out=er-maze.json`.

The world is a FUNCTION of the committed atlas, producer and derived-rule table and of the run
(`seedlingErState()` in the producer: the atlas id and seed 1), never a hand edit. Regenerate (deterministic,
byte-identical every time; ~20 s):

```
node scripts/procgen/make-seedling-er-preset.mjs          # write
node scripts/procgen/make-seedling-er-preset.mjs --check  # the gate
```

Regenerate it whenever the playthrough rules move (after the playthrough recipe's producers), and re-run its
pins (`scripts/procgen/seedlingErMode.test.js`). The same run, stepped (byte-identical to this file): `node scripts/procgen/entrance-step.js
run --atlas <atlas id> --seed 1 --game-name "Seedling Playthrough ER" -o env.json --rules-out rules.json`; `--to shuffle --save
env.json` then `run --resume env.json --rules-out rules.json` gives the same file without re-pooling (ER E4c).

Registered once with
`python scripts/utils/register-preset.py --game-id seedling_er frontend/presets/seedling_er/AP_1/AP_1_rules.json`;
a dev preset (`scripts/release/preserved-dev-presets.txt`), so it is not in `preset_files.live.json`.
