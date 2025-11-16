# Remaining Exporter Issues

## Issue 1: Space Zone 2 - Boss - Incomplete rule export

**Location:** Space Zone 2 - Boss
**Status:** Not fixed
**Priority:** High
**Sphere:** 1.1

### Problem Description
The exporter is only capturing the first branch of the `space_zone_2_boss` logic function, missing the alternative conditions that make the location accessible.

### Python Logic (worlds/marioland2/logic.py:457-471)
```python
def space_zone_2_boss(state, player):
    if has_pipe_right(state, player):
        if state.has("Space Physics", player):
            return True
        if (state.has("Space Zone 2 Midway Bell", player)
                or not state.multiworld.worlds[player].options.shuffle_midway_bells):
            # Reaching the midway bell without space physics requires taking damage once.
            # Reaching the end pipe from the midway bell also requires taking damage once.
            if state.has_any(["Mushroom", "Fire Flower", "Carrot"], player):
                return True
        else:
            # With no midway bell, you'll have to be able to take damage twice.
            if state.has("Mushroom", player) and state.has_any(["Fire Flower", "Carrot"], player):
                return True
    return False
```

### Exported JSON (incomplete - missing branches)
```json
{
    "type": "conditional",
    "test": {"type": "helper", "name": "has_pipe_right", "args": []},
    "if_true": {
        "type": "conditional",
        "test": {"type": "item_check", "item": {"type": "constant", "value": "Space Physics"}},
        "if_true": {"type": "constant", "value": true},
        "if_false": null
    },
    "if_false": {"type": "constant", "value": false}
}
```

### Expected Behavior
The exporter should capture all three conditions:
1. has_pipe_right() AND has("Space Physics") -> accessible
2. has_pipe_right() AND (has("Space Zone 2 Midway Bell") OR shuffle_midway_bells==False) AND has_any(["Mushroom", "Fire Flower", "Carrot"]) -> accessible
3. has_pipe_right() AND (shuffle_midway_bells==True AND no midway bell) AND has("Mushroom") AND has_any(["Fire Flower", "Carrot"]) -> accessible

### Why It Matters
In sphere 1.1, the player has:
- Pipe Traversal (which gives has_pipe_right)
- Mushroom
- shuffle_midway_bells appears to be False (default setting)

According to the Python logic, condition 2 applies and the location should be accessible. But the exported JSON only checks for Space Physics (condition 1), so the frontend doesn't unlock it.

### Root Cause
The analyzer in `exporter/analyzer.py` is not properly handling complex multi-branch if-statements. It's likely stopping after the first `if...return True` and not continuing to analyze the subsequent conditions.

### Fix Approach
The exporter needs to be enhanced to:
1. Recognize that multiple if-branches with return statements represent alternative conditions
2. Combine these branches using an OR logic
3. Properly handle nested conditions within each branch
4. Handle `state.multiworld.worlds[player].options.*` references to export them as settings checks

This is likely a general exporter issue that could affect other locations with complex multi-branch logic.
