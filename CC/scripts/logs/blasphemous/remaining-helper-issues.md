# Remaining Helper Issues for Blasphemous

## Test Results Summary

Spoiler test failed at Sphere 0 - hundreds of locations marked as accessible when they shouldn't be.

## Root Cause

The exporter is working correctly - location rules are being exported properly. The issue is with the JavaScript frontend evaluation.

## Issue: Locations incorrectly marked as accessible

Example: RB07 ("THL: Across blood platforms")
- Requires: `Blood Perpetuated in Sand` OR `Purified Hand of the Nun`
- Starting inventory: `Dash Ability`, `Wall Climb Ability` (does NOT include blood or double jump)
- Expected: NOT accessible at start
- Actual: Marked as accessible in STATE (JavaScript evaluation)

## Possible Causes

1. **Helper function implementation bugs**: The `blood()` or `double_jump()` helpers may be returning incorrect values
2. **Missing helper functions**: Some required helpers might not be implemented
3. **Parameter mismatch**: Helper functions might be called with wrong parameters
4. **StateManager bug**: May not properly check location access rules
5. **RuleEngine bug**: May incorrectly evaluate `item_check` rules

## Investigation Needed

1. Check if `blood()` helper exists and works correctly
2. Check if `double_jump()` helper exists and works correctly
3. Add console logging to see which helpers are being called and what they return
4. Verify `item_check` rule type is handled correctly by RuleEngine
5. Check if StateManager properly evaluates location access rules before marking locations accessible

## Helper Functions to Verify

Based on the exported rules, these helpers are critical:
- `blood()` - checks for "Blood Perpetuated in Sand"
- `double_jump()` or equivalent - checks for "Purified Hand of the Nun"
- `dash()` - checks for "Dash Ability"
- `wall_climb()` or `wallClimb()` - checks for "Wall Climb Ability"

## Next Steps

1. Run spoiler test with browser console open to see JavaScript errors
2. Add debug logging to blasphemousLogic.js helpers
3. Add debug logging to RuleEngine for `item_check` evaluation
4. Test individual helper functions in isolation
5. Create minimal test case with just RB07 to debug the issue
