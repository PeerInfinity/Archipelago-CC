# UT Fuzzer Analysis: The Legend of Zelda - Oracle of Seasons

**Date:** 2026-01-23
**APWorld Version:** oos-13.7.4
**Source:** https://github.com/Dinopony/ArchipelagoOoS

## Summary

The Oracle of Seasons (OoS) apworld fails Universal Tracker (UT) fuzzer testing with 0% success rate. The failure is due to **fundamental incompatibility between the apworld's rule structure and the exporter/worldgen system**.

## Root Cause Analysis

### Primary Issue: Parameterized Helper Functions

The OoS apworld uses helper functions with **additional parameters beyond `(state, player)`**. These parameterized helpers cannot be properly analyzed by the exporter, causing them to be dropped from the rules.json export while rules that reference them are still exported.

**Affected helpers (undefined in worldgen Rules.py):**

| Helper Function | Extra Parameters |
|----------------|------------------|
| `oos_can_jump_1_wide_liquid` | `can_summon_companion: bool` |
| `oos_can_break_mushroom` | `can_use_companion: bool` |
| `oos_season_in_lost_woods` | `season: int` |
| `oos_self_locking_item` | `region_name: str, item_name: str` |

### Secondary Issues

1. **Infinite Loop Detection**: The exporter hits the 10,000 call limit when analyzing complex helpers, causing them to be skipped:
   ```
   Error analyzing helper 'oos_can_jump_1_wide_liquid': analyze_rule called 10243 times - likely infinite loop
   ```

2. **Large Source Files**: The OverworldLogic.py file (1515 lines) requires fallback to `getsource`, complicating analysis.

3. **Runtime Option Access**: Many helpers access `state.multiworld.worlds[player].options.*` at runtime, which can't be statically analyzed.

4. **Complex Rule Patterns**: Rules use nested lambda functions and data structures that don't match the typical Archipelago pattern:
   ```python
   # OoS pattern (OverworldLogic.py)
   holodrum_logic = [
       ["region_from", "region_to", False, lambda state: helper(state, player, extra_param)],
       ...
   ]
   ```

## Error Chain

1. **Export phase**: Exporter encounters parameterized helper calls
2. **Analysis fails**: Hits infinite loop detection or can't resolve extra parameters
3. **Partial export**: Helper definitions are dropped, but rules referencing them remain as raw AST
4. **Worldgen fails**: Generated Rules.py contains calls to undefined helpers
5. **UT fails**: `NameError: name 'oos_can_jump_1_wide_liquid' is not defined`

## Statistics

From fuzzer run:
- **Total helpers in apworld**: 133+ (in LogicPredicates.py)
- **Successfully exported helpers**: 79
- **Missing/undefined helpers**: 4 (minimum, likely more)
- **Rules.json size**: 1.5 MB (indicates complex rules)

## Reproduction

```bash
# With extended timeout to see actual failure (not timeout)
python fuzz.py -r 1 -j 1 -g tloz_oos -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0 -t 120
```

## Classification

**Failure Type:** Fundamental Incompatibility
**Fixable in our codebase:** Partially - would require significant exporter changes
**Requires apworld changes:** Ideally, but unlikely to get upstream changes

## Potential Fixes

### Option 1: Exporter Enhancement (Complex)

Enhance the exporter to handle parameterized helpers:
- Detect parameterized helper patterns
- Generate helper wrappers that accept extra parameters
- Track parameter usage through rule analysis

**Effort:** High
**Risk:** May introduce other issues

### Option 2: Helper Stub Generation (Medium)

When a helper can't be analyzed but is referenced, generate a stub:
- Detect referenced but undefined helpers
- Generate `def helper(...): return False` stubs
- Log warning about incomplete analysis

**Effort:** Medium
**Risk:** Rules won't work correctly, but won't crash

### Option 3: Add to Known-Incompatible List (Simple)

Document this apworld as incompatible with UT tracking:
- Add to exclusion list
- Skip in fuzzer testing
- Note in documentation

**Effort:** Low
**Risk:** None, but loses UT support for this game

## Recommendation

**Short term:** Add to known-incompatible list (Option 3)

**Medium term:** Implement Option 2 (stub generation) to prevent crashes while marking rules as incomplete

**Long term:** Consider Option 1 if there's demand for OoS UT support

## Files Modified/Created

- `CC/docs/findings/tloz_oos-fuzzer-analysis.md` (this file)

## Related Files

- `custom_worlds/tloz_oos.apworld` - The apworld package
- `tloz_oos/data/logic/LogicPredicates.py` - Helper function definitions
- `tloz_oos/data/logic/OverworldLogic.py` - Rule definitions with lambdas
- `exporter/analyzer/analysis.py` - Rule analysis logic (infinite loop detection)
- `worlds/tracker/fuzzer_hook.py` - UT fuzzer validation
