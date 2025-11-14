# The Witness - Solved Exporter Issues

This document tracks resolved issues related to the exporter for The Witness.

## Status
Last updated: 2025-11-14

## Solved Issues

### Issue 1: Start regions not using origin_region_name ✓
**Location**: `exporter/exporter.py` lines 551-583
**Severity**: Critical
**Description**: The exporter was not checking the world's `origin_region_name` attribute when determining the default starting region. It defaulted to "Menu" and then looked for regions with no entrances, but The Witness world has `origin_region_name = "Entry"` which should be used.

**Impact**: The frontend couldn't reach any regions because it started at "Menu" which doesn't exist. All regions showed as unreachable in Sphere 0.

**Test failure**:
```
ISSUE: Region Tutorial is not reachable
REGION MISMATCH found for: {"type":"state_update","sphere_number":0,"player_id":"1"}
Regions accessible in LOG but NOT in STATE: [all regions]
```

**Fix Applied**: Modified `exporter/exporter.py` to check for `world.origin_region_name` attribute first before falling back to "Menu" or searching for regions with no entrances.

**Result**: The start_regions now correctly uses "Entry" as the starting region. Most regions are now reachable in the frontend.

**Status**: ✓ FIXED
