# Zillion Exporter Progress Summary

## Session Date
2025-11-16

## Environment Setup
✅ Completed full cloud environment setup:
- Created Python virtual environment
- Installed all requirements and game-specific dependencies (including zilliandomizer)
- Generated template files
- Configured host settings for minimal-spoilers mode
- Installed Node.js dependencies and Playwright browsers

## Major Accomplishments

### 1. Deep Research into Zillion Requirements System
Created comprehensive documentation in `ZILLION_REQUIREMENTS_EXPLAINED.md` explaining:
- Character-dependent gun/jump power systems
- Lookup tables mapping item counts to power levels
- Rescue item mechanics (Apple/Champ provide ability boosts)
- Starting abilities vary by character (JJ, Apple, Champ)
- Jump comes from Opa-Opa items via leveling, not "Jump Shoes"

### 2. Implemented Character-Dependent Exporter
Updated `exporter/games/zillion.py` with:
- Import of zilliandomizer lookup tables (char_to_gun, char_to_jump)
- World options loading (start_char, gun_levels, jump_levels, opas_per_level)
- `_get_gun_requirement()` - calculates Zillion item needs based on character
- `_get_jump_requirement()` - calculates Opa-Opa needs based on character
- Support for rescue item alternatives (OR conditions)
- Red ID Card and Floppy Disk requirements

### 3. Fixed Option Name Case Sensitivity
Corrected lowercase conversion for option lookups:
- Options return "Balanced" but lookup tables use "balanced"
- Fixed by adding `.lower()` to option name retrieval

## Current Challenge: Item Placement Dependency

### The Problem
Discovered a fundamental circular dependency:
1. Exporter runs during `generate_output` to create rules.json
2. Zilliandomizer's `get_locations()` method considers item PLACEMENT when determining accessibility
3. Items haven't been placed yet when exporter runs
4. Therefore, access rules can't be accurately determined from `zz_loc.req` alone

### Evidence
Locations with identical requirements appear in different spheres:
- "B-1 mid far left": gun=1, jump=0 → Sphere 0 (accessible from start)
- "C-3 mid far right": gun=1, jump=0 → Sphere 0.3 (needs Zillion)
- Both have IDENTICAL req fields, but different accessibility

### Root Cause
From `worlds/zillion/logic.py` (lines 64-95):
```python
def cs_to_zz_locs(self, cs: CollectionState) -> frozenset[Location]:
    # Calls set_randomizer_locs which syncs item placement
    hash_ = set_randomizer_locs(cs, self._player, self._zz_r)
    # ...
    # Then calls zilliandomizer's get_locations with current item placement
    tr = frozenset(self._zz_r.get_locations(have_req))
```

The `set_randomizer_locs` function (lines 18-36) assigns placed items to zilliandomizer locations, affecting which locations `get_locations` considers accessible.

## Test Results

### Initial Test (Before Fixes)
- ❌ Failed at Sphere 0
- Issue: Many locations incorrectly marked as always accessible
- Cause: Using `sweep_for_advancements()` which collected events

### After Character-Dependent Implementation
- ❌ Still failing at Sphere 0
- Issue: Locations accessible in STATE but not in LOG
- Cause: Req-based rules don't account for item placement dependency

## Files Modified

1. **exporter/games/zillion.py** - Complete rewrite with character-dependent logic
2. **CC/scripts/logs/zillion/** - Created issue tracking structure
3. **ZILLION_REQUIREMENTS_EXPLAINED.md** - Comprehensive documentation

## Files Created by Research Agent

1. **test_zillion_reqs2.py** - Shows actual location requirements
2. **test_gun_jump_logic.py** - Explains power progressions
3. **test_rescue_logic.py** - Explains rescue mechanics

## Next Steps (Recommended Approaches)

### Option 1: Test Access Rules Without Sweep
Try testing location.access_rule with truly empty CollectionState:
```python
base_state = multiworld.get_all_state(False)
# DON'T call sweep_for_advancements()
is_accessible = location.access_rule(base_state)
```

### Option 2: Export During fill_slot_data
Move exporter to run during `fill_slot_data` (after item placement):
- Requires changes to Archipelago core exporter timing
- Would have access to actual item placement
- Could test access rules accurately

### Option 3: Simplified Rule Approximation
Create simplified rules that approximate zilliandomizer logic:
- Ignore item placement effects
- Accept some inaccuracy for simplicity
- Document limitations

### Option 4: Statistical Analysis
Generate multiple seeds and analyze patterns:
- Identify which requirements correlate with sphere appearance
- Build probabilistic rules
- May not be 100% accurate but could be close enough

## Known Working: Lookup Tables
The character-dependent lookup table logic is CORRECT and handles:
- Gun power progression (character-specific)
- Jump power progression (character-specific)
- Rescue item alternatives (OR conditions)
- Option-dependent power curves (vanilla/balanced/low/restrictive)

## Known Issue: Item Placement
The fundamental limitation is that zilliandomizer considers WHERE items are placed, and this information isn't available during export.

## Recommendations for Next Session

1. Try Option 1 first (test without sweep) - simplest to implement
2. If that fails, investigate Option 2 (export timing) - may require core changes
3. Document decision and rationale in issue tracker
4. Consider reaching out to zilliandomizer/Archipelago developers for guidance

## Time Invested
Approximately 2-3 hours including:
- Environment setup
- Deep research into zilliandomizer
- Multiple exporter implementations
- Extensive debugging and testing

## Success Metrics
- ✅ Environment fully configured
- ✅ Deep understanding of Zillion requirements system
- ✅ Character-dependent exporter implemented
- ❌ Tests not yet passing (fundamental issue discovered)
- ✅ Issue root cause identified
- ✅ Multiple solution paths identified

## References
- `ZILLION_REQUIREMENTS_EXPLAINED.md` - Requirement system documentation
- `worlds/zillion/logic.py` - Zilliandomizer integration
- `exporter/games/zillion.py` - Current exporter implementation
- `.venv/lib/python3.11/site-packages/zilliandomizer/options/__init__.py` - Lookup tables
