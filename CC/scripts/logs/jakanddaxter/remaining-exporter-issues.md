# Remaining Exporter Issues for Jak and Daxter

## Issue: Reachable Orbs Not Updated When New Orb Regions Become Accessible

**Status:** Not fixed
**Priority:** High
**Sphere where it fails:** 3.15 (step 120)

**Description:**
The "Reachable Orbs" progressive item is not being updated in the sphere log when new orb-containing regions become accessible. At sphere 3.15, the Snowy Mountain Gondola is collected, which unlocks many Snowy Mountain regions containing orbs. These new orb regions should increase the "Reachable Orbs" count from 288 (from sphere 3.1) to at least 1530 (required for orb trading locations). However, the sphere log at 3.15 does not show an updated "Reachable Orbs" value in the resolved_items.

**Current Behavior:**
- Sphere 3.1: Reachable Orbs = 288
- Sphere 3.15: Snowy Mountain regions become accessible (no Reachable Orbs update in sphere log)
- Orb trading locations require 1530 orbs but frontend only sees 288

**Expected Behavior:**
- When new regions with orbs become accessible, the "Reachable Orbs" value should be recalculated and written to the sphere log

**Python Code Reference:**
In `worlds/jakanddaxter/rules.py`:
- `recalculate_reachable_orbs()` (line 34-46) - recalculates orbs based on accessible regions
- `can_reach_orbs_global()` (line 71-79) - checks if recalculation is needed
- The Python code sets `Reachable Orbs Fresh` to false to trigger recalculation

**Problem:**
The sphere log generation or exporter is not capturing the recalculated "Reachable Orbs" values. The sphere log only shows "Reachable Orbs" updates at specific spheres (0.1, 1.1, 2.1, 3.1, 4.1) but not when intermediate regions become accessible.

**Affected Locations (at sphere 3.15):**
- RV: Bring 120 Orbs To The Oracle (1) - requires 1740 orbs
- RV: Bring 120 Orbs To The Oracle (2) - requires 1860 orbs
- RV: Bring 90 Orbs To The Gambler - requires 1530 orbs
- RV: Bring 90 Orbs To The Geologist - requires 1620 orbs
- RV: Bring 90 Orbs To The Warrior - requires 1440 orbs
- SV: Bring 120 Orbs To The Oracle (1) - requires 1740 orbs
- SV: Bring 120 Orbs To The Oracle (2) - requires 1860 orbs
- SV: Bring 90 Orbs To The Mayor - requires 1530 orbs
- SV: Bring 90 Orbs to Your Uncle - requires 1350 orbs
- VC: Bring 120 Orbs To The Oracle (1) - requires 1740 orbs
- VC: Bring 120 Orbs To The Oracle (2) - requires 1860 orbs
- VC: Bring 90 Orbs To The Miners (1) - requires 1350 orbs
- VC: Bring 90 Orbs To The Miners (2) - requires 1440 orbs
- VC: Bring 90 Orbs To The Miners (3) - requires 1530 orbs
- VC: Bring 90 Orbs To The Miners (4) - requires 1620 orbs

**Potential Fix:**
The sphere log generation code needs to ensure that when regions are marked as accessible, any progressive items that depend on region accessibility (like "Reachable Orbs") are recalculated and written to the sphere log's resolved_items.
