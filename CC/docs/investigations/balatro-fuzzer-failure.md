# Balatro UT Fuzzer Test Failure Investigation

## Summary

The Balatro apworld (v0.1.9 from BurndiL/BalatroAP) fails Universal Tracker fuzzer testing due to **complex dynamic rule patterns** that are difficult to fully support in the world generator.

## Test Results (After Partial Fix)

- **Total runs**: 30
- **Success**: 0 (0%)
- **Failures**: 8 (27%) - logic mismatches and apworld bugs
- **Timeouts**: 3 (10%)
- **Ignored**: 19 (63%) - option validation errors

### Breakdown of Failures
- **list index out of range**: 5 runs - Apworld bug in `generate_early` when certain options are configured
- **None (logic mismatch)**: 3 runs - Dynamic rules with ante-based calculations can't be fully resolved

## Root Cause Analysis

### 1. Complex Lambda Expressions with Dynamic Lists

The Balatro apworld uses complex Python lambda expressions with dynamic item lists:

```python
# From balatro/__init__.py lines 404-415
add_rule(new_location, lambda state, _ante3_=ante:
    state.has_from_list(list(jokers.values()), self.player, 5 + _ante3_ * 2) or
    state.has_from_list(list(joker_bundles.values()), self.player, round((_ante3_ * 10) / self.options.joker_bundle_size.value)))
```

### 2. Pattern Types Identified

| Pattern | Status | Notes |
|---------|--------|-------|
| `list(dict.values())` | **Partially Fixed** | Extracts values from constant dicts |
| `list(key for key, _ in dict.items())` | **Partially Fixed** | Extracts keys from generator expressions |
| Dynamic count expressions | **Lambda mode** | Works when worldgen can use lambdas |
| Ante-based calculations | **Partial** | Fixed ante values get resolved, dynamic ones don't |

## Improvements Made

### 1. RuleCodeGenerator Updates (`rule_codegen.py`)

Added `_resolve_items_list_expression` and `_extract_from_generator_expression` methods to handle:
- `list(dict.values())` patterns - extracts dict values as item list
- `list(dict.keys())` patterns - extracts dict keys as item list
- `list(key for key, _ in dict.items())` - extracts dict keys from generator expressions

### 2. HelperCodeGenerator Updates (`rule_codegen.py`)

Added `HasFromList` and `HasFromListUnique` handlers in lambda mode to generate proper `state.has_from_list()` calls with resolved item lists.

### 3. None Propagation Fix

Updated `And` and `Or` handlers to properly propagate `None` (lambda mode signal) when child rules can't be converted.

## Remaining Issues

### 1. Apworld Bugs
The Balatro apworld has bugs in option handling:
```python
# In generate_early line 113
if list(self.options.required_stake_for_goal.value)[0] in self.playable_stakes:
    # IndexError when list is empty
```

### 2. Complex Ante-Based Rules
Some rules depend on runtime ante values that can't be statically resolved:
```python
state.has_from_list(list(jokers.values()), self.player, 5 + _ante3_ * 2)
```
The `_ante3_` value varies per location, making it impossible to statically determine the count.

### 3. Option-Dependent Logic
Rules that depend on `self.options.joker_bundle_size.value` are resolved at worldgen time using the specific option values for that seed, which may not always match server expectations.

## Classification

| Category | Status |
|----------|--------|
| Fundamental compatibility issue | **Partial** |
| Fixable in exporter/tracker | Improved but limited |
| Needs apworld maintainer update | Yes, for full compatibility |

## Recommended Actions

### Short Term
1. Keep Balatro on known-incompatible list
2. Document the partial improvements made

### Long Term
1. Apworld maintainer could simplify rules by pre-computing item lists
2. Apworld maintainer could fix the `list index out of range` bug in option handling

## Affected Files

- `custom_worlds/balatro.apworld` - The apworld with complex rules
- `world_generator/rule_codegen.py` - Added pattern resolution methods
- `world_generator/templates.py` - Lambda mode detection

## Test Commands

```bash
# Reproduce failure
source .venv/bin/activate
python fuzz.py -r 30 -j 4 -g balatro -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Check failure log
cat fuzz_output/error/balatro/*/0.log | tail -50
```

## Related Issues

- Similar pattern issues may affect other apworlds that use `list(dict.values())` or generator expressions in rules
- The improvements made here will benefit any apworld using these patterns
