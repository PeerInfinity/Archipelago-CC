# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

**Generated:** 2026-01-13 04:39:01 UTC

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
| Original Spoiler Test | 59 | 1 | 60 |
| Stage 1: World Generation | 60 | 0 | 60 |
| Stage 2: Seed Generation | 58 | 2 | 60 |
| Stage 3: Rules Comparison | 58 | 0 | 58 |
| Stage 4: WorldGen Spoiler Test | 57 | 1 | 58 |
| Stage 5: Cross-Validation | 58 | 0 | 58 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ❌ | ✅ | ❌ | - | - | - |
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
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
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
| Original Spoiler Test | 59 | 1 | 60 |
| Stage 1: World Generation | 60 | 0 | 60 |
| Stage 2: Seed Generation | 59 | 1 | 60 |
| Stage 3: Rules Comparison | 0 | 59 | 59 |
| Stage 4: WorldGen Spoiler Test | 59 | 0 | 59 |
| Stage 5: Cross-Validation | 38 | 21 | 59 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ❌ | ✅ | ❌ | - | - | - |
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
| Total | 228.2s | 424.3s | 5.7s | 205.0s | 377.4s | 369.9s |
| Average | 3.8s | 7.1s | 0.1s | 3.4s | 6.5s | 6.4s |
| Max | 11.1s | 23.0s | 0.2s | 5.1s | 19.8s | 19.9s |
| Min | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.1s) | A Link to the Past (23.0s) | A Link to the Past (0.2s) | The Wind Waker (5.1s) | Dark Souls III (19.8s) | Dark Souls III (19.9s) |
| Fastest | Paint (2.9s) | shapez (5.6s) | Wargroove (0.1s) | TOEM rule builder (2.9s) | TOEM rule builder (5.6s) | shapez (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.0s | 8.6s | 0.2s | 4.3s | 6.8s | 6.8s |
| A Link to the Past | 8.7s | 23.0s | 0.2s | 2.9s | - | - |
| A Short Hike | 3.4s | 8.4s | 0.2s | 3.3s | 5.7s | 5.7s |
| APQuest | 3.1s | 10.9s | 0.1s | 3.0s | 5.7s | 5.6s |
| Adventure | 3.2s | 8.5s | 0.1s | 3.0s | 5.6s | 5.6s |
| Aquaria | 4.3s | 8.3s | 0.2s | 3.3s | 5.6s | 5.6s |
| Baking Adventure | 3.2s | 10.6s | 0.2s | 3.0s | 5.6s | 5.6s |
| Bumper Stickers | 3.3s | 6.3s | 0.2s | 3.0s | 5.7s | 5.7s |
| Castlevania - Circle of the Moon | 3.3s | 10.2s | 0.2s | 3.4s | 5.7s | 5.6s |
| Castlevania 64 | 3.5s | 6.6s | 0.2s | 3.4s | 5.6s | 5.6s |
| Celeste 64 | 3.4s | 5.8s | 0.1s | 3.4s | 5.8s | 5.8s |
| ChecksFinder | 3.4s | 5.8s | 0.1s | 3.4s | 5.8s | 5.9s |
| Choo-Choo Charles | 3.3s | 7.7s | 0.1s | 3.4s | 7.7s | 7.9s |
| Civilization VI | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Coding Adventure | 2.9s | 5.7s | 0.1s | 2.9s | 5.6s | 5.7s |
| DLCQuest | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| DOOM 1993 | 3.6s | 6.7s | 0.1s | 3.5s | 6.7s | 6.7s |
| DOOM II | 3.8s | 7.8s | 0.1s | 3.7s | 7.8s | 7.8s |
| Dark Souls III | 4.0s | 18.7s | 0.1s | 4.1s | 19.8s | 19.9s |
| Donkey Kong Country 3 | 3.0s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Factorio | 4.0s | 5.8s | 0.1s | 3.7s | 5.7s | 5.8s |
| Faxanadu | 3.5s | 5.8s | 0.1s | 3.4s | 5.8s | 5.8s |
| Final Fantasy Mystic Quest | 4.4s | 6.8s | 0.1s | 3.7s | 6.8s | 6.7s |
| Heretic | 3.6s | 7.7s | 0.1s | 3.5s | 7.7s | 7.6s |
| Hylics 2 | 3.2s | 5.6s | 0.1s | 3.2s | 5.8s | 5.7s |
| Inscryption | 3.0s | 5.7s | 0.1s | 3.4s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.4s | 5.8s | 0.1s | 3.3s | 14.3s | 5.7s |
| Links Awakening DX | 6.7s | 7.8s | 0.1s | 4.1s | 7.8s | 7.7s |
| Lufia II Ancient Cave | 3.3s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 7.6s | 0.1s | 4.3s | 7.6s | 7.6s |
| Math Adventure | 3.3s | 5.8s | 0.1s | 3.2s | 5.7s | 5.7s |
| Mega Man 2 | 3.5s | 5.8s | 0.1s | 3.4s | 5.7s | 5.8s |
| MegaMan Battle Network 3 | 3.5s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Meritous | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Metamath | 11.1s | 5.8s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 5.7s | 0.1s | 3.4s | 5.7s | 5.6s |
| Noita | 3.2s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Old School Runescape | 4.1s | 5.7s | 0.1s | 3.8s | 5.7s | 5.8s |
| Overcooked! 2 | 3.4s | 7.8s | 0.1s | 3.4s | 7.8s | 7.8s |
| Paint | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.9s | 5.7s | 0.1s | 3.8s | 5.8s | 5.8s |
| Saving Princess | 3.4s | 5.8s | 0.1s | 3.4s | 5.7s | 5.8s |
| Shivers | 3.4s | 5.7s | 0.1s | 3.4s | 5.7s | 5.7s |
| Sonic Adventure 2 Battle | 4.5s | 5.7s | 0.1s | 4.1s | 5.7s | 6.8s |
| Subnautica | 3.7s | 9.7s | 0.1s | 3.5s | 9.7s | 9.7s |
| Super Mario 64 | 3.1s | 5.7s | 0.1s | 3.2s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.7s | 5.7s | 0.1s | 4.0s | 5.7s | 5.7s |
| Super Mario World | 4.7s | 5.7s | 0.1s | 3.5s | 5.7s | 5.8s |
| TOEM original | 3.0s | 5.7s | 0.1s | 3.2s | 5.8s | 5.7s |
| TOEM rule builder | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Terraria | 3.5s | 7.8s | 0.1s | 3.4s | 7.8s | 7.8s |
| The Legend of Zelda | 4.1s | 5.8s | 0.1s | 2.9s | - | - |
| The Messenger | 3.5s | 8.8s | 0.1s | 3.3s | 8.9s | 8.8s |
| The Wind Waker | 5.0s | 5.6s | 0.1s | 5.1s | 5.6s | 5.7s |
| Timespinner | 4.2s | 5.7s | 0.1s | 3.9s | 5.7s | 5.7s |
| Undertale | 3.5s | 5.6s | 0.1s | 3.2s | 5.7s | 5.7s |
| VVVVVV | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.7s |
| Wargroove | 3.1s | 5.8s | 0.1s | 3.3s | 5.7s | 5.8s |
| Yoshi's Island | 3.9s | 6.7s | 0.1s | 4.1s | 5.7s | 5.7s |
| shapez | 3.8s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.1s |
| 2 | A Link to the Past | 8.7s |
| 3 | Links Awakening DX | 6.7s |
| 4 | A Hat in Time | 5.0s |
| 5 | The Wind Waker | 5.0s |
| 6 | Super Mario World | 4.7s |
| 7 | Sonic Adventure 2 Battle | 4.5s |
| 8 | Final Fantasy Mystic Quest | 4.4s |
| 9 | Aquaria | 4.3s |
| 10 | Timespinner | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 23.0s |
| 2 | Dark Souls III | 18.7s |
| 3 | APQuest | 10.9s |
| 4 | Baking Adventure | 10.6s |
| 5 | Castlevania - Circle of the Moon | 10.2s |
| 6 | Subnautica | 9.7s |
| 7 | The Messenger | 8.8s |
| 8 | A Hat in Time | 8.6s |
| 9 | Adventure | 8.5s |
| 10 | A Short Hike | 8.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.2s |
| 3 | A Short Hike | 0.2s |
| 4 | Aquaria | 0.2s |
| 5 | Baking Adventure | 0.2s |
| 6 | Bumper Stickers | 0.2s |
| 7 | Castlevania - Circle of the Moon | 0.2s |
| 8 | Castlevania 64 | 0.2s |
| 9 | APQuest | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 5.1s |
| 2 | Mario & Luigi Superstar Saga | 4.3s |
| 3 | A Hat in Time | 4.3s |
| 4 | Dark Souls III | 4.1s |
| 5 | Yoshi's Island | 4.1s |
| 6 | Sonic Adventure 2 Battle | 4.1s |
| 7 | Links Awakening DX | 4.1s |
| 8 | Super Mario Land 2 | 4.0s |
| 9 | Timespinner | 3.9s |
| 10 | Old School Runescape | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 19.8s |
| 2 | Landstalker - The Treasures of King Nole | 14.3s |
| 3 | Subnautica | 9.7s |
| 4 | The Messenger | 8.9s |
| 5 | Links Awakening DX | 7.8s |
| 6 | Overcooked! 2 | 7.8s |
| 7 | DOOM II | 7.8s |
| 8 | Terraria | 7.8s |
| 9 | Choo-Choo Charles | 7.7s |
| 10 | Heretic | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 19.9s |
| 2 | Subnautica | 9.7s |
| 3 | The Messenger | 8.8s |
| 4 | Choo-Choo Charles | 7.9s |
| 5 | DOOM II | 7.8s |
| 6 | Overcooked! 2 | 7.8s |
| 7 | Terraria | 7.8s |
| 8 | Links Awakening DX | 7.7s |
| 9 | Heretic | 7.6s |
| 10 | Mario & Luigi Superstar Saga | 7.6s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 216.7s | 414.8s | 5.5s | 193.2s | 366.6s | 541.9s |
| Average | 3.6s | 6.9s | 0.1s | 3.2s | 6.2s | 9.2s |
| Max | 10.0s | 24.4s | 0.2s | 4.8s | 17.8s | 32.9s |
| Min | 2.7s | 5.4s | 0.1s | 2.6s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.0s) | A Link to the Past (24.4s) | A Link to the Past (0.2s) | The Wind Waker (4.8s) | Dark Souls III (17.8s) | Dark Souls III (32.9s) |
| Fastest | Coding Adventure (2.7s) | Metamath (5.4s) | Metamath (0.1s) | A Link to the Past (2.6s) | Metamath (5.4s) | Hylics 2 (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.4s | 10.6s | 0.2s | 4.1s | 6.7s | 6.8s |
| A Link to the Past | 7.6s | 24.4s | 0.2s | 2.6s | - | - |
| A Short Hike | 3.4s | 9.8s | 0.1s | 3.1s | 5.6s | 5.7s |
| APQuest | 3.0s | 7.3s | 0.1s | 2.7s | 5.4s | 5.5s |
| Adventure | 2.9s | 8.7s | 0.1s | 2.8s | 5.4s | 5.4s |
| Aquaria | 4.2s | 7.6s | 0.2s | 3.2s | 5.6s | 5.7s |
| Baking Adventure | 3.1s | 6.8s | 0.1s | 3.0s | 5.6s | 14.2s |
| Bumper Stickers | 3.1s | 6.8s | 0.1s | 3.0s | 5.7s | 14.2s |
| Castlevania - Circle of the Moon | 3.3s | 8.6s | 0.2s | 3.2s | 5.7s | 5.6s |
| Castlevania 64 | 3.6s | 6.2s | 0.1s | 3.4s | 5.6s | 5.7s |
| Celeste 64 | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 14.3s |
| ChecksFinder | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.2s | 7.7s | 0.1s | 3.1s | 7.7s | 7.8s |
| Civilization VI | 2.9s | 5.5s | 0.1s | 2.9s | 5.5s | 14.1s |
| Coding Adventure | 2.7s | 5.4s | 0.1s | 2.7s | 5.4s | 13.7s |
| DLCQuest | 3.1s | 5.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| DOOM 1993 | 3.5s | 6.8s | 0.1s | 3.3s | 6.7s | 14.3s |
| DOOM II | 3.6s | 7.6s | 0.1s | 3.4s | 7.6s | 14.3s |
| Dark Souls III | 4.2s | 18.7s | 0.1s | 4.2s | 17.8s | 32.9s |
| Donkey Kong Country 3 | 3.2s | 5.7s | 0.1s | 3.1s | 5.7s | 14.2s |
| Factorio | 3.6s | 5.8s | 0.1s | 3.3s | 5.6s | 5.6s |
| Faxanadu | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 14.1s |
| Final Fantasy Mystic Quest | 4.2s | 6.7s | 0.1s | 3.4s | 6.7s | 6.6s |
| Heretic | 3.5s | 7.5s | 0.1s | 3.3s | 7.5s | 13.9s |
| Hylics 2 | 3.0s | 5.4s | 0.1s | 2.9s | 5.5s | 5.4s |
| Inscryption | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.6s | 0.1s | 3.3s | 5.7s | 14.3s |
| Links Awakening DX | 5.8s | 7.7s | 0.1s | 4.0s | 7.7s | 7.7s |
| Lufia II Ancient Cave | 3.5s | 5.6s | 0.1s | 3.3s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 7.7s | 0.1s | 4.3s | 7.8s | 7.6s |
| Math Adventure | 3.0s | 5.7s | 0.1s | 2.8s | 5.6s | 14.2s |
| Mega Man 2 | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.3s | 5.6s | 0.1s | 3.0s | 5.6s | 14.3s |
| Meritous | 2.8s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |
| Metamath | 10.0s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |
| Muse Dash | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Noita | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Old School Runescape | 3.9s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Overcooked! 2 | 3.4s | 7.7s | 0.1s | 3.3s | 7.7s | 14.4s |
| Paint | 3.0s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.4s | 5.7s | 0.1s | 3.3s | 5.7s | 5.6s |
| Saving Princess | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Shivers | 3.2s | 5.6s | 0.1s | 3.1s | 5.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.5s | 5.4s | 0.1s | 3.9s | 5.5s | 13.9s |
| Subnautica | 3.4s | 9.4s | 0.1s | 3.3s | 9.4s | 13.8s |
| Super Mario 64 | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.7s | 5.7s | 0.1s | 3.8s | 5.7s | 5.7s |
| Super Mario World | 4.5s | 5.6s | 0.1s | 3.4s | 5.7s | 5.6s |
| TOEM original | 3.1s | 5.6s | 0.1s | 3.0s | 5.7s | 5.7s |
| TOEM rule builder | 3.0s | 5.8s | 0.1s | 3.0s | 5.7s | 5.6s |
| Terraria | 3.3s | 7.7s | 0.1s | 3.1s | 7.7s | 7.7s |
| The Legend of Zelda | 3.6s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| The Messenger | 3.3s | 8.8s | 0.1s | 3.2s | 8.8s | 8.8s |
| The Wind Waker | 4.8s | 5.5s | 0.1s | 4.8s | 5.5s | 13.8s |
| Timespinner | 3.8s | 5.6s | 0.1s | 3.5s | 5.4s | 5.4s |
| Undertale | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 3.2s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Yoshi's Island | 4.2s | 6.6s | 0.1s | 4.2s | 5.7s | 5.7s |
| shapez | 3.9s | 5.7s | 0.1s | 3.3s | 5.6s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.0s |
| 2 | A Link to the Past | 7.6s |
| 3 | Links Awakening DX | 5.8s |
| 4 | The Wind Waker | 4.8s |
| 5 | Super Mario World | 4.5s |
| 6 | Sonic Adventure 2 Battle | 4.5s |
| 7 | A Hat in Time | 4.4s |
| 8 | Final Fantasy Mystic Quest | 4.2s |
| 9 | Dark Souls III | 4.2s |
| 10 | Yoshi's Island | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 24.4s |
| 2 | Dark Souls III | 18.7s |
| 3 | A Hat in Time | 10.6s |
| 4 | A Short Hike | 9.8s |
| 5 | Subnautica | 9.4s |
| 6 | The Messenger | 8.8s |
| 7 | Adventure | 8.7s |
| 8 | Castlevania - Circle of the Moon | 8.6s |
| 9 | Links Awakening DX | 7.7s |
| 10 | Overcooked! 2 | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.2s |
| 3 | Aquaria | 0.2s |
| 4 | Castlevania - Circle of the Moon | 0.2s |
| 5 | A Short Hike | 0.1s |
| 6 | Baking Adventure | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 4.8s |
| 2 | Mario & Luigi Superstar Saga | 4.3s |
| 3 | Dark Souls III | 4.2s |
| 4 | Yoshi's Island | 4.2s |
| 5 | A Hat in Time | 4.1s |
| 6 | Links Awakening DX | 4.0s |
| 7 | Sonic Adventure 2 Battle | 3.9s |
| 8 | Super Mario Land 2 | 3.8s |
| 9 | Old School Runescape | 3.6s |
| 10 | Timespinner | 3.5s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 17.8s |
| 2 | Subnautica | 9.4s |
| 3 | The Messenger | 8.8s |
| 4 | Mario & Luigi Superstar Saga | 7.8s |
| 5 | Links Awakening DX | 7.7s |
| 6 | Choo-Choo Charles | 7.7s |
| 7 | Overcooked! 2 | 7.7s |
| 8 | Terraria | 7.7s |
| 9 | DOOM II | 7.6s |
| 10 | Heretic | 7.5s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.9s |
| 2 | Overcooked! 2 | 14.4s |
| 3 | Landstalker - The Treasures of King Nole | 14.3s |
| 4 | MegaMan Battle Network 3 | 14.3s |
| 5 | shapez | 14.3s |
| 6 | DOOM II | 14.3s |
| 7 | Celeste 64 | 14.3s |
| 8 | DOOM 1993 | 14.3s |
| 9 | Shivers | 14.3s |
| 10 | Donkey Kong Country 3 | 14.2s |
