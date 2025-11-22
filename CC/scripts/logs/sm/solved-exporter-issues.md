# Solved Exporter Issues

## Issue 1: RomPatches.has() function calls

**Status:** RESOLVED

**Description:** Access rules contained `RomPatches.has(patch_id)` function calls that the frontend couldn't evaluate.

**Solution:** Added RomPatches resolution to exporter (exporter/games/sm.py:356-381). The exporter now resolves `RomPatches.has()` calls to constant true/false values at generation time, since ROM patches are fixed when the seed is created and don't change during gameplay.

**Files modified:**
- exporter/games/sm.py

