# Remaining General Issues for Blasphemous

This document tracks remaining general issues that don't fit into exporter or helper categories.

Status: Initial testing complete. 1 critical issue identified.

## Issues

### Issue 1: Starting items not being initialized in frontend state (CRITICAL)

**Sphere:** 0
**Impact:** 78 locations that should be accessible at start are not accessible
**Root cause:** The frontend state manager is not initializing the player's starting inventory with the items defined in the `starting_items` field of rules.json.

**Expected behavior:**
- Player should start with "Dash Ability" and "Wall Climb Ability" (defined in `starting_items["1"]`)
- These items enable access to 78 locations in sphere 0
- Spheres log shows these items in "base_items" for sphere 0

**Actual behavior:**
- Frontend state is not including these starting items in the initial inventory
- All 78 locations that require these starting items are inaccessible
- Test reports: "Locations accessible in LOG but NOT in STATE"

**Affected locations (78 total):**
Albero: Child of Moonlight, Albero: Gate of Travel room, Albero: Graveyard, Albero: Mea Culpa altar, Albero: Outside Ossuary, Albero: Tirso's house top floor, BotSS: Mea Culpa altar, BotSS: Platforming gauntlet, BotSS: Warden of the Silent Sorrow, and 69 more...

**Regions reported as not reachable:**
- RESCUED_CHERUB_08
- D01Z02S07
- D01Z02S05
- D01Z02S06
- (and many more)

**Solution needed:**
The frontend state initialization code needs to be updated to:
1. Read the `starting_items` field from rules.json
2. Add those items to the player's initial inventory before any accessibility checks
3. This is likely in the state manager initialization or the test spoiler module

**Files investigated:**
- frontend/modules/stateManager/core/initialization.js - correctly processes starting_items
- frontend/modules/testSpoilers/testSpoilerUI.js - UI layer
- frontend/modules/testSpoilers/testOrchestrator.js - orchestration layer
- frontend/modules/testSpoilers/eventProcessor.js - **FIX APPLIED HERE**

**Fix applied (Work in Progress):**
Modified `frontend/modules/testSpoilers/eventProcessor.js`:
1. Lines 165-183: Modified inventory extraction to merge both base_items and resolved_items
   - Starting items appear in resolved_items for sphere 0, not base_items
   - Now properly combines both sources to get complete inventory
2. Lines 226-239: Added logic to add newly discovered items to StateManager before checking locations
   - Ensures items from sphere log are in inventory before accessibility checks
3. Added debug logging to trace inventory values through the process

**Current status:**
Fix implemented but test still failing. Items should be added but locations still inaccessible.
Possible next steps to investigate:
- Verify StateManager worker is processing addItemToInventory calls
- Check if pingWorker timeout is sufficient
- Verify game logic helpers are recognizing the added items
- Check if region connectivity is independent issue
