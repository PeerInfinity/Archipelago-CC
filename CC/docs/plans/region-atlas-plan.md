# Region Atlas: Real-Game Maps as Procgen Regions

**Date:** 2026-07-26 (Phases 1–4 shipped 2026-07-27, Phases 5a–6 and Phase 8
slice 1 — the maze-surface bot — 2026-07-28)
**Status:** Design ruled; Phase 1 (atlas format), Phase 2 (marking tool),
Phase 3 (vanilla rules.json projection), Phase 4 (play-time transitions — the
real game walks between atlas regions), Phase 5a (the reachability analyzer —
sub-region splits and their rules are computed from the tile map), Phase 5b
(the maze projection — the same geometry and gating, playable with no engine
artifact, so the in-app suite can test it) and Phase 6 (sphere growth — a grown
world contains real map regions, gated on what the real game charges to enter
them) complete, and **Phase 8 slice 1 (the MAZE-SURFACE playback bot: a
headless tile-walking witness plus the shipped bot completing the grown world
in-app) complete 2026-07-28** — **Phase 7 (RWK) POSTPONED INDEFINITELY (user
ruling 2026-07-28); the arc continues Seedling-only.** Phase 8's real-game
surface is **v1 + v2 COMPLETE (2026-07-30)** — the recompiled game replays
tapes and the JS transcription reproduces it exactly through collision, room
transitions and A\*-planned cross-level routes; per-stage JS-first (user
amendment 2026-07-30). **NEXT: v3 (item-gated terrain), which is gated on
the entity CLASS TABLE — 3 of 116 levels build today.**
**Games:** Seedling only for now (redistributable, discrete sections, source
available); Robot Wants Kitty postponed indefinitely (2026-07-28)

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
   sorter is designed. **RESOLVED in Phase 6 (2026-07-28): it may**, because the
   sorter first schedules the rule's items into an earlier sphere, which makes
   the intrinsic rule a legitimate sphere-k gate. This decision's
   beside-the-skeleton placement survives as the FALLBACK route
   (`--atlas-placement quota`), not the default.

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
- ~~Gate-rung ruling for pre-built regions (decision 9)~~ **RULED + RESOLVED
  2026-07-28 (Phase 6): sorter-first with a built-in fallback.** A pre-built
  region's intrinsic entry rule IS its sphere gate; the sorter makes that
  legitimate by scheduling every required item into a strictly earlier sphere,
  so the stratification invariant holds by construction and the sphere-log
  oracle stays exact. The attempt succeeded, so the fallback (synthetic gates in
  front, intrinsic rules AND-composed) is kept as an option rather than the
  default. Full ruling text and as-built in Phase 6 below.
- ~~How the marking tool and the existing RWK tile map editor share code~~
  **RULED 2026-07-27: separate modules, shared canvas.** The marking tool is
  its own GL panel (`regionMarkingTool`); `markingRenderer.js` subclasses the
  analyzer's `TileMapCanvasRenderer` rather than either module absorbing the
  other. The analyzer's own reachability/physics data model stays RWK-specific.

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
        "bidirectional": true, "source": "analyzer",
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

Access rules are ordinary Rule Builder trees. `internal_exits[].source` records
who wrote each row — absent means `manual`, so every pre-analyzer atlas reads
correctly — and `annotations.rules_source` is DERIVED from the mix once any row
is analyzer-written (Phase 5a, ruling 2). Seedling's puzzles still force some
hand annotation; that is expected, not a gap, and those rows are what the
analyzer's needs-authoring list names.

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

### Phase 2 — Region-marking tool (minimal) — **COMPLETE 2026-07-27**
- [x] Load a game's tile map for display (Seedling first; reuse tile map
      analyzer rendering where possible)
- [x] Mark boundary lines (H/V → side label), teleporter exits, entrance
      spawn tiles; name/number regions
- [x] Mark locations + vanilla items
- [x] Edit subgraph: declare sub-regions, assign exits/locations, author
      internal-exit rules (annotation-first)
- [x] Save/load atlas documents (restamp on edit)
- [x] Seedling map extractor + a real starter atlas (added this phase)
- [ ] ~~Handoff seam to APWorld Editor~~ **DEFERRED to Phase 3** (ruling 5):
      it hands over the *projected rules.json*, which is Phase 3's compiler —
      there is nothing to hand over until that exists.

**Rulings (user, 2026-07-27):**
1. Seedling map display comes from a **source extractor** over the Ogmo `.oel`
   level files in a Seedling source checkout — not a runtime capture.
2. The marking tool is a **new GL panel module** (`regionMarkingTool`), NOT a
   mode inside tileMapAnalyzer. The analyzer is an RWK-specific
   reachability/physics tool with its own tilemap+categories data model; what
   the two genuinely share is the canvas, and that is shared as code.
3. The extracted Seedling map data is **committed** — Seedling is MIT, so
   decision 7's "coordinates only, never the tile map" constraint is RWK-only.
4. Phase-2 acceptance includes a **real starter atlas** (2–3 regions around the
   game start) authored with the tool and committed.
5. The APWorld Editor handoff is deferred to Phase 3 (above).

**As built:**
- Extractor: `scripts/procgen/extract-seedling-map.mjs` +
  `scripts/procgen/seedlingOgmo.js` (pure `.oel` / `Game.as` parsers) →
  `frontend/modules/flashPanel/atlases/seedling-map.json`: **116** levels
  (not 120 — four `.oel` files are unreferenced by the level table and are
  recorded by name only), 28803 tile placements, 2461 entities, no timestamp so
  `--check` is an exact regenerates-byte-identically gate.
- Panel: `frontend/modules/regionMarkingTool/` — `atlasSession.js` (the editing
  model, no DOM), `mapSource.js`, `markingRenderer.js` (subclasses the
  analyzer's `TileMapCanvasRenderer`, adding rect/line drags + the region
  overlay it lacks), `regionMarkingToolUI.js`, CSS. Registered in all four
  places; default off, enabled in `modules-flash.json`.
- Starter atlas: `frontend/modules/flashPanel/atlases/seedling.json`, built by
  `scripts/procgen/make-seedling-starter-atlas.mjs`.
- Verifier: `scripts/procgen/verify-region-marking-tool.mjs` drives the real
  panel in chromium under `?mode=flash` with actual mouse drags.
- Tests: 3380 → **3471** vitest (35 atlasSession, 25 extractor, 15 compact
  writer, +16 validator/starter-atlas). `vitest.config.js` `include` gains
  `scripts/**/*.test.js`.

**Deltas from Phase 1** (all additive; the Phase-1 fixture validates unchanged):
- **`map_ref` + `tile_space.map_document`** — Phase 1 assumed one coordinate
  space per game. True of RWK, false of Seedling: 116 levels, each with its own
  origin. A region may name its space with `map_ref`; `map_document` names the
  document those ids index. Every geometry check already stayed inside one
  region and never compared two, so nothing else moved. Given the map document
  (the CLI loads it from beside the atlas), `map_ref` must resolve and the
  region's bounds must fit inside that level. Partial adoption warns.
- **Compact atlas writer** (`procgenPipeline/compactJson.js`) used by both the
  tool's save path and the CLI's `--restamp`, which used to explode every tile
  pair to one number per line. The `atlases/README.md` "never use `--restamp`,
  paste the hash in by hand" workaround is gone.
- **Authoring-time enforcement.** The rules a UI can enforce before the
  validator sees a document now throw in `AtlasSession`: no `__` in ids, an
  edge exit's `side` DERIVED from which bounds line its tiles sit on,
  `entrance_tile ∈ exit_tiles`, `sub_region` present exactly when the region has
  a subgraph (adding/dropping one rewrites exits and locations to match),
  `bidirectional` never defaulted.
- **A door on a room's outer wall is a teleporter, not an edge exit.** Geometry
  alone would call Seedling's house door "side S"; its destination is a spot in
  the middle of the overworld, not a grid neighbour. `kind` is therefore
  overridable when the author knows better — decision 3's teleporter case.
- **Entrance tile vs. spawn pixel.** The atlas's `entrance_tile` is the boundary
  trigger tile; the game's actual arrival pixel is one tile inside it. That
  conversion is engine binding and belongs in `games/seedling.json`
  (decision 6), not in the atlas.
- **Overpaint is dropped, not carried.** 506 tile placements across 51 levels
  sit outside their own level rectangle; the game's `loadlevel` discards them
  too, so the extract does, recording the per-level count so the drop is never
  silent.

### Phase 3 — Projection 1 + APWorld Editor handoff (Seedling) — **COMPLETE 2026-07-27**
- [x] Atlas → vanilla rules.json compiler
- [x] **Milestone:** the projected preset loads in the frontend with the full
      region graph, and the APWorld Editor handoff works
- [x] Handoff seam to APWorld Editor (`apworldEditor:loadRules` with the
      projected rules.json) for detail-filling — deferred here from Phase 2
      (ruling 5): it needs the projected rules.json this phase produces
- [ ] ~~walk between real Seedling sections in-app~~ **MOVED to Phase 4**
      (ruling 1): walking runs the REAL game with a teleport to the entrance
      spawn tile, which is projection 3

**Rulings (user, 2026-07-27):**
1. **Phase 3 is graph-only: the compiler emits NO `preset_sidecars`.**
   Play-time walking runs the real Seedling game with the teleport recipe
   placing the player at the entrance spawn tile — that is projection 3, and
   the "walk between sections in-app" milestone therefore belongs to Phase 4.
   Phase 3's milestone is the projected preset loading in the frontend with the
   full region graph, plus a working APWorld Editor handoff.
2. The Phase-2-deferred **APWorld Editor handoff lands here** (Phase-2 ruling 5).

**As built:**
- Compiler: `frontend/modules/procgenPipeline/regionAtlasCompiler.js`
  (`compileRegionAtlas(atlas, options) -> { rules, report }`), beside the
  validator — built on `shared/rulesJsonBuilder.js`, the same helpers
  `tileMapAnalyzer/rulesExporter.js` uses; `shared/` was consumed read-only.
- CLI: `scripts/procgen/region-atlas-compile.mjs` — atlas in, rules.json out,
  with `--check` (byte-identical regeneration gate), `--game-name`, `--seed`,
  `--allow-invalid`. The output carries no timestamp, so `--check` is exact.
- Preset: `frontend/presets/seedling_atlas/AP_1/AP_1_rules.json`, registered by
  `scripts/utils/register-preset.py --game-id seedling_atlas` and mirrored by
  hand into `preset_files.live.json` (the script does not touch the live index).
  No `has_procgen_data` — that flag means "has sidecars", which this preset
  deliberately does not.
- Panel: two toolbar buttons after Save in `regionMarkingToolUI.js` — **Export
  rules.json** (download the projection; the status line NAMES the omitted
  unwired exits) and **Edit in APWorld Editor** (`apworldEditor:loadRules` then
  `ui:activatePanel`, copying procgenPipelineUI §2.2 — deliberately not
  `files:jsonLoaded`, which wakes the substrate panels and steals focus).
  `regionMarkingTool/index.js` registers the new publisher; the bus rejects
  unregistered ones.
- Verifiers: `scripts/procgen/verify-seedling-atlas-preset.mjs` (boots
  `?game=seedling_atlas&seed=1` and compares the state manager's regions/exits/
  locations against a headless compile) and two new phases in
  `verify-region-marking-tool.mjs` (E: the downloaded rules.json is
  byte-identical to the headless compile; F: the hand-off lands in the editor's
  own model).
