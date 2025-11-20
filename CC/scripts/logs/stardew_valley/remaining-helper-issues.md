# Remaining Helper Issues for Stardew Valley

## Issue 1: Museumsanity Locations Rule Evaluation Failure

**Status**: PARTIALLY FIXED - Progression tracking works, rule evaluation still fails
**Type**: Rule Evaluation / count_true
**Priority**: HIGH

**Description**:
Three Museumsanity locations fail to be recognized as accessible in sphere 2.1:
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts

**Progress Made**:
✅ "Received Progression Percent" and "Received Progression Item" virtual items are correctly tracked
✅ The afterItemAdded hook in stardewValleyLogic.js is working correctly
✅ Progression tracking verified: 39 items = 12% at sphere 2.1 (matches Python)
✅ total_progression_items (322) is correctly loaded from game_info

**Remaining Issue**:
❌ Rule evaluation still returns undefined/not-true for these locations
❌ Test error: "Access rule evaluation failed" (locationRuleResult !== true)

**Rule Structure**:
The failing locations use complex count_true rules with:
- Traveling Merchant Metal Detector (possessed: TRUE)
- count_true (need 3 of many conditions):
  - Simple percentage checks (e.g., >= 12%, >= 8%)
  - Complex conditions with percentage + region checks

**Expected Behavior**:
At 12% progression:
- Received Progression Percent >= 12: should be TRUE
- Received Progression Percent >= 8: should be TRUE
- Need 1 more TRUE condition out of ~20 options

**Next Steps**:
1. Add debug logging to count_true evaluation to see which conditions evaluate to what
2. Check if region_check is working correctly for complex conditions
3. Verify that "Received Progression Percent" value (12) is actually in inventory during rule evaluation
4. Check if the issue is timing-related (hooks called after rule evaluation?)
