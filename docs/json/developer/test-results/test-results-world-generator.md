# World Generator Test Results

**Generated:** 2026-01-01 00:16:51 UTC

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
| Stage 3: Rules Comparison | 6 | 54 | 60 |
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
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Total | 484.3s | 604.5s | 5.2s | 430.8s | 587.0s | 568.2s |
| Average | 7.9s | 9.9s | 0.1s | 7.1s | 9.8s | 9.5s |
| Max | 29.6s | 28.7s | 0.1s | 28.2s | 28.8s | 28.8s |
| Min | 3.0s | 5.5s | 0.1s | 2.6s | 5.6s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.6s) | Dark Souls III (28.7s) | A Hat in Time (0.1s) | Dark Souls III (28.2s) | Dark Souls III (28.8s) | Dark Souls III (28.8s) |
| Fastest | Paint (3.0s) | Saving Princess (5.5s) | Saving Princess (0.1s) | TUNIC (2.6s) | Undertale (5.6s) | Saving Princess (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.8s | 15.2s | 0.1s | 8.6s | 13.7s | 13.7s |
| A Link to the Past | 16.9s | 18.9s | 0.1s | 10.4s | 17.6s | 16.6s |
| A Short Hike | 5.5s | 12.8s | 0.1s | 5.4s | 9.7s | 9.7s |
| APQuest | 3.2s | 8.4s | 0.1s | 3.1s | 5.7s | 5.6s |
| Adventure | 3.4s | 7.0s | 0.1s | 3.5s | 5.6s | 5.6s |
| Aquaria | 14.3s | 9.2s | 0.1s | 9.2s | 7.7s | 8.7s |
| Baking Adventure | 3.2s | 6.0s | 0.1s | 3.0s | 5.6s | 5.6s |
| Bumper Stickers | 4.8s | 11.8s | 0.1s | 4.7s | 8.6s | 8.6s |
| Castlevania - Circle of the Moon | 5.5s | 8.6s | 0.1s | 5.4s | 5.7s | 5.6s |
| Castlevania 64 | 8.6s | 7.6s | 0.1s | 8.5s | 6.6s | 6.5s |
| Celeste 64 | 3.5s | 6.6s | 0.1s | 3.6s | 7.6s | 6.6s |
| ChecksFinder | 3.0s | 6.5s | 0.1s | 3.1s | 6.5s | 6.5s |
| Choo-Choo Charles | 18.3s | 10.7s | 0.1s | 18.1s | 9.7s | 10.7s |
| Civilization VI | 6.0s | 8.7s | 0.1s | 6.4s | 8.7s | 8.7s |
| Coding Adventure | 3.8s | 8.6s | 0.1s | 3.9s | 8.6s | 8.6s |
| DLCQuest | 3.9s | 5.7s | 0.1s | 3.9s | 5.7s | 5.6s |
| DOOM 1993 | 11.1s | 12.7s | 0.1s | 11.1s | 12.6s | 12.6s |
| DOOM II | 13.9s | 15.7s | 0.1s | 13.8s | 15.7s | 15.8s |
| Dark Souls III | 27.7s | 28.7s | 0.1s | 28.2s | 28.8s | 28.8s |
| Donkey Kong Country 3 | 7.6s | 14.6s | 0.1s | 7.5s | 14.7s | 14.7s |
| Factorio | 5.9s | 9.8s | 0.1s | 5.3s | 9.7s | 9.7s |
| Faxanadu | 4.7s | 6.5s | 0.1s | 5.2s | 8.5s | 6.4s |
| Final Fantasy Mystic Quest | 13.1s | 10.9s | 0.1s | 12.2s | 10.7s | 10.7s |
| Heretic | 15.2s | 14.7s | 0.1s | 15.1s | 14.7s | 14.8s |
| Hylics 2 | 6.2s | 6.6s | 0.1s | 5.4s | 6.6s | 6.6s |
| Inscryption | 4.7s | 6.6s | 0.1s | 4.5s | 6.7s | 6.7s |
| Landstalker - The Treasures of King Nole | 9.4s | 8.6s | 0.1s | 10.0s | 17.6s | 8.6s |
| Links Awakening DX | 9.3s | 16.8s | 0.1s | 10.3s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 3.9s | 5.6s | 0.1s | 3.7s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 10.8s | 9.6s | 0.1s | 12.2s | 9.5s | 9.6s |
| Math Adventure | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Mega Man 2 | 3.9s | 6.4s | 0.1s | 3.8s | 6.5s | 6.5s |
| MegaMan Battle Network 3 | 8.2s | 8.7s | 0.1s | 8.1s | 8.7s | 8.7s |
| Meritous | 5.3s | 5.7s | 0.1s | 5.4s | 5.6s | 5.6s |
| Metamath | 9.8s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 4.3s | 7.7s | 0.1s | 4.2s | 9.7s | 7.7s |
| Noita | 5.9s | 5.6s | 0.1s | 5.8s | 5.6s | 5.6s |
| Old School Runescape | 8.0s | 8.7s | 0.1s | 6.7s | 8.6s | 8.6s |
| Overcooked! 2 | 6.0s | 19.8s | 0.1s | 7.3s | 19.8s | 19.7s |
| Paint | 3.0s | 7.6s | 0.1s | 4.2s | 6.5s | 6.6s |
| Risk of Rain 2 | 6.0s | 6.6s | 0.1s | 6.0s | 6.6s | 6.7s |
| Saving Princess | 3.5s | 5.5s | 0.1s | 3.5s | 6.5s | 5.5s |
| Shivers | 6.1s | 9.7s | 0.1s | 6.0s | 9.7s | 9.8s |
| Sonic Adventure 2 Battle | 8.2s | 13.7s | 0.1s | 7.9s | 16.7s | 13.8s |
| Subnautica | 29.6s | 14.7s | 0.1s | 7.5s | 14.7s | 14.6s |
| Super Mario 64 | 6.5s | 12.7s | 0.1s | 6.4s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.7s | 7.6s | 0.1s | 4.6s | 7.6s | 7.6s |
| Super Mario World | 8.7s | 6.6s | 0.1s | 7.6s | 6.6s | 6.6s |
| TOEM original | 6.4s | 9.7s | 0.1s | 6.4s | 9.6s | 9.6s |
| TOEM rule builder | 6.2s | 9.6s | 0.1s | 6.1s | 9.5s | 9.5s |
| TUNIC | 14.5s | 12.7s | 0.1s | 2.6s | - | - |
| Terraria | 5.5s | 20.7s | 0.1s | 5.6s | 20.6s | 20.6s |
| The Legend of Zelda | 6.5s | 8.7s | 0.1s | 5.0s | 10.7s | 8.7s |
| The Messenger | 7.5s | 13.9s | 0.1s | 7.2s | 12.8s | 12.9s |
| The Wind Waker | 16.3s | 9.8s | 0.1s | 19.3s | 9.6s | 9.6s |
| Timespinner | 7.6s | 7.7s | 0.1s | 7.0s | 6.7s | 6.6s |
| Undertale | 3.6s | 5.6s | 0.1s | 3.6s | 5.6s | 5.6s |
| VVVVVV | 3.3s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Wargroove | 3.5s | 6.6s | 0.1s | 3.5s | 6.6s | 6.7s |
| Yoshi's Island | 6.5s | 9.6s | 0.1s | 8.5s | 8.5s | 8.5s |
| shapez | 7.7s | 6.6s | 0.1s | 6.2s | 6.6s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.6s |
| 2 | Dark Souls III | 27.7s |
| 3 | Choo-Choo Charles | 18.3s |
| 4 | A Link to the Past | 16.9s |
| 5 | The Wind Waker | 16.3s |
| 6 | Heretic | 15.2s |
| 7 | TUNIC | 14.5s |
| 8 | Aquaria | 14.3s |
| 9 | DOOM II | 13.9s |
| 10 | Final Fantasy Mystic Quest | 13.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.7s |
| 2 | Terraria | 20.7s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | A Link to the Past | 18.9s |
| 5 | Links Awakening DX | 16.8s |
| 6 | DOOM II | 15.7s |
| 7 | A Hat in Time | 15.2s |
| 8 | Heretic | 14.7s |
| 9 | Subnautica | 14.7s |
| 10 | Donkey Kong Country 3 | 14.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Hat in Time | 0.1s |
| 2 | A Link to the Past | 0.1s |
| 3 | Aquaria | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | APQuest | 0.1s |
| 6 | Adventure | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | Baking Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.2s |
| 2 | The Wind Waker | 19.3s |
| 3 | Choo-Choo Charles | 18.1s |
| 4 | Heretic | 15.1s |
| 5 | DOOM II | 13.8s |
| 6 | Mario & Luigi Superstar Saga | 12.2s |
| 7 | Final Fantasy Mystic Quest | 12.2s |
| 8 | DOOM 1993 | 11.1s |
| 9 | A Link to the Past | 10.4s |
| 10 | Links Awakening DX | 10.3s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | Terraria | 20.6s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | A Link to the Past | 17.6s |
| 5 | Landstalker - The Treasures of King Nole | 17.6s |
| 6 | Links Awakening DX | 16.7s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | DOOM II | 15.7s |
| 9 | Heretic | 14.7s |
| 10 | Subnautica | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | Terraria | 20.6s |
| 3 | Overcooked! 2 | 19.7s |
| 4 | Links Awakening DX | 16.7s |
| 5 | A Link to the Past | 16.6s |
| 6 | DOOM II | 15.8s |
| 7 | Heretic | 14.8s |
| 8 | Donkey Kong Country 3 | 14.7s |
| 9 | Subnautica | 14.6s |
| 10 | Sonic Adventure 2 Battle | 13.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 488.7s | 597.8s | 5.2s | 437.8s | 587.5s | 699.3s |
| Average | 8.0s | 9.8s | 0.1s | 7.2s | 9.8s | 11.7s |
| Max | 29.7s | 28.8s | 0.1s | 28.7s | 26.8s | 23.6s |
| Min | 2.9s | 5.4s | 0.1s | 2.9s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.7s) | Dark Souls III (28.8s) | A Link to the Past (0.1s) | Dark Souls III (28.7s) | Dark Souls III (26.8s) | Terraria (23.6s) |
| Fastest | Paint (2.9s) | DLCQuest (5.4s) | Wargroove (0.1s) | TUNIC (2.9s) | DLCQuest (5.5s) | DLCQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 11.2s | 15.3s | 0.1s | 9.7s | 13.8s | 13.8s |
| A Link to the Past | 18.2s | 18.9s | 0.1s | 10.9s | 18.7s | 14.3s |
| A Short Hike | 5.3s | 10.4s | 0.1s | 5.3s | 9.6s | 9.7s |
| APQuest | 3.2s | 8.2s | 0.1s | 3.2s | 5.7s | 5.7s |
| Adventure | 3.5s | 6.8s | 0.1s | 3.5s | 5.6s | 14.2s |
| Aquaria | 12.8s | 9.8s | 0.1s | 8.6s | 8.5s | 14.0s |
| Baking Adventure | 3.3s | 7.8s | 0.1s | 3.1s | 5.6s | 14.3s |
| Bumper Stickers | 4.8s | 9.6s | 0.1s | 4.7s | 8.6s | 14.2s |
| Castlevania - Circle of the Moon | 5.5s | 6.9s | 0.1s | 5.5s | 5.6s | 14.3s |
| Castlevania 64 | 8.6s | 9.2s | 0.1s | 8.3s | 6.6s | 6.6s |
| Celeste 64 | 3.7s | 6.9s | 0.1s | 4.0s | 7.8s | 14.6s |
| ChecksFinder | 3.3s | 6.6s | 0.1s | 3.1s | 6.6s | 6.6s |
| Choo-Choo Charles | 18.3s | 9.7s | 0.1s | 18.0s | 9.7s | 9.7s |
| Civilization VI | 6.0s | 8.7s | 0.1s | 6.3s | 8.7s | 17.4s |
| Coding Adventure | 3.9s | 8.6s | 0.1s | 4.0s | 8.7s | 14.2s |
| DLCQuest | 3.6s | 5.4s | 0.1s | 3.5s | 5.5s | 5.5s |
| DOOM 1993 | 11.4s | 12.7s | 0.1s | 11.2s | 12.7s | 14.2s |
| DOOM II | 14.1s | 14.7s | 0.1s | 13.9s | 15.7s | 14.3s |
| Dark Souls III | 28.2s | 28.8s | 0.1s | 28.7s | 26.8s | 17.4s |
| Donkey Kong Country 3 | 7.7s | 13.7s | 0.1s | 7.6s | 13.6s | 14.9s |
| Factorio | 6.1s | 9.8s | 0.1s | 6.0s | 9.8s | 9.8s |
| Faxanadu | 4.8s | 6.6s | 0.1s | 5.2s | 8.6s | 14.2s |
| Final Fantasy Mystic Quest | 13.1s | 10.8s | 0.1s | 11.9s | 10.7s | 10.7s |
| Heretic | 15.4s | 14.7s | 0.1s | 15.1s | 15.7s | 14.3s |
| Hylics 2 | 6.5s | 6.6s | 0.1s | 5.5s | 6.6s | 6.6s |
| Inscryption | 4.3s | 6.5s | 0.1s | 4.3s | 6.5s | 6.5s |
| Landstalker - The Treasures of King Nole | 9.8s | 8.6s | 0.1s | 10.5s | 17.7s | 14.2s |
| Links Awakening DX | 9.4s | 16.7s | 0.1s | 10.4s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 4.0s | 5.6s | 0.1s | 3.8s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 11.0s | 9.7s | 0.1s | 12.9s | 9.6s | 9.7s |
| Math Adventure | 3.2s | 5.7s | 0.1s | 3.4s | 5.8s | 14.6s |
| Mega Man 2 | 4.0s | 6.6s | 0.1s | 3.8s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 8.2s | 8.6s | 0.1s | 8.2s | 8.7s | 17.3s |
| Meritous | 5.3s | 5.7s | 0.1s | 5.5s | 5.7s | 14.2s |
| Metamath | 10.3s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 3.9s | 7.5s | 0.1s | 3.8s | 9.5s | 13.9s |
| Noita | 5.9s | 5.6s | 0.1s | 5.9s | 5.6s | 5.6s |
| Old School Runescape | 8.0s | 8.6s | 0.1s | 6.8s | 8.7s | 8.7s |
| Overcooked! 2 | 6.2s | 19.8s | 0.1s | 7.3s | 19.8s | 14.3s |
| Paint | 2.9s | 6.8s | 0.1s | 4.3s | 6.6s | 6.6s |
| Risk of Rain 2 | 6.3s | 6.8s | 0.1s | 6.7s | 6.8s | 6.8s |
| Saving Princess | 3.6s | 5.6s | 0.1s | 3.5s | 6.6s | 14.2s |
| Shivers | 6.0s | 9.7s | 0.1s | 6.0s | 9.7s | 14.3s |
| Sonic Adventure 2 Battle | 8.3s | 13.7s | 0.1s | 8.1s | 16.7s | 14.4s |
| Subnautica | 29.7s | 14.7s | 0.1s | 7.5s | 14.7s | 17.6s |
| Super Mario 64 | 5.8s | 12.5s | 0.1s | 6.1s | 12.6s | 12.5s |
| Super Mario Land 2 | 5.0s | 8.6s | 0.1s | 4.8s | 7.7s | 7.7s |
| Super Mario World | 8.7s | 6.6s | 0.1s | 7.8s | 6.6s | 6.6s |
| TOEM original | 6.4s | 9.7s | 0.1s | 6.5s | 8.7s | 9.7s |
| TOEM rule builder | 6.2s | 8.6s | 0.1s | 6.3s | 8.6s | 8.6s |
| TUNIC | 15.3s | 12.8s | 0.1s | 2.9s | - | - |
| Terraria | 5.8s | 19.7s | 0.1s | 5.7s | 19.8s | 23.6s |
| The Legend of Zelda | 6.3s | 8.6s | 0.1s | 5.0s | 10.7s | 14.3s |
| The Messenger | 7.8s | 13.9s | 0.1s | 7.4s | 13.9s | 13.8s |
| The Wind Waker | 16.2s | 9.8s | 0.1s | 19.3s | 9.7s | 14.3s |
| Timespinner | 7.0s | 7.5s | 0.1s | 6.9s | 7.5s | 14.0s |
| Undertale | 3.8s | 5.6s | 0.1s | 3.7s | 5.6s | 5.6s |
| VVVVVV | 3.3s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Wargroove | 3.5s | 6.7s | 0.1s | 3.6s | 6.7s | 6.7s |
| Yoshi's Island | 6.5s | 9.7s | 0.1s | 9.0s | 8.6s | 8.6s |
| shapez | 8.5s | 6.7s | 0.1s | 6.9s | 6.8s | 14.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.7s |
| 2 | Dark Souls III | 28.2s |
| 3 | Choo-Choo Charles | 18.3s |
| 4 | A Link to the Past | 18.2s |
| 5 | The Wind Waker | 16.2s |
| 6 | Heretic | 15.4s |
| 7 | TUNIC | 15.3s |
| 8 | DOOM II | 14.1s |
| 9 | Final Fantasy Mystic Quest | 13.1s |
| 10 | Aquaria | 12.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | Overcooked! 2 | 19.8s |
| 3 | Terraria | 19.7s |
| 4 | A Link to the Past | 18.9s |
| 5 | Links Awakening DX | 16.7s |
| 6 | A Hat in Time | 15.3s |
| 7 | Heretic | 14.7s |
| 8 | DOOM II | 14.7s |
| 9 | Subnautica | 14.7s |
| 10 | The Messenger | 13.9s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | A Hat in Time | 0.1s |
| 3 | A Short Hike | 0.1s |
| 4 | APQuest | 0.1s |
| 5 | Adventure | 0.1s |
| 6 | Baking Adventure | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | Aquaria | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.7s |
| 2 | The Wind Waker | 19.3s |
| 3 | Choo-Choo Charles | 18.0s |
| 4 | Heretic | 15.1s |
| 5 | DOOM II | 13.9s |
| 6 | Mario & Luigi Superstar Saga | 12.9s |
| 7 | Final Fantasy Mystic Quest | 11.9s |
| 8 | DOOM 1993 | 11.2s |
| 9 | A Link to the Past | 10.9s |
| 10 | Landstalker - The Treasures of King Nole | 10.5s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 26.8s |
| 2 | Overcooked! 2 | 19.8s |
| 3 | Terraria | 19.8s |
| 4 | A Link to the Past | 18.7s |
| 5 | Landstalker - The Treasures of King Nole | 17.7s |
| 6 | Links Awakening DX | 16.7s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | DOOM II | 15.7s |
| 9 | Heretic | 15.7s |
| 10 | Subnautica | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.6s |
| 2 | Subnautica | 17.6s |
| 3 | Dark Souls III | 17.4s |
| 4 | Civilization VI | 17.4s |
| 5 | MegaMan Battle Network 3 | 17.3s |
| 6 | Links Awakening DX | 16.7s |
| 7 | Donkey Kong Country 3 | 14.9s |
| 8 | shapez | 14.7s |
| 9 | Celeste 64 | 14.6s |
| 10 | Math Adventure | 14.6s |
