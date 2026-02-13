# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-12 23:32:00 UTC

**Source Data Created:** 2026-02-12 23:31:59

**Source Data Last Updated:** 2026-02-12 23:31:59

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
| Total | 230.5s | 429.6s | 33.6s | 204.9s | 388.4s | 388.9s |
| Average | 3.7s | 6.9s | 0.5s | 3.3s | 6.6s | 6.6s |
| Max | 11.5s | 21.9s | 0.6s | 6.0s | 21.8s | 21.8s |
| Min | 2.8s | 5.5s | 0.5s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.5s) | Satisfactory (21.9s) | Satisfactory (0.6s) | The Wind Waker (6.0s) | Satisfactory (21.8s) | Satisfactory (21.8s) |
| Fastest | TOEM original (2.8s) | Landstalker - The Treasures of King Nole (5.5s) | TOEM original (0.5s) | Risk of Rain 2 (2.5s) | TOEM original (5.5s) | TOEM original (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 3.9s | 11.5s | 0.5s | 3.6s | 6.5s | 6.5s |
| A Link to the Past | 6.5s | 9.4s | 0.6s | 5.8s | 8.7s | 8.7s |
| A Short Hike | 3.2s | 6.4s | 0.6s | 3.3s | 5.7s | 5.7s |
| APQuest | 3.0s | 6.2s | 0.6s | 3.0s | 5.7s | 5.7s |
| Adventure | 2.8s | 7.4s | 0.5s | 2.8s | 5.7s | 5.7s |
| Aquaria | 4.4s | 7.3s | 0.6s | 3.5s | 5.7s | 5.7s |
| Baking Adventure | 2.8s | 6.5s | 0.5s | 2.8s | 5.6s | 5.7s |
| Bumper Stickers | 2.8s | 9.9s | 0.5s | 2.8s | 5.5s | 5.6s |
| Castlevania - Circle of the Moon | 3.1s | 6.9s | 0.6s | 3.2s | 5.7s | 5.7s |
| Castlevania 64 | 3.5s | 8.8s | 0.6s | 3.5s | 5.7s | 5.7s |
| Celeste 64 | 2.9s | 5.5s | 0.5s | 3.0s | 5.5s | 5.5s |
| ChecksFinder | 2.9s | 5.8s | 0.5s | 2.9s | 5.6s | 5.7s |
| Choo-Choo Charles | 3.3s | 7.8s | 0.6s | 3.3s | 7.8s | 7.8s |
| Civilization VI | 8.5s | 5.8s | 0.6s | 3.1s | 5.7s | 5.7s |
| Coding Adventure | 2.8s | 5.7s | 0.5s | 2.8s | 5.7s | 5.7s |
| DLCQuest | 3.4s | 5.8s | 0.6s | 2.6s | - | - |
| DOOM 1993 | 3.4s | 6.7s | 0.5s | 3.2s | 6.7s | 6.7s |
| DOOM II | 3.3s | 7.5s | 0.5s | 3.2s | 7.6s | 7.6s |
| Dark Souls III | 3.9s | 18.9s | 0.6s | 4.0s | 19.7s | 18.7s |
| Donkey Kong Country 3 | 3.2s | 6.8s | 0.6s | 3.2s | 5.7s | 5.7s |
| EarthBound | 3.7s | 5.5s | 0.5s | 3.5s | 5.5s | 5.5s |
| Factorio | 3.5s | 5.7s | 0.6s | 3.3s | 5.7s | 5.7s |
| Faxanadu | 3.2s | 5.7s | 0.6s | 3.1s | 5.7s | 5.8s |
| Final Fantasy Mystic Quest | 3.7s | 6.7s | 0.6s | 3.5s | 6.7s | 7.8s |
| Heretic | 3.6s | 7.7s | 0.5s | 3.3s | 7.7s | 7.7s |
| Hylics 2 | 3.5s | 5.7s | 0.6s | 3.1s | 5.8s | 5.7s |
| Inscryption | 3.0s | 5.6s | 0.5s | 3.0s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.1s | 5.5s | 0.5s | 3.0s | 5.5s | 5.5s |
| Links Awakening DX | 6.1s | 8.7s | 0.6s | 3.9s | 8.7s | 8.7s |
| Lufia II Ancient Cave | 3.3s | 5.8s | 0.6s | 3.2s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 7.7s | 0.5s | 4.1s | 7.5s | 7.5s |
| Math Adventure | 2.9s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Mega Man 2 | 3.2s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 3.3s | 5.7s | 0.6s | 3.2s | 5.8s | 5.7s |
| Meritous | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.7s |
| Metamath | 11.5s | 5.8s | 0.6s | 3.0s | 5.7s | 5.7s |
| Muse Dash | 3.1s | 5.7s | 0.5s | 3.1s | 5.7s | 5.7s |
| Noita | 2.8s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| Old School Runescape | 4.2s | 5.7s | 0.6s | 3.9s | 5.7s | 5.7s |
| Overcooked! 2 | 3.4s | 7.7s | 0.6s | 2.5s | - | - |
| Paint | 2.9s | 5.5s | 0.5s | 3.0s | 5.5s | 5.5s |
| Risk of Rain 2 | 3.4s | 5.7s | 0.6s | 2.5s | - | - |
| Satisfactory | 5.0s | 21.9s | 0.6s | 3.9s | 21.8s | 21.8s |
| Saving Princess | 3.1s | 5.7s | 0.5s | 3.2s | 5.7s | 5.7s |
| Shivers | 3.1s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| Sonic Adventure 2 Battle | 4.7s | 5.8s | 0.6s | 4.3s | 5.7s | 5.8s |
| Subnautica | 3.2s | 7.7s | 0.5s | 3.4s | 7.7s | 7.7s |
| Super Mario 64 | 3.1s | 5.5s | 0.5s | 3.0s | 5.5s | 5.5s |
| Super Mario Land 2 | 3.7s | 5.8s | 0.6s | 3.8s | 5.7s | 5.8s |
| Super Mario World | 4.6s | 5.7s | 0.6s | 3.4s | 5.7s | 5.7s |
| TOEM original | 2.8s | 5.5s | 0.5s | 2.7s | 5.5s | 5.5s |
| TOEM rule builder | 2.9s | 5.7s | 0.5s | 3.0s | 5.6s | 5.7s |
| Terraria | 3.3s | 7.8s | 0.6s | 3.3s | 7.7s | 7.8s |
| The Legend of Zelda | 3.9s | 5.7s | 0.6s | 3.4s | 5.8s | 5.8s |
| The Messenger | 3.2s | 9.8s | 0.5s | 3.2s | 9.8s | 9.8s |
| The Wind Waker | 5.7s | 5.8s | 0.6s | 6.0s | 5.7s | 5.7s |
| Timespinner | 4.0s | 5.8s | 0.6s | 3.8s | 5.7s | 5.7s |
| Undertale | 2.9s | 5.5s | 0.5s | 2.9s | 5.5s | 5.5s |
| VVVVVV | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Wargroove | 3.1s | 5.7s | 0.6s | 3.0s | 5.7s | 5.7s |
| Yoshi's Island | 3.8s | 6.5s | 0.5s | 3.7s | 5.5s | 5.5s |
| shapez | 3.8s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.5s |
| 2 | Civilization VI | 8.5s |
| 3 | A Link to the Past | 6.5s |
| 4 | Links Awakening DX | 6.1s |
| 5 | The Wind Waker | 5.7s |
| 6 | Satisfactory | 5.0s |
| 7 | Sonic Adventure 2 Battle | 4.7s |
| 8 | Super Mario World | 4.6s |
| 9 | Aquaria | 4.4s |
| 10 | Old School Runescape | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.9s |
| 2 | Dark Souls III | 18.9s |
| 3 | A Hat in Time | 11.5s |
| 4 | Bumper Stickers | 9.9s |
| 5 | The Messenger | 9.8s |
| 6 | A Link to the Past | 9.4s |
| 7 | Castlevania 64 | 8.8s |
| 8 | Links Awakening DX | 8.7s |
| 9 | Choo-Choo Charles | 7.8s |
| 10 | Terraria | 7.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 0.6s |
| 2 | Dark Souls III | 0.6s |
| 3 | Choo-Choo Charles | 0.6s |
| 4 | DLCQuest | 0.6s |
| 5 | Sonic Adventure 2 Battle | 0.6s |
| 6 | The Wind Waker | 0.6s |
| 7 | A Link to the Past | 0.6s |
| 8 | Aquaria | 0.6s |
| 9 | Super Mario Land 2 | 0.6s |
| 10 | The Legend of Zelda | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 6.0s |
| 2 | A Link to the Past | 5.8s |
| 3 | Sonic Adventure 2 Battle | 4.3s |
| 4 | Mario & Luigi Superstar Saga | 4.1s |
| 5 | Dark Souls III | 4.0s |
| 6 | Satisfactory | 3.9s |
| 7 | Old School Runescape | 3.9s |
| 8 | Links Awakening DX | 3.9s |
| 9 | Super Mario Land 2 | 3.8s |
| 10 | Timespinner | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 19.7s |
| 3 | The Messenger | 9.8s |
| 4 | Links Awakening DX | 8.7s |
| 5 | A Link to the Past | 8.7s |
| 6 | Choo-Choo Charles | 7.8s |
| 7 | Terraria | 7.7s |
| 8 | Subnautica | 7.7s |
| 9 | Heretic | 7.7s |
| 10 | DOOM II | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.7s |
| 3 | The Messenger | 9.8s |
| 4 | Links Awakening DX | 8.7s |
| 5 | A Link to the Past | 8.7s |
| 6 | Choo-Choo Charles | 7.8s |
| 7 | Final Fantasy Mystic Quest | 7.8s |
| 8 | Terraria | 7.8s |
| 9 | Heretic | 7.7s |
| 10 | Subnautica | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 224.4s | 432.0s | 33.6s | 204.6s | 390.2s | 529.8s |
| Average | 3.6s | 7.0s | 0.5s | 3.3s | 6.6s | 9.0s |
| Max | 9.8s | 21.9s | 0.6s | 6.3s | 21.9s | 33.0s |
| Min | 2.7s | 5.6s | 0.5s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (9.8s) | Satisfactory (21.9s) | A Link to the Past (0.6s) | A Link to the Past (6.3s) | Satisfactory (21.9s) | Dark Souls III (33.0s) |
| Fastest | APQuest (2.7s) | Saving Princess (5.6s) | Saving Princess (0.5s) | DLCQuest (2.5s) | APQuest (5.6s) | APQuest (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 3.9s | 8.3s | 0.5s | 3.6s | 6.7s | 6.7s |
| A Link to the Past | 6.6s | 11.1s | 0.6s | 6.3s | 9.9s | 14.8s |
| A Short Hike | 2.9s | 9.0s | 0.5s | 3.0s | 5.7s | 5.7s |
| APQuest | 2.7s | 8.5s | 0.5s | 2.7s | 5.6s | 5.6s |
| Adventure | 2.8s | 6.7s | 0.5s | 2.9s | 5.8s | 5.7s |
| Aquaria | 4.0s | 8.0s | 0.5s | 3.2s | 5.7s | 5.7s |
| Baking Adventure | 2.8s | 7.2s | 0.6s | 2.9s | 5.7s | 5.7s |
| Bumper Stickers | 2.9s | 8.3s | 0.5s | 2.9s | 5.7s | 14.3s |
| Castlevania - Circle of the Moon | 3.7s | 7.0s | 0.6s | 3.2s | 5.7s | 5.7s |
| Castlevania 64 | 3.3s | 8.7s | 0.5s | 3.4s | 5.7s | 5.7s |
| Celeste 64 | 2.8s | 5.6s | 0.5s | 3.0s | 5.7s | 14.3s |
| ChecksFinder | 3.0s | 5.8s | 0.5s | 3.1s | 5.7s | 5.8s |
| Choo-Choo Charles | 3.0s | 7.7s | 0.5s | 3.0s | 7.7s | 7.7s |
| Civilization VI | 8.0s | 5.7s | 0.5s | 2.8s | 5.7s | 14.3s |
| Coding Adventure | 2.8s | 5.8s | 0.5s | 2.8s | 5.7s | 5.7s |
| DLCQuest | 3.0s | 5.7s | 0.5s | 2.5s | - | - |
| DOOM 1993 | 3.3s | 6.7s | 0.5s | 3.3s | 6.7s | 14.6s |
| DOOM II | 3.5s | 7.7s | 0.5s | 3.3s | 7.7s | 14.4s |
| Dark Souls III | 4.2s | 18.8s | 0.6s | 4.0s | 17.8s | 33.0s |
| Donkey Kong Country 3 | 3.0s | 5.7s | 0.5s | 3.2s | 5.7s | 14.4s |
| EarthBound | 3.6s | 5.7s | 0.5s | 3.4s | 5.7s | 5.7s |
| Factorio | 3.8s | 5.8s | 0.6s | 3.8s | 5.8s | 5.7s |
| Faxanadu | 2.9s | 5.7s | 0.5s | 2.9s | 5.7s | 14.4s |
| Final Fantasy Mystic Quest | 3.4s | 6.8s | 0.5s | 3.2s | 6.8s | 6.7s |
| Heretic | 3.3s | 7.7s | 0.5s | 3.5s | 7.7s | 14.5s |
| Hylics 2 | 3.1s | 5.6s | 0.5s | 2.9s | 5.6s | 5.7s |
| Inscryption | 2.9s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.2s | 5.7s | 0.5s | 3.1s | 5.7s | 5.7s |
| Links Awakening DX | 6.4s | 8.8s | 0.6s | 4.1s | 8.7s | 8.7s |
| Lufia II Ancient Cave | 3.1s | 5.8s | 0.5s | 3.2s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 7.7s | 0.6s | 4.2s | 7.7s | 7.7s |
| Math Adventure | 3.0s | 5.8s | 0.6s | 3.0s | 5.7s | 5.7s |
| Mega Man 2 | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 3.0s | 5.7s | 0.5s | 2.8s | 5.6s | 14.3s |
| Meritous | 2.8s | 5.6s | 0.5s | 2.8s | 5.7s | 5.7s |
| Metamath | 9.8s | 5.7s | 0.5s | 2.8s | 5.6s | 5.7s |
| Muse Dash | 3.1s | 5.7s | 0.5s | 3.1s | 5.7s | 5.7s |
| Noita | 2.9s | 5.8s | 0.5s | 3.0s | 5.7s | 5.7s |
| Old School Runescape | 4.5s | 5.7s | 0.6s | 3.7s | 5.7s | 5.7s |
| Overcooked! 2 | 3.4s | 7.7s | 0.6s | 2.8s | - | - |
| Paint | 2.8s | 5.8s | 0.5s | 3.0s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.5s | 5.9s | 0.6s | 2.8s | - | - |
| Satisfactory | 4.7s | 21.9s | 0.6s | 4.4s | 21.9s | 17.9s |
| Saving Princess | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Shivers | 3.0s | 5.7s | 0.5s | 3.1s | 5.7s | 14.4s |
| Sonic Adventure 2 Battle | 4.2s | 5.7s | 0.5s | 4.0s | 5.7s | 14.3s |
| Subnautica | 3.3s | 7.7s | 0.5s | 3.5s | 7.7s | 14.4s |
| Super Mario 64 | 3.3s | 5.7s | 0.5s | 3.2s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.9s | 5.7s | 0.6s | 4.3s | 5.8s | 5.8s |
| Super Mario World | 4.5s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| TOEM original | 2.8s | 5.7s | 0.5s | 2.8s | 5.7s | 5.7s |
| TOEM rule builder | 3.0s | 5.8s | 0.6s | 3.2s | 5.8s | 5.7s |
| Terraria | 3.0s | 7.8s | 0.5s | 3.0s | 7.7s | 7.7s |
| The Legend of Zelda | 3.6s | 5.7s | 0.6s | 2.9s | 5.7s | 14.3s |
| The Messenger | 3.1s | 9.8s | 0.5s | 3.2s | 9.8s | 9.8s |
| The Wind Waker | 5.1s | 5.7s | 0.5s | 5.4s | 5.7s | 14.3s |
| Timespinner | 4.0s | 5.7s | 0.6s | 4.0s | 5.7s | 5.7s |
| Undertale | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| VVVVVV | 3.1s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Wargroove | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Yoshi's Island | 3.8s | 5.7s | 0.5s | 3.7s | 5.7s | 5.7s |
| shapez | 4.0s | 5.7s | 0.6s | 3.5s | 5.7s | 14.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 9.8s |
| 2 | Civilization VI | 8.0s |
| 3 | A Link to the Past | 6.6s |
| 4 | Links Awakening DX | 6.4s |
| 5 | The Wind Waker | 5.1s |
| 6 | Satisfactory | 4.7s |
| 7 | Super Mario World | 4.5s |
| 8 | Old School Runescape | 4.5s |
| 9 | Sonic Adventure 2 Battle | 4.2s |
| 10 | Dark Souls III | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.9s |
| 2 | Dark Souls III | 18.8s |
| 3 | A Link to the Past | 11.1s |
| 4 | The Messenger | 9.8s |
| 5 | A Short Hike | 9.0s |
| 6 | Links Awakening DX | 8.8s |
| 7 | Castlevania 64 | 8.7s |
| 8 | APQuest | 8.5s |
| 9 | A Hat in Time | 8.3s |
| 10 | Bumper Stickers | 8.3s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.6s |
| 2 | Super Mario Land 2 | 0.6s |
| 3 | Dark Souls III | 0.6s |
| 4 | Satisfactory | 0.6s |
| 5 | Math Adventure | 0.6s |
| 6 | TOEM rule builder | 0.6s |
| 7 | Factorio | 0.6s |
| 8 | shapez | 0.6s |
| 9 | Baking Adventure | 0.6s |
| 10 | Castlevania - Circle of the Moon | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.3s |
| 2 | The Wind Waker | 5.4s |
| 3 | Satisfactory | 4.4s |
| 4 | Super Mario Land 2 | 4.3s |
| 5 | Mario & Luigi Superstar Saga | 4.2s |
| 6 | Links Awakening DX | 4.1s |
| 7 | Timespinner | 4.0s |
| 8 | Sonic Adventure 2 Battle | 4.0s |
| 9 | Dark Souls III | 4.0s |
| 10 | Factorio | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.9s |
| 2 | Dark Souls III | 17.8s |
| 3 | A Link to the Past | 9.9s |
| 4 | The Messenger | 9.8s |
| 5 | Links Awakening DX | 8.7s |
| 6 | Choo-Choo Charles | 7.7s |
| 7 | Heretic | 7.7s |
| 8 | DOOM II | 7.7s |
| 9 | Terraria | 7.7s |
| 10 | Subnautica | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 33.0s |
| 2 | Satisfactory | 17.9s |
| 3 | A Link to the Past | 14.8s |
| 4 | DOOM 1993 | 14.6s |
| 5 | Heretic | 14.5s |
| 6 | shapez | 14.5s |
| 7 | DOOM II | 14.4s |
| 8 | Faxanadu | 14.4s |
| 9 | Subnautica | 14.4s |
| 10 | Donkey Kong Country 3 | 14.4s |
