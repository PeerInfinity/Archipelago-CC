# seedling_generated_leaf

A sphere-growth world with ONE **generated** Seedling room in it, as a LEAF
behind a maze gate: a room the procgen pipeline asked the Seedling level
generator for, holding the victory item, played in the Seedling wasm (seedling
generated levels G3).

- Three regions, seed 1, 3 spheres: `region_2_2` (the START) and `region_2_3`
  are maze rooms; `region_3_3` is a generated Seedling room
  (`flash_seedling_gen`, level 0, 8×6).
- The plan, sphere by sphere: `key_blue` lies in `region_2_2` and opens its exit
  to `region_2_3`; `key_red` lies in `region_2_3` and opens its exit to the
  generated room; the generated room's goal cell (tile 5,3) holds the AP
  location `region_3_3__loc_0` — the `victory` item, as an Archipelago item.
- The generated room has ONE door, the way back (tile 1,4, drawn as a portal),
  bound to `region_2_3`'s exit. The engine inserted it; it is ungated (a
  generated door enforces no AP gate, so the room hosts no children). Coming in
  from the maze, the player lands on its approach cell (tile 1,3); going out, the
  game waits in a one-cell PARKING room while the maze plays, and the maze puts
  the player on its exit paired with the door.
- No door seals its approach and no door, approach or location stands on a
  hazard (the pits at 6,1, 6,2 and 5,4); the room needed 0 re-rolls
  (`generation.rerolls`).

The level set is not in this file. At play it is ASSEMBLED from the room the
sidecar carries (`seedlingDemo/seedlingGeneratedSet.js`) and delivered to the
game when the Flash Game panel starts. The panel log names the generated arm.

The world is a FUNCTION of `SEEDLING_GENERATED_LEAF_STATE` in
`frontend/modules/procgenPipeline/presetDefs.js`, never a hand edit. Regenerate
(deterministic, byte-identical every time):

```
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated-leaf          # write
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated-leaf --check  # the gate
```

The box gate that plays it is `scripts/procgen/check-seedling-generated-leaf-play.mjs`.
