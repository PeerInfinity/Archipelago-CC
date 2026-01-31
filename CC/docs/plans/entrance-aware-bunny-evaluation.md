# Entrance-Aware Bunny Rule Evaluation

## Overview

This document outlines the implementation plan for entrance-aware bunny rule evaluation in the worldgen, specifically addressing the Superbunny Cave logic mismatch issues discovered during UT fuzzer testing.

**Status**: Planning
**Priority**: High
**Complexity**: Medium-High
**Date**: 2026-01-31
**Related**: `CC/docs/plans/bunny-rule-extraction-options.md`

## Problem Statement

### Current Issue

The ALttP UT fuzzer tests fail for Superbunny Cave locations in glitch modes with entrance shuffle. The root cause:

1. **Bunny rules use path-based BFS logic** at generation time (`worlds/alttp/Rules.py:1653-1783`)
2. **Exported rules are oversimplified** - `And(CanReachEntrance(...), Magic Mirror)` doesn't capture the path context
3. **CanReachEntrance only checks source reachability** - doesn't verify the path is actually valid for bunny access

### Example Failure (Seed 168)

Original exported rule for Superbunny Cave - Top:
```json
{"rule": "Or", "children": [
  {"rule": "And", "children": [
    {"rule": "CanReachEntrance", "args": {"entrance_name": "Palace of Darkness Hint"}},
    {"rule": "Has", "args": {"item_name": "Magic Mirror"}}
  ]},
  {"rule": "CanReachEntrance", "args": {"entrance_name": "Palace of Darkness Hint"}},  // BUG: standalone
  {"rule": "Has", "args": {"item_name": "Moon Pearl"}}
]}
```

Problems:
1. Standalone `CanReachEntrance` (without Mirror) is too permissive
2. `And(CanReachEntrance, Mirror)` doesn't capture the actual path requirements
3. The UT thinks locations are accessible when the server says they're not

### Current Workaround

`exporter/games/official/alttp.py` post-processing removes CanReachEntrance options for Superbunny Cave, requiring Moon Pearl only. This trades false negatives for avoiding false positives.

## Solution Overview

### Primary Approach: Pre-compute Path Requirements (Option 2)

Instead of trying to analyze the complex bunny rule closures, pre-compute which paths are valid at export time and export simplified path requirements.

**Key Insight**: At export time, we have access to:
- The actual entrance shuffle state
- The closure variables containing entrance/path data
- The ability to evaluate what items each path requires

### Alternative Approach: Enhanced CanReachEntrance (Option 1)

Add destination awareness to CanReachEntrance so it verifies the entrance actually leads somewhere useful.

---

## Option 2: Pre-compute Path Requirements (Recommended)

### Concept

During export, extract path data from bunny rule closures and pre-compute which item combinations make each path viable. Export this as a new rule type that the worldgen can evaluate.

### Output Format

```json
{
  "rule": "BunnyPaths",
  "location": "Superbunny Cave - Top",
  "options": [
    {
      "type": "path",
      "via_entrance": "Palace of Darkness Hint",
      "via_region": "East Dark World",
      "requires": ["Magic Mirror"],
      "is_superbunny": true
    },
    {
      "type": "direct",
      "requires": ["Moon Pearl"]
    }
  ]
}
```

### Implementation Phases

#### Phase 1: Extract Path Data from Closures (4-6 hours)

**File**: `exporter/analyzer/closure_function_analyzer.py`

Add method to extract raw path data without deep analysis:

