# Universal Graph Mode for Proof Modules

**Date**: 2026-03-05
**Status**: Planning

---

## 1. Goal

Make the Proof Queue and Proof Graph panels work for all games, not just MetaMath and DepGraph. MetaMath games use proof mode (existing behavior). Everything else uses DepGraph/graph mode with a synthetic `graph_structure` built from the game's rules data.

---

## 2. Current State

The proof modules (proofQueue, proofGraph) are already loaded for all games in `modules.json`. At runtime, they check for `proof_structure` or `graph_structure` in `slot_data` and silently do nothing if neither exists.

**Key gate functions** (all in `frontend/modules/proofShared/`):

| Function | File | Current behavior |
|----------|------|-----------------|
| `hasStructureData(slotData)` | `proofModuleHelpers.js` | `!!(proof_structure \|\| graph_structure)` |
| `hasProofStructure()` | `proofUIHelpers.js` | Same check via stateManager |
| `getStructureType()` | `proofUIHelpers.js` | Returns `'proof'`, `'graph'`, or `null` |
| `ensureStateLoaded(state)` | `proofUIHelpers.js` | Requires `proof_structure` or `graph_structure` |
| `initializeProofState(...)` | `proofModuleHelpers.js` | Calls `loadFromSlotData` which calls `_parseProofStructure` |

**Core parser**: `ProofBaseState._parseProofStructure()` in `proofBaseState.js` requires an actual `proof_structure` or `graph_structure` object to iterate over. It handles missing optional fields (`title`, `starting_nodes`, per-node `full_text`, etc.) gracefully but cannot proceed without the structure object itself.

### Experimental validation

We tried simply relaxing the gate functions to allow all games through. Result: the modules activate but `_parseProofStructure` returns `false` (no structure to parse), and the panels show "No proof or graph structure found." This confirms a synthetic graph must be constructed.

---

## 3. Available Data in Rules Files

Every rules.json contains rich dependency information:

### Regions (`regions[playerId]`)
- Dict of region objects keyed by name
- Each region has `locations` (list) and `exits` (list)
- Exits have `connected_region` and `access_rule`
- Locations have `access_rule` and placed `item`

### Access Rules (recursive tree structure)
- `True_` — always accessible
- `Has` — requires a specific item (`{rule: "Has", args: {item_name: "Hammer"}}`)
- `HasAll` — requires multiple items
- `HasGroup` — requires any item from a group
- `CanReachLocation` — requires access to another location
- `And` / `Or` — composite rules with `children` array
- Helper references — named predicates defined in the `helpers` section

### Items (`items[playerId]`)
- Dict of item objects with `name`, `classification`, `groups`, `type`
- Classifications indicate progression relevance

### Additional
- `helpers` — AST-like function definitions that resolve to boolean predicates
- `item_groups` — named groups of items (e.g., "Bottles", "Swords")
- `progression_mapping` — progressive item upgrade chains
- `slot_data` — game-specific settings (always present except for a few legacy games like Adventure)

### Edge case: games without `slot_data`
Adventure (and potentially other legacy presets) has no `slot_data` at all. The gate functions should continue returning false for these.

---

## 4. Design: Synthesizing `graph_structure`

### Option A: Location-centric graph

Each location becomes a node. Dependencies come from access rules.

```
Node per location:
  label: location name
  expression: access rule summary (e.g., "Requires: Hammer, Hookshot")
  dependencies: [indices of locations whose items are needed]
  full_text: region name, placed item info
```

**Pros**: Direct mapping from existing data, every game has locations.
**Cons**: Large graphs (ALttP has 200+ locations), many nodes with trivial `True_` access rules (no dependencies), access rules reference items not locations (indirection needed).

### Option B: Item-centric graph

Each progression item becomes a node. Dependencies are the items needed to reach the location that contains this item.

```
Node per progression item:
  label: item name
  expression: "Found at: [location name]"
  dependencies: [indices of items required by the location's access rule]
  full_text: location details, region info
```

**Pros**: Smaller graphs (only progression items), cleaner dependency chains, closer to how players think about progression.
**Cons**: Requires resolving canonical placements (seed 1 has these), items at `True_` locations have no dependencies (graph roots), composite rules (Or/And) need flattening.

