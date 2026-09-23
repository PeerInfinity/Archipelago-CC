# seedling_spiral_room

A shuffled-spiral world with ONE room of the **real Seedling map** in it: the
simplest test of a Seedling region running through the procgen pipeline and
playing in the Seedling wasm (seedling-in-the-pipeline T2).

- Four regions, seed 1, 8×6: three generated maze rooms around one placed
  `flash_seedling` room.
- The Seedling room is the START region `region_0_0`: the overworld start
  screen (`overworld_start`, sub-region `r8c0`, level 0). Menu → GameStart lands
  the player inside Seedling, at `house_door`.
- Two of the room's real doors are bound to the spiral's exits, both `external`
  to the maze: `house_door → exit_S → region_0_1` and
  `owls_nest_stairs → exit_E → region_1_0`. When the game fires one of them it
  still swaps into the door's real destination (level 86 or 2), and the host
  parks the game there while the maze room plays. The level's other doors
  (`hut_door`, `gundernourd_stairs`, the edges) are not declared: taking one
  moves the game and warns that the AP region did not move.
- No location: the room is placed with its vanilla contents, and the AP level
  set is not delivered because these rules are not a Seedling placement.

The world is a FUNCTION of `SEEDLING_SPIRAL_ROOM_STATE` in
`frontend/modules/procgenPipeline/presetDefs.js`, never a hand edit. Regenerate
(deterministic, byte-identical every time):

```
node scripts/procgen/make-seedling-spiral-room-preset.mjs          # write
node scripts/procgen/make-seedling-spiral-room-preset.mjs --check  # the gate
```

Registered once with
`python scripts/utils/register-preset.py --game-id seedling_spiral_room frontend/presets/seedling_spiral_room/AP_1/AP_1_rules.json`;
a dev preset (`scripts/release/preserved-dev-presets.txt`), so it is not in
`preset_files.live.json`.

Load it as `frontend/?game=seedling_spiral_room&seed=1`. The box gate
`scripts/procgen/check-seedling-spiral-room-play.mjs` plays it: the game's own
doors out, the maze walked back in.
