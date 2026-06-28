# Universal Tracker Fuzz Test Comparison: Original vs Worldgen

**Generated:** 2026-06-28 01:45:42 UTC

**Source Data Last Updated:** 2026-06-26T17:57:11

This report compares fuzz test results between the Original Universal Tracker (FarisTheAncient) and the Worldgen Universal Tracker (regenerates world from rules.json).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Original UT Results](./test-results-ut-fuzz-original.md)
- [Worldgen UT Results](./test-results-ut-fuzz-worldgen.md)

## Summary

- **Total Games Tested:** 1
- **Passing Both:** 1 (100.0%)
- **Passing Original Only:** 0 (0.0%)
- **Passing Worldgen Only:** 0 (0.0%)
- **Passing Neither:** 0 (0.0%)
- **Passing Worldgen with no custom code:** 1 (100.0%)
- **Passing Worldgen Only with no custom code:** 0 (0.0%)

## Full Comparison

| Game Name | Original Result | Worldgen Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| Adventure | ✅ | ✅ | ✅ | ✅ | 25.8KB |

## Games Passing Both (1)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Adventure | ✅ | ✅ | 25.8KB |

## Notes

- **Original Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
