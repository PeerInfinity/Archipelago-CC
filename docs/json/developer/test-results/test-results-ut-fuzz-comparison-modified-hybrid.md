# Universal Tracker Fuzz Test Comparison: Modified vs Hybrid

**Generated:** 2026-02-04 11:49:58

**Source Data Last Updated:** 2026-02-04T11:13:08

This report compares fuzz test results between the Modified Universal Tracker (worldgen-based tracking) and the Hybrid Universal Tracker (modified with native UT preference).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Modified UT Results](./test-results-ut-fuzz-modified.md)
- [Hybrid UT Results](./test-results-ut-fuzz-hybrid.md)

## Summary

- **Total Games Tested:** 1
- **Passing Both:** 1 (100.0%)
- **Passing Modified Only:** 0 (0.0%)
- **Passing Hybrid Only:** 0 (0.0%)
- **Passing Neither:** 0 (0.0%)
- **Passing Hybrid with no custom code:** 1 (100.0%)
- **Passing Hybrid Only with no custom code:** 0 (0.0%)

## Full Comparison

| Game Name | Modified Success Rate | Hybrid Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 26.0KB |

## Games Passing Both (1)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Adventure | ✅ | ✅ | 26.0KB |

## Notes

- **Modified Success Rate:** Percentage of fuzz runs that passed in the Modified Universal Tracker
- **Hybrid Success Rate:** Percentage of fuzz runs that passed in the Hybrid Universal Tracker
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
