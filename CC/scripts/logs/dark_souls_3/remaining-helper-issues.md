# Remaining Helper Issues

## Issue 1: Additional regions not accessible due to _can_get usage

**Error Message:**
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":"2.11","player_id":"1"}
> Regions accessible in LOG but NOT in STATE: Catacombs of Carthus, Irithyll of the Boreal Valley, Smouldering Lake
```

**Description:**
The `_can_get` helper has been successfully implemented and now works for basic cases. Undead Settlement is now accessible, and the test progresses from Sphere 0.4 to Sphere 2.11. However, there are still three regions that aren't becoming accessible:
- Catacombs of Carthus
- Irithyll of the Boreal Valley
- Smouldering Lake

These likely use `_can_get` in their entrance rules as well.

**Progress:**
- ✅ `_can_get` helper is recognized
- ✅ Undead Settlement is now accessible (test progresses to Sphere 2.11)
- ✅ Test now passes through 31 steps (previously failed at step 5)
- ⏳ Need to investigate why these three regions aren't accessible

**Priority:** High

**Status:** In progress

**Next Steps:**
1. Check the entrance rules for these three regions in rules.json
2. Verify which boss soul locations they depend on
3. Ensure those locations are being properly evaluated by `_can_get`

