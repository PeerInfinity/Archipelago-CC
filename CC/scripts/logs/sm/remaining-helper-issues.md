# Remaining Helper Issues - Super Metroid

## Status
Cannot fully evaluate until exporter issues are resolved.

Current helpers are stubs that always return True, which is contributing to the test failure.

## Issue 1: evalSMBool Always Returns True

### Problem
The `evalSMBool` helper in smLogic.js always returns True, regardless of the actual SMBool value or difficulty.

**Location:** frontend/modules/shared/gameLogic/sm/smLogic.js:84-88

**Current implementation:**
```javascript
export function evalSMBool(snapshot, staticData, smbool, maxDiff) {
  // The Python backend has already evaluated this with the SMBoolManager
  // We trust the sphere log to tell us what's actually accessible
  return true;
}
```

### Impact
Even if the exporter starts exporting proper evalSMBool calls, the JavaScript implementation will still evaluate them all as True.

### What's Needed
A proper implementation that:
1. Evaluates the SMBool object
2. Checks the difficulty against maxDiff
3. Returns the appropriate boolean value

However, this depends on what structure the exporter provides for SMBool objects.

## Issue 2: func and rule Helpers Return Placeholders

### Problem
The `func` and `rule` helpers return placeholder SMBool objects without actually evaluating anything.

**Location:** frontend/modules/shared/gameLogic/sm/smLogic.js:102-119

**Current implementation:**
```javascript
export function func(snapshot, staticData, smbm) {
  // Return a placeholder that evalSMBool will process
  return { bool: true, difficulty: 0 };
}

export function rule(snapshot, staticData, smbm) {
  // Return a placeholder that evalSMBool will process
  return { bool: true, difficulty: 0 };
}
```

### Impact
These helpers are meant to interface with VARIA logic functions, but they don't actually do anything.

### What's Needed
Understanding of:
1. What `func` and `rule` actually represent in VARIA logic
2. How to evaluate them in JavaScript
3. Whether the exporter even exports these in a way that can be evaluated

## Issue 3: any() Helper May Need Enhancement

### Problem
The current `any()` implementation is basic and assumes it receives an array of booleans.

**Current implementation:**
```javascript
export function any(snapshot, staticData, iterable) {
  if (!Array.isArray(iterable)) return false;
  return iterable.some(x => x);
}
```

### Potential Issue
If `any()` is used with SMBool objects (which have `bool` and `difficulty` fields), the current implementation won't handle them correctly.

### What's Needed
- Verify what types of values `any()` receives
- Handle SMBool objects if necessary
- Properly evaluate difficulty checks

## Dependencies

These helper issues are blocked by the exporter issues:
1. We need to see what the exporter actually exports when it doesn't simplify to constant True
2. Then we can implement the helpers to correctly evaluate those exported rules

## Recommended Approach

### Step 1: Wait for exporter fix
Don't modify helpers until we see what the exporter produces.

### Step 2: Analyze exported rules
Look at the structure of evalSMBool calls, func calls, and rule calls in the exported rules.json.

### Step 3: Implement helpers incrementally
Start with the simplest cases and work up to more complex VARIA logic.

### Step 4: Test iteratively
Run spoiler tests after each helper implementation to verify progress.

## Questions to Answer

1. **What is an SMBool object?**
   - Structure: `{bool: boolean, difficulty: number}`
   - How to evaluate it?

2. **What do func and rule represent?**
   - Are they VARIA logic function references?
   - Can they be evaluated in JavaScript?
   - Or should the exporter resolve them to item checks?

3. **What is smbm (SMBoolManager)?**
   - Is it per-player state?
   - What does it contain?
   - How should it be represented in JavaScript?

4. **What is maxDiff?**
   - Maximum difficulty setting for the player?
   - Should it be in player settings?
   - How should it be checked?

## Additional Context
- VARIA randomizer SMBoolManager: worlds/sm/variaRandomizer/logic/smboolmanager.py
- Super Metroid world logic: worlds/sm/__init__.py
- Current helper implementations: frontend/modules/shared/gameLogic/sm/smLogic.js
