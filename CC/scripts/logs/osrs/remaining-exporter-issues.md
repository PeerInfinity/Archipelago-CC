# Remaining Exporter Issues for Old School Runescape

## Issue 1: Unresolved Lambda Default Parameters

**Status**: In Progress (Exporter created, needs debugging)
**Priority**: High
**Test Failure**: Sphere 0 - 3 locations not accessible

**Description**:
The OSRS world code uses lambdas with default parameters to capture variable values:
- `lambda state, region_required=region_required: state.can_reach(region_required, "Region", self.player)`
- `lambda state, item_req=item_req: state.has(item_req, self.player)`
- `lambda state, location_row=location_row: self.quest_points(state) > location_row.qp`

The generic exporter doesn't resolve these default parameters, resulting in rules like:
```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {
      "type": "name",
      "name": "region_required"
    },
    ...
  ]
}
```

The frontend can't evaluate `{"type": "name", "name": "region_required"}` because it's an unresolved variable.

**Affected Locations** (at least):
- "Burn some Oak Logs" - needs Oak Tree region
- "Burn some Willow Logs" - needs Oak Tree and Willow Tree regions
- "Kill a Duck" - needs Duck region

**Solution**:
Create a custom OSRS exporter that:
1. Detects lambda default parameters
2. Resolves the actual values (region names, item names, etc.)
3. Replaces `{"type": "name", "name": "region_required"}` with `{"type": "constant", "value": "Duck"}` (or appropriate region name)

**Code Location**:
- `worlds/osrs/__init__.py` lines ~220-230 (location rule creation)
- Exporter created: `exporter/games/osrs.py` (created, has override_rule_analysis method)

**Current Implementation**:
An OSRS exporter has been created at `exporter/games/osrs.py` with an `override_rule_analysis` method that attempts to:
1. Extract closure variables from the lambda
2. Convert Region objects to their name strings
3. Pass the modified closure_vars to analyze_rule

**Remaining Work**:
The implementation needs debugging - the closure variable conversion is not taking effect in the final rules.json output. Possible approaches:
1. Modify the analyzer to handle Region objects during serialization
2. Post-process the analyzed rules to replace "name" type rules with "constant" type
3. Investigate why the modified closure_vars are being overwritten during analysis

## Issue 2: Quest Points Helper Function

**Status**: Not Fixed
**Priority**: High

**Description**:
The OSRS world uses a custom method `self.quest_points(state)` to calculate total quest points from QP items in inventory.

This needs to be:
1. Recognized by the exporter as a helper function
2. Implemented in the frontend as a JavaScript helper

**Code Location**:
- Python: `worlds/osrs/__init__.py` - quest_points() method
- Frontend helper needed: `frontend/modules/shared/gameLogic/osrs/helpers.js` (doesn't exist yet)

**Implementation Notes**:
The quest_points() method should sum up quest point values from special QP items like:
- "1 QP (Quest Name)"
- "3 QP (Quest Name)"
- etc.
