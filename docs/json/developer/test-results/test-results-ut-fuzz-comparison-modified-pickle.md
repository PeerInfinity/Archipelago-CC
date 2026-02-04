# Universal Tracker Fuzz Test Comparison: Modified vs Pickle

**Generated:** 2026-02-04 19:19:22

**Source Data Last Updated:** 2026-02-04T05:43:50

This report compares fuzz test results between the Modified Universal Tracker (worldgen-based tracking) and the Pickle-based Universal Tracker (loads serialized multiworld).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Modified UT Results](./test-results-ut-fuzz-modified.md)
- [Pickle UT Results](./test-results-ut-fuzz-pickle.md)

## Summary

- **Total Games Tested:** 85
- **Passing Both:** 59 (69.4%)
- **Passing Modified Only:** 2 (2.4%)
- **Passing Pickle Only:** 16 (18.8%)
- **Passing Neither:** 8 (9.4%)
- **Passing Pickle with no custom code:** 43 (50.6%)
- **Passing Pickle Only with no custom code:** 4 (4.7%)

## Full Comparison

| Game Name | Modified Success Rate | Pickle Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ✅ 99.0% | ✅ 100.0% | 18.2KB | ✅ | 231.1KB |
| A Link to the Past | ✅ 97.0% | ✅ 80.0% | 12.6KB | ✅ | 667.7KB |
| A Short Hike | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 410.7KB |
| APQuest | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 11.0KB |
| Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 26.0KB |
| Aquaria | ✅ 100.0% | ✅ 100.0% | 1.8KB | ✅ | 275.1KB |
| Baking Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 18.2KB |
| Blasphemous | ❌ 0.0% | ✅ 40.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ❌ 0.0% | ✅ 100.0% | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ 100.0% | ✅ 100.0% | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | ❌ 0.0% | ✅ 100.0% | ✅ | ✅ | 1043.4KB |
| Celeste 64 | ✅ 100.0% | ✅ 100.0% | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 16.2KB |
| Choo-Choo Charles | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 282.3KB |
| Civilization VI | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 166.9KB |
| Coding Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 54.9KB |
| DLCQuest | ✅ 100.0% | ✅ 100.0% | 1.2KB | ✅ | 51.0KB |
| DOOM 1993 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 280.1KB |
| DOOM II | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 326.5KB |
| Dark Souls III | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 1062.0KB |
| Donkey Kong Country 3 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 122.5KB |
| Factorio | ✅ 100.0% | ✅ 100.0% | 8.8KB | ✅ | 295.0KB |
| Faxanadu | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ⚠️ 80.0% | ⚠️ 70.0% | 13.4KB | ✅ | 549.5KB |
| Heretic | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 367.5KB |
| Hollow Knight | ❌ 0.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Hylics 2 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 101.9KB |
| Inscryption | ✅ 100.0% | ✅ 100.0% | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | ❌ 1.0% | ✅ 100.0% | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ❌ 15.0% | ✅ 100.0% | ✅ | ✅ | 753.6KB |
| Kingdom Hearts 2 | ❌ 0.0% | ❌ 10.0% | 19.5KB | ✅ | 1641.1KB |
| Kirby's Dream Land 3 | ⚠️ 87.0% | ✅ 100.0% | 10.1KB | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | ✅ 100.0% | ✅ 100.0% | 3.6KB | ✅ | 210.5KB |
| Lingo | ❌ 2.0% | ✅ 30.0% | 38.0KB | 10.7KB | 946.3KB |
| Links Awakening DX | ✅ 100.0% | ✅ 100.0% | 7.4KB | ✅ | 714.5KB |
| Lufia II Ancient Cave | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 398.5KB |
| Math Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ✅ 99.0% | ✅ 100.0% | ✅ | ✅ | 51.5KB |
| MegaMan Battle Network 3 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 209.8KB |
| Meritous | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 57.2KB |
| Metamath | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 48.1KB |
| Muse Dash | ✅ 97.0% | ✅ 100.0% | ✅ | ✅ | 233.5KB |
| Noita | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 74.6KB |
| Ocarina of Time | ❌ 0.0% | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ 91.0% | ✅ 100.0% | 1.0KB | ✅ | 307.1KB |
| Overcooked! 2 | ✅ 67.0% | ✅ 50.0% | 28.5KB | ✅ | 489.2KB |
| Paint | ✅ 98.0% | ✅ 100.0% | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | ❌ 29.0% | ✅ 60.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ❌ 0.0% | ✅ 90.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ❌ 0.0% | ✅ 100.0% | 6.5KB | ✅ | 205.9KB |
| Risk of Rain 2 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 146.1KB |
| SMZ3 | ❌ 0.0% | ✅ 100.0% | 61.4KB | 51.3KB | 1044.7KB |
| Saving Princess | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 33.8KB |
| Secret of Evermore | ❌ 0.0% | ❌ 0.0% | 5.3KB | 7.5KB | 418.7KB |
| Shivers | ✅ 100.0% | ⚠️ 90.0% | ✅ | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 266.2KB |
| Starcraft 2 | ❌ 0.0% | ❌ 0.0% | 28.7KB | 90.1KB | 1126.8KB |
| Stardew Valley | ❌ 0.0% | ⚠️ 80.0% | 18.8KB | 8.0KB | 2430.2KB |
| Subnautica | ✅ 100.0% | ✅ 100.0% | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 93.2KB |
| Super Mario Land 2 | ✅ 98.0% | ✅ 100.0% | 96.3KB | ✅ | 982.7KB |
| Super Mario World | ✅ 98.0% | ✅ 90.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ 0.0% | ⚠️ 60.0% | 60.9KB | 114.5KB | 625.4KB |
| TOEM original | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 102.8KB |
| TUNIC | ⚠️ 56.0% | ✅ 100.0% | 3.1KB | ✅ | 653.3KB |
| Terraria | ✅ 98.0% | ✅ 90.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 555.3KB |
| The Messenger | ✅ 100.0% | ⚠️ 80.0% | 15.2KB | ✅ | 211.8KB |
| The Wind Waker | ✅ 54.0% | ✅ 50.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | ❌ 11.0% | ✅ 100.0% | 14.1KB | ✅ | 398.4KB |
| Timespinner | ✅ 99.0% | ✅ 100.0% | 2.2KB | ✅ | 267.3KB |
| Undertale | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 58.0KB |
| VVVVVV | ✅ 100.0% | ✅ 100.0% | 3.8KB | ✅ | 22.8KB |
| Wargroove | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 44.7KB |
| Yacht Dice | ❌ 0.0% | ✅ 100.0% | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | ✅ 100.0% | ✅ 100.0% | 9.2KB | ✅ | 296.7KB |
| Yu-Gi-Oh! 2006 | ❌ 0.0% | ✅ 100.0% | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ 0.0% | ⚠️ 80.0% | ✅ | ✅ | N/A |
| shapez | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 155.3KB |

