# Wordipelago UT Fuzzer Analysis

## Summary

The Wordipelago apworld fails the UT (Universal Tracker) fuzz test approximately 40% of the time with "None" type errors (logic mismatches). The root cause is that the world_generator cannot properly convert complex option-dependent entrance rules to Python code.

## Test Results

- **Total runs**: 10
- **Success**: 5-6 (50-60%)
- **Failures**: 4-5 (40-50%)
- **Timeouts**: 0
- **Ignored**: 1 (due to certain option combinations)

## Root Cause

### The Problem

Wordipelago uses dynamic entrance rules that depend on game options. For example, the rule for "Words Chunk 1 -> Words Chunk 2" is:

```python
lambda state: state.has(str((world.options.word_checks // 5 + (world.options.word_checks % 5 > 0)) * 1) + ' Words', player)
```

This rule:
1. Reads the `word_checks` option value
2. Performs arithmetic to calculate a threshold
3. Converts to string and concatenates with " Words"
4. Checks if the player has that item

### Export Behavior

The exporter correctly captures this rule in JSON with full structure:
- `OptionValue` references for option access
- `Arithmetic` operations for math
- `str` helper for string conversion
- String concatenation

### World Generator Behavior

When the world_generator processes this rule:
1. `_rule_needs_lambda()` correctly identifies it needs lambda (due to `OptionValue`)
2. `HelperCodeGenerator._generate_expression()` is called
3. The generator **fails to convert** the complex expression
4. Falls back to returning `True`

### Result

The generated `Rules.py` has:
```python
multiworld.get_entrance("Words Chunk 1 -> Words Chunk 2", player).access_rule = \
    lambda state: True
```

This makes the entrance always accessible when it should require specific progression items.

## Impact

When the fuzzer generates a seed:
1. **Server** uses the original apworld rules (correct logic)
2. **UT** uses the worldgen world with broken rules (`True`)
3. UT thinks regions like "Words Chunk 2" are always accessible
4. Server correctly requires progression items
5. Logic mismatch is detected

## Affected Rules

Entrance rules in Wordipelago that fail to convert:
- `Words Chunk 1 -> Words Chunk 2`
- `Words Chunk 2 -> Words Chunk 3`
- `Words Chunk 3 -> Words Chunk 4`
- `Words Chunk 4 -> Words Chunk 5`
- `Streaks Chunk 1 -> Streaks Chunk 2`
- `Streaks Chunk 2 -> Streaks Chunk 3`
- `Streaks Chunk 3 -> Streaks Chunk 4`
- `Streaks Chunk 4 -> Streaks Chunk 5`

All of these use the same pattern of option-dependent item names.

## Technical Details

The `HelperCodeGenerator._generate_expression()` in `world_generator/rule_codegen.py` cannot handle:
1. `str()` helper function calls with `OptionValue` arguments
2. Complex `Arithmetic` expressions nested inside helper calls
3. Dynamic string construction from option values

## Potential Solutions

### Option 1: Improve HelperCodeGenerator (High Effort)

Extend the `HelperCodeGenerator` to properly handle:
- `str()` helper calls with option values
- Dynamic item name construction
- Option-based arithmetic

This would require significant changes to `rule_codegen.py`.

### Option 2: Pre-resolve Option Values (Medium Effort)

When generating worldgen worlds for UT testing:
1. Read the option values from the generated seed
2. Substitute option references with concrete values during export
3. This turns `OptionValue` into `Constant`, making rules simpler

### Option 3: Create Custom Exporter Handler (Low-Medium Effort)

Create `exporter/games/unofficial/wordipelago.py` handler that:
1. Pre-evaluates the chunk transition rules
2. Generates explicit item check rules with resolved item names
3. Similar to how the handler already handles `needed_for_words` star unpacking

### Option 4: Report to APWorld Maintainer (No Code Changes)

Document the incompatibility and suggest the apworld author:
1. Use simpler rule patterns
2. Pre-compute chunk thresholds at world generation time
3. Store thresholds as world attributes instead of computing in rules

### Option 5: Add to Known-Incompatible List

If the apworld cannot be fixed:
1. Add Wordipelago to a known-incompatible list
2. Skip it during UT fuzzer testing
3. Document the specific incompatibility

## Recommendation

**Option 3 (Custom Exporter Handler)** is the most practical approach:
- The existing `wordipelago.py` handler already handles some complex patterns
- We can add logic to pre-evaluate the chunk transition rules
- This fixes the issue without requiring changes to the core world_generator

The handler would:
1. Intercept exit rules for "Words Chunk X -> Words Chunk Y" and "Streaks Chunk X -> Streaks Chunk Y"
2. Read the relevant options from the world
3. Compute the actual item name needed
4. Return a simple `ItemCheck` rule with the resolved item name

## Files Involved

- `custom_worlds/wordipelago.apworld` - The apworld package
- `exporter/games/unofficial/wordipelago.py` - Existing handler (to be extended)
- `world_generator/rule_codegen.py` - Core conversion logic (limitation source)
- `world_generator/templates.py` - Rules.py generation
