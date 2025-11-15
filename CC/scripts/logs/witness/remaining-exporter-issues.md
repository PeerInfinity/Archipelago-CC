# The Witness - Remaining Exporter Issues

## Issue 1: Complex region reachability checks not translating to JavaScript

**Status:** Partially fixed (lambda resolution done, but Python-specific logic remains)

**Previous status:** Lambda functions with variable references not being resolved - **RESOLVED**

**Description:**
The exporter is exporting lambda functions that contain references to Python local variables like `fully_converted_rules` and `condition`. These variables don't exist in the JavaScript context, causing "Access rule evaluation failed" errors.

**Example from rules.json:**
```json
{
  "type": "all_of",
  "element_rule": {
    "type": "helper",
    "name": "condition",
    "args": []
  },
  "iterator_info": {
    "type": "comprehension_details",
    "target": {
      "type": "name",
      "name": "condition"
    },
    "iterator": {
      "type": "subscript",
      "value": {
        "type": "name",
        "name": "fully_converted_rules"
      },
      "index": {
        "type": "constant",
        "value": 0
      }
    }
  }
}
```

**Python source (worlds/witness/rules.py:287-296):**
```python
fully_converted_rules = [convert_requirement_option(sublist, player) for sublist in optimized_rule_conversion]

if len(fully_converted_rules) == 1:
    if len(fully_converted_rules[0]) == 1:
        return fully_converted_rules[0][0]
    return lambda state: all(condition(state) for condition in fully_converted_rules[0])
return lambda state: any(
    all(condition(state) for condition in sub_requirement)
    for sub_requirement in fully_converted_rules
)
```

**Root cause:**
The exporter is capturing the AST of the lambda function including the variable references, but not evaluating what those variables actually contain before exporting.

**Test failures:**
- Multiple "Access rule evaluation failed" errors
- Regions not accessible: Desert Behind Elevator, Outside Tutorial Path To Outpost, Shadows Laser Room
- Locations not accessible: Desert Laser Activated, Keep Laser Activated, Shadows Laser Activated, etc.

**Current situation:**
The exporter now correctly resolves lambda functions with closure variable references and expands list comprehensions. However, The Witness uses complex Python-specific state management logic that doesn't translate directly to JavaScript:

- `state.stale[player]` - Python-specific state cache invalidation
- `state.update_reachable_regions()` - Python-specific region update method
- `region in state.reachable_regions[player]` - Python set membership checks

These patterns appear in rules like:
```python
if state.stale[region.player]:
    state.update_reachable_regions()
return region in state.reachable_regions[region.player]
```

**Fix needed:**
One of the following approaches:

1. **Custom Game Handler:** Create a WitnessGameExportHandler that:
   - Detects region.can_reach() patterns
   - Converts them to simplified "region_reachable" rules
   - Extracts just the region name instead of the complex logic

2. **Frontend Helper Functions:** Implement Witness-specific helpers:
   - `check_region_reachable(state, region_name)` in frontend
   - Update rule engine to handle Python state methods

3. **Hybrid Approach:** Simplify at export time AND add frontend support for remaining complex patterns

**Priority:** High (blocks all location access)
