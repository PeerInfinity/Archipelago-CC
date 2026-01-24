# Sonic the Hedgehog 1 UT Fuzz Failure Investigation

## Summary

The Sonic the Hedgehog 1 apworld fails the Universal Tracker fuzz test with a ~10% failure rate. The failure type is "logic mismatch" (error type: None), where the UT thinks locations are accessible when the server disagrees.

## Root Cause

**Bug Location:** `world_generator/rule_codegen.py`, method `_convert_count_true_logic()`, lines 2400-2416

**The Issue:**

When converting `count_true` rules with non-item_check conditions (like `location_check`), the codegen has a limitation:

```python
if count <= 3 and n <= 10:
    # Generate combinations using Or/And
    ...
# Fallback for complex cases: generate True_() with a warning
self.required_imports.add('True_')
return 'True_()'
```

If `count > 3`, the codegen falls back to `True_()`, which means the rule **always passes**.

**In Sonic 1's case:**

- The `specials_goal: 5` option requires reaching 5 of 6 special stages
- This creates a `count_true` rule with `count=5` and 6 `location_check` conditions
- Since `count (5) > 3`, the codegen outputs `True_()` instead of the actual check
- Result: Final Zone becomes accessible without meeting the specials requirement

## Failure Pattern

All 5 observed failures have the same error:
```
Locations Final Zone Boss were expected to be in logic but weren't
```

This happens when:
1. `final_zone_last` is non-zero (requiring goals to be met before Final Zone)
2. `specials_goal` is > 3 (triggering the codegen fallback)
3. The UT thinks Final Zone is accessible because the specials check is `True_()`
4. The server correctly evaluates the original `common_checks()` logic and says no

## Evidence

### Exported rules.json (correct)
```json
{
  "rule": "AST_count_true",
  "args": {
    "count": 5,
    "conditions": [
      {"type": "location_check", "location": "Special Stage 1"},
      {"type": "location_check", "location": "Special Stage 2"},
      ...
    ]
  }
}
```

### Generated Rules.py (incorrect)
```python
world.set_rule(
    multiworld.get_entrance("Final Zone", player),
    And(
        HasFromList(..., count=5),  # emeralds - correct
        (CanReachLocation("Green Hill 3 Boss")) & ... & (CanReachLocation("Starlight 3 Boss")),  # bosses - correct
        True_(),  # specials - WRONG! should check 5 of 6 special stages
        HasGroup('rings', 114)  # rings - correct
    )
)
```

## Potential Fixes

### Option 1: Increase count limit
Change `count <= 3` to `count <= 6` to handle common cases like Sonic 1's 5-of-6 specials.

### Option 2: Use And for count == n-1
When `count == n - 1`, the rule is equivalent to "all except one must be true", which can be expressed as an Or of And combinations where each And excludes one condition.

### Option 3: Implement lambda-based counting
For complex cases, generate a Python lambda that counts truthy conditions at runtime.

### Option 4: Game-specific handler
Add a Sonic 1-specific handler in the world generator to expand these rules correctly.

## Workaround

Until the codegen is fixed, apworlds with `count_true` rules where `count > 3` will have inaccurate tracking. This includes:
- Games with "complete N of M goals" victory conditions where N > 3
- Games with optional boss/dungeon requirements where the threshold is > 3

## Files Involved

- `world_generator/rule_codegen.py` - The bug is here
- `exporter/games/unofficial/sonic1.py` - Correctly exports the count_true rules
- `custom_worlds/sonic1.apworld` - The affected apworld
- `rule_builder/rules.py` - The Rule Builder handles count correctly

## Reproduction Steps

```bash
source .venv/bin/activate
python fuzz.py -r 50 -j 8 -g sonic1 -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

Expect ~10% failure rate with errors about "Final Zone Boss".

## Conclusion

This is a bug in our codebase (world_generator), not in the Sonic 1 apworld. The apworld's `common_checks()` function is correctly exported by our handler, but the codegen incorrectly converts `count_true` rules with `count > 3` to `True_()`.

The fix should be applied to `world_generator/rule_codegen.py` to properly handle count values > 3.
