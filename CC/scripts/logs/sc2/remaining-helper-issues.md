# Remaining SC2 Helper Issues

## Issue 1: Enemy Intelligence locations still not accessible at Sphere 18.23

**Location:** Various helper functions

**Problem:** After fixing `terran_defense_rating` and restructuring `enemy_intelligence_*_requirement` functions, the test still fails at Sphere 18.23. The locations "Beat Enemy Intelligence" and "Enemy Intelligence: Victory" are not accessible when they should be.

**Error:** Access rule evaluation failed (no specific error, but locations not accessible)

**Possible causes to investigate:**
1. Missing items in player inventory before sphere 18.23
2. Logic in one of the nested helper functions (nova_*, terran_*, etc.)
3. Settings not being read correctly (story_tech_granted, etc.)
4. Requirements may need items that aren't available yet

**Test Status:** Still failing at Sphere 18.23

**Needs investigation:** Need to check what items player has at sphere 18.23 and manually verify each requirement

---

**Current progress:** Made good progress on fixing helper functions. The code is now structured correctly and no longer throwing errors. The logic evaluation is happening but returning false. Need to debug why the requirements aren't being met.
