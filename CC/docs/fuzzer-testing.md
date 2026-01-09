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
- Bunny rules are simplified to Moon Pearl requirements
- Shop price rules may evaluate differently
- ~90% failure rate due to complex dynamic systems

### Adventure
- ~100% pass rate with current implementation

## Troubleshooting

### "Skip output" causes failures
Don't use `--skip-output` - the hook needs the archive file to load the seed.

### Race conditions with parallel jobs
Fixed in commit `8c22fb8a8` - worldgen directories are now seed-specific.

### Lambda strings in rules
Fixed by game-specific handlers (e.g., ALttP handler converts bunny rule lambdas).
