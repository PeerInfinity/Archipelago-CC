# Universal Tracker Fuzz Test Comparison: Original vs Worldgen

**Generated:** 2026-02-13 07:20:53 UTC

This report compares fuzz test results between the Original Universal Tracker (FarisTheAncient) and the Worldgen Universal Tracker (regenerates world from rules.json).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Original UT Results](./test-results-ut-fuzz-original.md)
- [Worldgen UT Results](./test-results-ut-fuzz-worldgen.md)

## Summary

- **Total Games Tested:** 87
- **Passing Both:** 38 (43.7%)
- **Passing Original Only:** 0 (0.0%)
- **Passing Worldgen Only:** 35 (40.2%)
- **Passing Neither:** 14 (16.1%)
- **Passing Worldgen with no custom code:** 43 (49.4%)
- **Passing Worldgen Only with no custom code:** 16 (18.4%)

## Full Comparison

| Game Name | Original Success Rate | Worldgen Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ❌ 17.0% | ✅ 100.0% | 18.2KB | ✅ | 230.1KB |
| A Link to the Past | ❌ 0.0% | ✅ 80.0% | 12.6KB | ✅ | 664.1KB |
| A Short Hike | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 409.8KB |
| APQuest | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 10.9KB |
| Adventure | ⚠️ 94.0% | ✅ 100.0% | ✅ | ✅ | 25.6KB |
| Aquaria | ✅ 100.0% | ✅ 100.0% | 1.8KB | ✅ | 272.0KB |
| Baking Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Blasphemous | ✅ 56.0% | ✅ 40.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ✅ 100.0% | ✅ 100.0% | 1.4KB | 40.3KB | 325.2KB |
| Bumper Stickers | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 50.1KB |
| Castlevania - Circle of the Moon | ✅ 100.0% | ✅ 100.0% | 4.0KB | ✅ | 93.7KB |
| Castlevania 64 | ❌ 10.0% | ✅ 100.0% | ✅ | ✅ | 137.7KB |
| Celeste (Open World) | ⚠️ 51.0% | ✅ 100.0% | ✅ | ✅ | 1039.3KB |
| Celeste 64 | ✅ 100.0% | ✅ 100.0% | 4.1KB | ✅ | 53.3KB |
| ChecksFinder | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 16.1KB |
| Choo-Choo Charles | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 281.3KB |
| Civilization VI | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 163.0KB |
| Coding Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| DLCQuest | ❌ 46.0% | ✅ 100.0% | 1.2KB | ✅ | 49.7KB |
| DOOM 1993 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 275.6KB |
| DOOM II | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 322.4KB |
| Dark Souls III | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 1033.9KB |
| Donkey Kong Country 3 | ⚠️ 52.0% | ✅ 100.0% | ✅ | ✅ | 122.3KB |
| EarthBound | N/A | ✅ 100.0% | ✅ | ✅ | 337.5KB |
| Factorio | ❌ 0.0% | ✅ 100.0% | 8.8KB | ✅ | 290.0KB |
| Faxanadu | ❌ 20.0% | ✅ 100.0% | ✅ | ✅ | 68.0KB |
| Final Fantasy | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ❌ 1.0% | ✅ 90.0% | 13.9KB | ✅ | 548.0KB |
| Heretic | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 361.3KB |
| Hollow Knight | ❌ 11.0% | ❌ 0.0% | ✅ | ✅ | N/A |
| Hylics 2 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 100.3KB |
| Inscryption | ✅ 100.0% | ✅ 100.0% | 8.0KB | ✅ | 83.0KB |
| Jak and Daxter: The Precursor Legacy | ⚠️ 62.0% | ✅ 100.0% | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ❌ 18.0% | ❌ 40.0% | ✅ | ✅ | 748.6KB |
| Kingdom Hearts 2 | ❌ 37.0% | ❌ 0.0% | 19.5KB | ✅ | 1634.7KB |
| Kirby's Dream Land 3 | ❌ 3.0% | ❌ 0.0% | 10.1KB | ✅ | 528.6KB |
| Landstalker - The Treasures of King Nole | ❌ 20.0% | ✅ 100.0% | 3.6KB | ✅ | 209.1KB |
| Lingo | ❌ 21.0% | ✅ 30.0% | 38.0KB | 10.7KB | 939.9KB |
| Links Awakening DX | ❌ 23.0% | ✅ 100.0% | 7.4KB | ✅ | 703.0KB |
| Lufia II Ancient Cave | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 122.7KB |
| Mario & Luigi Superstar Saga | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 395.4KB |
| Math Adventure | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Mega Man 2 | ⚠️ 91.0% | ✅ 100.0% | ✅ | ✅ | 51.6KB |
| MegaMan Battle Network 3 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 204.6KB |
| Meritous | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 56.7KB |
| Metamath | ⚠️ 75.0% | ✅ 100.0% | ✅ | ✅ | 45.8KB |
| Muse Dash | ❌ 0.0% | ✅ 100.0% | ✅ | ✅ | 217.4KB |
| Noita | ❌ 22.0% | ✅ 100.0% | ✅ | ✅ | 73.8KB |
| Ocarina of Time | ❌ 0.0% | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ 91.0% | ✅ 100.0% | 1.0KB | ✅ | 305.1KB |
| Overcooked! 2 | ❌ 12.0% | ✅ 50.0% | 28.5KB | ✅ | 488.2KB |
| Paint | ✅ 98.0% | ✅ 100.0% | 2.7KB | ✅ | 123.0KB |
| Pokemon Emerald | ⚠️ 59.0% | ❌ 20.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ❌ 0.0% | ❌ 0.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ✅ 100.0% | ✅ 100.0% | 6.5KB | ✅ | 198.3KB |
| Risk of Rain 2 | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 145.0KB |
| SMZ3 | ❌ 1.0% | ❌ 0.0% | 61.4KB | 51.3KB | 1044.7KB |
| Satisfactory | N/A | ✅ 100.0% | 41.6KB | ✅ | 1618.9KB |
| Saving Princess | ❌ 28.0% | ✅ 100.0% | ✅ | ✅ | 33.3KB |
| Secret of Evermore | ✅ 100.0% | ✅ 100.0% | 5.3KB | 7.5KB | 414.9KB |
| Shivers | ❌ 0.0% | ✅ 100.0% | ✅ | ✅ | 149.8KB |
| Sonic Adventure 2 Battle | ❌ 8.0% | ✅ 100.0% | ✅ | ✅ | 262.1KB |
| Starcraft 2 | ❌ 0.0% | ❌ 0.0% | 28.7KB | 90.1KB | 1086.7KB |
| Stardew Valley | ❌ 4.0% | ❌ 0.0% | 18.8KB | 8.0KB | 2407.6KB |
| Subnautica | ❌ 10.0% | ✅ 100.0% | 2.2KB | ✅ | 205.4KB |
| Sudoku | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | N/A |
| Super Mario 64 | ❌ 29.0% | ✅ 90.0% | ✅ | ✅ | 100.9KB |
| Super Mario Land 2 | ❌ 10.0% | ✅ 100.0% | 96.3KB | ✅ | 918.7KB |
| Super Mario World | ⚠️ 54.0% | ✅ 90.0% | ✅ | ✅ | 177.6KB |
| Super Metroid | ❌ 1.0% | ❌ 0.0% | 60.9KB | 114.5KB | 625.0KB |
| TOEM original | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 99.6KB |
| TOEM rule builder | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 99.6KB |
| TUNIC | ✅ 100.0% | ✅ 100.0% | 3.1KB | ✅ | 649.1KB |
| Terraria | ⚠️ 98.0% | ✅ 90.0% | 16.8KB | ✅ | 278.6KB |
| The Legend of Zelda | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 554.5KB |
| The Messenger | ❌ 2.0% | ✅ 100.0% | 15.2KB | ✅ | 210.3KB |
| The Wind Waker | ❌ 3.0% | ✅ 50.0% | 7.0KB | ✅ | 250.1KB |
| The Witness | ✅ 100.0% | ✅ 100.0% | 14.1KB | ✅ | 392.1KB |
| Timespinner | ❌ 5.0% | ✅ 100.0% | 2.2KB | ✅ | 262.7KB |
| Undertale | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 56.0KB |
| VVVVVV | ⚠️ 67.0% | ✅ 100.0% | 3.8KB | ✅ | 22.4KB |
| Wargroove | ✅ 100.0% | ✅ 100.0% | ✅ | ✅ | 44.0KB |
| Yacht Dice | ❌ 5.0% | ❌ 0.0% | 0.9KB | 285.0KB | 248.4KB |
| Yoshi's Island | ❌ 22.0% | ✅ 100.0% | 9.2KB | ✅ | 295.2KB |
| Yu-Gi-Oh! 2006 | ❌ 33.0% | ⚠️ 50.0% | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ 0.0% | ❌ 0.0% | ✅ | ✅ | N/A |
| shapez | ❌ 42.0% | ✅ 100.0% | ✅ | ✅ | 153.7KB |

