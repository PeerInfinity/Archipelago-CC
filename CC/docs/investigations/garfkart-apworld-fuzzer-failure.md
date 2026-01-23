# Garfield Kart - Furious Racing APWorld Fuzzer Failure Investigation

## Summary

The Garfield Kart - Furious Racing apworld fails 100% of UT fuzzer tests due to a **bug in the apworld source code**, not a UT tracking issue.

## Error Pattern

```
compared against a str that could never be equal. RandomizeSpoilers(Off) == on
compared against a str that could never be equal. RandomizeSpoilers(Progressive) == on
```

All 10 test runs failed with similar errors.

## Root Cause

In `garfkart/locations.py`, the code compares `Choice` options against an invalid string value `"on"`:

```python
# Line 148-149 (problematic code):
if world.options.randomize_spoilers in ["on", "progressive"]:

# Line 158-164 (similar issue):
if world.options.randomize_hats in ["on", "progressive"]:
```

### Valid Option Values

The `RandomizeSpoilers` and `RandomizeHats` options define these valid values:

| Option Name      | Value |
|------------------|-------|
| `option_off`     | 0     |
| `option_progressive` | 1 |
| `option_combine_tiers` | 2 |

The string `"on"` does **not exist** as a valid option name.

### Archipelago's Safety Check

Archipelago's `Options.py:471` asserts that string comparisons use valid option names:

```python
def __eq__(self, other):
    if isinstance(other, str):
        assert other in self.options, f"compared against a str that could never be equal. {self} == {other}"
        return other == self.current_key
```

This prevents silent bugs where invalid comparisons would always return `False`.

## APWorld Details

- **Source**: https://github.com/FeluciaPS/Archipelago
- **Release**: v0.4.3-beta
- **Download URL**: https://github.com/FeluciaPS/Archipelago/releases/download/v0.4.3-beta/garfkart.apworld

## Impact

This is a **fundamental compatibility issue** that prevents:
- Basic seed generation
- Any gameplay with this apworld

The issue occurs regardless of option settings because the code always evaluates these comparisons.

## Required Fix (APWorld Maintainer)

The apworld code needs to use valid option comparisons:

```python
# FROM (incorrect):
if world.options.randomize_spoilers in ["on", "progressive"]:
if world.options.randomize_hats in ["on", "progressive"]:

# TO (correct - check if enabled):
if world.options.randomize_spoilers.current_key != "off":
if world.options.randomize_hats.current_key != "off":

# OR (correct - check specific values):
if world.options.randomize_spoilers.current_key in ["progressive", "combine_tiers"]:
if world.options.randomize_hats.current_key in ["progressive", "combine_tiers"]:

# OR (using numeric values):
if world.options.randomize_spoilers.value != 0:
if world.options.randomize_hats.value != 0:
```

## Recommendations

1. **Report to maintainer**: Open an issue at https://github.com/FeluciaPS/Archipelago
2. **Mark as incompatible**: Add to known-incompatible apworlds list until fixed
3. **Cannot fix via exporter**: This is a source code bug, not an export/tracking issue

## Reproduction

```bash
source .venv/bin/activate

# Download apworld
curl -L -o custom_worlds/garfkart.apworld "https://github.com/FeluciaPS/Archipelago/releases/download/v0.4.3-beta/garfkart.apworld"

# Generate templates
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Attempt seed generation (will fail)
python Generate.py --weights_file_path "Templates/Garfield Kart - Furious Racing.yaml" --multi 1 --seed 1
```

## Date

2026-01-23
