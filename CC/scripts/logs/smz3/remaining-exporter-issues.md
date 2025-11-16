# SMZ3 Remaining Exporter Issues

## Issue 1: Region-Specific Helper Methods Need Inlining

**Priority:** High
**Status:** In Progress
**Location:** Various dungeon locations (e.g., Tower of Hera - Moldorm)

### Description
Dungeon-specific helper methods like `CanBeatBoss` are being converted to generic helpers (e.g., `smz3_CanBeatBoss`), but each dungeon has its own specific requirements. The generic helper is too permissive, causing locations to be accessible earlier than they should be.

For example, Tower of Hera - Moldorm requires:
```python
lambda items: items.BigKeyTH and self.CanBeatBoss(items)

def CanBeatBoss(self, items: Progression):
    return items.Sword or items.Hammer
```

But our generic smz3_CanBeatBoss allows many more weapons (Bow, Firerod, Icerod, Byrna, Somaria), making the location accessible too early.

### Root Cause
When the analyzer encounters `self.MethodName(items)`, it converts it to a helper call. The exporter then adds the `smz3_` prefix. However, methods like `CanBeatBoss` are defined differently in each dungeon region class, so using a single generic helper doesn't work.

### Files Affected
- `exporter/games/smz3.py` - SMZ3 game exporter
- `exporter/analyzer.py` - Rule analyzer
- `worlds/smz3/TotalSMZ3/Regions/Zelda/*.py` - Various dungeon region files
- `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` - SMZ3 helper functions

### Proposed Solutions
1. **Inline region-specific methods**: When extracting location rules, detect calls to `self.MethodName()` and inline the method logic directly into the rule
2. **Region-specific helpers**: Create unique helper names like `smz3_TowerOfHera_CanBeatBoss` for each region
3. **Pass region context**: Modify helpers to accept region name as parameter and implement region-specific logic

Option 1 (inlining) is preferred as it's most accurate to the Python logic.

### Expected Behavior
Each location's access rule should accurately reflect the specific requirements from its region's methods, not a generic approximation.

### Testing
After fix:
1. Run generation: `python Generate.py --weights_file_path "Templates/SMZ3.yaml" --multi 1 --seed 1`
2. Check Tower of Hera - Moldorm access rule only requires Sword OR Hammer (not other weapons)
3. Run spoiler test: `npm test --mode=test-spoilers --game=smz3 --seed=1`
4. Verify locations are accessible in the correct spheres
