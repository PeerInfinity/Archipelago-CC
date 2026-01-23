# System Shock 2 APWorld - UT Fuzzer Analysis

## Summary

**Game**: System Shock 2
**APWorld Version**: 0.4.1
**Source**: https://codeberg.org/Partatio/SS2-Apworld
**Status**: Partially compatible (10% success rate after fixes)

## Test Results

### Before Fixes
- **Total runs**: 10
- **Success**: 0 (0.0%)
- **Failures**: 5 (logic mismatches)
- **Ignored**: 5 (pre-generation failures)

### After Fixes
- **Total runs**: 10
- **Success**: 1 (10%)
- **Failures**: 4 (2 logic mismatches, 2 FillError)
- **Ignored**: 5 (pre-generation failures)

## Fixes Implemented

### 1. Walrus Operator Support (NamedExpr)

Added `visit_NamedExpr` to `exporter/analyzer/ast_visitors/expression_visitors.py` to handle Python's walrus operator (`:=`) in lambda expressions:

```python
def visit_NamedExpr(self, node: ast.NamedExpr):
    """Handle named expressions (walrus operator := )."""
    # Simply evaluate and return the value expression
    return self.visit(node.value)
```

This fixes the error:
```
Failed to analyze argument 4 in call: NamedExpr(target=Name(id='curcba', ctx=Store()), ...)
```

### 2. SS2 Game Handler

Created `exporter/games/unofficial/ss2.py` with support for:

- **`cyb_mod_count` helper**: Converts to `WeightedSum` rule that sums cyber module items:
  ```python
  WeightedSum(threshold=N, items=[
      ("2 Cyber Modules", 2.0),
      ("3 Cyber Modules", 3.0),
      # ... all denominations up to 30
      ("Naturally Able OSUpgrade", 20.0)
  ])
  ```

- **`upgrade_or_cybmod` helper**: Converts to Or(Has(item), WeightedSum(...))

- **`Functional_Weapon` / `has_functional_weapon`**: Converts to HasAny for weapon items:
  ```python
  HasAny(['Pistol', 'Damaged Pistol', 'Broken Pistol', 'Shotgun', 'Laser Pistol', 'Psi Amp', ...])
  ```

## Remaining Issues

### Issue 1: Complex Logic Patterns

Some complex helper interactions still cause logic mismatches. The SS2 world uses intricate combinations of:
- Cyber module thresholds
- Weapon availability with repair/upgrade requirements
- Psi abilities with tier requirements

Not all of these patterns can be fully replicated without extensive game-specific logic.

### Issue 2: Item/Location Imbalances (FillError)

The apworld dynamically adjusts item counts based on options:

```python
if self.options.remove_duplicate_locations:
    SS2itemlist["Wrench"]["count"] -= 12
    SS2itemlist["Pistol"]["count"] -= 4
    # ... many more adjustments
```

This can cause FillError when certain option combinations create more items than locations.

### Issue 3: High Ignore Rate

~50% of fuzzer runs are "ignored" because the world fails to generate. This is due to:
- Option combinations that create invalid configurations
- The apworld targeting an older Archipelago version (missing `archipelago.json` manifest)

## Root Cause Analysis

### cyb_mod_count Pattern

The SS2 apworld uses a **weighted sum of multiple items** to calculate total cyber modules:

```python
def cyb_mod_count(self, state) -> int:
    total = 0
    total += state.count("2 Cyber Modules", self.player) * 2
    total += state.count("3 Cyber Modules", self.player) * 3
    # ... etc
    return total
```

This is now converted to the Rule Builder's `WeightedSum` rule, which correctly evaluates the resource pool.

### Functional_Weapon Pattern

The `has_functional_weapon` method checks for various weapon combinations with repairs, upgrades, and ammo. We approximate this as having ANY weapon item, which is less restrictive than the original but allows progression.

## Affected Locations

**147 "Cyber module shop" locations** (when `include_stats_skills_psi` option is enabled):
- Now correctly use `WeightedSum` rules
- Properly evaluate cyber module totals

**All locations with weapon requirements**:
- Now use `HasAny` for weapon items
- Approximation is less restrictive than original

## Files Modified

1. `exporter/analyzer/ast_visitors/expression_visitors.py`
   - Added `visit_NamedExpr` for walrus operator support

2. `exporter/games/unofficial/ss2.py` (new file)
   - SS2-specific game handler
   - WeightedSum conversion for cyb_mod_count
   - Functional_Weapon handling

## Recommendations

### For Further Improvement

1. **More precise Functional_Weapon logic**: The current implementation is an approximation. A more accurate version would check for weapon + ammo + repair/upgrade combinations.

2. **Handle more SS2-specific helpers**: There may be other helpers that need conversion.

3. **Report to APWorld maintainer**: The item/location imbalances should be fixed in the apworld itself.

### For APWorld Maintainer

1. **Add `archipelago.json` manifest**: The apworld is missing the manifest file required for Archipelago 0.7.0+.

2. **Fix item/location balance**: Ensure all option combinations produce valid item/location counts.

3. **Consider simplifying cyber module logic**: Using a single "Cyber Modules" item with quantity would be more compatible with tracking tools.

## Conclusion

The System Shock 2 apworld has been partially made compatible with the Universal Tracker through:

1. Adding walrus operator support to the exporter
2. Creating a game-specific handler for SS2's custom helpers

The remaining 90% failure rate is due to:
- Complex logic patterns not fully replicated
- APWorld bugs (item/location imbalances, missing manifest)
- Option combinations that fail generation

Full compatibility would require either:
- More extensive game-specific logic in the handler
- Fixes to the apworld itself by its maintainer
