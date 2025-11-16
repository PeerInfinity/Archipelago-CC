# SMZ3 Solved Exporter Issues

## Issue 1: Medallion Entrance Rules Return None ✓

**Solved:** 2025-11-16
**Location:** Menu->Misery Mire and Menu->Turtle Rock entrances

### Description
The entrance rules for Misery Mire and Turtle Rock were returning error rules with type "error" and message "Analysis did not produce a result structure (returned None)."

### Root Cause
The CanEnter methods for these dungeons use `self.Medallion` compared to enum values in a nested ternary conditional, which the analyzer couldn't handle.

### Solution
Added `_handle_medallion_entrance` method in `exporter/games/smz3.py` that:
1. Detects when a region has a `Medallion` attribute (indicates Misery Mire or Turtle Rock)
2. Reads the medallion enum value (0=Bombos, 1=Ether, 2=Quake)
3. Manually constructs the entrance rule with the appropriate medallion item check
4. Adds region-specific requirements (Boots/Hookshot for Misery Mire, CanLiftHeavy/Hammer/Somaria for Turtle Rock)

### Files Modified
- `exporter/games/smz3.py` - Added medallion handling logic

### Verification
Both entrance rules now correctly export as `and` rules with the proper medallion requirement and all other access conditions.

## Issue 2: Helper Functions Missing "smz3_" Prefix ✓

**Solved:** 2025-11-16
**Location:** Various locations using helper functions

### Description
Helper functions converted by the analyzer were missing the "smz3_" prefix, causing them to not be found at runtime.

### Root Cause
The analyzer converts method calls like `self.CanBeatBoss(items)` to generic helper rules, but doesn't add the game-specific prefix.

### Solution
Modified `postprocess_rule` method in `exporter/games/smz3.py` to:
1. Detect helper type rules
2. Add "smz3_" prefix if not already present
3. Filter out 'items' arguments since JavaScript helpers receive the snapshot directly

### Files Modified
- `exporter/games/smz3.py` - Enhanced postprocess_rule method

### Verification
Helper function names now have the "smz3_" prefix and items arguments are filtered out.
