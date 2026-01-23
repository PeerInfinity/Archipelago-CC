# System Shock 2 APWorld - UT Fuzzer Analysis

## Summary

**Game**: System Shock 2
**APWorld Version**: 0.4.1
**Source**: https://codeberg.org/Partatio/SS2-Apworld
**Status**: Incompatible with Universal Tracker (100% failure rate)

## Test Results

- **Total runs**: 10
- **Success**: 0 (0.0%)
- **Failures**: 5 (logic mismatches)
- **Ignored**: 5 (pre-generation failures)

## Root Cause Analysis

### Issue 1: Unknown Helper - `cyb_mod_count`

The SS2 apworld uses a custom helper method `cyb_mod_count(state)` that calculates the total number of "Cyber Modules" the player has by summing up multiple item types:

```python
def cyb_mod_count(self, state) -> int:
    curcybmodamount = 0
    curcybmodamount += state.count("2 Cyber Modules", self.player) * 2
    curcybmodamount += state.count("3 Cyber Modules", self.player) * 3
    curcybmodamount += state.count("4 Cyber Modules", self.player) * 4
    # ... etc for all cyber module denominations
    return curcybmodamount
```

This is used in location rules like:
```python
case "Cyber Modules":
    add_rule(loc, lambda state, a = amount: a <= self.cyb_mod_count(state))
```

**Problem**: The worldgen code generator doesn't understand this helper, so it substitutes `True_()`:

```python
# In generated Rules.py - INCORRECT
world.set_rule(
    multiworld.get_location("Cyber module shop 1", player),
    Compare(6, "<=", True_())  # Should compare to actual cyber module count
)
```

This causes `6 <= True` to evaluate to `6 <= 1` = `False`, making all Cyber Module Shop locations appear inaccessible to the tracker, while the server correctly evaluates them as accessible once enough modules are collected.

### Issue 2: Walrus Operator (NamedExpr) in Lambda

The apworld uses Python's walrus operator (`:=`) inside lambda expressions:

```python
lambda state: state.has("Psi Amp", self.player) and self.upgrade_or_cybmod(
    state, "Metacreative Barrier Psi Ability", 1, 169,
    curcba := self.cyb_mod_count(state)
)
```

The exporter cannot analyze NamedExpr (walrus operator) AST nodes:
```
Failed to analyze argument 4 in call: NamedExpr(target=Name(id='curcba', ctx=Store()), ...)
```

### Issue 3: Complex Resource Accumulation Pattern

The `cyb_mod_count` pattern represents a **weighted sum of multiple items**:
- "2 Cyber Modules" × count × 2
- "3 Cyber Modules" × count × 3
- etc.

This is a resource pool pattern where multiple item types contribute to a single logical resource. The exporter could potentially convert this to a `WeightedSum` rule, but it would require game-specific handling.

### Issue 4: Dynamic Item Count Adjustments

The apworld dynamically adjusts item counts based on options:

```python
if self.options.remove_duplicate_locations:
    SS2itemlist["Wrench"]["count"] -= 12
    SS2itemlist["Pistol"]["count"] -= 4
    # ... many more adjustments
```

This can lead to item/location count mismatches depending on the random option combination selected by the fuzzer.

## Affected Locations

**147 "Cyber module shop" locations** (when `include_stats_skills_psi` option is enabled):
- Cyber module shop 1 (requires 6 cyber modules)
- Cyber module shop 2 (requires 12 cyber modules)
- ... up to ...
- Cyber module shop 147 (requires very high cyber module count)

## Recommendations

### For This Project

1. **Add to known-incompatible list**: This apworld cannot be supported without significant effort.

2. **Create SS2 exporter handler** (if support is desired):
   - Add `exporter/games/unofficial/ss2.py`
   - Convert `cyb_mod_count` helper to `WeightedSum` rule
   - Handle `upgrade_or_cybmod` helper similarly

Example exporter approach:
```python
# Convert cyb_mod_count to WeightedSum
def _convert_cyb_mod_count(self, rule_data):
    """Convert cyb_mod_count helper to WeightedSum rule."""
    items = [
        ("2 Cyber Modules", 2),
        ("3 Cyber Modules", 3),
        ("4 Cyber Modules", 4),
        # ... all denominations
    ]
    return {
        "rule": "WeightedSum",
        "args": {"items": items}
    }
```

### For APWorld Maintainer

1. **Refactor cyber module counting**: Use a single "Cyber Modules" item with quantity instead of multiple denominations, or use a pattern that standard Archipelago tools can understand.

2. **Avoid walrus operator in lambdas**: The `:=` operator in lambda expressions is not well-supported by AST analyzers.

3. **Ensure item/location balance**: The dynamic item count adjustments may cause generation failures with certain option combinations.

## Technical Details

### Exported Rules JSON

The exporter correctly captures the helper:
```json
{
  "name": "Cyber module shop 1",
  "access_rule": {
    "rule": "Compare",
    "args": {
      "left": 6,
      "op": "<=",
      "right": {
        "rule": "cyb_mod_count",
        "_original_ast_type": "helper",
        "_converted_from_ast": true
      }
    }
  }
}
```

### Generated Rules.py (Incorrect)

The world generator produces:
```python
world.set_rule(
    multiworld.get_location("Cyber module shop 1", player),
    Compare(6, "<=", True_())  # Fallback for unknown helper
)
```

### Expected Rules.py (Correct)

Would need to be:
```python
world.set_rule(
    multiworld.get_location("Cyber module shop 1", player),
    Compare(6, "<=", WeightedSum([
        ("2 Cyber Modules", 2),
        ("3 Cyber Modules", 3),
        ("4 Cyber Modules", 4),
        # ... etc
    ]))
)
```

## Files Examined

- `custom_worlds/ss2.apworld` - APWorld package
- `ss2/__init__.py` - Main world class with `cyb_mod_count` method
- `ss2/items.py` - Item definitions (396 items)
- `ss2/locations.py` - Location definitions (1628 locations)

## Conclusion

The System Shock 2 apworld is **fundamentally incompatible** with the Universal Tracker due to its use of the custom `cyb_mod_count` resource accumulation helper. This is a legitimate game design pattern, but it's not one that the current exporter/worldgen infrastructure can handle without game-specific support.

Adding support would require creating an unofficial game handler that converts the `cyb_mod_count` calls to equivalent Rule Builder `WeightedSum` rules.
