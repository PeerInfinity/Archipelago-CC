# The Wind Waker - Remaining Exporter Issues

This file tracks issues with the exporter (`exporter/games/tww.py`) that need to be fixed.

## Issue 1: Helper Functions Being Inlined Instead of Preserved

### Symptoms
- Rules.json has 0 helper type references
- Access rules are extremely large (e.g., 763 lines for one location)
- Deeply nested "and" conditions (6+ levels)
- Access rule evaluation failures at sphere 15.2

### Root Cause
The TWW exporter doesn't implement `should_preserve_as_helper()` method, causing all helper functions from Macros.py to be recursively inlined instead of being preserved as callable helpers.

### Solution
Implement `should_preserve_as_helper()` method in TWWGameExportHandler to:
1. Return True for all functions from Macros.py (can_*, has_*, etc.)
2. This will create 'helper' type rules that JavaScript can call directly
3. Dramatically reduce rule size and complexity

### Status
Working on implementation...
