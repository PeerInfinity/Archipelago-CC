# Super Metroid - Remaining Helper Issues

Test failures at Sphere 0. Locations not accessible: "Energy Tank, Brinstar Ceiling", "Morphing Ball"

## Root Cause
Super Metroid uses a custom SMBoolManager system. The rules have complex structures that the frontend doesn't understand.

## Progress
1. ✅ Created `frontend/modules/shared/gameLogic/super_metroid/smLogic.js` with stub implementations
2. ✅ Registered Super Metroid in `gameLogicRegistry.js`
3. ✅ Helper functions (any, func, rule, evalSMBool) are now being found

## Current Issue: "Name 'self' NOT FOUND in context"

The test still fails because the rules reference `self.evalSMBool()` as a function call:
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {"type": "name", "name": "self"},
    "attr": "evalSMBool"
  },
  "args": [...]
}
```

The `self` refers to the Python SMWorld object, which doesn't exist in JavaScript. The rule engine is trying to resolve `self` as a name in the evaluation context but can't find it.

## Possible Solutions

### Option 1: Modify the Exporter (Recommended)
Transform `self.evalSMBool(...)` calls into direct helper calls:
- From: `{"type": "function_call", "function": {"type": "attribute", "object": {"type": "name", "name": "self"}, "attr": "evalSMBool"}, ...}`
- To: `{"type": "helper", "name": "evalSMBool", ...}`

This would require modifying `exporter/games/sm.py` to recognize and transform these patterns.

### Option 2: Modify the Rule Engine
Add special handling in the rule engine to recognize `self.method` patterns and redirect to helpers. This would be a global change affecting all games.

### Option 3: Synthetic `self` Object
Provide a `self` object in the evaluation context with methods like `evalSMBool`. This might conflict with other uses of names in rules.

## Next Step
Implement Option 1 - modify the exporter to transform these rule patterns.
