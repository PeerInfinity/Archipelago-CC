# seedling_generated_host

A sphere-growth world whose START is a **generated** Seedling room that HOSTS a
child behind an Archipelago gate: the door out of the room is locked until the
player holds `key_blue`, and it is the HOST that enforces it — the game cannot
hold a pipeline item (seedling generated levels G4).

- Three regions, seed 1, 3 spheres: `region_2_2` (the START) is a generated
  Seedling room (`flash_seedling_gen`, level 0, 8×6); `region_2_3` and
  `region_3_3` are maze rooms.
- The plan, sphere by sphere: `key_blue` lies on the generated room's goal cell
  (tile 4,3 — the AP location `region_2_2__loc_0`, as an Archipelago item) and
  opens the room's one door to `region_2_3`; `key_red` lies in `region_2_3` and
  opens its exit to `region_3_3`, which holds `victory`.
- The room's door (tile 1,2, drawn as a portal) is bound to `region_2_3`'s exit
  back, and its gate — `Has(key_blue)` — is in the rules.json AND in the
  payload's `exitGates`, so the play-side world carries it. The player boots on
  the door's approach cell (tile 1,1), right above it.
- **Walk onto the door without the key**: the game fires the door and swaps
  into the PARKING room, the host refuses the crossing — no region move — and
  teleports the player back onto the approach cell; the Flash Panel's log
  says *"[door gate] the door to region_2_3 is locked — you need key_blue"*.
  Walk to the AP logo on the goal cell (right, down, right, down: 1,1 → 3,1 →
  3,2 → 4,2 → 4,3) and the key arrives; walk back onto the door and it opens:
  the maze comes forward with the player on its exit paired with the door.
- No door seals its approach and no door, approach or location stands on a
  hazard (the water and pits); the room needed 0 re-rolls
  (`generation.rerolls`).

The level set is not in this file. At play it is ASSEMBLED from the room the
sidecar carries (`seedlingDemo/seedlingGeneratedSet.js`) and delivered to the
game when the Flash Panel starts. The panel log names the generated arm.

The world is a FUNCTION of `SEEDLING_GENERATED_HOST_STATE` in
`frontend/modules/procgenPipeline/presetDefs.js`, never a hand edit. Regenerate
(deterministic, byte-identical every time):

```
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated-host          # write
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=generated-host --check  # the gate
```

The box gate that plays it is `scripts/procgen/check-seedling-generated-host-play.mjs`.
