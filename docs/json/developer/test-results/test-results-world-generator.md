# World Generator Test Results

**Generated:** 2026-01-07 04:52:31 UTC

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
| Stage 3: Rules Comparison | 46 | 10 | 56 |
| Stage 4: WorldGen Spoiler Test | 56 | 0 | 56 |
| Stage 5: Cross-Validation | 48 | 8 | 56 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

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
| Stage 4: WorldGen Spoiler Test | 56 | 0 | 56 |
| Stage 5: Cross-Validation | 29 | 27 | 56 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Total | 226.0s | 396.8s | 5.4s | 196.6s | 355.3s | 421.4s |
| Average | 3.7s | 6.5s | 0.1s | 3.2s | 6.3s | 7.5s |
| Max | 10.3s | 18.7s | 0.2s | 4.2s | 18.7s | 18.7s |
| Min | 2.9s | 5.6s | 0.1s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.3s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | Timespinner (4.2s) | Dark Souls III (18.7s) | Dark Souls III (18.7s) |
| Fastest | Meritous (2.9s) | Wargroove (5.6s) | shapez (0.1s) | The Wind Waker (2.5s) | Meritous (5.6s) | TOEM rule builder (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.3s | 8.1s | 0.1s | 3.8s | 6.6s | 6.6s |
| A Link to the Past | 7.7s | 9.1s | 0.2s | 2.6s | - | - |
| A Link to the Past WorldGen 2 | 6.2s | 10.4s | 0.2s | 2.7s | - | - |
| A Short Hike | 3.3s | 6.0s | 0.1s | 3.3s | 5.7s | 5.7s |
| APQuest | 3.0s | 6.6s | 0.1s | 2.9s | 5.7s | 5.6s |
| Adventure | 3.3s | 6.7s | 0.1s | 3.0s | 5.6s | 5.7s |
| Aquaria | 4.3s | 6.5s | 0.1s | 3.4s | 5.6s | 5.6s |
| Baking Adventure | 3.0s | 6.5s | 0.1s | 2.9s | 5.6s | 5.6s |
| Bumper Stickers | 3.1s | 6.5s | 0.1s | 3.0s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.3s | 6.5s | 0.1s | 3.1s | 5.6s | 5.6s |
| Castlevania 64 | 3.3s | 5.6s | 0.1s | 3.4s | 5.6s | 5.7s |
| Celeste 64 | 3.1s | 5.8s | 0.1s | 3.1s | 5.6s | 5.6s |
| ChecksFinder | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.2s | 7.7s | 0.1s | 3.4s | 7.7s | 7.7s |
| Civilization VI | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Coding Adventure | 3.0s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| DLCQuest | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| DOOM 1993 | 3.4s | 6.6s | 0.1s | 3.3s | 6.7s | 14.5s |
| DOOM II | 3.5s | 7.7s | 0.1s | 3.4s | 7.7s | 7.7s |
| Dark Souls III | 4.2s | 18.7s | 0.1s | 4.2s | 18.7s | 18.7s |
| Donkey Kong Country 3 | 3.1s | 5.6s | 0.1s | 3.1s | 5.7s | 14.3s |
| Factorio | 3.7s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| Faxanadu | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Final Fantasy Mystic Quest | 4.3s | 6.7s | 0.1s | 3.8s | 6.7s | 6.7s |
| Heretic | 3.5s | 7.6s | 0.1s | 3.4s | 7.6s | 7.6s |
| Hylics 2 | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Inscryption | 3.0s | 5.6s | 0.1s | 3.1s | 5.7s | 14.3s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.6s | 0.1s | 3.4s | 6.7s | 5.6s |
| Links Awakening DX | 7.6s | 7.8s | 0.1s | 4.0s | 7.7s | 7.7s |
| Lufia II Ancient Cave | 3.3s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 6.6s | 0.1s | 4.0s | 7.6s | 7.6s |
| Math Adventure | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Mega Man 2 | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.3s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Meritous | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.7s |
| Metamath | 10.3s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| Muse Dash | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Noita | 2.9s | 5.6s | 0.1s | 3.1s | 5.7s | 14.3s |
| Old School Runescape | 3.9s | 5.6s | 0.1s | 2.6s | - | - |
| Overcooked! 2 | 3.4s | 7.7s | 0.1s | 3.3s | 7.7s | 7.7s |
| Paint | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.5s | 5.7s | 0.1s | 3.4s | 5.6s | 14.2s |
| Saving Princess | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Shivers | 3.3s | 5.8s | 0.1s | 3.4s | 5.7s | 5.6s |
| Sonic Adventure 2 Battle | 4.3s | 5.6s | 0.1s | 4.0s | 6.6s | 14.1s |
| Subnautica | 3.7s | 9.8s | 0.1s | 3.7s | 9.7s | 9.7s |
| Super Mario 64 | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.5s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Super Mario World | 4.5s | 5.6s | 0.1s | 3.4s | 5.6s | 14.2s |
| TOEM original | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| TOEM rule builder | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Terraria | 3.2s | 7.7s | 0.1s | 3.1s | 7.6s | 7.7s |
| The Legend of Zelda | 3.7s | 5.6s | 0.1s | 3.1s | 5.7s | 5.8s |
| The Messenger | 3.4s | 8.8s | 0.1s | 3.3s | 8.7s | 8.7s |
| The Wind Waker | 4.8s | 5.6s | 0.1s | 2.5s | - | - |
| Timespinner | 4.0s | 5.7s | 0.1s | 4.2s | 5.8s | 14.5s |
| Undertale | 3.2s | 5.6s | 0.1s | 2.7s | - | - |
| VVVVVV | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Yoshi's Island | 4.0s | 6.6s | 0.1s | 3.9s | 5.6s | 5.6s |
| shapez | 3.8s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.3s |
| 2 | A Link to the Past | 7.7s |
| 3 | Links Awakening DX | 7.6s |
| 4 | A Link to the Past WorldGen 2 | 6.2s |
| 5 | The Wind Waker | 4.8s |
| 6 | Super Mario World | 4.5s |
| 7 | Sonic Adventure 2 Battle | 4.3s |
| 8 | A Hat in Time | 4.3s |
| 9 | Final Fantasy Mystic Quest | 4.3s |
| 10 | Aquaria | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past WorldGen 2 | 10.4s |
| 3 | Subnautica | 9.8s |
| 4 | A Link to the Past | 9.1s |
| 5 | The Messenger | 8.8s |
| 6 | A Hat in Time | 8.1s |
| 7 | Links Awakening DX | 7.8s |
| 8 | Overcooked! 2 | 7.7s |
| 9 | Choo-Choo Charles | 7.7s |
| 10 | DOOM II | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | Castlevania - Circle of the Moon | 0.1s |
| 6 | A Short Hike | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Timespinner | 4.2s |
| 2 | Dark Souls III | 4.2s |
| 3 | Sonic Adventure 2 Battle | 4.0s |
| 4 | Links Awakening DX | 4.0s |
| 5 | Mario & Luigi Superstar Saga | 4.0s |
| 6 | Yoshi's Island | 3.9s |
| 7 | Final Fantasy Mystic Quest | 3.8s |
| 8 | A Hat in Time | 3.8s |
| 9 | Subnautica | 3.7s |
| 10 | Super Mario Land 2 | 3.6s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | Subnautica | 9.7s |
| 3 | The Messenger | 8.7s |
| 4 | Overcooked! 2 | 7.7s |
| 5 | Choo-Choo Charles | 7.7s |
| 6 | Links Awakening DX | 7.7s |
| 7 | DOOM II | 7.7s |
| 8 | Terraria | 7.6s |
| 9 | Heretic | 7.6s |
| 10 | Mario & Luigi Superstar Saga | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | DOOM 1993 | 14.5s |
| 3 | Timespinner | 14.5s |
| 4 | Noita | 14.3s |
| 5 | Donkey Kong Country 3 | 14.3s |
| 6 | Inscryption | 14.3s |
| 7 | Risk of Rain 2 | 14.2s |
| 8 | Super Mario World | 14.2s |
| 9 | Sonic Adventure 2 Battle | 14.1s |
| 10 | Subnautica | 9.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 228.7s | 404.8s | 5.4s | 198.9s | 353.9s | 579.3s |
| Average | 3.7s | 6.6s | 0.1s | 3.3s | 6.3s | 10.3s |
| Max | 10.2s | 18.7s | 0.2s | 4.7s | 17.8s | 32.7s |
| Min | 2.9s | 5.5s | 0.1s | 2.5s | 5.5s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.2s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | Sonic Adventure 2 Battle (4.7s) | Dark Souls III (17.8s) | Dark Souls III (32.7s) |
| Fastest | Coding Adventure (2.9s) | Metamath (5.5s) | Wargroove (0.1s) | Old School Runescape (2.5s) | Hylics 2 (5.5s) | Adventure (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 9.1s | 0.1s | 4.3s | 6.7s | 6.7s |
| A Link to the Past | 7.6s | 10.4s | 0.2s | 2.6s | - | - |
| A Link to the Past WorldGen 2 | 6.4s | 10.4s | 0.2s | 2.7s | - | - |
| A Short Hike | 3.1s | 6.9s | 0.1s | 3.0s | 5.6s | 5.6s |
| APQuest | 3.2s | 7.9s | 0.1s | 3.1s | 5.7s | 5.6s |
| Adventure | 3.1s | 6.6s | 0.1s | 3.0s | 5.6s | 5.4s |
| Aquaria | 4.1s | 6.7s | 0.1s | 3.3s | 5.7s | 5.6s |
| Baking Adventure | 3.2s | 8.0s | 0.1s | 3.1s | 5.7s | 14.2s |
| Bumper Stickers | 3.2s | 7.4s | 0.1s | 3.0s | 5.6s | 14.1s |
| Castlevania - Circle of the Moon | 3.2s | 7.1s | 0.1s | 3.0s | 5.6s | 5.6s |
| Castlevania 64 | 3.5s | 5.8s | 0.1s | 3.7s | 5.7s | 5.7s |
| Celeste 64 | 3.4s | 5.8s | 0.1s | 3.2s | 5.7s | 14.5s |
| ChecksFinder | 2.9s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Choo-Choo Charles | 3.1s | 7.6s | 0.1s | 3.2s | 7.6s | 7.6s |
| Civilization VI | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 14.3s |
| Coding Adventure | 2.9s | 5.5s | 0.1s | 2.9s | 5.5s | 13.9s |
| DLCQuest | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.7s |
| DOOM 1993 | 3.7s | 6.7s | 0.1s | 3.4s | 6.7s | 14.4s |
| DOOM II | 3.7s | 7.7s | 0.1s | 3.5s | 7.7s | 14.2s |
| Dark Souls III | 4.0s | 18.7s | 0.1s | 4.1s | 17.8s | 32.7s |
| Donkey Kong Country 3 | 3.2s | 5.7s | 0.1s | 3.3s | 5.7s | 14.2s |
| Factorio | 3.9s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Faxanadu | 3.0s | 5.7s | 0.1s | 3.1s | 5.7s | 14.3s |
| Final Fantasy Mystic Quest | 4.2s | 6.8s | 0.1s | 3.6s | 6.6s | 6.7s |
| Heretic | 3.8s | 7.7s | 0.1s | 3.7s | 7.7s | 14.5s |
| Hylics 2 | 3.1s | 5.5s | 0.1s | 3.0s | 5.5s | 5.5s |
| Inscryption | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| Landstalker - The Treasures of King Nole | 3.5s | 5.6s | 0.1s | 3.5s | 6.7s | 14.3s |
| Links Awakening DX | 7.7s | 7.7s | 0.1s | 4.0s | 7.7s | 7.6s |
| Lufia II Ancient Cave | 3.2s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.9s | 6.7s | 0.1s | 4.0s | 7.6s | 7.6s |
| Math Adventure | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 14.3s |
| Mega Man 2 | 3.0s | 5.6s | 0.1s | 3.1s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 3.2s | 5.7s | 0.1s | 3.0s | 5.6s | 14.2s |
| Meritous | 3.0s | 5.8s | 0.1s | 3.2s | 5.6s | 5.6s |
| Metamath | 10.2s | 5.5s | 0.1s | 2.9s | 5.5s | 5.5s |
| Muse Dash | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| Noita | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 14.3s |
| Old School Runescape | 4.0s | 5.8s | 0.1s | 2.5s | - | - |
| Overcooked! 2 | 3.4s | 7.6s | 0.1s | 3.3s | 7.6s | 14.2s |
| Paint | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.7s |
| Risk of Rain 2 | 3.6s | 5.7s | 0.1s | 3.7s | 5.7s | 14.3s |
| Saving Princess | 3.0s | 5.7s | 0.1s | 3.1s | 5.7s | 14.3s |
| Shivers | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 14.2s |
| Sonic Adventure 2 Battle | 4.5s | 5.7s | 0.1s | 4.7s | 6.7s | 14.3s |
| Subnautica | 3.5s | 9.5s | 0.1s | 3.4s | 9.5s | 13.9s |
| Super Mario 64 | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.7s | 5.7s | 0.1s | 3.6s | 5.8s | 5.7s |
| Super Mario World | 4.7s | 5.6s | 0.1s | 3.4s | 5.6s | 14.2s |
| TOEM original | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| TOEM rule builder | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Terraria | 3.2s | 7.7s | 0.1s | 3.3s | 7.7s | 7.8s |
| The Legend of Zelda | 3.7s | 5.7s | 0.1s | 3.3s | 5.7s | 14.4s |
| The Messenger | 3.3s | 8.8s | 0.1s | 3.3s | 8.7s | 8.7s |
| The Wind Waker | 5.0s | 5.6s | 0.1s | 2.6s | - | - |
| Timespinner | 4.2s | 5.5s | 0.1s | 3.9s | 5.6s | 14.0s |
| Undertale | 3.0s | 5.6s | 0.1s | 2.6s | - | - |
| VVVVVV | 3.2s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Wargroove | 3.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 3.8s | 6.6s | 0.1s | 3.8s | 5.6s | 5.6s |
| shapez | 4.0s | 5.7s | 0.1s | 3.3s | 5.6s | 14.2s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.2s |
| 2 | Links Awakening DX | 7.7s |
| 3 | A Link to the Past | 7.6s |
| 4 | A Link to the Past WorldGen 2 | 6.4s |
| 5 | The Wind Waker | 5.0s |
| 6 | Super Mario World | 4.7s |
| 7 | A Hat in Time | 4.5s |
| 8 | Sonic Adventure 2 Battle | 4.5s |
| 9 | Timespinner | 4.2s |
| 10 | Final Fantasy Mystic Quest | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past WorldGen 2 | 10.4s |
| 3 | A Link to the Past | 10.4s |
| 4 | Subnautica | 9.5s |
| 5 | A Hat in Time | 9.1s |
| 6 | The Messenger | 8.8s |
| 7 | Baking Adventure | 8.0s |
| 8 | APQuest | 7.9s |
| 9 | Heretic | 7.7s |
| 10 | Terraria | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Baking Adventure | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Sonic Adventure 2 Battle | 4.7s |
| 2 | A Hat in Time | 4.3s |
| 3 | Dark Souls III | 4.1s |
| 4 | Links Awakening DX | 4.0s |
| 5 | Mario & Luigi Superstar Saga | 4.0s |
| 6 | Timespinner | 3.9s |
| 7 | Yoshi's Island | 3.8s |
| 8 | Risk of Rain 2 | 3.7s |
| 9 | Heretic | 3.7s |
| 10 | Castlevania 64 | 3.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 17.8s |
| 2 | Subnautica | 9.5s |
| 3 | The Messenger | 8.7s |
| 4 | Heretic | 7.7s |
| 5 | DOOM II | 7.7s |
| 6 | Terraria | 7.7s |
| 7 | Links Awakening DX | 7.7s |
| 8 | Choo-Choo Charles | 7.6s |
| 9 | Mario & Luigi Superstar Saga | 7.6s |
| 10 | Overcooked! 2 | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.7s |
| 2 | Celeste 64 | 14.5s |
| 3 | Heretic | 14.5s |
| 4 | DOOM 1993 | 14.4s |
| 5 | The Legend of Zelda | 14.4s |
| 6 | Landstalker - The Treasures of King Nole | 14.3s |
| 7 | Civilization VI | 14.3s |
| 8 | Noita | 14.3s |
| 9 | Risk of Rain 2 | 14.3s |
| 10 | Faxanadu | 14.3s |
