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

## Format

- Schema (documentation): [`frontend/schema/region-atlas.schema.json`](../../../schema/region-atlas.schema.json)
- Validator (authoritative): [`frontend/modules/procgenPipeline/regionAtlasValidator.js`](../../procgenPipeline/regionAtlasValidator.js)

`atlas_id` ends in a content hash. After any hand edit, restamp — the new hash
is what invalidates the downstream pipeline steps keyed on it:

```sh
node scripts/procgen/region-atlas-validate.mjs --restamp atlases/<game>.json
```

(`--restamp` rewrites the file with `JSON.stringify(…, 2)`, which explodes the
tile pairs one number per line. For a hand-maintained document, prefer running
the CLI without `--restamp` to check, and paste the reported hash into
`atlas_id` + `provenance.content_hash` by hand — the hash is computed over the
parsed document, so formatting never moves it.)

## Files

- `seedling-fixture.json` — the Phase-1 test anchor. Three regions using
  Seedling's real region and item names, but **invented geometry**: it exists to
  exercise every feature of the format (multi-tile edge spans, teleporters, a
  region with no subgraph, item-gated and one-way internal exits, boundary and
  location access rules, both `rules_source` flavours, the vanilla layout), not
  to describe the real map. The real Seedling atlas arrives with the marking
  tool in Phase 2.
