# Universal Tracker Fuzz Test Results (Pickle)

[<- Back to Fuzz Summary](./test-results-fuzz-summary.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Orig Seeded)](./test-results-ut-fuzz-comparison-original-original_seeded.md) | [View Comparison (Original vs Worldgen)](./test-results-ut-fuzz-comparison-original-worldgen.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-comparison-original-pickle.md) | [View Comparison (Worldgen vs Hybrid)](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | [View Comparison (Worldgen vs Pickle)](./test-results-ut-fuzz-comparison-worldgen-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-06-27 23:54:33 UTC

**Source Data Created:** 2026-06-27T23:54:33.277678+00:00

**Source Data Last Updated:** 2026-06-27T23:54:33.277688+00:00

**Universal Tracker Version:** Pickle (loads serialized multiworld)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 89
- **Games with 100% Pass Rate:** 20 (22.5%)
- **Games with Failures:** 69 (77.5%)
- **Total Fuzz Runs:** 890
- **Successful Runs:** 709 (79.7%)
- **Failed Runs:** 116
- **Timed Out Runs:** 1
- **Ignored Runs:** 64

### Expected vs Unexpected Results (based on tracking-mode-config.json)

- **Expected Passes:** 15 (passes pickle mode per config)
- **Unexpected Passes:** 5 (expected to fail but passed)
- **Expected Failures:** 11 (doesn't pass pickle mode per config)
- **Unexpected Failures (logic):** 58 (expected to pass but had logic mismatch)
- **Unexpected Failures (timeout only):** 0 (expected to pass but timed out)

### Explain Support Summary

- **Games with Explain Stats:** 79
- **Games with 100% Explain Coverage:** 72
- **Games with No Explain Support:** 0
- **Locations with Explain Support:** 5,492
- **Locations without Explain Support:** 85
- **Locations with Default Rule:** 8,860
- **Overall Explain Coverage:** 98.5%

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|
| A Hat in Time | ❌ | 10 | 7 | 3 | 0 | 0 | ⚠️ 70.0% |
| A Link to the Past | ❌ | 10 | 4 | 2 | 0 | 4 | ❌ 40.0% |
| A Short Hike | ❌ | 10 | 7 | 3 | 0 | 0 | ⚠️ 70.0% |
| APCalc | ❌ | 10 | 7 | 3 | 0 | 0 | ⚠️ 70.0% |
| APQuest | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Adventure | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% |
| Aquaria | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Baking Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| Blasphemous | ✅ | 10 | 4 | 0 | 0 | 6 | ❌ 40.0% |
| *Bomb Rush Cyberfunk* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Bumper Stickers | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| Castlevania - Circle of the Moon | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Castlevania 64 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *Celeste (Open World)* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| Celeste 64 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| ChecksFinder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| Choo-Choo Charles | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| Civilization VI | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Coding Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| DLCQuest | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *DOOM 1993* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *DOOM II* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Dark Souls III | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| DepGraph | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% |
| EarthBound | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Factorio | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Faxanadu | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Final Fantasy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| Final Fantasy Mystic Quest | ❌ | 10 | 8 | 1 | 0 | 1 | ⚠️ 80.0% |
| *Heretic* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Hollow Knight | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| Hylics 2 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Inscryption | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Jak and Daxter: The Precursor Legacy | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *Journey to Ascension* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% |
| *Kingdom Hearts* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *Kingdom Hearts 2* | ❌ | 10 | 6 | 1 | 0 | 3 | ⚠️ 60.0% |
| *Kirby's Dream Land 3* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Landstalker - The Treasures of King Nole | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *Lingo* | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% |
| Links Awakening DX | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% |
| Lufia II Ancient Cave | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Mario & Luigi Superstar Saga | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Mega Man 2 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *Mega Man 3* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| MegaMan Battle Network 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| Meritous | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| Metamath | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% |
| *Muse Dash* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Noita | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Ocarina of Time | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% |
| Old School Runescape | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Overcooked! 2 | ❌ | 10 | 4 | 1 | 0 | 5 | ❌ 40.0% |
| *Paint* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Pokemon Emerald | ✅ | 10 | 7 | 0 | 0 | 3 | ⚠️ 70.0% |
| Pokemon Red and Blue | ❌ | 10 | 7 | 1 | 0 | 2 | ⚠️ 70.0% |
| *Raft* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Risk of Rain 2 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| SMZ3 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *Satisfactory* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% |
| Saving Princess | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| *Secret of Evermore* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *Seedling* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Shivers | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Sonic Adventure 2 Battle | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *Starcraft 2* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% |
| *Stardew Valley* | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% |
| Subnautica | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Super Mario 64 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Super Mario Land 2 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Super Mario World | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *Super Metroid* | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% |
| TOEM original | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| TOEM rule builder | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| *TUNIC* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Terraria | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| The Legend of Zelda | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| The Messenger | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% |
| The Wind Waker | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% |
| *The Witness* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Timespinner | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Undertale | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| VVVVVV | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Wargroove | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** |
| *Yacht Dice* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Yoshi's Island | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Yu-Gi-Oh! 2006 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |
| Zillion | ❌ | 10 | 7 | 1 | 1 | 1 | ⚠️ 70.0% |
| shapez | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% |

## Results Breakdown

### Expected Passes (15)

Games that pass pickle mode per tracking-mode-config.json and passed the test.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Baking Adventure | 10 | 10 | 0 | 0 | 100.0% |
| Blasphemous | 10 | 4 | 0 | 0 | 40.0% |
| Bumper Stickers | 10 | 10 | 0 | 0 | 100.0% |
| Celeste (Open World) | 10 | 10 | 0 | 0 | 100.0% |
| ChecksFinder | 10 | 10 | 0 | 0 | 100.0% |
| Choo-Choo Charles | 10 | 10 | 0 | 0 | 100.0% |
| Coding Adventure | 10 | 10 | 0 | 0 | 100.0% |
| Final Fantasy | 10 | 10 | 0 | 0 | 100.0% |
| Hollow Knight | 10 | 10 | 0 | 0 | 100.0% |
| Lingo | 10 | 3 | 0 | 0 | 30.0% |
| MegaMan Battle Network 3 | 10 | 10 | 0 | 0 | 100.0% |
| Meritous | 10 | 10 | 0 | 0 | 100.0% |
| Saving Princess | 10 | 10 | 0 | 0 | 100.0% |
| The Wind Waker | 10 | 5 | 0 | 0 | 50.0% |
| Wargroove | 10 | 10 | 0 | 0 | 100.0% |

### Unexpected Passes (5)

Games NOT expected to pass pickle mode (not in config or mode not listed) but passed anyway.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| Journey to Ascension | 10 | 0 | 0 | 0 | 0.0% |
| Ocarina of Time | 10 | 8 | 0 | 0 | 80.0% |
| Pokemon Emerald | 10 | 7 | 0 | 0 | 70.0% |
| Starcraft 2 | 10 | 0 | 0 | 0 | 0.0% |
| Super Metroid | 10 | 5 | 0 | 0 | 50.0% |

### Expected Failures (11)

Games NOT expected to pass pickle mode and failed as expected.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| APCalc | 10 | 7 | 3 | 0 | 70.0% |
| Kingdom Hearts | 10 | 9 | 1 | 0 | 90.0% |
| Kingdom Hearts 2 | 10 | 6 | 1 | 0 | 60.0% |
| Links Awakening DX | 10 | 1 | 9 | 0 | 10.0% |
| Metamath | 10 | 2 | 8 | 0 | 20.0% |
| Satisfactory | 10 | 0 | 10 | 0 | 0.0% |
| Seedling | 10 | 9 | 1 | 0 | 90.0% |
| Shivers | 10 | 9 | 1 | 0 | 90.0% |
| Stardew Valley | 10 | 4 | 6 | 0 | 40.0% |
| The Messenger | 10 | 8 | 2 | 0 | 80.0% |
| Zillion | 10 | 7 | 1 | 1 | 70.0% |

### Unexpected Failures (Logic Mismatch) (58)

Games expected to pass pickle mode but failed due to logic mismatches.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| A Hat in Time | 10 | 7 | 3 | 0 | 70.0% |
| A Link to the Past | 10 | 4 | 2 | 0 | 40.0% |
| A Short Hike | 10 | 7 | 3 | 0 | 70.0% |
| APQuest | 10 | 9 | 1 | 0 | 90.0% |
| Adventure | 10 | 8 | 2 | 0 | 80.0% |
| Aquaria | 10 | 9 | 1 | 0 | 90.0% |
| Bomb Rush Cyberfunk | 10 | 9 | 1 | 0 | 90.0% |
| Castlevania - Circle of the Moon | 10 | 9 | 1 | 0 | 90.0% |
| Castlevania 64 | 10 | 9 | 1 | 0 | 90.0% |
| Celeste 64 | 10 | 9 | 1 | 0 | 90.0% |
| Civilization VI | 10 | 9 | 1 | 0 | 90.0% |
| DLCQuest | 10 | 9 | 1 | 0 | 90.0% |
| DOOM 1993 | 10 | 9 | 1 | 0 | 90.0% |
| DOOM II | 10 | 9 | 1 | 0 | 90.0% |
| Dark Souls III | 10 | 9 | 1 | 0 | 90.0% |
| DepGraph | 10 | 0 | 10 | 0 | 0.0% |
| EarthBound | 10 | 9 | 1 | 0 | 90.0% |
| Factorio | 10 | 9 | 1 | 0 | 90.0% |
| Faxanadu | 10 | 9 | 1 | 0 | 90.0% |
| Final Fantasy Mystic Quest | 10 | 8 | 1 | 0 | 80.0% |
| Heretic | 10 | 9 | 1 | 0 | 90.0% |
| Hylics 2 | 10 | 9 | 1 | 0 | 90.0% |
| Inscryption | 10 | 9 | 1 | 0 | 90.0% |
| Jak and Daxter: The Precursor Legacy | 10 | 9 | 1 | 0 | 90.0% |
| Kirby's Dream Land 3 | 10 | 9 | 1 | 0 | 90.0% |
| Landstalker - The Treasures of King Nole | 10 | 9 | 1 | 0 | 90.0% |
| Lufia II Ancient Cave | 10 | 9 | 1 | 0 | 90.0% |
| Mario & Luigi Superstar Saga | 10 | 9 | 1 | 0 | 90.0% |
| Mega Man 2 | 10 | 9 | 1 | 0 | 90.0% |
| Mega Man 3 | 10 | 9 | 1 | 0 | 90.0% |
| Muse Dash | 10 | 9 | 1 | 0 | 90.0% |
| Noita | 10 | 9 | 1 | 0 | 90.0% |
| Old School Runescape | 10 | 9 | 1 | 0 | 90.0% |
| Overcooked! 2 | 10 | 4 | 1 | 0 | 40.0% |
| Paint | 10 | 9 | 1 | 0 | 90.0% |
| Pokemon Red and Blue | 10 | 7 | 1 | 0 | 70.0% |
| Raft | 10 | 9 | 1 | 0 | 90.0% |
| Risk of Rain 2 | 10 | 9 | 1 | 0 | 90.0% |
| SMZ3 | 10 | 9 | 1 | 0 | 90.0% |
| Secret of Evermore | 10 | 9 | 1 | 0 | 90.0% |
| Sonic Adventure 2 Battle | 10 | 9 | 1 | 0 | 90.0% |
| Subnautica | 10 | 9 | 1 | 0 | 90.0% |
| Super Mario 64 | 10 | 9 | 1 | 0 | 90.0% |
| Super Mario Land 2 | 10 | 9 | 1 | 0 | 90.0% |
| Super Mario World | 10 | 9 | 1 | 0 | 90.0% |
| TOEM original | 10 | 9 | 1 | 0 | 90.0% |
| TOEM rule builder | 10 | 9 | 1 | 0 | 90.0% |
| TUNIC | 10 | 9 | 1 | 0 | 90.0% |
| Terraria | 10 | 9 | 1 | 0 | 90.0% |
| The Legend of Zelda | 10 | 9 | 1 | 0 | 90.0% |
| The Witness | 10 | 9 | 1 | 0 | 90.0% |
| Timespinner | 10 | 9 | 1 | 0 | 90.0% |
| Undertale | 10 | 9 | 1 | 0 | 90.0% |
| VVVVVV | 10 | 9 | 1 | 0 | 90.0% |
| Yacht Dice | 10 | 9 | 1 | 0 | 90.0% |
| Yoshi's Island | 10 | 9 | 1 | 0 | 90.0% |
| Yu-Gi-Oh! 2006 | 10 | 9 | 1 | 0 | 90.0% |
| shapez | 10 | 9 | 1 | 0 | 90.0% |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| Kingdom Hearts 2 | 643 | 46 | 30 | 567 | ⚠️ 61% |
| Pokemon Red and Blue | 161 | 16 | 5 | 140 | ⚠️ 76% |
| Kirby's Dream Land 3 | 65 | 22 | 5 | 38 | ⚠️ 81% |
| Timespinner | 180 | 77 | 14 | 89 | ⚠️ 85% |
| A Link to the Past | 249 | 171 | 29 | 49 | ⚠️ 86% |
| Mega Man 2 | 44 | 9 | 1 | 34 | ⚠️ 90% |
| Super Mario 64 | 149 | 25 | 1 | 123 | ⚠️ 96% |
| A Hat in Time | 225 | 61 | 0 | 164 | ✅ 100% |
| A Short Hike | 131 | 48 | 0 | 83 | ✅ 100% |
| APCalc | 77 | 0 | 0 | 77 | ✅ 100% |
| APQuest | 6 | 1 | 0 | 5 | ✅ 100% |
| Adventure | 24 | 3 | 0 | 21 | ✅ 100% |
| Aquaria | 219 | 38 | 0 | 181 | ✅ 100% |
| Baking Adventure | 15 | 8 | 0 | 7 | ✅ 100% |
| Bomb Rush Cyberfunk | 247 | 136 | 0 | 111 | ✅ 100% |
| Bumper Stickers | 100 | 38 | 0 | 62 | ✅ 100% |
| Castlevania - Circle of the Moon | 124 | 46 | 0 | 78 | ✅ 100% |
| Castlevania 64 | 213 | 0 | 0 | 213 | ✅ 100% |
| Celeste 64 | 40 | 26 | 0 | 14 | ✅ 100% |
| ChecksFinder | 25 | 20 | 0 | 5 | ✅ 100% |
| Choo-Choo Charles | 691 | 64 | 0 | 627 | ✅ 100% |
| Civilization VI | 148 | 0 | 0 | 148 | ✅ 100% |
| Coding Adventure | 61 | 43 | 0 | 18 | ✅ 100% |
| DLCQuest | 29 | 20 | 0 | 9 | ✅ 100% |
| DOOM 1993 | 348 | 0 | 0 | 348 | ✅ 100% |
| DOOM II | 453 | 0 | 0 | 453 | ✅ 100% |
| Dark Souls III | 1190 | 207 | 0 | 983 | ✅ 100% |
| DepGraph | 15 | 0 | 0 | 15 | ✅ 100% |
| EarthBound | 251 | 44 | 0 | 207 | ✅ 100% |
| Factorio | 179 | 179 | 0 | 0 | ✅ 100% |
| Faxanadu | 110 | 24 | 0 | 86 | ✅ 100% |
| Final Fantasy | 0 | 0 | 0 | 0 | ✅ 100% |
| Final Fantasy Mystic Quest | 251 | 61 | 0 | 190 | ✅ 100% |
| Heretic | 502 | 0 | 0 | 502 | ✅ 100% |
| Hylics 2 | 133 | 70 | 0 | 63 | ✅ 100% |
| Inscryption | 100 | 67 | 0 | 33 | ✅ 100% |
| Jak and Daxter: The Precursor Legacy | 239 | 109 | 0 | 130 | ✅ 100% |
| Kingdom Hearts | 511 | 373 | 0 | 138 | ✅ 100% |
| Landstalker - The Treasures of King Nole | 291 | 1 | 0 | 290 | ✅ 100% |
| Links Awakening DX | 220 | 0 | 0 | 220 | ✅ 100% |
| Lufia II Ancient Cave | 35 | 30 | 0 | 5 | ✅ 100% |
| Mario & Luigi Superstar Saga | 556 | 339 | 0 | 217 | ✅ 100% |
| Mega Man 3 | 64 | 22 | 0 | 42 | ✅ 100% |
| MegaMan Battle Network 3 | 263 | 80 | 0 | 183 | ✅ 100% |
| Meritous | 104 | 0 | 0 | 104 | ✅ 100% |
| Metamath | 9 | 0 | 0 | 9 | ✅ 100% |
| Muse Dash | 90 | 90 | 0 | 0 | ✅ 100% |
| Noita | 109 | 0 | 0 | 109 | ✅ 100% |
| Old School Runescape | 54 | 47 | 0 | 7 | ✅ 100% |
| Overcooked! 2 | 43 | 8 | 0 | 35 | ✅ 100% |
| Paint | 130 | 130 | 0 | 0 | ✅ 100% |
| Raft | 154 | 141 | 0 | 13 | ✅ 100% |
| Risk of Rain 2 | 187 | 187 | 0 | 0 | ✅ 100% |
| SMZ3 | 316 | 316 | 0 | 0 | ✅ 100% |
| Satisfactory | 377 | 100 | 0 | 277 | ✅ 100% |
| Saving Princess | 36 | 16 | 0 | 20 | ✅ 100% |
| Secret of Evermore | 339 | 282 | 0 | 57 | ✅ 100% |
| Seedling | 40 | 37 | 0 | 3 | ✅ 100% |
| Shivers | 76 | 22 | 0 | 54 | ✅ 100% |
| Sonic Adventure 2 Battle | 206 | 112 | 0 | 94 | ✅ 100% |
| Stardew Valley | 472 | 364 | 0 | 108 | ✅ 100% |
| Subnautica | 131 | 131 | 0 | 0 | ✅ 100% |
| Super Mario Land 2 | 53 | 29 | 0 | 24 | ✅ 100% |
| Super Mario World | 108 | 1 | 0 | 107 | ✅ 100% |
| TOEM original | 156 | 4 | 0 | 152 | ✅ 100% |
| TOEM rule builder | 156 | 4 | 0 | 152 | ✅ 100% |
| TUNIC | 302 | 87 | 0 | 215 | ✅ 100% |
| Terraria | 63 | 23 | 0 | 40 | ✅ 100% |
| The Legend of Zelda | 155 | 152 | 0 | 3 | ✅ 100% |
| The Messenger | 106 | 53 | 0 | 53 | ✅ 100% |
| The Witness | 132 | 103 | 0 | 29 | ✅ 100% |
| Undertale | 48 | 39 | 0 | 9 | ✅ 100% |
| VVVVVV | 20 | 2 | 0 | 18 | ✅ 100% |
| Wargroove | 38 | 28 | 0 | 10 | ✅ 100% |
| Yacht Dice | 89 | 89 | 0 | 0 | ✅ 100% |
| Yoshi's Island | 191 | 161 | 0 | 30 | ✅ 100% |
| Yu-Gi-Oh! 2006 | 84 | 63 | 0 | 21 | ✅ 100% |
| Zillion | 147 | 147 | 0 | 0 | ✅ 100% |
| shapez | 139 | 0 | 0 | 139 | ✅ 100% |

## Notes

- *Italic game names* are in the exclude list for this test type
- **Result:** ✅ if all fuzz runs passed (0 failures, 0 timeouts), ❌ otherwise
- **Total:** Number of fuzz runs attempted for this game
- **Success:** Number of runs where UT matched Python sphere log
- **Failure:** Number of runs where UT mismatched or encountered errors
- **Timeout:** Number of runs that exceeded the time limit
- **Ignored:** Number of runs skipped due to option errors
- **Success Rate:** Percentage of successful runs

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
