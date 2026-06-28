# Universal Tracker Fuzz Test Comparison: Original vs Hybrid

**Generated:** 2026-06-28 01:45:42 UTC

**Source Data Last Updated:** 2026-03-21T18:02:56

This report compares fuzz test results between the Original Universal Tracker (FarisTheAncient) and the Hybrid Universal Tracker (worldgen with native UT preference).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Original UT Results](./test-results-ut-fuzz-original.md)
- [Hybrid UT Results](./test-results-ut-fuzz-hybrid.md)

## Summary

- **Total Games Tested:** 2
- **Passing Both:** 0 (0.0%)
- **Passing Original Only:** 1 (50.0%)
- **Passing Hybrid Only:** 1 (50.0%)
- **Passing Neither:** 0 (0.0%)
- **Passing Hybrid with no custom code:** 1 (50.0%)
- **Passing Hybrid Only with no custom code:** 1 (50.0%)

## Full Comparison

| Game Name | Original Result | Hybrid Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| Adventure | ✅ | N/A | ✅ | ✅ | 25.8KB |
| DepGraph | N/A | ✅ | ✅ | ✅ | 410.5KB |

## Games Passing Original Only (1)

These games pass in the Original UT but fail in the Hybrid UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Adventure | ✅ | ✅ | 25.8KB |

## Games Passing Hybrid Only (1)

These games pass in the Hybrid UT but fail in the Original UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| DepGraph | ✅ | ✅ | 410.5KB |

## Notes

- **Original Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Hybrid Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
