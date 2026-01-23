# Majora's Mask Recompiled (mm_recomp) UT Fuzzer Investigation Report

## Summary

The mm_recomp apworld fails UT fuzzer testing due to **multiple compounding compatibility issues** related to randomized shop prices. The tracker cannot correctly evaluate shop location accessibility because the dynamically generated prices are not properly communicated between the original seed and the tracker.

## Test Results

- **Total runs**: 10
- **Success rate**: ~40%
- **Failure type**: Logic mismatch (error type: `None`)

## Root Cause Analysis

### Issue 1: Rules.json Auto-Discovery Fails

**Location**: `worlds/tracker/TrackerCore.py:456`

The TrackerCore's `auto_discover_rules_json()` function converts game names to directory paths by removing apostrophes:
```python
world_directory = self.game.lower().replace(' ', '_').replace("'", "")
```

For "Majora's Mask Recompiled":
- **Computed path**: `majoras_mask_recompiled` (no apostrophe)
- **Actual path**: `majora's_mask_recompiled` (with apostrophe)

This causes rules.json discovery to fail, preventing worldgen-based tracking.

### Issue 2: Shop Prices Not Exported to rules.json

The mm_recomp exporter handler (`exporter/games/unofficial/mm_recomp.py`) correctly:
1. Loads shop prices from `world.prices_ints`
2. Generates wallet rules via `override_rule_analysis()`

However, it does NOT:
1. Export the actual price values to game_info in rules.json
2. Implement `get_game_info()` to save shop_prices_ints

Even though shop_prices are in the .archipelago slot_data, they're missing from rules.json, making it impossible for the worldgen world to reconstruct the correct wallet requirements.

### Issue 3: Price Randomization is Non-Deterministic

When TrackerCore falls back to native UT tracking (via `run_generator`):
1. It creates a NEW mm_recomp world from the fuzzer YAML
2. The YAML only specifies `shop_prices: offensive` (randomization mode)
3. The new world generates COMPLETELY DIFFERENT random prices
4. Different prices = different wallet requirements = logic mismatch

## Evidence from Logs

From the fuzzer error log:
```
[MMRecomp] Loaded 36 shop prices from world        # During original seed generation
...
[MMRecomp] Using default shop prices (world prices not available)  # During tracker initialization
```

This shows the tracker couldn't access the original prices and fell back to defaults.

## Specific Failure Example

**Sphere 0 mismatch**:
- **Server logic includes**: `Clock Town Trading Post Shop (Night) Item 1` (price=51, no wallet required)
- **UT logic includes**: `Clock Town Trading Post Shop Item 8` (requires Wallet x2 at original price=468)

The UT evaluated with different prices, causing it to think more locations were accessible.

## JSON Export Analysis

The rules.json correctly exports wallet rules:
```json
{
  "Clock Town Trading Post Shop Item 1": {
    "access_rule": {"rule": "Has", "args": {"item_name": "Progressive Wallet", "count": 2}}
  },
  "Clock Town Trading Post Shop (Night) Item 1": {
    "access_rule": {"rule": "True_"}  // price=51, no wallet needed
  }
}
```

But the game_info section is empty - no prices are exported:
```json
"game_info": {"1": {}}
```

## Recommendations

### Short-term (Workaround)
Add mm_recomp to a "known incompatible" list for UT fuzzer testing. The apworld has fundamental architecture incompatibilities with the tracker.

### Medium-term (Fixes Required)

1. **Fix apostrophe handling** in `auto_discover_rules_json()`:
   ```python
   # Don't strip apostrophes from directory names
   world_directory = self.game.lower().replace(' ', '_')
   ```

2. **Add get_game_info() to mm_recomp handler**:
   ```python
   def get_game_info(self, world) -> Dict[str, Any]:
       game_info = super().get_game_info(world)
       if hasattr(world, 'prices_ints'):
           game_info['shop_prices_ints'] = world.prices_ints
       return game_info
   ```

3. **Update worldgen world loading** to receive prices from game_info and configure shop rules accordingly.

### Long-term (Apworld Changes)
The apworld maintainer could:
1. Use slot_data for prices (already done) AND ensure prices are deterministic from seed
2. Consider using the Rule Builder directly instead of closure-based rules
3. Expose a method to set prices for tracker compatibility

## Files Involved

- `worlds/tracker/TrackerCore.py` - auto_discover_rules_json() path handling
- `exporter/games/unofficial/mm_recomp.py` - missing get_game_info()
- `custom_worlds/mm_recomp.apworld` - price randomization in create_regions()

## Classification

**Type**: Fundamental compatibility issue (not a simple bug)
**Severity**: Medium (apworld-specific, doesn't affect other worlds)
**Fixable by us**: Partially (apostrophe fix + handler update helps, but complete fix requires apworld changes)

---

*Investigation completed: 2026-01-23*
