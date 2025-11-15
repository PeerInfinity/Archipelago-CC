# Pokemon Red/Blue - Remaining General Issues

## Test Run Information
- **Date**: 2025-11-15
- **Seed**: 1

## Current Status
Spoiler test fails at sphere 6.18 with region accessibility mismatches.

## ROOT CAUSE IDENTIFIED

### Issue 1: StateManager Not Incrementing Item Counts
**Severity**: CRITICAL
**Type**: StateManager Bug (affects all games, not just Pokemon RB)
**Sphere**: All spheres

**Description**:
The StateManager is initializing all 366 items in the inventory with a count of 0, but it is NOT incrementing the counts when locations are checked and items are collected.

**Evidence**:
```
Snapshot Debug Output (Sphere 6.18):
- inventoryItemCount: 366 (all items present)
- itemsWithCounts>0: 0 (NO items have count > 0!)
- eventsCount: 0 (events array is empty)
- flagsCount: 0 (flags array is empty)
- hasHM in inventory: 0 (should be 1)
- hasBadge in inventory: 0 (should be 1)
```

**Expected Behavior**:
- When a location is checked, the item at that location should be added to inventory with count incremented by 1
- Event items (items with id=None) might go into the `events` array instead
- Regular items (items with real IDs) should go into `inventory` with proper counts

**Actual Behavior**:
- All items are in inventory but with count=0
- No items are being incremented when collected
- Events and flags arrays remain empty

**Impact**:
- All helper functions that check for items return false
- All regions/locations that require items are inaccessible
- Spoiler test fails because no progression is possible beyond initial items

**Item Categories in Pokemon RB**:
- 207 non-event items (HMs, Badges, regular items) - have real IDs
- 159 event items (evolved Pokemon, defeats) - have id=None

**Test Items**:
- HM03 Surf: non-event, id=172000198, advancement=True
- Soul Badge: non-event, id=172000025, advancement=True
- Defeat Brock: event, id=None, advancement=True
- Pidgey: event, id=None, advancement=True

**Next Steps**:
1. Investigate StateManager's location checking logic
2. Find where items should be added to inventory
3. Check if there's a difference between test mode and normal mode
4. Fix the inventory increment logic
5. Re-run spoiler test to verify fix

**Files to Investigate**:
- `frontend/modules/stateManager/*` - State management logic
- `frontend/modules/testSpoilers/*` - Spoiler test harness
- Look for where `snapshot.inventory[itemName]` should be incremented

**Notes**:
- This is NOT a Pokemon RB exporter issue
- This is NOT a Pokemon RB helper function issue
- This is a CORE StateManager bug affecting item collection
- Once fixed, Pokemon RB (and possibly other games) should work correctly
