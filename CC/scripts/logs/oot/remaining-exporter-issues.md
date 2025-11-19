# Remaining Exporter Issues for Ocarina of Time

This file tracks outstanding issues with the OOT exporter (`exporter/games/oot.py`).

## Critical Issues

### Issue #1: Menu region not accessible at Sphere 0

**Status**: In Progress
**Priority**: P0 - Blocking all tests

**Description**:
The spoiler test fails immediately at Sphere 0 because the Menu region is not accessible. The error shows:

```
Expected regions in SPHERE that are NOT accessible in STATE: Menu, Kokiri Forest, KF Outside Deku Tree, KF Links House, KF Midos House, KF House of Twins, KF Know It All House, KF Kokiri Shop, Lost Woods, Lost Woods Bridge, LW Beyond Mido, LW Forest Exit, LW Deku Theater, LW Near Shortcuts Grotto, Sacred Forest Meadow...
```

**Root Cause**:
Needs investigation. The Menu region should be accessible from the start without any requirements.

**Next Steps**:
1. Check if the start_regions configuration is being properly exported
2. Verify that regions with no access requirements are being marked as accessible
3. Examine the rules.json file to see if Menu region has unexpected access rules
