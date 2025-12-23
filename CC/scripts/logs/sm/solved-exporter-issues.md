# Solved Super Metroid Exporter Issues

This document tracks solved issues with the Super Metroid exporter (`exporter/games/sm.py`).

## 2025-12-23: Removed WorldGen-Related Code

**Issue:** The SM exporter had accumulated WorldGen-related code that was no longer needed since WorldGen support for this game was abandoned.

**Solution:** Reverted the exporter to commit `36902da4` which is the pre-WorldGen version.

**Changes:**
- Removed `_is_worldgen` field
- Removed `_is_worldgen_world()` method
- Removed all `if self._is_worldgen_world():` conditionals
- Removed `get_helper_definitions()` method that exported WorldGen helpers
