# Generic Pathfinding Tools for WorldGen Worlds

## Current Status (Updated 2026-01-20)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Infrastructure | **Complete** | `rule_builder/pathfinding.py` implemented, but no unit tests or schema updates |
| Phase 2: ALttP Integration | **Different Approach** | ALttP exporter uses simplified rules + metadata, not generic pathfinding tools |
| Phase 3: WorldGen Support | Not Started | `rule_codegen.py` has no pathfinding support |
| Phase 4: Frontend Support | Not Started | `ruleEngine.js` has no pathfinding rule types |

**Key Finding**: The pathfinding infrastructure exists but is not connected to the ALttP export pipeline. ALttP bunny rules are handled via simplified replacement rules with metadata export, not the generic pathfinding tools.

---

## Overview

This document outlines the plan to implement generic pathfinding tools that enable worldgen worlds to handle complex path-dependent accessibility rules. The primary motivation is ALttP's bunny rules, but the design should be generic enough to support other games with similar requirements.

## Problem Statement

### ALttP Bunny Rules

ALttP has complex "bunny rules" that determine when Moon Pearl is required. These rules:

1. **Are path-dependent**: They check which entrance you used to reach a region
2. **Use BFS pathfinding**: They search backwards through entrance chains to find valid paths
3. **Create modified states**: `fake_pearl_state()` creates a temporary state with Moon Pearl for hypothetical checks
4. **Are option-dependent**: Different glitch modes (no_glitches, minor_glitches, overworld_glitches) enable different accessibility options

**Current Limitations:**

The exporter simplifies bunny rules to "Moon Pearl required" for most locations, which doesn't match the original server logic when:
- Glitch modes are enabled (superbunny accessibility)
- Inverted mode changes bunny/link regions
- Complex entrance paths allow access without Moon Pearl

### Other Games with Similar Patterns

| Game | Pattern | Current Status |
|------|---------|----------------|
| **OoT** | Age-based state modification, time-of-day paths | Not exported |
| **TWW** | Region reachability with multi-conditions | Not exported |
| **Landstalker** | Path graph navigation with named routes | Not exported |
| **AHIT** | Act dependency DAG, entrance-connected checks | Exported (helper blacklisted) |
| **SM** | AccessFrom system with per-region lambdas | Exported (custom extractors) |

## Design Goals

1. **Generic API**: Tools usable by any game, not ALttP-specific
2. **JSON-serializable**: All pathfinding rules expressible in rules.json format
3. **Efficient evaluation**: Runtime performance comparable to original rules
4. **Incremental adoption**: Games can opt-in to specific tools as needed
5. **Frontend compatible**: Pathfinding evaluable in both Python (worldgen) and JavaScript (tracker)

## Proposed Tools

### Tool 1: `can_reach_via_entrance_chain`

Check if a region is reachable through a specific entrance chain pattern.

**JSON Schema:**
```json
{
  "type": "entrance_chain_check",
  "target_region": "Dark World",
  "chain_conditions": [
    {
      "entrance_pattern": "*",
      "region_condition": {"type": "item_check", "item": "Moon Pearl"}
    },
    {
      "entrance_pattern": "Superbunny Cave*",
      "region_condition": {"type": "constant", "value": true}
    }
  ],
  "default_condition": {"type": "item_check", "item": "Moon Pearl"}
}
```

**Use Case (ALttP):**
- Check if player can reach a Dark World region through an entrance that allows bunny access
- Different entrances have different requirements (some need Mirror, some need Moon Pearl)

### Tool 2: `state_with_hypothetical_item`

Create a temporary state copy with a hypothetical item for "what if" checks.

**JSON Schema:**
```json
{
  "type": "hypothetical_state_check",
  "add_items": ["Moon Pearl"],
  "check": {
    "type": "can_reach",
    "target": "Castle Courtyard",
    "reach_type": "Region"
  }
}
```

**Use Case (ALttP):**
- `fake_pearl_state()` pattern: Check if a location would be accessible with Moon Pearl
- Used in glitch logic for dungeon re-entry rules

### Tool 3: `path_exists_with_condition`

Check if any path exists from current position to target that satisfies conditions.

**JSON Schema:**
```json
{
  "type": "path_exists",
  "target": "Hyrule Castle Courtyard",
  "path_condition": {
    "type": "all_entrances_satisfy",
    "condition": {
      "type": "or",
      "conditions": [
        {"type": "item_check", "item": "Moon Pearl"},
        {"type": "entrance_has_tag", "tag": "bunny_passable"}
      ]
    }
  },
  "max_depth": 10
}
```

**Use Case (ALttP):**
- `mirrorless_path_to_castle_courtyard()`: Find if a path exists without needing mirror
- General "can I get there via route X" checks

### Tool 4: `region_type_check`

Check if a region has a specific type/property (Light World, Dark World, Dungeon, etc.).

