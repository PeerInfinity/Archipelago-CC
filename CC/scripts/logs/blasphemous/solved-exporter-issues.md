# Solved Exporter Issues for Blasphemous

This document tracks exporter issues that have been resolved.

## Solved Issues

### Issue 1: Amanecida Boss Location Rules Incorrectly Using OR Logic Instead of AND

**Date Fixed:** 2025-11-26

**Problem:**
The Amanecida boss locations (GotP: Amanecida of the Bejeweled Arrow, PotSS: Amanecida of the Chiselled Steel, WotHP: Amanecida of the Molten Thorn, MotED: Amanecida of the Golden Blades) and the Amanecida[D03Z01S03] region were being marked as accessible prematurely.

The test failed at sphere 4.30-4.35 with the following errors:
- `Locations accessible in STATE (and unchecked) but NOT in LOG: GotP: Amanecida of the Bejeweled Arrow, PotSS: Amanecida of the Chiselled Steel, WotHP: Amanecida of the Molten Thorn, MotED: Amanecida of the Golden Blades`
- `Regions accessible in STATE but NOT in LOG: Amanecida[D03Z01S03]`

**Root Cause:**
The exporter's `override_rule_analysis` method in `exporter/games/blasphemous.py` was using a generic approach to extract region requirements from boss methods and was incorrectly ORing ALL region requirements together.

However, the actual Python boss methods have specific AND/OR combinations:
- `can_beat_graveyard_boss`: ALL regions ANDed together (Santos AND D02Z03S18[NW] AND D02Z02S03[NE])
- `can_beat_jondo_boss`: Santos AND (D20Z01S06[NE] OR D20Z01S04[W]) AND (D03Z01S04[E] OR D03Z02S10[N])
- `can_beat_patio_boss`: Santos AND D06Z01S02[W] AND (D04Z01S03[E] OR D04Z01S01[W] OR D06Z01S18[-Cherubs])
- `can_beat_wall_boss`: Santos AND D09Z01S09[Cell24] AND (D09Z01S11[E] OR D06Z01S13[W])

**Solution:**
Replaced the generic boss rule extraction logic with explicit rule definitions for each Amanecida-related boss method (can_beat_graveyard_boss, can_beat_jondo_boss, can_beat_patio_boss, can_beat_wall_boss, can_beat_hall_boss, can_beat_mourning_boss) that exactly match the Python AND/OR structure.

**Files Modified:**
- `exporter/games/blasphemous.py`: Added `explicit_boss_rules` dictionary with correct AND/OR logic for each Amanecida boss method

**Verification:**
After regenerating rules.json with the fixed exporter, all 306 spheres pass with no mismatches.
