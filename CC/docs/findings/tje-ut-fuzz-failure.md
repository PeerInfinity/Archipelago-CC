# ToeJam and Earl - UT Fuzzer Failure Analysis

## Summary

**APWorld**: ToeJam and Earl (tje)
**Version**: v0.3.2
**Source**: https://github.com/IgnisUmbrae/TJE-Archipelago
**Test Results**: 8/10 failures, 0/10 successes, 2/10 ignored (option errors)

## Root Cause: Custom State Tracking

The ToeJam and Earl apworld uses a **custom `collect` method** that implements point-based rank progression. This pattern is fundamentally incompatible with the Universal Tracker's worldgen-based tracking approach.

### How the APWorld Works

1. **Items have point values**: Each item has a `point_value` attribute (e.g., opening presents gives points)

2. **Custom collect method**: The world overrides `collect()` to track cumulative state:
   ```python
   def collect(self, state: "CollectionState", item: "TJEItem") -> bool:
       change = super().collect(state, item)
       if change:
           state.prog_items[item.player]["points"] += item.point_value
           # Calculate rank from points threshold
           rank = max(i for i in range(len(self.rank_thresholds))
                   if self.rank_thresholds[i] <= state.prog_items[item.player]["points"])
           state.prog_items[item.player]["ranks"] = rank
       return change
   ```

3. **Rules check pseudo-items**: Rank locations use `state.has("ranks", player, count)`:
   ```python
   loc.access_rule = lambda state, rank_num=number: state.has("ranks", player, rank_num)
   ```

### Why UT Fails

1. The exporter sees `state.has("ranks", player, count)` and exports it as:
   ```json
   {
     "rule": "Has",
     "args": { "item_name": "ranks", "count": X }
   }
   ```

2. The worldgen world:
   - Does NOT have the custom `collect` method
   - Has no item named "ranks"
   - Cannot track point accumulation across items
   - Therefore `has("ranks", player)` always returns false

3. The server (original apworld) correctly tracks ranks via the custom `collect` method

4. Result: Locations like "Promoted to Dufus", "Promoted to Poindexter", etc. are accessible to the server but not to UT

### Failure Log Example

```
Locations `Promoted to Dufus,Promoted to Poindexter,Promoted to Peanut,Promoted to Dude,Promoted to Bro`
were in server logic but not expected in UT
...
State inventory = `Reached Level 1:1,5 Points (Map Exploration):1,...`
```

Note that the state inventory contains event items like "Reached Level 1" but NOT "ranks" pseudo-items.

## Classification

This is a **fundamental incompatibility** that cannot be fixed by the exporter or tracker. The apworld uses:

1. **Custom item collection logic** that adds state beyond what `has()` normally tracks
2. **Threshold-based progression** where cumulative points determine rank
3. **Option-dependent thresholds** that vary based on game settings

## Possible Solutions

### 1. APWorld Maintainer Fix (Recommended)

The apworld could be restructured to use actual event items for ranks:

```python
# Instead of tracking in prog_items, create actual rank events
def add_rank_event(self, state, rank_number):
    # Create an event item "Rank 1", "Rank 2", etc.
    # Place it when threshold is reached
```

This would require significant refactoring of the apworld.

### 2. Add to Known-Incompatible List

Add ToeJam and Earl to a list of apworlds known to be incompatible with UT due to custom state tracking.

### 3. Custom Exporter Handler

A ToeJam and Earl-specific exporter could potentially:
- Pre-calculate which items contribute to ranks
- Export complex rules like "has X points worth of items"

However, this is extremely complex due to option-dependent thresholds and would be fragile.

## Recommendation

**Add to known-incompatible list** with documentation explaining why. The apworld maintainer could be notified with a suggestion to restructure rank tracking if UT compatibility is desired.

## Test Commands

```bash
# Reproduce a failure
python fuzz.py -r 1 -j 1 -g tje -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 3

# Run multiple tests
python fuzz.py -r 10 -j 4 -g tje -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

## Files Analyzed

- `custom_worlds/tje.apworld` - The apworld package
  - `tje/__init__.py` - Custom `collect` method (lines 42-56)
  - `tje/regions.py` - Rank check rules (lines 88-98)
- `fuzz_output/error/tje/*/` - Failure logs showing rank location mismatches
