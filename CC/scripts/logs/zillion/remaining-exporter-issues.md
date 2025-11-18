# Remaining Exporter Issues for Zillion

This file tracks outstanding issues with the Zillion exporter.

## Issues

## Progress Summary

- **Initial Status**: Sphere 0 failure with 200+ locations accessible in STATE but not in LOG
- **After fixing prevent_deduplication parameter**: Sphere 0 PASSES! Now failing at Sphere 0.1
- **Current Status**: 147 locations exported, test fails at Sphere 0.1 with 135 locations too permissive

## Remaining Issues

### Issue 1: Access rules too permissive after Sphere 0

**Status**: In Progress

**Description**: After fixing the prevent_deduplication parameter error, the exporter now successfully tests access rules using `location.access_rule(cs)`. However, the exported rules are too permissive - many locations are marked as accessible when they shouldn't be.

**Symptom**: Test passes Sphere 0, but fails at Sphere 0.1. After collecting 1 Floppy Disk, 135 locations become accessible in STATE but should NOT be accessible according to the LOG.

**Root Cause**: When testing access rules with fresh CollectionStates during export, Zillion's ZillionLogicCache may not properly reflect the actual game state. The logic cache queries zilliandomizer's pathfinding which depends on global state.

**Potential Solutions**:
1. Test access rules by simulating actual sphere progression rather than isolated states
2. Combine zilliandomizer req fields with region reachability analysis
3. Investigate zilliandomizer's get_locations() behavior with different collection states
4. Consider if empty item placements are affecting pathfinding

### Issue 2: Not all locations exported

**Status**: Identified

**Description**: Only 147 out of ~232 locations are being exported to rules.json

**Possible Causes**:
- Locations with pre-placed "keyword" items are not in `world.my_locations`
- Some locations may be excluded by game settings
- Access rule generation may timeout or fail for certain locations
