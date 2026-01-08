# World Generator Test Results

**Generated:** 2026-01-08 05:16:36 UTC

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
| Stage 4: WorldGen Spoiler Test | 60 | 0 | 60 |
| Stage 5: Cross-Validation | 60 | 0 | 60 |

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
| Stage 4: WorldGen Spoiler Test | 60 | 0 | 60 |
| Stage 5: Cross-Validation | 36 | 24 | 60 |

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
| Total | 229.8s | 402.4s | 5.4s | 205.6s | 384.2s | 382.3s |
| Average | 3.8s | 6.7s | 0.1s | 3.4s | 6.4s | 6.4s |
| Max | 10.2s | 18.8s | 0.2s | 6.3s | 18.8s | 18.7s |
| Min | 2.9s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.2s) | Dark Souls III (18.8s) | A Link to the Past (0.2s) | A Link to the Past WorldGen 2 (6.3s) | Dark Souls III (18.8s) | Dark Souls III (18.7s) |
| Fastest | Inscryption (2.9s) | Muse Dash (5.4s) | Undertale (0.1s) | DLCQuest (2.7s) | Undertale (5.4s) | Inscryption (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.9s | 7.5s | 0.2s | 4.4s | 6.9s | 6.9s |
| A Link to the Past | 7.9s | 9.8s | 0.2s | 5.9s | 9.7s | 8.7s |
| A Link to the Past WorldGen 2 | 6.2s | 10.6s | 0.2s | 6.3s | 9.7s | 9.7s |
| A Short Hike | 3.2s | 6.5s | 0.1s | 3.1s | 5.7s | 5.7s |
| APQuest | 3.2s | 10.3s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.1s | 6.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Aquaria | 3.9s | 5.9s | 0.1s | 3.1s | 5.4s | 5.4s |
| Baking Adventure | 3.3s | 7.4s | 0.1s | 2.8s | 5.6s | 5.6s |
| Bumper Stickers | 3.1s | 7.1s | 0.1s | 2.9s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.5s | 10.2s | 0.1s | 3.3s | 5.7s | 5.6s |
| Castlevania 64 | 3.8s | 5.8s | 0.1s | 3.8s | 5.7s | 5.8s |
| Celeste 64 | 3.2s | 5.7s | 0.1s | 3.2s | 5.6s | 5.7s |
| ChecksFinder | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.7s |
| Choo-Choo Charles | 3.1s | 7.7s | 0.1s | 3.2s | 7.7s | 7.7s |
| Civilization VI | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Coding Adventure | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| DLCQuest | 3.1s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |
| DOOM 1993 | 3.6s | 6.6s | 0.1s | 3.2s | 6.6s | 6.6s |
| DOOM II | 3.5s | 7.7s | 0.1s | 3.3s | 7.6s | 7.6s |
| Dark Souls III | 4.4s | 18.8s | 0.1s | 4.2s | 18.8s | 18.7s |
| Donkey Kong Country 3 | 3.4s | 5.8s | 0.1s | 3.5s | 5.8s | 5.8s |
| Factorio | 3.8s | 5.6s | 0.1s | 3.5s | 5.6s | 5.6s |
| Faxanadu | 2.9s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Final Fantasy Mystic Quest | 4.2s | 6.8s | 0.1s | 3.6s | 6.7s | 6.7s |
| Heretic | 3.8s | 7.7s | 0.1s | 3.5s | 7.6s | 7.7s |
| Hylics 2 | 3.3s | 5.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| Inscryption | 2.9s | 5.5s | 0.1s | 2.8s | 5.4s | 5.4s |
| Landstalker - The Treasures of King Nole | 3.4s | - | - | - | - | - |
| Links Awakening DX | 7.6s | 7.7s | 0.1s | 3.8s | 7.6s | 7.6s |
| Lufia II Ancient Cave | 3.3s | 5.7s | 0.1s | 3.5s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 4.1s | 7.9s | 0.1s | 4.5s | 7.8s | 7.7s |
| Math Adventure | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Mega Man 2 | 3.1s | 5.8s | 0.1s | 3.1s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Meritous | 3.0s | 5.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| Metamath | 10.2s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 2.9s | 5.4s | 0.1s | 2.9s | 5.4s | 5.4s |
| Noita | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Old School Runescape | 4.0s | 5.6s | 0.1s | 3.5s | 5.6s | 5.6s |
| Overcooked! 2 | 3.5s | 7.7s | 0.1s | 3.4s | 7.7s | 7.7s |
| Paint | 3.3s | 5.8s | 0.1s | 3.5s | 5.7s | 5.8s |
| Risk of Rain 2 | 3.5s | 5.8s | 0.1s | 3.4s | 5.6s | 5.6s |
| Saving Princess | 3.0s | 5.7s | 0.1s | 3.1s | 5.7s | 5.6s |
| Shivers | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.6s |
| Sonic Adventure 2 Battle | 4.6s | 5.7s | 0.1s | 4.2s | 6.6s | 5.6s |
| Subnautica | 3.7s | 9.6s | 0.1s | 3.5s | 9.7s | 9.7s |
| Super Mario 64 | 3.0s | 5.4s | 0.1s | 2.9s | 5.5s | 5.4s |
| Super Mario Land 2 | 3.5s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| Super Mario World | 4.5s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| TOEM original | 3.1s | 5.6s | 0.1s | 3.2s | 5.7s | 5.6s |
| TOEM rule builder | 3.3s | 5.8s | 0.1s | 3.3s | 5.7s | 5.7s |
| Terraria | 3.1s | 7.7s | 0.1s | 3.3s | 7.7s | 7.7s |
| The Legend of Zelda | 3.7s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| The Messenger | 3.3s | 8.8s | 0.1s | 3.3s | 8.8s | 8.8s |
| The Wind Waker | 5.0s | 5.6s | 0.1s | 5.2s | 5.6s | 5.7s |
| Timespinner | 4.0s | 5.6s | 0.1s | 3.9s | 5.6s | 5.6s |
| Undertale | 2.9s | 5.4s | 0.1s | 2.8s | 5.4s | 5.4s |
| VVVVVV | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Yoshi's Island | 4.2s | 6.7s | 0.1s | 4.0s | 5.7s | 5.7s |
| shapez | 4.3s | 5.7s | 0.1s | 3.6s | 5.8s | 5.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.2s |
| 2 | A Link to the Past | 7.9s |
| 3 | Links Awakening DX | 7.6s |
| 4 | A Link to the Past WorldGen 2 | 6.2s |
| 5 | The Wind Waker | 5.0s |
| 6 | A Hat in Time | 4.9s |
| 7 | Sonic Adventure 2 Battle | 4.6s |
| 8 | Super Mario World | 4.5s |
| 9 | Dark Souls III | 4.4s |
| 10 | shapez | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.8s |
| 2 | A Link to the Past WorldGen 2 | 10.6s |
| 3 | APQuest | 10.3s |
| 4 | Castlevania - Circle of the Moon | 10.2s |
| 5 | A Link to the Past | 9.8s |
| 6 | Subnautica | 9.6s |
| 7 | The Messenger | 8.8s |
| 8 | Mario & Luigi Superstar Saga | 7.9s |
| 9 | Choo-Choo Charles | 7.7s |
| 10 | Overcooked! 2 | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen 2 | 0.2s |
| 3 | A Hat in Time | 0.2s |
| 4 | APQuest | 0.1s |
| 5 | Baking Adventure | 0.1s |
| 6 | Castlevania - Circle of the Moon | 0.1s |
| 7 | A Short Hike | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 6.3s |
| 2 | A Link to the Past | 5.9s |
| 3 | The Wind Waker | 5.2s |
| 4 | Mario & Luigi Superstar Saga | 4.5s |
| 5 | A Hat in Time | 4.4s |
| 6 | Dark Souls III | 4.2s |
| 7 | Sonic Adventure 2 Battle | 4.2s |
| 8 | Yoshi's Island | 4.0s |
| 9 | Timespinner | 3.9s |
| 10 | Castlevania 64 | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.8s |
| 2 | A Link to the Past WorldGen 2 | 9.7s |
| 3 | A Link to the Past | 9.7s |
| 4 | Subnautica | 9.7s |
| 5 | The Messenger | 8.8s |
| 6 | Mario & Luigi Superstar Saga | 7.8s |
| 7 | Overcooked! 2 | 7.7s |
| 8 | Choo-Choo Charles | 7.7s |
| 9 | Terraria | 7.7s |
| 10 | Heretic | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past WorldGen 2 | 9.7s |
| 3 | Subnautica | 9.7s |
| 4 | The Messenger | 8.8s |
| 5 | A Link to the Past | 8.7s |
| 6 | Mario & Luigi Superstar Saga | 7.7s |
| 7 | Choo-Choo Charles | 7.7s |
| 8 | Overcooked! 2 | 7.7s |
| 9 | Heretic | 7.7s |
| 10 | Terraria | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 234.5s | 407.2s | 5.5s | 209.3s | 384.5s | 578.0s |
| Average | 3.8s | 6.8s | 0.1s | 3.5s | 6.4s | 9.6s |
| Max | 10.6s | 18.7s | 0.2s | 6.7s | 17.7s | 32.7s |
| Min | 2.9s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.6s) | Dark Souls III (18.7s) | A Link to the Past WorldGen 2 (0.2s) | A Link to the Past WorldGen 2 (6.7s) | Dark Souls III (17.7s) | Dark Souls III (32.7s) |
| Fastest | Saving Princess (2.9s) | Saving Princess (5.6s) | Wargroove (0.1s) | ChecksFinder (2.8s) | The Legend of Zelda (5.6s) | Hylics 2 (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.8s | 7.5s | 0.1s | 4.2s | 6.7s | 6.7s |
| A Link to the Past | 7.5s | 10.0s | 0.2s | 6.1s | 9.7s | 14.3s |
| A Link to the Past WorldGen 2 | 6.4s | 11.9s | 0.2s | 6.7s | 9.7s | 14.4s |
| A Short Hike | 3.3s | 8.0s | 0.1s | 3.2s | 5.7s | 5.6s |
| APQuest | 3.3s | 7.4s | 0.1s | 3.2s | 5.7s | 5.7s |
| Adventure | 3.5s | 8.8s | 0.1s | 3.2s | 5.6s | 5.6s |
| Aquaria | 4.3s | 7.7s | 0.1s | 3.4s | 5.7s | 5.8s |
| Baking Adventure | 3.0s | 7.9s | 0.1s | 2.9s | 5.6s | 14.1s |
| Bumper Stickers | 3.3s | 8.7s | 0.1s | 3.1s | 5.7s | 14.2s |
| Castlevania - Circle of the Moon | 3.4s | 8.8s | 0.1s | 3.1s | 5.6s | 5.6s |
| Castlevania 64 | 3.7s | 5.7s | 0.1s | 3.6s | 5.6s | 5.7s |
| Celeste 64 | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 14.3s |
| ChecksFinder | 3.0s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.2s | 7.7s | 0.1s | 3.2s | 7.6s | 7.7s |
| Civilization VI | 3.4s | 5.7s | 0.1s | 3.3s | 5.7s | 14.3s |
| Coding Adventure | 3.2s | 5.7s | 0.1s | 3.0s | 5.6s | 14.2s |
| DLCQuest | 3.4s | 5.7s | 0.1s | 3.0s | 5.7s | 5.8s |
| DOOM 1993 | 3.5s | 6.7s | 0.1s | 3.3s | 6.6s | 14.3s |
| DOOM II | 3.6s | 7.7s | 0.1s | 3.5s | 7.7s | 14.3s |
| Dark Souls III | 4.3s | 18.7s | 0.1s | 4.1s | 17.7s | 32.7s |
| Donkey Kong Country 3 | 3.4s | 5.7s | 0.1s | 3.3s | 5.6s | 14.2s |
| Factorio | 3.7s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Faxanadu | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 14.1s |
| Final Fantasy Mystic Quest | 4.3s | 6.7s | 0.1s | 3.7s | 6.7s | 6.7s |
| Heretic | 4.1s | 7.7s | 0.1s | 3.7s | 7.7s | 14.4s |
| Hylics 2 | 3.6s | 5.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| Inscryption | 3.1s | 5.7s | 0.1s | 3.1s | 5.6s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.3s | - | - | - | - | - |
| Links Awakening DX | 7.7s | 7.7s | 0.1s | 4.2s | 7.8s | 7.7s |
| Lufia II Ancient Cave | 3.4s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 4.1s | 7.7s | 0.1s | 4.2s | 7.7s | 7.8s |
| Math Adventure | 3.0s | 5.7s | 0.1s | 3.0s | 5.7s | 14.3s |
| Mega Man 2 | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.3s | 5.6s | 0.1s | 3.1s | 5.6s | 14.2s |
| Meritous | 3.2s | 5.7s | 0.1s | 3.1s | 5.6s | 5.7s |
| Metamath | 10.6s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 14.3s |
| Noita | 2.9s | 5.8s | 0.1s | 3.0s | 5.6s | 5.6s |
| Old School Runescape | 4.0s | 5.7s | 0.1s | 3.9s | 5.6s | 5.6s |
| Overcooked! 2 | 3.5s | 7.7s | 0.1s | 3.4s | 7.7s | 14.3s |
| Paint | 3.2s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.5s | 5.7s | 0.1s | 3.7s | 5.7s | 5.7s |
| Saving Princess | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 14.3s |
| Shivers | 3.3s | 5.7s | 0.1s | 3.2s | 5.6s | 14.3s |
| Sonic Adventure 2 Battle | 4.9s | 5.7s | 0.1s | 4.9s | 6.7s | 14.4s |
| Subnautica | 4.0s | 9.8s | 0.1s | 3.6s | 9.7s | 14.3s |
| Super Mario 64 | 3.2s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.7s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| Super Mario World | 4.6s | 5.7s | 0.1s | 3.5s | 5.7s | 5.6s |
| TOEM original | 3.1s | 5.6s | 0.1s | 3.0s | 5.7s | 5.6s |
| TOEM rule builder | 3.2s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Terraria | 3.3s | 7.7s | 0.1s | 3.3s | 7.7s | 7.7s |
| The Legend of Zelda | 3.6s | 5.7s | 0.1s | 3.1s | 5.6s | 14.2s |
| The Messenger | 3.5s | 8.8s | 0.1s | 3.4s | 8.8s | 8.8s |
| The Wind Waker | 5.1s | 5.8s | 0.1s | 5.5s | 5.7s | 14.4s |
| Timespinner | 4.5s | 5.7s | 0.1s | 3.9s | 5.6s | 5.7s |
| Undertale | 3.1s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| VVVVVV | 3.0s | 5.6s | 0.1s | 2.9s | 5.7s | 5.6s |
| Wargroove | 3.1s | 5.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| Yoshi's Island | 4.1s | 6.7s | 0.1s | 3.8s | 5.7s | 5.6s |
| shapez | 4.1s | 5.7s | 0.1s | 3.6s | 5.7s | 14.2s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.6s |
| 2 | Links Awakening DX | 7.7s |
| 3 | A Link to the Past | 7.5s |
| 4 | A Link to the Past WorldGen 2 | 6.4s |
| 5 | The Wind Waker | 5.1s |
| 6 | Sonic Adventure 2 Battle | 4.9s |
| 7 | A Hat in Time | 4.8s |
| 8 | Super Mario World | 4.6s |
| 9 | Timespinner | 4.5s |
| 10 | Dark Souls III | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past WorldGen 2 | 11.9s |
| 3 | A Link to the Past | 10.0s |
| 4 | Subnautica | 9.8s |
| 5 | The Messenger | 8.8s |
| 6 | Adventure | 8.8s |
| 7 | Castlevania - Circle of the Moon | 8.8s |
| 8 | Bumper Stickers | 8.7s |
| 9 | A Short Hike | 8.0s |
| 10 | Baking Adventure | 7.9s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | APQuest | 0.1s |
| 5 | Adventure | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | A Short Hike | 0.1s |
| 10 | Baking Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen 2 | 6.7s |
| 2 | A Link to the Past | 6.1s |
| 3 | The Wind Waker | 5.5s |
| 4 | Sonic Adventure 2 Battle | 4.9s |
| 5 | Links Awakening DX | 4.2s |
| 6 | A Hat in Time | 4.2s |
| 7 | Mario & Luigi Superstar Saga | 4.2s |
| 8 | Dark Souls III | 4.1s |
| 9 | Timespinner | 3.9s |
| 10 | Old School Runescape | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 17.7s |
| 2 | A Link to the Past WorldGen 2 | 9.7s |
| 3 | A Link to the Past | 9.7s |
| 4 | Subnautica | 9.7s |
| 5 | The Messenger | 8.8s |
| 6 | Links Awakening DX | 7.8s |
| 7 | Heretic | 7.7s |
| 8 | Terraria | 7.7s |
| 9 | Mario & Luigi Superstar Saga | 7.7s |
| 10 | DOOM II | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.7s |
| 2 | A Link to the Past WorldGen 2 | 14.4s |
| 3 | The Wind Waker | 14.4s |
| 4 | Heretic | 14.4s |
| 5 | Sonic Adventure 2 Battle | 14.4s |
| 6 | A Link to the Past | 14.3s |
| 7 | Civilization VI | 14.3s |
| 8 | Math Adventure | 14.3s |
| 9 | Muse Dash | 14.3s |
| 10 | Overcooked! 2 | 14.3s |
