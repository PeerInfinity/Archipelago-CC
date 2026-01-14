# Ratchet & Clank 2 APWorld Fuzzer Failure Investigation

## Summary

**APWorld**: Ratchet & Clank 2 (rac2)
**Source**: https://github.com/evilwb/APRac2/releases/download/v0.6.4/rac2.apworld
**Failure Type**: Logic mismatch (error type: `None`)
**Success Rate**: 0% (10/10 failures)

## Root Cause

The fuzzer failures are caused by **option-dependent rules** in the apworld that the world generator cannot properly convert to static Rule Builder expressions.

### Technical Details

1. **Option-dependent rules**: The apworld has rules that check `world.options.first_person_mode_glitch_in_logic` to determine accessibility:

```python
# From Logic.py in rac2 apworld
def maktar_photo_booth_rule(state, player):
    options = get_options(state, player)
    if options.first_person_mode_glitch_in_logic >= FIRST_PERSON_MEDIUM:
        return can_electrolyze(state, player) or can_heli(state, player)
    return can_electrolyze(state, player)
```

2. **Export preserves the structure**: The exporter correctly captures this as an AST block:

```json
{
  "rule": "AST_block",
  "args": {
    "statements": [
      {"type": "assign", "name": "options", "value": {"type": "helper", "name": "get_options"}},
      {"type": "if_statement", "test": {"type": "compare", "left": {...}, "op": ">=", "right": {"value": 2}}, ...},
      {"type": "return", ...}
    ]
  }
}
```

3. **World generator fails to convert**: During code generation:
   - `get_options` helper expands to `{"type": "world_attribute", "attribute": "options"}`
   - `_expr_to_rule_builder` has no handler for `world_attribute` type → returns `None`
   - `_generate_runtime_ast_block` fails and falls back to static evaluation
   - Static evaluation can't resolve the conditional → defaults to `True_()`

4. **Result**: The generated rule becomes `True_()` (always accessible), but the actual game logic requires specific items depending on the option value.

### Affected Locations

Any location with rules that depend on `first_person_mode_glitch_in_logic` option:
- `Maktar: Photo Booth`
- `Oozla: End of Store Cutscene`
- `Oozla: Tractor Puzzle - Platinum Bolt`
- `Oozla: Swamp Ruins - Platinum Bolt`
- And many more (~50% of locations)

## Reproduction

```bash
source .venv/bin/activate

# Download apworld
curl -L -o custom_worlds/rac2.apworld "https://github.com/evilwb/APRac2/releases/download/v0.6.4/rac2.apworld"

# Generate templates
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer
python fuzz.py -r 1 -j 1 -g rac2 -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0
```

## Potential Fixes

### Option 1: Static evaluation of option comparisons (Recommended)

In `_expand_helper_refs` or `_evaluate_ast_block_statements`, when we encounter a comparison like:
```
options.first_person_mode_glitch_in_logic >= 2
```

And we have the option value in settings (`first_person_mode_glitch_in_logic: 2`), evaluate the comparison statically and short-circuit the if statement to only keep the relevant branch.

**Pros**: Clean solution, reduces generated code complexity
**Cons**: Requires changes to `_expand_helper_refs` to handle attribute access on `options`

### Option 2: Add `world_attribute` handling to `_expr_to_rule_builder`

Add a handler for `world_attribute` type that generates a `WorldAttribute()` Rule Builder call:

```python
if expr_type == 'world_attribute':
    attr = expr.get('attribute', '')
    self.required_imports.add('WorldAttribute')
    return f'WorldAttribute("{attr}")'
```

**Pros**: Generic solution
**Cons**: Still doesn't help with the conditional evaluation

### Option 3: Generate Conditional expressions

When the if test can't be evaluated statically but contains runtime-evaluatable parts, generate a `Conditional()` Rule Builder expression.

**Pros**: Preserves the exact logic
**Cons**: Complex implementation, may generate verbose code

## Workaround

Currently, there is no workaround. The apworld's heavy reliance on option-dependent logic makes it incompatible with the current world generator.

## Classification

**Category**: World Generator Limitation
**Priority**: Medium
**Affected Games**: Ratchet & Clank 2 (and potentially other apworlds with similar patterns)

## Related Files

- `world_generator/rule_codegen.py` - `_generate_runtime_ast_block`, `_expr_to_rule_builder`
- `exporter/exporter.py` - Rule export logic
- `worlds/tracker/fuzzer_hook.py` - UT fuzzer hook

## Action Items

1. [ ] Add handling for option-dependent conditionals in world generator
2. [ ] Add rac2 to known-incompatible apworld list until fixed
3. [ ] Consider creating a game-specific exporter for rac2
