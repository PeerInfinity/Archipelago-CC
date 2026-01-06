# World Generator Test Results

**Generated:** 2026-01-06 04:37:50 UTC

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
| Original Spoiler Test | 57 | 4 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 61 | 0 | 61 |
| Stage 3: Rules Comparison | 55 | 6 | 61 |
| Stage 4: WorldGen Spoiler Test | 58 | 3 | 61 |
| Stage 5: Cross-Validation | 58 | 3 | 61 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | Error |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DLCQuest | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| shapez | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | Error |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 61

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 61 | 0 | 61 |
| Original Spoiler Test | 57 | 4 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 61 | 0 | 61 |
| Stage 3: Rules Comparison | 0 | 61 | 61 |
| Stage 4: WorldGen Spoiler Test | 58 | 3 | 61 |
| Stage 5: Cross-Validation | 30 | 31 | 61 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| A Link to the Past WorldGen 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Aquaria | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | Error |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| DLCQuest | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Dark Souls III | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
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
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| shapez | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 227.3s | 460.1s | 5.4s | 205.5s | 429.5s | 426.7s |
| Average | 3.7s | 7.5s | 0.1s | 3.4s | 7.0s | 7.0s |
| Max | 11.3s | 42.3s | 0.2s | 6.3s | 42.1s | 42.0s |
| Min | 2.8s | 5.5s | 0.1s | 2.7s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.3s) | Dark Souls III (42.3s) | A Link to the Past (0.2s) | A Link to the Past WorldGen 2 (6.3s) | Dark Souls III (42.1s) | Dark Souls III (42.0s) |
| Fastest | Inscryption (2.8s) | Sonic Adventure 2 Battle (5.5s) | Wargroove (0.1s) | MegaMan Battle Network 3 (2.7s) | Wargroove (5.4s) | Civilization VI (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.8s | 7.5s | 0.1s | 4.0s | 6.7s | 6.7s |
| A Link to the Past | 7.8s | 9.7s | 0.2s | 6.1s | 9.7s | 8.7s |
| A Link to the Past WorldGen 2 | 6.4s | 10.4s | 0.2s | 6.3s | 9.8s | 9.7s |
| A Short Hike | 2.9s | 9.4s | 0.1s | 2.8s | 5.5s | 5.5s |
| APQuest | 3.1s | 8.6s | 0.1s | 2.8s | 5.4s | 5.5s |
| Adventure | 3.1s | 7.3s | 0.1s | 3.1s | 5.6s | 5.6s |
| Aquaria | 3.9s | 17.5s | 0.1s | 3.1s | 5.5s | 14.1s |
| Baking Adventure | 3.0s | 6.3s | 0.1s | 2.9s | 5.6s | 5.6s |
| Bumper Stickers | 2.9s | 8.6s | 0.1s | 2.8s | 5.5s | 5.5s |
| Castlevania - Circle of the Moon | 3.5s | 9.8s | 0.2s | 3.3s | 5.7s | 5.7s |
| Castlevania 64 | 3.6s | 5.6s | 0.1s | 3.8s | 5.7s | 5.7s |
| Celeste 64 | 3.3s | 5.8s | 0.1s | 3.2s | 5.7s | 5.7s |
| ChecksFinder | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Choo-Choo Charles | 2.8s | 7.5s | 0.1s | 2.8s | 7.5s | 7.6s |
| Civilization VI | 3.1s | 5.5s | 0.1s | 2.8s | 5.5s | 5.4s |
| Coding Adventure | 2.9s | 5.7s | 0.1s | 2.9s | 5.6s | 5.7s |
| DLCQuest | 3.0s | 14.0s | 0.1s | 2.8s | 14.2s | 5.5s |
| DOOM 1993 | 3.5s | 6.7s | 0.1s | 3.3s | 6.6s | 6.6s |
| DOOM II | 3.4s | 7.5s | 0.1s | 3.4s | 7.5s | 7.5s |
| Dark Souls III | 4.4s | 42.3s | 0.1s | 4.4s | 42.1s | 42.0s |
| Donkey Kong Country 3 | 3.5s | 5.7s | 0.1s | 3.4s | 5.7s | 5.7s |
| Factorio | 3.8s | 5.8s | 0.1s | 3.4s | 5.7s | 5.7s |
| Faxanadu | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Final Fantasy Mystic Quest | 3.8s | 6.5s | 0.1s | 3.1s | 6.5s | 6.5s |
| Heretic | 3.7s | 7.5s | 0.1s | 3.3s | 7.5s | 7.6s |
| Hylics 2 | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Inscryption | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 5.5s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.8s | 0.1s | 3.2s | 6.6s | 5.7s |
| Links Awakening DX | 7.2s | 7.6s | 0.1s | 4.0s | 7.6s | 7.5s |
| Lufia II Ancient Cave | 3.6s | 5.7s | 0.1s | 3.3s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 4.0s | 7.7s | 0.1s | 4.2s | 7.7s | 7.7s |
| Math Adventure | 3.0s | 5.8s | 0.1s | 2.9s | 5.7s | 5.7s |
| Mega Man 2 | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.0s | 5.5s | 0.1s | 2.7s | 5.5s | 5.5s |
| Meritous | 2.9s | 5.6s | 0.1s | 3.0s | 5.5s | 5.5s |
| Metamath | 11.3s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 2.9s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Noita | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Old School Runescape | 3.6s | 5.5s | 0.1s | 3.8s | 5.5s | 5.5s |
| Overcooked! 2 | 3.7s | 7.8s | 0.1s | 3.4s | 7.7s | 7.7s |
| Paint | 3.1s | 5.8s | 0.1s | 3.2s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.6s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| Saving Princess | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Shivers | 2.9s | 5.5s | 0.1s | 2.9s | 14.0s | 5.5s |
| Sonic Adventure 2 Battle | 4.5s | 5.5s | 0.1s | 4.4s | 6.6s | 5.6s |
| Subnautica | 3.7s | 9.7s | 0.1s | 3.7s | 9.7s | 9.7s |
| Super Mario 64 | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.6s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| Super Mario World | 4.2s | 5.6s | 0.1s | 3.3s | 5.5s | 5.5s |
| TOEM original | 3.2s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| TOEM rule builder | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Terraria | 3.2s | 7.7s | 0.1s | 3.0s | 7.7s | 7.7s |
| The Legend of Zelda | 3.8s | 5.6s | 0.1s | 3.5s | 5.7s | 5.7s |
| The Messenger | 3.0s | 8.6s | 0.1s | 2.9s | 8.6s | 8.6s |
| The Wind Waker | 4.8s | 5.5s | 0.1s | 5.0s | 5.5s | 5.5s |
| Timespinner | 4.2s | 5.7s | 0.1s | 3.9s | 5.7s | 5.7s |
| Undertale | 2.9s | 5.5s | 0.1s | 2.9s | 5.5s | 5.6s |
| VVVVVV | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 2.9s | 5.5s | 0.1s | 2.8s | 5.4s | 5.5s |
| Yoshi's Island | 4.3s | 6.7s | 0.1s | 3.9s | 5.7s | 5.7s |
| shapez | 4.1s | 14.3s | 0.1s | 3.4s | 5.7s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.3s |
| 2 | A Link to the Past | 7.8s |
| 3 | Links Awakening DX | 7.2s |
| 4 | A Link to the Past WorldGen 2 | 6.4s |
| 5 | The Wind Waker | 4.8s |
| 6 | A Hat in Time | 4.8s |
| 7 | Sonic Adventure 2 Battle | 4.5s |
| 8 | Dark Souls III | 4.4s |
| 9 | Yoshi's Island | 4.3s |
| 10 | Super Mario World | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 42.3s |
| 2 | Aquaria | 17.5s |
| 3 | shapez | 14.3s |
| 4 | DLCQuest | 14.0s |
| 5 | A Link to the Past WorldGen 2 | 10.4s |
| 6 | Castlevania - Circle of the Moon | 9.8s |
| 7 | Subnautica | 9.7s |
| 8 | A Link to the Past | 9.7s |
| 9 | A Short Hike | 9.4s |
| 10 | The Messenger | 8.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | Castlevania - Circle of the Moon | 0.2s |
| 4 | A Hat in Time | 0.1s |
| 5 | Aquaria | 0.1s |
| 6 | Adventure | 0.1s |
| 7 | Baking Adventure | 0.1s |
| 8 | A Short Hike | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 6.3s |
| 2 | A Link to the Past | 6.1s |
| 3 | The Wind Waker | 5.0s |
| 4 | Dark Souls III | 4.4s |
| 5 | Sonic Adventure 2 Battle | 4.4s |
| 6 | Mario & Luigi Superstar Saga | 4.2s |
| 7 | A Hat in Time | 4.0s |
| 8 | Links Awakening DX | 4.0s |
| 9 | Timespinner | 3.9s |
| 10 | Yoshi's Island | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 42.1s |
| 2 | DLCQuest | 14.2s |
| 3 | Shivers | 14.0s |
| 4 | A Link to the Past WorldGen 2 | 9.8s |
| 5 | A Link to the Past | 9.7s |
| 6 | Subnautica | 9.7s |
| 7 | The Messenger | 8.6s |
| 8 | Mario & Luigi Superstar Saga | 7.7s |
| 9 | Overcooked! 2 | 7.7s |
| 10 | Terraria | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 42.0s |
| 2 | shapez | 14.3s |
| 3 | Aquaria | 14.1s |
| 4 | A Link to the Past WorldGen 2 | 9.7s |
| 5 | Subnautica | 9.7s |
| 6 | A Link to the Past | 8.7s |
| 7 | The Messenger | 8.6s |
| 8 | Overcooked! 2 | 7.7s |
| 9 | Mario & Luigi Superstar Saga | 7.7s |
| 10 | Terraria | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 227.4s | 466.4s | 5.4s | 207.2s | 430.2s | 622.6s |
| Average | 3.7s | 7.6s | 0.1s | 3.4s | 7.1s | 10.2s |
| Max | 11.1s | 42.1s | 0.2s | 6.2s | 41.9s | 14.5s |
| Min | 2.8s | 5.4s | 0.1s | 2.8s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.1s) | Dark Souls III (42.1s) | A Link to the Past (0.2s) | A Link to the Past WorldGen 2 (6.2s) | Dark Souls III (41.9s) | Dark Souls III (14.5s) |
| Fastest | Paint (2.8s) | Paint (5.4s) | TOEM rule builder (0.1s) | TOEM rule builder (2.8s) | Paint (5.5s) | Castlevania 64 (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.2s | 7.6s | 0.1s | 3.7s | 6.5s | 6.5s |
| A Link to the Past | 7.7s | 9.9s | 0.2s | 6.2s | 9.7s | 14.3s |
| A Link to the Past WorldGen 2 | 6.0s | 13.8s | 0.2s | 6.2s | 9.7s | 14.4s |
| A Short Hike | 3.2s | 10.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| APQuest | 3.3s | 8.7s | 0.1s | 3.2s | 5.8s | 5.7s |
| Adventure | 3.1s | 8.1s | 0.1s | 2.9s | 5.6s | 14.1s |
| Aquaria | 4.1s | 18.4s | 0.1s | 3.3s | 5.6s | 14.3s |
| Baking Adventure | 3.3s | 11.3s | 0.1s | 3.1s | 5.7s | 14.3s |
| Bumper Stickers | 3.1s | 6.2s | 0.1s | 3.0s | 5.7s | 14.2s |
| Castlevania - Circle of the Moon | 3.2s | 7.3s | 0.1s | 3.0s | 5.7s | 14.2s |
| Castlevania 64 | 3.3s | 5.5s | 0.1s | 3.3s | 5.5s | 5.5s |
| Celeste 64 | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 14.2s |
| ChecksFinder | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.1s | 7.7s | 0.1s | 3.1s | 7.6s | 7.7s |
| Civilization VI | 3.3s | 5.8s | 0.1s | 3.2s | 5.7s | 14.5s |
| Coding Adventure | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 14.4s |
| DLCQuest | 3.1s | 14.5s | 0.1s | 3.1s | 14.2s | 5.7s |
| DOOM 1993 | 3.8s | 6.7s | 0.1s | 3.5s | 6.7s | 14.4s |
| DOOM II | 3.6s | 7.6s | 0.1s | 3.5s | 7.7s | 14.3s |
| Dark Souls III | 4.1s | 42.1s | 0.1s | 4.0s | 41.9s | 14.5s |
| Donkey Kong Country 3 | 3.0s | 5.4s | 0.1s | 3.0s | 5.5s | 13.8s |
| Factorio | 3.5s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Faxanadu | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 14.3s |
| Final Fantasy Mystic Quest | 4.2s | 6.7s | 0.1s | 3.5s | 6.7s | 6.7s |
| Heretic | 4.0s | 7.8s | 0.1s | 3.8s | 7.8s | 14.4s |
| Hylics 2 | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Inscryption | 2.9s | 5.6s | 0.1s | 3.3s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.6s | 5.8s | 0.1s | 3.6s | 6.7s | 14.4s |
| Links Awakening DX | 7.5s | 7.7s | 0.1s | 4.1s | 7.7s | 7.8s |
| Lufia II Ancient Cave | 3.3s | 5.6s | 0.1s | 3.3s | 5.6s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 6.5s | 0.1s | 3.8s | 7.5s | 7.6s |
| Math Adventure | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 14.2s |
| Mega Man 2 | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 14.3s |
| Meritous | 3.2s | 5.8s | 0.1s | 3.1s | 5.6s | 14.4s |
| Metamath | 11.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.0s | 5.6s | 0.1s | 3.2s | 5.7s | 14.4s |
| Noita | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.6s |
| Old School Runescape | 3.8s | 5.7s | 0.1s | 3.7s | 5.7s | 5.7s |
| Overcooked! 2 | 3.6s | 7.7s | 0.1s | 3.3s | 7.7s | 14.4s |
| Paint | 2.8s | 5.4s | 0.1s | 2.9s | 5.5s | 5.5s |
| Risk of Rain 2 | 3.3s | 5.8s | 0.1s | 3.4s | 5.7s | 5.6s |
| Saving Princess | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 14.1s |
| Shivers | 3.2s | 5.6s | 0.1s | 3.4s | 14.3s | 14.3s |
| Sonic Adventure 2 Battle | 4.8s | 5.7s | 0.1s | 4.4s | 6.7s | 14.3s |
| Subnautica | 3.6s | 9.6s | 0.1s | 3.5s | 8.6s | 14.2s |
| Super Mario 64 | 3.1s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.8s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Super Mario World | 4.5s | 5.6s | 0.1s | 3.4s | 5.7s | 5.6s |
| TOEM original | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| TOEM rule builder | 2.8s | 5.5s | 0.1s | 2.8s | 5.5s | 5.5s |
| Terraria | 3.1s | 7.7s | 0.1s | 3.1s | 7.7s | 14.4s |
| The Legend of Zelda | 3.8s | 5.6s | 0.1s | 3.1s | 5.7s | 14.2s |
| The Messenger | 3.3s | 8.8s | 0.1s | 3.4s | 8.8s | 8.8s |
| The Wind Waker | 5.3s | 5.8s | 0.1s | 5.2s | 5.7s | 14.5s |
| Timespinner | 3.9s | 5.6s | 0.1s | 3.7s | 5.6s | 14.2s |
| Undertale | 3.0s | 5.6s | 0.1s | 3.1s | 5.7s | 5.7s |
| VVVVVV | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Wargroove | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Yoshi's Island | 4.0s | 6.7s | 0.1s | 3.8s | 5.6s | 5.7s |
| shapez | 3.6s | 13.9s | 0.1s | 3.1s | 5.5s | 13.8s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.1s |
| 2 | A Link to the Past | 7.7s |
| 3 | Links Awakening DX | 7.5s |
| 4 | A Link to the Past WorldGen 2 | 6.0s |
| 5 | The Wind Waker | 5.3s |
| 6 | Sonic Adventure 2 Battle | 4.8s |
| 7 | Super Mario World | 4.5s |
| 8 | Final Fantasy Mystic Quest | 4.2s |
| 9 | A Hat in Time | 4.2s |
| 10 | Aquaria | 4.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 42.1s |
| 2 | Aquaria | 18.4s |
| 3 | DLCQuest | 14.5s |
| 4 | shapez | 13.9s |
| 5 | A Link to the Past WorldGen 2 | 13.8s |
| 6 | Baking Adventure | 11.3s |
| 7 | A Short Hike | 10.7s |
| 8 | A Link to the Past | 9.9s |
| 9 | Subnautica | 9.6s |
| 10 | The Messenger | 8.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | APQuest | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | Adventure | 0.1s |
| 7 | Baking Adventure | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | A Hat in Time | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 6.2s |
| 2 | A Link to the Past | 6.2s |
| 3 | The Wind Waker | 5.2s |
| 4 | Sonic Adventure 2 Battle | 4.4s |
| 5 | Links Awakening DX | 4.1s |
| 6 | Dark Souls III | 4.0s |
| 7 | Heretic | 3.8s |
| 8 | Mario & Luigi Superstar Saga | 3.8s |
| 9 | Yoshi's Island | 3.8s |
| 10 | Timespinner | 3.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 41.9s |
| 2 | Shivers | 14.3s |
| 3 | DLCQuest | 14.2s |
| 4 | A Link to the Past WorldGen 2 | 9.7s |
| 5 | A Link to the Past | 9.7s |
| 6 | The Messenger | 8.8s |
| 7 | Subnautica | 8.6s |
| 8 | Heretic | 7.8s |
| 9 | Links Awakening DX | 7.7s |
| 10 | Overcooked! 2 | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 14.5s |
| 2 | Civilization VI | 14.5s |
| 3 | The Wind Waker | 14.5s |
| 4 | Heretic | 14.4s |
| 5 | A Link to the Past WorldGen 2 | 14.4s |
| 6 | Coding Adventure | 14.4s |
| 7 | Meritous | 14.4s |
| 8 | DOOM 1993 | 14.4s |
| 9 | Terraria | 14.4s |
| 10 | Landstalker - The Treasures of King Nole | 14.4s |
