# Spoiler Fuzz Test Results (APWorlds)

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

**Generated:** 2026-01-24 22:47:25

**Source Data Created:** 2026-01-24T22:47:25.242777

**Source Data Last Updated:** 2026-01-24T22:47:25.242783

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 1

**Generation Timeout:** 300s

**Test Timeout:** 120s

## Summary

- **Total Games:** 1
- **Games with 100% Pass Rate:** 1 (100.0%)
- **Games with Failures:** 0 (0.0%)
- **Total Fuzz Runs:** 1
- **Successful Runs:** 1 (100.0%)
- **Generation Failures:** 0
- **Test Failures:** 0
- **Timed Out Runs:** 0

## Test Results

| Game Name | Result | Total | Success | Gen Fail | Test Fail | Timeout | Success Rate | Rules Size |
|-----------|:------:|:-----:|:-------:|:--------:|:---------:|:-------:|:------------:|:----------:|
| Clique | ✅ | 1 | 1 | 0 | 0 | 0 | **100.0%** | N/A |

## Notes

- **Result:** ✅ if all fuzz runs passed (0 failures, 0 timeouts), ❌ otherwise
- **Total:** Number of fuzz runs attempted for this game
- **Success:** Number of runs where spoiler test completed successfully
- **Gen Fail:** Number of runs where seed generation failed
- **Test Fail:** Number of runs where spoiler test failed
- **Timeout:** Number of runs that exceeded the time limit
- **Success Rate:** Percentage of successful runs
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)

### About This Test

The spoiler fuzz test validates game configurations by:
1. Generating random game configurations (YAML options) using the fuzzer
2. Creating an Archipelago seed with those options
3. Exporting the seed to JSON rules
4. Running the frontend spoiler playthrough test

Failures indicate that certain option combinations cause issues with either seed generation or the frontend spoiler test playthrough.