- Tests: **3503** vitest (3471 Phase-2 baseline + 32 compiler cases over BOTH
  atlases). `runnerDemo/ruleSchemaCheck.js` grew `patternProperties` / `enum` /
  `anyOf` / `allOf` / list-valued `type` so a WHOLE rules.json validates against
  `frontend/schema/rules.schema.json`, not just its rule subtrees; Python's
  `jsonschema` covers the committed preset through
  `test/general/test_schema_validation.py` (it globs every preset).

**Projection decisions worth knowing:**
- **A connection direction carries its SOURCE exit's `access_rule`** — the exit
  you leave through is the frontier you have to get past. A gate authored on the
  far side therefore does not apply to arrivals; when Phase 5's analyzer starts
  computing these mechanically, revisit whether a crossing wants both.
- **Unwired boundary exits are omitted and NAMED** — in the compile report, in
  the CLI output, and in the panel's status line. The starter atlas has 6; that
  list is the growth queue, not a defect, and a silent drop would read as a
  complete map.
- **v1 classifies every `vanilla_item` as progression.** Real classifications
  need per-game knowledge the atlas deliberately does not hold (decision 6).
- **AP ids** are a stable base (30000000) plus the index of the name in sorted
  order. That base is clear of the flashPanel per-game `ap_id_offset`
  (`games/seedling.json`: 20000000); *aligning* the two is Phase 4's binding
  concern.
- `Menu` is reserved: an atlas region that would project onto it is a hard
  error, not a silent merge.
- The rules.json carries a `region_atlas: { atlas_id, game, map_document }`
  block, so a restamped atlas visibly invalidates a stale preset.
- No `Generate.py` roundtrip was attempted (not a Phase-3 gate): the scaffold's
  `completion_condition` stays `{constant: true}` — the atlas has no goal
  concept yet.

### Phase 4 — Seedling play-time transitions — **COMPLETE 2026-07-27**
- [x] Projection 3: the compiler stamps atlas binding into `playable_payload`
- [x] Host-side triggers over the wasm-iframe transport (level change →
      boundary crossing → region exit; arrival → entrance spawn teleport)
- [x] **Milestone (moved here from Phase 3, ruling 1):** walk between real
      Seedling sections via boundary transitions in-app
- [ ] ~~Boundary visual indication~~ **SATISFIED BY NATURE for v1** (ruling 3):
      the game's own teleporters and level edges ARE the visible affordance —
      the player already sees a door. Recorded as deferred: it becomes real work
      only when a *generated* world puts a boundary somewhere the vanilla game
      draws nothing.
- [ ] ~~Substrate tests in the test-substrates config~~ **DELIBERATE
      DEVIATION** — see "Testing deviation" below.

**Rulings (user, 2026-07-27):**
1. **Level-granular v1.** A physical atlas region binds to a whole Seedling
   level; boundary crossings are detected by the game's own level change
   (`Main.level`), disambiguated by spawn coordinates when two connections join
   the same level pair. Sub-level physical boundaries (live player x/y against a
   marked tile line) are DEFERRED — no BridgeGeneric changes, no re-injection,
   no wasm rebuild in this phase. Logical sub-regions are unaffected: they carry
   rules and are never physically triggered, so every sub-region of a region
   shares its level.
2. **One sync implementation.** The `flash_seedling` substrate entry DELEGATES
   to flashPanel's shipped `WasmBridgeAdapter` (teleports, item writes,
   progressives/fusions, location checks — all Stage-1-verified). No second
   AP↔game translation in flashSubstrate's `bridge.js`, and no use of the
   substrate-bridge dialect (`__swfBridge.configure(obj)` / `pollItems`): the
   wasm shim speaks `game.configure(json)` + `queueItems`, which the adapter
   already handles.
3. **Boundary visuals: satisfied by nature for v1** (above).

**As built:**
- **Position signals** — `games/seedling.json` `state_properties` gains
  `playerPositionX`, `playerPositionY`, `level`, three `Main` statics written at
  every `Game` construction. They are therefore SPAWN coordinates, not live
  position, which is precisely why ruling 1 works. Declared positions-first so a
  `new Game(level,x,y)` reports its tie-break coordinates before the level
  change that triggers the crossing. ⚠ `BridgeGeneric.doConfigure` refuses a
  second configure for the life of a game instance, so these ride the ONE
  configure at boot — widening the set later needs a page reload.
- **Compiler** — `regionAtlasCompiler` emits `preset_sidecars['1']` for every
  region naming a level, plus the top-level `flash_panel` block (so a
  regeneration no longer drops the wiring — the trap decision 2 names). The
  payload carries `gameId` / `atlas_ref` / `atlas_region` / `level` /
  `tile_size` and one entry per WIRED exit with `exit_id`, `kind`, `side`,
  `exit_tiles`, `entrance_tile`, `entrance_spawn`, `exitName`, `targetRegion`,
  `targetExitId`, `target_level`, `target_spawn` — everything both halves of a
  crossing need, resolved compiler-side from the whole atlas.
- **Substrate** — `frontend/modules/flashPanel/flashSeedlingLibrary.js`
  registers `flash_seedling` off `createFlashSubstrateEntry`, overriding the
  panel to `flashPanel` and the load event to `flashSeedling:loadRegion`, and
  dropping the inherited `iframeId` (flashPanel's embed is a plain iframe that
  never announces `appReady`). Glue: `seedlingRegionBinding.js` (pure state
  machine) + `seedlingRegionGlue.js` (effects → adapter + dispatcher).
  `FlashBridgeAdapter.onStateReport` is the new seam, fired at the TOP of
  `_onStateChanged` — above the echo/first-read suppressions, which exist for AP
  *location* detection and would swallow the reports this consumer needs.
- **flashPanel is enabled in `modules.json`** (the default/procgen mode). It
  stays idle unless the loaded rules carry `flash_panel` wiring, and the
  `e2623bead` re-init-on-rules-change fix already covers preset switches; the
  "Flash Game" panel was already in the default layout.

**Decisions worth knowing:**
- **Both traps are real and are handled explicitly.** (a) *Teleport echo:* the
  glue's own arrival teleport changes `level`, and that report is
  indistinguishable from a player crossing — an arrival is marked in flight, the
  matching report swallowed, cleared on match or after 15 s. A teleport to the
  level the game is already on arms nothing, because arming would eat the next
  real crossing. (b) *First-read baseline:* BridgeGeneric reports the whole
  declared set at boot, so the first `level` report is where the game already
  is; it doubles as the "game is alive" signal that releases an arrival queued
  while the wasm page was still waiting on its ▶ Start gesture (minutes,
  legitimately).
- **Unmapped-level policy:** a level change the current region has no marked
  exit to WARNS LOUDLY (console + panel log, naming the levels and pointing at
  the Region Marking Tool) and does NOT move the AP region. The atlas covers 3
  of 116 levels by design; a silent no-op would read as a complete map and a
  crash would make a partial atlas unusable.
- **Initial arrival spawn:** with no `arrivedFrom` (the synthesized
  `Menu → start-region` hop) the region's FIRST declared exit's entrance spawn
  is used. `region_coords` in `games/seedling.json` was the alternative and was
  rejected: it is keyed by display names no atlas `region_id` matches, and it is
  engine binding for the manual teleport UI, not map truth. The same fallback
  covers a move whose source region is outside the warehouse; both are logged as
  info, not warnings — there is no marked entrance to honour, and neither is a
  defect.
- **A region with no `map_ref` stays graph-only** and is NAMED in the compile
  report, the same discipline unwired exits get.
- **A region with a subgraph emits one sidecar per sub-region**, exits
  partitioned by their `sub_region` binding, all sharing the parent's level
  (ruling 1).
- **`has_procgen_data` is now true** for `seedling_atlas` in both preset
  indexes (the live one mirrored by hand again — `register-preset.py` does not
  touch it).
- **No `SubstrateInactiveOverlay`** in v1, and deliberately not half-wired: the
  flashPanel panel is not procgen-only (it still serves the Stage-1 direct-client
  presets), so a `procgen:activeSubstrateChanged`-null predicate would blank a
  panel that is legitimately in use. Recorded here rather than stubbed.

**Testing deviation (deliberate):** the plan's "substrate tests in
test-substrates" bullet is NOT satisfied, because the leg that matters needs the
gitignored 31 MB wasm artifact, which is machine-local — an enumerated in-app
test would be red everywhere it is missing. The e2e gate for this phase is
`scripts/procgen/verify-seedling-atlas-play.mjs`, which SKIPs (exit 0) when the
artifact is absent. It asserts effects, not silence: the arrival teleport
reaching the game as a `new Game(...)` and confirmed by an independent
`readState`; a NATIVE crossing (a `new Game(...)` queued straight into the
iframe, the glue's suppression path uninvolved) publishing `user:regionMove`
AND moving gameState; a second crossing so the count is not a one-off; and only
then the negative — a host-driven region move whose cross-level arrival teleport
must not become a second crossing. The watcher wraps the dispatcher's real
`publish` and throws if it cannot, so the negative cannot pass vacuously. If an
in-app leg is ever added, remember the test-substrates config ENUMERATES ids and
it needs a batch category.

**Test counts:** 3503 → **3548** vitest (10 compiler cases for projection 3, 22
for the binding state machine, 7 for the glue wiring, 6 for the registry entry).

### Phase 5a — Seedling analyzer — **COMPLETE 2026-07-28**
- [x] Per-region reachability where mechanically computable; manual
      annotation workflow for puzzle-gated edges (`rules_source` marks which)
- [ ] ~~Maze-mode substrate projection~~ **DEFERRED to Phase 5b** (ruling 4):
      a separate kickoff after this lands. The semantics tables shipped here are
      its input, which is why they are a clean data module with no atlas or AP
      concepts in them.

**Rulings (user, 2026-07-28):**
1. **Direct gate-vocabulary analysis, NOT a leave-one-out ability diff.**
   Diffing cannot express disjunctions: Seedling's magical lock opens with the
   Wand OR the Fire Wand, and removing either one alone leaves the other route
   open, so the diff would call the crossing free. Every Seedling blocker names
   its own condition, so the analyzer floods transparently, partitions into
   zero-item components, and labels each crossing with the blocking cells'
   declared conditions — decision 1's algorithm, directly. (Real output on the
   committed map confirms the ruling: `(Wand OR (Fire Wand Fusion AND Wand AND
   Fire))` for a magical lock, `(Progressive Sword OR Ghost Spear)` for a
   breakable rock.)
2. **Per-exit provenance, additive:** `internal_exits[]` gains
   `source: 'analyzer' | 'manual'`; ABSENT means `'manual'`. Re-analysis
   replaces only its own rows; hand-authored rows and their sub-region
   assignments survive byte-exact. `annotations.rules_source` becomes DERIVED
   (all-analyzer → `analyzer`, any hand-authored row → `mixed`), and the
   analyzer keeps it consistent.
3. **Surface = pure module + marking-tool action + CLI.** Propose→review→accept
   in the tool is the authoring workflow; the CLI is the batch/regeneration gate.
4. The maze-mode substrate projection is **Phase 5b**, above.

