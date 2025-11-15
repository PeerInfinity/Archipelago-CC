# Solved Exporter Issues - Metamath

This file tracks issues with the Metamath exporter that have been fixed.

## Issue 1: Incorrect access rules for dynamically created lambdas

**Date Fixed**: 2025-11-15

**Symptom**:
- Location "Prove Statement 10" was accessible in Sphere 0 according to JavaScript state manager
- Should only be accessible at Sphere 2.1 according to Python sphere log
- The location's `access_rule` only required `Statement 1` instead of `Statement 6` and `Statement 9`

**Root Cause**:
- Metamath creates access rules using dynamically generated lambdas in `Rules.py`:
  ```python
  access_rule = lambda state, p=player, items=item_names: state.has_all(items, p)
  ```
- The analyzer couldn't extract source code from these dynamically created lambdas
- This caused the rule analysis to fail and fall back to an incorrect default

**Solution**:
- Added `override_rule_analysis()` method to `MetamathGameExportHandler`
- This method intercepts rule analysis for locations, entrances, and exits
- It uses the pre-computed dependency caches (`location_dependencies`, `entrance_dependencies`, `exit_dependencies`)
- These caches are populated by the world's `set_rules()` method
- The override builds explicit item_check rules directly from the dependencies

**Implementation**:
- File: `exporter/games/metamath.py`
- Method: `override_rule_analysis(self, rule_func, rule_target_name: str = None)`
- Lines: 415-483

**Test Result**:
- Spoiler test now passes successfully
- All spheres match between Python backend and JavaScript frontend
