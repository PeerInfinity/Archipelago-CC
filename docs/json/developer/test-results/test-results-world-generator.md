# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-06-28 01:14:42 UTC

**Source Data Created:** 2026-06-28 01:14:42

**Source Data Last Updated:** 2026-06-28 01:14:42

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
| Original Spoiler Test | 0 | 55 | 55 |
| Stage 1: World Generation | 55 | 0 | 55 |
| Stage 2: Seed Generation | 55 | 0 | 55 |
| Stage 3: Rules Comparison | 32 | 23 | 55 |
| Stage 4: WorldGen Spoiler Test | 0 | 55 | 55 |
| Stage 5: Cross-Validation | 0 | 55 | 55 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| A Short Hike | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| APCalc | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| APQuest | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Adventure | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Aquaria | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Baking Adventure | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Bumper Stickers | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Castlevania - Circle of the Moon | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Castlevania 64 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Celeste 64 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| ChecksFinder | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Choo-Choo Charles | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Civilization VI | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Coding Adventure | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| DLCQuest | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| DepGraph | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| EarthBound | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Factorio | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Faxanadu | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Final Fantasy Mystic Quest | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Hylics 2 | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Inscryption | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Links Awakening DX | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Lufia II Ancient Cave | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Mario & Luigi Superstar Saga | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Mega Man 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| MegaMan Battle Network 3 | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Meritous | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Metamath | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Noita | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Old School Runescape | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Overcooked! 2 | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Risk of Rain 2 | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Saving Princess | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Sonic Adventure 2 Battle | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Subnautica | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Super Mario 64 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario Land 2 | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Super Mario World | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| TOEM original | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| TOEM rule builder | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Terraria | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| The Legend of Zelda | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| The Messenger | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| The Wind Waker | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Timespinner | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Undertale | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| VVVVVV | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Wargroove | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| Yoshi's Island | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |
| shapez | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Error |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 55

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 55 | 0 | 55 |
| Original Spoiler Test | 0 | 55 | 55 |
| Stage 1: World Generation | 55 | 0 | 55 |
| Stage 2: Seed Generation | 55 | 0 | 55 |
| Stage 3: Rules Comparison | 0 | 55 | 55 |
| Stage 4: WorldGen Spoiler Test | 0 | 55 | 55 |
| Stage 5: Cross-Validation | 0 | 55 | 55 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| A Link to the Past | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| A Short Hike | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| APCalc | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| APQuest | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Adventure | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Aquaria | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Baking Adventure | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Bumper Stickers | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Castlevania - Circle of the Moon | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Castlevania 64 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Celeste 64 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| ChecksFinder | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Choo-Choo Charles | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Civilization VI | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Coding Adventure | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| DLCQuest | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| DepGraph | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| EarthBound | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Factorio | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Faxanadu | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Final Fantasy Mystic Quest | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Hylics 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Inscryption | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Links Awakening DX | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Lufia II Ancient Cave | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Mario & Luigi Superstar Saga | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Mega Man 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| MegaMan Battle Network 3 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Meritous | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Metamath | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Noita | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Old School Runescape | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Overcooked! 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Risk of Rain 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Saving Princess | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Shivers | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Sonic Adventure 2 Battle | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Subnautica | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario 64 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario Land 2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario World | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| TOEM original | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| TOEM rule builder | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Terraria | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| The Legend of Zelda | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| The Messenger | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| The Wind Waker | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Timespinner | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Undertale | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| VVVVVV | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Wargroove | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| Yoshi's Island | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |
| shapez | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 219.3s | 5286.9s | 31.2s | 194.8s | 5265.8s | 5265.9s |
| Average | 4.0s | 96.1s | 0.6s | 3.5s | 95.7s | 95.7s |
| Max | 12.7s | 100.6s | 2.8s | 5.9s | 96.0s | 95.9s |
| Min | 2.8s | 95.4s | 0.5s | 2.8s | 95.4s | 95.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (12.7s) | Castlevania - Circle of the Moon (100.6s) | A Link to the Past (2.8s) | A Link to the Past (5.9s) | Aquaria (96.0s) | Sonic Adventure 2 Battle (95.9s) |
| Fastest | TOEM rule builder (2.8s) | Meritous (95.4s) | shapez (0.5s) | APQuest (2.8s) | Undertale (95.4s) | shapez (95.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.7s | 97.0s | 0.5s | 4.3s | 95.4s | 95.5s |
| A Link to the Past | 7.1s | 97.2s | 2.8s | 5.9s | 95.8s | 95.8s |
| A Short Hike | 3.6s | 96.4s | 0.6s | 3.2s | 95.8s | 95.8s |
| APCalc | 3.8s | 96.5s | 0.5s | 3.7s | 95.9s | 95.8s |
| APQuest | 3.1s | 97.6s | 0.5s | 2.8s | 95.5s | 95.5s |
| Adventure | 3.5s | 100.1s | 0.5s | 3.2s | 95.9s | 95.9s |
| Aquaria | 4.8s | 96.4s | 0.5s | 3.9s | 96.0s | 95.8s |
| Baking Adventure | 3.4s | 96.4s | 0.5s | 3.2s | 95.8s | 95.8s |
| Bumper Stickers | 3.5s | 99.8s | 0.5s | 3.3s | 95.9s | 95.9s |
| Castlevania - Circle of the Moon | 3.8s | 100.6s | 0.5s | 3.4s | 95.8s | 95.8s |
| Castlevania 64 | 3.9s | 95.4s | 0.5s | 4.1s | 95.5s | 95.5s |
| Celeste 64 | 3.3s | 95.9s | 0.5s | 3.1s | 95.8s | 95.8s |
| ChecksFinder | 2.9s | 95.8s | 0.5s | 3.1s | 95.8s | 95.8s |
| Choo-Choo Charles | 3.4s | 95.8s | 0.5s | 3.5s | 95.8s | 95.8s |
| Civilization VI | 7.4s | 95.4s | 0.5s | 3.0s | 95.5s | 95.4s |
| Coding Adventure | 3.0s | 95.8s | 0.5s | 3.1s | 95.9s | 95.8s |
| DLCQuest | 3.4s | 95.8s | 0.5s | 3.1s | 95.8s | 95.8s |
| DepGraph | 3.4s | 95.9s | 0.5s | 3.4s | 95.8s | 95.8s |
| EarthBound | 3.9s | 95.9s | 0.5s | 4.0s | 95.9s | 95.9s |
| Factorio | 4.0s | 95.8s | 0.5s | 3.5s | 95.8s | 95.8s |
| Faxanadu | 3.3s | 95.4s | 0.5s | 3.4s | 95.5s | 95.5s |
| Final Fantasy Mystic Quest | 3.9s | 95.9s | 0.6s | 3.6s | 95.8s | 95.8s |
| Hylics 2 | 3.4s | 95.8s | 0.5s | 3.4s | 95.8s | 95.8s |
| Inscryption | 3.4s | 95.8s | 0.5s | 3.4s | 95.8s | 95.8s |
| Landstalker - The Treasures of King Nole | 3.1s | 95.4s | 0.5s | 3.1s | 95.5s | 95.5s |
| Links Awakening DX | 6.1s | 95.9s | 0.6s | 3.8s | 95.9s | 95.8s |
| Lufia II Ancient Cave | 3.3s | 95.9s | 0.5s | 3.2s | 95.8s | 95.8s |
| Mario & Luigi Superstar Saga | 4.0s | 95.8s | 0.6s | 4.5s | 95.8s | 95.8s |
| Mega Man 2 | 3.3s | 95.9s | 0.5s | 3.3s | 95.9s | 95.9s |
| MegaMan Battle Network 3 | 3.5s | 95.8s | 0.5s | 3.3s | 95.8s | 95.8s |
| Meritous | 3.1s | 95.4s | 0.5s | 3.1s | 95.4s | 95.5s |
| Metamath | 12.7s | 95.8s | 0.5s | 3.0s | 95.8s | 95.8s |
| Noita | 3.2s | 95.9s | 0.5s | 3.2s | 95.8s | 95.8s |
| Old School Runescape | 4.3s | 95.8s | 0.5s | 4.0s | 95.8s | 95.8s |
| Overcooked! 2 | 3.2s | 95.5s | 0.5s | 3.2s | 95.5s | 95.5s |
| Risk of Rain 2 | 3.6s | 96.0s | 0.5s | 3.4s | 95.9s | 95.8s |
| Saving Princess | 3.3s | 95.9s | 0.5s | 3.1s | 95.8s | 95.8s |
| Shivers | 3.6s | 95.8s | 0.5s | 3.5s | 95.8s | 95.8s |
| Sonic Adventure 2 Battle | 4.9s | 95.8s | 0.6s | 4.7s | 96.0s | 95.9s |
| Subnautica | 3.6s | 95.8s | 0.5s | 3.8s | 95.8s | 95.8s |
| Super Mario 64 | 3.5s | 95.4s | 0.5s | 3.5s | 95.5s | 95.5s |
| Super Mario Land 2 | 3.8s | 95.8s | 0.6s | 3.8s | 95.8s | 95.8s |
| Super Mario World | 4.5s | 95.9s | 0.5s | 3.4s | 95.8s | 95.8s |
| TOEM original | 3.2s | 95.8s | 0.5s | 3.2s | 95.8s | 95.8s |
| TOEM rule builder | 2.8s | 95.4s | 0.5s | 2.9s | 95.4s | 95.5s |
| Terraria | 3.2s | 95.8s | 0.5s | 3.3s | 95.8s | 95.9s |
| The Legend of Zelda | 3.9s | 95.9s | 0.6s | 3.5s | 95.9s | 95.8s |
| The Messenger | 3.6s | 95.8s | 0.5s | 3.5s | 95.8s | 95.8s |
| The Wind Waker | 5.7s | 95.8s | 0.6s | 5.8s | 95.8s | 95.9s |
| Timespinner | 4.4s | 95.8s | 0.6s | 4.2s | 95.8s | 95.8s |
| Undertale | 3.4s | 95.5s | 0.5s | 3.3s | 95.4s | 95.4s |
| VVVVVV | 3.2s | 95.8s | 0.5s | 3.1s | 95.8s | 95.8s |
| Wargroove | 3.3s | 95.8s | 0.5s | 3.1s | 95.8s | 95.9s |
| Yoshi's Island | 4.4s | 95.8s | 0.5s | 4.3s | 95.8s | 95.8s |
| shapez | 3.7s | 95.5s | 0.5s | 3.2s | 95.4s | 95.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 12.7s |
| 2 | Civilization VI | 7.4s |
| 3 | A Link to the Past | 7.1s |
| 4 | Links Awakening DX | 6.1s |
| 5 | The Wind Waker | 5.7s |
| 6 | Sonic Adventure 2 Battle | 4.9s |
| 7 | Aquaria | 4.8s |
| 8 | A Hat in Time | 4.7s |
| 9 | Super Mario World | 4.5s |
| 10 | Timespinner | 4.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Castlevania - Circle of the Moon | 100.6s |
| 2 | Adventure | 100.1s |
| 3 | Bumper Stickers | 99.8s |
| 4 | APQuest | 97.6s |
| 5 | A Link to the Past | 97.2s |
| 6 | A Hat in Time | 97.0s |
| 7 | APCalc | 96.5s |
| 8 | A Short Hike | 96.4s |
| 9 | Aquaria | 96.4s |
| 10 | Baking Adventure | 96.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 2.8s |
| 2 | Super Mario Land 2 | 0.6s |
| 3 | Links Awakening DX | 0.6s |
| 4 | A Short Hike | 0.6s |
| 5 | Mario & Luigi Superstar Saga | 0.6s |
| 6 | The Legend of Zelda | 0.6s |
| 7 | The Wind Waker | 0.6s |
| 8 | Final Fantasy Mystic Quest | 0.6s |
| 9 | Sonic Adventure 2 Battle | 0.6s |
| 10 | Timespinner | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.9s |
| 2 | The Wind Waker | 5.8s |
| 3 | Sonic Adventure 2 Battle | 4.7s |
| 4 | Mario & Luigi Superstar Saga | 4.5s |
| 5 | A Hat in Time | 4.3s |
| 6 | Yoshi's Island | 4.3s |
| 7 | Timespinner | 4.2s |
| 8 | Castlevania 64 | 4.1s |
| 9 | EarthBound | 4.0s |
| 10 | Old School Runescape | 4.0s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Aquaria | 96.0s |
| 2 | Sonic Adventure 2 Battle | 96.0s |
| 3 | EarthBound | 95.9s |
| 4 | Mega Man 2 | 95.9s |
| 5 | Risk of Rain 2 | 95.9s |
| 6 | APCalc | 95.9s |
| 7 | Coding Adventure | 95.9s |
| 8 | Links Awakening DX | 95.9s |
| 9 | Adventure | 95.9s |
| 10 | Bumper Stickers | 95.9s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Sonic Adventure 2 Battle | 95.9s |
| 2 | The Wind Waker | 95.9s |
| 3 | Mega Man 2 | 95.9s |
| 4 | Terraria | 95.9s |
| 5 | Adventure | 95.9s |
| 6 | EarthBound | 95.9s |
| 7 | Wargroove | 95.9s |
| 8 | Bumper Stickers | 95.9s |
| 9 | ChecksFinder | 95.8s |
| 10 | Choo-Choo Charles | 95.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 215.7s | 5270.9s | 30.4s | 189.1s | 5260.9s | 5261.4s |
| Average | 3.9s | 95.8s | 0.6s | 3.4s | 95.7s | 95.7s |
| Max | 10.8s | 97.2s | 2.4s | 5.8s | 96.0s | 96.0s |
| Min | 2.7s | 95.0s | 0.4s | 2.5s | 95.0s | 95.0s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.8s) | Bumper Stickers (97.2s) | A Link to the Past (2.4s) | A Link to the Past (5.8s) | TOEM original (96.0s) | Noita (96.0s) |
| Fastest | VVVVVV (2.7s) | Timespinner (95.0s) | VVVVVV (0.4s) | VVVVVV (2.5s) | Subnautica (95.0s) | Timespinner (95.0s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.4s | 96.0s | 0.5s | 3.8s | 95.5s | 95.5s |
| A Link to the Past | 6.0s | 95.6s | 2.4s | 5.8s | 95.2s | 95.2s |
| A Short Hike | 3.9s | 96.6s | 0.6s | 3.2s | 95.9s | 95.8s |
| APCalc | 3.6s | 96.5s | 0.6s | 3.5s | 96.0s | 95.9s |
| APQuest | 3.4s | 97.1s | 0.5s | 3.1s | 95.8s | 95.8s |
| Adventure | 3.6s | 96.7s | 0.5s | 3.3s | 95.9s | 96.0s |
| Aquaria | 5.3s | 96.6s | 0.6s | 4.0s | 95.9s | 95.9s |
| Baking Adventure | 3.4s | 97.1s | 0.5s | 3.1s | 95.8s | 95.8s |
| Bumper Stickers | 3.3s | 97.2s | 0.5s | 3.2s | 95.9s | 95.8s |
| Castlevania - Circle of the Moon | 2.9s | 95.3s | 0.4s | 2.7s | 95.0s | 95.0s |
| Castlevania 64 | 3.5s | 95.5s | 0.5s | 3.5s | 95.5s | 95.5s |
| Celeste 64 | 2.8s | 95.2s | 0.4s | 3.0s | 95.1s | 95.1s |
| ChecksFinder | 3.2s | 96.0s | 0.6s | 3.0s | 95.8s | 95.8s |
| Choo-Choo Charles | 3.4s | 96.0s | 0.6s | 3.3s | 95.9s | 95.9s |
| Civilization VI | 8.7s | 95.8s | 0.5s | 3.3s | 95.8s | 95.8s |
| Coding Adventure | 3.1s | 96.0s | 0.5s | 3.1s | 95.9s | 96.0s |
| DLCQuest | 3.8s | 96.0s | 0.6s | 3.3s | 95.8s | 95.8s |
| DepGraph | 3.4s | 95.8s | 0.5s | 3.5s | 95.8s | 95.8s |
| EarthBound | 3.9s | 95.8s | 0.5s | 3.8s | 95.8s | 95.9s |
| Factorio | 3.1s | 95.0s | 0.4s | 2.8s | 95.0s | 95.2s |
| Faxanadu | 3.1s | 95.4s | 0.5s | 3.0s | 95.5s | 95.4s |
| Final Fantasy Mystic Quest | 3.2s | 95.3s | 0.5s | 3.6s | 95.2s | 95.2s |
| Hylics 2 | 3.8s | 96.0s | 0.6s | 3.2s | 95.8s | 95.8s |
| Inscryption | 3.4s | 95.9s | 0.6s | 3.4s | 95.9s | 95.9s |
| Landstalker - The Treasures of King Nole | 3.5s | 95.8s | 0.5s | 3.4s | 95.9s | 95.8s |
| Links Awakening DX | 6.3s | 95.9s | 0.6s | 3.9s | 95.9s | 95.8s |
| Lufia II Ancient Cave | 3.8s | 96.0s | 0.6s | 3.5s | 95.8s | 95.8s |
| Mario & Luigi Superstar Saga | 3.9s | 95.8s | 0.6s | 4.5s | 95.8s | 95.8s |
| Mega Man 2 | 3.2s | 95.8s | 0.5s | 3.3s | 95.8s | 95.8s |
| MegaMan Battle Network 3 | 2.8s | 95.0s | 0.4s | 2.6s | 95.0s | 95.0s |
| Meritous | 2.9s | 95.5s | 0.5s | 2.8s | 95.5s | 95.5s |
| Metamath | 10.8s | 95.2s | 0.4s | 2.5s | 95.0s | 95.2s |
| Noita | 3.5s | 96.0s | 0.6s | 3.1s | 95.8s | 96.0s |
| Old School Runescape | 4.3s | 95.9s | 0.6s | 3.9s | 95.9s | 95.9s |
| Overcooked! 2 | 3.7s | 95.8s | 0.5s | 3.8s | 95.8s | 95.8s |
| Risk of Rain 2 | 3.8s | 95.9s | 0.6s | 3.6s | 95.9s | 95.9s |
| Saving Princess | 3.5s | 95.9s | 0.6s | 3.5s | 95.9s | 95.9s |
| Shivers | 3.7s | 95.8s | 0.6s | 3.5s | 95.8s | 95.8s |
| Sonic Adventure 2 Battle | 4.7s | 95.8s | 0.5s | 4.5s | 95.8s | 95.9s |
| Subnautica | 2.9s | 95.0s | 0.4s | 3.0s | 95.0s | 95.0s |
| Super Mario 64 | 3.2s | 95.5s | 0.5s | 3.1s | 95.4s | 95.5s |
| Super Mario Land 2 | 3.3s | 95.2s | 0.5s | 3.4s | 95.1s | 95.0s |
| Super Mario World | 4.9s | 96.0s | 0.6s | 3.5s | 95.8s | 95.8s |
| TOEM original | 3.2s | 95.9s | 0.6s | 3.2s | 96.0s | 95.9s |
| TOEM rule builder | 3.2s | 95.8s | 0.5s | 3.1s | 95.8s | 95.8s |
| Terraria | 3.4s | 95.9s | 0.6s | 3.4s | 95.9s | 95.8s |
| The Legend of Zelda | 4.3s | 95.9s | 0.6s | 3.5s | 95.8s | 95.9s |
| The Messenger | 3.7s | 95.8s | 0.6s | 3.5s | 95.8s | 95.8s |
| The Wind Waker | 5.7s | 95.8s | 0.5s | 5.7s | 95.9s | 95.9s |
| Timespinner | 3.5s | 95.0s | 0.4s | 3.4s | 95.0s | 95.0s |
| Undertale | 3.1s | 95.5s | 0.5s | 3.0s | 95.5s | 95.5s |
| VVVVVV | 2.7s | 95.2s | 0.4s | 2.5s | 95.0s | 95.1s |
| Wargroove | 3.5s | 96.0s | 0.6s | 3.2s | 95.9s | 95.9s |
| Yoshi's Island | 4.4s | 95.9s | 0.6s | 4.2s | 95.9s | 95.9s |
| shapez | 4.0s | 95.8s | 0.5s | 3.5s | 95.8s | 95.8s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.8s |
| 2 | Civilization VI | 8.7s |
| 3 | Links Awakening DX | 6.3s |
| 4 | A Link to the Past | 6.0s |
| 5 | The Wind Waker | 5.7s |
| 6 | Aquaria | 5.3s |
| 7 | Super Mario World | 4.9s |
| 8 | Sonic Adventure 2 Battle | 4.7s |
| 9 | Yoshi's Island | 4.4s |
| 10 | A Hat in Time | 4.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Bumper Stickers | 97.2s |
| 2 | APQuest | 97.1s |
| 3 | Baking Adventure | 97.1s |
| 4 | Adventure | 96.7s |
| 5 | A Short Hike | 96.6s |
| 6 | Aquaria | 96.6s |
| 7 | APCalc | 96.5s |
| 8 | Hylics 2 | 96.0s |
| 9 | Super Mario World | 96.0s |
| 10 | ChecksFinder | 96.0s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 2.4s |
| 2 | The Legend of Zelda | 0.6s |
| 3 | Aquaria | 0.6s |
| 4 | Inscryption | 0.6s |
| 5 | Links Awakening DX | 0.6s |
| 6 | Risk of Rain 2 | 0.6s |
| 7 | Super Mario World | 0.6s |
| 8 | Wargroove | 0.6s |
| 9 | Yoshi's Island | 0.6s |
| 10 | A Short Hike | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.8s |
| 2 | The Wind Waker | 5.7s |
| 3 | Mario & Luigi Superstar Saga | 4.5s |
| 4 | Sonic Adventure 2 Battle | 4.5s |
| 5 | Yoshi's Island | 4.2s |
| 6 | Aquaria | 4.0s |
| 7 | Links Awakening DX | 3.9s |
| 8 | Old School Runescape | 3.9s |
| 9 | A Hat in Time | 3.8s |
| 10 | Overcooked! 2 | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | TOEM original | 96.0s |
| 2 | APCalc | 96.0s |
| 3 | Yoshi's Island | 95.9s |
| 4 | Choo-Choo Charles | 95.9s |
| 5 | Adventure | 95.9s |
| 6 | Inscryption | 95.9s |
| 7 | Aquaria | 95.9s |
| 8 | Risk of Rain 2 | 95.9s |
| 9 | The Wind Waker | 95.9s |
| 10 | Bumper Stickers | 95.9s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Noita | 96.0s |
| 2 | Adventure | 96.0s |
| 3 | Coding Adventure | 96.0s |
| 4 | Aquaria | 95.9s |
| 5 | Wargroove | 95.9s |
| 6 | Saving Princess | 95.9s |
| 7 | Yoshi's Island | 95.9s |
| 8 | APCalc | 95.9s |
| 9 | Old School Runescape | 95.9s |
| 10 | Inscryption | 95.9s |
