# Region Atlas: Real-Game Maps as Procgen Regions

**Date:** 2026-07-26 (Phases 1–4 shipped 2026-07-27, Phase 5a 2026-07-28)
**Status:** Design ruled; Phase 1 (atlas format), Phase 2 (marking tool),
Phase 3 (vanilla rules.json projection), Phase 4 (play-time transitions — the
real game walks between atlas regions) and Phase 5a (the reachability analyzer —
sub-region splits and their rules are computed from the tile map) complete —
Phase 5b (maze projection) or Phase 6 (sphere growth) next
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

**Acceptance on real data:** the starter atlas gained `dungeon1_room1` (level 3,
closing the `descent` exit that was on the growth list) and every region now
carries computed rules. `overworld_start` → 6 sub-regions, `mixed` (water,
breakable rocks, an asymmetric waterfall, and one building crossing left for
hand authoring); `dungeon1_room1` → 2 sub-regions, `analyzer` (a breakable rock
walls off the stairs down); `starting_house` and `owls_nest_entrance` → no
split, asserted rather than skipped, with the subgraph correctly OMITTED. The
compiled preset regenerated to 11 AP regions / 23 exits, and the end-to-end
verifier still walks the real game between them.

### Phase 5b — Maze-mode substrate projection (deferred here from 5a, ruling 4)
- [ ] Project an atlas region's analyzed grid into the maze substrate, so a
      marked region is playable without the original engine

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
