# Universal Tracker Fuzz Test Comparison: Original vs Worldgen

**Generated:** 2026-06-27 23:54:33 UTC

**Source Data Last Updated:** 2026-03-24T03:06:02

This report compares fuzz test results between the Original Universal Tracker (FarisTheAncient) and the Worldgen Universal Tracker (regenerates world from rules.json).

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Original UT Results](./test-results-ut-fuzz-original.md)
- [Worldgen UT Results](./test-results-ut-fuzz-worldgen.md)

## Summary

- **Total Games Tested:** 88
- **Passing Both:** 31 (35.2%)
- **Passing Original Only:** 6 (6.8%)
- **Passing Worldgen Only:** 32 (36.4%)
- **Passing Neither:** 19 (21.6%)
- **Passing Worldgen with no custom code:** 37 (42.0%)
- **Passing Worldgen Only with no custom code:** 14 (15.9%)

## Full Comparison

| Game Name | Original Result | Worldgen Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ❌ 15/100 | ✅ | 18.2KB | ✅ | 230.4KB |
| A Link to the Past | ❌ | ✅ | 14.0KB | ✅ | 664.5KB |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | 74.4KB |
| APQuest | ✅ | ✅ | ✅ | ✅ | 11.1KB |
| Adventure | ⚠️ 89/100 | ✅ | ✅ | ✅ | 25.8KB |
| Aquaria | ✅ | ✅ | 1.8KB | ✅ | 277.5KB |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | 18.0KB |
| Blasphemous | ✅ | ❌ | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ✅ | ❌ | 1.4KB | 40.3KB | 325.3KB |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | 50.5KB |
| Castlevania - Circle of the Moon | ✅ | ✅ | 4.0KB | ✅ | 93.9KB |
| Castlevania 64 | ❌ 10/100 | ✅ | ✅ | ✅ | 137.9KB |
| Celeste (Open World) | ❌ 46/100 | ❌ | ✅ | ✅ | N/A |
| Celeste 64 | ✅ | ✅ | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | 16.6KB |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | 281.4KB |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | 163.1KB |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | 54.2KB |
| DLCQuest | ⚠️ 92/100 | ✅ | 1.2KB | ✅ | 49.9KB |
| DOOM 1993 | ⚠️ 99/100 | ✅ | ✅ | ✅ | 282.1KB |
| DOOM II | ✅ | ✅ | ✅ | ✅ | 327.8KB |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | 1034.5KB |
| DepGraph | ⚠️ 82/100 | ✅ | ✅ | ✅ | 410.5KB |
| Donkey Kong Country 3 | ⚠️ 52/100 | ✅ | N/A | N/A | N/A |
| EarthBound | ❌ 30/100 | ✅ | ✅ | ✅ | 337.7KB |
| Factorio | ❌ | ✅ | 8.8KB | ✅ | 290.8KB |
| Faxanadu | ❌ 16/100 | ✅ | ✅ | ✅ | 68.2KB |
| Final Fantasy | ✅ | ✅ | ✅ | ✅ | 50.3KB |
| Final Fantasy Mystic Quest | ⚠️ 89/100 | ✅ | 14.0KB | ✅ | 549.4KB |
| Heretic | ✅ | ✅ | ✅ | ✅ | 367.8KB |
| Hollow Knight | ❌ 9/100 | ❌ | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | 100.4KB |
| Inscryption | ✅ | ✅ | 8.0KB | ✅ | 84.6KB |
| Jak and Daxter: The Precursor Legacy | ⚠️ 62/100 | ❌ 1/100 | 21.7KB | 4.6KB | 258.5KB |
| Journey to Ascension | ❌ | ❌ | ✅ | ✅ | 48.4KB |
| Kingdom Hearts | ❌ 19/99 | ❌ 45/100 | ✅ | ✅ | 748.9KB |
| Kingdom Hearts 2 | ❌ 44/100 | ❌ | 20.4KB | ✅ | 1631.0KB |
| Kirby's Dream Land 3 | ❌ | ⚠️ 88/98 | 10.1KB | ✅ | 528.8KB |
| Landstalker - The Treasures of King Nole | ❌ 31/100 | ✅ | 3.6KB | ✅ | 209.2KB |
| Lingo | ❌ 20/45 | ❌ 2/45 | 38.2KB | 10.7KB | 940.0KB |
| Links Awakening DX | ❌ 23/100 | ✅ | 7.3KB | ✅ | 705.1KB |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | 122.8KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | 395.5KB |
| Mega Man 2 | ⚠️ 93/100 | ✅ | ✅ | ✅ | 51.8KB |
| Mega Man 3 | ❌ | ✅ | ✅ | ✅ | 71.7KB |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | 204.7KB |
| Meritous | ✅ | ✅ | ✅ | ✅ | 57.0KB |
| Metamath | ⚠️ 90/100 | ⚠️ 99/100 | ✅ | ✅ | 56.1KB |
| Muse Dash | ❌ | ✅ | ✅ | ✅ | 229.8KB |
| Noita | ✅ | ✅ | ✅ | ✅ | 74.0KB |
| Ocarina of Time | ❌ | ❌ | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | ✅ | 1.0KB | ✅ | 305.2KB |
| Overcooked! 2 | ❌ 9/100 | ✅ | 28.5KB | ✅ | 488.6KB |
| Paint | ✅ | ✅ | 2.7KB | ✅ | 123.5KB |
| Pokemon Emerald | ⚠️ 55/92 | ❌ 32/92 | 5.2KB | 8.7KB | N/A |
| Pokemon Red and Blue | ❌ | ❌ | 12.2KB | 13.0KB | 1270.3KB |
| Raft | ✅ | ❌ | 6.5KB | ✅ | 198.4KB |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | 131.4KB |
| SMZ3 | ❌ 1/100 | ❌ | 54.2KB | 51.3KB | 1890.8KB |
| Satisfactory | ❌ | ✅ | 41.8KB | ✅ | 1624.0KB |
| Saving Princess | ❌ 24/100 | ✅ | ✅ | ✅ | 33.7KB |
| Secret of Evermore | ✅ | ❌ | 5.6KB | 7.5KB | 415.0KB |
| Shivers | ❌ | ✅ | ✅ | ✅ | 150.1KB |
| Sonic Adventure 2 Battle | ❌ 6/100 | ✅ | ✅ | ✅ | 262.4KB |
| Starcraft 2 | ❌ | ❌ | 29.3KB | 90.1KB | 1084.5KB |
| Stardew Valley | ❌ 6/99 | ❌ | 20.0KB | 9.8KB | 2558.8KB |
| Subnautica | ❌ 13/100 | ✅ | 2.2KB | ✅ | 205.5KB |
| Super Mario 64 | ❌ 28/100 | ✅ | ✅ | ✅ | 101.3KB |
| Super Mario Land 2 | ❌ 20/100 | ✅ | 96.3KB | ✅ | 920.0KB |
| Super Mario World | ⚠️ 55/100 | ✅ | ✅ | ✅ | 177.9KB |
| Super Metroid | ❌ 6/100 | ❌ | 61.0KB | 119.4KB | 625.1KB |
| TOEM original | ✅ | ✅ | 0.6KB | ✅ | 99.7KB |
| TOEM rule builder | ✅ | ✅ | 0.5KB | ✅ | 99.8KB |
| TUNIC | ✅ | ⚠️ 58/100 | 3.1KB | ✅ | 649.4KB |
| Terraria | ⚠️ 98/100 | ✅ | 16.9KB | ✅ | 279.5KB |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | 558.4KB |
| The Messenger | ❌ 7/100 | ✅ | 15.2KB | ✅ | 211.0KB |
| The Wind Waker | ❌ 4/57 | ✅ | 7.0KB | ✅ | 250.3KB |
| The Witness | ✅ | ❌ 15/100 | 14.6KB | ✅ | 408.0KB |
| Timespinner | ❌ 4/100 | ✅ | 2.2KB | ✅ | 263.1KB |
| Undertale | ✅ | ✅ | ✅ | ✅ | 56.3KB |
| VVVVVV | ⚠️ 64/100 | ✅ | 3.8KB | ✅ | 22.7KB |
| Wargroove | ✅ | ✅ | ✅ | ✅ | 44.3KB |
| Yacht Dice | ❌ 1/100 | ❌ | 0.9KB | 285.0KB | 248.5KB |
| Yoshi's Island | ❌ 22/100 | ✅ | 9.2KB | ✅ | 295.8KB |
| Yu-Gi-Oh! 2006 | ❌ 34/100 | ❌ | 1.3KB | 21.4KB | 644.2KB |
| Zillion | ❌ | ❌ | ✅ | ✅ | 321.2KB |
| shapez | ✅ | ✅ | ✅ | ✅ | 153.9KB |

