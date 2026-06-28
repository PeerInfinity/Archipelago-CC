# Universal Tracker Fuzz Test Comparison: Worldgen vs Pickle

**Generated:** 2026-06-28 01:45:42 UTC

**Source Data Last Updated:** 2026-06-26T17:57:48

This report compares fuzz test results between the Worldgen Universal Tracker (regenerates world from rules.json) and the Pickle-based Universal Tracker (loads serialized multiworld).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Worldgen UT Results](./test-results-ut-fuzz-worldgen.md)
- [Pickle UT Results](./test-results-ut-fuzz-pickle.md)

## Summary

- **Total Games Tested:** 89
- **Passing Both:** 0 (0.0%)
- **Passing Worldgen Only:** 1 (1.1%)
- **Passing Pickle Only:** 20 (22.5%)
- **Passing Neither:** 68 (76.4%)
- **Passing Pickle with no custom code:** 15 (16.9%)
- **Passing Pickle Only with no custom code:** 15 (16.9%)

## Full Comparison

| Game Name | Worldgen Result | Pickle Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Hat in Time | N/A | ⚠️ 7/10 | 18.2KB | ✅ | 230.4KB |
| A Link to the Past | N/A | ⚠️ 4/6 | 14.0KB | ✅ | 664.5KB |
| A Short Hike | N/A | ⚠️ 7/10 | ✅ | ✅ | 74.4KB |
| APCalc | N/A | ⚠️ 7/10 | ✅ | ✅ | 317.5KB |
| APQuest | N/A | ⚠️ 9/10 | ✅ | ✅ | 11.1KB |
| Adventure | ✅ | ⚠️ 8/10 | ✅ | ✅ | 25.8KB |
| Aquaria | N/A | ⚠️ 9/10 | 1.8KB | ✅ | 277.5KB |
| Baking Adventure | N/A | ✅ | ✅ | ✅ | 18.0KB |
| Blasphemous | N/A | ✅ | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | N/A | ⚠️ 9/10 | 1.4KB | 40.3KB | 325.3KB |
| Bumper Stickers | N/A | ✅ | ✅ | ✅ | 50.5KB |
| Castlevania - Circle of the Moon | N/A | ⚠️ 9/10 | 4.0KB | ✅ | 93.9KB |
| Castlevania 64 | N/A | ⚠️ 9/10 | ✅ | ✅ | 137.9KB |
| Celeste (Open World) | N/A | ✅ | ✅ | ✅ | N/A |
| Celeste 64 | N/A | ⚠️ 9/10 | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | N/A | ✅ | ✅ | ✅ | 16.6KB |
| Choo-Choo Charles | N/A | ✅ | ✅ | ✅ | 281.4KB |
| Civilization VI | N/A | ⚠️ 9/10 | ✅ | ✅ | 163.1KB |
| Coding Adventure | N/A | ✅ | ✅ | ✅ | 54.2KB |
| DLCQuest | N/A | ⚠️ 9/10 | 1.2KB | ✅ | 49.9KB |
| DOOM 1993 | N/A | ⚠️ 9/10 | ✅ | ✅ | 282.1KB |
| DOOM II | N/A | ⚠️ 9/10 | ✅ | ✅ | 327.8KB |
| Dark Souls III | N/A | ⚠️ 9/10 | ✅ | ✅ | 1034.5KB |
| DepGraph | N/A | ❌ | ✅ | ✅ | 410.5KB |
| EarthBound | N/A | ⚠️ 9/10 | ✅ | ✅ | 337.7KB |
| Factorio | N/A | ⚠️ 9/10 | 8.8KB | ✅ | 290.8KB |
| Faxanadu | N/A | ⚠️ 9/10 | ✅ | ✅ | 68.2KB |
| Final Fantasy | N/A | ✅ | ✅ | ✅ | 50.3KB |
| Final Fantasy Mystic Quest | N/A | ⚠️ 8/9 | 14.0KB | ✅ | 549.4KB |
| Heretic | N/A | ⚠️ 9/10 | ✅ | ✅ | 367.8KB |
| Hollow Knight | N/A | ✅ | ✅ | ✅ | N/A |
| Hylics 2 | N/A | ⚠️ 9/10 | ✅ | ✅ | 100.4KB |
| Inscryption | N/A | ⚠️ 9/10 | 8.0KB | ✅ | 84.6KB |
| Jak and Daxter: The Precursor Legacy | N/A | ⚠️ 9/10 | 21.7KB | 4.6KB | 258.5KB |
| Journey to Ascension | N/A | ✅ | ✅ | ✅ | 48.4KB |
| Kingdom Hearts | N/A | ⚠️ 9/10 | ✅ | ✅ | 748.9KB |
| Kingdom Hearts 2 | N/A | ⚠️ 6/7 | 20.4KB | ✅ | 1631.0KB |
| Kirby's Dream Land 3 | N/A | ⚠️ 9/10 | 10.1KB | ✅ | 528.8KB |
| Landstalker - The Treasures of King Nole | N/A | ⚠️ 9/10 | 3.6KB | ✅ | 209.2KB |
| Lingo | N/A | ✅ | 38.2KB | 10.7KB | 940.0KB |
| Links Awakening DX | N/A | ❌ 1/10 | 7.3KB | ✅ | 705.1KB |
| Lufia II Ancient Cave | N/A | ⚠️ 9/10 | ✅ | ✅ | 122.8KB |
| Mario & Luigi Superstar Saga | N/A | ⚠️ 9/10 | ✅ | ✅ | 395.5KB |
| Mega Man 2 | N/A | ⚠️ 9/10 | ✅ | ✅ | 51.8KB |
| Mega Man 3 | N/A | ⚠️ 9/10 | ✅ | ✅ | 71.7KB |
| MegaMan Battle Network 3 | N/A | ✅ | ✅ | ✅ | 204.7KB |
| Meritous | N/A | ✅ | ✅ | ✅ | 57.0KB |
| Metamath | N/A | ❌ 2/10 | ✅ | ✅ | 56.1KB |
| Muse Dash | N/A | ⚠️ 9/10 | ✅ | ✅ | 229.8KB |
| Noita | N/A | ⚠️ 9/10 | ✅ | ✅ | 74.0KB |
| Ocarina of Time | N/A | ✅ | ✅ | ✅ | N/A |
| Old School Runescape | N/A | ⚠️ 9/10 | 1.0KB | ✅ | 305.2KB |
| Overcooked! 2 | N/A | ⚠️ 4/5 | 28.5KB | ✅ | 488.6KB |
| Paint | N/A | ⚠️ 9/10 | 2.7KB | ✅ | 123.5KB |
| Pokemon Emerald | N/A | ✅ | 5.2KB | 8.7KB | N/A |
| Pokemon Red and Blue | N/A | ⚠️ 7/8 | 12.2KB | 13.0KB | 1270.3KB |
| Raft | N/A | ⚠️ 9/10 | 6.5KB | ✅ | 198.4KB |
| Risk of Rain 2 | N/A | ⚠️ 9/10 | ✅ | ✅ | 131.4KB |
| SMZ3 | N/A | ⚠️ 9/10 | 54.2KB | 51.3KB | 1890.8KB |
| Satisfactory | N/A | ❌ | 41.8KB | ✅ | 1624.0KB |
| Saving Princess | N/A | ✅ | ✅ | ✅ | 33.7KB |
| Secret of Evermore | N/A | ⚠️ 9/10 | 5.6KB | 7.5KB | 415.0KB |
| Seedling | N/A | ⚠️ 9/10 | ✅ | ✅ | 156.9KB |
| Shivers | N/A | ⚠️ 9/10 | ✅ | ✅ | 150.1KB |
| Sonic Adventure 2 Battle | N/A | ⚠️ 9/10 | ✅ | ✅ | 262.4KB |
| Starcraft 2 | N/A | ✅ | 29.3KB | 90.1KB | 1084.5KB |
| Stardew Valley | N/A | ❌ 4/10 | 20.0KB | 9.8KB | 2558.8KB |
| Subnautica | N/A | ⚠️ 9/10 | 2.2KB | ✅ | 205.5KB |
| Super Mario 64 | N/A | ⚠️ 9/10 | ✅ | ✅ | 101.3KB |
| Super Mario Land 2 | N/A | ⚠️ 9/10 | 96.3KB | ✅ | 920.0KB |
| Super Mario World | N/A | ⚠️ 9/10 | ✅ | ✅ | 177.9KB |
| Super Metroid | N/A | ✅ | 61.0KB | 119.4KB | 625.1KB |
| TOEM original | N/A | ⚠️ 9/10 | 0.6KB | ✅ | 99.7KB |
| TOEM rule builder | N/A | ⚠️ 9/10 | 0.5KB | ✅ | 99.8KB |
| TUNIC | N/A | ⚠️ 9/10 | 3.1KB | ✅ | 649.4KB |
| Terraria | N/A | ⚠️ 9/10 | 16.9KB | ✅ | 279.5KB |
| The Legend of Zelda | N/A | ⚠️ 9/10 | ✅ | ✅ | 558.4KB |
| The Messenger | N/A | ⚠️ 8/10 | 15.2KB | ✅ | 211.0KB |
| The Wind Waker | N/A | ✅ | 7.0KB | ✅ | 250.3KB |
| The Witness | N/A | ⚠️ 9/10 | 14.6KB | ✅ | 408.0KB |
| Timespinner | N/A | ⚠️ 9/10 | 2.2KB | ✅ | 263.1KB |
| Undertale | N/A | ⚠️ 9/10 | ✅ | ✅ | 56.3KB |
| VVVVVV | N/A | ⚠️ 9/10 | 3.8KB | ✅ | 22.7KB |
| Wargroove | N/A | ✅ | ✅ | ✅ | 44.3KB |
| Yacht Dice | N/A | ⚠️ 9/10 | 0.9KB | 285.0KB | 248.5KB |
| Yoshi's Island | N/A | ⚠️ 9/10 | 9.2KB | ✅ | 295.8KB |
| Yu-Gi-Oh! 2006 | N/A | ⚠️ 9/10 | 1.3KB | 21.4KB | 644.2KB |
| Zillion | N/A | ⚠️ 7/8 | ✅ | ✅ | 321.2KB |
| shapez | N/A | ⚠️ 9/10 | ✅ | ✅ | 153.9KB |

