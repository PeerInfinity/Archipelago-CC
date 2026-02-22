# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-22 19:25:08 UTC

**Source Data Created:** 2026-02-22 19:25:08

**Source Data Last Updated:** 2026-02-22 19:25:08

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
| Stage 2: Seed Generation | 62 | 0 | 62 |
| Stage 3: Rules Comparison | 52 | 10 | 62 |
| Stage 4: WorldGen Spoiler Test | 62 | 0 | 62 |
| Stage 5: Cross-Validation | 59 | 3 | 62 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| EarthBound | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Satisfactory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Stage 2: Seed Generation | 62 | 0 | 62 |
| Stage 3: Rules Comparison | 0 | 62 | 62 |
| Stage 4: WorldGen Spoiler Test | 62 | 0 | 62 |
| Stage 5: Cross-Validation | 43 | 19 | 62 |

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
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Total | 236.5s | 422.8s | 32.9s | 207.6s | 403.0s | 430.4s |
| Average | 3.8s | 6.8s | 0.5s | 3.3s | 6.5s | 6.9s |
| Max | 11.1s | 21.6s | 0.6s | 5.8s | 20.6s | 21.6s |
| Min | 2.8s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.1s) | Satisfactory (21.6s) | Mario & Luigi Superstar Saga (0.6s) | A Link to the Past (5.8s) | Satisfactory (20.6s) | Satisfactory (21.6s) |
| Fastest | Faxanadu (2.8s) | Faxanadu (5.5s) | A Short Hike (0.5s) | Faxanadu (2.8s) | A Short Hike (5.5s) | Mega Man 2 (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.6s | 7.8s | 0.5s | 4.0s | 6.7s | 6.7s |
| A Link to the Past | 6.9s | 9.3s | 0.6s | 5.8s | 8.7s | 8.7s |
| A Short Hike | 3.4s | 6.7s | 0.5s | 3.0s | 5.5s | 5.5s |
| APQuest | 3.8s | 6.8s | 0.6s | 3.2s | 5.6s | 5.7s |
| Adventure | 3.3s | 8.4s | 0.5s | 3.0s | 5.6s | 5.6s |
| Aquaria | 4.7s | 7.9s | 0.6s | 3.5s | 5.8s | 5.7s |
| Baking Adventure | 3.3s | 7.5s | 0.5s | 2.9s | 5.6s | 14.4s |
| Bumper Stickers | 3.5s | 7.3s | 0.5s | 2.9s | 5.6s | 5.7s |
| Castlevania - Circle of the Moon | 3.6s | 6.4s | 0.5s | 3.2s | 5.5s | 5.5s |
| Castlevania 64 | 4.0s | 8.9s | 0.6s | 3.7s | 5.7s | 5.7s |
| Celeste 64 | 3.1s | 5.7s | 0.5s | 3.1s | 5.6s | 5.6s |
| ChecksFinder | 2.8s | 5.7s | 0.5s | 2.8s | 5.6s | 5.6s |
| Choo-Choo Charles | 2.8s | 7.5s | 0.5s | 3.0s | 7.5s | 7.5s |
| Civilization VI | 8.8s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| Coding Adventure | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 14.2s |
| DLCQuest | 3.2s | 5.6s | 0.5s | 3.1s | 5.6s | 5.7s |
| DOOM 1993 | 3.4s | 6.7s | 0.5s | 3.2s | 6.6s | 6.7s |
| DOOM II | 3.5s | 7.7s | 0.5s | 3.3s | 7.7s | 7.7s |
| Dark Souls III | 4.0s | 18.6s | 0.5s | 3.9s | 18.6s | 18.6s |
| Donkey Kong Country 3 | 3.3s | 5.7s | 0.6s | 3.3s | 5.7s | 5.7s |
| EarthBound | 3.9s | 5.7s | 0.6s | 3.7s | 5.7s | 5.7s |
| Factorio | 3.6s | 5.7s | 0.5s | 3.3s | 5.7s | 5.8s |
| Faxanadu | 2.8s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| Final Fantasy Mystic Quest | 4.2s | 6.8s | 0.6s | 3.8s | 6.7s | 6.7s |
| Heretic | 3.4s | 7.7s | 0.5s | 3.2s | 7.7s | 7.8s |
| Hylics 2 | 3.2s | 5.6s | 0.5s | 3.1s | 5.7s | 5.7s |
| Inscryption | 3.0s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.2s | 5.7s | 0.5s | 3.2s | 5.7s | 5.7s |
| Links Awakening DX | 5.9s | 8.6s | 0.5s | 3.7s | 8.6s | 8.5s |
| Lufia II Ancient Cave | 3.4s | 5.7s | 0.5s | 3.4s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.8s | 7.7s | 0.6s | 4.2s | 7.7s | 7.7s |
| Math Adventure | 2.9s | 5.6s | 0.5s | 2.9s | 5.6s | 14.2s |
| Mega Man 2 | 3.0s | 5.6s | 0.5s | 2.9s | 5.5s | 5.5s |
| MegaMan Battle Network 3 | 3.5s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| Meritous | 2.9s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Metamath | 11.1s | 5.7s | 0.6s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 5.7s | 0.5s | 3.1s | 5.6s | 5.6s |
| Noita | 2.9s | 5.8s | 0.5s | 3.1s | 5.6s | 5.6s |
| Old School Runescape | 3.9s | 5.6s | 0.5s | 3.6s | 5.5s | 5.5s |
| Overcooked! 2 | 3.4s | 7.7s | 0.6s | 3.4s | 7.8s | 7.8s |
| Paint | 3.2s | 5.8s | 0.6s | 3.2s | 5.6s | 5.7s |
| Risk of Rain 2 | 3.3s | 5.7s | 0.5s | 3.3s | 5.6s | 5.6s |
| Satisfactory | 4.6s | 21.6s | 0.5s | 3.4s | 20.6s | 21.6s |
| Saving Princess | 3.4s | 5.8s | 0.6s | 3.2s | 5.7s | 5.7s |
| Shivers | 3.2s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Sonic Adventure 2 Battle | 4.4s | 5.6s | 0.5s | 4.2s | 5.6s | 5.6s |
| Subnautica | 3.5s | 7.7s | 0.6s | 3.6s | 7.7s | 7.7s |
| Super Mario 64 | 3.2s | 5.7s | 0.5s | 3.1s | 5.6s | 5.7s |
| Super Mario Land 2 | 3.6s | 5.6s | 0.5s | 3.8s | 5.5s | 5.6s |
| Super Mario World | 4.7s | 5.7s | 0.6s | 3.5s | 5.7s | 5.7s |
| TOEM original | 3.1s | 5.6s | 0.6s | 3.0s | 5.7s | 5.7s |
| TOEM rule builder | 3.1s | 5.7s | 0.5s | 3.0s | 5.6s | 5.7s |
| Terraria | 3.0s | 7.5s | 0.5s | 3.1s | 7.5s | 7.5s |
| The Legend of Zelda | 4.1s | 5.7s | 0.6s | 3.4s | 5.7s | 5.7s |
| The Messenger | 3.3s | 8.7s | 0.5s | 3.1s | 8.8s | 8.8s |
| The Wind Waker | 5.7s | 5.7s | 0.6s | 5.6s | 5.7s | 5.7s |
| Timespinner | 4.2s | 5.7s | 0.6s | 4.0s | 5.7s | 5.7s |
| Undertale | 3.0s | 5.6s | 0.5s | 2.9s | 5.6s | 5.7s |
| VVVVVV | 3.0s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| Wargroove | 3.2s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| Yoshi's Island | 4.1s | 6.7s | 0.6s | 3.9s | 5.7s | 5.7s |
| shapez | 3.8s | 5.7s | 0.5s | 3.2s | 5.6s | 5.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.1s |
| 2 | Civilization VI | 8.8s |
| 3 | A Link to the Past | 6.9s |
| 4 | Links Awakening DX | 5.9s |
| 5 | The Wind Waker | 5.7s |
| 6 | Super Mario World | 4.7s |
| 7 | Aquaria | 4.7s |
| 8 | Satisfactory | 4.6s |
| 9 | A Hat in Time | 4.6s |
| 10 | Sonic Adventure 2 Battle | 4.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.6s |
| 2 | Dark Souls III | 18.6s |
| 3 | A Link to the Past | 9.3s |
| 4 | Castlevania 64 | 8.9s |
| 5 | The Messenger | 8.7s |
| 6 | Links Awakening DX | 8.6s |
| 7 | Adventure | 8.4s |
| 8 | Aquaria | 7.9s |
| 9 | A Hat in Time | 7.8s |
| 10 | Overcooked! 2 | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Mario & Luigi Superstar Saga | 0.6s |
| 2 | Subnautica | 0.6s |
| 3 | The Legend of Zelda | 0.6s |
| 4 | A Link to the Past | 0.6s |
| 5 | APQuest | 0.6s |
| 6 | Final Fantasy Mystic Quest | 0.6s |
| 7 | MegaMan Battle Network 3 | 0.6s |
| 8 | Yoshi's Island | 0.6s |
| 9 | Aquaria | 0.6s |
| 10 | Castlevania 64 | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.8s |
| 2 | The Wind Waker | 5.6s |
| 3 | Mario & Luigi Superstar Saga | 4.2s |
| 4 | Sonic Adventure 2 Battle | 4.2s |
| 5 | Timespinner | 4.0s |
| 6 | A Hat in Time | 4.0s |
| 7 | Yoshi's Island | 3.9s |
| 8 | Dark Souls III | 3.9s |
| 9 | Final Fantasy Mystic Quest | 3.8s |
| 10 | Super Mario Land 2 | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 20.6s |
| 2 | Dark Souls III | 18.6s |
| 3 | The Messenger | 8.8s |
| 4 | A Link to the Past | 8.7s |
| 5 | Links Awakening DX | 8.6s |
| 6 | Overcooked! 2 | 7.8s |
| 7 | DOOM II | 7.7s |
| 8 | Mario & Luigi Superstar Saga | 7.7s |
| 9 | Subnautica | 7.7s |
| 10 | Heretic | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.6s |
| 2 | Dark Souls III | 18.6s |
| 3 | Baking Adventure | 14.4s |
| 4 | Math Adventure | 14.2s |
| 5 | Coding Adventure | 14.2s |
| 6 | The Messenger | 8.8s |
| 7 | A Link to the Past | 8.7s |
| 8 | Links Awakening DX | 8.5s |
| 9 | Heretic | 7.8s |
| 10 | Overcooked! 2 | 7.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 235.3s | 423.7s | 33.6s | 209.2s | 405.6s | 549.8s |
| Average | 3.8s | 6.8s | 0.5s | 3.4s | 6.5s | 8.9s |
| Max | 10.7s | 21.8s | 0.6s | 6.0s | 21.7s | 32.8s |
| Min | 2.9s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.7s) | Satisfactory (21.8s) | A Link to the Past (0.6s) | A Link to the Past (6.0s) | Satisfactory (21.7s) | Dark Souls III (32.8s) |
| Fastest | Noita (2.9s) | Undertale (5.6s) | Undertale (0.5s) | Faxanadu (2.8s) | Saving Princess (5.6s) | APQuest (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 8.1s | 0.5s | 3.8s | 6.7s | 6.7s |
| A Link to the Past | 7.3s | 12.5s | 0.6s | 6.0s | 8.7s | 14.5s |
| A Short Hike | 3.4s | 6.2s | 0.5s | 3.0s | 5.6s | 5.6s |
| APQuest | 3.2s | 6.1s | 0.5s | 2.9s | 5.6s | 5.6s |
| Adventure | 3.8s | 6.3s | 0.6s | 3.1s | 5.6s | 5.7s |
| Aquaria | 4.8s | 7.3s | 0.6s | 3.6s | 5.7s | 5.8s |
| Baking Adventure | 3.3s | 7.6s | 0.5s | 2.9s | 5.7s | 5.7s |
| Bumper Stickers | 3.3s | 6.5s | 0.5s | 2.9s | 5.6s | 14.2s |
| Castlevania - Circle of the Moon | 3.6s | 10.0s | 0.5s | 3.1s | 5.7s | 5.6s |
| Castlevania 64 | 3.9s | 6.6s | 0.6s | 3.5s | 5.6s | 5.7s |
| Celeste 64 | 3.1s | 5.8s | 0.5s | 3.1s | 5.6s | 14.3s |
| ChecksFinder | 3.0s | 5.7s | 0.6s | 2.9s | 5.7s | 5.7s |
| Choo-Choo Charles | 3.0s | 7.7s | 0.5s | 3.0s | 7.7s | 7.7s |
| Civilization VI | 8.1s | 5.6s | 0.5s | 3.0s | 5.6s | 14.2s |
| Coding Adventure | 3.1s | 5.7s | 0.6s | 2.9s | 5.7s | 5.7s |
| DLCQuest | 3.2s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| DOOM 1993 | 3.4s | 6.7s | 0.5s | 3.4s | 6.7s | 14.3s |
| DOOM II | 3.5s | 7.6s | 0.5s | 3.3s | 7.7s | 14.3s |
| Dark Souls III | 4.1s | 18.8s | 0.6s | 4.0s | 17.7s | 32.8s |
| Donkey Kong Country 3 | 3.2s | 5.7s | 0.5s | 3.2s | 5.7s | 14.3s |
| EarthBound | 3.8s | 5.7s | 0.5s | 3.7s | 5.7s | 5.7s |
| Factorio | 3.8s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| Faxanadu | 2.9s | 5.6s | 0.5s | 2.8s | 5.6s | 14.2s |
| Final Fantasy Mystic Quest | 3.7s | 6.7s | 0.6s | 3.4s | 6.7s | 6.7s |
| Heretic | 3.7s | 7.7s | 0.6s | 3.5s | 7.7s | 14.5s |
| Hylics 2 | 3.3s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| Inscryption | 3.0s | 5.7s | 0.5s | 3.2s | 5.6s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.8s | 0.5s | 3.2s | 5.7s | 5.6s |
| Links Awakening DX | 6.0s | 8.8s | 0.6s | 3.9s | 8.7s | 8.7s |
| Lufia II Ancient Cave | 3.2s | 5.6s | 0.5s | 3.2s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 7.6s | 0.6s | 4.1s | 7.7s | 7.6s |
| Math Adventure | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Mega Man 2 | 3.0s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.2s | 5.6s | 0.5s | 3.0s | 5.8s | 14.3s |
| Meritous | 3.1s | 5.7s | 0.6s | 3.0s | 5.8s | 5.7s |
| Metamath | 10.7s | 5.7s | 0.5s | 3.0s | 5.7s | 5.8s |
| Muse Dash | 3.2s | 5.7s | 0.5s | 3.2s | 5.7s | 5.7s |
| Noita | 2.9s | 5.6s | 0.5s | 3.0s | 5.6s | 5.7s |
| Old School Runescape | 4.0s | 5.7s | 0.6s | 3.7s | 5.7s | 5.7s |
| Overcooked! 2 | 3.3s | 7.7s | 0.6s | 3.3s | 7.7s | 14.4s |
| Paint | 3.1s | 5.6s | 0.5s | 3.2s | 5.7s | 5.6s |
| Risk of Rain 2 | 3.5s | 5.7s | 0.5s | 3.3s | 5.6s | 5.7s |
| Satisfactory | 4.7s | 21.8s | 0.6s | 4.0s | 21.7s | 15.6s |
| Saving Princess | 3.0s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Shivers | 3.4s | 5.7s | 0.6s | 3.2s | 5.7s | 14.4s |
| Sonic Adventure 2 Battle | 4.7s | 5.7s | 0.6s | 4.3s | 5.7s | 14.5s |
| Subnautica | 3.4s | 7.6s | 0.5s | 3.6s | 7.7s | 14.3s |
| Super Mario 64 | 3.2s | 5.6s | 0.5s | 3.2s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.7s | 5.7s | 0.6s | 3.8s | 5.7s | 5.7s |
| Super Mario World | 4.4s | 5.8s | 0.5s | 3.3s | 5.6s | 5.7s |
| TOEM original | 2.9s | 5.7s | 0.5s | 2.9s | 5.6s | 5.6s |
| TOEM rule builder | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Terraria | 3.1s | 7.6s | 0.5s | 3.0s | 7.7s | 7.6s |
| The Legend of Zelda | 3.7s | 5.6s | 0.6s | 3.0s | 5.6s | 14.3s |
| The Messenger | 3.4s | 8.9s | 0.5s | 3.3s | 8.8s | 8.8s |
| The Wind Waker | 5.8s | 5.8s | 0.6s | 5.7s | 5.7s | 14.4s |
| Timespinner | 4.2s | 5.7s | 0.6s | 3.9s | 5.7s | 5.7s |
| Undertale | 3.0s | 5.6s | 0.5s | 3.0s | 5.6s | 5.7s |
| VVVVVV | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.6s |
| Wargroove | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Yoshi's Island | 3.9s | 5.7s | 0.5s | 3.9s | 5.7s | 5.7s |
| shapez | 3.9s | 5.7s | 0.5s | 3.3s | 5.7s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.7s |
| 2 | Civilization VI | 8.1s |
| 3 | A Link to the Past | 7.3s |
| 4 | Links Awakening DX | 6.0s |
| 5 | The Wind Waker | 5.8s |
| 6 | Aquaria | 4.8s |
| 7 | Sonic Adventure 2 Battle | 4.7s |
| 8 | Satisfactory | 4.7s |
| 9 | A Hat in Time | 4.5s |
| 10 | Super Mario World | 4.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.8s |
| 3 | A Link to the Past | 12.5s |
| 4 | Castlevania - Circle of the Moon | 10.0s |
| 5 | The Messenger | 8.9s |
| 6 | Links Awakening DX | 8.8s |
| 7 | A Hat in Time | 8.1s |
| 8 | Overcooked! 2 | 7.7s |
| 9 | Heretic | 7.7s |
| 10 | Choo-Choo Charles | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.6s |
| 2 | Satisfactory | 0.6s |
| 3 | Super Mario Land 2 | 0.6s |
| 4 | Dark Souls III | 0.6s |
| 5 | Heretic | 0.6s |
| 6 | Old School Runescape | 0.6s |
| 7 | Adventure | 0.6s |
| 8 | Coding Adventure | 0.6s |
| 9 | Hylics 2 | 0.6s |
| 10 | Links Awakening DX | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.0s |
| 2 | The Wind Waker | 5.7s |
| 3 | Sonic Adventure 2 Battle | 4.3s |
| 4 | Mario & Luigi Superstar Saga | 4.1s |
| 5 | Satisfactory | 4.0s |
| 6 | Dark Souls III | 4.0s |
| 7 | Links Awakening DX | 3.9s |
| 8 | Timespinner | 3.9s |
| 9 | Yoshi's Island | 3.9s |
| 10 | Super Mario Land 2 | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.7s |
| 2 | Dark Souls III | 17.7s |
| 3 | The Messenger | 8.8s |
| 4 | A Link to the Past | 8.7s |
| 5 | Links Awakening DX | 8.7s |
| 6 | Heretic | 7.7s |
| 7 | Overcooked! 2 | 7.7s |
| 8 | Mario & Luigi Superstar Saga | 7.7s |
| 9 | DOOM II | 7.7s |
| 10 | Choo-Choo Charles | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.8s |
| 2 | Satisfactory | 15.6s |
| 3 | Sonic Adventure 2 Battle | 14.5s |
| 4 | Heretic | 14.5s |
| 5 | A Link to the Past | 14.5s |
| 6 | Overcooked! 2 | 14.4s |
| 7 | Shivers | 14.4s |
| 8 | The Wind Waker | 14.4s |
| 9 | DOOM 1993 | 14.3s |
| 10 | MegaMan Battle Network 3 | 14.3s |
