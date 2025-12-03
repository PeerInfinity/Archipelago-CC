# Universal Tracker Comparison Test Results (Fixed Seed)

[<- Back to Test Results Summary](./test-results-summary.md)

**See also:** [Random Seed Results](./test-results-ut-comparison-random-seed.md) - Tests run with random seeds for variety

**Generated:** 2025-12-03 16:26:23

**Source Data Created:** 2025-12-03T16:26:23.330407

**Source Data Last Updated:** 2025-12-03T16:26:23.330415

**Seed Mode:** Fixed (seed=1)

## Summary

- **Total Games:** 1
- **Passed:** 1 (100.0%)
- **Failed:** 0 (0.0%)
- **Consistent Results:** 1 (100.0%)
- **With re_gen_passthrough:** 0 (0.0%)

## Test Results

Click on a game name to load the JSON frontend and run the UT comparison spoiler test, which will stop at the sphere with the first conflict.

| Game Name | Result | Consistent | Spheres | Mismatches (min) | Mismatches (max) | Last Good (min) | Last Good (max) | re_gen |
|-----------|:------:|:----------:|:-------:|:----------------:|:----------------:|:---------------:|:---------------:|:------:|
| [Adventure](https://peerinfinity.github.io/Archipelago-CC/?mode=test-spoilers-headed&game=adventure&ut=true) | ✅ | ✅ | 6.1 | 0 | 0 | 6.1 | 6.1 | ⚫ |

## Notes

- **Result:** ✅ if UT matches Python sphere log exactly in ALL runs, ❌ otherwise
- **Consistent:** ✅ if all test runs had the same mismatch count, ❌ if results varied
- **Spheres:** The last sphere index in the game (shows sphere numbering from logs)
- **Mismatches (min/max):** Lowest and highest number of mismatched spheres across all runs
- **Last Good (min/max):** Lowest and highest sphere index reached before first mismatch across all runs
- **re_gen:** ✅ if game implements `re_gen_passthrough` for UT support, ⚫ otherwise

Games with `re_gen_passthrough` support pass slot data to UT for accurate regeneration.
Games without this support may have significant mismatches due to randomization differences.
