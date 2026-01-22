# Universal Tracker Fuzz Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[View Comparison (Original vs Modified)](./test-results-ut-fuzz-comparison.md)

**Generated:** 2026-01-22 03:03:45

**Source Data Created:** 2026-01-21T20:33:39.978966

**Source Data Last Updated:** 2026-01-21T20:33:39.978973

**Universal Tracker Version:** Modified (this repository)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 2

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 85
- **Games with 100% Pass Rate:** 62 (72.9%)
- **Games with Failures:** 23 (27.1%)
- **Total Fuzz Runs:** 850
- **Successful Runs:** 620 (72.9%)
- **Failed Runs:** 188
- **Timed Out Runs:** 1
- **Ignored Runs:** 41

### Explain Support Summary

- **Games with Explain Stats:** 83
- **Games with 100% Explain Coverage:** 73
- **Games with No Explain Support:** 2
- **Locations with Explain Support:** 11,164
- **Locations without Explain Support:** 841
- **Locations with Default Rule:** 20,812
- **Overall Explain Coverage:** 93.0%

### Generic Exporter/Logic Statistics

Of the 62 games with 100% pass rate:

- **Passing with Generic Exporter:** 39/62 (62.9%)
- **Passing with Generic Logic:** 62/62 (100.0%)
- **Passing with Both Generic:** 39/62 (62.9%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 662.7KB
- **Total Game Logic Code:** 652.0KB
- **Combined Total:** 1314.7KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Hat in Time | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 18.0KB | ✅ | 235.0KB |
| A Link to the Past | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 100.1KB | ✅ | 654.1KB |
| A Short Hike | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 72.4KB |
| APQuest | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 11.0KB |
| Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 26.0KB |
| Aquaria | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.8KB | ✅ | 275.4KB |
| Baking Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 18.2KB |
| Blasphemous | ❌ | 10 | 0 | 4 | 0 | 6 | ❌ 0.0% | ✅ | ✅ | N/A |
| Bomb Rush Cyberfunk | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 1.4KB | 40.3KB | 329.0KB |
| Bumper Stickers | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 50.4KB |
| Castlevania - Circle of the Moon | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 4.0KB | ✅ | 94.4KB |
| Castlevania 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 138.5KB |
| Celeste (Open World) | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | 1043.3KB |
| Celeste 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 4.1KB | ✅ | 53.7KB |
| ChecksFinder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 16.2KB |
| Choo-Choo Charles | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 282.3KB |
| Civilization VI | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 166.9KB |
| Coding Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 54.9KB |
| DLCQuest | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.2KB | ✅ | 51.3KB |
| DOOM 1993 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 280.1KB |
| DOOM II | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 326.5KB |
| Dark Souls III | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 1062.0KB |
| Donkey Kong Country 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 122.5KB |
| Factorio | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 5.1KB | ✅ | 298.4KB |
| Faxanadu | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 68.6KB |
| Final Fantasy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Final Fantasy Mystic Quest | ❌ | 10 | 7 | 0 | 1 | 2 | ⚠️ 70.0% | ✅ | ✅ | 1302.5KB |
| Heretic | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 367.5KB |
| Hollow Knight | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Hylics 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.2KB |
| Inscryption | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.0KB | ✅ | 84.2KB |
| Jak and Daxter: The Precursor Legacy | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | 21.6KB | 4.6KB | 298.6KB |
| Kingdom Hearts | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | 754.0KB |
| Kingdom Hearts 2 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 19.5KB | ✅ | 1675.2KB |
| Kirby's Dream Land 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 10.1KB | ✅ | 688.9KB |
| Landstalker - The Treasures of King Nole | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.6KB | ✅ | 210.3KB |
| Lingo | ❌ | 10 | 0 | 3 | 0 | 7 | ❌ 0.0% | 38.0KB | 10.7KB | 946.3KB |
| Links Awakening DX | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 7.4KB | ✅ | 714.5KB |
| Lufia II Ancient Cave | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 132.4KB |
| Mario & Luigi Superstar Saga | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 398.5KB |
| Math Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 12.6KB |
| Mega Man 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 51.5KB |
| MegaMan Battle Network 3 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 209.8KB |
| Meritous | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 57.2KB |
| Metamath | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 47.5KB |
| Muse Dash | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 231.5KB |
| Noita | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 74.6KB |
| Ocarina of Time | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Old School Runescape | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 1.0KB | ✅ | 308.9KB |
| Overcooked! 2 | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% | 28.5KB | ✅ | 489.2KB |
| Paint | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.7KB | ✅ | 123.7KB |
| Pokemon Emerald | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | 5.2KB | 8.7KB | 1390.9KB |
| Pokemon Red and Blue | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | 12.2KB | 13.0KB | 1029.2KB |
| Raft | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 5.4KB | ✅ | 205.9KB |
| Risk of Rain 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 146.1KB |
| SMZ3 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 61.3KB | 51.3KB | 1044.7KB |
| Saving Princess | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 33.5KB |
| Secret of Evermore | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 5.3KB | 6.9KB | 418.7KB |
| Shivers | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 151.3KB |
| Sonic Adventure 2 Battle | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 266.1KB |
| Starcraft 2 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 28.7KB | 87.4KB | 1136.1KB |
| Stardew Valley | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 18.8KB | 8.0KB | 2430.1KB |
| Subnautica | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 207.8KB |
| Sudoku | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Super Mario 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 21.4KB | ✅ | 92.9KB |
| Super Mario Land 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 92.5KB | ✅ | 875.0KB |
| Super Mario World | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | 178.2KB |
| Super Metroid | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | 60.9KB | 114.5KB | 625.1KB |
| TOEM original | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TOEM rule builder | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 102.8KB |
| TUNIC | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | 3.1KB | ✅ | 711.6KB |
| Terraria | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 16.8KB | ✅ | 283.0KB |
| The Legend of Zelda | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 555.5KB |
| The Messenger | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 14.7KB | ✅ | 211.8KB |
| The Wind Waker | ✅ | 10 | 5 | 0 | 0 | 5 | ⚠️ 50.0% | 7.0KB | ✅ | 253.9KB |
| The Witness | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | 14.1KB | ✅ | 401.3KB |
| Timespinner | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 2.2KB | ✅ | 267.3KB |
| Undertale | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 58.0KB |
| VVVVVV | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.8KB | ✅ | 22.7KB |
| Wargroove | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | 44.7KB |
| Yacht Dice | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 0.9KB | 285.0KB | 249.5KB |
| Yoshi's Island | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 9.2KB | ✅ | 283.2KB |
| Yu-Gi-Oh! 2006 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 1.3KB | 21.4KB | 628.0KB |
| Zillion | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| shapez | ✅ | 10 | 6 | 0 | 0 | 4 | ⚠️ 60.0% | ✅ | ✅ | 155.5KB |

## Error Details

### Blasphemous

- **None**: 4 occurrence(s)

### Bomb Rush Cyberfunk

- **None**: 10 occurrence(s)

### Celeste (Open World)

- **None**: 10 occurrence(s)

### Final Fantasy Mystic Quest

- **<class 'TimeoutError'>**: 1 occurrence(s)

### Hollow Knight

- **None**: 10 occurrence(s)

### Jak and Daxter: The Precursor Legacy

- **None**: 7 occurrence(s)

### Kingdom Hearts

- **None**: 9 occurrence(s)

### Kingdom Hearts 2

- **FillError**: 9 occurrence(s)
- **None**: 1 occurrence(s)

### Lingo

- **None**: 3 occurrence(s)

### Ocarina of Time

- **<class 'AttributeError'>**: 9 occurrence(s)

### Pokemon Emerald

- **None**: 6 occurrence(s)

### Pokemon Red and Blue

- **None**: 9 occurrence(s)

### Raft

- **None**: 10 occurrence(s)

### SMZ3

- **None**: 10 occurrence(s)

### Secret of Evermore

- **None**: 10 occurrence(s)

### Starcraft 2

- **File 0-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)
- **File 1-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)
- **File 2-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)
- **File 3-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)
- **File 4-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)
- **File 5-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)
- **File 7-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)
- **File 6-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)
- **File 8-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)
- **File 9-0.yaml is invalid. Please fix your yaml.**: 1 occurrence(s)

