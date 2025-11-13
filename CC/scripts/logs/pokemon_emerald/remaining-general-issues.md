# Pokemon Emerald - Remaining General Issues

## Issue 1: Battle Frontier/Artisan Cave regions not reachable

**Status**: In Progress
**Priority**: High
**Sphere**: Fails at Sphere 8.11

### Description
The spoiler test fails at Sphere 8.11. Several Battle Frontier and Artisan Cave regions are not reachable in the STATE but are accessible in the LOG.

### Details
- **Regions not reachable**:
  - MAP_ARTISAN_CAVE_1F_LAND_ENCOUNTERS
  - MAP_ARTISAN_CAVE_B1F_LAND_ENCOUNTERS
  - REGION_ARTISAN_CAVE_1F/MAIN
  - REGION_ARTISAN_CAVE_B1F/MAIN
  - REGION_BATTLE_FRONTIER_OUTSIDE_EAST/ABOVE_WATERFALL
  - REGION_BATTLE_FRONTIER_OUTSIDE_EAST/CAVE_ENTRANCE
  - REGION_BATTLE_FRONTIER_OUTSIDE_EAST/WATER
  - REGION_BATTLE_FRONTIER_OUTSIDE_WEST/CAVE_ENTRANCE
  - REGION_BATTLE_FRONTIER_OUTSIDE_WEST/WATER

### Investigation Needed
Need to check the access rules for these regions to identify why they're not being unlocked properly.
