# Universal Tracker Fuzz Test Comparison: Worldgen vs Hybrid

**Generated:** 2026-03-22 02:03:57 UTC

**Source Data Last Updated:** 2026-03-21T22:05:16

This report compares fuzz test results between the Worldgen Universal Tracker (regenerates world from rules.json) and the Hybrid Universal Tracker (worldgen with native UT preference).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Worldgen UT Results](./test-results-ut-fuzz-worldgen.md)
- [Hybrid UT Results](./test-results-ut-fuzz-hybrid.md)

## Summary

- **Total Games Tested:** 88
- **Passing Both:** 64 (72.7%)
- **Passing Worldgen Only:** 9 (10.2%)
- **Passing Hybrid Only:** 0 (0.0%)
- **Passing Neither:** 15 (17.0%)
- **Passing Hybrid with no custom code:** 39 (44.3%)
- **Passing Hybrid Only with no custom code:** 0 (0.0%)

## Full Comparison

| Game Name | Worldgen Result | Hybrid Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ✅ | ✅ | 18.2KB | ✅ | 230.2KB |
| A Link to the Past | ✅ | ✅ | 14.0KB | ✅ | 664.0KB |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | 74.4KB |
| APQuest | ✅ | ✅ | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | ✅ | ✅ | ✅ | 25.7KB |
| Aquaria | ✅ | ✅ | 1.8KB | ✅ | 277.3KB |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | 17.9KB |
| Blasphemous | ✅ | ❌ | ✅ | ✅ | 2760.8KB |
| Bomb Rush Cyberfunk | ✅ | ❌ | 1.4KB | 40.3KB | 325.3KB |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ | ✅ | 4.0KB | ✅ | 93.8KB |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | 137.8KB |
| Celeste (Open World) | ✅ | ❌ | ✅ | ✅ | 1039.8KB |
| Celeste 64 | ✅ | ✅ | 4.1KB | ✅ | 53.6KB |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | 16.4KB |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | 281.4KB |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | 163.1KB |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | 54.2KB |
| DLCQuest | ✅ | ✅ | 1.2KB | ✅ | 49.8KB |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | 281.9KB |
| DOOM II | ✅ | ✅ | ✅ | ✅ | 327.5KB |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | 1034.1KB |
| DepGraph | ✅ | ✅ | ✅ | ✅ | 201.9KB |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | 122.4KB |
| EarthBound | ✅ | ✅ | ✅ | ✅ | 337.6KB |
| Factorio | ✅ | ✅ | 8.8KB | ✅ | 290.1KB |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | 68.1KB |
| Final Fantasy | ✅ | ✅ | ✅ | ✅ | 50.3KB |
| Final Fantasy Mystic Quest | ✅ | ✅ | 13.9KB | ✅ | 548.1KB |
| Heretic | ✅ | ✅ | ✅ | ✅ | 367.6KB |
| Hollow Knight | ❌ | ❌ | ✅ | ✅ | 3501.1KB |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | 100.4KB |
| Inscryption | ✅ | ✅ | 8.0KB | ✅ | 84.3KB |
| Jak and Daxter: The Precursor Legacy | ✅ | ❌ | 21.7KB | 4.6KB | 257.9KB |
| Journey to Ascension | ❌ | ❌ | ✅ | ✅ | 48.3KB |
| Kingdom Hearts | ❌ 4/10 | ❌ 4/10 | ✅ | ✅ | 748.7KB |
| Kingdom Hearts 2 | ❌ | ⚠️ 6/10 | 20.4KB | ✅ | 1630.7KB |
| Kirby's Dream Land 3 | ❌ | ❌ | 10.1KB | ✅ | 528.7KB |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | 3.6KB | ✅ | 209.2KB |
| Lingo | ✅ | ❌ | 38.2KB | 10.7KB | 940.0KB |
| Links Awakening DX | ✅ | ✅ | 7.3KB | ✅ | 703.1KB |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | 122.8KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | 395.5KB |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | 51.7KB |
| Mega Man 3 | ✅ | ✅ | ✅ | ✅ | 71.7KB |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | 204.7KB |
| Meritous | ✅ | ✅ | ✅ | ✅ | 57.0KB |
| Metamath | ✅ | ✅ | ✅ | ✅ | 56.0KB |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | 228.3KB |
| Noita | ✅ | ✅ | ✅ | ✅ | 73.9KB |
| Ocarina of Time | ❌ | ❌ | ✅ | ✅ | 1274.4KB |
| Old School Runescape | ✅ | ✅ | 1.0KB | ✅ | 305.2KB |
| Overcooked! 2 | ✅ | ✅ | 28.5KB | ✅ | 488.3KB |
| Paint | ✅ | ✅ | 2.7KB | ✅ | 123.5KB |
| Pokemon Emerald | ⚠️ 4/7 | ❌ 3/7 | 5.2KB | 8.7KB | 1350.2KB |
| Pokemon Red and Blue | ❌ | ❌ | 12.2KB | 13.0KB | 1270.2KB |
| Raft | ✅ | ❌ | 6.5KB | ✅ | 198.4KB |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | 131.4KB |
| SMZ3 | ❌ 2/10 | ❌ 1/10 | 54.2KB | 51.3KB | 1890.6KB |
| Satisfactory | ✅ | ✅ | 41.8KB | ✅ | 1619.5KB |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | 33.6KB |
| Secret of Evermore | ✅ | ❌ | 5.6KB | 7.5KB | 415.0KB |
| Shivers | ✅ | ✅ | ✅ | ✅ | 150.1KB |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | 262.2KB |
| Starcraft 2 | ❌ | ❌ | 29.3KB | 90.1KB | 1086.9KB |
| Stardew Valley | ❌ | ⚠️ 5/10 | 20.0KB | 9.8KB | 2558.2KB |
| Subnautica | ✅ | ✅ | 2.2KB | ✅ | 205.5KB |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | 101.2KB |
| Super Mario Land 2 | ✅ | ✅ | 96.3KB | ✅ | 919.1KB |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | 177.7KB |
| Super Metroid | ❌ | ❌ | 61.0KB | 114.5KB | 625.1KB |
| TOEM original | ✅ | ✅ | 0.6KB | ✅ | 99.7KB |
| TOEM rule builder | ✅ | ✅ | 0.5KB | ✅ | 99.7KB |
| TUNIC | ✅ | ⚠️ 6/10 | 3.1KB | ✅ | 649.2KB |
| Terraria | ✅ | ✅ | 16.9KB | ✅ | 279.0KB |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | 554.6KB |
| The Messenger | ✅ | ✅ | 15.2KB | ✅ | 210.4KB |
| The Wind Waker | ✅ | ✅ | 7.0KB | ✅ | 250.2KB |
| The Witness | ✅ | ❌ 2/10 | 14.6KB | ✅ | 468.1KB |
| Timespinner | ✅ | ✅ | 2.2KB | ✅ | 262.9KB |
| Undertale | ✅ | ✅ | ✅ | ✅ | 56.3KB |
| VVVVVV | ✅ | ✅ | 3.8KB | ✅ | 22.7KB |
| Wargroove | ✅ | ✅ | ✅ | ✅ | 44.1KB |
| Yacht Dice | ❌ | ❌ | 0.9KB | 285.0KB | 248.5KB |
| Yoshi's Island | ✅ | ✅ | 9.2KB | ✅ | 295.3KB |
| Yu-Gi-Oh! 2006 | ⚠️ 5/10 | ⚠️ 5/10 | 1.3KB | 21.4KB | 644.0KB |
| Zillion | ❌ | ❌ | ✅ | ✅ | 321.2KB |
| shapez | ✅ | ✅ | ✅ | ✅ | 153.8KB |

