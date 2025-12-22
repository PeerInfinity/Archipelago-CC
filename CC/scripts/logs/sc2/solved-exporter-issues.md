# Solved Exporter Issues for Starcraft 2

This document tracks exporter issues that have been fixed for the SC2 game.

## Solved Issues

### Issue 1: Helpers that call blacklisted helpers are exported with incorrect logic

**Status:** FIXED

**Description:**
When the exporter exports a helper function that internally calls a blacklisted helper, the blacklisted helper call was replaced with `True`. This caused the exported helper to have incorrect logic.

**Root cause:**
In `exporter/games/sc2.py`, the `override_rule_analysis` and `expand_rule` methods were replacing blacklisted helpers with `{'type': 'constant', 'value': True}` instead of keeping them as helper calls.

**Fix applied:**
Changed the exporter to return `{'type': 'helper', 'name': helper_name}` instead of `{'type': 'constant', 'value': True}` for blacklisted helpers. This allows the frontend to use the JavaScript implementation of these helpers.

Also added `terran_competent_anti_air` and `terran_moderate_anti_air` to the blacklist since they depend on `terran_competent_ground_to_air`.

**Files modified:**
- `exporter/games/sc2.py`: Changed blacklisted helper handling in 4 locations

---

### Issue 2: Helper function arguments not preserved during export

**Status:** FIXED

**Description:**
When the exporter exports a location rule that calls a helper with arguments (e.g., `lambda state: logic.terran_competent_comp(state, 2)`), the arguments were not preserved in the exported rules.json.

**Example:**
```python
# Victory uses upgrade_level=2
lambda state: logic.terran_competent_comp(state, 2)
```

Was being exported as:
```json
{"rule": "terran_competent_comp"}
```

Instead of including the args.

**Root cause:**
The general analyzer pipeline was processing lambdas through multiple stages, and the args were being lost along the way. The issue was particularly problematic for blacklisted helpers called from lambdas.

**Fix applied:**
Added a new `_handle_blacklisted_helper_lambda` method in `exporter/games/sc2.py` that:
1. Detects lambdas that are simple calls to blacklisted helpers
2. Parses the lambda's AST directly
3. Extracts the method name and arguments (filtering out state/player/world)
4. Returns a properly formatted helper rule with args included

**Files modified:**
- `exporter/games/sc2.py`: Added `_handle_blacklisted_helper_lambda` method and integrated it into `override_rule_analysis`
