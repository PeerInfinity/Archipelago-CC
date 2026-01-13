# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

**Generated:** 2026-01-12 22:25:48 UTC

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
| Stage 2: Seed Generation | 58 | 2 | 60 |
| Stage 3: Rules Comparison | 56 | 2 | 58 |
| Stage 4: WorldGen Spoiler Test | 58 | 0 | 58 |
| Stage 5: Cross-Validation | 55 | 3 | 58 |

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
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ❌ | - | - | - |
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

**Total Templates:** 60

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 60 | 0 | 60 |
| Original Spoiler Test | 60 | 0 | 60 |
| Stage 1: World Generation | 60 | 0 | 60 |
| Stage 2: Seed Generation | 60 | 0 | 60 |
| Stage 3: Rules Comparison | 0 | 60 | 60 |
| Stage 4: WorldGen Spoiler Test | 60 | 0 | 60 |
| Stage 5: Cross-Validation | 38 | 22 | 60 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Total | 222.7s | 400.0s | 5.5s | 199.0s | 368.5s | 393.5s |
| Average | 3.7s | 6.7s | 0.1s | 3.3s | 6.4s | 6.8s |
| Max | 11.5s | 18.7s | 0.2s | 6.0s | 18.7s | 18.7s |
| Min | 2.8s | 5.5s | 0.1s | 2.6s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.5s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | A Link to the Past (6.0s) | Dark Souls III (18.7s) | Dark Souls III (18.7s) |
| Fastest | ChecksFinder (2.8s) | Saving Princess (5.5s) | Wargroove (0.1s) | Muse Dash (2.6s) | ChecksFinder (5.5s) | ChecksFinder (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 10.7s | 0.2s | 3.8s | 6.7s | 6.7s |
| A Link to the Past | 7.5s | 10.6s | 0.2s | 6.0s | 9.5s | 9.6s |
| A Short Hike | 3.3s | 7.8s | 0.1s | 3.3s | 5.8s | 5.6s |
| APQuest | 3.2s | 6.7s | 0.2s | 3.0s | 5.8s | 5.6s |
| Adventure | 3.3s | 6.9s | 0.2s | 3.3s | 5.7s | 5.7s |
| Aquaria | 4.4s | 7.0s | 0.2s | 3.6s | 5.7s | 5.7s |
| Baking Adventure | 3.0s | 9.0s | 0.1s | 2.9s | 5.6s | 5.6s |
| Bumper Stickers | 3.1s | 7.2s | 0.1s | 3.0s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.2s | 7.2s | 0.1s | 3.1s | 5.6s | 5.6s |
| Castlevania 64 | 3.7s | 7.8s | 0.2s | 3.5s | 5.6s | 5.6s |
| Celeste 64 | 3.1s | 5.6s | 0.1s | 3.1s | 5.8s | 5.6s |
| ChecksFinder | 2.8s | 5.6s | 0.1s | 2.8s | 5.5s | 5.5s |
| Choo-Choo Charles | 3.2s | 7.7s | 0.1s | 3.2s | 7.7s | 7.7s |
| Civilization VI | 3.1s | 5.7s | 0.1s | 3.0s | 5.7s | 5.6s |
| Coding Adventure | 3.0s | 5.7s | 0.1s | 3.1s | 5.7s | 5.6s |
| DLCQuest | 3.3s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| DOOM 1993 | 3.4s | 6.6s | 0.1s | 3.3s | 6.6s | 6.8s |
| DOOM II | 3.5s | 7.6s | 0.1s | 3.3s | 7.7s | 7.7s |
| Dark Souls III | 4.0s | 18.7s | 0.1s | 4.1s | 18.7s | 18.7s |
| Donkey Kong Country 3 | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Factorio | 3.6s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| Faxanadu | 2.9s | 5.5s | 0.1s | 2.9s | 5.5s | 13.9s |
| Final Fantasy Mystic Quest | 4.3s | 6.7s | 0.1s | 3.5s | 6.7s | 6.7s |
| Heretic | 3.7s | 7.7s | 0.1s | 3.5s | 7.7s | 7.7s |
| Hylics 2 | 3.4s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Inscryption | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.6s | 0.1s | 3.1s | 5.6s | 14.4s |
| Links Awakening DX | 7.6s | 7.7s | 0.1s | 3.9s | 7.7s | 7.7s |
| Lufia II Ancient Cave | 3.3s | 5.7s | 0.1s | 3.2s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.8s | 7.6s | 0.1s | 4.4s | 7.6s | 7.7s |
| Math Adventure | 2.9s | 5.6s | 0.1s | 3.0s | 5.7s | 5.7s |
| Mega Man 2 | 3.0s | 5.5s | 0.1s | 3.0s | 5.5s | 5.5s |
| MegaMan Battle Network 3 | 3.3s | 5.7s | 0.1s | 3.1s | 5.7s | 5.6s |
| Meritous | 3.2s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Metamath | 11.5s | 5.7s | 0.1s | 3.1s | 5.8s | 5.7s |
| Muse Dash | 3.1s | 5.7s | 0.1s | 2.6s | - | - |
| Noita | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Old School Runescape | 3.8s | 5.6s | 0.1s | 3.4s | 5.6s | 5.7s |
| Overcooked! 2 | 3.2s | 7.7s | 0.1s | 3.3s | 7.7s | 7.7s |
| Paint | 3.0s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.6s | 5.6s | 0.1s | 3.5s | 5.7s | 5.7s |
| Saving Princess | 2.9s | 5.5s | 0.1s | 2.9s | 5.5s | 13.9s |
| Shivers | 3.3s | 5.7s | 0.1s | 3.2s | 5.6s | 5.7s |
| Sonic Adventure 2 Battle | 4.5s | 5.6s | 0.1s | 2.6s | - | - |
| Subnautica | 3.8s | 9.7s | 0.1s | 3.8s | 9.7s | 9.8s |
| Super Mario 64 | 3.1s | 5.6s | 0.1s | 3.1s | 5.7s | 5.6s |
| Super Mario Land 2 | 3.6s | 5.7s | 0.1s | 3.8s | 5.7s | 5.6s |
| Super Mario World | 4.6s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| TOEM original | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| TOEM rule builder | 3.0s | 5.8s | 0.1s | 3.0s | 5.7s | 5.6s |
| Terraria | 3.2s | 7.7s | 0.1s | 3.2s | 7.7s | 7.7s |
| The Legend of Zelda | 3.6s | 5.5s | 0.1s | 3.0s | 5.5s | 5.5s |
| The Messenger | 3.4s | 8.9s | 0.1s | 3.3s | 8.9s | 8.8s |
| The Wind Waker | 5.1s | 5.7s | 0.1s | 5.3s | 5.6s | 5.7s |
| Timespinner | 4.2s | 5.7s | 0.1s | 4.2s | 5.7s | 5.7s |
| Undertale | 3.2s | 5.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| VVVVVV | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Yoshi's Island | 4.0s | 6.7s | 0.1s | 3.9s | 5.7s | 5.6s |
| shapez | 4.0s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.5s |
| 2 | Links Awakening DX | 7.6s |
| 3 | A Link to the Past | 7.5s |
| 4 | The Wind Waker | 5.1s |
| 5 | Super Mario World | 4.6s |
| 6 | Sonic Adventure 2 Battle | 4.5s |
| 7 | A Hat in Time | 4.5s |
| 8 | Aquaria | 4.4s |
| 9 | Final Fantasy Mystic Quest | 4.3s |
| 10 | Timespinner | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Hat in Time | 10.7s |
| 3 | A Link to the Past | 10.6s |
| 4 | Subnautica | 9.7s |
| 5 | Baking Adventure | 9.0s |
| 6 | The Messenger | 8.9s |
| 7 | A Short Hike | 7.8s |
| 8 | Castlevania 64 | 7.8s |
| 9 | Choo-Choo Charles | 7.7s |
| 10 | Heretic | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.2s |
| 3 | APQuest | 0.2s |
| 4 | Adventure | 0.2s |
| 5 | Aquaria | 0.2s |
| 6 | Castlevania 64 | 0.2s |
| 7 | A Short Hike | 0.1s |
| 8 | Baking Adventure | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.0s |
| 2 | The Wind Waker | 5.3s |
| 3 | Mario & Luigi Superstar Saga | 4.4s |
| 4 | Timespinner | 4.2s |
| 5 | Dark Souls III | 4.1s |
| 6 | Yoshi's Island | 3.9s |
| 7 | Links Awakening DX | 3.9s |
| 8 | A Hat in Time | 3.8s |
| 9 | Subnautica | 3.8s |
| 10 | Super Mario Land 2 | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | Subnautica | 9.7s |
| 3 | A Link to the Past | 9.5s |
| 4 | The Messenger | 8.9s |
| 5 | Links Awakening DX | 7.7s |
| 6 | Overcooked! 2 | 7.7s |
| 7 | Heretic | 7.7s |
| 8 | Choo-Choo Charles | 7.7s |
| 9 | Terraria | 7.7s |
| 10 | DOOM II | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | Landstalker - The Treasures of King Nole | 14.4s |
| 3 | Faxanadu | 13.9s |
| 4 | Saving Princess | 13.9s |
| 5 | Subnautica | 9.8s |
| 6 | A Link to the Past | 9.6s |
| 7 | The Messenger | 8.8s |
| 8 | Heretic | 7.7s |
| 9 | Links Awakening DX | 7.7s |
| 10 | Terraria | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 222.2s | 400.8s | 5.6s | 202.2s | 378.2s | 558.6s |
| Average | 3.7s | 6.7s | 0.1s | 3.4s | 6.3s | 9.3s |
| Max | 11.0s | 18.8s | 0.2s | 5.5s | 17.7s | 32.8s |
| Min | 2.6s | 5.4s | 0.1s | 2.6s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.0s) | Dark Souls III (18.8s) | A Hat in Time (0.2s) | A Link to the Past (5.5s) | Dark Souls III (17.7s) | Dark Souls III (32.8s) |
| Fastest | ChecksFinder (2.6s) | Mega Man 2 (5.4s) | ChecksFinder (0.1s) | ChecksFinder (2.6s) | Mega Man 2 (5.5s) | Mega Man 2 (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.6s | 7.2s | 0.2s | 4.1s | 6.6s | 6.7s |
| A Link to the Past | 7.1s | 10.8s | 0.2s | 5.5s | 9.5s | 14.2s |
| A Short Hike | 3.3s | 8.5s | 0.2s | 3.1s | 5.7s | 5.6s |
| APQuest | 3.1s | 7.7s | 0.1s | 3.0s | 5.7s | 5.6s |
| Adventure | 3.3s | 6.5s | 0.2s | 3.1s | 5.6s | 5.7s |
| Aquaria | 4.4s | 7.9s | 0.2s | 3.4s | 5.7s | 5.6s |
| Baking Adventure | 3.0s | 8.8s | 0.1s | 3.0s | 5.6s | 14.2s |
| Bumper Stickers | 3.1s | 6.1s | 0.1s | 2.9s | 5.6s | 14.1s |
| Castlevania - Circle of the Moon | 3.2s | 8.2s | 0.2s | 3.3s | 5.7s | 5.7s |
| Castlevania 64 | 3.8s | 9.9s | 0.2s | 3.6s | 5.6s | 5.7s |
| Celeste 64 | 3.1s | 5.6s | 0.1s | 3.2s | 5.6s | 14.2s |
| ChecksFinder | 2.6s | 5.6s | 0.1s | 2.6s | 5.5s | 5.5s |
| Choo-Choo Charles | 3.2s | 7.7s | 0.1s | 3.2s | 7.7s | 7.7s |
| Civilization VI | 3.0s | 5.7s | 0.1s | 3.1s | 5.6s | 14.2s |
| Coding Adventure | 3.0s | 5.6s | 0.1s | 3.0s | 5.7s | 14.2s |
| DLCQuest | 3.2s | 5.6s | 0.1s | 3.0s | 5.7s | 5.8s |
| DOOM 1993 | 3.5s | 6.6s | 0.1s | 3.5s | 6.7s | 14.2s |
| DOOM II | 3.4s | 7.6s | 0.1s | 3.4s | 7.6s | 14.2s |
| Dark Souls III | 4.1s | 18.8s | 0.1s | 4.3s | 17.7s | 32.8s |
| Donkey Kong Country 3 | 3.4s | 5.7s | 0.1s | 3.4s | 5.7s | 14.2s |
| Factorio | 3.7s | 5.8s | 0.1s | 3.5s | 5.6s | 5.6s |
| Faxanadu | 2.7s | 5.5s | 0.1s | 2.7s | 5.5s | 13.8s |
| Final Fantasy Mystic Quest | 4.3s | 6.7s | 0.1s | 3.7s | 6.7s | 6.7s |
| Heretic | 3.6s | 7.7s | 0.1s | 3.5s | 7.7s | 14.3s |
| Hylics 2 | 3.3s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| Inscryption | 3.0s | 5.6s | 0.1s | 3.0s | 5.7s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.5s | 5.6s | 0.1s | 3.2s | 5.6s | 14.3s |
| Links Awakening DX | 7.4s | 7.6s | 0.1s | 4.0s | 7.6s | 7.7s |
| Lufia II Ancient Cave | 3.3s | 5.6s | 0.1s | 3.5s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 4.0s | 7.7s | 0.1s | 4.4s | 7.7s | 7.7s |
| Math Adventure | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| Mega Man 2 | 2.7s | 5.4s | 0.1s | 2.6s | 5.5s | 5.5s |
| MegaMan Battle Network 3 | 3.4s | 5.7s | 0.1s | 3.1s | 5.7s | 14.3s |
| Meritous | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Metamath | 11.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 3.0s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Noita | 3.1s | 5.8s | 0.1s | 3.1s | 5.6s | 5.6s |
| Old School Runescape | 3.8s | 5.6s | 0.1s | 3.5s | 5.7s | 5.6s |
| Overcooked! 2 | 3.3s | 7.7s | 0.1s | 3.4s | 7.7s | 14.4s |
| Paint | 3.1s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.5s | 5.7s | 0.1s | 3.5s | 5.6s | 5.6s |
| Saving Princess | 2.7s | 5.5s | 0.1s | 2.7s | 5.5s | 5.5s |
| Shivers | 3.4s | 5.7s | 0.1s | 3.2s | 5.6s | 14.3s |
| Sonic Adventure 2 Battle | 4.7s | 5.7s | 0.1s | 4.4s | 5.7s | 14.3s |
| Subnautica | 3.8s | 9.8s | 0.1s | 3.6s | 9.7s | 14.2s |
| Super Mario 64 | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.6s | 5.7s | 0.1s | 3.8s | 5.7s | 5.7s |
| Super Mario World | 4.4s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| TOEM original | 3.1s | 5.6s | 0.1s | 3.0s | 5.7s | 5.7s |
| TOEM rule builder | 3.2s | 5.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| Terraria | 3.2s | 7.8s | 0.1s | 3.2s | 7.6s | 7.6s |
| The Legend of Zelda | 3.6s | 5.5s | 0.1s | 2.8s | 5.5s | 13.9s |
| The Messenger | 3.4s | 8.8s | 0.1s | 3.3s | 8.8s | 8.8s |
| The Wind Waker | 5.1s | 5.7s | 0.1s | 5.5s | 5.7s | 14.4s |
| Timespinner | 4.2s | 5.7s | 0.1s | 3.9s | 5.6s | 5.6s |
| Undertale | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 3.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 4.4s | 6.7s | 0.1s | 4.2s | 5.7s | 5.7s |
| shapez | 4.3s | 5.7s | 0.1s | 3.3s | 5.7s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.0s |
| 2 | Links Awakening DX | 7.4s |
| 3 | A Link to the Past | 7.1s |
| 4 | The Wind Waker | 5.1s |
| 5 | Sonic Adventure 2 Battle | 4.7s |
| 6 | A Hat in Time | 4.6s |
| 7 | Super Mario World | 4.4s |
| 8 | Aquaria | 4.4s |
| 9 | Yoshi's Island | 4.4s |
| 10 | Final Fantasy Mystic Quest | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.8s |
| 2 | A Link to the Past | 10.8s |
| 3 | Castlevania 64 | 9.9s |
| 4 | Subnautica | 9.8s |
| 5 | Baking Adventure | 8.8s |
| 6 | The Messenger | 8.8s |
| 7 | A Short Hike | 8.5s |
| 8 | Castlevania - Circle of the Moon | 8.2s |
| 9 | Aquaria | 7.9s |
| 10 | Terraria | 7.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Hat in Time | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | Aquaria | 0.2s |
| 4 | A Short Hike | 0.2s |
| 5 | Adventure | 0.2s |
| 6 | Castlevania - Circle of the Moon | 0.2s |
| 7 | Castlevania 64 | 0.2s |
| 8 | APQuest | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.5s |
| 2 | The Wind Waker | 5.5s |
| 3 | Mario & Luigi Superstar Saga | 4.4s |
| 4 | Sonic Adventure 2 Battle | 4.4s |
| 5 | Dark Souls III | 4.3s |
| 6 | Yoshi's Island | 4.2s |
| 7 | A Hat in Time | 4.1s |
| 8 | Links Awakening DX | 4.0s |
| 9 | Timespinner | 3.9s |
| 10 | Super Mario Land 2 | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 17.7s |
| 2 | Subnautica | 9.7s |
| 3 | A Link to the Past | 9.5s |
| 4 | The Messenger | 8.8s |
| 5 | Heretic | 7.7s |
| 6 | Choo-Choo Charles | 7.7s |
| 7 | Mario & Luigi Superstar Saga | 7.7s |
| 8 | Overcooked! 2 | 7.7s |
| 9 | Links Awakening DX | 7.6s |
| 10 | Terraria | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.8s |
| 2 | The Wind Waker | 14.4s |
| 3 | Overcooked! 2 | 14.4s |
| 4 | Heretic | 14.3s |
| 5 | MegaMan Battle Network 3 | 14.3s |
| 6 | Sonic Adventure 2 Battle | 14.3s |
| 7 | shapez | 14.3s |
| 8 | Landstalker - The Treasures of King Nole | 14.3s |
| 9 | Shivers | 14.3s |
| 10 | DOOM 1993 | 14.2s |
