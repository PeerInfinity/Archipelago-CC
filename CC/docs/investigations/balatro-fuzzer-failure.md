# Balatro UT Fuzzer Test Failure Investigation

## Summary

The Balatro apworld (v0.1.9 from BurndiL/BalatroAP) fails Universal Tracker fuzzer testing due to **unsupported rule patterns** in the apworld's access rules that cannot be properly converted by the world generator.

## Test Results

- **Total runs**: 10
- **Success**: 0 (0%)
- **Failures**: 4 (40%) - logic mismatches
- **Ignored**: 6 (60%) - option validation errors

## Root Cause Analysis

### 1. Complex Lambda Expressions

The Balatro apworld uses complex Python lambda expressions with dynamic item lists:

```python
# From balatro/__init__.py lines 404-415
add_rule(new_location, lambda state, _ante3_=ante:
    state.has_from_list(list(jokers.values()), self.player, 5 + _ante3_ * 2) or
    state.has_from_list(list(joker_bundles.values()), self.player, round((_ante3_ * 10) / self.options.joker_bundle_size.value)))
```

### 2. Exporter Serialization

The exporter serializes these lambdas into complex AST structures:

```json
{
  "rule": "HasFromList",
  "args": {
    "items": {
      "type": "helper",
      "name": "list",
      "args": [
        {
          "type": "generator_expression",
          "element": {...},
          "comprehension": {...}
        }
      ]
    },
    "count": {...}
  }
}
```

### 3. World Generator Failure

The world generator (`rule_codegen.py` line 1406-1418) processes `HasFromList` rules by iterating over the `items` field:

```python
items = args.get('items', [])
# ...
items_str = ', '.join(repr(item) for item in items)
return f'HasFromList({items_str}, count={count})'
```

When `items` is a dict (helper expression) instead of a list, iterating over it yields the dict keys ('type', 'name', 'args'), resulting in broken rules like:

```python
HasFromList('type', 'name', 'args', count=1)
```

### 4. Resulting Logic Mismatches

The broken rules cause locations to be in logic when they shouldn't be (or vice versa):

```
Locations `Shop Item 1 at Blue Stake,Shop Item 1 at Purple Stake` were in server logic but not expected in UT
```

## Additional Issues

### Option Validation Errors (Ignored Runs)

The Balatro apworld has strict option validation that causes some fuzzer configurations to fail:

```
OptionError: No Custom Planets Specified. To avoid this turn off custom planet bundles
```

These are treated as "ignored" since they're option configuration issues, not logic bugs.

## Classification

| Category | Status |
|----------|--------|
| Fundamental compatibility issue | **Yes** |
| Fixable in exporter/tracker | Possible but complex |
| Needs apworld maintainer update | Preferred solution |

## Recommended Actions

### Option 1: Add to Known-Incompatible List (Recommended)
Add Balatro to a known-incompatible apworld list until the maintainer updates the rules to use simpler patterns.

### Option 2: Apworld Maintainer Fix
The apworld could be updated to use simpler rule patterns:

```python
# Instead of:
state.has_from_list(list(jokers.values()), self.player, count)

# Use:
state.has_from_list(['Joker', 'Greedy Joker', ...], self.player, count)
```

### Option 3: Exporter Enhancement (Complex)
Enhance the exporter to resolve `list(dict.values())` patterns at export time into actual item lists. This would require:
1. Access to the actual item dictionaries at export time
2. Pre-computing the item lists before serialization
3. Handling dynamic counts based on option values

## Affected Files

- `custom_worlds/balatro.apworld` - The apworld with complex rules
- `world_generator/rule_codegen.py:1406-1418` - HasFromList handler that fails on dict items
- `exporter/exporter.py` - Serializes lambdas to AST

## Test Commands

```bash
# Reproduce failure
source .venv/bin/activate
python fuzz.py -r 10 -j 4 -g balatro -n 1 --hook worlds.tracker.fuzzer_hook:Hook --dump-ignored

# Check failure log
cat fuzz_output/error/balatro/1/1.log | tail -50
```

## Related Issues

- Similar pattern issues may affect other apworlds that use `list(dict.values())` or generator expressions in rules
