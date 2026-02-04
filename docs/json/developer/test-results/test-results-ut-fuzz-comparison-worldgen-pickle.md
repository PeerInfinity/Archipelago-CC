# Universal Tracker Fuzz Test Comparison: Worldgen vs Pickle

**Generated:** 2026-02-04 14:05:32

**Source Data Last Updated:** 2026-02-04T11:13:21

This report compares fuzz test results between the Worldgen Universal Tracker (regenerates world from rules.json) and the Pickle-based Universal Tracker (loads serialized multiworld).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Worldgen UT Results](./test-results-ut-fuzz-worldgen.md)
- [Pickle UT Results](./test-results-ut-fuzz-pickle.md)

## Summary

- **Total Games Tested:** 85
- **Passing Both:** 1 (1.2%)
- **Passing Worldgen Only:** 0 (0.0%)
- **Passing Pickle Only:** 74 (87.1%)
- **Passing Neither:** 10 (11.8%)
- **Passing Pickle with no custom code:** 43 (50.6%)
- **Passing Pickle Only with no custom code:** 42 (49.4%)

## Full Comparison

| Game Name | Worldgen Success Rate | Pickle Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Hat in Time | N/A | ✅ 100.0% | 18.2KB | ✅ | 231.1KB |
| A Link to the Past | N/A | ✅ 80.0% | 12.6KB | ✅ | 667.7KB |
| A Short Hike | N/A | ✅ 100.0% | ✅ | ✅ | 410.7KB |
| APQuest | N/A | ✅ 100.0% | ✅ | ✅ | 11.0KB |
| Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 26.0KB |
| Aquaria | N/A | ✅ 100.0% | 1.8KB | ✅ | 275.1KB |
| Baking Adventure | N/A | ✅ 100.0% | ✅ | ✅ | 18.2KB |
| Blasphemous | N/A | ✅ 40.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | N/A | ✅ 100.0% | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | N/A | ✅ 100.0% | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | N/A | ✅ 100.0% | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | N/A | ✅ 100.0% | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | N/A | ✅ 100.0% | ✅ | ✅ | 1043.4KB |
| Celeste 64 | N/A | ✅ 100.0% | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | N/A | ✅ 100.0% | ✅ | ✅ | 16.2KB |
| Choo-Choo Charles | N/A | ✅ 100.0% | ✅ | ✅ | 282.3KB |
| Civilization VI | N/A | ✅ 100.0% | ✅ | ✅ | 166.9KB |
| Coding Adventure | N/A | ✅ 100.0% | ✅ | ✅ | 54.9KB |
| DLCQuest | N/A | ✅ 100.0% | 1.2KB | ✅ | 51.0KB |
| DOOM 1993 | N/A | ✅ 100.0% | ✅ | ✅ | 280.1KB |
| DOOM II | N/A | ✅ 100.0% | ✅ | ✅ | 326.5KB |
| Dark Souls III | N/A | ✅ 100.0% | ✅ | ✅ | 1062.0KB |
| Donkey Kong Country 3 | N/A | ✅ 100.0% | ✅ | ✅ | 122.5KB |
| Factorio | N/A | ✅ 100.0% | 8.8KB | ✅ | 295.0KB |
| Faxanadu | N/A | ✅ 100.0% | ✅ | ✅ | 68.7KB |
| Final Fantasy | N/A | ✅ 100.0% | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | N/A | ⚠️ 70.0% | 13.4KB | ✅ | 549.5KB |
| Heretic | N/A | ✅ 100.0% | ✅ | ✅ | 367.5KB |
| Hollow Knight | N/A | ✅ 100.0% | ✅ | ✅ | N/A |
| Hylics 2 | N/A | ✅ 100.0% | ✅ | ✅ | 101.9KB |
| Inscryption | N/A | ✅ 100.0% | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | N/A | ✅ 100.0% | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | N/A | ✅ 100.0% | ✅ | ✅ | 753.6KB |
| Kingdom Hearts 2 | N/A | ❌ 10.0% | 19.5KB | ✅ | 1641.1KB |
| Kirby's Dream Land 3 | N/A | ✅ 100.0% | 10.1KB | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | N/A | ✅ 100.0% | 3.6KB | ✅ | 210.5KB |
| Lingo | N/A | ✅ 30.0% | 38.0KB | 10.7KB | 946.3KB |
| Links Awakening DX | N/A | ✅ 100.0% | 7.4KB | ✅ | 714.5KB |
| Lufia II Ancient Cave | N/A | ✅ 100.0% | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | N/A | ✅ 100.0% | ✅ | ✅ | 398.5KB |
| Math Adventure | N/A | ✅ 100.0% | ✅ | ✅ | 12.6KB |
| Mega Man 2 | N/A | ✅ 100.0% | ✅ | ✅ | 51.5KB |
| MegaMan Battle Network 3 | N/A | ✅ 100.0% | ✅ | ✅ | 209.8KB |
| Meritous | N/A | ✅ 100.0% | ✅ | ✅ | 57.2KB |
| Metamath | N/A | ✅ 100.0% | ✅ | ✅ | 48.1KB |
| Muse Dash | N/A | ✅ 100.0% | ✅ | ✅ | 233.5KB |
| Noita | N/A | ✅ 100.0% | ✅ | ✅ | 74.6KB |
| Ocarina of Time | N/A | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | N/A | ✅ 100.0% | 1.0KB | ✅ | 307.1KB |
| Overcooked! 2 | N/A | ✅ 50.0% | 28.5KB | ✅ | 489.2KB |
| Paint | N/A | ✅ 100.0% | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | N/A | ✅ 60.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | N/A | ✅ 90.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | N/A | ✅ 100.0% | 6.5KB | ✅ | 205.9KB |
| Risk of Rain 2 | N/A | ✅ 100.0% | ✅ | ✅ | 146.1KB |
| SMZ3 | N/A | ✅ 100.0% | 61.4KB | 51.3KB | 1044.7KB |
| Saving Princess | N/A | ✅ 100.0% | ✅ | ✅ | 33.8KB |
| Secret of Evermore | N/A | ❌ 0.0% | 5.3KB | 7.5KB | 418.7KB |
| Shivers | N/A | ⚠️ 90.0% | ✅ | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | N/A | ✅ 100.0% | ✅ | ✅ | 266.2KB |
| Starcraft 2 | N/A | ❌ 0.0% | 28.7KB | 90.1KB | 1126.8KB |
| Stardew Valley | N/A | ⚠️ 80.0% | 18.8KB | 8.0KB | 2430.2KB |
| Subnautica | N/A | ✅ 100.0% | 2.2KB | ✅ | 207.8KB |
| Sudoku | N/A | ✅ 100.0% | ✅ | ✅ | N/A |
| Super Mario 64 | N/A | ✅ 100.0% | ✅ | ✅ | 93.2KB |
| Super Mario Land 2 | N/A | ✅ 100.0% | 96.3KB | ✅ | 982.7KB |
| Super Mario World | N/A | ✅ 90.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | N/A | ⚠️ 60.0% | 60.9KB | 114.5KB | 625.4KB |
| TOEM original | N/A | ✅ 100.0% | ✅ | ✅ | 102.8KB |
| TOEM rule builder | N/A | ✅ 100.0% | ✅ | ✅ | 102.8KB |
| TUNIC | N/A | ✅ 100.0% | 3.1KB | ✅ | 653.3KB |
| Terraria | N/A | ✅ 90.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | N/A | ✅ 100.0% | ✅ | ✅ | 555.3KB |
| The Messenger | N/A | ⚠️ 80.0% | 15.2KB | ✅ | 211.8KB |
| The Wind Waker | N/A | ✅ 50.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | N/A | ✅ 100.0% | 14.1KB | ✅ | 398.4KB |
| Timespinner | N/A | ✅ 100.0% | 2.2KB | ✅ | 267.3KB |
| Undertale | N/A | ✅ 100.0% | ✅ | ✅ | 58.0KB |
| VVVVVV | N/A | ✅ 100.0% | 3.8KB | ✅ | 22.8KB |
| Wargroove | N/A | ✅ 100.0% | ✅ | ✅ | 44.7KB |
| Yacht Dice | N/A | ✅ 100.0% | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | N/A | ✅ 100.0% | 9.2KB | ✅ | 296.7KB |
| Yu-Gi-Oh! 2006 | N/A | ✅ 100.0% | 1.3KB | 21.4KB | 628.0KB |
| Zillion | N/A | ⚠️ 80.0% | ✅ | ✅ | N/A |
| shapez | N/A | ✅ 100.0% | ✅ | ✅ | 155.3KB |

