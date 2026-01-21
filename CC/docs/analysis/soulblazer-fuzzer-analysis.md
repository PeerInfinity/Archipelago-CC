# Soul Blazer UT Fuzzer Analysis

## Summary

**APWorld**: Soul Blazer v0.6.1
**Source**: https://github.com/Tranquilite0/Archipelago-SoulBlazer
**Fuzzer Result**: 100% failure rate (10/10 runs)
**Error Type**: `None` (Logic mismatch - NameError at runtime)

## Root Cause

The Soul Blazer apworld uses a **closure-based data-driven rule pattern** that is incompatible with the current exporter/world generator pipeline.

### The Pattern

Soul Blazer defines exits using a `ExitData` named tuple with a `rule_flag` attribute:

```python
# From soulblazer/Regions.py
class ExitData(NamedTuple):
    destination: str
    has_all: list[str] = []
    has_any: list[str] = []
    rule_flag: RuleFlag = RuleFlag.NONE
```

Rules are set dynamically based on the flag value:

```python
# From soulblazer/Rules.py
rule_for_flag = {
    RuleFlag.NONE: no_requirement,
    RuleFlag.CAN_CUT_METAL: can_cut_metal,
    RuleFlag.CAN_CUT_SPIRIT: can_cut_spirit,
    RuleFlag.HAS_THUNDER: has_thunder,
    RuleFlag.HAS_MAGIC: has_magic,
    RuleFlag.HAS_SWORD: has_sword,
    RuleFlag.HAS_STONES: has_stones,
    RuleFlag.PHOENIX_CUTSCENE: has_phoenix_cutscene,
}

def get_rule_for_exit(data: ExitData, player: int) -> Callable[[CollectionState], bool]:
    if not data.has_all and not data.has_any:
        def rule_simple(state: CollectionState) -> bool:
            return rule_for_flag[data.rule_flag](state, player)
        return rule_simple
    # ... more complex rule with has_all/has_any
```

### What the Exporter Captures

The exporter serializes the lambda's AST, resulting in:

```json
{
  "rule": "AST_function_call",
  "args": {
    "function": {
      "type": "subscript",
      "value": {
        "type": "constant",
        "value": {
          "RuleFlag.NONE": "<function no_requirement>",
          "RuleFlag.CAN_CUT_METAL": "<function can_cut_metal>",
          ...
        }
      },
      "index": {
        "type": "attribute",
        "object": {"type": "name", "name": "data"},
        "attr": "rule_flag"
      }
    }
  }
}
```

### What the World Generator Produces

The world generator attempts to recreate this pattern but produces invalid code:

```python
# From generated Rules.py (line 25)
lambda state: {'RuleFlag.NONE': '<function no_requirement>', ...}[data.rule_flag]()
```

**Problems:**
1. `data` is undefined - it was a closure variable in the original code
2. Dictionary values are string representations of functions, not callable
3. The pattern can't be reconstructed without the original context

## Error Trace

```
NameError: name 'data' is not defined
  File "worlds/soul_blazer_worldgen_.../Rules.py", line 25, in <lambda>
    lambda state: {...}[data.rule_flag]()
```

## Analysis: Why This Pattern Fails

The exporter is designed to capture rule logic statically. Soul Blazer's pattern is inherently dynamic:

1. **Closure capture**: The `data` variable is bound at rule creation time, not export time
2. **Function references**: `rule_for_flag` maps enum values to functions, but these become string representations when serialized
3. **Runtime dispatch**: The pattern performs a dictionary lookup to select which function to call

The world generator can't recreate this because:
- It doesn't have access to the `ExitData` objects that provide `data.rule_flag` values
- Even if it did, the function references can't be restored from string representations

## Potential Fixes

### Option 1: Create Soul Blazer-Specific Exporter Handler (Recommended)

Create `exporter/games/soulblazer.py` that:

1. **Pre-expand rules at export time**: Instead of capturing the AST, evaluate `data.rule_flag` during export and replace with the actual rule
2. **Map flag values to standard rules**:
   - `RuleFlag.NONE` → `True_`
   - `RuleFlag.CAN_CUT_METAL` → `state.has_any(['Zantetsu Sword', 'Soul Blade'], player)`
   - `RuleFlag.HAS_SWORD` → `state.has_any(sword_names, player)`
   - etc.

**Pros**: Fix is contained in our codebase; doesn't require upstream changes
**Cons**: Requires maintaining mapping of Soul Blazer's rule flags to item checks

### Option 2: Request APWorld Changes (Alternative)

Ask the apworld maintainer to change the rule pattern to use direct item checks instead of the data-driven dispatch:

```python
# Instead of:
def get_rule_for_exit(data: ExitData, player: int):
    def rule(state): return rule_for_flag[data.rule_flag](state, player)
    return rule

# Use:
def get_rule_for_exit(data: ExitData, player: int):
    if data.rule_flag == RuleFlag.CAN_CUT_METAL:
        return lambda state: state.has_any(metal_cutting_swords, player) and ...
    # etc.
```

**Pros**: Results in cleaner export; benefits all tools that analyze the world
**Cons**: Requires upstream cooperation; may not be desired by maintainer

### Option 3: Add to Known-Incompatible List

Add Soul Blazer to a list of apworlds that are known to be incompatible with UT fuzzing.

**Pros**: Simple; acknowledges limitation
**Cons**: Doesn't solve the problem; reduces tracker coverage

## Recommendation

**Option 1** is recommended. Create a Soul Blazer exporter handler that:

1. Detects the `rule_for_flag[data.rule_flag]` pattern
2. Extracts which `RuleFlag` value would be used for each entrance
3. Expands the rule inline based on that flag value

This requires:
1. Understanding how to extract `rule_flag` from entrance data at export time
2. Mapping each `RuleFlag` to equivalent item checks
3. Handling the compound rules (flag + has_all + has_any)

## File References

- `custom_worlds/soulblazer.apworld` - The apworld package
- `soulblazer/Rules.py` - Rule flag definitions and `rule_for_flag` mapping
- `soulblazer/Regions.py` - `ExitData` class and `get_rule_for_exit` function
- `exporter/games/generic.py` - Current generic handler (base for new handler)
- `world_generator/rule_codegen.py` - Code generation that fails for this pattern

## Date

2026-01-21
