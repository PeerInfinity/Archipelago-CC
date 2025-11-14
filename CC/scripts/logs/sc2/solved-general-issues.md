# Solved SC2 General Issues

## Issue 1: SC2 exporter pattern recognition for logic object

**Status:** ✅ SOLVED

**Description:**
SC2's Python code uses a pattern where access rules reference a `logic` object with both methods and attributes:
- Methods: `logic.terran_early_tech()`, `logic.zerg_common_unit()`
- Attributes: `logic.story_tech_granted`, `logic.advanced_tactics`

**Solution:**
The SC2 exporter (`exporter/games/sc2.py`) implements custom `expand_rule` method that:
1. Converts `logic.method_name()` function calls to helper calls
2. Converts `logic.attribute_name` attribute access to `self.attribute_name` (for settings resolution)

This pattern recognition was already implemented in the initial exporter code.

**Files:**
- `exporter/games/sc2.py`
