# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-09 02:16:19 UTC

**Source Data Created:** 2026-02-09 02:16:19

**Source Data Last Updated:** 2026-02-09 02:16:19

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
| Original Spoiler Test | 61 | 1 | 62 |
| Stage 1: World Generation | 62 | 0 | 62 |
| Stage 2: Seed Generation | 62 | 0 | 62 |
| Stage 3: Rules Comparison | 55 | 7 | 62 |
| Stage 4: WorldGen Spoiler Test | 61 | 1 | 62 |
| Stage 5: Cross-Validation | 58 | 4 | 62 |

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
| EarthBound | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Math Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Satisfactory | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 62

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 62 | 0 | 62 |
| Original Spoiler Test | 61 | 1 | 62 |
| Stage 1: World Generation | 62 | 0 | 62 |
| Stage 2: Seed Generation | 62 | 0 | 62 |
| Stage 3: Rules Comparison | 0 | 62 | 62 |
| Stage 4: WorldGen Spoiler Test | 61 | 1 | 62 |
| Stage 5: Cross-Validation | 38 | 24 | 62 |

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
| Factorio | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Satisfactory | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Total | 230.7s | 421.7s | 160.0s | 205.9s | 414.8s | 430.1s |
| Average | 3.7s | 6.8s | 2.6s | 3.3s | 6.7s | 6.9s |
| Max | 11.3s | 18.8s | 2.8s | 6.1s | 20.7s | 19.8s |
| Min | 2.6s | 5.4s | 2.3s | 2.6s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.3s) | Dark Souls III (18.8s) | Links Awakening DX (2.8s) | A Link to the Past (6.1s) | Satisfactory (20.7s) | Dark Souls III (19.8s) |
| Fastest | Baking Adventure (2.6s) | Muse Dash (5.4s) | Subnautica (2.3s) | Baking Adventure (2.6s) | Baking Adventure (5.4s) | Inscryption (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 10.1s | 2.7s | 3.9s | 6.8s | 6.7s |
| A Link to the Past | 7.1s | 12.2s | 2.8s | 6.1s | 8.7s | 8.7s |
| A Short Hike | 2.9s | 6.5s | 2.5s | 2.9s | 5.6s | 5.6s |
| APQuest | 2.9s | 6.8s | 2.5s | 2.9s | 5.7s | 5.7s |
| Adventure | 3.1s | 9.7s | 2.7s | 3.0s | 5.7s | 5.7s |
| Aquaria | 4.2s | 6.8s | 2.7s | 3.4s | 5.7s | 5.7s |
| Baking Adventure | 2.6s | 6.5s | 2.3s | 2.6s | 5.4s | 5.4s |
| Bumper Stickers | 3.0s | 8.8s | 2.7s | 3.0s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.3s | 6.3s | 2.7s | 3.4s | 5.7s | 5.7s |
| Castlevania 64 | 3.2s | 8.1s | 2.5s | 3.3s | 5.6s | 5.6s |
| Celeste 64 | 3.1s | 5.7s | 2.6s | 3.0s | 5.6s | 5.7s |
| ChecksFinder | 3.1s | 5.8s | 2.8s | 3.0s | 5.7s | 5.7s |
| Choo-Choo Charles | 2.9s | 7.6s | 2.4s | 2.9s | 7.6s | 7.6s |
| Civilization VI | 8.1s | 5.7s | 2.5s | 3.0s | 5.7s | 5.7s |
| Coding Adventure | 3.0s | 5.7s | 2.6s | 2.9s | 5.7s | 5.7s |
| DLCQuest | 3.2s | 5.7s | 2.6s | 3.0s | 5.6s | 5.7s |
| DOOM 1993 | 3.1s | 6.5s | 2.3s | 3.0s | 6.5s | 6.5s |
| DOOM II | 3.6s | 7.7s | 2.6s | 3.4s | 7.7s | 7.7s |
| Dark Souls III | 4.2s | 18.8s | 2.7s | 4.2s | 19.8s | 19.8s |
| Donkey Kong Country 3 | 3.0s | 5.6s | 2.5s | 3.2s | 5.7s | 5.7s |
| EarthBound | 4.0s | 5.7s | 2.7s | 3.6s | 5.7s | 5.7s |
| Factorio | 3.8s | 5.7s | 2.8s | 3.5s | 5.7s | 14.4s |
| Faxanadu | 2.8s | 5.7s | 2.5s | 2.8s | 5.6s | 5.6s |
| Final Fantasy Mystic Quest | 3.5s | 6.7s | 2.5s | 3.4s | 6.7s | 6.7s |
| Heretic | 3.5s | 7.8s | 2.6s | 3.3s | 7.7s | 7.7s |
| Hylics 2 | 3.3s | 5.7s | 2.6s | 3.3s | 5.7s | 5.7s |
| Inscryption | 2.8s | 5.4s | 2.3s | 2.8s | 5.4s | 5.4s |
| Landstalker - The Treasures of King Nole | 3.4s | 5.8s | 2.6s | 3.3s | 5.6s | 5.6s |
| Links Awakening DX | 6.3s | 8.7s | 2.8s | 4.0s | 8.8s | 8.8s |
| Lufia II Ancient Cave | 3.1s | 5.6s | 2.5s | 3.4s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.9s | 7.7s | 2.6s | 4.3s | 7.7s | 7.7s |
| Math Adventure | 3.1s | 5.7s | 2.8s | 3.1s | 5.7s | 5.8s |
| Mega Man 2 | 2.9s | 5.6s | 2.5s | 2.8s | 14.1s | 14.1s |
| MegaMan Battle Network 3 | 3.1s | 5.7s | 2.5s | 3.0s | 5.7s | 5.7s |
| Meritous | 2.9s | 5.7s | 2.5s | 2.9s | 5.6s | 5.6s |
| Metamath | 11.3s | 5.7s | 2.6s | 3.1s | 5.7s | 5.7s |
| Muse Dash | 2.9s | 5.4s | 2.3s | 2.9s | 5.4s | 5.4s |
| Noita | 3.0s | 5.6s | 2.7s | 3.0s | 5.6s | 5.6s |
| Old School Runescape | 4.2s | 5.7s | 2.7s | 3.8s | 5.7s | 5.7s |
| Overcooked! 2 | 3.2s | 7.7s | 2.5s | 3.3s | 7.7s | 7.7s |
| Paint | 3.1s | 5.7s | 2.5s | 3.1s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.6s | 5.7s | 2.7s | 3.6s | 5.7s | 5.7s |
| Satisfactory | 4.6s | 14.8s | 2.5s | 3.4s | 20.7s | 18.6s |
| Saving Princess | 2.9s | 5.8s | 2.5s | 2.9s | 5.7s | 5.7s |
| Shivers | 3.2s | 5.7s | 2.6s | 3.1s | 5.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.6s | 5.7s | 2.7s | 4.3s | 5.7s | 5.7s |
| Subnautica | 2.9s | 7.5s | 2.3s | 3.1s | 7.5s | 7.5s |
| Super Mario 64 | 3.5s | 5.7s | 2.6s | 3.2s | 5.6s | 5.7s |
| Super Mario Land 2 | 3.9s | 5.8s | 2.7s | 4.0s | 5.8s | 5.8s |
| Super Mario World | 4.3s | 5.7s | 2.5s | 3.3s | 5.7s | 5.6s |
| TOEM original | 2.9s | 5.7s | 2.5s | 2.8s | 5.6s | 5.6s |
| TOEM rule builder | 3.1s | 5.7s | 2.7s | 3.1s | 5.7s | 5.7s |
| Terraria | 3.0s | 7.6s | 2.5s | 2.9s | 7.6s | 7.6s |
| The Legend of Zelda | 3.6s | 5.7s | 2.5s | 3.0s | 5.7s | 5.7s |
| The Messenger | 3.3s | 9.8s | 2.6s | 3.2s | 9.8s | 9.8s |
| The Wind Waker | 5.6s | 5.7s | 2.7s | 5.3s | 5.7s | 5.7s |
| Timespinner | 3.8s | 5.6s | 2.3s | 3.7s | 5.4s | 5.5s |
| Undertale | 3.2s | 5.7s | 2.6s | 3.0s | 5.6s | 5.6s |
| VVVVVV | 3.1s | 5.7s | 2.7s | 3.1s | 5.7s | 5.6s |
| Wargroove | 2.9s | 5.6s | 2.5s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 4.1s | 5.7s | 2.7s | 3.9s | 5.7s | 5.7s |
| shapez | 4.1s | 5.7s | 2.8s | 3.5s | 5.7s | 5.8s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.3s |
| 2 | Civilization VI | 8.1s |
| 3 | A Link to the Past | 7.1s |
| 4 | Links Awakening DX | 6.3s |
| 5 | The Wind Waker | 5.6s |
| 6 | Sonic Adventure 2 Battle | 4.6s |
| 7 | Satisfactory | 4.6s |
| 8 | A Hat in Time | 4.5s |
| 9 | Super Mario World | 4.3s |
| 10 | Old School Runescape | 4.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.8s |
| 2 | Satisfactory | 14.8s |
| 3 | A Link to the Past | 12.2s |
| 4 | A Hat in Time | 10.1s |
| 5 | The Messenger | 9.8s |
| 6 | Adventure | 9.7s |
| 7 | Bumper Stickers | 8.8s |
| 8 | Links Awakening DX | 8.7s |
| 9 | Castlevania 64 | 8.1s |
| 10 | Heretic | 7.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Links Awakening DX | 2.8s |
| 2 | A Link to the Past | 2.8s |
| 3 | ChecksFinder | 2.8s |
| 4 | Factorio | 2.8s |
| 5 | Math Adventure | 2.8s |
| 6 | shapez | 2.8s |
| 7 | A Hat in Time | 2.7s |
| 8 | Dark Souls III | 2.7s |
| 9 | Super Mario Land 2 | 2.7s |
| 10 | Risk of Rain 2 | 2.7s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.1s |
| 2 | The Wind Waker | 5.3s |
| 3 | Sonic Adventure 2 Battle | 4.3s |
| 4 | Mario & Luigi Superstar Saga | 4.3s |
| 5 | Dark Souls III | 4.2s |
| 6 | Super Mario Land 2 | 4.0s |
| 7 | Links Awakening DX | 4.0s |
| 8 | A Hat in Time | 3.9s |
| 9 | Yoshi's Island | 3.9s |
| 10 | Old School Runescape | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 20.7s |
| 2 | Dark Souls III | 19.8s |
| 3 | Mega Man 2 | 14.1s |
| 4 | The Messenger | 9.8s |
| 5 | Links Awakening DX | 8.8s |
| 6 | A Link to the Past | 8.7s |
| 7 | Mario & Luigi Superstar Saga | 7.7s |
| 8 | Heretic | 7.7s |
| 9 | DOOM II | 7.7s |
| 10 | Overcooked! 2 | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 19.8s |
| 2 | Satisfactory | 18.6s |
| 3 | Factorio | 14.4s |
| 4 | Shivers | 14.3s |
| 5 | Mega Man 2 | 14.1s |
| 6 | The Messenger | 9.8s |
| 7 | Links Awakening DX | 8.8s |
| 8 | A Link to the Past | 8.7s |
| 9 | Heretic | 7.7s |
| 10 | Mario & Luigi Superstar Saga | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 224.4s | 412.6s | 156.7s | 206.0s | 412.1s | 591.4s |
| Average | 3.6s | 6.7s | 2.5s | 3.3s | 6.6s | 9.5s |
| Max | 10.2s | 18.6s | 2.8s | 6.3s | 21.7s | 32.6s |
| Min | 2.8s | 5.4s | 2.3s | 2.6s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.2s) | Dark Souls III (18.6s) | APQuest (2.8s) | A Link to the Past (6.3s) | Satisfactory (21.7s) | Dark Souls III (32.6s) |
| Fastest | Donkey Kong Country 3 (2.8s) | Wargroove (5.4s) | Castlevania 64 (2.3s) | Wargroove (2.6s) | Lufia II Ancient Cave (5.4s) | Lufia II Ancient Cave (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.2s | 7.2s | 2.6s | 4.0s | 6.7s | 6.7s |
| A Link to the Past | 6.3s | 9.4s | 2.8s | 6.3s | 8.7s | 14.6s |
| A Short Hike | 2.9s | 6.2s | 2.5s | 3.0s | 5.6s | 5.6s |
| APQuest | 3.2s | 6.2s | 2.8s | 3.0s | 5.7s | 5.7s |
| Adventure | 2.9s | 8.6s | 2.5s | 2.9s | 5.6s | 5.6s |
| Aquaria | 4.0s | 6.3s | 2.5s | 3.3s | 5.6s | 5.7s |
| Baking Adventure | 2.8s | 9.1s | 2.5s | 3.0s | 5.7s | 14.3s |
| Bumper Stickers | 2.9s | 6.8s | 2.5s | 2.9s | 5.5s | 14.0s |
| Castlevania - Circle of the Moon | 3.1s | 6.9s | 2.5s | 3.3s | 5.5s | 5.5s |
| Castlevania 64 | 3.1s | 7.1s | 2.3s | 3.2s | 5.4s | 5.5s |
| Celeste 64 | 3.0s | 5.7s | 2.6s | 3.2s | 5.6s | 14.3s |
| ChecksFinder | 2.9s | 5.7s | 2.6s | 3.1s | 5.7s | 5.7s |
| Choo-Choo Charles | 3.0s | 7.8s | 2.5s | 2.9s | 7.6s | 7.8s |
| Civilization VI | 8.4s | 5.7s | 2.7s | 3.1s | 5.7s | 14.5s |
| Coding Adventure | 2.8s | 5.6s | 2.5s | 2.9s | 5.6s | 14.1s |
| DLCQuest | 3.2s | 5.6s | 2.5s | 2.9s | 5.6s | 5.6s |
| DOOM 1993 | 3.4s | 6.7s | 2.5s | 3.3s | 6.7s | 14.5s |
| DOOM II | 3.5s | 7.6s | 2.5s | 3.3s | 7.6s | 14.2s |
| Dark Souls III | 3.8s | 18.6s | 2.5s | 4.0s | 17.6s | 32.6s |
| Donkey Kong Country 3 | 2.8s | 5.5s | 2.3s | 2.9s | 5.4s | 14.0s |
| EarthBound | 3.8s | 5.7s | 2.6s | 3.7s | 5.7s | 5.7s |
| Factorio | 3.5s | 5.7s | 2.6s | 3.6s | 5.7s | 14.3s |
| Faxanadu | 2.9s | 5.6s | 2.5s | 2.9s | 5.6s | 14.1s |
| Final Fantasy Mystic Quest | 3.7s | 6.7s | 2.6s | 3.6s | 6.8s | 6.8s |
| Heretic | 3.4s | 7.7s | 2.5s | 3.3s | 7.6s | 14.3s |
| Hylics 2 | 3.1s | 5.7s | 2.5s | 3.0s | 5.6s | 5.6s |
| Inscryption | 3.0s | 5.6s | 2.6s | 3.0s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.7s | 2.5s | 3.2s | 5.5s | 5.5s |
| Links Awakening DX | 5.8s | 8.6s | 2.5s | 4.0s | 8.6s | 8.6s |
| Lufia II Ancient Cave | 3.0s | 5.5s | 2.3s | 2.9s | 5.4s | 5.4s |
| Mario & Luigi Superstar Saga | 3.8s | 7.7s | 2.5s | 4.3s | 7.7s | 7.7s |
| Math Adventure | 2.9s | 5.7s | 2.6s | 2.8s | 5.6s | 14.3s |
| Mega Man 2 | 2.9s | 5.6s | 2.5s | 2.9s | 14.2s | 14.2s |
| MegaMan Battle Network 3 | 3.6s | 5.7s | 2.7s | 3.2s | 5.7s | 14.6s |
| Meritous | 2.8s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| Metamath | 10.2s | 5.6s | 2.5s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.2s | 5.7s | 2.6s | 3.1s | 5.7s | 5.7s |
| Noita | 3.0s | 5.5s | 2.5s | 3.0s | 5.5s | 5.5s |
| Old School Runescape | 3.9s | 5.5s | 2.5s | 3.7s | 5.6s | 5.6s |
| Overcooked! 2 | 3.1s | 7.5s | 2.3s | 3.0s | 7.5s | 13.9s |
| Paint | 3.0s | 5.6s | 2.5s | 3.2s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.2s | 5.7s | 2.5s | 3.4s | 5.6s | 5.6s |
| Satisfactory | 4.7s | 14.6s | 2.5s | 4.0s | 21.7s | 15.6s |
| Saving Princess | 3.1s | 5.8s | 2.7s | 3.2s | 5.7s | 5.8s |
| Shivers | 3.1s | 5.6s | 2.5s | 3.0s | 5.6s | 14.2s |
| Sonic Adventure 2 Battle | 4.4s | 5.6s | 2.6s | 4.2s | 5.7s | 14.3s |
| Subnautica | 3.3s | 7.7s | 2.6s | 3.5s | 7.7s | 14.3s |
| Super Mario 64 | 3.3s | 5.6s | 2.5s | 3.2s | 5.5s | 5.6s |
| Super Mario Land 2 | 3.5s | 5.6s | 2.5s | 3.9s | 5.6s | 5.6s |
| Super Mario World | 4.2s | 5.5s | 2.3s | 3.0s | 5.5s | 5.5s |
| TOEM original | 3.0s | 5.7s | 2.6s | 3.0s | 5.6s | 5.6s |
| TOEM rule builder | 2.9s | 5.7s | 2.6s | 2.9s | 5.6s | 5.6s |
| Terraria | 3.0s | 7.6s | 2.5s | 2.9s | 7.6s | 7.6s |
| The Legend of Zelda | 3.8s | 5.7s | 2.7s | 3.3s | 5.7s | 14.5s |
| The Messenger | 3.2s | 9.7s | 2.5s | 3.2s | 9.8s | 9.8s |
| The Wind Waker | 5.2s | 5.6s | 2.5s | 5.3s | 5.7s | 14.6s |
| Timespinner | 4.1s | 5.7s | 2.6s | 3.9s | 5.7s | 5.7s |
| Undertale | 3.0s | 5.5s | 2.5s | 3.0s | 5.5s | 5.6s |
| VVVVVV | 2.9s | 5.5s | 2.4s | 3.0s | 5.6s | 5.6s |
| Wargroove | 2.8s | 5.4s | 2.3s | 2.6s | 5.4s | 5.4s |
| Yoshi's Island | 4.1s | 6.7s | 2.6s | 4.0s | 5.7s | 5.6s |
| shapez | 3.8s | 5.7s | 2.6s | 3.3s | 5.6s | 14.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.2s |
| 2 | Civilization VI | 8.4s |
| 3 | A Link to the Past | 6.3s |
| 4 | Links Awakening DX | 5.8s |
| 5 | The Wind Waker | 5.2s |
| 6 | Satisfactory | 4.7s |
| 7 | Sonic Adventure 2 Battle | 4.4s |
| 8 | A Hat in Time | 4.2s |
| 9 | Super Mario World | 4.2s |
| 10 | Timespinner | 4.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.6s |
| 2 | Satisfactory | 14.6s |
| 3 | The Messenger | 9.7s |
| 4 | A Link to the Past | 9.4s |
| 5 | Baking Adventure | 9.1s |
| 6 | Adventure | 8.6s |
| 7 | Links Awakening DX | 8.6s |
| 8 | Choo-Choo Charles | 7.8s |
| 9 | Mario & Luigi Superstar Saga | 7.7s |
| 10 | Subnautica | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | APQuest | 2.8s |
| 2 | A Link to the Past | 2.8s |
| 3 | Civilization VI | 2.7s |
| 4 | MegaMan Battle Network 3 | 2.7s |
| 5 | Saving Princess | 2.7s |
| 6 | The Legend of Zelda | 2.7s |
| 7 | Final Fantasy Mystic Quest | 2.6s |
| 8 | Sonic Adventure 2 Battle | 2.6s |
| 9 | Celeste 64 | 2.6s |
| 10 | Factorio | 2.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.3s |
| 2 | The Wind Waker | 5.3s |
| 3 | Mario & Luigi Superstar Saga | 4.3s |
| 4 | Sonic Adventure 2 Battle | 4.2s |
| 5 | Dark Souls III | 4.0s |
| 6 | Links Awakening DX | 4.0s |
| 7 | Satisfactory | 4.0s |
| 8 | A Hat in Time | 4.0s |
| 9 | Yoshi's Island | 4.0s |
| 10 | Timespinner | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.7s |
| 2 | Dark Souls III | 17.6s |
| 3 | Mega Man 2 | 14.2s |
| 4 | The Messenger | 9.8s |
| 5 | A Link to the Past | 8.7s |
| 6 | Links Awakening DX | 8.6s |
| 7 | Subnautica | 7.7s |
| 8 | Mario & Luigi Superstar Saga | 7.7s |
| 9 | Choo-Choo Charles | 7.6s |
| 10 | Heretic | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.6s |
| 2 | Satisfactory | 15.6s |
| 3 | A Link to the Past | 14.6s |
| 4 | The Wind Waker | 14.6s |
| 5 | MegaMan Battle Network 3 | 14.6s |
| 6 | Civilization VI | 14.5s |
| 7 | The Legend of Zelda | 14.5s |
| 8 | DOOM 1993 | 14.5s |
| 9 | shapez | 14.5s |
| 10 | Baking Adventure | 14.3s |
