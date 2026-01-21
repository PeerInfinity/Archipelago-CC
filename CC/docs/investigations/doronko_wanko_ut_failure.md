# DORONKO WANKO UT Fuzzer Failure Investigation

## Summary

The DORONKO WANKO apworld was failing the Universal Tracker (UT) fuzz test approximately 20-30% of the time. The failures occurred due to bugs in the world generator when handling option-dependent helper arguments.

**Status: FIXED** - All issues have been resolved.

## Root Causes (Fixed)

Three separate bugs in the world generator (`world_generator/rule_codegen.py`) caused the failures:

### Issue 1: Compare Rule Arguments Not Evaluated

**Location:** `rule_codegen.py` - `_convert_helper()` and `_convert_rule_builder_helper()`

**Problem:** When a helper function received a `Compare` rule as an argument (e.g., `options.logic == "glitched"`), the code generator didn't know how to convert it to Python and defaulted to `None`.

**Fix:** Added `_evaluate_compare_rule()` and supporting methods to:
- Resolve SettingValue/OptionValue operands from the settings
- Handle Choice option string-to-int conversion using `name_lookup` from option definitions
- Handle already-resolved values by checking all option definitions

### Issue 2: Conditional with Lambda Parameters Incorrectly Generated

**Location:** `rule_codegen.py` - `HelperGenerator._expr_helper()`

**Problem:** The `glitched_logic_check` helper had a conditional that should call lambda function parameters, but `_expr_helper()` returned `True` for unknown helpers, resulting in:
```python
return (True if is_glitched else True)  # Always True!
```

**Fix:**
- Added `_current_helper_params` tracking to `HelperGenerator`
- Modified `generate_helper_function()` to set parameter context during generation
- Modified `_expr_helper()` to recognize when a helper name is a parameter and generate proper calls:
```python
return (glitched_rule(state) if is_glitched else normal_rule(state))
```

### Issue 3: Lambda State Method Calls Missing Player Argument

**Location:** `rule_codegen.py` - `_expr_function_call()`

**Problem:** Lambdas like `lambda s: s.has('Item')` were generated without the required `player` argument.

**Fix:** Added special handling in `_expr_function_call()` to detect state method calls (`has`, `has_all`, `has_any`, etc.) and automatically append the `player` argument when missing:
```python
lambda s: s.has('Item', player)
```

### Issue 4: Option Definitions Not Passed to RuleCodeGenerator

**Location:** `templates.py`

**Problem:** `RuleCodeGenerator` didn't receive `option_definitions`, preventing proper Choice option string-to-int conversion.

**Fix:** Updated `RuleCodeGenerator` constructor to accept `option_definitions` and passed it from `templates.py`.

## Test Results

Before fix: ~70% success rate (3 failures out of 10)
After fix: 100% success rate (0 failures out of 20+)

## Test Commands

```bash
source .venv/bin/activate

# Run fuzzer tests
python fuzz.py -r 10 -j 4 -g doronko_wanko -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Verify via test runner
python scripts/test/test-all-ut-fuzz.py --runs 10 --include-list "DORONKO WANKO.yaml" --custom-worlds-only
```

## Files Modified

1. `world_generator/rule_codegen.py`:
   - Added `_evaluate_compare_rule()`
   - Added `_resolve_compare_operand()`
   - Added `_get_setting_name_from_operand()`
   - Added `_convert_option_key_to_value()`
   - Added `_try_convert_option_key_all_defs()`
   - Added Compare rule handling in `_convert_helper()` and `_convert_rule_builder_helper()`
   - Added `_current_helper_params` tracking to `HelperGenerator`
   - Modified `generate_helper_function()` to set params context
   - Modified `_expr_helper()` to handle parameter calls
   - Modified `_expr_function_call()` to add missing player argument

2. `world_generator/templates.py`:
   - Updated `RuleCodeGenerator` instantiation to pass `option_definitions`
