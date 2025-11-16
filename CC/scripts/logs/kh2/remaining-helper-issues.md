# Kingdom Hearts 2 - Remaining Helper Issues

## Current Test Status
- **Last Successful Sphere**: 8.9
- **Current Failure Point**: Sphere 8.10
- **Error**: Missing helper function `get_scar_rules`

## Remaining Issues

### 1. Missing `get_scar_rules` helper - Sphere 8.10
**Status**: To be implemented
**Priority**: High
**Location**: Should be in `frontend/modules/shared/gameLogic/kh2/kh2Logic.js`
**Python Source**: `worlds/kh2/Rules.py:get_scar_rules`

---

## Systematic Approach Needed

Since multiple helper functions are missing, a systematic approach is recommended:

1. Run the test to identify the next missing helper
2. Find the Python implementation in `worlds/kh2/Rules.py`
3. Implement the JavaScript equivalent in `kh2Logic.js`
4. Re-run the test to verify and find the next issue
5. Repeat until all tests pass

This iterative approach ensures each helper is implemented correctly before moving to the next one.

---

## Expected Pattern

Based on the Python code, there are likely many fight-specific helper functions that need to be implemented:
- `get_scar_rules`
- `get_groundshaker_rules`
- `get_data_*_rules` (for data battles)
- And potentially others

Each of these follows a similar pattern:
- Check fight logic setting (easy/normal/hard)
- Require different combinations of items/forms/abilities based on difficulty
- Use utility functions like `kh2_list_any_sum`, `kh2_dict_count`, etc.
