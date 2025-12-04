# Universal Tracker Comparison Test Process

This document explains the automated testing system that validates Universal Tracker's accessibility calculations match the Python-generated sphere logs.

## Overview

The **UT Comparison Test** ensures that Universal Tracker correctly tracks what locations, regions, and items are accessible at each step of a game's playthrough. This is critical for verifying that UT's regenerated game state matches the authoritative Python implementation.

## Architecture

The testing system consists of several layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                          │
│                     (.github/workflows/test-ut.yml)                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │ Batch Test Runner      │
                    │ (test-all-ut-comparison.py)
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │ Single Test Orchestrator│
                    │ (test-ut-comparison.py) │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼───────┐     ┌─────────▼─────────┐    ┌───────▼───────┐
│ Archipelago   │     │ Universal Tracker │    │ TestDriver    │
│ Server        │     │ (TrackerClient)   │    │ Client        │
└───────────────┘     └───────────────────┘    └───────────────┘
                                │                       │
                    ┌───────────▼───────────────────────▼───────────┐
                    │         Sphere Log Comparison                  │
                    │         (compare-sphere-logs.cjs)              │
                    └───────────────────────────────────────────────┘
```

## Key Components

### 1. GitHub Actions Workflow

**Location:** `.github/workflows/test-ut.yml`

The workflow is triggered manually via `workflow_dispatch` with configurable inputs:

| Input | Description | Default |
|-------|-------------|---------|
| `runs_per_template` | Number of test runs per game template | 3 |
| `delete_existing_results` | Clear previous results before testing | true |
| `run_random_seed_test` | Test with random seeds | true |
| `run_fixed_seed_test` | Test with fixed seed (1) for reproducibility | true |
| `debug_mode` | Only test Adventure.yaml for quick testing | false |

**Jobs:**

1. **setup-branch** - Creates/syncs the `ut-test` branch from `main`
2. **test-ut-comparison-random** - Runs tests with random seeds (10 parallel workers)
3. **combine-ut-comparison-random** - Merges random seed results
4. **test-ut-comparison-fixed** - Runs tests with fixed seed=1 (10 parallel workers)
5. **combine-ut-comparison-fixed** - Merges fixed seed results, commits to `ut-test` branch

The workflow uses a matrix strategy to split templates across 10 parallel workers, significantly reducing total test time.

### 2. Batch Test Runner

**Location:** `scripts/test/test-all-ut-comparison.py`

Iterates through all YAML template files and runs the comparison test for each:

```bash
# Test all templates
python scripts/test/test-all-ut-comparison.py

# Test specific templates
python scripts/test/test-all-ut-comparison.py --include-list Adventure.yaml "A Link to the Past.yaml"

# Skip certain templates
python scripts/test/test-all-ut-comparison.py --skip-list "Problematic Game.yaml"

# Parallel splitting (used by CI)
python scripts/test/test-all-ut-comparison.py --every-nth 10 --skip-first 0
```

**Key Features:**
- Loads templates from `Players/Templates/`
- Excludes games listed in `scripts/data/template-exclude-list.json`
- Supports parallel splitting with `--every-nth` and `--skip-first` flags
- Runs multiple iterations per template for consistency checking
- Checks for `re_gen_passthrough` support in each world

**Output:** `scripts/output/ut-comparison/test-results-{random|fixed}-seed.json`

### 3. Single Test Orchestrator

**Location:** `scripts/test/test-ut-comparison.py`

Orchestrates a single game's test through these steps:

#### Step 0: Game Generation
- Uses `Generate.py` to create game from YAML template
- Produces `.archipelago` file and `sphere_log.jsonl`

#### Step 1: Server Startup
- Starts `MultiServer.py` with the generated game
- Waits for server to accept connections on configured port

#### Step 2: Universal Tracker Startup
- Starts TrackerClient in `--sphere-log-mode`
- Outputs UT's sphere log to `*_sphere_log_ut.jsonl`

#### Step 3: Test Driver
- Runs `TestDriverClient.py` to drive the test
- Checks locations in sphere order
- Uses bounce protocol to synchronize with UT

#### Step 4: Comparison
- Runs Node.js comparison script
- Compares Python sphere log vs UT sphere log
- Outputs detailed comparison results

**Usage:**
```bash
# Simplest usage - just provide the YAML file:
python scripts/test/test-ut-comparison.py --yaml-file Players/Templates/Adventure.yaml

