# Solved OSRS Exporter Issues

## Issue 1: Lambda default parameter with Location object resolved to loc.can_reach()

**Status**: SOLVED

**Description**:
Quest point ("Points:") locations had access rules using lambda default parameters that referenced Location objects via `loc.can_reach(state)`. The exporter was initially exporting these as raw function_call nodes with name references instead of converting them to proper state_method calls.

**Example from Python code** (worlds/osrs/__init__.py:413):
```python
add_rule(qp_loc, lambda state, loc=q_loc: (loc.can_reach(state)))
```

**Previous incorrect export**:
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {
      "type": "name",
      "name": "loc"
    },
    "attr": "can_reach"
  },
  "args": []
}
```

**Current correct export**:
```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {
      "type": "constant",
      "value": "Quest: Misthalin Mystery"
    },
    {
      "type": "constant",
      "value": "Location"
    }
  ]
}
```

**Solution**:
The exporter's code in `exporter/analyzer/ast_visitors.py` (lines 884-914) already had logic to detect `loc.can_reach()` patterns and convert them to state_method calls. The issue was resolved by regenerating the rules.json file with the correct code path being executed.

**Date solved**: 2025-11-16

---

## Issue 2: Lambda default parameter with Region object not being resolved to region name

**Status**: SOLVED

**Description**:
When location access rules used lambda default parameters that referenced Region objects, the exporter was not extracting the region's `.name` attribute and instead left it as a name reference `{"type": "name", "name": "region_required"}`.

**Example from Python code** (worlds/osrs/__init__.py:431-433):
```python
add_rule(location,
         lambda state, region_required=region_required: state.can_reach(region_required, "Region",
                                                                        self.player))
```

**Previous incorrect export**:
```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {
      "type": "name",
      "name": "region_required"
    },
    {
      "type": "constant",
      "value": "Region"
    }
  ]
}
```

**Current correct export**:
```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {
      "type": "constant",
      "value": "Oak Tree"
    },
    {
      "type": "constant",
      "value": "Region"
    }
  ]
}
```

**Affected locations** (examples):
- Burn some Oak Logs
- Burn some Willow Logs
- Kill a Duck

**Root cause**:
In `exporter/analyzer/ast_visitors.py`, when resolving variable references in arguments (for state methods, helpers, and module calls), the code only converted simple values to constants. Region objects were not considered "simple values", so they remained as name references.

**Solution**:
Added checks in three locations in `exporter/analyzer/ast_visitors.py` to detect Region objects (objects with both 'name' and 'entrances' attributes) and extract the `.name` attribute to create constant values:
1. Helper function argument resolution (around line 230)
2. State method argument resolution (around line 611)
3. Module helper call argument resolution (around line 954)

**Code changes**: Modified `exporter/analyzer/ast_visitors.py` to add:
```python
# Handle Region objects - extract the .name attribute
elif resolved_value is not None and hasattr(resolved_value, 'name') and hasattr(resolved_value, 'entrances'):
    region_name = resolved_value.name
    logging.debug(f"Resolved argument variable '{arg['name']}' (Region object) to region name: {region_name}")
    resolved_args.append({'type': 'constant', 'value': region_name})
```

**Test results**: After the fix, the OSRS spoiler test passes with 63 events checked successfully and 0 mismatches.

**Date solved**: 2025-11-16
