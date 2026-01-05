# World Generator Test Results

**Generated:** 2026-01-05 06:01:44 UTC

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
| Stage 2: Seed Generation | 60 | 1 | 61 |
| Stage 3: Rules Comparison | 49 | 11 | 60 |
| Stage 4: WorldGen Spoiler Test | 58 | 2 | 60 |
| Stage 5: Cross-Validation | 57 | 3 | 60 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 60 | 1 | 61 |
| Stage 3: Rules Comparison | 0 | 60 | 60 |
| Stage 4: WorldGen Spoiler Test | 58 | 2 | 60 |
| Stage 5: Cross-Validation | 28 | 32 | 60 |

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
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
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
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Total | 506.1s | 625.4s | 5.4s | 467.5s | 641.4s | 621.1s |
| Average | 8.3s | 10.3s | 0.1s | 7.7s | 10.7s | 10.4s |
| Max | 29.5s | 28.8s | 0.2s | 28.8s | 32.6s | 32.9s |
| Min | 2.9s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.5s) | Dark Souls III (28.8s) | A Link to the Past (0.2s) | Dark Souls III (28.8s) | Donkey Kong Country 3 (32.6s) | Donkey Kong Country 3 (32.9s) |
| Fastest | Paint (2.9s) | Math Adventure (5.5s) | Celeste 64 (0.1s) | Mega Man 2 (2.5s) | Math Adventure (5.5s) | Math Adventure (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.8s | 14.2s | 0.2s | 8.6s | 13.7s | 13.7s |
| A Link to the Past | 18.3s | 23.4s | 0.2s | 18.3s | 18.8s | 17.7s |
| A Link to the Past WorldGen 2 | 16.7s | 22.5s | 0.1s | 16.2s | 18.6s | 18.6s |
| A Short Hike | 5.5s | 15.1s | 0.1s | 5.5s | 9.7s | 9.8s |
| APQuest | 3.4s | 7.4s | 0.1s | 3.3s | 5.7s | 5.6s |
| Adventure | 3.6s | 9.6s | 0.1s | 3.7s | 5.6s | 5.6s |
| Aquaria | 14.2s | 13.5s | 0.1s | 9.5s | 8.7s | 8.7s |
| Baking Adventure | 3.4s | 9.3s | 0.1s | 3.6s | 5.7s | 5.8s |
| Bumper Stickers | 5.3s | 9.6s | 0.1s | 5.0s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 5.7s | 6.3s | 0.1s | 5.6s | 5.7s | 5.7s |
| Castlevania 64 | 8.4s | 6.6s | 0.1s | 8.6s | 6.6s | 6.6s |
| Celeste 64 | 3.5s | 6.6s | 0.1s | 3.6s | 7.5s | 6.5s |
| ChecksFinder | 3.2s | 6.6s | 0.1s | 3.2s | 6.6s | 6.7s |
| Choo-Choo Charles | 18.5s | 10.7s | 0.1s | 18.7s | 10.7s | 10.7s |
| Civilization VI | 6.5s | 8.8s | 0.1s | 6.5s | 8.7s | 8.7s |
| Coding Adventure | 4.0s | 8.7s | 0.1s | 3.9s | 8.6s | 8.6s |
| DLCQuest | 4.0s | 5.7s | 0.1s | 3.8s | 5.7s | 5.7s |
| DOOM 1993 | 11.9s | 12.8s | 0.1s | 12.1s | 12.8s | 12.8s |
| DOOM II | 14.6s | 15.8s | 0.1s | 14.6s | 15.8s | 15.8s |
| Dark Souls III | 28.1s | 28.8s | 0.1s | 28.8s | 28.8s | 28.8s |
| Donkey Kong Country 3 | 8.0s | 13.7s | 0.1s | 7.8s | 32.6s | 32.9s |
| Factorio | 5.8s | 9.5s | 0.1s | 5.2s | 9.6s | 9.5s |
| Faxanadu | 4.9s | 6.6s | 0.1s | 5.3s | 8.7s | 6.6s |
| Final Fantasy Mystic Quest | 13.9s | 10.8s | 0.1s | 12.3s | 10.8s | 10.8s |
| Heretic | 16.3s | 14.8s | 0.1s | 15.2s | 15.8s | 14.9s |
| Hylics 2 | 6.4s | 6.6s | 0.1s | 5.6s | 6.7s | 6.6s |
| Inscryption | 4.8s | 6.7s | 0.1s | 4.6s | 6.7s | 6.7s |
| Landstalker - The Treasures of King Nole | 10.6s | 8.8s | 0.1s | 11.3s | 18.9s | 8.8s |
| Links Awakening DX | 11.1s | 18.0s | 0.1s | 11.0s | 17.8s | 17.8s |
| Lufia II Ancient Cave | 4.0s | 5.7s | 0.1s | 3.8s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 10.9s | 9.7s | 0.1s | 14.2s | 9.7s | 9.7s |
| Math Adventure | 2.9s | 5.5s | 0.1s | 3.1s | 5.5s | 5.5s |
| Mega Man 2 | 4.0s | 6.6s | 0.1s | 2.5s | - | - |
| MegaMan Battle Network 3 | 8.6s | 8.7s | 0.1s | 8.3s | 8.7s | 8.7s |
| Meritous | 5.6s | 5.7s | 0.1s | 5.3s | 5.6s | 5.6s |
| Metamath | 10.7s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 4.4s | 7.7s | 0.1s | 4.1s | 9.7s | 7.7s |
| Noita | 6.5s | 5.7s | 0.1s | 6.3s | 5.8s | 5.8s |
| Old School Runescape | 8.6s | 8.8s | 0.1s | 7.4s | 8.8s | 8.8s |
| Overcooked! 2 | 6.3s | 19.8s | 0.1s | 7.4s | 20.8s | 19.8s |
| Paint | 2.9s | 6.7s | 0.1s | 4.5s | 6.6s | 6.7s |
| Risk of Rain 2 | 5.9s | 7.6s | 0.1s | 5.9s | 6.5s | 6.5s |
| Saving Princess | 3.6s | 5.7s | 0.1s | 3.6s | 6.6s | 5.7s |
| Shivers | 6.4s | 9.7s | 0.1s | 6.4s | 9.7s | 14.5s |
| Sonic Adventure 2 Battle | 8.8s | 13.7s | 0.1s | 8.0s | 16.7s | 13.7s |
| Subnautica | 29.5s | 14.7s | 0.1s | 7.5s | 15.7s | 14.7s |
| Super Mario 64 | 6.3s | 12.7s | 0.1s | 6.6s | 12.7s | 12.7s |
| Super Mario Land 2 | 5.4s | 8.8s | 0.1s | 5.1s | 8.9s | 8.8s |
| Super Mario World | 9.6s | 6.7s | 0.1s | 8.1s | 17.5s | 17.5s |
| TOEM original | 6.5s | 9.7s | 0.1s | 6.5s | 9.7s | 9.7s |
| TOEM rule builder | 6.4s | 8.6s | 0.1s | 6.4s | 8.6s | 8.6s |
| Terraria | 5.5s | 20.6s | 0.1s | 5.6s | 20.6s | 20.6s |
| The Legend of Zelda | 6.3s | 8.7s | 0.1s | 5.0s | 10.7s | 8.7s |
| The Messenger | 7.8s | 12.9s | 0.1s | 7.5s | 13.9s | 13.9s |
| The Wind Waker | 18.5s | 9.7s | 0.1s | 21.9s | 9.7s | 9.7s |
| Timespinner | 7.6s | 7.7s | 0.1s | 7.4s | 7.6s | 7.6s |
| Undertale | 4.0s | 5.7s | 0.1s | 3.8s | 5.7s | 5.7s |
| VVVVVV | 3.5s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Wargroove | 3.8s | 6.7s | 0.1s | 3.8s | 6.7s | 6.7s |
| Yoshi's Island | 6.8s | 9.7s | 0.1s | 7.0s | 8.7s | 8.7s |
| shapez | 7.7s | 6.6s | 0.1s | 6.4s | 6.6s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.5s |
| 2 | Dark Souls III | 28.1s |
| 3 | Choo-Choo Charles | 18.5s |
| 4 | The Wind Waker | 18.5s |
| 5 | A Link to the Past | 18.3s |
| 6 | A Link to the Past WorldGen 2 | 16.7s |
| 7 | Heretic | 16.3s |
| 8 | DOOM II | 14.6s |
| 9 | Aquaria | 14.2s |
| 10 | Final Fantasy Mystic Quest | 13.9s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | A Link to the Past | 23.4s |
| 3 | A Link to the Past WorldGen 2 | 22.5s |
| 4 | Terraria | 20.6s |
| 5 | Overcooked! 2 | 19.8s |
| 6 | Links Awakening DX | 18.0s |
| 7 | DOOM II | 15.8s |
| 8 | A Short Hike | 15.1s |
| 9 | Heretic | 14.8s |
| 10 | Subnautica | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.2s |
| 3 | A Link to the Past WorldGen 2 | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | Bumper Stickers | 0.1s |
| 6 | Castlevania - Circle of the Moon | 0.1s |
| 7 | A Short Hike | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Baking Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | The Wind Waker | 21.9s |
| 3 | Choo-Choo Charles | 18.7s |
| 4 | A Link to the Past | 18.3s |
| 5 | A Link to the Past WorldGen 2 | 16.2s |
| 6 | Heretic | 15.2s |
| 7 | DOOM II | 14.6s |
| 8 | Mario & Luigi Superstar Saga | 14.2s |
| 9 | Final Fantasy Mystic Quest | 12.3s |
| 10 | DOOM 1993 | 12.1s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Donkey Kong Country 3 | 32.6s |
| 2 | Dark Souls III | 28.8s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | Terraria | 20.6s |
| 5 | Landstalker - The Treasures of King Nole | 18.9s |
| 6 | A Link to the Past | 18.8s |
| 7 | A Link to the Past WorldGen 2 | 18.6s |
| 8 | Links Awakening DX | 17.8s |
| 9 | Super Mario World | 17.5s |
| 10 | Sonic Adventure 2 Battle | 16.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Donkey Kong Country 3 | 32.9s |
| 2 | Dark Souls III | 28.8s |
| 3 | Terraria | 20.6s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | A Link to the Past WorldGen 2 | 18.6s |
| 6 | Links Awakening DX | 17.8s |
| 7 | A Link to the Past | 17.7s |
| 8 | Super Mario World | 17.5s |
| 9 | DOOM II | 15.8s |
| 10 | Heretic | 14.9s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 502.4s | 621.4s | 5.4s | 469.2s | 633.8s | 721.6s |
| Average | 8.2s | 10.2s | 0.1s | 7.7s | 10.6s | 12.0s |
| Max | 29.1s | 27.8s | 0.2s | 28.2s | 32.6s | 23.6s |
| Min | 2.9s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.1s) | Dark Souls III (27.8s) | A Link to the Past (0.2s) | Dark Souls III (28.2s) | Donkey Kong Country 3 (32.6s) | Terraria (23.6s) |
| Fastest | Paint (2.9s) | Lufia II Ancient Cave (5.6s) | Wargroove (0.1s) | Mega Man 2 (2.6s) | VVVVVV (5.6s) | Lufia II Ancient Cave (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.7s | 17.8s | 0.1s | 8.7s | 13.7s | 13.7s |
| A Link to the Past | 18.7s | 20.4s | 0.2s | 18.8s | 19.8s | 14.4s |
| A Link to the Past WorldGen 2 | 17.6s | 23.1s | 0.2s | 17.9s | 19.8s | 14.4s |
| A Short Hike | 5.9s | 12.0s | 0.1s | 5.7s | 9.7s | 9.8s |
| APQuest | 3.2s | 8.9s | 0.1s | 3.4s | 5.7s | 5.7s |
| Adventure | 3.8s | 8.5s | 0.1s | 3.5s | 5.6s | 14.2s |
| Aquaria | 14.1s | 9.9s | 0.1s | 9.2s | 7.7s | 14.7s |
| Baking Adventure | 3.3s | 8.4s | 0.1s | 3.3s | 5.6s | 14.3s |
| Bumper Stickers | 5.2s | 12.5s | 0.1s | 4.9s | 8.7s | 14.3s |
| Castlevania - Circle of the Moon | 5.4s | 6.2s | 0.1s | 5.4s | 5.6s | 14.1s |
| Castlevania 64 | 8.4s | 6.6s | 0.1s | 8.5s | 6.6s | 6.6s |
| Celeste 64 | 3.5s | 6.8s | 0.1s | 3.7s | 7.6s | 14.2s |
| ChecksFinder | 3.3s | 6.8s | 0.1s | 3.3s | 6.6s | 6.7s |
| Choo-Choo Charles | 19.3s | 10.9s | 0.1s | 19.4s | 10.8s | 10.8s |
| Civilization VI | 6.0s | 8.7s | 0.1s | 6.4s | 8.7s | 17.6s |
| Coding Adventure | 4.1s | 8.7s | 0.1s | 4.1s | 8.7s | 14.2s |
| DLCQuest | 3.9s | 5.6s | 0.1s | 3.7s | 5.6s | 5.6s |
| DOOM 1993 | 11.4s | 12.7s | 0.1s | 11.3s | 12.7s | 14.2s |
| DOOM II | 14.8s | 15.7s | 0.1s | 14.3s | 15.8s | 14.7s |
| Dark Souls III | 27.6s | 27.8s | 0.1s | 28.2s | 26.7s | 17.0s |
| Donkey Kong Country 3 | 7.9s | 13.6s | 0.1s | 8.0s | 32.6s | 14.9s |
| Factorio | 5.9s | 9.7s | 0.1s | 5.3s | 9.7s | 9.7s |
| Faxanadu | 4.9s | 6.7s | 0.1s | 5.5s | 8.6s | 14.3s |
| Final Fantasy Mystic Quest | 13.8s | 10.8s | 0.1s | 12.9s | 10.8s | 10.8s |
| Heretic | 15.3s | 14.8s | 0.1s | 16.2s | 15.9s | 14.6s |
| Hylics 2 | 6.5s | 6.6s | 0.1s | 5.7s | 6.7s | 6.7s |
| Inscryption | 4.5s | 6.7s | 0.1s | 4.4s | 6.7s | 6.6s |
| Landstalker - The Treasures of King Nole | 9.8s | 8.6s | 0.1s | 10.5s | 17.7s | 14.3s |
| Links Awakening DX | 11.2s | 17.9s | 0.1s | 10.9s | 17.8s | 16.8s |
| Lufia II Ancient Cave | 3.8s | 5.6s | 0.1s | 3.6s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 10.8s | 9.7s | 0.1s | 14.1s | 9.7s | 9.7s |
| Math Adventure | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 14.2s |
| Mega Man 2 | 4.1s | 6.7s | 0.1s | 2.6s | - | - |
| MegaMan Battle Network 3 | 8.7s | 8.8s | 0.1s | 8.6s | 8.7s | 17.6s |
| Meritous | 5.3s | 5.7s | 0.1s | 5.6s | 5.7s | 14.3s |
| Metamath | 11.0s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Muse Dash | 4.2s | 7.7s | 0.1s | 4.1s | 9.7s | 14.3s |
| Noita | 5.9s | 5.6s | 0.1s | 6.0s | 5.6s | 5.7s |
| Old School Runescape | 8.5s | 8.8s | 0.1s | 7.5s | 8.8s | 8.7s |
| Overcooked! 2 | 6.1s | 19.7s | 0.1s | 7.2s | 19.7s | 14.4s |
| Paint | 2.9s | 7.7s | 0.1s | 4.5s | 6.6s | 6.6s |
| Risk of Rain 2 | 6.1s | 6.6s | 0.1s | 6.0s | 6.6s | 6.6s |
| Saving Princess | 3.7s | 5.7s | 0.1s | 3.7s | 6.7s | 14.3s |
| Shivers | 6.6s | 9.7s | 0.1s | 6.5s | 9.7s | 14.5s |
| Sonic Adventure 2 Battle | 8.5s | 13.7s | 0.1s | 8.3s | 16.7s | 14.5s |
| Subnautica | 29.1s | 14.7s | 0.1s | 7.6s | 14.7s | 17.9s |
| Super Mario 64 | 6.1s | 12.7s | 0.1s | 6.4s | 12.7s | 12.7s |
| Super Mario Land 2 | 5.1s | 8.7s | 0.1s | 4.6s | 8.7s | 8.7s |
| Super Mario World | 9.3s | 6.7s | 0.1s | 8.2s | 17.5s | 17.5s |
| TOEM original | 6.3s | 8.6s | 0.1s | 6.3s | 8.6s | 8.6s |
| TOEM rule builder | 6.3s | 8.6s | 0.1s | 6.3s | 8.6s | 8.6s |
| Terraria | 5.7s | 20.7s | 0.1s | 5.8s | 19.8s | 23.6s |
| The Legend of Zelda | 6.3s | 8.7s | 0.1s | 5.2s | 10.7s | 14.3s |
| The Messenger | 8.1s | 13.9s | 0.1s | 7.8s | 13.9s | 13.9s |
| The Wind Waker | 18.1s | 9.8s | 0.1s | 21.8s | 9.7s | 14.2s |
| Timespinner | 7.4s | 7.8s | 0.1s | 7.3s | 6.7s | 14.4s |
| Undertale | 3.9s | 5.6s | 0.1s | 3.7s | 5.6s | 5.7s |
| VVVVVV | 3.3s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Wargroove | 3.8s | 6.7s | 0.1s | 3.9s | 6.7s | 6.7s |
| Yoshi's Island | 6.6s | 9.6s | 0.1s | 7.0s | 8.7s | 8.6s |
| shapez | 7.7s | 6.6s | 0.1s | 6.5s | 6.6s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.1s |
| 2 | Dark Souls III | 27.6s |
| 3 | Choo-Choo Charles | 19.3s |
| 4 | A Link to the Past | 18.7s |
| 5 | The Wind Waker | 18.1s |
| 6 | A Link to the Past WorldGen 2 | 17.6s |
| 7 | Heretic | 15.3s |
| 8 | DOOM II | 14.8s |
| 9 | Aquaria | 14.1s |
| 10 | Final Fantasy Mystic Quest | 13.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.8s |
| 2 | A Link to the Past WorldGen 2 | 23.1s |
| 3 | Terraria | 20.7s |
| 4 | A Link to the Past | 20.4s |
| 5 | Overcooked! 2 | 19.7s |
| 6 | Links Awakening DX | 17.9s |
| 7 | A Hat in Time | 17.8s |
| 8 | DOOM II | 15.7s |
| 9 | Heretic | 14.8s |
| 10 | Subnautica | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | Aquaria | 0.1s |
| 6 | Bumper Stickers | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.2s |
| 2 | The Wind Waker | 21.8s |
| 3 | Choo-Choo Charles | 19.4s |
| 4 | A Link to the Past | 18.8s |
| 5 | A Link to the Past WorldGen 2 | 17.9s |
| 6 | Heretic | 16.2s |
| 7 | DOOM II | 14.3s |
| 8 | Mario & Luigi Superstar Saga | 14.1s |
| 9 | Final Fantasy Mystic Quest | 12.9s |
| 10 | DOOM 1993 | 11.3s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Donkey Kong Country 3 | 32.6s |
| 2 | Dark Souls III | 26.7s |
| 3 | A Link to the Past WorldGen 2 | 19.8s |
| 4 | A Link to the Past | 19.8s |
| 5 | Terraria | 19.8s |
| 6 | Overcooked! 2 | 19.7s |
| 7 | Links Awakening DX | 17.8s |
| 8 | Landstalker - The Treasures of King Nole | 17.7s |
| 9 | Super Mario World | 17.5s |
| 10 | Sonic Adventure 2 Battle | 16.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.6s |
| 2 | Subnautica | 17.9s |
| 3 | Civilization VI | 17.6s |
| 4 | MegaMan Battle Network 3 | 17.6s |
| 5 | Super Mario World | 17.5s |
| 6 | Dark Souls III | 17.0s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Donkey Kong Country 3 | 14.9s |
| 9 | Aquaria | 14.7s |
| 10 | DOOM II | 14.7s |
