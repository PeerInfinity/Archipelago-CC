# Solved General Issues for Donkey Kong Country 3

## Issue 1: Test script expects wrong folder name - SOLVED ✅

**Status:** Fixed (via exporter fix)
**Priority:** High
**Related to:** Exporter Issue #1

**Description:**
The test script looked for rules.json in `frontend/presets/dkc3/` but the exporter created files in `frontend/presets/donkey_kong_country_3/`. This was a symptom of the exporter issue and manifested as a test failure.

**Error Message:**
```
Rules file not found: /home/user/Archipelago-CC/frontend/presets/dkc3/AP_01043188731678011336/AP_01043188731678011336_rules.json
```

**Solution:**
Fixed by correcting the exporter's `get_world_directory_name()` function to properly identify the world directory. Files are now created in the correct location.

**Testing:**
- Extended test suite now passes with files in correct location
- All 9 seeds (2-10) pass successfully
