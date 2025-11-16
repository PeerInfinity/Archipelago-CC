# Solved Exporter Issues

## Issue 1: Overcooked2Level has no shortname attribute ✅

**Error during generation:**
```
Error adding level_logic to game_info: 'Overcooked2Level' object has no attribute 'shortname'
```

**Location:** `exporter/games/overcooked2.py:56`

**Problem:** The code tried to access `level.shortname` but `Overcooked2Level` instances don't have this attribute. Only `Overcooked2GenericLevel` instances have it.

**Impact:** level_logic was not added to game_info in the rules.json file.

**Fix:** Changed `level.shortname` to `level.as_generic_level.shortname` at line 56.

**Status:** FIXED - level_logic now exports successfully with 45 entries.
