# Fuzz Test Results Summary

**Generated:** 2026-02-04 11:50:39

**Source Data Created:** 2026-02-04T05:43:50.051248

**Source Data Last Updated:** 2026-02-04T05:43:50.051254

[<- Back to Main Test Results Summary](./test-results-summary.md)

[View APWorlds Fuzz Results](./test-results-fuzz-summary-apworlds.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

This summary combines results from fuzz tests that validate game configurations across randomized option combinations:

- **Javascript:** Frontend spoiler playthrough fuzz tests - [View Details](./test-results-spoiler-fuzz.md)
- **UT Fuzz Original:** Universal Tracker (original) fuzz tests - [View Details](./test-results-ut-fuzz-original.md)
- **UT Fuzz Modified:** Universal Tracker (modified/worldgen) fuzz tests - [View Details](./test-results-ut-fuzz-modified.md)
- **UT Fuzz Pickle:** Universal Tracker (pickle) fuzz tests - [View Details](./test-results-ut-fuzz-pickle.md)
- **UT Fuzz Hybrid:** Universal Tracker (hybrid) fuzz tests - [View Details](./test-results-ut-fuzz-hybrid.md)

## Summary Statistics

### Individual Test Results

- **Javascript:** 61/73 passed (83.6%)
- **UT Fuzz Original:** 38/85 passed (44.7%)
- **UT Fuzz Modified:** 61/85 passed (71.8%)
- **UT Fuzz Pickle:** 75/85 passed (88.2%)
- **UT Fuzz Hybrid:** 79/85 passed (92.9%)

### Combined Results (All 5 Tests)

- **Games passing all 5 fuzz tests:** 30/85 (35.3%)
- **Games passing 4 fuzz tests:** 29/85 (34.1%)
- **Games passing 3 fuzz tests:** 8/85 (9.4%)
- **Games passing 2 fuzz tests:** 11/85 (12.9%)
- **Games passing 1 fuzz test:** 2/85 (2.4%)
- **Games passing 0 fuzz tests:** 5/85 (5.9%)

### Combined Results (Excluding UT Original)

This view excludes UT Original, showing results for Javascript, UT Modified, UT Pickle, and UT Hybrid.

- **Games passing all 4 fuzz tests:** 56/85 (65.9%)
- **Games passing 3 fuzz tests:** 7/85 (8.2%)
- **Games passing 2 fuzz tests:** 14/85 (16.5%)
- **Games passing 1 fuzz test:** 3/85 (3.5%)
- **Games passing 0 fuzz tests:** 5/85 (5.9%)

## Test Results

| Game Name | [Javascript](./test-results-spoiler-fuzz.md) | [UT Original](./test-results-ut-fuzz-original.md) | [UT Modified](./test-results-ut-fuzz-modified.md) | [UT Pickle](./test-results-ut-fuzz-pickle.md) | [UT Hybrid](./test-results-ut-fuzz-hybrid.md) | Rules Size |
|-----------|:----------:|:------------:|:------------:|:----------:|:----------:|:----------:|
| A Hat in Time | ✅ | ❌ 17% | ✅ | ✅ | ✅ | 231.1KB |
| A Link to the Past | ✅ | ❌ 0% | ✅ | ✅ | ✅ | 667.7KB |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | 410.7KB |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | ⚠️ 94% | ✅ | ✅ | ✅ | 26.0KB |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | 275.1KB |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | 18.2KB |
| Blasphemous | — | ✅ | ❌ 0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | 🔶 80% | ✅ | ❌ 0% | ✅ | ✅ | 329.0KB |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | 94.4KB |
| Castlevania 64 | ✅ | ❌ 10% | ✅ | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | ✅ | 🔶 51% | ❌ 0% | ✅ | ✅ | 1043.4KB |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | 53.8KB |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | 16.2KB |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | 282.3KB |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | 166.9KB |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | 54.9KB |
| DLCQuest | ✅ | ❌ 46% | ✅ | ✅ | ✅ | 51.0KB |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | 280.1KB |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | 326.5KB |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | 1062.0KB |
| Donkey Kong Country 3 | ✅ | 🔶 52% | ✅ | ✅ | ✅ | 122.5KB |
| Factorio | ✅ | ❌ 0% | ✅ | ✅ | ✅ | 295.0KB |
| Faxanadu | ✅ | ❌ 20% | ✅ | ✅ | ✅ | 68.7KB |
| Final Fantasy | — | ✅ | ✅ | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | 🔶 50% | ❌ 1% | 🔶 80% | 🔶 70% | ❌ 0% | 549.5KB |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | 367.5KB |
| Hollow Knight | — | ❌ 11% | ❌ 0% | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | 101.9KB |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | — | 🔶 62% | ❌ 1% | ✅ | ✅ | 298.6KB |
| Kingdom Hearts | 🔶 80% | ❌ 18% | ❌ 15% | ✅ | ✅ | 753.6KB |
| Kingdom Hearts 2 | ✅ | ❌ 37% | ❌ 0% | ❌ 10% | ❌ 10% | 1641.1KB |
| Kirby's Dream Land 3 | 🔶 50% | ❌ 3% | 🔶 87% | ✅ | ✅ | 529.1KB |
| Landstalker - The Treasures of King Nole | ✅ | ❌ 20% | ✅ | ✅ | ✅ | 210.5KB |
| Lingo | ❌ 20% | ❌ 21% | ❌ 2% | ✅ | ✅ | 946.3KB |
| Links Awakening DX | ✅ | ❌ 23% | ✅ | ✅ | ✅ | 714.5KB |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | 398.5KB |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ✅ | ⚠️ 91% | ✅ | ✅ | ✅ | 51.5KB |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | 209.8KB |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | 57.2KB |
| Metamath | ✅ | 🔶 75% | ✅ | ✅ | ✅ | 48.1KB |
| Muse Dash | ✅ | ❌ 0% | ✅ | ✅ | ✅ | 233.5KB |
| Noita | ✅ | ❌ 22% | ✅ | ✅ | ✅ | 74.6KB |
| Ocarina of Time | — | ❌ 0% | ❌ 0% | ❌ 0% | ❌ 0% | N/A |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | 307.1KB |
| Overcooked! 2 | ✅ | ❌ 12% | ✅ | ✅ | ✅ | 489.2KB |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | 123.7KB |
| Pokemon Emerald | — | 🔶 59% | ❌ 29% | ✅ | ✅ | 1390.9KB |
| Pokemon Red and Blue | — | ❌ 0% | ❌ 0% | ✅ | ✅ | 1029.2KB |
| Raft | ✅ | ✅ | ❌ 0% | ✅ | ✅ | 205.9KB |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | 146.1KB |
| SMZ3 | — | ❌ 1% | ❌ 0% | ✅ | ✅ | 1044.7KB |
| Saving Princess | ✅ | ❌ 28% | ✅ | ✅ | ✅ | 33.8KB |
| Secret of Evermore | 🔶 70% | ✅ | ❌ 0% | ❌ 0% | ✅ | 418.7KB |
| Shivers | ✅ | ❌ 0% | ✅ | ⚠️ 90% | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | ✅ | ❌ 8% | ✅ | ✅ | ✅ | 266.2KB |
| Starcraft 2 | ❌ 0% | ❌ 0% | ❌ 0% | ❌ 0% | ❌ 0% | 1126.8KB |
| Stardew Valley | ❌ 20% | ❌ 4% | ❌ 0% | 🔶 80% | ✅ | 2430.2KB |
| Subnautica | ✅ | ❌ 10% | ✅ | ✅ | ✅ | 207.8KB |
| Sudoku | — | ✅ | ✅ | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ | ❌ 29% | ✅ | ✅ | ✅ | 93.2KB |
| Super Mario Land 2 | ⚠️ 90% | ❌ 10% | ✅ | ✅ | ✅ | 982.7KB |
| Super Mario World | ✅ | 🔶 54% | ✅ | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ 0% | ❌ 1% | ❌ 0% | 🔶 60% | ❌ 0% | 625.4KB |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | 102.8KB |
| TUNIC | ❌ 20% | ✅ | 🔶 56% | ✅ | ✅ | 653.3KB |
| Terraria | ✅ | ⚠️ 98% | ✅ | ✅ | ✅ | 283.0KB |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | 555.3KB |
| The Messenger | ✅ | ❌ 2% | ✅ | 🔶 80% | ✅ | 211.8KB |
| The Wind Waker | ✅ | ❌ 3% | ✅ | ✅ | ✅ | 253.9KB |
| The Witness | ❌ 20% | ✅ | ❌ 11% | ✅ | ✅ | 398.4KB |
| Timespinner | ✅ | ❌ 5% | ✅ | ✅ | ✅ | 267.3KB |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | 58.0KB |
| VVVVVV | ✅ | 🔶 67% | ✅ | ✅ | ✅ | 22.8KB |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | 44.7KB |
| Yacht Dice | — | ❌ 5% | ❌ 0% | ✅ | ✅ | 249.5KB |
| Yoshi's Island | ✅ | ❌ 22% | ✅ | ✅ | ✅ | 296.7KB |
| Yu-Gi-Oh! 2006 | — | ❌ 33% | ❌ 0% | ✅ | ✅ | 628.0KB |
| Zillion | — | ❌ 0% | ❌ 0% | 🔶 80% | ❌ 0% | N/A |
| shapez | ✅ | ❌ 42% | ✅ | ✅ | ✅ | 155.3KB |

## Notes

- **✅:** All fuzz runs passed (100% success rate)
- **⚠️ X%:** Most runs passed (90-99% success rate)
- **🔶 X%:** Some runs passed (50-89% success rate)
- **❌ X%:** Most runs failed (<50% success rate)
- **—:** No test results available for this game
- **Rules Size:** File size of rules.json for seed 1

### About Fuzz Tests

Fuzz tests validate game configurations by generating random YAML option combinations and running various tests:

- **Javascript:** Tests frontend spoiler playthrough with randomized configurations
- **UT Fuzz:** Tests Universal Tracker's accessibility calculations against Python's sphere log
  - **Original:** Uses native game integration
  - **Modified:** Uses worldgen-based tracking (regenerates from JSON rules)
  - **Pickle:** Uses pickle-based tracking (loads serialized multiworld)
  - **Hybrid:** Prefers native integration, falls back to worldgen