**As built:**
- **Semantics tables:** `frontend/modules/flashPanel/seedlingSemantics.js` —
  tileset column → tile type (all 45 cases of `Game.as:1909-2004`), tile type →
  cell kind (`Tile.as:23-26` + the specials), entity tag → {solidity, condition}
  for all 130 placed tags, and `buildFlagItemRules()` deriving engine flag → AP
  item from `games/seedling.json` (progressive counts, fusion conjunctions).
  Conditions in the tables are ENGINE FLAGS, never AP names — an item-shuffle
  change lands in the config without touching the transcription.
- **Analyzer:** `procgenPipeline/regionAtlasAnalyzer.js`, game-agnostic: it
  takes a cell grid plus `conditionKey` / `resolveCondition` and knows nothing
  about Seedling. `flashPanel/seedlingAtlasAnalysis.js` is the one place the two
  are wired together, so the analyzer stays reusable for RWK in Phase 7.
- **Surfaces:** an **Analyze region** toolbar action (propose → coloured overlay
  + review list → Accept/Discard), `AtlasSession.setInternalExitRule()` for
  taking a row over by hand, and
  `scripts/procgen/region-atlas-analyze.mjs` (whole-atlas, `--check`,
  `--region`, `--dry-run`, `--quiet`, condition census + needs-authoring list).
- **Tests:** 3548 → **3635** vitest. Two strata: hand-built ASCII grids in a
  made-up one-item game (which also prove the core is game-agnostic) and the
  real 116-level extract, where every cell must classify and every emitted rule
  must name an item the game config knows. `verify-region-marking-tool.mjs`
  gains Phase G (analyze the real Dungeon1_1 in the browser; assert the document
  is UNTOUCHED while the proposal exists; Accept; prove the result
  byte-identical to a headless analyze+apply).

**Findings that changed the kickoff's sketch, all from source:**
- **Solidity comes from `Mobile.as:17`** — `solids = ["Solid","Tree","Rock",
  "Rope","ShieldBoss"]` is the game's own oracle. Enemies are type `"Enemy"` and
  therefore do **not** block traversal at all, which is why enemy handling is a
  playback-bot concern (decision 10, stage 5) and never a region-split one.
- **A plain breakable rock and a rope fall to `Sword OR Spear`.** The spear
  thrust (`Player.as:960`) routes through the same `genericHit` as the slash, so
  either weapon breaks them. Conversely the **bridge stays Spear-only**: the
  Ghost Sword's slash types as `"Spear"` too, but holding the Ghost Sword
  already implies holding the Ghost Spear (the `ghostsword` fusion requires the
  `spear` item), so that path adds nothing.
- **A FACE gate and a DIRECTION gate are different physics, and both are
  needed.** The cave mouth's north face is walled in BOTH directions
  (`Tile.check` case 13 spawns a 1px Solid along the top edge), so walking north
  INTO a cave from below is free — the kickoff's "one-way top ledge" reading
  would have blocked it. The waterfall is the direction case: down is free, the
  climb needs the Feather.
- **Buildings are `manual`, not walls.** They collide through a Pixelmask
  (`Building.as:22`) this transcription does not have, and NEITHER rectangle
  approximation is safe: the sprite rect swallows the building's own doorway
  (the overworld house puts its teleporter at the centre of a 3×3 rect, which
  made two exits unplaceable and invented two phantom sub-regions), while
  shrinking it would merge rooms a wall really separates. As crossing material a
  house in open ground costs nothing, and a building that IS the only way
  between two areas becomes a hand-authoring row instead of an invented wall.

**Decisions worth knowing:**
- **Components are 4-connected floods over freely-walkable cells only.**
  Everything else is crossing MATERIAL and never joins a component. Components
  joined by a crossing that is free in BOTH directions are then fused —
  "zero-item component" means mutually free-reachable, and the two sides of a
  cave mouth are one place, not two with a free exit between them.
- **Every Pareto-minimal condition set is a way across, and the ways OR
  together.** A route that costs strictly more than another is dropped.
- **Component ids are their own geometry** (`r<y>c<x>` at the minimum (y,x)
  tile, in atlas coordinates). Re-analysing unchanged terrain reproduces the
  same ids, which is what makes `--check` exact and keeps hand-written
  references from churning.
- **A hand-authored row is remapped by what its sub-region HELD.** A sub-region
  has no tiles of its own, so old id → new is read off the exits and locations
  bound to it; a sub-region that bound nothing cannot be remapped and is
  reported rather than guessed at.
- **The round trip needed an explicit rule.** The analyzer writes its own
  unlabelled crossings as `source: "manual"` — that is what "someone has to
  author this" means in the format — so a naive second run preserved them as
  hand-authored AND emitted them again, growing the file by a row per run. Two
  cases collapse: a ruleless preserved row the analyzer just re-emitted, and a
  fresh unlabelled row for a crossing the author has since labelled.
- **The tile partition is session-local and never persisted.** It recomputes
  deterministically from the map document; storing it would only give the schema
  a second copy of the terrain to drift from.
- **`simplifyRule` collapses what composition says twice.** A swim followed by a
  waterfall climb came out as `Has(Swim) AND Has(Swim, 2)`; n copies of an item
  imply n−1 in any game, so this lives in the game-agnostic core.
- **An unlabelled internal exit compiles to a FREE AP exit.** `access_rule` is
  optional in the format and the compiler passes that through, so a crossing
  awaiting a hand-written rule is permissive downstream. That is the right
  default for an atlas grown incrementally, but it means the needs-authoring
  list is a logic obligation, not a cosmetic one.
