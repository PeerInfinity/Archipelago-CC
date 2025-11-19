# Remaining General Issues for Ocarina of Time

## Summary
This document tracks general (non-exporter, non-helper) issues for Ocarina of Time (OOT).

## Status
- **Current Test Status**: FAILING at Sphere 0
- **Test Date**: 2025-11-19
- **Seed**: 1 (AP_14089154938208861744)

## Issues

### Template Generation Failure

**Description**: The default OOT template (`Templates/Ocarina of Time.yaml`) fails to generate with a FillError.

**Error Message**:
```
Fill.FillError: No more spots to place 2 items. Remaining locations are invalid.
```

**Impact**: Cannot generate new test seeds. Must use pre-existing preset files.

**Workaround**: Use the existing preset at `frontend/presets/ocarina_of_time/AP_14089154938208861744/`

**Priority**: LOW - This is a generation issue in the core Archipelago logic, not related to our JSON export/frontend testing work.

**Note**: This issue exists in both seed 1 and seed 42, suggesting it's a template configuration problem, not a seed-specific issue.