```python
def extract_bunny_path_data(self, func: Callable) -> Optional[Dict[str, Any]]:
    """Extract entrance/path data from bunny rule closures.

    Instead of analyzing the rule code, directly extract:
    - entrance objects from path_to_access_rule closures
    - the path list of access rule functions
    - item constants from bytecode

    Returns:
        Dict with 'paths' list containing entrance info and requirements,
        or None if not a recognizable bunny rule pattern.
    """
    closure_vars = self._extract_closure_vars(func)

    # Pattern: options_to_access_rule - has 'options' list
    if 'options' not in closure_vars:
        return None

    options = closure_vars['options']
    extracted_paths = []

    for option_func in options:
        if not callable(option_func):
            continue

        path_data = self._extract_single_path(option_func)
        if path_data:
            extracted_paths.append(path_data)

    if not extracted_paths:
        return None

    return {
        'rule': 'BunnyPaths',
        'options': extracted_paths
    }

def _extract_single_path(self, func: Callable) -> Optional[Dict[str, Any]]:
    """Extract data from a single path_to_access_rule closure."""
    closure_vars = self._extract_closure_vars(func)

    # Must have 'entrance' and 'path' from path_to_access_rule
    if 'entrance' not in closure_vars:
        return None

    entrance = closure_vars['entrance']
    path_rules = closure_vars.get('path', [])

    # Extract entrance info
    entrance_name = getattr(entrance, 'name', None)
    parent_region = None
    if hasattr(entrance, 'parent_region') and entrance.parent_region:
        parent_region = entrance.parent_region.name

    # Extract required items from path rules
    required_items = self._extract_path_item_requirements(path_rules)

    # Check if this is a superbunny mirror path (has Magic Mirror in path)
    is_mirror_path = 'Magic Mirror' in required_items

    return {
        'type': 'path',
        'via_entrance': entrance_name,
        'via_region': parent_region,
        'requires': required_items,
        'is_superbunny': is_mirror_path
    }

def _extract_path_item_requirements(self, path_rules: List) -> List[str]:
    """Extract item requirements from path rule functions."""
    items = set()

    for rule_func in path_rules:
        if not callable(rule_func):
            continue

        # Extract from bytecode constants
        if hasattr(rule_func, '__code__'):
            for const in rule_func.__code__.co_consts:
                if isinstance(const, str) and const in self.KNOWN_ITEMS:
                    items.add(const)

        # Check for nested bunny rules - if found, this path is complex
        closure = self._extract_closure_vars(rule_func)
        if 'options' in closure:
            # Nested bunny rule - path goes through another bunny region
            # This requires Moon Pearl to safely navigate
            items.add('Moon Pearl')

    return list(items)
```

#### Phase 2: ALttP Handler Integration (4-6 hours)

**File**: `exporter/games/official/alttp.py`

Integrate path extraction into `post_process_data`:

```python
def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
    """Post-process ALttP export data to fix bunny rule issues."""
    if not self._is_glitch_mode():
        return super().post_process_data(data)

    from ..analyzer.closure_function_analyzer import ClosureFunctionAnalyzer

    fixed_count = 0
    for player_id_str, player_regions in data.get('regions', {}).items():
        for region_name, region_data in player_regions.items():
            for loc_data in region_data.get('locations', []):
                loc_name = loc_data.get('name', '')

                if loc_name in SUPERBUNNY_ACCESSIBLE_LOCATIONS:
                    # Try to extract pre-computed bunny paths
                    bunny_paths = self._extract_bunny_paths(loc_name)

                    if bunny_paths:
                        loc_data['access_rule'] = bunny_paths
                        fixed_count += 1
                    else:
                        # Fallback: use Moon Pearl only
                        loc_data['access_rule'] = {
                            'rule': 'BunnyPaths',
                            'options': [{'type': 'direct', 'requires': ['Moon Pearl']}]
                        }
                        fixed_count += 1

    logger.debug(f"ALttP post_process_data: converted {fixed_count} bunny rules to BunnyPaths")
    return super().post_process_data(data)

def _extract_bunny_paths(self, location_name: str) -> Optional[Dict[str, Any]]:
    """Extract pre-computed bunny paths for a location."""
    if not self.world:
        return None

    try:
        location = self.world.get_location(location_name)
    except KeyError:
        return None

    if not callable(location.access_rule):
        return None

    # Use the closure analyzer to extract path data
    analyzer = ClosureFunctionAnalyzer(self.world)
    path_data = analyzer.extract_bunny_path_data(location.access_rule)

    if path_data:
        # Add Moon Pearl as direct option if not already present
        has_moon_pearl = any(
            opt.get('type') == 'direct' and 'Moon Pearl' in opt.get('requires', [])
            for opt in path_data.get('options', [])
        )
        if not has_moon_pearl:
            path_data['options'].append({
                'type': 'direct',
                'requires': ['Moon Pearl']
            })

    return path_data
```

