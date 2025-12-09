# The Wind Waker - Remaining Helper Issues

## Issue 1: Sphere 12.2 Inventory Timing Issue (Spoiler Test Framework)

**Status:** Under Investigation - Likely framework issue, not game logic issue

**Description:**
The spoiler test fails at Sphere 12.2 when "Triforce Shard 1" should be added to inventory. The test framework tracks 7/8 shards correctly through the test, but the 8th shard ("Triforce Shard 1") never appears in the inventory snapshot when the comparison is made.

### Impact:
- Test fails at step 48 (Sphere 12.2)
- Location "Ganon's Tower - Maze Chest" cannot be validated as accessible
- Location "Hyrule - Master Sword Chamber" also affected

### Root Cause Analysis:
This appears to be a timing/sequencing issue in the spoiler test framework (`eventProcessor.js`), specifically in how inventory is tracked for incremental sphere log format:

1. The sphere log uses incremental format (`new_inventory_details.base_items` contains only items added in that sphere)
2. At the end of each sphere processing (line ~800), `previousInventory` is overwritten with just the current sphere's `base_items` instead of accumulating
3. The `findNewlyAddedItems` function should still detect "Triforce Shard 1" as new (since it's not in previousInventory)
4. The item addition via `stateManager.addItemToInventory` should be called
5. The snapshot used for comparison may not include the newly added item

### Game Logic Status:
All `can_access_*` helper functions have been correctly implemented. The test progresses through 47 spheres successfully before failing at Sphere 12.2. The `hasGroupUnique` function correctly identifies 7/8 shards, demonstrating the helper functions work correctly.

### Next Steps:
1. Investigate if this is a known issue with the spoiler test framework for TWW
2. Check the sphereState module's inventory accumulation logic
3. Verify snapshot freshness after item addition
4. Consider if this might be resolved by a regeneration of test data

---

*Note: The original Issue 1 and Issue 2 (missing `can_access_*` helpers) have been SOLVED - see solved-helper-issues.md*
