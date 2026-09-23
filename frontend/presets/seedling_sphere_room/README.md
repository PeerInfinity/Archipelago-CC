# seedling_sphere_room

A sphere-growth world with ONE room of the **real Seedling map** in it, placed
as a LEAF behind a maze gate (seedling-in-the-pipeline T3): the first procgen
mode that GROWS a world around a real room rather than laying one on a grid.

- Four regions, seed 1, 3 spheres, 1 filler, starting in a maze:
  `region_2_2` (start) → `region_2_3` → `region_2_4` (victory), and the room
  `region_3_2` behind `region_2_2`'s `exit_1`.
- The room is `dungeon1_room1`, sub-region `r0c4` (level 3). It is the filler,
  so it carries no AP location; the tightest room of the starter atlas that
  fits a 0-item leaf (one wired door, no marked location).
- **The gate is the maze's.** `region_2_2`'s `exit_1` needs `key_blue`, which
  lies in `region_2_2` itself (sphere 1). A real Seedling door cannot enforce an
  AP gate, so the room hosts no children and its door back — the real
  `stairs_up`, bound `external` to the maze — is ungated in the game; the
  rules copy the entry gate onto it, which only restates that you are inside.
- The door and the maze exit are PAIRED by `targetExitId` on both sides
  (`stairs_up` ⇄ `exit_1`), so a crossing lands on the exit that leads back.
- The room keeps its vanilla contents; the AP level set is not delivered
  because these rules are not a Seedling placement.

The world is a FUNCTION of `SEEDLING_SPHERE_ROOM_STATE` in
`frontend/modules/procgenPipeline/presetDefs.js`, never a hand edit. Regenerate
(deterministic, byte-identical every time):

```
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=sphere          # write
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=sphere --check  # the gate
```

Registered once with
`python scripts/utils/register-preset.py --game-id seedling_sphere_room frontend/presets/seedling_sphere_room/AP_1/AP_1_rules.json`;
a dev preset (`scripts/release/preserved-dev-presets.txt`), so it is not in
`preset_files.live.json`.

Load it as `frontend/?game=seedling_sphere_room&seed=1`. The box gate
`scripts/procgen/check-seedling-sphere-room-play.mjs` plays it: the maze gate
opened with its key, into the room, the game's own stairs back out.
