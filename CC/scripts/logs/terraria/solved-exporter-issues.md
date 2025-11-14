# Solved Exporter Issues for Terraria

## Issue 1: Access rules not properly exported

**Status:** SOLVED
**Priority:** Critical
**Category:** Exporter

**Description:**
The access rules in the generated rules.json were calling a helper function `check_conditions` with arguments like `rule.operator` and `rule.conditions`, which are Python-specific data structures. These needed to be properly converted to the JavaScript rule format.

**Solution:**
Created `exporter/games/terraria.py` which implements:
1. `override_rule_analysis` method to intercept rule analysis and directly convert Terraria's Condition objects to JSON rules
2. Support for all Terraria condition types:
   - COND_ITEM: Check for items
   - COND_LOC: Recursively check location accessibility
   - COND_FN: Special functions (npc, calamity, pickaxe, hammer, mech_boss, minions, etc.)
   - COND_GROUP: Grouped conditions with operators
3. Proper handling of negation with the `~` operator
4. Conversion of special functions to helper calls or expanded item checks
5. Sentinel value handling to distinguish "always accessible" (None) from "didn't handle" (None)

**Files modified:**
- Created: `exporter/games/terraria.py`
- Modified: `exporter/exporter.py` (added sentinel value handling for Terraria)