#### Phase 3: BunnyPaths Rule Type (4-6 hours)

**File**: `rule_builder/rules.py`

Add new rule type for evaluating pre-computed bunny paths:

```python
@dataclasses.dataclass()
class BunnyPaths(Rule[TWorld], game="Archipelago"):
    """A rule that checks multiple pre-computed bunny access paths.

    This rule is generated during ALttP export for superbunny-accessible locations
    in glitch modes. It contains a list of path options, each with:
    - type: 'path' (via entrance) or 'direct' (item-only)
    - via_entrance: entrance name (for path type)
    - via_region: source region of entrance (for path type)
    - requires: list of required items

    The rule succeeds if ANY path option is satisfied.
    """

    options: List[Dict[str, Any]] = dataclasses.field(default_factory=list)
    """List of path options, each with type, entrance info, and requirements"""

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        # Pre-resolve entrance lookups
        resolved_options = []
        for opt in self.options:
            resolved_opt = dict(opt)
            if opt.get('type') == 'path' and opt.get('via_entrance'):
                try:
                    entrance = world.get_entrance(opt['via_entrance'])
                    resolved_opt['_entrance_exists'] = True
                    resolved_opt['_parent_region'] = entrance.parent_region.name if entrance.parent_region else None
                except KeyError:
                    resolved_opt['_entrance_exists'] = False
            resolved_options.append(resolved_opt)

        return self.Resolved(
            resolved_options,
            player=world.player,
            caching_enabled=world.rule_caching_enabled,
        )

    @classmethod
    def from_dict(cls, data: Mapping[str, Any], world_cls: type) -> "BunnyPaths":
        options = data.get('options', data.get('args', {}).get('options', []))
        return cls(options=options)

    class Resolved(Rule.Resolved):
        options: List[Dict[str, Any]]

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            """Check if any path option is satisfied."""
            for opt in self.options:
                if self._check_option(opt, state):
                    return True
            return False

        def _check_option(self, opt: Dict[str, Any], state: CollectionState) -> bool:
            """Check if a single path option is satisfied."""
            opt_type = opt.get('type', 'direct')
            requires = opt.get('requires', [])

            # Check required items
            for item in requires:
                if not state.has(item, self.player):
                    return False

            # For path type, also check entrance reachability
            if opt_type == 'path':
                entrance_name = opt.get('via_entrance')
                if not entrance_name:
                    return False

                # Skip if entrance doesn't exist
                if not opt.get('_entrance_exists', True):
                    return False

                # Check if entrance is reachable
                try:
                    if not state.can_reach_entrance(entrance_name, self.player):
                        return False
                except KeyError:
                    return False

            return True

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            deps = {}
            for opt in self.options:
                for item in opt.get('requires', []):
                    if item not in deps:
                        deps[item] = set()
                    deps[item].add(id(self))
            return deps

        @override
        def entrance_dependencies(self) -> dict[str, set[int]]:
            deps = {}
            for opt in self.options:
                if opt.get('type') == 'path':
                    entrance = opt.get('via_entrance')
                    if entrance:
                        if entrance not in deps:
                            deps[entrance] = set()
                        deps[entrance].add(id(self))
            return deps

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            if state is None:
                paths = [self._describe_option(opt) for opt in self.options]
                return f"BunnyPaths({' OR '.join(paths)})"

            for opt in self.options:
                if self._check_option(opt, state):
                    return f"Satisfied via {self._describe_option(opt)}"

            return "No bunny path available"

        def _describe_option(self, opt: Dict[str, Any]) -> str:
            if opt.get('type') == 'direct':
                return f"direct({','.join(opt.get('requires', []))})"
            else:
                entrance = opt.get('via_entrance', '?')
                items = ','.join(opt.get('requires', []))
                return f"path({entrance}: {items})"

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"options": self.options}
```

