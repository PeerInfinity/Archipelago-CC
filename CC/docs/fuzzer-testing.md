# UT Fuzzer Testing

The UT (Universal Tracker) fuzzer tests whether the worldgen-based tracking produces the same results as the original Archipelago generation. It generates random seeds and compares what locations are accessible.

## Prerequisites

```bash
source .venv/bin/activate
```

## Basic Usage

Run the fuzzer with a specific game:

```bash
python fuzz.py -r <runs> -j <jobs> -g <game> -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

**Important:** On Linux, use `exec` to avoid module caching issues (see [Troubleshooting](#module-caching-with-code-changes)):

```bash
exec python fuzz.py -r <runs> -j <jobs> -g <game> -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `-r <runs>` | Number of test runs |
| `-j <jobs>` | Number of parallel jobs |
| `-g <game>` | Game name (e.g., `adventure`, `alttp`) |
| `-n <yamls>` | Number of YAML configs per run (use `1` for single-game tests) |
| `--hook` | Hook module for UT validation (always use `worlds.tracker.fuzzer_hook:Hook`) |

## Examples

### Single Test Run

```bash
python fuzz.py -r 1 -j 1 -g adventure -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

### Parallel Testing (Recommended)

```bash
python fuzz.py -r 50 -j 8 -g adventure -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

### ALttP Testing

```bash
# Use exec to ensure fresh module imports (avoids caching issues)
exec python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

**Expected pass rate:** ~60-70% due to entrance shuffle and glitch mode limitations (see [Known Limitations](#alttp)).

### Testing with Specific Options

Use `--default-options` to keep options at default, and `--disallow-options` to exclude specific values:

```bash
# Test with entrance_shuffle at default (test glitches only)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --default-options entrance_shuffle

# Test with glitches_required at default (test entrance shuffle only)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --default-options glitches_required

# Test only minor_glitches (exclude other glitch values)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --default-options entrance_shuffle \
    --disallow-options "glitches_required=no_glitches,overworld_glitches,hybrid_major_glitches,no_logic"

# Test only supported entrance_shuffle values (exclude problematic ones)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --default-options glitches_required \
    --disallow-options "entrance_shuffle=crossed,dungeons_crossed,insanity"

# Maximum compatibility mode (avoid all known problematic options)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --disallow-options "entrance_shuffle=crossed,dungeons_crossed,insanity;glitches_required=hybrid_major_glitches"
```

## Output

Results are written to `fuzz_output/`:

- `report.json` - Summary of test results
- `error/<game>/<run>/` - Details for failed runs
  - `<run>.log` - Full log output
  - `<run>.yaml` - YAML configuration that caused the failure

### Report Format

```json
{
  "stats": {
    "total": 10,
    "success": 8,
    "failure": 2,
    "timeout": 0,
    "ignored": 0
  },
  "errors": {
    "adventure": {
      "None": [1, 4]
    }
  }
}
```

Error types:
- `None` - Logic mismatch (no Python error, but UT and server disagree on accessible locations)
- Other - Python exception type

## Interpreting Results

### Success
The worldgen-based UT tracking matches the original Archipelago generation.

### Failure (None type)
Logic mismatch - locations accessible in one but not the other. Check the log file for details:
- "Locations X were in server logic but not expected in UT"
- "UT logic sphere" shows what UT found accessible

### Failure (Exception type)
Python error during generation or tracking. Check the log file for the traceback.

## Cleanup

The fuzzer creates temporary files that should be cleaned up:

```bash
# Remove fuzzer output
rm -rf fuzz_output

