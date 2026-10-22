# rules-block-path — L15 game witness (p4g, headless logic-only)

`scripts/procgen/probe-seedling-l15-block-path.mjs --host=http://localhost:8213 --out=<this dir>`, on the delivered set
`seedling-vanilla-record-f5bdb07d`, each tape on a FRESH page, all from `r9-solve-15`'s staging (boot L15 (48,64)).

| tape | items | game | model |
|---|---|---|---|
| with-sword | Sword (as recorded) | L15 → L16 at t456; clears {15,0} lock, {15,2} {15,3} rocks | agrees |
| no-weapon | none | stays in L15, final (90.7, 66.4); no rock clear | agrees |
| button-hold | none; booted ON `button@112,32`, still 120 t, then for the lock | max x 125.97 < 128: the DIAGONAL button cannot be self-held | agrees |
| swim | Conch only | L15 → L16 at t305, no rock or lock clear | agrees |

- `witness-l15.log`: the first full run. Its `swim` FAILED on the game: the first cut climbed column 9 and stopped at
  (158, 114), under `chest@144,96`, which is a Solid on the game and which the model walks through (a model gap,
  handed to fidelity). The model passed it.
- `witness-l15-swim.log`: the re-cut swim, which climbs column 8 and enters column 9 at row 4, above the chest. PASS.
- `l15-block-path-<tape>.json`: one row per tape (game transitions, max x, clears, final; the model's row).