## Games Passing Both (1)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Adventure | ✅ | ✅ | 26.0KB |

## Games Passing Pickle Only (74)

These games pass in the Pickle UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Hat in Time | 18.2KB | ✅ | 231.1KB |
| A Link to the Past | 12.6KB | ✅ | 667.7KB |
| A Short Hike | ✅ | ✅ | 410.7KB |
| APQuest | ✅ | ✅ | 11.0KB |
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
| Factorio | 8.8KB | ✅ | 295.0KB |
| Faxanadu | ✅ | ✅ | 68.7KB |
| Final Fantasy | ✅ | ✅ | N/A |
| Heretic | ✅ | ✅ | 367.5KB |
| Hollow Knight | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | ✅ | 101.9KB |
| Inscryption | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ✅ | ✅ | 753.6KB |
| Kirby's Dream Land 3 | 10.1KB | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | 3.6KB | ✅ | 210.5KB |
| Lingo | 38.0KB | 10.7KB | 946.3KB |
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
| Pokemon Emerald | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | 12.2KB | 13.0KB | 1029.2KB |
| Raft | 6.5KB | ✅ | 205.9KB |
| Risk of Rain 2 | ✅ | ✅ | 146.1KB |
| SMZ3 | 61.4KB | 51.3KB | 1044.7KB |
| Saving Princess | ✅ | ✅ | 33.8KB |
| Sonic Adventure 2 Battle | ✅ | ✅ | 266.2KB |
| Subnautica | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ | ✅ | 93.2KB |
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
| Yacht Dice | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | 9.2KB | ✅ | 296.7KB |
| Yu-Gi-Oh! 2006 | 1.3KB | 21.4KB | 628.0KB |
| shapez | ✅ | ✅ | 155.3KB |

## Games Passing Neither (10)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Final Fantasy Mystic Quest | 13.4KB | ✅ | 549.5KB |
| Kingdom Hearts 2 | 19.5KB | ✅ | 1641.1KB |
| Ocarina of Time | ✅ | ✅ | N/A |
| Secret of Evermore | 5.3KB | 7.5KB | 418.7KB |
| Shivers | ✅ | ✅ | 151.3KB |
| Starcraft 2 | 28.7KB | 90.1KB | 1126.8KB |
| Stardew Valley | 18.8KB | 8.0KB | 2430.2KB |
| Super Metroid | 60.9KB | 114.5KB | 625.4KB |
| The Messenger | 15.2KB | ✅ | 211.8KB |
| Zillion | ✅ | ✅ | N/A |

## Notes

- **Worldgen Success Rate:** Percentage of fuzz runs that passed in the Worldgen Universal Tracker
- **Pickle Success Rate:** Percentage of fuzz runs that passed in the Pickle Universal Tracker
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
