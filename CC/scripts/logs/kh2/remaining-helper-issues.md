# Remaining Helper Issues

## Issue 1: Form level unlocks are too permissive (Master levels 4-7)

**Error**: Locations accessible in STATE but NOT in LOG
**Impact**: Master level 4, 5, 6, 7 become accessible too soon (in Sphere 0.2 when they should be later)
**Sphere**: 0.2
**Status**: Need to implement proper form_list_unlock helper

The Python logic for `form_list_unlock` requires counting total forms available and comparing to the level requirement. Current simplified expansion just checks for the form itself, which makes all levels accessible at once.

**Python Logic**:
- Master level 2 (level 0): Need Master Form + 0 total forms (so just Master Form)
- Master level 3 (level 1): Need Master Form + 1 total form (so any 1 form)
- Master level 4 (level 2): Need Master Form + 2 total forms
- etc.

**Solution**: Create a JavaScript helper function `form_list_unlock` that counts total forms and checks level requirement.