**JSON Schema:**
```json
{
  "type": "region_type_check",
  "region": "current",
  "property": "is_dark_world"
}
```

**Use Case (ALttP):**
- `is_bunny()` / `is_link()` functions check region type based on game mode
- Inverted mode swaps which regions are bunny regions

### Tool 5: `entrance_property_check`

Check properties of the entrance used to reach current location.

**JSON Schema:**
```json
{
  "type": "entrance_property_check",
  "property": "parent_region_type",
  "expected": "light_world"
}
```

**Use Case (ALttP):**
- Check if the entrance we came through is from a bunny-safe region

## Implementation Plan

### Phase 1: Infrastructure - COMPLETE

**Files created/modified:**

1. **`rule_builder/pathfinding.py`** (CREATED)
   - `PathExistsToRegion` class - BFS pathfinding to target region
   - `HypotheticalState` class - State wrapper with hypothetical items
   - `RegionProperty` class - Region property definitions
   - `EntranceChainCondition` class - Entrance chain conditions
   - `BunnyAccessibilityCheck` class - ALttP-specific bunny rule evaluation
   - `find_paths_to_region()` - Core BFS implementation
   - `can_reach_via_bunny_path()` - ALttP bunny path checking
   - `ALTTP_REGION_PROPERTIES` - Standard ALttP region properties

2. **`world_generator/rule_codegen.py`** - NOT UPDATED
   - No code generation for pathfinding rule types added

3. **`frontend/schema/rules.schema.json`** - NOT UPDATED
   - No schema definitions for new rule types added

**Deliverables:**
- [x] Basic pathfinding infrastructure in Python
- [ ] Schema definitions for new rule types
- [ ] Unit tests for pathfinding tools

### Phase 2: ALttP Integration - DIFFERENT APPROACH TAKEN

**What was planned:**
- Export bunny rules using new pathfinding format
- Use `BunnyAccessibilityCheck` from pathfinding.py

**What was implemented:**

Instead of using the generic pathfinding tools, the ALttP exporter (`exporter/games/alttp.py`) uses a **simplified replacement approach**:

1. **Bunny rule interception** - `override_rule_analysis()` intercepts bunny rule lambdas
2. **Simplified replacement** - `_get_bunny_replacement_rule()` replaces bunny rules with:
   - `True` for locations in `BUNNY_ACCESSIBLE_LOCATIONS`
   - `True` for `MANDATORY_SUPERBUNNY_LOCATIONS` in glitch modes
   - `Moon Pearl OR Magic Mirror` for `MIRROR_SUPERBUNNY_LOCATIONS` in glitch modes
   - `Moon Pearl` for all other bunny-affected locations
3. **Metadata export** - `add_game_info()` exports bunny rule metadata for potential future use:
   - `bunny_impassable_caves`
   - `bunny_accessible_locations`
   - `mandatory_superbunny_locations`
   - `mirror_superbunny_locations`

**Rationale for different approach:**
- Simpler to implement and maintain
- Works for most common cases
- Metadata export allows future enhancement without changing rule format
- Avoids complexity of BFS pathfinding in frontend JavaScript

**Deliverables:**
- [x] ALttP exporter handles bunny rules (via simplified replacement)
- [x] Bunny rule metadata exported for future use
- [ ] ~~ALttP exporter uses pathfinding rules for bunny logic~~ (different approach)
- [ ] UT fuzz tests pass at higher rate (needs verification)
- [ ] Documentation of bunny rule mapping

### Phase 3: WorldGen World Support - NOT STARTED

**Files to modify:**

1. **`world_generator/rule_codegen.py`**
   - Generate Python code for pathfinding rules
   - Generate helper functions that use pathfinding

2. **`world_generator/templates/Rules.py.jinja2`**
   - Add imports for pathfinding tools
   - Include pathfinding helper functions

**Deliverables:**
- [ ] WorldGen worlds can use pathfinding rules
- [ ] Generated Rules.py includes pathfinding logic
- [ ] Integration tests with ALttP worldgen

### Phase 4: Frontend Support - NOT STARTED

**Files to modify:**

1. **`frontend/modules/shared/ruleEngine.js`**
   - JavaScript implementation of pathfinding rules
   - BFS pathfinding for entrance chains

2. **`frontend/modules/stateManager/core/ruleEvaluator.js`**
   - Pathfinding rule type handling

**Deliverables:**
- [ ] Tracker can evaluate pathfinding rules
- [ ] End-to-end tests with ALttP in tracker
- [ ] Performance benchmarks

### Phase 5: Other Games (Future)

Apply pathfinding tools to other games:

1. **OoT**: Age-based state modification
2. **TWW**: Region reachability checks
3. **Landstalker**: Path graph navigation

## Technical Details

### BFS Pathfinding Algorithm

