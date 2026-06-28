# Universal Tracker Fuzz Test Results (Original UT)

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Orig Seeded)](./test-results-ut-fuzz-comparison-original-original_seeded.md) | [View Comparison (Original vs Worldgen)](./test-results-ut-fuzz-comparison-original-worldgen.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-comparison-original-pickle.md) | [View Comparison (Worldgen vs Hybrid)](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | [View Comparison (Worldgen vs Pickle)](./test-results-ut-fuzz-comparison-worldgen-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-06-28 01:45:41 UTC

**Source Data Created:** 2026-06-26T17:57:04.371092+00:00

**Source Data Last Updated:** 2026-06-26T17:57:11.132519+00:00

**Universal Tracker Version:** Original (FarisTheAncient)

**Seed Mode:** Random

**Runs Per Game:** 3

**Parallel Jobs:** 2

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 1
- **Games with 100% Pass Rate:** 1 (100.0%)
- **Games with Failures:** 0 (0.0%)
- **Total Fuzz Runs:** 3
- **Successful Runs:** 3 (100.0%)
- **Failed Runs:** 0
- **Timed Out Runs:** 0
- **Ignored Runs:** 0

### Expected vs Unexpected Results (based on tracking-mode-config.json)

- **Expected Passes:** 0 (passes original mode per config)
- **Unexpected Passes:** 1 (expected to fail but passed)
- **Expected Failures:** 0 (doesn't pass original mode per config)
- **Unexpected Failures (logic):** 0 (expected to pass but had logic mismatch)
- **Unexpected Failures (timeout only):** 0 (expected to pass but timed out)

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|
| Adventure | ✅ | 3 | 3 | 0 | 0 | 0 | **100.0%** |

## Results Breakdown

### Unexpected Passes (1)

Games NOT expected to pass original mode (not in config or mode not listed) but passed anyway.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Adventure | 3 | 3 | 0 | 0 | 100.0% |

## Notes

- *Italic game names* are in the exclude list for this test type
- **Result:** ✅ if all fuzz runs passed (0 failures, 0 timeouts), ❌ otherwise
- **Total:** Number of fuzz runs attempted for this game
- **Success:** Number of runs where UT matched Python sphere log
- **Failure:** Number of runs where UT mismatched or encountered errors
- **Timeout:** Number of runs that exceeded the time limit
- **Ignored:** Number of runs skipped due to option errors
- **Success Rate:** Percentage of successful runs

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
| Bomb Rush Cyberfunk.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Celeste (Open World).yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| DOOM 1993.yaml | Temporarily excluded. Helper references original module data (Maps.map_names, self.all_boss_levels, self.included_episodes, Locations.location_table) causing NameError. |
| DOOM II.yaml | Temporarily excluded. Same pattern as DOOM 1993 — helper references original module data (Maps.map_names) causing NameError. |
| Heretic.yaml | Temporarily excluded. Same pattern as DOOM 1993 — helper references original module data (Maps.map_names) causing NameError. |
| JSON Tools Installer.yaml | Not a game. |
| Journey to Ascension.yaml | JtA is not compatible with WorldGen. |
| Kingdom Hearts 2.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Kingdom Hearts.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Kirby's Dream Land 3.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Lingo.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Mega Man 3.yaml | Temporarily excluded. WorldGen variant intermittently fails test_explicit_indirect_conditions_spheres with Fill.FillError on certain pytest seeds (e.g. 57516062135983689099). |
| Muse Dash.yaml | Temporarily excluded. Block-bodied helper inlined into expression context causes SyntaxError. |
| Paint.yaml | Temporarily excluded. Helper paint_percent_available not in JSON helpers dict causing NameError (calculate_paint_percent_available is present but referenced under wrong name). |
| Raft.yaml | Temporarily excluded. The WorldGen spoiler test times out at 300 seconds. |
| Satisfactory.yaml | Temporarily excluded. Calls self.state_logic.can_produce_all() which resolves to state.has_all() but is not exported, causing AttributeError. |
| Secret of Evermore.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Seedling.yaml | WorldGen variant generation produces a broken world (worlds/seedling_worldgen missing Items.py, causing ModuleNotFoundError on load). |
| Starcraft 2.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Stardew Valley.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Super Metroid.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| TUNIC.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| The Witness.yaml | Temporarily excluded. The WorldGen spoiler test takes 261 seconds. |
| UT Pickle Mode.yaml | Not a game. Universal Tracker pickle-mode meta-template, not a playable world (its worldgen variant fails with AttributeError in ut_pickle_worldgen._place_original_items). |
| Universal Tracker.yaml | Not a game. |
| Yacht Dice.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
