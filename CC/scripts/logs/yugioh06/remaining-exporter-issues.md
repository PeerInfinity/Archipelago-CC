# Remaining Exporter Issues

## Issue 1: state_method "has_from_list" not handled by rule engine

**Status**: Partially Solved - Exporter created, but rule engine needs update

## Issue 2: Complex lambda functions with multiline strings cause SyntaxError

**Status**: Identified
**Test Failure**: Sphere 0 mismatch - "No More Cards Bonus" accessible when it shouldn't be
**Error Message**: `Locations accessible in STATE (and unchecked) but NOT in LOG: No More Cards Bonus`

**Description**:
The game does not have a custom exporter handler, so it's falling back to the GenericGameExportHandler. This causes location access rules to be exported as `null` instead of properly analyzing the Python lambda functions.

**Example**:
Location "No More Cards Bonus" in Python (worlds/yugioh06/rules.py:76-79):
```python
"No More Cards Bonus": lambda state: state.has_any(["Cyber Jar", "Morphing Jar",
                                                    "Morphing Jar #2", "Needle Worm"], player)
                                     and state.has_any(["The Shallow Grave", "Spear Cretin"],
                                                       player) and yugioh06_difficulty(state, player, 5),
```

But in rules.json, the access_rule is exported as:
```json
{
  "name": "No More Cards Bonus",
  "id": 5730026,
  "access_rule": null,
  ...
}
```

**Impact**:
- Locations with complex access requirements are accessible immediately (null = always accessible)
- Progression order doesn't match Python backend
- Tests fail at Sphere 0

**Required Action**:
- Create `exporter/games/yugioh06.py`
- Implement `Yugioh06GameExportHandler` class extending `BaseGameExportHandler`
- Set `GAME_NAME = 'Yu-Gi-Oh! 2006'`
- The generic exporter may be sufficient once created - test first before adding custom logic

