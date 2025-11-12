# Solved Exporter Issues for Donkey Kong Country 3

## Issue 1: Wrong preset folder name - SOLVED ✅

**Status:** Fixed
**Priority:** High
**File:** exporter/exporter.py
**Commit:** Pending

**Description:**
The exporter was using "donkey_kong_country_3" as the preset folder name instead of "dkc3". This caused the test script to fail because it couldn't find the rules.json file in the expected location.

**Root Cause:**
The `get_world_directory_name()` function in exporter/exporter.py didn't properly match the game name declaration pattern used in DKC3's __init__.py. The function had regex patterns for:
- `game: ClassVar[str] = "Game Name"`
- `game = "Game Name"`

But DKC3 uses:
- `game: str = "Donkey Kong Country 3"`

This pattern was not matched, so the function fell back to creating a directory name from the game name by replacing spaces with underscores.

**Solution:**
Added a new regex pattern to match type-annotated game declarations:
```python
pattern = r'game:\s*[A-Za-z_]\w*(?:\[[^\]]*\])?\s*=\s*"([^"]*)"'
```

This pattern matches:
- `game: str = "Game Name"`
- `game: int = "Game Name"` (though unlikely)
- `game: Optional[str] = "Game Name"`
- And other type annotations

**Changes Made:**
- exporter/exporter.py:152-159 - Added type-annotated pattern matching

**Testing:**
- Generation now correctly creates files in `frontend/presets/dkc3/`
- Spoiler test passes for seed 2
- Extended test suite passes all 9 seeds (seeds 2-10)

**Verification:**
```bash
# Before fix:
Detected single game world (Donkey Kong Country 3), using 'donkey_kong_country_3' preset folder.

# After fix:
Detected single game world (Donkey Kong Country 3), using 'dkc3' preset folder.
```