```python
def find_paths_to_region(
    state: CollectionState,
    player: int,
    target_region: str,
    path_condition: Callable[[Entrance], bool],
    max_depth: int = 10
) -> List[List[Entrance]]:
    """Find all paths to target region that satisfy condition."""
    from collections import deque

    target = state.multiworld.get_region(target_region, player)
    visited = {target}
    queue = deque([(target, [])])
    valid_paths = []

    while queue:
        current, path = queue.popleft()
        if len(path) >= max_depth:
            continue

        for entrance in current.entrances:
            if entrance.parent_region in visited:
                continue

            new_path = [entrance] + path

            # Check if this entrance satisfies condition
            if path_condition(entrance):
                if entrance.access_rule is None or entrance.access_rule(state):
                    # Found a valid path
                    valid_paths.append(new_path)

            visited.add(entrance.parent_region)
            queue.append((entrance.parent_region, new_path))

    return valid_paths
```

### Hypothetical State Implementation

```python
class HypotheticalState:
    """Wrapper that adds hypothetical items to a state for "what if" checks."""

    def __init__(self, real_state: CollectionState, player: int, add_items: List[str]):
        self._real_state = real_state
        self._player = player
        self._hypothetical_items = set(add_items)

    def has(self, item: str, player: int, count: int = 1) -> bool:
        if player == self._player and item in self._hypothetical_items:
            return True
        return self._real_state.has(item, player, count)

    def can_reach(self, target: str, reach_type: str, player: int) -> bool:
        # Use real state's reachability with hypothetical items
        # This requires careful implementation to avoid infinite recursion
        pass
```

### JSON Rule Format Examples

**ALttP Bunny Rule (Current - Simplified):**
```json
{
  "type": "item_check",
  "item": "Moon Pearl"
}
```

**ALttP Bunny Rule (Proposed - Full Logic):**
```json
{
  "type": "or",
  "conditions": [
    {"type": "item_check", "item": "Moon Pearl"},
    {
      "type": "entrance_chain_check",
      "from_region_type": "light_world",
      "allow_bunny_passable": true
    },
    {
      "type": "and",
      "conditions": [
        {"type": "item_check", "item": "Magic Mirror"},
        {"type": "entrance_chain_check", "from_region_type": "dark_world"}
      ]
    }
  ]
}
```

## Risk Assessment

### High Risk
- **Performance**: BFS pathfinding on every rule check could be slow
  - Mitigation: Caching, lazy evaluation, depth limits

- **Complexity**: Pathfinding rules harder to debug than simple item checks
  - Mitigation: Comprehensive logging, explain tool support

### Medium Risk
- **Frontend parity**: JavaScript pathfinding must match Python exactly
  - Mitigation: Shared test suite, property-based testing

- **Backward compatibility**: Existing rules.json files don't have pathfinding data
  - Mitigation: Graceful fallback to simple rules

### Low Risk
- **Schema changes**: New rule types need schema updates
  - Mitigation: Additive changes only, version the schema

## Success Criteria

1. **ALttP UT fuzz tests**: Pass rate increases from ~30% to >80% (needs verification)
2. **Performance**: Rule evaluation <10ms per location
3. **Test coverage**: >90% coverage of pathfinding code
4. **Documentation**: All new rule types documented with examples

## Design Decisions

1. **Caching strategy**: Start without caching, evaluate fresh each time. Add caching later if performance requires it.

2. **Entrance randomizer**: Dynamic entrances are already resolved to static entrances during export, so no special handling is needed. The exported rules.json contains the final entrance configuration.

3. **Standardization**: Prefer universal format for pathfinding conditions. Start with custom conditions only if universal format proves too complex, then refactor to universal later.

4. **Tracker visualization**: Defer to Phase 4 (Frontend Support). The explain tool should show which paths were checked and which succeeded/failed.

5. **Simplified ALttP approach (NEW)**: Phase 2 took a simplified approach using replacement rules + metadata export instead of generic pathfinding. This trades accuracy for simplicity and can be enhanced later using the exported metadata.

## Open Questions

1. How to visualize pathfinding in the tracker explain tool? (Deferred to Phase 4)
2. Should we revisit Phase 2 to use generic pathfinding tools, or is the simplified approach sufficient?
3. What is the actual ALttP fuzz test pass rate with the current implementation?

## References

- ALttP Rules.py: `worlds/alttp/Rules.py` (lines 1653-1783)
- ALttP UnderworldGlitchRules.py: `worlds/alttp/UnderworldGlitchRules.py`
- ALttP OverworldGlitchRules.py: `worlds/alttp/OverworldGlitchRules.py`
- Rule Builder: `rule_builder/`
- Pathfinding module: `rule_builder/pathfinding.py`
- ALttP Exporter: `exporter/games/alttp.py`
- World Generator: `world_generator/`
