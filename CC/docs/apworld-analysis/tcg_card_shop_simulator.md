# TCG Card Shop Simulator APWorld Analysis

## APWorld Information
- **Game**: TCG Card Shop Simulator
- **Version**: v0.5.13
- **Source**: https://github.com/FyreDay/Archipelago-TCGCardShopSimulator
- **Download**: https://github.com/FyreDay/Archipelago-TCGCardShopSimulator/releases/download/v0.5.13/tcg_card_shop_simulator.apworld

## Analysis Date
2026-01-23

## Issues Found

### 1. Python 3.12+ Syntax Compatibility (FIXED UPSTREAM)

**Issue**: The apworld uses Python 3.12+ f-string syntax with nested quotes:
```python
sell_item_locs[f"Sell {n} {"Boxes" if n>1 else "Box"} of {item_key}"] = ...
```

This syntax is invalid in Python 3.11 and earlier.

**Location**:
- `locations.py:168`
- `rules.py:548`

**Fix**: Changed nested double quotes to single quotes:
```python
sell_item_locs[f"Sell {n} {'Boxes' if n>1 else 'Box'} of {item_key}"] = ...
```

**Status**: Fixed in local patched version. Should be reported to apworld maintainer.

### 2. Enum Parameter Access in Helper Functions (FIXED IN world_generator)

**Issue**: The apworld's `has_card_pack` helper function accepts a `CardRegion` enum parameter and accesses `.value` on it. When exported, the enum values are serialized as integers, but the helper body still tries to access `.value` on them.

**Error**:
```
AttributeError: 'int' object has no attribute 'value'
```

**Root Cause**: When the exporter captures helper function bodies that use `param.value` where `param` is an enum, the generated code still uses `.value` even though the argument is now an integer.

**Fix**: Added handling in `world_generator/rule_codegen.py` in `_expr_attribute()` to recognize when a helper parameter is being accessed with `.value` and strip the `.value` access since the parameter is already an integer value.

**Status**: Fixed in `world_generator/rule_codegen.py`.

### 3. Complex Dynamic Rule Logic (NOT FIXED - FUNDAMENTAL INCOMPATIBILITY)

**Issue**: The apworld uses dynamic data structures (`pg1_licenses`, `pg2_licenses`, etc.) that map item codes to level requirements. These are populated during world setup and used in rule evaluation. While the exporter captures these as hardcoded dictionaries, the rule evaluation in UT doesn't match the server's evaluation.

**Example**: The `has_required_licenses` helper iterates over license dictionaries to count how many items from lower levels the player needs to have. The exported version has hardcoded dictionaries but the logic doesn't evaluate the same way.

**Symptoms**: Logic mismatch errors like:
- "Locations X were in server logic but not expected in UT"
- Different sell locations are accessible between server and UT

**Status**: This is a fundamental incompatibility that would require either:
1. A custom game-specific exporter for TCG Card Shop Simulator
2. Restructuring the apworld's rule system to be more exportable
3. Significant improvements to the generic exporter to handle this pattern

## UT Fuzzer Results

### After Fixes
- **Total runs**: 10
- **Success**: 0 (0.0%)
- **Failures**: 10
- **Timeouts**: 0

The failures are now due to logic mismatches (error type: `None`), not code errors.

### Error Type
`None` - Logic mismatch between UT and server rule evaluation

## Recommendations

1. **Report Python 3.12+ syntax issue to apworld maintainer** - The apworld should be updated to use compatible syntax for Python 3.11.

2. **Add to known-incompatible list** - Due to the complex dynamic rule system, this apworld is fundamentally incompatible with the current UT tracking approach.

3. **Consider custom exporter** - If UT support is desired, a custom exporter would need to be written that understands the license system pattern.

## Files Modified

1. `world_generator/rule_codegen.py` - Added handling for enum parameter `.value` access in helper functions
2. `custom_worlds/tcg_card_shop_simulator.apworld` - Patched Python 3.12+ syntax (local only)

## Test Commands

```bash
# Download and patch apworld
curl -L -o custom_worlds/tcg_card_shop_simulator.apworld "https://github.com/FyreDay/Archipelago-TCGCardShopSimulator/releases/download/v0.5.13/tcg_card_shop_simulator.apworld"
# Manual patching required for Python 3.11 compatibility

# Run fuzzer test
source .venv/bin/activate
python fuzz.py -r 10 -j 4 -g tcg_card_shop_simulator -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```