# With existing game files:
python scripts/test/test-ut-comparison.py \
    --game-file frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744.archipelago \
    --python-sphere-log frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl \
    --game "Adventure"
```

### 4. Test Driver Client

**Location:** `scripts/test/TestDriverClient.py`

A specialized Archipelago client that drives the test:

1. Reads the Python-generated sphere log
2. Connects to the server as the player
3. For each sphere:
   - Sends location checks for that sphere
   - Sends `STEP` bounce message to Universal Tracker
   - Waits for `READY` bounce response from UT
4. Sends `COMPLETE` when finished

**Bounce Protocol:**
```json
// TestDriver -> UT
{"type": "UT_TEST_SYNC", "action": "STEP", "sphere": "1.2"}

// UT -> TestDriver
{"type": "UT_TEST_SYNC", "action": "READY", "sphere": "1.2"}

// TestDriver -> UT (end of test)
{"type": "UT_TEST_SYNC", "action": "COMPLETE"}
```

The bounce protocol ensures UT has finished processing and logged its state before the comparison moves to the next sphere.

### 5. Sphere Log Comparison

**Location:** `scripts/test/compare-sphere-logs.cjs`

Node.js CLI that compares two sphere logs:

```bash
node compare-sphere-logs.cjs \
  --python-log path/to/sphere_log.jsonl \
  --ut-log path/to/sphere_log_ut.jsonl \
  --auto-ignore-events \
  --output result.json
```

**Comparison Fields:**
| Field | Description |
|-------|-------------|
| `new_accessible_locations` | Locations that became accessible in this sphere |
| `new_accessible_regions` | Regions that became accessible in this sphere |
| `new_inventory_details` | Items acquired (base_items and resolved_items) |

**Note:** `sphere_locations` is **not** compared because UT cannot determine which locations were collected in each sphere - it only receives items via the Bounce protocol. The sphere playthrough algorithm runs during generation, not during gameplay.

**Comparison Library:** `scripts/test/lib/sphereLogComparison.cjs`

### 6. Result Combiner

**Location:** `scripts/test/combine-test-results.py`

Merges split test results from parallel workers:

```bash
python scripts/test/combine-test-results.py \
    --input-files artifacts/test-results-ut-random-split-*/test-results-random-split-*.json
```

Features:
- Auto-detects UT comparison vs spoiler test structure
- Combines results by template name
- Preserves individual run details

### 7. Documentation Generator

**Location:** `scripts/docs/generate_ut_comparison_chart.py`

Generates Markdown reports from test results:

```bash
python scripts/docs/generate_ut_comparison_chart.py
```

Features:
- Cross-links between random and fixed seed results
- Clickable game names link to JSON frontend test mode
- Shows pass/fail, consistency, sphere counts, mismatches

**Output:** `docs/json/developer/test-results/test-results-ut-comparison-*.md`

## Data Files

### Template Exclude List

**Location:** `scripts/data/template-exclude-list.json`

Games excluded from testing with reasons:
```json
{
  "exclude_list": [
    {"name": "Archipelago.yaml", "reason": "Not a game"},
    {"name": "Universal Tracker.yaml", "reason": "Not a game"},
    {"name": "Hollow Knight.yaml", "reason": "The spoiler test currently freezes"},
    {"name": "Zillion.yaml", "reason": "Uses external zilliandomizer tool"}
  ]
}
```

### World Mapping

**Location:** `scripts/data/world-mapping.json`

Maps game names to world directory names. Used for:
- Creating links in documentation
- Resolving preset directories
- Game configuration

## Host Settings Configuration

**Script:** `scripts/setup/update_host_settings.py`

Configures `host.yaml` for testing:

```bash
# For UT comparison testing (minimal spoilers)
python scripts/setup/update_host_settings.py minimal-spoilers
```

This enables:
```yaml
skip_required_files: true
save_rules_json: true
save_sphere_log: true
update_frontend_presets: true
```

## Test Output Structure

```
scripts/output/ut-comparison/
├── test-results-random-seed.json    # Combined random seed results
├── test-results-fixed-seed.json     # Combined fixed seed results
├── test-results-random-split-N.json # Individual split results (CI)
└── test-results-fixed-split-N.json  # Individual split results (CI)

