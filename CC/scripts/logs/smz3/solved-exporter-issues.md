# Solved SMZ3 Exporter Issues

## Issue 1: Sphere logger fails with "Not all progression items reachable" in full spoilers mode

**Status**: FIXED

**Description**:
When running with `extend_sphere_log_to_all_locations` enabled (full spoilers mode), the sphere logger would fail with:
```
RuntimeError: Not all progression items reachable ({Swamp Palace - Big Chest, Skull Woods - Big Chest}). Something went wrong.
```

**Root Cause**:
In full spoilers mode, the sphere logger includes ALL filled locations (not just advancement items). Some non-advancement item locations are unreachable (they're behind optional areas), which is expected behavior. The original code treated any unreachable location as an error.

**Solution**:
Modified `exporter/sphere_logger.py` to only check accessibility errors for advancement items when in full spoilers mode. Non-advancement items at unreachable locations are now correctly treated as expected and non-fatal.

**Files Changed**:
- `exporter/sphere_logger.py` - Added conditional check for `extend_sphere_log_to_all_locations`
