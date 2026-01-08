# World Generator Test Results

**Generated:** 2026-01-08 03:29:55 UTC

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
| Original Generation | 60 | 1 | 61 |
| Original Spoiler Test | 60 | 0 | 60 |
| Stage 1: World Generation | 60 | 1 | 61 |
| Stage 2: Seed Generation | 60 | 1 | 61 |
| Stage 3: Rules Comparison | 60 | 0 | 60 |
| Stage 4: WorldGen Spoiler Test | 59 | 1 | 60 |
| Stage 5: Cross-Validation | 59 | 1 | 60 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ❌ | ❌ | - | - | - | - | - |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 61

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 60 | 1 | 61 |
| Original Spoiler Test | 60 | 0 | 60 |
| Stage 1: World Generation | 60 | 1 | 61 |
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
| Landstalker - The Treasures of King Nole | ❌ | ❌ | - | - | - | - | - |
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
| Total | 230.4s | 410.1s | 5.4s | 208.2s | 393.6s | 394.4s |
| Average | 3.8s | 6.8s | 0.1s | 3.5s | 6.6s | 6.6s |
| Max | 10.4s | 18.7s | 0.2s | 6.3s | 18.8s | 18.8s |
| Min | 2.9s | 5.4s | 0.1s | 2.8s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.4s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | A Link to the Past WorldGen 2 (6.3s) | Dark Souls III (18.8s) | Dark Souls III (18.8s) |
| Fastest | Choo-Choo Charles (2.9s) | MegaMan Battle Network 3 (5.4s) | Wargroove (0.1s) | A Short Hike (2.8s) | Shivers (5.4s) | Shivers (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.3s | 7.2s | 0.1s | 3.7s | 15.3s | 17.3s |
| A Link to the Past | 8.1s | 9.3s | 0.2s | 6.2s | 9.7s | 8.7s |
| A Link to the Past WorldGen 2 | 6.2s | 13.5s | 0.2s | 6.3s | 9.7s | 9.7s |
| A Short Hike | 3.0s | 5.9s | 0.1s | 2.8s | 5.4s | 5.6s |
| APQuest | 3.2s | 7.3s | 0.1s | 3.1s | 5.6s | 5.7s |
| Adventure | 3.3s | 8.7s | 0.1s | 3.5s | 5.8s | 5.8s |
| Aquaria | 4.6s | 7.1s | 0.2s | 3.6s | 5.7s | 5.9s |
| Baking Adventure | 3.1s | 9.7s | 0.1s | 3.1s | 5.7s | 5.6s |
| Bumper Stickers | 3.1s | 8.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Castlevania - Circle of the Moon | 3.3s | 12.2s | 0.1s | 3.1s | 5.7s | 5.7s |
| Castlevania 64 | 3.3s | 5.8s | 0.1s | 3.3s | 5.6s | 5.6s |
| Celeste 64 | 3.1s | 5.8s | 0.1s | 3.2s | 5.7s | 5.7s |
| ChecksFinder | 3.0s | 5.8s | 0.1s | 3.0s | 5.6s | 5.7s |
| Choo-Choo Charles | 2.9s | 7.5s | 0.1s | 2.9s | 7.5s | 7.5s |
| Civilization VI | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.7s |
| Coding Adventure | 3.1s | 5.6s | 0.1s | 3.2s | 5.8s | 5.7s |
| DLCQuest | 3.5s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| DOOM 1993 | 3.7s | 6.7s | 0.1s | 3.4s | 6.7s | 6.7s |
| DOOM II | 3.5s | 7.7s | 0.1s | 3.5s | 7.7s | 7.7s |
| Dark Souls III | 4.0s | 18.7s | 0.1s | 4.3s | 18.8s | 18.8s |
| Donkey Kong Country 3 | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Factorio | 3.6s | 5.7s | 0.1s | 3.4s | 5.7s | 5.7s |
| Faxanadu | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Final Fantasy Mystic Quest | 3.9s | 6.5s | 0.1s | 3.2s | 6.5s | 6.5s |
| Heretic | 3.7s | 7.7s | 0.1s | 3.6s | 7.7s | 7.8s |
| Hylics 2 | 3.3s | 5.7s | 0.1s | 3.3s | 5.8s | 5.8s |
| Inscryption | 3.3s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.6s | - | - | - | - | - |
| Links Awakening DX | 7.6s | 7.8s | 0.1s | 4.1s | 7.7s | 7.7s |
| Lufia II Ancient Cave | 3.4s | 5.8s | 0.1s | 3.4s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 7.6s | 0.1s | 4.0s | 7.6s | 7.6s |
| Math Adventure | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.7s |
| Mega Man 2 | 3.2s | 5.7s | 0.1s | 3.2s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.0s | 5.4s | 0.1s | 2.8s | 5.4s | 5.5s |
| Meritous | 3.0s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Metamath | 10.4s | 5.7s | 0.1s | 3.3s | 5.8s | 5.7s |
| Muse Dash | 3.4s | 5.7s | 0.1s | 3.4s | 5.7s | 5.7s |
| Noita | 3.2s | 5.8s | 0.1s | 3.1s | 5.6s | 5.6s |
| Old School Runescape | 3.9s | 5.7s | 0.1s | 3.9s | 5.7s | 5.7s |
| Overcooked! 2 | 3.6s | 7.7s | 0.1s | 3.3s | 7.6s | 7.7s |
| Paint | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.5s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Saving Princess | 3.0s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Shivers | 3.0s | 5.5s | 0.1s | 2.9s | 5.4s | 5.4s |
| Sonic Adventure 2 Battle | 4.7s | 5.7s | 0.1s | 4.5s | 6.7s | 5.7s |
| Subnautica | 3.7s | 9.9s | 0.1s | 3.9s | 9.8s | 9.8s |
| Super Mario 64 | 3.5s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.8s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Super Mario World | 4.5s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| TOEM original | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| TOEM rule builder | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Terraria | 3.1s | 7.7s | 0.1s | 3.2s | 7.7s | 7.7s |
| The Legend of Zelda | 3.9s | 5.7s | 0.1s | 3.2s | 5.7s | 5.6s |
| The Messenger | 3.1s | 8.6s | 0.1s | 3.0s | 8.6s | 8.5s |
| The Wind Waker | 5.1s | 5.7s | 0.1s | 5.2s | 5.7s | 5.7s |
| Timespinner | 4.0s | 6.0s | 0.1s | 4.2s | 5.7s | 5.8s |
| Undertale | 3.7s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| VVVVVV | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Wargroove | 3.1s | 5.6s | 0.1s | 3.1s | 5.7s | 5.6s |
| Yoshi's Island | 4.0s | 6.7s | 0.1s | 3.9s | 5.6s | 5.7s |
| shapez | 3.8s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.4s |
| 2 | A Link to the Past | 8.1s |
| 3 | Links Awakening DX | 7.6s |
| 4 | A Link to the Past WorldGen 2 | 6.2s |
| 5 | The Wind Waker | 5.1s |
| 6 | Sonic Adventure 2 Battle | 4.7s |
| 7 | Aquaria | 4.6s |
| 8 | Super Mario World | 4.5s |
| 9 | A Hat in Time | 4.3s |
| 10 | Dark Souls III | 4.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past WorldGen 2 | 13.5s |
| 3 | Castlevania - Circle of the Moon | 12.2s |
| 4 | Subnautica | 9.9s |
| 5 | Baking Adventure | 9.7s |
| 6 | A Link to the Past | 9.3s |
| 7 | Adventure | 8.7s |
| 8 | Bumper Stickers | 8.7s |
| 9 | The Messenger | 8.6s |
| 10 | Links Awakening DX | 7.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | Aquaria | 0.2s |
| 4 | A Hat in Time | 0.1s |
| 5 | Adventure | 0.1s |
| 6 | Castlevania - Circle of the Moon | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Baking Adventure | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 6.3s |
| 2 | A Link to the Past | 6.2s |
| 3 | The Wind Waker | 5.2s |
| 4 | Sonic Adventure 2 Battle | 4.5s |
| 5 | Dark Souls III | 4.3s |
| 6 | Timespinner | 4.2s |
| 7 | Links Awakening DX | 4.1s |
| 8 | Mario & Luigi Superstar Saga | 4.0s |
| 9 | Subnautica | 3.9s |
| 10 | Yoshi's Island | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.8s |
| 2 | A Hat in Time | 15.3s |
| 3 | Subnautica | 9.8s |
| 4 | A Link to the Past WorldGen 2 | 9.7s |
| 5 | A Link to the Past | 9.7s |
| 6 | The Messenger | 8.6s |
| 7 | Links Awakening DX | 7.7s |
| 8 | Heretic | 7.7s |
| 9 | DOOM II | 7.7s |
| 10 | Terraria | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.8s |
| 2 | A Hat in Time | 17.3s |
| 3 | Subnautica | 9.8s |
| 4 | A Link to the Past WorldGen 2 | 9.7s |
| 5 | A Link to the Past | 8.7s |
| 6 | The Messenger | 8.5s |
| 7 | Heretic | 7.8s |
| 8 | Links Awakening DX | 7.7s |
| 9 | DOOM II | 7.7s |
| 10 | Terraria | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 221.2s | 396.3s | 5.3s | 201.2s | 391.3s | 583.8s |
| Average | 3.6s | 6.6s | 0.1s | 3.4s | 6.5s | 9.7s |
| Max | 9.2s | 18.7s | 0.2s | 6.5s | 17.7s | 32.7s |
| Min | 2.8s | 5.4s | 0.1s | 2.8s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (9.2s) | Dark Souls III (18.7s) | A Link to the Past WorldGen 2 (0.2s) | A Link to the Past WorldGen 2 (6.5s) | Dark Souls III (17.7s) | Dark Souls III (32.7s) |
| Fastest | Coding Adventure (2.8s) | Metamath (5.4s) | Wargroove (0.1s) | Metamath (2.8s) | Timespinner (5.4s) | Adventure (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.3s | 8.0s | 0.1s | 3.8s | 17.3s | 17.3s |
| A Link to the Past | 7.6s | 9.7s | 0.2s | 6.0s | 9.7s | 14.5s |
| A Link to the Past WorldGen 2 | 6.2s | 12.6s | 0.2s | 6.5s | 9.7s | 14.3s |
| A Short Hike | 3.2s | 6.1s | 0.1s | 3.2s | 5.7s | 5.6s |
| APQuest | 3.0s | 9.4s | 0.1s | 2.9s | 5.5s | 5.6s |
| Adventure | 3.0s | 7.2s | 0.1s | 2.8s | 5.4s | 5.4s |
| Aquaria | 4.2s | 6.4s | 0.1s | 3.4s | 5.5s | 5.5s |
| Baking Adventure | 3.0s | 6.1s | 0.1s | 2.9s | 5.6s | 14.1s |
| Bumper Stickers | 3.0s | 6.3s | 0.1s | 2.9s | 5.6s | 14.1s |
| Castlevania - Circle of the Moon | 3.1s | 6.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Castlevania 64 | 3.4s | 5.6s | 0.1s | 3.4s | 5.6s | 5.7s |
| Celeste 64 | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 14.2s |
| ChecksFinder | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.2s | 7.6s | 0.1s | 3.1s | 7.7s | 7.7s |
| Civilization VI | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 14.1s |
| Coding Adventure | 2.8s | 5.5s | 0.1s | 2.8s | 5.4s | 13.9s |
| DLCQuest | 3.2s | 5.6s | 0.1s | 3.0s | 5.5s | 5.5s |
| DOOM 1993 | 3.4s | 6.6s | 0.1s | 3.3s | 6.6s | 14.2s |
| DOOM II | 3.5s | 7.6s | 0.1s | 3.6s | 7.7s | 14.2s |
| Dark Souls III | 4.0s | 18.7s | 0.1s | 4.0s | 17.7s | 32.7s |
| Donkey Kong Country 3 | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 14.2s |
| Factorio | 3.6s | 5.6s | 0.1s | 3.5s | 5.7s | 5.6s |
| Faxanadu | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 14.1s |
| Final Fantasy Mystic Quest | 4.2s | 6.7s | 0.1s | 3.7s | 6.7s | 6.7s |
| Heretic | 3.5s | 7.6s | 0.1s | 3.4s | 7.6s | 14.5s |
| Hylics 2 | 3.0s | 5.5s | 0.1s | 2.9s | 5.5s | 5.5s |
| Inscryption | 3.0s | 5.5s | 0.1s | 3.1s | 5.5s | 5.5s |
| Landstalker - The Treasures of King Nole | 3.3s | - | - | - | - | - |
| Links Awakening DX | 7.3s | 7.6s | 0.1s | 4.0s | 7.7s | 7.8s |
| Lufia II Ancient Cave | 3.3s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 7.7s | 0.1s | 4.0s | 7.6s | 7.7s |
| Math Adventure | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| Mega Man 2 | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.2s | 5.8s | 0.1s | 3.1s | 5.7s | 14.3s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.9s | 5.5s | 5.5s |
| Metamath | 9.2s | 5.4s | 0.1s | 2.8s | 5.4s | 5.4s |
| Muse Dash | 3.2s | 5.5s | 0.1s | 3.1s | 5.5s | 14.1s |
| Noita | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Old School Runescape | 3.7s | 6.2s | 0.1s | 3.6s | 5.6s | 5.6s |
| Overcooked! 2 | 3.3s | 7.6s | 0.1s | 3.4s | 7.6s | 14.2s |
| Paint | 3.0s | 5.8s | 0.1s | 3.0s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.5s | 5.6s | 0.1s | 3.6s | 5.7s | 5.6s |
| Saving Princess | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 14.1s |
| Shivers | 3.2s | 5.7s | 0.1s | 3.3s | 5.6s | 14.3s |
| Sonic Adventure 2 Battle | 4.2s | 5.6s | 0.1s | 4.0s | 6.6s | 14.1s |
| Subnautica | 3.5s | 9.4s | 0.1s | 3.3s | 9.4s | 13.8s |
| Super Mario 64 | 3.2s | 5.6s | 0.1s | 3.2s | 5.5s | 5.5s |
| Super Mario Land 2 | 3.5s | 5.7s | 0.1s | 3.4s | 5.7s | 5.7s |
| Super Mario World | 4.4s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| TOEM original | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| TOEM rule builder | 2.9s | 5.7s | 0.1s | 3.1s | 5.7s | 5.6s |
| Terraria | 3.2s | 7.7s | 0.1s | 3.2s | 7.7s | 7.7s |
| The Legend of Zelda | 3.7s | 5.6s | 0.1s | 3.1s | 5.6s | 14.2s |
| The Messenger | 3.3s | 8.7s | 0.1s | 3.5s | 8.8s | 8.8s |
| The Wind Waker | 4.8s | 5.7s | 0.1s | 4.9s | 5.6s | 14.1s |
| Timespinner | 4.0s | 5.5s | 0.1s | 3.8s | 5.4s | 5.5s |
| Undertale | 3.1s | 5.5s | 0.1s | 3.0s | 5.5s | 5.5s |
| VVVVVV | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 3.9s | 6.7s | 0.1s | 3.7s | 5.6s | 5.6s |
| shapez | 3.8s | 5.6s | 0.1s | 3.2s | 5.6s | 14.2s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 9.2s |
| 2 | A Link to the Past | 7.6s |
| 3 | Links Awakening DX | 7.3s |
| 4 | A Link to the Past WorldGen 2 | 6.2s |
| 5 | The Wind Waker | 4.8s |
| 6 | Super Mario World | 4.4s |
| 7 | A Hat in Time | 4.3s |
| 8 | Sonic Adventure 2 Battle | 4.2s |
| 9 | Final Fantasy Mystic Quest | 4.2s |
| 10 | Aquaria | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past WorldGen 2 | 12.6s |
| 3 | A Link to the Past | 9.7s |
| 4 | Subnautica | 9.4s |
| 5 | APQuest | 9.4s |
| 6 | The Messenger | 8.7s |
| 7 | A Hat in Time | 8.0s |
| 8 | Mario & Luigi Superstar Saga | 7.7s |
| 9 | Terraria | 7.7s |
| 10 | Choo-Choo Charles | 7.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | APQuest | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Baking Adventure | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 6.5s |
| 2 | A Link to the Past | 6.0s |
| 3 | The Wind Waker | 4.9s |
| 4 | Links Awakening DX | 4.0s |
| 5 | Sonic Adventure 2 Battle | 4.0s |
| 6 | Dark Souls III | 4.0s |
| 7 | Mario & Luigi Superstar Saga | 4.0s |
| 8 | Timespinner | 3.8s |
| 9 | A Hat in Time | 3.8s |
| 10 | Yoshi's Island | 3.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 17.7s |
| 2 | A Hat in Time | 17.3s |
| 3 | A Link to the Past WorldGen 2 | 9.7s |
| 4 | A Link to the Past | 9.7s |
| 5 | Subnautica | 9.4s |
| 6 | The Messenger | 8.8s |
| 7 | DOOM II | 7.7s |
| 8 | Choo-Choo Charles | 7.7s |
| 9 | Terraria | 7.7s |
| 10 | Links Awakening DX | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.7s |
| 2 | A Hat in Time | 17.3s |
| 3 | A Link to the Past | 14.5s |
| 4 | Heretic | 14.5s |
| 5 | A Link to the Past WorldGen 2 | 14.3s |
| 6 | Shivers | 14.3s |
| 7 | MegaMan Battle Network 3 | 14.3s |
| 8 | Overcooked! 2 | 14.2s |
| 9 | shapez | 14.2s |
| 10 | DOOM II | 14.2s |
