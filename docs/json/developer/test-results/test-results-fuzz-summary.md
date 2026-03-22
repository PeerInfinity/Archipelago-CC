# Fuzz Test Results Summary

**Generated:** 2026-03-22 03:26:59 UTC

**Source Data Created:** 2026-03-21T22:05:16.406246+00:00

**Source Data Last Updated:** 2026-03-21T22:05:16.406255+00:00

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

- **Javascript:** 61/75 passed (81.3%)
- **UT Fuzz Original:** 39/88 passed (44.3%)
- **UT Fuzz Orig Seeded:** 48/88 passed (54.5%)
- **UT Fuzz Worldgen:** 73/88 passed (83.0%)
- **UT Fuzz Pickle:** 77/88 passed (87.5%)
- **UT Fuzz Hybrid:** 64/88 passed (72.7%)

### Combined Results (All 6 Tests)

- **Games passing all 6 fuzz tests:** 29/88 (33.0%)
- **Games passing 5 fuzz tests:** 11/88 (12.5%)
- **Games passing 4 fuzz tests:** 26/88 (29.5%)
- **Games passing 3 fuzz tests:** 7/88 (8.0%)
- **Games passing 2 fuzz tests:** 0/88 (0.0%)
- **Games passing 1 fuzz test:** 8/88 (9.1%)
- **Games passing 0 fuzz tests:** 7/88 (8.0%)

### Combined Results (Excluding UT Original/Orig Seeded)

This view excludes UT Original and UT Orig Seeded, showing results for Javascript, UT Worldgen, UT Pickle, and UT Hybrid.

- **Games passing all 4 fuzz tests:** 56/88 (63.6%)
- **Games passing 3 fuzz tests:** 9/88 (10.2%)
- **Games passing 2 fuzz tests:** 8/88 (9.1%)
- **Games passing 1 fuzz test:** 8/88 (9.1%)
- **Games passing 0 fuzz tests:** 7/88 (8.0%)

## Test Results