#### Phase 4: World Generator Support (2-4 hours)

**File**: `world_generator/code_generator.py`

Add code generation for BunnyPaths rule:

```python
def _generate_bunny_paths_rule(self, rule_data: Dict[str, Any]) -> str:
    """Generate code for BunnyPaths rule."""
    options = rule_data.get('options', [])

    # Build option list
    option_strs = []
    for opt in options:
        opt_dict = {
            'type': repr(opt.get('type', 'direct')),
            'requires': repr(opt.get('requires', [])),
        }
        if opt.get('type') == 'path':
            opt_dict['via_entrance'] = repr(opt.get('via_entrance'))
            if opt.get('via_region'):
                opt_dict['via_region'] = repr(opt.get('via_region'))

        items = ', '.join(f'{k}: {v}' for k, v in opt_dict.items())
        option_strs.append(f'{{{items}}}')

    return f"BunnyPaths(options=[{', '.join(option_strs)}])"
```

#### Phase 5: AST Format Support (2-4 hours)

**File**: `rule_builder/ast_format.py`

Add AST format parsing for BunnyPaths:

```python
def _parse_bunny_paths(data: Dict[str, Any], world_cls: type) -> Rule:
    """Parse BunnyPaths rule from AST format."""
    from rule_builder.rules import BunnyPaths

    options = data.get('options', [])
    return BunnyPaths(options=options)

# Add to AST_TYPE_HANDLERS
AST_TYPE_HANDLERS['bunny_paths'] = _parse_bunny_paths
```

#### Phase 6: Testing (4-8 hours)

1. **Unit tests** for BunnyPaths rule evaluation
2. **Integration tests** for path extraction
3. **Fuzzer tests** for Superbunny Cave locations
4. **Regression tests** for other ALttP configurations

### Success Criteria

1. Seed 168 passes (Superbunny Cave logic mismatch fixed)
2. Overall ALttP fuzzer pass rate improves from ~74% to >85%
3. No regressions in non-glitch mode configurations
4. Export time remains under 2x baseline

### Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Path extraction | 4-6 hours |
| Phase 2: ALttP integration | 4-6 hours |
| Phase 3: BunnyPaths rule | 4-6 hours |
| Phase 4: World generator | 2-4 hours |
| Phase 5: AST format | 2-4 hours |
| Phase 6: Testing | 4-8 hours |
| **Total** | **20-34 hours** |

---

## Option 1: Enhanced CanReachEntrance (Alternative)

### Concept

Extend `CanReachEntrance` to verify that the entrance leads to a useful destination, not just that you can reach the entrance source.

### Implementation

**File**: `rule_builder/rules.py`

