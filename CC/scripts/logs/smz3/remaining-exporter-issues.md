# Remaining Exporter Issues

## Issue 1: Test timeout at event 78/120 (performance issue)

**Symptom**: Test successfully processes events but times out around event 78, with worker ping timeout warnings

**Location**: Reachability calculation after Gravity Suit acquisition (event 79/sphere 8.16)

**Impact**: Full test cannot complete within 150-second timeout

**Root Cause**: Event 79 adds Gravity Suit, which opens 17 new Maridia locations simultaneously, causing a large spike in rule evaluations

**Status**: Likely requires performance optimization of rule evaluation

**Notes**:
- Test successfully processes 78 out of 120 events before timing out
- Event 79 opens: Maridia Inner, Maridia Outer regions + 17 locations
- Worker ping is timing out during the reachability recalculation
- No more "any_of iterator" errors (that issue is fixed)

**Potential Solutions**:
1. Optimize rule evaluation caching
2. Optimize helper function performance
3. Increase test timeout (temporary workaround)
4. Profile the rule evaluator to find bottlenecks

