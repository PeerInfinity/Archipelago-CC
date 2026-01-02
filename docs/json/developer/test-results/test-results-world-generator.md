# World Generator Test Results

**Generated:** 2026-01-02 02:49:17 UTC

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
| Original Spoiler Test | 58 | 3 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 28 | 33 | 61 |
| Stage 3: Rules Comparison | 9 | 19 | 28 |
| Stage 4: WorldGen Spoiler Test | 28 | 0 | 28 |
| Stage 5: Cross-Validation | 27 | 1 | 28 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Short Hike | ✅ | ✅ | ✅ | ❌ | - | - | - |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Adventure | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Bumper Stickers | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ❌ | - | - | - |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Factorio | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Heretic | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Meritous | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Saving Princess | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Shivers | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Timespinner | ✅ | ❌ | ✅ | ❌ | - | - | - |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Wargroove | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - | - |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 61

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 61 | 0 | 61 |
| Original Spoiler Test | 58 | 3 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 50 | 11 | 61 |
| Stage 3: Rules Comparison | 0 | 50 | 50 |
| Stage 4: WorldGen Spoiler Test | 50 | 0 | 50 |
| Stage 5: Cross-Validation | 22 | 28 | 50 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | Error |
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
| DLCQuest | ✅ | ✅ | ✅ | ❌ | - | - | - |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Factorio | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Timespinner | ✅ | ❌ | ✅ | ❌ | - | - | - |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - | - |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 496.5s | 626.8s | 5.4s | 337.9s | 344.5s | 335.2s |
| Average | 8.1s | 10.3s | 0.1s | 5.5s | 12.3s | 12.0s |
| Max | 29.1s | 27.7s | 0.2s | 28.4s | 27.8s | 28.8s |
| Min | 3.0s | 5.6s | 0.1s | 0.4s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.1s) | Dark Souls III (27.7s) | A Link to the Past (0.2s) | Dark Souls III (28.4s) | Dark Souls III (27.8s) | Dark Souls III (28.8s) |
| Fastest | Paint (3.0s) | Math Adventure (5.6s) | Wargroove (0.1s) | The Messenger (0.4s) | Math Adventure (5.6s) | Math Adventure (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.9s | 16.4s | 0.1s | 8.7s | 13.7s | 13.7s |
| A Link to the Past | 18.8s | 22.3s | 0.2s | 18.4s | 18.8s | 23.7s |
| A Link to the Past WorldGen 2 | 17.8s | 21.4s | 0.2s | 17.4s | 18.7s | 18.8s |
| A Short Hike | 5.4s | 10.8s | 0.1s | 2.6s | - | - |
| APQuest | 3.2s | 8.5s | 0.1s | 2.6s | - | - |
| Adventure | 3.9s | 8.8s | 0.1s | 2.8s | - | - |
| Aquaria | 13.7s | 9.3s | 0.1s | 9.7s | 8.8s | 8.7s |
| Baking Adventure | 3.4s | 9.0s | 0.1s | 2.5s | - | - |
| Bumper Stickers | 4.9s | 11.0s | 0.1s | 2.5s | - | - |
| Castlevania - Circle of the Moon | 5.5s | 6.1s | 0.1s | 2.6s | - | - |
| Castlevania 64 | 8.4s | 6.6s | 0.1s | 2.5s | - | - |
| Celeste 64 | 3.6s | 6.7s | 0.1s | 3.7s | 7.6s | 6.6s |
| ChecksFinder | 3.3s | 6.6s | 0.1s | 2.6s | - | - |
| Choo-Choo Charles | 18.6s | 9.8s | 0.1s | 2.6s | - | - |
| Civilization VI | 6.2s | 8.7s | 0.1s | 2.6s | - | - |
| Coding Adventure | 4.1s | 8.7s | 0.1s | 4.1s | 8.7s | 8.7s |
| DLCQuest | 3.8s | 5.7s | 0.1s | 2.6s | - | - |
| DOOM 1993 | 11.5s | 12.7s | 0.1s | 11.4s | 12.7s | 12.7s |
| DOOM II | 14.0s | 14.7s | 0.1s | 13.8s | 15.7s | 15.7s |
| Dark Souls III | 27.5s | 27.7s | 0.1s | 28.4s | 27.8s | 28.8s |
| Donkey Kong Country 3 | 7.8s | 14.7s | 0.1s | 7.7s | 13.7s | 13.7s |
| Factorio | 5.9s | 14.3s | 0.1s | 5.4s | 9.7s | 9.7s |
| Faxanadu | 5.0s | 6.7s | 0.1s | 2.6s | - | - |
| Final Fantasy Mystic Quest | 13.2s | 10.8s | 0.1s | 2.6s | - | - |
| Heretic | 15.5s | 14.8s | 0.1s | 15.3s | 14.8s | 14.7s |
| Hylics 2 | 6.4s | 6.6s | 0.1s | 5.7s | 6.7s | 6.7s |
| Inscryption | 4.5s | 6.7s | 0.1s | 2.6s | - | - |
| Landstalker - The Treasures of King Nole | 9.9s | 8.7s | 0.1s | 10.4s | 17.7s | 8.7s |
| Links Awakening DX | 10.5s | 16.8s | 0.1s | 10.3s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.8s | 5.6s | 0.1s | 2.6s | - | - |
| Mario & Luigi Superstar Saga | 10.9s | 9.7s | 0.1s | 13.1s | 9.7s | 9.7s |
| Math Adventure | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Mega Man 2 | 4.1s | 6.6s | 0.1s | 4.0s | 6.6s | 6.7s |
| MegaMan Battle Network 3 | 8.3s | 8.7s | 0.1s | 2.6s | - | - |
| Meritous | 5.4s | 5.7s | 0.1s | 2.6s | - | - |
| Metamath | 10.7s | 5.6s | 0.1s | 2.7s | - | - |
| Muse Dash | 4.2s | 7.7s | 0.1s | 4.2s | 9.8s | 7.7s |
| Noita | 6.0s | 5.7s | 0.1s | 6.1s | 5.6s | 5.7s |
| Old School Runescape | 8.2s | 8.7s | 0.1s | 2.6s | - | - |
| Overcooked! 2 | 6.1s | 19.8s | 0.1s | 7.3s | 19.8s | 19.7s |
| Paint | 3.0s | 7.6s | 0.1s | 4.5s | 6.7s | 6.7s |
| Risk of Rain 2 | 6.1s | 6.6s | 0.1s | 2.6s | - | - |
| Saving Princess | 3.8s | 5.7s | 0.1s | 2.6s | - | - |
| Shivers | 6.2s | 9.7s | 0.1s | 2.7s | - | - |
| Sonic Adventure 2 Battle | 8.6s | 13.7s | 0.1s | 8.1s | 16.7s | 13.7s |
| Subnautica | 29.1s | 15.7s | 0.1s | 2.8s | - | - |
| Super Mario 64 | 6.2s | 12.7s | 0.1s | 2.8s | - | - |
| Super Mario Land 2 | 5.2s | 8.7s | 0.1s | 2.6s | - | - |
| Super Mario World | 8.9s | 6.6s | 0.1s | 7.6s | 6.7s | 6.6s |
| TOEM original | 6.4s | 8.6s | 0.1s | 6.5s | 8.6s | 8.6s |
| TOEM rule builder | 6.4s | 9.7s | 0.1s | 6.4s | 8.7s | 8.7s |
| Terraria | 5.8s | 19.8s | 0.1s | 5.7s | 19.8s | 19.7s |
| The Legend of Zelda | 6.4s | 8.7s | 0.1s | 2.6s | - | - |
| The Messenger | 7.7s | 13.8s | 0.1s | 0.4s | - | - |
| The Wind Waker | 16.6s | 9.7s | 0.1s | 2.6s | - | - |
| Timespinner | 7.6s | 14.3s | 0.1s | 2.8s | - | - |
| Undertale | 3.8s | 5.7s | 0.1s | 2.9s | - | - |
| VVVVVV | 3.4s | 5.8s | 0.1s | 2.6s | - | - |
| Wargroove | 3.5s | 6.6s | 0.1s | 2.5s | - | - |
| Yoshi's Island | 6.6s | 9.7s | 0.1s | 6.7s | 8.6s | 8.6s |
| shapez | 7.6s | 6.6s | 0.1s | 2.6s | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.1s |
| 2 | Dark Souls III | 27.5s |
| 3 | A Link to the Past | 18.8s |
| 4 | Choo-Choo Charles | 18.6s |
| 5 | A Link to the Past WorldGen 2 | 17.8s |
| 6 | The Wind Waker | 16.6s |
| 7 | Heretic | 15.5s |
| 8 | DOOM II | 14.0s |
| 9 | Aquaria | 13.7s |
| 10 | Final Fantasy Mystic Quest | 13.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.7s |
| 2 | A Link to the Past | 22.3s |
| 3 | A Link to the Past WorldGen 2 | 21.4s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | Terraria | 19.8s |
| 6 | Links Awakening DX | 16.8s |
| 7 | A Hat in Time | 16.4s |
| 8 | Subnautica | 15.7s |
| 9 | Heretic | 14.8s |
| 10 | DOOM II | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | Adventure | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Aquaria | 0.1s |
| 8 | Baking Adventure | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.4s |
| 2 | A Link to the Past | 18.4s |
| 3 | A Link to the Past WorldGen 2 | 17.4s |
| 4 | Heretic | 15.3s |
| 5 | DOOM II | 13.8s |
| 6 | Mario & Luigi Superstar Saga | 13.1s |
| 7 | DOOM 1993 | 11.4s |
| 8 | Landstalker - The Treasures of King Nole | 10.4s |
| 9 | Links Awakening DX | 10.3s |
| 10 | Aquaria | 9.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.8s |
| 2 | Overcooked! 2 | 19.8s |
| 3 | Terraria | 19.8s |
| 4 | A Link to the Past | 18.8s |
| 5 | A Link to the Past WorldGen 2 | 18.7s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Sonic Adventure 2 Battle | 16.7s |
| 9 | DOOM II | 15.7s |
| 10 | Heretic | 14.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | A Link to the Past | 23.7s |
| 3 | Overcooked! 2 | 19.7s |
| 4 | Terraria | 19.7s |
| 5 | A Link to the Past WorldGen 2 | 18.8s |
| 6 | Links Awakening DX | 16.8s |
| 7 | DOOM II | 15.7s |
| 8 | Heretic | 14.7s |
| 9 | Sonic Adventure 2 Battle | 13.7s |
| 10 | Donkey Kong Country 3 | 13.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 485.6s | 624.9s | 5.3s | 402.9s | 521.9s | 605.6s |
| Average | 8.0s | 10.2s | 0.1s | 6.6s | 10.4s | 12.1s |
| Max | 29.4s | 28.9s | 0.2s | 28.9s | 26.8s | 23.1s |
| Min | 2.9s | 5.4s | 0.1s | 0.5s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.4s) | Dark Souls III (28.9s) | A Link to the Past (0.2s) | Dark Souls III (28.9s) | Dark Souls III (26.8s) | Terraria (23.1s) |
| Fastest | APQuest (2.9s) | Meritous (5.4s) | Meritous (0.1s) | The Messenger (0.5s) | Meritous (5.4s) | APQuest (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.7s | 14.3s | 0.1s | 8.8s | 13.7s | 13.7s |
| A Link to the Past | 18.2s | 23.6s | 0.2s | 18.2s | 19.8s | 14.5s |
| A Link to the Past WorldGen 2 | 16.7s | 20.6s | 0.1s | 16.3s | 19.6s | 14.0s |
| A Short Hike | 5.4s | 10.4s | 0.1s | 5.4s | 9.7s | 9.7s |
| APQuest | 2.9s | 8.1s | 0.1s | 2.8s | 5.4s | 5.4s |
| Adventure | 3.5s | 10.3s | 0.1s | 3.6s | 5.6s | 14.2s |
| Aquaria | 13.6s | 10.4s | 0.1s | 9.1s | 7.6s | 14.3s |
| Baking Adventure | 3.3s | 6.4s | 0.1s | 3.1s | 5.6s | 14.1s |
| Bumper Stickers | 4.8s | 9.3s | 0.1s | 4.7s | 8.6s | 14.3s |
| Castlevania - Circle of the Moon | 5.7s | 7.8s | 0.1s | 6.0s | 5.7s | 14.2s |
| Castlevania 64 | 8.4s | 6.6s | 0.1s | 8.5s | 6.6s | 6.6s |
| Celeste 64 | 3.5s | 6.5s | 0.1s | 3.4s | 7.4s | 13.9s |
| ChecksFinder | 3.4s | 6.6s | 0.1s | 3.4s | 6.7s | 6.6s |
| Choo-Choo Charles | 18.4s | 10.7s | 0.1s | 18.3s | 10.8s | 10.8s |
| Civilization VI | 5.5s | 8.4s | 0.1s | 5.8s | 8.4s | 16.9s |
| Coding Adventure | 4.0s | 8.6s | 0.1s | 4.0s | 8.7s | 14.2s |
| DLCQuest | 3.8s | 5.6s | 0.1s | 2.5s | - | - |
| DOOM 1993 | 11.4s | 12.7s | 0.1s | 11.2s | 12.7s | 14.3s |
| DOOM II | 13.9s | 15.7s | 0.1s | 13.9s | 15.7s | 14.3s |
| Dark Souls III | 28.2s | 28.9s | 0.1s | 28.9s | 26.8s | 17.4s |
| Donkey Kong Country 3 | 8.0s | 13.7s | 0.1s | 7.8s | 13.6s | 15.1s |
| Factorio | 5.8s | 13.9s | 0.1s | 5.2s | 9.5s | 9.5s |
| Faxanadu | 4.9s | 6.6s | 0.1s | 5.4s | 8.7s | 14.3s |
| Final Fantasy Mystic Quest | 13.1s | 10.8s | 0.1s | 2.8s | - | - |
| Heretic | 14.0s | 15.5s | 0.1s | 14.0s | 15.6s | 14.2s |
| Hylics 2 | 6.3s | 6.6s | 0.1s | 5.6s | 6.6s | 6.6s |
| Inscryption | 4.4s | 6.6s | 0.1s | 4.4s | 6.6s | 6.6s |
| Landstalker - The Treasures of King Nole | 9.7s | 8.6s | 0.1s | 10.5s | 17.7s | 14.3s |
| Links Awakening DX | 10.3s | 16.7s | 0.1s | 10.4s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 3.8s | 5.7s | 0.1s | 4.1s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 10.8s | 9.7s | 0.1s | 13.7s | 9.7s | 9.7s |
| Math Adventure | 3.0s | 5.4s | 0.1s | 3.0s | 5.5s | 13.9s |
| Mega Man 2 | 4.1s | 6.7s | 0.1s | 4.1s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 8.3s | 8.7s | 0.1s | 9.0s | 8.8s | 17.7s |
| Meritous | 5.0s | 5.4s | 0.1s | 4.9s | 5.4s | 13.8s |
| Metamath | 9.9s | 5.6s | 0.1s | 2.5s | - | - |
| Muse Dash | 4.2s | 7.6s | 0.1s | 4.0s | 9.6s | 14.2s |
| Noita | 5.9s | 5.6s | 0.1s | 5.9s | 5.6s | 5.6s |
| Old School Runescape | 8.1s | 8.6s | 0.1s | 2.5s | - | - |
| Overcooked! 2 | 6.1s | 19.8s | 0.1s | 7.7s | 20.9s | 14.5s |
| Paint | 2.9s | 6.6s | 0.1s | 4.6s | 6.7s | 6.7s |
| Risk of Rain 2 | 5.9s | 6.5s | 0.1s | 2.5s | - | - |
| Saving Princess | 3.7s | 5.7s | 0.1s | 3.7s | 6.7s | 14.2s |
| Shivers | 6.1s | 9.7s | 0.1s | 6.4s | 9.8s | 14.7s |
| Sonic Adventure 2 Battle | 7.7s | 13.5s | 0.1s | 7.5s | 16.5s | 13.9s |
| Subnautica | 29.4s | 14.7s | 0.1s | 7.5s | 14.7s | 17.6s |
| Super Mario 64 | 6.0s | 12.6s | 0.1s | 6.5s | 12.7s | 12.7s |
| Super Mario Land 2 | 5.0s | 8.7s | 0.1s | 2.5s | - | - |
| Super Mario World | 8.8s | 6.6s | 0.1s | 7.6s | 6.6s | 6.6s |
| TOEM original | 6.4s | 9.7s | 0.1s | 6.8s | 9.7s | 9.7s |
| TOEM rule builder | 6.3s | 9.7s | 0.1s | 6.4s | 8.6s | 8.6s |
| Terraria | 5.5s | 20.6s | 0.1s | 5.6s | 20.5s | 23.1s |
| The Legend of Zelda | 6.4s | 8.7s | 0.1s | 5.2s | 10.7s | 14.4s |
| The Messenger | 7.5s | 13.9s | 0.1s | 0.5s | - | - |
| The Wind Waker | 14.6s | 9.5s | 0.1s | 2.4s | - | - |
| Timespinner | 7.4s | 14.6s | 0.1s | 2.6s | - | - |
| Undertale | 3.8s | 5.6s | 0.1s | 2.5s | - | - |
| VVVVVV | 3.3s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| Wargroove | 3.5s | 6.6s | 0.1s | 3.5s | 6.6s | 6.7s |
| Yoshi's Island | 6.9s | 9.7s | 0.1s | 7.1s | 8.7s | 8.7s |
| shapez | 7.6s | 6.6s | 0.1s | 2.6s | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.4s |
| 2 | Dark Souls III | 28.2s |
| 3 | Choo-Choo Charles | 18.4s |
| 4 | A Link to the Past | 18.2s |
| 5 | A Link to the Past WorldGen 2 | 16.7s |
| 6 | The Wind Waker | 14.6s |
| 7 | Heretic | 14.0s |
| 8 | DOOM II | 13.9s |
| 9 | Aquaria | 13.6s |
| 10 | Final Fantasy Mystic Quest | 13.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.9s |
| 2 | A Link to the Past | 23.6s |
| 3 | A Link to the Past WorldGen 2 | 20.6s |
| 4 | Terraria | 20.6s |
| 5 | Overcooked! 2 | 19.8s |
| 6 | Links Awakening DX | 16.7s |
| 7 | DOOM II | 15.7s |
| 8 | Heretic | 15.5s |
| 9 | Subnautica | 14.7s |
| 10 | Timespinner | 14.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.1s |
| 3 | A Hat in Time | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | Adventure | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | APQuest | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.9s |
| 2 | Choo-Choo Charles | 18.3s |
| 3 | A Link to the Past | 18.2s |
| 4 | A Link to the Past WorldGen 2 | 16.3s |
| 5 | Heretic | 14.0s |
| 6 | DOOM II | 13.9s |
| 7 | Mario & Luigi Superstar Saga | 13.7s |
| 8 | DOOM 1993 | 11.2s |
| 9 | Landstalker - The Treasures of King Nole | 10.5s |
| 10 | Links Awakening DX | 10.4s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 26.8s |
| 2 | Overcooked! 2 | 20.9s |
| 3 | Terraria | 20.5s |
| 4 | A Link to the Past | 19.8s |
| 5 | A Link to the Past WorldGen 2 | 19.6s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Links Awakening DX | 16.7s |
| 8 | Sonic Adventure 2 Battle | 16.5s |
| 9 | DOOM II | 15.7s |
| 10 | Heretic | 15.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.1s |
| 2 | MegaMan Battle Network 3 | 17.7s |
| 3 | Subnautica | 17.6s |
| 4 | Dark Souls III | 17.4s |
| 5 | Civilization VI | 16.9s |
| 6 | Links Awakening DX | 16.7s |
| 7 | Donkey Kong Country 3 | 15.1s |
| 8 | Shivers | 14.7s |
| 9 | Overcooked! 2 | 14.5s |
| 10 | A Link to the Past | 14.5s |
