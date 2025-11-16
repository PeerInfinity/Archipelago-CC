# Solved Exporter Issues for Ocarina of Time

This document tracks resolved issues in the OOT exporter (exporter/games/oot.py).

## Resolved Issues

### 1. Subrule Locations with Null Access Rules **FIXED in commit cbb8ead6**

**Problem:**
All Subrule locations were being exported with `access_rule: null`, causing the JavaScript state manager to treat them as "always accessible". This created mismatches where locations were accessible in STATE but not in the expected spheres in LOG.

**Root Cause:**
The exporter was trying to access `world.parser.delayed_rules` to get the AST nodes for unparsing rule strings. However, `RuleParser.create_delayed_rules()` clears the `delayed_rules` list after creating the location events. Since the exporter runs after generation is complete, the list was already empty.

**Solution:**
1. Modified `worlds/oot/RuleParser.py` `create_delayed_rules()` to save the delayed_rules to a new attribute `delayed_rules_for_export` before clearing
2. Updated `exporter/games/oot.py` `build_rule_string_map()` to use `delayed_rules_for_export` instead of `delayed_rules`
3. Added fallback to `delayed_rules` for backward compatibility

**Result:**
- All 46 Subrule locations now properly export their access rules
- Spoiler test progression improved from failing at step 1 (Sphere 0) to step 7 (Sphere 0.6)
- Initial Subrule accessibility mismatch resolved

**Files Modified:**
- `worlds/oot/RuleParser.py` - Added delayed_rules_for_export preservation
- `exporter/games/oot.py` - Updated to use delayed_rules_for_export
