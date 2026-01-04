# World Generator Test Results

**Generated:** 2026-01-03 21:35:08 UTC

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
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 56 | 5 | 61 |
| Stage 3: Rules Comparison | 43 | 13 | 56 |
| Stage 4: WorldGen Spoiler Test | 55 | 1 | 56 |
| Stage 5: Cross-Validation | 55 | 1 | 56 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ❌ | - | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 56 | 5 | 61 |
| Stage 3: Rules Comparison | 0 | 56 | 56 |
| Stage 4: WorldGen Spoiler Test | 55 | 1 | 56 |
| Stage 5: Cross-Validation | 26 | 30 | 56 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
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
| Shivers | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ❌ | - | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Total | 494.7s | 611.1s | 5.4s | 437.9s | 568.3s | 547.7s |
| Average | 8.1s | 10.0s | 0.1s | 7.2s | 10.1s | 9.8s |
| Max | 29.0s | 27.7s | 0.2s | 28.3s | 28.9s | 27.7s |
| Min | 3.1s | 5.6s | 0.1s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.0s) | Dark Souls III (27.7s) | A Link to the Past (0.2s) | Dark Souls III (28.3s) | Dark Souls III (28.9s) | Dark Souls III (27.7s) |
| Fastest | APQuest (3.1s) | Undertale (5.6s) | Wargroove (0.1s) | Undertale (2.5s) | APQuest (5.6s) | Meritous (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 11.6s | 18.2s | 0.1s | 2.6s | - | - |
| A Link to the Past | 18.3s | 21.6s | 0.2s | 17.7s | 18.7s | 17.8s |
| A Link to the Past WorldGen 2 | 18.1s | 19.4s | 0.2s | 17.9s | 18.8s | 18.8s |
| A Short Hike | 5.4s | 11.1s | 0.1s | 5.5s | 9.7s | 9.7s |
| APQuest | 3.1s | 6.4s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.5s | 6.7s | 0.1s | 3.5s | 5.6s | 5.6s |
| Aquaria | 13.9s | 8.9s | 0.1s | 9.0s | 7.6s | 7.6s |
| Baking Adventure | 3.3s | 6.2s | 0.1s | 3.2s | 5.6s | 5.6s |
| Bumper Stickers | 4.8s | 11.9s | 0.1s | 4.7s | 8.6s | 8.6s |
| Castlevania - Circle of the Moon | 5.4s | 8.9s | 0.1s | 5.3s | 5.6s | 5.6s |
| Castlevania 64 | 8.8s | 6.7s | 0.1s | 8.8s | 6.7s | 6.7s |
| Celeste 64 | 3.9s | 6.7s | 0.1s | 3.6s | 7.6s | 6.6s |
| ChecksFinder | 3.2s | 6.6s | 0.1s | 3.2s | 6.6s | 6.6s |
| Choo-Choo Charles | 18.2s | 10.7s | 0.1s | 18.0s | 10.7s | 10.7s |
| Civilization VI | 5.9s | 8.6s | 0.1s | 6.2s | 8.6s | 8.6s |
| Coding Adventure | 3.9s | 8.6s | 0.1s | 3.9s | 8.6s | 8.6s |
| DLCQuest | 3.8s | 5.6s | 0.1s | 3.6s | 5.6s | 5.6s |
| DOOM 1993 | 11.4s | 12.7s | 0.1s | 11.3s | 12.7s | 12.7s |
| DOOM II | 14.0s | 14.7s | 0.1s | 13.8s | 14.7s | 15.7s |
| Dark Souls III | 27.5s | 27.7s | 0.1s | 28.3s | 28.9s | 27.7s |
| Donkey Kong Country 3 | 8.2s | 14.7s | 0.1s | 2.8s | - | - |
| Factorio | 6.1s | 9.7s | 0.1s | 5.5s | 9.7s | 9.7s |
| Faxanadu | 4.8s | 6.6s | 0.1s | 5.3s | 8.6s | 6.6s |
| Final Fantasy Mystic Quest | 13.1s | 10.9s | 0.1s | 12.4s | 10.7s | 10.7s |
| Heretic | 14.9s | 14.7s | 0.1s | 14.8s | 14.7s | 14.7s |
| Hylics 2 | 6.3s | 6.6s | 0.1s | 5.5s | 6.6s | 6.6s |
| Inscryption | 4.5s | 6.6s | 0.1s | 4.4s | 6.6s | 6.6s |
| Landstalker - The Treasures of King Nole | 9.7s | 8.6s | 0.1s | 10.4s | 17.7s | 8.7s |
| Links Awakening DX | 10.6s | 16.7s | 0.1s | 10.2s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 3.7s | 5.6s | 0.1s | 3.6s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 11.3s | 10.7s | 0.1s | 14.9s | 9.7s | 9.7s |
| Math Adventure | 3.2s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| Mega Man 2 | 3.9s | 6.6s | 0.1s | 3.9s | 17.2s | 17.3s |
| MegaMan Battle Network 3 | 8.2s | 8.7s | 0.1s | 8.1s | 8.6s | 8.7s |
| Meritous | 5.2s | 5.6s | 0.1s | 5.2s | 5.6s | 5.6s |
| Metamath | 11.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 4.2s | 7.6s | 0.1s | 3.9s | 9.6s | 7.6s |
| Noita | 5.9s | 5.6s | 0.1s | 5.9s | 5.6s | 5.6s |
| Old School Runescape | 8.1s | 8.7s | 0.1s | 6.9s | 8.7s | 8.7s |
| Overcooked! 2 | 6.0s | 19.7s | 0.1s | 7.1s | 19.7s | 19.7s |
| Paint | 3.1s | 7.7s | 0.1s | 4.6s | 6.7s | 6.7s |
| Risk of Rain 2 | 6.1s | 6.6s | 0.1s | 6.0s | 6.7s | 6.6s |
| Saving Princess | 3.6s | 5.6s | 0.1s | 3.6s | 6.6s | 5.6s |
| Shivers | 6.2s | 9.7s | 0.1s | 2.6s | - | - |
| Sonic Adventure 2 Battle | 8.0s | 13.6s | 0.1s | 7.8s | 16.7s | 13.6s |
| Subnautica | 29.0s | 14.7s | 0.1s | 7.4s | 14.6s | 14.7s |
| Super Mario 64 | 6.0s | 12.6s | 0.1s | 6.3s | 12.6s | 12.7s |
| Super Mario Land 2 | 5.0s | 8.7s | 0.1s | 4.6s | 8.7s | 8.8s |
| Super Mario World | 8.8s | 6.6s | 0.1s | 2.6s | - | - |
| TOEM original | 6.3s | 8.6s | 0.1s | 6.3s | 8.6s | 8.6s |
| TOEM rule builder | 6.5s | 9.7s | 0.1s | 6.6s | 9.7s | 9.7s |
| Terraria | 5.8s | 20.8s | 0.1s | 5.8s | 19.7s | 19.8s |
| The Legend of Zelda | 6.2s | 8.6s | 0.1s | 5.0s | 10.7s | 8.7s |
| The Messenger | 7.6s | 12.9s | 0.1s | 7.3s | 12.8s | 12.8s |
| The Wind Waker | 17.3s | 9.6s | 0.1s | 21.0s | 9.6s | 9.6s |
| Timespinner | 7.3s | 7.6s | 0.1s | 7.3s | 7.6s | 7.6s |
| Undertale | 3.7s | 5.6s | 0.1s | 2.5s | - | - |
| VVVVVV | 3.3s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Wargroove | 3.4s | 6.6s | 0.1s | 3.6s | 6.6s | 6.6s |
| Yoshi's Island | 6.5s | 9.7s | 0.1s | 6.8s | 8.6s | 8.7s |
| shapez | 7.9s | 6.7s | 0.1s | 6.9s | 6.7s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.0s |
| 2 | Dark Souls III | 27.5s |
| 3 | A Link to the Past | 18.3s |
| 4 | Choo-Choo Charles | 18.2s |
| 5 | A Link to the Past WorldGen 2 | 18.1s |
| 6 | The Wind Waker | 17.3s |
| 7 | Heretic | 14.9s |
| 8 | DOOM II | 14.0s |
| 9 | Aquaria | 13.9s |
| 10 | Final Fantasy Mystic Quest | 13.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.7s |
| 2 | A Link to the Past | 21.6s |
| 3 | Terraria | 20.8s |
| 4 | Overcooked! 2 | 19.7s |
| 5 | A Link to the Past WorldGen 2 | 19.4s |
| 6 | A Hat in Time | 18.2s |
| 7 | Links Awakening DX | 16.7s |
| 8 | Donkey Kong Country 3 | 14.7s |
| 9 | DOOM II | 14.7s |
| 10 | Subnautica | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Adventure | 0.1s |
| 8 | Baking Adventure | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.3s |
| 2 | The Wind Waker | 21.0s |
| 3 | Choo-Choo Charles | 18.0s |
| 4 | A Link to the Past WorldGen 2 | 17.9s |
| 5 | A Link to the Past | 17.7s |
| 6 | Mario & Luigi Superstar Saga | 14.9s |
| 7 | Heretic | 14.8s |
| 8 | DOOM II | 13.8s |
| 9 | Final Fantasy Mystic Quest | 12.4s |
| 10 | DOOM 1993 | 11.3s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.9s |
| 2 | Terraria | 19.7s |
| 3 | Overcooked! 2 | 19.7s |
| 4 | A Link to the Past WorldGen 2 | 18.8s |
| 5 | A Link to the Past | 18.7s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Mega Man 2 | 17.2s |
| 8 | Links Awakening DX | 16.7s |
| 9 | Sonic Adventure 2 Battle | 16.7s |
| 10 | DOOM II | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.7s |
| 2 | Terraria | 19.8s |
| 3 | Overcooked! 2 | 19.7s |
| 4 | A Link to the Past WorldGen 2 | 18.8s |
| 5 | A Link to the Past | 17.8s |
| 6 | Mega Man 2 | 17.3s |
| 7 | Links Awakening DX | 16.7s |
| 8 | DOOM II | 15.7s |
| 9 | Heretic | 14.7s |
| 10 | Subnautica | 14.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 491.6s | 615.5s | 5.3s | 438.4s | 568.3s | 668.5s |
| Average | 8.1s | 10.1s | 0.1s | 7.2s | 10.1s | 11.9s |
| Max | 28.9s | 28.8s | 0.2s | 28.3s | 26.7s | 23.3s |
| Min | 2.9s | 5.5s | 0.1s | 2.5s | 5.4s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (28.9s) | Dark Souls III (28.8s) | A Link to the Past (0.2s) | Dark Souls III (28.3s) | Dark Souls III (26.7s) | Terraria (23.3s) |
| Fastest | Paint (2.9s) | Math Adventure (5.5s) | Math Adventure (0.1s) | Donkey Kong Country 3 (2.5s) | Math Adventure (5.4s) | DLCQuest (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.8s | 15.9s | 0.1s | 2.6s | - | - |
| A Link to the Past | 18.4s | 19.4s | 0.2s | 18.3s | 18.7s | 14.3s |
| A Link to the Past WorldGen 2 | 16.6s | 20.8s | 0.1s | 16.4s | 19.6s | 14.1s |
| A Short Hike | 5.2s | 12.3s | 0.1s | 5.3s | 9.6s | 9.6s |
| APQuest | 3.2s | 9.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| Adventure | 3.5s | 8.3s | 0.1s | 3.5s | 5.6s | 14.2s |
| Aquaria | 14.0s | 11.7s | 0.1s | 9.1s | 7.7s | 14.4s |
| Baking Adventure | 3.4s | 10.6s | 0.1s | 3.2s | 5.6s | 14.3s |
| Bumper Stickers | 4.9s | 11.3s | 0.1s | 4.7s | 8.7s | 14.4s |
| Castlevania - Circle of the Moon | 5.6s | 6.1s | 0.1s | 5.4s | 5.6s | 14.2s |
| Castlevania 64 | 8.3s | 6.6s | 0.1s | 8.6s | 6.6s | 6.6s |
| Celeste 64 | 3.4s | 6.6s | 0.1s | 3.5s | 7.5s | 13.9s |
| ChecksFinder | 3.4s | 6.7s | 0.1s | 3.1s | 6.6s | 6.6s |
| Choo-Choo Charles | 18.0s | 9.7s | 0.1s | 18.0s | 9.7s | 9.7s |
| Civilization VI | 6.0s | 8.6s | 0.1s | 6.3s | 8.7s | 17.4s |
| Coding Adventure | 4.0s | 8.6s | 0.1s | 3.9s | 8.6s | 14.2s |
| DLCQuest | 3.9s | 5.6s | 0.1s | 3.7s | 5.7s | 5.6s |
| DOOM 1993 | 11.5s | 12.7s | 0.1s | 11.5s | 12.7s | 14.3s |
| DOOM II | 14.2s | 14.7s | 0.1s | 14.1s | 15.8s | 14.3s |
| Dark Souls III | 27.5s | 28.8s | 0.1s | 28.3s | 26.7s | 17.2s |
| Donkey Kong Country 3 | 7.8s | 13.7s | 0.1s | 2.5s | - | - |
| Factorio | 5.6s | 9.5s | 0.1s | 5.1s | 9.5s | 9.5s |
| Faxanadu | 5.1s | 6.7s | 0.1s | 5.3s | 8.7s | 14.3s |
| Final Fantasy Mystic Quest | 13.0s | 10.7s | 0.1s | 12.1s | 10.7s | 10.7s |
| Heretic | 15.2s | 14.7s | 0.1s | 15.3s | 15.8s | 14.5s |
| Hylics 2 | 6.4s | 6.7s | 0.1s | 5.6s | 6.7s | 6.7s |
| Inscryption | 4.7s | 6.7s | 0.1s | 4.4s | 6.7s | 6.6s |
| Landstalker - The Treasures of King Nole | 10.0s | 8.7s | 0.1s | 10.7s | 17.7s | 14.4s |
| Links Awakening DX | 10.5s | 16.8s | 0.1s | 10.6s | 16.8s | 17.8s |
| Lufia II Ancient Cave | 3.8s | 5.6s | 0.1s | 3.7s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 10.9s | 9.7s | 0.1s | 14.1s | 9.7s | 9.7s |
| Math Adventure | 2.9s | 5.5s | 0.1s | 2.9s | 5.4s | 13.9s |
| Mega Man 2 | 4.0s | 6.6s | 0.1s | 4.0s | 17.3s | 17.3s |
| MegaMan Battle Network 3 | 8.1s | 8.6s | 0.1s | 8.1s | 8.7s | 17.4s |
| Meritous | 5.3s | 5.6s | 0.1s | 5.4s | 5.6s | 14.2s |
| Metamath | 10.5s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| Muse Dash | 4.2s | 7.6s | 0.1s | 4.1s | 9.7s | 14.3s |
| Noita | 6.0s | 5.6s | 0.1s | 6.0s | 5.7s | 5.7s |
| Old School Runescape | 8.2s | 8.6s | 0.1s | 6.9s | 8.7s | 8.7s |
| Overcooked! 2 | 6.3s | 19.8s | 0.1s | 7.3s | 19.7s | 14.3s |
| Paint | 2.9s | 6.6s | 0.1s | 4.5s | 6.6s | 6.6s |
| Risk of Rain 2 | 5.9s | 6.5s | 0.1s | 5.9s | 6.5s | 6.5s |
| Saving Princess | 3.7s | 5.7s | 0.1s | 3.5s | 6.6s | 14.3s |
| Shivers | 5.9s | 9.7s | 0.1s | 2.6s | - | - |
| Sonic Adventure 2 Battle | 8.2s | 13.7s | 0.1s | 8.0s | 16.7s | 14.4s |
| Subnautica | 28.9s | 14.7s | 0.1s | 7.7s | 14.7s | 17.5s |
| Super Mario 64 | 6.0s | 12.6s | 0.1s | 6.5s | 12.7s | 12.7s |
| Super Mario Land 2 | 5.2s | 8.7s | 0.1s | 4.8s | 8.7s | 8.7s |
| Super Mario World | 8.9s | 6.6s | 0.1s | 2.5s | - | - |
| TOEM original | 6.4s | 8.6s | 0.1s | 6.4s | 8.6s | 8.6s |
| TOEM rule builder | 6.5s | 8.6s | 0.1s | 6.4s | 8.6s | 8.6s |
| Terraria | 5.5s | 21.6s | 0.1s | 5.6s | 20.6s | 23.3s |
| The Legend of Zelda | 6.3s | 8.7s | 0.1s | 5.0s | 10.7s | 14.4s |
| The Messenger | 7.4s | 13.8s | 0.1s | 7.2s | 12.8s | 12.9s |
| The Wind Waker | 17.3s | 9.7s | 0.1s | 21.5s | 9.7s | 14.2s |
| Timespinner | 7.4s | 7.7s | 0.1s | 7.5s | 7.7s | 14.4s |
| Undertale | 3.8s | 5.6s | 0.1s | 2.5s | - | - |
| VVVVVV | 3.4s | 5.7s | 0.1s | 3.4s | 5.6s | 5.7s |
| Wargroove | 3.4s | 6.6s | 0.1s | 3.6s | 6.6s | 6.6s |
| Yoshi's Island | 6.7s | 9.7s | 0.1s | 6.9s | 8.7s | 8.6s |
| shapez | 7.6s | 6.6s | 0.1s | 6.6s | 6.6s | 14.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 28.9s |
| 2 | Dark Souls III | 27.5s |
| 3 | A Link to the Past | 18.4s |
| 4 | Choo-Choo Charles | 18.0s |
| 5 | The Wind Waker | 17.3s |
| 6 | A Link to the Past WorldGen 2 | 16.6s |
| 7 | Heretic | 15.2s |
| 8 | DOOM II | 14.2s |
| 9 | Aquaria | 14.0s |
| 10 | Final Fantasy Mystic Quest | 13.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | Terraria | 21.6s |
| 3 | A Link to the Past WorldGen 2 | 20.8s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | A Link to the Past | 19.4s |
| 6 | Links Awakening DX | 16.8s |
| 7 | A Hat in Time | 15.9s |
| 8 | DOOM II | 14.7s |
| 9 | Subnautica | 14.7s |
| 10 | Heretic | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.1s |
| 3 | A Link to the Past WorldGen 2 | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Adventure | 0.1s |
| 8 | Baking Adventure | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.3s |
| 2 | The Wind Waker | 21.5s |
| 3 | A Link to the Past | 18.3s |
| 4 | Choo-Choo Charles | 18.0s |
| 5 | A Link to the Past WorldGen 2 | 16.4s |
| 6 | Heretic | 15.3s |
| 7 | DOOM II | 14.1s |
| 8 | Mario & Luigi Superstar Saga | 14.1s |
| 9 | Final Fantasy Mystic Quest | 12.1s |
| 10 | DOOM 1993 | 11.5s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 26.7s |
| 2 | Terraria | 20.6s |
| 3 | Overcooked! 2 | 19.7s |
| 4 | A Link to the Past WorldGen 2 | 19.6s |
| 5 | A Link to the Past | 18.7s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Mega Man 2 | 17.3s |
| 8 | Links Awakening DX | 16.8s |
| 9 | Sonic Adventure 2 Battle | 16.7s |
| 10 | DOOM II | 15.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.3s |
| 2 | Links Awakening DX | 17.8s |
| 3 | Subnautica | 17.5s |
| 4 | Civilization VI | 17.4s |
| 5 | MegaMan Battle Network 3 | 17.4s |
| 6 | Mega Man 2 | 17.3s |
| 7 | Dark Souls III | 17.2s |
| 8 | shapez | 14.6s |
| 9 | Heretic | 14.5s |
| 10 | Aquaria | 14.4s |
