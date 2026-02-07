# Universal Tracker Fuzz Test Results (Pickle)

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Worldgen)](./test-results-ut-fuzz-comparison-original-worldgen.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-comparison-original-pickle.md) | [View Comparison (Worldgen vs Hybrid)](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | [View Comparison (Worldgen vs Pickle)](./test-results-ut-fuzz-comparison-worldgen-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-07 03:42:39

**Source Data Created:** 2026-02-07T03:42:39.698672

**Source Data Last Updated:** 2026-02-07T03:42:39.698677

**Universal Tracker Version:** Pickle (loads serialized multiworld)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 87
- **Games with 100% Pass Rate:** 76 (87.4%)
- **Games with Failures:** 11 (12.6%)
- **Total Fuzz Runs:** 870
- **Successful Runs:** 735 (84.5%)
- **Failed Runs:** 94
- **Timed Out Runs:** 2
- **Ignored Runs:** 39

### Expected vs Unexpected Results (based on tracking-mode-config.json)

- **Expected Passes:** 73 (passes pickle mode per config)
- **Unexpected Passes:** 3 (expected to fail but passed)
- **Expected Failures:** 9 (doesn't pass pickle mode per config)
- **Unexpected Failures (logic):** 2 (expected to pass but had logic mismatch)
- **Unexpected Failures (timeout only):** 0 (expected to pass but timed out)

### Explain Support Summary

- **Games with Explain Stats:** 67
- **Games with 100% Explain Coverage:** 59
- **Games with No Explain Support:** 1
- **Locations with Explain Support:** 9,049
- **Locations without Explain Support:** 647
- **Locations with Default Rule:** 13,280
- **Overall Explain Coverage:** 93.3%

### Generic Exporter/Logic Statistics

Of the 76 games with 100% pass rate:

- **Passing with Generic Exporter:** 43/76 (56.6%)
- **Passing with Generic Logic:** 68/76 (89.5%)
- **Passing with Both Generic:** 43/76 (56.6%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 576.8KB
- **Total Game Logic Code:** 655.3KB
- **Combined Total:** 1232.0KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 18.2KB | ✅ | 231.1KB |
| A Link to the Past | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | 12.6KB | ✅ | 667.7KB |
| A Short Hike | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 410.7KB |
| APQuest | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 26.0KB |
| Aquaria | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.8KB | ✅ | 275.1KB |
| Baking Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 18.2KB |
| Blasphemous | ✅ | 10 | 4 | 0 | 0 | 6 | ❌ 40.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 1043.4KB |
| Celeste 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 16.2KB |
| Choo-Choo Charles | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 282.3KB |
| Civilization VI | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 166.9KB |
| Coding Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 54.9KB |
| DLCQuest | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.2KB | ✅ | 51.0KB |
| DOOM 1993 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 280.1KB |
| DOOM II | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 326.5KB |
| Dark Souls III | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 1062.0KB |
| Donkey Kong Country 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 122.5KB |
| EarthBound | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | N/A | N/A | N/A |
| Factorio | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 8.8KB | ✅ | 295.0KB |
| Faxanadu | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | 13.4KB | ✅ | 549.5KB |
| Heretic | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 367.5KB |
| Hollow Knight | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 101.9KB |
| Inscryption | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 753.6KB |
| Kingdom Hearts 2 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 19.5KB | ✅ | 1641.1KB |
| Kirby's Dream Land 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 10.1KB | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.6KB | ✅ | 210.5KB |
| Lingo | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% | 38.0KB | 10.7KB | 946.3KB |
| Links Awakening DX | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 7.4KB | ✅ | 714.5KB |
| Lufia II Ancient Cave | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 398.5KB |
| Math Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 51.5KB |
| MegaMan Battle Network 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 209.8KB |
| Meritous | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 57.2KB |
| Metamath | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 48.1KB |
| Muse Dash | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 233.5KB |
| Noita | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 74.6KB |
| Ocarina of Time | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.0KB | ✅ | 307.1KB |
| Overcooked! 2 | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% | 28.5KB | ✅ | 489.2KB |
| Paint | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | ✅ | 10 | 6 | 0 | 0 | 4 | ⚠️ 60.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 6.5KB | ✅ | 205.9KB |
| Risk of Rain 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 146.1KB |
| SMZ3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 61.4KB | 51.3KB | 1044.7KB |
| Satisfactory | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | N/A | N/A | N/A |
| Saving Princess | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 33.8KB |
| Secret of Evermore | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 5.3KB | 7.5KB | 418.7KB |
| Shivers | ❌ | 10 | 9 | 0 | 1 | 0 | 90.0% | ✅ | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 266.2KB |
| Starcraft 2 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 28.7KB | 90.1KB | 1126.8KB |
| Stardew Valley | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 18.8KB | 8.0KB | 2430.2KB |
| Subnautica | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Super Mario 64 | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | 93.2KB |
| Super Mario Land 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 96.3KB | ✅ | 982.7KB |
| Super Mario World | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | 60.9KB | 114.5KB | 625.4KB |
| TOEM original | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TUNIC | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.1KB | ✅ | 653.3KB |
| Terraria | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 555.3KB |
| The Messenger | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 15.2KB | ✅ | 211.8KB |
| The Wind Waker | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 14.1KB | ✅ | 398.4KB |
| Timespinner | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 267.3KB |
| Undertale | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 58.0KB |
| VVVVVV | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.8KB | ✅ | 22.8KB |
| Wargroove | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 44.7KB |
| Yacht Dice | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 9.2KB | ✅ | 296.7KB |
| Yu-Gi-Oh! 2006 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ | 10 | 0 | 8 | 1 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| shapez | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 155.3KB |

## Results Breakdown

### Expected Passes (73)

Games that pass pickle mode per tracking-mode-config.json and passed the test.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| A Hat in Time | 10 | 10 | 0 | 0 | 100.0% |
| A Link to the Past | 10 | 8 | 0 | 0 | 80.0% |
| A Short Hike | 10 | 10 | 0 | 0 | 100.0% |
| APQuest | 10 | 10 | 0 | 0 | 100.0% |
| Adventure | 10 | 10 | 0 | 0 | 100.0% |
| Aquaria | 10 | 10 | 0 | 0 | 100.0% |
| Baking Adventure | 10 | 10 | 0 | 0 | 100.0% |
| Blasphemous | 10 | 4 | 0 | 0 | 40.0% |
| Bomb Rush Cyberfunk | 10 | 10 | 0 | 0 | 100.0% |
| Bumper Stickers | 10 | 10 | 0 | 0 | 100.0% |
| Castlevania - Circle of the Moon | 10 | 10 | 0 | 0 | 100.0% |
| Castlevania 64 | 10 | 10 | 0 | 0 | 100.0% |
| Celeste (Open World) | 10 | 10 | 0 | 0 | 100.0% |
| Celeste 64 | 10 | 10 | 0 | 0 | 100.0% |
| ChecksFinder | 10 | 10 | 0 | 0 | 100.0% |
| Choo-Choo Charles | 10 | 10 | 0 | 0 | 100.0% |
| Civilization VI | 10 | 10 | 0 | 0 | 100.0% |
| Coding Adventure | 10 | 10 | 0 | 0 | 100.0% |
| DLCQuest | 10 | 10 | 0 | 0 | 100.0% |
| DOOM 1993 | 10 | 10 | 0 | 0 | 100.0% |
| DOOM II | 10 | 10 | 0 | 0 | 100.0% |
| Dark Souls III | 10 | 10 | 0 | 0 | 100.0% |
| Donkey Kong Country 3 | 10 | 10 | 0 | 0 | 100.0% |
| Faxanadu | 10 | 10 | 0 | 0 | 100.0% |
| Final Fantasy | 10 | 10 | 0 | 0 | 100.0% |
| Heretic | 10 | 10 | 0 | 0 | 100.0% |
| Hollow Knight | 10 | 10 | 0 | 0 | 100.0% |
| Hylics 2 | 10 | 10 | 0 | 0 | 100.0% |
| Inscryption | 10 | 10 | 0 | 0 | 100.0% |
| Jak and Daxter: The Precursor Legacy | 10 | 10 | 0 | 0 | 100.0% |
| Kingdom Hearts | 10 | 10 | 0 | 0 | 100.0% |
| Kirby's Dream Land 3 | 10 | 10 | 0 | 0 | 100.0% |
| Landstalker - The Treasures of King Nole | 10 | 10 | 0 | 0 | 100.0% |
| Lingo | 10 | 3 | 0 | 0 | 30.0% |
| Links Awakening DX | 10 | 10 | 0 | 0 | 100.0% |
| Lufia II Ancient Cave | 10 | 10 | 0 | 0 | 100.0% |
| Mario & Luigi Superstar Saga | 10 | 10 | 0 | 0 | 100.0% |
| Math Adventure | 10 | 10 | 0 | 0 | 100.0% |
| Mega Man 2 | 10 | 10 | 0 | 0 | 100.0% |
| MegaMan Battle Network 3 | 10 | 10 | 0 | 0 | 100.0% |
| Meritous | 10 | 10 | 0 | 0 | 100.0% |
| Metamath | 10 | 10 | 0 | 0 | 100.0% |
| Muse Dash | 10 | 10 | 0 | 0 | 100.0% |
| Noita | 10 | 10 | 0 | 0 | 100.0% |
| Old School Runescape | 10 | 10 | 0 | 0 | 100.0% |
| Overcooked! 2 | 10 | 5 | 0 | 0 | 50.0% |
| Paint | 10 | 10 | 0 | 0 | 100.0% |
| Pokemon Emerald | 10 | 6 | 0 | 0 | 60.0% |
| Pokemon Red and Blue | 10 | 9 | 0 | 0 | 90.0% |
| Raft | 10 | 10 | 0 | 0 | 100.0% |
| Risk of Rain 2 | 10 | 10 | 0 | 0 | 100.0% |
| SMZ3 | 10 | 10 | 0 | 0 | 100.0% |
| Saving Princess | 10 | 10 | 0 | 0 | 100.0% |
| Sonic Adventure 2 Battle | 10 | 10 | 0 | 0 | 100.0% |
| Subnautica | 10 | 10 | 0 | 0 | 100.0% |
| Sudoku | 10 | 10 | 0 | 0 | 100.0% |
| Super Mario Land 2 | 10 | 10 | 0 | 0 | 100.0% |
| Super Mario World | 10 | 9 | 0 | 0 | 90.0% |
| TOEM original | 10 | 10 | 0 | 0 | 100.0% |
| TOEM rule builder | 10 | 10 | 0 | 0 | 100.0% |
| TUNIC | 10 | 10 | 0 | 0 | 100.0% |
| Terraria | 10 | 9 | 0 | 0 | 90.0% |
| The Legend of Zelda | 10 | 10 | 0 | 0 | 100.0% |
| The Wind Waker | 10 | 5 | 0 | 0 | 50.0% |
| The Witness | 10 | 10 | 0 | 0 | 100.0% |
| Timespinner | 10 | 10 | 0 | 0 | 100.0% |
| Undertale | 10 | 10 | 0 | 0 | 100.0% |
| VVVVVV | 10 | 10 | 0 | 0 | 100.0% |
| Wargroove | 10 | 10 | 0 | 0 | 100.0% |
| Yacht Dice | 10 | 10 | 0 | 0 | 100.0% |
| Yoshi's Island | 10 | 10 | 0 | 0 | 100.0% |
| Yu-Gi-Oh! 2006 | 10 | 10 | 0 | 0 | 100.0% |
| shapez | 10 | 10 | 0 | 0 | 100.0% |

### Unexpected Passes (3)

Games NOT expected to pass pickle mode (not in config or mode not listed) but passed anyway.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| EarthBound | 10 | 10 | 0 | 0 | 100.0% |
| Final Fantasy Mystic Quest | 10 | 8 | 0 | 0 | 80.0% |
| The Messenger | 10 | 10 | 0 | 0 | 100.0% |

### Expected Failures (9)

Games NOT expected to pass pickle mode and failed as expected.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Kingdom Hearts 2 | 10 | 0 | 10 | 0 | 0.0% |
| Ocarina of Time | 10 | 0 | 9 | 0 | 0.0% |
| Satisfactory | 10 | 0 | 10 | 0 | 0.0% |
| Secret of Evermore | 10 | 0 | 10 | 0 | 0.0% |
| Shivers | 10 | 9 | 0 | 1 | 90.0% |
| Starcraft 2 | 10 | 0 | 10 | 0 | 0.0% |
| Stardew Valley | 10 | 0 | 10 | 0 | 0.0% |
| Super Metroid | 10 | 0 | 8 | 0 | 0.0% |
| Zillion | 10 | 0 | 8 | 1 | 0.0% |

### Unexpected Failures (Logic Mismatch) (2)

Games expected to pass pickle mode but failed due to logic mismatches.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Factorio | 10 | 0 | 10 | 0 | 0.0% |
| Super Mario 64 | 10 | 0 | 9 | 0 | 0.0% |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| Satisfactory | 549 | 0 | 104 | 445 | ❌ 0% |
| Super Mario 64 | 164 | 11 | 32 | 121 | 🔶 26% |
| Timespinner | 720 | 185 | 434 | 101 | 🔶 30% |
| Kingdom Hearts 2 | 669 | 46 | 30 | 593 | ⚠️ 61% |
| A Link to the Past | 226 | 113 | 28 | 85 | ⚠️ 80% |
| The Wind Waker | 228 | 173 | 16 | 39 | ⚠️ 92% |
| The Messenger | 136 | 52 | 2 | 82 | ⚠️ 96% |
| Mega Man 2 | 44 | 29 | 1 | 14 | ⚠️ 97% |
| A Hat in Time | 275 | 95 | 0 | 180 | ✅ 100% |
| A Short Hike | 131 | 82 | 0 | 49 | ✅ 100% |
| APQuest | 6 | 1 | 0 | 5 | ✅ 100% |
| Adventure | 24 | 3 | 0 | 21 | ✅ 100% |
| Aquaria | 218 | 35 | 0 | 183 | ✅ 100% |
| Baking Adventure | 15 | 8 | 0 | 7 | ✅ 100% |
| Bumper Stickers | 100 | 38 | 0 | 62 | ✅ 100% |
| Castlevania - Circle of the Moon | 124 | 46 | 0 | 78 | ✅ 100% |
| Castlevania 64 | 294 | 0 | 0 | 294 | ✅ 100% |
| Celeste 64 | 54 | 21 | 0 | 33 | ✅ 100% |
| ChecksFinder | 25 | 20 | 0 | 5 | ✅ 100% |
| Choo-Choo Charles | 691 | 64 | 0 | 627 | ✅ 100% |
| Civilization VI | 270 | 91 | 0 | 179 | ✅ 100% |
| Coding Adventure | 61 | 43 | 0 | 18 | ✅ 100% |
| DLCQuest | 31 | 22 | 0 | 9 | ✅ 100% |
| DOOM 1993 | 474 | 0 | 0 | 474 | ✅ 100% |
| DOOM II | 479 | 0 | 0 | 479 | ✅ 100% |
| Dark Souls III | 1190 | 208 | 0 | 982 | ✅ 100% |
| Donkey Kong Country 3 | 220 | 1 | 0 | 219 | ✅ 100% |
| EarthBound | 250 | 38 | 0 | 212 | ✅ 100% |
| Factorio | 309 | 151 | 0 | 158 | ✅ 100% |
| Faxanadu | 110 | 24 | 0 | 86 | ✅ 100% |
| Final Fantasy | 0 | 0 | 0 | 0 | ✅ 100% |
| Final Fantasy Mystic Quest | 251 | 63 | 0 | 188 | ✅ 100% |
| Heretic | 691 | 0 | 0 | 691 | ✅ 100% |
| Hylics 2 | 166 | 88 | 0 | 78 | ✅ 100% |
| Inscryption | 100 | 65 | 0 | 35 | ✅ 100% |
| Landstalker - The Treasures of King Nole | 291 | 1 | 0 | 290 | ✅ 100% |
| Links Awakening DX | 220 | 0 | 0 | 220 | ✅ 100% |
| Lufia II Ancient Cave | 97 | 92 | 0 | 5 | ✅ 100% |
| Mario & Luigi Superstar Saga | 598 | 372 | 0 | 226 | ✅ 100% |
| Math Adventure | 10 | 5 | 0 | 5 | ✅ 100% |
| MegaMan Battle Network 3 | 263 | 80 | 0 | 183 | ✅ 100% |
| Meritous | 104 | 0 | 0 | 104 | ✅ 100% |
| Metamath | 3 | 1 | 0 | 2 | ✅ 100% |
| Muse Dash | 828 | 828 | 0 | 0 | ✅ 100% |
| Noita | 376 | 0 | 0 | 376 | ✅ 100% |
| Old School Runescape | 76 | 68 | 0 | 8 | ✅ 100% |
| Overcooked! 2 | 43 | 9 | 0 | 34 | ✅ 100% |
| Paint | 167 | 167 | 0 | 0 | ✅ 100% |
| Risk of Rain 2 | 672 | 672 | 0 | 0 | ✅ 100% |
| Saving Princess | 36 | 16 | 0 | 20 | ✅ 100% |
| Shivers | 77 | 15 | 0 | 62 | ✅ 100% |
| Sonic Adventure 2 Battle | 1046 | 227 | 0 | 819 | ✅ 100% |
| Stardew Valley | 1069 | 927 | 0 | 142 | ✅ 100% |
| Subnautica | 161 | 161 | 0 | 0 | ✅ 100% |
| Super Mario Land 2 | 2652 | 2491 | 0 | 161 | ✅ 100% |
| Super Mario World | 743 | 396 | 0 | 347 | ✅ 100% |
| Super Metroid | 36 | 36 | 0 | 0 | ✅ 100% |
| TOEM original | 214 | 4 | 0 | 210 | ✅ 100% |
| TOEM rule builder | 214 | 4 | 0 | 210 | ✅ 100% |
| Terraria | 128 | 92 | 0 | 36 | ✅ 100% |
| The Legend of Zelda | 155 | 151 | 0 | 4 | ✅ 100% |
| Undertale | 106 | 95 | 0 | 11 | ✅ 100% |
| VVVVVV | 20 | 2 | 0 | 18 | ✅ 100% |
| Wargroove | 38 | 28 | 0 | 10 | ✅ 100% |
| Yoshi's Island | 221 | 121 | 0 | 100 | ✅ 100% |
| Zillion | 147 | 147 | 0 | 0 | ✅ 100% |
| shapez | 2870 | 25 | 0 | 2845 | ✅ 100% |

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
