# Remaining General Issues

## Issue 1: Virtual event item tracking still failing despite infrastructure fixes

**Location**: `frontend/modules/testSpoilers/eventProcessor.js`, state manager

**Problem**:
Despite adding virtual event items to the items list and implementing resolved_items processing in the event processor, the test still fails at "Read Jack Be Nimble, Jack Be Thick" (Sphere 0.11).

**Test Failure**: Location requires 4 "Received Progression Percent" items, and the sphere log shows 4 items should be available at sphere 0.11, but the frontend rule evaluation fails.

**Work completed**:
- Added virtual event items to items list (exporter)
- Implemented resolved_items delta processing in event processor
- Corrected delta vs cumulative understanding

**Next steps needed**:
- Use headed test mode or browser console to verify virtual items are being added
- Check if state manager correctly tracks event items with null IDs
- Verify item_check rule evaluation works for event items
- May need to debug state manager's inventory tracking for event items

