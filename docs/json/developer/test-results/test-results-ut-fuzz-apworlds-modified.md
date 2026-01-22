# Universal Tracker Fuzz Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[View Comparison (Original vs Modified)](./test-results-ut-fuzz-apworlds-comparison.md)

**Generated:** 2026-01-22 02:42:11

**Source Data Created:** 2026-01-22T02:42:11.262729

**Source Data Last Updated:** 2026-01-22T02:42:11.262734

**Universal Tracker Version:** Modified (this repository)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 1

**Parallel Jobs:** 2

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 1
- **Games with 100% Pass Rate:** 1 (100.0%)
- **Games with Failures:** 0 (0.0%)
- **Total Fuzz Runs:** 1
- **Successful Runs:** 1 (100.0%)
- **Failed Runs:** 0
- **Timed Out Runs:** 0
- **Ignored Runs:** 0

### Explain Support Summary

- **Games with Explain Stats:** 1
- **Games with 100% Explain Coverage:** 1
- **Games with No Explain Support:** 0
- **Locations with Explain Support:** 0
- **Locations without Explain Support:** 0
- **Locations with Default Rule:** 1
- **Overall Explain Coverage:** 100.0%

### Generic Exporter/Logic Statistics

Of the 1 games with 100% pass rate:

- **Passing with Generic Exporter:** 1/1 (100.0%)
- **Passing with Generic Logic:** 1/1 (100.0%)
- **Passing with Both Generic:** 1/1 (100.0%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 0.0KB
- **Total Game Logic Code:** 0.0KB
- **Combined Total:** 0.0KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| Clique | ✅ | 1 | 1 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| Clique | 1 | 0 | 0 | 1 | ✅ 100% |

## Notes

- **Result:** ✅ if all fuzz runs passed (0 failures, 0 timeouts), ❌ otherwise
- **Total:** Number of fuzz runs attempted for this game
- **Success:** Number of runs where UT matched Python sphere log
- **Failure:** Number of runs where UT mismatched or encountered errors
- **Timeout:** Number of runs that exceeded the time limit
- **Ignored:** Number of runs skipped due to option errors
- **Success Rate:** Percentage of successful runs
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)

### Explain Support Columns

- **Total Locs:** Total number of locations with addresses (excludes events)
- **With Explain:** Locations with rules that have `explain_json()` support
- **Without Explain:** Locations with custom rules but no explain support (lambdas/functions)
- **Default Rule:** Locations with no access rule set (always accessible)
- **Coverage:** Percentage of custom-rule locations that have explain support

### About This Test

The UT fuzzer tests Universal Tracker compatibility by:
1. Generating random game configurations (YAML options)
2. Creating an Archipelago seed with those options
3. Exporting the seed to JSON rules
4. Regenerating the world using the world generator
5. Comparing UT's accessibility calculations to the Python sphere log

Failures indicate that for certain option combinations, UT's logic differs from Python's logic. This helps identify edge cases that need fixing.
