# UT Pickle Mode

A minimal modification to [Universal Tracker](https://github.com/FarisTheAncient/Archipelago/tree/tracker) that adds pickle-based multiworld export for improved tracking accuracy.

After a multiworld is generated, the entire multiworld data is exported to a gzip-compressed pickle file. Universal Tracker can then load this pickle instead of regenerating from YAML, so its logic calculations match the server's exactly.

## Fuzz Test Results

According to the UT fuzzer tests on official Archipelago games:

| Mode | Pass Rate |
|------|-----------|
| Original UT | 33/81 |
| UT Pickle Mode | 69/81 |

Full results: [Fuzz Summary (official games)](../../test-results/test-results-fuzz-summary.md) | [Fuzz Summary (apworlds)](../../test-results/test-results-fuzz-summary-apworlds.md)

## Files

### APWorld

- [ut_pickle.apworld](../../../../../apworlds/ut_pickle.apworld) — packaged APWorld for installation

### Source Code

All source files are in [`worlds/ut_pickle/`](../../../../../worlds/ut_pickle/):

| File | Description |
|------|-------------|
| [`__init__.py`](../../../../../worlds/ut_pickle/__init__.py) | World registration, settings, launcher component |
| [`TrackerCore.py`](../../../../../worlds/ut_pickle/TrackerCore.py) | Thin wrapper extending original TrackerCore with pickle support |
| [`TrackerCoreOriginal.py`](../../../../../worlds/ut_pickle/TrackerCoreOriginal.py) | Verbatim copy of original UT TrackerCore (v0.2.27) |
| [`TrackerClient.py`](../../../../../worlds/ut_pickle/TrackerClient.py) | Original UT client with 7 lines added for pickle discovery |
| [`pickle_exporter.py`](../../../../../worlds/ut_pickle/pickle_exporter.py) | Exports/loads multiworld as gzip-compressed dill pickle |
| [`pickle_mixin.py`](../../../../../worlds/ut_pickle/pickle_mixin.py) | Mixin for pickle loading and auto-discovery |
| [`monkey_patches/hooks.py`](../../../../../worlds/ut_pickle/monkey_patches/hooks.py) | Wraps Main.main to export pickle after generation |
| [`fuzzer_hook.py`](../../../../../worlds/ut_pickle/fuzzer_hook.py) | Fuzz test hook for validating pickle tracking accuracy |

Unchanged from original UT: `Tracker.kv`, `TrackerKivy.py`, `icon.png`, `archipelago.json`

### Documentation

| Document | Description |
|----------|-------------|
| [ut_pickle.md](../../../../../worlds/ut_pickle/docs/ut_pickle.md) | General documentation for UT Pickle Mode |
| [diff-explanation.md](diff-explanation.md) | Line-by-line explanation of every change from the original UT |

### Diffs

| File | Description |
|------|-------------|
| [ut_pickle.diff](ut_pickle.diff) | Full unified diff (modified + new files) |
| [ut_pickle_modified_only.diff](ut_pickle_modified_only.diff) | Diff of only the modified files (no new files) |

### Test Script

| File | Description |
|------|-------------|
| [test_pickle_tracker.py](test_pickle_tracker.py) | Standalone test validating export/load/tracking cycle |
| [test-script.md](test-script.md) | Test script documentation and usage |

### Original UT Fixtures

| Directory | Description |
|-----------|-------------|
| [`scripts/test/fixtures/tracker_original/`](../../../../../scripts/test/fixtures/tracker_original/) | Current baseline (v0.2.27) |
| [`scripts/test/fixtures/tracker_original_v0.2.26/`](../../../../../scripts/test/fixtures/tracker_original_v0.2.26/) | Previous version |
| [`scripts/test/fixtures/tracker_original_v0.2.27/`](../../../../../scripts/test/fixtures/tracker_original_v0.2.27/) | Explicit v0.2.27 snapshot |
| [`scripts/test/fixtures/fuzzer_original/`](../../../../../scripts/test/fixtures/fuzzer_original/) | Original fuzzer used for testing |
