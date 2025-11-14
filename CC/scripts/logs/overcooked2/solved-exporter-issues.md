# Overcooked! 2 - Solved Exporter Issues

## Issue 1: Entrance rules not properly expanded

**Date Solved:** 2025-11-14
**Priority:** HIGH

**Description:**
Entrance rules from Overworld to level regions were being analyzed and inlined, resulting in references to undefined helpers (`overworld_logic`) and unresolved variables (`visited`, `star_count`, `previous_level_completed_event_name`).

**Solution:**
Implemented `override_rule_analysis` method in `Overcooked2GameExportHandler` to intercept entrance rule analysis before the analyzer inlines the function body. The method:
1. Detects lambda functions that call `has_requirements_for_level_access`
2. Extracts closure variables (level_name, previous_level, required_stars, allow_tricks)
3. Returns a clean helper structure with resolved constants as arguments

The `postprocess_rule` method then calls `expand_rule` which expands the `has_requirements_for_level_access` helper using `_expand_level_access_rule` to generate proper entrance rules with:
- Overworld region access checks (ramp requirements)
- Kevin item checks for Kevin levels
- Star count requirements
- Previous level completion requirements

**Files Modified:**
- `exporter/games/overcooked2.py`: Added `override_rule_analysis` and `postprocess_rule` methods, enhanced `_resolve_variables_in_rule` method

**Test Results:**
- Entrance rules now properly expand to constant true for accessible levels (e.g., 1-1, 2-1, 4-1)
- Regions 1-1, 2-1, 4-1 are now reachable in the spoiler test
- No more "Region X is not reachable" errors