frontend/presets/{game}/AP_{seed_id}/
├── AP_{seed_id}.archipelago         # Game file
├── AP_{seed_id}_sphere_log.jsonl    # Python sphere log (ground truth)
└── AP_{seed_id}_sphere_log_ut.jsonl # UT sphere log (test output)
```

## Test Result JSON Structure

```json
{
  "metadata": {
    "created": "2025-12-03T...",
    "seed_mode": "random",
    "runs_per_template": 3,
    "total_templates": 95
  },
  "results": {
    "Adventure.yaml": {
      "ut_comparison": {
        "passed": true,
        "total_spheres": 15,
        "last_sphere_index": "6.1",
        "lowest_mismatch_count": 0,
        "highest_mismatch_count": 0,
        "lowest_sphere_before_mismatch": null,
        "highest_sphere_before_mismatch": null,
        "results_consistent": true,
        "num_runs": 3,
        "run_details": [
          {
            "seed": null,
            "passed": true,
            "spheres_matched": 15,
            "spheres_mismatched": 0
          }
        ]
      },
      "world_info": {
        "game_name_from_yaml": "Adventure",
        "has_re_gen_passthrough": false
      },
      "timestamp": "2025-12-03T..."
    }
  }
}
```

## Key Concepts

### re_gen_passthrough

Games implementing `re_gen_passthrough` pass slot data to Universal Tracker for accurate world regeneration. This allows UT to recreate the exact same game state as the original generation.

Without this support, UT may have significant mismatches due to randomization differences when regenerating the world.

Check for support in a world's `__init__.py`:
```python
def re_gen_passthrough(self) -> dict[str, Any]:
    return {
        "custom_data": self.custom_data,
        # ... other slot-specific data
    }
```

### Sphere Index Format

Spheres use a fractional notation like `"1.2"` where:
- First number = major sphere (integer spheres in playthrough)
- Second number = minor sphere (fractional steps within a sphere)

Example: `"3.1"` means the first fractional step in sphere 3.

### Event Filtering

Event locations and items (like "Victory") are automatically detected from sphere log metadata and excluded from comparison. This is because UT handles events differently than the Python generation.

The `--auto-ignore-events` flag extracts event lists from the metadata entry in the sphere log.

## Running Tests Locally

```bash
# 1. Activate virtual environment
source .venv/bin/activate

# 2. Generate templates (if not already done)
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# 3. Configure host settings
python Launcher.py --update_settings
python scripts/setup/update_host_settings.py minimal-spoilers

# 4. Install Node.js dependencies (for comparison script)
npm install

# 5. Run single game test
python scripts/test/test-ut-comparison.py --yaml-file Players/Templates/Adventure.yaml

# 6. Run all games (with 1 run per template for speed)
python scripts/test/test-all-ut-comparison.py --runs-per-template 1