### Stardew Valley

- **None**: 10 occurrence(s)

### Super Metroid

- **varia_custom was chosen but varia_custom_preset is missing.**: 2 occurrence(s)
- **None**: 6 occurrence(s)

### TUNIC

- **None**: 7 occurrence(s)

### The Witness

- **None**: 7 occurrence(s)

### Yacht Dice

- **None**: 10 occurrence(s)

### Yu-Gi-Oh! 2006

- **None**: 10 occurrence(s)

### Zillion

- **None**: 8 occurrence(s)
- **<class 'AssertionError'>**: 1 occurrence(s)


## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| Jak and Daxter: The Precursor Legacy | 289 | 0 | 159 | 130 | ❌ 0% |
| Yacht Dice | 63 | 0 | 63 | 0 | ❌ 0% |
| Pokemon Red and Blue | 578 | 35 | 104 | 439 | 🔶 25% |
| Timespinner | 684 | 162 | 432 | 90 | 🔶 27% |
| Kingdom Hearts 2 | 643 | 46 | 30 | 567 | ⚠️ 61% |
| Mega Man 2 | 51 | 4 | 1 | 46 | ⚠️ 80% |
| A Link to the Past | 242 | 148 | 28 | 66 | ⚠️ 84% |
| The Wind Waker | 228 | 173 | 16 | 39 | ⚠️ 92% |
| Kirby's Dream Land 3 | 832 | 118 | 5 | 709 | ⚠️ 96% |
| Blasphemous | 305 | 121 | 3 | 181 | ⚠️ 98% |
| A Hat in Time | 301 | 67 | 0 | 234 | ✅ 100% |
| A Short Hike | 131 | 40 | 0 | 91 | ✅ 100% |
| APQuest | 6 | 1 | 0 | 5 | ✅ 100% |
| Adventure | 21 | 0 | 0 | 21 | ✅ 100% |
| Aquaria | 218 | 25 | 0 | 193 | ✅ 100% |
| Baking Adventure | 15 | 8 | 0 | 7 | ✅ 100% |
| Bomb Rush Cyberfunk | 230 | 119 | 0 | 111 | ✅ 100% |
| Bumper Stickers | 100 | 38 | 0 | 62 | ✅ 100% |
| Castlevania - Circle of the Moon | 123 | 45 | 0 | 78 | ✅ 100% |
| Castlevania 64 | 339 | 0 | 0 | 339 | ✅ 100% |
| Celeste (Open World) | 1035 | 125 | 0 | 910 | ✅ 100% |
| Celeste 64 | 40 | 26 | 0 | 14 | ✅ 100% |
| ChecksFinder | 25 | 20 | 0 | 5 | ✅ 100% |
| Choo-Choo Charles | 691 | 64 | 0 | 627 | ✅ 100% |
| Civilization VI | 268 | 91 | 0 | 177 | ✅ 100% |
| Coding Adventure | 61 | 43 | 0 | 18 | ✅ 100% |
| DLCQuest | 38 | 25 | 0 | 13 | ✅ 100% |
| DOOM 1993 | 474 | 0 | 0 | 474 | ✅ 100% |
| DOOM II | 479 | 0 | 0 | 479 | ✅ 100% |
| Dark Souls III | 1469 | 228 | 0 | 1241 | ✅ 100% |
| Donkey Kong Country 3 | 220 | 1 | 0 | 219 | ✅ 100% |
| Factorio | 251 | 251 | 0 | 0 | ✅ 100% |
| Faxanadu | 110 | 24 | 0 | 86 | ✅ 100% |
| Final Fantasy | 0 | 0 | 0 | 0 | ✅ 100% |
| Final Fantasy Mystic Quest | 251 | 60 | 0 | 191 | ✅ 100% |
| Heretic | 691 | 0 | 0 | 691 | ✅ 100% |
| Hollow Knight | 712 | 712 | 0 | 0 | ✅ 100% |
| Hylics 2 | 133 | 70 | 0 | 63 | ✅ 100% |
| Inscryption | 100 | 65 | 0 | 35 | ✅ 100% |
| Kingdom Hearts | 523 | 464 | 0 | 59 | ✅ 100% |
| Landstalker - The Treasures of King Nole | 291 | 1 | 0 | 290 | ✅ 100% |
| Lingo | 165 | 165 | 0 | 0 | ✅ 100% |
| Links Awakening DX | 220 | 0 | 0 | 220 | ✅ 100% |
| Lufia II Ancient Cave | 66 | 61 | 0 | 5 | ✅ 100% |
| Mario & Luigi Superstar Saga | 555 | 344 | 0 | 211 | ✅ 100% |
| Math Adventure | 10 | 5 | 0 | 5 | ✅ 100% |
| MegaMan Battle Network 3 | 263 | 80 | 0 | 183 | ✅ 100% |
| Meritous | 104 | 0 | 0 | 104 | ✅ 100% |
| Metamath | 3 | 1 | 0 | 2 | ✅ 100% |
| Muse Dash | 776 | 776 | 0 | 0 | ✅ 100% |
| Noita | 303 | 0 | 0 | 303 | ✅ 100% |
| Old School Runescape | 62 | 60 | 0 | 2 | ✅ 100% |
| Overcooked! 2 | 35 | 3 | 0 | 32 | ✅ 100% |
| Paint | 89 | 89 | 0 | 0 | ✅ 100% |
| Pokemon Emerald | 695 | 21 | 0 | 674 | ✅ 100% |
| Raft | 154 | 141 | 0 | 13 | ✅ 100% |
| Risk of Rain 2 | 159 | 135 | 0 | 24 | ✅ 100% |
| SMZ3 | 316 | 316 | 0 | 0 | ✅ 100% |
| Saving Princess | 24 | 9 | 0 | 15 | ✅ 100% |
| Secret of Evermore | 913 | 724 | 0 | 189 | ✅ 100% |
| Shivers | 113 | 11 | 0 | 102 | ✅ 100% |
| Sonic Adventure 2 Battle | 708 | 277 | 0 | 431 | ✅ 100% |
| Stardew Valley | 1069 | 927 | 0 | 142 | ✅ 100% |
| Subnautica | 147 | 147 | 0 | 0 | ✅ 100% |
| Sudoku | 0 | 0 | 0 | 0 | ✅ 100% |
| Super Mario 64 | 164 | 55 | 0 | 109 | ✅ 100% |
| Super Mario Land 2 | 2018 | 1889 | 0 | 129 | ✅ 100% |
| Super Mario World | 708 | 365 | 0 | 343 | ✅ 100% |
| Super Metroid | 29 | 29 | 0 | 0 | ✅ 100% |
| TOEM original | 191 | 4 | 0 | 187 | ✅ 100% |
| TOEM rule builder | 191 | 4 | 0 | 187 | ✅ 100% |
| TUNIC | 6804 | 362 | 0 | 6442 | ✅ 100% |
| Terraria | 128 | 92 | 0 | 36 | ✅ 100% |
| The Legend of Zelda | 155 | 151 | 0 | 4 | ✅ 100% |
| The Messenger | 136 | 54 | 0 | 82 | ✅ 100% |
| The Witness | 133 | 116 | 0 | 17 | ✅ 100% |
| Undertale | 106 | 95 | 0 | 11 | ✅ 100% |
| VVVVVV | 20 | 2 | 0 | 18 | ✅ 100% |
| Wargroove | 38 | 28 | 0 | 10 | ✅ 100% |
| Yoshi's Island | 221 | 121 | 0 | 100 | ✅ 100% |
| Yu-Gi-Oh! 2006 | 151 | 63 | 0 | 88 | ✅ 100% |
| Zillion | 147 | 0 | 0 | 147 | ✅ 100% |
| shapez | 1267 | 22 | 0 | 1245 | ✅ 100% |

## Notes

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