## Games Passing Both (38)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Short Hike | ✅ | ✅ | 409.8KB |
| APQuest | ✅ | ✅ | 10.9KB |
| Aquaria | 1.8KB | ✅ | 272.0KB |
| Baking Adventure | ✅ | ✅ | N/A |
| Blasphemous | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | 1.4KB | 40.3KB | 325.2KB |
| Bumper Stickers | ✅ | ✅ | 50.1KB |
| Castlevania - Circle of the Moon | 4.0KB | ✅ | 93.7KB |
| Celeste 64 | 4.1KB | ✅ | 53.3KB |
| ChecksFinder | ✅ | ✅ | 16.1KB |
| Choo-Choo Charles | ✅ | ✅ | 281.3KB |
| Civilization VI | ✅ | ✅ | 163.0KB |
| Coding Adventure | ✅ | ✅ | N/A |
| DOOM 1993 | ✅ | ✅ | 275.6KB |
| DOOM II | ✅ | ✅ | 322.4KB |
| Dark Souls III | ✅ | ✅ | 1033.9KB |
| Final Fantasy | ✅ | ✅ | N/A |
| Heretic | ✅ | ✅ | 361.3KB |
| Hylics 2 | ✅ | ✅ | 100.3KB |
| Inscryption | 8.0KB | ✅ | 83.0KB |
| Lufia II Ancient Cave | ✅ | ✅ | 122.7KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | 395.4KB |
| Math Adventure | ✅ | ✅ | N/A |
| MegaMan Battle Network 3 | ✅ | ✅ | 204.6KB |
| Meritous | ✅ | ✅ | 56.7KB |
| Old School Runescape | 1.0KB | ✅ | 305.1KB |
| Paint | 2.7KB | ✅ | 123.0KB |
| Raft | 6.5KB | ✅ | 198.3KB |
| Risk of Rain 2 | ✅ | ✅ | 145.0KB |
| Secret of Evermore | 5.3KB | 7.5KB | 414.9KB |
| Sudoku | ✅ | ✅ | N/A |
| TOEM original | ✅ | ✅ | 99.6KB |
| TOEM rule builder | ✅ | ✅ | 99.6KB |
| TUNIC | 3.1KB | ✅ | 649.1KB |
| The Legend of Zelda | ✅ | ✅ | 554.5KB |
| The Witness | 14.1KB | ✅ | 392.1KB |
| Undertale | ✅ | ✅ | 56.0KB |
| Wargroove | ✅ | ✅ | 44.0KB |