## Games Passing Both (59)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Hat in Time | 18.2KB | ✅ | 231.1KB |
| A Link to the Past | 12.6KB | ✅ | 667.7KB |
| A Short Hike | ✅ | ✅ | 410.7KB |
| APQuest | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | ✅ | 26.0KB |
| Aquaria | 1.8KB | ✅ | 275.1KB |
| Baking Adventure | ✅ | ✅ | 18.2KB |
| Bumper Stickers | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ✅ | ✅ | 138.5KB |
| Celeste 64 | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | ✅ | ✅ | 16.2KB |
| Choo-Choo Charles | ✅ | ✅ | 282.3KB |
| Civilization VI | ✅ | ✅ | 166.9KB |
| Coding Adventure | ✅ | ✅ | 54.9KB |
| DLCQuest | 1.2KB | ✅ | 51.0KB |
| DOOM 1993 | ✅ | ✅ | 280.1KB |
| DOOM II | ✅ | ✅ | 326.5KB |
| Dark Souls III | ✅ | ✅ | 1062.0KB |
| Donkey Kong Country 3 | ✅ | ✅ | 122.5KB |
| Factorio | 8.8KB | ✅ | 295.0KB |
| Faxanadu | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ | ✅ | N/A |
| Heretic | ✅ | ✅ | 367.5KB |
| Hylics 2 | ✅ | ✅ | 101.9KB |
| Inscryption | 8.0KB | ✅ | 84.2KB |
| Landstalker - The Treasures of King Nole | 3.6KB | ✅ | 210.5KB |
| Links Awakening DX | 7.4KB | ✅ | 714.5KB |
| Lufia II Ancient Cave | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | 398.5KB |
| Math Adventure | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ✅ | ✅ | 51.5KB |
| MegaMan Battle Network 3 | ✅ | ✅ | 209.8KB |
| Meritous | ✅ | ✅ | 57.2KB |
| Metamath | ✅ | ✅ | 48.1KB |
| Muse Dash | ✅ | ✅ | 233.5KB |
| Noita | ✅ | ✅ | 74.6KB |
| Old School Runescape | 1.0KB | ✅ | 307.1KB |
| Overcooked! 2 | 28.5KB | ✅ | 489.2KB |
| Paint | 2.7KB | ✅ | 123.7KB |
| Risk of Rain 2 | ✅ | ✅ | 146.1KB |
| Saving Princess | ✅ | ✅ | 33.8KB |
| Sonic Adventure 2 Battle | ✅ | ✅ | 266.2KB |
| Subnautica | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ | ✅ | 93.2KB |
| Super Mario Land 2 | 96.3KB | ✅ | 982.7KB |
| Super Mario World | ✅ | ✅ | 178.2KB |
| TOEM original | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ | ✅ | 102.8KB |
| Terraria | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ | ✅ | 555.3KB |
| The Wind Waker | 7.0KB | ✅ | 253.9KB |
| Timespinner | 2.2KB | ✅ | 267.3KB |
| Undertale | ✅ | ✅ | 58.0KB |
| VVVVVV | 3.8KB | ✅ | 22.8KB |
| Wargroove | ✅ | ✅ | 44.7KB |
| Yoshi's Island | 9.2KB | ✅ | 296.7KB |
| shapez | ✅ | ✅ | 155.3KB |

