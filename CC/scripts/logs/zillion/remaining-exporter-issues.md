# Remaining Exporter Issues

## Issue 1: Incorrect mapping of gun/jump levels to item counts

**Problem:**
The exporter now extracts requirements from `zz_loc.req` successfully, but the mapping of gun/jump levels to Zillion/Opa-Opa item counts is not correct.

**Current Understanding:**
- In Zillion, you start with a basic gun (gun=1) and can jump (jump=1)
- These are the default starting abilities, not items to collect
- The exporter currently treats gun>1 as requiring (gun-1) Zillion items
- The exporter currently treats jump>1 as requiring (jump-1) Opa-Opa items

**Evidence from Testing:**
- Sphere 0 should have 12 accessible locations
- Current implementation shows wrong locations accessible in Sphere 0
- Need to verify the exact mapping between levels and item counts

**Next Steps:**
1. Investigate zilliandomizer's `make_ability()` function to understand how items map to levels
2. Test with the Python backend to see what gun/jump levels correspond to different item counts
3. Adjust the exporter's level-to-count mapping accordingly
4. Consider testing empirically by checking what gun/jump levels the 12 Sphere 0 locations have

