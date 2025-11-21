# Solved Exporter Issues for Ocarina of Time

## FIXED: Game ID 'oot' Not Mapped to Preset Folder

**Status**: ✓ FIXED (2025-11-21)

**Description**:
Frontend spoiler test was looking for game="oot" but preset_files.json had the key as "ocarina_of_time", causing the test to fall back to "adventure" game data instead.

**Error Message**:
```
[WARN] [init] Game "oot" not found in preset_files.json
```

**Root Cause**:
The exporter was using `get_world_directory_name()` which converted "Ocarina of Time" to "ocarina_of_time" (snake_case), but the correct world directory name is "oot". The preset folder and preset_files.json key need to match the game's short code.

**Fix Applied**:
1. Renamed preset folder: `frontend/presets/ocarina_of_time` → `frontend/presets/oot`
2. Updated preset_files.json: Changed key from "ocarina_of_time" to "oot"
3. Used Python script to ensure JSON structure remained valid

**Files Modified**:
- frontend/presets/preset_files.json (renamed key)
- frontend/presets/oot/ (renamed directory)

**Verification**:
Re-running `npm test --mode=test-spoilers --game=oot --seed=1` now correctly finds and loads:
```
./presets/oot/AP_14089154938208861744/AP_14089154938208861744_rules.json
```

**Impact**:
Frontend can now load OOT preset files correctly, allowing proper testing to proceed.

**Related Issues**:
This fix revealed the next major issue: massive state mismatch due to placeholder rule parsing (see remaining-exporter-issues.md).

