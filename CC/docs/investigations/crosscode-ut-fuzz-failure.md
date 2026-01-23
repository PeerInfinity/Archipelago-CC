# CrossCode APWorld UT Fuzzer Failure Investigation

**Date:** 2026-01-23
**APWorld Version:** 0.8.0-pre.1
**Source:** https://github.com/CodeTriangle/CCMultiworldRandomizer
**Test Results:** 0/10 pass rate (100% failure)
**Error Type:** Logic mismatch (None type)

## Summary

The CrossCode apworld fails the Universal Tracker (UT) fuzz test due to a **fundamental incompatibility** between CrossCode's custom condition-based rule system and the exporter/Rule Builder architecture.

## Root Cause

### CrossCode's Rule System

CrossCode uses a custom object-oriented condition system instead of standard Archipelago lambda rules. The key files are:

- `crosscode/types/condition.py` - Defines condition classes:
  - `ItemCondition` - Check if player has an item
  - `QuestCondition` - Check if quest is complete
  - `LocationCondition` - Check if location is accessible
  - `RegionCondition` - Check if region is reachable
  - `OrCondition`, `AndCondition` - Logical combinations
  - `VariableCondition` - Option-dependent checks
  - `AnyElementCondition` - Element check
  - `NeverCondition` - Always false

- `crosscode/logic.py` - Factory function that creates rules:
  ```python
  def condition_satisfied(player, conditions, location, cond_args):
      def conditions_satisfied_internal(state):
          return all(c.satisfied(state, player, location, cond_args) for c in conditions)
      return conditions_satisfied_internal
  ```

### How Rules Are Exported

When the exporter analyzes CrossCode's rules, it encounters:
```python
all(c.satisfied(state, player, location, cond_args) for c in conditions)
```

This gets exported as:
```json
{
  "rule": "AST_all_of",
  "args": {
    "element_rule": {
      "type": "function_call",
      "function": {"type": "attribute", "object": {"name": "c"}, "attr": "satisfied"},
      "args": [...]
    }
  }
}
```

### The Problem

1. **Condition objects are serialized incorrectly** - The exporter converts condition objects to their string representation (e.g., `"item_name='Green Leaf Shade', amount=1"`) instead of extracting the actual item requirement.

2. **Complex LogicDict is dumped as-is** - The `cond_args` parameter contains:
   - `item_progressive_replacements` - Maps base items to progressive equivalents
   - `variable_definitions` - Option-dependent conditions
   - `keyrings` - Key grouping information
   - These appear in the JSON but aren't processed

3. **Raw Python objects leak into JSON** - Some conditions like `NeverCondition` appear as:
   ```json
   "<worlds.crosscode.types.condition.NeverCondition object at 0x7ead3e587150>"
   ```

4. **World generator produces broken rules** - The generated `Rules.py` has malformed rules:
   ```python
   Has('item_name=\'Green Leaf Shade\', amount=1')  # Should be: Has('Green Leaf Shade')
   ```

### Result

- **Server (original CrossCode)**: Correctly evaluates conditions using the `Condition.satisfied()` method
- **UT (worldgen-based)**: Cannot evaluate the `AST_all_of` + `function_call` pattern, defaulting to False
- **Locations accessible**: Server sees many locations accessible; UT sees almost none

## Technical Details

### Failing Test Output

```
Locations `Petty Crime Hunter - Reward 2,It Can Dig But It Can't Hide...` were in server logic but not expected in UT
UT logic sphere `Rookie Harbor Disc,Rookie Harbor Shade,Faction Introduction,Railing Rider`
Current Inventory = [Progressive Overworld Area Unlock]
UT accessible regions `Menu,open2`
```

The player has `Progressive Overworld Area Unlock:1`, which should grant access to areas like Autumn's Rise. However:
- The UT cannot evaluate the progressive item replacement logic embedded in `cond_args`
- The `open2 => open3` entrance rule requires `Green Leaf Shade` but:
  - The rule is `Has('item_name=\'Green Leaf Shade\', amount=1')` (malformed)
  - Progressive replacement to `Progressive Overworld Area Unlock` is not applied

### Configuration That Failed

```yaml
CrossCode:
  progressive_area_unlocks: overworld  # Uses Progressive Overworld Area Unlock
  keyrings: 'false'
  quest_rando: 'true'
  # ... other options
```

## Resolution Options

### Option 1: Create Custom CrossCode Exporter (Recommended)

Create `exporter/games/unofficial/crosscode.py` that:

1. **Recognizes CrossCode's condition patterns** - Detect `c.satisfied()` calls in `all()` expressions
2. **Extracts condition data** - Parse `ItemCondition`, `QuestCondition`, etc. from the serialized format
3. **Handles progressive item replacement** - Convert `item_progressive_replacements` to proper Rule Builder syntax
4. **Converts to Rule Builder format** - Transform conditions to `Has()`, `HasAny()`, `CanReach()` etc.

Example conversion:
```python
# From CrossCode's condition system:
ItemCondition(item_name='Green Leaf Shade', amount=1)
# With progressive_replacements including "Progressive Overworld Area Unlock"

# To Rule Builder:
HasAny('Green Leaf Shade', 'Progressive Overworld Area Unlock')
```

**Complexity**: High - CrossCode's condition system is complex with many condition types and the `cond_args` dictionary containing option-dependent logic.

### Option 2: Report to APWorld Maintainer

The CrossCode apworld could be updated to use Archipelago's standard rule system instead of custom conditions. This would:
- Make it compatible with the exporter out-of-the-box
- Allow UT tracking to work correctly

**Repository**: https://github.com/CodeTriangle/CCMultiworldRandomizer
**Issue to report**: The custom `Condition` class system is incompatible with rule export/analysis tools.

### Option 3: Add to Known-Incompatible List

If fixing is not feasible, add CrossCode to a list of apworlds known to be incompatible with UT tracking, with documentation explaining why.

## Files Examined

- `custom_worlds/crosscode.apworld` - The apworld package
- `crosscode/types/condition.py` - Condition class definitions
- `crosscode/logic.py` - Rule factory function
- `frontend/presets/crosscode/AP_*/AP_*_rules.json` - Exported rules
- `worlds/crosscode_worldgen_*/Rules.py` - Generated rules (malformed)
- `exporter/games/unofficial/minit.py` - Example of custom handler

## Conclusion

The CrossCode apworld is **fundamentally incompatible** with the current UT fuzz testing infrastructure due to its custom condition-based rule system. A custom exporter would be required to properly convert CrossCode's conditions to Rule Builder format, which would be a significant development effort given the complexity of CrossCode's logic system.

**Recommendation**: Report the incompatibility to the apworld maintainer and add CrossCode to a known-incompatible list until either a custom exporter is developed or the apworld adopts standard Archipelago rules.
