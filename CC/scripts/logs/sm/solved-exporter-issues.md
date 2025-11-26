# Super Metroid - Solved Exporter Issues

This file tracks exporter issues that have been resolved for Super Metroid.

## Solved Issues

### 1. Rules.json caching issue - Stale rules with `self.evalSMBool` and `func` helper
- **Date Solved:** 2025-11-26
- **Problem:** The rules.json file had stale data with invalid patterns like:
  - `self.evalSMBool(func(...), ...)` - function_call with `self` reference
  - `helper: "func"` - invalid helper referencing closure variable
- **Solution:** Regenerating the rules.json file with `python Generate.py` produced correct output. The exporter's `get_unwrapped_exit_lambda` method and analyzer were working correctly, but the cached rules.json was outdated.
- **Files Changed:** Regenerated `frontend/presets/sm/AP_*/AP_*_rules.json`

The correct rules.json now has:
- `helper: "SMBool"` for simple boolean returns
- `helper: "traverse"` for door traversal
- `helper: "wand"` for AND conditions
- Proper helper calls like `canPassLavaPit`, `canHellRun`, etc.