## Games Passing Both (31)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Short Hike | ✅ | ✅ | 74.4KB |
| APQuest | ✅ | ✅ | 11.1KB |
| Aquaria | 1.8KB | ✅ | 277.5KB |
| Baking Adventure | ✅ | ✅ | 18.0KB |
| Bumper Stickers | ✅ | ✅ | 50.5KB |
| Castlevania - Circle of the Moon | 4.0KB | ✅ | 93.9KB |
| Celeste 64 | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | ✅ | ✅ | 16.6KB |
| Choo-Choo Charles | ✅ | ✅ | 281.4KB |
| Civilization VI | ✅ | ✅ | 163.1KB |
| Coding Adventure | ✅ | ✅ | 54.2KB |
| DOOM II | ✅ | ✅ | 327.8KB |
| Dark Souls III | ✅ | ✅ | 1034.5KB |
| Final Fantasy | ✅ | ✅ | 50.3KB |
| Heretic | ✅ | ✅ | 367.8KB |
| Hylics 2 | ✅ | ✅ | 100.4KB |
| Inscryption | 8.0KB | ✅ | 84.6KB |
| Lufia II Ancient Cave | ✅ | ✅ | 122.8KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | 395.5KB |
| MegaMan Battle Network 3 | ✅ | ✅ | 204.7KB |
| Meritous | ✅ | ✅ | 57.0KB |
| Noita | ✅ | ✅ | 74.0KB |
| Old School Runescape | 1.0KB | ✅ | 305.2KB |
| Paint | 2.7KB | ✅ | 123.5KB |
| Risk of Rain 2 | ✅ | ✅ | 131.4KB |
| TOEM original | 0.6KB | ✅ | 99.7KB |
| TOEM rule builder | 0.5KB | ✅ | 99.8KB |
| The Legend of Zelda | ✅ | ✅ | 558.4KB |
| Undertale | ✅ | ✅ | 56.3KB |
| Wargroove | ✅ | ✅ | 44.3KB |
| shapez | ✅ | ✅ | 153.9KB |

