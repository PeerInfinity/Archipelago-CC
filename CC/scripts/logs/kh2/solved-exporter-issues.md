# KH2 Solved Exporter Issues

This document tracks exporter issues for Kingdom Hearts 2 that have been resolved.

## Solved Issues

### 1. FinalFormLogic Type Mismatch (2025-12-18)

**Problem:** The `get_form_level_requirement` helper expansion in `exporter/games/kh2.py` generated comparisons using integer values (0, 1, 2) for FinalFormLogic, but the settings export FinalFormLogic as string keys ("no_light_and_darkness", "light_and_darkness", "just_a_form").

**Symptom:** "Master level 4" location was incorrectly marked as accessible at sphere 0.2 (when only Master Form was acquired), instead of sphere 1.10 (when Final Form was acquired).

**Root Cause:** The code compared `FinalFormLogic != 0` and `FinalFormLogic == 1`, but FinalFormLogic was actually the string "light_and_darkness". String vs integer comparison resulted in incorrect branch execution:
- `"light_and_darkness" != 0` → true (correct)
- `"light_and_darkness" == 1` → false (incorrect - should be true for light_and_darkness)
This caused the "just_a_form" logic to be used instead of "light_and_darkness" logic.

**Solution:** Changed the comparisons to use string values:
- `0` → `'no_light_and_darkness'`
- `1` → `'light_and_darkness'`

**Files Modified:**
- `exporter/games/kh2.py` (lines 379-389)

---

Last updated: 2025-12-18
