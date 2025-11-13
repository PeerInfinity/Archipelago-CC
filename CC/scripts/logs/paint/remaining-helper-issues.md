# Paint - Remaining Helper Issues

## Issue 1: paint_percent_available helper needs JavaScript implementation

**Status:** Not Started
**Priority:** High

### Description
The Paint game uses a custom helper function `paint_percent_available` that calculates what percentage of the target image can be painted with the current items.

### Python Implementation
Location: `worlds/paint/rules.py:7-34`

The function:
1. Checks if calculation is stale
2. Calls `calculate_paint_percent_available` if needed
3. Caches the result

The calculation considers:
- Pick Color item (boolean)
- Progressive Color Depth (Red) count (max 7)
- Progressive Color Depth (Green) count (max 7)
- Progressive Color Depth (Blue) count (max 7)
- Progressive Canvas Width count
- Progressive Canvas Height count
- World options: canvas_size_increment, logic_percent

### Formula
```
((1 - ((sqrt(((2^(7-r) - 1)^2 + (2^(7-g) - 1)^2 + (2^(7-b) - 1)^2) * 12)) / 765)) *
 min(400 + w * canvas_size_increment, 800) *
 min(300 + h * canvas_size_increment, 600) *
 logic_percent / 480000)
```

Where:
- r, g, b = color depth counts (capped at 2 if Pick Color is not collected)
- w, h = canvas width/height counts
- canvas_size_increment = world option (default varies)
- logic_percent = world option (default 60)

### Required Implementation
Create `frontend/modules/shared/gameLogic/paint/helpers.js` with:
- `paint_percent_available(state, context)` function
- Access to world options from context
- Proper item counting and math calculations

---
