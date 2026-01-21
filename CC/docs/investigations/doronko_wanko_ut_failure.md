# DORONKO WANKO UT Fuzzer Failure Investigation

## Summary

The DORONKO WANKO apworld fails the Universal Tracker (UT) fuzz test approximately 20-30% of the time. The failures occur when the `logic` option is set to `standard` (as opposed to `glitched`).

## Root Causes

There are **two separate issues** in the world generator (`world_generator/rule_codegen.py`) that cause this failure:

### Issue 1: Compare Rule Arguments Not Evaluated

**Location:** `rule_codegen.py` lines 4804-4806 in `_convert_rule_builder_helper()`

**Problem:** When a helper function is called with a `Compare` rule as an argument (e.g., `options.logic == "glitched"`), the code generator doesn't know how to convert this to Python code and defaults to `None`.

**Example:**
- Original rule: `can_get_all_paintings(options.logic == "glitched", state, player)`
- Exported JSON arg: `{"rule": "Compare", "args": {"left": {"rule": "SettingValue", "args": {"setting": "logic"}}, "op": "==", "right": "glitched"}}`
- Generated Python: `HelperCall(helper_func=can_get_all_paintings, args=(None,))`

**Expected:** The Compare rule should be evaluated at generation time since both sides are known:
- If `settings["logic"] == "glitched"` → `True`
- If `settings["logic"] == "standard"` → `False`

### Issue 2: Conditional with Lambda Parameters Incorrectly Generated

**Location:** `rule_codegen.py` helper function generation

**Problem:** The `glitched_logic_check` helper has a conditional that should call lambda function parameters, but is incorrectly converted to always return `True`.

**Original helper body (from JSON):**
```json
{
  "type": "conditional",
  "test": {"type": "name", "name": "is_glitched"},
  "if_true": {"type": "helper", "name": "glitched_rule"},
  "if_false": {"type": "helper", "name": "normal_rule"}
}
```

**Generated Python (INCORRECT):**
```python
def glitched_logic_check(state, player, is_glitched=None, normal_rule=None, glitched_rule=None):
    return (True if is_glitched else True)
```

**Expected Python:**
```python
def glitched_logic_check(state, player, is_glitched=None, normal_rule=None, glitched_rule=None):
    if is_glitched:
        return glitched_rule(state)
    else:
        return normal_rule(state)
```

## Impact

When `logic: standard`:
1. The `is_glitched` argument is `None` (should be `False`)
2. Even if it were `False`, `glitched_logic_check` returns `True` regardless
3. This causes `can_get_all_paintings` to always return `True` when `Train Unlock` and `Train Wheel` are collected
4. The UT and server disagree on which locations are accessible because the rule logic is broken

## Recommended Fixes

### Fix 1: Handle Compare Rules in Helper Arguments

In `_convert_rule_builder_helper()`, add handling for `Compare` rules:

```python
elif arg_rule == 'Compare':
    # Evaluate comparison at generation time
    args_dict = arg.get('args', {})
    left = args_dict.get('left')
    op = args_dict.get('op', '==')
    right = args_dict.get('right')
    
    # Resolve left side (usually a SettingValue)
    left_val = None
    if isinstance(left, dict):
        if left.get('rule') == 'SettingValue':
            setting = left.get('args', {}).get('setting', '')
            left_val = self.settings.get(setting)
    
    # Resolve right side (usually a constant)
    right_val = right if not isinstance(right, dict) else right.get('value')
    
    # Evaluate the comparison
    if left_val is not None and right_val is not None:
        if op == '==':
            result = left_val == right_val
        elif op == '!=':
            result = left_val != right_val
        # ... handle other operators
        arg_strs.append(repr(result))
    else:
        arg_strs.append('None')
```

### Fix 2: Properly Generate Conditionals with Callable Parameters

When generating helper functions with conditional bodies where branches reference parameters (lambdas), ensure the parameters are called, not just referenced:

```python
# When if_true/if_false are helper references to parameter names
if branch.get('type') == 'helper':
    param_name = branch.get('name')
    if param_name in helper_params:
        # This is a callable parameter - generate a call
        return f'{param_name}(state)'
```

## Workaround

Until these fixes are implemented, users can:
1. Avoid apworlds that pass option-dependent expressions to helper functions
2. Manually create game-specific exporters that handle these patterns

## Files to Modify

1. `world_generator/rule_codegen.py`:
   - `_convert_rule_builder_helper()` - Add Compare rule handling
   - `generate_helper_function()` - Fix conditional generation with callable parameters

## Test Commands

```bash
# Reproduce failure
source .venv/bin/activate
python fuzz.py -r 10 -j 1 -g doronko_wanko -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Check specific failing seed
python fuzz.py -r 1 -j 1 -g doronko_wanko -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed <SEED>
```
