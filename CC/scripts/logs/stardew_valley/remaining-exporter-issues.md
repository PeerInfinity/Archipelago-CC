# Remaining Exporter Issues for Stardew Valley

This file tracks exporter issues that still need to be fixed.

## Issue 1: Museumsanity artifact/donation milestones - Incorrect rule export

**Affected Locations:**
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts
- (Possibly all Museumsanity milestone locations)

**Problem:**
The exported count_true rule for these locations contains flattened conditions that don't match the actual Python logic.

**Python Logic (Expected):**
```python
# From rules.py line 634
rule = logic.museum.can_find_museum_artifacts(3) & logic.received(metal_detector, required_detectors)

# This expands to:
Count(3, [can_find_museum_item(artifact1), can_find_museum_item(artifact2), ...])
```

Each `can_find_museum_item()` has complex conditions involving regions, geodes, time, etc.

**Exported Logic (Actual):**
The count_true rule contains a mix of:
- 7 simple item_check conditions for "Received Progression Percent"
- 14 complex "and" conditions combining progression percent + region checks

**Why It Fails:**
At sphere 2.1 with 12 "Received Progression Percent":
- Only 2 simple checks are TRUE (>= 8, >= 12)
- Need 3 conditions TRUE, but the complex "and" conditions require regions not yet accessible

**Root Cause:**
The exporter is likely incorrectly flattening or expanding the nested Count rules from the museum logic. The individual artifact conditions should be exported as-is, not pre-expanded into progression percent checks.

**Files to Investigate:**
- `exporter/games/stardew_valley.py` - Count rule serialization (line 312-344)
- `exporter/analyzer.py` - Rule analysis and expansion
- `worlds/stardew_valley/logic/museum_logic.py` - Original Python logic

**Next Steps:**
1. Trace how the nested Count(can_find_museum_item(...)) rules are being serialized
2. Verify if the individual museum item conditions are being correctly preserved
3. Check if there's premature rule evaluation/expansion happening during export

