# Solved Exporter Issues for Civilization VI

This file tracks issues related to the exporter that have been resolved.

## Issue 1: Era entrance rules not properly expanded ✅ SOLVED

**Status:** Solved

**Description:** The entrance rules for era regions were using complex subscript expressions that referenced `world.era_required_progressive_items_counts[era]` and `world.era_required_non_progressive_items[era]`. These needed to be expanded to concrete item requirements.

**Original Problem:**
The entrance from ERA_ANCIENT to ERA_CLASSICAL had a rule like:
```json
{
  "type": "state_method",
  "method": "has_all_counts",
  "args": [{
    "type": "subscript",
    "value": {
      "type": "attribute",
      "object": {"type": "name", "name": "world"},
      "attr": "era_required_progressive_items_counts"
    },
    "index": {"type": "constant", "value": "ERA_ANCIENT"}
  }]
}
```

**Solution:**
Extended the `resolve_attribute_nodes_in_rule` function in `exporter/exporter.py` to:
1. Handle subscript nodes by resolving both the value and index
2. Support Enum-keyed dictionaries by matching Enum.value with string indices
3. Transform state_method calls with resolved constant arguments to inline the values

**Result:**
The rule is now properly expanded to:
```json
{
  "type": "state_method",
  "method": "has_all_counts",
  "args": [{
    "type": "constant",
    "value": {
      "Progressive Encampment": 1,
      "Progressive Holy Site": 1,
      "Progressive Campus": 1
    }
  }]
}
```

**Test Result:** Spoiler test now passes at sphere 0.13 - ERA_CLASSICAL region is correctly marked as accessible

**Files Modified:**
- `exporter/exporter.py` - Added subscript resolution and Enum key handling to `resolve_attribute_nodes_in_rule`

