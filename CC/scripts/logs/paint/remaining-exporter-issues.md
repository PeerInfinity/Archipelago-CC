# Paint - Remaining Exporter Issues

## Issue 1: Location access rules are not exported

**Status:** Not Started
**Priority:** High

### Description
All locations in the Paint game have `"access_rule": null` in the generated rules.json file. However, the Python code defines custom access rules in the `PaintLocation` class that use the `paint_percent_available` helper function.

### Python Implementation
- Location: `worlds/paint/locations.py:8-11`
- Each location's access rule checks if `paint_percent_available(state, world, player) >= (location.address % 198600) / 4`
- The threshold is derived from the location address (e.g., "Similarity: 1.0%" at address 198604 requires >= 1.0%)

### Required Fix
The exporter needs to:
1. Detect the custom access_rule method in PaintLocation class
2. Export the rule that calls `paint_percent_available` helper
3. Include the percentage threshold calculation based on location address

### Expected Output Format
```json
{
  "access_rule": {
    "type": "compare",
    "left": {
      "type": "helper",
      "name": "paint_percent_available",
      "args": []
    },
    "op": ">=",
    "right": {
      "type": "constant",
      "value": 1.0
    }
  }
}
```

---

## Issue 2: paint_percent_available helper needs to be exported

**Status:** Not Started
**Priority:** High

### Description
The `paint_percent_available` function is the core logic function for Paint. It needs to be recognized and properly handled by the exporter.

### Python Implementation
- Location: `worlds/paint/rules.py:7-11`
- Uses a cached calculation in state
- Depends on `calculate_paint_percent_available` which has complex math

### Required Fix
The exporter needs to identify this as a helper function that should be implemented in JavaScript.

---
