# Universal Tracker Fuzz Test Results (Hybrid)

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Orig Seeded)](./test-results-ut-fuzz-comparison-original-original_seeded.md) | [View Comparison (Original vs Worldgen)](./test-results-ut-fuzz-comparison-original-worldgen.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-comparison-original-pickle.md) | [View Comparison (Worldgen vs Hybrid)](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | [View Comparison (Worldgen vs Pickle)](./test-results-ut-fuzz-comparison-worldgen-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-06-28 17:05:16 UTC

**Source Data Created:** 2026-06-28T17:04:24.397957+00:00

**Source Data Last Updated:** 2026-06-28T17:04:24.397966+00:00

**Universal Tracker Version:** Hybrid (worldgen with native UT preference)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 89
- **Games with 100% Pass Rate:** 87 (97.8%)
- **Games with Failures:** 2 (2.2%)
- **Total Fuzz Runs:** 890
- **Successful Runs:** 812 (91.2%)
- **Failed Runs:** 12
- **Timed Out Runs:** 2
- **Ignored Runs:** 64

### Expected vs Unexpected Results (based on tracking-mode-config.json)

- **Expected Passes:** 87 (passes hybrid mode per config)
- **Unexpected Passes:** 0 (expected to fail but passed)
- **Expected Failures:** 2 (doesn't pass hybrid mode per config)
- **Unexpected Failures (logic):** 0 (expected to pass but had logic mismatch)
- **Unexpected Failures (timeout only):** 0 (expected to pass but timed out)

### Explain Support Summary

- **Games with Explain Stats:** 69
- **Games with 100% Explain Coverage:** 62
- **Games with No Explain Support:** 0
- **Locations with Explain Support:** 6,095
- **Locations without Explain Support:** 492
- **Locations with Default Rule:** 13,838
- **Overall Explain Coverage:** 92.5%

### Generic Exporter/Logic Statistics

Of the 87 games with 100% pass rate:

- **Passing with Generic Exporter:** 46/87 (52.9%)
- **Passing with Generic Logic:** 76/87 (87.4%)
- **Passing with Both Generic:** 46/87 (52.9%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 618.3KB
- **Total Game Logic Code:** 662.0KB
- **Combined Total:** 1280.3KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 18.2KB | ✅ | 230.4KB |
| A Link to the Past | ✅ | 10 | 6 | 0 | 0 | 4 | ⚠️ 60.0% | 14.0KB | ✅ | 664.5KB |
| A Short Hike | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 74.4KB |
| APCalc | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 317.5KB |
| APQuest | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 11.1KB |
| Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 25.8KB |
| Aquaria | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.8KB | ✅ | 277.5KB |
| Baking Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 18.0KB |
| Blasphemous | ✅ | 10 | 4 | 0 | 0 | 6 | ❌ 40.0% | ✅ | ✅ | N/A |
| *Bomb Rush Cyberfunk* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.4KB | 40.3KB | 325.3KB |
| Bumper Stickers | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 50.5KB |
| Castlevania - Circle of the Moon | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 4.0KB | ✅ | 93.9KB |
| Castlevania 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 137.9KB |
| *Celeste (Open World)* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Celeste 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 4.1KB | ✅ | 53.8KB |
| ChecksFinder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 16.6KB |
| Choo-Choo Charles | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 281.4KB |
| Civilization VI | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 163.1KB |
| Coding Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 54.2KB |
| DLCQuest | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.2KB | ✅ | 49.9KB |
| *DOOM 1993* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 282.1KB |
| *DOOM II* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 327.8KB |
| Dark Souls III | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 1034.5KB |
| DepGraph | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 410.5KB |
| EarthBound | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 337.7KB |
| Factorio | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.8KB | ✅ | 290.8KB |
| Faxanadu | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 68.2KB |
| Final Fantasy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 50.3KB |
| Final Fantasy Mystic Quest | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 14.0KB | ✅ | 549.4KB |
| *Heretic* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 367.8KB |
| Hollow Knight | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 100.4KB |
| Inscryption | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.0KB | ✅ | 84.6KB |
| Jak and Daxter: The Precursor Legacy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 21.7KB | 4.6KB | 258.5KB |
| *Journey to Ascension* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | 48.4KB |
| *Kingdom Hearts* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 748.9KB |
| *Kingdom Hearts 2* | ✅ | 10 | 7 | 0 | 0 | 3 | ⚠️ 70.0% | 20.4KB | ✅ | 1631.0KB |
| *Kirby's Dream Land 3* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 10.1KB | ✅ | 528.8KB |
| Landstalker - The Treasures of King Nole | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.6KB | ✅ | 209.2KB |
| *Lingo* | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% | 38.2KB | 10.7KB | 940.0KB |
| Links Awakening DX | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 7.3KB | ✅ | 705.1KB |
| Lufia II Ancient Cave | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 122.8KB |
| Mario & Luigi Superstar Saga | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 395.5KB |
| Mega Man 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 51.8KB |
| *Mega Man 3* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 71.7KB |
| MegaMan Battle Network 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 204.7KB |
| Meritous | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 57.0KB |
| Metamath | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 56.1KB |
| *Muse Dash* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 229.8KB |
| Noita | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 74.0KB |
| Ocarina of Time | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.0KB | ✅ | 305.2KB |
| Overcooked! 2 | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% | 28.5KB | ✅ | 488.6KB |
| *Paint* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.7KB | ✅ | 123.5KB |
| Pokemon Emerald | ✅ | 10 | 7 | 0 | 0 | 3 | ⚠️ 70.0% | 5.2KB | 8.7KB | N/A |
| Pokemon Red and Blue | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | 12.2KB | 13.0KB | 1270.3KB |
| *Raft* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 6.5KB | ✅ | 198.4KB |
| Risk of Rain 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 131.4KB |
| SMZ3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 54.2KB | 51.3KB | 1890.8KB |
| *Satisfactory* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 41.8KB | ✅ | 1624.0KB |
| Saving Princess | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 33.7KB |
| *Secret of Evermore* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 5.6KB | 7.5KB | 415.0KB |
| *Seedling* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 156.9KB |
| Shivers | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 150.1KB |
| Sonic Adventure 2 Battle | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 262.4KB |
| *Starcraft 2* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | 29.3KB | 90.1KB | 1084.5KB |
| *Stardew Valley* | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | 20.0KB | 9.8KB | 2558.8KB |
| Subnautica | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 205.5KB |
| Super Mario 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 101.3KB |
| Super Mario Land 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 96.3KB | ✅ | 920.0KB |
| Super Mario World | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 177.9KB |
| *Super Metroid* | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% | 61.0KB | 119.4KB | 625.1KB |
| TOEM original | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 0.6KB | ✅ | 99.7KB |
| TOEM rule builder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 0.5KB | ✅ | 99.8KB |
| *TUNIC* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.1KB | ✅ | 649.4KB |
| Terraria | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 16.9KB | ✅ | 279.5KB |
| The Legend of Zelda | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 558.4KB |
| The Messenger | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 15.2KB | ✅ | 211.0KB |
| The Wind Waker | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% | 7.0KB | ✅ | 250.3KB |
| *The Witness* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 14.6KB | ✅ | 408.0KB |
| Timespinner | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 263.1KB |
| Undertale | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 56.3KB |
| VVVVVV | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.8KB | ✅ | 22.7KB |
| Wargroove | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 44.3KB |
| *Yacht Dice* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 0.9KB | 285.0KB | 248.5KB |
| Yoshi's Island | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 9.2KB | ✅ | 295.8KB |
| Yu-Gi-Oh! 2006 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.3KB | 21.4KB | 644.2KB |
| Zillion | ❌ | 10 | 0 | 7 | 2 | 1 | ❌ 0.0% | ✅ | ✅ | 321.2KB |
| shapez | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 153.9KB |

## Results Breakdown

### Expected Passes (87)

Games that pass hybrid mode per tracking-mode-config.json and passed the test.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| A Hat in Time | 10 | 10 | 0 | 0 | 100.0% |
| A Link to the Past | 10 | 6 | 0 | 0 | 60.0% |
| A Short Hike | 10 | 10 | 0 | 0 | 100.0% |
| APCalc | 10 | 10 | 0 | 0 | 100.0% |
| APQuest | 10 | 10 | 0 | 0 | 100.0% |
| Adventure | 10 | 10 | 0 | 0 | 100.0% |
| Aquaria | 10 | 10 | 0 | 0 | 100.0% |
| Baking Adventure | 10 | 10 | 0 | 0 | 100.0% |
| Blasphemous | 10 | 4 | 0 | 0 | 40.0% |
| Bomb Rush Cyberfunk | 10 | 10 | 0 | 0 | 100.0% |
| Bumper Stickers | 10 | 10 | 0 | 0 | 100.0% |
| Castlevania - Circle of the Moon | 10 | 10 | 0 | 0 | 100.0% |
| Castlevania 64 | 10 | 10 | 0 | 0 | 100.0% |
| Celeste (Open World) | 10 | 10 | 0 | 0 | 100.0% |
| Celeste 64 | 10 | 10 | 0 | 0 | 100.0% |
| ChecksFinder | 10 | 10 | 0 | 0 | 100.0% |
| Choo-Choo Charles | 10 | 10 | 0 | 0 | 100.0% |
| Civilization VI | 10 | 10 | 0 | 0 | 100.0% |
| Coding Adventure | 10 | 10 | 0 | 0 | 100.0% |
| DLCQuest | 10 | 10 | 0 | 0 | 100.0% |
| DOOM 1993 | 10 | 10 | 0 | 0 | 100.0% |
| DOOM II | 10 | 10 | 0 | 0 | 100.0% |
| Dark Souls III | 10 | 10 | 0 | 0 | 100.0% |
| DepGraph | 10 | 10 | 0 | 0 | 100.0% |
| EarthBound | 10 | 10 | 0 | 0 | 100.0% |
| Factorio | 10 | 10 | 0 | 0 | 100.0% |
| Faxanadu | 10 | 10 | 0 | 0 | 100.0% |
| Final Fantasy | 10 | 10 | 0 | 0 | 100.0% |
| Final Fantasy Mystic Quest | 10 | 9 | 0 | 0 | 90.0% |
| Heretic | 10 | 10 | 0 | 0 | 100.0% |
| Hollow Knight | 10 | 10 | 0 | 0 | 100.0% |
| Hylics 2 | 10 | 10 | 0 | 0 | 100.0% |
| Inscryption | 10 | 10 | 0 | 0 | 100.0% |
| Jak and Daxter: The Precursor Legacy | 10 | 10 | 0 | 0 | 100.0% |
| Journey to Ascension | 10 | 0 | 0 | 0 | 0.0% |
| Kingdom Hearts | 10 | 10 | 0 | 0 | 100.0% |
| Kingdom Hearts 2 | 10 | 7 | 0 | 0 | 70.0% |
| Kirby's Dream Land 3 | 10 | 10 | 0 | 0 | 100.0% |
| Landstalker - The Treasures of King Nole | 10 | 10 | 0 | 0 | 100.0% |
| Lingo | 10 | 3 | 0 | 0 | 30.0% |
| Links Awakening DX | 10 | 10 | 0 | 0 | 100.0% |
| Lufia II Ancient Cave | 10 | 10 | 0 | 0 | 100.0% |
| Mario & Luigi Superstar Saga | 10 | 10 | 0 | 0 | 100.0% |
| Mega Man 2 | 10 | 10 | 0 | 0 | 100.0% |
| Mega Man 3 | 10 | 10 | 0 | 0 | 100.0% |
| MegaMan Battle Network 3 | 10 | 10 | 0 | 0 | 100.0% |
| Meritous | 10 | 10 | 0 | 0 | 100.0% |
| Metamath | 10 | 10 | 0 | 0 | 100.0% |
| Muse Dash | 10 | 10 | 0 | 0 | 100.0% |
| Noita | 10 | 10 | 0 | 0 | 100.0% |
| Ocarina of Time | 10 | 8 | 0 | 0 | 80.0% |
| Old School Runescape | 10 | 10 | 0 | 0 | 100.0% |
| Overcooked! 2 | 10 | 5 | 0 | 0 | 50.0% |
| Paint | 10 | 10 | 0 | 0 | 100.0% |
| Pokemon Emerald | 10 | 7 | 0 | 0 | 70.0% |
| Pokemon Red and Blue | 10 | 8 | 0 | 0 | 80.0% |
| Raft | 10 | 10 | 0 | 0 | 100.0% |
| Risk of Rain 2 | 10 | 10 | 0 | 0 | 100.0% |
| SMZ3 | 10 | 10 | 0 | 0 | 100.0% |
| Satisfactory | 10 | 10 | 0 | 0 | 100.0% |
| Saving Princess | 10 | 10 | 0 | 0 | 100.0% |
| Secret of Evermore | 10 | 10 | 0 | 0 | 100.0% |
| Seedling | 10 | 10 | 0 | 0 | 100.0% |
| Shivers | 10 | 10 | 0 | 0 | 100.0% |
| Sonic Adventure 2 Battle | 10 | 10 | 0 | 0 | 100.0% |
| Starcraft 2 | 10 | 0 | 0 | 0 | 0.0% |
| Subnautica | 10 | 10 | 0 | 0 | 100.0% |
| Super Mario 64 | 10 | 10 | 0 | 0 | 100.0% |
| Super Mario Land 2 | 10 | 10 | 0 | 0 | 100.0% |
| Super Mario World | 10 | 10 | 0 | 0 | 100.0% |
| Super Metroid | 10 | 5 | 0 | 0 | 50.0% |
| TOEM original | 10 | 10 | 0 | 0 | 100.0% |
| TOEM rule builder | 10 | 10 | 0 | 0 | 100.0% |
| TUNIC | 10 | 10 | 0 | 0 | 100.0% |
| Terraria | 10 | 10 | 0 | 0 | 100.0% |
| The Legend of Zelda | 10 | 10 | 0 | 0 | 100.0% |
| The Messenger | 10 | 10 | 0 | 0 | 100.0% |
| The Wind Waker | 10 | 5 | 0 | 0 | 50.0% |
| The Witness | 10 | 10 | 0 | 0 | 100.0% |
| Timespinner | 10 | 10 | 0 | 0 | 100.0% |
| Undertale | 10 | 10 | 0 | 0 | 100.0% |
| VVVVVV | 10 | 10 | 0 | 0 | 100.0% |
| Wargroove | 10 | 10 | 0 | 0 | 100.0% |
| Yacht Dice | 10 | 10 | 0 | 0 | 100.0% |
| Yoshi's Island | 10 | 10 | 0 | 0 | 100.0% |
| Yu-Gi-Oh! 2006 | 10 | 10 | 0 | 0 | 100.0% |
| shapez | 10 | 10 | 0 | 0 | 100.0% |

### Expected Failures (2)

Games NOT expected to pass hybrid mode and failed as expected.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Stardew Valley | 10 | 5 | 5 | 0 | 50.0% |
| Zillion | 10 | 0 | 7 | 2 | 0.0% |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| Timespinner | 720 | 182 | 434 | 104 | 🔶 30% |
| A Link to the Past | 226 | 114 | 27 | 85 | ⚠️ 81% |
| Super Mario 64 | 164 | 36 | 7 | 121 | ⚠️ 84% |
| The Wind Waker | 228 | 173 | 16 | 39 | ⚠️ 92% |
| Kirby's Dream Land 3 | 832 | 118 | 5 | 709 | ⚠️ 96% |
| The Messenger | 136 | 52 | 2 | 82 | ⚠️ 96% |
| Mega Man 2 | 44 | 29 | 1 | 14 | ⚠️ 97% |
| A Hat in Time | 279 | 104 | 0 | 175 | ✅ 100% |
| A Short Hike | 131 | 82 | 0 | 49 | ✅ 100% |
| APCalc | 224 | 0 | 0 | 224 | ✅ 100% |
| APQuest | 7 | 1 | 0 | 6 | ✅ 100% |
| Adventure | 24 | 3 | 0 | 21 | ✅ 100% |
| Aquaria | 219 | 36 | 0 | 183 | ✅ 100% |
| Baking Adventure | 15 | 8 | 0 | 7 | ✅ 100% |
| Bumper Stickers | 100 | 38 | 0 | 62 | ✅ 100% |
| Castlevania - Circle of the Moon | 124 | 46 | 0 | 78 | ✅ 100% |
| Castlevania 64 | 294 | 0 | 0 | 294 | ✅ 100% |
| Celeste 64 | 42 | 21 | 0 | 21 | ✅ 100% |
| ChecksFinder | 25 | 20 | 0 | 5 | ✅ 100% |
| Choo-Choo Charles | 691 | 64 | 0 | 627 | ✅ 100% |
| Civilization VI | 270 | 91 | 0 | 179 | ✅ 100% |
| Coding Adventure | 61 | 43 | 0 | 18 | ✅ 100% |
| DLCQuest | 29 | 16 | 0 | 13 | ✅ 100% |
| DOOM 1993 | 474 | 0 | 0 | 474 | ✅ 100% |
| DOOM II | 479 | 0 | 0 | 479 | ✅ 100% |
| Dark Souls III | 1190 | 208 | 0 | 982 | ✅ 100% |
| DepGraph | 10 | 0 | 0 | 10 | ✅ 100% |
| EarthBound | 250 | 38 | 0 | 212 | ✅ 100% |
| Factorio | 309 | 288 | 0 | 21 | ✅ 100% |
| Faxanadu | 110 | 25 | 0 | 85 | ✅ 100% |
| Final Fantasy | 0 | 0 | 0 | 0 | ✅ 100% |
| Final Fantasy Mystic Quest | 251 | 61 | 0 | 190 | ✅ 100% |
| Heretic | 691 | 0 | 0 | 691 | ✅ 100% |
| Hylics 2 | 166 | 88 | 0 | 78 | ✅ 100% |
| Inscryption | 100 | 65 | 0 | 35 | ✅ 100% |
| Landstalker - The Treasures of King Nole | 291 | 1 | 0 | 290 | ✅ 100% |
| Links Awakening DX | 220 | 0 | 0 | 220 | ✅ 100% |
| Lufia II Ancient Cave | 77 | 72 | 0 | 5 | ✅ 100% |
| Mario & Luigi Superstar Saga | 598 | 372 | 0 | 226 | ✅ 100% |
| Mega Man 3 | 137 | 43 | 0 | 94 | ✅ 100% |
| MegaMan Battle Network 3 | 263 | 80 | 0 | 183 | ✅ 100% |
| Meritous | 104 | 0 | 0 | 104 | ✅ 100% |
| Metamath | 5 | 0 | 0 | 5 | ✅ 100% |
| Muse Dash | 606 | 606 | 0 | 0 | ✅ 100% |
| Noita | 376 | 0 | 0 | 376 | ✅ 100% |
| Old School Runescape | 76 | 67 | 0 | 9 | ✅ 100% |
| Overcooked! 2 | 43 | 9 | 0 | 34 | ✅ 100% |
| Paint | 167 | 167 | 0 | 0 | ✅ 100% |
| Pokemon Emerald | 946 | 291 | 0 | 655 | ✅ 100% |
| Risk of Rain 2 | 324 | 324 | 0 | 0 | ✅ 100% |
| Satisfactory | 549 | 104 | 0 | 445 | ✅ 100% |
| Saving Princess | 36 | 16 | 0 | 20 | ✅ 100% |
| Seedling | 47 | 44 | 0 | 3 | ✅ 100% |
| Shivers | 76 | 22 | 0 | 54 | ✅ 100% |
| Sonic Adventure 2 Battle | 1046 | 227 | 0 | 819 | ✅ 100% |
| Stardew Valley | 472 | 364 | 0 | 108 | ✅ 100% |
| Subnautica | 136 | 136 | 0 | 0 | ✅ 100% |
| Super Mario Land 2 | 59 | 35 | 0 | 24 | ✅ 100% |
| Super Mario World | 743 | 396 | 0 | 347 | ✅ 100% |
| TOEM original | 214 | 4 | 0 | 210 | ✅ 100% |
| TOEM rule builder | 214 | 4 | 0 | 210 | ✅ 100% |
| Terraria | 128 | 92 | 0 | 36 | ✅ 100% |
| The Legend of Zelda | 155 | 151 | 0 | 4 | ✅ 100% |
| Undertale | 106 | 95 | 0 | 11 | ✅ 100% |
| VVVVVV | 20 | 2 | 0 | 18 | ✅ 100% |
| Wargroove | 38 | 28 | 0 | 10 | ✅ 100% |
| Yoshi's Island | 221 | 121 | 0 | 100 | ✅ 100% |
| Zillion | 147 | 147 | 0 | 0 | ✅ 100% |
| shapez | 2870 | 25 | 0 | 2845 | ✅ 100% |

## Notes

- *Italic game names* are in the exclude list for this test type
- **Result:** ✅ if all fuzz runs passed (0 failures, 0 timeouts), ❌ otherwise
- **Total:** Number of fuzz runs attempted for this game
- **Success:** Number of runs where UT matched Python sphere log
- **Failure:** Number of runs where UT mismatched or encountered errors
- **Timeout:** Number of runs that exceeded the time limit
- **Ignored:** Number of runs skipped due to option errors
- **Success Rate:** Percentage of successful runs
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)

### Explain Support Columns

- **Total Locs:** Total number of locations with addresses (excludes events)
- **With Explain:** Locations with rules that have `explain_json()` support
- **Without Explain:** Locations with custom rules but no explain support (lambdas/functions)
- **Default Rule:** Locations with no access rule set (always accessible)
- **Coverage:** Percentage of custom-rule locations that have explain support

### About This Test

The UT fuzzer tests Universal Tracker compatibility by:
1. Generating random game configurations (YAML options)
2. Creating an Archipelago seed with those options
3. Exporting the seed to JSON rules
4. Regenerating the world using the world generator
5. Comparing UT's accessibility calculations to the Python sphere log

Failures indicate that for certain option combinations, UT's logic differs from Python's logic. This helps identify edge cases that need fixing.

## Excluded Templates

These templates are excluded from testing:

| Template | Reason |
|----------|--------|
| APWorld Manager.yaml | Not a game. |
| Archipelago.yaml | Not a game. |
| Bomb Rush Cyberfunk.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Celeste (Open World).yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| DOOM 1993.yaml | Temporarily excluded. Helper references original module data (Maps.map_names, self.all_boss_levels, self.included_episodes, Locations.location_table) causing NameError. |
| DOOM II.yaml | Temporarily excluded. Same pattern as DOOM 1993 — helper references original module data (Maps.map_names) causing NameError. |
| Heretic.yaml | Temporarily excluded. Same pattern as DOOM 1993 — helper references original module data (Maps.map_names) causing NameError. |
| JSON Tools Installer.yaml | Not a game. |
| Journey to Ascension.yaml | JtA is not compatible with WorldGen. |
| Kingdom Hearts 2.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Kingdom Hearts.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Kirby's Dream Land 3.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Lingo.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Mega Man 3.yaml | Temporarily excluded. WorldGen variant intermittently fails test_explicit_indirect_conditions_spheres with Fill.FillError on certain pytest seeds (e.g. 57516062135983689099). |
| Muse Dash.yaml | Temporarily excluded. Block-bodied helper inlined into expression context causes SyntaxError. |
| Paint.yaml | Temporarily excluded. Helper paint_percent_available not in JSON helpers dict causing NameError (calculate_paint_percent_available is present but referenced under wrong name). |
| Raft.yaml | Temporarily excluded. The WorldGen spoiler test times out at 300 seconds. |
| Satisfactory.yaml | Temporarily excluded. Calls self.state_logic.can_produce_all() which resolves to state.has_all() but is not exported, causing AttributeError. |
| Secret of Evermore.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Seedling.yaml | WorldGen variant generation produces a broken world (worlds/seedling_worldgen missing Items.py, causing ModuleNotFoundError on load). |
| Starcraft 2.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Stardew Valley.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| Super Metroid.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| TUNIC.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
| The Witness.yaml | Temporarily excluded. The WorldGen spoiler test takes 261 seconds. |
| UT Pickle Mode.yaml | Not a game. Universal Tracker pickle-mode meta-template, not a playable world (its worldgen variant fails with AttributeError in ut_pickle_worldgen._place_original_items). |
| Universal Tracker.yaml | Not a game. |
| Yacht Dice.yaml | Temporarily excluded. Supporting this game through WorldGen might not be possible. |
