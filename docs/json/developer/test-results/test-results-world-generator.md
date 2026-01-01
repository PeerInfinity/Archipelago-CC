# World Generator Test Results

**Generated:** 2026-01-01 03:16:04 UTC

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
| Original Spoiler Test | 60 | 1 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 61 | 0 | 61 |
| Stage 3: Rules Comparison | 44 | 17 | 61 |
| Stage 4: WorldGen Spoiler Test | 60 | 1 | 61 |
| Stage 5: Cross-Validation | 59 | 2 | 61 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Factorio | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TUNIC | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Original Spoiler Test | 60 | 1 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 61 | 0 | 61 |
| Stage 3: Rules Comparison | 0 | 61 | 61 |
| Stage 4: WorldGen Spoiler Test | 60 | 1 | 61 |
| Stage 5: Cross-Validation | 29 | 32 | 61 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Factorio | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TUNIC | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Total | 489.1s | 607.0s | 5.2s | 903.8s | 608.2s | 590.0s |
| Average | 8.0s | 10.0s | 0.1s | 14.8s | 10.0s | 9.7s |
| Max | 29.8s | 28.8s | 0.2s | 471.1s | 28.8s | 28.8s |
| Min | 2.8s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.8s) | Dark Souls III (28.8s) | A Link to the Past (0.2s) | TUNIC (471.1s) | Dark Souls III (28.8s) | Dark Souls III (28.8s) |
| Fastest | Paint (2.8s) | Saving Princess (5.6s) | Wargroove (0.1s) | APQuest (3.0s) | VVVVVV (5.6s) | VVVVVV (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.7s | 17.6s | 0.1s | 8.6s | 13.7s | 13.7s |
| A Link to the Past | 18.6s | 20.1s | 0.2s | 11.2s | 17.8s | 16.8s |
| A Short Hike | 5.2s | 10.7s | 0.1s | 5.4s | 9.6s | 9.7s |
| APQuest | 3.2s | 6.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.5s | 6.8s | 0.1s | 3.6s | 5.7s | 5.7s |
| Aquaria | 13.8s | 10.2s | 0.1s | 9.2s | 7.6s | 7.6s |
| Baking Adventure | 3.3s | 8.9s | 0.1s | 3.3s | 5.7s | 5.6s |
| Bumper Stickers | 4.9s | 10.2s | 0.1s | 4.7s | 8.6s | 8.6s |
| Castlevania - Circle of the Moon | 5.6s | 8.8s | 0.1s | 5.4s | 5.6s | 5.6s |
| Castlevania 64 | 8.2s | 7.1s | 0.1s | 8.0s | 6.6s | 6.6s |
| Celeste 64 | 3.5s | 6.7s | 0.1s | 3.7s | 7.6s | 6.7s |
| ChecksFinder | 3.3s | 6.8s | 0.1s | 3.3s | 6.7s | 6.7s |
| Choo-Choo Charles | 18.2s | 9.7s | 0.1s | 18.1s | 9.7s | 9.6s |
| Civilization VI | 6.0s | 8.6s | 0.1s | 6.3s | 8.7s | 8.7s |
| Coding Adventure | 4.1s | 8.7s | 0.1s | 4.2s | 8.7s | 8.7s |
| DLCQuest | 3.9s | 5.6s | 0.1s | 3.7s | 5.6s | 5.6s |
| DOOM 1993 | 11.4s | 12.7s | 0.1s | 11.4s | 12.7s | 12.7s |
| DOOM II | 14.0s | 14.7s | 0.1s | 13.8s | 15.7s | 14.7s |
| Dark Souls III | 28.1s | 28.8s | 0.1s | 28.7s | 28.8s | 28.8s |
| Donkey Kong Country 3 | 7.5s | 13.6s | 0.1s | 7.4s | 13.6s | 13.6s |
| Factorio | 5.8s | 14.3s | 0.1s | 5.4s | 9.7s | 14.5s |
| Faxanadu | 5.1s | 6.6s | 0.1s | 5.3s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 13.0s | 10.8s | 0.1s | 11.8s | 10.7s | 10.7s |
| Heretic | 15.3s | 14.7s | 0.1s | 15.3s | 14.7s | 14.7s |
| Hylics 2 | 6.4s | 6.6s | 0.1s | 5.8s | 6.7s | 6.7s |
| Inscryption | 4.5s | 6.7s | 0.1s | 4.4s | 6.7s | 6.6s |
| Landstalker - The Treasures of King Nole | 9.9s | 8.7s | 0.1s | 10.5s | 17.7s | 8.6s |
| Links Awakening DX | 10.4s | 16.7s | 0.1s | 10.2s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 3.9s | 5.6s | 0.1s | 3.8s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 10.6s | 9.6s | 0.1s | 12.5s | 9.6s | 9.6s |
| Math Adventure | 3.0s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| Mega Man 2 | 4.1s | 6.6s | 0.1s | 4.0s | 6.6s | 6.7s |
| MegaMan Battle Network 3 | 8.1s | 8.6s | 0.1s | 8.0s | 8.6s | 8.7s |
| Meritous | 5.5s | 5.6s | 0.1s | 5.3s | 5.6s | 5.6s |
| Metamath | 10.3s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Muse Dash | 4.4s | 7.8s | 0.1s | 4.0s | 9.7s | 7.6s |
| Noita | 6.1s | 5.6s | 0.1s | 6.0s | 5.6s | 5.6s |
| Old School Runescape | 7.9s | 8.6s | 0.1s | 6.9s | 8.7s | 8.7s |
| Overcooked! 2 | 6.2s | 19.8s | 0.1s | 7.3s | 19.8s | 19.8s |
| Paint | 2.8s | 7.7s | 0.1s | 4.2s | 6.6s | 6.6s |
| Risk of Rain 2 | 6.0s | 6.7s | 0.1s | 6.0s | 6.7s | 6.7s |
| Saving Princess | 3.6s | 5.6s | 0.1s | 3.6s | 6.7s | 5.6s |
| Shivers | 6.0s | 9.7s | 0.1s | 6.0s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 8.1s | 13.7s | 0.1s | 7.7s | 16.7s | 13.6s |
| Subnautica | 29.8s | 14.7s | 0.1s | 7.6s | 14.8s | 14.7s |
| Super Mario 64 | 6.2s | 12.7s | 0.1s | 6.4s | 12.7s | 12.7s |
| Super Mario Land 2 | 5.1s | 8.8s | 0.1s | 4.7s | 7.7s | 7.7s |
| Super Mario World | 8.7s | 6.7s | 0.1s | 7.7s | 6.6s | 6.7s |
| TOEM original | 6.4s | 8.7s | 0.1s | 6.5s | 8.7s | 8.7s |
| TOEM rule builder | 6.2s | 8.6s | 0.1s | 6.1s | 8.6s | 8.6s |
| TUNIC | 14.3s | 12.7s | 0.1s | 471.1s | 22.2s | 22.3s |
| Terraria | 5.8s | 20.8s | 0.1s | 5.9s | 20.8s | 19.8s |
| The Legend of Zelda | 6.2s | 8.6s | 0.1s | 5.0s | 10.7s | 8.6s |
| The Messenger | 7.5s | 13.8s | 0.1s | 7.2s | 12.8s | 12.9s |
| The Wind Waker | 16.7s | 9.7s | 0.1s | 19.9s | 9.7s | 9.7s |
| Timespinner | 7.5s | 6.7s | 0.1s | 6.9s | 6.6s | 6.6s |
| Undertale | 3.9s | 5.6s | 0.1s | 3.6s | 5.6s | 5.6s |
| VVVVVV | 3.3s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Wargroove | 3.5s | 6.6s | 0.1s | 3.6s | 6.7s | 6.7s |
| Yoshi's Island | 6.3s | 9.6s | 0.1s | 8.8s | 8.6s | 8.6s |
| shapez | 7.7s | 6.7s | 0.1s | 6.2s | 6.7s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.8s |
| 2 | Dark Souls III | 28.1s |
| 3 | A Link to the Past | 18.6s |
| 4 | Choo-Choo Charles | 18.2s |
| 5 | The Wind Waker | 16.7s |
| 6 | Heretic | 15.3s |
| 7 | TUNIC | 14.3s |
| 8 | DOOM II | 14.0s |
| 9 | Aquaria | 13.8s |
| 10 | Final Fantasy Mystic Quest | 13.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | Terraria | 20.8s |
| 3 | A Link to the Past | 20.1s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | A Hat in Time | 17.6s |
| 6 | Links Awakening DX | 16.7s |
| 7 | DOOM II | 14.7s |
| 8 | Heretic | 14.7s |
| 9 | Subnautica | 14.7s |
| 10 | Factorio | 14.3s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.1s |
| 3 | Aquaria | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | APQuest | 0.1s |
| 6 | Adventure | 0.1s |
| 7 | Baking Adventure | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | TUNIC | 471.1s |
| 2 | Dark Souls III | 28.7s |
| 3 | The Wind Waker | 19.9s |
| 4 | Choo-Choo Charles | 18.1s |
| 5 | Heretic | 15.3s |
| 6 | DOOM II | 13.8s |
| 7 | Mario & Luigi Superstar Saga | 12.5s |
| 8 | Final Fantasy Mystic Quest | 11.8s |
| 9 | DOOM 1993 | 11.4s |
| 10 | A Link to the Past | 11.2s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | TUNIC | 22.2s |
| 3 | Terraria | 20.8s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | A Link to the Past | 17.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | Links Awakening DX | 16.7s |
| 9 | DOOM II | 15.7s |
| 10 | Subnautica | 14.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | TUNIC | 22.3s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | Terraria | 19.8s |
| 5 | A Link to the Past | 16.8s |
| 6 | Links Awakening DX | 16.7s |
| 7 | DOOM II | 14.7s |
| 8 | Subnautica | 14.7s |
| 9 | Heretic | 14.7s |
| 10 | Factorio | 14.5s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 479.9s | 607.8s | 5.1s | 811.3s | 608.4s | 723.9s |
| Average | 7.9s | 10.0s | 0.1s | 13.3s | 10.0s | 11.9s |
| Max | 27.6s | 27.8s | 0.1s | 383.4s | 26.8s | 23.6s |
| Min | 2.8s | 5.4s | 0.1s | 2.9s | 5.4s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Dark Souls III (27.6s) | Dark Souls III (27.8s) | A Link to the Past (0.1s) | TUNIC (383.4s) | Dark Souls III (26.8s) | Terraria (23.6s) |
| Fastest | Math Adventure (2.8s) | Math Adventure (5.4s) | Math Adventure (0.1s) | Math Adventure (2.9s) | Math Adventure (5.4s) | Metamath (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 9.9s | 14.9s | 0.1s | 8.0s | 13.5s | 13.5s |
| A Link to the Past | 18.0s | 19.0s | 0.1s | 11.2s | 18.8s | 14.3s |
| A Short Hike | 5.5s | 11.0s | 0.1s | 5.4s | 9.7s | 9.6s |
| APQuest | 3.2s | 8.1s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.5s | 6.8s | 0.1s | 3.5s | 5.5s | 14.0s |
| Aquaria | 14.0s | 8.2s | 0.1s | 9.1s | 7.6s | 14.4s |
| Baking Adventure | 3.3s | 6.8s | 0.1s | 3.2s | 5.6s | 14.2s |
| Bumper Stickers | 4.9s | 13.6s | 0.1s | 4.7s | 8.7s | 14.2s |
| Castlevania - Circle of the Moon | 5.4s | 8.8s | 0.1s | 5.2s | 5.6s | 14.2s |
| Castlevania 64 | 8.7s | 9.4s | 0.1s | 8.5s | 6.7s | 6.7s |
| Celeste 64 | 3.2s | 6.6s | 0.1s | 3.3s | 7.4s | 13.8s |
| ChecksFinder | 3.1s | 6.7s | 0.1s | 3.2s | 6.6s | 6.7s |
| Choo-Choo Charles | 18.2s | 9.6s | 0.1s | 17.8s | 9.6s | 9.7s |
| Civilization VI | 6.0s | 8.7s | 0.1s | 6.3s | 8.7s | 17.3s |
| Coding Adventure | 3.9s | 8.5s | 0.1s | 4.0s | 8.6s | 14.0s |
| DLCQuest | 3.8s | 5.6s | 0.1s | 3.7s | 5.7s | 5.6s |
| DOOM 1993 | 11.6s | 12.7s | 0.1s | 11.3s | 12.7s | 14.4s |
| DOOM II | 14.1s | 15.8s | 0.1s | 13.8s | 15.7s | 14.3s |
| Dark Souls III | 27.6s | 27.8s | 0.1s | 28.0s | 26.8s | 17.1s |
| Donkey Kong Country 3 | 8.0s | 14.7s | 0.1s | 7.8s | 14.7s | 15.1s |
| Factorio | 5.5s | 13.8s | 0.1s | 4.9s | 9.5s | 13.8s |
| Faxanadu | 4.8s | 6.7s | 0.1s | 5.3s | 8.7s | 14.3s |
| Final Fantasy Mystic Quest | 12.8s | 10.7s | 0.1s | 11.8s | 10.7s | 10.7s |
| Heretic | 15.2s | 14.7s | 0.1s | 14.9s | 14.8s | 14.4s |
| Hylics 2 | 6.1s | 6.5s | 0.1s | 5.5s | 6.6s | 6.6s |
| Inscryption | 4.6s | 6.6s | 0.1s | 4.4s | 6.6s | 6.6s |
| Landstalker - The Treasures of King Nole | 9.8s | 8.7s | 0.1s | 10.5s | 17.8s | 14.3s |
| Links Awakening DX | 10.4s | 16.9s | 0.1s | 10.3s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.7s | 5.6s | 0.1s | 3.6s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 11.0s | 10.7s | 0.1s | 13.1s | 9.7s | 9.7s |
| Math Adventure | 2.8s | 5.4s | 0.1s | 2.9s | 5.4s | 13.8s |
| Mega Man 2 | 4.0s | 6.7s | 0.1s | 3.9s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 8.1s | 8.6s | 0.1s | 8.0s | 8.7s | 17.5s |
| Meritous | 5.3s | 5.6s | 0.1s | 5.4s | 5.7s | 14.3s |
| Metamath | 9.7s | 5.5s | 0.1s | 3.0s | 5.5s | 5.5s |
| Muse Dash | 4.3s | 7.6s | 0.1s | 3.9s | 9.7s | 14.2s |
| Noita | 6.0s | 5.6s | 0.1s | 5.9s | 5.6s | 5.7s |
| Old School Runescape | 7.9s | 8.7s | 0.1s | 6.8s | 8.6s | 8.7s |
| Overcooked! 2 | 6.0s | 19.8s | 0.1s | 7.2s | 19.7s | 14.3s |
| Paint | 3.0s | 7.7s | 0.1s | 4.4s | 6.6s | 6.7s |
| Risk of Rain 2 | 5.7s | 6.5s | 0.1s | 5.6s | 6.5s | 6.5s |
| Saving Princess | 3.5s | 5.7s | 0.1s | 3.6s | 6.7s | 14.3s |
| Shivers | 5.9s | 9.6s | 0.1s | 6.0s | 9.7s | 14.2s |
| Sonic Adventure 2 Battle | 8.2s | 13.7s | 0.1s | 8.1s | 16.8s | 14.4s |
| Subnautica | 27.2s | 14.6s | 0.1s | 7.3s | 14.6s | 17.5s |
| Super Mario 64 | 6.1s | 12.6s | 0.1s | 6.4s | 12.6s | 12.7s |
| Super Mario Land 2 | 5.0s | 8.7s | 0.1s | 4.8s | 7.7s | 7.7s |
| Super Mario World | 8.7s | 6.6s | 0.1s | 7.7s | 6.6s | 6.6s |
| TOEM original | 6.3s | 8.6s | 0.1s | 6.4s | 8.6s | 8.6s |
| TOEM rule builder | 6.5s | 9.7s | 0.1s | 6.4s | 9.7s | 9.7s |
| TUNIC | 13.3s | 12.5s | 0.1s | 383.4s | 22.1s | 22.2s |
| Terraria | 5.7s | 20.8s | 0.1s | 5.9s | 20.8s | 23.6s |
| The Legend of Zelda | 6.4s | 8.7s | 0.1s | 5.0s | 10.7s | 14.4s |
| The Messenger | 7.5s | 13.8s | 0.1s | 7.3s | 13.8s | 13.8s |
| The Wind Waker | 15.0s | 9.7s | 0.1s | 18.2s | 9.6s | 14.1s |
| Timespinner | 7.3s | 6.6s | 0.1s | 7.0s | 6.6s | 14.3s |
| Undertale | 3.8s | 5.6s | 0.1s | 3.7s | 5.6s | 5.7s |
| VVVVVV | 3.3s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Wargroove | 3.4s | 6.6s | 0.1s | 3.5s | 6.6s | 6.6s |
| Yoshi's Island | 6.9s | 9.7s | 0.1s | 9.3s | 8.7s | 8.7s |
| shapez | 7.0s | 6.5s | 0.1s | 5.8s | 6.5s | 13.9s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.6s |
| 2 | Subnautica | 27.2s |
| 3 | Choo-Choo Charles | 18.2s |
| 4 | A Link to the Past | 18.0s |
| 5 | Heretic | 15.2s |
| 6 | The Wind Waker | 15.0s |
| 7 | DOOM II | 14.1s |
| 8 | Aquaria | 14.0s |
| 9 | TUNIC | 13.3s |
| 10 | Final Fantasy Mystic Quest | 12.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.8s |
| 2 | Terraria | 20.8s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | A Link to the Past | 19.0s |
| 5 | Links Awakening DX | 16.9s |
| 6 | DOOM II | 15.8s |
| 7 | A Hat in Time | 14.9s |
| 8 | Heretic | 14.7s |
| 9 | Donkey Kong Country 3 | 14.7s |
| 10 | Subnautica | 14.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | Aquaria | 0.1s |
| 3 | Castlevania 64 | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | APQuest | 0.1s |
| 6 | Baking Adventure | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | A Hat in Time | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | TUNIC | 383.4s |
| 2 | Dark Souls III | 28.0s |
| 3 | The Wind Waker | 18.2s |
| 4 | Choo-Choo Charles | 17.8s |
| 5 | Heretic | 14.9s |
| 6 | DOOM II | 13.8s |
| 7 | Mario & Luigi Superstar Saga | 13.1s |
| 8 | Final Fantasy Mystic Quest | 11.8s |
| 9 | DOOM 1993 | 11.3s |
| 10 | A Link to the Past | 11.2s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 26.8s |
| 2 | TUNIC | 22.1s |
| 3 | Terraria | 20.8s |
| 4 | Overcooked! 2 | 19.7s |
| 5 | A Link to the Past | 18.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.8s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Sonic Adventure 2 Battle | 16.8s |
| 9 | DOOM II | 15.7s |
| 10 | Heretic | 14.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.6s |
| 2 | TUNIC | 22.2s |
| 3 | MegaMan Battle Network 3 | 17.5s |
| 4 | Subnautica | 17.5s |
| 5 | Civilization VI | 17.3s |
| 6 | Dark Souls III | 17.1s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Donkey Kong Country 3 | 15.1s |
| 9 | DOOM 1993 | 14.4s |
| 10 | Sonic Adventure 2 Battle | 14.4s |
