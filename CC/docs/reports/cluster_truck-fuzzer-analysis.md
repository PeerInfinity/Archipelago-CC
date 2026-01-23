# ClusterTruck APWorld Fuzzer Analysis Report

**Date**: 2026-01-23
**APWorld Version**: 1.3.1
**Source**: https://github.com/Nullctipus/ArchipelagoClusterTruck/releases/download/1.3.1/cluster_truck.apworld
**Failure Type**: FillError
**Success Rate**: ~30-60% (varies by random configuration)

## Summary

The ClusterTruck apworld has a **fundamental item balance bug** that causes `FillError` when the `start_level` is also included in `skipped_levels`. This is an upstream bug in the apworld that **cannot be fixed** in our codebase.

## Root Cause Analysis

### The Bug

In `ClusterTruckWorld.create_items()`, there's an unconditional addition of a filler item:

```python
def create_items(self) -> None:
    for location in self.all_selected_locations:
        if location.game_id > len(location_list):
            break
        try:
            if (location.game_id != self.options.start_level.value
                    and location.game_id != self.options.goal_level.value):
                self.multiworld.itempool.append(self.create_item(location.name))
        except Exception as e:
            print(location.name)
            raise e

    # ... victory item placement ...

    # there needs to be one more item /shrug  <-- THE BUG
    self.multiworld.itempool.append(self.create_item(self.get_filler_item_name()))
```

The comment `# there needs to be one more item /shrug` indicates the developer wasn't sure why this was needed.

### Why It Fails

When `start_level` is **also in** `skipped_levels`:

1. `all_selected_locations` excludes `start_level` because it's in `skipped_level`
2. The item exclusion check `if (location.game_id != self.options.start_level.value ...)` doesn't exclude anything because start is already not in the list
3. The unconditional filler item is still added
4. **Result**: 1 more item than available locations

### Example Calculation

From a failing configuration with:
- `start_level: '1_6'` (game_id 5)
- `skipped_levels` contains `'1-6'` (also game_id 5)
- 62 skipped levels total

| Metric | Count |
|--------|-------|
| Total locations | 119 |
| Skipped levels | 62 |
| all_selected_locations | 57 (43 level + 14 ability) |
| Items from locations | 57 (start not excluded - already not in list) |
| Filler item added | +1 |
| **Total items** | **58** |
| Locations created | 58 (57 + goal) |
| Free locations (goal has Victory) | **57** |
| **Difference** | **+1 item** |

This causes: `FillError: Game appears as unbeatable. Aborting.`

## Reproduction

```bash
# Download the apworld
curl -L -o custom_worlds/cluster_truck.apworld \
    "https://github.com/Nullctipus/ArchipelagoClusterTruck/releases/download/1.3.1/cluster_truck.apworld"

# Generate templates
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer to reproduce
python fuzz.py -r 10 -j 4 -g cluster_truck -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

Failures occur when the randomly generated `skipped_levels` happens to include the `start_level`.

## Recommended Fix (for apworld maintainer)

In `ClusterTruckWorld.create_items()`, replace:

```python
# there needs to be one more item /shrug
self.multiworld.itempool.append(self.create_item(self.get_filler_item_name()))
```

With:

```python
# Only add extra filler if start_level was actually in the pool and excluded
start_in_pool = any(loc.game_id == self.options.start_level.value
                    for loc in self.all_selected_locations)
if start_in_pool:
    self.multiworld.itempool.append(self.create_item(self.get_filler_item_name()))
```

Or better: validate that `start_level` is not in `skipped_levels` during `generate_early()`.

## Resolution Options

1. **Report to maintainer** - File an issue at https://github.com/Nullctipus/ArchipelagoClusterTruck
2. **Add to known-incompatible list** - Document that this apworld has balance bugs with certain configurations
3. **Create an exporter workaround** - Not possible since this is a generation-time bug, not an export/tracking bug

## Files Examined

- `custom_worlds/cluster_truck.apworld/cluster_truck/__init__.py` - Main world class with the bug
- `custom_worlds/cluster_truck.apworld/cluster_truck/Items.py` - Item definitions
- `custom_worlds/cluster_truck.apworld/cluster_truck/Locations.py` - Location definitions
- `custom_worlds/cluster_truck.apworld/cluster_truck/Options.py` - Option definitions including skipped_levels

## Conclusion

This is a **fundamental bug in the ClusterTruck apworld** that cannot be fixed without modifying the apworld itself. The bug occurs when randomized configurations cause `start_level` to be included in `skipped_levels`, resulting in an item/location imbalance.

**Recommendation**: Add ClusterTruck to a "known issues" list and/or report to the apworld maintainer.
