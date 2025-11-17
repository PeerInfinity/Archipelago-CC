# SMZ3 - Remaining Exporter Issues

This file tracks remaining issues in the SMZ3 exporter (exporter/games/smz3.py).

## Issue 1: Generation fails before exporter runs

**Status**: Identified Root Cause

**Description**: The SMZ3 generation fails during playthrough calculation, before the exporter (export_game_rules) is ever called. This prevents testing whether the exporter changes actually work.

**Error message**:
```
RuntimeError: Not all progression items reachable ({Skull Woods - Big Chest, Swamp Palace - Big Chest}). Something went wrong.
```

**Root cause**: The SMZ3 world has a logic issue where Big Chests in Swamp Palace and Skull Woods contain their own Big Keys, creating a circular dependency. With "items" accessibility mode (the template default), the generation fails because these items are unreachable.

**Evidence**:
1. SMZ3 exporter is properly registered in GAME_HANDLERS
2. The exporter's `__init__` method is never called (confirmed via debug logging)
3. `override_rule_analysis` is never executed
4. Generation fails at line 280 of sphere_logger.py (during playthrough calculation)
5. export_game_rules is called at Main.py:402, which is AFTER playthrough calculation (Main.py:393)

**Attempted fixes**:
1. Changed `canAccess` to `Available` in the exporter - correct but untested
2. Added extensive debug logging - revealed the exporter never runs
3. Created SMZ3_minimal.yaml template with minimal accessibility - needs further testing

**Next steps**:
1. Either fix the SMZ3 world logic to handle self-locking Big Chests
2. Or use a template with minimal accessibility for testing
3. Verify that the exporter changes (using `Available` instead of `canAccess`) work correctly
4. Test that loc.Available() patterns are properly extracted and converted

**Temporary workaround**: Use minimal accessibility mode to allow unreachable items:
```yaml
accessibility:
  minimal: 50
```

## Issue 2: loc.Available() pattern not being extracted (UNVERIFIED)

**Status**: Fixed in code, but untested due to Issue 1

**Description**: Location access rules should be extracted by the exporter's `override_rule_analysis` method, but they remain in their raw form with references to `loc.Available()`.

**Example location**: Aginah's Cave, Blind's Hideout locations, etc.

**Current behavior**: Access rules exported as:
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {"type": "name", "name": "loc"},
    "attr": "Available"
  },
  "args": [...]
}
```

**Expected behavior**: The exporter should extract the `loc` object from the lambda's default arguments and analyze its `Available` function.

**Code changes made** (exporter/games/smz3.py):
- Line 241: Changed check from `has_can_access` to `has_available`
- Line 251: Changed `loc_object.canAccess` to `loc_object.Available`
- Lines 256, 265: Updated error messages to reference `Available` instead of `canAccess`

**Status**: Cannot test these changes until Issue 1 is resolved.
