# Universal Tracker Fuzz Test Results

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Worldgen)](./test-results-ut-fuzz-comparison-original-worldgen.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-comparison-original-pickle.md) | [View Comparison (Worldgen vs Hybrid)](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | [View Comparison (Worldgen vs Pickle)](./test-results-ut-fuzz-comparison-worldgen-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-04 14:05:32

**Source Data Created:** 2026-02-04T11:13:18.238830

**Source Data Last Updated:** 2026-02-04T11:13:21.869890

**Universal Tracker Version:** Worldgen (regenerates world from rules.json)

**Seed Mode:** Random

**Runs Per Game:** 1

**Parallel Jobs:** 8

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

### Expected vs Unexpected Results

- **Expected Passes:** 1 (not excluded, passed)
- **Unexpected Passes:** 0 (excluded, but passed)
- **Expected Failures:** 0 (excluded, failed as expected)
- **Unexpected Failures (logic):** 0 (not excluded, logic mismatch)
- **Unexpected Failures (timeout only):** 0 (not excluded, only timeouts)

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
| Adventure | ✅ | 1 | 1 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 26.0KB |

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

### About This Test

The UT fuzzer tests Universal Tracker compatibility by:
1. Generating random game configurations (YAML options)
2. Creating an Archipelago seed with those options
3. Exporting the seed to JSON rules
4. Regenerating the world using the world generator
5. Comparing UT's accessibility calculations to the Python sphere log

Failures indicate that for certain option combinations, UT's logic differs from Python's logic. This helps identify edge cases that need fixing.

## Excluded Templates

These templates are excluded from testing:

| Template | Reason |
|----------|--------|
| APWorld Manager.yaml | Not a game. |
| Archipelago.yaml | Not a game. |
| Blasphemous.yaml | The spoiler test currently freezes. |
| Bomb Rush Cyberfunk.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Celeste (Open World).yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Final Fantasy.yaml | Requires manual configuration and is not compatible with the spoiler test. |
| Hollow Knight.yaml | The spoiler test currently freezes. |
| JSON Tools Installer.yaml | Not a game. |
| Jak and Daxter The Precursor Legacy.yaml | Temporarily excluded. It takes too long to process. 200 seconds for the spoiler test. |
| Kingdom Hearts 2.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Kingdom Hearts.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Kirby's Dream Land 3.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Lingo.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Ocarina of Time.yaml | The default yaml file fails to generate. |
| Pokemon Emerald.yaml | Temporarily excluded. It takes too long to process. 120 seconds for the spoiler test. |
| Pokemon Red and Blue.yaml | Temporarily excluded. It takes too long to process. 408 seconds for the multiclient test. |
| Raft.yaml | Temporarily excluded. The WorldGen spoiler test times out at 300 seconds. |
| SMZ3.yaml | Temporarily excluded. It takes too long to process. 186 seconds for the multiclient test, which also fails because of self-locking items. |
| Secret of Evermore.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Starcraft 2.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Stardew Valley.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Sudoku.yaml | Cannot be used for generating worlds. |
| Super Metroid.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| TUNIC.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| The Witness.yaml | Temporarily excluded. The WorldGen spoiler test takes 261 seconds. |
| Universal Tracker.yaml | Not a game. |
| Yacht Dice.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Yu-Gi-Oh! 2006.yaml | Temporarily excluded. It takes too long to process. 161 seconds for the spoiler test. |
| Zillion.yaml | Uses the external zilliandomizer tool for its logic, which is not compatible with this system. |
