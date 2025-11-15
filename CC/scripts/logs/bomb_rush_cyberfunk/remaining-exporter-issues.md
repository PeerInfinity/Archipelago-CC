# Remaining Exporter Issues for Bomb Rush Cyberfunk

## Status
Test run on 2025-11-15 (latest): **FAILING** at Sphere 4.5 (significant progress from initial Sphere 0 failure)

## Progress Summary
- Sphere 0-4.4: PASSING ✓
- Sphere 4.5: FAILING - Multiple regions accessible too early

## Remaining Issues

### Issue 3: Chapter-gated regions accessible too early
**Status:** INVESTIGATING
**Test failure:** Sphere 4.5 - Multiple regions and locations accessible in STATE but NOT in LOG

**Affected regions:**
- Brink Terminal
- Millennium Mall
- Mataan - After Smoke Wall

**Affected locations (sample):**
- Brink Terminal: Under square ledge graffiti
- Millennium Mall: Warehouse pallet graffiti
- Mataan: Trash CD
- (and 15+ other locations in these regions)

**Problem:**
The JavaScript state manager thinks these three regions are accessible at Sphere 4.5, but the Python sphere log shows they should not be accessible yet. These regions are all Chapter 2+ content that requires completing Chapter 1.

**Analysis:**
This is likely a helper implementation issue rather than an exporter issue. The region entrance rules are probably exported correctly, but the JavaScript helper functions that check chapter completion or region access may have bugs.

**Next steps:**
1. Check the entrance rules for these regions in rules.json
2. Verify the Python chapter/region access functions
3. Debug the JavaScript helper implementations for chapter checking and region access
4. This should be tracked in remaining-helper-issues.md rather than remaining-exporter-issues.md

## Previously Fixed Issues
See solved-exporter-issues.md for:
- Issue 1: Incorrect graffiti_spots function inlining (FIXED)
- Issue 2: Region access functions returning empty rules (FIXED)
