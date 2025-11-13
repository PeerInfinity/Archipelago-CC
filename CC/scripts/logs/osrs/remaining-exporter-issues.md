# Remaining Exporter Issues for Old School Runescape

## Issue 1: Location.can_reach() Pattern

**Status**: Not Fixed
**Priority**: High
**Test Failure**: Sphere 0.2 - "Points: Misthalin Mystery" not accessible

**Description**:
The OSRS world uses a pattern where Location objects' .can_reach() method is called:
```python
add_rule(qp_loc, lambda state, loc=q_loc: (loc.can_reach(state)))
```

The current export produces:
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {"type": "name", "name": "loc"},
    "attr": "can_reach"
  },
  "args": []
}
```

This should be converted to:
```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {"type": "constant", "value": "Quest: Misthalin Mystery"},
    {"type": "constant", "value": "Location"}
  ]
}
```

**Solution**:
Need to handle this pattern in the exporter or analyzer. Options:
1. Add special handling in OSRS exporter's expand_rule
2. Add generic handling in the analyzer for Location.can_reach() pattern
3. Modify how Location objects are stored in closures

**Code Location**:
- `worlds/osrs/__init__.py` line 413
- Analyzer: `exporter/analyzer/ast_visitors.py`
- Exporter: `exporter/games/osrs.py`

---

## ~~Issue: Unresolved Lambda Default Parameters~~ (FIXED ✓)

**Status**: Fixed in commit 600c367
**Test Failure**: Sphere 0 - 3 locations not accessible (NOW FIXED)

**Description** (Historical):
The OSRS world code used lambdas with default parameters that captured Region objects:
```python
lambda state, region_required=region_required: state.can_reach(region_required, "Region", self.player)
```

**Solution Implemented**:
Modified `exporter/analyzer/ast_visitors.py` to detect objects with both `.name` and `.entrances` attributes (Region objects) and automatically extract their `.name` attribute as a constant string value.

**Results**:
- ✅ Fixed: "Burn some Oak Logs" - now has `{\"type\": \"constant\", \"value\": \"Oak Tree\"}`
- ✅ Fixed: "Burn some Willow Logs" - now has proper region constants
- ✅ Fixed: "Kill a Duck" - now has `{\"type\": \"constant\", \"value\": \"Duck\"}`
