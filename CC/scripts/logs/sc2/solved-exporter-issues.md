# SC2 Solved Exporter Issues

## Summary
This document tracks resolved issues with the Starcraft 2 exporter (`exporter/games/sc2.py`).

Last updated: 2025-11-17

## Resolved Issues

### Issue 1: Helper Methods Accessed as Attributes Incorrectly Exported as Self Attributes

**Status:** SOLVED

**Description:**
The exporter was converting all `logic.attribute_name` accesses to `self.attribute_name` (settings access), even when the attribute was actually a helper method. This caused many mission requirements to fail because helper methods accessed without parentheses (e.g., `logic.terran_basic_anti_air`) were being treated as settings instead of helper function calls.

**Example:**
```python
# Python code
rule = logic.terran_basic_anti_air  # Method accessed without ()

# Before fix: Exported as
{"type": "attribute", "object": {"type": "name", "name": "self"}, "attr": "terran_basic_anti_air"}

# After fix: Exported as
{"type": "helper", "name": "terran_basic_anti_air", "args": []}
```

**Solution:**
Added a `known_helpers` set to the `expand_rule()` method in `SC2GameExportHandler`. The exporter now checks if the accessed attribute is a known helper method. If yes, it converts to a helper call; if no, it converts to a self attribute access for settings.

**Impact:**
This fix resolved multiple mission unlock issues and allowed test progression from sphere 15.5 to 15.10+. Many missions that were previously inaccessible (like Cutthroat) now work correctly.

**File Modified:** `exporter/games/sc2.py`

**Commit:** 49a73761

**Code Added:**
```python
known_helpers = {
    'terran_common_unit', 'terran_early_tech', 'terran_air', 'terran_air_anti_air',
    'terran_competent_ground_to_air', 'terran_competent_anti_air', 'terran_bio_heal',
    'terran_basic_anti_air', 'terran_defense_rating', 'terran_competent_comp',
    # ... (full list in code)
}

if attr_name in known_helpers:
    # Convert to helper call
    converted_rule = {'type': 'helper', 'name': attr_name, 'args': []}
else:
    # Convert to settings access
    converted_rule = {'type': 'attribute', 'object': {'type': 'name', 'name': 'self'}, 'attr': attr_name}
```
