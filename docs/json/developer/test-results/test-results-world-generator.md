# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-13 01:21:11 UTC

**Source Data Created:** 2026-02-13 01:21:10

**Source Data Last Updated:** 2026-02-13 01:21:10

**Seed:** 1

**Mode:** Both (Canonical and Random)

This report shows the results of round-trip testing the world generator.
Each game's rules.json is converted to a `_worldgen` world, and the generated
world is validated to produce equivalent game logic.

Tests are run in two modes:
- **Canonical**: Uses `--canonical-seed` which places items in their original locations when seed matches
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

Tests run with `--canonical-seed` (items placed in original locations).

## Canonical Summary

**Total Templates:** 62

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 62 | 0 | 62 |
| Original Spoiler Test | 62 | 0 | 62 |
| Stage 1: World Generation | 62 | 0 | 62 |
| Stage 2: Seed Generation | 59 | 3 | 62 |
| Stage 3: Rules Comparison | 58 | 1 | 59 |
| Stage 4: WorldGen Spoiler Test | 59 | 0 | 59 |
| Stage 5: Cross-Validation | 59 | 0 | 59 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ❌ | - | - | - |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| EarthBound | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Satisfactory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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

**Total Templates:** 62

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 62 | 0 | 62 |
| Original Spoiler Test | 62 | 0 | 62 |
| Stage 1: World Generation | 62 | 0 | 62 |
| Stage 2: Seed Generation | 59 | 3 | 62 |
| Stage 3: Rules Comparison | 0 | 59 | 59 |
| Stage 4: WorldGen Spoiler Test | 59 | 0 | 59 |
| Stage 5: Cross-Validation | 41 | 18 | 59 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ❌ | - | - | - |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| EarthBound | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ❌ | - | - | - |
| Satisfactory | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Total | 227.5s | 437.1s | 33.8s | 203.3s | 389.9s | 388.9s |
| Average | 3.7s | 7.1s | 0.5s | 3.3s | 6.6s | 6.6s |
| Max | 11.0s | 21.9s | 0.6s | 6.3s | 21.8s | 21.8s |
| Min | 2.6s | 5.5s | 0.5s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.0s) | Satisfactory (21.9s) | A Link to the Past (0.6s) | A Link to the Past (6.3s) | Satisfactory (21.8s) | Satisfactory (21.8s) |
| Fastest | APQuest (2.6s) | VVVVVV (5.5s) | VVVVVV (0.5s) | Overcooked! 2 (2.5s) | Castlevania - Circle of the Moon (5.5s) | VVVVVV (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.1s | 7.3s | 0.6s | 4.0s | 6.7s | 6.7s |
| A Link to the Past | 7.0s | 10.3s | 0.6s | 6.3s | 8.8s | 8.8s |
| A Short Hike | 3.1s | 9.3s | 0.5s | 3.2s | 5.7s | 5.7s |
| APQuest | 2.6s | 8.9s | 0.5s | 2.6s | 5.6s | 5.5s |
| Adventure | 2.8s | 14.1s | 0.5s | 2.8s | 5.6s | 5.6s |
| Aquaria | 4.2s | 7.0s | 0.6s | 3.4s | 5.8s | 5.7s |
| Baking Adventure | 2.8s | 6.6s | 0.5s | 2.8s | 5.6s | 5.7s |
| Bumper Stickers | 3.2s | 8.2s | 0.6s | 3.0s | 5.7s | 5.7s |
| Castlevania - Circle of the Moon | 3.0s | 8.2s | 0.5s | 3.0s | 5.5s | 5.5s |
| Castlevania 64 | 3.3s | 9.4s | 0.5s | 3.4s | 5.7s | 5.7s |
| Celeste 64 | 3.0s | 5.9s | 0.6s | 3.3s | 5.7s | 5.7s |
| ChecksFinder | 3.2s | 5.8s | 0.6s | 3.1s | 5.7s | 5.8s |
| Choo-Choo Charles | 3.1s | 7.7s | 0.6s | 3.1s | 7.7s | 7.7s |
| Civilization VI | 7.5s | 5.5s | 0.5s | 2.7s | 5.5s | 5.5s |
| Coding Adventure | 2.8s | 5.7s | 0.5s | 2.7s | 5.6s | 5.7s |
| DLCQuest | 3.2s | 5.7s | 0.5s | 2.6s | - | - |
| DOOM 1993 | 3.3s | 6.7s | 0.5s | 3.1s | 6.7s | 6.7s |
| DOOM II | 3.8s | 7.7s | 0.6s | 3.3s | 7.7s | 7.7s |
| Dark Souls III | 3.8s | 18.6s | 0.5s | 3.8s | 18.5s | 18.5s |
| Donkey Kong Country 3 | 3.1s | 5.7s | 0.6s | 3.1s | 6.7s | 5.8s |
| EarthBound | 3.9s | 5.8s | 0.6s | 3.9s | 5.8s | 5.7s |
| Factorio | 3.9s | 5.8s | 0.6s | 3.5s | 5.8s | 5.8s |
| Faxanadu | 3.0s | 5.7s | 0.6s | 3.0s | 5.7s | 5.7s |
| Final Fantasy Mystic Quest | 3.2s | 6.6s | 0.5s | 3.0s | 6.6s | 6.6s |
| Heretic | 3.4s | 7.7s | 0.5s | 3.2s | 7.7s | 7.7s |
| Hylics 2 | 3.2s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| Inscryption | 2.9s | 5.7s | 0.5s | 3.0s | 5.6s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.6s | 5.9s | 0.6s | 3.3s | 5.7s | 5.7s |
| Links Awakening DX | 5.7s | 8.5s | 0.5s | 3.5s | 8.5s | 8.5s |
| Lufia II Ancient Cave | 3.2s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.8s | 7.7s | 0.6s | 4.6s | 7.7s | 7.8s |
| Math Adventure | 3.1s | 5.8s | 0.6s | 3.1s | 5.8s | 5.8s |
| Mega Man 2 | 3.0s | 5.7s | 0.5s | 3.1s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 2.9s | 5.5s | 0.5s | 2.7s | 5.5s | 5.6s |
| Meritous | 2.8s | 5.6s | 0.5s | 2.7s | 5.6s | 5.6s |
| Metamath | 11.0s | 5.7s | 0.6s | 2.9s | 5.7s | 5.7s |
| Muse Dash | 3.1s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| Noita | 3.3s | 5.7s | 0.6s | 3.0s | 5.8s | 5.7s |
| Old School Runescape | 3.8s | 5.5s | 0.5s | 3.4s | 5.5s | 5.5s |
| Overcooked! 2 | 3.3s | 7.7s | 0.6s | 2.5s | - | - |
| Paint | 3.0s | 5.7s | 0.6s | 3.4s | 5.8s | 5.7s |
| Risk of Rain 2 | 3.5s | 5.8s | 0.6s | 2.7s | - | - |
| Satisfactory | 4.9s | 21.9s | 0.6s | 3.8s | 21.8s | 21.8s |
| Saving Princess | 2.6s | 5.5s | 0.5s | 2.6s | 5.5s | 5.5s |
| Shivers | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.6s |
| Sonic Adventure 2 Battle | 4.5s | 5.7s | 0.6s | 4.3s | 5.7s | 5.7s |
| Subnautica | 3.2s | 7.7s | 0.5s | 3.3s | 7.7s | 7.7s |
| Super Mario 64 | 3.6s | 5.7s | 0.6s | 3.3s | 5.8s | 5.7s |
| Super Mario Land 2 | 3.4s | 5.6s | 0.5s | 3.6s | 5.5s | 5.5s |
| Super Mario World | 4.4s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| TOEM original | 3.0s | 5.7s | 0.6s | 3.2s | 5.8s | 5.7s |
| TOEM rule builder | 3.4s | 5.8s | 0.6s | 3.1s | 5.8s | 5.8s |
| Terraria | 3.2s | 7.8s | 0.6s | 3.1s | 7.7s | 7.8s |
| The Legend of Zelda | 3.4s | 5.6s | 0.5s | 2.7s | 5.5s | 5.5s |
| The Messenger | 3.1s | 9.8s | 0.5s | 3.1s | 9.8s | 9.8s |
| The Wind Waker | 5.3s | 5.7s | 0.6s | 5.6s | 5.7s | 5.7s |
| Timespinner | 4.1s | 5.8s | 0.6s | 3.8s | 5.7s | 5.7s |
| Undertale | 3.2s | 5.7s | 0.6s | 3.2s | 5.7s | 5.8s |
| VVVVVV | 2.8s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| Wargroove | 3.0s | 5.7s | 0.6s | 2.9s | 5.6s | 5.7s |
| Yoshi's Island | 4.1s | 5.7s | 0.6s | 4.1s | 5.7s | 5.7s |
| shapez | 4.0s | 5.8s | 0.6s | 3.5s | 5.8s | 5.8s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.0s |
| 2 | Civilization VI | 7.5s |
| 3 | A Link to the Past | 7.0s |
| 4 | Links Awakening DX | 5.7s |
| 5 | The Wind Waker | 5.3s |
| 6 | Satisfactory | 4.9s |
| 7 | Sonic Adventure 2 Battle | 4.5s |
| 8 | Super Mario World | 4.4s |
| 9 | Aquaria | 4.2s |
| 10 | A Hat in Time | 4.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.9s |
| 2 | Dark Souls III | 18.6s |
| 3 | Adventure | 14.1s |
| 4 | A Link to the Past | 10.3s |
| 5 | The Messenger | 9.8s |
| 6 | Castlevania 64 | 9.4s |
| 7 | A Short Hike | 9.3s |
| 8 | APQuest | 8.9s |
| 9 | Links Awakening DX | 8.5s |
| 10 | Castlevania - Circle of the Moon | 8.2s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.6s |
| 2 | Satisfactory | 0.6s |
| 3 | DOOM II | 0.6s |
| 4 | Noita | 0.6s |
| 5 | Super Mario 64 | 0.6s |
| 6 | shapez | 0.6s |
| 7 | Mario & Luigi Superstar Saga | 0.6s |
| 8 | Sonic Adventure 2 Battle | 0.6s |
| 9 | The Wind Waker | 0.6s |
| 10 | Undertale | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.3s |
| 2 | The Wind Waker | 5.6s |
| 3 | Mario & Luigi Superstar Saga | 4.6s |
| 4 | Sonic Adventure 2 Battle | 4.3s |
| 5 | Yoshi's Island | 4.1s |
| 6 | A Hat in Time | 4.0s |
| 7 | EarthBound | 3.9s |
| 8 | Dark Souls III | 3.8s |
| 9 | Satisfactory | 3.8s |
| 10 | Timespinner | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.5s |
| 3 | The Messenger | 9.8s |
| 4 | A Link to the Past | 8.8s |
| 5 | Links Awakening DX | 8.5s |
| 6 | Choo-Choo Charles | 7.7s |
| 7 | DOOM II | 7.7s |
| 8 | Mario & Luigi Superstar Saga | 7.7s |
| 9 | Terraria | 7.7s |
| 10 | Subnautica | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.5s |
| 3 | The Messenger | 9.8s |
| 4 | A Link to the Past | 8.8s |
| 5 | Links Awakening DX | 8.5s |
| 6 | Terraria | 7.8s |
| 7 | Mario & Luigi Superstar Saga | 7.8s |
| 8 | Choo-Choo Charles | 7.7s |
| 9 | Subnautica | 7.7s |
| 10 | DOOM II | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 231.0s | 428.8s | 34.2s | 206.2s | 390.6s | 528.1s |
| Average | 3.7s | 6.9s | 0.6s | 3.3s | 6.6s | 9.0s |
| Max | 11.2s | 21.8s | 0.6s | 6.1s | 21.8s | 33.0s |
| Min | 2.7s | 5.6s | 0.5s | 2.6s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.2s) | Satisfactory (21.8s) | Links Awakening DX (0.6s) | A Link to the Past (6.1s) | Satisfactory (21.8s) | Dark Souls III (33.0s) |
| Fastest | APQuest (2.7s) | Mega Man 2 (5.6s) | Undertale (0.5s) | Overcooked! 2 (2.6s) | Lufia II Ancient Cave (5.6s) | Lufia II Ancient Cave (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.3s | 7.9s | 0.6s | 4.1s | 6.8s | 6.7s |
| A Link to the Past | 6.8s | 9.3s | 0.6s | 6.1s | 9.8s | 15.0s |
| A Short Hike | 2.9s | 6.2s | 0.5s | 3.0s | 5.7s | 5.7s |
| APQuest | 2.7s | 6.4s | 0.5s | 2.8s | 5.6s | 5.6s |
| Adventure | 3.1s | 6.5s | 0.6s | 2.9s | 5.7s | 5.6s |
| Aquaria | 4.2s | 7.2s | 0.6s | 3.5s | 5.7s | 5.7s |
| Baking Adventure | 3.0s | 10.3s | 0.6s | 2.9s | 5.7s | 5.7s |
| Bumper Stickers | 2.8s | 8.8s | 0.5s | 2.8s | 5.7s | 14.4s |
| Castlevania - Circle of the Moon | 3.2s | 9.1s | 0.6s | 3.3s | 5.7s | 5.7s |
| Castlevania 64 | 3.4s | 6.8s | 0.6s | 3.2s | 5.6s | 5.7s |
| Celeste 64 | 3.0s | 5.9s | 0.5s | 3.5s | 5.8s | 14.4s |
| ChecksFinder | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 5.8s |
| Choo-Choo Charles | 2.9s | 7.7s | 0.5s | 2.9s | 7.7s | 7.7s |
| Civilization VI | 8.0s | 5.6s | 0.5s | 2.8s | 5.6s | 14.3s |
| Coding Adventure | 3.0s | 5.7s | 0.6s | 2.9s | 5.7s | 5.7s |
| DLCQuest | 3.2s | 5.7s | 0.5s | 2.7s | - | - |
| DOOM 1993 | 3.5s | 6.7s | 0.5s | 3.6s | 6.8s | 14.5s |
| DOOM II | 3.3s | 7.7s | 0.6s | 3.2s | 7.7s | 14.3s |
| Dark Souls III | 4.1s | 18.8s | 0.6s | 4.1s | 17.8s | 33.0s |
| Donkey Kong Country 3 | 3.0s | 5.7s | 0.5s | 3.0s | 5.6s | 14.3s |
| EarthBound | 4.0s | 5.8s | 0.6s | 3.8s | 5.8s | 5.7s |
| Factorio | 3.6s | 5.8s | 0.5s | 3.6s | 5.8s | 5.8s |
| Faxanadu | 2.9s | 5.6s | 0.5s | 2.8s | 5.6s | 14.3s |
| Final Fantasy Mystic Quest | 3.4s | 6.7s | 0.5s | 3.2s | 6.7s | 6.7s |
| Heretic | 3.7s | 7.7s | 0.6s | 3.3s | 7.7s | 14.4s |
| Hylics 2 | 3.3s | 5.7s | 0.5s | 3.3s | 5.8s | 5.7s |
| Inscryption | 3.1s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.1s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Links Awakening DX | 6.2s | 8.8s | 0.6s | 4.0s | 8.8s | 8.8s |
| Lufia II Ancient Cave | 3.1s | 5.7s | 0.6s | 3.0s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 4.1s | 7.8s | 0.6s | 4.3s | 7.7s | 7.7s |
| Math Adventure | 2.9s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| Mega Man 2 | 2.9s | 5.6s | 0.5s | 3.0s | 5.7s | 5.6s |
| MegaMan Battle Network 3 | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 14.3s |
| Meritous | 3.1s | 5.7s | 0.6s | 2.9s | 5.7s | 5.7s |
| Metamath | 11.2s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Muse Dash | 3.2s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| Noita | 2.8s | 5.8s | 0.5s | 2.8s | 5.7s | 5.6s |
| Old School Runescape | 4.1s | 5.7s | 0.6s | 3.8s | 5.8s | 5.7s |
| Overcooked! 2 | 3.4s | 7.7s | 0.6s | 2.6s | - | - |
| Paint | 3.3s | 5.8s | 0.6s | 3.2s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.3s | 5.7s | 0.5s | 2.7s | - | - |
| Satisfactory | 4.7s | 21.8s | 0.6s | 4.0s | 21.8s | 15.7s |
| Saving Princess | 2.9s | 5.7s | 0.5s | 2.8s | 5.6s | 5.7s |
| Shivers | 3.3s | 5.7s | 0.6s | 3.1s | 5.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.9s | 5.7s | 0.6s | 4.6s | 5.8s | 14.5s |
| Subnautica | 3.3s | 7.7s | 0.6s | 3.6s | 7.7s | 14.4s |
| Super Mario 64 | 3.2s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.7s | 5.8s | 0.6s | 3.9s | 5.8s | 5.7s |
| Super Mario World | 4.5s | 5.8s | 0.5s | 3.1s | 5.6s | 5.6s |
| TOEM original | 3.2s | 5.8s | 0.6s | 3.0s | 5.7s | 5.7s |
| TOEM rule builder | 2.9s | 5.7s | 0.6s | 3.0s | 5.7s | 5.8s |
| Terraria | 3.0s | 7.7s | 0.5s | 2.9s | 7.7s | 7.7s |
| The Legend of Zelda | 3.7s | 5.7s | 0.6s | 2.9s | 5.7s | 14.3s |
| The Messenger | 3.3s | 9.9s | 0.5s | 3.2s | 9.8s | 9.8s |
| The Wind Waker | 5.5s | 5.8s | 0.6s | 5.9s | 5.7s | 14.5s |
| Timespinner | 4.1s | 5.8s | 0.6s | 3.8s | 5.7s | 5.7s |
| Undertale | 2.9s | 5.7s | 0.5s | 2.8s | 5.6s | 5.6s |
| VVVVVV | 3.1s | 5.7s | 0.6s | 3.0s | 5.7s | 5.7s |
| Wargroove | 3.0s | 5.7s | 0.6s | 2.8s | 5.6s | 5.6s |
| Yoshi's Island | 4.4s | 6.8s | 0.6s | 3.9s | 5.7s | 5.7s |
| shapez | 3.9s | 5.7s | 0.5s | 3.6s | 5.8s | 14.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.2s |
| 2 | Civilization VI | 8.0s |
| 3 | A Link to the Past | 6.8s |
| 4 | Links Awakening DX | 6.2s |
| 5 | The Wind Waker | 5.5s |
| 6 | Sonic Adventure 2 Battle | 4.9s |
| 7 | Satisfactory | 4.7s |
| 8 | Super Mario World | 4.5s |
| 9 | Yoshi's Island | 4.4s |
| 10 | A Hat in Time | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.8s |
| 3 | Baking Adventure | 10.3s |
| 4 | The Messenger | 9.9s |
| 5 | A Link to the Past | 9.3s |
| 6 | Castlevania - Circle of the Moon | 9.1s |
| 7 | Bumper Stickers | 8.8s |
| 8 | Links Awakening DX | 8.8s |
| 9 | A Hat in Time | 7.9s |
| 10 | Mario & Luigi Superstar Saga | 7.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Links Awakening DX | 0.6s |
| 2 | Mario & Luigi Superstar Saga | 0.6s |
| 3 | Yoshi's Island | 0.6s |
| 4 | Heretic | 0.6s |
| 5 | Super Mario Land 2 | 0.6s |
| 6 | Dark Souls III | 0.6s |
| 7 | EarthBound | 0.6s |
| 8 | Satisfactory | 0.6s |
| 9 | TOEM original | 0.6s |
| 10 | A Link to the Past | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.1s |
| 2 | The Wind Waker | 5.9s |
| 3 | Sonic Adventure 2 Battle | 4.6s |
| 4 | Mario & Luigi Superstar Saga | 4.3s |
| 5 | A Hat in Time | 4.1s |
| 6 | Dark Souls III | 4.1s |
| 7 | Satisfactory | 4.0s |
| 8 | Links Awakening DX | 4.0s |
| 9 | Super Mario Land 2 | 3.9s |
| 10 | Yoshi's Island | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 17.8s |
| 3 | The Messenger | 9.8s |
| 4 | A Link to the Past | 9.8s |
| 5 | Links Awakening DX | 8.8s |
| 6 | Heretic | 7.7s |
| 7 | Mario & Luigi Superstar Saga | 7.7s |
| 8 | Terraria | 7.7s |
| 9 | Subnautica | 7.7s |
| 10 | DOOM II | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 33.0s |
| 2 | Satisfactory | 15.7s |
| 3 | A Link to the Past | 15.0s |
| 4 | shapez | 14.6s |
| 5 | Sonic Adventure 2 Battle | 14.5s |
| 6 | DOOM 1993 | 14.5s |
| 7 | The Wind Waker | 14.5s |
| 8 | Heretic | 14.4s |
| 9 | Celeste 64 | 14.4s |
| 10 | Subnautica | 14.4s |
