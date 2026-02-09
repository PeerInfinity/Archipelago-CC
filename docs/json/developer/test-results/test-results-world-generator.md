# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-08 22:57:53 UTC

**Source Data Created:** 2026-02-08 22:51:10

**Source Data Last Updated:** 2026-02-08 22:51:10

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
| Stage 3: Rules Comparison | 50 | 12 | 62 |
| Stage 4: WorldGen Spoiler Test | 57 | 5 | 62 |
| Stage 5: Cross-Validation | 55 | 7 | 62 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
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
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
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
| Satisfactory | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |

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
| Stage 4: WorldGen Spoiler Test | 57 | 5 | 62 |
| Stage 5: Cross-Validation | 38 | 24 | 62 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
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
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
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
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 231.6s | 429.8s | 162.0s | 208.5s | 448.8s | 466.9s |
| Average | 3.7s | 6.9s | 2.6s | 3.4s | 7.2s | 7.5s |
| Max | 10.6s | 21.8s | 2.9s | 5.9s | 21.7s | 21.8s |
| Min | 2.8s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.6s) | Satisfactory (21.8s) | Mario & Luigi Superstar Saga (2.9s) | A Link to the Past (5.9s) | Satisfactory (21.7s) | Satisfactory (21.8s) |
| Fastest | Bumper Stickers (2.8s) | Noita (5.6s) | Undertale (2.5s) | Undertale (2.8s) | Undertale (5.6s) | Bumper Stickers (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 8.3s | 2.8s | 4.3s | 14.6s | 14.6s |
| A Link to the Past | 6.8s | 9.7s | 2.6s | 5.9s | 8.7s | 8.7s |
| A Short Hike | 3.0s | 6.2s | 2.5s | 3.1s | 5.7s | 5.6s |
| APQuest | 2.9s | 6.4s | 2.5s | 2.9s | 5.6s | 5.6s |
| Adventure | 3.0s | 8.7s | 2.6s | 3.0s | 5.6s | 5.7s |
| Aquaria | 4.1s | 9.7s | 2.6s | 3.4s | 5.7s | 5.7s |
| Baking Adventure | 2.9s | 8.8s | 2.6s | 2.9s | 5.6s | 5.7s |
| Bumper Stickers | 2.8s | 6.3s | 2.5s | 2.8s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.2s | 7.9s | 2.7s | 3.3s | 5.7s | 5.7s |
| Castlevania 64 | 3.5s | 9.3s | 2.7s | 3.6s | 5.6s | 5.6s |
| Celeste 64 | 3.2s | 5.7s | 2.7s | 3.4s | 5.8s | 5.7s |
| ChecksFinder | 3.0s | 5.7s | 2.5s | 2.9s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.0s | 7.7s | 2.6s | 3.0s | 7.7s | 7.7s |
| Civilization VI | 8.1s | 5.6s | 2.5s | 2.9s | 5.6s | 5.6s |
| Coding Adventure | 2.9s | 5.6s | 2.6s | 3.0s | 5.6s | 5.6s |
| DLCQuest | 3.1s | 5.6s | 2.6s | 3.0s | 5.7s | 5.6s |
| DOOM 1993 | 3.5s | 6.7s | 2.6s | 3.4s | 6.8s | 6.7s |
| DOOM II | 3.4s | 7.6s | 2.5s | 3.2s | 7.6s | 7.7s |
| Dark Souls III | 4.1s | 18.7s | 2.6s | 4.0s | 18.8s | 19.8s |
| Donkey Kong Country 3 | 3.2s | 5.7s | 2.6s | 3.2s | 5.7s | 5.7s |
| EarthBound | 4.1s | 5.8s | 2.7s | 4.0s | 5.8s | 5.8s |
| Factorio | 3.6s | 5.8s | 2.5s | 3.2s | 5.7s | 14.2s |
| Faxanadu | 3.0s | 5.8s | 2.5s | 2.9s | 14.2s | 14.2s |
| Final Fantasy Mystic Quest | 3.5s | 6.7s | 2.5s | 3.4s | 6.7s | 6.7s |
| Heretic | 3.5s | 7.7s | 2.6s | 3.4s | 7.7s | 7.7s |
| Hylics 2 | 3.2s | 5.6s | 2.6s | 3.0s | 5.6s | 5.6s |
| Inscryption | 3.0s | 5.6s | 2.6s | 3.0s | 5.6s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.2s | 5.6s | 2.5s | 3.0s | 5.6s | 5.6s |
| Links Awakening DX | 6.3s | 8.7s | 2.8s | 4.1s | 8.8s | 8.7s |
| Lufia II Ancient Cave | 3.3s | 5.6s | 2.7s | 3.4s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 4.1s | 7.8s | 2.9s | 4.6s | 7.8s | 7.8s |
| Math Adventure | 2.9s | 5.6s | 2.6s | 2.9s | 5.6s | 5.6s |
| Mega Man 2 | 3.0s | 5.6s | 2.6s | 2.9s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.1s | 5.6s | 2.6s | 2.9s | 5.7s | 5.7s |
| Meritous | 3.0s | 5.6s | 2.5s | 3.0s | 5.6s | 5.6s |
| Metamath | 10.6s | 5.7s | 2.6s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.2s | 5.7s | 2.6s | 3.2s | 5.7s | 5.7s |
| Noita | 2.9s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| Old School Runescape | 4.3s | 5.8s | 2.7s | 3.8s | 5.7s | 5.7s |
| Overcooked! 2 | 3.5s | 7.7s | 2.7s | 3.4s | 7.7s | 7.7s |
| Paint | 3.2s | 5.7s | 2.8s | 3.5s | 6.0s | 5.8s |
| Risk of Rain 2 | 3.4s | 5.6s | 2.5s | 3.4s | 5.7s | 5.7s |
| Satisfactory | 4.8s | 21.8s | 2.6s | 3.6s | 21.7s | 21.8s |
| Saving Princess | 2.9s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| Shivers | 3.2s | 5.6s | 2.6s | 3.2s | 5.6s | 14.3s |
| Sonic Adventure 2 Battle | 4.7s | 5.6s | 2.7s | 4.2s | 5.7s | 5.7s |
| Subnautica | 3.3s | 7.7s | 2.6s | 3.5s | 14.5s | 14.4s |
| Super Mario 64 | 3.2s | 5.6s | 2.5s | 3.0s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.8s | 5.7s | 2.7s | 4.0s | 5.8s | 5.8s |
| Super Mario World | 4.8s | 5.8s | 2.7s | 3.4s | 5.7s | 5.7s |
| TOEM original | 3.2s | 5.8s | 2.8s | 3.2s | 5.8s | 5.8s |
| TOEM rule builder | 2.9s | 5.6s | 2.7s | 3.0s | 5.7s | 5.6s |
| Terraria | 3.1s | 7.7s | 2.6s | 3.0s | 7.6s | 7.6s |
| The Legend of Zelda | 3.6s | 5.7s | 2.5s | 2.9s | 5.6s | 5.8s |
| The Messenger | 3.4s | 9.8s | 2.6s | 3.2s | 9.8s | 9.9s |
| The Wind Waker | 5.5s | 5.7s | 2.7s | 5.3s | 14.4s | 14.5s |
| Timespinner | 4.1s | 5.8s | 2.6s | 3.8s | 5.7s | 5.7s |
| Undertale | 2.9s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| VVVVVV | 3.1s | 5.7s | 2.6s | 3.1s | 5.7s | 5.7s |
| Wargroove | 3.1s | 5.7s | 2.7s | 3.1s | 5.6s | 5.7s |
| Yoshi's Island | 4.2s | 6.8s | 2.8s | 4.3s | 5.8s | 5.8s |
| shapez | 3.9s | 5.6s | 2.7s | 3.3s | 14.3s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.6s |
| 2 | Civilization VI | 8.1s |
| 3 | A Link to the Past | 6.8s |
| 4 | Links Awakening DX | 6.3s |
| 5 | The Wind Waker | 5.5s |
| 6 | Super Mario World | 4.8s |
| 7 | Satisfactory | 4.8s |
| 8 | Sonic Adventure 2 Battle | 4.7s |
| 9 | A Hat in Time | 4.5s |
| 10 | Old School Runescape | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.7s |
| 3 | The Messenger | 9.8s |
| 4 | Aquaria | 9.7s |
| 5 | A Link to the Past | 9.7s |
| 6 | Castlevania 64 | 9.3s |
| 7 | Baking Adventure | 8.8s |
| 8 | Adventure | 8.7s |
| 9 | Links Awakening DX | 8.7s |
| 10 | A Hat in Time | 8.3s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Mario & Luigi Superstar Saga | 2.9s |
| 2 | Yoshi's Island | 2.8s |
| 3 | A Hat in Time | 2.8s |
| 4 | Paint | 2.8s |
| 5 | Links Awakening DX | 2.8s |
| 6 | TOEM original | 2.8s |
| 7 | EarthBound | 2.7s |
| 8 | Old School Runescape | 2.7s |
| 9 | Castlevania - Circle of the Moon | 2.7s |
| 10 | Celeste 64 | 2.7s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.9s |
| 2 | The Wind Waker | 5.3s |
| 3 | Mario & Luigi Superstar Saga | 4.6s |
| 4 | A Hat in Time | 4.3s |
| 5 | Yoshi's Island | 4.3s |
| 6 | Sonic Adventure 2 Battle | 4.2s |
| 7 | Links Awakening DX | 4.1s |
| 8 | EarthBound | 4.0s |
| 9 | Super Mario Land 2 | 4.0s |
| 10 | Dark Souls III | 4.0s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.7s |
| 2 | Dark Souls III | 18.8s |
| 3 | A Hat in Time | 14.6s |
| 4 | Subnautica | 14.5s |
| 5 | The Wind Waker | 14.4s |
| 6 | shapez | 14.3s |
| 7 | Faxanadu | 14.2s |
| 8 | The Messenger | 9.8s |
| 9 | Links Awakening DX | 8.8s |
| 10 | A Link to the Past | 8.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 19.8s |
| 3 | A Hat in Time | 14.6s |
| 4 | The Wind Waker | 14.5s |
| 5 | Subnautica | 14.4s |
| 6 | Shivers | 14.3s |
| 7 | shapez | 14.3s |
| 8 | Factorio | 14.2s |
| 9 | Faxanadu | 14.2s |
| 10 | The Messenger | 9.9s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 223.9s | 417.4s | 156.0s | 203.3s | 445.4s | 590.2s |
| Average | 3.6s | 6.7s | 2.5s | 3.3s | 7.2s | 9.5s |
| Max | 10.8s | 21.8s | 2.6s | 5.7s | 21.7s | 32.7s |
| Min | 2.7s | 5.4s | 2.4s | 2.8s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.8s) | Satisfactory (21.8s) | Links Awakening DX (2.6s) | A Link to the Past (5.7s) | Satisfactory (21.7s) | Dark Souls III (32.7s) |
| Fastest | Baking Adventure (2.7s) | Timespinner (5.4s) | Timespinner (2.4s) | Baking Adventure (2.8s) | Baking Adventure (5.5s) | Inscryption (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.2s | 7.8s | 2.6s | 4.0s | 14.3s | 14.3s |
| A Link to the Past | 6.4s | 10.1s | 2.5s | 5.7s | 9.7s | 14.6s |
| A Short Hike | 3.0s | 7.2s | 2.5s | 3.1s | 5.6s | 5.6s |
| APQuest | 2.8s | 6.9s | 2.5s | 2.8s | 5.6s | 5.6s |
| Adventure | 3.0s | 8.2s | 2.5s | 3.1s | 5.8s | 5.6s |
| Aquaria | 4.1s | 6.2s | 2.5s | 3.3s | 5.6s | 5.6s |
| Baking Adventure | 2.7s | 5.9s | 2.4s | 2.8s | 5.5s | 13.8s |
| Bumper Stickers | 2.8s | 6.2s | 2.5s | 2.8s | 5.6s | 14.1s |
| Castlevania - Circle of the Moon | 3.2s | 6.9s | 2.5s | 3.2s | 5.7s | 5.7s |
| Castlevania 64 | 3.2s | 6.2s | 2.5s | 3.2s | 5.6s | 5.6s |
| Celeste 64 | 3.0s | 5.6s | 2.6s | 3.2s | 5.6s | 14.3s |
| ChecksFinder | 2.8s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.0s | 7.7s | 2.5s | 2.9s | 7.7s | 7.7s |
| Civilization VI | 8.0s | 5.8s | 2.5s | 2.9s | 5.6s | 14.2s |
| Coding Adventure | 2.9s | 5.6s | 2.6s | 2.9s | 5.7s | 14.4s |
| DLCQuest | 3.1s | 5.6s | 2.5s | 2.9s | 5.6s | 5.6s |
| DOOM 1993 | 3.2s | 6.5s | 2.4s | 3.2s | 6.5s | 14.1s |
| DOOM II | 3.4s | 7.7s | 2.5s | 3.2s | 7.7s | 14.3s |
| Dark Souls III | 4.0s | 18.7s | 2.6s | 4.0s | 17.7s | 32.7s |
| Donkey Kong Country 3 | 3.0s | 5.7s | 2.5s | 3.0s | 5.7s | 14.5s |
| EarthBound | 3.8s | 5.7s | 2.6s | 3.7s | 5.7s | 5.7s |
| Factorio | 3.5s | 5.7s | 2.5s | 3.2s | 5.6s | 14.3s |
| Faxanadu | 3.0s | 5.6s | 2.5s | 2.9s | 14.2s | 14.2s |
| Final Fantasy Mystic Quest | 3.4s | 6.7s | 2.5s | 3.2s | 6.7s | 6.8s |
| Heretic | 3.6s | 7.7s | 2.5s | 3.5s | 7.7s | 14.5s |
| Hylics 2 | 3.1s | 5.6s | 2.5s | 2.9s | 5.6s | 5.6s |
| Inscryption | 2.9s | 5.4s | 2.4s | 2.9s | 5.5s | 5.5s |
| Landstalker - The Treasures of King Nole | 3.2s | 6.0s | 2.5s | 3.0s | 5.6s | 5.6s |
| Links Awakening DX | 6.1s | 8.7s | 2.6s | 3.9s | 8.7s | 8.7s |
| Lufia II Ancient Cave | 3.1s | 5.6s | 2.5s | 3.0s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.8s | 7.7s | 2.6s | 4.3s | 7.7s | 7.7s |
| Math Adventure | 2.8s | 5.7s | 2.5s | 2.8s | 5.6s | 14.2s |
| Mega Man 2 | 3.0s | 5.6s | 2.5s | 3.0s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.1s | 5.6s | 2.5s | 2.8s | 5.6s | 14.3s |
| Meritous | 2.9s | 5.6s | 2.6s | 3.0s | 5.7s | 5.7s |
| Metamath | 10.8s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| Muse Dash | 3.0s | 5.5s | 2.4s | 3.1s | 5.5s | 5.5s |
| Noita | 2.9s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| Old School Runescape | 4.0s | 5.7s | 2.6s | 3.5s | 5.7s | 5.7s |
| Overcooked! 2 | 3.2s | 7.7s | 2.5s | 3.2s | 7.6s | 14.3s |
| Paint | 3.0s | 5.8s | 2.5s | 3.2s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.3s | 5.7s | 2.5s | 3.3s | 5.7s | 5.6s |
| Satisfactory | 4.9s | 21.8s | 2.6s | 4.1s | 21.7s | 15.6s |
| Saving Princess | 2.9s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| Shivers | 3.2s | 5.7s | 2.6s | 3.4s | 5.7s | 14.4s |
| Sonic Adventure 2 Battle | 4.3s | 5.7s | 2.5s | 4.2s | 5.7s | 14.2s |
| Subnautica | 3.1s | 7.5s | 2.4s | 3.3s | 14.0s | 14.0s |
| Super Mario 64 | 3.1s | 5.6s | 2.5s | 3.1s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.6s | 5.7s | 2.6s | 3.8s | 5.7s | 5.7s |
| Super Mario World | 4.3s | 5.6s | 2.5s | 3.1s | 5.6s | 5.6s |
| TOEM original | 3.0s | 5.7s | 2.6s | 3.0s | 5.7s | 5.6s |
| TOEM rule builder | 2.8s | 5.6s | 2.5s | 2.9s | 5.7s | 5.7s |
| Terraria | 3.0s | 7.7s | 2.5s | 3.0s | 7.7s | 7.7s |
| The Legend of Zelda | 3.5s | 5.6s | 2.5s | 2.9s | 5.6s | 14.3s |
| The Messenger | 3.4s | 9.8s | 2.6s | 3.6s | 9.9s | 9.9s |
| The Wind Waker | 5.2s | 5.8s | 2.5s | 5.2s | 14.3s | 14.3s |
| Timespinner | 3.9s | 5.4s | 2.4s | 3.8s | 5.5s | 5.5s |
| Undertale | 2.9s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| VVVVVV | 3.0s | 5.6s | 2.5s | 2.9s | 5.6s | 5.6s |
| Wargroove | 2.9s | 5.6s | 2.5s | 2.8s | 5.6s | 5.6s |
| Yoshi's Island | 4.0s | 5.7s | 2.6s | 3.9s | 5.7s | 5.7s |
| shapez | 3.7s | 5.7s | 2.5s | 3.2s | 14.2s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.8s |
| 2 | Civilization VI | 8.0s |
| 3 | A Link to the Past | 6.4s |
| 4 | Links Awakening DX | 6.1s |
| 5 | The Wind Waker | 5.2s |
| 6 | Satisfactory | 4.9s |
| 7 | Super Mario World | 4.3s |
| 8 | Sonic Adventure 2 Battle | 4.3s |
| 9 | A Hat in Time | 4.2s |
| 10 | Aquaria | 4.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.7s |
| 3 | A Link to the Past | 10.1s |
| 4 | The Messenger | 9.8s |
| 5 | Links Awakening DX | 8.7s |
| 6 | Adventure | 8.2s |
| 7 | A Hat in Time | 7.8s |
| 8 | Mario & Luigi Superstar Saga | 7.7s |
| 9 | Overcooked! 2 | 7.7s |
| 10 | Heretic | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Links Awakening DX | 2.6s |
| 2 | Mario & Luigi Superstar Saga | 2.6s |
| 3 | Dark Souls III | 2.6s |
| 4 | Old School Runescape | 2.6s |
| 5 | Super Mario Land 2 | 2.6s |
| 6 | The Messenger | 2.6s |
| 7 | A Hat in Time | 2.6s |
| 8 | Shivers | 2.6s |
| 9 | Yoshi's Island | 2.6s |
| 10 | Satisfactory | 2.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.7s |
| 2 | The Wind Waker | 5.2s |
| 3 | Mario & Luigi Superstar Saga | 4.3s |
| 4 | Sonic Adventure 2 Battle | 4.2s |
| 5 | Satisfactory | 4.1s |
| 6 | Dark Souls III | 4.0s |
| 7 | A Hat in Time | 4.0s |
| 8 | Yoshi's Island | 3.9s |
| 9 | Links Awakening DX | 3.9s |
| 10 | Super Mario Land 2 | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.7s |
| 2 | Dark Souls III | 17.7s |
| 3 | A Hat in Time | 14.3s |
| 4 | The Wind Waker | 14.3s |
| 5 | shapez | 14.2s |
| 6 | Faxanadu | 14.2s |
| 7 | Subnautica | 14.0s |
| 8 | The Messenger | 9.9s |
| 9 | A Link to the Past | 9.7s |
| 10 | Links Awakening DX | 8.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.7s |
| 2 | Satisfactory | 15.6s |
| 3 | A Link to the Past | 14.6s |
| 4 | Heretic | 14.5s |
| 5 | Donkey Kong Country 3 | 14.5s |
| 6 | Shivers | 14.4s |
| 7 | Coding Adventure | 14.4s |
| 8 | Overcooked! 2 | 14.3s |
| 9 | A Hat in Time | 14.3s |
| 10 | DOOM II | 14.3s |
