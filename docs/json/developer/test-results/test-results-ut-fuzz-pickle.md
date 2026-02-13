# Universal Tracker Fuzz Test Results (Pickle)

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Worldgen)](./test-results-ut-fuzz-comparison-original-worldgen.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-comparison-original-pickle.md) | [View Comparison (Worldgen vs Hybrid)](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | [View Comparison (Worldgen vs Pickle)](./test-results-ut-fuzz-comparison-worldgen-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-13 05:28:22 UTC

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

- **Total Exporter Code:** 618.8KB
- **Total Game Logic Code:** 655.3KB
- **Combined Total:** 1274.1KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ✅ | 100 | 99 | 0 | 0 | 1 | 99.0% | 18.2KB | ✅ | 230.1KB |
| A Link to the Past | ✅ | 100 | 97 | 0 | 0 | 3 | 97.0% | 12.6KB | ✅ | 664.1KB |
| A Short Hike | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 409.8KB |
| APQuest | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 10.9KB |
| Adventure | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 25.6KB |
| Aquaria | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 1.8KB | ✅ | 272.0KB |
| Baking Adventure | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Blasphemous | ✅ | 100 | 56 | 0 | 0 | 44 | ⚠️ 56.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 1.4KB | 40.3KB | 325.2KB |
| Bumper Stickers | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 50.1KB |
| Castlevania - Circle of the Moon | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 4.0KB | ✅ | 93.7KB |
| Castlevania 64 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 137.7KB |
| Celeste (Open World) | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 1039.3KB |
| Celeste 64 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 4.1KB | ✅ | 53.3KB |
| ChecksFinder | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 16.1KB |
| Choo-Choo Charles | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 281.3KB |
| Civilization VI | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 163.0KB |
| Coding Adventure | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| DLCQuest | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 1.2KB | ✅ | 49.7KB |
| DOOM 1993 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 275.6KB |
| DOOM II | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 322.4KB |
| Dark Souls III | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 1033.9KB |
| Donkey Kong Country 3 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 122.3KB |
| EarthBound | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 337.5KB |
| Factorio | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 8.8KB | ✅ | 290.0KB |
| Faxanadu | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 68.0KB |
| Final Fantasy | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ❌ | 100 | 80 | 0 | 4 | 16 | ⚠️ 80.0% | 13.9KB | ✅ | 548.0KB |
| Heretic | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 361.3KB |
| Hollow Knight | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 100.3KB |
| Inscryption | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 8.0KB | ✅ | 83.0KB |
| Jak and Daxter: The Precursor Legacy | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ❌ | 100 | 98 | 0 | 2 | 0 | 98.0% | ✅ | ✅ | 748.6KB |
| Kingdom Hearts 2 | ❌ | 100 | 44 | 51 | 0 | 5 | ❌ 44.0% | 19.5KB | ✅ | 1634.7KB |
| Kirby's Dream Land 3 | ✅ | 100 | 97 | 0 | 0 | 3 | 97.0% | 10.1KB | ✅ | 528.6KB |
| Landstalker - The Treasures of King Nole | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 3.6KB | ✅ | 209.1KB |
| Lingo | ✅ | 100 | 45 | 0 | 0 | 55 | ❌ 45.0% | 38.0KB | 10.7KB | 939.9KB |
| Links Awakening DX | ❌ | 100 | 23 | 77 | 0 | 0 | ❌ 23.0% | 7.4KB | ✅ | 703.0KB |
| Lufia II Ancient Cave | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 122.7KB |
| Mario & Luigi Superstar Saga | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 395.4KB |
| Math Adventure | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Mega Man 2 | ✅ | 100 | 99 | 0 | 0 | 1 | 99.0% | ✅ | ✅ | 51.6KB |
| MegaMan Battle Network 3 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 204.6KB |
| Meritous | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 56.7KB |
| Metamath | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 45.8KB |
| Muse Dash | ✅ | 100 | 97 | 0 | 0 | 3 | 97.0% | ✅ | ✅ | 217.4KB |
| Noita | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 73.8KB |
| Ocarina of Time | ❌ | 100 | 0 | 99 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | 100 | 91 | 0 | 0 | 9 | 91.0% | 1.0KB | ✅ | 305.1KB |
| Overcooked! 2 | ✅ | 100 | 67 | 0 | 0 | 33 | ⚠️ 67.0% | 28.5KB | ✅ | 488.2KB |
| Paint | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | 2.7KB | ✅ | 123.0KB |
| Pokemon Emerald | ✅ | 100 | 78 | 0 | 0 | 22 | ⚠️ 78.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ✅ | 100 | 93 | 0 | 0 | 7 | 93.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 6.5KB | ✅ | 198.3KB |
| Risk of Rain 2 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 145.0KB |
| SMZ3 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 61.4KB | 51.3KB | 1044.7KB |
| Satisfactory | ❌ | 100 | 0 | 99 | 0 | 1 | ❌ 0.0% | 41.6KB | ✅ | 1618.9KB |
| Saving Princess | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 33.3KB |
| Secret of Evermore | ❌ | 100 | 0 | 100 | 0 | 0 | ❌ 0.0% | 5.3KB | 7.5KB | 414.9KB |
| Shivers | ❌ | 100 | 0 | 100 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 149.8KB |
| Sonic Adventure 2 Battle | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 262.1KB |
| Starcraft 2 | ❌ | 100 | 0 | 99 | 0 | 1 | ❌ 0.0% | 28.7KB | 90.1KB | 1086.7KB |
| Stardew Valley | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 18.8KB | 8.0KB | 2407.6KB |
| Subnautica | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 205.4KB |
| Sudoku | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | ✅ | ✅ | 100.9KB |
| Super Mario Land 2 | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | 96.3KB | ✅ | 918.7KB |
| Super Mario World | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | ✅ | ✅ | 177.6KB |
| Super Metroid | ❌ | 100 | 49 | 8 | 0 | 43 | ❌ 49.0% | 60.9KB | 114.5KB | 625.0KB |
| TOEM original | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 99.6KB |
| TOEM rule builder | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 99.6KB |
| TUNIC | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 3.1KB | ✅ | 649.1KB |
| Terraria | ✅ | 100 | 98 | 0 | 0 | 2 | 98.0% | 16.8KB | ✅ | 278.6KB |
| The Legend of Zelda | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 554.5KB |
| The Messenger | ❌ | 100 | 2 | 98 | 0 | 0 | ❌ 2.0% | 15.2KB | ✅ | 210.3KB |
| The Wind Waker | ✅ | 100 | 54 | 0 | 0 | 46 | ⚠️ 54.0% | 7.0KB | ✅ | 250.1KB |
| The Witness | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 14.1KB | ✅ | 392.1KB |
| Timespinner | ✅ | 100 | 99 | 0 | 0 | 1 | 99.0% | 2.2KB | ✅ | 262.7KB |
| Undertale | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 56.0KB |
| VVVVVV | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 3.8KB | ✅ | 22.4KB |
| Wargroove | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 44.0KB |
| Yacht Dice | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 0.9KB | 285.0KB | 248.4KB |
| Yoshi's Island | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 9.2KB | ✅ | 295.2KB |
| Yu-Gi-Oh! 2006 | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ | 100 | 78 | 1 | 13 | 8 | ⚠️ 78.0% | ✅ | ✅ | N/A |
| shapez | ✅ | 100 | 100 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 153.7KB |

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
