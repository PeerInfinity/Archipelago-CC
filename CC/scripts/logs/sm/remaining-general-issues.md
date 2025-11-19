# Super Metroid - Remaining General Issues

## Issue 1: State snapshot missing `smbm` property

**Symptom:**
- Locations "Energy Tank, Brinstar Ceiling" and "Morphing Ball" fail to be accessible in Sphere 0
- Error: "Access rule evaluation failed"

**Root Cause:**
The access rules for Super Metroid locations reference `state.smbm[1].maxDiff` to get the difficulty threshold. For example:
```json
{
  "type": "helper",
  "name": "evalSMBool",
  "args": [
    {"type": "helper", "name": "SMBool", "args": [{"type": "constant", "value": true}]},
    {
      "type": "attribute",
      "object": {
        "type": "subscript",
        "value": {
          "type": "attribute",
          "object": {"type": "name", "name": "state"},
          "attr": "smbm"
        },
        "index": {"type": "constant", "value": 1}
      },
      "attr": "maxDiff"
    }
  ]
}
```

This tries to access `state.smbm[1].maxDiff`, where `state` resolves to the state snapshot.

The `smStateModule` in `frontend/modules/shared/gameLogic/sm/smLogic.js` defines an `initializeState()` function that should add the `smbm` property:
```javascript
initializeState() {
  return {
    flags: [],
    events: [],
    smbm: {
      1: { maxDiff: 999 }
    }
  };
}
```

However, this initialization function needs to be actually called by the StateManager when initializing the state for Super Metroid.

**Expected Behavior:**
- The state snapshot should have a `smbm` property with player-specific difficulty thresholds
- `state.smbm[1].maxDiff` should evaluate to `999`
- `evalSMBool(SMBool(true), 999)` should evaluate to `true`

**Fix Location:**
Need to verify that StateManager calls the game-specific `initializeState()` function from `smStateModule` when initializing state for Super Metroid games.

**Status:** SOLVED - See solved-general-issues.md

---

## Issue 2: Locations with `SMBool(True)` marked as always accessible

**Symptom:**
- After fixing Issue 1, the spoiler test now shows:
  - "Locations accessible in STATE (and unchecked) but NOT in LOG: Energy Tank, Terminator, Missile (Crateria gauntlet right), Missile (Crateria gauntlet left), Power Bomb (blue Brinstar)"
- These locations should NOT be accessible in Sphere 0, but they are being marked as accessible

**Root Cause:**
Super Metroid uses complex `accessFrom` comprehensions that the exporter cannot handle (they hit recursion limits). The exporter skips the `accessFrom` part and only exports the `Available` part of the access rule.

For many locations, the `Available` rule is just `evalSMBool(SMBool(true), state.smbm[1].maxDiff)`, which evaluates to `true`. The actual item requirements are in the `accessFrom` part, which is being skipped.

According to the sphere log:
- These are REGIONS that become accessible in Sphere 0
- But the LOCATIONS in those regions require items to access:
  - "Energy Tank, Terminator" location requires Bombs (accessible in Sphere 1.2)
  - "Missile (Crateria gauntlet left)" requires Reserve Tank (accessible in Sphere 2.1)
  - "Missile (Crateria gauntlet right)" requires Reserve Tank + one more item (accessible in Sphere 2.1)
  - "Power Bomb (blue Brinstar)" requires Power Bomb item (accessible in Sphere 3.2)

**Expected Behavior:**
- Locations should only be accessible when the player has the required items
- The `accessFrom` comprehension encodes region-to-region connectivity requirements
- The `Available` rule encodes within-region item requirements

**Possible Solutions:**
1. **Implement VARIA logic in frontend**: Fully implement the `accessFrom` comprehension evaluation in the frontend, including all VARIA logic helper functions
2. **Export as False**: Continue exporting `accessFrom` patterns as `constant False` (currently done for deeply nested patterns), but also mark locations with only `SMBool(True)` in their `Available` rule
3. **Python-side simplification**: Modify the Python exporter to simplify the `accessFrom` comprehensions before export, or pre-compute region connectivity
