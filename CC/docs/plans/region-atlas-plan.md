# Region Atlas: Real-Game Maps as Procgen Regions

**Date:** 2026-07-26 (Phase 1 shipped 2026-07-27)
**Status:** Design ruled; Phase 1 (atlas format) complete — Phase 2 next
**Games:** Seedling first (redistributable, discrete sections, source available), then Robot Wants Kitty

## Goal

Divide a real game's map into procgen regions. The game plays normally, but
marked boundary tiles trigger the standard procgen region-exit transition
(host round trip → teleport into the destination region's entrance tile),
so regions of the original game can be recomposed by the pipeline — adjacent
in the original, not necessarily adjacent in the generated world, and freely
interleaved with regions from other substrates. Downstream, sphere growth
learns to place these pre-built regions into the worlds it creates, and a
staged playback bot proves the generated worlds beatable.

This is the umbrella plan for the whole arc. The first artifact is the
**region atlas** — the canonical per-game storage format every other piece
consumes — followed by the marking tool that authors it.

## Settled design decisions

These were discussed and agreed 2026-07-26. Do not re-litigate without new
information.

1. **Entrance-dependent logic = sub-region split, not entrance tracking.**
   A physical region whose interior has traversal obstacles is modeled as a
   subgraph of logical sub-regions split at each obstacle; each boundary exit
   and each location binds to a specific sub-region; the obstacle becomes an
   internal exit carrying the traversal rule. AP's ordinary region
   reachability then answers "what can I reach having entered here" with no
   engine or rule_builder changes. (Rejected: per-entrance region copies —
   duplicates location identity; entrance-conditional rules — not expressible
   in AP's stateless rules; primary-entrance-only — over-constrains procgen
   composition.) Analyzers compute the split mechanically: partition the
   region's tiles into zero-item-reachable components, label the edges between
   components with the items/abilities that cross them. One-way drops become
   one-directional internal exits.

2. **Storage = a per-game "region atlas" document + three compiled
   projections** (the jta-dataset pattern, not the region library, not
   extended rules.json). One authored document per game, edited by the
   marking tool, stored beside the game's wrapper (as `jtaSubstrateWrapper/
   datasets/` does). Follows the established conventions: `schema_version`,
   content-hash identity (`atlas_id` ends in the hash; edits restamp, which
   invalidates downstream pipeline steps), a validator module, and a JSON
   schema in `frontend/schema/`. Consumers never read each other's
   projections; the atlas is the single source of truth.
   - *Rejected: region library as master* — one-entry-one-region is baked
     into its validator, fit rule, and adapters; no per-game concept; the
     whole-game vanilla layout isn't a library concern. The library stays
     what it is (synthetic interchangeable content).
   - *Rejected: extended rules.json as master* — rules.json is compiled
     per-seed output; hand-added blocks get dropped on regeneration (the
     `flash_panel` block demonstrates this today).

3. **Exit categories:** boundary exits are straight horizontal/vertical
   lines whose direction gives the side label (N/E/S/W); anything that
   doesn't fit a side (stairs, doors, warps) is a first-class **teleporter**
   exit, whose destination need not be a grid neighbor. (Precedent: top-down
   mode already synthesizes teleporters for non-embeddable edges; new work is
   authoring them and teaching the composite map / Move Exits editor a fifth
   "direction".) Multi-tile exit spans with a single entrance spawn tile are
   explicit in the format — exits are logical edges, the entrance is a spawn
   point.

4. **Vanilla layout lives in the atlas** (`vanilla_layout`: start region +
   boundary connections). It is map truth, and the rules.json projection
   needs it.

5. **Sphere-sorter consumes the atlas directly** via the same install seam
   jta datasets use (`substrateConfig['<game>'].atlasDoc`), with the adapter
   exposing a region pool and a per-region extract (exit sides, intrinsic
   frontier rules, locations). It borrows the library path's exit-side fit
   rule but not its carriage — the library's one-entry-one-region invariant
   stays untouched.

6. **Play-time binding rides `playable_payload`**, exactly as `{jtaZone:
   idx}` does today: the engine stamps `{atlas_region, atlas_ref}` plus the
   boundary/spawn tiles into each region's payload; the wrapper configures
   its transition triggers from that. Engine-binding *mechanics* (teleport
   recipes, injected-AS class paths, `ap_items`/`ap_locations` maps) stay in
   the flashPanel-style per-game config (`games/<id>.json`) — the atlas holds
   map semantics only.

7. **Distribution:** the RWK atlas contains coordinates and annotations
   ONLY — it references the tile map, never embeds it. The extracted tile
   grid (`*_tilemap.json`), category config (`*_tiles.json`), and SWFs are
   already gitignored; keep it that way. Seedling is redistributable and has
   no such constraint.

8. **Geometry accommodation in sphere growth: accept grid gaps first.**
   Logic correctness rides entirely on exit connections; adjacency is
   aesthetics. An any-shape filler substrate is a later option if gaps grate.

9. **Pre-built regions are added beside the gated-braid skeleton** (synthetic
   gates in front) as the safe default. Whether a pre-built region may
   *serve as* a gate rung (its intrinsic entry rule becoming the sphere gate)
   is an open ruling — touches the braid rigidity contract; decide when the
   sorter is designed.

10. **Bot strategy = staged collision** (Seedling first): no collision →
    walls → item-gated terrain → puzzles (hand-written solutions) → enemies.
    Each stage is a witness gate proving intended-solution beatability.
    Apply the omsi bot lessons: gate progress on held state, not ambient
    flags; size bot work against the ~12s host round trip; expect real-time
    legs to be load-dependent in CI.

## Open questions (settle during implementation)

- ~~AP naming convention for sub-regions in the rules.json projection~~
  **RULED 2026-07-27: `<region_id>__<sub_region>` compound.** `__` is already
  the fork-wide separator for region-scoped names (jta's
  `${region_id}__${task_id}` AP locations, procgenPipelineEngine's
  `${regionName}__${locId}`); it keeps sub-region ids unique across regions
  with no global registry, and splitting on the first `__` recovers the pair.
  A region with no subgraph keeps its bare `region_id`. Encoded as
  `apRegionName()` in `regionAtlasValidator.js`, which forbids `__` inside
  `region_id` and sub-region ids so the split stays unambiguous.
- Gate-rung ruling for pre-built regions (decision 9).
- How the marking tool and the existing RWK tile map editor share code
  (the marking tool is game-agnostic; the RWK editor is one host for it).

## Atlas schema sketch

```json
{
  "schema_version": 1,
  "atlas_id": "seedling-vanilla-<hash>",
  "game": "seedling",
  "provenance": { "generator": "region-marking-tool", "content_hash": "..." },
  "tile_space": { "tile_size": 16, "map_source": "runtime-extract" },
  "regions": [{
    "region_id": "sunken_hall",
    "name": "Sunken Hall",
    "bounds": { "x": 0, "y": 32, "w": 40, "h": 24 },
    "exits": [
      { "exit_id": "E", "kind": "edge", "side": "E",
        "exit_tiles": [[39,40],[39,41],[39,42]], "entrance_tile": [39,41],
        "sub_region": "hall_east" },
      { "exit_id": "stairs_down", "kind": "teleporter",
        "exit_tiles": [[12,55]], "entrance_tile": [12,55],
        "sub_region": "hall_west" }
    ],
    "subgraph": {
      "sub_regions": ["hall_west", "hall_east"],
      "internal_exits": [{ "from": "hall_west", "to": "hall_east",
        "bidirectional": true,
        "access_rule": { "rule": "Has", "args": { "item_name": "Acid Boots" } } }]
    },
    "locations": [{ "name": "Sunken Hall - Chest", "sub_region": "hall_east",
      "tile": [30,40], "vanilla_item": "Silver Key" }],
    "annotations": { "rules_source": "manual" }
  }],
  "vanilla_layout": {
    "start_region": "...",
    "connections": [{ "from": ["sunken_hall","E"], "to": ["crystal_cave","W"] }]
  }
}
```

Access rules are ordinary Rule Builder trees. `annotations.rules_source`
distinguishes analyzer-computed from hand-annotated (Seedling's puzzles
force manual annotation; that is expected, not a gap).

## The three projections

1. **Atlas → vanilla rules.json** (feeds top-down mode). Sub-regions become
   AP regions; internal exits + `vanilla_layout.connections` become AP
   exits; locations carry vanilla items. Extends the tile map analyzer's
   existing `rulesExporter.js` / `shared/rulesJsonBuilder.js` path. Pair it
   with a `Generate.py`-produced sphere log when the 6-step sphere editors
   are wanted (top-down-sphere upgrade).
2. **Atlas → sphere-sorter input** (pre-built regions in generated worlds).
   Carried via `substrateConfig['<game>'].atlasDoc`; a new pre-pass sorts
   pre-built regions into spheres from their intrinsic rules, then normal
   growth fills around them, placing connector regions so each fixed exit
   side can be met (gaps allowed).
3. **Atlas → play-time payload.** Per-region `{atlas_region, atlas_ref,
   boundaries, spawn tiles}` in `playable_payload`; wrapper wires transition
   triggers (Seedling: wasm bridge; RWK: injected AS position polling +
   existing teleport hook) and boundary visuals.

## Phases

Ordering follows the agreed sequencing: data model → marking tool → Seedling
end-to-end → sorter → RWK → bots. Each phase lands separately.

### Phase 1 — Atlas format — **COMPLETE 2026-07-27**
- [x] Atlas JSON schema (`frontend/schema/region-atlas.schema.json`) +
      validator module (structural checks, content-hash stamp/restamp,
      sub-region referential integrity: every exit/location `sub_region`
      exists; every sub_region reachable in the subgraph)
- [x] Rule: decide sub-region AP naming convention (open question 1)
- [x] Hand-write a tiny 2–3-region Seedling atlas fixture as the test anchor

**As built:**
- Validator: `frontend/modules/procgenPipeline/regionAtlasValidator.js` —
  beside `regionLibraryValidator.js` (its identity/split precedent) and the
  Phase-6 sphere-growth consumer. procgenPipeline is already a bundled module,
  so no `__BUNDLED_MODULES__` registration was needed.
- CLI: `scripts/procgen/region-atlas-validate.mjs [--restamp]`, mirroring
  `region-library-validate.mjs`.
- Fixture: `frontend/modules/flashPanel/atlases/seedling-fixture.json`
  (+ `atlases/README.md`) — beside the game's wrapper config in
  `flashPanel/games/`, the `jtaSubstrateWrapper/datasets/` precedent. Three
  regions with Seedling's real region/item names but invented geometry; it is
  the format anchor, not the real map (which arrives with the Phase-2 tool).
- Tests: `regionAtlasValidator.test.js`, 52 vitest cases reading the committed
  fixture off disk.

**Deltas from the schema sketch** (all additive; the sketch stays accurate):
- `vanilla_layout.start_sub_region` — required when the start region has a
  subgraph, forbidden when it doesn't. Without it the rules.json projection
  cannot tell which sub-region `Menu` connects to.
- `access_rule` is also allowed on **boundary exits** (the intrinsic frontier
  gates decision 5 hands the sorter) and on **locations** (a condition beyond
  reaching the sub-region).
- `internal_exits[].bidirectional` is **required**, never defaulted — a
  silently-defaulted direction is exactly the bug the subgraph split exists to
  avoid.
- Optional top-level `name` / `description`; `annotations.rules_source` gains
  a third value `mixed` (analyzer-computed split + hand-annotated gate in one
  region) and an optional `notes` string.
- **Single-sub-region regions carry no boilerplate:** a region with no
  traversal obstacles omits `subgraph` entirely and its exits/locations MUST
  omit `sub_region`; once a subgraph exists, every exit/location MUST name
  one. A one-entry subgraph validates but warns.
- Enforcement beyond the kickoff list: edge-exit geometry (a straight,
  contiguous run on the bounds line the `side` names — y grows downward, so N
  is minimum-y), `entrance_tile ∈ exit_tiles`, all tiles inside `bounds`,
  globally-unique location names, Rule Builder tree shape (recursing through
  `children`, rule-shaped named args like `Compare.left/right`, and positional
  `args` arrays), `vanilla_layout` endpoint resolution with each exit wired at
  most once. Warnings (not errors) for: unwired exits, non-opposite edge
  pairings, one-way dead-end sub-regions, missing `vanilla_item`, missing
  annotations, unstamped provenance.

### Phase 2 — Region-marking tool (minimal)
- [ ] Load a game's tile map for display (Seedling first; reuse tile map
      analyzer rendering where possible)
- [ ] Mark boundary lines (H/V → side label), teleporter exits, entrance
      spawn tiles; name/number regions
- [ ] Mark locations + vanilla items
- [ ] Edit subgraph: declare sub-regions, assign exits/locations, author
      internal-exit rules (annotation-first)
- [ ] Save/load atlas documents (restamp on edit)
- [ ] Handoff seam to APWorld Editor (`apworldEditor:loadRules` with the
      projected rules.json) for detail-filling

### Phase 3 — Projection 1 + top-down milestone (Seedling)
- [ ] Atlas → vanilla rules.json compiler
- [ ] **Milestone:** load the projected Seedling vanilla rules.json in
      top-down mode; walk between real Seedling sections via boundary
      transitions in-app

### Phase 4 — Seedling play-time transitions
- [ ] Projection 3: engine stamps atlas binding into `playable_payload`
- [ ] Wrapper-side triggers over the wasm-iframe transport (position →
      boundary crossing → region exit; arrival → entrance spawn teleport)
- [ ] Boundary visual indication (whatever the transport makes cheap)
- [ ] Substrate tests (remember: test-substrates config ENUMERATES ids;
      new tests must be added there, and to a batch category)

### Phase 5 — Seedling analyzer
- [ ] Per-region reachability where mechanically computable; manual
      annotation workflow for puzzle-gated edges (`rules_source` marks which)

### Phase 6 — Sphere growth: pre-built regions
- [ ] Adapter + `atlasDoc` seam (pool, per-region extract)
- [ ] Sorting pre-pass: assign pre-built regions to spheres from intrinsic
      rules; settle the gate-rung ruling (open question 2)
- [ ] Placement with fixed exit sides; connector regions; gaps allowed
- [ ] Oracle/verification parity with existing sphere-growth gates

### Phase 7 — RWK
- [ ] Tile map editor feature: select region-transition tiles (H/V lines)
- [ ] Analyzer update: evaluate one region at a time; per-region access
      rules for locations and exits (sub-region split computed from
      reachability); RWK atlas emitted (coordinates only)
- [ ] Injected ActionScript: position detection → transition trigger;
      boundary visuals; reuse existing teleport injection
- [ ] Same top-down milestone as Phase 3, for RWK

### Phase 8 — Playback bots (staged)
- [ ] Seedling v1: collision fully disabled, move to targets
- [ ] v2: wall collision + pathing
- [ ] v3: item-gated terrain awareness
- [ ] v4: puzzle elements with hand-written solutions
- [ ] v5 (ambitious): enemy collision + avoid/defeat
- [ ] RWK bot (later): jump physics planning; start with enemy collision off

### Deferred / adjacent (not this plan)
- Tilemap Platformer substrate (JS clone of RWK reusing runner code; tile
  map read from the user's SWF at runtime, never distributed)
- Any-shape filler substrate for gap-free packing
- Shipped panel presets that bundle a rules.json + sphere-log reference
  ("load vanilla <game>, ready to edit" one-click), per the 2026-07-26
  top-down/preset discussion
