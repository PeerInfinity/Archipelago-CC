# Universal Tracker Fuzz Test Results

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Worldgen)](./test-results-ut-fuzz-comparison-original-worldgen.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-comparison-original-pickle.md) | [View Comparison (Worldgen vs Hybrid)](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | [View Comparison (Worldgen vs Pickle)](./test-results-ut-fuzz-comparison-worldgen-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-07 03:22:41

**Source Data Created:** 2026-02-07T03:22:41.350931

**Source Data Last Updated:** 2026-02-07T03:22:41.350936

**Universal Tracker Version:** Worldgen (regenerates world from rules.json)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 87
- **Games with 100% Pass Rate:** 0 (0.0%)
- **Games with Failures:** 87 (100.0%)
- **Total Fuzz Runs:** 0
- **Successful Runs:** 0 (0.0%)
- **Failed Runs:** 0
- **Timed Out Runs:** 0
- **Ignored Runs:** 0

### Expected vs Unexpected Results (based on tracking-mode-config.json)

- **Expected Passes:** 0 (passes worldgen mode per config)
- **Unexpected Passes:** 0 (expected to fail but passed)
- **Expected Failures:** 26 (doesn't pass worldgen mode per config)
- **Unexpected Failures (logic):** 0 (expected to pass but had logic mismatch)
- **Unexpected Failures (timeout only):** 61 (expected to pass but timed out)

### Generic Exporter/Logic Statistics

Of the 0 games with 100% pass rate:

- **Passing with Generic Exporter:** 0/0
- **Passing with Generic Logic:** 0/0
- **Passing with Both Generic:** 0/0

**Combined Custom Code Size:**

- **Total Exporter Code:** 576.8KB
- **Total Game Logic Code:** 655.3KB
- **Combined Total:** 1232.0KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 18.2KB | ✅ | 231.1KB |
| A Link to the Past | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 12.6KB | ✅ | 667.7KB |
| A Short Hike | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 410.7KB |
| APQuest | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 11.0KB |
| Adventure | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 26.0KB |
| Aquaria | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 1.8KB | ✅ | 275.1KB |
| Baking Adventure | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 18.2KB |
| Blasphemous | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 1043.4KB |
| Celeste 64 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 16.2KB |
| Choo-Choo Charles | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 282.3KB |
| Civilization VI | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 166.9KB |
| Coding Adventure | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 54.9KB |
| DLCQuest | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 1.2KB | ✅ | 51.0KB |
| DOOM 1993 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 280.1KB |
| DOOM II | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 326.5KB |
| Dark Souls III | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 1062.0KB |
| Donkey Kong Country 3 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 122.5KB |
| EarthBound | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | N/A | N/A | N/A |
| Factorio | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 8.8KB | ✅ | 295.0KB |
| Faxanadu | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 68.7KB |
| Final Fantasy | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 13.4KB | ✅ | 549.5KB |
| Heretic | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 367.5KB |
| Hollow Knight | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Hylics 2 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 101.9KB |
| Inscryption | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 753.6KB |
| Kingdom Hearts 2 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 19.5KB | ✅ | 1641.1KB |
| Kirby's Dream Land 3 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 10.1KB | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 3.6KB | ✅ | 210.5KB |
| Lingo | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 38.0KB | 10.7KB | 946.3KB |
| Links Awakening DX | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 7.4KB | ✅ | 714.5KB |
| Lufia II Ancient Cave | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 398.5KB |
| Math Adventure | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 51.5KB |
| MegaMan Battle Network 3 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 209.8KB |
| Meritous | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 57.2KB |
| Metamath | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 48.1KB |
| Muse Dash | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 233.5KB |
| Noita | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 74.6KB |
| Ocarina of Time | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 1.0KB | ✅ | 307.1KB |
| Overcooked! 2 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 28.5KB | ✅ | 489.2KB |
| Paint | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 6.5KB | ✅ | 205.9KB |
| Risk of Rain 2 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 146.1KB |
| SMZ3 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 61.4KB | 51.3KB | 1044.7KB |
| Satisfactory | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | N/A | N/A | N/A |
| Saving Princess | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 33.8KB |
| Secret of Evermore | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 5.3KB | 7.5KB | 418.7KB |
| Shivers | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 266.2KB |
| Starcraft 2 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 28.7KB | 90.1KB | 1126.8KB |
| Stardew Valley | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 18.8KB | 8.0KB | 2430.2KB |
| Subnautica | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 2.2KB | ✅ | 207.8KB |
| Sudoku | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Super Mario 64 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 93.2KB |
| Super Mario Land 2 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 96.3KB | ✅ | 982.7KB |
| Super Mario World | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 60.9KB | 114.5KB | 625.4KB |
| TOEM original | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 102.8KB |
| TUNIC | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 3.1KB | ✅ | 653.3KB |
| Terraria | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 555.3KB |
| The Messenger | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 15.2KB | ✅ | 211.8KB |
| The Wind Waker | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 14.1KB | ✅ | 398.4KB |
| Timespinner | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 2.2KB | ✅ | 267.3KB |
| Undertale | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 58.0KB |
| VVVVVV | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 3.8KB | ✅ | 22.8KB |
| Wargroove | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 44.7KB |
| Yacht Dice | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 9.2KB | ✅ | 296.7KB |
| Yu-Gi-Oh! 2006 | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| shapez | ❌ | 0 | 0 | 0 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 155.3KB |

## Results Breakdown

### Expected Failures (26)

Games NOT expected to pass worldgen mode and failed as expected.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Blasphemous | 0 | 0 | 0 | 0 | 0.0% |
| Bomb Rush Cyberfunk | 0 | 0 | 0 | 0 | 0.0% |
| Celeste (Open World) | 0 | 0 | 0 | 0 | 0.0% |
| EarthBound | 0 | 0 | 0 | 0 | 0.0% |
| Final Fantasy Mystic Quest | 0 | 0 | 0 | 0 | 0.0% |
| Hollow Knight | 0 | 0 | 0 | 0 | 0.0% |
| Jak and Daxter: The Precursor Legacy | 0 | 0 | 0 | 0 | 0.0% |
| Kingdom Hearts | 0 | 0 | 0 | 0 | 0.0% |
| Kingdom Hearts 2 | 0 | 0 | 0 | 0 | 0.0% |
| Kirby's Dream Land 3 | 0 | 0 | 0 | 0 | 0.0% |
| Lingo | 0 | 0 | 0 | 0 | 0.0% |
| Ocarina of Time | 0 | 0 | 0 | 0 | 0.0% |
| Pokemon Emerald | 0 | 0 | 0 | 0 | 0.0% |
| Pokemon Red and Blue | 0 | 0 | 0 | 0 | 0.0% |
| Raft | 0 | 0 | 0 | 0 | 0.0% |
| SMZ3 | 0 | 0 | 0 | 0 | 0.0% |
| Satisfactory | 0 | 0 | 0 | 0 | 0.0% |
| Secret of Evermore | 0 | 0 | 0 | 0 | 0.0% |
| Starcraft 2 | 0 | 0 | 0 | 0 | 0.0% |
| Stardew Valley | 0 | 0 | 0 | 0 | 0.0% |
| Super Metroid | 0 | 0 | 0 | 0 | 0.0% |
| TUNIC | 0 | 0 | 0 | 0 | 0.0% |
| The Witness | 0 | 0 | 0 | 0 | 0.0% |
| Yacht Dice | 0 | 0 | 0 | 0 | 0.0% |
| Yu-Gi-Oh! 2006 | 0 | 0 | 0 | 0 | 0.0% |
| Zillion | 0 | 0 | 0 | 0 | 0.0% |

### Unexpected Failures (Timeout Only) (61)

Games expected to pass worldgen mode but failed only due to timeouts.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| A Hat in Time | 0 | 0 | 0 | 0 | 0.0% |
| A Link to the Past | 0 | 0 | 0 | 0 | 0.0% |
| A Short Hike | 0 | 0 | 0 | 0 | 0.0% |
| APQuest | 0 | 0 | 0 | 0 | 0.0% |
| Adventure | 0 | 0 | 0 | 0 | 0.0% |
| Aquaria | 0 | 0 | 0 | 0 | 0.0% |
| Baking Adventure | 0 | 0 | 0 | 0 | 0.0% |
| Bumper Stickers | 0 | 0 | 0 | 0 | 0.0% |
| Castlevania - Circle of the Moon | 0 | 0 | 0 | 0 | 0.0% |
| Castlevania 64 | 0 | 0 | 0 | 0 | 0.0% |
| Celeste 64 | 0 | 0 | 0 | 0 | 0.0% |
| ChecksFinder | 0 | 0 | 0 | 0 | 0.0% |
| Choo-Choo Charles | 0 | 0 | 0 | 0 | 0.0% |
| Civilization VI | 0 | 0 | 0 | 0 | 0.0% |
| Coding Adventure | 0 | 0 | 0 | 0 | 0.0% |
| DLCQuest | 0 | 0 | 0 | 0 | 0.0% |
| DOOM 1993 | 0 | 0 | 0 | 0 | 0.0% |
| DOOM II | 0 | 0 | 0 | 0 | 0.0% |
| Dark Souls III | 0 | 0 | 0 | 0 | 0.0% |
| Donkey Kong Country 3 | 0 | 0 | 0 | 0 | 0.0% |
| Factorio | 0 | 0 | 0 | 0 | 0.0% |
| Faxanadu | 0 | 0 | 0 | 0 | 0.0% |
| Final Fantasy | 0 | 0 | 0 | 0 | 0.0% |
| Heretic | 0 | 0 | 0 | 0 | 0.0% |
| Hylics 2 | 0 | 0 | 0 | 0 | 0.0% |
| Inscryption | 0 | 0 | 0 | 0 | 0.0% |
| Landstalker - The Treasures of King Nole | 0 | 0 | 0 | 0 | 0.0% |
| Links Awakening DX | 0 | 0 | 0 | 0 | 0.0% |
| Lufia II Ancient Cave | 0 | 0 | 0 | 0 | 0.0% |
| Mario & Luigi Superstar Saga | 0 | 0 | 0 | 0 | 0.0% |
| Math Adventure | 0 | 0 | 0 | 0 | 0.0% |
| Mega Man 2 | 0 | 0 | 0 | 0 | 0.0% |
| MegaMan Battle Network 3 | 0 | 0 | 0 | 0 | 0.0% |
| Meritous | 0 | 0 | 0 | 0 | 0.0% |
| Metamath | 0 | 0 | 0 | 0 | 0.0% |
| Muse Dash | 0 | 0 | 0 | 0 | 0.0% |
| Noita | 0 | 0 | 0 | 0 | 0.0% |
| Old School Runescape | 0 | 0 | 0 | 0 | 0.0% |
| Overcooked! 2 | 0 | 0 | 0 | 0 | 0.0% |
| Paint | 0 | 0 | 0 | 0 | 0.0% |
| Risk of Rain 2 | 0 | 0 | 0 | 0 | 0.0% |
| Saving Princess | 0 | 0 | 0 | 0 | 0.0% |
| Shivers | 0 | 0 | 0 | 0 | 0.0% |
| Sonic Adventure 2 Battle | 0 | 0 | 0 | 0 | 0.0% |
| Subnautica | 0 | 0 | 0 | 0 | 0.0% |
| Sudoku | 0 | 0 | 0 | 0 | 0.0% |
| Super Mario 64 | 0 | 0 | 0 | 0 | 0.0% |
| Super Mario Land 2 | 0 | 0 | 0 | 0 | 0.0% |
| Super Mario World | 0 | 0 | 0 | 0 | 0.0% |
| TOEM original | 0 | 0 | 0 | 0 | 0.0% |
| TOEM rule builder | 0 | 0 | 0 | 0 | 0.0% |
| Terraria | 0 | 0 | 0 | 0 | 0.0% |
| The Legend of Zelda | 0 | 0 | 0 | 0 | 0.0% |
| The Messenger | 0 | 0 | 0 | 0 | 0.0% |
| The Wind Waker | 0 | 0 | 0 | 0 | 0.0% |
| Timespinner | 0 | 0 | 0 | 0 | 0.0% |
| Undertale | 0 | 0 | 0 | 0 | 0.0% |
| VVVVVV | 0 | 0 | 0 | 0 | 0.0% |
| Wargroove | 0 | 0 | 0 | 0 | 0.0% |
| Yoshi's Island | 0 | 0 | 0 | 0 | 0.0% |
| shapez | 0 | 0 | 0 | 0 | 0.0% |

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
| Bomb Rush Cyberfunk.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Celeste (Open World).yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| JSON Tools Installer.yaml | Not a game. |
| Kingdom Hearts 2.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Kingdom Hearts.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Kirby's Dream Land 3.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Lingo.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Raft.yaml | Temporarily excluded. The WorldGen spoiler test times out at 300 seconds. |
| Secret of Evermore.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Starcraft 2.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Stardew Valley.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Super Metroid.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| TUNIC.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| The Witness.yaml | Temporarily excluded. The WorldGen spoiler test takes 261 seconds. |
| Universal Tracker.yaml | Not a game. |
| Yacht Dice.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
