# SMZ3 Remaining Exporter Issues

## Issue 2: RewardType and CanAcquire pattern not resolved

**Status:** Needs Design Decision
**Sphere where issue appears:** 5.8
**Test failure:** Sahasrahla location not accessible

**Description:**
The location "Sahasrahla" is accessible in the Python backend at sphere 5.8, but not in the JavaScript frontend. The error message is:
```
Name "RewardType" NOT FOUND in context
ISSUE: Access rule evaluation failed
Locations accessible in LOG but NOT in STATE (or checked): Sahasrahla
```

**Python Source:**
```python
Location(self, 256+44, 0x5F1FC, LocationType.Regular, "Sahasrahla",
    lambda items: self.world.CanAcquire(items, RewardType.PendantGreen))
```

**Exported Rule:**
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {"type": "constant", "value": true},
    "attr": "CanAcquire"
  },
  "args": [{
    "type": "attribute",
    "object": {"type": "name", "name": "RewardType"},
    "attr": "PendantGreen"
  }]
}
```

**Root Cause:**
The `self.world.CanAcquire(items, RewardType.PendantGreen)` pattern is complex:

1. `CanAcquire` checks if a region with a specific reward can be completed
2. The green pendant reward is randomly assigned to a dungeon (in this seed, it's Swamp Palace)
3. The check effectively means "can the player complete Swamp Palace?"
4. This is runtime-dependent - we can't know which dungeon has which reward at analysis time

**Sphere Analysis:**
- Sphere 5.8: Sahasrahla becomes accessible when KeySP is obtained
- Swamp Palace (which has PendantGreen in this seed) becomes completable
- The check is effectively "can complete the dungeon with the green pendant"

**Complexity:**
This requires:
- Exporting dungeon reward mappings to frontend
- JavaScript logic to look up which dungeon has the green pendant
- Checking if that dungeon can be completed
- Handling all reward types (3 pendants, 7 crystals)

**Possible Solutions:**
1. **Export dungeon rewards**: Add reward info to dungeons section and implement JS lookup logic
2. **Convert to events**: Create "PendantGreen" event items granted when dungeons are completed
3. **Inline at generation time**: Resolve which dungeon has each reward during export and inline the check
4. **Simplified assumption**: Assume rewards follow vanilla pattern (may not work for randomized rewards)

**Fix needed:**
Design decision needed on how to handle runtime-dependent dungeon reward checks. This affects multiple locations that use `CanAcquire`, `CanAcquireAll`, and `CanAcquireAtLeast` patterns.
