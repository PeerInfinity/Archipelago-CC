# World Generator: Helper Functions Implementation Plan

## Overview

This document outlines the plan to update the world generator to read "helpers" data from rules.json files and convert them into working Python helper functions in the generated world files.

## Current State

### How Helpers Work in Original World Code

Looking at the original world files:

**Undertale** (`worlds/undertale/Rules.py`):
```python
def _undertale_has_plot(state: CollectionState, player: int, item: str):
    if item == "Complete Skeleton":
        return state.has("Complete Skeleton", player)
    elif item == "Fish":
        return state.has("Fish", player)
    # ... etc
```

**shapez** (`worlds/shapez/regions.py`):
```python
def can_stack(state: CollectionState, player: int) -> bool:
    return state.has(ITEMS.stacker, player)

def has_x_belt_multiplier(state: CollectionState, player: int, needed: float) -> bool:
    multiplier = 1.0
    for _ in range(state.count(ITEMS.upgrade_rising_belt, player)):
        multiplier *= 2
    # ... complex logic
    return multiplier >= needed
```

### How Helpers are Stored in rules.json

Helpers are exported by the exporter in two formats:

**Simple helpers** (no parameters beyond state/player):
```json
"can_stack": {
    "type": "item_check",
    "item": "Stacker"
}
```

**Parameterized helpers**:
```json
"has_x_belt_multiplier": {
    "params": ["needed"],
    "body": {
        "type": "block",
        "statements": [
            {"type": "assign", "name": "multiplier", "value": {"type": "constant", "value": 1.0}},
            {"type": "for_range", "var": "_", "count": {...}, "body": [...]},
            {"type": "return", "value": {...}}
        ]
    }
}
```

### Current World Generator Limitations

The current `rule_codegen.py` returns `True_()` for:
- `helper` rule type (helper function calls)
- `not` rule type
- Many other rule types used in helper bodies

This causes many shapez rules to evaluate as `True_()` in the generated code, breaking access rules.

## Design Goals

1. **Generate Python helper functions** from rules.json helper definitions
2. **Match original world code format** as closely as possible
3. **Support all rule types** used in helper bodies
4. **Enable spoiler tests to pass** on worldgen worlds

## Implementation Plan

### Phase 1: Extract Helper Definitions

**Files to modify**: `world_generator/extractors.py`

Add extraction of helper definitions:

```python
@dataclass
class HelperData:
    """Extracted helper function data."""
    name: str
    params: List[str] = field(default_factory=list)  # Parameters (excluding state/player)
    body: Dict[str, Any] = None  # The rule body
    defaults: Dict[str, Any] = field(default_factory=dict)  # Default parameter values

def extract_helpers(json_data: Dict[str, Any]) -> Dict[str, HelperData]:
    """Extract helper function definitions from JSON."""
    helpers = {}
    helpers_data = json_data.get('helpers', {}).get('1', {})

    for helper_name, helper_def in helpers_data.items():
        if isinstance(helper_def, dict):
            if 'params' in helper_def or 'body' in helper_def:
                # Parameterized helper
                helpers[helper_name] = HelperData(
                    name=helper_name,
                    params=helper_def.get('params', []),
                    body=helper_def.get('body', helper_def),
                    defaults=helper_def.get('defaults', {})
                )
            else:
                # Simple helper - body is the helper_def itself
                helpers[helper_name] = HelperData(
                    name=helper_name,
                    body=helper_def
                )

    return helpers
```

### Phase 2: Generate Python Helper Functions

**Files to modify**: `world_generator/templates.py`, `world_generator/rule_codegen.py`

Create a new `HelperCodeGenerator` class that converts helper definitions to Python code:

```python
class HelperCodeGenerator:
    """Generates Python helper functions from rule definitions."""

    def generate_helper(self, helper: HelperData, game_name: str) -> str:
        """Generate a Python helper function."""
        # Build function signature
        params = ['state: CollectionState', 'player: int']
        params.extend(helper.params)

        func_name = f"_{sanitize_identifier(game_name).lower()}_{helper.name}"
        signature = f"def {func_name}({', '.join(params)}) -> bool:"

        # Generate function body
        body = self._generate_body(helper.body)

        return f"{signature}\n{self._indent(body)}"

    def _generate_body(self, rule: Dict[str, Any]) -> str:
        """Generate Python code for a rule body."""
        # Handle different rule types...
```

The generated helpers should follow the pattern from original worlds:

```python
def _shapez_can_stack(state: CollectionState, player: int) -> bool:
    return state.has("Stacker", player)

def _shapez_has_x_belt_multiplier(state: CollectionState, player: int, needed: float) -> bool:
    multiplier = 1.0
    for _ in range(state.count("Rising Belt Upgrade", player)):
        multiplier *= 2
    multiplier += state.count("Gigantic Belt Upgrade", player) * 10
    multiplier += state.count("Big Belt Upgrade", player)
    multiplier += state.count("Small Belt Upgrade", player) * 0.1
    return multiplier >= needed
```

### Phase 3: Extend Rule Type Support

**Files to modify**: `world_generator/rule_codegen.py`

Add support for these rule types (used in helper bodies):

| Rule Type | Python Output | Example |
|-----------|---------------|---------|
| `conditional` | Ternary or if-statement | `x if cond else y` |
| `block` | Multi-statement body | `stmt1; stmt2; return result` |
| `assign` | Variable assignment | `x = value` or `x += value` |
| `for_range` | For loop | `for _ in range(n):` |
| `return` | Return statement | `return value` |
| `binary_op` | Arithmetic | `a + b`, `a * b` |
| `subscript` | Indexing | `list[index]` |
| `attribute` | Property access | `obj.attr` |
| `function_call` | Method call | `list.index(value)` |
| `not` | Negation | `not condition` |
| `name` | Variable reference | `variable_name` |
| `compare` | Comparison | `a >= b`, `a == b` |

