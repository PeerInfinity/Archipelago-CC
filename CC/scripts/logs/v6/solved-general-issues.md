# VVVVVV Solved General Issues

This document tracks resolved general issues for VVVVVV.

## Solved Issues

### 1. Fixed get_world_directory_name to support game: str pattern
**Status:** SOLVED
**Priority:** High
**Solution Date:** 2025-11-12

**Problem:**
The `get_world_directory_name` function in `exporter/exporter.py` didn't recognize the pattern `game: str = "VVVVVV"` used in the v6 world's `__init__.py`. It only looked for `ClassVar[str]` or plain `game = "..."` patterns, causing files to be generated in the wrong directory (`frontend/presets/vvvvvv/` instead of `frontend/presets/v6/`).

**Solution:**
Added support for typed variable patterns in the `get_world_directory_name` function:
- Added pattern: `game: str = "Game Name"`
- Added pattern: `game: str = 'Game Name'`

**Files Changed:**
- `exporter/exporter.py` (modified)

**Result:**
VVVVVV files are now correctly generated in `frontend/presets/v6/` directory, and npm test can find the game with `--game=v6`.

## Summary
All VVVVVV issues have been resolved:
- ✓ Exporter correctly exports door_cost and area_cost_map
- ✓ Helper function _has_trinket_range implemented
- ✓ Files generated in correct directory (v6)
- ✓ All 13 spheres pass in spoiler test
- ✓ No location or region reachability issues