# 7. Generate documentation
python scripts/docs/generate_ut_comparison_chart.py
```

## Interpreting Test Results

### Understanding the Results Table

| Column | Meaning |
|--------|---------|
| **Result** | ✅ if UT matches Python sphere log exactly in ALL runs, ❌ otherwise |
| **Consistent** | ✅ if UT produced the same mismatch count across all test runs, ❌ if results varied between runs |
| **Spheres** | The last sphere index in the game |
| **Mismatches (min/max)** | Range of mismatched sphere counts across runs |
| **Last Good (min/max)** | Range of last matching sphere before first mismatch |
| **re_gen** | ✅ if game implements `re_gen_passthrough`, ⚫ otherwise |

### What "Consistent" Means

The **Consistent** column indicates whether UT produced the same result across multiple test runs. This is **not** measuring whether Archipelago's generation is deterministic (it is). Instead, it measures whether UT's internal world regeneration produces consistent results.

- **Consistent (✅)**: UT behaved the same way each run
- **Inconsistent (❌)**: UT's world regeneration differed between runs, causing varying mismatch counts

Inconsistent results typically indicate that the game has randomization that UT cannot reproduce without `re_gen_passthrough` support.

### When Failures Are Expected vs Bugs

**Games WITH `re_gen_passthrough` support:**
- Any mismatch is a bug and should be reported
- UT receives slot data needed to reproduce the exact game state
- The test validates that UT's logic matches Python's logic

**Games WITHOUT `re_gen_passthrough` support:**
- Mismatches due to randomization differences are **expected behavior**, not bugs
- UT must regenerate the world without access to generation-time random choices
- The multiworld seed is split into per-slot seeds based on player index, which may differ between generation and UT

### Pass Criteria

A test **passes** when:
- All spheres have matching `new_accessible_locations`
- All spheres have matching `new_accessible_regions`
- All spheres have matching `new_inventory_details`

### Fixed Seed vs Random Seed Tests

The test suite runs both fixed seed and random seed tests to help diagnose issues:

| Test Type | Purpose |
|-----------|---------|
| **Fixed Seed** | Uses seed=1 for both generation and UT. Helps isolate logic differences from randomization differences. |
| **Random Seed** | Uses random seeds. Reveals which games have randomization that UT cannot reproduce. |

If a game **passes with fixed seed but fails with random seed**, this indicates randomization issues that could be addressed by implementing `re_gen_passthrough`.

If a game **fails with both**, there's likely a logic difference between UT and Python that should be investigated.

### Common Failure Causes

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Missing locations in UT | UT rule evaluation differs | Check world's rule implementation |
| Extra locations in UT | UT has more permissive rules | Verify rule export accuracy |
| Missing items | Item not being sent via bounce | Check TestDriver item handling |
| Inconsistent results (no re_gen) | Randomization in regeneration | Expected behavior; implement `re_gen_passthrough` to fix |
| Inconsistent results (with re_gen) | Bug in re_gen_passthrough | Check that all relevant slot data is passed |

### Consistency Checking

Running multiple iterations (`--runs-per-template 3`) helps identify:
- **Consistent failures**: Logic differences between UT and Python
- **Inconsistent results**: Randomization issues (expected without `re_gen_passthrough`)

## Utility Libraries

### test_utils.py

**Location:** `scripts/lib/test_utils.py`

Common utilities:
- `extract_game_name_from_template()` - Parse YAML for game name
- `get_world_directory_name_from_game_name()` - Map game to world directory
- `load_template_exclude_list()` - Load exclusion list
- `count_total_spheres()` - Get sphere count from log

### sphereLogComparison.cjs

**Location:** `scripts/test/lib/sphereLogComparison.cjs`

Comparison library:
- `loadSphereLog()` - Parse JSONL sphere logs
- `loadSphereLogWithMetadata()` - Parse with metadata extraction
- `extractEventFiltersFromMetadata()` - Get event ignore lists
- `compareSphereLogs()` - Full comparison
- `findFirstMismatch()` - Locate first difference
- `formatComparisonSummary()` - Human-readable output

## Related Documentation

- **[Test Results (Fixed Seed)](../test-results/test-results-ut-comparison-fixed-seed.md)** - Latest fixed seed test results
- **[Test Results (Random Seed)](../test-results/test-results-ut-comparison-random-seed.md)** - Latest random seed test results
- **[Testing Pipeline](./testing-pipeline.md)** - Frontend JavaScript vs Python testing (different from UT testing)
- **[Test Results Summary](../test-results/test-results-summary.md)** - Overview of all test types

## Relationship to Other UT Testing

Universal Tracker has its own correctness testing via the [Archipelago-fuzzer](https://github.com/Eijebong/Archipelago-fuzzer) project, which uses a fuzzer hook (`worlds/tracker/fuzzer_hook.py`). This is a different testing approach that complements the sphere log comparison test described here.

| Test | Approach | Purpose |
|------|----------|---------|
| **UT Comparison (this test)** | Compares sphere logs | Validates UT accessibility matches Python at each step |
| **UT Fuzzer Hook** | Fuzzes game generation | Tests UT under many random configurations |

## Differences from Frontend Spoiler Testing

| Aspect | UT Comparison Test | Frontend Spoiler Test |
|--------|-------------------|----------------------|
| What's tested | Universal Tracker (Python) | JavaScript StateManager |
| Ground truth | Python sphere log | Python sphere log |
| Runs on | CI (GitHub Actions) | Local or CI |
| Purpose | Validate UT regeneration | Validate JS rule engine |
| Protocol | Server + Bounce messages | Direct state comparison |
