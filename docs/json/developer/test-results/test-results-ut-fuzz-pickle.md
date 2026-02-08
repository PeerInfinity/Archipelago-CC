# Universal Tracker Fuzz Test Results (Pickle)

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Worldgen)](./test-results-ut-fuzz-comparison-original-worldgen.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-comparison-original-pickle.md) | [View Comparison (Worldgen vs Hybrid)](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | [View Comparison (Worldgen vs Pickle)](./test-results-ut-fuzz-comparison-worldgen-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-08 01:19:09

**Source Data Created:** 2026-02-07T05:13:22.623022

**Source Data Last Updated:** 2026-02-07T05:13:22.623029

**Universal Tracker Version:** Pickle (loads serialized multiworld)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 100

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 87
- **Games with 100% Pass Rate:** 75 (86.2%)
- **Games with Failures:** 12 (13.8%)
- **Total Fuzz Runs:** 8700
- **Successful Runs:** 7636 (87.8%)
- **Failed Runs:** 732
- **Timed Out Runs:** 19
- **Ignored Runs:** 313

### Expected vs Unexpected Results (based on tracking-mode-config.json)

- **Expected Passes:** 73 (passes pickle mode per config)
- **Unexpected Passes:** 2 (expected to fail but passed)
- **Expected Failures:** 10 (doesn't pass pickle mode per config)
- **Unexpected Failures (logic):** 1 (expected to pass but had logic mismatch)
- **Unexpected Failures (timeout only):** 1 (expected to pass but timed out)

### Generic Exporter/Logic Statistics

Of the 75 games with 100% pass rate:

- **Passing with Generic Exporter:** 43/75 (57.3%)
- **Passing with Generic Logic:** 66/75 (88.0%)
- **Passing with Both Generic:** 43/75 (57.3%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 612.0KB
- **Total Game Logic Code:** 655.3KB
- **Combined Total:** 1267.3KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ✅ | 100 | 99 | 0 | 0 | 1 | 99.0% | 18.2KB | ✅ | 231.3KB |
| A Link to the Past | ✅ | 100 | 97 | 0 | 0 | 3 | 97.0% | 12.6KB | ✅ | 667.7KB |
| A Short Hike | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 410.7KB |
| APQuest | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 26.0KB |
| Aquaria | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 1.8KB | ✅ | 275.1KB |
| Baking Adventure | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 18.2KB |
| Blasphemous | ✅ | 100 | 56 | 0 | 0 | 44 | ⚠️ 56.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 1043.4KB |
| Celeste 64 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 16.2KB |
| Choo-Choo Charles | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 282.3KB |
| Civilization VI | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 166.9KB |
| Coding Adventure | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 54.9KB |
| DLCQuest | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 1.2KB | ✅ | 51.0KB |
| DOOM 1993 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 280.1KB |
| DOOM II | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 326.5KB |
| Dark Souls III | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 1062.0KB |
| Donkey Kong Country 3 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 122.5KB |
| EarthBound | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 343.8KB |
| Factorio | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 8.8KB | ✅ | 295.4KB |
| Faxanadu | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ❌ | 100 | 80 | 0 | 4 | 16 | ⚠️ 80.0% | 13.4KB | ✅ | 549.5KB |
| Heretic | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 367.5KB |
| Hollow Knight | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 101.9KB |
| Inscryption | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ❌ | 100 | 98 | 0 | 2 | 0 | 98.0% | ✅ | ✅ | 753.6KB |
| Kingdom Hearts 2 | ❌ | 100 | 44 | 51 | 0 | 5 | ❌ 44.0% | 19.5KB | ✅ | 1641.6KB |
| Kirby's Dream Land 3 | ✅ | 100 | 97 | 0 | 0 | 3 | 97.0% | 10.1KB | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 3.6KB | ✅ | 210.5KB |
| Lingo | ✅ | 100 | 45 | 0 | 0 | 55 | ❌ 45.0% | 38.0KB | 10.7KB | 946.3KB |
| Links Awakening DX | ❌ | 100 | 23 | 77 | 0 | 0 | ❌ 23.0% | 7.4KB | ✅ | 705.8KB |
| Lufia II Ancient Cave | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 398.8KB |
| Math Adventure | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ✅ | 100 | 99 | 0 | 0 | 1 | 99.0% | ✅ | ✅ | 51.5KB |
| MegaMan Battle Network 3 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 209.8KB |
| Meritous | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 57.2KB |
| Metamath | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 48.1KB |
| Muse Dash | ✅ | 100 | 97 | 0 | 0 | 3 | 97.0% | ✅ | ✅ | 233.5KB |
| Noita | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 74.6KB |
| Ocarina of Time | ❌ | 100 | 0 | 99 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | 100 | 91 | 0 | 0 | 9 | 91.0% | 1.0KB | ✅ | 307.1KB |
| Overcooked! 2 | ✅ | 100 | 67 | 0 | 0 | 33 | ⚠️ 67.0% | 28.5KB | ✅ | 489.2KB |
| Paint | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | ✅ | 100 | 78 | 0 | 0 | 22 | ⚠️ 78.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ✅ | 100 | 93 | 0 | 0 | 7 | 93.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 6.5KB | ✅ | 205.9KB |
| Risk of Rain 2 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 146.1KB |
| SMZ3 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 61.4KB | 51.3KB | 1044.7KB |
| Satisfactory | ❌ | 100 | 0 | 99 | 0 | 1 | ❌ 0.0% | 35.2KB | ✅ | 1703.4KB |
| Saving Princess | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 33.8KB |
| Secret of Evermore | ❌ | 100 | 0 | 100 | 0 | 0 | ❌ 0.0% | 5.3KB | 7.5KB | 418.7KB |
| Shivers | ❌ | 100 | 0 | 100 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 266.2KB |
| Starcraft 2 | ❌ | 100 | 0 | 99 | 0 | 1 | ❌ 0.0% | 28.7KB | 90.1KB | 1126.8KB |
| Stardew Valley | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 18.8KB | 8.0KB | 2430.2KB |
| Subnautica | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | ✅ | ✅ | 101.9KB |
| Super Mario Land 2 | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | 96.3KB | ✅ | 982.7KB |
| Super Mario World | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ | 100 | 49 | 8 | 0 | 43 | ❌ 49.0% | 60.9KB | 114.5KB | 625.4KB |
| TOEM original | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TUNIC | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 3.1KB | ✅ | 653.3KB |
| Terraria | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 555.3KB |
| The Messenger | ❌ | 100 | 2 | 98 | 0 | 0 | ❌ 2.0% | 15.2KB | ✅ | 211.8KB |
| The Wind Waker | ✅ | 100 | 54 | 0 | 0 | 46 | ⚠️ 54.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 14.1KB | ✅ | 398.4KB |
| Timespinner | ✅ | 100 | 99 | 0 | 0 | 1 | 99.0% | 2.2KB | ✅ | 267.3KB |
| Undertale | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 58.0KB |
| VVVVVV | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 3.8KB | ✅ | 22.8KB |
| Wargroove | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 44.7KB |
| Yacht Dice | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 9.2KB | ✅ | 296.8KB |
| Yu-Gi-Oh! 2006 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ | 100 | 78 | 1 | 13 | 8 | ⚠️ 78.0% | ✅ | ✅ | N/A |
| shapez | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 155.3KB |

## Results Breakdown

### Expected Passes (73)

Games that pass pickle mode per tracking-mode-config.json and passed the test.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| A Hat in Time | 100 | 99 | 0 | 0 | 99.0% |
| A Link to the Past | 100 | 97 | 0 | 0 | 97.0% |
| A Short Hike | 100 | 100 | 0 | 0 | 100.0% |
| APQuest | 100 | 100 | 0 | 0 | 100.0% |
| Adventure | 100 | 100 | 0 | 0 | 100.0% |
| Aquaria | 100 | 100 | 0 | 0 | 100.0% |
| Baking Adventure | 100 | 100 | 0 | 0 | 100.0% |
| Blasphemous | 100 | 56 | 0 | 0 | 56.0% |
| Bomb Rush Cyberfunk | 100 | 100 | 0 | 0 | 100.0% |
| Bumper Stickers | 100 | 100 | 0 | 0 | 100.0% |
| Castlevania - Circle of the Moon | 100 | 100 | 0 | 0 | 100.0% |
| Castlevania 64 | 100 | 100 | 0 | 0 | 100.0% |
| Celeste (Open World) | 100 | 100 | 0 | 0 | 100.0% |
| Celeste 64 | 100 | 100 | 0 | 0 | 100.0% |
| ChecksFinder | 100 | 100 | 0 | 0 | 100.0% |
| Choo-Choo Charles | 100 | 100 | 0 | 0 | 100.0% |
| Civilization VI | 100 | 100 | 0 | 0 | 100.0% |
| Coding Adventure | 100 | 100 | 0 | 0 | 100.0% |
| DLCQuest | 100 | 100 | 0 | 0 | 100.0% |
| DOOM 1993 | 100 | 100 | 0 | 0 | 100.0% |
| DOOM II | 100 | 100 | 0 | 0 | 100.0% |
| Dark Souls III | 100 | 100 | 0 | 0 | 100.0% |
| Donkey Kong Country 3 | 100 | 100 | 0 | 0 | 100.0% |
| Factorio | 100 | 100 | 0 | 0 | 100.0% |
| Faxanadu | 100 | 100 | 0 | 0 | 100.0% |
| Final Fantasy | 100 | 100 | 0 | 0 | 100.0% |
| Heretic | 100 | 100 | 0 | 0 | 100.0% |
| Hollow Knight | 100 | 100 | 0 | 0 | 100.0% |
| Hylics 2 | 100 | 100 | 0 | 0 | 100.0% |
| Inscryption | 100 | 100 | 0 | 0 | 100.0% |
| Jak and Daxter: The Precursor Legacy | 100 | 100 | 0 | 0 | 100.0% |
| Kirby's Dream Land 3 | 100 | 97 | 0 | 0 | 97.0% |
| Landstalker - The Treasures of King Nole | 100 | 100 | 0 | 0 | 100.0% |
| Lingo | 100 | 45 | 0 | 0 | 45.0% |
| Lufia II Ancient Cave | 100 | 100 | 0 | 0 | 100.0% |
| Mario & Luigi Superstar Saga | 100 | 100 | 0 | 0 | 100.0% |
| Math Adventure | 100 | 100 | 0 | 0 | 100.0% |
| Mega Man 2 | 100 | 99 | 0 | 0 | 99.0% |
| MegaMan Battle Network 3 | 100 | 100 | 0 | 0 | 100.0% |
| Meritous | 100 | 100 | 0 | 0 | 100.0% |
| Metamath | 100 | 100 | 0 | 0 | 100.0% |
| Muse Dash | 100 | 97 | 0 | 0 | 97.0% |
| Noita | 100 | 100 | 0 | 0 | 100.0% |
| Old School Runescape | 100 | 91 | 0 | 0 | 91.0% |
| Overcooked! 2 | 100 | 67 | 0 | 0 | 67.0% |
| Paint | 100 | 98 | 0 | 0 | 98.0% |
| Pokemon Emerald | 100 | 78 | 0 | 0 | 78.0% |
| Pokemon Red and Blue | 100 | 93 | 0 | 0 | 93.0% |
| Raft | 100 | 100 | 0 | 0 | 100.0% |
| Risk of Rain 2 | 100 | 100 | 0 | 0 | 100.0% |
| SMZ3 | 100 | 100 | 0 | 0 | 100.0% |
| Saving Princess | 100 | 100 | 0 | 0 | 100.0% |
| Sonic Adventure 2 Battle | 100 | 100 | 0 | 0 | 100.0% |
| Subnautica | 100 | 100 | 0 | 0 | 100.0% |
| Sudoku | 100 | 100 | 0 | 0 | 100.0% |
| Super Mario 64 | 100 | 98 | 0 | 0 | 98.0% |
| Super Mario Land 2 | 100 | 98 | 0 | 0 | 98.0% |
| Super Mario World | 100 | 98 | 0 | 0 | 98.0% |
| TOEM original | 100 | 100 | 0 | 0 | 100.0% |
| TOEM rule builder | 100 | 100 | 0 | 0 | 100.0% |
| TUNIC | 100 | 100 | 0 | 0 | 100.0% |
| Terraria | 100 | 98 | 0 | 0 | 98.0% |
| The Legend of Zelda | 100 | 100 | 0 | 0 | 100.0% |
| The Wind Waker | 100 | 54 | 0 | 0 | 54.0% |
| The Witness | 100 | 100 | 0 | 0 | 100.0% |
| Timespinner | 100 | 99 | 0 | 0 | 99.0% |
| Undertale | 100 | 100 | 0 | 0 | 100.0% |
| VVVVVV | 100 | 100 | 0 | 0 | 100.0% |
| Wargroove | 100 | 100 | 0 | 0 | 100.0% |
| Yacht Dice | 100 | 100 | 0 | 0 | 100.0% |
| Yoshi's Island | 100 | 100 | 0 | 0 | 100.0% |
| Yu-Gi-Oh! 2006 | 100 | 100 | 0 | 0 | 100.0% |
| shapez | 100 | 100 | 0 | 0 | 100.0% |

### Unexpected Passes (2)

Games NOT expected to pass pickle mode (not in config or mode not listed) but passed anyway.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| EarthBound | 100 | 100 | 0 | 0 | 100.0% |
| Stardew Valley | 100 | 100 | 0 | 0 | 100.0% |

### Expected Failures (10)

Games NOT expected to pass pickle mode and failed as expected.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Final Fantasy Mystic Quest | 100 | 80 | 0 | 4 | 80.0% |
| Kingdom Hearts 2 | 100 | 44 | 51 | 0 | 44.0% |
| Ocarina of Time | 100 | 0 | 99 | 0 | 0.0% |
| Satisfactory | 100 | 0 | 99 | 0 | 0.0% |
| Secret of Evermore | 100 | 0 | 100 | 0 | 0.0% |
| Shivers | 100 | 0 | 100 | 0 | 0.0% |
| Starcraft 2 | 100 | 0 | 99 | 0 | 0.0% |
| Super Metroid | 100 | 49 | 8 | 0 | 49.0% |
| The Messenger | 100 | 2 | 98 | 0 | 2.0% |
| Zillion | 100 | 78 | 1 | 13 | 78.0% |

### Unexpected Failures (Logic Mismatch) (1)

Games expected to pass pickle mode but failed due to logic mismatches.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Links Awakening DX | 100 | 23 | 77 | 0 | 23.0% |

### Unexpected Failures (Timeout Only) (1)

Games expected to pass pickle mode but failed only due to timeouts.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Kingdom Hearts | 100 | 98 | 0 | 2 | 98.0% |

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
