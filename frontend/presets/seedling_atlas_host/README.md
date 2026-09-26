# seedling_atlas_host

A sphere-growth world in which a room of the **real** Seedling map HOSTS a
child behind an Archipelago gate: the room's door onward is locked until the
player holds `key_red`, and it is the HOST that enforces it — the game opens a
real door for whoever walks onto it (seedling generated levels G6).

- Four regions, seed 1, 3 spheres, 1 filler: `region_2_2` (the START) and
  `region_2_3` are maze rooms; `region_3_2` is the starter atlas's
  `overworld_start__r8c0` (level 0, the overworld outside the starting house,
  `flash_seedling`); `region_3_1` is a maze room.
- The plan, sphere by sphere: `key_blue` lies in the start maze and opens its
  exit into the real room; `key_red` lies in `region_2_3` (the start maze's
  other exit, also behind `key_blue`) and opens the real room's door onward to
  `region_3_1`, which holds `victory`.
- The real room has two doors: the owl's-nest stairs lead back to the start
  (gated on `key_blue` — the entry gate; you are only inside if you hold it),
  and the house door leads on to `region_3_1` (gated on `key_red`). Neither rule
  is in the room's payload: the host reads each one from the state manager's
  static data — the rules the logic itself evaluates.
- **Walk onto the house door without `key_red`**: the game fires the door and
  swaps into the house (the door's real destination, level 86) for a frame; the
  host refuses the crossing — no region move — and teleports the player back to
  the door's return spawn below it; the Flash Game panel's log says *"[door
  gate] the door to region_3_1 is locked — you need key_red"*. Leave by the
  owl's-nest stairs, fetch `key_red` from the maze, come back, and the house
  door opens onto `region_3_1`; walk to the victory item and the world is
  complete.
- The room holds NO location of its own on purpose: a real room's own location
  (the starting house's chest, for example) has no play-side check path yet —
  the chest fires, and nothing is checked (plan §12.4).

This is the world of `seedling_sphere_room` without that state's
`seedlingAtlasHostChildren: false` knob — the same seed, spheres and quotas;
there the room is a LEAF.

The world is a FUNCTION of `SEEDLING_ATLAS_HOST_STATE` in
`frontend/modules/procgenPipeline/presetDefs.js`, never a hand edit. Regenerate
(deterministic, byte-identical every time):

```
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=atlas-host          # write
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=atlas-host --check  # the gate
```

The box gate that plays it is `scripts/procgen/check-seedling-atlas-host-play.mjs`.
