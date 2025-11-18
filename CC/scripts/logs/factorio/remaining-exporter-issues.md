# Remaining Exporter Issues - Factorio

This file tracks outstanding issues with the Factorio exporter (`exporter/games/factorio.py`).

## Issue 1: `all_of` rule evaluation failing for required_technologies

**Status:** Investigating

**Location:** "Automate logistic-science-pack"

**Sphere:** 1.8

**Description:**
The location "Automate logistic-science-pack" is not accessible in the JavaScript frontend even though it should be accessible in sphere 1.8 when the player has the "logistic-science-pack" technology.

**Access Rule Structure:**
```json
{
    "type": "all_of",
    "element_rule": {
        "type": "item_check",
        "item": {
            "type": "name",
            "name": "technology"
        }
    },
    "iterator_info": {
        "type": "comprehension_details",
        "target": {
            "type": "name",
            "name": "technology"
        },
        "iterator": {
            "type": "subscript",
            "value": {
                "type": "name",
                "name": "required_technologies"
            },
            "index": {
                "type": "constant",
                "value": "logistic-science-pack"
            }
        }
    }
}
```

**Required Technologies Data:**
- `required_technologies["logistic-science-pack"]` = `["logistic-science-pack"]`

**Expected Behavior:**
At sphere 1.8, the player has the technology "logistic-science-pack". The `all_of` rule should:
1. Evaluate the iterator `required_technologies["logistic-science-pack"]` to get `["logistic-science-pack"]`
2. For each technology in the list (just "logistic-science-pack"), check if the player has it
3. Return true since the player has the technology

**Actual Behavior:**
The location is not accessible, suggesting the rule evaluation is failing.

**Potential Root Causes:**
1. The `resolveName` function may not be finding `required_technologies` from `game_info.variables`
2. The `all_of` rule may not be properly binding the iterator variable "technology"
3. The `item_check` with `{"type": "name", "name": "technology"}` may not be evaluating correctly in the bound context
4. The `createBoundContext` function may not be working correctly for this case

**Next Steps:**
1. Add debug logging to see what `resolveName` returns for "required_technologies"
2. Check if the iterator is being evaluated correctly
3. Verify that the bound context properly resolves "technology" to each item in the list
4. Test the `item_check` with the bound variable
