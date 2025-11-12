# Remaining Helper Issues for Kirby's Dream Land 3

## Issue 1: can_assemble_rob helper function not implemented

**Description:**
The helper function `can_assemble_rob` is referenced in access rules but not implemented in the frontend. This is a complex helper that checks enemy abilities and copy abilities.

**Error:**
```
STATE MISMATCH found for: Sphere 7.57
> Locations accessible in LOG but NOT in STATE (or checked): Sand Canyon 6 - Professor Hector & R.O.B
        Helper function "can_assemble_rob" NOT FOUND in snapshotInterface
    ISSUE: Access rule evaluation failed
```

**Test Progress:**
- Events processed: 241/342 (70.5%)
- Sphere reached: 7.57

**Python Implementation:**
The function is defined in worlds/kdl3/rules.py:89 and requires:
- Coo and Kine animal friends
- Checks enemy_abilities.enemy_restrictive for specific ability requirements
- Requires Parasol and Stone abilities

**Next Steps:**
1. Understand the enemy_abilities structure
2. Export necessary data (copy_abilities mapping, enemy_restrictive data)
3. Implement can_assemble_rob and potentially can_fix_angel_wings helpers
