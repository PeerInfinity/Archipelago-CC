# SMZ3 Solved Exporter Issues

## Issue 1: Tower of Hera boss logic not properly inlined

**Status:** ✅ SOLVED
**Sphere where issue appeared:** 3.4
**Test failure:** Tower of Hera - Moldorm accessible too early

**Description:**
The location "Tower of Hera - Moldorm" was being unlocked at sphere 3.4 in the JavaScript frontend, but the Python backend didn't unlock it until sphere 4.3 when the Hammer was obtained.

**Root Cause:**
The exporter had special logic to inline Tower of Hera boss requirements (Sword OR Hammer only), but this inlining wasn't working. The exported rule used the generic `smz3_CanBeatBoss` helper which accepted too many weapons (including Somaria, which the player had at sphere 1.2), causing early access.

**Solution:**
Modified `exporter/games/smz3.py` to call `postprocess_rule` within `override_rule_analysis` while `_current_location_region` is still set (line 283), and added special handling in `postprocess_rule` to inline `CanBeatBoss` helper based on region name (lines 518-556).

**Changes made:**
1. Added `analyzed_rule = self.postprocess_rule(analyzed_rule)` in `override_rule_analysis` before returning
2. Added region-specific inlining logic for `CanBeatBoss` helper:
   - Tower of Hera: Sword OR Hammer only
   - Turtle Rock: Firerod AND Icerod
   - Thieves' Town: Sword OR Hammer OR Somaria OR Byrna
   - Other regions: Use generic helper

**Result:**
The test now correctly recognizes that Tower of Hera - Moldorm requires BigKeyTH AND (ProgressiveSword OR Hammer), and passes spheres 1-4 successfully.
