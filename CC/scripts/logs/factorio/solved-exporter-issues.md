# Factorio - Solved Exporter Issues

This document tracks exporter issues for Factorio that have been resolved.

## Test Results (2025-12-13)

- **Spoiler Test**: PASSED
- **Spheres Processed**: 67/67
- **Errors**: 0

## Solved Issues

### 1. technology.name attribute access not simplified for inlined constant dictionaries

**Date Fixed**: 2025-12-13

**Symptoms**:
- Location "Automate logistic-science-pack" failed at Sphere 1.8
- Error: "Access rule evaluation failed"
- The `all_of` rule checking technology requirements was not evaluating correctly

**Root Cause**:
The exporter had code to simplify `technology.name` attribute access in `all_of` rules that iterate over `required_technologies[ingredient]`. However, the condition only checked for the case where `required_technologies` was a name reference:

```python
if (iterator.get('type') == 'subscript' and
    iterator.get('value', {}).get('type') == 'name' and
    iterator.get('value', {}).get('name') == 'required_technologies'):
```

But at export time, the `required_technologies` dictionary was being inlined as a constant value, so the iterator had:
```json
"iterator": {
  "type": "subscript",
  "value": { "type": "constant", "value": { ... dictionary ... } }
}
```

This meant `value.type` was `"constant"`, not `"name"`, so the simplification was not applied.

**Fix**:
Added a second condition to also detect when `required_technologies` has been inlined as a constant dictionary:

```python
# Case 1: required_technologies is still a name reference
is_required_tech_name = (iterator.get('type') == 'subscript' and
    iterator.get('value', {}).get('type') == 'name' and
    iterator.get('value', {}).get('name') == 'required_technologies')

# Case 2: required_technologies has been inlined as a constant dictionary
is_required_tech_constant = (iterator.get('type') == 'subscript' and
    iterator.get('value', {}).get('type') == 'constant' and
    isinstance(iterator.get('value', {}).get('value'), dict))

if is_required_tech_name or is_required_tech_constant:
    # Apply simplification...
```

**Files Changed**:
- `exporter/games/factorio.py`: Updated `expand_rule()` method to handle both cases

**Verification**:
After regenerating rules.json, the element_rule changed from:
```json
{
  "type": "item_check",
  "item": {
    "type": "attribute",
    "object": { "type": "name", "name": "technology" },
    "attr": "name"
  }
}
```
to:
```json
{
  "type": "item_check",
  "item": { "type": "name", "name": "technology" }
}
```

This allows the rule engine to correctly evaluate the item check using the bound iterator variable value directly.
