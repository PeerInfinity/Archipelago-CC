# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

**Generated:** 2026-01-12 20:23:22 UTC

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

**Total Templates:** 64

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 64 | 0 | 64 |
| Original Spoiler Test | 63 | 1 | 64 |
| Stage 1: World Generation | 64 | 0 | 64 |
| Stage 2: Seed Generation | 26 | 38 | 64 |
| Stage 3: Rules Comparison | 24 | 2 | 26 |
| Stage 4: WorldGen Spoiler Test | 26 | 0 | 26 |
| Stage 5: Cross-Validation | 26 | 0 | 26 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Hat in Time WorldGen2 | ✅ | ❌ | ✅ | ❌ | - | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Link to the Past WorldGen2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike WorldGen2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure WorldGen2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Bumper Stickers | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Celeste 64 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Coding Adventure | ✅ | ✅ | ✅ | ❌ | - | - | - |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Links Awakening DX | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Math Adventure | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ❌ | - | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 64

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 64 | 0 | 64 |
| Original Spoiler Test | 63 | 1 | 64 |
| Stage 1: World Generation | 64 | 0 | 64 |
| Stage 2: Seed Generation | 26 | 38 | 64 |
| Stage 3: Rules Comparison | 0 | 26 | 26 |
| Stage 4: WorldGen Spoiler Test | 26 | 0 | 26 |
| Stage 5: Cross-Validation | 19 | 7 | 26 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Hat in Time WorldGen2 | ✅ | ❌ | ✅ | ❌ | - | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Link to the Past WorldGen2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike WorldGen2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| APQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Adventure WorldGen2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Bumper Stickers | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Celeste 64 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Coding Adventure | ✅ | ✅ | ✅ | ❌ | - | - | - |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Heretic | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Links Awakening DX | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Math Adventure | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Meritous | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ❌ | - | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 252.4s | 452.3s | 6.0s | 227.6s | 158.2s | 158.3s |
| Average | 3.9s | 7.1s | 0.1s | 3.6s | 6.1s | 6.1s |
| Max | 10.0s | 22.8s | 0.2s | 7.5s | 9.6s | 9.8s |
| Min | 2.9s | 5.5s | 0.1s | 2.8s | 5.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.0s) | A Hat in Time WorldGen2 (22.8s) | A Link to the Past WorldGen2 (0.2s) | A Link to the Past WorldGen2 (7.5s) | Subnautica (9.6s) | Subnautica (9.8s) |
| Fastest | Math Adventure (2.9s) | Bumper Stickers (5.5s) | Bumper Stickers (0.1s) | Super Mario Land 2 (2.8s) | Wargroove (5.5s) | Wargroove (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.8s | 7.3s | 0.1s | 4.3s | - | - |
| A Hat in Time WorldGen2 | 4.6s | 22.8s | 0.2s | 4.5s | - | - |
| A Link to the Past | 7.9s | 10.8s | 0.2s | 6.2s | - | - |
| A Link to the Past WorldGen2 | 7.6s | 18.2s | 0.2s | 7.5s | - | - |
| A Short Hike | 3.6s | 9.3s | 0.2s | 3.4s | - | - |
| A Short Hike WorldGen2 | 3.2s | 6.4s | 0.1s | 3.0s | - | - |
| APQuest | 3.1s | 10.5s | 0.1s | 2.9s | 5.7s | 5.6s |
| Adventure | 3.1s | 6.2s | 0.1s | 3.0s | 5.6s | 5.6s |
| Adventure WorldGen2 | 3.4s | 6.7s | 0.2s | 3.2s | 5.7s | 5.7s |
| Aquaria | 4.7s | 8.4s | 0.2s | 3.7s | 5.7s | 5.7s |
| Baking Adventure | 3.2s | 5.7s | 0.1s | 3.2s | - | - |
| Bumper Stickers | 3.0s | 5.5s | 0.1s | 3.1s | - | - |
| Castlevania - Circle of the Moon | 4.0s | 5.9s | 0.1s | 3.9s | - | - |
| Castlevania 64 | 3.4s | 5.7s | 0.1s | 3.6s | - | - |
| Celeste 64 | 3.0s | 5.7s | 0.1s | 3.0s | - | - |
| ChecksFinder | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Choo-Choo Charles | 3.1s | 7.7s | 0.1s | 3.1s | - | - |
| Civilization VI | 3.4s | 5.7s | 0.1s | 3.3s | - | - |
| Coding Adventure | 2.9s | 5.6s | 0.1s | 2.9s | - | - |
| DLCQuest | 3.5s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| DOOM 1993 | 4.0s | 6.8s | 0.1s | 3.7s | 6.7s | 6.7s |
| DOOM II | 3.6s | 7.5s | 0.1s | 3.7s | 7.5s | 7.5s |
| Dark Souls III | 5.2s | 20.0s | 0.1s | 3.1s | - | - |
| Donkey Kong Country 3 | 3.2s | 5.6s | 0.1s | 3.2s | - | - |
| Factorio | 3.5s | 5.6s | 0.1s | 3.3s | 5.6s | 5.6s |
| Faxanadu | 3.3s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Final Fantasy Mystic Quest | 4.2s | 6.7s | 0.1s | 3.6s | - | - |
| Heretic | 4.0s | 7.7s | 0.1s | 3.9s | 7.7s | 7.7s |
| Hylics 2 | 3.2s | 5.6s | 0.1s | 3.1s | - | - |
| Inscryption | 3.3s | 5.8s | 0.1s | 3.3s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.7s | 5.7s | 0.1s | 2.8s | - | - |
| Links Awakening DX | 7.7s | 7.5s | 0.1s | 4.4s | - | - |
| Lufia II Ancient Cave | 4.5s | 5.9s | 0.1s | 4.2s | - | - |
| Mario & Luigi Superstar Saga | 3.8s | 7.6s | 0.1s | 4.3s | - | - |
| Math Adventure | 2.9s | 5.7s | 0.1s | 2.9s | - | - |
| Mega Man 2 | 3.4s | 5.7s | 0.1s | 3.3s | - | - |
| MegaMan Battle Network 3 | 3.2s | 5.6s | 0.1s | 3.0s | - | - |
| Meritous | 3.3s | 5.7s | 0.1s | 3.2s | 5.7s | 5.6s |
| Metamath | 10.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.4s | 5.7s | 0.1s | 3.3s | - | - |
| Noita | 3.5s | 5.7s | 0.1s | 3.4s | 5.7s | 5.7s |
| Old School Runescape | 4.2s | 5.5s | 0.1s | 4.0s | - | - |
| Overcooked! 2 | 4.3s | 7.9s | 0.1s | 4.2s | - | - |
| Paint | 3.0s | 5.6s | 0.1s | 3.0s | 5.7s | 5.6s |
| Risk of Rain 2 | 3.4s | 5.7s | 0.1s | 3.3s | - | - |
| Saving Princess | 3.3s | 5.7s | 0.1s | 3.3s | 5.7s | 5.8s |
| Shivers | 3.2s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Sonic Adventure 2 Battle | 4.9s | 5.7s | 0.1s | 4.5s | - | - |
| Subnautica | 3.7s | 9.6s | 0.1s | 3.4s | 9.6s | 9.8s |
| Super Mario 64 | 3.4s | 5.7s | 0.1s | 3.3s | - | - |
| Super Mario Land 2 | 4.0s | 5.8s | 0.1s | 2.8s | - | - |
| Super Mario World | 4.5s | 5.7s | 0.1s | 3.6s | - | - |
| TOEM original | 3.6s | 5.9s | 0.1s | 3.7s | 5.9s | 5.9s |
| TOEM rule builder | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Terraria | 3.1s | 7.7s | 0.1s | 3.1s | 7.7s | 7.7s |
| The Legend of Zelda | 4.1s | 5.8s | 0.1s | 2.9s | - | - |
| The Messenger | 3.3s | 8.8s | 0.1s | 3.2s | - | - |
| The Wind Waker | 5.3s | 5.7s | 0.1s | 5.5s | - | - |
| Timespinner | 4.0s | 5.6s | 0.1s | 3.8s | 5.6s | 5.6s |
| Undertale | 3.4s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| VVVVVV | 3.4s | 5.8s | 0.1s | 3.4s | - | - |
| Wargroove | 3.0s | 5.5s | 0.1s | 3.1s | 5.5s | 5.6s |
| Yoshi's Island | 4.9s | 6.9s | 0.1s | 4.9s | - | - |
| shapez | 3.8s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.0s |
| 2 | A Link to the Past | 7.9s |
| 3 | Links Awakening DX | 7.7s |
| 4 | A Link to the Past WorldGen2 | 7.6s |
| 5 | The Wind Waker | 5.3s |
| 6 | Dark Souls III | 5.2s |
| 7 | Sonic Adventure 2 Battle | 4.9s |
| 8 | Yoshi's Island | 4.9s |
| 9 | A Hat in Time | 4.8s |
| 10 | Aquaria | 4.7s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | A Hat in Time WorldGen2 | 22.8s |
| 2 | Dark Souls III | 20.0s |
| 3 | A Link to the Past WorldGen2 | 18.2s |
| 4 | A Link to the Past | 10.8s |
| 5 | APQuest | 10.5s |
| 6 | Subnautica | 9.6s |
| 7 | A Short Hike | 9.3s |
| 8 | The Messenger | 8.8s |
| 9 | Aquaria | 8.4s |
| 10 | Overcooked! 2 | 7.9s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen2 | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | A Hat in Time WorldGen2 | 0.2s |
| 4 | A Short Hike | 0.2s |
| 5 | Aquaria | 0.2s |
| 6 | Adventure WorldGen2 | 0.2s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Short Hike WorldGen2 | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past WorldGen2 | 7.5s |
| 2 | A Link to the Past | 6.2s |
| 3 | The Wind Waker | 5.5s |
| 4 | Yoshi's Island | 4.9s |
| 5 | Sonic Adventure 2 Battle | 4.5s |
| 6 | A Hat in Time WorldGen2 | 4.5s |
| 7 | Links Awakening DX | 4.4s |
| 8 | A Hat in Time | 4.3s |
| 9 | Mario & Luigi Superstar Saga | 4.3s |
| 10 | Overcooked! 2 | 4.2s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 9.6s |
| 2 | Heretic | 7.7s |
| 3 | Terraria | 7.7s |
| 4 | DOOM II | 7.5s |
| 5 | DOOM 1993 | 6.7s |
| 6 | TOEM original | 5.9s |
| 7 | DLCQuest | 5.7s |
| 8 | APQuest | 5.7s |
| 9 | Noita | 5.7s |
| 10 | Saving Princess | 5.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 9.8s |
| 2 | Heretic | 7.7s |
| 3 | Terraria | 7.7s |
| 4 | DOOM II | 7.5s |
| 5 | DOOM 1993 | 6.7s |
| 6 | TOEM original | 5.9s |
| 7 | Saving Princess | 5.8s |
| 8 | Faxanadu | 5.7s |
| 9 | Aquaria | 5.7s |
| 10 | ChecksFinder | 5.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 239.4s | 447.8s | 5.8s | 215.1s | 157.0s | 208.5s |
| Average | 3.7s | 7.0s | 0.1s | 3.4s | 6.0s | 8.0s |
| Max | 10.2s | 18.7s | 0.2s | 7.0s | 9.6s | 14.5s |
| Min | 2.7s | 5.4s | 0.1s | 2.4s | 5.5s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.2s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | A Link to the Past (7.0s) | Subnautica (9.6s) | DOOM II (14.5s) |
| Fastest | Baking Adventure (2.7s) | Baking Adventure (5.4s) | VVVVVV (0.1s) | Super Mario Land 2 (2.4s) | Noita (5.5s) | Noita (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.4s | 7.5s | 0.2s | 2.6s | - | - |
| A Hat in Time WorldGen2 | 3.7s | 17.5s | 0.1s | 3.8s | - | - |
| A Link to the Past | 8.2s | 14.2s | 0.2s | 7.0s | - | - |
| A Link to the Past WorldGen2 | 6.3s | 10.8s | 0.2s | 6.7s | - | - |
| A Short Hike | 3.2s | 10.5s | 0.1s | 3.0s | - | - |
| A Short Hike WorldGen2 | 3.4s | 8.1s | 0.2s | 3.1s | - | - |
| APQuest | 3.1s | 10.2s | 0.1s | 2.9s | 5.6s | 5.6s |
| Adventure | 3.2s | 6.2s | 0.1s | 3.1s | 5.6s | 5.6s |
| Adventure WorldGen2 | 3.1s | 10.2s | 0.1s | 3.0s | 5.6s | 5.6s |
| Aquaria | 4.5s | 10.9s | 0.2s | 3.6s | 5.7s | 5.7s |
| Baking Adventure | 2.7s | 5.4s | 0.1s | 2.8s | - | - |
| Bumper Stickers | 3.0s | 5.6s | 0.1s | 3.0s | - | - |
| Castlevania - Circle of the Moon | 3.2s | 5.7s | 0.1s | 3.4s | - | - |
| Castlevania 64 | 3.6s | 5.9s | 0.1s | 4.0s | - | - |
| Celeste 64 | 3.1s | 5.6s | 0.1s | 3.1s | - | - |
| ChecksFinder | 2.9s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.1s | 7.6s | 0.1s | 3.1s | - | - |
| Civilization VI | 3.0s | 5.6s | 0.1s | 3.0s | - | - |
| Coding Adventure | 2.9s | 5.6s | 0.1s | 3.0s | - | - |
| DLCQuest | 3.5s | 5.8s | 0.1s | 3.1s | 5.7s | 5.7s |
| DOOM 1993 | 3.3s | 6.4s | 0.1s | 3.2s | 6.5s | 13.8s |
| DOOM II | 3.5s | 7.6s | 0.1s | 3.4s | 7.6s | 14.5s |
| Dark Souls III | 4.3s | 18.7s | 0.1s | 2.7s | - | - |
| Donkey Kong Country 3 | 3.3s | 5.8s | 0.1s | 3.5s | - | - |
| Factorio | 3.7s | 5.7s | 0.1s | 3.4s | 5.7s | 5.8s |
| Faxanadu | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 14.1s |
| Final Fantasy Mystic Quest | 4.2s | 6.8s | 0.1s | 3.6s | - | - |
| Heretic | 3.6s | 7.6s | 0.1s | 3.4s | 7.6s | 14.3s |
| Hylics 2 | 3.2s | 5.6s | 0.1s | 3.1s | - | - |
| Inscryption | 3.3s | 5.7s | 0.1s | 3.2s | 5.7s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.1s | 5.5s | 0.1s | 3.2s | - | - |
| Links Awakening DX | 7.5s | 7.6s | 0.1s | 4.1s | - | - |
| Lufia II Ancient Cave | 3.5s | 5.6s | 0.1s | 3.4s | - | - |
| Mario & Luigi Superstar Saga | 4.0s | 7.7s | 0.1s | 4.5s | - | - |
| Math Adventure | 3.1s | 5.7s | 0.1s | 3.0s | - | - |
| Mega Man 2 | 3.0s | 5.6s | 0.1s | 2.9s | - | - |
| MegaMan Battle Network 3 | 3.3s | 5.6s | 0.1s | 3.0s | - | - |
| Meritous | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Metamath | 10.2s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 3.3s | 5.7s | 0.1s | 3.1s | - | - |
| Noita | 2.9s | 5.5s | 0.1s | 2.9s | 5.5s | 5.4s |
| Old School Runescape | 4.0s | 5.6s | 0.1s | 3.7s | - | - |
| Overcooked! 2 | 3.5s | 7.7s | 0.1s | 3.5s | - | - |
| Paint | 3.1s | 5.8s | 0.1s | 3.4s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.5s | 5.6s | 0.1s | 3.4s | - | - |
| Saving Princess | 3.2s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Shivers | 3.2s | 5.7s | 0.1s | 3.2s | 5.6s | 14.3s |
| Sonic Adventure 2 Battle | 4.4s | 5.6s | 0.1s | 2.6s | - | - |
| Subnautica | 3.7s | 9.7s | 0.1s | 3.6s | 9.6s | 14.3s |
| Super Mario 64 | 3.3s | 5.7s | 0.1s | 3.2s | - | - |
| Super Mario Land 2 | 3.4s | 5.5s | 0.1s | 2.4s | - | - |
| Super Mario World | 4.5s | 5.6s | 0.1s | 3.3s | - | - |
| TOEM original | 3.2s | 5.7s | 0.1s | 3.1s | 5.7s | 5.6s |
| TOEM rule builder | 3.2s | 5.8s | 0.1s | 3.1s | 5.7s | 5.7s |
| Terraria | 3.2s | 7.7s | 0.1s | 3.1s | 7.7s | 7.7s |
| The Legend of Zelda | 3.7s | 5.6s | 0.1s | 3.0s | - | - |
| The Messenger | 3.3s | 8.7s | 0.1s | 3.3s | - | - |
| The Wind Waker | 4.8s | 5.6s | 0.1s | 5.1s | - | - |
| Timespinner | 4.2s | 5.8s | 0.1s | 4.0s | 5.6s | 5.6s |
| Undertale | 3.3s | 5.7s | 0.1s | 3.2s | 5.6s | 5.7s |
| VVVVVV | 3.0s | 5.5s | 0.1s | 2.8s | - | - |
| Wargroove | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Yoshi's Island | 4.1s | 6.7s | 0.1s | 3.9s | - | - |
| shapez | 4.1s | 5.7s | 0.1s | 3.6s | 5.7s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.2s |
| 2 | A Link to the Past | 8.2s |
| 3 | Links Awakening DX | 7.5s |
| 4 | A Link to the Past WorldGen2 | 6.3s |
| 5 | The Wind Waker | 4.8s |
| 6 | Aquaria | 4.5s |
| 7 | Super Mario World | 4.5s |
| 8 | A Hat in Time | 4.4s |
| 9 | Sonic Adventure 2 Battle | 4.4s |
| 10 | Dark Souls III | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Hat in Time WorldGen2 | 17.5s |
| 3 | A Link to the Past | 14.2s |
| 4 | Aquaria | 10.9s |
| 5 | A Link to the Past WorldGen2 | 10.8s |
| 6 | A Short Hike | 10.5s |
| 7 | Adventure WorldGen2 | 10.2s |
| 8 | APQuest | 10.2s |
| 9 | Subnautica | 9.7s |
| 10 | The Messenger | 8.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Link to the Past WorldGen2 | 0.2s |
| 3 | Aquaria | 0.2s |
| 4 | A Hat in Time | 0.2s |
| 5 | A Short Hike WorldGen2 | 0.2s |
| 6 | A Hat in Time WorldGen2 | 0.1s |
| 7 | A Short Hike | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Adventure WorldGen2 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 7.0s |
| 2 | A Link to the Past WorldGen2 | 6.7s |
| 3 | The Wind Waker | 5.1s |
| 4 | Mario & Luigi Superstar Saga | 4.5s |
| 5 | Links Awakening DX | 4.1s |
| 6 | Castlevania 64 | 4.0s |
| 7 | Timespinner | 4.0s |
| 8 | Yoshi's Island | 3.9s |
| 9 | A Hat in Time WorldGen2 | 3.8s |
| 10 | Old School Runescape | 3.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 9.6s |
| 2 | Terraria | 7.7s |
| 3 | Heretic | 7.6s |
| 4 | DOOM II | 7.6s |
| 5 | DOOM 1993 | 6.5s |
| 6 | Paint | 5.7s |
| 7 | Aquaria | 5.7s |
| 8 | shapez | 5.7s |
| 9 | Factorio | 5.7s |
| 10 | TOEM original | 5.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | DOOM II | 14.5s |
| 2 | Heretic | 14.3s |
| 3 | shapez | 14.3s |
| 4 | Subnautica | 14.3s |
| 5 | Shivers | 14.3s |
| 6 | Faxanadu | 14.1s |
| 7 | DOOM 1993 | 13.8s |
| 8 | Terraria | 7.7s |
| 9 | Factorio | 5.8s |
| 10 | Aquaria | 5.7s |
