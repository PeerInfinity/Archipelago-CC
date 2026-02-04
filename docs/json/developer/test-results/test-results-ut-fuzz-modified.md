# Universal Tracker Fuzz Test Results

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Modified)](./test-results-ut-fuzz-comparison-original-modified.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Modified vs Hybrid)](./test-results-ut-fuzz-comparison-modified-hybrid.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-04 04:25:03

**Source Data Created:** 2026-02-04T04:25:03.137992

**Source Data Last Updated:** 2026-02-04T04:25:03.137998

**Universal Tracker Version:** Modified (worldgen-based tracking)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 85
- **Games with 100% Pass Rate:** 46 (54.1%)
- **Games with Failures:** 39 (45.9%)
- **Total Fuzz Runs:** 850
- **Successful Runs:** 541 (63.6%)
- **Failed Runs:** 270
- **Timed Out Runs:** 1
- **Ignored Runs:** 38

### Expected vs Unexpected Results

- **Expected Passes:** 34 (not excluded, passed)
- **Unexpected Passes:** 12 (excluded, but passed)
- **Expected Failures:** 13 (excluded, failed as expected)
- **Unexpected Failures (logic):** 26 (not excluded, logic mismatch)
- **Unexpected Failures (timeout only):** 0 (not excluded, only timeouts)

### Explain Support Summary

- **Games with Explain Stats:** 73
- **Games with 100% Explain Coverage:** 68
- **Games with No Explain Support:** 0
- **Locations with Explain Support:** 4,751
- **Locations without Explain Support:** 67
- **Locations with Default Rule:** 8,352
- **Overall Explain Coverage:** 98.6%

### Generic Exporter/Logic Statistics

Of the 46 games with 100% pass rate:

- **Passing with Generic Exporter:** 30/46 (65.2%)
- **Passing with Generic Logic:** 41/46 (89.1%)
- **Passing with Both Generic:** 30/46 (65.2%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 593.7KB
- **Total Game Logic Code:** 655.3KB
- **Combined Total:** 1249.0KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 18.0KB | ✅ | 231.3KB |
| A Link to the Past | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | 12.6KB | ✅ | 665.3KB |
| A Short Hike | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 410.7KB |
| APQuest | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 11.0KB |
| Adventure | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% | ✅ | ✅ | 26.0KB |
| Aquaria | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.8KB | ✅ | 275.4KB |
| Baking Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 18.2KB |
| Blasphemous | ✅ | 10 | 4 | 0 | 0 | 6 | ❌ 40.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 138.5KB |
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
| Donkey Kong Country 3 | ❌ | 10 | 7 | 3 | 0 | 0 | ⚠️ 70.0% | ✅ | ✅ | 122.5KB |
| Factorio | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 8.8KB | ✅ | 497.8KB |
| Faxanadu | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | 13.4KB | ✅ | 549.0KB |
| Heretic | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 367.5KB |
| Hollow Knight | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.2KB |
| Inscryption | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | ✅ | ✅ | 757.5KB |
| Kingdom Hearts 2 | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | 19.5KB | ✅ | 1675.2KB |
| Kirby's Dream Land 3 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 10.1KB | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | 3.6KB | ✅ | 210.5KB |
| Lingo | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% | 38.0KB | 10.7KB | 946.3KB |
| Links Awakening DX | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | 7.4KB | ✅ | 714.5KB |
| Lufia II Ancient Cave | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 398.5KB |
| Math Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% | ✅ | ✅ | 52.9KB |
| MegaMan Battle Network 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 209.8KB |
| Meritous | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 57.2KB |
| Metamath | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | 48.1KB |
| Muse Dash | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | ✅ | ✅ | 233.5KB |
| Noita | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 74.6KB |
| Ocarina of Time | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.0KB | ✅ | 308.9KB |
| Overcooked! 2 | ❌ | 10 | 3 | 2 | 0 | 5 | ❌ 30.0% | 28.5KB | ✅ | 489.2KB |
| Paint | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | ❌ | 10 | 3 | 3 | 0 | 4 | ❌ 30.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 6.5KB | ✅ | 485.4KB |
| Risk of Rain 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 146.1KB |
| SMZ3 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 61.4KB | 51.3KB | 1044.7KB |
| Saving Princess | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 33.8KB |
| Secret of Evermore | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 5.3KB | 7.5KB | 418.7KB |
| Shivers | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | ✅ | ✅ | 266.2KB |
| Starcraft 2 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 28.7KB | 90.1KB | 1126.6KB |
| Stardew Valley | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 18.8KB | 8.0KB | 2430.2KB |
| Subnautica | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Super Mario 64 | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | 21.4KB | ✅ | 92.9KB |
| Super Mario Land 2 | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | 92.5KB | ✅ | 976.7KB |
| Super Mario World | ❌ | 10 | 7 | 2 | 0 | 1 | ⚠️ 70.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | 60.9KB | 114.5KB | 625.4KB |
| TOEM original | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TUNIC | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.1KB | ✅ | 705.5KB |
| Terraria | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 555.6KB |
| The Messenger | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 14.8KB | ✅ | 211.8KB |
| The Wind Waker | ❌ | 10 | 1 | 4 | 0 | 5 | ❌ 10.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 14.1KB | ✅ | 401.1KB |
| Timespinner | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 2.2KB | ✅ | 260.8KB |
| Undertale | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 58.0KB |
| VVVVVV | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | 3.8KB | ✅ | 22.8KB |
| Wargroove | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 44.7KB |
| Yacht Dice | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | 9.2KB | ✅ | 296.7KB |
| Yu-Gi-Oh! 2006 | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ | 10 | 0 | 8 | 1 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| shapez | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | 155.5KB |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| A Short Hike | 131 | 33 | 15 | 83 | ⚠️ 69% |
| Timespinner | 180 | 74 | 14 | 92 | ⚠️ 84% |
| A Link to the Past | 249 | 171 | 29 | 49 | ⚠️ 86% |
| Mega Man 2 | 44 | 9 | 1 | 34 | ⚠️ 90% |
| The Wind Waker | 108 | 83 | 8 | 17 | ⚠️ 91% |
| A Hat in Time | 223 | 61 | 0 | 162 | ✅ 100% |
| APQuest | 6 | 1 | 0 | 5 | ✅ 100% |
| Adventure | 24 | 3 | 0 | 21 | ✅ 100% |
| Aquaria | 218 | 37 | 0 | 181 | ✅ 100% |
| Baking Adventure | 15 | 8 | 0 | 7 | ✅ 100% |
| Bomb Rush Cyberfunk | 247 | 136 | 0 | 111 | ✅ 100% |
| Bumper Stickers | 100 | 38 | 0 | 62 | ✅ 100% |
| Castlevania - Circle of the Moon | 124 | 46 | 0 | 78 | ✅ 100% |
| Castlevania 64 | 213 | 0 | 0 | 213 | ✅ 100% |
| Celeste 64 | 40 | 26 | 0 | 14 | ✅ 100% |
| ChecksFinder | 25 | 20 | 0 | 5 | ✅ 100% |
| Choo-Choo Charles | 691 | 64 | 0 | 627 | ✅ 100% |
| Civilization VI | 148 | 0 | 0 | 148 | ✅ 100% |
| Coding Adventure | 61 | 43 | 0 | 18 | ✅ 100% |
| DLCQuest | 29 | 20 | 0 | 9 | ✅ 100% |
| DOOM 1993 | 348 | 0 | 0 | 348 | ✅ 100% |
| DOOM II | 453 | 0 | 0 | 453 | ✅ 100% |
| Dark Souls III | 1190 | 207 | 0 | 983 | ✅ 100% |
| Donkey Kong Country 3 | 180 | 0 | 0 | 180 | ✅ 100% |
| Factorio | 179 | 179 | 0 | 0 | ✅ 100% |
| Faxanadu | 110 | 24 | 0 | 86 | ✅ 100% |
| Final Fantasy Mystic Quest | 251 | 61 | 0 | 190 | ✅ 100% |
| Heretic | 502 | 0 | 0 | 502 | ✅ 100% |
| Hylics 2 | 133 | 70 | 0 | 63 | ✅ 100% |
| Inscryption | 100 | 67 | 0 | 33 | ✅ 100% |
| Kingdom Hearts | 511 | 381 | 0 | 130 | ✅ 100% |
| Landstalker - The Treasures of King Nole | 291 | 1 | 0 | 290 | ✅ 100% |
| Links Awakening DX | 220 | 0 | 0 | 220 | ✅ 100% |
| Lufia II Ancient Cave | 35 | 30 | 0 | 5 | ✅ 100% |
| Mario & Luigi Superstar Saga | 556 | 339 | 0 | 217 | ✅ 100% |
| Math Adventure | 10 | 5 | 0 | 5 | ✅ 100% |
| MegaMan Battle Network 3 | 263 | 80 | 0 | 183 | ✅ 100% |
| Meritous | 104 | 0 | 0 | 104 | ✅ 100% |
| Metamath | 9 | 5 | 0 | 4 | ✅ 100% |
| Muse Dash | 90 | 90 | 0 | 0 | ✅ 100% |
| Noita | 109 | 0 | 0 | 109 | ✅ 100% |
| Old School Runescape | 54 | 47 | 0 | 7 | ✅ 100% |
| Overcooked! 2 | 43 | 8 | 0 | 35 | ✅ 100% |
| Paint | 130 | 130 | 0 | 0 | ✅ 100% |
| Pokemon Emerald | 203 | 15 | 0 | 188 | ✅ 100% |
| Pokemon Red and Blue | 161 | 21 | 0 | 140 | ✅ 100% |
| Raft | 154 | 141 | 0 | 13 | ✅ 100% |
| Risk of Rain 2 | 221 | 221 | 0 | 0 | ✅ 100% |
| SMZ3 | 316 | 231 | 0 | 85 | ✅ 100% |
| Saving Princess | 36 | 16 | 0 | 20 | ✅ 100% |
| Secret of Evermore | 339 | 282 | 0 | 57 | ✅ 100% |
| Shivers | 76 | 22 | 0 | 54 | ✅ 100% |
| Sonic Adventure 2 Battle | 206 | 112 | 0 | 94 | ✅ 100% |
| Stardew Valley | 491 | 0 | 0 | 491 | ✅ 100% |
| Subnautica | 131 | 131 | 0 | 0 | ✅ 100% |
| Super Mario 64 | 149 | 26 | 0 | 123 | ✅ 100% |
| Super Mario Land 2 | 53 | 29 | 0 | 24 | ✅ 100% |
| Super Mario World | 108 | 1 | 0 | 107 | ✅ 100% |
| Super Metroid | 100 | 100 | 0 | 0 | ✅ 100% |
| TOEM original | 156 | 4 | 0 | 152 | ✅ 100% |
| TOEM rule builder | 156 | 4 | 0 | 152 | ✅ 100% |
| TUNIC | 302 | 87 | 0 | 215 | ✅ 100% |
| Terraria | 63 | 23 | 0 | 40 | ✅ 100% |
| The Legend of Zelda | 155 | 152 | 0 | 3 | ✅ 100% |
| The Messenger | 106 | 53 | 0 | 53 | ✅ 100% |
| The Witness | 132 | 101 | 0 | 31 | ✅ 100% |
| Undertale | 48 | 39 | 0 | 9 | ✅ 100% |
| VVVVVV | 20 | 2 | 0 | 18 | ✅ 100% |
| Wargroove | 38 | 28 | 0 | 10 | ✅ 100% |
| Yacht Dice | 89 | 89 | 0 | 0 | ✅ 100% |
| Yoshi's Island | 191 | 161 | 0 | 30 | ✅ 100% |
| Yu-Gi-Oh! 2006 | 84 | 63 | 0 | 21 | ✅ 100% |
| shapez | 139 | 0 | 0 | 139 | ✅ 100% |

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

### Unexpected Passes

- Blasphemous
- Bomb Rush Cyberfunk
- Celeste (Open World)
- Final Fantasy
- Jak and Daxter: The Precursor Legacy
- Lingo
- Raft
- Secret of Evermore
- Stardew Valley
- Sudoku
- TUNIC
- The Witness

### Unexpected Failures (Logic Mismatch)

These games have actual logic mismatches between UT and Python:

- A Hat in Time
- A Link to the Past
- Adventure
- Castlevania 64
- Donkey Kong Country 3
- Factorio
- Faxanadu
- Final Fantasy Mystic Quest
- Landstalker - The Treasures of King Nole
- Links Awakening DX
- Mega Man 2
- Metamath
- Muse Dash
- Overcooked! 2
- Shivers
- Sonic Adventure 2 Battle
- Subnautica
- Super Mario 64
- Super Mario Land 2
- Super Mario World
- The Messenger
- The Wind Waker
- Timespinner
- VVVVVV
- Yoshi's Island
- shapez
