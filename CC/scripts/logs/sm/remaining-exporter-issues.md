# Remaining Exporter Issues - Super Metroid

## Status
Test run on seed 1 - FAILED at sphere 0

All locations are accessible from the start because all access rules are simplified to constant True.

## Critical Issue: Over-Simplification of evalSMBool Calls

### Problem
The exporter (exporter/games/sm.py) is overly aggressive in simplifying all `evalSMBool` calls to constant True. This destroys all meaningful logic in the exported rules.json file.

**Location in code:** `exporter/games/sm.py:65-79` (_try_simplify_evalSMBool method)

**Current behavior:**
```python
def _try_simplify_evalSMBool(self, args: list) -> Optional[Dict[str, Any]]:
    # Simplify ALL evalSMBool calls to True
    # The sphere log will enforce the correct progression
    logger.debug("SM: Simplifying evalSMBool call to constant True")
    return {'type': 'constant', 'value': True}
```

**Result:** All location and exit access rules become `{"type": "constant", "value": true}`

### Impact
- **Sphere 0**: All 107 locations are accessible from the start (should be only 2)
- **Spoiler test**: Fails immediately because state doesn't match sphere log
- **Frontend logic**: Completely bypassed - no meaningful progression

### Root Cause
Super Metroid uses the VARIA randomizer's SMBoolManager system, which is a complex Python-based logic evaluator that can't be easily replicated in JavaScript. The exporter developer chose to simplify all logic to True and rely on the sphere log for correct progression.

However, this approach is incompatible with the spoiler test, which verifies that the JavaScript frontend can correctly evaluate the same logic as the Python backend.

### Example
Location: "Bomb" (should require Morph Ball)
- **Expected**: Should be accessible only after collecting Morph Ball (sphere 0.2)
- **Actual**: Accessible immediately (sphere 0) because access_rule is constant True

### Possible Solutions

#### Option 1: Don't simplify evalSMBool (Recommended)
Instead of simplifying to constant True, preserve the actual rule structure and let the frontend evaluate it.

**Changes needed:**
1. Remove or modify `_try_simplify_evalSMBool` to NOT return constant True
2. Export the actual VARIA logic function calls as helpers
3. Implement basic SMBool evaluation in JavaScript (smLogic.js)

**Pros:**
- Allows spoiler test to work correctly
- Provides actual progression logic to frontend
- Follows the pattern of other games

**Cons:**
- Requires understanding and exporting VARIA logic
- May need JavaScript implementation of SMBoolManager basics

#### Option 2: Export minimal logic
Export item checks without the VARIA SMBool wrapper.

For example, if a location requires Morph Ball:
- Instead of: `evalSMBool(func(...), maxDiff)` → constant True
- Export: `{"type": "item_check", "item": "Morph Ball"}`

**Pros:**
- Simpler than full VARIA logic
- May be sufficient for many locations

**Cons:**
- Loses difficulty-based logic
- May not work for complex location requirements

#### Option 3: Skip Super Metroid in spoiler tests
Add Super Metroid to a skip list for spoiler tests.

**Pros:**
- Quick fix
- Acknowledges that VARIA logic is too complex

**Cons:**
- No verification that frontend logic works
- Doesn't solve the underlying problem

### Recommended Action
Start with Option 1: Modify the exporter to preserve actual logic and see what rules are generated. Then implement the necessary JavaScript helpers to evaluate those rules.

### Progress Update

#### Completed
✅ Modified exporter to NOT simplify evalSMBool calls (exporter/games/sm.py:65-76, 131-138, 148-153)
✅ Regenerated rules.json with actual VARIA logic structure
✅ Analyzed the exported rule structure

#### Findings

The exported rules now preserve the VARIA logic structure. Example for "Bomb" location:
```json
{
  "type": "helper",
  "name": "evalSMBool",
  "args": [
    {
      "type": "function_call",
      "function": {
        "type": "attribute",
        "object": {"type": "name", "name": "sm"},
        "attr": "wor"
      },
      "args": [
        {"type": "function_call", "function": {...}, "args": []},  // sm.knowsAlcatrazEscape()
        {"type": "function_call", "function": {...}, "args": []}   // sm.canPassBombPassages()
      ]
    },
    {"type": "attribute", "object": {...}, "attr": "maxDiff"}
  ]
}
```

**Key observations:**
1. VARIA logic operators are preserved: `sm.wor`, `sm.wand`, `SMBool`
2. VARIA technique checks are preserved: `sm.knowsAlcatrazEscape()`, `sm.canPassBombPassages()`, etc.
3. Difficulty checks are preserved: `state.smbm[1].maxDiff`

#### New Challenge: VARIA Technique Evaluation

The exported rules reference VARIA technique functions like:
- `sm.knowsAlcatrazEscape()` - Checks if player knows the Alcatraz Escape technique
- `sm.canPassBombPassages()` - Checks if player can pass bomb passages
- `sm.canFly()` - Checks if player can fly
- etc.

These functions check the player's configured technique knowledge, which is set during world generation but NOT exported to rules.json.

**Problem:** We can't evaluate these in JavaScript without:
1. Exporting the player's technique knowledge configuration
2. Implementing all VARIA technique checks in JavaScript
3. Understanding the complex dependencies between techniques

### Next Steps

#### Option A: Export Pre-Evaluated VARIA Logic (Recommended)
Evaluate VARIA function calls during export and replace them with their results.

For example:
- `sm.knowsAlcatrazEscape()` → `{"type": "helper", "name": "SMBool", "args": [{"type": "constant", "value": true}, {"type": "constant", "value": 15}]}`
- This requires accessing the logic evaluation context during export

**Pros:**
- No need to implement VARIA logic in JavaScript
- Frontend just needs to handle SMBool operations (wor, wand, evalSMBool)
- Much simpler than full VARIA implementation

**Cons:**
- Requires modifying the exporter to evaluate logic during export
- Need access to the Logic/SMBoolManager instance

#### Option B: Implement Minimal VARIA Logic
Implement stub VARIA functions that return conservative estimates.

**Pros:**
- Might be enough for basic progression
- Can be incrementally improved

**Cons:**
- Will never be fully accurate without technique knowledge
- Still requires significant JavaScript implementation

#### Option C: Skip Super Metroid in Spoiler Tests
Accept that VARIA logic is too complex for frontend replication.

**Pros:**
- Simple solution
- Acknowledges the complexity

**Cons:**
- No verification of frontend logic
- Doesn't help users who want to use the tracker

### Recommended Action
Pursue Option A: Modify the exporter to pre-evaluate VARIA logic function calls and export their SMBool results.

## Additional Context
- Super Metroid world implementation: worlds/sm/__init__.py
- VARIA randomizer: worlds/sm/variaRandomizer/
- Current JavaScript helpers: frontend/modules/shared/gameLogic/sm/smLogic.js
- Test output: spoiler_test_output.txt
