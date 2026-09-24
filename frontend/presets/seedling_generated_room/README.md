# seedling_generated_room

A shuffled-spiral world with TWO **generated** Seedling rooms in it: rooms the
procgen pipeline asked the Seedling level generator for, played in the Seedling
wasm (seedling generated levels G2).

- Four regions, seed 1, 10×10: `region_0_0` and `region_0_1` are generated
  Seedling rooms (`flash_seedling_gen`, levels 0 and 1); `region_1_0` and
  `region_1_1` are maze rooms.
- `region_0_0` is the START region. Menu → GameStart lands the player on the
  approach cell of its first door. Its goal cell holds the AP location
  `region_0_0__key_blue_pickup` (the blue key) as an Archipelago item.
- Each generated room has two doors, drawn as portals:
  - `region_0_0` `exit_0` (tile 8,1) ↔ `region_0_1` `exit_0` (tile 4,3). The
    game makes this crossing itself, and the host moves the AP region to match.
  - `region_0_0` `exit_1` (tile 8,8) → the maze `region_1_0`, and `region_0_1`
    `exit_1` (tile 6,3) → the maze `region_1_1`. At these doors the game waits in
    a one-cell PARKING room while the maze plays. Coming back, the player
    lands on the approach cell of the door they left by.
- No door seals another's approach: with every door (and every water, lava and
  pit cell) a wall, the start still reaches each door's approach cell and the
  goal; no door, approach or location stands on a hazard (seedling generated G2; a room
  that cannot seat its doors that way is re-rolled, and `generation.rerolls`
  records how many times — 0 for both rooms here).
- No region names are declared, so no door shows a region sign.

The level set is not in this file. At play it is ASSEMBLED from the rooms the
sidecars carry (`seedlingDemo/seedlingGeneratedSet.js`) and delivered to the
game when the Flash Game panel starts. The panel log names the generated arm.

The world is a FUNCTION of `SEEDLING_GENERATED_ROOM_STATE` in
`frontend/modules/procgenPipeline/presetDefs.js`, never a hand edit. Regenerate
(deterministic, byte-identical every time):

```
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated          # write
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated --check  # the gate
```

The box gate that plays it is `scripts/procgen/check-seedling-generated-room-play.mjs`.
