# Remaining Exporter Issues for Zillion

This document tracks unresolved issues in the Zillion exporter (exporter/games/zillion.py).

## Issues

### Issue 2: req object doesn't contain complete access logic
- **Status**: In Progress
- **Description**: The Zillion location req object (from zilliandomizer) doesn't contain the complete access logic. Two locations ("H-8 top right-center" and "L-2 mid far right") have gun=0, jump=0 in their req object but are NOT accessible from the start according to the Python world's access rules. The Python world uses zilliandomizer's `get_locations()` method which has internal logic beyond what's in the req object.
- **Impact**: 2 locations incorrectly marked as always accessible
- **Locations affected**: H-8 top right-center, L-2 mid far right
- **Root cause**: The Python world's access_rule (worlds/zillion/__init__.py:212-222) calls zilliandomizer's internal logic, not just the req object
- **Possible fixes**:
  1. Call zilliandomizer's get_locations() with different item combinations to reverse-engineer requirements
  2. Access zilliandomizer's internal data structures
  3. Use the generic exporter's approach of calling the world's access_rule function
  4. Check if there are other zilliandomizer data structures that contain the full access logic
