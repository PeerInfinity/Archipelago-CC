# Remaining Exporter Issues for Secret of Evermore

This file tracks outstanding issues with the Secret of Evermore exporter.

## Critical Issue: Rule Analysis Failures

**Status**: BLOCKING - All locations have `null` access rules

**Description**: During generation, the analyzer fails to analyze or expand rules for all locations. This results in all location access_rules being set to `None/null` in the rules.json file.

**Evidence from generation output**:
```
Analysis finished without errors but produced no result (None).
Failed to analyze or expand rule for Location 'S. Jungle #0' using runtime analysis.
```
This pattern repeats for hundreds of locations.

**Impact**:
- Spoiler test fails at Sphere 0 because no locations are accessible
- 265 locations expected to be accessible in Sphere 0, but STATE shows 0 accessible
- Test output: "Locations accessible in LOG but NOT in STATE (265 locations)"

**Root Cause**:
The analyzer is unable to parse/analyze the lambda functions that define access rules in the SOE world. These lambdas likely use the custom `.has()` method from `SoEPlayerLogic`.

**Example from worlds/soe/logic.py**:
The game uses a custom `logic.has(state, progress_id, count)` method for checking progression requirements, which the analyzer doesn't understand.

**Detailed Investigation**:

After investigating, the root cause is architectural:

1. **SOE uses pyevermizer**: A C++ library wrapper that handles all game logic internally
2. **No Python lambda rules**: SOE locations don't have `access_rule` attributes set in Python
   ```python
   # From pyevermizer check:
   loc.requires = none  # No requirements exposed to Python
   loc.provides = none  # No provides exposed to Python
   ```
3. **Logic is internal**: The `SoEPlayerLogic.has(state, progress_id, count)` method queries the C++ library
4. **Exporter behavior**: The exporter correctly exports `null` for locations without Python rules

**The Problem**:
SOE's architecture is fundamentally different from games like ALTTP or Adventure that attach Python lambda rules to each location. The logic exists entirely within the evermizer C++ library and isn't exposed as analyzable Python code.

**Possible Solutions**:
1. **Convert evermizer logic to Python rules**: Would require extracting/converting all C++ logic rules
2. **Create a custom SOE logic file**: Manually define JavaScript equivalents of the evermizer logic
3. **Enhance exporter**: Add special handling for pyevermizer-based games to generate rules from the C++ library's data structures
4. **Use pyevermizer's rule data**: The evermizer library has a `get_logic()` function that returns rules - these might be exportable

**Next Steps**:
1. Investigate `pyevermizer.get_logic()` to see if it provides exportable rule structures
2. Check if other C++-based worlds have similar issues
3. Consider creating a manual JavaScript logic file for SOE as a short-term solution
