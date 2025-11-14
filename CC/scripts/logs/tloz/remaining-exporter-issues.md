# TLOZ Remaining Exporter Issues

Status: 1 issue remaining

## Issue 1: Boss Status location dependencies (IN PROGRESS)

**Priority:** High
**Type:** Exporter issue

**Problem:**
Boss Status event locations have `can_reach` dependencies with unresolved variable references. The current approach of simplifying can_reach to True causes Boss Status locations to be accessible too early.

**Example:**
- "Level 5 Boss" requires Recorder + Stepladder + other requirements
- "Level 5 Boss Status" should only be accessible when "Level 5 Boss" is accessible
- Current code removes the dependency, making "Level 5 Boss Status" accessible with just Stepladder

**Root Cause:**
Python code at `worlds/tloz/Rules.py:21`:
```python
add_rule(boss_event, lambda state, b=boss: state.can_reach(b, "Location", player))
```

The variable `b` is an unresolved reference to the boss location. The exporter needs to:
1. Resolve the variable `b` to the actual boss location name, OR
2. Copy the boss location's access rules to merge with the boss status location

**Current Status:**
Test progresses from Sphere 0.1 to Sphere 3.5 before failing. "Level 5 Boss Status" is accessible too early.

**Next Steps:**
- Option A: Implement location-to-location dependency copying in the exporter
- Option B: Add support for `can_reach` rule type in the frontend
- Option C: Detect Boss/Boss Status pattern specifically and handle it as a special case
