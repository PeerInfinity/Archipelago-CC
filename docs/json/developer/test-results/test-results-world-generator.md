# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

**Generated:** 2026-01-12 20:54:11 UTC

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

**Total Templates:** 60

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 60 | 0 | 60 |
| Original Spoiler Test | 60 | 0 | 60 |
| Stage 1: World Generation | 60 | 0 | 60 |
| Stage 2: Seed Generation | 56 | 4 | 60 |
| Stage 3: Rules Comparison | 48 | 8 | 56 |
| Stage 4: WorldGen Spoiler Test | 55 | 1 | 56 |
| Stage 5: Cross-Validation | 55 | 1 | 56 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ❌ | - | - | - |
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

**Total Templates:** 60

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 60 | 0 | 60 |
| Original Spoiler Test | 60 | 0 | 60 |
| Stage 1: World Generation | 60 | 0 | 60 |
| Stage 2: Seed Generation | 56 | 4 | 60 |
| Stage 3: Rules Comparison | 0 | 56 | 56 |
| Stage 4: WorldGen Spoiler Test | 55 | 1 | 56 |
| Stage 5: Cross-Validation | 35 | 21 | 56 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
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
| Total | 232.0s | 407.2s | 5.7s | 204.3s | 356.3s | 354.3s |
| Average | 3.9s | 6.8s | 0.1s | 3.4s | 6.4s | 6.3s |
| Max | 10.3s | 18.9s | 0.2s | 6.1s | 14.2s | 14.3s |
| Min | 2.9s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.3s) | Dark Souls III (18.9s) | Castlevania 64 (0.2s) | Mario & Luigi Superstar Saga (6.1s) | Mega Man 2 (14.2s) | Mega Man 2 (14.3s) |
| Fastest | Coding Adventure (2.9s) | DLCQuest (5.6s) | Wargroove (0.1s) | Dark Souls III (2.6s) | Meritous (5.6s) | Inscryption (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 13.6s | 0.2s | 3.9s | 6.7s | 6.7s |
| A Link to the Past | 7.9s | 11.8s | 0.2s | 6.0s | 9.7s | 9.7s |
| A Short Hike | 3.6s | 6.1s | 0.2s | 3.1s | 5.7s | 5.6s |
| APQuest | 3.1s | 9.5s | 0.1s | 2.8s | 5.6s | 5.6s |
| Adventure | 3.1s | 8.5s | 0.1s | 2.9s | 5.6s | 5.6s |
| Aquaria | 4.3s | 6.3s | 0.2s | 3.4s | 5.6s | 5.6s |
| Baking Adventure | 3.1s | 6.4s | 0.1s | 3.1s | 5.6s | 5.7s |
| Bumper Stickers | 3.0s | 8.2s | 0.1s | 2.9s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.2s | 7.0s | 0.2s | 3.0s | 5.6s | 5.6s |
| Castlevania 64 | 5.3s | 7.2s | 0.2s | 5.2s | 6.0s | 5.9s |
| Celeste 64 | 3.0s | 5.6s | 0.1s | 3.1s | 5.8s | 5.7s |
| ChecksFinder | 3.1s | 5.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.5s | 7.6s | 0.1s | 3.1s | 7.7s | 7.7s |
| Civilization VI | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Coding Adventure | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| DLCQuest | 3.2s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| DOOM 1993 | 3.6s | 6.8s | 0.1s | 3.5s | 6.7s | 6.7s |
| DOOM II | 3.5s | 7.6s | 0.1s | 3.3s | 7.6s | 7.6s |
| Dark Souls III | 4.0s | 18.9s | 0.1s | 2.6s | - | - |
| Donkey Kong Country 3 | 4.8s | 7.0s | 0.1s | 4.5s | 7.0s | 6.0s |
| Factorio | 3.6s | 5.6s | 0.1s | 3.5s | 5.7s | 5.7s |
| Faxanadu | 3.0s | 5.6s | 0.1s | 3.1s | 5.7s | 5.6s |
| Final Fantasy Mystic Quest | 4.6s | 6.7s | 0.1s | 3.6s | 6.7s | 6.7s |
| Heretic | 3.6s | 7.7s | 0.1s | 3.3s | 7.6s | 7.6s |
| Hylics 2 | 3.2s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Inscryption | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.5s | 5.7s | 0.1s | 2.6s | - | - |
| Links Awakening DX | 7.3s | 7.7s | 0.1s | 3.8s | 7.6s | 7.7s |
| Lufia II Ancient Cave | 3.3s | 5.8s | 0.1s | 3.2s | 5.6s | 5.7s |
| Mario & Luigi Superstar Saga | 5.9s | 8.0s | 0.1s | 6.1s | 8.1s | 8.0s |
| Math Adventure | 2.9s | 5.6s | 0.1s | 3.0s | 5.7s | 5.6s |
| Mega Man 2 | 3.0s | 5.6s | 0.1s | 3.1s | 14.2s | 14.3s |
| MegaMan Battle Network 3 | 3.5s | 5.7s | 0.1s | 3.1s | 5.7s | 5.6s |
| Meritous | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Metamath | 10.3s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Noita | 3.1s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Old School Runescape | 3.7s | 5.6s | 0.1s | 3.4s | 5.6s | 5.6s |
| Overcooked! 2 | 3.3s | 7.7s | 0.1s | 3.3s | 7.7s | 7.6s |
| Paint | 4.6s | 6.2s | 0.1s | 4.6s | 6.0s | 5.9s |
| Risk of Rain 2 | 3.5s | 5.6s | 0.1s | 3.6s | 5.7s | 5.7s |
| Saving Princess | 3.0s | 5.6s | 0.1s | 3.1s | 5.7s | 5.7s |
| Shivers | 3.4s | 5.7s | 0.1s | 3.2s | 5.6s | 5.6s |
| Sonic Adventure 2 Battle | 4.5s | 5.7s | 0.1s | 4.0s | 6.6s | 5.6s |
| Subnautica | 3.6s | 9.7s | 0.1s | 3.4s | 9.6s | 9.6s |
| Super Mario 64 | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.7s | 5.7s | 0.1s | 2.7s | - | - |
| Super Mario World | 4.4s | 5.6s | 0.1s | 3.3s | 5.7s | 5.6s |
| TOEM original | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| TOEM rule builder | 4.6s | 6.0s | 0.1s | 4.2s | 5.9s | 5.9s |
| Terraria | 3.2s | 7.7s | 0.1s | 3.3s | 7.7s | 7.7s |
| The Legend of Zelda | 3.7s | 5.6s | 0.1s | 2.8s | - | - |
| The Messenger | 3.5s | 8.8s | 0.1s | 3.3s | 8.8s | 8.8s |
| The Wind Waker | 5.0s | 5.6s | 0.1s | 5.0s | 5.6s | 5.6s |
| Timespinner | 4.1s | 5.8s | 0.1s | 3.7s | 5.6s | 5.7s |
| Undertale | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 3.1s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Wargroove | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 4.0s | 6.6s | 0.1s | 3.9s | 5.6s | 5.7s |
| shapez | 6.0s | 6.0s | 0.1s | 4.4s | 6.0s | 5.9s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.3s |
| 2 | A Link to the Past | 7.9s |
| 3 | Links Awakening DX | 7.3s |
| 4 | shapez | 6.0s |
| 5 | Mario & Luigi Superstar Saga | 5.9s |
| 6 | Castlevania 64 | 5.3s |
| 7 | The Wind Waker | 5.0s |
| 8 | Donkey Kong Country 3 | 4.8s |
| 9 | TOEM rule builder | 4.6s |
| 10 | Final Fantasy Mystic Quest | 4.6s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.9s |
| 2 | A Hat in Time | 13.6s |
| 3 | A Link to the Past | 11.8s |
| 4 | Subnautica | 9.7s |
| 5 | APQuest | 9.5s |
| 6 | The Messenger | 8.8s |
| 7 | Adventure | 8.5s |
| 8 | Bumper Stickers | 8.2s |
| 9 | Mario & Luigi Superstar Saga | 8.0s |
| 10 | Terraria | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Castlevania 64 | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | A Hat in Time | 0.2s |
| 4 | A Short Hike | 0.2s |
| 5 | Aquaria | 0.2s |
| 6 | Castlevania - Circle of the Moon | 0.2s |
| 7 | APQuest | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Mario & Luigi Superstar Saga | 6.1s |
| 2 | A Link to the Past | 6.0s |
| 3 | Castlevania 64 | 5.2s |
| 4 | The Wind Waker | 5.0s |
| 5 | Paint | 4.6s |
| 6 | Donkey Kong Country 3 | 4.5s |
| 7 | shapez | 4.4s |
| 8 | TOEM rule builder | 4.2s |
| 9 | Sonic Adventure 2 Battle | 4.0s |
| 10 | A Hat in Time | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Mega Man 2 | 14.2s |
| 2 | A Link to the Past | 9.7s |
| 3 | Subnautica | 9.6s |
| 4 | The Messenger | 8.8s |
| 5 | Mario & Luigi Superstar Saga | 8.1s |
| 6 | Terraria | 7.7s |
| 7 | Choo-Choo Charles | 7.7s |
| 8 | Overcooked! 2 | 7.7s |
| 9 | DOOM II | 7.6s |
| 10 | Links Awakening DX | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Mega Man 2 | 14.3s |
| 2 | A Link to the Past | 9.7s |
| 3 | Subnautica | 9.6s |
| 4 | The Messenger | 8.8s |
| 5 | Mario & Luigi Superstar Saga | 8.0s |
| 6 | Terraria | 7.7s |
| 7 | Links Awakening DX | 7.7s |
| 8 | Choo-Choo Charles | 7.7s |
| 9 | Overcooked! 2 | 7.6s |
| 10 | DOOM II | 7.6s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 224.4s | 405.0s | 5.6s | 197.3s | 350.5s | 507.9s |
| Average | 3.7s | 6.7s | 0.1s | 3.3s | 6.3s | 9.1s |
| Max | 10.7s | 19.8s | 0.2s | 6.2s | 14.2s | 14.6s |
| Min | 2.8s | 5.5s | 0.1s | 2.5s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.7s) | Dark Souls III (19.8s) | A Link to the Past (0.2s) | A Link to the Past (6.2s) | Mega Man 2 (14.2s) | Subnautica (14.6s) |
| Fastest | TOEM rule builder (2.8s) | Donkey Kong Country 3 (5.5s) | shapez (0.1s) | Super Mario Land 2 (2.5s) | TOEM rule builder (5.4s) | TOEM rule builder (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.3s | 8.1s | 0.2s | 2.7s | - | - |
| A Link to the Past | 8.0s | 12.7s | 0.2s | 6.2s | 9.7s | 14.4s |
| A Short Hike | 3.2s | 7.4s | 0.1s | 3.0s | 5.6s | 5.6s |
| APQuest | 3.0s | 9.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.4s | 7.9s | 0.2s | 3.2s | 5.7s | 5.7s |
| Aquaria | 4.5s | 10.0s | 0.2s | 3.5s | 5.7s | 5.7s |
| Baking Adventure | 3.0s | 7.8s | 0.1s | 2.8s | 5.6s | 14.2s |
| Bumper Stickers | 3.2s | 8.4s | 0.2s | 3.1s | 5.6s | 14.2s |
| Castlevania - Circle of the Moon | 3.7s | 6.2s | 0.2s | 3.4s | 5.7s | 5.7s |
| Castlevania 64 | 3.5s | 6.0s | 0.1s | 3.4s | 5.4s | 5.4s |
| Celeste 64 | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| ChecksFinder | 2.9s | 5.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.1s | 7.7s | 0.1s | 3.1s | 7.6s | 7.7s |
| Civilization VI | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| Coding Adventure | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 14.4s |
| DLCQuest | 3.3s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| DOOM 1993 | 3.4s | 6.6s | 0.1s | 3.2s | 6.6s | 14.2s |
| DOOM II | 3.7s | 7.7s | 0.1s | 3.5s | 7.7s | 14.3s |
| Dark Souls III | 4.6s | 19.8s | 0.1s | 2.8s | - | - |
| Donkey Kong Country 3 | 3.0s | 5.5s | 0.1s | 3.0s | 5.4s | 13.8s |
| Factorio | 3.5s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Faxanadu | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| Final Fantasy Mystic Quest | 4.2s | 6.8s | 0.1s | 3.4s | 6.7s | 6.7s |
| Heretic | 3.5s | 7.6s | 0.1s | 3.4s | 7.6s | 14.2s |
| Hylics 2 | 3.4s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Inscryption | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.6s | 0.1s | 3.1s | 5.6s | 14.2s |
| Links Awakening DX | 7.7s | 7.8s | 0.1s | 4.3s | 7.7s | 7.8s |
| Lufia II Ancient Cave | 3.8s | 5.7s | 0.1s | 3.5s | 5.7s | 5.8s |
| Mario & Luigi Superstar Saga | 3.7s | 7.5s | 0.1s | 4.1s | 7.5s | 7.5s |
| Math Adventure | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 14.3s |
| Mega Man 2 | 3.0s | 5.6s | 0.1s | 3.0s | 14.2s | 14.2s |
| MegaMan Battle Network 3 | 3.2s | 5.6s | 0.1s | 3.0s | 5.6s | 14.3s |
| Meritous | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Metamath | 10.7s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Muse Dash | 3.2s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Noita | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Old School Runescape | 4.2s | 5.7s | 0.1s | 3.6s | 5.6s | 5.7s |
| Overcooked! 2 | 3.7s | 7.8s | 0.1s | 3.7s | 7.7s | 14.4s |
| Paint | 2.9s | 5.7s | 0.1s | 2.9s | 5.5s | 5.5s |
| Risk of Rain 2 | 3.4s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Saving Princess | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Shivers | 3.2s | 5.6s | 0.1s | 3.1s | 5.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.4s | 5.6s | 0.1s | 2.5s | - | - |
| Subnautica | 3.9s | 9.7s | 0.1s | 3.8s | 9.8s | 14.6s |
| Super Mario 64 | 3.3s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.5s | 5.7s | 0.1s | 2.5s | - | - |
| Super Mario World | 4.8s | 5.7s | 0.1s | 3.5s | 5.6s | 5.6s |
| TOEM original | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.6s |
| TOEM rule builder | 2.8s | 5.5s | 0.1s | 2.9s | 5.4s | 5.4s |
| Terraria | 3.1s | 7.7s | 0.1s | 3.1s | 7.7s | 7.6s |
| The Legend of Zelda | 3.8s | 5.6s | 0.1s | 3.1s | 5.6s | 14.3s |
| The Messenger | 3.3s | 8.8s | 0.1s | 3.2s | 8.8s | 8.8s |
| The Wind Waker | 4.9s | 5.7s | 0.1s | 5.1s | 5.6s | 14.2s |
| Timespinner | 4.6s | 5.9s | 0.1s | 4.4s | 5.7s | 5.7s |
| Undertale | 3.4s | 5.6s | 0.1s | 3.1s | 5.7s | 5.6s |
| VVVVVV | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 3.4s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Yoshi's Island | 4.1s | 6.7s | 0.1s | 4.0s | 5.6s | 5.6s |
| shapez | 3.7s | 5.5s | 0.1s | 3.0s | 5.5s | 13.9s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.7s |
| 2 | A Link to the Past | 8.0s |
| 3 | Links Awakening DX | 7.7s |
| 4 | The Wind Waker | 4.9s |
| 5 | Super Mario World | 4.8s |
| 6 | Dark Souls III | 4.6s |
| 7 | Timespinner | 4.6s |
| 8 | Aquaria | 4.5s |
| 9 | Sonic Adventure 2 Battle | 4.4s |
| 10 | A Hat in Time | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 19.8s |
| 2 | A Link to the Past | 12.7s |
| 3 | Aquaria | 10.0s |
| 4 | Subnautica | 9.7s |
| 5 | APQuest | 9.7s |
| 6 | The Messenger | 8.8s |
| 7 | Bumper Stickers | 8.4s |
| 8 | A Hat in Time | 8.1s |
| 9 | Adventure | 7.9s |
| 10 | Links Awakening DX | 7.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | Aquaria | 0.2s |
| 3 | Castlevania - Circle of the Moon | 0.2s |
| 4 | A Hat in Time | 0.2s |
| 5 | Adventure | 0.2s |
| 6 | Bumper Stickers | 0.2s |
| 7 | A Short Hike | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.2s |
| 2 | The Wind Waker | 5.1s |
| 3 | Timespinner | 4.4s |
| 4 | Links Awakening DX | 4.3s |
| 5 | Mario & Luigi Superstar Saga | 4.1s |
| 6 | Yoshi's Island | 4.0s |
| 7 | Subnautica | 3.8s |
| 8 | Overcooked! 2 | 3.7s |
| 9 | Old School Runescape | 3.6s |
| 10 | Aquaria | 3.5s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Mega Man 2 | 14.2s |
| 2 | Subnautica | 9.8s |
| 3 | A Link to the Past | 9.7s |
| 4 | The Messenger | 8.8s |
| 5 | Overcooked! 2 | 7.7s |
| 6 | Links Awakening DX | 7.7s |
| 7 | DOOM II | 7.7s |
| 8 | Terraria | 7.7s |
| 9 | Choo-Choo Charles | 7.6s |
| 10 | Heretic | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 14.6s |
| 2 | Overcooked! 2 | 14.4s |
| 3 | A Link to the Past | 14.4s |
| 4 | Coding Adventure | 14.4s |
| 5 | Math Adventure | 14.3s |
| 6 | DOOM II | 14.3s |
| 7 | Shivers | 14.3s |
| 8 | MegaMan Battle Network 3 | 14.3s |
| 9 | The Legend of Zelda | 14.3s |
| 10 | Heretic | 14.2s |
