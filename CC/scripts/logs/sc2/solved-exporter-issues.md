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
