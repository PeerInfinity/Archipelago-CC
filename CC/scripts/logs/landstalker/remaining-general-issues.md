# Remaining General Issues for Landstalker

## Status: One Minor Debug Issue (Non-blocking)

As of 2025-12-09, all spoiler tests pass for Landstalker - The Treasures of King Nole.

### Debug Memory Leak Assertion

When running in debug mode (`__debug__` is True), there's a memory leak assertion that fails at the end of generation:

```
AssertionError: MultiWorld object was not de-allocated, it's referenced 67 times. This would be a memory leak.
```

**Impact**: None on functionality. Files are generated correctly and tests pass.

**Details**:
- This only occurs in debug mode (assert statements)
- Generation completes successfully in ~0.5 seconds
- All 53 spheres pass the spoiler test
- The issue appears to be related to how closure variables containing Region objects are handled during rule analysis

**Attempted fixes**:
1. Added `clear_analyzer_caches()` to cleanup process - didn't help
2. Modified analyzer to not overwrite prepared closure variables - didn't help (but is a good improvement)

**Possible root causes**:
- Rule functions (lambdas) attached to locations/exits have closures referencing Region objects
- These closures may be retained in some internal Python state even after cache clearing
- The issue may be in Archipelago core, not the JSON exporter

## Test Results

- **Total spheres tested**: 53
- **Passed**: 53
- **Failed**: 0
- **Error count**: 0

## Implementation Summary

### Files

| File | Purpose |
|------|---------|
| `exporter/games/landstalker.py` | Custom exporter for Landstalker rules |
| `frontend/modules/shared/gameLogic/landstalker/landstalkerLogic.js` | Helper functions for rule evaluation |
| `frontend/presets/landstalker/AP_14089154938208861744/AP_14089154938208861744_rules.json` | Generated rules file |
| `frontend/presets/landstalker/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl` | Ground truth sphere log |

### Settings

The exporter sets `use_resolved_items: true` in the settings data to indicate that item requirements have been pre-resolved where possible.

## Notes

- The game uses the `LandstalkerGameExportHandler` class which extends `GenericGameExportHandler`
- Auto-export of helpers is disabled (`AUTO_EXPORT_DISCOVERED_HELPERS = False`) because the complex patterns need special handling
- The exporter uses a regions stack to track `required_regions` values across nested rule processing