## Games Passing Both (64)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Hat in Time | 18.2KB | ✅ | 230.2KB |
| A Link to the Past | 14.0KB | ✅ | 664.0KB |
| A Short Hike | ✅ | ✅ | 74.4KB |
| APQuest | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | ✅ | 25.7KB |
| Aquaria | 1.8KB | ✅ | 277.3KB |
| Baking Adventure | ✅ | ✅ | 17.9KB |
| Bumper Stickers | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | 4.0KB | ✅ | 93.8KB |
| Castlevania 64 | ✅ | ✅ | 137.8KB |
| Celeste 64 | 4.1KB | ✅ | 53.6KB |
| ChecksFinder | ✅ | ✅ | 16.4KB |
| Choo-Choo Charles | ✅ | ✅ | 281.4KB |
| Civilization VI | ✅ | ✅ | 163.1KB |
| Coding Adventure | ✅ | ✅ | 54.2KB |
| DLCQuest | 1.2KB | ✅ | 49.8KB |
| DOOM 1993 | ✅ | ✅ | 281.9KB |
| DOOM II | ✅ | ✅ | 327.5KB |
| Dark Souls III | ✅ | ✅ | 1034.1KB |
| DepGraph | ✅ | ✅ | 201.9KB |
| Donkey Kong Country 3 | ✅ | ✅ | 122.4KB |
| EarthBound | ✅ | ✅ | 337.6KB |
| Factorio | 8.8KB | ✅ | 290.1KB |
| Faxanadu | ✅ | ✅ | 68.1KB |
| Final Fantasy | ✅ | ✅ | 50.3KB |
| Final Fantasy Mystic Quest | 13.9KB | ✅ | 548.1KB |
| Heretic | ✅ | ✅ | 367.6KB |
| Hylics 2 | ✅ | ✅ | 100.4KB |
| Inscryption | 8.0KB | ✅ | 84.3KB |
| Landstalker - The Treasures of King Nole | 3.6KB | ✅ | 209.2KB |
| Links Awakening DX | 7.3KB | ✅ | 703.1KB |
| Lufia II Ancient Cave | ✅ | ✅ | 122.8KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | 395.5KB |
| Mega Man 2 | ✅ | ✅ | 51.7KB |
| Mega Man 3 | ✅ | ✅ | 71.7KB |
| MegaMan Battle Network 3 | ✅ | ✅ | 204.7KB |
| Meritous | ✅ | ✅ | 57.0KB |
| Metamath | ✅ | ✅ | 56.0KB |
| Muse Dash | ✅ | ✅ | 228.3KB |
| Noita | ✅ | ✅ | 73.9KB |
| Old School Runescape | 1.0KB | ✅ | 305.2KB |
| Overcooked! 2 | 28.5KB | ✅ | 488.3KB |
| Paint | 2.7KB | ✅ | 123.5KB |
| Risk of Rain 2 | ✅ | ✅ | 131.4KB |
| Satisfactory | 41.8KB | ✅ | 1619.5KB |
| Saving Princess | ✅ | ✅ | 33.6KB |
| Shivers | ✅ | ✅ | 150.1KB |
| Sonic Adventure 2 Battle | ✅ | ✅ | 262.2KB |
| Subnautica | 2.2KB | ✅ | 205.5KB |
| Super Mario 64 | ✅ | ✅ | 101.2KB |
| Super Mario Land 2 | 96.3KB | ✅ | 919.1KB |
| Super Mario World | ✅ | ✅ | 177.7KB |
| TOEM original | 0.6KB | ✅ | 99.7KB |
| TOEM rule builder | 0.5KB | ✅ | 99.7KB |
| Terraria | 16.9KB | ✅ | 279.0KB |
| The Legend of Zelda | ✅ | ✅ | 554.6KB |
| The Messenger | 15.2KB | ✅ | 210.4KB |
| The Wind Waker | 7.0KB | ✅ | 250.2KB |
| Timespinner | 2.2KB | ✅ | 262.9KB |
| Undertale | ✅ | ✅ | 56.3KB |
| VVVVVV | 3.8KB | ✅ | 22.7KB |
| Wargroove | ✅ | ✅ | 44.1KB |
| Yoshi's Island | 9.2KB | ✅ | 295.3KB |
| shapez | ✅ | ✅ | 153.8KB |

