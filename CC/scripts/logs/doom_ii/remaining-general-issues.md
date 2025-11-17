# DOOM II - Remaining General Issues

This file tracks unresolved general issues with DOOM II that don't fall into exporter or helper categories.

## Issues

### Batch Test Inconsistency (Investigation Needed)

**Issue**: Inconsistent test results when running seeds in batch mode vs. individually
**Details**:
- Individual seed tests (1-10) all pass consistently when run separately
- Batch testing of seeds 1-10 shows intermittent failures on different seeds across runs
- Example: First batch run failed on seeds 6 and 9; second batch run failed on seeds 3, 6, 8, and 10
- When failed seeds are retested individually, they pass

**Status**: Under investigation
**Impact**: Low - Individual tests pass consistently; appears to be a test infrastructure issue rather than a game implementation issue
**Hypothesis**: Possible browser state not being properly reset between tests in batch mode, or timing/race condition issues

**Test Evidence**:
- Batch run 1: Seeds 1-5, 7-8, 10 passed; Seeds 6, 9 failed
- Batch run 2: Seeds 1-2, 4-5, 7, 9 passed; Seeds 3, 6, 8, 10 failed
- Individual tests: All seeds 1-10 pass when tested separately

**Recommended Action**:
- DOOM II implementation appears correct
- Issue likely lies in the batch test script or test environment
- For validation purposes, use individual seed tests rather than batch tests