# Remove generated worldgen worlds (created per-seed for parallel safety)
rm -rf worlds/*_worldgen_*

# Remove generated preset files
rm -rf frontend/presets/*/AP_*
```

## How It Works

1. **Generation**: Creates a random Archipelago seed for the specified game
2. **Export**: Exports the seed's rules to JSON format
3. **Worldgen**: Generates a new world package from the JSON rules
4. **Tracking**: Initializes UT with the worldgen world
5. **Comparison**: Compares what locations UT considers accessible vs what the server considers accessible
6. **Validation**: Reports any mismatches

## Known Limitations

### ALttP

**Entrance Shuffle Compatibility:**

| Mode | Pass Rate | Notes |
|------|-----------|-------|
| `vanilla` | 100% | Default, fully supported |
| `dungeons_simple` | ~50-90% | Affected by er_seed regeneration - key rules differ |
| `dungeons_full` | ~50-90% | Affected by er_seed regeneration - key rules differ |
| `simple` | ~70-90% | Affected by er_seed regeneration when combined with glitches |
| `restricted` | ~70-90% | Affected by er_seed regeneration - Turtle Rock key rules differ |
| `full` | ~50-70% | Affected by er_seed regeneration when combined with inverted/glitches |
| `dungeons_crossed` | ~40-60% | Cross-world dungeon entrance tracking + er_seed issues |
| `crossed` | ~40-60% | Cross-world entrance tracking + er_seed issues |
| `insanity` | ~20% | Severe entrance tracking issues |

**Note:** Pass rates vary based on combinations with `mode` and `glitches_required`. The underlying cause is that the ALttP world's `er_seed` is not included in slot_data, causing TrackerCore to regenerate with different entrance connections. See "Root Cause - Entrance Shuffle Regeneration" below.

**Mode Interactions:**

| Combination | Pass Rate | Notes |
|-------------|-----------|-------|
| `entrance_shuffle` + `mode=inverted` | ~90% | Inverted mode may affect dungeon entrance rules |
| `entrance_shuffle` + `glitches_required` | Varies | Combined failures stack - test separately first |

**Glitches Required Compatibility:**

| Mode | Pass Rate | Notes |
|------|-----------|-------|
| `no_glitches` | 100% | Default, fully supported |
| `minor_glitches` | ~90% | Fully supported (uses CanReachRegion) |
| `overworld_glitches` | ~75% | Mostly supported |
| `hybrid_major_glitches` | ~70% | Dict lambda lookup + bunny revival fixes |
| `no_logic` | ~70% | Mostly supported |

**Why hybrid_major_glitches still has ~30% failures:**

Cross-dungeon clips (`mire_clip`, `hera_clip`) now export with `CanReachRegion` checks:
```python
# mire_clip exports as:
CanReachRegion('Misery Mire (West)') AND Pegasus Boots AND (Fire Rod OR Lamp)
```

The `rule_map.get(key, default)(state)` pattern is now supported via `dict_lambda_lookup`:
- Each lambda in the dict is analyzed recursively
- Results are OR'd together since we don't know which key matches at export time
- This permissive approach allows any matching rule path

Bunny revival rules are now correctly exported using dynamic imports from ALttP:
- Swamp Palace: Moon Pearl only (0hp revival not in logic)
- Tower of Hera: (Magic Mirror AND sword) OR Moon Pearl
- Other invalid dungeons (Turtle Rock, Sanctuary): Magic Mirror OR Moon Pearl

However, some failures remain due to:
- Dynamic entrance shuffle affecting which regions connect
- Complex nested closures beyond the `rule_map` pattern
- Server using specific glitch paths that UT doesn't know about

Previously, hybrid_major_glitches used `add_rule(..., combine='or')` which was difficult to export.
The new approach analyzes the combined rules and exports both paths, improving compatibility
from ~10% to ~45%, then to ~70% with the bunny revival fixes.

**Glitch rule handling:**
- `dict_lambda_lookup`: Dicts with lambda values are analyzed and OR'd together
- `CanReachRegion`: Direct glitch rules (mire_clip, hera_clip) use region reachability
- Combined or-rules now export both the original and glitch alternative paths
- Fallback rules are used for dungeon entrance patterns when analysis fails

**Root Cause - Entrance Shuffle Regeneration:**

The fundamental issue with entrance shuffle failures is that the ALttP world's `er_seed` (entrance random seed) is not included in slot_data. When TrackerCore regenerates the world:

1. It uses the same `entrance_shuffle` option (e.g., "restricted")
2. But generates a DIFFERENT random `er_seed`
3. This causes different entrance connections
4. Which causes `set_trock_key_rules` to evaluate `can_reach_back` differently
5. Leading to different key requirements for Turtle Rock (and other dungeons)

For example, with `entrance_shuffle=restricted` and `glitches_required=overworld_glitches`:
- Original world: Glitch paths might make `can_reach_back = True` → Turtle Rock Chain Chomp Room (South) requires 5 keys
- Regenerated world: Different entrance shuffle → `can_reach_back = False` → Requires 3 keys if Big Key is in front
- Result: Locations accessible in one world but not the other

**Fixes Applied:**

1. **Numeric entrance_shuffle_seed generation** (`fuzz.py`): The fuzzer's `get_random_value()` always generates a numeric string for `entrance_shuffle_seed` instead of random Unicode garbage or "random". This ensures consistent entrance connections between original and regenerated worlds.

2. **er_seed pre-generation safety net** (`fuzzer_hook.py`): As a backup, the fuzzer hook validates that `entrance_shuffle_seed` is numeric before generation runs. If it finds "random" or invalid values, it pre-generates a numeric seed. This catches edge cases like manually-created YAMLs.

3. **Turtle Rock key rule location fix** (`exporter/games/official/alttp.py`): The exporter now computes TR reachability (`can_reach_back`, `front_locked_locations`) at export time and fixes empty `locations` arrays in conditional key rules. When `set_trock_key_rules` creates rules with `front_locked_locations.union({...})`, the `.union()` call wasn't being evaluated during AST analysis - this fix properly populates the locations.

4. **Shop price rule generation** (`exporter/games/official/alttp.py`): When `randomize_cost_types` is enabled, shop locations can require Hearts, Bombs, or Arrows instead of Rupees. The exporter's `post_process_location_data` method generates appropriate access rules:
   - Hearts (type 1): `has_hearts` helper with count = (price // 8) + 1
   - Bombs (type 3): `can_use_bombs` helper with count = price
   - Arrows (type 4): `can_hold_arrows` helper with count = price
   - Rupees/Magic (types 0, 2): No rule needed (always accessible)

**Remaining Issues:**

Some entrance shuffle failures still occur due to:
- Complex region accessibility differences between original and worldgen worlds
- Inverted mode interactions with entrance shuffle
- Glitch mode rules that depend on specific entrance configurations

**Workaround:**

Use `--default-options entrance_shuffle` to test with vanilla entrance shuffle, which has deterministic connections:

```bash
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --default-options entrance_shuffle
```

**Future Fix:**

Add `er_seed` to ALttP's `fill_slot_data` and handle it in `generate_early` via `re_gen_passthrough`. This would require a contribution to upstream Archipelago.

**Other Notes:**
- Bunny rules are simplified to Moon Pearl requirements
- Key logic rules using `location_item_name` may evaluate differently

### Adventure
- ~100% pass rate with current implementation

## Troubleshooting

### "Skip output" causes failures
Don't use `--skip-output` - the hook needs the archive file to load the seed.

### Race conditions with parallel jobs
Fixed in commit `8c22fb8a8` - worldgen directories are now seed-specific.

### Lambda strings in rules
Fixed by game-specific handlers (e.g., ALttP handler converts bunny rule lambdas).

### Module caching with code changes

On Linux, the fuzzer uses `fork` for multiprocessing, which means worker processes inherit cached module imports from the parent process. If you modify exporter code (like game handlers in `exporter/games/`), the changes may not take effect immediately.

**Symptoms:**
- Debug print statements don't appear in output
- Code changes don't seem to have any effect
- Tests pass/fail inconsistently

**Solutions:**

1. **Start a fresh Python process** - Use `exec` to replace the current process:
   ```bash
   exec python fuzz.py -r 1 -j 1 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook
   ```

2. **Clear Python cache files**:
   ```bash
   find . -name "*.pyc" -delete
   find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
   ```

3. **Run from a new terminal** - Close your current terminal and open a fresh one.

**Why this happens:**
The fuzzer imports modules before creating the multiprocessing Pool. When `fork` is used (default on Linux), child processes inherit the parent's memory including already-imported modules. Even with `-j 1`, the Pool still creates a worker process via fork.
