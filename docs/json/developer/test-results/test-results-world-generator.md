# World Generator Test Results

**Generated:** 2026-01-07 06:00:39 UTC

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
| Stage 2: Seed Generation | 61 | 0 | 61 |
| Stage 3: Rules Comparison | 56 | 5 | 61 |
| Stage 4: WorldGen Spoiler Test | 61 | 0 | 61 |
| Stage 5: Cross-Validation | 61 | 0 | 61 |

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
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Stage 2: Seed Generation | 61 | 0 | 61 |
| Stage 3: Rules Comparison | 0 | 61 | 61 |
| Stage 4: WorldGen Spoiler Test | 61 | 0 | 61 |
| Stage 5: Cross-Validation | 36 | 25 | 61 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Total | 232.2s | 411.4s | 5.5s | 213.1s | 393.1s | 390.8s |
| Average | 3.8s | 6.7s | 0.1s | 3.5s | 6.4s | 6.4s |
| Max | 10.8s | 18.7s | 0.2s | 6.5s | 18.8s | 18.8s |
| Min | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.8s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | A Link to the Past (6.5s) | Dark Souls III (18.8s) | Dark Souls III (18.8s) |
| Fastest | Coding Adventure (2.9s) | Wargroove (5.6s) | Wargroove (0.1s) | Math Adventure (2.9s) | shapez (5.6s) | Metamath (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 7.3s | 0.1s | 4.0s | 6.7s | 6.7s |
| A Link to the Past | 8.2s | 9.8s | 0.2s | 6.5s | 9.8s | 9.8s |
| A Link to the Past WorldGen 2 | 6.1s | 12.0s | 0.2s | 6.1s | 9.7s | 9.7s |
| A Short Hike | 3.2s | 7.5s | 0.1s | 3.0s | 5.6s | 5.6s |
| APQuest | 3.3s | 9.9s | 0.1s | 3.0s | 5.7s | 5.7s |
| Adventure | 3.1s | 6.3s | 0.1s | 3.0s | 5.6s | 5.6s |
| Aquaria | 4.6s | 8.4s | 0.2s | 3.7s | 5.8s | 5.7s |
| Baking Adventure | 3.0s | 8.0s | 0.1s | 2.9s | 5.6s | 5.6s |
| Bumper Stickers | 3.1s | 9.0s | 0.1s | 3.0s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.5s | 6.2s | 0.1s | 3.4s | 5.7s | 5.7s |
| Castlevania 64 | 3.5s | 5.6s | 0.1s | 3.6s | 5.6s | 5.6s |
| Celeste 64 | 3.1s | 5.8s | 0.1s | 3.1s | 5.6s | 5.6s |
| ChecksFinder | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Choo-Choo Charles | 3.1s | 7.6s | 0.1s | 3.1s | 7.7s | 7.6s |
| Civilization VI | 3.3s | 5.7s | 0.1s | 3.1s | 5.6s | 5.7s |
| Coding Adventure | 2.9s | 5.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| DLCQuest | 3.4s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| DOOM 1993 | 3.3s | 6.7s | 0.1s | 3.3s | 6.6s | 6.7s |
| DOOM II | 3.6s | 7.7s | 0.1s | 3.4s | 7.6s | 7.7s |
| Dark Souls III | 4.4s | 18.7s | 0.1s | 4.4s | 18.8s | 18.8s |
| Donkey Kong Country 3 | 3.2s | 5.7s | 0.1s | 3.3s | 5.6s | 5.6s |
| Factorio | 3.5s | 5.7s | 0.1s | 3.3s | 5.7s | 5.6s |
| Faxanadu | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Final Fantasy Mystic Quest | 4.2s | 6.6s | 0.1s | 3.5s | 6.6s | 6.7s |
| Heretic | 3.6s | 7.7s | 0.1s | 3.5s | 7.7s | 7.7s |
| Hylics 2 | 3.2s | 5.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| Inscryption | 3.3s | 5.7s | 0.1s | 3.4s | 5.7s | 5.8s |
| Landstalker - The Treasures of King Nole | 3.2s | 5.8s | 0.1s | 3.3s | 6.7s | 5.8s |
| Links Awakening DX | 7.6s | 7.7s | 0.1s | 4.0s | 7.7s | 7.7s |
| Lufia II Ancient Cave | 3.6s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.9s | 7.7s | 0.1s | 4.1s | 7.6s | 7.6s |
| Math Adventure | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Mega Man 2 | 3.3s | 5.8s | 0.1s | 3.2s | 5.7s | 5.8s |
| MegaMan Battle Network 3 | 3.3s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Meritous | 3.0s | 5.6s | 0.1s | 3.1s | 5.8s | 5.7s |
| Metamath | 10.8s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.4s | 5.7s | 0.1s | 3.4s | 5.8s | 5.7s |
| Noita | 2.9s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Old School Runescape | 3.9s | 5.6s | 0.1s | 3.6s | 5.6s | 5.7s |
| Overcooked! 2 | 3.7s | 7.7s | 0.1s | 3.7s | 7.8s | 7.7s |
| Paint | 3.1s | 5.8s | 0.1s | 3.1s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.4s | 5.6s | 0.1s | 3.5s | 5.6s | 5.6s |
| Saving Princess | 3.2s | 5.9s | 0.1s | 3.2s | 5.8s | 5.8s |
| Shivers | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Sonic Adventure 2 Battle | 4.7s | 5.7s | 0.1s | 4.4s | 6.7s | 5.7s |
| Subnautica | 3.7s | 9.6s | 0.1s | 3.5s | 9.7s | 9.6s |
| Super Mario 64 | 3.5s | 5.8s | 0.1s | 3.5s | 5.8s | 5.7s |
| Super Mario Land 2 | 3.5s | 5.7s | 0.1s | 3.7s | 5.8s | 5.7s |
| Super Mario World | 4.6s | 5.6s | 0.1s | 3.4s | 5.6s | 5.6s |
| TOEM original | 3.2s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| TOEM rule builder | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Terraria | 3.1s | 7.6s | 0.1s | 3.1s | 7.7s | 7.6s |
| The Legend of Zelda | 4.0s | 5.8s | 0.1s | 3.4s | 5.8s | 5.8s |
| The Messenger | 3.4s | 8.9s | 0.1s | 3.2s | 8.7s | 8.7s |
| The Wind Waker | 5.0s | 5.7s | 0.1s | 5.3s | 5.7s | 5.7s |
| Timespinner | 4.0s | 5.8s | 0.1s | 4.0s | 5.6s | 5.6s |
| Undertale | 3.3s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| VVVVVV | 3.0s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| Wargroove | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Yoshi's Island | 4.2s | 6.7s | 0.1s | 4.2s | 5.7s | 5.7s |
| shapez | 4.0s | 5.7s | 0.1s | 3.3s | 5.6s | 5.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.8s |
| 2 | A Link to the Past | 8.2s |
| 3 | Links Awakening DX | 7.6s |
| 4 | A Link to the Past WorldGen 2 | 6.1s |
| 5 | The Wind Waker | 5.0s |
| 6 | Sonic Adventure 2 Battle | 4.7s |
| 7 | Aquaria | 4.6s |
| 8 | Super Mario World | 4.6s |
| 9 | A Hat in Time | 4.5s |
| 10 | Dark Souls III | 4.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past WorldGen 2 | 12.0s |
| 3 | APQuest | 9.9s |
| 4 | A Link to the Past | 9.8s |
| 5 | Subnautica | 9.6s |
| 6 | Bumper Stickers | 9.0s |
| 7 | The Messenger | 8.9s |
| 8 | Aquaria | 8.4s |
| 9 | Baking Adventure | 8.0s |
| 10 | Overcooked! 2 | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | Aquaria | 0.2s |
| 4 | A Hat in Time | 0.1s |
| 5 | Castlevania - Circle of the Moon | 0.1s |
| 6 | A Short Hike | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.5s |
| 2 | A Link to the Past WorldGen 2 | 6.1s |
| 3 | The Wind Waker | 5.3s |
| 4 | Sonic Adventure 2 Battle | 4.4s |
| 5 | Dark Souls III | 4.4s |
| 6 | Yoshi's Island | 4.2s |
| 7 | Mario & Luigi Superstar Saga | 4.1s |
| 8 | A Hat in Time | 4.0s |
| 9 | Timespinner | 4.0s |
| 10 | Links Awakening DX | 4.0s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.8s |
| 2 | A Link to the Past | 9.8s |
| 3 | A Link to the Past WorldGen 2 | 9.7s |
| 4 | Subnautica | 9.7s |
| 5 | The Messenger | 8.7s |
| 6 | Overcooked! 2 | 7.8s |
| 7 | Heretic | 7.7s |
| 8 | Choo-Choo Charles | 7.7s |
| 9 | Links Awakening DX | 7.7s |
| 10 | Terraria | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.8s |
| 2 | A Link to the Past | 9.8s |
| 3 | A Link to the Past WorldGen 2 | 9.7s |
| 4 | Subnautica | 9.6s |
| 5 | The Messenger | 8.7s |
| 6 | Overcooked! 2 | 7.7s |
| 7 | Heretic | 7.7s |
| 8 | DOOM II | 7.7s |
| 9 | Links Awakening DX | 7.7s |
| 10 | Choo-Choo Charles | 7.6s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 220.2s | 411.9s | 5.2s | 200.8s | 384.1s | 583.6s |
| Average | 3.6s | 6.8s | 0.1s | 3.3s | 6.3s | 9.6s |
| Max | 10.1s | 18.5s | 0.2s | 6.2s | 17.5s | 32.3s |
| Min | 2.6s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.1s) | Dark Souls III (18.5s) | A Link to the Past WorldGen 2 (0.2s) | A Link to the Past WorldGen 2 (6.2s) | Dark Souls III (17.5s) | Dark Souls III (32.3s) |
| Fastest | Meritous (2.6s) | Civilization VI (5.4s) | TOEM original (0.1s) | APQuest (2.7s) | Meritous (5.4s) | APQuest (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 7.2s | 0.1s | 3.8s | 6.6s | 6.7s |
| A Link to the Past | 7.3s | 10.1s | 0.1s | 6.0s | 9.5s | 14.0s |
| A Link to the Past WorldGen 2 | 6.1s | 13.3s | 0.2s | 6.2s | 9.7s | 14.6s |
| A Short Hike | 3.3s | 10.7s | 0.1s | 3.1s | 5.7s | 5.6s |
| APQuest | 2.8s | 8.4s | 0.1s | 2.7s | 5.4s | 5.4s |
| Adventure | 2.9s | 8.0s | 0.1s | 2.8s | 5.4s | 5.5s |
| Aquaria | 4.2s | 8.2s | 0.1s | 3.4s | 5.6s | 5.6s |
| Baking Adventure | 3.0s | 6.4s | 0.1s | 2.8s | 5.6s | 14.1s |
| Bumper Stickers | 3.0s | 8.2s | 0.1s | 2.9s | 5.6s | 14.2s |
| Castlevania - Circle of the Moon | 3.1s | 9.5s | 0.1s | 2.9s | 5.4s | 5.5s |
| Castlevania 64 | 3.5s | 5.6s | 0.1s | 3.6s | 5.6s | 5.6s |
| Celeste 64 | 3.2s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| ChecksFinder | 2.8s | 5.6s | 0.1s | 2.8s | 5.4s | 5.5s |
| Choo-Choo Charles | 3.2s | 7.7s | 0.1s | 3.1s | 7.7s | 7.7s |
| Civilization VI | 2.7s | 5.4s | 0.1s | 2.8s | 5.4s | 13.7s |
| Coding Adventure | 2.7s | 5.4s | 0.1s | 2.7s | 5.4s | 13.8s |
| DLCQuest | 3.2s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| DOOM 1993 | 3.4s | 6.8s | 0.1s | 3.3s | 6.6s | 14.2s |
| DOOM II | 3.5s | 7.6s | 0.1s | 3.3s | 7.6s | 14.2s |
| Dark Souls III | 4.0s | 18.5s | 0.1s | 3.8s | 17.5s | 32.3s |
| Donkey Kong Country 3 | 3.1s | 5.6s | 0.1s | 3.1s | 5.7s | 14.3s |
| Factorio | 3.6s | 5.6s | 0.1s | 3.3s | 5.6s | 5.7s |
| Faxanadu | 2.9s | 5.5s | 0.1s | 2.8s | 5.5s | 13.9s |
| Final Fantasy Mystic Quest | 4.2s | 6.7s | 0.1s | 3.6s | 6.7s | 6.7s |
| Heretic | 3.3s | 7.4s | 0.1s | 3.2s | 7.4s | 14.1s |
| Hylics 2 | 3.0s | 5.4s | 0.1s | 2.9s | 5.5s | 5.5s |
| Inscryption | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.6s | 0.1s | 3.3s | 6.6s | 14.3s |
| Links Awakening DX | 7.3s | 7.7s | 0.1s | 4.0s | 7.7s | 7.7s |
| Lufia II Ancient Cave | 3.2s | 5.5s | 0.1s | 3.1s | 5.5s | 5.4s |
| Mario & Luigi Superstar Saga | 3.9s | 7.7s | 0.1s | 4.1s | 6.6s | 7.6s |
| Math Adventure | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 14.1s |
| Mega Man 2 | 2.9s | 5.5s | 0.1s | 2.9s | 5.5s | 5.5s |
| MegaMan Battle Network 3 | 3.3s | 5.6s | 0.1s | 3.0s | 5.6s | 14.3s |
| Meritous | 2.6s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |
| Metamath | 10.1s | 5.4s | 0.1s | 2.7s | 5.5s | 5.4s |
| Muse Dash | 3.0s | 5.6s | 0.1s | 3.1s | 5.6s | 14.2s |
| Noita | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Old School Runescape | 3.8s | 5.6s | 0.1s | 3.6s | 5.6s | 5.6s |
| Overcooked! 2 | 3.2s | 7.5s | 0.1s | 3.2s | 7.5s | 13.9s |
| Paint | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.4s | 5.6s | 0.1s | 3.4s | 5.6s | 5.6s |
| Saving Princess | 2.9s | 5.5s | 0.1s | 2.9s | 5.5s | 13.9s |
| Shivers | 3.2s | 5.6s | 0.1s | 3.2s | 5.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.2s | 5.4s | 0.1s | 4.0s | 6.4s | 13.7s |
| Subnautica | 3.4s | 9.5s | 0.1s | 3.3s | 9.4s | 13.8s |
| Super Mario 64 | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.5s | 5.7s | 0.1s | 3.4s | 5.7s | 5.7s |
| Super Mario World | 4.4s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| TOEM original | 2.8s | 5.4s | 0.1s | 2.9s | 5.5s | 5.5s |
| TOEM rule builder | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Terraria | 3.1s | 7.7s | 0.1s | 3.2s | 7.7s | 7.6s |
| The Legend of Zelda | 3.5s | 5.5s | 0.1s | 3.0s | 5.5s | 13.9s |
| The Messenger | 3.4s | 9.8s | 0.1s | 3.3s | 8.8s | 8.7s |
| The Wind Waker | 4.5s | 5.4s | 0.1s | 4.6s | 5.4s | 13.7s |
| Timespinner | 3.8s | 5.4s | 0.1s | 3.7s | 5.5s | 5.5s |
| Undertale | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| VVVVVV | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 3.6s | 6.4s | 0.1s | 3.6s | 5.4s | 5.5s |
| shapez | 4.0s | 5.6s | 0.1s | 3.3s | 5.6s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.1s |
| 2 | A Link to the Past | 7.3s |
| 3 | Links Awakening DX | 7.3s |
| 4 | A Link to the Past WorldGen 2 | 6.1s |
| 5 | A Hat in Time | 4.5s |
| 6 | The Wind Waker | 4.5s |
| 7 | Super Mario World | 4.4s |
| 8 | Aquaria | 4.2s |
| 9 | Final Fantasy Mystic Quest | 4.2s |
| 10 | Sonic Adventure 2 Battle | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.5s |
| 2 | A Link to the Past WorldGen 2 | 13.3s |
| 3 | A Short Hike | 10.7s |
| 4 | A Link to the Past | 10.1s |
| 5 | The Messenger | 9.8s |
| 6 | Castlevania - Circle of the Moon | 9.5s |
| 7 | Subnautica | 9.5s |
| 8 | APQuest | 8.4s |
| 9 | Bumper Stickers | 8.2s |
| 10 | Aquaria | 8.2s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 0.2s |
| 2 | A Hat in Time | 0.1s |
| 3 | A Link to the Past | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | Aquaria | 0.1s |
| 6 | Baking Adventure | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 6.2s |
| 2 | A Link to the Past | 6.0s |
| 3 | The Wind Waker | 4.6s |
| 4 | Mario & Luigi Superstar Saga | 4.1s |
| 5 | Links Awakening DX | 4.0s |
| 6 | Sonic Adventure 2 Battle | 4.0s |
| 7 | Dark Souls III | 3.8s |
| 8 | A Hat in Time | 3.8s |
| 9 | Timespinner | 3.7s |
| 10 | Yoshi's Island | 3.6s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 17.5s |
| 2 | A Link to the Past WorldGen 2 | 9.7s |
| 3 | A Link to the Past | 9.5s |
| 4 | Subnautica | 9.4s |
| 5 | The Messenger | 8.8s |
| 6 | Choo-Choo Charles | 7.7s |
| 7 | Links Awakening DX | 7.7s |
| 8 | Terraria | 7.7s |
| 9 | DOOM II | 7.6s |
| 10 | Overcooked! 2 | 7.5s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.3s |
| 2 | A Link to the Past WorldGen 2 | 14.6s |
| 3 | Donkey Kong Country 3 | 14.3s |
| 4 | Landstalker - The Treasures of King Nole | 14.3s |
| 5 | Shivers | 14.3s |
| 6 | shapez | 14.3s |
| 7 | MegaMan Battle Network 3 | 14.3s |
| 8 | Bumper Stickers | 14.2s |
| 9 | DOOM II | 14.2s |
| 10 | DOOM 1993 | 14.2s |
