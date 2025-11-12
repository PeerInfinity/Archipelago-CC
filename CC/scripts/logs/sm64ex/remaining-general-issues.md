# SM64EX Remaining General Issues

## Issue 1: Preset folder name mismatch

**Status:** Resolved (workaround)
**Priority:** Low

### Problem
The exporter creates files in `frontend/presets/super_mario_64/` but tests expect them in `frontend/presets/sm64ex/`.

### Root Cause
The `get_world_directory_name()` function in `exporter/exporter.py` looks for pattern:
```python
pattern = r'game:\s*ClassVar\[str\]\s*=\s*"([^"]*)"'
```

But SM64 uses:
```python
game: str = "Super Mario 64"
```

So the pattern doesn't match and it falls back to converting the game name to snake_case: "super_mario_64".

### Workaround Applied
- Copied `frontend/presets/super_mario_64/` to `frontend/presets/sm64ex/`
- Updated `frontend/presets/preset_files.json` to include sm64ex entry

### Proper Solution
Update the regex pattern in `exporter/exporter.py:get_world_directory_name()` to match both:
- `game: ClassVar[str] = "..."`
- `game: str = "..."`

## Issue 2: Generation errors with unary operators

**Status:** Needs investigation
**Priority:** Medium

### Problem
Generation output shows:
```
Unhandled unary operator: usub
Error visiting value or index in subscript: Subscript(value=Name(id='expression', ctx=Load()), slice=Slice(lower=Constant(value=1), upper=UnaryOp(op=USub(), operand=Constant(value=1))), ctx=Load())
Failed to analyze argument 0 in call: ...
```

This appears twice in the generation output.

### Root Cause
The analyzer doesn't handle negative slicing like `expression[1:-1]` (which uses unary subtraction operator USub).

### Impact
Unknown - need to investigate what code is using this pattern and whether it affects exported rules.

## Issue 3: Sphere 0.3 mismatch - "BoB: Mario Wings to the Sky"

**Status:** Active
**Priority:** Medium
**Sphere Failure:** 0.3

### Problem
Location "BoB: Mario Wings to the Sky" is accessible in STATE but not in LOG at sphere 0.3.

### Evidence
Test error: "Locations accessible in STATE (and unchecked) but NOT in LOG: BoB: Mario Wings to the Sky"

### Progress
- Initial test failed at sphere 0.1 due to missing helper functions
- After adding helpers and fixing move randomizer logic, test now fails at sphere 0.3
- **This represents major progress through 3 spheres!**

### Analysis Needed
- Check the rule for this location
- Verify what items/regions are available in sphere 0.3
- Determine why Python logic considers it inaccessible while frontend considers it accessible

This is the NEXT issue to investigate.
