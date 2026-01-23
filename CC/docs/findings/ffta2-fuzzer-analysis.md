# FFTA2 APWorld UT Fuzzer Analysis

**Game**: Final Fantasy Tactics A2
**APWorld Source**: https://github.com/Rurusachi/Archipelago/releases/download/FFTA2_0.0.9/ffta2.apworld
**Date**: 2026-01-23
**Fuzzer Results**: 0% success rate (10/10 failures)

## Summary

The FFTA2 apworld has a **fundamental option validation bug** that causes 100% failure rate in the UT fuzzer. This is **not a UT tracking compatibility issue** - the apworld fails during normal seed generation when randomized options are used.

## Root Cause

The `StartingUnits` option (`OptionSet`) allows selecting from 69 valid unit names:
- 8 special units: Adelle, Cid, Hurdy, Vaan, Penelo, Al-Cid, Montblanc, Frimelda
- 61 non-special units: race/job combinations like "Hume Soldier", "Viera White Mage", etc.

**The Bug**: The option documentation states "You cannot start with more than 5 non-special units", but this limit is **not enforced at the option level**. Instead, validation only occurs in `rom.py:set_starting_units()` during output generation:

```python
# rom.py line 130-131
if normal_unit_index > 5:
    raise Exception("Too many non-special starting units to randomize")
```

When the fuzzer randomly selects unit names from the 69 valid keys, it almost always selects more than 5 non-special units, triggering this exception.

## Evidence

### Failing YAML Example (fuzz seed 0)
```yaml
starting_units:
- Gria Geomancer
- Hume Blue Mage
- Nu Mou Scholar
- Hume Archer
- Hume Thief
- Viera White Mage
- Bangaa Trickster
# ... 25 more entries (32 total)
```

Only 4 of the 32 units are special (Montblanc, Vaan, Adelle, Al-Cid), leaving 28 non-special units - far exceeding the 5 unit limit.

### Stack Trace
```
File ".../rom.py", line 131, in set_starting_units
    raise Exception("Too many non-special starting units to randomize")
Exception: Too many non-special starting units to randomize
```

## Technical Details

| Aspect | Value |
|--------|-------|
| Option Type | `OptionSet` |
| Valid Keys | 69 (8 special + 61 non-special) |
| Allowed Non-Special | 5 |
| Error Location | `rom.py:set_starting_units()` line 131 |
| Error Phase | `generate_output()` (post-generation) |

## Recommended Fixes (for APWorld maintainer)

### Option 1: Early Validation (Recommended)
Add validation in `generate_early()` to fail fast with a clear error:

```python
def generate_early(self):
    special_units = {'Adelle', 'Cid', 'Hurdy', 'Vaan', 'Penelo', 'Al-Cid', 'Montblanc', 'Frimelda'}
    non_special = [u for u in self.options.starting_units.value if u not in special_units]
    if len(non_special) > 5:
        raise OptionError(f"starting_units contains {len(non_special)} non-special units, max is 5")
```

### Option 2: Custom Option Validation
Create a custom `StartingUnits` class that validates the constraint:

```python
class StartingUnits(OptionSet):
    def verify(self, world, player_name, plando_options):
        super().verify(world, player_name, plando_options)
        special = {'Adelle', 'Cid', 'Hurdy', 'Vaan', 'Penelo', 'Al-Cid', 'Montblanc', 'Frimelda'}
        non_special = [u for u in self.value if u not in special]
        if len(non_special) > 5:
            raise OptionError(f"Too many non-special starting units ({len(non_special)}), max is 5")
```

## Impact Assessment

| Category | Impact |
|----------|--------|
| UT Compatibility | N/A - fails before UT tracking phase |
| Seed 1 Generation | Works (default options are valid) |
| Randomized Options | 100% failure rate |
| User Impact | Users must manually ensure valid starting_units |

## Conclusion

This is an **apworld bug**, not a UT compatibility issue. The apworld needs to validate the `starting_units` option constraint before reaching output generation. The fix must be made by the apworld maintainer.

**Recommended Actions**:
1. Report issue to apworld maintainer at https://github.com/Rurusachi/Archipelago
2. Add FFTA2 to a "known issues" list if fuzzer testing is intended to track pass/fail
3. Consider adding the apworld to an ignore list for automated fuzzer testing until fixed

## Files Examined

- `custom_worlds/ffta2.apworld/ffta2/__init__.py` - World class
- `custom_worlds/ffta2.apworld/ffta2/options.py` - StartingUnits option definition
- `custom_worlds/ffta2.apworld/ffta2/rom.py` - Error location in set_starting_units()
