# Ratchet & Clank 2 APWorld Fuzzer Failure Investigation

## Summary

**APWorld**: Ratchet & Clank 2 (rac2)
**Source**: https://github.com/evilwb/APRac2/releases/download/v0.6.4/rac2.apworld
**Failure Type**: Logic mismatch (error type: `None`)
**Initial Success Rate**: 0% (10/10 failures)
**Final Success Rate**: 100% (20/20 successes after fix)

## Status: FIXED

The fuzzer failures have been fixed by adding proper handling for:
1. `state_method` with `has_any` and `has_all` methods
2. `conditional` expressions with option-based tests
3. Proper `helper` type handling in `_expr_to_rule_builder`

## Root Cause

The fuzzer failures were caused by several gaps in the world generator's ability to convert option-dependent rules to Rule Builder expressions.

### Technical Details

1. **Option-dependent rules**: The apworld has rules that check `world.options.first_person_mode_glitch_in_logic` and `world.options.randomize_megacorp_vendor` to determine accessibility.

2. **Missing handlers**: The `_expr_to_rule_builder` function was missing handlers for:
   - `state_method` with `has_any` method (used in `can_improved_jump` helper)
   - `conditional` expressions that test option values
   - Proper `helper` type handling with `body_rule` parameter

3. **Helper expansion issue**: When helpers were expanded, `conditional` types (from helpers like `can_spiderbot`) weren't being evaluated even though the option value was known.

## Fix Applied

### Changes to `world_generator/rule_codegen.py`:

1. **Added `has_any` and `has_all` handling in `_expr_to_rule_builder`** (lines 3682-3698):
```python
if method == 'has_any' and len(args) == 1:
    items_arg = args[0]
    if items_arg.get('type') == 'constant':
        items = items_arg.get('value', [])
        if isinstance(items, list):
            self.required_imports.add('HasAny')
            items_str = ', '.join(f'"{self._escape_string(item, chr(34))}"' for item in items)
            return f'HasAny({items_str})'
```

2. **Added short-circuit evaluation for `conditional` with known option tests** (lines 3742-3749):
```python
# Try to evaluate the test to a constant boolean
test_result = self._try_evaluate_conditional_test_expr(test, var_expressions)
if test_result is True:
    return self._expr_to_rule_builder(if_true, var_expressions)
elif test_result is False:
    return self._expr_to_rule_builder(if_false, var_expressions)
```

3. **Fixed `helper` type handling** (lines 4023-4061):
   - Now generates proper `HelperCall` with `helper_func`, `helper_name`, and `body_rule` parameters
   - Calls `_try_convert_helper_body_to_rule` to get the body expression

4. **Added `_try_evaluate_conditional_test_expr` method** (lines 4970-5031):
   - Evaluates conditional tests with `option_value` references
   - Handles `not`, `constant`, and `compare` types
   - Uses settings to resolve option values at generation time

## Verification

```bash
# Run fuzzer to verify fix
source .venv/bin/activate
python fuzz.py -r 20 -j 4 -g rac2 -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Result: 20/20 successes, 0 failures
```

## Affected Locations (Now Fixed)

Any location with rules that depend on options:
- `Maktar: Photo Booth`
- `Todano: Spiderbot Conveyor - Platinum Bolt`
- `Oozla: End of Store Cutscene`
- `Oozla: Tractor Puzzle - Platinum Bolt`
- And many more

## Related Files

- `world_generator/rule_codegen.py` - Main fix location
- `exporter/exporter.py` - Rule export logic
- `worlds/tracker/fuzzer_hook.py` - UT fuzzer hook

## Classification

**Category**: World Generator Enhancement
**Priority**: Completed
**Affected Games**: Ratchet & Clank 2 (now compatible)
