# Universal Tracker Fuzz Test Results

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Modified)](./test-results-ut-fuzz-comparison-original-modified.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Modified vs Hybrid)](./test-results-ut-fuzz-comparison-modified-hybrid.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-04 04:16:22

**Source Data Created:** 2026-02-04T04:16:22.101618

**Source Data Last Updated:** 2026-02-04T04:16:22.101624

**Universal Tracker Version:** Modified (worldgen-based tracking)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 85
- **Games with 100% Pass Rate:** 47 (55.3%)
- **Games with Failures:** 38 (44.7%)
- **Total Fuzz Runs:** 850
- **Successful Runs:** 543 (63.9%)
- **Failed Runs:** 267
- **Timed Out Runs:** 1
- **Ignored Runs:** 39

### Expected vs Unexpected Results

- **Expected Passes:** 35 (not excluded, passed)
- **Unexpected Passes:** 12 (excluded, but passed)
- **Expected Failures:** 13 (excluded, failed as expected)
- **Unexpected Failures (logic):** 25 (not excluded, logic mismatch)
- **Unexpected Failures (timeout only):** 0 (not excluded, only timeouts)

### Explain Support Summary

- **Games with Explain Stats:** 83
- **Games with 100% Explain Coverage:** 12
- **Games with No Explain Support:** 71
- **Locations with Explain Support:** 4
- **Locations without Explain Support:** 15,241
- **Locations with Default Rule:** 21,159
- **Overall Explain Coverage:** 0.0%

### Generic Exporter/Logic Statistics

Of the 47 games with 100% pass rate:

- **Passing with Generic Exporter:** 31/47 (66.0%)
- **Passing with Generic Logic:** 42/47 (89.4%)
- **Passing with Both Generic:** 31/47 (66.0%)

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
| Castlevania 64 | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | ✅ | ✅ | 138.5KB |
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
| Faxanadu | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ❌ | 10 | 0 | 6 | 1 | 3 | ❌ 0.0% | 13.4KB | ✅ | 549.0KB |
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
| Mega Man 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 52.9KB |
| MegaMan Battle Network 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 209.8KB |
| Meritous | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 57.2KB |
| Metamath | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | 48.1KB |
| Muse Dash | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | ✅ | ✅ | 233.5KB |
| Noita | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 74.6KB |
| Ocarina of Time | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.0KB | ✅ | 308.9KB |
| Overcooked! 2 | ❌ | 10 | 3 | 2 | 0 | 5 | ❌ 30.0% | 28.5KB | ✅ | 489.2KB |
| Paint | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | ❌ | 10 | 2 | 4 | 0 | 4 | ❌ 20.0% | 5.2KB | 8.7KB | 1390.9KB |
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
| Super Mario Land 2 | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | 92.5KB | ✅ | 976.7KB |
| Super Mario World | ❌ | 10 | 7 | 2 | 0 | 1 | ⚠️ 70.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ | 10 | 1 | 7 | 0 | 2 | ❌ 10.0% | 60.9KB | 114.5KB | 625.4KB |
| TOEM original | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TUNIC | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.1KB | ✅ | 705.5KB |
| Terraria | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 555.6KB |
| The Messenger | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | 14.8KB | ✅ | 211.8KB |
| The Wind Waker | ❌ | 10 | 1 | 4 | 0 | 5 | ❌ 10.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 14.1KB | ✅ | 401.1KB |
| Timespinner | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 2.2KB | ✅ | 260.8KB |
| Undertale | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 58.0KB |
| VVVVVV | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | 3.8KB | ✅ | 22.8KB |
| Wargroove | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 44.7KB |
| Yacht Dice | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | 9.2KB | ✅ | 296.7KB |
| Yu-Gi-Oh! 2006 | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| shapez | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | 155.5KB |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| A Hat in Time | 278 | 0 | 131 | 147 | ❌ 0% |
| A Link to the Past | 280 | 0 | 173 | 107 | ❌ 0% |
| A Short Hike | 131 | 0 | 82 | 49 | ❌ 0% |
| APQuest | 6 | 0 | 1 | 5 | ❌ 0% |
| Aquaria | 218 | 0 | 35 | 183 | ❌ 0% |
| Baking Adventure | 15 | 0 | 8 | 7 | ❌ 0% |
| Blasphemous | 305 | 0 | 305 | 0 | ❌ 0% |
| Bomb Rush Cyberfunk | 247 | 0 | 136 | 111 | ❌ 0% |
| Bumper Stickers | 100 | 0 | 38 | 62 | ❌ 0% |
| Castlevania - Circle of the Moon | 123 | 0 | 46 | 77 | ❌ 0% |
| Celeste (Open World) | 1035 | 0 | 125 | 910 | ❌ 0% |
| Celeste 64 | 54 | 0 | 54 | 0 | ❌ 0% |
| ChecksFinder | 25 | 0 | 20 | 5 | ❌ 0% |
| Choo-Choo Charles | 691 | 0 | 64 | 627 | ❌ 0% |
| Civilization VI | 270 | 0 | 91 | 179 | ❌ 0% |
| Coding Adventure | 61 | 0 | 43 | 18 | ❌ 0% |
| DLCQuest | 31 | 0 | 22 | 9 | ❌ 0% |
| Dark Souls III | 1190 | 0 | 208 | 982 | ❌ 0% |
| Factorio | 309 | 0 | 309 | 0 | ❌ 0% |
| Faxanadu | 110 | 0 | 24 | 86 | ❌ 0% |
| Final Fantasy Mystic Quest | 251 | 0 | 63 | 188 | ❌ 0% |
| Hollow Knight | 731 | 0 | 731 | 0 | ❌ 0% |
| Hylics 2 | 166 | 0 | 88 | 78 | ❌ 0% |
| Inscryption | 100 | 0 | 65 | 35 | ❌ 0% |
| Jak and Daxter: The Precursor Legacy | 439 | 0 | 309 | 130 | ❌ 0% |
| Kingdom Hearts | 523 | 0 | 481 | 42 | ❌ 0% |
| Kingdom Hearts 2 | 643 | 0 | 76 | 567 | ❌ 0% |
| Kirby's Dream Land 3 | 832 | 0 | 123 | 709 | ❌ 0% |
| Landstalker - The Treasures of King Nole | 291 | 0 | 1 | 290 | ❌ 0% |
| Lingo | 800 | 0 | 800 | 0 | ❌ 0% |
| Lufia II Ancient Cave | 97 | 0 | 92 | 5 | ❌ 0% |
| Mario & Luigi Superstar Saga | 598 | 0 | 372 | 226 | ❌ 0% |
| Math Adventure | 10 | 0 | 5 | 5 | ❌ 0% |
| Mega Man 2 | 44 | 0 | 30 | 14 | ❌ 0% |
| MegaMan Battle Network 3 | 263 | 0 | 80 | 183 | ❌ 0% |
| Metamath | 3 | 0 | 1 | 2 | ❌ 0% |
| Muse Dash | 828 | 0 | 828 | 0 | ❌ 0% |
| Old School Runescape | 127 | 0 | 115 | 12 | ❌ 0% |
| Overcooked! 2 | 43 | 0 | 43 | 0 | ❌ 0% |
| Paint | 167 | 0 | 167 | 0 | ❌ 0% |
| Pokemon Emerald | 817 | 0 | 18 | 799 | ❌ 0% |
| Pokemon Red and Blue | 280 | 0 | 137 | 143 | ❌ 0% |
| Raft | 154 | 0 | 154 | 0 | ❌ 0% |
| Risk of Rain 2 | 672 | 0 | 672 | 0 | ❌ 0% |
| SMZ3 | 316 | 0 | 316 | 0 | ❌ 0% |
| Saving Princess | 36 | 0 | 16 | 20 | ❌ 0% |
| Secret of Evermore | 913 | 0 | 913 | 0 | ❌ 0% |
| Shivers | 76 | 0 | 22 | 54 | ❌ 0% |
| Sonic Adventure 2 Battle | 1046 | 0 | 227 | 819 | ❌ 0% |
| Stardew Valley | 1068 | 0 | 995 | 73 | ❌ 0% |
| Subnautica | 161 | 0 | 161 | 0 | ❌ 0% |
| Super Mario 64 | 164 | 0 | 55 | 109 | ❌ 0% |
| Super Mario Land 2 | 2652 | 0 | 2491 | 161 | ❌ 0% |
| Super Mario World | 743 | 0 | 396 | 347 | ❌ 0% |
| Super Metroid | 100 | 0 | 100 | 0 | ❌ 0% |
| TOEM original | 214 | 0 | 4 | 210 | ❌ 0% |
| TUNIC | 6837 | 0 | 596 | 6241 | ❌ 0% |
| Terraria | 128 | 0 | 128 | 0 | ❌ 0% |
| The Legend of Zelda | 155 | 0 | 151 | 4 | ❌ 0% |
| The Messenger | 136 | 0 | 61 | 75 | ❌ 0% |
| The Wind Waker | 228 | 0 | 228 | 0 | ❌ 0% |
| The Witness | 269 | 0 | 260 | 9 | ❌ 0% |
| Timespinner | 203 | 0 | 109 | 94 | ❌ 0% |
| Undertale | 106 | 0 | 95 | 11 | ❌ 0% |
| VVVVVV | 20 | 0 | 2 | 18 | ❌ 0% |
| Wargroove | 38 | 0 | 38 | 0 | ❌ 0% |
| Yacht Dice | 55 | 0 | 55 | 0 | ❌ 0% |
| Yoshi's Island | 221 | 0 | 221 | 0 | ❌ 0% |
| Yu-Gi-Oh! 2006 | 151 | 0 | 63 | 88 | ❌ 0% |
| Zillion | 147 | 0 | 147 | 0 | ❌ 0% |
| shapez | 2870 | 0 | 25 | 2845 | ❌ 0% |
| Adventure | 21 | 0 | 0 | 21 | ✅ 100% |
| Castlevania 64 | 221 | 0 | 0 | 221 | ✅ 100% |
| DOOM 1993 | 474 | 0 | 0 | 474 | ✅ 100% |
| DOOM II | 453 | 0 | 0 | 453 | ✅ 100% |
| Donkey Kong Country 3 | 219 | 0 | 0 | 219 | ✅ 100% |
| Final Fantasy | 0 | 0 | 0 | 0 | ✅ 100% |
| Heretic | 691 | 0 | 0 | 691 | ✅ 100% |
| Links Awakening DX | 220 | 0 | 0 | 220 | ✅ 100% |
| Meritous | 104 | 0 | 0 | 104 | ✅ 100% |
| Noita | 376 | 0 | 0 | 376 | ✅ 100% |
| Sudoku | 0 | 0 | 0 | 0 | ✅ 100% |
| TOEM rule builder | 214 | 4 | 0 | 210 | ✅ 100% |

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
