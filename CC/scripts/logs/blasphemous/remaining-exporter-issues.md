# Blasphemous Exporter Issues (Remaining)

## Issue 1: Rules failing to evaluate properly - locations unreachable

**Status**: Investigating (Moving to helper issues)
**Priority**: High

### Description
After fixing the exporter issues (item_check wrapping, invalid rule types), the test now shows "Locations accessible in LOG but NOT in STATE" for Sphere 0. This indicates:
- The region graph is properly exported (Menu -> D17Z01S01 with exits)
- Access rules are being created correctly
- But rules are failing to evaluate to `true` when they should

### Root Cause Analysis
Investigation shows:
1. ✅ Region exits are properly exported to rules.json
2. ✅ Menu region connects to D17Z01S01 (starting region)
3. ✅ item_check rules no longer have wrapped item names
4. ✅ No invalid rule types (capability, boss_check, etc.)
5. ❓ Rules may be failing due to:
   - Missing helper functions in blasphemousLogic.js
   - Helper functions returning wrong values
   - Helper functions throwing exceptions

This issue is likely a **helper function problem**, not an exporter problem.

### Test Observations
- 75+ locations expected to be accessible in Sphere 0 are not reachable
- Regions like D01Z02S07, D01Z02S05, D01Z02S06, D01Z02S04, D01Z02S02 not accessible
- Item regions like CO25, RB08, RB202, CO05, CO29, RB15, CO01, CO33, QI41, HE06, QI46 not reachable

### Next Steps
Move investigation to helper-issues.md and focus on identifying failing helper functions.