## Games Passing Original Only (6)

These games pass in the Original UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Blasphemous | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | 1.4KB | 40.3KB | 325.3KB |
| Raft | 6.5KB | ✅ | 198.4KB |
| Secret of Evermore | 5.6KB | 7.5KB | 415.0KB |
| TUNIC | 3.1KB | ✅ | 649.4KB |
| The Witness | 14.6KB | ✅ | 408.0KB |

## Games Passing Worldgen Only (32)

These games pass in the Worldgen UT but fail in the Original UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Hat in Time | 18.2KB | ✅ | 230.4KB |
| A Link to the Past | 14.0KB | ✅ | 664.5KB |
| Adventure | ✅ | ✅ | 25.8KB |
| Castlevania 64 | ✅ | ✅ | 137.9KB |
| DLCQuest | 1.2KB | ✅ | 49.9KB |
| DOOM 1993 | ✅ | ✅ | 282.1KB |
| DepGraph | ✅ | ✅ | 410.5KB |
| Donkey Kong Country 3 | N/A | N/A | N/A |
| EarthBound | ✅ | ✅ | 337.7KB |
| Factorio | 8.8KB | ✅ | 290.8KB |
| Faxanadu | ✅ | ✅ | 68.2KB |
| Final Fantasy Mystic Quest | 14.0KB | ✅ | 549.4KB |
| Landstalker - The Treasures of King Nole | 3.6KB | ✅ | 209.2KB |
| Links Awakening DX | 7.3KB | ✅ | 705.1KB |
| Mega Man 2 | ✅ | ✅ | 51.8KB |
| Mega Man 3 | ✅ | ✅ | 71.7KB |
| Muse Dash | ✅ | ✅ | 229.8KB |
| Overcooked! 2 | 28.5KB | ✅ | 488.6KB |
| Satisfactory | 41.8KB | ✅ | 1624.0KB |
| Saving Princess | ✅ | ✅ | 33.7KB |
| Shivers | ✅ | ✅ | 150.1KB |
| Sonic Adventure 2 Battle | ✅ | ✅ | 262.4KB |
| Subnautica | 2.2KB | ✅ | 205.5KB |
| Super Mario 64 | ✅ | ✅ | 101.3KB |
| Super Mario Land 2 | 96.3KB | ✅ | 920.0KB |
| Super Mario World | ✅ | ✅ | 177.9KB |
| Terraria | 16.9KB | ✅ | 279.5KB |
| The Messenger | 15.2KB | ✅ | 211.0KB |
| The Wind Waker | 7.0KB | ✅ | 250.3KB |
| Timespinner | 2.2KB | ✅ | 263.1KB |
| VVVVVV | 3.8KB | ✅ | 22.7KB |
| Yoshi's Island | 9.2KB | ✅ | 295.8KB |

## Games Passing Neither (19)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Celeste (Open World) | ✅ | ✅ | N/A |
| Hollow Knight | ✅ | ✅ | N/A |
| Jak and Daxter: The Precursor Legacy | 21.7KB | 4.6KB | 258.5KB |
| Journey to Ascension | ✅ | ✅ | 48.4KB |
| Kingdom Hearts | ✅ | ✅ | 748.9KB |
| Kingdom Hearts 2 | 20.4KB | ✅ | 1631.0KB |
| Kirby's Dream Land 3 | 10.1KB | ✅ | 528.8KB |
| Lingo | 38.2KB | 10.7KB | 940.0KB |
| Metamath | ✅ | ✅ | 56.1KB |
| Ocarina of Time | ✅ | ✅ | N/A |
| Pokemon Emerald | 5.2KB | 8.7KB | N/A |
| Pokemon Red and Blue | 12.2KB | 13.0KB | 1270.3KB |
| SMZ3 | 54.2KB | 51.3KB | 1890.8KB |
| Starcraft 2 | 29.3KB | 90.1KB | 1084.5KB |
| Stardew Valley | 20.0KB | 9.8KB | 2558.8KB |
| Super Metroid | 61.0KB | 119.4KB | 625.1KB |
| Yacht Dice | 0.9KB | 285.0KB | 248.5KB |
| Yu-Gi-Oh! 2006 | 1.3KB | 21.4KB | 644.2KB |
| Zillion | ✅ | ✅ | 321.2KB |

## Notes

- **Original Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
