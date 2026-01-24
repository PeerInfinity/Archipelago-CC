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
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

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
| `dungeons_simple` | ~95% | Mostly supported, some inverted mode issues |
| `dungeons_full` | ~95% | Mostly supported, some inverted mode issues |
| `simple` | 100% | Fully supported |
| `restricted` | 100% | Fully supported |
| `full` | ~95% | Mostly supported, some inverted mode issues |
| `dungeons_crossed` | ~60% | Cross-world dungeon entrance tracking issues |
| `crossed` | ~60% | Cross-world entrance tracking issues |
| `insanity` | ~20% | Severe entrance tracking issues |

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
