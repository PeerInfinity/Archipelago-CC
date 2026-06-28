# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-06-28 01:28:50 UTC

**Source Data Created:** 2026-06-28 01:28:50

**Source Data Last Updated:** 2026-06-28 01:28:50

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

**Total Templates:** 55

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 55 | 0 | 55 |
| Original Spoiler Test | 55 | 0 | 55 |
| Stage 1: World Generation | 55 | 0 | 55 |
| Stage 2: Seed Generation | 55 | 0 | 55 |
| Stage 3: Rules Comparison | 32 | 23 | 55 |
| Stage 4: WorldGen Spoiler Test | 52 | 3 | 55 |
| Stage 5: Cross-Validation | 49 | 6 | 55 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| APCalc | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| APQuest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Baking Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Coding Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DepGraph | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| EarthBound | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 55

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 55 | 0 | 55 |
| Original Spoiler Test | 55 | 0 | 55 |
| Stage 1: World Generation | 55 | 0 | 55 |
| Stage 2: Seed Generation | 55 | 0 | 55 |
| Stage 3: Rules Comparison | 0 | 55 | 55 |
| Stage 4: WorldGen Spoiler Test | 52 | 3 | 55 |
| Stage 5: Cross-Validation | 36 | 19 | 55 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| APCalc | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
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
| DepGraph | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| EarthBound | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
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
| Total | 219.3s | 402.7s | 31.9s | 193.1s | 407.8s | 430.3s |
| Average | 4.0s | 7.3s | 0.6s | 3.5s | 7.4s | 7.8s |
| Max | 10.8s | 15.9s | 2.7s | 5.8s | 21.0s | 21.1s |
| Min | 2.9s | 5.7s | 0.5s | 2.9s | 5.7s | 5.8s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.8s) | Links Awakening DX (15.9s) | A Link to the Past (2.7s) | The Wind Waker (5.8s) | Super Mario Land 2 (21.0s) | Super Mario Land 2 (21.1s) |
| Fastest | TOEM original (2.9s) | Metamath (5.7s) | VVVVVV (0.5s) | VVVVVV (2.9s) | VVVVVV (5.7s) | VVVVVV (5.8s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.0s | 9.4s | 0.6s | 4.6s | 8.9s | 8.9s |
| A Link to the Past | 6.8s | 14.2s | 2.7s | 5.8s | 12.8s | 12.8s |
| A Short Hike | 3.6s | 7.9s | 0.5s | 3.2s | 5.8s | 5.8s |
| APCalc | 3.5s | 10.1s | 0.5s | 3.2s | 6.8s | 14.7s |
| APQuest | 3.5s | 6.5s | 0.6s | 2.9s | 5.8s | 5.8s |
| Adventure | 3.8s | 6.5s | 0.5s | 3.4s | 5.9s | 5.8s |
| Aquaria | 4.7s | 9.6s | 0.5s | 3.5s | 6.8s | 6.8s |
| Baking Adventure | 3.3s | 7.4s | 0.5s | 3.0s | 5.8s | 5.8s |
| Bumper Stickers | 3.6s | 7.1s | 0.5s | 3.4s | 5.8s | 5.8s |
| Castlevania - Circle of the Moon | 3.7s | 7.5s | 0.5s | 3.2s | 5.8s | 5.8s |
| Castlevania 64 | 4.1s | 6.0s | 0.6s | 4.1s | 5.9s | 5.9s |
| Celeste 64 | 3.1s | 5.9s | 0.5s | 3.1s | 5.7s | 5.8s |
| ChecksFinder | 3.0s | 5.8s | 0.5s | 2.9s | 5.8s | 5.8s |
| Choo-Choo Charles | 3.1s | 9.8s | 0.5s | 3.2s | 9.8s | 9.8s |
| Civilization VI | 8.4s | 5.8s | 0.6s | 3.1s | 5.8s | 5.8s |
| Coding Adventure | 3.1s | 5.9s | 0.5s | 3.1s | 5.9s | 5.9s |
| DLCQuest | 3.5s | 5.8s | 0.5s | 3.1s | 5.8s | 5.8s |
| DepGraph | 3.3s | 10.9s | 0.6s | 3.4s | 9.9s | 14.8s |
| EarthBound | 4.1s | 6.8s | 0.5s | 4.2s | 6.8s | 6.8s |
| Factorio | 3.7s | 6.8s | 0.5s | 3.4s | 6.8s | 6.8s |
| Faxanadu | 3.5s | 5.9s | 0.6s | 3.5s | 5.8s | 5.8s |
| Final Fantasy Mystic Quest | 3.6s | 8.8s | 0.5s | 3.5s | 8.8s | 8.8s |
| Hylics 2 | 3.5s | 5.8s | 0.5s | 3.3s | 5.8s | 5.8s |
| Inscryption | 3.1s | 5.9s | 0.5s | 3.1s | 5.8s | 5.8s |
| Landstalker - The Treasures of King Nole | 3.6s | 6.8s | 0.6s | 3.2s | 6.8s | 6.8s |
| Links Awakening DX | 6.4s | 15.9s | 0.6s | 4.1s | 15.9s | 16.0s |
| Lufia II Ancient Cave | 3.3s | 5.8s | 0.5s | 3.2s | 5.8s | 5.8s |
| Mario & Luigi Superstar Saga | 3.9s | 9.0s | 0.6s | 4.4s | 9.9s | 9.9s |
| Mega Man 2 | 3.5s | 5.9s | 0.5s | 3.4s | 5.8s | 5.8s |
| MegaMan Battle Network 3 | 3.4s | 6.8s | 0.6s | 3.2s | 6.8s | 6.9s |
| Meritous | 3.3s | 5.8s | 0.6s | 3.2s | 5.8s | 5.9s |
| Metamath | 10.8s | 5.7s | 0.5s | 3.0s | 5.7s | 14.5s |
| Noita | 3.3s | 6.0s | 0.5s | 3.2s | 5.8s | 5.8s |
| Old School Runescape | 3.8s | 5.8s | 0.5s | 3.6s | 5.8s | 5.8s |
| Overcooked! 2 | 3.5s | 7.9s | 0.6s | 3.3s | 7.8s | 8.8s |
| Risk of Rain 2 | 3.8s | 6.0s | 0.5s | 3.7s | 5.9s | 5.9s |
| Saving Princess | 3.2s | 5.8s | 0.5s | 3.1s | 5.8s | 5.8s |
| Shivers | 3.5s | 6.9s | 0.6s | 3.4s | 6.8s | 6.8s |
| Sonic Adventure 2 Battle | 5.2s | 6.9s | 0.6s | 4.8s | 6.8s | 6.8s |
| Subnautica | 3.5s | 10.0s | 0.6s | 3.7s | 10.0s | 9.8s |
| Super Mario 64 | 3.8s | 5.9s | 0.5s | 3.8s | 5.9s | 5.8s |
| Super Mario Land 2 | 3.6s | 11.9s | 0.6s | 3.8s | 21.0s | 21.1s |
| Super Mario World | 4.6s | 5.8s | 0.5s | 3.5s | 5.8s | 5.8s |
| TOEM original | 2.9s | 5.8s | 0.5s | 2.9s | 5.8s | 5.8s |
| TOEM rule builder | 3.3s | 5.8s | 0.5s | 3.0s | 5.8s | 5.8s |
| Terraria | 3.4s | 9.9s | 0.6s | 3.4s | 15.0s | 14.9s |
| The Legend of Zelda | 3.9s | 6.8s | 0.6s | 3.2s | 5.8s | 5.8s |
| The Messenger | 3.4s | 8.9s | 0.5s | 3.3s | 8.9s | 8.9s |
| The Wind Waker | 5.9s | 6.8s | 0.5s | 5.8s | 6.8s | 6.8s |
| Timespinner | 4.2s | 5.8s | 0.6s | 4.0s | 14.8s | 14.8s |
| Undertale | 3.6s | 5.8s | 0.5s | 3.4s | 5.8s | 5.8s |
| VVVVVV | 3.0s | 5.8s | 0.5s | 2.9s | 5.7s | 5.8s |
| Wargroove | 3.2s | 5.8s | 0.6s | 3.1s | 5.8s | 5.8s |
| Yoshi's Island | 3.9s | 6.8s | 0.5s | 4.0s | 6.8s | 6.8s |
| shapez | 3.9s | 5.8s | 0.6s | 3.5s | 5.8s | 5.8s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.8s |
| 2 | Civilization VI | 8.4s |
| 3 | A Link to the Past | 6.8s |
| 4 | Links Awakening DX | 6.4s |
| 5 | The Wind Waker | 5.9s |
| 6 | Sonic Adventure 2 Battle | 5.2s |
| 7 | A Hat in Time | 5.0s |
| 8 | Aquaria | 4.7s |
| 9 | Super Mario World | 4.6s |
| 10 | Timespinner | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Links Awakening DX | 15.9s |
| 2 | A Link to the Past | 14.2s |
| 3 | Super Mario Land 2 | 11.9s |
| 4 | DepGraph | 10.9s |
| 5 | APCalc | 10.1s |
| 6 | Subnautica | 10.0s |
| 7 | Terraria | 9.9s |
| 8 | Choo-Choo Charles | 9.8s |
| 9 | Aquaria | 9.6s |
| 10 | A Hat in Time | 9.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 2.7s |
| 2 | Links Awakening DX | 0.6s |
| 3 | Mario & Luigi Superstar Saga | 0.6s |
| 4 | APQuest | 0.6s |
| 5 | Civilization VI | 0.6s |
| 6 | Faxanadu | 0.6s |
| 7 | Terraria | 0.6s |
| 8 | Timespinner | 0.6s |
| 9 | A Hat in Time | 0.6s |
| 10 | Castlevania 64 | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 5.8s |
| 2 | A Link to the Past | 5.8s |
| 3 | Sonic Adventure 2 Battle | 4.8s |
| 4 | A Hat in Time | 4.6s |
| 5 | Mario & Luigi Superstar Saga | 4.4s |
| 6 | EarthBound | 4.2s |
| 7 | Links Awakening DX | 4.1s |
| 8 | Castlevania 64 | 4.1s |
| 9 | Timespinner | 4.0s |
| 10 | Yoshi's Island | 4.0s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Super Mario Land 2 | 21.0s |
| 2 | Links Awakening DX | 15.9s |
| 3 | Terraria | 15.0s |
| 4 | Timespinner | 14.8s |
| 5 | A Link to the Past | 12.8s |
| 6 | Subnautica | 10.0s |
| 7 | Mario & Luigi Superstar Saga | 9.9s |
| 8 | DepGraph | 9.9s |
| 9 | Choo-Choo Charles | 9.8s |
| 10 | The Messenger | 8.9s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Mario Land 2 | 21.1s |
| 2 | Links Awakening DX | 16.0s |
| 3 | Terraria | 14.9s |
| 4 | DepGraph | 14.8s |
| 5 | Timespinner | 14.8s |
| 6 | APCalc | 14.7s |
| 7 | Metamath | 14.5s |
| 8 | A Link to the Past | 12.8s |
| 9 | Mario & Luigi Superstar Saga | 9.9s |
| 10 | Choo-Choo Charles | 9.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 218.9s | 405.8s | 31.8s | 193.9s | 408.4s | 532.2s |
| Average | 4.0s | 7.4s | 0.6s | 3.5s | 7.4s | 9.7s |
| Max | 10.7s | 15.9s | 2.8s | 6.3s | 21.1s | 21.2s |
| Min | 2.9s | 5.8s | 0.5s | 3.0s | 5.8s | 5.8s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.7s) | Links Awakening DX (15.9s) | A Link to the Past (2.8s) | A Link to the Past (6.3s) | Super Mario Land 2 (21.1s) | Super Mario Land 2 (21.2s) |
| Fastest | ChecksFinder (2.9s) | Mega Man 2 (5.8s) | Wargroove (0.5s) | ChecksFinder (3.0s) | Castlevania - Circle of the Moon (5.8s) | VVVVVV (5.8s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.8s | 11.4s | 0.6s | 4.2s | 7.9s | 7.9s |
| A Link to the Past | 7.2s | 15.0s | 2.8s | 6.3s | 13.9s | 18.0s |
| A Short Hike | 3.5s | 6.5s | 0.5s | 3.2s | 5.8s | 5.8s |
| APCalc | 3.6s | 7.9s | 0.5s | 3.2s | 6.9s | 15.1s |
| APQuest | 3.3s | 6.8s | 0.5s | 3.0s | 5.8s | 5.8s |
| Adventure | 3.6s | 6.9s | 0.5s | 3.2s | 5.8s | 5.8s |
| Aquaria | 5.2s | 8.2s | 0.6s | 3.8s | 6.8s | 7.9s |
| Baking Adventure | 3.6s | 9.6s | 0.5s | 3.3s | 5.8s | 5.8s |
| Bumper Stickers | 3.3s | 10.1s | 0.5s | 3.1s | 5.8s | 14.6s |
| Castlevania - Circle of the Moon | 3.6s | 6.3s | 0.5s | 3.2s | 5.8s | 5.8s |
| Castlevania 64 | 3.8s | 6.0s | 0.5s | 3.8s | 5.8s | 5.8s |
| Celeste 64 | 3.3s | 6.0s | 0.5s | 3.2s | 5.8s | 14.7s |
| ChecksFinder | 2.9s | 5.8s | 0.5s | 3.0s | 5.8s | 5.8s |
| Choo-Choo Charles | 3.3s | 9.9s | 0.5s | 3.2s | 9.8s | 9.8s |
| Civilization VI | 8.3s | 5.8s | 0.5s | 3.1s | 5.8s | 14.9s |
| Coding Adventure | 3.0s | 5.8s | 0.5s | 3.0s | 5.8s | 5.8s |
| DLCQuest | 3.8s | 5.8s | 0.5s | 3.4s | 5.8s | 5.8s |
| DepGraph | 3.6s | 10.9s | 0.6s | 3.6s | 9.9s | 14.9s |
| EarthBound | 3.8s | 6.8s | 0.5s | 3.7s | 6.8s | 6.8s |
| Factorio | 3.9s | 6.8s | 0.5s | 3.4s | 6.8s | 6.8s |
| Faxanadu | 3.3s | 5.9s | 0.6s | 3.3s | 5.8s | 14.8s |
| Final Fantasy Mystic Quest | 3.9s | 8.8s | 0.5s | 3.9s | 8.9s | 8.8s |
| Hylics 2 | 3.4s | 5.8s | 0.5s | 3.2s | 5.8s | 5.8s |
| Inscryption | 3.3s | 5.9s | 0.5s | 3.2s | 5.8s | 5.8s |
| Landstalker - The Treasures of King Nole | 3.2s | 6.8s | 0.5s | 3.2s | 6.8s | 6.8s |
| Links Awakening DX | 6.2s | 15.9s | 0.6s | 4.0s | 15.9s | 15.9s |
| Lufia II Ancient Cave | 3.7s | 5.9s | 0.5s | 3.6s | 5.8s | 5.8s |
| Mario & Luigi Superstar Saga | 4.3s | 9.8s | 0.6s | 4.7s | 9.9s | 9.9s |
| Mega Man 2 | 3.2s | 5.8s | 0.5s | 3.1s | 5.8s | 5.8s |
| MegaMan Battle Network 3 | 3.3s | 6.8s | 0.5s | 3.2s | 6.8s | 14.7s |
| Meritous | 3.1s | 5.8s | 0.5s | 3.1s | 5.8s | 5.8s |
| Metamath | 10.7s | 5.8s | 0.5s | 3.0s | 5.8s | 14.6s |
| Noita | 3.1s | 5.8s | 0.5s | 3.1s | 5.8s | 5.8s |
| Old School Runescape | 4.0s | 5.9s | 0.5s | 3.9s | 5.8s | 5.8s |
| Overcooked! 2 | 3.4s | 7.8s | 0.5s | 3.4s | 8.9s | 14.8s |
| Risk of Rain 2 | 3.7s | 5.8s | 0.5s | 3.7s | 5.8s | 5.8s |
| Saving Princess | 3.5s | 5.8s | 0.5s | 3.4s | 5.8s | 5.8s |
| Shivers | 3.8s | 6.8s | 0.6s | 3.8s | 6.8s | 14.8s |
| Sonic Adventure 2 Battle | 4.6s | 6.8s | 0.5s | 4.2s | 6.8s | 14.7s |
| Subnautica | 3.5s | 9.8s | 0.5s | 3.6s | 9.8s | 14.7s |
| Super Mario 64 | 3.5s | 5.9s | 0.5s | 3.5s | 5.9s | 5.8s |
| Super Mario Land 2 | 3.8s | 11.9s | 0.6s | 3.9s | 21.1s | 21.2s |
| Super Mario World | 4.5s | 5.8s | 0.5s | 3.4s | 5.8s | 5.8s |
| TOEM original | 3.1s | 5.8s | 0.6s | 3.0s | 5.8s | 5.8s |
| TOEM rule builder | 3.0s | 5.8s | 0.5s | 3.0s | 5.8s | 5.8s |
| Terraria | 3.3s | 9.9s | 0.5s | 3.3s | 14.8s | 14.9s |
| The Legend of Zelda | 4.2s | 6.8s | 0.6s | 3.4s | 5.8s | 15.0s |
| The Messenger | 3.9s | 9.0s | 0.6s | 3.8s | 9.0s | 9.0s |
| The Wind Waker | 5.6s | 6.8s | 0.5s | 5.6s | 6.8s | 14.7s |
| Timespinner | 4.0s | 6.0s | 0.5s | 3.9s | 14.7s | 14.8s |
| Undertale | 3.4s | 5.9s | 0.6s | 3.3s | 5.8s | 5.8s |
| VVVVVV | 3.1s | 5.9s | 0.5s | 3.0s | 5.8s | 5.8s |
| Wargroove | 3.1s | 5.8s | 0.5s | 3.1s | 5.8s | 5.8s |
| Yoshi's Island | 4.1s | 6.8s | 0.6s | 4.0s | 6.8s | 6.8s |
| shapez | 3.8s | 5.8s | 0.5s | 3.4s | 5.8s | 14.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.7s |
| 2 | Civilization VI | 8.3s |
| 3 | A Link to the Past | 7.2s |
| 4 | Links Awakening DX | 6.2s |
| 5 | The Wind Waker | 5.6s |
| 6 | Aquaria | 5.2s |
| 7 | A Hat in Time | 4.8s |
| 8 | Sonic Adventure 2 Battle | 4.6s |
| 9 | Super Mario World | 4.5s |
| 10 | Mario & Luigi Superstar Saga | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Links Awakening DX | 15.9s |
| 2 | A Link to the Past | 15.0s |
| 3 | Super Mario Land 2 | 11.9s |
| 4 | A Hat in Time | 11.4s |
| 5 | DepGraph | 10.9s |
| 6 | Bumper Stickers | 10.1s |
| 7 | Choo-Choo Charles | 9.9s |
| 8 | Terraria | 9.9s |
| 9 | Mario & Luigi Superstar Saga | 9.8s |
| 10 | Subnautica | 9.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 2.8s |
| 2 | Mario & Luigi Superstar Saga | 0.6s |
| 3 | Shivers | 0.6s |
| 4 | Super Mario Land 2 | 0.6s |
| 5 | The Legend of Zelda | 0.6s |
| 6 | Undertale | 0.6s |
| 7 | A Hat in Time | 0.6s |
| 8 | Aquaria | 0.6s |
| 9 | Faxanadu | 0.6s |
| 10 | Links Awakening DX | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.3s |
| 2 | The Wind Waker | 5.6s |
| 3 | Mario & Luigi Superstar Saga | 4.7s |
| 4 | Sonic Adventure 2 Battle | 4.2s |
| 5 | A Hat in Time | 4.2s |
| 6 | Links Awakening DX | 4.0s |
| 7 | Yoshi's Island | 4.0s |
| 8 | Final Fantasy Mystic Quest | 3.9s |
| 9 | Super Mario Land 2 | 3.9s |
| 10 | Old School Runescape | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Super Mario Land 2 | 21.1s |
| 2 | Links Awakening DX | 15.9s |
| 3 | Terraria | 14.8s |
| 4 | Timespinner | 14.7s |
| 5 | A Link to the Past | 13.9s |
| 6 | DepGraph | 9.9s |
| 7 | Mario & Luigi Superstar Saga | 9.9s |
| 8 | Choo-Choo Charles | 9.8s |
| 9 | Subnautica | 9.8s |
| 10 | The Messenger | 9.0s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Mario Land 2 | 21.2s |
| 2 | A Link to the Past | 18.0s |
| 3 | Links Awakening DX | 15.9s |
| 4 | APCalc | 15.1s |
| 5 | The Legend of Zelda | 15.0s |
| 6 | Civilization VI | 14.9s |
| 7 | Terraria | 14.9s |
| 8 | DepGraph | 14.9s |
| 9 | Overcooked! 2 | 14.8s |
| 10 | Shivers | 14.8s |
