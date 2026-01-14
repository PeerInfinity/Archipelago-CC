# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

**Generated:** 2026-01-14 04:15:44 UTC

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
| Stage 2: Seed Generation | 60 | 0 | 60 |
| Stage 3: Rules Comparison | 60 | 0 | 60 |
| Stage 4: WorldGen Spoiler Test | 60 | 0 | 60 |
| Stage 5: Cross-Validation | 60 | 0 | 60 |

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
| Total | 221.0s | 405.7s | 5.6s | 201.0s | 379.5s | 379.9s |
| Average | 3.7s | 6.8s | 0.1s | 3.4s | 6.3s | 6.3s |
| Max | 10.6s | 18.7s | 0.2s | 5.9s | 19.7s | 19.8s |
| Min | 2.7s | 5.4s | 0.1s | 2.6s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.6s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | A Link to the Past (5.9s) | Dark Souls III (19.7s) | Dark Souls III (19.8s) |
| Fastest | Noita (2.7s) | Noita (5.4s) | VVVVVV (0.1s) | Baking Adventure (2.6s) | Baking Adventure (5.4s) | VVVVVV (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.9s | 8.2s | 0.2s | 4.3s | 6.8s | 6.7s |
| A Link to the Past | 7.9s | 12.4s | 0.2s | 5.9s | 9.7s | 9.7s |
| A Short Hike | 3.2s | 7.9s | 0.1s | 3.0s | 5.5s | 5.5s |
| APQuest | 3.0s | 11.1s | 0.1s | 2.9s | 5.6s | 5.6s |
| Adventure | 3.4s | 6.8s | 0.2s | 3.1s | 5.6s | 5.6s |
| Aquaria | 4.1s | 6.3s | 0.2s | 3.2s | 5.6s | 5.8s |
| Baking Adventure | 2.8s | 10.2s | 0.1s | 2.6s | 5.4s | 5.5s |
| Bumper Stickers | 3.0s | 6.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.4s | 8.8s | 0.2s | 3.1s | 5.6s | 5.7s |
| Castlevania 64 | 4.0s | 8.2s | 0.2s | 3.9s | 5.8s | 5.8s |
| Celeste 64 | 3.4s | 5.9s | 0.1s | 3.3s | 5.7s | 5.7s |
| ChecksFinder | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.0s | 7.5s | 0.1s | 3.1s | 7.5s | 7.5s |
| Civilization VI | 3.2s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Coding Adventure | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.7s |
| DLCQuest | 3.2s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| DOOM 1993 | 3.1s | 6.4s | 0.1s | 3.1s | 6.5s | 6.4s |
| DOOM II | 3.4s | 7.6s | 0.1s | 3.3s | 7.6s | 7.6s |
| Dark Souls III | 4.2s | 18.7s | 0.1s | 4.2s | 19.7s | 19.8s |
| Donkey Kong Country 3 | 3.5s | 5.7s | 0.1s | 3.4s | 5.8s | 5.8s |
| Factorio | 3.9s | 5.8s | 0.1s | 3.6s | 5.7s | 5.8s |
| Faxanadu | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Final Fantasy Mystic Quest | 4.0s | 6.5s | 0.1s | 3.4s | 6.5s | 6.5s |
| Heretic | 3.6s | 7.6s | 0.1s | 3.4s | 7.7s | 7.8s |
| Hylics 2 | 3.3s | 5.7s | 0.1s | 3.2s | 5.6s | 5.7s |
| Inscryption | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.0s | 5.4s | 0.1s | 2.8s | 5.4s | 5.4s |
| Links Awakening DX | 5.7s | 7.7s | 0.1s | 3.6s | 7.7s | 7.7s |
| Lufia II Ancient Cave | 3.4s | 5.6s | 0.1s | 3.4s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 4.2s | 7.8s | 0.1s | 4.8s | 7.8s | 7.8s |
| Math Adventure | 3.2s | 5.8s | 0.1s | 3.2s | 5.7s | 5.8s |
| Mega Man 2 | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.7s |
| MegaMan Battle Network 3 | 3.1s | 5.6s | 0.1s | 3.0s | 5.5s | 5.5s |
| Meritous | 3.0s | 5.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| Metamath | 10.6s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Muse Dash | 3.0s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Noita | 2.7s | 5.4s | 0.1s | 2.8s | 5.4s | 5.4s |
| Old School Runescape | 3.8s | 5.6s | 0.1s | 3.5s | 5.6s | 5.6s |
| Overcooked! 2 | 3.3s | 7.7s | 0.1s | 3.2s | 7.7s | 7.7s |
| Paint | 3.3s | 5.8s | 0.1s | 3.4s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.8s | 5.8s | 0.1s | 3.7s | 5.7s | 5.7s |
| Saving Princess | 3.0s | 5.6s | 0.1s | 3.1s | 5.7s | 5.6s |
| Shivers | 3.1s | 5.5s | 0.1s | 3.1s | 5.5s | 5.6s |
| Sonic Adventure 2 Battle | 4.4s | 5.6s | 0.1s | 4.1s | 5.6s | 5.7s |
| Subnautica | 3.8s | 9.7s | 0.1s | 3.6s | 9.7s | 9.7s |
| Super Mario 64 | 3.1s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.4s | 5.5s | 0.1s | 3.5s | 5.5s | 5.5s |
| Super Mario World | 4.4s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| TOEM original | 3.0s | 5.6s | 0.1s | 3.1s | 5.7s | 5.7s |
| TOEM rule builder | 3.3s | 5.8s | 0.1s | 3.2s | 5.7s | 5.7s |
| Terraria | 3.4s | 7.8s | 0.1s | 3.4s | 7.8s | 7.8s |
| The Legend of Zelda | 3.7s | 5.6s | 0.1s | 3.1s | 5.7s | 5.7s |
| The Messenger | 3.3s | 8.6s | 0.1s | 3.2s | 8.6s | 8.6s |
| The Wind Waker | 4.8s | 5.6s | 0.1s | 5.3s | 5.7s | 5.7s |
| Timespinner | 4.3s | 5.8s | 0.1s | 4.0s | 5.6s | 5.6s |
| Undertale | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| VVVVVV | 2.7s | 5.5s | 0.1s | 2.8s | 5.4s | 5.4s |
| Wargroove | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 4.0s | 6.7s | 0.1s | 4.1s | 5.7s | 5.6s |
| shapez | 4.2s | 5.8s | 0.1s | 3.4s | 5.7s | 5.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.6s |
| 2 | A Link to the Past | 7.9s |
| 3 | Links Awakening DX | 5.7s |
| 4 | A Hat in Time | 4.9s |
| 5 | The Wind Waker | 4.8s |
| 6 | Super Mario World | 4.4s |
| 7 | Sonic Adventure 2 Battle | 4.4s |
| 8 | Timespinner | 4.3s |
| 9 | Mario & Luigi Superstar Saga | 4.2s |
| 10 | shapez | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past | 12.4s |
| 3 | APQuest | 11.1s |
| 4 | Baking Adventure | 10.2s |
| 5 | Subnautica | 9.7s |
| 6 | Castlevania - Circle of the Moon | 8.8s |
| 7 | The Messenger | 8.6s |
| 8 | A Hat in Time | 8.2s |
| 9 | Castlevania 64 | 8.2s |
| 10 | A Short Hike | 7.9s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.2s |
| 3 | Castlevania 64 | 0.2s |
| 4 | Adventure | 0.2s |
| 5 | Aquaria | 0.2s |
| 6 | Castlevania - Circle of the Moon | 0.2s |
| 7 | A Short Hike | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | Baking Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.9s |
| 2 | The Wind Waker | 5.3s |
| 3 | Mario & Luigi Superstar Saga | 4.8s |
| 4 | A Hat in Time | 4.3s |
| 5 | Dark Souls III | 4.2s |
| 6 | Sonic Adventure 2 Battle | 4.1s |
| 7 | Yoshi's Island | 4.1s |
| 8 | Timespinner | 4.0s |
| 9 | Castlevania 64 | 3.9s |
| 10 | Risk of Rain 2 | 3.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 19.7s |
| 2 | Subnautica | 9.7s |
| 3 | A Link to the Past | 9.7s |
| 4 | The Messenger | 8.6s |
| 5 | Mario & Luigi Superstar Saga | 7.8s |
| 6 | Terraria | 7.8s |
| 7 | Heretic | 7.7s |
| 8 | Overcooked! 2 | 7.7s |
| 9 | Links Awakening DX | 7.7s |
| 10 | DOOM II | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 19.8s |
| 2 | A Link to the Past | 9.7s |
| 3 | Subnautica | 9.7s |
| 4 | The Messenger | 8.6s |
| 5 | Heretic | 7.8s |
| 6 | Mario & Luigi Superstar Saga | 7.8s |
| 7 | Terraria | 7.8s |
| 8 | Overcooked! 2 | 7.7s |
| 9 | Links Awakening DX | 7.7s |
| 10 | DOOM II | 7.6s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 222.2s | 413.2s | 5.6s | 205.3s | 379.4s | 560.5s |
| Average | 3.7s | 6.9s | 0.1s | 3.4s | 6.3s | 9.3s |
| Max | 11.0s | 18.6s | 0.2s | 7.0s | 17.5s | 32.3s |
| Min | 2.8s | 5.4s | 0.1s | 2.8s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.0s) | Dark Souls III (18.6s) | A Link to the Past (0.2s) | The Wind Waker (7.0s) | Dark Souls III (17.5s) | Dark Souls III (32.3s) |
| Fastest | TOEM original (2.8s) | Noita (5.4s) | Wargroove (0.1s) | ChecksFinder (2.8s) | Yoshi's Island (5.4s) | TOEM original (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.6s | 10.3s | 0.2s | 4.4s | 6.8s | 6.8s |
| A Link to the Past | 7.6s | 12.5s | 0.2s | 5.7s | 9.6s | 14.3s |
| A Short Hike | 3.2s | 10.9s | 0.1s | 3.0s | 5.6s | 5.6s |
| APQuest | 3.6s | 8.9s | 0.2s | 3.9s | 5.8s | 5.9s |
| Adventure | 3.3s | 9.5s | 0.2s | 3.1s | 5.7s | 5.7s |
| Aquaria | 4.1s | 8.3s | 0.2s | 3.2s | 5.6s | 5.6s |
| Baking Adventure | 3.0s | 8.4s | 0.1s | 3.0s | 5.5s | 13.9s |
| Bumper Stickers | 3.1s | 7.7s | 0.2s | 3.1s | 5.7s | 14.2s |
| Castlevania - Circle of the Moon | 3.0s | 6.7s | 0.1s | 2.9s | 5.4s | 5.4s |
| Castlevania 64 | 3.6s | 9.1s | 0.2s | 3.5s | 5.6s | 5.6s |
| Celeste 64 | 3.3s | 5.6s | 0.1s | 3.4s | 5.7s | 14.3s |
| ChecksFinder | 2.8s | 5.7s | 0.1s | 2.8s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.1s | 7.7s | 0.1s | 3.0s | 7.6s | 7.6s |
| Civilization VI | 4.0s | 5.9s | 0.1s | 3.6s | 5.9s | 14.9s |
| Coding Adventure | 3.0s | 5.7s | 0.1s | 3.3s | 5.8s | 14.3s |
| DLCQuest | 3.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| DOOM 1993 | 3.4s | 6.5s | 0.1s | 3.3s | 6.5s | 14.1s |
| DOOM II | 3.6s | 7.6s | 0.1s | 3.4s | 7.7s | 14.3s |
| Dark Souls III | 3.8s | 18.6s | 0.1s | 3.8s | 17.5s | 32.3s |
| Donkey Kong Country 3 | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 14.2s |
| Factorio | 3.8s | 5.7s | 0.1s | 3.5s | 5.7s | 5.7s |
| Faxanadu | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 14.1s |
| Final Fantasy Mystic Quest | 4.0s | 6.7s | 0.1s | 3.4s | 6.7s | 6.6s |
| Heretic | 4.3s | 8.1s | 0.1s | 4.7s | 7.9s | 14.9s |
| Hylics 2 | 3.4s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Inscryption | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.2s | 5.4s | 0.1s | 3.1s | 5.4s | 14.0s |
| Links Awakening DX | 5.8s | 7.7s | 0.1s | 3.9s | 7.7s | 7.9s |
| Lufia II Ancient Cave | 3.1s | 5.4s | 0.1s | 3.1s | 5.5s | 5.4s |
| Mario & Luigi Superstar Saga | 3.8s | 7.7s | 0.1s | 4.4s | 7.6s | 7.7s |
| Math Adventure | 3.0s | 5.7s | 0.1s | 3.1s | 5.7s | 14.3s |
| Mega Man 2 | 2.9s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.2s | 5.8s | 0.1s | 3.0s | 5.6s | 14.2s |
| Meritous | 3.4s | 5.8s | 0.1s | 3.7s | 5.9s | 5.8s |
| Metamath | 11.0s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Muse Dash | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Noita | 3.0s | 5.4s | 0.1s | 3.0s | 5.5s | 5.5s |
| Old School Runescape | 3.7s | 5.7s | 0.1s | 3.5s | 5.6s | 5.6s |
| Overcooked! 2 | 3.0s | 7.5s | 0.1s | 3.0s | 7.5s | 13.9s |
| Paint | 3.0s | 5.8s | 0.1s | 3.1s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.5s | 5.7s | 0.1s | 3.6s | 5.7s | 5.7s |
| Saving Princess | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Shivers | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 14.2s |
| Sonic Adventure 2 Battle | 6.1s | 7.0s | 0.1s | 5.0s | 6.9s | 15.2s |
| Subnautica | 4.0s | 9.8s | 0.1s | 3.7s | 9.7s | 14.6s |
| Super Mario 64 | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.5s | 5.5s | 0.1s | 3.7s | 5.5s | 5.5s |
| Super Mario World | 4.4s | 5.6s | 0.1s | 3.3s | 5.7s | 5.6s |
| TOEM original | 2.8s | 5.4s | 0.1s | 2.8s | 5.5s | 5.4s |
| TOEM rule builder | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Terraria | 3.1s | 7.8s | 0.1s | 3.3s | 7.7s | 7.9s |
| The Legend of Zelda | 3.6s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| The Messenger | 3.3s | 8.7s | 0.1s | 3.1s | 8.7s | 8.7s |
| The Wind Waker | 5.8s | 5.9s | 0.1s | 7.0s | 5.9s | 14.8s |
| Timespinner | 4.4s | 5.8s | 0.1s | 4.1s | 5.8s | 5.8s |
| Undertale | 3.0s | 5.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 2.8s | 5.5s | 0.1s | 2.9s | 5.4s | 5.5s |
| Wargroove | 2.9s | 5.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 3.7s | 6.5s | 0.1s | 3.7s | 5.4s | 5.5s |
| shapez | 4.0s | 5.6s | 0.1s | 3.2s | 5.6s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.0s |
| 2 | A Link to the Past | 7.6s |
| 3 | Sonic Adventure 2 Battle | 6.1s |
| 4 | Links Awakening DX | 5.8s |
| 5 | The Wind Waker | 5.8s |
| 6 | A Hat in Time | 4.6s |
| 7 | Timespinner | 4.4s |
| 8 | Super Mario World | 4.4s |
| 9 | Heretic | 4.3s |
| 10 | Aquaria | 4.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.6s |
| 2 | A Link to the Past | 12.5s |
| 3 | A Short Hike | 10.9s |
| 4 | A Hat in Time | 10.3s |
| 5 | Subnautica | 9.8s |
| 6 | Adventure | 9.5s |
| 7 | Castlevania 64 | 9.1s |
| 8 | APQuest | 8.9s |
| 9 | The Messenger | 8.7s |
| 10 | Baking Adventure | 8.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.2s |
| 3 | APQuest | 0.2s |
| 4 | Adventure | 0.2s |
| 5 | Aquaria | 0.2s |
| 6 | Bumper Stickers | 0.2s |
| 7 | Castlevania 64 | 0.2s |
| 8 | A Short Hike | 0.1s |
| 9 | Baking Adventure | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 7.0s |
| 2 | A Link to the Past | 5.7s |
| 3 | Sonic Adventure 2 Battle | 5.0s |
| 4 | Heretic | 4.7s |
| 5 | Mario & Luigi Superstar Saga | 4.4s |
| 6 | A Hat in Time | 4.4s |
| 7 | Timespinner | 4.1s |
| 8 | APQuest | 3.9s |
| 9 | Links Awakening DX | 3.9s |
| 10 | Dark Souls III | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 17.5s |
| 2 | Subnautica | 9.7s |
| 3 | A Link to the Past | 9.6s |
| 4 | The Messenger | 8.7s |
| 5 | Heretic | 7.9s |
| 6 | Links Awakening DX | 7.7s |
| 7 | Terraria | 7.7s |
| 8 | DOOM II | 7.7s |
| 9 | Choo-Choo Charles | 7.6s |
| 10 | Mario & Luigi Superstar Saga | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.3s |
| 2 | Sonic Adventure 2 Battle | 15.2s |
| 3 | Civilization VI | 14.9s |
| 4 | Heretic | 14.9s |
| 5 | The Wind Waker | 14.8s |
| 6 | Subnautica | 14.6s |
| 7 | Celeste 64 | 14.3s |
| 8 | Math Adventure | 14.3s |
| 9 | Coding Adventure | 14.3s |
| 10 | DOOM II | 14.3s |
