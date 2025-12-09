# Remaining Helper Issues - Landstalker

Last updated: 2025-12-09

## Status: No remaining issues

All spoiler tests pass (53/53 spheres). The helper functions correctly handle:

1. **`_landstalker_has_visited_regions`** - Checks if player has all `event_visited_` flags for required regions
2. **`_landstalker_has_health`** - Checks if player has enough Life Stock items
3. **`has`** - Core item check with progressive item support
4. **`count`** - Item counting

## Helper File Location

`frontend/modules/shared/gameLogic/landstalker/landstalkerLogic.js`

## Notes

The helper functions handle:
- Event checking via flags and events arrays
- Progressive item chain resolution
- Region visit tracking via `event_visited_` events
- Health requirements via Life Stock counting
