# Sentinels of the Multiverse - UT Fuzzer Investigation

## Summary

**APWorld**: Sentinels of the Multiverse (sotm)
**Version**: v0.4.5
**Source**: https://github.com/Totox00/Archipelago-sotm
**Investigation Date**: 2026-01-23

## Test Results

| Metric | Value |
|--------|-------|
| Total Runs | 10 |
| Success | 0 (0%) |
| FillError | 7-8 |
| TimeoutError | 2-3 |
| UT Logic Mismatches | 0 |

## Root Cause Analysis

### Finding: Not a UT Compatibility Issue

**All failures are FillError or TimeoutError** - there are **no UT tracking mismatches** (None-type errors). The failures occur during seed generation, before UT tracking even runs.

### Actual Issue: Invalid Option Combinations

The Sentinels of the Multiverse apworld allows option combinations that create more items than available locations. The fuzzer randomly generates options that frequently hit these invalid configurations.

The apworld itself warns about this during generation:
```
[player] has more items than locations. If generation fails, you may need to increase location_density
```

### Problematic Options

| Option | Range | Problem |
|--------|-------|---------|
| `required_scions` | 0-65535 | When high, creates thousands of required scion items |
| `scions_are_relative` | true/false | When false, `required_scions` is an absolute item count |
| `location_density.hero` | 0-64 | When 0, no hero locations exist |
| `required_variants` | 0-N | High values require many variant unlock items |
| `required_villains` | 0-N | High values combined with low villain_points creates problems |

### Example Failing Configuration

From `fuzz_output/error/sotm/0/0-0.yaml`:
```yaml
required_scions: 18254
scions_are_relative: 'true'  # 1825.4% of filler becomes scions
location_density:
  hero: 0  # No hero locations
required_variants: 111
required_villains: 2933
```

Error:
```
FillError: Not enough locations for progression items.
There are 655 more progression items than there are available locations.
```

## Technical Details

### How the Item/Location Count Works

1. **Items generated**:
   - Villain items (based on pool_size)
   - Environment items (based on pool_size)
   - Hero items (based on pool_size)
   - Variant items (based on pool_size)
   - Scion items (based on required_scions)
   - Filler items

2. **Locations generated**:
   - Villain locations: count × location_density per difficulty
   - Environment locations: count × location_density.environment
   - Hero locations: count × location_density.hero
   - Variant unlock locations: count × location_density.variant_unlock

3. **The math fails when**:
   - `required_scions` is high (thousands of scion items)
   - `location_density.hero` is 0 (no hero locations)
   - Multiple high-requirement options combine

### Why Fuzzer Fails

The fuzzer (`fuzz.py`) randomizes ALL option values within their valid ranges. For sotm:
- `required_scions` can be randomized to 13000+
- `scions_are_relative` can be randomized to false
- This creates 13000+ required scion items with limited locations

## Conclusions

### This is NOT a UT Tracking Issue

The apworld's core logic appears fine for UT tracking purposes. The failures are purely due to:
1. Invalid option combinations creating impossible games
2. The fuzzer stress-testing all option ranges uniformly

### Recommendation: APWorld Needs Option Validation

The apworld maintainer should:
1. Add option validation to prevent impossible configurations
2. Or dynamically adjust scions/items based on available locations
3. Or cap `required_scions` to a reasonable value based on location count

### Impact on UT Support

| Assessment | Status |
|------------|--------|
| UT Tracking Logic | Unknown (can't test without valid generation) |
| Exporter Support | None exists - needs `exporter/games/unofficial/sotm.py` |
| Fuzzer Compatibility | Poor - needs option constraints |

### Next Steps

1. **For UT support**: Need to create a sotm exporter before UT can work
2. **For fuzzer**: Add sotm to a known-problematic list, or create custom fuzzer constraints
3. **For apworld**: Consider reporting to maintainer about option validation

## Files Examined

- `custom_worlds/sotm.apworld` - The apworld package
- `/tmp/sotm_extracted/sotm/__init__.py` - Main world implementation
- `/tmp/sotm_extracted/sotm/Options.py` - Option definitions
- `fuzz_output/error/sotm/*/` - Failed generation logs

## Commands Used

```bash
# Download apworld
curl -L -o custom_worlds/sotm.apworld "https://github.com/Totox00/Archipelago-sotm/releases/download/v0.4.5/sotm.apworld"

# Test basic generation (succeeds with default options)
python Generate.py --weights_file_path "Templates/Sentinels of the Multiverse.yaml" --multi 1 --seed 1

# Run fuzzer (fails with random options)
python fuzz.py -r 10 -j 4 -g sotm -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```
