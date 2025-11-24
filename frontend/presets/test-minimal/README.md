# Minimal can_reach Bug Reproduction

This directory contains the simplest possible test case to reproduce the `can_reach` region reachability bug.

## The Bug

When a location has an access rule that checks `can_reach("Act Region", "Region")`:
- **Backend (Python)**: Correctly identifies "Act Region" as reachable from start
- **Frontend (JavaScript)**: `can_reach` returns `false` or `undefined` even though the region should be reachable

## Test Setup

### Files
1. **minimal_rules.json**: Minimal rules with 3 regions
   - `Menu` (start region)
   - `Hub` (reachable from Menu via constant true exit)
   - `Act Region` (reachable from Hub via constant true exit)
   - Location "Hub - Location With Can Reach Rule" that requires `can_reach("Act Region", "Region")`

2. **minimal_spheres_log.jsonl**: Expected behavior
   - Sphere 0: All 3 regions (Menu, Hub, Act Region) are accessible
   - Sphere 0.1: Location should be checkable

3. **test_minimal.html**: Browser-based test
   - Open http://localhost:8000/frontend/presets/test-minimal/test_minimal.html
   - Shows region reachability and can_reach results

## Expected Behavior

Since:
1. Menu → Hub (constant true)
2. Hub → Act Region (constant true)  
3. Start region is Menu

Then "Act Region" should be reachable from the start, and `can_reach("Act Region", "Region")` should return `true`.

## Actual Behavior

`can_reach("Act Region", "Region")` returns `false` or `undefined`, causing the location check to fail.

## Root Cause Hypothesis

The `computeReachableRegions` BFS traversal in `frontend/modules/stateManager/core/reachabilityEngine.js` may not be:
1. Following exits with constant true rules correctly
2. Adding connected regions to the reachable set properly
3. Handling the transition from Menu → Hub → Act Region correctly

## How to Use

1. Start the HTTP server: `python -m http.server 8000`
2. Open `http://localhost:8000/frontend/presets/test-minimal/test_minimal.html`
3. Check console output for:
   - Region reachability status
   - `can_reach` return values
   - Bug reproduction confirmation