## Games Passing Modified Only (2)

These games pass in the Modified UT but fail in the Pickle UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Shivers | ✅ | ✅ | 151.3KB |
| The Messenger | 15.2KB | ✅ | 211.8KB |

## Games Passing Pickle Only (16)

These games pass in the Pickle UT but fail in the Modified UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Blasphemous | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | 1.4KB | 40.3KB | 329.0KB |
| Celeste (Open World) | ✅ | ✅ | 1043.4KB |
| Hollow Knight | ✅ | ✅ | N/A |
| Jak and Daxter: The Precursor Legacy | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ✅ | ✅ | 753.6KB |
| Kirby's Dream Land 3 | 10.1KB | ✅ | 529.1KB |
| Lingo | 38.0KB | 10.7KB | 946.3KB |
| Pokemon Emerald | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | 12.2KB | 13.0KB | 1029.2KB |
| Raft | 6.5KB | ✅ | 205.9KB |
| SMZ3 | 61.4KB | 51.3KB | 1044.7KB |
| TUNIC | 3.1KB | ✅ | 653.3KB |
| The Witness | 14.1KB | ✅ | 398.4KB |
| Yacht Dice | 0.9KB | 285.0KB | 249.5KB |
| Yu-Gi-Oh! 2006 | 1.3KB | 21.4KB | 628.0KB |

## Games Passing Neither (8)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Final Fantasy Mystic Quest | 13.4KB | ✅ | 549.5KB |
| Kingdom Hearts 2 | 19.5KB | ✅ | 1641.1KB |
| Ocarina of Time | ✅ | ✅ | N/A |
| Secret of Evermore | 5.3KB | 7.5KB | 418.7KB |
| Starcraft 2 | 28.7KB | 90.1KB | 1126.8KB |
| Stardew Valley | 18.8KB | 8.0KB | 2430.2KB |
| Super Metroid | 60.9KB | 114.5KB | 625.4KB |
| Zillion | ✅ | ✅ | N/A |

## Notes

- **Modified Success Rate:** Percentage of fuzz runs that passed in the Modified Universal Tracker
- **Pickle Success Rate:** Percentage of fuzz runs that passed in the Pickle Universal Tracker
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
