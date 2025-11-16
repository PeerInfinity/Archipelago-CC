# Solved Exporter Issues

## Issue #1: Wrong level_id used for has_requirements_for_level_star

**Problem:**
The exporter was extracting level_id from the shuffled level object and passing it to the JavaScript helper. But level_logic in the JSON only contained Story DLC mappings (level_id 1-44), so when a shuffled level from a different DLC (e.g., "Chinese 1-3" with DLC-specific level_id=7) was used, it would lookup the wrong requirements.

**Solution:**
- Changed exporter to extract and pass the shortname (e.g., "Story 1-1", "Chinese 1-3") instead of level_id
- Updated get_game_info to keep level_logic with shortname keys (as-is from Python) instead of converting to level_id keys
- Updated JavaScript helper to accept shortname parameter and lookup level_logic by shortname
- Also fixed the helper to properly implement the Python logic: check global "*" requirements first, then check all star levels up to the requested count

**Files changed:**
- exporter/games/overcooked2.py (override_rule_analysis and get_game_info methods)
- frontend/modules/shared/gameLogic/overcooked2/helpers.js (has_requirements_for_level_star function)

**Result:**
Star location access rules now work correctly with level shuffle enabled.

