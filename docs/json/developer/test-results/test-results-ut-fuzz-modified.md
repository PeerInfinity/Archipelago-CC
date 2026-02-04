# Universal Tracker Fuzz Test Results

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Modified)](./test-results-ut-fuzz-comparison-original-modified.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Modified vs Hybrid)](./test-results-ut-fuzz-comparison-modified-hybrid.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-04 04:52:36

**Source Data Created:** 2026-02-04T04:52:36.195266

**Source Data Last Updated:** 2026-02-04T04:52:36.195272

**Universal Tracker Version:** Modified (worldgen-based tracking)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 85
- **Games with 100% Pass Rate:** 62 (72.9%)
- **Games with Failures:** 23 (27.1%)
- **Total Fuzz Runs:** 850
- **Successful Runs:** 626 (73.6%)
- **Failed Runs:** 184
- **Timed Out Runs:** 2
- **Ignored Runs:** 38

### Expected vs Unexpected Results

- **Expected Passes:** 59 (not excluded, passed)
- **Unexpected Passes:** 3 (excluded, but passed)
- **Expected Failures:** 22 (excluded, failed as expected)
- **Unexpected Failures (logic):** 0 (not excluded, logic mismatch)
- **Unexpected Failures (timeout only):** 1 (not excluded, only timeouts)

### Explain Support Summary

- **Games with Explain Stats:** 82
- **Games with 100% Explain Coverage:** 72
- **Games with No Explain Support:** 0
- **Locations with Explain Support:** 14,117
- **Locations without Explain Support:** 609
- **Locations with Default Rule:** 22,041
- **Overall Explain Coverage:** 95.9%

### Generic Exporter/Logic Statistics

Of the 62 games with 100% pass rate:

- **Passing with Generic Exporter:** 39/62 (62.9%)
- **Passing with Generic Logic:** 62/62 (100.0%)
- **Passing with Both Generic:** 39/62 (62.9%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 593.7KB
- **Total Game Logic Code:** 655.3KB
- **Combined Total:** 1249.0KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 18.0KB | ✅ | 231.3KB |
| A Link to the Past | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | 12.6KB | ✅ | 665.3KB |
| A Short Hike | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 410.7KB |
| APQuest | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 26.0KB |
| Aquaria | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.8KB | ✅ | 275.4KB |
| Baking Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 18.2KB |
| Blasphemous | ❌ | 10 | 0 | 4 | 0 | 6 | ❌ 0.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 1043.4KB |
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
| Factorio | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.8KB | ✅ | 497.8KB |
| Faxanadu | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ❌ | 10 | 6 | 0 | 2 | 2 | ⚠️ 60.0% | 13.4KB | ✅ | 549.0KB |
| Heretic | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 367.5KB |
| Hollow Knight | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.2KB |
| Inscryption | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | 757.5KB |
| Kingdom Hearts 2 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 19.5KB | ✅ | 1675.2KB |
| Kirby's Dream Land 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 10.1KB | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.6KB | ✅ | 210.5KB |
| Lingo | ❌ | 10 | 0 | 3 | 0 | 7 | ❌ 0.0% | 38.0KB | 10.7KB | 946.3KB |
| Links Awakening DX | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 7.4KB | ✅ | 714.5KB |
| Lufia II Ancient Cave | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 398.5KB |
| Math Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 52.9KB |
| MegaMan Battle Network 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 209.8KB |
| Meritous | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 57.2KB |
| Metamath | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 48.1KB |
| Muse Dash | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 233.5KB |
| Noita | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 74.6KB |
| Ocarina of Time | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.0KB | ✅ | 308.9KB |
| Overcooked! 2 | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% | 28.5KB | ✅ | 489.2KB |
| Paint | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | ❌ | 10 | 2 | 4 | 0 | 4 | ❌ 20.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 6.5KB | ✅ | 485.4KB |
| Risk of Rain 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 146.1KB |
| SMZ3 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 61.4KB | 51.3KB | 1044.7KB |
| Saving Princess | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 33.8KB |
| Secret of Evermore | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 5.3KB | 7.5KB | 418.7KB |
| Shivers | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 266.2KB |
| Starcraft 2 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 28.7KB | 90.1KB | 1126.6KB |
| Stardew Valley | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 18.8KB | 8.0KB | 2430.2KB |
| Subnautica | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 21.4KB | ✅ | 92.9KB |
| Super Mario Land 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 92.5KB | ✅ | 976.7KB |
| Super Mario World | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | 60.9KB | 114.5KB | 625.4KB |
| TOEM original | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TUNIC | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | 3.1KB | ✅ | 705.5KB |
| Terraria | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 555.6KB |
| The Messenger | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 14.8KB | ✅ | 211.8KB |
| The Wind Waker | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | 14.1KB | ✅ | 401.1KB |
| Timespinner | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 260.8KB |
| Undertale | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 58.0KB |
| VVVVVV | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.8KB | ✅ | 22.8KB |
| Wargroove | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 44.7KB |
| Yacht Dice | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 9.2KB | ✅ | 296.7KB |
| Yu-Gi-Oh! 2006 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| shapez | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 155.5KB |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| Timespinner | 725 | 177 | 448 | 100 | 🔶 28% |
| Pokemon Red and Blue | 280 | 79 | 58 | 143 | ⚠️ 58% |
| Kingdom Hearts 2 | 643 | 46 | 30 | 567 | ⚠️ 61% |
| A Link to the Past | 226 | 113 | 28 | 85 | ⚠️ 80% |
| Blasphemous | 305 | 104 | 20 | 181 | ⚠️ 84% |
| The Wind Waker | 228 | 173 | 16 | 39 | ⚠️ 92% |
| Pokemon Emerald | 817 | 17 | 1 | 799 | ⚠️ 94% |
| Kirby's Dream Land 3 | 832 | 118 | 5 | 709 | ⚠️ 96% |
| The Messenger | 136 | 52 | 2 | 82 | ⚠️ 96% |
| Mega Man 2 | 44 | 29 | 1 | 14 | ⚠️ 97% |
| A Hat in Time | 273 | 90 | 0 | 183 | ✅ 100% |
| A Short Hike | 131 | 82 | 0 | 49 | ✅ 100% |
| APQuest | 6 | 1 | 0 | 5 | ✅ 100% |
| Adventure | 21 | 0 | 0 | 21 | ✅ 100% |
| Aquaria | 218 | 35 | 0 | 183 | ✅ 100% |
| Baking Adventure | 15 | 8 | 0 | 7 | ✅ 100% |
| Bomb Rush Cyberfunk | 247 | 136 | 0 | 111 | ✅ 100% |
| Bumper Stickers | 100 | 38 | 0 | 62 | ✅ 100% |
| Castlevania - Circle of the Moon | 123 | 45 | 0 | 78 | ✅ 100% |
| Castlevania 64 | 294 | 0 | 0 | 294 | ✅ 100% |
| Celeste (Open World) | 1035 | 125 | 0 | 910 | ✅ 100% |
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
| Factorio | 309 | 309 | 0 | 0 | ✅ 100% |
| Faxanadu | 110 | 24 | 0 | 86 | ✅ 100% |
| Final Fantasy | 0 | 0 | 0 | 0 | ✅ 100% |
| Final Fantasy Mystic Quest | 251 | 63 | 0 | 188 | ✅ 100% |
| Heretic | 691 | 0 | 0 | 691 | ✅ 100% |
| Hollow Knight | 731 | 731 | 0 | 0 | ✅ 100% |
| Hylics 2 | 166 | 88 | 0 | 78 | ✅ 100% |
| Inscryption | 100 | 65 | 0 | 35 | ✅ 100% |
| Jak and Daxter: The Precursor Legacy | 439 | 309 | 0 | 130 | ✅ 100% |
| Kingdom Hearts | 523 | 464 | 0 | 59 | ✅ 100% |
| Landstalker - The Treasures of King Nole | 291 | 1 | 0 | 290 | ✅ 100% |
| Lingo | 800 | 800 | 0 | 0 | ✅ 100% |
| Links Awakening DX | 220 | 0 | 0 | 220 | ✅ 100% |
| Lufia II Ancient Cave | 77 | 72 | 0 | 5 | ✅ 100% |
| Mario & Luigi Superstar Saga | 598 | 372 | 0 | 226 | ✅ 100% |
| Math Adventure | 10 | 5 | 0 | 5 | ✅ 100% |
| MegaMan Battle Network 3 | 263 | 80 | 0 | 183 | ✅ 100% |
| Meritous | 104 | 0 | 0 | 104 | ✅ 100% |
| Metamath | 6 | 3 | 0 | 3 | ✅ 100% |
| Muse Dash | 776 | 776 | 0 | 0 | ✅ 100% |
| Noita | 376 | 0 | 0 | 376 | ✅ 100% |
| Old School Runescape | 76 | 68 | 0 | 8 | ✅ 100% |
| Overcooked! 2 | 43 | 9 | 0 | 34 | ✅ 100% |
| Paint | 167 | 167 | 0 | 0 | ✅ 100% |
| Raft | 154 | 141 | 0 | 13 | ✅ 100% |
| Risk of Rain 2 | 672 | 672 | 0 | 0 | ✅ 100% |
| SMZ3 | 316 | 316 | 0 | 0 | ✅ 100% |
| Saving Princess | 36 | 16 | 0 | 20 | ✅ 100% |
| Secret of Evermore | 913 | 724 | 0 | 189 | ✅ 100% |
| Shivers | 76 | 22 | 0 | 54 | ✅ 100% |
| Sonic Adventure 2 Battle | 1046 | 227 | 0 | 819 | ✅ 100% |
| Stardew Valley | 1082 | 938 | 0 | 144 | ✅ 100% |
| Subnautica | 161 | 161 | 0 | 0 | ✅ 100% |
| Super Mario 64 | 164 | 55 | 0 | 109 | ✅ 100% |
| Super Mario Land 2 | 2652 | 2491 | 0 | 161 | ✅ 100% |
| Super Mario World | 743 | 396 | 0 | 347 | ✅ 100% |
| Super Metroid | 36 | 36 | 0 | 0 | ✅ 100% |
| TOEM original | 214 | 4 | 0 | 210 | ✅ 100% |
| TOEM rule builder | 214 | 4 | 0 | 210 | ✅ 100% |
| TUNIC | 6804 | 528 | 0 | 6276 | ✅ 100% |
| Terraria | 128 | 92 | 0 | 36 | ✅ 100% |
| The Legend of Zelda | 155 | 151 | 0 | 4 | ✅ 100% |
| The Witness | 269 | 260 | 0 | 9 | ✅ 100% |
| Undertale | 106 | 95 | 0 | 11 | ✅ 100% |
| VVVVVV | 20 | 2 | 0 | 18 | ✅ 100% |
| Wargroove | 38 | 28 | 0 | 10 | ✅ 100% |
| Yacht Dice | 58 | 58 | 0 | 0 | ✅ 100% |
| Yoshi's Island | 221 | 121 | 0 | 100 | ✅ 100% |
| Yu-Gi-Oh! 2006 | 151 | 63 | 0 | 88 | ✅ 100% |
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

- Final Fantasy
- Kirby's Dream Land 3
- Sudoku

### Unexpected Failures (Timeout Only)

These games failed only due to timeouts, not logic mismatches:

- Final Fantasy Mystic Quest
