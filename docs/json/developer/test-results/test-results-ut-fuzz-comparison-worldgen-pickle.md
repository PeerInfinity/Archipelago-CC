# Universal Tracker Fuzz Test Comparison: Worldgen vs Pickle

**Generated:** 2026-02-07 22:09:22

**Source Data Last Updated:** 2026-02-07T05:13:22

This report compares fuzz test results between the Worldgen Universal Tracker (regenerates world from rules.json) and the Pickle-based Universal Tracker (loads serialized multiworld).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Worldgen UT Results](./test-results-ut-fuzz-worldgen.md)
- [Pickle UT Results](./test-results-ut-fuzz-pickle.md)

## Summary

- **Total Games Tested:** 87
- **Passing Both:** 67 (77.0%)
- **Passing Worldgen Only:** 4 (4.6%)
- **Passing Pickle Only:** 8 (9.2%)
- **Passing Neither:** 8 (9.2%)
- **Passing Pickle with no custom code:** 43 (49.4%)
- **Passing Pickle Only with no custom code:** 1 (1.1%)

## Full Comparison

| Game Name | Worldgen Success Rate | Pickle Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ✅ 100.0% | ✅ 99.0% | 18.2KB | ✅ | 231.3KB |
| A Link to the Past | ✅ 80.0% | ✅ 97.0% | 12.6KB | ✅ | 667.7KB |
| A Short Hike | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 410.7KB |
| APQuest | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 11.0KB |
| Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 26.0KB |
| Aquaria | ✅ 100.0% | ✅ 100.0% | 1.8KB | ✅ | 275.1KB |
| Baking Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 18.2KB |
| Blasphemous | ✅ 40.0% | ✅ 56.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ✅ 100.0% | ✅ 100.0% | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ 100.0% | ✅ 100.0% | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 1043.4KB |
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
| EarthBound | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 343.8KB |
| Factorio | ✅ 100.0% | ✅ 100.0% | 8.8KB | ✅ | 295.4KB |
| Faxanadu | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ⚠️ 60.0% | ⚠️ 80.0% | 13.4KB | ✅ | 549.5KB |
| Heretic | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 367.5KB |
| Hollow Knight | ❌ 0.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Hylics 2 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 101.9KB |
| Inscryption | ✅ 100.0% | ✅ 100.0% | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | ✅ 100.0% | ✅ 100.0% | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ❌ 40.0% | ⚠️ 98.0% | ✅ | ✅ | 753.6KB |
| Kingdom Hearts 2 | ❌ 0.0% | ❌ 44.0% | 19.5KB | ✅ | 1641.6KB |
| Kirby's Dream Land 3 | ❌ 0.0% | ✅ 97.0% | 10.1KB | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | ✅ 100.0% | ✅ 100.0% | 3.6KB | ✅ | 210.5KB |
| Lingo | ✅ 30.0% | ✅ 45.0% | 38.0KB | 10.7KB | 946.3KB |
| Links Awakening DX | ✅ 100.0% | ❌ 23.0% | 7.4KB | ✅ | 705.8KB |
| Lufia II Ancient Cave | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 398.8KB |
| Math Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ✅ 100.0% | ✅ 99.0% | ✅ | ✅ | 51.5KB |
| MegaMan Battle Network 3 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 209.8KB |
| Meritous | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 57.2KB |
| Metamath | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 48.1KB |
| Muse Dash | ✅ 100.0% | ✅ 97.0% | ✅ | ✅ | 233.5KB |
| Noita | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 74.6KB |
| Ocarina of Time | ❌ 0.0% | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ 100.0% | ✅ 91.0% | 1.0KB | ✅ | 307.1KB |
| Overcooked! 2 | ✅ 50.0% | ✅ 67.0% | 28.5KB | ✅ | 489.2KB |
| Paint | ✅ 100.0% | ✅ 98.0% | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | ❌ 30.0% | ✅ 78.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ❌ 0.0% | ✅ 93.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ✅ 100.0% | ✅ 100.0% | 6.5KB | ✅ | 205.9KB |
| Risk of Rain 2 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 146.1KB |
| SMZ3 | ❌ 0.0% | ✅ 100.0% | 61.4KB | 51.3KB | 1044.7KB |
| Satisfactory | ❌ 0.0% | ❌ 0.0% | 35.2KB | ✅ | 1703.4KB |
| Saving Princess | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 33.8KB |
| Secret of Evermore | ✅ 100.0% | ❌ 0.0% | 5.3KB | 7.5KB | 418.7KB |
| Shivers | ✅ 100.0% | ❌ 0.0% | ✅ | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 266.2KB |
| Starcraft 2 | ❌ 0.0% | ❌ 0.0% | 28.7KB | 90.1KB | 1126.8KB |
| Stardew Valley | ❌ 0.0% | ✅ 100.0% | 18.8KB | 8.0KB | 2430.2KB |
| Subnautica | ✅ 100.0% | ✅ 100.0% | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ 90.0% | ✅ 98.0% | ✅ | ✅ | 101.9KB |
| Super Mario Land 2 | ✅ 100.0% | ✅ 98.0% | 96.3KB | ✅ | 982.7KB |
| Super Mario World | ✅ 90.0% | ✅ 98.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ 0.0% | ❌ 49.0% | 60.9KB | 114.5KB | 625.4KB |
| TOEM original | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 102.8KB |
| TUNIC | ✅ 100.0% | ✅ 100.0% | 3.1KB | ✅ | 653.3KB |
| Terraria | ✅ 90.0% | ✅ 98.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 555.3KB |
| The Messenger | ✅ 100.0% | ❌ 2.0% | 15.2KB | ✅ | 211.8KB |
| The Wind Waker | ✅ 50.0% | ✅ 54.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | ✅ 100.0% | ✅ 100.0% | 14.1KB | ✅ | 398.4KB |
| Timespinner | ✅ 100.0% | ✅ 99.0% | 2.2KB | ✅ | 267.3KB |
| Undertale | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 58.0KB |
| VVVVVV | ✅ 100.0% | ✅ 100.0% | 3.8KB | ✅ | 22.8KB |
| Wargroove | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 44.7KB |
| Yacht Dice | ❌ 0.0% | ✅ 100.0% | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | ✅ 100.0% | ✅ 100.0% | 9.2KB | ✅ | 296.8KB |
| Yu-Gi-Oh! 2006 | ⚠️ 50.0% | ✅ 100.0% | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ 0.0% | ⚠️ 78.0% | ✅ | ✅ | N/A |
| shapez | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 155.3KB |

