# World Generator Test Results

**Generated:** 2026-01-03 02:20:30 UTC

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
| Stage 1: World Generation | 58 | 3 | 61 |
| Stage 2: Seed Generation | 58 | 3 | 61 |
| Stage 3: Rules Comparison | 32 | 26 | 58 |
| Stage 4: WorldGen Spoiler Test | 58 | 0 | 58 |
| Stage 5: Cross-Validation | 57 | 1 | 58 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ❌ | - | - | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ❌ | - | - | - | - |
| Timespinner | ✅ | ✅ | ❌ | - | - | - | - |
| Undertale | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 61

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 61 | 0 | 61 |
| Original Spoiler Test | 61 | 0 | 61 |
| Stage 1: World Generation | 58 | 3 | 61 |
| Stage 2: Seed Generation | 58 | 3 | 61 |
| Stage 3: Rules Comparison | 0 | 58 | 58 |
| Stage 4: WorldGen Spoiler Test | 58 | 0 | 58 |
| Stage 5: Cross-Validation | 30 | 28 | 58 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Meritous | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Shivers | ✅ | ✅ | ❌ | - | - | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ❌ | - | - | - | - |
| Timespinner | ✅ | ✅ | ❌ | - | - | - | - |
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
| Total | 497.9s | 612.6s | 5.4s | 426.8s | 584.5s | 569.4s |
| Average | 8.2s | 10.0s | 0.1s | 7.4s | 10.1s | 9.8s |
| Max | 29.1s | 28.8s | 0.2s | 29.2s | 28.9s | 28.8s |
| Min | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Dark Souls III (29.1s) | Dark Souls III (28.8s) | A Link to the Past (0.2s) | Dark Souls III (29.2s) | Dark Souls III (28.9s) | Dark Souls III (28.8s) |
| Fastest | Paint (3.0s) | Meritous (5.6s) | shapez (0.1s) | APQuest (3.0s) | APQuest (5.6s) | APQuest (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.7s | 15.6s | 0.1s | 8.7s | 13.7s | 13.7s |
| A Link to the Past | 18.2s | 21.3s | 0.2s | 17.5s | 18.7s | 23.7s |
| A Link to the Past WorldGen 2 | 17.6s | 19.4s | 0.2s | 17.6s | 18.7s | 18.8s |
| A Short Hike | 5.3s | 13.8s | 0.1s | 5.4s | 9.7s | 9.7s |
| APQuest | 3.1s | 6.5s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.5s | 9.2s | 0.1s | 3.5s | 5.6s | 5.6s |
| Aquaria | 14.0s | 9.2s | 0.1s | 9.2s | 7.7s | 8.7s |
| Baking Adventure | 3.6s | 6.9s | 0.1s | 3.5s | 5.7s | 5.7s |
| Bumper Stickers | 5.0s | 12.0s | 0.1s | 4.9s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 5.8s | 6.8s | 0.1s | 5.8s | 5.7s | 5.7s |
| Castlevania 64 | 8.5s | 6.7s | 0.1s | 8.4s | 6.6s | 6.6s |
| Celeste 64 | 3.5s | 6.8s | 0.1s | 3.7s | 7.6s | 6.6s |
| ChecksFinder | 3.3s | 6.6s | 0.1s | 3.2s | 6.6s | 6.7s |
| Choo-Choo Charles | 18.0s | 9.6s | 0.1s | 18.0s | 9.6s | 10.7s |
| Civilization VI | 5.9s | 8.7s | 0.1s | 6.2s | 8.6s | 8.6s |
| Coding Adventure | 4.0s | 8.7s | 0.1s | 4.0s | 8.7s | 8.7s |
| DLCQuest | 3.9s | 5.6s | 0.1s | 3.8s | 5.7s | 5.6s |
| DOOM 1993 | 12.2s | 12.8s | 0.1s | 11.3s | 12.7s | 12.7s |
| DOOM II | 14.3s | 15.8s | 0.1s | 14.1s | 15.8s | 15.8s |
| Dark Souls III | 29.1s | 28.8s | 0.1s | 29.2s | 28.9s | 28.8s |
| Donkey Kong Country 3 | 7.9s | 13.7s | 0.1s | 7.7s | 13.7s | 13.7s |
| Factorio | 5.9s | 9.7s | 0.1s | 5.2s | 9.7s | 9.7s |
| Faxanadu | 4.9s | 6.6s | 0.1s | 5.5s | 8.7s | 6.6s |
| Final Fantasy Mystic Quest | 13.0s | 10.7s | 0.1s | 12.0s | 10.7s | 10.7s |
| Heretic | 15.1s | 14.7s | 0.1s | 14.8s | 14.7s | 14.7s |
| Hylics 2 | 6.4s | 6.6s | 0.1s | 5.5s | 6.6s | 6.6s |
| Inscryption | 4.6s | 6.6s | 0.1s | 4.4s | 6.6s | 6.7s |
| Landstalker - The Treasures of King Nole | 10.4s | 8.7s | 0.1s | 10.8s | 17.7s | 8.7s |
| Links Awakening DX | 10.9s | 17.9s | 0.1s | 10.6s | 17.8s | 17.8s |
| Lufia II Ancient Cave | 4.0s | 5.7s | 0.1s | 3.9s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 10.8s | 9.7s | 0.1s | 12.9s | 9.7s | 9.7s |
| Math Adventure | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Mega Man 2 | 3.9s | 6.6s | 0.1s | 4.1s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 8.2s | 8.7s | 0.1s | 8.0s | 8.6s | 8.6s |
| Meritous | 5.2s | 5.6s | 0.1s | 5.2s | 5.6s | 5.6s |
| Metamath | 10.8s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 4.2s | 7.7s | 0.1s | 4.1s | 9.7s | 7.7s |
| Noita | 6.4s | 5.7s | 0.1s | 6.2s | 5.7s | 5.7s |
| Old School Runescape | 8.4s | 8.7s | 0.1s | 7.2s | 8.7s | 8.7s |
| Overcooked! 2 | 6.3s | 19.9s | 0.1s | 7.7s | 20.8s | 19.8s |
| Paint | 3.0s | 6.6s | 0.1s | 4.5s | 6.7s | 6.7s |
| Risk of Rain 2 | 6.1s | 6.6s | 0.1s | 6.0s | 6.6s | 6.6s |
| Saving Princess | 3.6s | 5.6s | 0.1s | 3.7s | 6.6s | 5.7s |
| Shivers | 6.0s | 9.6s | 0.1s | - | - | - |
| Sonic Adventure 2 Battle | 8.0s | 13.6s | 0.1s | 7.7s | 16.7s | 13.6s |
| Subnautica | 28.5s | 14.7s | 0.1s | 7.5s | 14.7s | 14.7s |
| Super Mario 64 | 6.1s | 12.7s | 0.1s | 6.7s | 12.7s | 12.7s |
| Super Mario Land 2 | 5.4s | 8.8s | 0.1s | 5.0s | 8.8s | 8.8s |
| Super Mario World | 9.1s | 6.7s | 0.1s | 7.9s | 6.7s | 6.7s |
| TOEM original | 6.5s | 9.7s | 0.1s | 6.7s | 9.7s | 9.7s |
| TOEM rule builder | 6.4s | 8.7s | 0.1s | 6.4s | 9.7s | 8.7s |
| Terraria | 5.8s | 20.8s | 0.1s | 5.7s | 19.8s | 19.7s |
| The Legend of Zelda | 6.2s | 8.7s | 0.1s | 5.0s | 10.7s | 8.7s |
| The Messenger | 7.4s | 12.8s | 0.1s | 7.2s | 12.8s | 12.8s |
| The Wind Waker | 16.8s | 9.6s | 0.1s | - | - | - |
| Timespinner | 7.5s | 7.7s | 0.1s | - | - | - |
| Undertale | 3.8s | 5.6s | 0.1s | 3.8s | 5.7s | 5.7s |
| VVVVVV | 3.6s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| Wargroove | 3.6s | 6.7s | 0.1s | 3.8s | 6.7s | 6.7s |
| Yoshi's Island | 7.0s | 9.7s | 0.1s | 7.0s | 8.7s | 8.7s |
| shapez | 7.5s | 6.6s | 0.1s | 6.4s | 6.6s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 29.1s |
| 2 | Subnautica | 28.5s |
| 3 | A Link to the Past | 18.2s |
| 4 | Choo-Choo Charles | 18.0s |
| 5 | A Link to the Past WorldGen 2 | 17.6s |
| 6 | The Wind Waker | 16.8s |
| 7 | Heretic | 15.1s |
| 8 | DOOM II | 14.3s |
| 9 | Aquaria | 14.0s |
| 10 | Final Fantasy Mystic Quest | 13.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | A Link to the Past | 21.3s |
| 3 | Terraria | 20.8s |
| 4 | Overcooked! 2 | 19.9s |
| 5 | A Link to the Past WorldGen 2 | 19.4s |
| 6 | Links Awakening DX | 17.9s |
| 7 | DOOM II | 15.8s |
| 8 | A Hat in Time | 15.6s |
| 9 | Heretic | 14.7s |
| 10 | Subnautica | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | Aquaria | 0.1s |
| 4 | A Hat in Time | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | Adventure | 0.1s |
| 7 | Baking Adventure | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | APQuest | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 29.2s |
| 2 | Choo-Choo Charles | 18.0s |
| 3 | A Link to the Past WorldGen 2 | 17.6s |
| 4 | A Link to the Past | 17.5s |
| 5 | Heretic | 14.8s |
| 6 | DOOM II | 14.1s |
| 7 | Mario & Luigi Superstar Saga | 12.9s |
| 8 | Final Fantasy Mystic Quest | 12.0s |
| 9 | DOOM 1993 | 11.3s |
| 10 | Landstalker - The Treasures of King Nole | 10.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.9s |
| 2 | Overcooked! 2 | 20.8s |
| 3 | Terraria | 19.8s |
| 4 | A Link to the Past | 18.7s |
| 5 | A Link to the Past WorldGen 2 | 18.7s |
| 6 | Links Awakening DX | 17.8s |
| 7 | Landstalker - The Treasures of King Nole | 17.7s |
| 8 | Sonic Adventure 2 Battle | 16.7s |
| 9 | DOOM II | 15.8s |
| 10 | Heretic | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | A Link to the Past | 23.7s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | Terraria | 19.7s |
| 5 | A Link to the Past WorldGen 2 | 18.8s |
| 6 | Links Awakening DX | 17.8s |
| 7 | DOOM II | 15.8s |
| 8 | Heretic | 14.7s |
| 9 | Subnautica | 14.7s |
| 10 | A Hat in Time | 13.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 502.9s | 608.5s | 5.4s | 432.5s | 585.6s | 673.8s |
| Average | 8.2s | 10.0s | 0.1s | 7.5s | 10.1s | 11.6s |
| Max | 29.1s | 28.8s | 0.2s | 28.4s | 26.8s | 23.8s |
| Min | 2.9s | 5.6s | 0.1s | 2.9s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.1s) | Dark Souls III (28.8s) | A Link to the Past (0.2s) | Dark Souls III (28.4s) | Dark Souls III (26.8s) | Terraria (23.8s) |
| Fastest | Paint (2.9s) | Lufia II Ancient Cave (5.6s) | shapez (0.1s) | APQuest (2.9s) | APQuest (5.5s) | APQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.6s | 15.5s | 0.1s | 8.7s | 13.7s | 13.7s |
| A Link to the Past | 18.9s | 19.6s | 0.2s | 18.6s | 19.8s | 14.6s |
| A Link to the Past WorldGen 2 | 19.1s | 21.2s | 0.2s | 19.0s | 19.9s | 14.7s |
| A Short Hike | 5.4s | 11.2s | 0.1s | 5.5s | 9.7s | 9.7s |
| APQuest | 3.2s | 7.1s | 0.1s | 2.9s | 5.5s | 5.5s |
| Adventure | 3.6s | 6.2s | 0.1s | 3.8s | 5.7s | 14.4s |
| Aquaria | 14.9s | 9.9s | 0.1s | 9.6s | 7.7s | 14.6s |
| Baking Adventure | 3.3s | 7.0s | 0.1s | 3.2s | 5.6s | 14.3s |
| Bumper Stickers | 4.9s | 9.6s | 0.1s | 4.8s | 8.6s | 14.3s |
| Castlevania - Circle of the Moon | 5.5s | 6.3s | 0.1s | 5.5s | 5.6s | 14.3s |
| Castlevania 64 | 8.3s | 6.6s | 0.1s | 8.4s | 6.6s | 6.6s |
| Celeste 64 | 3.9s | 6.7s | 0.1s | 4.1s | 7.7s | 14.4s |
| ChecksFinder | 3.4s | 6.9s | 0.1s | 3.4s | 6.7s | 6.7s |
| Choo-Choo Charles | 18.5s | 10.7s | 0.1s | 18.4s | 10.7s | 10.7s |
| Civilization VI | 5.9s | 8.5s | 0.1s | 6.1s | 8.5s | 17.0s |
| Coding Adventure | 4.0s | 8.7s | 0.1s | 4.2s | 8.7s | 14.3s |
| DLCQuest | 4.3s | 5.7s | 0.1s | 3.8s | 5.7s | 5.7s |
| DOOM 1993 | 11.4s | 12.7s | 0.1s | 11.4s | 12.7s | 14.3s |
| DOOM II | 14.1s | 15.7s | 0.1s | 14.1s | 15.7s | 14.3s |
| Dark Souls III | 27.8s | 28.8s | 0.1s | 28.4s | 26.8s | 17.1s |
| Donkey Kong Country 3 | 7.9s | 13.7s | 0.1s | 7.7s | 13.7s | 14.9s |
| Factorio | 6.5s | 9.7s | 0.1s | 5.8s | 9.8s | 9.7s |
| Faxanadu | 5.0s | 6.7s | 0.1s | 5.5s | 8.7s | 14.3s |
| Final Fantasy Mystic Quest | 13.6s | 10.9s | 0.1s | 12.3s | 10.7s | 10.7s |
| Heretic | 14.6s | 15.6s | 0.1s | 14.2s | 15.5s | 14.0s |
| Hylics 2 | 6.7s | 6.7s | 0.1s | 5.7s | 6.7s | 6.7s |
| Inscryption | 5.1s | 6.8s | 0.1s | 4.7s | 6.7s | 6.7s |
| Landstalker - The Treasures of King Nole | 9.8s | 8.7s | 0.1s | 10.6s | 17.8s | 14.3s |
| Links Awakening DX | 10.8s | 16.9s | 0.1s | 10.7s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.9s | 5.6s | 0.1s | 3.7s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 10.8s | 9.7s | 0.1s | 13.3s | 9.7s | 9.8s |
| Math Adventure | 3.4s | 5.7s | 0.1s | 3.4s | 5.7s | 14.4s |
| Mega Man 2 | 4.2s | 6.8s | 0.1s | 4.3s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 8.6s | 8.7s | 0.1s | 8.3s | 8.7s | 17.4s |
| Meritous | 5.1s | 5.6s | 0.1s | 5.1s | 5.5s | 13.9s |
| Metamath | 10.7s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| Muse Dash | 4.6s | 7.8s | 0.1s | 4.2s | 9.7s | 14.4s |
| Noita | 6.0s | 5.7s | 0.1s | 6.0s | 5.6s | 5.6s |
| Old School Runescape | 8.4s | 8.7s | 0.1s | 7.0s | 8.7s | 8.7s |
| Overcooked! 2 | 6.1s | 19.8s | 0.1s | 7.3s | 19.8s | 14.4s |
| Paint | 2.9s | 6.7s | 0.1s | 4.5s | 6.6s | 6.6s |
| Risk of Rain 2 | 6.8s | 6.7s | 0.1s | 6.5s | 6.7s | 6.7s |
| Saving Princess | 3.9s | 5.7s | 0.1s | 3.8s | 6.7s | 14.5s |
| Shivers | 6.3s | 9.7s | 0.1s | - | - | - |
| Sonic Adventure 2 Battle | 8.2s | 13.6s | 0.1s | 7.7s | 16.6s | 14.1s |
| Subnautica | 29.1s | 14.8s | 0.1s | 7.6s | 14.8s | 17.6s |
| Super Mario 64 | 6.4s | 12.8s | 0.1s | 6.6s | 12.7s | 12.7s |
| Super Mario Land 2 | 5.0s | 8.7s | 0.1s | 4.9s | 8.7s | 8.7s |
| Super Mario World | 9.0s | 6.6s | 0.1s | 8.0s | 6.7s | 6.7s |
| TOEM original | 6.5s | 8.7s | 0.1s | 6.4s | 9.7s | 8.7s |
| TOEM rule builder | 6.3s | 8.6s | 0.1s | 6.5s | 8.6s | 8.7s |
| Terraria | 6.3s | 21.9s | 0.1s | 6.2s | 20.8s | 23.8s |
| The Legend of Zelda | 6.6s | 8.7s | 0.1s | 5.3s | 10.7s | 14.4s |
| The Messenger | 7.7s | 13.8s | 0.1s | 7.5s | 13.8s | 13.9s |
| The Wind Waker | 15.5s | 9.5s | 0.1s | - | - | - |
| Timespinner | 7.8s | 7.7s | 0.1s | - | - | - |
| Undertale | 4.2s | 5.8s | 0.1s | 3.9s | 5.7s | 5.7s |
| VVVVVV | 3.4s | 5.6s | 0.1s | 3.3s | 5.6s | 5.7s |
| Wargroove | 3.5s | 6.6s | 0.1s | 3.7s | 6.6s | 6.6s |
| Yoshi's Island | 6.7s | 9.7s | 0.1s | 6.9s | 8.6s | 8.7s |
| shapez | 7.6s | 6.6s | 0.1s | 6.4s | 6.6s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.1s |
| 2 | Dark Souls III | 27.8s |
| 3 | A Link to the Past WorldGen 2 | 19.1s |
| 4 | A Link to the Past | 18.9s |
| 5 | Choo-Choo Charles | 18.5s |
| 6 | The Wind Waker | 15.5s |
| 7 | Aquaria | 14.9s |
| 8 | Heretic | 14.6s |
| 9 | DOOM II | 14.1s |
| 10 | Final Fantasy Mystic Quest | 13.6s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | Terraria | 21.9s |
| 3 | A Link to the Past WorldGen 2 | 21.2s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | A Link to the Past | 19.6s |
| 6 | Links Awakening DX | 16.9s |
| 7 | DOOM II | 15.7s |
| 8 | Heretic | 15.6s |
| 9 | A Hat in Time | 15.5s |
| 10 | Subnautica | 14.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | Adventure | 0.1s |
| 7 | Baking Adventure | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | APQuest | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.4s |
| 2 | A Link to the Past WorldGen 2 | 19.0s |
| 3 | A Link to the Past | 18.6s |
| 4 | Choo-Choo Charles | 18.4s |
| 5 | Heretic | 14.2s |
| 6 | DOOM II | 14.1s |
| 7 | Mario & Luigi Superstar Saga | 13.3s |
| 8 | Final Fantasy Mystic Quest | 12.3s |
| 9 | DOOM 1993 | 11.4s |
| 10 | Links Awakening DX | 10.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 26.8s |
| 2 | Terraria | 20.8s |
| 3 | A Link to the Past WorldGen 2 | 19.9s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | A Link to the Past | 19.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.8s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Sonic Adventure 2 Battle | 16.6s |
| 9 | DOOM II | 15.7s |
| 10 | Heretic | 15.5s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.8s |
| 2 | Subnautica | 17.6s |
| 3 | MegaMan Battle Network 3 | 17.4s |
| 4 | Dark Souls III | 17.1s |
| 5 | Civilization VI | 17.0s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Donkey Kong Country 3 | 14.9s |
| 8 | A Link to the Past WorldGen 2 | 14.7s |
| 9 | A Link to the Past | 14.6s |
| 10 | Aquaria | 14.6s |
