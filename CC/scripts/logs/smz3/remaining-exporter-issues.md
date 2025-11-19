# Remaining Exporter Issues for SMZ3

This file tracks outstanding issues in the SMZ3 exporter (`exporter/games/smz3.py`).

## Issues to Fix

### 1. RewardType variable not found in context

**Location:** Sahasrahla (appears at Sphere 5.8)

**Error:**
```
Name "RewardType" NOT FOUND in context
ISSUE: Access rule evaluation failed
```

**Impact:** Location "Sahasrahla" is accessible in the sphere log but not in the STATE because the access rule references a variable "RewardType" that is not exported or resolved.

**Investigation needed:**
- Check if RewardType is a variable that needs to be exported
- Look at the Python source code to understand what RewardType should be
- Check the access rule for Sahasrahla in the rules.json to see how it references RewardType
