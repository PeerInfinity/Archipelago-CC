# Super Mario Land 2 - Solved Helper Issues

## Issue 1: Turtle Zone 2 helpers missing Water Physics requirement

**Status**: FIXED
**Fixed in**: frontend/modules/shared/gameLogic/marioland2/helpers.js

### Problem
The Turtle Zone 2 helper functions were missing the Water Physics requirement, causing locations to be accessible too early (sphere 3.1 instead of sphere 7.2).

### Python Logic
```python
def turtle_zone_2_normal_exit(state, player):
    return (has_pipe_up and has_pipe_down and has_pipe_right and
            has_pipe_left and state.has("Water Physics", player) and
            not is_auto_scroll(state, player, "Turtle Zone 2"))

def turtle_zone_2_midway_bell(state, player):
    return ((state.has("Water Physics", player) and
             not is_auto_scroll(state, player, "Turtle Zone 2")) or
            state.has("Turtle Zone 2 Midway Bell", player))
```

### Fix
Updated helpers to match Python logic, adding Water Physics checks.

## Issue 2: Macro Zone 2 helpers missing Water Physics requirement

**Status**: FIXED
**Fixed in**: frontend/modules/shared/gameLogic/marioland2/helpers.js

### Problem
The Macro Zone 2 helper functions were missing the Water Physics requirement and had incorrect pipe checks, causing locations to be accessible too early (sphere 5.3 instead of sphere 7.2).

### Python Logic
```python
def macro_zone_2_normal_exit(state, player):
    return ((has_pipe_down or state.has("Macro Zone 2 Midway Bell", player)) and
            state.has("Water Physics", player) and has_pipe_up and
            not is_auto_scroll(state, player, "Macro Zone 2"))

def macro_zone_2_midway_bell(state, player):
    return ((has_pipe_down and state.has("Water Physics", player)) or
            state.has("Macro Zone 2 Midway Bell", player))
```

### Fix
Updated helpers to match Python logic, adding Water Physics and pipe checks.
