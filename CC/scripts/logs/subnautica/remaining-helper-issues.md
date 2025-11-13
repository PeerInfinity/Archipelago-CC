# Remaining Helper Issues for Subnautica

## Issue 1: Depth Calculation Mismatch at Sphere 0.5
**Problem**: The spoiler test fails at Sphere 0.5 (step 6) with 29 locations that are accessible in the frontend STATE but not in the Python LOG. These are all deep-water locations:
- Blood Kelp Trench Wreck locations
- Dunes wreck locations
- Grand Reef wreck locations
- Mountains wreck locations
- Sparse Reef wreck locations
- Jellyshroom Cave locations
- Lifepod 19 locations
- Deep Sparse Reef Sanctuary

**Diagnosis**: The frontend is being more permissive than the Python backend, suggesting the depth calculation or can_access_location helper is not correctly matching the Python implementation.

**Potential Causes**:
1. Depth calculation (get_max_depth) may be returning incorrect values
2. The can_access_location helper may have logic differences from Python
3. Settings (swim_rule) may not be loaded correctly from staticData
4. Map distance or seaglide requirements may be evaluated differently

**Next Steps**:
1. Verify swim_rule settings are loaded correctly from staticData
2. Add debug logging to depth calculation helpers
3. Compare specific location depths with Python expectations
4. Check if seaglide fragment requirements are being evaluated correctly

**Status**: In progress
