# Remaining Helper Issues

## Issue 1: Temporal Gyre region not accessible at sphere 7.1

**Status**: Under investigation

**Description**: The region "Temporal Gyre" should become accessible at sphere 7.1 (when "Killed Maw" event is collected), but it's not being marked as accessible in the state manager.

**Expected behavior**: After collecting all three boss kill events ("Killed Maw", "Killed Twins", "Killed Aelana") and having the Timespinner Wheel item, the `can_kill_all_3_bosses` helper should return true and the Temporal Gyre region should become accessible.

**Current test result**: Test passes up to sphere 6.4 but fails at sphere 7.1 with:
- REGION MISMATCH: "Temporal Gyre" accessible in LOG but NOT in STATE

**Access rule for Military Fortress -> Temporal Gyre**:
```json
{
  "type": "and",
  "conditions": [
    {"type": "item_check", "item": "Timespinner Wheel"},
    {"type": "helper", "name": "can_kill_all_3_bosses", "args": []}
  ]
}
```

**Helper implementation**: `can_kill_all_3_bosses` in `timespinnerLogic.js:262-280`

**Next steps**:
1. Verify that events are being properly collected and added to the snapshot's events array
2. Debug why `can_kill_all_3_bosses` is not returning true when all three events are present
3. Check if there's an issue with event item processing