- **The starter atlas is analyzed by its own generator**, so `--check` gates the
  analysis: a semantics-table edit that changes a rule shows up red instead of
  leaving the atlas quietly disagreeing with the map it describes. Two
  independent idempotence gates cover it (the generator's `--check` and the
  analyze CLI's).
- **Phase 3's "revisit whether a crossing wants both directions' rules" stays
  open, and is narrower than it looked.** The analyzer computes each DIRECTION of
  an internal crossing independently and emits them separately when they differ
  (the waterfall proves it), so the subgraph half of that question is answered.
  What is untouched is BOUNDARY exits: a `vanilla_layout` connection still
  carries only its source exit's `access_rule`, and the analyzer authors no
  boundary rules at all. That is decision 5's intrinsic-frontier territory, so
  it belongs with the sorter in Phase 6.

**Acceptance on real data:** the starter atlas gained `dungeon1_room1` (level 3,
closing the `descent` exit that was on the growth list) and every region now
carries computed rules. `overworld_start` → 6 sub-regions, `mixed` (water,
breakable rocks, an asymmetric waterfall, and one building crossing left for
hand authoring); `dungeon1_room1` → 2 sub-regions, `analyzer` (a breakable rock
walls off the stairs down); `starting_house` and `owls_nest_entrance` → no
split, asserted rather than skipped, with the subgraph correctly OMITTED. The
compiled preset regenerated to 11 AP regions / 23 exits, and the end-to-end
verifier still walks the real game between them.

### Phase 5b — Maze-mode substrate projection — **COMPLETE 2026-07-28**
- [x] Project an atlas region's analyzed grid into the maze substrate, so a
      marked region is playable without the original engine

**Rulings (user, 2026-07-28):**
1. **The atlas + the semantics tables are the SINGLE SOURCE OF TRUTH** (the
   two-truths rule): the projection derives everything and never hand-codes
   Seedling behaviour.
2. Combat, and anything outside access-rule-relevant mechanics, is OUT of scope.
3. The maze flavour is a SECOND registered preset beside the canonical flash one,
   never a merged file.

**As built:**
- **Projection:** `procgenPipeline/regionAtlasMazeProjection.js` — game-agnostic
  like the analyzer core; the caller supplies `gridFor(region)` /
  `conditionKey` / `resolveCondition`, and `seedlingMazeProjectionDeps()` in
  `flashPanel/seedlingAtlasAnalysis.js` is the one place Seedling is wired in.
  The tile PARTITION is recomputed through `analyzeRegion` (it is deliberately
  never persisted — Phase 5a); the RULES and sub-region identities come from the
  atlas, which is also where the hand-authored rows live.
- **Compiler:** `sidecarFlavor: 'maze'` swaps the projection-3 sidecars and
  carries NO `flash_panel` block (nothing there boots the original engine, and a
  stray block would start it). The compiler now also records the AP exit names of
  internal crossings, which the projection needs.
- **CLI + preset:** `region-atlas-compile.mjs --maze` (loads the per-game config
  the analyze CLI uses) →
  `frontend/presets/seedling_atlas_maze/AP_1/AP_1_rules.json`: 10 sidecars, 20
  exits, 14 rule-typed gates, 1 location. Registered, and mirrored into
  `preset_files.live.json` BY HAND again.
- **In-app legs (the payoff):** `tests/testCases/seedlingAtlasMazeTests.js`,
  category `Seedling atlas maze`, both enumerated in the substrates config. No
  batch claims the category, so it rides the default `fast` batch. Everything is
  read off the LIVE world — which exit is ungated, which is gated, what item its
  rule wants, which tile to stand on — so a projection change retargets them
  instead of breaking them.
- **Verifier:** `scripts/procgen/verify-seedling-atlas-maze.mjs` — four phases
  over the COMMITTED preset (payload consistency, walkability through the real
  engine, byte-stable regeneration, and a browser phase in the DEFAULT mode). It
  PRINTS the projection report. Nothing SKIPs: no artifact is involved.
- **Tests:** 3635 → **3690** vitest (55 new). Two strata: hand-built ASCII grids
  in a made-up one-item game (which also prove the core is game-agnostic) and the
  real committed atlas, every payload loaded through the REAL
  `deserializeMazeWorld` and asserted walkable from its spawn.
  `test-substrates --batch=fast` **59/59**, up from 57.

**Acceptance on real data:** `?game=seedling_atlas_maze&seed=1` boots the default
procgen mode into `overworld_start__r8c0` — 20×20, 109 floor tiles, six exits
(two ungated level links, four computed crossings) — the player spawns on the
sub-region's own entrance tile, walks to the house door and crosses into
`starting_house`, and cannot reach `overworld_start__r11c19` until a Progressive
Sword is in the inventory.

**A red first run worth remembering:** both legs failed on a mis-signed
direction. The staging tile really was beside the gate, but the key walked the
player AWAY from it, so "the step did not move the player" passed for entirely
the wrong reason and the crossing half then failed. `assertAimedAt` now proves
the key aims at the tile under test BEFORE either half is believed — the same
lesson as every other "a negative assertion needs a positive control" entry in
this repo.

**What a sub-region becomes** — one maze world per AP sub-region, sized to the
atlas region's `bounds` in region-LOCAL coordinates so every world of one region
shares a coordinate space. Its own component cells are floor and everything else
(including the other sub-regions) is wall, so a crossing is the only way out.

**The crossing representation (the phase's one open design point), as chosen:**
a crossing gets ONE exit tile, on the crossing material's FIRST cell out of the
sub-region — `crossings[].tiles[0]` from the analyzer — plus a
`clear_set_type: 'rule'` obstacle carrying the atlas row's rule. This collapses
the kickoff's point-vs-area distinction instead of implementing both: a point
gate (rock, lock, rope) is the degenerate case where both sides' first cells are
the SAME cell, so the two worlds put their exits on one shared tile and an
arrival lands exactly where the player left; an area span (water, lava) has the
two sides' first cells on opposite banks, so you step into the water on one side
and arrive standing in the water on the far side. Uniform, and it keeps the
invariant: crossing into another sub-region produces a real `user:regionMove`,
and a gated cell is impassable without the rule's items.
- *Rejected: exit tiles on every gate cell of a point gate* — a maze exit
  carries one target, and a material group touching three components would make
  the attribution of each cell ambiguous.
- *Rejected: an obstacle span walkable tile-by-tile with exit tiles on the far
  bank* — the far bank differs by direction, so the arrival tile would not be an
  exit in the destination world and could not be resolved at all. The maze model
  is "boundary tiles are single tiles"; the span texture is incompatible with it.

**The exit-id invariant (a real defect found and fixed here):** a maze payload's
`exit_id` IS its `exitName` — check any committed maze preset
(`{exit_id: 'exit_1', exitName: 'exit_1'}`). It is load-bearing:
`mazeRoomEngine` keys `world.exits` on `exit_id`, the panel publishes
`user:regionMove` with `exitName`, and `procgenPlayer.handleRegionMove` resolves
the arrival by asking the SOURCE world for `exits.get(exitName)` and reading its
`targetExitId`. The first cut keyed exits by the atlas's short id, that lookup
missed silently, and every arrival fell back to the region's entrance tile. So
both fields are the AP exit name, `targetExitId` is the AP exit name of the edge
coming BACK, and the atlas's own id rides along as `atlas_exit_id` for
traceability. (The FLASH payload is different and correct as it stands: its glue
resolves an arrival against `exits[].exit_id`, so it keeps the atlas id.)

**A door drawn on solid ground is the NORMAL case**, not an edge case: four of
the starter atlas's seven overworld exits sit on non-walkable cells (the house
door is inside a building whose per-pixel mask Phase 5a deliberately did not
transcribe). Such a tile is opened, and when it is not adjacent to its own
sub-region a corridor is CARVED to it through the non-wall cells between —
never through a wall. **A carved cell keeps its own gate:** carving a water tile
emits the water's rule as an obstacle, because a carve that opened it free would
hand the player a route the real game charges for (the starter atlas's unwired
`north_crossing` is exactly that case, three water cells deep).

**v1 fidelity fences, all reported by the projection rather than assumed:**
- A crossing collapses to one tile: you enter the material at the near side and
  emerge at the reverse crossing's near cell. Interior material cells are walls.
- A crossing with several routes realises only the CHEAPEST route's entry cell;
  the rule still ORs every route.
- A one-way crossing (no reverse row) has nothing to arrive at, so arriving in
  the destination falls back to its entrance tile (`one_way_arrival`).
- A multi-tile boundary span collapses to its `entrance_tile`; the other span
  tiles stay whatever terrain the map says they are.
- An unlabelled crossing is **WALLED** and named (`walled_unlabelled`). Phase
  5a's "an unlabelled internal exit compiles to a FREE AP exit" must not become
  a free WALK; the starter atlas's building crossing is walled in both
  directions. A row the ANALYZER wrote with no rule is different — that one is
  genuinely free and projects ungated.
- Directional physics is BETTER than the kickoff expected: the analyzer already
  emits each direction of an asymmetric crossing as its own row, so the
  projection gates each direction at its own cost (the water column comes out
  one Progressive Swim down and two back up). A direction with no row at all is
  a wall — conservative, never under-gated.
- Sinks (pit drops) are walls, named as boundary-exit candidates; ice slides as
  ordinary floor and the analyzer's `review` note is carried through;
  unclassified terrain is walled and named.
- A carve through a blocker with no derivable rule is passable, and said so
  (`carved_through_manual` — the two house doorways).

**Known incompleteness (not a 5b defect):** the computed crossings gate on AP
items the partial atlas has no location for, so granting one logs
`[InventoryManager] Adding unknown item`. That is the graph's pre-existing state
(the atlas records one `vanilla_item` so far) and is why the in-app leg grants
through stateManager rather than by checking a location.

**No mazeRoom change was needed** — the phase's own guardrail held: every
runtime behaviour rides existing machinery (arrival spawn at the arrival exit's
tile, `clear_set_type: 'rule'` clearance through the panel's stateManager-backed
evaluator, `exit_cross` → `user:regionMove`, item overlays → `user:locationCheck`).

### Phase 6 — Sphere growth: pre-built regions — **COMPLETE 2026-07-28**
- [x] Adapter + `atlasDoc` seam (pool, per-region extract)
- [x] Sorting pre-pass: assign pre-built regions to spheres from intrinsic
      rules; settle the gate-rung ruling (open question 2 — **RESOLVED**, below)
- [x] Placement with fixed exit sides; connector regions; gaps allowed
- [x] Oracle/verification parity with existing sphere-growth gates

**Rulings (user, 2026-07-28):**
1. **Sorter-first, with a built-in fallback.** A pre-pass sorts atlas regions
   into spheres from their intrinsic access rules BEFORE growth fills the rest in
   around them; the region's intrinsic entry rule serves as its sphere gate, made
   legitimate by the sorter scheduling every required item into a strictly
   earlier sphere — so the stratification invariant holds by construction and the
   sphere-log oracle stays exact. If the attempt proved unworkable, the fallback
   was beside-the-skeleton placement with engine-drawn synthetic gates and
   intrinsic rules AND-composed. **The attempt SUCCEEDED**; the fallback is built
   and kept (`--atlas-placement quota`), because slice order made it the first
   thing that worked and it remains the honest answer when a pool's frontiers are
   mostly out of vocabulary.
2. **Required-item injection**: intrinsic-rule items are added to the item plan
   of an earlier sphere by the sorter. A region whose requirements cannot be
   scheduled is DECLINED loudly, never forced.
3. **Locations keep their Seedling names**; the world's fill places items
   normally (`vanilla_item` is vanilla-preset-only).
4. Scope fences: sphere growth only; maze flavour only; Seedling only. **v1
   entry-rule vocabulary: conjunctions of `Has(item)`** — a region whose entrance
   rule contains OR or counts is declined with a report line. **(LIFTED
   2026-07-28 — the vocabulary is now DNF over `Has`; see "fences 1 and 2
   LIFTED" below.)**

**This resolves open question 2 (the gate-rung ruling for decision 9):** a
pre-built region MAY serve as a gate rung, and its gate is its own intrinsic
entry rule — but only because the sorter first makes that rule a legitimate
sphere-k gate. Decision 9's "beside the skeleton with synthetic gates in front"
survives as the fallback route, not as the default.

**As built:**
- **The pool (`procgenPipeline/regionAtlasPool.js`)** — a THIRD capture contract
  beside the region library's two. The library has 'procedural' (payload only,
  rules re-derived from geometry) and 'content' (payload + carried rules); an
  atlas entry is **payload + AUTHORED rules**. Its geometry IS re-derivable, but
  its rules are rows a human or the Phase-5a analyzer wrote, and re-deriving them
  from the projected tiles would quietly promote the projection's v1 fidelity
  fences into AP logic. One entry per AP sub-region, carrying the 5b payload,
  every OUTBOUND exit with the atlas's rule for it, and every way IN with what
  the real game charges to come that way.
- **CLI + artifact:** `scripts/procgen/region-atlas-pool.mjs` →
  `frontend/atlas-pools/seedling-atlas-pool.json` (derived, `--check`-gated,
  content-hashed `pool_id`). It prints the requirement census, which is the
  sorter's input and therefore the place an atlas or semantics change shows up.
- **Seam:** `growthParams.substrateConfig['<game>'].atlasDoc`, read directly by
  `resolveSphereAtlasSources` — the library route's precedent, keyed by the GAME
  (decision 5) while the quota is keyed `atlas:<game>`. No `applySubstrateConfig`
  was added to the sphere path.
- **Substrate hook:** `mazeLibraryEntry.instantiateAtlasEntryForSpecs`, registered
  on maze. Prunes surplus exits (keeping their geometry), stamps the authored
  rules, and gives each slot the atlas's own location name via `global_name`.
- **The sorter (`procgenPipeline/sphereAtlasSorter.js`)** — pure, rng-free, and
  it MUTATES the plan (which is also the oracle, so the caller must verify
  against the same object). Groups regions by frontier, schedules fresh
  requirement items into successive spheres, and places each group in the wave
  its requirement earns.

**Decisions worth knowing:**
- **An atlas entry is placed AT MOST ONCE.** A library entry is a palette chip; an
  atlas entry is a SPECIFIC PLACE, and two copies of the starting house would
  duplicate its location identity. Selection is declaration order among unplaced
  entries, tightest location fit first (so a node needing no chest does not eat
  the one sub-region the map marked one in). Zero rng, as F6a requires.
- **The placed region takes the MAP's name** (`overworld_start__r8c0`, not
  `region_4_3`), so the compiled world, its spoiler and the sphere tree all say
  which piece of the map this is. That is why the entry is claimed BEFORE the
  realiser specs are built.