### Phase 4: Update Rules.py Generation

**Files to modify**: `world_generator/templates.py`

Update `generate_rules_py()` to:

1. Include helper function definitions at module level
2. Generate helper calls instead of `True_()`

Example output:

```python
"""
Access rules for shapez WorldGen.
"""
from typing import TYPE_CHECKING
from BaseClasses import CollectionState

if TYPE_CHECKING:
    from worlds.AutoWorld import World


# Helper functions
def _shapez_can_stack(state: CollectionState, player: int) -> bool:
    return state.has("Stacker", player)

def _shapez_can_cut_half(state: CollectionState, player: int) -> bool:
    return state.has("Cutter", player)

def _shapez_can_make_stitched_shape(state: CollectionState, player: int, floating: bool) -> bool:
    return (_shapez_can_stack(state, player) and
            ((state.has("Quad Cutter", player) and not floating) or
             (_shapez_can_cut_half(state, player) and _shapez_can_rotate_90(state, player))))

# ...more helpers...


def set_rules(world: "World") -> None:
    """Set access rules for all locations and entrances."""
    player = world.player
    multiworld = world.multiworld

    # Entrance rules
    multiworld.get_entrance("Stacking shapes", player).access_rule = \
        lambda state: _shapez_can_stack(state, player)

    multiworld.get_entrance("Building a MAM", player).access_rule = \
        lambda state: _shapez_can_build_mam(state, player, False)  # floating=False
```

### Phase 5: Update Helper Call Generation

**Files to modify**: `world_generator/rule_codegen.py`

When encountering a `helper` rule type, generate a call to the helper function:

```python
def _convert_helper(self, rule: Dict[str, Any]) -> str:
    """Convert helper rule to function call."""
    name = rule.get('name', '')
    args = rule.get('args', [])

    # Generate function name
    func_name = f"_{self.game_name_lower}_{name}"

    # Convert arguments
    arg_strs = ['state', 'player']
    for arg in args:
        arg_strs.append(self._convert_rule(arg))

    return f"{func_name}({', '.join(arg_strs)})"
```

## Rule Type Implementation Details

### `block` - Multi-statement Body

```json
{"type": "block", "statements": [...]}
```

```python
def _generate_block(self, statements: List[Dict]) -> str:
    lines = []
    for stmt in statements:
        lines.append(self._generate_statement(stmt))
    return '\n'.join(lines)
```

### `assign` - Variable Assignment

```json
{"type": "assign", "name": "x", "value": {...}}
{"type": "assign", "name": "x", "op": "+=", "value": {...}}
```

```python
def _generate_assign(self, rule: Dict) -> str:
    name = rule['name']
    value = self._generate_expression(rule['value'])
    op = rule.get('op', '=')
    return f"{name} {op} {value}"
```

### `for_range` - Range Loop

```json
{"type": "for_range", "var": "_", "count": {...}, "body": [...]}
```

```python
def _generate_for_range(self, rule: Dict) -> str:
    var = rule['var']
    count = self._generate_expression(rule['count'])
    body = self._generate_block(rule['body'])
    return f"for {var} in range({count}):\n{self._indent(body)}"
```

### `conditional` - If-Then-Else

```json
{"type": "conditional", "test": {...}, "if_true": {...}, "if_false": {...}}
```

For simple expressions, use ternary:
```python
result_true if condition else result_false
```

For complex bodies (blocks), use if statement:
```python
if condition:
    # if_true body
else:
    # if_false body
```

### `state_method` - State Method Calls

```json
{"type": "state_method", "method": "count", "args": [{"type": "constant", "value": "Item Name"}]}
```

Convert to direct state method calls:
```python
state.count("Item Name", player)
state.has_any(["Item1", "Item2"], player)
state.has_all(["Item1", "Item2"], player)
```

## Testing Strategy

1. **Unit tests for rule type conversion** - Test each rule type converter
2. **Undertale test** - Simple game with one parameterized helper
3. **shapez test** - Complex game with many helpers including loops and arithmetic
4. **Spoiler test validation** - Run `npm test -- --mode=test-spoilers` on worldgen worlds

## Files Modified Summary

| File | Changes |
|------|---------|
| `world_generator/extractors.py` | Add `HelperData` class and `extract_helpers()` |
| `world_generator/rule_codegen.py` | Add helper code generation, support new rule types |
| `world_generator/templates.py` | Update `generate_rules_py()` to include helpers |

## Questions for Review

1. **Lambda vs direct function assignment**: Should we use:
   - `entrance.access_rule = lambda state: helper(state, player)`
   - Or call through Rule Builder's `set_rule()`?

   The original worlds use direct lambda assignment. Rule Builder is used in the current worldgen for simpler rules.

2. **Handling `floating` parameter**: shapez passes `floating=False` from region setup code, but this is a setting-dependent value. Should we:
   - Hard-code `False` for now?
   - Extract from settings and pass through?

3. **Helper naming convention**: Use `_{game}_{helper_name}` like original worlds?

## Timeline Estimate

Not applicable - work will be done incrementally.

## Next Steps

1. Review and approve this plan
2. Implement Phase 1 (extraction)
3. Implement Phase 2 (code generation for simple helpers)
4. Test with Undertale
5. Implement Phase 3 (complex rule types)
6. Test with shapez
7. Run full spoiler tests on all worldgen worlds
