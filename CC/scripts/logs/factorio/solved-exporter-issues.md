# Solved Exporter Issues for Factorio

## Issue 1a: all_of iterator evaluates to undefined

**Status:** Solved
**Priority:** Critical
**Type:** Rule Engine

**Solution:**
Added game_info.variables resolution to `statePersistence.js`. The `resolveName` function now checks `staticData.game_info[playerId].variables` for game-specific variables like `required_technologies`.

**Changes Made:**
- Modified `frontend/modules/stateManager/core/statePersistence.js` lines 532-539
- Added code to check `staticData.game_info[playerId].variables` before the location variable extraction hook

**Result:**
The `all_of` iterator now correctly resolves `required_technologies["automation-science-pack"]` to an array of technology names. No more warnings about "all_of iterator is not an array".

## Issue 1b: Missing progression_mapping export

**Status:** Solved
**Priority:** Critical
**Type:** Exporter

**Solution:**
Implemented `get_progression_mapping` method in the Factorio exporter to export progressive technology mappings.

**Changes Made:**
- Added `get_progression_mapping` method to `exporter/games/factorio.py` (lines 56-77)
- Method reads from `worlds.factorio.Technologies.progressive_technology_table`
- Exports sequential progression mappings for all progressive technologies

**Result:**
The rules.json now includes progression_mapping with entries like:
- `progressive-science-pack` → [logistic-science-pack (level 1), military-science-pack (level 2), ...]
- `progressive-automation` → [automation (level 1), automation-2 (level 2), ...]
- etc.
