# Secret of Evermore - Remaining Helper Issues

## Issue 1: Access rule evaluation failures at Sphere 4.1

**Status:** Under Investigation

**Description:**
At Sphere 4.1, several locations that should be accessible are not being made accessible by the frontend. The error message says "Access rule evaluation failed" but doesn't provide specific details.

**Affected Locations:**
- Aquagoth
- Barrier
- Double Drain
- Oglin Cave #179
- Tiny
- Tiny's hideout #158-164

**Common Requirements:**
These locations require `has(31, 1)` (P_31). Rule 3 should provide P_31 when the player has P_WEAPON + 2x P_12. At Sphere 4.1, the player has Knight Basher (P_WEAPON) and 2x Diamond Eye (2x P_12), so P_31 should be available.

**Possible Causes:**
1. The `countProgress` function might not be correctly evaluating logic rules
2. There might be a JavaScript error in the rule engine when evaluating these specific rules
3. The circular dependency protection (`visitedRules`) might be preventing valid rules from being evaluated

**Next Steps:**
1. Add more detailed logging to the `countProgress` function to see what's happening
2. Check if P_31 is being counted correctly
3. Verify that Rule 3 is being processed when checking for P_31

---
