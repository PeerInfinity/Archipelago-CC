# seedling_generated_swim

A sphere-growth world whose gate is **water**: the maze START holds the
Archipelago item `Progressive Swim` (the conch; the Seedling bridge grants
`canSwim` on the first one), and its exit leads into a **generated** Seedling
room whose `watergate` stands between the player's arrival and the victory item
(seedling swim T1).

- Two regions, seed 1, 2 spheres: `region_2_2` (the START) is a maze room
  holding `Progressive Swim` (`region_2_2__loc_0__5_3`); `region_3_2` is a
  generated Seedling room (`flash_seedling_gen`, level 0, 8×6) holding `victory`
  on its goal cell (tile 2,3 — `region_3_2__loc_0`).
- The maze's exit into the room is gated `Has(Progressive Swim)`, and so is the
  room's door back. The room was generated in the `post-swim` biome with
  `elements: watergate` and `require: canSwim`: the generator's differential
  certified the goal SOLVED with the conch and REFUSED without it. The tree's
  gate and the room's requirement are one item.
- The room (`S` start, `a` the door's approach, `D` the door, `~` water, `G` the
  goal):

  ```
  ########
  #S...aD#
  #~######
  #.G....#
  #......#
  ########
  ```

  The player arrives on the approach cell (tile 5,1), on the dry side; the one
  water cell (tile 1,2) is the only way down to the goal. With the conch it is
  swum; a non-swimmer's `drownTimer` would run out on it.
- The door, its approach and the location stand on no hazard, and the approach
  is reached from the room's start without crossing water
  (`seedlingGenRoom.pickGenRoomDoors`); the room needed 0 re-rolls
  (`generation.rerolls`).

The level set is not in this file. At play it is ASSEMBLED from the room the
sidecar carries (`seedlingDemo/seedlingGeneratedSet.js`) and delivered to the
game when the player first enters the room.

The world is a FUNCTION of `SEEDLING_GENERATED_SWIM_STATE` in
`frontend/modules/procgenPipeline/presetDefs.js`, never a hand edit. Regenerate
(deterministic, byte-identical every time):

```
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated-swim          # write
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated-swim --check  # the gate
```

The box gate that plays it is `scripts/procgen/check-seedling-generated-swim-play.mjs`.