## Games Passing Worldgen Only (1)

These games pass in the Worldgen UT but fail in the Pickle UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Adventure | ✅ | ✅ | 25.8KB |

## Games Passing Pickle Only (20)

These games pass in the Pickle UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Baking Adventure | ✅ | ✅ | 18.0KB |
| Blasphemous | ✅ | ✅ | N/A |
| Bumper Stickers | ✅ | ✅ | 50.5KB |
| Celeste (Open World) | ✅ | ✅ | N/A |
| ChecksFinder | ✅ | ✅ | 16.6KB |
| Choo-Choo Charles | ✅ | ✅ | 281.4KB |
| Coding Adventure | ✅ | ✅ | 54.2KB |
| Final Fantasy | ✅ | ✅ | 50.3KB |
| Hollow Knight | ✅ | ✅ | N/A |
| Journey to Ascension | ✅ | ✅ | 48.4KB |
| Lingo | 38.2KB | 10.7KB | 940.0KB |
| MegaMan Battle Network 3 | ✅ | ✅ | 204.7KB |
| Meritous | ✅ | ✅ | 57.0KB |
| Ocarina of Time | ✅ | ✅ | N/A |
| Pokemon Emerald | 5.2KB | 8.7KB | N/A |
| Saving Princess | ✅ | ✅ | 33.7KB |
| Starcraft 2 | 29.3KB | 90.1KB | 1084.5KB |
| Super Metroid | 61.0KB | 119.4KB | 625.1KB |
| The Wind Waker | 7.0KB | ✅ | 250.3KB |
| Wargroove | ✅ | ✅ | 44.3KB |

