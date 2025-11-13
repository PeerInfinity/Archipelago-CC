# Remaining Exporter Issues for Ocarina of Time

This file tracks exporter issues that still need to be fixed.

## Issues

### 1. Settings not being exported properly (HIGH PRIORITY)

**Issue**: The `starting_age` and other settings are exported as `null` instead of their actual values.

**Evidence**: In `AP_14089154938208861744_rules.json`:
```json
{
  "starting_age": null,
  "shuffle_child_trade": null
}
```

**Impact**: This breaks the very first region transition from `Root` -> `Root Exits`, which requires `is_starting_age or Time_Travel`. Since `starting_age` is null, `is_starting_age()` returns false, and without `Time_Travel`, the entire game world becomes unreachable.

**Fix needed**: The exporter needs to export the actual setting values from the OOT world. The default `starting_age` should be `'child'`.

**Location**: `exporter/games/oot.py` - need to implement settings export

---

### 2. Failed to analyze many location rules

**Issue**: Many locations show "Failed to analyze or expand rule" errors during generation.

**Evidence**: From `generate_output.txt`:
- "Failed to analyze or expand rule for Location 'Deku Tree Basement Back Room Subrule 1'"
- "Failed to analyze or expand rule for Location 'Deku Tree Basement Ledge Subrule 1'"
- And many more...

**Impact**: These locations may have incorrect or missing access rules in the rules.json.

**Fix needed**: The exporter's `override_rule_analysis` method needs to handle these cases better, or the rule strings need to be available for these locations.

**Location**: `exporter/games/oot.py` - `build_rule_string_map` or `override_rule_analysis`