### Option C: Region-centric graph

Each region becomes a node. Dependencies come from exit access rules.

```
Node per region:
  label: region name
  expression: "Locations: N, Exits: M"
  dependencies: [indices of regions whose exits lead here, filtered by access rules]
  full_text: list of locations in region
```

**Pros**: Smallest graphs, natural geographic representation.
**Cons**: Many games have flat region structures (Short Hike has 2 regions), loses location-level detail.

### Recommended: Option B (item-centric) with fallback to Option A

Item-centric graphs are the most interesting for gameplay — they show the player's progression path. Fall back to location-centric for games where canonical placements aren't available or item count is too low.

---

## 5. Implementation Plan

### Phase 1: Graph synthesizer module

Create `frontend/modules/proofShared/graphSynthesizer.js`:

1. **Input**: stateManager static data (regions, items, rules, helpers, canonical_placements)
2. **Output**: A `graph_structure` object compatible with `_parseProofStructure`
3. **Rule flattening**: Walk access rule trees to extract item dependencies
   - `Has` → single item dependency
   - `HasAll` → multiple item dependencies
   - `And` → union of children's dependencies
   - `Or` → pick the simplest child (fewest deps) or create an "any of" annotation
   - Helper references → resolve by looking up helper definitions, or treat as opaque
4. **Node construction**: Build numbered node entries with `label`, `expression`, `dependencies`, `full_text`
5. **Starting nodes**: Items/locations with `True_` access rules (no dependencies)
6. **Title**: Use `game_name` from rules data

### Phase 2: Gate function changes

Update the four gate functions (as prototyped in our experiment):
- `hasStructureData` → `!!slotData`
- `hasProofStructure` → `!!playerWorld?.slot_data`
- `getStructureType` → `'proof'` for MetaMath, `'graph'` for all else
- `ensureStateLoaded` → try native structure first, fall back to synthesizer

### Phase 3: Integration with `_parseProofStructure`

Two options:
- **A**: Synthesizer produces a `graph_structure` object, inject it into `slotData` before parsing → minimal changes to existing parser
- **B**: New `loadFromSynthesizedGraph()` method on ProofBaseState → cleaner separation but more code

Option A is simpler and reuses all existing naming/parsing logic.

### Phase 4: UI adjustments

- Status messages should reflect that it's a synthesized view ("Game Dependency Graph" vs "Proof Graph")
- Consider a toggle or info note indicating the graph is derived from access rules
- Handle very large graphs (100+ nodes): filtering, search, collapsing regions

---

## 6. Challenges

### Helper resolution
Helpers are AST-like structures, not simple rule trees. Full resolution requires interpreting `if_statement`, `assign`, `compare`, `call` nodes. For v1, treat unresolved helpers as opaque dependencies (node with unknown requirements).

### Or-rules
`Or(Has("Hookshot"), Has("Pegasus Boots"))` — which dependency do we pick? Options:
- Show all alternatives as annotations
- Pick the shortest path (fewest deps)
- Create a virtual "choice" node

### Progressive items
`Progressive Sword` maps to `Fighter Sword` → `Master Sword` → `Tempered Sword` → `Golden Sword`. The graph should show the progression chain, not 4 independent nodes.

### Graph size
ALttP has 163 items and 200+ locations. The Cytoscape graph panel may struggle with very large graphs. Consider:
- Only showing progression items
- Collapsible region clusters
- A "zoom level" setting (regions → items → locations)

---

## 7. Files to Modify

| File | Change |
|------|--------|
| `frontend/modules/proofShared/graphSynthesizer.js` | **New** — synthesize graph_structure from rules data |
| `frontend/modules/proofShared/proofModuleHelpers.js` | Relax `hasStructureData`, update `initializeProofState` to try synthesis |
| `frontend/modules/proofShared/proofUIHelpers.js` | Relax `hasProofStructure`, `getStructureType`, `ensureStateLoaded` |
| `frontend/modules/proofQueue/proofQueueUI.js` | Fallback UI for synthesis failure |
| `frontend/modules/proofGraph/proofGraphUI.js` | Fallback UI for synthesis failure, large graph handling |
| `frontend/modules/proofShared/proofBaseState.js` | Possibly extend `_parseProofStructure` for synthesized data |