## Games Passing Neither (68)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Hat in Time | 18.2KB | ✅ | 230.4KB |
| A Link to the Past | 14.0KB | ✅ | 664.5KB |
| A Short Hike | ✅ | ✅ | 74.4KB |
| APCalc | ✅ | ✅ | 317.5KB |
| APQuest | ✅ | ✅ | 11.1KB |
| Aquaria | 1.8KB | ✅ | 277.5KB |
| Bomb Rush Cyberfunk | 1.4KB | 40.3KB | 325.3KB |
| Castlevania - Circle of the Moon | 4.0KB | ✅ | 93.9KB |
| Castlevania 64 | ✅ | ✅ | 137.9KB |
| Celeste 64 | 4.1KB | ✅ | 53.8KB |
| Civilization VI | ✅ | ✅ | 163.1KB |
| DLCQuest | 1.2KB | ✅ | 49.9KB |
| DOOM 1993 | ✅ | ✅ | 282.1KB |
| DOOM II | ✅ | ✅ | 327.8KB |
| Dark Souls III | ✅ | ✅ | 1034.5KB |
| DepGraph | ✅ | ✅ | 410.5KB |
| EarthBound | ✅ | ✅ | 337.7KB |
| Factorio | 8.8KB | ✅ | 290.8KB |
| Faxanadu | ✅ | ✅ | 68.2KB |
| Final Fantasy Mystic Quest | 14.0KB | ✅ | 549.4KB |
| Heretic | ✅ | ✅ | 367.8KB |
| Hylics 2 | ✅ | ✅ | 100.4KB |
| Inscryption | 8.0KB | ✅ | 84.6KB |
| Jak and Daxter: The Precursor Legacy | 21.7KB | 4.6KB | 258.5KB |
| Kingdom Hearts | ✅ | ✅ | 748.9KB |
| Kingdom Hearts 2 | 20.4KB | ✅ | 1631.0KB |
| Kirby's Dream Land 3 | 10.1KB | ✅ | 528.8KB |
| Landstalker - The Treasures of King Nole | 3.6KB | ✅ | 209.2KB |
| Links Awakening DX | 7.3KB | ✅ | 705.1KB |
| Lufia II Ancient Cave | ✅ | ✅ | 122.8KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | 395.5KB |
| Mega Man 2 | ✅ | ✅ | 51.8KB |
| Mega Man 3 | ✅ | ✅ | 71.7KB |
| Metamath | ✅ | ✅ | 56.1KB |
| Muse Dash | ✅ | ✅ | 229.8KB |
| Noita | ✅ | ✅ | 74.0KB |
| Old School Runescape | 1.0KB | ✅ | 305.2KB |
| Overcooked! 2 | 28.5KB | ✅ | 488.6KB |
| Paint | 2.7KB | ✅ | 123.5KB |
| Pokemon Red and Blue | 12.2KB | 13.0KB | 1270.3KB |
| Raft | 6.5KB | ✅ | 198.4KB |
| Risk of Rain 2 | ✅ | ✅ | 131.4KB |
| SMZ3 | 54.2KB | 51.3KB | 1890.8KB |
| Satisfactory | 41.8KB | ✅ | 1624.0KB |
| Secret of Evermore | 5.6KB | 7.5KB | 415.0KB |
| Seedling | ✅ | ✅ | 156.9KB |
| Shivers | ✅ | ✅ | 150.1KB |
| Sonic Adventure 2 Battle | ✅ | ✅ | 262.4KB |
| Stardew Valley | 20.0KB | 9.8KB | 2558.8KB |
| Subnautica | 2.2KB | ✅ | 205.5KB |
| Super Mario 64 | ✅ | ✅ | 101.3KB |
| Super Mario Land 2 | 96.3KB | ✅ | 920.0KB |
| Super Mario World | ✅ | ✅ | 177.9KB |
| TOEM original | 0.6KB | ✅ | 99.7KB |
| TOEM rule builder | 0.5KB | ✅ | 99.8KB |
| TUNIC | 3.1KB | ✅ | 649.4KB |
| Terraria | 16.9KB | ✅ | 279.5KB |
| The Legend of Zelda | ✅ | ✅ | 558.4KB |
| The Messenger | 15.2KB | ✅ | 211.0KB |
| The Witness | 14.6KB | ✅ | 408.0KB |
| Timespinner | 2.2KB | ✅ | 263.1KB |
| Undertale | ✅ | ✅ | 56.3KB |
| VVVVVV | 3.8KB | ✅ | 22.7KB |
| Yacht Dice | 0.9KB | 285.0KB | 248.5KB |
| Yoshi's Island | 9.2KB | ✅ | 295.8KB |
| Yu-Gi-Oh! 2006 | 1.3KB | 21.4KB | 644.2KB |
| Zillion | ✅ | ✅ | 321.2KB |
| shapez | ✅ | ✅ | 153.9KB |

## Notes

- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Pickle Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
