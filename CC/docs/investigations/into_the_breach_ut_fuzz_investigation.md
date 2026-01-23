# Into the Breach UT Fuzz Test Investigation

**Date:** 2026-01-23
**APWorld Version:** v0.15.18
**Source:** https://github.com/Ishigh1/ITB-randomizer-for-AP/releases/download/v0.15.18/into_the_breach.apworld

## Summary

The Into the Breach apworld fails the Universal Tracker fuzz test with two distinct error types:
1. **Missing `python-sat` dependency** (~50% of runs)
2. **Rules export bug** (~50% of runs)

**Conclusion:** This apworld is **not compatible** with the current Universal Tracker system due to fundamental issues in both dependency management and rules export.

## Error Distribution

From 10 test runs:
- `No module named 'pysat'`: 5 runs (50%)
- `None` (rules export issue): 5 runs (50%)
- Success: 0 runs (0%)

## Issue 1: Missing `python-sat` Dependency

### Description

The apworld requires the `python-sat` package for squad randomization. When `randomize_squads: true` is selected (default with 50% weight), the generation fails with an ImportError.

### Error Traceback

```
File "/home/user/Archipelago-CC/custom_worlds/into_the_breach.apworld/into_the_breach/__init__.py", line 100, in generate_early
    self.squads = shuffle_teams(self.random, filtered_squad_names, unit_plando)
File "/home/user/Archipelago-CC/custom_worlds/into_the_breach.apworld/into_the_breach/squad/SquadRando.py", line 13, in shuffle_teams
    from pysat.solvers import Glucose42
ModuleNotFoundError: No module named 'pysat'
```

### Root Cause

The apworld's `requirements.txt` contains:
```
python-sat
```

However, Archipelago doesn't automatically install dependencies from apworld `requirements.txt` files. The `python-sat` package must be installed manually.

### Why pysat is Used

The apworld uses a SAT (Boolean Satisfiability) solver to ensure valid squad compositions when `randomize_squads` is enabled. This is an unusual pattern for Archipelago worlds.

Code location: `into_the_breach/squad/SquadRando.py`:
```python
from pysat.solvers import Glucose42
# ... uses solver to ensure valid squad combinations with achievement requirements
```

### Potential Workarounds

1. **Install python-sat manually:** `pip install python-sat`
2. **Disable randomize_squads:** Set `randomize_squads: false` in the template
3. **Report to apworld maintainer:** Suggest using a simpler randomization algorithm

## Issue 2: Rules Export Bug

### Description

When `custom_squad: true` and `randomize_squads: false` (so pysat isn't triggered), the generation succeeds but the rules export produces invalid code. The exported rules incorrectly call `is_doable_by_tags()` on Location objects instead of Achievement objects.

### Error Traceback

```
File "/home/user/Archipelago-CC/worlds/into_the_breach_worldgen_.../Rules.py", line 42, in <lambda>
    lambda state: state.multiworld.get_location("Chain Attack", player).is_doable_by_tags(unlocked_tags(state, player))
AttributeError: 'IntotheBreachWorldGen...Location' object has no attribute 'is_doable_by_tags'
```

### Root Cause

The apworld uses a custom `Achievement` class with `is_doable_by_tags()` method:

```python
# achievement/__init__.py
class Achievement:
    def get_custom_access_rule(self, player: int):
        return lambda state: self.is_doable_by_tags(unlocked_tags(state, player), state, player)

    def is_doable_by_tags(self, tags, state, player):
        # Achievement-specific logic
        ...
```

When the exporter captures this rule, it sees a lambda with `self.is_doable_by_tags()` but incorrectly assumes `self` refers to the Location object (since the rule is attached to a location). The exporter converts it to:

```python
lambda state: state.multiworld.get_location("Chain Attack", player).is_doable_by_tags(...)
```

This is incorrect because:
1. `self` in the original lambda refers to an `Achievement` object, not the `Location`
2. The `Location` class doesn't have `is_doable_by_tags()` method

### Exported Rules JSON Structure

The exporter produces:
```json
{
  "rule": "AST_function_call",
  "args": {
    "function": {
      "type": "attribute",
      "object": {
        "type": "name",
        "name": "location"  // INCORRECT - should be achievement
      },
      "attr": "is_doable_by_tags"
    }
  }
}
```

### Why This Is Hard to Fix

The exporter doesn't have context about what `self` refers to when capturing lambda rules. It assumes `self` is the Location or Region, but in this case it's an `Achievement` object that's only available during the original world's execution.

## APWorld Architecture Issues

### 1. Complex Logic Pattern

The apworld uses game-specific classes (`Achievement`) with custom methods in access rules. This pattern is not standard and cannot be properly exported:

```python
# Standard pattern (exportable):
lambda state: state.has("Item", player)

# ITB pattern (not exportable):
lambda state: self.is_doable_by_tags(...)  # self is Achievement, not Location
```

### 2. External Dependencies

Using a SAT solver (python-sat) is unusual for Archipelago worlds and adds significant complexity:
- Requires manual dependency installation
- Makes the world harder to maintain
- Potentially affects generation time

### 3. UT Slot Data Handling

The world does have UT support code:
```python
# __init__.py
def interpret_slot_data(self, slot_data: dict[str, Any]) -> Any:
    return slot_data
```

And uses `re_gen_passthrough` for UT:
```python
if hasattr(self.multiworld, "re_gen_passthrough"):
    slot_data = self.multiworld.re_gen_passthrough[self.game]
    # ... recreates squads from slot data
```

However, this doesn't help with the rules export issue because the Achievement objects and their methods can't be serialized.

## Recommendations

### For This Repository

1. **Add to incompatible list:** Mark this apworld as known-incompatible with UT fuzzer testing
2. **Skip in automated testing:** Exclude from UT fuzz test runs

### For APWorld Maintainer

1. **Install dependency automatically:** Consider bundling pysat or documenting the installation requirement prominently
2. **Simplify access rules:** Replace Achievement-based access rules with standard item/location-based rules that can be exported:
   ```python
   # Instead of:
   lambda state: self.is_doable_by_tags(...)

   # Use:
   lambda state: state.has("Required_Item", player) and core_function[cores](state, player)
   ```
3. **Consider simpler randomization:** The SAT solver might be overkill for squad randomization; a simpler shuffle with validation could work

## Test Commands

```bash
# Install dependency (temporary workaround)
pip install python-sat

# Run single fuzz test
python fuzz.py -r 1 -j 1 -g into_the_breach -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Run multiple tests to see error distribution
python fuzz.py -r 10 -j 4 -g into_the_breach -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

## Files Analyzed

- `custom_worlds/into_the_breach.apworld`
  - `into_the_breach/__init__.py` - Main world class
  - `into_the_breach/achievement/__init__.py` - Achievement class with `is_doable_by_tags()`
  - `into_the_breach/achievement/Achievements.py` - Achievement definitions
  - `into_the_breach/squad/SquadRando.py` - pysat usage for squad randomization
  - `into_the_breach/requirements.txt` - Lists `python-sat` dependency