- **The driver's gate AND-composes onto the authored rule**, never replaces it
  (the library path's overlay-write assumption does not carry over).
- **The back-exit is retargeted to the projection's own entrance tile.** The
  grid-mirror tile a generated region uses is very likely a WALL in a real map,
  and an atlas region is sized to its own bounds so the mirror may not even be
  inside it. This is F6 deferred-thread 2 ("maze back-exit tile fidelity"), and
  for an atlas region it is not a nicety: without it the arrival lands in solid
  rock while every compile and every oracle stays green. Gated on the atlas
  source id, so it is byte-inert everywhere else.
- **v1 fence: an atlas region hosts NO children** (`canHost`) — **LIFTED
  2026-07-28, see below.** Its exits are the real map's and most are gated by the
  map's own rules; a child hung behind one would need those items scheduled
  before its own wave — exactly the invariant the oracle checks — and the planner
  could not know which exit the fit-selector would pick (the F6b
  tree-build-vs-realise split). A SORTED node closes that gap by pinning the
  entry, which is what the exit envelope is built on.
- **A sorted atlas node carries no items.** A real map offers exactly the
  locations it was marked with (the starter atlas has ONE), and the grower's item
  round-robin knows nothing about that capacity. The quota route does assign
  items and DECLINES loudly when the map has no slot — which is the honest
  failure, and the reason the sorter route is the default. Capacity-aware item
  assignment is the natural next step, not a v1 claim.
- **The gate's COUNT comes from the plan's cumulative table**, not the atlas row.
  It can only ever be stricter than the map's own requirement; over-gating is
  safe, opening a sphere early is not.
- **Byte-inertness** is by construction: with no `atlas:` quota and no
  assignments, `resolveSphereAtlasSources` returns `{}`, `pickQuotas` is the
  original object, and no new branch is taken. Verified against the parent commit
  with `dump-sphere-byteidentity` and `dump-topdown-byteidentity`, plus
  `sphere-step.js` ≡ `dump-sphere-growth.js` for seed 1.

**Acceptance on real data (as of the v1 fences; superseded by the lift below).**
The committed pool's requirement census read the map exactly: four sub-regions
free to enter, three behind a plain `Progressive Swim`, and three DECLINED
because their only way in is `(Progressive Sword OR Ghost Spear)` — a
disjunction the v1 gate representation could not carry. Sorted into a
three-sphere plan, `Progressive Swim` was scheduled into sphere 1 and the three
water-locked sub-regions became wave-1 nodes gated on it; the sphere oracle was
exact, `Generate.py` found a winnable fill, and `Starting House - Chest`
appeared in the spoiler under the name the map gave it, holding a real item.

**Gates:** `scripts/procgen/verify-atlas-sphere-roundtrip.mjs` (43 assertions,
world_generator + Generate.py, the independent stratum); the in-app leg
`seedling-atlas-sphere-placed-region` walking the committed
`seedling_atlas_sphere` preset (the witness the oracle cannot be: it asserts the
arrival lands on FLOOR); vitest 3690 → **3753** (33 pool, 16 maze hook, 14
sorter) plus **25** `*.slow` cases for sphere placement + the sorter route;
`test-substrates --batch=fast` 59 → **60**.

**Known incompleteness (recorded, not defects):** ~~the atlas hosts no
children~~ (LIFTED, below); sorted atlas nodes hold no items; ~~the entry-rule
vocabulary is conjunctive~~ (LIFTED, below); the Seedling starter atlas has one
marked location, so an atlas region is currently geography and gating rather
than loot. Each is a fence with a named next step.

---

### Phase 6, fences 1 and 2 LIFTED — **COMPLETE 2026-07-28**

**Rulings (user, 2026-07-28):**
1. **The lift is default sorter behaviour**, no opt-in flag. The shipped
   `seedling_atlas_sphere` preset is REGENERATED with the quota raised to admit
   every accepted entry (a quota that truncates in declaration order serves
   nothing), and every downstream witness re-pins against the richer world.
2. **Child-hosting: gated exits are the primary design** — an atlas exit's
   authored rule determines what must be scheduled before a child may connect
   behind it. Fallback if it fought the tree/oracle invariants:
   ungated-exits-only. **The primary design SUCCEEDED**; no fallback was taken.
3. Count support lands with OR.

#### Fence 1 — the entry-rule vocabulary (OR + counts)

A requirement is normalized to **DNF over `Has` terms**
(`regionAtlasPool.requirementDnf`): `Or`/`HasAny`/`HasAll`/`And` compositions and
`Has(x, n)`. Redundant disjuncts are dropped (a conjunct another one implies),
the result is ordered (fewest terms, then canonical key), and a blow-up past
`DNF_DISJUNCT_LIMIT` declines rather than enumerating. `Compare`, `Count*`,
helpers and `False_` still decline with a reason.

- **The honest wave is `min over disjuncts of (max over that disjunct's items'
  spheres)`** — the first sphere in which SOME way through the rule opens. It is
  computed in a SECOND PASS against the finished plan, so a frontier another
  group happened to complete is not missed.
- **Scheduling picks ONE disjunct** (cheapest, then lexical — rng-free) and
  pushes its items. A count pushes N instances and tops up a partially-planned
  item. A disjunct the plan already satisfies is reused and nothing is scheduled.
- ⚠ **The gate the world sees is the AUTHORED rule, verbatim.** This is the
  whole point. `sphereGateRule` re-synthesises a gate from item names, and doing
  that for a disjunctive requirement would AND one branch onto the map's own row
  and kill the other — the exact over-gating the v1 decline existed to prevent.
  So `gateRule` rides the tree node, `buildNodeRealiserSpecs` prefers it, and
  `andComposeRules` became identity-aware.
- ⚠ **A ZONE host cannot derive an OR back out of its geometry.** It is handed
  BOTH the necessary subset (`extractItemRequirementFromRule` — open-enough
  geometry) AND the `access_rule` (the true gate, which the zone assembler
  already stamps). Building the geometry on the scheduled disjunct would
  physically wall off the branch the logic still promised. Maze hosts need
  nothing: `placeFromRules` realises arbitrary rule trees.
- ⚠ **`rebuildSphereTopology`'s stratification advisory is per disjunct.** One
  way through holding a sphere-k item is enough; flagging each item separately
  would report every atlas world as broken.

**On real data:** the three sword-or-spear sub-regions v1 declined are now
placed, and `overworld_start__r2c13` moves with them — its sword crossing costs
the same as its water one and sorts first, so the map's earliest way in is the
sword. Census: four free, four behind `Progressive Sword OR Ghost Spear` (Ghost
Spear scheduled into sphere 1), two behind `Progressive Swim` (sphere 2). **Zero
declines — the whole starter atlas places.**

#### Fence 2 — child hosting

Each sorted assignment carries an **exit envelope**: the pinned entry's exits in
payload order — which is the order `mazeLibraryEntry` assigns them to child
sides — each priced with the sphere it opens in. `canHost` and the gate choice
read it, so the planner knows exactly which of the real map's doors a child gets.

**The rule, in one sentence:** the realised exit rule is the door's rule AND the
child's gate, and that composition must become satisfiable in **exactly** the
child's own gate sphere.

- a door that opens LATER → refused (composing would drag the child past its wave)
- a door whose rule is out of vocabulary → refused (its sphere is unknowable)
- a door that opens EXACTLY at that sphere, for a child with no gate of its own →
  **the map's own charge for the crossing IS the child's gate**; nothing
  synthetic is added to a real door
- a FREE or earlier door → the drawn gate (or an atlas child's own entry
  requirement) ANDed onto whatever the door charges. This is the AND-composition
  path Phase 6 could only drive directly; growth reaches it now.

- ⚠ **The envelope bound is HARD, not advisory** — `reserve()` THROWS past
  `entry.exits.length`.
- ⚠ **A door standing on the region's ENTRANCE TILE cannot host.** The driver's
  back-exit is retargeted onto that tile, so a door there shares a cell with it,
  and one cell leading two places is one dead connection. Slots also refuse a
  cell an EARLIER door claimed. Doors go to children in order and cannot be
  skipped, so an unhostable slot ENDS the envelope.
- ⚠ **A pre-existing `stitchGrid` defect this exposed.** It identified an exit
  by its TILE. An atlas back-exit sharing a cell with a door matched that door's
  row, lost its driver-managed exemption, and was re-stitched to the door's
  geographic neighbour: the region ended up with two exits into its CHILD and
  none back to its parent — a shortcut the plan never made, which compiled clean
  and turned the sphere oracle red. Keyed by exit id now. Three engine fixtures
  had been omitting `exit_id` from `exits_placed`; every real producer stamps it.
- The QUOTA route pins no entry, so it keeps the v1 leaf behaviour.
- `buildSphereAtlasRegion` asserts the realised child→exit mapping IS the one
  the tree priced, and that no two exits share a cell. Both failures are
  otherwise invisible.

#### As shipped

`seedling_atlas_sphere` carries all ten sub-regions in eighteen regions; seven
hang off an atlas region's own doors, including a GENERATED region behind the
map's sword-or-spear crossing.

**Gates (2026-07-28):** vitest 3768 → **3790/3790**; procgenPipeline slow tier
117 → **121** (whole slow tier **364/364**); `test-substrates --batch=fast`
**61/61**; `verify-atlas-sphere-roundtrip` fully green including its
byte-equality regen pin and AP's own fill on the richer world; byte-inert
against the parent commit on `dump-sphere-byteidentity`,
`dump-topdown-byteidentity` and `dump-spiral-byteidentity`.

**The acceptance headline:** the headless bot (573 steps, 33 crossings) beats
the richer world, and every sword-or-spear crossing in it clears with ONLY the
Progressive Sword and with ONLY the Ghost Spear — bracketed by holding neither
and finding them shut. A gate re-synthesised from the one disjunct the sorter
scheduled fails that test, which is what makes it the witness for fence 1.

**No panel exposure yet** — an atlas pool reaches sphere growth through the
headless CLI only. The region-library arc needed a whole phase for this (F6d),
and it found a real wire missing: the panel drives the STEPPED runner, which had
to learn to resolve the sources itself. That half is already done here
(`sphereSteps` resolves atlas sources and threads `atlasAssignments`), so what
remains is the UI: serving pools, ticking one, and running the sorter in
`_buildSphereConfig` before the plan reaches the driver. Deliberately out of this
phase's scope (the kickoff fenced it to sphere growth).

### Phase 7 — RWK — **POSTPONED INDEFINITELY (user ruling 2026-07-28)**

The arc is Seedling-only for now. Nothing below is cancelled — the checklist
stands for whenever RWK resumes — but no session should pick it up without a
fresh user ruling. Phase 8 proceeds with its Seedling legs only; the RWK bot
bullet inherits this postponement.

- [ ] Tile map editor feature: select region-transition tiles (H/V lines)
- [ ] Analyzer update: evaluate one region at a time; per-region access
      rules for locations and exits (sub-region split computed from
      reachability); RWK atlas emitted (coordinates only)
- [ ] Injected ActionScript: position detection → transition trigger;
      boundary visuals; reuse existing teleport injection
- [ ] Same top-down milestone as Phase 3, for RWK

### Phase 8 — Playback bots (staged)

**Ruling (user, 2026-07-28): the MAZE SURFACE comes first.** A bot that walks
the projected map proves the generated worlds beatable without touching the
original engine at all, and it is the surface every downstream consumer already
runs on. The real-game bot (driving recompiled Seedling itself) is a LATER
slice; its design space is recorded below, unexplored.

#### Maze surface (slice 1) — **COMPLETE 2026-07-28**
- [x] Headless witness: a world with real Seedling map regions in it is proven
      beatable by walking it tile by tile through the real maze engine
- [x] Traversal completeness on the maze fixture: every region entered, every
      exit crossed, gated exits blocked-then-open
- [x] In-app leg: the SHIPPED playback bot completes the sphere-grown world
- [x] The walkTo evaluator divergence (found by this slice's recon) fixed

**As built:**
- **The headless witness** —
  `frontend/modules/procgenPipeline/atlasMazeBot.slow.test.js` (20 cases), in the
  `*.slow` tier beside `braidSphereBot`. Its whole input is the COMMITTED
  presets: `rules.json` for the logic, `preset_sidecars` for the geometry. It
  imports the sorter, the projection and the compiler NOT AT ALL, which is what
  makes it the arc's independent stratum — the sphere oracle shares the
  placement's assumptions, and this does not. Logic order comes from
  `shared/procgen/forwardSimulator.js` (`buildAccessibilityModel` /
  `pickNextTarget`), the drive from `deserializeMazeWorld` → `findPath` →
  `stepsToInputs` → `step` / `detectStepEvents`. It is engine-stepped, not
  wall-clock: ~400 steps across 24 maze worlds in about a tenth of a second.
- **Two presets, two DIFFERENT claims.** `seedling_atlas_sphere` is
  BEATABILITY (all 7 canonical locations checked in a logic-consistent order,
  `victory` held, no stall). `seedling_atlas_maze` is TRAVERSAL COMPLETENESS —
  it is a FIXTURE, not a beatable world (constant-true completion, gate items
  absent from its pool), so the honest claim is that the projected map is
  walkable: grant the gate items externally, enter all 10 regions, cross all 20
  exits, check the one marked location. The suite asserts the fixture is still a
  fixture, so a future regeneration that makes it beatable fails loudly rather
  than silently changing what is being proven.
- **The in-app leg** — `seedling-atlas-sphere-bot-completion` in
  `tests/testCases/seedlingAtlasMazeTests.js`, enumerated in the substrates
  config under the existing `Seedling atlas maze` category (no batch claims it,
  so it rides `fast`). The queue is built from the preset's EMBEDDED
  `sphere_log` — there is no `.jsonl` beside this preset, so a non-empty queue
  IS the assertion that the embedded path works. Measured 28.3 s;
  `--batch=fast` 60 → **61/61**.
- **The sphere queue alone never enters a placed atlas region in this world,
  and asserting that it did would have been an assertion about the FILL.** Every
  advancement item sits in a generated region, and the one location the atlas
  marks (`Starting House - Chest`) holds filler, so the sphere log does not name
  it. The leg therefore has two halves: drain the queue (4 generated regions,
  `victory` held), then `bot.walkToLocation('Starting House - Chest')` — which
  routes across regions one exit at a time — and assert gameState's own path
  reaches `starting_house`. That second half is the one where a walled AP-only
  crossing would strand the router, so the silent-stall guard is re-checked
  after it.
- **The cross-region witness is gameState's PATH**, not the bot's log (plain
  status strings) and not its own cursor — a bot agreeing with itself witnesses
  nothing. The first cut read `bot.getLog()` expecting objects and silently
  produced an empty set; it failed loudly only because the assertion was
  `> 1`, which is the argument for asserting a lower bound rather than a
  property of a set that might be empty.

**Decisions and findings worth knowing:**
- **An exit-tile step IS a crossing**, so the bot may never treat a crossing
  cell as floor on the way somewhere else. Every in-region walk runs with
  `excludeOtherExits`. That WALLS real corridors — `region_3_3`'s back-exit sits
  on its own entrance tile and its three other exits are mutually unreachable
  without stepping over it — and the answer is neither "walk through it" nor
  "call it unreachable": the bot routes through the REGION GRAPH, crossing out
  and coming back to arrive ON the tile that was in the way. The route search is
  therefore over `(region, arrival-exit)` NODES, not regions; the position
  inside a region is a function of which exit you came through, and that is
  exactly what makes the detour expressible. Both halves are positively
  controlled in the suite (the severance exists; the planner answers it with
  legs that leave the region).
- **Route over the SIDECAR exit set, never the AP graph.** AP lists exits the
  projection deliberately walled (`overworld_start__r1c6 ↔ r8c0`, an unlabelled
  crossing). A router trusting AP picks one, resolves no tile, and stalls in
  silence.
- **A silent stall is the vacuous-negative trap, and it is now impossible.**
  `mazeRoomUI._handleWalkToCommand` used to `console.warn` and return when it
  could not resolve a target; the visualizer got no target and the bot waited
  forever for a transition that could never come — indistinguishable from slow
  progress under a timed poll. It now returns `false`, `playbackBotUI._dispatch`
  returns the controller's verdict, and `_publishWalkTo` turns it into a NAMED
  error status. The in-app leg asserts completion AND that no error status ever
  appeared.
- **The entrance-==-exit-tile case is normal, not an edge case** (a retargeted
  back-exit, and every point-gate crossing where both sides share one cell). A
  zero-length walk fires no event, so the bot steps OFF and back ON — earning
  the crossing rather than fabricating the event.
- **Inventory is a `Map<name, count>` end to end.** `inventoryCount` reads a Map
  directly, so Has/HasAll/HasAny/AtLeast and count gates all evaluate with zero
  stubbing. This is the only reason `overworld_start__r8c0`'s
  `Has(Progressive Swim, count: 2)` gate can be tested headlessly, and the suite
  pins it opening at exactly 2 and not at 1.
- **A real defect in the shared simulator, fixed here:**
  `forwardSimulator.pickNextTarget` ran its inventory through
  `new Set(value)` — which, handed the `Map` that `generateSphereLog` in the
  same file builds, produced a set of `[name, count]` PAIRS. Every lookup then
  missed and the caller saw "nothing is reachable" instead of an error. A Map
  now passes through unchanged. (`frontend/modules/shared` is a submodule; this
  landed there with its own regression case.)
- **The witness verifies AP logic independently of its own router.** On every
  pickup — including items walked over en route, which `pickNextTarget` never
  chose — it checks the location really was AP-accessible with what was held a
  moment earlier. A tile route that reaches a chest logic says is still locked
  is an under-gated projection, and that is the bug class a tile-walking witness
  exists to catch.
- **Quantitative pins, not just green.** Every assertion above is satisfiable by
  a bot that teleports, so the suite also pins step counts (245 sphere / 155
  maze, measured 2026-07-28) and crossing counts (25 / 20). Two mutations were
  run to confirm the suite bites: dropping `excludeOtherExits` and granting
  nothing on pickup each turn it red.

**The walkTo evaluator divergence (a pre-existing maze defect, found by this
slice's recon and fixed here).** The panel had TWO ways to move the player that
judged a gate differently:
- the keyboard / queue path passed `_currentRuleEvaluator()` (the full Rule
  Builder schema over stateManager's snapshot interface — CountItem, helpers,
  `count_check`) to `step`;
- the walkTo path planned AND stepped with a count-collapsed `Set`
  (`inventoryFromSnapshot`) and NO clearance opts at all, so it fell back to the
  procgen-local subset evaluator.

A `Has(count: 2)` gate therefore behaved differently depending on which control
the player used, and any rule the subset cannot express was judged by the wrong
engine entirely. The fix is one shape and one evaluator on both paths:
`inventoryFromSnapshot` returns a `Map<name, count>`; the visualizer's
`_inventory` is a Map throughout; `MazeRoomVisualizer.setClearanceOpts()` installs
the bag and both `_planTilePath` and `_tick`'s `step` use it;
`mazeAutopather.findPath` gained `opts.clearanceOpts` and forwards it to
`isObstacleCleared`. The panel's other planners (`_resolveExploreTarget`,
`_pickBestExit`) go through the same `_planningClearanceOpts()`. Everything
downstream only calls `.has` / `.size` / iterates `.keys()`, which a Map answers
identically — the one spread over the raw collection (the inventory display) was
changed to `.keys()`.

*A planner and the engine that executes its plan must agree about every gate.
When they do not, the walk is either routed through a door the engine then
refuses (a stall) or around one that is really open (a detour) — and both look
like content bugs, not harness bugs.*

- **The stall guard folds the bot's LOG, it does not sample it.** `instant()`
  drives the whole queue in a tight loop, so an error status can appear and be
  overwritten between two poll ticks — and a transient is exactly the case worth
  catching. `_setStatus` appends every distinct status to `_log`, so the log is
  the mutation record. The empty-error assertion is bracketed by a positive
  control: the log must contain real statuses (including a terminal `finished`)
  before "no errors" means anything.

**Test deltas and gates, all measured 2026-07-28:** vitest 3755 → **3768/3768**
(1 shared-submodule regression case + 12 maze/bot cases: 6 visualizer, 4
autopather, 2 bot); slow tier 339 → **359/359** (the new file; the tier takes
~23 min, dominated by the runnerDemo battery, and CI runs it);
`test-substrates --batch=fast` 60 → **61/61**. All five atlas verifiers green
(`verify-seedling-atlas-maze`, `-preset`, `-play` — the wasm artifact was
present, so it did not SKIP — `verify-atlas-sphere-roundtrip`,
`verify-region-marking-tool`), both region-library round-trips green, and every
`--check` gate byte-identical (map extract, starter atlas, analyze, pool,
compile in both flavours).

#### In-app witness hardening — **COMPLETE 2026-07-28**
The fence-lift arc left an apparent flake in
`seedling-atlas-sphere-placed-region`. The on-disk run records
(`test-results/in-app-tests/`, 30-run retention) split it into three distinct
signatures, and the first job was dating them: **the run files are stamped UTC
while git dates are local (PDT, −7)**, which is what made these look like reds
against shipped code. Re-dated, *every one of them ran on code that predates the
commit which introduced or rewrote that leg* — the leg did not exist at all in
the tree two commits back (the file was 340 lines).

- **The gate that did not block** (22:17Z = 15:17 local; leg committed 15:39 in
  `363f72e60`). Reproduced ON DEMAND at HEAD by mutation — grant the gate item,
  skip the clear — and the failure is identical to the record: the negative and
  its region check fail while every positive after them passes, which is exactly
  what a still-held key looks like. **A real residual defect was found here and
  fixed.** The leg emptied the gate items rather than assuming an empty
  inventory, but decided *whether* to empty them by reading `getSnapshot()` —
  the proxy's `uiCache`, refreshed asynchronously — with no flush first. A
  pickup the walk had just made could still be in flight, so the read returned a
  stale zero, the removal was skipped, and the player walked through a gate that
  was working correctly. It now flushes with `pingWorker` before the read and
  asserts the items really are gone; without that positive check a removal that
  silently did nothing is indistinguishable from a gate that failed to block.
  The `gated-crossing` sibling had the older form of the same gap — it assumed
  an empty inventory outright — and both now share `clearGateItems`.
- **The walkTo stall** (22:33Z = 15:33 local; fix committed 15:39, six minutes
  later). Not load: the poll self-classified **STUCK** — "101/100 polls in 20.2s
  (max gap 218ms vs 200ms interval)" — so the tile really was never reached.
  `(0,0)` was an unreachable staging tile, and `walkableFrom` (the flood that
  makes `stagingTileBeside` prefer a tile the player can actually get to) is
  that fix, already in the leg's first committed version.
- **`.dispatch` of undefined** (02:2x Z = 19:2x local; `ddfe003b2` landed
  19:35). Mid-rewrite, uncommitted: those runs' condition lists differ from each
  other AND from HEAD, and no `.dispatch` call survives anywhere in the path —
  the relocation publishes through `window.eventDispatcher.publish` with
  `initialTarget: 'bottom'`.
- **The bot-completion red** (00:23Z) is confirmed stale, with a mechanism: the
  bot *won* — victory item held, "BEAT" passed — while the sampler watching it
  recorded `0 leg(s)` and `0 region(s)`. A blind witness, replaced 39 minutes
  later by `99c90784d`, which reads the bot's own log instead.

**Counted on HEAD after the fix:** the leg 8× solo green (2.3–4.0s, no stalls)
and 3 consecutive `test-substrates --batch=fast` runs green at 61/61. No
assertion was loosened; the leg gained one.

⚠ The "run it alone 8× and count" discipline had no way to express itself —
batches select whole categories by design, so triaging one test meant running
sixty neighbours. `npm test -- --test=<id>[,<id>]` now narrows an already-enabled
roster (it never enables what a mode disabled, and throws rather than run
nothing green). The id list is stamped into results and taken into
`compare-runs.js`'s baseline identity: an unstamped one-test run would become
the baseline for the next full run and report sixty tests as ADDED.

#### Real-game surface (later slice) — design space recorded, sequencing RULED
Recorded 2026-07-28 so the next session starts from the question, not from
scratch. Sequencing and the JS-port question ruled 2026-07-29 (below); the
routes themselves remain untried.
- **Two routes, both plausible.** (a) MORE INJECTED ACTIONSCRIPT: keep driving
  the shipped game from outside, extending the Phase-4 `state_properties` /
  teleport machinery with input synthesis. Note the Phase-4 fence —
  `BridgeGeneric.doConfigure` refuses a second configure for the life of a game
  instance, so widening the reported property set needs a page reload. (b) BUILD
  THE BOT INTO THE SEEDLING SOURCE and recompile: the source checkout already
  exists (the Phase-2 extractor reads it), and a bot compiled in gets the game's
  own collision and physics for free instead of reimplementing them. Stage 1 of
  the Seedling integration already proved the recompile-to-wasm toolchain, so
  (b) is de-risked on that axis; the 2026-07-29 recommendation leans (b).
- **The `Mobile.solids` caveat is RESOLVED (source read 2026-07-29), and
  favorably.** It is a `public var` — an INSTANCE variable, not a static — so
  per-entity overrides do exist, but every override in the tree is on enemies,
  projectiles, and scenery (`Jellyfish`, `Drill`, `LavaRunner`, `IceTurret`,
  `Puncher`, `Bomb`/`LavaBall`/`BossTotemShot` zeroing theirs, `Tree` carrying
  its own private list). The ONLY Player-side change is `Player.as:359` pushing
  `"LavaBoss"` — a boss-fight concern, not terrain. For PLAYER traversal — what
  the Phase-5a analyzer and the atlas model — the base list
  `["Solid","Tree","Rock","Rope","ShieldBoss"]` is the truth. The analyzer
  needs no correction; a real-game bot should still expect entity-side
  surprises in the v5 (enemies) rung, where the overrides live.
- **RULING (recommended by Claude, accepted by user 2026-07-29): a JS port of
  Seedling's core gameplay is a SEPARATE, LATER substrate arc — not the
  Phase 8 instrument.** The question was whether porting the game to JS as a
  substrate would help this slice. It cannot make this slice's claim: the
  maze projection, the analyzer, the atlas, and any hand-written port are all
  OUR TRANSCRIPTION of the same source, read by the same eyes — they would
  disagree with the real game *together* (the verifier-shared-assumption
  doctrine). "This grown world is beatable in the actual game" can only be
  witnessed by the actual game, and route (b) gets the game's own collision
  for free at a fraction of a port's cost. What the port DOES uniquely offer
  (recorded for its own arc): it is the only route to GENERATED worlds with
  real Seedling physics (the wasm game plays only its 116 baked-in levels —
  Phase 4 teleports the player around them but can never load a sphere-grown
  map); it is CI-testable from the committed repo where the 31 MB gitignored
  wasm never will be; and it gives the bot ladder's puzzle/enemy rungs a
  suite-runnable surface the maze projection deliberately lacks. Seedling is
  a BETTER first target for the Tilemap-Platformer-substrate idea than RWK:
  MIT-licensed, so the port and its maps are committable with no
  SWF-at-runtime dance.
- **Sequencing (same ruling): real-game bot FIRST, port SECOND — so the port
  is born verified instead of retrofitted.** The real-game slice builds the
  input-synthesis/drive machinery, and that machinery is exactly what anchors
  a port afterwards: differential tape testing (same input tape through port
  and wasm game, compare positions and level transitions) converts the port
  from shared-assumption transcription into an artifact verified against the
  oracle. The port never becomes a load-bearing stratum for Phase 8's
  beatability claim; the real game stays the oracle.
- **SEQUENCING AMENDED (user ruling 2026-07-30): per-stage JS-first.** The
  2026-07-29 "real-game bot first, port second" ordering is superseded at the
  stage granularity: each ladder stage is implemented **in JavaScript first**
  (fast iteration, suite-runnable, debuggable in the browser), **then in the
  actual Seedling code**. The port is thereby pulled forward incrementally —
  each stage ports only what that bot rung needs (v1 movement → v2
  collision/pathing → v3 gated terrain → v4 puzzles → v5 enemies), matching
  the staged-port observation in the scope datum below. What the 07-29 ruling
  protected is UNCHANGED: the JS side is the ITERATION surface, never the
  load-bearing stratum — "beatable in the actual game" is still witnessed
  only by the recompiled game, and differential tapes (same input tape
  through JS and wasm, compare positions/level transitions) verify each
  stage's JS transcription against the oracle as it lands.
- **The Seedling repository is FORKED (2026-07-30): `PeerInfinity/Seedling`**
  (parent `ConnorUllmann/Seedling`, MIT). The local checkout
  `~/CC/seedling` now has `origin` = fork, `upstream` = parent; the fork's
  `main` is kept PRISTINE (identical to upstream). The long-standing
  Stage-1 modifications are committed and pushed on branch
  **`stage1-teleport-build`** (checked out): the WhirlPool.png
  case-sensitivity build fix (a symlink — any Linux build needs it or the
  embed-path fix), and the Main.as skip-splash boot the teleport/AP wasm
  builds were compiled with. **The bot-in-source work branch exists:
  `bot`** (pristine `main` + the case fix ONLY, pushed 2026-07-30) —
  following the omsi-loops fork precedent.
- **Port scope datum (source survey 2026-07-29):** ~30,500 lines of AS3 across
  209 files on FlashPunk, but the core-gameplay subset (`Player.as`,
  `Mobile.as`, tiles, `Pickups/`, `Stairs`, `Teleporter`, `Puzzlements/`) is a
  modest fraction; the bulk is `Enemies/` (30+ classes), bosses, `NPCs/`, and
  presentation. A staged port mirroring the bot ladder (terrain → gates →
  puzzles → enemies) matches how the mass is distributed.
- **v1 KICKOFF DESIGNED (2026-07-30, Fable design session)** — brief:
  **`CC/docs/plans/seedling-bot-v1-opus-kickoff.md`** (moved out of the
  gitignored `NewDocs/` when implementation started, 2026-07-30). Four
  rulings taken (user, 2026-07-30):
  (1) the JS-side stage code lives in a **new frontend module
  `frontend/modules/seedlingDemo/`** (runnerDemo precedent: pure engine core
  + vitest, no panel/substrate registration yet) — this closes the
  2026-07-30 open flag; (2) the wasm oracle's observation streams are
  **committed fixtures**, so vitest runs a JS-vs-recorded-oracle
  differential in CI despite the machine-local artifact, and the local
  verify script becomes the staleness gate (SKIPs without the artifact);
  (3) the bot build is a **separate page `seedling_bot_ap/`** beside
  `seedling_teleport_ap/` — the Phase-4 artifacts stay untouched; (4) the
  kickoff is **v1 only**. Recon findings that shaped it: Seedling reads raw
  keycodes (`Player.as:59`) via check/pressed/**released** (dialogue needs
  full down-then-up), FlashPunk input state is private but its listeners
  hang on `FP.stage` so synthetic `KeyboardEvent`s drive it patch-free;
  `FP.elapsed` appears in zero lines of game code, so a tick-indexed tape is
  deterministic for movement (RNG only bites at the v5 rung; ~20 blackCover
  dead ticks follow every room load); live position is `player.x/.y` only
  (the `Main` statics are spawn-time, SharedObject-backed); the bot needs
  **no BridgeGeneric/configure change at all** — it registers its own EI
  callbacks, which the page shim auto-wraps under `__swfBridge.game.*`; and
  a one-line AS3 edit costs the FULL pipeline (~15 min mxmlc+SWFRecomp plus
  an effectively cold emcc pass), so the AS3 bot is a generic data-driven
  tape interpreter compiled in once per rung, with all iteration in
  tapes + JS.
- **v1 IMPLEMENTATION RECON COMPLETE (2026-07-30)** — full evidence trail in
  the kickoff's §8; the corrections are applied inline throughout that doc.
  All three flagged ⚠ items resolved, one unflagged risk cleared, and **two
  substantive corrections to the design brief**:
  - ⛔ **`Player` OVERRIDES `moveX`/`moveY`** (`Player.as:1687`/`:1717`). The
    brief's suggested noclip patch site (`Mobile.moveX/moveY`) would have
    been a **silent no-op for the player**. The flag belongs in the Player
    overrides.
  - ⛔ **`Player.input()` overshoots; it does not clamp.** The brief said
    "one held frame saturates the axis — velocity is effectively binary".
    The real guard is `if (v.x < moveSpeed) v.x += accel`, so velocity
    exceeds `moveSpeed` on most ticks and runs a ~3-tick limit cycle
    (0.80 → 1.35 → 1.10 → 0.85 → 1.40 …) against a `moveSpeed` of 0.8. **A
    JS transcription written to the old description diverges on tick 1.**
  - ✅ **SharedObject persistence — resolved, and the worry inverts.** The
    recompiled runtime models no persistence at all (in-process cache;
    `flush()` is a no-op returning `"flushed"`), so **every page load starts
    from an empty save and reproducibility is free** — no fresh-context
    dance, no reset command needed.
  - ✅ **The unflagged risk: synthetic `KeyboardEvent` dispatch works in the
    RECOMPILED runtime**, reaching the identical sink the hardware path uses
    (`input_handle_key → dispatch_key → avm2_keyboard_event_new →
    avm2_dispatch_event`). The whole zero-patch input design rested on this
    and it had not been checked against the C runtime, only against the AS3.
  - Also: **noclip does NOT bypass terrain speed** (`getState()` types the
    tile under the player independently of collision), so v1's JS engine
    takes a pluggable `terrainStateAt()` seam stubbed to ground rather than
    a hardcoded `0.8` — that way the differential *catches* a tape that
    wanders onto water/stairs instead of the assumption hiding in a constant.
    The verify scripts also run **headless** (swiftshader), correcting a
    stale "must be headed" note. Baseline re-measured fresh: vitest
    **3790/3790**, 155 files, 34.8s.
- **v1 SLICES 1+2 SHIPPED+PUSHED 2026-07-30** (`d67edb55d`, `d1e5f4ac5`;
  fork `bot` @ `25aaa43`). `frontend/modules/seedlingDemo/` holds the tape
  contract, the v1 physics transcription, the tape runner and the bot
  driver; `Bot.as` is compiled into a new `seedling_bot_ap` wasm page and
  **the real recompiled Seedling now replays tapes and reports where the
  player went**.
  - **The physics correction is CONFIRMED BY THE ORACLE.** Holding RIGHT,
    the game reports `x = 88, 92.09999999999998, 99.15` at ticks 0/4/10 and
    the JS engine produces the same doubles, float noise included — the
    overshooting limit cycle, measured in the real game rather than argued
    from the source.
  - **Two more transcription bugs the game caught**: the clamp reads the
    LEVEL size (`Game.as:1854-1855` overwrites `FP.width/height` per load,
    so level 0 is 320x320 → bounds [2,318]×[2,317], NOT the [2,158] the
    160×160 screen implies), and the player spawns half a tile in from the
    constructor args (`Player.as:357`, so `new Game(0,80,128)` → (88,136)).
  - ⏱ **Operationally: the recompiled game runs at ~0.5 frames/sec** under
    software WebGPU (headless AND headed alike), with ~18-20 `blackCover`
    fade frames per world load. Harness deadlines must scale with tape
    length — a flat 60s timeout dies during the fade and is
    indistinguishable from a dead bot. Every tape also needs a FRESH PAGE
    (`botReset` cannot rewind the game).
- **v1 COMPLETE — SLICES 3+4+5 SHIPPED+PUSHED 2026-07-30** (`dfd081bb8`).
  All five expectations are now ORACLE RECORDINGS from the real game, and
  **the JS transcription reproduces every one EXACTLY** — 220 ticks, bit
  for bit, float noise included, on the first recording. Both gates green:
  G1 (vitest: JS == recordings) and G2 (live wasm replay matches, and the
  live bot-driver task lands the REAL GAME at (119.88, 100.61) for a
  (120,100) target, read from the game's own observations).
  - ⚡ **~44x faster harness via real-GPU Windows Chrome driven from WSL**
    (`--win`; recipe in SWFRecomp-CC
    `tools/divergence/perf/WINDOWS_PLAYWRIGHT_FROM_WSL.md`). WSL Chromium
    is SwiftShader and must never be used for perf — ~0.5 fps there vs
    **~25 fps** on the real GPU, turning a 20-minute sweep into ~50s. ⚠ that
    doc says `python.exe`; on this box use **`py.exe -3.12`**.
  - ⚠ **The world clamp is UNREACHABLE in level 0** — the `clamp-left`
    fixture was invalid: walking left the game loaded an adjacent level
    (recorded `level=94` at tick 61) long before x=2. Replaced by
    `shuffle-stop`; the clamp keeps its hand-derived unit case. The
    observation stream's `level` field is what caught it.
  - ✅ **Cutscenes already skipped**, by design not luck: the intro fires
    only from the `level < 0` branch (`Game.as:765-773`) and the teleport
    boot passes an explicit level 0. `botStatus.saw_input_refused` has
    never fired.
  - Doc: `docs/json/developer/procgen/seedling-bot.md` (indexed in the
    procgen README), which also records the dead ends: the black canvas
    and the unconfigured-BridgeGeneric page errors are both present in the
    untouched teleport build and mean nothing.
- **v2 KICKOFF DESIGNED (2026-07-30, Fable design session)** — brief:
  `NewDocs/plans/seedling-bot-v2-opus-kickoff.md` (→ `CC/docs/plans/` when
  implementation starts). Queue §5c's three questions plus one the recon
  surfaced, all ruled (user, 2026-07-30):
  1. **Geometry: consume the committed Phase-2 extract directly**
     (`flashPanel/atlases/seedling-map.json` + `seedlingSemantics.js`'s
     verbatim AS3 tables) — no new committed artifact, no new regen chain;
     a new `seedlingDemo/levelWorld.js` transcribes the `loadlevel` subset.
     ⛔ reuse stops at the verbatim tables — the analyzer's
     `CELL_KINDS`/`buildSeedlingRegionGrid` abstraction is the
     region-verifier's altitude, not physics. Bonus: the oracle
     differential now live-tests the same tables the Phase-5a analyzer
     trusts. (Parse-at-test-time rejected — machine-local checkout would
     make the CI differential SKIP forever.)
  2. **Transitions modeled FULLY; `transitions` carries the minimal
     symmetric record** `{t, from_level, to_level}` (t = first observation
     tick in the new level), element-wise exact-diffed; teleporter identity
     EXCLUDED (the AS3 bot cannot observe it — an asymmetrically-known
     field cannot be differentially checked). Tapes may span levels.
  3. **Pixelmask colliders (Building, TreeLarge, …) are a loud-throw
     seam**, not modeled — a sweep step overlapping one's bounding rect
     throws a named error; fixtures route around. Phase 5a already proved
     both rect approximations unsafe; masks are extractable later if ever
     needed.
  4. **Pathing: in-level A\* + explicit cross-level legs** (the caller
     names the teleporter; planner executes waypoints through the REAL
     `step()` — the walkTo-divergence lesson). Auto cross-level routing
     deferred to the rung that needs it.
  **The headline recon correction: there is NO edge/bounds transition
  logic in Seedling at all.** Room changes are authored `<teleporter>`
  entities (16×16 AABB trigger with an anti-ping-pong latch;
  `new Game(to, playerx, playery)`; arrival at `(playerx+8, playery+8)`;
  velocity reset; held keys persist — no `Input.clear()` on teleport;
  `Stairs` is a `Teleporter` subclass). Collision is ENTITY-based: one
  `Tile` entity per cell whose type flips to `"Solid"` on its first
  update per `Tile.types`; Tree = a 2×2-tile footprint
  (`setHitbox(32,32,16,16)` at `+16,+16`); on a hit the sweep returns and
  the caller DISCARDS it — position pins, **velocity is NOT zeroed**.
  `getState()` is STICKY (nearest WALKABLE tile by center distance,
  assigned only on rect intersection) — v1's pure `terrainStateAt(x,y)`
  seam cannot express it and becomes a transcribed stateful resolver;
  supported v2 states = plain grounds + stairs(10)/ghost-step(30), all
  else throws (water physics is coupled to `Music.soundPosition` — v3+).
  **Queue Q3 CONFIRMED**: player list = base + `"LavaBoss"` pushed
  unconditionally in the ctor (`Player.as:359`, transcribe verbatim, inert
  outside Dungeon 7); `Tree`'s private `solids` is DEAD CODE (extends
  Entity, unused); enemy-side overrides stay v5. Also: **v2 expects ZERO
  AS3 edits** — `Bot.as` already takes `noclip` per tape and survived a
  transition in the discarded `clamp-left` recording, so the oracle is
  available on day one (slice 0 records real collision runs FIRST and the
  JS reconciles toward them); the `<player>` spawn-override caveat is
  RETIRED (no `.oel` in the repo contains one); a recon-sweep claim that
  the 1-px loop skips sub-pixel moves was REFUTED (`0 < 0.8` executes —
  v1's bit-exact friction tails already proved it).
- **v2 COMPLETE — SLICES 0–5 SHIPPED + PUSHED 2026-07-30**
  (`e923c627c`, `a8fcaab43`, `0abd47259`, `e5bc7b612`, `b54c72d78`,
  `240f03aab`, plus the as-built doc commits). The kickoff moved to
  `CC/docs/plans/seedling-bot-v2-opus-kickoff.md`; **its §7–§13 are the
  AS-BUILT record and correct §1–§6 in several places — read those, not
  the brief.** The doc is
  `docs/json/developer/procgen/seedling-bot.md`, now extended to v2.
  - **Eleven fixtures, all oracle recordings, all EXACT** — 1084 ticks /
    1095 observations / 4 transition records, bit for bit. The v1 five
    stayed byte-identical throughout, and the prediction held: **zero AS3
    edits for the whole rung.**
  - Landed: `levelWorld.js` (the `loadlevel` subset over the committed
    extract), `playerPhysicsV2.js` (sweeps re-armed + the stateful sticky
    terrain resolver + the world swap), `levelSource.js`/`levelRun.js`
    (the level is INJECTED, never loaded; one swap, two callers),
    `botDriverV2.js` (A\* + caller-named cross-level legs), and the
    `transitions` contract in `tapeFormat.js`.
  - **The `transitions` field is DERIVED at RECORD time** — `botDrain`
    hardcodes `[]`, so one `deriveTransitions` is applied by the harness on
    both paths, the JS side derives from its OWN world swap, and the
    harness checks the game's field is still empty so a future build
    reporting it for real is a named failure.
  - ⚠ **The controller is 45°-then-axis, not straight-line** — §3.4's
    "smooth while the straight segment stays clear" put a fixture in the
    lake. Both axes accelerate by the same quantum under vector friction.
  - ⚠ **Five model properties are bounded vacuities** (stickiness, the
    latch, terrain reset on a swap, the driver's teleporter policy, the
    executor's hit-throw): mutating them kills hand-derived cases and NO
    fixture, because levels 0 and 94 are too benign. Witnesses named in the
    doc; **all of them are blocked by the same class table**, not by the
    baked-in boot — cross-level walking from level 0 reaches exactly ONE
    other level, 94.
  - **NEXT (v3) is gated on entity semantics.** 3/116 levels build; 115
    unclassified tags; classifying the top 20 gets you 27 levels. Sizing
    table in kickoff §13.
- **THE LADDER ABOVE v2 IS RESTRUCTURED — SUBTRACTIVE, not additive
  (user correction + 4 rulings, Fable design session 2026-07-31).** The
  additive v3/v4/v5 sequence below was never the intended plan. The intended
  one: disable collision/damage/hazards so the whole map is freely walkable,
  generate a full playthrough that reaches all the items, then reintroduce
  ONE obstacle type per rung until the full game is beatable — end-to-end
  coverage first, every rung a full playthrough, progress measured in "what
  still blocks us". Plan: `NewDocs/plans/seedling-bot-subtractive-plan.md`;
  rung-0 kickoff: `NewDocs/plans/seedling-bot-r0-opus-kickoff.md` (both →
  `CC/docs/plans/` at implementation start). Rulings (user 2026-07-31):
  (1) rung 1 relaxes noclip + noDamage + noHazards, ALL mirrored exactly in
  JS — the exact differential holds end-to-end, R1 is not a reconnaissance
  artifact; (2) ONE AS3 batch (first since v1): dialogue auto-advance on
  dead frames (walked-over special pickups otherwise DEADLOCK the tape —
  dismissal is `Input.released` during frozen frames), item/win readout in
  `botStatus` (the acceptance signal; win = the Seed's `Game.cutscene[]`/
  `menu` statics), `Bot.noDamage` (enemy contact is a KNOCKBACK — position
  divergence, not just damage), parameterised boot, `Bot.noHazards`
  (coerce consumed terrain state at one choke point), tape-driven grants;
  (3) removal order cheapest-machinery-first, invariant: after each rung
  the full item walk is still completable with what is modelled; (4) items
  are GRANTED ON REACHING THEIR ROOM for now (walk must physically reach
  all 13 non-combat item rooms; real collection is its own later rung —
  12 walk-over pickups + darksword from the Witch needing `hasWand`; only
  `fire` is combat-gated, a BobBoss drop). The class-table gate (§13)
  now prices R2 (solids return), not the next rung — R0/R1 escape it by
  relaxing `buildLevelWorld` BY ROLE (blocking / trigger / pickup /
  proximity-hazard / ignorable; census wider than fixture levels for the
  graph-defining roles). The five bounded vacuities' witnesses become
  reachable at R1.

- [x] Seedling v1: collision fully disabled, move to targets
      — **COMPLETE 2026-07-30** (all 5 slices). Doc:
        `docs/json/developer/procgen/seedling-bot.md`
- [x] v2: wall collision + pathing
      — **COMPLETE 2026-07-30** (all 6 slices; see below). Doc: the same
        one, now extended to v2.
- [ ] R0: acceptance signal + machinery (AS3 batch, tape v2, role-relaxed
      builder, witness mini-walk) — kickoff ready
- [ ] R1: the relaxed full walk — 13 items granted room-by-room, exactly
      differentially verified end-to-end
- [ ] R2: solids return (noclip off) — pays the blocking-role class table
      (sizing: v2 kickoff §13) + pixelmask extraction; interactive blockers
      bridged by named persistence grants
- [ ] R3: interactions + real collection (item use, rocks/ropes, locks;
      grants retired) — absorbs old v3/v4's item-gate + puzzle scope
- [ ] R4: hazards return (noHazards off): pits, water/swim (⚠ sound-stub
      recon decides exactness), lava, ice
- [ ] R5: enemies return (noDamage off) — `fire` from BobBoss → 14/14
      (old v5)
- [ ] R6: bosses + the ending — terminal win assertion live, zero crutches
      = the real-game beatability proof
- [ ] ~~RWK bot~~ — inherits Phase 7's indefinite postponement (2026-07-28)

### Deferred / adjacent (not this plan)
- **Seedling JS-port substrate** (ruled 2026-07-29; sequencing amended
  2026-07-30, Phase 8 section above): no longer strictly AFTER the bot slice —
  the port grows incrementally, per ladder stage, as each stage's JS-first
  iteration surface; the full SUBSTRATE (generated worlds with real Seedling
  physics, suite-runnable puzzle/enemy surfaces) remains its own later arc.
  MIT so fully committable; anchored by differential tapes against the wasm
  game
- Tilemap Platformer substrate (JS clone of RWK reusing runner code; tile
  map read from the user's SWF at runtime, never distributed) — if revived,
  the Seedling port above is its precedent and template
- Any-shape filler substrate for gap-free packing
- Shipped panel presets that bundle a rules.json + sphere-log reference
  ("load vanilla <game>, ready to edit" one-click), per the 2026-07-26
  top-down/preset discussion
