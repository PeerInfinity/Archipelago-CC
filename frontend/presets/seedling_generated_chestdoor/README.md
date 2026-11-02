# seedling_generated_chestdoor

The generated maze spiral (`seedling_generated_room`'s world) with the
**chestdoor** element: each generated Seedling room grows a wall across its
corridor whose only gap is a CHEST, and each chest is an Archipelago location.

- Four regions, seed 1: `region_0_0` (the START) and `region_0_1` are generated
  Seedling rooms (`flash_seedling_gen`, levels 0 and 1, 10×10, `pre-sword`,
  `elements: chestdoor`); `region_1_0` and `region_1_1` are maze rooms.
- Three locations, three items:
  - `region_0_0__key_blue_pickup` — `key_blue` on room 0's goal cell (tile 4,1);
  - `region_0_0 - Chest` — the chest at tile 2,1 (tag 1), `Region Library Filler`;
  - `region_0_1 - Chest` — the chest at tile 6,5 (tag 1), `Region Library Filler`.
- A door chest is NOT replaced by an `apitem`: the chest stays (it is the wall's
  gap) and its `{level, tag}` clear is the location check
  (`seedlingGeneratedSet.placeApItems`, `kind: 'chest-door'`). The player opens
  it from the cell below.
- Room 1's chest is two goals from the start (the door, then the chest) and is
  not walked by the bot (one goal per room).

The level set is not in this file. At play it is ASSEMBLED from the room the
sidecar carries (`seedlingDemo/seedlingGeneratedSet.js`) and delivered to the
game when the player first enters the room.

The world is a FUNCTION of `SEEDLING_GENERATED_CHESTDOOR_STATE` in
`frontend/modules/procgenPipeline/presetDefs.js`, never a hand edit. Regenerate
(deterministic, byte-identical every time):

```
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated-chestdoor          # write
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated-chestdoor --check  # the gate
```

The in-app row that plays it in the REAL Seedling wasm game is
`seedling-wasm-generated-chestdoor-chest` (batch `seedling-wasm`): the Playback
Bot walks to `region_0_0 - Chest` and the row ends on its `locationCheck`.
