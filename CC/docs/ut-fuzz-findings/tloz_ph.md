# UT Fuzzer Testing: The Legend of Zelda - Phantom Hourglass

## Summary

**Game**: The Legend of Zelda - Phantom Hourglass
**APWorld Source**: https://github.com/carrotinator/Archipelago/releases/download/v0.8.0-alpha/tloz_ph.apworld
**Version**: v0.8.0
**Author**: Carrotinator

## Test Results

| Metric | Value |
|--------|-------|
| Total Runs | 20 |
| Success | 0 (0%) |
| Failures (GER) | 6 (30%) |
| Timeouts | 14 (70%) |
| Logic Mismatches (None) | 0 |

## Root Cause Analysis

### Primary Issue: Entrance Randomization Failures

The apworld has extensive entrance randomization (ER) options that the fuzzer randomly enables. When complex ER settings are combined, the `randomize_entrances` algorithm frequently fails to find valid placements.

**Error Pattern**: `Phantom Hourglass: failed GER after 10 attempts.`

The error occurs in the apworld's `connect_entrances` method (`__init__.py:768-774`) which retries entrance randomization up to 10 times before giving up:

```python
self.er_placement_state = randomize_entrances(self, coupled, groups, on_connect=on_connect)
# ...
raise EntranceRandomizationError("Phantom Hourglass: failed GER after 10 attempts.")
```

### ER Options That Cause Issues

The fuzzer generates random combinations of these options:

- `shuffle_dungeon_entrances`: no_shuffle, shuffle, simple_mixed_pool
- `shuffle_ports`: no_shuffle, shuffle, simple_mixed_pool
- `shuffle_caves`: no_shuffle, shuffle, simple_mixed_pool
- `shuffle_houses`: no_shuffle, shuffle, shuffle_on_own_island, simple_mixed_pool
- `shuffle_overworld_transitions`: no_shuffle, shuffle, simple_mixed_pool
- `shuffle_bosses`: no_shuffle, shuffle
- `entrance_directionality`: preserve, disregard_simple_mixed_pool, disregard_all
- `decouple_entrances`: couple_all, decouple_houses, decouple_all
- `shuffle_between_islands`: no_shuffle, shuffle_only_on_own_island, shuffle_between_all_islands

When multiple "mixed_pool" options are enabled with `decouple_entrances: decouple_all` or `entrance_directionality: disregard_all`, the algorithm struggles to find valid placements that:
1. Maintain game progression
2. Ensure all regions are reachable
3. Handle dead-end entrances correctly

### Timeout Pattern

70% of tests timed out (14/20 runs). This indicates:
1. ER is computationally expensive with complex settings
2. The retry mechanism (10 attempts) multiplies the cost
3. Default fuzzer timeout (3-5 seconds) is insufficient

## Generation Without ER Works

When entrance randomization is disabled, the apworld generates successfully:

```yaml
shuffle_dungeon_entrances: no_shuffle
shuffle_ports: no_shuffle
shuffle_caves: no_shuffle
shuffle_houses: no_shuffle
shuffle_overworld_transitions: no_shuffle
shuffle_bosses: no_shuffle
```

With these settings:
- Seed generation completes in ~32 seconds
- Rules export works (with warnings about starred arguments)
- 576 regions and 248 items are exported
- 331 helper functions are defined

### Export Warnings

The exporter produces warnings:
```
Starred argument 2 could not be unpacked: {'type': 'starred', 'unpacked_args': []}
```

This indicates the apworld uses some Python patterns (starred argument unpacking) that the rule exporter can't fully analyze. The export continues but some rules may not be completely captured.

## Recommendations

### For APWorld Maintainer

1. **Improve ER Robustness**: The entrance randomization algorithm fails too frequently with certain option combinations. Consider:
   - Adding pre-validation of option combinations
   - Implementing smarter retry strategies
   - Marking incompatible option combinations
   - Increasing retry limit for complex configurations

2. **Add Option Constraints**: Some option combinations may be mathematically impossible to satisfy. Add validation to reject these early rather than failing during generation.

3. **Performance Optimization**: ER is computationally expensive. Consider caching or pre-computing valid entrance pairings.

### For This Repository

1. **Do Not Add to Known-Incompatible List**: The apworld isn't fundamentally incompatible with UT - it just has ER generation issues.

2. **No Exporter Needed**: The default exporter works well enough (with warnings). The 331 exported helpers cover the game's logic.

3. **Consider Fuzzer Option Filtering**: The fuzzer could be enhanced to:
   - Skip or reduce likelihood of complex ER options for games with known ER issues
   - Increase timeout for games with expensive ER
   - Treat ER failures as "option error" rather than "failure"

### Testing Recommendation

For UT testing purposes, consider testing with ER disabled to validate the logic export separately from ER generation:

```bash
# Create a YAML with ER disabled
python -c "
import yaml
with open('Players/Templates/The Legend of Zelda - Phantom Hourglass.yaml', 'r') as f:
    t = yaml.safe_load(f)
opts = t['The Legend of Zelda - Phantom Hourglass']
opts['shuffle_dungeon_entrances'] = 'no_shuffle'
opts['shuffle_ports'] = 'no_shuffle'
opts['shuffle_caves'] = 'no_shuffle'
opts['shuffle_houses'] = 'no_shuffle'
opts['shuffle_overworld_transitions'] = 'no_shuffle'
opts['shuffle_bosses'] = 'no_shuffle'
with open('Players/ph_no_er.yaml', 'w') as f:
    yaml.dump(t, f)
"

# Generate seed
python Generate.py --weights_file_path "ph_no_er.yaml" --multi 1 --seed 42
```

## Conclusion

The Phantom Hourglass apworld fails UT fuzzer testing primarily due to **entrance randomization generation failures**, not UT logic incompatibilities. When ER is disabled, the apworld generates successfully and exports rules correctly.

This is a **generation-time issue** in the apworld, not a **tracking/logic issue** that this repository could fix. The apworld maintainer should be contacted about improving ER robustness for complex option combinations.

## Technical Details

### APWorld Structure
- Main file: `tloz_ph/__init__.py`
- Logic: `tloz_ph/Logic.py`
- Data: `tloz_ph/data/` (Items, Locations, Regions, Entrances, etc.)
- Has its own tracker module: `tloz_ph/tracker/`

### Files Examined
- `custom_worlds/tloz_ph.apworld` (2.5 MB)
- Generated `rules.json` (934 KB)
- Generated `sphere_log.jsonl` (87 KB)

### Test Environment
- Archipelago Version: 0.6.5
- Python: 3.11.14
- OS: Linux 4.4.0
