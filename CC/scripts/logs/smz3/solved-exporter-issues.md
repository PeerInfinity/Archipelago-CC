# Solved Exporter Issues

## Issue 1: Incorrect rule type for region accessibility checks

**Status**: Fixed
**Sphere**: 0.3
**Location**: exporter/games/smz3.py:288-291
**Fixed in**: Commit pending

### Description
The SMZ3 exporter was generating `region_accessible` rules when converting `self.world.CanEnter()` calls, but the rule engine only supports `region_check` rules for checking region accessibility.

### Fix Applied
Changed line 289 in `exporter/games/smz3.py` from:
```python
'type': 'region_accessible',
```
to:
```python
'type': 'region_check',
```

### Verification
After the fix, sphere 0.3 now passes successfully. Tower of Hera region becomes accessible as expected when the player obtains the Flute.

---

## Issue 2: static_ref rule type not supported

**Status**: Fixed
**Sphere**: 1.2
**Location**: exporter/games/smz3.py:201-239
**Fixed in**: Commit pending

### Description
The SMZ3 exporter was generating `static_ref` rules for `self.Logic` and `SMLogic.Normal` references, but the rule engine has no handler for this rule type.

### Fix Applied
Modified the postprocess_rule method to:
1. Convert `self.Logic` to a constant value of 0 (Normal logic)
2. Convert `SMLogic.Normal` to constant value 0
3. Convert `SMLogic.Hard` to constant value 1

### Verification
After the fix, sphere 1.2 now passes successfully. Brinstar Pink region becomes accessible as expected when the player obtains the SpeedBooster.

The test now progresses to sphere 4.3 before encountering the next issue (missing CanBeatBoss helper).

