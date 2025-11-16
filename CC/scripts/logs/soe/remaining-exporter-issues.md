# Secret of Evermore - Remaining Exporter Issues

## Issue 1: Locations with NULL/missing access rules during generation

**Status:** Needs Investigation

**Description:**
During generation, many gourd locations report "Analysis finished without errors but produced no result (None)". This appears in the generation output for locations like:
- S. Jungle #0, #1, #4
- FE Village #9
- FE Village Hut #13-28 (many gourds)

**Evidence:**
```
Analysis finished without errors but produced no result (None) for Location 'S. Jungle #0'.
Analysis finished without errors but produced no result (None) for Location 'S. Jungle #1'.
...
```

**Analysis:**
The exporter's `get_location_attributes` method may not be properly handling all location types. The method tries to get evermizer requirements from raw location data, but some locations may not be in the evermizer mapping or may have issues with their access rules.

**Potential Fix:**
- Check if locations are properly mapped in `_get_location_mapping`
- Verify that `get_location_attributes` correctly handles gourd locations
- Ensure the exporter sets a default rule (constant True) for locations with no requirements

**Priority:** Medium (locations may still have rules in JSON, but warnings indicate potential issues)

---

## Issue 2: Progress ID constants missing from mapping

**Status:** Partially Resolved (exporter handles this, but documentation needed)

**Description:**
Some progress IDs used by pyevermizer don't have corresponding P_ constants in the pyevermizer module. For example:
- Progress ID 12: No P_12 constant (but used by Diamond Eye)
- Progress ID 31: No P_31 constant (but provided by logic rules)

**Evidence:**
The exporter correctly labels these as "P_12", "P_31", etc. in the progress_name field, but they don't map to actual pyevermizer constants.

**Analysis:**
The exporter's `_build_progress_map()` only captures constants that start with 'P_' and are integers. Many progress IDs are used internally by pyevermizer logic but don't have exported constants.

**Current Behavior:**
- Exporter handles this by falling back to "P_{id}" format for unmapped IDs
- This is actually correct behavior - not all progress IDs need named constants

**Action:** Document that this is expected behavior, not a bug.

---

## Summary

**Total Exporter Issues:** 1 active (Issue 1)

**Next Steps:**
1. Investigate why gourd locations report NULL analysis results
2. Verify that all locations have proper access rules in the final JSON
3. Test that locations with no requirements get `{"type": "constant", "value": true}` rules
