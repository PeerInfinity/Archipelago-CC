# Solved General Issues - MegaMan Battle Network 3

## Completed Fixes

### 1. Added rule engine support for self.method() function calls
- Modified frontend/modules/shared/ruleEngine.js
- Added handler for function_call rules where function is an attribute of 'self'
- Pattern: self.method_name() is now treated as helper function call
- Allows Python world methods to be called as helpers in JavaScript
- Specifically enables self.explore_score() to work correctly
