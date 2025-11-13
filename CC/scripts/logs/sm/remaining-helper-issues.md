# Super Metroid - Remaining Helper Issues

Test failures at Sphere 0. Locations not accessible: "Energy Tank, Brinstar Ceiling", "Morphing Ball"

## Root Cause
Super Metroid uses a custom SMBoolManager system. The rules have complex structures that the frontend doesn't understand:

1. **Missing helper function `any`**: Python's built-in `any()` is used in rules
2. **Unknown name `self`**: Rules reference `self.evalSMBool()`
3. **Generator expressions**: Rules use Python generator expressions with `accessFrom.items()`
4. **Helper functions**: Rules call helpers like `func` and `rule` that operate on `state.smbm[player]`

## Key Rule Pattern
```json
{
  "type": "and",
  "conditions": [
    {
      "type": "helper",
      "name": "any",
      "args": [generator_expression]
    },
    {
      "type": "function_call",
      "function": {"type": "attribute", "object": {"type": "name", "name": "self"}, "attr": "evalSMBool"},
      "args": [helper_func, maxDiff]
    }
  ]
}
```

## Next Steps
1. Create `frontend/modules/shared/gameLogic/sm/` directory
2. Create helper functions to handle:
   - `any()` - Python's any() builtin
   - `self.evalSMBool()` - Evaluates SMBool objects
   - Generator expressions over `accessFrom`
   - SMBoolManager integration

## Challenge
Super Metroid's logic system is fundamentally different from other games. It uses SMBool objects that have both a boolean value AND a difficulty rating. The frontend may need special handling for this game's unique logic system.
