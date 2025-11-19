# Remaining General Issues for Stardew Valley

This document tracks general issues that need to be fixed.

## Issue 1: Museumsanity locations failing to evaluate in Sphere 2.1

**Status:** Investigating
**Priority:** High

### Problem
Three Museumsanity locations are not being recognized as accessible in Sphere 2.1:
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts

Error: "Access rule evaluation failed" (no details provided in logs)

### Analysis
- These locations use complex `count_true` rules with many nested conditions
- The `count_true` rules contain multiple `region_check` conditions
- The rule engine supports both `count_true` and `region_check` types
- Added recursion protection to `isRegionReachable` (similar to `isLocationAccessible`)
- Test still fails at the same point after the recursion fix

### Current Test Status
- Test processes 37/322 events successfully
- Fails at Sphere 2.1 (step 38)
- Sphere 0 now passes completely (was failing before due to starting items bug)

### Next Steps
1. Get more detailed error messages from the rule evaluator to identify the exact failure
2. Analyze the complex count_true rules to find what condition is causing evaluation to fail
3. Test with simpler Museumsanity rules to isolate the issue
4. Check if there are any undefined values or errors being passed to the rule engine
5. Verify that the `count_true` rule type is working correctly with nested conditions
