# Solved Exporter Issues for Ocarina of Time

This file tracks exporter-related issues that have been fixed.

## Fixed Issues

### Issue 1: Subrule Locations Have Null Access Rules ✓

**Fixed:** 2025-11-17

**Solution:**
- Modified `worlds/oot/RuleParser.py` to store the rule AST as a string on subrule locations using `ast.unparse(node)`
- The OOT exporter's `build_rule_string_map` picks up the `rule_string` attribute and includes it in the rule string map
- The `parse_oot_rule` helper in frontend can now evaluate these rules

**Result:**
- Subrule locations now have proper access rules
- Test progressed from failing at Sphere 0 to Sphere 0.38
- Subrules are no longer incorrectly accessible from the start

**Files Modified:**
- `worlds/oot/RuleParser.py` - Added lines 385-393 to store rule_string on subrule locations
