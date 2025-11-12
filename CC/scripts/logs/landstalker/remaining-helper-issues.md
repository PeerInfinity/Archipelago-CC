# Remaining Helper Issues for Landstalker

This file tracks unresolved issues with Landstalker helper functions.

## Issue 1: Missing `_landstalker_has_visited_regions` Helper Function

**Status**: Not fixed yet

**Description**: The helper function `_landstalker_has_visited_regions` is referenced in the rules but not implemented in JavaScript.

**Error Message**:
```
Helper function "_landstalker_has_visited_regions" NOT FOUND in snapshotInterface
```

**Impact**: Regions that depend on visiting other regions are not accessible in the frontend logic. This affects regions like:
- Crypt
- Mercator
- Mercator Dungeon
- Mir Tower sector
- Twinkle village

**Python Code** (Rules.py:12-13):
```python
def _landstalker_has_visited_regions(state: CollectionState, player: int, regions):
    return all(state.has("event_visited_" + region.code, player) for region in regions)
```

**Solution Needed**: Implement this helper function in `frontend/modules/shared/gameLogic/landstalker/helpers.js`

## Issue 2: Missing `_landstalker_has_health` Helper Function

**Status**: Unknown if needed yet

**Description**: The helper function `_landstalker_has_health` is used for Fahl's dojo challenge.

**Python Code** (Rules.py:16-17):
```python
def _landstalker_has_health(state: CollectionState, player: int, health):
    return state.has("Life Stock", player, health)
```

**Solution Needed**: May need to implement this helper function if Fahl's challenge appears in the test failures.