## Games Passing Worldgen Only (9)

These games pass in the Worldgen UT but fail in the Hybrid UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Blasphemous | ✅ | ✅ | 2760.8KB |
| Bomb Rush Cyberfunk | 1.4KB | 40.3KB | 325.3KB |
| Celeste (Open World) | ✅ | ✅ | 1039.8KB |
| Jak and Daxter: The Precursor Legacy | 21.7KB | 4.6KB | 257.9KB |
| Lingo | 38.2KB | 10.7KB | 940.0KB |
| Raft | 6.5KB | ✅ | 198.4KB |
| Secret of Evermore | 5.6KB | 7.5KB | 415.0KB |
| TUNIC | 3.1KB | ✅ | 649.2KB |
| The Witness | 14.6KB | ✅ | 468.1KB |

## Games Passing Neither (15)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Hollow Knight | ✅ | ✅ | 3501.1KB |
| Journey to Ascension | ✅ | ✅ | 48.3KB |
| Kingdom Hearts | ✅ | ✅ | 748.7KB |
| Kingdom Hearts 2 | 20.4KB | ✅ | 1630.7KB |
| Kirby's Dream Land 3 | 10.1KB | ✅ | 528.7KB |
| Ocarina of Time | ✅ | ✅ | 1274.4KB |
| Pokemon Emerald | 5.2KB | 8.7KB | 1350.2KB |
| Pokemon Red and Blue | 12.2KB | 13.0KB | 1270.2KB |
| SMZ3 | 54.2KB | 51.3KB | 1890.6KB |
| Starcraft 2 | 29.3KB | 90.1KB | 1086.9KB |
| Stardew Valley | 20.0KB | 9.8KB | 2558.2KB |
| Super Metroid | 61.0KB | 114.5KB | 625.1KB |
| Yacht Dice | 0.9KB | 285.0KB | 248.5KB |
| Yu-Gi-Oh! 2006 | 1.3KB | 21.4KB | 644.0KB |
| Zillion | ✅ | ✅ | 321.2KB |

## Notes

- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Hybrid Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
