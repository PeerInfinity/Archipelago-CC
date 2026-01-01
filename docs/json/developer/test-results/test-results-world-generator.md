# World Generator Test Results

**Generated:** 2026-01-01 05:32:31 UTC

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
| Original Spoiler Test | 58 | 2 | 60 |
| Stage 1: World Generation | 60 | 0 | 60 |
| Stage 2: Seed Generation | 59 | 1 | 60 |
| Stage 3: Rules Comparison | 59 | 0 | 59 |
| Stage 4: WorldGen Spoiler Test | 59 | 0 | 59 |
| Stage 5: Cross-Validation | 58 | 1 | 59 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Factorio | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Timespinner | ✅ | ❌ | ✅ | ❌ | - | - | - |
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
| Original Spoiler Test | 58 | 2 | 60 |
| Stage 1: World Generation | 60 | 0 | 60 |
| Stage 2: Seed Generation | 59 | 1 | 60 |
| Stage 3: Rules Comparison | 0 | 59 | 59 |
| Stage 4: WorldGen Spoiler Test | 59 | 0 | 59 |
| Stage 5: Cross-Validation | 29 | 30 | 59 |

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
| Factorio | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Timespinner | ✅ | ❌ | ✅ | ❌ | - | - | - |
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
| Total | 470.1s | 613.4s | 5.1s | 428.1s | 582.5s | 569.1s |
| Average | 7.8s | 10.2s | 0.1s | 7.1s | 9.9s | 9.6s |
| Max | 29.2s | 28.9s | 0.1s | 28.3s | 28.8s | 28.8s |
| Min | 3.0s | 5.5s | 0.1s | 2.5s | 5.4s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Dark Souls III (29.2s) | Dark Souls III (28.9s) | A Hat in Time (0.1s) | Dark Souls III (28.3s) | Dark Souls III (28.8s) | Dark Souls III (28.8s) |
| Fastest | Paint (3.0s) | Metamath (5.5s) | Wargroove (0.1s) | Timespinner (2.5s) | Metamath (5.4s) | Metamath (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 11.0s | 18.8s | 0.1s | 8.8s | 13.7s | 13.7s |
| A Link to the Past | 18.1s | 21.6s | 0.1s | 11.1s | 17.7s | 16.7s |
| A Short Hike | 5.3s | 11.9s | 0.1s | 5.3s | 9.6s | 9.7s |
| APQuest | 3.1s | 8.9s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.3s | 5.9s | 0.1s | 3.3s | 5.5s | 5.5s |
| Aquaria | 13.8s | 8.9s | 0.1s | 9.1s | 7.7s | 8.7s |
| Baking Adventure | 3.4s | 8.2s | 0.1s | 3.3s | 5.7s | 5.7s |
| Bumper Stickers | 4.5s | 11.3s | 0.1s | 4.3s | 8.4s | 8.4s |
| Castlevania - Circle of the Moon | 5.6s | 8.2s | 0.1s | 5.7s | 5.7s | 5.7s |
| Castlevania 64 | 8.6s | 10.3s | 0.1s | 8.7s | 6.7s | 6.7s |
| Celeste 64 | 3.6s | 6.7s | 0.1s | 3.8s | 7.7s | 6.7s |
| ChecksFinder | 3.2s | 6.8s | 0.1s | 3.2s | 6.6s | 6.6s |
| Choo-Choo Charles | 18.2s | 10.7s | 0.1s | 18.2s | 9.7s | 10.7s |
| Civilization VI | 6.0s | 8.6s | 0.1s | 6.2s | 8.6s | 8.6s |
| Coding Adventure | 3.6s | 8.4s | 0.1s | 3.7s | 8.5s | 8.5s |
| DLCQuest | 3.8s | 5.7s | 0.1s | 3.7s | 5.6s | 5.6s |
| DOOM 1993 | 11.6s | 12.7s | 0.1s | 11.4s | 12.8s | 12.7s |
| DOOM II | 13.0s | 15.5s | 0.1s | 12.9s | 15.5s | 15.6s |
| Dark Souls III | 29.2s | 28.9s | 0.1s | 28.3s | 28.8s | 28.8s |
| Donkey Kong Country 3 | 7.9s | 13.7s | 0.1s | 8.1s | 14.7s | 14.7s |
| Factorio | 6.1s | 14.6s | 0.1s | 5.5s | 9.7s | 14.3s |
| Faxanadu | 4.9s | 6.6s | 0.1s | 5.3s | 8.7s | 6.6s |
| Final Fantasy Mystic Quest | 13.4s | 10.7s | 0.1s | 12.4s | 10.7s | 10.7s |
| Heretic | 15.0s | 14.7s | 0.1s | 14.8s | 14.7s | 14.7s |
| Hylics 2 | 5.8s | 6.5s | 0.1s | 5.2s | 6.5s | 6.4s |
| Inscryption | 4.6s | 6.6s | 0.1s | 4.4s | 6.6s | 6.7s |
| Landstalker - The Treasures of King Nole | 9.8s | 8.7s | 0.1s | 10.4s | 17.8s | 8.7s |
| Links Awakening DX | 10.2s | 17.6s | 0.1s | 9.4s | 17.5s | 17.6s |
| Lufia II Ancient Cave | 4.2s | 5.7s | 0.1s | 3.8s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 11.2s | 9.7s | 0.1s | 13.5s | 9.7s | 9.7s |
| Math Adventure | 3.1s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Mega Man 2 | 4.1s | 6.7s | 0.1s | 3.9s | 6.6s | 6.7s |
| MegaMan Battle Network 3 | 8.3s | 8.6s | 0.1s | 8.3s | 8.6s | 8.7s |
| Meritous | 5.2s | 5.8s | 0.1s | 5.2s | 5.6s | 5.6s |
| Metamath | 10.2s | 5.5s | 0.1s | 2.8s | 5.4s | 5.5s |
| Muse Dash | 4.1s | 7.6s | 0.1s | 3.9s | 9.7s | 7.6s |
| Noita | 5.8s | 5.7s | 0.1s | 6.0s | 5.7s | 5.7s |
| Old School Runescape | 7.7s | 8.5s | 0.1s | 6.5s | 8.5s | 8.5s |
| Overcooked! 2 | 6.1s | 19.8s | 0.1s | 7.7s | 19.9s | 19.8s |
| Paint | 3.0s | 7.7s | 0.1s | 4.6s | 6.7s | 6.7s |
| Risk of Rain 2 | 6.4s | 6.7s | 0.1s | 6.3s | 6.7s | 6.7s |
| Saving Princess | 3.6s | 5.6s | 0.1s | 3.6s | 6.6s | 5.6s |
| Shivers | 6.1s | 9.7s | 0.1s | 6.1s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 8.1s | 13.7s | 0.1s | 7.9s | 16.7s | 13.7s |
| Subnautica | 26.3s | 14.6s | 0.1s | 7.0s | 14.5s | 14.5s |
| Super Mario 64 | 6.1s | 12.7s | 0.1s | 6.3s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.9s | 8.7s | 0.1s | 4.7s | 7.7s | 7.8s |
| Super Mario World | 8.3s | 6.4s | 0.1s | 7.4s | 6.5s | 6.5s |
| TOEM original | 6.5s | 9.8s | 0.1s | 6.8s | 9.8s | 9.8s |
| TOEM rule builder | 6.5s | 9.7s | 0.1s | 6.5s | 9.7s | 9.7s |
| Terraria | 6.0s | 20.8s | 0.1s | 5.8s | 20.8s | 20.8s |
| The Legend of Zelda | 6.3s | 8.7s | 0.1s | 5.0s | 10.7s | 8.6s |
| The Messenger | 7.6s | 13.8s | 0.1s | 7.3s | 12.8s | 13.8s |
| The Wind Waker | 16.2s | 9.7s | 0.1s | 19.1s | 9.7s | 9.7s |
| Timespinner | 6.8s | 13.9s | 0.1s | 2.5s | - | - |
| Undertale | 3.8s | 5.6s | 0.1s | 3.8s | 5.6s | 5.6s |
| VVVVVV | 3.3s | 5.7s | 0.1s | 3.3s | 5.7s | 5.6s |
| Wargroove | 3.1s | 6.4s | 0.1s | 3.5s | 6.5s | 6.5s |
| Yoshi's Island | 6.8s | 9.7s | 0.1s | 9.8s | 8.7s | 8.7s |
| shapez | 7.8s | 6.7s | 0.1s | 6.5s | 6.7s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 29.2s |
| 2 | Subnautica | 26.3s |
| 3 | Choo-Choo Charles | 18.2s |
| 4 | A Link to the Past | 18.1s |
| 5 | The Wind Waker | 16.2s |
| 6 | Heretic | 15.0s |
| 7 | Aquaria | 13.8s |
| 8 | Final Fantasy Mystic Quest | 13.4s |
| 9 | DOOM II | 13.0s |
| 10 | DOOM 1993 | 11.6s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.9s |
| 2 | A Link to the Past | 21.6s |
| 3 | Terraria | 20.8s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | A Hat in Time | 18.8s |
| 6 | Links Awakening DX | 17.6s |
| 7 | DOOM II | 15.5s |
| 8 | Heretic | 14.7s |
| 9 | Subnautica | 14.6s |
| 10 | Factorio | 14.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Hat in Time | 0.1s |
| 2 | A Link to the Past | 0.1s |
| 3 | Aquaria | 0.1s |
| 4 | Castlevania - Circle of the Moon | 0.1s |
| 5 | Castlevania 64 | 0.1s |
| 6 | A Short Hike | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Baking Adventure | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.3s |
| 2 | The Wind Waker | 19.1s |
| 3 | Choo-Choo Charles | 18.2s |
| 4 | Heretic | 14.8s |
| 5 | Mario & Luigi Superstar Saga | 13.5s |
| 6 | DOOM II | 12.9s |
| 7 | Final Fantasy Mystic Quest | 12.4s |
| 8 | DOOM 1993 | 11.4s |
| 9 | A Link to the Past | 11.1s |
| 10 | Landstalker - The Treasures of King Nole | 10.4s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | Terraria | 20.8s |
| 3 | Overcooked! 2 | 19.9s |
| 4 | Landstalker - The Treasures of King Nole | 17.8s |
| 5 | A Link to the Past | 17.7s |
| 6 | Links Awakening DX | 17.5s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | DOOM II | 15.5s |
| 9 | Donkey Kong Country 3 | 14.7s |
| 10 | Heretic | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.8s |
| 2 | Terraria | 20.8s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | Links Awakening DX | 17.6s |
| 5 | A Link to the Past | 16.7s |
| 6 | DOOM II | 15.6s |
| 7 | Donkey Kong Country 3 | 14.7s |
| 8 | Heretic | 14.7s |
| 9 | Subnautica | 14.5s |
| 10 | Factorio | 14.3s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 479.1s | 599.8s | 5.2s | 434.4s | 582.2s | 692.7s |
| Average | 8.0s | 10.0s | 0.1s | 7.2s | 9.9s | 11.7s |
| Max | 29.8s | 28.9s | 0.1s | 29.9s | 27.9s | 23.6s |
| Min | 3.0s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.8s) | Dark Souls III (28.9s) | A Link to the Past (0.1s) | Dark Souls III (29.9s) | Dark Souls III (27.9s) | Terraria (23.6s) |
| Fastest | Paint (3.0s) | Meritous (5.6s) | Wargroove (0.1s) | Timespinner (2.6s) | Math Adventure (5.6s) | APQuest (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 10.8s | 14.7s | 0.1s | 8.8s | 13.7s | 13.7s |
| A Link to the Past | 18.6s | 18.5s | 0.1s | 11.1s | 18.7s | 14.5s |
| A Short Hike | 5.2s | 10.3s | 0.1s | 5.5s | 9.7s | 9.7s |
| APQuest | 3.4s | 8.4s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure | 3.5s | 6.5s | 0.1s | 3.8s | 5.7s | 14.2s |
| Aquaria | 14.2s | 10.2s | 0.1s | 9.1s | 7.7s | 14.4s |
| Baking Adventure | 3.4s | 6.9s | 0.1s | 3.2s | 5.6s | 14.2s |
| Bumper Stickers | 4.7s | 9.7s | 0.1s | 4.5s | 8.5s | 13.9s |
| Castlevania - Circle of the Moon | 5.8s | 8.0s | 0.1s | 5.6s | 5.7s | 14.4s |
| Castlevania 64 | 8.7s | 7.5s | 0.1s | 8.7s | 6.7s | 6.7s |
| Celeste 64 | 3.5s | 6.6s | 0.1s | 3.6s | 7.6s | 14.4s |
| ChecksFinder | 3.2s | 6.6s | 0.1s | 3.2s | 6.6s | 6.6s |
| Choo-Choo Charles | 18.9s | 10.7s | 0.1s | 18.0s | 9.6s | 9.7s |
| Civilization VI | 6.0s | 8.7s | 0.1s | 6.4s | 8.6s | 17.3s |
| Coding Adventure | 4.0s | 8.7s | 0.1s | 4.1s | 8.7s | 14.2s |
| DLCQuest | 4.0s | 5.7s | 0.1s | 3.8s | 5.7s | 5.7s |
| DOOM 1993 | 11.6s | 12.7s | 0.1s | 11.5s | 12.7s | 14.3s |
| DOOM II | 13.4s | 15.6s | 0.1s | 13.3s | 15.5s | 14.0s |
| Dark Souls III | 28.7s | 28.9s | 0.1s | 29.9s | 27.9s | 17.6s |
| Donkey Kong Country 3 | 7.8s | 14.7s | 0.1s | 7.7s | 13.7s | 15.0s |
| Factorio | 6.2s | 14.3s | 0.1s | 5.5s | 9.7s | 14.2s |
| Faxanadu | 4.9s | 6.6s | 0.1s | 5.3s | 8.6s | 14.2s |
| Final Fantasy Mystic Quest | 13.2s | 10.7s | 0.1s | 12.5s | 10.7s | 10.8s |
| Heretic | 15.2s | 14.7s | 0.1s | 15.1s | 14.7s | 14.3s |
| Hylics 2 | 6.3s | 6.7s | 0.1s | 5.7s | 6.6s | 6.6s |
| Inscryption | 4.6s | 6.7s | 0.1s | 4.8s | 6.7s | 6.7s |
| Landstalker - The Treasures of King Nole | 10.0s | 8.7s | 0.1s | 10.6s | 17.7s | 14.4s |
| Links Awakening DX | 10.2s | 17.7s | 0.1s | 10.1s | 17.6s | 17.6s |
| Lufia II Ancient Cave | 4.1s | 5.7s | 0.1s | 4.0s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 11.0s | 9.7s | 0.1s | 13.1s | 9.7s | 9.8s |
| Math Adventure | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| Mega Man 2 | 4.1s | 6.6s | 0.1s | 3.9s | 6.6s | 6.7s |
| MegaMan Battle Network 3 | 8.1s | 8.7s | 0.1s | 8.0s | 8.6s | 17.4s |
| Meritous | 5.2s | 5.6s | 0.1s | 5.3s | 5.6s | 14.2s |
| Metamath | 10.7s | 5.7s | 0.1s | 3.1s | 5.6s | 5.6s |
| Muse Dash | 4.3s | 7.7s | 0.1s | 4.1s | 9.7s | 14.4s |
| Noita | 6.0s | 5.7s | 0.1s | 6.0s | 5.6s | 5.6s |
| Old School Runescape | 7.6s | 8.5s | 0.1s | 6.6s | 8.5s | 8.5s |
| Overcooked! 2 | 6.4s | 19.8s | 0.1s | 7.6s | 20.8s | 14.6s |
| Paint | 3.0s | 7.8s | 0.1s | 4.8s | 6.8s | 6.8s |
| Risk of Rain 2 | 6.1s | 6.7s | 0.1s | 6.0s | 6.6s | 6.6s |
| Saving Princess | 3.7s | 5.6s | 0.1s | 3.6s | 6.6s | 14.2s |
| Shivers | 6.0s | 9.7s | 0.1s | 6.2s | 9.7s | 14.3s |
| Sonic Adventure 2 Battle | 8.2s | 13.7s | 0.1s | 7.9s | 16.7s | 14.4s |
| Subnautica | 29.8s | 15.8s | 0.1s | 7.5s | 14.7s | 17.3s |
| Super Mario 64 | 6.2s | 12.7s | 0.1s | 6.5s | 12.8s | 12.7s |
| Super Mario Land 2 | 5.1s | 8.7s | 0.1s | 4.8s | 7.7s | 7.7s |
| Super Mario World | 8.4s | 6.5s | 0.1s | 7.5s | 6.5s | 6.5s |
| TOEM original | 6.7s | 9.7s | 0.1s | 6.8s | 9.8s | 9.8s |
| TOEM rule builder | 6.4s | 8.7s | 0.1s | 6.6s | 9.8s | 9.7s |
| Terraria | 5.7s | 19.8s | 0.1s | 5.7s | 19.7s | 23.6s |
| The Legend of Zelda | 6.4s | 8.7s | 0.1s | 5.2s | 10.7s | 14.2s |
| The Messenger | 7.3s | 12.9s | 0.1s | 7.1s | 12.8s | 13.8s |
| The Wind Waker | 16.5s | 9.7s | 0.1s | 19.4s | 9.7s | 14.2s |
| Timespinner | 7.7s | 14.5s | 0.1s | 2.6s | - | - |
| Undertale | 3.9s | 5.6s | 0.1s | 3.9s | 5.7s | 5.7s |
| VVVVVV | 3.4s | 5.6s | 0.1s | 3.4s | 5.6s | 5.6s |
| Wargroove | 3.3s | 6.5s | 0.1s | 3.6s | 6.5s | 6.5s |
| Yoshi's Island | 7.0s | 9.7s | 0.1s | 9.8s | 8.7s | 8.7s |
| shapez | 7.6s | 6.7s | 0.1s | 6.6s | 6.7s | 14.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.8s |
| 2 | Dark Souls III | 28.7s |
| 3 | Choo-Choo Charles | 18.9s |
| 4 | A Link to the Past | 18.6s |
| 5 | The Wind Waker | 16.5s |
| 6 | Heretic | 15.2s |
| 7 | Aquaria | 14.2s |
| 8 | DOOM II | 13.4s |
| 9 | Final Fantasy Mystic Quest | 13.2s |
| 10 | DOOM 1993 | 11.6s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 28.9s |
| 2 | Overcooked! 2 | 19.8s |
| 3 | Terraria | 19.8s |
| 4 | A Link to the Past | 18.5s |
| 5 | Links Awakening DX | 17.7s |
| 6 | Subnautica | 15.8s |
| 7 | DOOM II | 15.6s |
| 8 | Heretic | 14.7s |
| 9 | Donkey Kong Country 3 | 14.7s |
| 10 | A Hat in Time | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | A Hat in Time | 0.1s |
| 3 | Aquaria | 0.1s |
| 4 | Castlevania - Circle of the Moon | 0.1s |
| 5 | Castlevania 64 | 0.1s |
| 6 | A Short Hike | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 29.9s |
| 2 | The Wind Waker | 19.4s |
| 3 | Choo-Choo Charles | 18.0s |
| 4 | Heretic | 15.1s |
| 5 | DOOM II | 13.3s |
| 6 | Mario & Luigi Superstar Saga | 13.1s |
| 7 | Final Fantasy Mystic Quest | 12.5s |
| 8 | DOOM 1993 | 11.5s |
| 9 | A Link to the Past | 11.1s |
| 10 | Landstalker - The Treasures of King Nole | 10.6s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 27.9s |
| 2 | Overcooked! 2 | 20.8s |
| 3 | Terraria | 19.7s |
| 4 | A Link to the Past | 18.7s |
| 5 | Landstalker - The Treasures of King Nole | 17.7s |
| 6 | Links Awakening DX | 17.6s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | DOOM II | 15.5s |
| 9 | Heretic | 14.7s |
| 10 | Subnautica | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.6s |
| 2 | Links Awakening DX | 17.6s |
| 3 | Dark Souls III | 17.6s |
| 4 | MegaMan Battle Network 3 | 17.4s |
| 5 | Civilization VI | 17.3s |
| 6 | Subnautica | 17.3s |
| 7 | Donkey Kong Country 3 | 15.0s |
| 8 | shapez | 14.7s |
| 9 | Overcooked! 2 | 14.6s |
| 10 | A Link to the Past | 14.5s |
