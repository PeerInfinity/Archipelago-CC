# Solved Exporter Issues for Wargroove

This file tracks solved issues related to the exporter in `exporter/games/wargroove.py`.

## Solved Issues

### Issue #1: Region Exit Rules Not Being Properly Exported

**Solved**: 2025-11-15
**Priority**: High
**Type**: Exporter Logic

**Problem**:
The `handle_complex_exit_rule` method was falling back to `{'type': 'constant', 'value': True}` for all region exits, making all regions immediately accessible at Sphere 0. This caused 10 regions to be incorrectly accessible:
- Surrounded, Darkest Knight, Robbed, Open Season, Doggo Mountain
- Tenri's Fall, Foolish Canal, Master of the Lake, A Ballista's Revenge, Rebel Village

**Root Cause**:
Wargroove uses `set_region_exit_rules()` which creates lambdas like:
```python
lambda state: any(location.access_rule(state) for location in locations)
```

The exporter was trying to look up locations by name from a hardcoded mapping, but the location lookup was failing due to incorrect parameter usage with `analyze_rule()`.

**Solution**:
Modified `/home/user/Archipelago-CC/exporter/games/wargroove.py` lines 28-93:
1. Extract the `locations` list directly from the exit rule lambda's closure
2. For each location, analyze its `access_rule` using `analyze_rule(rule_func=access_rule_func, game_handler=self, player_context=self.player)`
3. Combine analyzed rules with 'or' logic
4. Return the properly constructed rule

**Files Changed**:
- `exporter/games/wargroove.py` - Updated `handle_complex_exit_rule` method

**Test Results**:
- Before: Test failed at Sphere 0 with 10 incorrectly accessible regions
- After: Test passes Sphere 0 and progresses to Sphere 0.1
- Exit rules now properly reflect Python logic (e.g., Dragon Freeway → Surrounded requires Mage item)