| Game Name | [Javascript](./test-results-spoiler-fuzz.md) | [UT Original](./test-results-ut-fuzz-original.md) | [UT Orig Seeded](./test-results-ut-fuzz-original_seeded.md) | [UT Worldgen](./test-results-ut-fuzz-worldgen.md) | [UT Pickle](./test-results-ut-fuzz-pickle.md) | [UT Hybrid](./test-results-ut-fuzz-hybrid.md) | Rules Size |
|-----------|:----------:|:------------:|:--------------:|:------------:|:----------:|:----------:|:----------:|
| A Hat in Time | ✅ | ❌ 1/10 | ❌ 1/10 | ✅ | ✅ | ✅ | 230.2KB |
| A Link to the Past | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 664.0KB |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 74.4KB |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | ⚠️ 9/10 | ✅ | ✅ | ✅ | ✅ | 25.7KB |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 277.3KB |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 17.9KB |
| Blasphemous | — | ✅ | ✅ | ✅ | ✅ | ❌ | 2760.8KB |
| Bomb Rush Cyberfunk | 🔶 8/10 | ✅ | ✅ | ✅ | ✅ | ❌ | 325.3KB |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 93.8KB |
| Castlevania 64 | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 137.8KB |
| Celeste (Open World) | ⚠️ 9/10 | ❌ 4/10 | ✅ | ✅ | ✅ | ❌ | 1039.8KB |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 53.6KB |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 16.4KB |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 281.4KB |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 163.1KB |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 54.2KB |
| DLCQuest | ✅ | ⚠️ 9/10 | ✅ | ✅ | ✅ | ✅ | 49.8KB |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 281.9KB |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 327.5KB |
| Dark Souls III | — | ✅ | ✅ | ✅ | ✅ | ✅ | 1034.1KB |
| DepGraph | ✅ | ⚠️ 9/10 | ✅ | ✅ | ✅ | ✅ | 201.9KB |
| Donkey Kong Country 3 | ✅ | 🔶 7/10 | 🔶 7/10 | ✅ | ✅ | ✅ | 122.4KB |
| EarthBound | ✅ | 🔶 5/10 | 🔶 5/10 | ✅ | ✅ | ✅ | 337.6KB |
| Factorio | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 290.1KB |
| Faxanadu | ✅ | ❌ 2/10 | ❌ 1/10 | ✅ | ✅ | ✅ | 68.1KB |
| Final Fantasy | — | ✅ | ✅ | ✅ | ✅ | ✅ | 50.3KB |
| Final Fantasy Mystic Quest | ✅ | ⚠️ 9/10 | ✅ | ✅ | ✅ | ✅ | 548.1KB |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 367.6KB |
| Hollow Knight | — | ❌ | ❌ | ❌ | ✅ | ❌ | 3501.1KB |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 100.4KB |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 84.3KB |
| Jak and Daxter: The Precursor Legacy | — | ❌ 3/10 | ✅ | ✅ | ✅ | ❌ | 257.9KB |
| Journey to Ascension | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 48.3KB |
| Kingdom Hearts | 🔶 8/10 | ❌ 4/10 | ❌ 4/10 | ❌ 4/10 | ✅ | ❌ 4/10 | 748.7KB |
| Kingdom Hearts 2 | ❌ 3/7 | 🔶 7/10 | 🔶 7/10 | ❌ | 🔶 7/10 | 🔶 6/10 | 1630.7KB |
| Kirby's Dream Land 3 | ❌ 3/10 | ❌ | ❌ | ❌ | ✅ | ❌ | 528.7KB |
| Landstalker - The Treasures of King Nole | ✅ | ❌ 2/10 | ❌ 3/10 | ✅ | ✅ | ✅ | 209.2KB |
| Lingo | 🔶 2/3 | ✅ | ✅ | ✅ | ✅ | ❌ | 940.0KB |
| Links Awakening DX | ✅ | ❌ 1/10 | ❌ 1/10 | ✅ | ❌ 1/10 | ✅ | 703.1KB |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 122.8KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 395.5KB |
| Mega Man 2 | ✅ | ⚠️ 9/10 | ⚠️ 9/10 | ✅ | ✅ | ✅ | 51.7KB |
| Mega Man 3 | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 71.7KB |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 204.7KB |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 57.0KB |
| Metamath | ✅ | ⚠️ 9/10 | ✅ | ✅ | ✅ | ✅ | 56.0KB |
| Muse Dash | ✅ | ❌ | ❌ 3/10 | ✅ | ✅ | ✅ | 228.3KB |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 73.9KB |
| Ocarina of Time | — | ❌ | ❌ | ❌ | ✅ | ❌ | 1274.4KB |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 305.2KB |
| Overcooked! 2 | ✅ | ❌ | 🔶 3/5 | ✅ | ✅ | ✅ | 488.3KB |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 123.5KB |
| Pokemon Emerald | — | ❌ 3/7 | ❌ 3/7 | 🔶 4/7 | 🔶 5/7 | ❌ 3/7 | 1350.2KB |
| Pokemon Red and Blue | — | ❌ | ❌ | ❌ | ✅ | ❌ | 1270.2KB |
| Raft | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 198.4KB |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 131.4KB |
| SMZ3 | — | ❌ 1/10 | ❌ 2/10 | ❌ 2/10 | ✅ | ❌ 1/10 | 1890.6KB |
| Satisfactory | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | 1619.5KB |
| Saving Princess | ✅ | ❌ 3/10 | ✅ | ✅ | ✅ | ✅ | 33.6KB |
| Secret of Evermore | 🔶 5/10 | ✅ | ✅ | ✅ | ✅ | ❌ | 415.0KB |
| Shivers | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | 150.1KB |
| Sonic Adventure 2 Battle | ⚠️ 9/10 | ❌ 1/10 | ❌ 2/10 | ✅ | ✅ | ✅ | 262.2KB |
| Starcraft 2 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 1086.9KB |
| Stardew Valley | — | ❌ | ❌ 3/10 | ❌ | ❌ 4/10 | 🔶 5/10 | 2558.2KB |
| Subnautica | ✅ | ❌ 1/10 | ❌ 1/10 | ✅ | ✅ | ✅ | 205.5KB |
| Super Mario 64 | ✅ | ❌ 4/10 | ❌ 4/10 | ✅ | ✅ | ✅ | 101.2KB |
| Super Mario Land 2 | ✅ | ❌ 4/10 | ❌ 1/10 | ✅ | ✅ | ✅ | 919.1KB |
| Super Mario World | ✅ | 🔶 7/10 | 🔶 7/10 | ✅ | ✅ | ✅ | 177.7KB |
| Super Metroid | ❌ | ❌ | ❌ | ❌ | 🔶 3/5 | ❌ | 625.1KB |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 99.7KB |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 99.7KB |
| TUNIC | ❌ 2/10 | ✅ | ✅ | ✅ | ✅ | 🔶 6/10 | 649.2KB |
| Terraria | ✅ | ⚠️ 9/10 | ✅ | ✅ | ✅ | ✅ | 279.0KB |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 554.6KB |
| The Messenger | ✅ | ❌ | ❌ 1/10 | ✅ | ❌ 1/10 | ✅ | 210.4KB |
| The Wind Waker | ✅ | ❌ | ❌ 1/5 | ✅ | ✅ | ✅ | 250.2KB |
| The Witness | ❌ 2/10 | ✅ | ✅ | ✅ | ✅ | ❌ 2/10 | 468.1KB |
| Timespinner | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 262.9KB |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 56.3KB |
| VVVVVV | ✅ | 🔶 8/10 | 🔶 8/10 | ✅ | ✅ | ✅ | 22.7KB |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 44.1KB |
| Yacht Dice | — | ❌ | ❌ | ❌ | ✅ | ❌ | 248.5KB |
| Yoshi's Island | ✅ | ❌ 3/10 | ❌ 2/10 | ✅ | ✅ | ✅ | 295.3KB |
| Yu-Gi-Oh! 2006 | — | 🔶 5/10 | 🔶 5/10 | 🔶 5/10 | ✅ | 🔶 5/10 | 644.0KB |
| Zillion | — | ❌ | ❌ | ❌ | ⚠️ 8/8 | ❌ | 321.2KB |
| shapez | 🔶 8/10 | ✅ | ✅ | ✅ | ✅ | ✅ | 153.8KB |

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
