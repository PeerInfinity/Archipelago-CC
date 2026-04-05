# UT Pickle Mode Test Script

## Overview

`test_pickle_tracker.py` is a standalone test that validates the full pickle export/load/tracking cycle without needing an Archipelago server.

## What it tests

| Test | Description |
|------|-------------|
| **Test 0: Monkey patch** | Verifies the `Main.main` wrapper was installed by the pickle export hook |
| **Test 1: Pickle export** | Generates a ChecksFinder seed and verifies a `.pkl.gz` file and metadata JSON were created in `output/` |
| **Test 2: Pickle load** | Loads the pickle and verifies the multiworld has the expected structure (regions, locations, items) |
| **Test 3: Tracking init** | Initializes tracking from the pickle via `PickleMixin` and verifies precollected items are cleared correctly |
| **Test 4: Logic check** | Collects all progression items, sweeps for events, and verifies 100% location reachability |
| **Test 5: Auto-discovery** | Verifies `auto_discover_pickle()` finds the pickle file by game name and seed name |

## Usage

### Setup

The test requires a vanilla Archipelago installation with `worlds/ut_pickle/` installed and `dill` in the Python environment.

```bash
cd ~/CC/Archipelago-vanilla
source .venv/bin/activate
pip install dill>=0.3.8
```

Copy `worlds/ut_pickle/` into the Archipelago installation's `worlds/` directory.

### Running

```bash
python scripts/test_pickle_tracker.py
```

The `ut_pickle.enabled` setting does NOT need to be `true` for this test — it bypasses the settings check and tests the pickle export/load machinery directly.

### Expected output

```
Pickle Tracker Test Suite
============================================================

TEST 0: Monkey patch verification
  Main.main is wrapped: True
  PASSED!

TEST 1: Pickle export during seed generation
  Seed name: 14089154938208861744
  Game: ChecksFinder
  Pickle file created: .../output/AP_14089154938208861744.pkl.gz (9,750 bytes)
  PASSED!

...

ALL TESTS PASSED!
```

## Fuzz testing

For more comprehensive testing with random option combinations, use the fuzzer:

```bash
python fuzz.py -g factorio -r 10 -j 1 \
    --hook worlds.ut_pickle.fuzzer_hook:Hook \
    --skip-output
```

To compare against original UT (which fails for Factorio):

```bash
# Disable pickle mode in host.yaml:
#   ut_pickle:
#     pickle_mode: false
python fuzz.py -g factorio -r 10 -j 1 \
    --hook worlds.ut_pickle.fuzzer_hook:Hook \
    --skip-output
# Expected: 10/10 failures
```
