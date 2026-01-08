# World Generator Test Results

**Generated:** 2026-01-08 02:09:50 UTC

**Seed:** 1

**Mode:** Both (Canonical and Random)

This report shows the results of round-trip testing the world generator.
Each game's rules.json is converted to a `_worldgen` world, and the generated
world is validated to produce equivalent game logic.

Tests are run in two modes:
- **Canonical**: Uses `--canonical-seed1` which places items in their original locations when seed is 1
- **Random**: Standard randomized item placement

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

---

# Canonical Mode Results

Tests run with `--canonical-seed1` (items placed in original locations).

## Canonical Summary

**Total Templates:** 61

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 61 | 0 | 61 |
| Original Spoiler Test | 61 | 0 | 61 |
| Stage 1: World Generation | 0 | 61 | 61 |
| Stage 2: Seed Generation | 0 | 61 | 61 |
| Stage 3: Rules Comparison | 0 | 0 | 0 |
| Stage 4: WorldGen Spoiler Test | 0 | 0 | 0 |
| Stage 5: Cross-Validation | 0 | 0 | 0 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ❌ | - | - | - | - |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - | - |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ❌ | - | - | - | - |
| A Short Hike | ✅ | ✅ | ❌ | - | - | - | - |
| APQuest | ✅ | ✅ | ❌ | - | - | - | - |
| Adventure | ✅ | ✅ | ❌ | - | - | - | - |
| Aquaria | ✅ | ✅ | ❌ | - | - | - | - |
| Baking Adventure | ✅ | ✅ | ❌ | - | - | - | - |
| Bumper Stickers | ✅ | ✅ | ❌ | - | - | - | - |
| Castlevania - Circle of the Moon | ✅ | ✅ | ❌ | - | - | - | - |
| Castlevania 64 | ✅ | ✅ | ❌ | - | - | - | - |
| Celeste 64 | ✅ | ✅ | ❌ | - | - | - | - |
| ChecksFinder | ✅ | ✅ | ❌ | - | - | - | - |
| Choo-Choo Charles | ✅ | ✅ | ❌ | - | - | - | - |
| Civilization VI | ✅ | ✅ | ❌ | - | - | - | - |
| Coding Adventure | ✅ | ✅ | ❌ | - | - | - | - |
| DLCQuest | ✅ | ✅ | ❌ | - | - | - | - |
| DOOM 1993 | ✅ | ✅ | ❌ | - | - | - | - |
| DOOM II | ✅ | ✅ | ❌ | - | - | - | - |
| Dark Souls III | ✅ | ✅ | ❌ | - | - | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - | - |
| Factorio | ✅ | ✅ | ❌ | - | - | - | - |
| Faxanadu | ✅ | ✅ | ❌ | - | - | - | - |
| Final Fantasy Mystic Quest | ✅ | ✅ | ❌ | - | - | - | - |
| Heretic | ✅ | ✅ | ❌ | - | - | - | - |
| Hylics 2 | ✅ | ✅ | ❌ | - | - | - | - |
| Inscryption | ✅ | ✅ | ❌ | - | - | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ❌ | - | - | - | - |
| Links Awakening DX | ✅ | ✅ | ❌ | - | - | - | - |
| Lufia II Ancient Cave | ✅ | ✅ | ❌ | - | - | - | - |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ❌ | - | - | - | - |
| Math Adventure | ✅ | ✅ | ❌ | - | - | - | - |
| Mega Man 2 | ✅ | ✅ | ❌ | - | - | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ❌ | - | - | - | - |
| Meritous | ✅ | ✅ | ❌ | - | - | - | - |
| Metamath | ✅ | ✅ | ❌ | - | - | - | - |
| Muse Dash | ✅ | ✅ | ❌ | - | - | - | - |
| Noita | ✅ | ✅ | ❌ | - | - | - | - |
| Old School Runescape | ✅ | ✅ | ❌ | - | - | - | - |
| Overcooked! 2 | ✅ | ✅ | ❌ | - | - | - | - |
| Paint | ✅ | ✅ | ❌ | - | - | - | - |
| Risk of Rain 2 | ✅ | ✅ | ❌ | - | - | - | - |
| Saving Princess | ✅ | ✅ | ❌ | - | - | - | - |
| Shivers | ✅ | ✅ | ❌ | - | - | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ❌ | - | - | - | - |
| Subnautica | ✅ | ✅ | ❌ | - | - | - | - |
| Super Mario 64 | ✅ | ✅ | ❌ | - | - | - | - |
| Super Mario Land 2 | ✅ | ✅ | ❌ | - | - | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - | - |
| TOEM original | ✅ | ✅ | ❌ | - | - | - | - |
| TOEM rule builder | ✅ | ✅ | ❌ | - | - | - | - |
| Terraria | ✅ | ✅ | ❌ | - | - | - | - |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - | - |
| The Messenger | ✅ | ✅ | ❌ | - | - | - | - |
| The Wind Waker | ✅ | ✅ | ❌ | - | - | - | - |
| Timespinner | ✅ | ✅ | ❌ | - | - | - | - |
| Undertale | ✅ | ✅ | ❌ | - | - | - | - |
| VVVVVV | ✅ | ✅ | ❌ | - | - | - | - |
| Wargroove | ✅ | ✅ | ❌ | - | - | - | - |
| Yoshi's Island | ✅ | ✅ | ❌ | - | - | - | - |
| shapez | ✅ | ✅ | ❌ | - | - | - | - |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 61

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 61 | 0 | 61 |
| Original Spoiler Test | 61 | 0 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 60 | 1 | 61 |
| Stage 3: Rules Comparison | 0 | 60 | 60 |
| Stage 4: WorldGen Spoiler Test | 59 | 1 | 60 |
| Stage 5: Cross-Validation | 35 | 25 | 60 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Factorio | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 227.4s | 424.4s | 5.2s | 0.0s | 0.0s | 0.0s |
| Average | 3.7s | 7.0s | 0.1s | 0.0s | 0.0s | 0.0s |
| Max | 9.1s | 18.8s | 0.2s | 0.0s | 0.0s | 0.0s |
| Min | 2.7s | 5.4s | 0.1s | N/A | N/A | N/A |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (9.1s) | Dark Souls III (18.8s) | A Link to the Past WorldGen 2 (0.2s) | N/A | N/A | N/A |
| Fastest | Coding Adventure (2.7s) | Timespinner (5.4s) | Metamath (0.1s) | N/A | N/A | N/A |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 10.7s | 0.1s | - | - | - |
| A Link to the Past | 7.7s | 9.8s | 0.2s | - | - | - |
| A Link to the Past WorldGen 2 | 6.0s | 15.0s | 0.2s | - | - | - |
| A Short Hike | 3.3s | 10.8s | 0.1s | - | - | - |
| APQuest | 3.1s | 9.1s | 0.1s | - | - | - |
| Adventure | 2.9s | 9.6s | 0.1s | - | - | - |
| Aquaria | 4.4s | 7.2s | 0.1s | - | - | - |
| Baking Adventure | 3.1s | 9.0s | 0.1s | - | - | - |
| Bumper Stickers | 3.4s | 8.6s | 0.1s | - | - | - |
| Castlevania - Circle of the Moon | 3.5s | 9.7s | 0.1s | - | - | - |
| Castlevania 64 | 3.4s | 5.6s | 0.1s | - | - | - |
| Celeste 64 | 3.0s | 5.6s | 0.1s | - | - | - |
| ChecksFinder | 2.8s | 5.7s | 0.1s | - | - | - |
| Choo-Choo Charles | 3.2s | 7.7s | 0.1s | - | - | - |
| Civilization VI | 3.1s | 5.6s | 0.1s | - | - | - |
| Coding Adventure | 2.7s | 5.4s | 0.1s | - | - | - |
| DLCQuest | 3.4s | 5.7s | 0.1s | - | - | - |
| DOOM 1993 | 3.6s | 6.7s | 0.1s | - | - | - |
| DOOM II | 3.9s | 7.7s | 0.1s | - | - | - |
| Dark Souls III | 4.5s | 18.8s | 0.1s | - | - | - |
| Donkey Kong Country 3 | 3.1s | 5.6s | 0.1s | - | - | - |
| Factorio | 3.6s | 5.7s | 0.1s | - | - | - |
| Faxanadu | 3.0s | 5.6s | 0.1s | - | - | - |
| Final Fantasy Mystic Quest | 4.2s | 6.7s | 0.1s | - | - | - |
| Heretic | 3.7s | 7.7s | 0.1s | - | - | - |
| Hylics 2 | 2.9s | 5.4s | 0.1s | - | - | - |
| Inscryption | 3.2s | 5.6s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.4s | 5.7s | 0.1s | - | - | - |
| Links Awakening DX | 8.1s | 7.9s | 0.1s | - | - | - |
| Lufia II Ancient Cave | 3.5s | 5.7s | 0.1s | - | - | - |
| Mario & Luigi Superstar Saga | 3.8s | 7.7s | 0.1s | - | - | - |
| Math Adventure | 2.8s | 5.6s | 0.1s | - | - | - |
| Mega Man 2 | 3.0s | 5.6s | 0.1s | - | - | - |
| MegaMan Battle Network 3 | 3.2s | 5.6s | 0.1s | - | - | - |
| Meritous | 3.0s | 5.6s | 0.1s | - | - | - |
| Metamath | 9.1s | 5.4s | 0.1s | - | - | - |
| Muse Dash | 3.1s | 5.7s | 0.1s | - | - | - |
| Noita | 3.1s | 5.8s | 0.1s | - | - | - |
| Old School Runescape | 4.1s | 5.7s | 0.1s | - | - | - |
| Overcooked! 2 | 3.5s | 7.7s | 0.1s | - | - | - |
| Paint | 2.9s | 5.6s | 0.1s | - | - | - |
| Risk of Rain 2 | 3.4s | 5.6s | 0.1s | - | - | - |
| Saving Princess | 3.0s | 5.6s | 0.1s | - | - | - |
| Shivers | 3.3s | 5.6s | 0.1s | - | - | - |
| Sonic Adventure 2 Battle | 4.7s | 5.6s | 0.1s | - | - | - |
| Subnautica | 3.3s | 9.4s | 0.1s | - | - | - |
| Super Mario 64 | 3.3s | 5.7s | 0.1s | - | - | - |
| Super Mario Land 2 | 3.7s | 5.7s | 0.1s | - | - | - |
| Super Mario World | 4.7s | 5.7s | 0.1s | - | - | - |
| TOEM original | 3.1s | 5.7s | 0.1s | - | - | - |
| TOEM rule builder | 3.0s | 5.8s | 0.1s | - | - | - |
| Terraria | 3.0s | 7.6s | 0.1s | - | - | - |
| The Legend of Zelda | 3.6s | 5.6s | 0.1s | - | - | - |
| The Messenger | 3.5s | 8.8s | 0.1s | - | - | - |
| The Wind Waker | 4.9s | 5.6s | 0.1s | - | - | - |
| Timespinner | 3.7s | 5.4s | 0.1s | - | - | - |
| Undertale | 3.3s | 5.7s | 0.1s | - | - | - |
| VVVVVV | 3.1s | 5.7s | 0.1s | - | - | - |
| Wargroove | 3.2s | 5.7s | 0.1s | - | - | - |
| Yoshi's Island | 4.3s | 6.6s | 0.1s | - | - | - |
| shapez | 3.8s | 5.6s | 0.1s | - | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 9.1s |
| 2 | Links Awakening DX | 8.1s |
| 3 | A Link to the Past | 7.7s |
| 4 | A Link to the Past WorldGen 2 | 6.0s |
| 5 | The Wind Waker | 4.9s |
| 6 | Super Mario World | 4.7s |
| 7 | Sonic Adventure 2 Battle | 4.7s |
| 8 | Dark Souls III | 4.5s |
| 9 | A Hat in Time | 4.5s |
| 10 | Aquaria | 4.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.8s |
| 2 | A Link to the Past WorldGen 2 | 15.0s |
| 3 | A Short Hike | 10.8s |
| 4 | A Hat in Time | 10.7s |
| 5 | A Link to the Past | 9.8s |
| 6 | Castlevania - Circle of the Moon | 9.7s |
| 7 | Adventure | 9.6s |
| 8 | Subnautica | 9.4s |
| 9 | APQuest | 9.1s |
| 10 | Baking Adventure | 9.0s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | Aquaria | 0.1s |
| 6 | Bumper Stickers | 0.1s |
| 7 | Castlevania - Circle of the Moon | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Adventure | 0.1s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 226.2s | 412.4s | 5.5s | 207.2s | 391.7s | 584.7s |
| Average | 3.7s | 6.8s | 0.1s | 3.4s | 6.5s | 9.7s |
| Max | 10.1s | 18.7s | 0.2s | 6.6s | 17.7s | 32.7s |
| Min | 2.8s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.1s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | A Link to the Past (6.6s) | Dark Souls III (17.7s) | Dark Souls III (32.7s) |
| Fastest | Math Adventure (2.8s) | Noita (5.6s) | Wargroove (0.1s) | Civilization VI (2.6s) | Noita (5.6s) | Wargroove (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.2s | 8.7s | 0.1s | 3.8s | 16.2s | 16.4s |
| A Link to the Past | 8.2s | 9.4s | 0.2s | 6.6s | 9.8s | 14.5s |
| A Link to the Past WorldGen 2 | 5.7s | 10.5s | 0.2s | 6.0s | 9.6s | 14.3s |
| A Short Hike | 3.4s | 8.3s | 0.1s | 3.2s | 5.7s | 5.7s |
| APQuest | 3.1s | 7.3s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.1s | 8.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Aquaria | 4.2s | 9.0s | 0.1s | 3.3s | 5.7s | 5.6s |
| Baking Adventure | 3.0s | 10.9s | 0.1s | 2.8s | 5.6s | 14.1s |
| Bumper Stickers | 3.1s | 6.2s | 0.1s | 3.0s | 5.6s | 14.2s |
| Castlevania - Circle of the Moon | 3.2s | 9.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Castlevania 64 | 3.3s | 5.6s | 0.1s | 3.4s | 5.6s | 5.6s |
| Celeste 64 | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 14.1s |
| ChecksFinder | 3.2s | 5.8s | 0.1s | 3.1s | 5.7s | 5.7s |
| Choo-Choo Charles | 3.3s | 7.7s | 0.1s | 3.3s | 7.7s | 7.7s |
| Civilization VI | 3.1s | 5.7s | 0.1s | 2.6s | - | - |
| Coding Adventure | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 14.1s |
| DLCQuest | 3.2s | 5.6s | 0.1s | 3.1s | 5.7s | 5.6s |
| DOOM 1993 | 3.4s | 6.6s | 0.1s | 3.3s | 6.6s | 14.2s |
| DOOM II | 3.5s | 7.6s | 0.1s | 3.6s | 7.7s | 14.3s |
| Dark Souls III | 4.1s | 18.7s | 0.1s | 4.0s | 17.7s | 32.7s |
| Donkey Kong Country 3 | 3.0s | 5.6s | 0.1s | 3.1s | 5.6s | 14.1s |
| Factorio | 3.4s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| Faxanadu | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 14.2s |
| Final Fantasy Mystic Quest | 4.4s | 6.7s | 0.1s | 3.8s | 6.7s | 6.7s |
| Heretic | 3.7s | 7.7s | 0.1s | 3.6s | 7.7s | 14.4s |
| Hylics 2 | 3.2s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Inscryption | 3.0s | 5.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.6s | 0.1s | 3.3s | 6.6s | 14.2s |
| Links Awakening DX | 7.5s | 7.8s | 0.1s | 4.4s | 7.8s | 7.8s |
| Lufia II Ancient Cave | 3.3s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 6.6s | 0.1s | 3.9s | 6.6s | 6.6s |
| Math Adventure | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 14.1s |
| Mega Man 2 | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 3.5s | 5.7s | 0.1s | 3.2s | 5.7s | 14.4s |
| Meritous | 3.0s | 5.8s | 0.1s | 3.1s | 5.6s | 5.6s |
| Metamath | 10.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 14.2s |
| Noita | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Old School Runescape | 3.9s | 5.6s | 0.1s | 3.9s | 5.7s | 5.7s |
| Overcooked! 2 | 3.4s | 7.6s | 0.1s | 3.3s | 7.6s | 14.3s |
| Paint | 2.9s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.2s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| Saving Princess | 3.3s | 5.7s | 0.1s | 3.2s | 5.7s | 14.2s |
| Shivers | 3.5s | 5.7s | 0.1s | 3.3s | 5.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.6s | 5.7s | 0.1s | 4.4s | 6.7s | 14.3s |
| Subnautica | 3.6s | 9.7s | 0.1s | 3.5s | 8.6s | 14.2s |
| Super Mario 64 | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.5s | 5.7s | 0.1s | 3.4s | 5.6s | 5.7s |
| Super Mario World | 4.4s | 5.6s | 0.1s | 3.5s | 5.6s | 5.7s |
| TOEM original | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| TOEM rule builder | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Terraria | 3.0s | 7.6s | 0.1s | 3.0s | 7.6s | 7.6s |
| The Legend of Zelda | 3.9s | 5.7s | 0.1s | 3.3s | 5.7s | 14.4s |
| The Messenger | 3.7s | 8.8s | 0.1s | 3.5s | 8.8s | 8.8s |
| The Wind Waker | 5.0s | 5.7s | 0.1s | 5.3s | 5.7s | 14.3s |
| Timespinner | 4.0s | 5.6s | 0.1s | 3.8s | 5.6s | 5.6s |
| Undertale | 3.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 2.9s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Wargroove | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Yoshi's Island | 4.0s | 6.6s | 0.1s | 3.8s | 5.6s | 5.6s |
| shapez | 3.8s | 5.6s | 0.1s | 3.2s | 5.6s | 14.2s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.1s |
| 2 | A Link to the Past | 8.2s |
| 3 | Links Awakening DX | 7.5s |
| 4 | A Link to the Past WorldGen 2 | 5.7s |
| 5 | The Wind Waker | 5.0s |
| 6 | Sonic Adventure 2 Battle | 4.6s |
| 7 | Final Fantasy Mystic Quest | 4.4s |
| 8 | Super Mario World | 4.4s |
| 9 | A Hat in Time | 4.2s |
| 10 | Aquaria | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | Baking Adventure | 10.9s |
| 3 | A Link to the Past WorldGen 2 | 10.5s |
| 4 | Subnautica | 9.7s |
| 5 | Castlevania - Circle of the Moon | 9.6s |
| 6 | A Link to the Past | 9.4s |
| 7 | Aquaria | 9.0s |
| 8 | The Messenger | 8.8s |
| 9 | A Hat in Time | 8.7s |
| 10 | Adventure | 8.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | Adventure | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Baking Adventure | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.6s |
| 2 | A Link to the Past WorldGen 2 | 6.0s |
| 3 | The Wind Waker | 5.3s |
| 4 | Links Awakening DX | 4.4s |
| 5 | Sonic Adventure 2 Battle | 4.4s |
| 6 | Dark Souls III | 4.0s |
| 7 | Mario & Luigi Superstar Saga | 3.9s |
| 8 | Old School Runescape | 3.9s |
| 9 | Final Fantasy Mystic Quest | 3.8s |
| 10 | Yoshi's Island | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 17.7s |
| 2 | A Hat in Time | 16.2s |
| 3 | A Link to the Past | 9.8s |
| 4 | A Link to the Past WorldGen 2 | 9.6s |
| 5 | The Messenger | 8.8s |
| 6 | Subnautica | 8.6s |
| 7 | Links Awakening DX | 7.8s |
| 8 | Choo-Choo Charles | 7.7s |
| 9 | DOOM II | 7.7s |
| 10 | Heretic | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.7s |
| 2 | A Hat in Time | 16.4s |
| 3 | A Link to the Past | 14.5s |
| 4 | Heretic | 14.4s |
| 5 | The Legend of Zelda | 14.4s |
| 6 | MegaMan Battle Network 3 | 14.4s |
| 7 | DOOM II | 14.3s |
| 8 | Shivers | 14.3s |
| 9 | A Link to the Past WorldGen 2 | 14.3s |
| 10 | Sonic Adventure 2 Battle | 14.3s |
