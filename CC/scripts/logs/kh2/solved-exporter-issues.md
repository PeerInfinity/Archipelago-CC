# Kingdom Hearts 2 - Solved Exporter Issues

This file tracks exporter issues that have been successfully fixed for Kingdom Hearts 2.

## Solved Issues

### 1. FightLogic setting not exported to rules.json ✓

**Location**: `exporter/games/kh2.py:144-166`

**Fix**: Added `get_settings_data()` method override to export KH2-specific settings including:
- `FightLogic` (easy=0, normal=1, hard=2)
- `AutoFormLogic` (enabled/disabled)
- `FinalFormLogic` (no_light_and_darkness=0, light_and_darkness=1, just_a_form=2)
- `Promise_Charm` (enabled/disabled)

**Result**: Settings are now correctly exported to rules.json and available to helper functions
