# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-10 03:43:15 UTC

**Source Data Created:** 2026-02-10 03:43:15

**Source Data Last Updated:** 2026-02-10 03:43:15

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

**Total Templates:** 62

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 62 | 0 | 62 |
| Original Spoiler Test | 62 | 0 | 62 |
| Stage 1: World Generation | 62 | 0 | 62 |
| Stage 2: Seed Generation | 62 | 0 | 62 |
| Stage 3: Rules Comparison | 60 | 2 | 62 |
| Stage 4: WorldGen Spoiler Test | 62 | 0 | 62 |
| Stage 5: Cross-Validation | 62 | 0 | 62 |

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
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Satisfactory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Stage 2: Seed Generation | 62 | 0 | 62 |
| Stage 3: Rules Comparison | 0 | 62 | 62 |
| Stage 4: WorldGen Spoiler Test | 62 | 0 | 62 |
| Stage 5: Cross-Validation | 40 | 22 | 62 |

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
| Total | 233.8s | 439.2s | 33.9s | 210.3s | 408.0s | 408.8s |
| Average | 3.8s | 7.1s | 0.5s | 3.4s | 6.6s | 6.6s |
| Max | 11.0s | 21.9s | 0.6s | 6.7s | 21.9s | 21.8s |
| Min | 2.7s | 5.5s | 0.5s | 2.7s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.0s) | Satisfactory (21.9s) | Factorio (0.6s) | A Link to the Past (6.7s) | Satisfactory (21.9s) | Satisfactory (21.8s) |
| Fastest | Baking Adventure (2.7s) | Saving Princess (5.5s) | Saving Princess (0.5s) | Baking Adventure (2.7s) | MegaMan Battle Network 3 (5.5s) | Saving Princess (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.0s | 7.3s | 0.5s | 4.0s | 6.7s | 6.7s |
| A Link to the Past | 7.4s | 12.5s | 0.6s | 6.7s | 9.8s | 9.0s |
| A Short Hike | 3.3s | 7.2s | 0.6s | 3.4s | 5.7s | 5.7s |
| APQuest | 3.0s | 6.8s | 0.5s | 3.1s | 5.6s | 5.5s |
| Adventure | 3.0s | 8.1s | 0.5s | 2.9s | 5.6s | 5.7s |
| Aquaria | 4.1s | 8.4s | 0.6s | 3.3s | 5.7s | 5.7s |
| Baking Adventure | 2.7s | 10.7s | 0.5s | 2.7s | 5.6s | 5.6s |
| Bumper Stickers | 3.1s | 9.1s | 0.6s | 3.2s | 5.7s | 5.7s |
| Castlevania - Circle of the Moon | 3.1s | 12.0s | 0.5s | 3.3s | 5.6s | 5.6s |
| Castlevania 64 | 3.3s | 8.6s | 0.5s | 3.2s | 5.7s | 5.6s |
| Celeste 64 | 2.9s | 5.6s | 0.5s | 3.2s | 5.6s | 5.7s |
| ChecksFinder | 3.3s | 5.7s | 0.6s | 3.3s | 5.8s | 5.7s |
| Choo-Choo Charles | 3.3s | 7.7s | 0.6s | 3.3s | 7.7s | 7.8s |
| Civilization VI | 7.6s | 5.5s | 0.5s | 3.4s | 5.5s | 5.5s |
| Coding Adventure | 2.9s | 5.6s | 0.5s | 3.0s | 5.7s | 5.7s |
| DLCQuest | 3.2s | 5.7s | 0.5s | 2.9s | 5.6s | 5.6s |
| DOOM 1993 | 3.2s | 6.6s | 0.5s | 3.1s | 6.6s | 6.6s |
| DOOM II | 3.7s | 7.7s | 0.6s | 3.5s | 7.7s | 7.8s |
| Dark Souls III | 4.0s | 18.8s | 0.6s | 3.9s | 18.7s | 18.7s |
| Donkey Kong Country 3 | 3.0s | 5.7s | 0.5s | 3.0s | 5.6s | 5.7s |
| EarthBound | 3.7s | 5.7s | 0.5s | 3.6s | 5.7s | 5.7s |
| Factorio | 4.2s | 5.7s | 0.6s | 3.7s | 5.7s | 5.7s |
| Faxanadu | 3.2s | 5.8s | 0.6s | 3.2s | 5.7s | 5.7s |
| Final Fantasy Mystic Quest | 3.9s | 6.7s | 0.5s | 3.7s | 6.5s | 6.6s |
| Heretic | 3.5s | 7.7s | 0.6s | 3.3s | 7.7s | 7.7s |
| Hylics 2 | 3.2s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Inscryption | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.5s | 5.7s | 0.6s | 3.4s | 5.7s | 5.7s |
| Links Awakening DX | 6.1s | 8.7s | 0.6s | 3.7s | 8.7s | 8.7s |
| Lufia II Ancient Cave | 3.1s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 7.7s | 0.6s | 4.2s | 7.7s | 7.7s |
| Math Adventure | 3.3s | 5.8s | 0.6s | 3.1s | 5.7s | 5.7s |
| Mega Man 2 | 3.2s | 5.8s | 0.6s | 3.2s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 3.4s | 5.5s | 0.5s | 3.2s | 5.5s | 5.5s |
| Meritous | 2.9s | 5.7s | 0.5s | 2.9s | 5.6s | 5.7s |
| Metamath | 11.0s | 5.6s | 0.5s | 2.9s | 5.6s | 5.7s |
| Muse Dash | 3.0s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Noita | 3.2s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| Old School Runescape | 4.1s | 5.6s | 0.6s | 3.5s | 5.6s | 5.6s |
| Overcooked! 2 | 3.2s | 7.7s | 0.5s | 3.2s | 7.7s | 7.7s |
| Paint | 2.9s | 5.8s | 0.5s | 3.1s | 5.6s | 5.7s |
| Risk of Rain 2 | 4.0s | 5.7s | 0.6s | 3.7s | 5.7s | 5.7s |
| Satisfactory | 5.1s | 21.9s | 0.6s | 3.9s | 21.9s | 21.8s |
| Saving Princess | 3.2s | 5.5s | 0.5s | 3.3s | 5.7s | 5.5s |
| Shivers | 3.2s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| Sonic Adventure 2 Battle | 4.6s | 5.7s | 0.6s | 4.2s | 5.7s | 6.9s |
| Subnautica | 3.1s | 7.6s | 0.5s | 3.3s | 7.6s | 7.8s |
| Super Mario 64 | 3.5s | 5.8s | 0.6s | 3.3s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.7s | 5.7s | 0.6s | 3.8s | 5.7s | 5.7s |
| Super Mario World | 4.3s | 5.8s | 0.5s | 3.2s | 5.6s | 5.6s |
| TOEM original | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 5.6s |
| TOEM rule builder | 3.6s | 5.8s | 0.6s | 3.1s | 5.7s | 5.7s |
| Terraria | 3.3s | 7.7s | 0.6s | 3.3s | 7.8s | 7.7s |
| The Legend of Zelda | 4.0s | 5.5s | 0.5s | 3.4s | 5.5s | 5.6s |
| The Messenger | 3.3s | 9.8s | 0.6s | 3.3s | 9.8s | 9.8s |
| The Wind Waker | 5.3s | 5.7s | 0.5s | 5.3s | 5.6s | 5.6s |
| Timespinner | 3.8s | 5.6s | 0.5s | 3.6s | 5.6s | 5.6s |
| Undertale | 3.3s | 5.8s | 0.6s | 3.1s | 5.7s | 5.7s |
| VVVVVV | 3.2s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Wargroove | 2.9s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Yoshi's Island | 3.9s | 6.7s | 0.5s | 3.9s | 5.7s | 5.7s |
| shapez | 4.4s | 5.8s | 0.6s | 3.6s | 5.7s | 5.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.0s |
| 2 | Civilization VI | 7.6s |
| 3 | A Link to the Past | 7.4s |
| 4 | Links Awakening DX | 6.1s |
| 5 | The Wind Waker | 5.3s |
| 6 | Satisfactory | 5.1s |
| 7 | Sonic Adventure 2 Battle | 4.6s |
| 8 | shapez | 4.4s |
| 9 | Super Mario World | 4.3s |
| 10 | Factorio | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.9s |
| 2 | Dark Souls III | 18.8s |
| 3 | A Link to the Past | 12.5s |
| 4 | Castlevania - Circle of the Moon | 12.0s |
| 5 | Baking Adventure | 10.7s |
| 6 | The Messenger | 9.8s |
| 7 | Bumper Stickers | 9.1s |
| 8 | Links Awakening DX | 8.7s |
| 9 | Castlevania 64 | 8.6s |
| 10 | Aquaria | 8.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Factorio | 0.6s |
| 2 | Satisfactory | 0.6s |
| 3 | A Link to the Past | 0.6s |
| 4 | Risk of Rain 2 | 0.6s |
| 5 | A Short Hike | 0.6s |
| 6 | Undertale | 0.6s |
| 7 | shapez | 0.6s |
| 8 | DOOM II | 0.6s |
| 9 | Landstalker - The Treasures of King Nole | 0.6s |
| 10 | Super Mario Land 2 | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.7s |
| 2 | The Wind Waker | 5.3s |
| 3 | Sonic Adventure 2 Battle | 4.2s |
| 4 | Mario & Luigi Superstar Saga | 4.2s |
| 5 | A Hat in Time | 4.0s |
| 6 | Dark Souls III | 3.9s |
| 7 | Satisfactory | 3.9s |
| 8 | Yoshi's Island | 3.9s |
| 9 | Super Mario Land 2 | 3.8s |
| 10 | Final Fantasy Mystic Quest | 3.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.9s |
| 2 | Dark Souls III | 18.7s |
| 3 | A Link to the Past | 9.8s |
| 4 | The Messenger | 9.8s |
| 5 | Links Awakening DX | 8.7s |
| 6 | Terraria | 7.8s |
| 7 | Choo-Choo Charles | 7.7s |
| 8 | DOOM II | 7.7s |
| 9 | Heretic | 7.7s |
| 10 | Mario & Luigi Superstar Saga | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.7s |
| 3 | The Messenger | 9.8s |
| 4 | A Link to the Past | 9.0s |
| 5 | Links Awakening DX | 8.7s |
| 6 | DOOM II | 7.8s |
| 7 | Subnautica | 7.8s |
| 8 | Choo-Choo Charles | 7.8s |
| 9 | Heretic | 7.7s |
| 10 | Terraria | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 225.5s | 423.7s | 32.6s | 206.4s | 403.8s | 575.6s |
| Average | 3.6s | 6.8s | 0.5s | 3.3s | 6.5s | 9.3s |
| Max | 11.2s | 21.8s | 0.6s | 6.2s | 21.8s | 32.8s |
| Min | 2.6s | 5.4s | 0.5s | 2.7s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.2s) | Satisfactory (21.8s) | Satisfactory (0.6s) | A Link to the Past (6.2s) | Satisfactory (21.8s) | Dark Souls III (32.8s) |
| Fastest | Bumper Stickers (2.6s) | Undertale (5.4s) | Wargroove (0.5s) | Noita (2.7s) | Undertale (5.4s) | Noita (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.2s | 8.5s | 0.5s | 3.9s | 6.6s | 6.7s |
| A Link to the Past | 6.5s | 9.4s | 0.6s | 6.2s | 8.7s | 14.8s |
| A Short Hike | 2.9s | 6.2s | 0.5s | 3.1s | 5.6s | 5.6s |
| APQuest | 2.9s | 8.8s | 0.5s | 3.1s | 5.7s | 5.7s |
| Adventure | 2.9s | 7.1s | 0.5s | 2.9s | 5.6s | 5.6s |
| Aquaria | 4.1s | 7.1s | 0.6s | 3.5s | 5.7s | 5.7s |
| Baking Adventure | 2.8s | 6.7s | 0.5s | 2.8s | 5.6s | 14.4s |
| Bumper Stickers | 2.6s | 7.0s | 0.5s | 2.7s | 5.4s | 13.8s |
| Castlevania - Circle of the Moon | 3.1s | 7.2s | 0.5s | 3.1s | 5.6s | 5.6s |
| Castlevania 64 | 3.4s | 9.8s | 0.5s | 3.4s | 5.5s | 5.5s |
| Celeste 64 | 3.0s | 5.8s | 0.5s | 3.1s | 5.6s | 14.2s |
| ChecksFinder | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 5.6s |
| Choo-Choo Charles | 3.0s | 7.7s | 0.5s | 3.1s | 7.7s | 7.7s |
| Civilization VI | 8.1s | 5.7s | 0.5s | 3.0s | 5.7s | 14.3s |
| Coding Adventure | 2.9s | 5.8s | 0.5s | 2.9s | 5.7s | 14.2s |
| DLCQuest | 3.1s | 5.7s | 0.5s | 3.0s | 5.7s | 5.6s |
| DOOM 1993 | 3.4s | 6.7s | 0.5s | 3.4s | 6.7s | 14.4s |
| DOOM II | 3.2s | 7.5s | 0.5s | 3.1s | 7.5s | 13.8s |
| Dark Souls III | 3.9s | 18.7s | 0.6s | 3.8s | 17.7s | 32.8s |
| Donkey Kong Country 3 | 3.0s | 5.6s | 0.5s | 3.1s | 5.5s | 13.9s |
| EarthBound | 3.8s | 5.7s | 0.5s | 3.7s | 5.7s | 5.7s |
| Factorio | 3.5s | 5.7s | 0.5s | 3.4s | 5.7s | 5.7s |
| Faxanadu | 2.9s | 5.6s | 0.5s | 3.1s | 5.7s | 14.3s |
| Final Fantasy Mystic Quest | 3.7s | 6.7s | 0.6s | 3.5s | 6.7s | 6.7s |
| Heretic | 3.4s | 7.7s | 0.5s | 3.4s | 7.7s | 14.4s |
| Hylics 2 | 3.1s | 5.7s | 0.5s | 3.1s | 5.6s | 5.6s |
| Inscryption | 3.0s | 5.8s | 0.5s | 3.0s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.0s | 5.5s | 0.5s | 2.9s | 5.4s | 5.5s |
| Links Awakening DX | 6.1s | 8.7s | 0.6s | 3.9s | 8.7s | 8.7s |
| Lufia II Ancient Cave | 3.3s | 5.5s | 0.5s | 3.2s | 5.5s | 5.5s |
| Mario & Luigi Superstar Saga | 3.8s | 7.7s | 0.6s | 4.3s | 7.7s | 7.7s |
| Math Adventure | 2.9s | 5.6s | 0.5s | 2.8s | 5.6s | 14.2s |
| Mega Man 2 | 2.9s | 5.6s | 0.5s | 3.2s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 3.3s | 5.8s | 0.6s | 3.1s | 5.7s | 14.4s |
| Meritous | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Metamath | 11.2s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 5.7s | 0.5s | 3.1s | 5.6s | 5.7s |
| Noita | 2.7s | 5.6s | 0.5s | 2.7s | 5.4s | 5.4s |
| Old School Runescape | 4.0s | 5.6s | 0.5s | 3.6s | 5.7s | 5.7s |
| Overcooked! 2 | 3.3s | 7.5s | 0.5s | 3.2s | 7.5s | 13.9s |
| Paint | 2.9s | 5.7s | 0.5s | 3.1s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.4s | 5.7s | 0.5s | 3.5s | 5.7s | 5.6s |
| Satisfactory | 4.7s | 21.8s | 0.6s | 4.3s | 21.8s | 17.9s |
| Saving Princess | 3.2s | 5.8s | 0.6s | 3.3s | 5.7s | 5.7s |
| Shivers | 3.1s | 5.7s | 0.5s | 3.1s | 5.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.5s | 5.7s | 0.6s | 4.3s | 5.6s | 14.2s |
| Subnautica | 3.2s | 7.6s | 0.5s | 3.5s | 7.7s | 14.3s |
| Super Mario 64 | 3.0s | 5.5s | 0.5s | 2.9s | 5.5s | 5.5s |
| Super Mario Land 2 | 3.6s | 5.7s | 0.6s | 3.8s | 5.7s | 5.7s |
| Super Mario World | 4.4s | 5.6s | 0.5s | 3.4s | 5.5s | 5.5s |
| TOEM original | 2.9s | 5.6s | 0.5s | 2.9s | 5.7s | 5.7s |
| TOEM rule builder | 2.9s | 5.7s | 0.5s | 3.0s | 5.6s | 5.6s |
| Terraria | 3.0s | 7.7s | 0.6s | 3.1s | 7.7s | 7.7s |
| The Legend of Zelda | 3.9s | 5.8s | 0.6s | 3.2s | 5.7s | 14.4s |
| The Messenger | 3.2s | 9.8s | 0.5s | 3.2s | 9.8s | 9.8s |
| The Wind Waker | 5.2s | 5.7s | 0.5s | 5.3s | 5.6s | 14.3s |
| Timespinner | 4.0s | 5.6s | 0.6s | 3.9s | 5.7s | 5.7s |
| Undertale | 2.8s | 5.4s | 0.5s | 2.7s | 5.4s | 5.5s |
| VVVVVV | 3.1s | 5.6s | 0.5s | 3.0s | 5.6s | 5.7s |
| Wargroove | 2.9s | 5.5s | 0.5s | 2.9s | 5.5s | 5.5s |
| Yoshi's Island | 4.0s | 5.7s | 0.5s | 3.9s | 5.7s | 5.7s |
| shapez | 3.8s | 5.7s | 0.5s | 3.2s | 5.6s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.2s |
| 2 | Civilization VI | 8.1s |
| 3 | A Link to the Past | 6.5s |
| 4 | Links Awakening DX | 6.1s |
| 5 | The Wind Waker | 5.2s |
| 6 | Satisfactory | 4.7s |
| 7 | Sonic Adventure 2 Battle | 4.5s |
| 8 | Super Mario World | 4.4s |
| 9 | A Hat in Time | 4.2s |
| 10 | Aquaria | 4.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.7s |
| 3 | The Messenger | 9.8s |
| 4 | Castlevania 64 | 9.8s |
| 5 | A Link to the Past | 9.4s |
| 6 | APQuest | 8.8s |
| 7 | Links Awakening DX | 8.7s |
| 8 | A Hat in Time | 8.5s |
| 9 | Heretic | 7.7s |
| 10 | Choo-Choo Charles | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 0.6s |
| 2 | The Legend of Zelda | 0.6s |
| 3 | A Link to the Past | 0.6s |
| 4 | Super Mario Land 2 | 0.6s |
| 5 | Dark Souls III | 0.6s |
| 6 | Final Fantasy Mystic Quest | 0.6s |
| 7 | Links Awakening DX | 0.6s |
| 8 | Mario & Luigi Superstar Saga | 0.6s |
| 9 | Saving Princess | 0.6s |
| 10 | Timespinner | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.2s |
| 2 | The Wind Waker | 5.3s |
| 3 | Mario & Luigi Superstar Saga | 4.3s |
| 4 | Satisfactory | 4.3s |
| 5 | Sonic Adventure 2 Battle | 4.3s |
| 6 | Timespinner | 3.9s |
| 7 | Yoshi's Island | 3.9s |
| 8 | Links Awakening DX | 3.9s |
| 9 | A Hat in Time | 3.9s |
| 10 | Super Mario Land 2 | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 17.7s |
| 3 | The Messenger | 9.8s |
| 4 | A Link to the Past | 8.7s |
| 5 | Links Awakening DX | 8.7s |
| 6 | Terraria | 7.7s |
| 7 | Choo-Choo Charles | 7.7s |
| 8 | Heretic | 7.7s |
| 9 | Subnautica | 7.7s |
| 10 | Mario & Luigi Superstar Saga | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.8s |
| 2 | Satisfactory | 17.9s |
| 3 | A Link to the Past | 14.8s |
| 4 | The Legend of Zelda | 14.4s |
| 5 | Baking Adventure | 14.4s |
| 6 | Heretic | 14.4s |
| 7 | MegaMan Battle Network 3 | 14.4s |
| 8 | DOOM 1993 | 14.4s |
| 9 | Subnautica | 14.3s |
| 10 | Civilization VI | 14.3s |
