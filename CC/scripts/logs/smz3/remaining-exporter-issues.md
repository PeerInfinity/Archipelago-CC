# Remaining Exporter Issues

## Issue 1: Test timeout at event 78/120 (performance issue)

**Symptom**: Test successfully processes events but times out around event 78, with worker ping timeout warnings

**Location**: Unknown - possibly complex rules or helper functions causing slow evaluation

**Impact**: Full test cannot complete within 150-second timeout

**Status**: Needs investigation - identify which rules/helpers are slow

**Notes**:
- Test successfully processes 78 out of 120 events before timing out
- Worker ping is timing out, suggesting long-running rule evaluation
- No more "any_of iterator" errors (that issue is fixed)

