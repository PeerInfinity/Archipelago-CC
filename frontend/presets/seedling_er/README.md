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
  placements}` (each placement names the AP exit and the AP exit it lands beside). `source.atlas_id` is the
  authored atlas; the compiled `region_atlas` / `atlas_ref` name the restamped shuffled graph.
- **Checked when it is made**: E2's validator (coupled mirror included); the layout is beatable under its own
  rules (the sphere walk collects every location and The Seed); Seedling's checks (sphere 0 no smaller than
  vanilla's; no moved stair lands on an at-risk permissive binding).
- ⛔ **Not playable as a shuffle yet** (Q3): the game still takes a stair to its vanilla room; the play-time
  redirect is E5. No world package or Generate.py seed is built from it (that is the ER world-package step).

The world is a FUNCTION of the committed atlas, producer and derived-rule table and of the run
(`seedlingErState()` in the producer: the atlas id and seed 1), never a hand edit. Regenerate (deterministic,
byte-identical every time; ~20 s):

```
node scripts/procgen/make-seedling-er-preset.mjs          # write
node scripts/procgen/make-seedling-er-preset.mjs --check  # the gate
```

Regenerate it whenever the playthrough rules move (after the playthrough recipe's producers), and re-run its
pins (`scripts/procgen/seedlingErMode.test.js`). The same run, stepped: `node scripts/procgen/entrance-step.js
run --atlas <atlas id> --seed 1 -o env.json --rules-out rules.json`.

Registered once with
`python scripts/utils/register-preset.py --game-id seedling_er frontend/presets/seedling_er/AP_1/AP_1_rules.json`;
a dev preset (`scripts/release/preserved-dev-presets.txt`), so it is not in `preset_files.live.json`.