```python
@dataclasses.dataclass()
class CanReachEntranceAndDestination(Rule[TWorld], game="Archipelago"):
    """A rule that checks if an entrance is reachable AND its destination is useful.

    Unlike CanReachEntrance which only checks if you can reach the entrance's source,
    this also verifies the connected_region is reachable (for bunny path validation).
    """

    entrance_name: str
    """The name of the entrance to check"""

    destination_must_reach: str = ""
    """Optional: specific region that must be reachable via this entrance"""

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        entrance = world.get_entrance(self.entrance_name)

        parent_region = entrance.parent_region.name if entrance.parent_region else ""
        connected_region = entrance.connected_region.name if entrance.connected_region else ""

        return self.Resolved(
            self.entrance_name,
            parent_region,
            connected_region,
            self.destination_must_reach or connected_region,
            player=world.player,
            caching_enabled=world.rule_caching_enabled,
        )

    class Resolved(Rule.Resolved):
        entrance_name: str
        parent_region_name: str
        connected_region_name: str
        destination_must_reach: str

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            # First check: can reach the entrance
            try:
                if not state.can_reach_entrance(self.entrance_name, self.player):
                    return False
            except KeyError:
                return False

            # Second check: can the destination region be reached
            # (This validates the path is actually useful)
            if self.destination_must_reach:
                try:
                    if not state.can_reach_region(self.destination_must_reach, self.player):
                        return False
                except KeyError:
                    return False

            return True
```

### Usage in Export

```python
# Instead of:
{"rule": "And", "children": [
    {"rule": "CanReachEntrance", "args": {"entrance_name": "Palace of Darkness Hint"}},
    {"rule": "Has", "args": {"item_name": "Magic Mirror"}}
]}

# Export:
{"rule": "And", "children": [
    {"rule": "CanReachEntranceAndDestination", "args": {
        "entrance_name": "Palace of Darkness Hint",
        "destination_must_reach": "Superbunny Cave (Bottom)"
    }},
    {"rule": "Has", "args": {"item_name": "Magic Mirror"}}
]}
```

### Pros/Cons

**Pros:**
- Simpler implementation than Option 2
- Works with existing rule structure
- Validates destination reachability

**Cons:**
- Still doesn't capture full path requirements
- Destination reachability check may be circular (region reachable because entrance accessible)
- Less accurate than pre-computed paths

### Estimated Effort

| Task | Effort |
|------|--------|
| Implement CanReachEntranceAndDestination | 2-4 hours |
| Update exporter to use new rule | 2-4 hours |
| Testing | 2-4 hours |
| **Total** | **6-12 hours** |

---

## Comparison

| Criterion | Option 1: Enhanced CanReach | Option 2: Pre-computed Paths |
|-----------|---------------------------|------------------------------|
| **Accuracy** | Medium | High |
| **Implementation Effort** | Low (6-12h) | High (20-34h) |
| **Maintenance** | Low | Medium |
| **Handles Complex Paths** | No | Yes |
| **Handles Nested Bunny Regions** | No | Partial |
| **Export Size Impact** | Minimal | Small increase |
| **Performance** | Good | Good |

## Recommendation

**Implement Option 2 (Pre-computed Paths)** because:

1. **Higher accuracy** - Captures actual path requirements from the generated world
2. **Handles complex cases** - Works for nested bunny regions and entrance shuffle
3. **Future-proof** - Can be extended to handle more complex bunny logic
4. **Cleaner abstraction** - BunnyPaths rule clearly represents the bunny access pattern

Option 1 can be considered as a quick interim fix if Option 2 takes longer than expected.

## Files to Modify

| File | Changes |
|------|---------|
| `exporter/analyzer/closure_function_analyzer.py` | Add `extract_bunny_path_data()` and helpers |
| `exporter/games/official/alttp.py` | Integrate path extraction in `post_process_data` |
| `rule_builder/rules.py` | Add `BunnyPaths` rule class |
| `rule_builder/ast_format.py` | Add `bunny_paths` type handler |
| `world_generator/code_generator.py` | Add code generation for BunnyPaths |
| `tests/rule_builder/test_bunny_paths.py` | Unit tests for new rule |

## References

- `CC/docs/plans/bunny-rule-extraction-options.md` - Previous optimization work
- `worlds/alttp/Rules.py:1653-1783` - Original `set_bunny_rules()` implementation
- `exporter/analyzer/closure_function_analyzer.py` - Existing closure analysis
- `worlds/alttp/OverworldGlitchRules.py` - Superbunny accessible locations list
