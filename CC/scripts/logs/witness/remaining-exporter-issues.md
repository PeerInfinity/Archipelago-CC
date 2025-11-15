# The Witness - Remaining Exporter Issues

## Issue 1: Lambda functions with variable references not being resolved

**Status:** Not fixed

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

**Fix needed:**
The exporter needs to:
1. Detect when a lambda function contains references to closure variables
2. Resolve those variables to their actual values before export
3. Convert the resolved values into proper JSON rule structures
4. OR: Call the lambda function with a test state to determine what it actually checks

**Priority:** High (blocks all location access)
