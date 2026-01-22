# UT Fuzz Test Failure Investigation: A Difficult Game About Climbing

## Summary

The `difficult_climbing.apworld` fails UT fuzz testing with a **100% failure rate** (9 failures, 1 ignored out of 10 runs). The root cause is a **type mismatch in option comparisons** in the exported rules.

## Investigation Details

### APWorld Information

- **Game**: A Difficult Game About Climbing
- **Template**: `A Difficult Game About Climbing.yaml`
- **World directory**: `difficult_climbing/` (from `custom_worlds/difficult_climbing.apworld`)
- **Source**: https://github.com/BlastSlimey/GrabbingChecks/releases/download/0.1.2/difficult_climbing.apworld
- **Author**: BlastSlimey

### Error Type

All failures are logic mismatches (error type: `None`), meaning the Universal Tracker and server disagree about which locations are accessible.

### Specific Failure

From the fuzz output:
```
Locations `Rubber,Cloth` were in server logic but not expected in UT
```

The locations `Rubber` and `Cloth` are in the "Clothesline" region. The server correctly marks them as accessible, but the UT (Universal Tracker) does not.

## Root Cause Analysis

### The Original APWorld Code

The apworld's `__init__.py` contains rules that compare options to string literals:

```python
regions[Reg.FIRST_CHECKPOINT].connect(
    regions[Reg.CLOTHESLINE], "After cogs",
    lambda state: (self.options.difficulty == "vanilla" and
                   state.has("Rotating Cog Repair", self.player)) or
                  (self.options.difficulty == "extra_buff" and
                   state.has_all(["Rotating Cog Halting", "Side Cog Halting"], self.player))
)
```

In Python, `self.options.difficulty` is a Choice option that supports string comparison. When `difficulty` is set to "vanilla" (value 0), the comparison `self.options.difficulty == "vanilla"` evaluates to `True`.

### The Exported Rules JSON

The exporter captures this rule as:

```json
{
  "rule": "Or",
  "children": [
    {
      "rule": "And",
      "children": [
        {
          "rule": "Compare",
          "args": {
            "left": 0,
            "op": "==",
            "right": "extra_buff"
          }
        },
        ...
      ]
    },
    {
      "rule": "And",
      "children": [
        {
          "rule": "Compare",
          "args": {
            "left": 0,
            "op": "==",
            "right": "vanilla"
          }
        },
        ...
      ]
    }
  ]
}
```

### The Problem

1. The exporter resolves `self.options.difficulty` to its **integer value** (`0` for "vanilla")
2. The comparison target (`"vanilla"`, `"extra_buff"`) remains as a **string**
3. The Rule Builder's `Compare` rule evaluates `0 == "vanilla"` directly
4. In Python, `0 == "vanilla"` is always `False` (type mismatch)

### Why It Matters

The rule for entering the "Clothesline" region is:
```
(difficulty == "vanilla" AND has "Rotating Cog Repair") OR
(difficulty == "extra_buff" AND has both cog halting items)
```

