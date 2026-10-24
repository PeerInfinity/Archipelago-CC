# Fuzz Test Results Summary

**Generated:** 2026-06-28 18:30:50 UTC

**Source Data Created:** 2026-06-28T16:56:10.434319+00:00

**Source Data Last Updated:** 2026-06-28T16:56:10.434330+00:00

[<- Back to Main Test Results Summary](./test-results-summary.md)

[View APWorlds Fuzz Results](./test-results-fuzz-summary-apworlds.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

This summary combines results from fuzz tests that validate game configurations across randomized option combinations:

- **Javascript:** Frontend spoiler playthrough fuzz tests - [View Details](./test-results-spoiler-fuzz.md)
- **UT Fuzz Original:** Universal Tracker (original) fuzz tests - [View Details](./test-results-ut-fuzz-original.md)
- **UT Fuzz Orig Seeded:** Universal Tracker (original with seed) fuzz tests - [View Details](./test-results-ut-fuzz-original_seeded.md)
- **UT Fuzz Worldgen:** Universal Tracker (worldgen-based) fuzz tests - [View Details](./test-results-ut-fuzz-worldgen.md)
- **UT Fuzz Pickle:** Universal Tracker (pickle) fuzz tests - [View Details](./test-results-ut-fuzz-pickle.md)
- **UT Fuzz Hybrid:** Universal Tracker (hybrid) fuzz tests - [View Details](./test-results-ut-fuzz-hybrid.md)

## Summary Statistics

### Individual Test Results

- **Javascript:** 70/76 passed (92.1%)
- **UT Fuzz Original:** 46/89 passed (51.7%)
- **UT Fuzz Orig Seeded:** 50/89 passed (56.2%)
- **UT Fuzz Worldgen:** 69/89 passed (77.5%)
- **UT Fuzz Pickle:** 84/89 passed (94.4%)
- **UT Fuzz Hybrid:** 87/89 passed (97.8%)

### Combined Results (All 6 Tests)

- **Games passing all 6 fuzz tests:** 34/89 (38.2%)
- **Games passing 5 fuzz tests:** 11/89 (12.4%)
- **Games passing 4 fuzz tests:** 28/89 (31.5%)
- **Games passing 3 fuzz tests:** 7/89 (7.9%)
- **Games passing 2 fuzz tests:** 7/89 (7.9%)
- **Games passing 1 fuzz test:** 0/89 (0.0%)
- **Games passing 0 fuzz tests:** 2/89 (2.2%)

### Combined Results (Excluding UT Original/Orig Seeded)

This view excludes UT Original and UT Orig Seeded, showing results for Javascript, UT Worldgen, UT Pickle, and UT Hybrid.

- **Games passing all 4 fuzz tests:** 60/89 (67.4%)
- **Games passing 3 fuzz tests:** 16/89 (18.0%)
- **Games passing 2 fuzz tests:** 11/89 (12.4%)
- **Games passing 1 fuzz test:** 0/89 (0.0%)
- **Games passing 0 fuzz tests:** 2/89 (2.2%)

## Test Results

| Game Name | [Javascript](./test-results-spoiler-fuzz.md) | [UT Original](./test-results-ut-fuzz-original.md) | [UT Orig Seeded](./test-results-ut-fuzz-original_seeded.md) | [UT Worldgen](./test-results-ut-fuzz-worldgen.md) | [UT Pickle](./test-results-ut-fuzz-pickle.md) | [UT Hybrid](./test-results-ut-fuzz-hybrid.md) | Rules Size |
|-----------|:----------:|:------------:|:--------------:|:------------:|:----------:|:----------:|:----------:|
| A Hat in Time | ✅ | ❌ 1/10 | ❌ 1/10 | ✅ | ✅ | ✅ | 230.4KB |
| A Link to the Past | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 664.5KB |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 74.4KB |
| APCalc | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 317.5KB |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 11.1KB |
| Adventure | ✅ | ⚠️ 9/10 | ✅ | ✅ | ✅ | ✅ | 25.8KB |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 277.5KB |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 18.0KB |
| Blasphemous | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 325.3KB |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 50.5KB |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 93.9KB |
| Castlevania 64 | ✅ | ❌ 1/10 | ❌ 1/10 | ✅ | ✅ | ✅ | 137.9KB |
| Celeste (Open World) | ✅ | ❌ 4/10 | ✅ | ❌ | ✅ | ✅ | N/A |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 53.8KB |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 16.6KB |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 281.4KB |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 163.1KB |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 54.2KB |
| DLCQuest | ✅ | ⚠️ 9/10 | ✅ | ✅ | ✅ | ✅ | 49.9KB |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 282.1KB |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 327.8KB |
| Dark Souls III | — | ✅ | ✅ | ✅ | ✅ | ✅ | 1034.5KB |
| DepGraph | ✅ | ⚠️ 9/10 | ⚠️ 9/10 | ✅ | ✅ | ✅ | 410.5KB |
| EarthBound | ✅ | 🔶 5/10 | 🔶 5/10 | ✅ | ✅ | ✅ | 337.7KB |
| Factorio | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 290.8KB |
| Faxanadu | ✅ | ❌ 2/10 | ❌ 1/10 | ✅ | ✅ | ✅ | 68.2KB |
| Final Fantasy | — | ✅ | ✅ | ✅ | ✅ | ✅ | 50.3KB |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 549.4KB |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 367.8KB |
| Hollow Knight | — | ❌ | ❌ | ❌ | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 100.4KB |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 84.6KB |
| Jak and Daxter: The Precursor Legacy | — | ❌ 3/10 | 🔶 8/10 | ❌ | ✅ | ✅ | 258.5KB |
| Journey to Ascension | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | 48.4KB |
| Kingdom Hearts | ✅ | ❌ 4/10 | ❌ 4/10 | ❌ 4/10 | ✅ | ✅ | 748.9KB |
| Kingdom Hearts 2 | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | 1631.0KB |
| Kirby's Dream Land 3 | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 528.8KB |
| Landstalker - The Treasures of King Nole | ✅ | ❌ 1/10 | ❌ 2/10 | ✅ | ✅ | ✅ | 209.2KB |
| Lingo | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 940.0KB |
| Links Awakening DX | ✅ | ❌ 1/10 | ❌ 1/10 | ✅ | ❌ 1/10 | ✅ | 705.1KB |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 122.8KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 395.5KB |
| Mega Man 2 | ✅ | ⚠️ 9/10 | ⚠️ 9/10 | ✅ | ✅ | ✅ | 51.8KB |
| Mega Man 3 | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 71.7KB |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 204.7KB |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 57.0KB |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 56.1KB |
| Muse Dash | ✅ | ❌ | ❌ 2/10 | ✅ | ✅ | ✅ | 229.8KB |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 74.0KB |
| Ocarina of Time | — | ❌ | ❌ | ❌ | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 305.2KB |
| Overcooked! 2 | ✅ | ❌ | 🔶 3/5 | ✅ | ✅ | ✅ | 488.6KB |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 123.5KB |
| Pokemon Emerald | — | 🔶 5/7 | 🔶 5/7 | ✅ | ✅ | ✅ | N/A |
| Pokemon Red and Blue | — | ❌ | ❌ | ❌ | ✅ | ✅ | 1270.3KB |
| Raft | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 198.4KB |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 131.4KB |
| SMZ3 | — | ❌ | ❌ 2/10 | ❌ | ✅ | ✅ | 1890.8KB |
| Satisfactory | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | 1624.0KB |
| Saving Princess | ✅ | ❌ 3/10 | ✅ | ✅ | ✅ | ✅ | 33.7KB |
| Secret of Evermore | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 415.0KB |
| Seedling | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 156.9KB |
| Shivers | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 150.1KB |
| Sonic Adventure 2 Battle | ✅ | ❌ 1/10 | ❌ 2/10 | ✅ | ✅ | ✅ | 262.4KB |
| Starcraft 2 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | 1084.5KB |
| Stardew Valley | — | ❌ 1/10 | 🔶 5/10 | ❌ 3/10 | ❌ 3/10 | 🔶 5/10 | 2558.8KB |
| Subnautica | ✅ | ❌ 1/10 | ❌ 1/10 | ✅ | ✅ | ✅ | 205.5KB |
| Super Mario 64 | ✅ | ❌ | ❌ 1/10 | ✅ | ✅ | ✅ | 101.3KB |
| Super Mario Land 2 | ✅ | ⚠️ 9/10 | ⚠️ 9/10 | ✅ | ✅ | ✅ | 920.0KB |
| Super Mario World | ✅ | 🔶 7/10 | 🔶 7/10 | ✅ | ✅ | ✅ | 177.9KB |
| Super Metroid | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | 625.1KB |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 99.7KB |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 99.8KB |
| TUNIC | ❌ | ✅ | ✅ | 🔶 6/10 | ✅ | ✅ | 649.4KB |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 279.5KB |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 558.4KB |
| The Messenger | ✅ | ❌ 1/10 | ❌ 1/10 | ✅ | ⚠️ 9/10 | ✅ | 211.0KB |
| The Wind Waker | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 250.3KB |
| The Witness | ❌ | ✅ | ✅ | ❌ 1/10 | ✅ | ✅ | 408.0KB |
| Timespinner | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 263.1KB |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 56.3KB |
| VVVVVV | ✅ | 🔶 8/10 | 🔶 8/10 | ✅ | ✅ | ✅ | 22.7KB |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 44.3KB |
| Yacht Dice | — | ❌ | ❌ | ❌ | ✅ | ✅ | 248.5KB |
| Yoshi's Island | ✅ | ❌ 2/10 | ❌ 2/10 | ✅ | ✅ | ✅ | 295.8KB |
| Yu-Gi-Oh! 2006 | — | 🔶 5/10 | 🔶 5/10 | ❌ | ✅ | ✅ | 644.2KB |
| Zillion | — | ❌ | ❌ | ❌ | ⚠️ 8/8 | ❌ | 321.2KB |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 153.9KB |

## Notes

- **✅:** All fuzz runs passed
- **⚠️ X/Y:** Most runs passed (90-99%, shown as passes/total)
- **🔶 X/Y:** Some runs passed (50-89%, shown as passes/total)
- **❌ X/Y:** Most runs failed (<50%, shown as passes/total)
- **❌:** No runs passed
- **—:** No test results available for this game
- **Rules Size:** File size of rules.json for seed 1

### About Fuzz Tests

Fuzz tests validate game configurations by generating random YAML option combinations and running various tests:

- **Javascript:** Tests frontend spoiler playthrough with randomized configurations
- **UT Fuzz:** Tests Universal Tracker's accessibility calculations against Python's sphere log
  - **Original:** Uses native game integration (random internal seed)
  - **Orig Seeded:** Uses native game integration with the actual generation seed number
  - **Worldgen:** Uses worldgen-based tracking (regenerates from JSON rules)
  - **Pickle:** Uses pickle-based tracking (loads serialized multiworld)
  - **Hybrid:** Prefers native integration, falls back to worldgen
