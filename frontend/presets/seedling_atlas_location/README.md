# seedling_atlas_location

A sphere-growth world whose START is a room of the **real** Seedling map, and
whose first item lies in that room's **own** location: the chest of the
starting house. Opening the chest is an Archipelago check — the location
`Starting House - Chest` — and the item it holds (`key_blue`) opens the room's
door (seedling generated levels G7).

- Three regions, seed 1, 3 spheres, no filler: `region_2_2` (the START) is the
  starter atlas's `starting_house` (level 86, `flash_seedling`); `region_2_3`
  and `region_3_3` are maze rooms.
- The plan, sphere by sphere: `key_blue` is in the starting house's chest and
  opens the house door onward to `region_2_3`; `key_red` lies in `region_2_3`
  and opens its exit to `region_3_3`, which holds `victory`.
- **How the chest becomes a check.** The atlas compiler names a real room's
  location by its atlas region (`Starting House - Chest`), which the vanilla
  goal ledger cannot name — so the vanilla placement arm does not apply. The
  ATLAS arm (`flashPanel/seedlingRandomizerWiring.loadSeedlingAtlas`) binds the
  location where it stands: the map entity on the location's tile that grants
  its vanilla item (the chest), and that entity's own persistence tag — the
  game reports `pendingCheck "<seq>|86|0|0"` when it opens. Nothing is
  rewritten and nothing is delivered: the game's own chest still hands its
  vanilla Seal in-game too (no Seedling property reports a Seal, so no second
  check fires).
- **Walk onto the house door before opening the chest**: the host refuses the
  crossing and puts you back below the door; the Flash Game panel's log says
  *"[door gate] the door to region_2_3 is locked — you need key_blue"*. Open the
  chest — the log says *"[ap placement] found key_blue for you at "Starting
  House - Chest""* — and the door opens onto the maze.

The world is a FUNCTION of `SEEDLING_ATLAS_LOCATION_STATE` in
`frontend/modules/procgenPipeline/presetDefs.js`, never a hand edit. Regenerate
(deterministic, byte-identical every time):

```
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=atlas-location          # write
node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=atlas-location --check  # the gate
```

The box gate that plays it is `scripts/procgen/check-seedling-atlas-location-play.mjs`.