When difficulty is "vanilla" (value 0):
- **Server**: Evaluates `self.options.difficulty == "vanilla"` → `True` (Python's Choice option supports this)
- **UT**: Evaluates `Compare(0, "==", "vanilla")` → `False` (integer vs string)

Result: The UT thinks the "Clothesline" region is unreachable, so locations `Rubber` and `Cloth` are inaccessible.

## Option Definitions

The rules JSON includes the option mapping:
```json
"difficulty": {
  "type": "choice",
  "name_lookup": {
    "0": "vanilla",
    "1": "extra_buff",
    "2": "challenge"
  },
  "default": 0,
  "display_name": "Difficulty"
}
```

This mapping could be used to resolve comparisons, but it's not currently utilized.

## Potential Fixes

### Option 1: Fix in the Exporter (Recommended)

When exporting a Compare where:
- Left side is a resolved option integer value
- Right side is a string (option name)
- The comparison is `==` or `!=`

Resolve the comparison at export time using the option's `name_lookup` or Choice semantics. For example, `Compare(0, "==", "vanilla")` should become `True` (constant) since `0` corresponds to `"vanilla"`.

**Implementation location**: `exporter/converter/ast_to_rule_builder.py` in `_convert_compare()`

### Option 2: Fix in the Rule Builder

Modify the `Compare` rule to understand option mappings. When comparing an integer to a string that looks like an option name, look up the mapping and resolve appropriately.

**Implementation location**: `rule_builder/rules.py` in `Compare.Resolved._evaluate()`

### Option 3: Fix in the World Generator

When generating Python code from JSON rules, recognize the pattern and either:
- Resolve to boolean constants
- Generate proper comparison code

**Implementation location**: `world_generator/`

### Recommendation

**Option 1 (Exporter fix)** is the cleanest approach because:
1. Option values are fixed at generation time, so comparisons can be resolved
2. It reduces rule complexity (constants instead of comparisons)
3. It fixes the issue at the source without requiring downstream changes

## APWorld-Specific Notes

1. **Missing manifest**: The apworld lacks `archipelago.json` (warning at load time)
2. **No Rules.py**: Rules are embedded in `__init__.py`
3. **Simple world**: Only 7 items, 16 locations, 6 regions
4. **Version**: v0.1.2, built for AP 0.6.5

## Reproduction Steps

```bash
# 1. Download the apworld
curl -L -o custom_worlds/difficult_climbing.apworld \
    "https://github.com/BlastSlimey/GrabbingChecks/releases/download/0.1.2/difficult_climbing.apworld"

# 2. Generate templates
source .venv/bin/activate
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# 3. Run fuzzer
python fuzz.py -r 1 -j 1 -g difficult_climbing -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0

# 4. Check logs
cat fuzz_output/error/difficult_climbing/0/0.log
```

## Files Involved

- `custom_worlds/difficult_climbing.apworld` - The APWorld package
- `exporter/converter/ast_to_rule_builder.py` - Rule conversion (fix location)
- `rule_builder/rules.py` - Compare rule implementation
- `worlds/tracker/fuzzer_hook.py` - UT fuzzer hook

## Conclusion

This is **not an APWorld bug** - the apworld uses valid Archipelago patterns. The issue is in the **exporter** which doesn't properly handle Choice option comparisons to string literals. The same issue could affect any APWorld that uses patterns like `self.options.some_choice == "option_name"`.

**Status**: FIXED. Two bugs were identified and resolved.

## Fix Implementation

### Fix 1: Option Value Comparison Normalization

**File**: `exporter/games/base/option_normalization.py`

**Problem**: When `self.options.difficulty` was resolved to its integer value (0), and compared to a string like `"vanilla"`, the normalization code didn't recognize this pattern because neither side was an `option_value` type node.

**Solution**: Added handling for comparisons where:
- One side is a raw integer (resolved option value)
- The other side is a raw string (option name)
- The string matches a known option name in the option definitions

The comparison is now resolved at export time to `True_` or `False_` based on whether the integer corresponds to the string according to the option's `name_lookup`.

### Fix 2: Integer Constant Preservation in World Generator

**File**: `world_generator/rule_codegen.py`

**Problem**: In `_convert_rule_builder_format`, when handling `Constant` rules, ALL non-zero integers were being converted to `True_()`. This caused count values like 2 and 4 in `Conditional` branches to become `True_()` instead of being preserved as numeric literals.

Example: `Conditional(test=..., if_true=2, if_false=4)` became `Conditional(test=..., if_true=True_(), if_false=True_())`

**Solution**: Modified the logic to only treat integers 0 and 1 as boolean values. Larger integers (2, 3, 4, etc.) are now preserved as numeric literals for use in count/arithmetic contexts.

## Test Results After Fix

```
Success: 8
Failures: 0
Timeouts: 0
Ignored: 2

Time taken: 1.56s
```

The 2 ignored runs are due to minimal accessibility mode, which is expected behavior.