## Games Passing Worldgen Only (35)

These games pass in the Worldgen UT but fail in the Original UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Hat in Time | 18.2KB | ✅ | 230.1KB |
| A Link to the Past | 12.6KB | ✅ | 664.1KB |
| Adventure | ✅ | ✅ | 25.6KB |
| Castlevania 64 | ✅ | ✅ | 137.7KB |
| Celeste (Open World) | ✅ | ✅ | 1039.3KB |
| DLCQuest | 1.2KB | ✅ | 49.7KB |
| Donkey Kong Country 3 | ✅ | ✅ | 122.3KB |
| EarthBound | ✅ | ✅ | 337.5KB |
| Factorio | 8.8KB | ✅ | 290.0KB |
| Faxanadu | ✅ | ✅ | 68.0KB |
| Final Fantasy Mystic Quest | 13.9KB | ✅ | 548.0KB |
| Jak and Daxter: The Precursor Legacy | 21.6KB | 4.6KB | 298.6KB |
| Landstalker - The Treasures of King Nole | 3.6KB | ✅ | 209.1KB |
| Lingo | 38.0KB | 10.7KB | 939.9KB |
| Links Awakening DX | 7.4KB | ✅ | 703.0KB |
| Mega Man 2 | ✅ | ✅ | 51.6KB |
| Metamath | ✅ | ✅ | 45.8KB |
| Muse Dash | ✅ | ✅ | 217.4KB |
| Noita | ✅ | ✅ | 73.8KB |
| Overcooked! 2 | 28.5KB | ✅ | 488.2KB |
| Satisfactory | 41.6KB | ✅ | 1618.9KB |
| Saving Princess | ✅ | ✅ | 33.3KB |
| Shivers | ✅ | ✅ | 149.8KB |
| Sonic Adventure 2 Battle | ✅ | ✅ | 262.1KB |
| Subnautica | 2.2KB | ✅ | 205.4KB |
| Super Mario 64 | ✅ | ✅ | 100.9KB |
| Super Mario Land 2 | 96.3KB | ✅ | 918.7KB |
| Super Mario World | ✅ | ✅ | 177.6KB |
| Terraria | 16.8KB | ✅ | 278.6KB |
| The Messenger | 15.2KB | ✅ | 210.3KB |
| The Wind Waker | 7.0KB | ✅ | 250.1KB |
| Timespinner | 2.2KB | ✅ | 262.7KB |
| VVVVVV | 3.8KB | ✅ | 22.4KB |
| Yoshi's Island | 9.2KB | ✅ | 295.2KB |
| shapez | ✅ | ✅ | 153.7KB |

## Games Passing Neither (14)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Hollow Knight | ✅ | ✅ | N/A |
| Kingdom Hearts | ✅ | ✅ | 748.6KB |
| Kingdom Hearts 2 | 19.5KB | ✅ | 1634.7KB |
| Kirby's Dream Land 3 | 10.1KB | ✅ | 528.6KB |
| Ocarina of Time | ✅ | ✅ | N/A |
| Pokemon Emerald | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | 12.2KB | 13.0KB | 1029.2KB |
| SMZ3 | 61.4KB | 51.3KB | 1044.7KB |
| Starcraft 2 | 28.7KB | 90.1KB | 1086.7KB |
| Stardew Valley | 18.8KB | 8.0KB | 2407.6KB |
| Super Metroid | 60.9KB | 114.5KB | 625.0KB |
| Yacht Dice | 0.9KB | 285.0KB | 248.4KB |
| Yu-Gi-Oh! 2006 | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ✅ | ✅ | N/A |

## Notes

- **Original Success Rate:** Percentage of fuzz runs that passed in the Original Universal Tracker
- **Worldgen Success Rate:** Percentage of fuzz runs that passed in the Worldgen Universal Tracker
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
