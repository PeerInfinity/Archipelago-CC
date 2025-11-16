# Factorio - Solved General Issues

This file tracks solved general issues that are not exporter or helper specific.

## Solved Issues

### 1. Rule Engine: Missing f_string support (SOLVED)

**Status:** Solved
**Priority:** High
**Type:** Rule Engine
**Solution:** Added f_string case to evaluateRule function in frontend/modules/shared/ruleEngine.js

**Implementation:**
- Added new case 'f_string' that evaluates each part of the f-string
- Handles constant parts and formatted_value parts
- Concatenates the evaluated parts into a final string

**File:** frontend/modules/shared/ruleEngine.js:1265-1299

### 2. Rule Engine: all_of iterator variable binding (SOLVED)

**Status:** Solved
**Priority:** High
**Type:** Rule Engine
**Solution:** Created createBoundContext helper and updated all_of/any_of implementations

**Implementation:**
- Created createBoundContext function that creates a new context with bound iterator variables
- Updated all_of and any_of to call createBoundContext for each iteration
- The bound context intercepts resolveName calls to return the bound value for the iterator variable

**Files:**
- frontend/modules/shared/ruleEngine.js:306-330 (createBoundContext)
- frontend/modules/shared/ruleEngine.js:1485 (all_of fix)
- frontend/modules/shared/ruleEngine.js:1572 (any_of fix)

### 3. State Interface: Missing game_info in staticData (SOLVED)

**Status:** Solved
**Priority:** High
**Type:** State Management
**Solution:** Added game_info to the object returned by getStaticData()

**Implementation:**
- Modified stateInterface.js getStaticData method to include game_info field
- This allows the resolveName function to access game_info.variables for variable resolution

**File:** frontend/modules/shared/stateInterface.js:507
