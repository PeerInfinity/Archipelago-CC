# World Generator Test Results

**Generated:** 2025-12-31 20:47:27 UTC

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
| Stage 3: Rules Comparison | 3 | 57 | 60 |
| Stage 4: WorldGen Spoiler Test | 60 | 0 | 60 |
| Stage 5: Cross-Validation | 60 | 0 | 60 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TUNIC | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Stage 4: WorldGen Spoiler Test | 60 | 0 | 60 |
| Stage 5: Cross-Validation | 30 | 30 | 60 |

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
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TUNIC | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Total | 482.1s | 599.8s | 5.1s | 423.9s | 583.5s | 562.6s |
| Average | 7.9s | 9.8s | 0.1s | 7.0s | 9.7s | 9.4s |
| Max | 29.6s | 27.8s | 0.1s | 28.3s | 26.8s | 27.8s |
| Min | 2.6s | 5.5s | 0.1s | 2.4s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.6s) | Dark Souls III (27.8s) | A Link to the Past (0.1s) | Dark Souls III (28.3s) | Dark Souls III (26.8s) | Dark Souls III (27.8s) |
| Fastest | Paint (2.6s) | Math Adventure (5.5s) | TOEM rule builder (0.1s) | TUNIC (2.4s) | Math Adventure (5.5s) | Math Adventure (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.2s | 15.2s | 0.1s | 8.0s | 13.5s | 13.6s |
| A Link to the Past | 18.7s | 18.3s | 0.1s | 11.1s | 17.8s | 16.8s |
| A Short Hike | 4.8s | 11.7s | 0.1s | 4.8s | 9.5s | 9.4s |
| APQuest | 3.2s | 6.2s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.6s | 10.9s | 0.1s | 3.6s | 5.7s | 5.7s |
| Aquaria | 14.2s | 8.2s | 0.1s | 9.1s | 7.7s | 7.7s |
| Baking Adventure | 3.3s | 8.0s | 0.1s | 3.1s | 5.6s | 5.6s |
| Bumper Stickers | 4.8s | 12.8s | 0.1s | 4.7s | 8.8s | 8.7s |
| Castlevania - Circle of the Moon | 5.7s | 6.2s | 0.1s | 5.3s | 5.7s | 5.7s |
| Castlevania 64 | 7.8s | 9.7s | 0.1s | 7.6s | 6.5s | 6.5s |
| Celeste 64 | 3.4s | 6.6s | 0.1s | 3.4s | 7.5s | 6.5s |
| ChecksFinder | 3.3s | 6.7s | 0.1s | 3.3s | 6.7s | 6.7s |
| Choo-Choo Charles | 16.8s | 9.5s | 0.1s | 16.4s | 9.5s | 9.5s |
| Civilization VI | 6.0s | 8.7s | 0.1s | 6.4s | 8.7s | 8.7s |
| Coding Adventure | 4.0s | 8.7s | 0.1s | 4.0s | 8.7s | 8.7s |
| DLCQuest | 4.0s | 5.7s | 0.1s | 3.7s | 5.7s | 5.7s |
| DOOM 1993 | 11.3s | 12.7s | 0.1s | 11.2s | 12.7s | 12.7s |
| DOOM II | 14.0s | 14.8s | 0.1s | 13.8s | 15.8s | 14.7s |
| Dark Souls III | 28.8s | 27.8s | 0.1s | 28.3s | 26.8s | 27.8s |
| Donkey Kong Country 3 | 7.2s | 14.5s | 0.1s | 7.0s | 13.5s | 14.5s |
| Factorio | 5.7s | 9.5s | 0.1s | 5.0s | 9.5s | 9.5s |
| Faxanadu | 4.9s | 6.7s | 0.1s | 5.4s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 11.8s | 10.6s | 0.1s | 10.8s | 10.5s | 10.5s |
| Heretic | 15.5s | 14.8s | 0.1s | 15.3s | 14.8s | 14.8s |
| Hylics 2 | 6.3s | 6.7s | 0.1s | 5.7s | 6.7s | 6.7s |
| Inscryption | 4.7s | 6.7s | 0.1s | 4.4s | 6.7s | 6.7s |
| Landstalker - The Treasures of King Nole | 9.9s | 8.7s | 0.1s | 10.3s | 17.7s | 8.6s |
| Links Awakening DX | 9.3s | 16.8s | 0.1s | 10.1s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 4.2s | 5.7s | 0.1s | 4.0s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 10.2s | 9.5s | 0.1s | 11.9s | 9.5s | 9.5s |
| Math Adventure | 2.9s | 5.5s | 0.1s | 3.0s | 5.5s | 5.5s |
| Mega Man 2 | 4.0s | 6.7s | 0.1s | 4.0s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 7.4s | 8.4s | 0.1s | 7.3s | 8.4s | 8.4s |
| Meritous | 5.2s | 5.7s | 0.1s | 5.3s | 5.7s | 5.7s |
| Metamath | 11.6s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Muse Dash | 4.4s | 7.7s | 0.1s | 4.0s | 9.7s | 7.7s |
| Noita | 5.9s | 5.6s | 0.1s | 5.9s | 5.6s | 5.6s |
| Old School Runescape | 7.9s | 8.7s | 0.1s | 6.7s | 8.7s | 8.7s |
| Overcooked! 2 | 6.4s | 19.8s | 0.1s | 7.5s | 19.8s | 19.8s |
| Paint | 2.6s | 6.5s | 0.1s | 4.1s | 6.5s | 6.5s |
| Risk of Rain 2 | 5.8s | 6.5s | 0.1s | 5.6s | 6.5s | 6.5s |
| Saving Princess | 3.7s | 5.7s | 0.1s | 3.8s | 6.7s | 5.8s |
| Shivers | 5.5s | 9.5s | 0.1s | 5.5s | 9.5s | 9.5s |
| Sonic Adventure 2 Battle | 8.4s | 13.7s | 0.1s | 7.8s | 16.7s | 13.7s |
| Subnautica | 29.6s | 14.7s | 0.1s | 7.6s | 14.7s | 14.7s |
| Super Mario 64 | 6.2s | 12.7s | 0.1s | 6.4s | 12.7s | 12.7s |
| Super Mario Land 2 | 5.0s | 8.7s | 0.1s | 5.0s | 7.7s | 7.7s |
| Super Mario World | 8.7s | 6.7s | 0.1s | 7.5s | 6.7s | 6.7s |
| TOEM original | 6.9s | 8.7s | 0.1s | 6.3s | 8.7s | 8.7s |
| TOEM rule builder | 5.8s | 8.5s | 0.1s | 5.8s | 8.5s | 8.5s |
| TUNIC | 13.7s | 12.5s | 0.1s | 2.4s | - | - |
| Terraria | 5.9s | 19.8s | 0.1s | 6.1s | 20.9s | 19.9s |
| The Legend of Zelda | 5.7s | 8.5s | 0.1s | 4.5s | 10.5s | 8.5s |
| The Messenger | 7.5s | 13.8s | 0.1s | 7.2s | 13.9s | 13.8s |
| The Wind Waker | 16.9s | 9.7s | 0.1s | 19.4s | 9.7s | 9.7s |
| Timespinner | 7.4s | 7.7s | 0.1s | 7.1s | 6.7s | 6.7s |
| Undertale | 3.8s | 5.6s | 0.1s | 3.7s | 5.6s | 5.6s |
| VVVVVV | 3.3s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Wargroove | 3.5s | 6.7s | 0.1s | 3.5s | 6.7s | 6.8s |
| Yoshi's Island | 6.1s | 9.5s | 0.1s | 8.2s | 8.5s | 8.6s |
| shapez | 7.1s | 6.5s | 0.1s | 6.0s | 6.5s | 6.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.6s |
| 2 | Dark Souls III | 28.8s |
| 3 | A Link to the Past | 18.7s |
| 4 | The Wind Waker | 16.9s |
| 5 | Choo-Choo Charles | 16.8s |
| 6 | Heretic | 15.5s |
| 7 | Aquaria | 14.2s |
| 8 | DOOM II | 14.0s |
| 9 | TUNIC | 13.7s |
| 10 | Final Fantasy Mystic Quest | 11.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.8s |
| 2 | Terraria | 19.8s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | A Link to the Past | 18.3s |
| 5 | Links Awakening DX | 16.8s |
| 6 | A Hat in Time | 15.2s |
| 7 | Heretic | 14.8s |
| 8 | DOOM II | 14.8s |
| 9 | Subnautica | 14.7s |
| 10 | Donkey Kong Country 3 | 14.5s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | Aquaria | 0.1s |
| 3 | A Hat in Time | 0.1s |
| 4 | APQuest | 0.1s |
| 5 | Adventure | 0.1s |
| 6 | Baking Adventure | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.3s |
| 2 | The Wind Waker | 19.4s |
| 3 | Choo-Choo Charles | 16.4s |
| 4 | Heretic | 15.3s |
| 5 | DOOM II | 13.8s |
| 6 | Mario & Luigi Superstar Saga | 11.9s |
| 7 | DOOM 1993 | 11.2s |
| 8 | A Link to the Past | 11.1s |
| 9 | Final Fantasy Mystic Quest | 10.8s |
| 10 | Landstalker - The Treasures of King Nole | 10.3s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 26.8s |
| 2 | Terraria | 20.9s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | A Link to the Past | 17.8s |
| 5 | Landstalker - The Treasures of King Nole | 17.7s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | DOOM II | 15.8s |
| 9 | Heretic | 14.8s |
| 10 | Subnautica | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.8s |
| 2 | Terraria | 19.9s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | Links Awakening DX | 16.8s |
| 5 | A Link to the Past | 16.8s |
| 6 | Heretic | 14.8s |
| 7 | DOOM II | 14.7s |
| 8 | Subnautica | 14.7s |
| 9 | Donkey Kong Country 3 | 14.5s |
| 10 | The Messenger | 13.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 477.0s | 595.5s | 5.1s | 423.1s | 582.0s | 698.5s |
| Average | 7.8s | 9.8s | 0.1s | 6.9s | 9.7s | 11.6s |
| Max | 30.1s | 26.8s | 0.1s | 27.9s | 25.8s | 23.7s |
| Min | 2.7s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (30.1s) | Dark Souls III (26.8s) | A Link to the Past (0.1s) | Dark Souls III (27.9s) | Dark Souls III (25.8s) | Terraria (23.7s) |
| Fastest | Paint (2.7s) | Noita (5.5s) | TOEM rule builder (0.1s) | TUNIC (2.5s) | APQuest (5.5s) | APQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.5s | 17.4s | 0.1s | 8.5s | 13.7s | 13.7s |
| A Link to the Past | 17.9s | 18.2s | 0.1s | 10.8s | 17.7s | 14.4s |
| A Short Hike | 5.0s | 11.9s | 0.1s | 5.1s | 9.5s | 9.5s |
| APQuest | 3.1s | 8.8s | 0.1s | 2.9s | 5.5s | 5.5s |
| Adventure | 3.6s | 6.2s | 0.1s | 3.6s | 5.7s | 14.4s |
| Aquaria | 13.7s | 11.9s | 0.1s | 9.1s | 7.7s | 14.5s |
| Baking Adventure | 3.3s | 5.9s | 0.1s | 3.1s | 5.5s | 14.1s |
| Bumper Stickers | 5.0s | 9.2s | 0.1s | 4.7s | 8.7s | 14.3s |
| Castlevania - Circle of the Moon | 5.4s | 7.6s | 0.1s | 5.2s | 5.6s | 14.3s |
| Castlevania 64 | 7.7s | 6.9s | 0.1s | 7.6s | 6.5s | 6.4s |
| Celeste 64 | 3.4s | 6.6s | 0.1s | 3.6s | 7.6s | 14.4s |
| ChecksFinder | 3.2s | 6.6s | 0.1s | 3.1s | 6.6s | 6.6s |
| Choo-Choo Charles | 16.8s | 10.5s | 0.1s | 16.8s | 9.5s | 9.5s |
| Civilization VI | 5.8s | 8.6s | 0.1s | 6.1s | 8.5s | 17.1s |
| Coding Adventure | 4.0s | 8.7s | 0.1s | 4.0s | 8.7s | 14.4s |
| DLCQuest | 3.8s | 5.6s | 0.1s | 3.7s | 5.7s | 5.7s |
| DOOM 1993 | 10.9s | 12.6s | 0.1s | 10.9s | 12.6s | 14.1s |
| DOOM II | 14.1s | 15.8s | 0.1s | 13.7s | 14.7s | 14.6s |
| Dark Souls III | 27.5s | 26.8s | 0.1s | 27.9s | 25.8s | 17.4s |
| Donkey Kong Country 3 | 7.1s | 13.5s | 0.1s | 7.0s | 14.5s | 14.6s |
| Factorio | 5.8s | 9.7s | 0.1s | 5.2s | 9.7s | 9.7s |
| Faxanadu | 4.7s | 6.6s | 0.1s | 5.2s | 8.6s | 14.3s |
| Final Fantasy Mystic Quest | 12.4s | 10.6s | 0.1s | 11.2s | 10.5s | 10.6s |
| Heretic | 14.4s | 14.6s | 0.1s | 14.4s | 15.6s | 14.2s |
| Hylics 2 | 6.3s | 6.7s | 0.1s | 5.6s | 6.7s | 6.7s |
| Inscryption | 4.5s | 6.7s | 0.1s | 4.4s | 6.7s | 6.7s |
| Landstalker - The Treasures of King Nole | 9.3s | 8.6s | 0.1s | 9.9s | 17.6s | 14.2s |
| Links Awakening DX | 9.6s | 16.8s | 0.1s | 10.5s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.7s | 5.6s | 0.1s | 3.6s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 10.1s | 9.5s | 0.1s | 12.1s | 9.5s | 9.5s |
| Math Adventure | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 14.3s |
| Mega Man 2 | 3.9s | 6.7s | 0.1s | 3.8s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 7.7s | 8.5s | 0.1s | 7.6s | 8.5s | 17.1s |
| Meritous | 5.1s | 5.5s | 0.1s | 5.1s | 5.5s | 14.1s |
| Metamath | 11.4s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Muse Dash | 4.2s | 7.7s | 0.1s | 4.0s | 9.7s | 14.6s |
| Noita | 5.7s | 5.5s | 0.1s | 5.8s | 5.5s | 5.5s |
| Old School Runescape | 8.1s | 8.7s | 0.1s | 6.9s | 8.7s | 8.7s |
| Overcooked! 2 | 5.9s | 19.8s | 0.1s | 7.2s | 19.8s | 14.4s |
| Paint | 2.7s | 6.6s | 0.1s | 4.1s | 6.5s | 6.4s |
| Risk of Rain 2 | 5.9s | 6.6s | 0.1s | 5.9s | 6.6s | 6.6s |
| Saving Princess | 3.5s | 5.6s | 0.1s | 3.5s | 6.6s | 14.3s |
| Shivers | 5.7s | 9.6s | 0.1s | 5.7s | 9.5s | 14.0s |
| Sonic Adventure 2 Battle | 7.9s | 13.6s | 0.1s | 7.5s | 16.6s | 14.2s |
| Subnautica | 30.1s | 14.7s | 0.1s | 7.7s | 14.7s | 18.0s |
| Super Mario 64 | 6.1s | 12.7s | 0.1s | 6.4s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.9s | 8.6s | 0.1s | 4.7s | 7.6s | 7.6s |
| Super Mario World | 8.8s | 6.7s | 0.1s | 7.6s | 6.6s | 6.7s |
| TOEM original | 6.3s | 8.7s | 0.1s | 6.5s | 8.6s | 8.7s |
| TOEM rule builder | 5.8s | 8.5s | 0.1s | 5.8s | 9.5s | 9.5s |
| TUNIC | 14.3s | 12.7s | 0.1s | 2.5s | - | - |
| Terraria | 5.8s | 19.8s | 0.1s | 5.7s | 19.8s | 23.7s |
| The Legend of Zelda | 5.9s | 8.5s | 0.1s | 4.8s | 10.5s | 14.0s |
| The Messenger | 7.2s | 13.7s | 0.1s | 6.9s | 13.7s | 13.8s |
| The Wind Waker | 16.8s | 9.7s | 0.1s | 19.8s | 9.7s | 14.5s |
| Timespinner | 7.3s | 6.7s | 0.1s | 7.0s | 6.7s | 14.4s |
| Undertale | 3.8s | 5.5s | 0.1s | 3.6s | 5.5s | 5.5s |
| VVVVVV | 3.3s | 5.7s | 0.1s | 3.3s | 5.6s | 5.6s |
| Wargroove | 3.4s | 6.6s | 0.1s | 3.5s | 6.7s | 6.6s |
| Yoshi's Island | 6.1s | 9.5s | 0.1s | 8.2s | 8.5s | 8.6s |
| shapez | 7.5s | 6.6s | 0.1s | 6.2s | 6.6s | 14.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 30.1s |
| 2 | Dark Souls III | 27.5s |
| 3 | A Link to the Past | 17.9s |
| 4 | The Wind Waker | 16.8s |
| 5 | Choo-Choo Charles | 16.8s |
| 6 | Heretic | 14.4s |
| 7 | TUNIC | 14.3s |
| 8 | DOOM II | 14.1s |
| 9 | Aquaria | 13.7s |
| 10 | Final Fantasy Mystic Quest | 12.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 26.8s |
| 2 | Overcooked! 2 | 19.8s |
| 3 | Terraria | 19.8s |
| 4 | A Link to the Past | 18.2s |
| 5 | A Hat in Time | 17.4s |
| 6 | Links Awakening DX | 16.8s |
| 7 | DOOM II | 15.8s |
| 8 | Subnautica | 14.7s |
| 9 | Heretic | 14.6s |
| 10 | The Messenger | 13.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | Aquaria | 0.1s |
| 3 | A Hat in Time | 0.1s |
| 4 | Adventure | 0.1s |
| 5 | Bumper Stickers | 0.1s |
| 6 | Castlevania - Circle of the Moon | 0.1s |
| 7 | A Short Hike | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.9s |
| 2 | The Wind Waker | 19.8s |
| 3 | Choo-Choo Charles | 16.8s |
| 4 | Heretic | 14.4s |
| 5 | DOOM II | 13.7s |
| 6 | Mario & Luigi Superstar Saga | 12.1s |
| 7 | Final Fantasy Mystic Quest | 11.2s |
| 8 | DOOM 1993 | 10.9s |
| 9 | A Link to the Past | 10.8s |
| 10 | Links Awakening DX | 10.5s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 25.8s |
| 2 | Overcooked! 2 | 19.8s |
| 3 | Terraria | 19.8s |
| 4 | A Link to the Past | 17.7s |
| 5 | Landstalker - The Treasures of King Nole | 17.6s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Sonic Adventure 2 Battle | 16.6s |
| 8 | Heretic | 15.6s |
| 9 | Subnautica | 14.7s |
| 10 | DOOM II | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.7s |
| 2 | Subnautica | 18.0s |
| 3 | Dark Souls III | 17.4s |
| 4 | Civilization VI | 17.1s |
| 5 | MegaMan Battle Network 3 | 17.1s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Donkey Kong Country 3 | 14.6s |
| 8 | DOOM II | 14.6s |
| 9 | Muse Dash | 14.6s |
| 10 | Aquaria | 14.5s |
