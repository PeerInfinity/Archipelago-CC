# Remaining Exporter Issues

## Issue 1: Over-aggressive region reachability simplification for laser activations

**Symptom:**
- Locations accessible in STATE but NOT in LOG in Sphere 0: Town Laser Activated, Bunker Laser Activated, Swamp Laser Activated, Treehouse Laser Activated
- These lasers have `{"type": "constant", "value": true}` as their access rule in rules.json
- Actual accessibility from sphere log:
  - Swamp Laser: becomes accessible in sphere 4.1
  - Bunker Laser: becomes accessible in sphere 5.5
  - Town Laser: becomes accessible in sphere 6.5
  - Treehouse Laser: becomes accessible in sphere 7.2

**Root Cause:**
The `WitnessGameExportHandler.postprocess_rule()` method simplifies ALL region reachability patterns to `{"type": "constant", "value": true}`. This is incorrect for laser activation events, which require reaching the region containing the laser panel.

These laser activations are event locations in the "Entry" region, but their access depends on being able to reach other regions (e.g., Town Laser requires reaching "Town Tower Top", Bunker Laser requires reaching "Bunker Laser Platform", etc.).

**Proper Solution:**
The analyzer needs to be enhanced to detect `region.can_reach(state)` method calls and convert them directly to `can_reach` rules with the proper region name, before analyzing the method's source code. This requires tracking which object a bound method is attached to during analysis.

**Current Workaround:**
Temporarily simplifying all region checks to constant true. This makes lasers accessible earlier than they should be, but allows the JavaScript engine to evaluate the rules. The test will fail on sphere accuracy but at least won't crash.

**Files Affected:**
- exporter/games/witness.py: postprocess_rule method

## Issue 2: Keep Laser Activated has broken all_of rule with string representations

**Symptom:**
- Keep Laser Activated has an `all_of` rule with an iterator containing string representations of Python objects like `"<bound method Region.can_reach of Keep 3rd Pressure Plate>"` instead of actual rule structures
- Example from rules.json:
  ```json
  {
    "type": "all_of",
    "element_rule": {"type": "helper", "name": "condition", "args": []},
    "iterator_info": {
      "type": "comprehension_details",
      "iterator": {
        "type": "constant",
        "value": [
          "<bound method Region.can_reach of Keep 3rd Pressure Plate>",
          "<function convert_requirement_option.<locals>.<lambda> at 0x...>"
        ]
      }
    }
  }
  ```

**Root Cause:**
The exporter's analyzer is not properly handling the comprehension/generator expression used in the Keep Laser's access rule. When it encounters a list/generator containing bound methods or lambda functions, it converts them to their string representations instead of analyzing what those callables do.

**Solution:**
The analyzer needs to:
1. Detect when comprehension iterators contain callable objects (bound methods, lambdas, functions)
2. Either analyze each callable and export its logic, or convert the entire comprehension to a different pattern
3. For region.can_reach methods specifically, convert them to `can_reach` rules with the region name extracted from the bound method

**Files Affected:**
- exporter/analyzer.py: Comprehension handling code
- May need changes in how iterators are processed for all_of rules

