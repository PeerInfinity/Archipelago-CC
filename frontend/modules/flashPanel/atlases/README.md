# Region atlases

Per-game **region atlas** documents — the canonical map partition a real game's
tile map is divided into for procgen (see
[`CC/docs/plans/region-atlas-plan.md`](../../../../CC/docs/plans/region-atlas-plan.md)).
They live here, beside the game's wrapper config in `../games/`, exactly as
`jtaSubstrateWrapper/datasets/` holds JtA's authored documents.

Division of labour (plan decision 6):

| | lives in |
|---|---|
| Map semantics — regions, exits, sub-region subgraphs, locations, vanilla layout | the atlas (here) |
| Engine binding — teleport recipes, injected-AS class paths, `ap_items`/`ap_locations` | `../games/<id>.json` |

The atlas is the single source of truth; the three projections (vanilla
`rules.json`, sphere-sorter input, play-time `playable_payload`) are compiled
from it and never read each other.

## Projection 1 — the vanilla `rules.json`

[`regionAtlasCompiler.js`](../../procgenPipeline/regionAtlasCompiler.js) turns an
atlas into the AP `rules.json` the frontend loads: sub-regions become AP regions
(`<region_id>__<sub_region>`), internal exits and `vanilla_layout.connections`
become AP exits, and locations carry their `vanilla_item`. It is **graph only** —
no `preset_sidecars`; play-time walking runs the real game (Phase 4).

```sh
node scripts/procgen/region-atlas-compile.mjs atlases/seedling.json \
    -o frontend/presets/seedling_atlas/AP_1/AP_1_rules.json
node scripts/procgen/region-atlas-compile.mjs atlases/seedling.json \
    -o frontend/presets/seedling_atlas/AP_1/AP_1_rules.json --check   # gate
```

The output has no timestamp, so `--check` is exact. Unwired boundary exits are
**omitted** from the graph and named in the report — the compile is not a silent
truncation. The marking tool's *Export rules.json* and *Edit in APWorld Editor*
buttons run the same compiler.

## Format

- Schema (documentation): [`frontend/schema/region-atlas.schema.json`](../../../schema/region-atlas.schema.json)
- Validator (authoritative): [`frontend/modules/procgenPipeline/regionAtlasValidator.js`](../../procgenPipeline/regionAtlasValidator.js)

`atlas_id` ends in a content hash. After any hand edit, restamp — the new hash
is what invalidates the downstream pipeline steps keyed on it:

```sh
node scripts/procgen/region-atlas-validate.mjs --restamp atlases/<game>.json
```

`--restamp` rewrites through
[`compactJson.js`](../../procgenPipeline/compactJson.js) — the same writer the
marking tool saves with — so tile pairs and small objects like `bounds` stay on
one line and a restamp of an unedited document is a no-op diff. (Before Phase 2
it used `JSON.stringify(…, 2)`, which put every coordinate on its own line;
the "paste the hash in by hand" workaround that forced is gone.)

## Coordinate spaces

RWK is one big tile map. Seedling is 116 separate levels, each with its own
origin — so a region names the space its `bounds` and tiles live in with
`map_ref` (a level id), and `tile_space.map_document` names the document those
ids index. Both are optional and additive: a single-space atlas omits them and
validates exactly as it did in Phase 1. When the map document sits beside the
atlas, the CLI loads it and resolves every `map_ref` against a real level.

## Files

- `seedling-map.json` — the **map source**, not an atlas: 116 levels extracted
  from the Seedling source checkout (Ogmo `.oel` levels + `Game.as`'s level
  table), holding per-level tile placements with raw tileset identity and the
  full entity layer. Regenerate and verify with:

  ```sh
  node scripts/procgen/extract-seedling-map.mjs --source ~/CC/seedling
  node scripts/procgen/extract-seedling-map.mjs --source ~/CC/seedling --check
  ```

  It carries no timestamp, so `--check` is exact: the same checkout produces
  the same bytes. Seedling is MIT, so unlike RWK's tile map this is committed.
  `level` is the 0-based index into `Game.as`'s `levels` array — the same
  number `games/seedling.json` uses in `teleport` / `region_coords` /
  `location_coords`, and the same one a `teleporter` entity's `to` names.
  Semantic tile categories (walkable/solid) are deliberately absent: that is
  Phase 5's job, and this document keeps raw tileset identity only.

- `seedling.json` — the real Seedling atlas, **partial**: the three regions
  around the game start (the overworld start room, the house, and the Owl's Nest
  entrance), authored with the marking-tool panel and meant to be grown from
  there. Every exit tile is a real level-link entity in `seedling-map.json` —
  the geometry is derived, not typed — so it is rebuilt rather than hand-edited
  when the map changes:

  ```sh
  node scripts/procgen/make-seedling-starter-atlas.mjs           # rebuild
  node scripts/procgen/make-seedling-starter-atlas.mjs --check   # gate
  ```

  Its six warnings are all `exit … is not wired`: real map crossings out of the
  start room that this atlas does not cover yet. That list is the growth queue,
  not a defect. The sub-region splits are deliberately absent — which tiles a
  breakable rock separates is a reachability question for the Phase-5 analyzer,
  not something to guess by hand.

- `seedling-fixture.json` — the Phase-1 test anchor. Three regions using
  Seedling's real region and item names, but **invented geometry**: it exists to
  exercise every feature of the format (multi-tile edge spans, teleporters, a
  region with no subgraph, item-gated and one-way internal exits, boundary and
  location access rules, both `rules_source` flavours, the vanilla layout), not
  to describe the real map. It is the format anchor the validator tests read off
  disk — leave it alone; author real maps in their own file.
