# Remaining General Issues

## Issue 1: Test failures at Sphere 2.1 - Regions not accessible after collecting event_visited_ryuma_lighthouse_repaired

**Status**: Under investigation

**Problem**: At Sphere 2.1, the spoiler test expects many regions (Destel Well, Destel, Verla Mines, Verla Shore, Verla, etc.) to become accessible after collecting the event location `event_visited_ryuma_lighthouse_repaired`. However, the test reports these regions as not reachable.

**Expected Flow** (from sphere log):
1. Sphere 1.4: Player collects "Sun Stone"
2. Sphere 1.4: Region "Ryuma (repaired lighthouse)" becomes accessible (requires Sun Stone)
3. Sphere 1.4: Event location "event_visited_ryuma_lighthouse_repaired" becomes accessible
4. Sphere 2.1: Event location "event_visited_ryuma_lighthouse_repaired" is checked/collected
5. Sphere 2.1: Having the event should make "Mercator (docks with repaired lighthouse)" accessible
6. Sphere 2.1: From there, "Verla shore" should be accessible, leading to Verla Mines, Destel, etc.

**Current Behavior**:
- Test fails at Sphere 2.1 with 64 missing locations
- All locations in Destel Well, Destel, Verla Mines, Verla Shore, and Verla are reported as not accessible
- The test reports: "Region Destel Well is not reachable"

**Rules Chain** (from rules.json):
- "Mercator" -> "Mercator (docks with repaired lighthouse)" requires `_landstalker_has_visited_regions(["ryuma_lighthouse_repaired"])`
- This helper checks for event `event_visited_ryuma_lighthouse_repaired`
- "Mercator (docks with repaired lighthouse)" -> "Verla shore" (no requirements)
- "Verla shore" -> "Verla Mines" (no requirements)
- "Verla Mines" -> "Route between Verla and Destel" -> "Destel" and "Destel Well"

**Possible Causes**:
1. Event location with `id: null` may not be handled correctly during checking
2. The `_landstalker_has_visited_regions` helper may not find the event in the inventory/flags
3. The event may not be triggering a reachability update correctly
4. Test framework may have timing issues with event collection

**Investigation Needed**:
- Verify that event locations with `id: null` are being checked and collected properly
- Check if the event is being added to the correct state (inventory, flags, or events)
- Verify that `_landstalker_has_visited_regions` helper is checking the right state location
- Test manually with auto-collect events enabled to see if the issue persists

**Files to Review**:
- frontend/modules/stateManager/core/locationChecking.js
- frontend/modules/stateManager/core/reachabilityEngine.js
- frontend/modules/shared/gameLogic/landstalker/landstalkerLogic.js
- frontend/modules/testSpoilers/eventProcessor.js

