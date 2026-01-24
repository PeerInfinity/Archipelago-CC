# ONI (Oxygen Not Included) APWorld Location Cache Bug Investigation

## Summary

The ONI apworld (v0.99) fails UT fuzz tests with ~30% failure rate due to duplicate location names being created when both `bionic=True` and the game is running in base-only mode (`spaced_out=False`).

## Error Details

**Error Message:**
```
AssertionError:  - 1 already exists in the location cache.
```

**Location:** `BaseClasses.py:1282` (Archipelago core)

**Trigger Conditions:**
- `bionic: true`
- `spaced_out: false` (causes `base_only=True` in the world logic)

## Root Cause Analysis

### The Bug

Four Bionic DLC items in `DefaultItemList.json` have empty `tech_base` values:

| Item Name | research_level_base | tech_base |
|-----------|---------------------|-----------|
| Lubrication Station | basic | "" (empty) |
| Data Miner | orbital | "" (empty) |
| Remote Worker Dock | orbital | "" (empty) |
| Remote Controller | orbital | "" (empty) |

### Code Path

When `base_only=True`, the world uses `tech_base` for location naming (`__init__.py:306`):
```python
if self.base_only == True:
    research_level = item.research_level_base
    tech = item.tech_base  # This is empty for the 4 items above
    internal_tech = item.internal_tech_base
```

The location name is constructed as `f"{tech} - {count}"` (line 319), so with empty `tech`:
- **Lubrication Station** creates ` - 1` in `basic_locations`
- **Data Miner** creates ` - 1` in `orbital_locations`

### Why Duplicates Occur

Although these locations are added to different lists (`basic_locations` vs `orbital_locations`), they share the same name ` - 1`. When `create_regions` adds locations to the MultiWorld, Archipelago's global location cache (per player) detects the duplicate name and raises an AssertionError.

### Missing Filter

The code at line 273 only filters items where `tech_base == "None"` (string):
```python
if self.bionic == True and self.base_only == True and item.tech_base == "None":
    continue;
```

This doesn't catch items with empty string `tech_base=""`.

## Reproduction

```bash
# Install the apworld
curl -L -o custom_worlds/oni.apworld "https://github.com/ShadowKitty42/ONI-Archipelago/releases/download/v0.99/oni.apworld"

# Generate templates
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer (30% failure rate expected)
python fuzz.py -r 10 -j 1 -g oni -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

**Failing YAML configuration:**
```yaml
bionic: 'true'
spaced_out: 'false'  # Any non-spaced_out cluster triggers base_only mode
```

## Fix Recommendations

### For APWorld Maintainer (Preferred)

1. **Add proper `tech_base` values** in `DefaultItemList.json` for the 4 affected items:
   - Lubrication Station should have a valid `tech_base` or be excluded from base-only mode
   - Data Miner, Remote Worker Dock, Remote Controller should similarly have valid `tech_base` values

2. **Alternatively, filter items with empty `tech_base`** in `__init__.py` around line 273:
   ```python
   if self.bionic == True and self.base_only == True and (item.tech_base == "None" or item.tech_base == ""):
       continue;
   ```

3. **Or use fallback to `tech`** when `tech_base` is empty:
   ```python
   if self.base_only == True:
       research_level = item.research_level_base
       tech = item.tech_base if item.tech_base else item.tech  # Fallback
       internal_tech = item.internal_tech_base
   ```

### For This Repository (Workaround)

Since we cannot modify the apworld directly, options are:

1. **Add ONI to known-incompatible list** for specific option combinations
2. **Document the issue** for users attempting to use bionic mode with base game clusters

## Files Analyzed

- `custom_worlds/oni.apworld/oni/__init__.py` - Main world class
- `custom_worlds/oni.apworld/oni/data/DefaultItemList.json` - Item definitions
- `fuzz_output/error/oni/*/` - Failure logs and YAML configs

## APWorld Metadata

- **Game:** Oxygen Not Included
- **Version:** v0.99
- **Source:** https://github.com/ShadowKitty42/ONI-Archipelago
- **Download:** https://github.com/ShadowKitty42/ONI-Archipelago/releases/download/v0.99/oni.apworld

## Test Results

| Metric | Value |
|--------|-------|
| Total Runs | 10 |
| Success | 60-70% |
| Failures | 30-40% |
| Timeouts | 0 |
| Error Type | Duplicate location name |

## Conclusion

This is a **data bug in the apworld** that creates duplicate location names when combining Bionic DLC content with base-game-only clusters. The fix requires updating the apworld's item data or adding filtering logic in the world class.

**Recommendation:** Report this issue to the apworld maintainer with the detailed analysis above.
