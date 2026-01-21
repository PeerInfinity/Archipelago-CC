# Wordipelago UT Fuzz Test Failure Investigation

**Date:** 2026-01-21
**APWorld:** Wordipelago
**Source:** https://github.com/ProfDeCube/Archipelago/releases/download/1.0.0/wordipelago.apworld
**Status:** Root cause identified - exporter limitation

## Summary

The Wordipelago apworld fails 100% of UT fuzz tests due to the exporter's inability to handle Python's `*` (starred/unpacking) operator in lambda rule definitions.

## Failure Details

**Error Type:** `TypeError: '>=' not supported between instances of 'int' and 'NoneType'`

**Location:** `worlds/wordipelago_worldgen_*/Rules.py:43` in `needed_for_words` helper

**Traceback:**
```python
File "rule_builder/rules.py", line 3250, in _evaluate
    return self.helper_func(state, self.player, *self.args)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
File "worlds/wordipelago_worldgen_.../Rules.py", line 43, in needed_for_words
    return (state.has_from_list_unique(vowels_items, player, vowels)) and ...
            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
File "BaseClasses.py", line 1050, in has_from_list_unique
    if found >= count:
       ^^^^^^^^^^^^^^
TypeError: '>=' not supported between instances of 'int' and 'NoneType'
```

## Root Cause Analysis

### 1. APWorld Rule Pattern

The Wordipelago apworld uses Python's `*` unpacking operator to pass arguments from a dictionary:

```python
# From wordipelago/rules.py
rules_for_difficulty = rule_logic[world.options.logic_difficulty.value]

multiworld.get_region("Letters", player).add_exits(
    ["Word Best", "Green Checks", "Yellow Checks", 'Point Shop'],
    {"Point Shop": lambda state: needed_for_words(state, world.player, *(rules_for_difficulty["pointShop"]))}
)
```

### 2. Exporter Limitation

The exporter's AST analysis (`exporter/analyzer/ast_visitors/call_visitor.py`) cannot handle `Starred` nodes:

```python
# Line 77-82 in call_visitor.py
for i, arg_node in enumerate(node.args):
    arg_result = self.visit(arg_node)  # Returns None for Starred nodes
    if arg_result is None:
        logging.error(f"Failed to analyze argument {i} in call: {ast.dump(arg_node)}")
        continue  # Argument is skipped!
```

When the exporter encounters `*(rules_for_difficulty["pointShop"])`, it:
1. Logs an error: `Failed to analyze argument 2 in call: Starred(value=Subscript...)`
2. Skips the argument (continues without adding it to the args list)
3. Creates a helper call with no arguments

### 3. Generated Code Issue

The world generator creates helper calls without the required arguments:

```python
# Generated Rules.py (incorrect)
world.set_rule(
    multiworld.get_entrance("Letters -> Point Shop", player),
    HelperCall(helper_func=needed_for_words, helper_name="needed_for_words")
    # Missing args: vowels, score, guesses, yellow
)
```

### 4. Runtime Failure

The helper function has default parameter values of `None`:

```python
def needed_for_words(state, player, vowels=None, score=None, guesses=1, yellow=False):
    # ...
    return state.has_from_list_unique(vowels_items, player, vowels)  # vowels is None!
```

When called without arguments, `state.has_from_list_unique(..., None)` eventually performs `found >= None`, which raises the TypeError.

## logicrules.py Contents

The expected argument values are defined in `logicrules.py`:

```python
rule_logic = {
    0: {  # Easy
        "pointShop": [3, 40, 2, False],  # [vowels, score, guesses, yellow]
        # ...
    },
    1: {  # Medium
        "pointShop": [2, 20, 1, False],
        # ...
    },
    2: {  # Hard
        "pointShop": [1, 3, 1, False],
        # ...
    }
}
```

## Possible Solutions

### 1. Apworld Maintainer Fix (Recommended)

Rewrite the rules without using unpacking:

```python
# Instead of:
lambda state: needed_for_words(state, world.player, *(rules_for_difficulty["pointShop"]))

# Use explicit arguments:
lambda state: needed_for_words(
    state, world.player,
    rules_for_difficulty["pointShop"][0],  # vowels
    rules_for_difficulty["pointShop"][1],  # score
    rules_for_difficulty["pointShop"][2],  # guesses
    rules_for_difficulty["pointShop"][3]   # yellow
)
```

### 2. Exporter Enhancement (Complex)

Add `visit_Starred` support to the exporter:
- Would need to resolve the dictionary lookup at export time
- Dictionary values depend on `world.options.logic_difficulty.value`
- At export time, we know the specific option value, so this is theoretically possible
- Requires significant changes to the AST visitor

### 3. Worldgen Defensive Coding (Safeguard)

Modify worldgen to not use `None` defaults for required parameters, or add validation:

```python
def needed_for_words(state, player, vowels, score, guesses=1, yellow=False):
    if vowels is None or score is None:
        raise ValueError("vowels and score are required parameters")
    # ...
```

## Recommendation

1. **Add Wordipelago to the known-incompatible list** for UT fuzz tests
2. **Report issue to apworld maintainer** with the solution above
3. **Consider exporter enhancement** as a long-term improvement to support this pattern

## Related Files

- `custom_worlds/wordipelago.apworld` - The apworld package
- `exporter/analyzer/ast_visitors/call_visitor.py` - Where Starred nodes fail
- `world_generator/generators/rules_generator.py` - Where helper calls are generated
- `rule_builder/rules.py` - HelperCall evaluation

## Test Reproduction

```bash
source .venv/bin/activate

# Download apworld
curl -L -o custom_worlds/wordipelago.apworld \
    "https://github.com/ProfDeCube/Archipelago/releases/download/1.0.0/wordipelago.apworld"

# Regenerate templates
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer (will fail)
python fuzz.py -r 1 -j 1 -g wordipelago -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0

# Check error log
cat fuzz_output/error/wordipelago/0/0.log | tail -50
```