## Games Passing Both (67)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Hat in Time | 18.2KB | ✅ | 231.3KB |
| A Link to the Past | 12.6KB | ✅ | 667.7KB |
| A Short Hike | ✅ | ✅ | 410.7KB |
| APQuest | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | ✅ | 26.0KB |
| Aquaria | 1.8KB | ✅ | 275.1KB |
| Baking Adventure | ✅ | ✅ | 18.2KB |
| Blasphemous | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | ✅ | ✅ | 1043.4KB |
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
| EarthBound | ✅ | ✅ | 343.8KB |
| Factorio | 8.8KB | ✅ | 295.4KB |
| Faxanadu | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ | ✅ | N/A |
| Heretic | ✅ | ✅ | 367.5KB |
| Hylics 2 | ✅ | ✅ | 101.9KB |
| Inscryption | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | 21.6KB | 4.6KB | 298.6KB |
| Landstalker - The Treasures of King Nole | 3.6KB | ✅ | 210.5KB |
| Lingo | 38.0KB | 10.7KB | 946.3KB |
| Lufia II Ancient Cave | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | 398.8KB |
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
| Raft | 6.5KB | ✅ | 205.9KB |
| Risk of Rain 2 | ✅ | ✅ | 146.1KB |
| Saving Princess | ✅ | ✅ | 33.8KB |
| Sonic Adventure 2 Battle | ✅ | ✅ | 266.2KB |
| Subnautica | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ | ✅ | 101.9KB |
| Super Mario Land 2 | 96.3KB | ✅ | 982.7KB |
| Super Mario World | ✅ | ✅ | 178.2KB |
| TOEM original | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ | ✅ | 102.8KB |
| TUNIC | 3.1KB | ✅ | 653.3KB |
| Terraria | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ | ✅ | 555.3KB |
| The Wind Waker | 7.0KB | ✅ | 253.9KB |
| The Witness | 14.1KB | ✅ | 398.4KB |
| Timespinner | 2.2KB | ✅ | 267.3KB |
| Undertale | ✅ | ✅ | 58.0KB |
| VVVVVV | 3.8KB | ✅ | 22.8KB |
| Wargroove | ✅ | ✅ | 44.7KB |
| Yoshi's Island | 9.2KB | ✅ | 296.8KB |
| shapez | ✅ | ✅ | 155.3KB |

## Games Passing Worldgen Only (4)

These games pass in the Worldgen UT but fail in the Pickle UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Links Awakening DX | 7.4KB | ✅ | 705.8KB |
| Secret of Evermore | 5.3KB | 7.5KB | 418.7KB |
| Shivers | ✅ | ✅ | 151.3KB |
| The Messenger | 15.2KB | ✅ | 211.8KB |

## Games Passing Pickle Only (8)

These games pass in the Pickle UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Hollow Knight | ✅ | ✅ | N/A |
| Kirby's Dream Land 3 | 10.1KB | ✅ | 529.1KB |
| Pokemon Emerald | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | 12.2KB | 13.0KB | 1029.2KB |
| SMZ3 | 61.4KB | 51.3KB | 1044.7KB |
| Stardew Valley | 18.8KB | 8.0KB | 2430.2KB |
| Yacht Dice | 0.9KB | 285.0KB | 249.5KB |
| Yu-Gi-Oh! 2006 | 1.3KB | 21.4KB | 628.0KB |

## Games Passing Neither (8)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Final Fantasy Mystic Quest | 13.4KB | ✅ | 549.5KB |
| Kingdom Hearts | ✅ | ✅ | 753.6KB |
| Kingdom Hearts 2 | 19.5KB | ✅ | 1641.6KB |
| Ocarina of Time | ✅ | ✅ | N/A |
| Satisfactory | 35.2KB | ✅ | 1703.4KB |
| Starcraft 2 | 28.7KB | 90.1KB | 1126.8KB |
| Super Metroid | 60.9KB | 114.5KB | 625.4KB |
| Zillion | ✅ | ✅ | N/A |

## Notes

- **Worldgen Success Rate:** Percentage of fuzz runs that passed in the Worldgen Universal Tracker
- **Pickle Success Rate:** Percentage of fuzz runs that passed in the Pickle Universal Tracker
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
