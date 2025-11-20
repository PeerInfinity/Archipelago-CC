# Remaining Exporter Issues for Zillion

## Current Status
Major progress made! Reduced from 470 incorrect locations to only 41 remaining issues.

## Issue: Region Connectivity Not Exported

### Problem
41 locations are accessible in STATE but shouldn't be in Sphere 0:
- C-3 mid far right, C-5 mid far left, D-2 top left-center, D-5 mid center, D-6 mid center, E-4 mid center, E-5 top far right, E-6 bottom center, F-8 bottom center, G-4 mid center, G-5 top far right, G-6 bottom far left, G-7 mid center, H-6 bottom far left, H-7 top far left, H-8 top right-center, I-5 mid far right, I-6 mid right-center, E-2 bottom left-center, J-2 bottom right-center, J-3 mid far left, J-4 bottom left-center, J-5 top left, J-5 mid left-center, K-2 bottom right, K-2 mid far left, K-2 mid left, L-2 top left-center, L-2 mid far right, L-7 mid left, M-3 bottom right-center, M-5 top left-center, M-6 bottom right-center, N-2 top center, N-2 bottom right, N-2 top left, N-2 bottom left, N-4 mid left, N-7 bottom far left, O-3 mid right, O-5 mid far left

These locations have `access_rule: {"type": "constant", "value": true}` (no item requirements) but are in regions that shouldn't be reachable yet.

### Root Cause
Location accessibility in Archipelago depends on:
1. **Location access rules** (item requirements) - ✓ We're exporting these
2. **Region connectivity** (which regions can be reached) - ✗ Not yet exported

The Zillion world creates regions with exits/entrances, but we're not exporting the access rules for those exits.

### Next Steps
1. Check how Zillion sets up region exits and their access rules
2. Export exit access rules from the Zillion world
3. Ensure regions are only marked as accessible when their connecting exits are accessible

### Expected Test Improvement
Once region connectivity is properly exported, the 41 extra accessible locations should be fixed, bringing us to 0 mismatches in Sphere 0.
