# rules-r4b-followup — evidence

## Part 1: the L70 → L69 pit landing (`witness-l70-pit.mjs`, `witness-l70-pit.log`)

p4g headless logic-only, a fresh page per arm, :8211. L70's only pit is tile (2,2) = (32,32). Two tapes (into the
pit from below with `up`, from the left with `right`) × (the built-in map, the delivered set):

| arm | game: the transition | game: final position (tile) | model |
|---|---|---|---|
| builtin / up, builtin / right, delivered / up, delivered / right | t28, L70 → L69 | (56,136) → tile (3,8) | identical transitions |

So the fall's ctor is (48,128), as `playerPhysicsV2.fallDestination` computes it. `Player.checkFallingInPit` uses
`fallInPitPos = (tile_test.x, tile_test.y)`, and a `Tile` is built at its centre (`Scenery/Tile.as:103`,
`super(_x + w/2, _y + h/2)`). The atlas's `out_pit_3_7` used the tile CORNER (`seedlingAtlasDerivation.pitOf`), and
L70's control offset is not a tile multiple, so the corner gave (3,7). Fixed in `pitOf`: the atlas now names
`out_pit_3_8` → `in_pit_L70_3_8`. No other pit in the playthrough atlas moves.

## Parts 2 and 3 (`survey-7.3-local-steps.log`)

A local `survey-seedling-route.mjs --through=7.3 --route=full --only=28,51,125,162,163` run after both fixes:
28 SOLVED (568 t), 51 REFUSED (the accepted refusal: the Times encounter's tree burn has no Fire in the run), 125
NO-EDGE (the L57 mouth exit, a pre-existing family; the Tentacled Beast is a skip by name), 162 SOLVED (105 t), 163
SKIPPED (Lights, by name). The CI dispatches on the branch are the record.

## The centre fix's reach (`census-pit-centre.mjs`, `census-pit-centre.log`)

`pitOf` is shared, so every pit landing it derives was compared, corner vs centre, over the vanilla map AND the
delivered set: 38 pit tiles over 12 rooms each, and ONE landing moves in both (L70 pit (2,2) → L69, (3,7) → (3,8)).
Outside the dated reports under `CC/docs/cloud-reports`, the only committed artifacts naming a pit exit are the
playthrough family (atlas, AP_1, the seed-1 rules, the package sidecars) and the vanilla overlay, all regenerated. The
starter atlas, spiral room and sphere order regenerate byte-identical. The divergence leg list (863 legs) re-keys exactly
three: `level_70 <- in_L66_72_64 -> exit:out_pit_3_7`, and `level_69 <- in_pit_L70_3_7 -> exit:out_lightbosscontroller_72_72`
and `-> location:Level 069 - Lights` become `…3_8`. The two L69 legs now arrive at (48,128), not (48,112). No other leg moves.
