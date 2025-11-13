# Kingdom Hearts 2 - Remaining Helper Issues

This file tracks unresolved issues with the KH2 helper functions (frontend/modules/shared/gameLogic/kh2/).

## Issues

### Issue 1: Simplified Fight Logic Causing Early Region Access
**Status**: In Progress
**Priority**: Medium
**Location**: frontend/modules/shared/gameLogic/kh2/kh2Logic.js:409-455
**Description**: Fight logic helpers are implemented with simplified logic that always returns true, causing fight regions to be accessible earlier than they should be.

**Affected Helpers**:
- `get_beast_rules()` - Currently returns true, should check fight_logic setting
- `get_thresholder_rules()` - Currently returns true, should check for drive forms, black magic, and defensive tools
- `get_prison_keeper_rules()` - Currently returns true, should check for defensive tools, drive forms, and party limits

**Impact**:
- Beast region accessible at Sphere 1.11 instead of later
- Thresholder region accessible at Sphere 1.11 instead of later
- 15 locations accessible earlier than expected
- Test fails at Sphere 1.11 with "Extra in state" mismatch

**Root Cause**:
The `fight_logic` setting is not currently exported in the rules.json settings section. Without this setting, we cannot properly implement the difficulty-based fight logic.

**Proper Implementation Would Require**:
1. Export `fight_logic` setting in rules.json (exporter change needed)
2. Implement helper functions like `kh2_list_any_sum()` that count items from different categories
3. Define item lists for:
   - `defensive_tool` - defensive abilities
   - `form_list` - drive forms
   - `party_limit` - party limit attacks
   - `black_magic` - black magic spells

**Workaround Options**:
1. Make fight helpers check for at least SOME requirements (partial implementation)
2. Wait for fight_logic setting to be exported
3. Accept that fights are accessible earlier in easy mode

**Recommendation**:
Since the test now progresses from Sphere 0.3 to Sphere 1.11 (a major improvement), and the issue is that regions are accessible too early (less critical than not accessible at all), this can be deferred until fight_logic settings are properly exported.

## Summary

**Current Test Status**: Fails at Sphere 1.11 (was Sphere 0.3 before fixes)
**Progress**: Test now reaches Sphere 1.11 - massive improvement!
**Remaining Issue**: Fight logic helpers need full implementation with difficulty settings
