# Generic Pathfinding Tools for WorldGen Worlds

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

### Phase 1: Infrastructure (Week 1)

**Files to create/modify:**

1. **`rule_builder/pathfinding.py`** (NEW)
   - `EntranceChainChecker` class
   - `HypotheticalStateEvaluator` class
   - `PathFinder` class with BFS implementation

2. **`world_generator/rule_codegen.py`**
   - Add code generation for new rule types
   - Generate pathfinding helper imports

3. **`frontend/schema/rules.schema.json`**
   - Add schema definitions for new rule types

**Deliverables:**
- [ ] Basic pathfinding infrastructure in Python
- [ ] Schema definitions for new rule types
- [ ] Unit tests for pathfinding tools

### Phase 2: ALttP Integration (Week 2)

**Files to modify:**

1. **`exporter/games/alttp.py`**
   - Export bunny rules using new pathfinding format instead of simplifying
   - Add region type metadata (is_light_world, is_dark_world, is_dungeon)
   - Export entrance metadata (bunny_passable, etc.)

2. **`worlds/alttp/Rules.py`** (reference only)
   - Document how original bunny rules map to new format

**Deliverables:**
- [ ] ALttP exporter uses pathfinding rules for bunny logic
- [ ] UT fuzz tests pass at higher rate
- [ ] Documentation of bunny rule mapping

### Phase 3: WorldGen World Support (Week 3)

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

### Phase 4: Frontend Support (Week 4)

**Files to modify:**

1. **`frontend/src/rule-evaluator.ts`** (or equivalent)
   - JavaScript implementation of pathfinding rules
   - BFS pathfinding for entrance chains

2. **`frontend/src/types/rules.ts`**
   - TypeScript types for pathfinding rules

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

1. **ALttP UT fuzz tests**: Pass rate increases from ~30% to >80%
2. **Performance**: Rule evaluation <10ms per location
3. **Test coverage**: >90% coverage of pathfinding code
4. **Documentation**: All new rule types documented with examples

## Open Questions

1. Should pathfinding cache results per sweep, or evaluate fresh each time?
2. How to handle dynamic entrances (entrance randomizer)?
3. Should we support custom pathfinding conditions per game, or standardize?
4. How to visualize pathfinding in the tracker explain tool?

## References

- ALttP Rules.py: `worlds/alttp/Rules.py` (lines 1653-1783)
- ALttP UnderworldGlitchRules.py: `worlds/alttp/UnderworldGlitchRules.py`
- ALttP OverworldGlitchRules.py: `worlds/alttp/OverworldGlitchRules.py`
- Rule Builder: `rule_builder/`
- World Generator: `world_generator/`
