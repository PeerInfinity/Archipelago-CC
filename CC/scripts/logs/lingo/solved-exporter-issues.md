# Solved Exporter Issues for Lingo

## 1. Entrance rules returning strings instead of booleans (FIXED)

**Date Fixed:** 2025-11-17
**Priority:** Critical
**Location:** `exporter/games/lingo.py` - `postprocess_entrance_rule` method

**Problem:**
The analyzer was failing to properly analyze `lingo_can_use_entrance` function calls, producing rules with nested conditionals that returned string values (region names) instead of boolean values.

**Root Cause:**
The analyzer produced broken rule structures like:
```json
{
  "type": "conditional",
  "if_true": {"type": "constant", "value": True},
  "if_false": {
    "type": "conditional",
    "test": {...},
    "if_true": {"type": "constant", "value": "Hidden Room"},  // String instead of boolean!
    "if_false": {"type": "constant", "value": "Starting Room"} // String instead of boolean!
  }
}
```

**Solution:**
Modified `postprocess_entrance_rule` to:
1. Detect broken entrance rules by recursively checking for constant string values in conditional branches
2. Extract door information from entrance names
3. Replace broken rules with proper helper calls to `lingo_can_use_entrance`

**Result:**
Entrance rules now correctly use helper calls:
```json
{
  "type": "helper",
  "name": "lingo_can_use_entrance",
  "args": [
    {"type": "constant", "value": "Hidden Room"},
    {
      "type": "tuple",
      "elements": [
        {"type": "constant", "value": "Starting Room"},
        {"type": "constant", "value": "Back Right Door"}
      ]
    }
  ]
}
```

**Test Impact:**
Test results improved significantly:
- Before: ~100 regions accessible in STATE but NOT in LOG
- After: 1 region accessible in STATE but NOT in LOG, 35 regions accessible in LOG but NOT in STATE
