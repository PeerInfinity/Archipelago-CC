# World Generator Test Results

**Generated:** 2025-12-31 23:55:41 UTC

**Seed:** 1

**Mode:** Random

This report shows the results of round-trip testing the world generator.
Each game's rules.json is converted to a `_worldgen` world, and the generated
world is validated to produce equivalent game logic.

## Legend

- ✅ - Success/Pass
- ❌ - Failure
- `-` - Not applicable (previous step failed)
- `Skipped` - Test was skipped
- `Error` - An error occurred

### Columns

**Original World Tests** (prerequisite - must pass before worldgen testing):
- **Original Gen**: Generate a seed with the original Archipelago world
- **Original Spoiler**: Validate the original world's sphere log against its rules.json

**World Generator Tests** (the actual round-trip test):
- **World Gen** (Stage 1): Create `_worldgen` Python world files from rules.json
- **Seed Gen** (Stage 2): Generate a seed with the `_worldgen` world
- **Rules Comp** (Stage 3): Compare original rules.json with `_worldgen` rules.json
- **WorldGen Spoiler** (Stage 4): Validate the `_worldgen` world's sphere log against its rules
- **Cross-Validation** (Stage 5): Validate the **original** sphere log against `_worldgen` rules (proves equivalent logic)

## Summary

**Total Templates:** 61

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 61 | 0 | 61 |
| Original Spoiler Test | 0 | 61 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 60 | 1 | 61 |
| Stage 3: Rules Comparison | 0 | 60 | 60 |
| Stage 4: WorldGen Spoiler Test | 0 | 60 | 60 |
| Stage 5: Cross-Validation | 0 | 60 | 60 |

## Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| A Link to the Past | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| A Short Hike | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| APQuest | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Adventure | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Aquaria | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Baking Adventure | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Bumper Stickers | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Castlevania - Circle of the Moon | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Castlevania 64 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Celeste 64 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| ChecksFinder | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Choo-Choo Charles | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Civilization VI | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Coding Adventure | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| DLCQuest | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| DOOM 1993 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| DOOM II | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Dark Souls III | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Donkey Kong Country 3 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Factorio | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Faxanadu | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Final Fantasy Mystic Quest | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Heretic | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Hylics 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Inscryption | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Links Awakening DX | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Lufia II Ancient Cave | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Mario & Luigi Superstar Saga | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Math Adventure | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Mega Man 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| MegaMan Battle Network 3 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Meritous | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Metamath | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Muse Dash | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Noita | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Old School Runescape | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Overcooked! 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Paint | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Risk of Rain 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Saving Princess | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Shivers | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Sonic Adventure 2 Battle | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Subnautica | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario 64 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario Land 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario World | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| TOEM original | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| TOEM rule builder | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| TUNIC | ✅ | ❌ | ✅ | ❌ | - | - | - |
| Terraria | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| The Legend of Zelda | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| The Messenger | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| The Wind Waker | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Timespinner | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Undertale | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| VVVVVV | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Wargroove | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Yoshi's Island | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| shapez | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |

---

## Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 479.1s | 9944.5s | 5.2s | 427.6s | 9822.8s | 9317.0s |
| Average | 7.9s | 163.0s | 0.1s | 7.0s | 163.7s | 155.3s |
| Max | 28.5s | 219.5s | 0.1s | 28.2s | 216.2s | 188.0s |
| Min | 2.9s | 150.0s | 0.1s | 2.5s | 150.5s | 149.8s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Dark Souls III (28.5s) | Dark Souls III (219.5s) | A Hat in Time (0.1s) | Dark Souls III (28.2s) | Dark Souls III (216.2s) | Links Awakening DX (188.0s) |
| Fastest | Paint (2.9s) | Undertale (150.0s) | Undertale (0.1s) | TUNIC (2.5s) | Metamath (150.5s) | Saving Princess (149.8s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.7s | 177.1s | 0.1s | 8.6s | 176.4s | 175.9s |
| A Link to the Past | 17.8s | 188.1s | 0.1s | 10.8s | 191.8s | 150.5s |
| A Short Hike | 5.1s | 163.1s | 0.1s | 5.1s | 162.7s | 162.7s |
| APQuest | 3.2s | 151.2s | 0.1s | 3.0s | 150.9s | 150.3s |
| Adventure | 3.3s | 152.0s | 0.1s | 3.4s | 150.5s | 150.5s |
| Aquaria | 13.9s | 158.5s | 0.1s | 9.0s | 158.1s | 150.9s |
| Baking Adventure | 3.1s | 150.9s | 0.1s | 3.0s | 150.5s | 150.5s |
| Bumper Stickers | 5.2s | 161.4s | 0.1s | 5.0s | 159.7s | 151.0s |
| Castlevania - Circle of the Moon | 5.6s | 150.9s | 0.1s | 5.4s | 151.0s | 150.8s |
| Castlevania 64 | 8.5s | 153.9s | 0.1s | 8.2s | 153.5s | 154.0s |
| Celeste 64 | 3.4s | 153.9s | 0.1s | 3.6s | 156.4s | 150.8s |
| ChecksFinder | 3.1s | 153.9s | 0.1s | 3.2s | 153.9s | 153.9s |
| Choo-Choo Charles | 17.2s | 165.8s | 0.1s | 17.0s | 165.8s | 165.8s |
| Civilization VI | 6.0s | 160.1s | 0.1s | 6.2s | 159.6s | 154.0s |
| Coding Adventure | 3.7s | 159.7s | 0.1s | 3.8s | 159.7s | 150.5s |
| DLCQuest | 3.9s | 150.9s | 0.1s | 3.7s | 151.0s | 150.8s |
| DOOM 1993 | 10.7s | 172.5s | 0.1s | 10.5s | 172.6s | 150.6s |
| DOOM II | 14.9s | 180.9s | 0.1s | 14.5s | 181.9s | 151.0s |
| Dark Souls III | 28.5s | 219.5s | 0.1s | 28.2s | 216.2s | 153.8s |
| Donkey Kong Country 3 | 7.7s | 176.4s | 0.1s | 7.9s | 178.1s | 151.4s |
| Factorio | 5.8s | 163.2s | 0.1s | 5.2s | 163.2s | 163.1s |
| Faxanadu | 4.7s | 153.9s | 0.1s | 5.2s | 160.0s | 150.8s |
| Final Fantasy Mystic Quest | 12.4s | 165.0s | 0.1s | 11.2s | 165.9s | 165.9s |
| Heretic | 15.3s | 179.7s | 0.1s | 15.2s | 181.8s | 151.1s |
| Hylics 2 | 5.9s | 153.5s | 0.1s | 5.3s | 153.1s | 153.6s |
| Inscryption | 4.6s | 154.0s | 0.1s | 4.4s | 153.9s | 153.9s |
| Landstalker - The Treasures of King Nole | 9.1s | 159.7s | 0.1s | 9.8s | 190.3s | 150.4s |
| Links Awakening DX | 9.7s | 188.1s | 0.1s | 10.8s | 187.0s | 188.0s |
| Lufia II Ancient Cave | 4.1s | 151.0s | 0.1s | 3.9s | 151.1s | 151.1s |
| Mario & Luigi Superstar Saga | 10.8s | 163.2s | 0.1s | 12.9s | 163.2s | 163.2s |
| Math Adventure | 3.0s | 150.9s | 0.1s | 3.0s | 150.8s | 150.8s |
| Mega Man 2 | 3.9s | 154.0s | 0.1s | 3.8s | 153.9s | 153.9s |
| MegaMan Battle Network 3 | 7.9s | 159.7s | 0.1s | 7.4s | 159.6s | 153.5s |
| Meritous | 5.3s | 150.9s | 0.1s | 5.5s | 151.0s | 150.9s |
| Metamath | 9.7s | 150.5s | 0.1s | 3.0s | 150.5s | 150.0s |
| Muse Dash | 4.2s | 157.0s | 0.1s | 3.9s | 163.2s | 150.9s |
| Noita | 5.5s | 150.5s | 0.1s | 5.5s | 150.5s | 150.6s |
| Old School Runescape | 8.5s | 161.3s | 0.1s | 7.2s | 161.3s | 160.8s |
| Overcooked! 2 | 6.3s | 194.6s | 0.1s | 7.3s | 194.9s | 150.9s |
| Paint | 2.9s | 156.1s | 0.1s | 4.5s | 154.0s | 154.7s |
| Risk of Rain 2 | 6.0s | 155.0s | 0.1s | 6.0s | 154.5s | 154.9s |
| Saving Princess | 3.5s | 150.9s | 0.1s | 3.5s | 153.4s | 149.8s |
| Shivers | 5.8s | 163.3s | 0.1s | 5.7s | 162.8s | 150.0s |
| Sonic Adventure 2 Battle | 8.1s | 174.9s | 0.1s | 8.0s | 184.8s | 150.4s |
| Subnautica | 26.4s | 177.6s | 0.1s | 7.0s | 177.5s | 153.4s |
| Super Mario 64 | 6.2s | 173.4s | 0.1s | 6.3s | 172.3s | 173.4s |
| Super Mario Land 2 | 4.7s | 159.9s | 0.1s | 4.6s | 156.3s | 156.8s |
| Super Mario World | 9.4s | 153.6s | 0.1s | 8.2s | 154.2s | 154.1s |
| TOEM original | 6.5s | 162.7s | 0.1s | 6.3s | 161.1s | 161.1s |
| TOEM rule builder | 6.3s | 162.1s | 0.1s | 6.5s | 162.7s | 161.7s |
| TUNIC | 14.3s | 172.4s | 0.1s | 2.5s | - | - |
| Terraria | 5.7s | 194.4s | 0.1s | 5.6s | 194.9s | 160.2s |
| The Legend of Zelda | 6.0s | 159.7s | 0.1s | 4.7s | 165.8s | 150.5s |
| The Messenger | 7.5s | 175.8s | 0.1s | 7.4s | 176.3s | 175.9s |
| The Wind Waker | 15.1s | 162.8s | 0.1s | 17.7s | 162.8s | 150.5s |
| Timespinner | 7.4s | 157.1s | 0.1s | 7.0s | 155.0s | 150.9s |
| Undertale | 3.7s | 150.0s | 0.1s | 3.6s | 150.5s | 150.6s |
| VVVVVV | 3.5s | 151.0s | 0.1s | 3.5s | 151.1s | 150.5s |
| Wargroove | 3.6s | 153.9s | 0.1s | 3.6s | 153.8s | 153.9s |
| Yoshi's Island | 6.6s | 162.7s | 0.1s | 9.0s | 160.2s | 159.6s |
| shapez | 7.5s | 153.9s | 0.1s | 6.2s | 153.4s | 150.9s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.5s |
| 2 | Subnautica | 26.4s |
| 3 | A Link to the Past | 17.8s |
| 4 | Choo-Choo Charles | 17.2s |
| 5 | Heretic | 15.3s |
| 6 | The Wind Waker | 15.1s |
| 7 | DOOM II | 14.9s |
| 8 | TUNIC | 14.3s |
| 9 | Aquaria | 13.9s |
| 10 | Final Fantasy Mystic Quest | 12.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 219.5s |
| 2 | Overcooked! 2 | 194.6s |
| 3 | Terraria | 194.4s |
| 4 | A Link to the Past | 188.1s |
| 5 | Links Awakening DX | 188.1s |
| 6 | DOOM II | 180.9s |
| 7 | Heretic | 179.7s |
| 8 | Subnautica | 177.6s |
| 9 | A Hat in Time | 177.1s |
| 10 | Donkey Kong Country 3 | 176.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Hat in Time | 0.1s |
| 2 | A Link to the Past | 0.1s |
| 3 | Aquaria | 0.1s |
| 4 | APQuest | 0.1s |
| 5 | Bumper Stickers | 0.1s |
| 6 | Castlevania - Circle of the Moon | 0.1s |
| 7 | Castlevania 64 | 0.1s |
| 8 | A Short Hike | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Baking Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.2s |
| 2 | The Wind Waker | 17.7s |
| 3 | Choo-Choo Charles | 17.0s |
| 4 | Heretic | 15.2s |
| 5 | DOOM II | 14.5s |
| 6 | Mario & Luigi Superstar Saga | 12.9s |
| 7 | Final Fantasy Mystic Quest | 11.2s |
| 8 | A Link to the Past | 10.8s |
| 9 | Links Awakening DX | 10.8s |
| 10 | DOOM 1993 | 10.5s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 216.2s |
| 2 | Overcooked! 2 | 194.9s |
| 3 | Terraria | 194.9s |
| 4 | A Link to the Past | 191.8s |
| 5 | Landstalker - The Treasures of King Nole | 190.3s |
| 6 | Links Awakening DX | 187.0s |
| 7 | Sonic Adventure 2 Battle | 184.8s |
| 8 | DOOM II | 181.9s |
| 9 | Heretic | 181.8s |
| 10 | Donkey Kong Country 3 | 178.1s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Links Awakening DX | 188.0s |
| 2 | A Hat in Time | 175.9s |
| 3 | The Messenger | 175.9s |
| 4 | Super Mario 64 | 173.4s |
| 5 | Final Fantasy Mystic Quest | 165.9s |
| 6 | Choo-Choo Charles | 165.8s |
| 7 | Mario & Luigi Superstar Saga | 163.2s |
| 8 | Factorio | 163.1s |
| 9 | A Short Hike | 162.7s |
| 10 | TOEM rule builder | 161.7s |
