# UT Pickle Mode

A modified version of [Universal Tracker](https://github.com/FarisTheAncient/Archipelago/tree/tracker) that uses pickle-based multiworld export for improved tracking accuracy.

## How it works

In standard Universal Tracker, when you connect to a game, UT regenerates the multiworld from your YAML file with a random seed. Because the internal seed doesn't match the actual game's seed, UT's logic calculations can differ from the server's — leading to locations being incorrectly shown as in-logic or out-of-logic.

UT Pickle Mode fixes this by:

1. **During seed generation**: A monkey patch on `Main.main()` exports the actual multiworld object as a gzip-compressed [dill](https://github.com/uqfoundation/dill) pickle file.
2. **During tracking**: Instead of regenerating from YAML, UT loads the pickled multiworld — preserving the exact regions, items, rules, and randomization from the original generation.

This means UT's logic calculations match the server's exactly.

## Installation

UT Pickle Mode is a replacement for the standard Universal Tracker. Do not install both at the same time.

### Requirements

- `dill>=0.3.8` (listed in `requirements.txt`)

### Configuration

In `host.yaml`, set:

```yaml
ut_pickle:
  enabled: true
  pickle_mode: true
```

The `enabled` setting controls whether the pickle export hook and launcher component are active. It defaults to `false` to avoid interfering with any existing tracker installation.

The `pickle_mode` setting controls whether to use pickle-based tracking (when `true`) or fall back to original YAML-based tracking (when `false`).

## Files

| File | Description |
|------|-------------|
| `TrackerCoreOriginal.py` | Verbatim copy of original UT's `TrackerCore.py` |
| `TrackerCore.py` | Thin wrapper adding pickle support via `PickleMixin` |
| `TrackerClient.py` | Original UT client with 7 lines added for pickle discovery |
| `pickle_exporter.py` | Exports/loads multiworld as gzip-compressed dill pickle |
| `pickle_mixin.py` | Mixin for pickle loading and auto-discovery |
| `monkey_patches/hooks.py` | Wraps `Main.main()` to export pickle after generation |
| `fuzzer_hook.py` | Fuzz test hook for validating pickle tracking accuracy |

All other files (`Tracker.kv`, `TrackerKivy.py`, `icon.png`) are unchanged from the original UT.

## Testing

### Fuzz test

The fuzz test validates that pickle-based tracking matches the server's ground truth spheres across random option combinations.

```bash
python fuzz.py -g factorio -r 10 -j 1 \
    --hook worlds.ut_pickle.fuzzer_hook:Hook \
    --skip-output
```

Where `fuzz.py` is the fuzzer from `scripts/test/fixtures/fuzzer_original/`.

### Basic test

See the [test script documentation](../../docs/json/developer/diffs/ut_pickle/test-script.md) for a standalone test that validates the export/load/tracking cycle.

## Fuzz test results

From the project's fuzz test data, pickle mode significantly improves tracking accuracy:

| Mode | Pass rate (official games) |
|------|--------------------------|
| Original UT | 37/88 (42%) |
| UT Pickle Mode | 74/88 (84%) |

Games like Factorio, A Link to the Past, and Hollow Knight go from 0% pass rate to 100% with pickle mode.
