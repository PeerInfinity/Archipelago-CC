# Remaining Exporter Issues

## Issue: Test failing at Sphere 3.2 - "Job: My Navi is sick" not accessible

**Status**: Under investigation
**Sphere**: 3.2
**Location**: Job: My Navi is sick
**Required Item**: Recov30 *

**Problem Description**:
The spoiler test fails at sphere 3.2. The location "Job: My Navi is sick" requires the item "Recov30 *", which should be obtained from checking "Job: Legendary Tomes - Treasure" in the same sphere. However, the JavaScript frontend reports that "Job: My Navi is sick" is not accessible after checking the location.

**Debug Findings**:
- Item "Recov30 *" exists in inventory but has value 0 (not 1 as expected)
- The item is defined correctly in rules.json with `advancement: true`
- The location "Job: Legendary Tomes - Treasure" contains the item in its definition
- `addItemToInventory` is never called for "Recov30 *" during the test

**Hypothesis**:
There appears to be an issue with how items are added to inventory when locations are checked during spoiler tests. The StateManager (running in a web worker) is not properly adding items to inventory, even though the location checking flow is triggered.

**Next Steps**:
- Investigate the StateManager worker's location checking implementation
- Verify that the `addItems` parameter is being passed correctly through the event system
- Check if there's a special case for spoiler test mode that's preventing items from being added

