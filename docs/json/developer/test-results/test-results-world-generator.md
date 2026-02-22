# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-22 16:19:48 UTC

**Source Data Created:** 2026-02-22 16:19:47

**Source Data Last Updated:** 2026-02-22 16:19:47

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
| Original Spoiler Test | 61 | 1 | 62 |
| Stage 1: World Generation | 62 | 0 | 62 |
| Stage 2: Seed Generation | 61 | 1 | 62 |
| Stage 3: Rules Comparison | 51 | 10 | 61 |
| Stage 4: WorldGen Spoiler Test | 61 | 0 | 61 |
| Stage 5: Cross-Validation | 58 | 3 | 61 |

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
| VVVVVV | ✅ | ❌ | ✅ | ❌ | - | - | - |
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
| Original Spoiler Test | 61 | 1 | 62 |
| Stage 1: World Generation | 62 | 0 | 62 |
| Stage 2: Seed Generation | 61 | 1 | 62 |
| Stage 3: Rules Comparison | 0 | 61 | 61 |
| Stage 4: WorldGen Spoiler Test | 61 | 0 | 61 |
| Stage 5: Cross-Validation | 42 | 19 | 61 |

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
| VVVVVV | ✅ | ❌ | ✅ | ❌ | - | - | - |
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
| Total | 233.5s | 446.5s | 33.0s | 207.6s | 399.8s | 427.0s |
| Average | 3.8s | 7.2s | 0.5s | 3.3s | 6.6s | 7.0s |
| Max | 10.9s | 21.8s | 0.6s | 6.0s | 21.8s | 21.8s |
| Min | 2.8s | 5.4s | 0.5s | 2.7s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.9s) | Satisfactory (21.8s) | Dark Souls III (0.6s) | A Link to the Past (6.0s) | Satisfactory (21.8s) | Satisfactory (21.8s) |
| Fastest | Noita (2.8s) | Undertale (5.4s) | Undertale (0.5s) | Bumper Stickers (2.7s) | Undertale (5.4s) | Undertale (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.3s | 10.4s | 0.5s | 3.6s | 6.6s | 6.8s |
| A Link to the Past | 7.3s | 12.2s | 0.6s | 6.0s | 8.8s | 8.8s |
| A Short Hike | 3.5s | 9.0s | 0.5s | 3.1s | 5.7s | 5.7s |
| APQuest | 3.4s | 6.6s | 0.5s | 3.1s | 5.7s | 5.7s |
| Adventure | 3.4s | 9.5s | 0.5s | 3.0s | 5.6s | 5.6s |
| Aquaria | 4.5s | 8.9s | 0.5s | 3.3s | 5.6s | 5.6s |
| Baking Adventure | 3.3s | 9.7s | 0.5s | 2.9s | 5.6s | 14.2s |
| Bumper Stickers | 3.0s | 8.8s | 0.5s | 2.7s | 5.4s | 5.4s |
| Castlevania - Circle of the Moon | 3.9s | 9.5s | 0.6s | 3.5s | 5.7s | 5.8s |
| Castlevania 64 | 3.8s | 8.9s | 0.5s | 3.4s | 5.7s | 5.6s |
| Celeste 64 | 3.0s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| ChecksFinder | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Choo-Choo Charles | 3.1s | 7.7s | 0.6s | 3.2s | 7.7s | 7.7s |
| Civilization VI | 8.2s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| Coding Adventure | 2.8s | 5.7s | 0.5s | 2.8s | 5.7s | 14.2s |
| DLCQuest | 3.0s | 5.7s | 0.5s | 2.9s | 5.6s | 5.6s |
| DOOM 1993 | 3.4s | 6.7s | 0.5s | 3.2s | 6.7s | 6.7s |
| DOOM II | 3.2s | 7.5s | 0.5s | 3.0s | 7.4s | 7.5s |
| Dark Souls III | 4.3s | 18.8s | 0.6s | 4.3s | 18.8s | 19.9s |
| Donkey Kong Country 3 | 3.1s | 5.7s | 0.5s | 3.1s | 5.7s | 5.7s |
| EarthBound | 3.6s | 5.6s | 0.5s | 3.7s | 5.7s | 5.7s |
| Factorio | 3.9s | 5.7s | 0.6s | 3.5s | 5.7s | 5.7s |
| Faxanadu | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Final Fantasy Mystic Quest | 3.9s | 6.9s | 0.6s | 3.6s | 6.7s | 6.7s |
| Heretic | 3.4s | 7.8s | 0.5s | 3.2s | 7.7s | 7.7s |
| Hylics 2 | 3.1s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Inscryption | 3.0s | 5.6s | 0.5s | 3.1s | 5.8s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.0s | 5.6s | 0.5s | 2.9s | 5.4s | 5.4s |
| Links Awakening DX | 6.4s | 8.8s | 0.6s | 4.1s | 8.8s | 8.8s |
| Lufia II Ancient Cave | 3.2s | 5.7s | 0.5s | 3.2s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 3.6s | 6.6s | 0.5s | 4.2s | 7.7s | 7.7s |
| Math Adventure | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 14.3s |
| Mega Man 2 | 3.1s | 5.7s | 0.5s | 3.1s | 5.6s | 5.7s |
| MegaMan Battle Network 3 | 3.3s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| Meritous | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Metamath | 10.9s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 5.7s | 0.5s | 3.1s | 5.6s | 5.7s |
| Noita | 2.8s | 5.4s | 0.5s | 2.8s | 5.4s | 5.4s |
| Old School Runescape | 4.3s | 5.8s | 0.6s | 4.0s | 5.8s | 5.8s |
| Overcooked! 2 | 3.3s | 7.7s | 0.5s | 3.2s | 7.7s | 7.7s |
| Paint | 3.0s | 5.6s | 0.5s | 3.5s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.6s | 5.7s | 0.5s | 3.5s | 5.7s | 5.7s |
| Satisfactory | 4.8s | 21.8s | 0.6s | 3.8s | 21.8s | 21.8s |
| Saving Princess | 3.2s | 5.7s | 0.5s | 3.1s | 5.7s | 5.7s |
| Shivers | 3.2s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Sonic Adventure 2 Battle | 4.2s | 5.8s | 0.5s | 3.9s | 5.6s | 5.6s |
| Subnautica | 3.4s | 7.6s | 0.5s | 3.5s | 7.6s | 7.7s |
| Super Mario 64 | 3.1s | 5.4s | 0.5s | 2.9s | 5.4s | 5.4s |
| Super Mario Land 2 | 4.1s | 5.8s | 0.6s | 4.0s | 5.8s | 5.8s |
| Super Mario World | 4.4s | 5.6s | 0.5s | 3.3s | 5.7s | 5.7s |
| TOEM original | 2.9s | 5.6s | 0.5s | 3.1s | 5.7s | 5.7s |
| TOEM rule builder | 3.2s | 5.7s | 0.5s | 3.1s | 5.7s | 5.7s |
| Terraria | 3.1s | 7.7s | 0.5s | 3.1s | 7.7s | 7.7s |
| The Legend of Zelda | 4.0s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| The Messenger | 3.2s | 8.8s | 0.5s | 3.1s | 8.8s | 8.8s |
| The Wind Waker | 5.2s | 5.6s | 0.5s | 5.3s | 5.6s | 5.6s |
| Timespinner | 4.0s | 5.6s | 0.5s | 3.9s | 5.7s | 5.6s |
| Undertale | 2.8s | 5.4s | 0.5s | 2.7s | 5.4s | 5.4s |
| VVVVVV | 3.2s | 14.4s | 0.6s | 2.8s | - | - |
| Wargroove | 2.9s | 5.6s | 0.5s | 3.0s | 5.7s | 5.6s |
| Yoshi's Island | 3.8s | 5.6s | 0.5s | 4.4s | 5.8s | 5.7s |
| shapez | 3.9s | 5.7s | 0.6s | 3.5s | 5.7s | 5.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.9s |
| 2 | Civilization VI | 8.2s |
| 3 | A Link to the Past | 7.3s |
| 4 | Links Awakening DX | 6.4s |
| 5 | The Wind Waker | 5.2s |
| 6 | Satisfactory | 4.8s |
| 7 | Aquaria | 4.5s |
| 8 | Super Mario World | 4.4s |
| 9 | A Hat in Time | 4.3s |
| 10 | Dark Souls III | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.8s |
| 3 | VVVVVV | 14.4s |
| 4 | A Link to the Past | 12.2s |
| 5 | A Hat in Time | 10.4s |
| 6 | Baking Adventure | 9.7s |
| 7 | Castlevania - Circle of the Moon | 9.5s |
| 8 | Adventure | 9.5s |
| 9 | A Short Hike | 9.0s |
| 10 | Aquaria | 8.9s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 0.6s |
| 2 | Super Mario Land 2 | 0.6s |
| 3 | The Legend of Zelda | 0.6s |
| 4 | A Link to the Past | 0.6s |
| 5 | Links Awakening DX | 0.6s |
| 6 | Satisfactory | 0.6s |
| 7 | Castlevania - Circle of the Moon | 0.6s |
| 8 | Final Fantasy Mystic Quest | 0.6s |
| 9 | Old School Runescape | 0.6s |
| 10 | Civilization VI | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.0s |
| 2 | The Wind Waker | 5.3s |
| 3 | Yoshi's Island | 4.4s |
| 4 | Dark Souls III | 4.3s |
| 5 | Mario & Luigi Superstar Saga | 4.2s |
| 6 | Links Awakening DX | 4.1s |
| 7 | Super Mario Land 2 | 4.0s |
| 8 | Old School Runescape | 4.0s |
| 9 | Sonic Adventure 2 Battle | 3.9s |
| 10 | Timespinner | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.8s |
| 3 | Links Awakening DX | 8.8s |
| 4 | The Messenger | 8.8s |
| 5 | A Link to the Past | 8.8s |
| 6 | Choo-Choo Charles | 7.7s |
| 7 | Heretic | 7.7s |
| 8 | Terraria | 7.7s |
| 9 | Overcooked! 2 | 7.7s |
| 10 | Mario & Luigi Superstar Saga | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 19.9s |
| 3 | Math Adventure | 14.3s |
| 4 | Baking Adventure | 14.2s |
| 5 | Coding Adventure | 14.2s |
| 6 | Links Awakening DX | 8.8s |
| 7 | A Link to the Past | 8.8s |
| 8 | The Messenger | 8.8s |
| 9 | Mario & Luigi Superstar Saga | 7.7s |
| 10 | Overcooked! 2 | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 235.3s | 443.9s | 33.2s | 207.7s | 398.6s | 542.5s |
| Average | 3.8s | 7.2s | 0.5s | 3.3s | 6.5s | 8.9s |
| Max | 10.1s | 20.8s | 0.6s | 5.8s | 21.8s | 32.8s |
| Min | 2.7s | 5.5s | 0.5s | 2.7s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.1s) | Satisfactory (20.8s) | TOEM original (0.6s) | A Link to the Past (5.8s) | Satisfactory (21.8s) | Dark Souls III (32.8s) |
| Fastest | Meritous (2.7s) | Shivers (5.5s) | Shivers (0.5s) | VVVVVV (2.7s) | Coding Adventure (5.4s) | Adventure (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.0s | 10.5s | 0.6s | 4.5s | 6.8s | 6.8s |
| A Link to the Past | 7.0s | 12.2s | 0.6s | 5.8s | 8.7s | 14.5s |
| A Short Hike | 3.5s | 8.4s | 0.5s | 3.0s | 5.6s | 5.6s |
| APQuest | 3.3s | 6.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Adventure | 3.4s | 8.2s | 0.5s | 2.9s | 5.4s | 5.4s |
| Aquaria | 4.8s | 9.3s | 0.5s | 3.5s | 5.7s | 5.7s |
| Baking Adventure | 3.3s | 8.4s | 0.5s | 2.9s | 5.6s | 5.7s |
| Bumper Stickers | 3.4s | 7.7s | 0.5s | 2.9s | 5.6s | 14.3s |
| Castlevania - Circle of the Moon | 3.5s | 7.7s | 0.5s | 3.2s | 5.6s | 5.7s |
| Castlevania 64 | 3.9s | 11.0s | 0.5s | 3.7s | 5.7s | 5.7s |
| Celeste 64 | 3.4s | 5.8s | 0.5s | 3.2s | 5.8s | 14.3s |
| ChecksFinder | 2.9s | 5.6s | 0.5s | 2.9s | 5.7s | 5.6s |
| Choo-Choo Charles | 3.0s | 7.8s | 0.5s | 3.0s | 7.7s | 7.6s |
| Civilization VI | 8.1s | 5.7s | 0.5s | 3.0s | 5.7s | 14.3s |
| Coding Adventure | 2.8s | 5.5s | 0.5s | 2.7s | 5.4s | 5.4s |
| DLCQuest | 3.2s | 5.8s | 0.6s | 3.1s | 5.7s | 5.7s |
| DOOM 1993 | 3.5s | 6.7s | 0.6s | 3.4s | 6.7s | 14.3s |
| DOOM II | 3.4s | 7.7s | 0.5s | 3.3s | 7.7s | 14.7s |
| Dark Souls III | 4.1s | 18.7s | 0.6s | 4.0s | 17.7s | 32.8s |
| Donkey Kong Country 3 | 3.3s | 5.7s | 0.5s | 3.3s | 5.7s | 14.7s |
| EarthBound | 4.2s | 5.8s | 0.6s | 3.5s | 5.7s | 5.7s |
| Factorio | 3.6s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| Faxanadu | 2.9s | 5.7s | 0.5s | 2.9s | 5.6s | 14.2s |
| Final Fantasy Mystic Quest | 3.7s | 6.7s | 0.6s | 3.4s | 6.7s | 6.7s |
| Heretic | 3.4s | 7.5s | 0.5s | 3.3s | 7.5s | 13.9s |
| Hylics 2 | 3.2s | 5.7s | 0.5s | 3.2s | 5.7s | 5.7s |
| Inscryption | 3.0s | 5.8s | 0.5s | 3.2s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.2s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Links Awakening DX | 6.1s | 8.7s | 0.6s | 3.9s | 8.7s | 8.7s |
| Lufia II Ancient Cave | 3.3s | 5.7s | 0.5s | 3.4s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 4.1s | 7.8s | 0.6s | 4.1s | 7.7s | 6.7s |
| Math Adventure | 2.9s | 5.7s | 0.5s | 2.9s | 5.6s | 5.7s |
| Mega Man 2 | 3.1s | 5.7s | 0.5s | 3.0s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.2s | 5.7s | 0.5s | 3.0s | 5.7s | 14.4s |
| Meritous | 2.7s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| Metamath | 10.1s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.2s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| Noita | 2.9s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Old School Runescape | 4.0s | 5.7s | 0.6s | 3.7s | 5.7s | 5.7s |
| Overcooked! 2 | 3.4s | 7.7s | 0.6s | 3.4s | 7.7s | 14.4s |
| Paint | 3.5s | 5.9s | 0.6s | 3.3s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.3s | 5.7s | 0.5s | 3.3s | 5.6s | 5.7s |
| Satisfactory | 4.7s | 20.8s | 0.6s | 4.1s | 21.8s | 15.6s |
| Saving Princess | 2.9s | 5.6s | 0.5s | 3.0s | 5.7s | 5.7s |
| Shivers | 3.1s | 5.5s | 0.5s | 3.0s | 5.5s | 14.1s |
| Sonic Adventure 2 Battle | 4.5s | 5.7s | 0.5s | 4.4s | 5.7s | 14.4s |
| Subnautica | 3.5s | 7.7s | 0.5s | 3.6s | 7.7s | 14.4s |
| Super Mario 64 | 3.2s | 5.7s | 0.5s | 3.1s | 5.6s | 5.7s |
| Super Mario Land 2 | 3.7s | 5.7s | 0.6s | 3.9s | 5.7s | 5.8s |
| Super Mario World | 4.6s | 5.7s | 0.5s | 3.5s | 5.7s | 5.7s |
| TOEM original | 3.4s | 5.8s | 0.6s | 2.9s | 5.6s | 5.6s |
| TOEM rule builder | 3.0s | 5.6s | 0.5s | 2.9s | 5.7s | 5.7s |
| Terraria | 3.0s | 7.7s | 0.5s | 3.1s | 7.7s | 7.7s |
| The Legend of Zelda | 3.7s | 5.7s | 0.6s | 3.0s | 5.6s | 14.4s |
| The Messenger | 3.2s | 8.6s | 0.5s | 3.1s | 8.6s | 8.6s |
| The Wind Waker | 5.6s | 5.7s | 0.6s | 5.6s | 5.7s | 14.3s |
| Timespinner | 4.3s | 5.7s | 0.6s | 3.9s | 5.6s | 5.7s |
| Undertale | 3.0s | 5.6s | 0.5s | 2.9s | 5.7s | 5.6s |
| VVVVVV | 3.0s | 14.2s | 0.5s | 2.7s | - | - |
| Wargroove | 3.1s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| Yoshi's Island | 4.4s | 5.8s | 0.6s | 3.8s | 5.7s | 5.6s |
| shapez | 3.8s | 5.8s | 0.6s | 3.2s | 5.7s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.1s |
| 2 | Civilization VI | 8.1s |
| 3 | A Link to the Past | 7.0s |
| 4 | Links Awakening DX | 6.1s |
| 5 | The Wind Waker | 5.6s |
| 6 | A Hat in Time | 5.0s |
| 7 | Aquaria | 4.8s |
| 8 | Satisfactory | 4.7s |
| 9 | Super Mario World | 4.6s |
| 10 | Sonic Adventure 2 Battle | 4.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 20.8s |
| 2 | Dark Souls III | 18.7s |
| 3 | VVVVVV | 14.2s |
| 4 | A Link to the Past | 12.2s |
| 5 | Castlevania 64 | 11.0s |
| 6 | A Hat in Time | 10.5s |
| 7 | Aquaria | 9.3s |
| 8 | Links Awakening DX | 8.7s |
| 9 | The Messenger | 8.6s |
| 10 | A Short Hike | 8.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | TOEM original | 0.6s |
| 2 | Yoshi's Island | 0.6s |
| 3 | Satisfactory | 0.6s |
| 4 | A Hat in Time | 0.6s |
| 5 | A Link to the Past | 0.6s |
| 6 | EarthBound | 0.6s |
| 7 | Mario & Luigi Superstar Saga | 0.6s |
| 8 | Paint | 0.6s |
| 9 | Dark Souls III | 0.6s |
| 10 | Links Awakening DX | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.8s |
| 2 | The Wind Waker | 5.6s |
| 3 | A Hat in Time | 4.5s |
| 4 | Sonic Adventure 2 Battle | 4.4s |
| 5 | Mario & Luigi Superstar Saga | 4.1s |
| 6 | Satisfactory | 4.1s |
| 7 | Dark Souls III | 4.0s |
| 8 | Links Awakening DX | 3.9s |
| 9 | Super Mario Land 2 | 3.9s |
| 10 | Timespinner | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 17.7s |
| 3 | Links Awakening DX | 8.7s |
| 4 | A Link to the Past | 8.7s |
| 5 | The Messenger | 8.6s |
| 6 | Overcooked! 2 | 7.7s |
| 7 | Subnautica | 7.7s |
| 8 | Choo-Choo Charles | 7.7s |
| 9 | Mario & Luigi Superstar Saga | 7.7s |
| 10 | Terraria | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.8s |
| 2 | Satisfactory | 15.6s |
| 3 | Donkey Kong Country 3 | 14.7s |
| 4 | DOOM II | 14.7s |
| 5 | A Link to the Past | 14.5s |
| 6 | Overcooked! 2 | 14.4s |
| 7 | MegaMan Battle Network 3 | 14.4s |
| 8 | Subnautica | 14.4s |
| 9 | Sonic Adventure 2 Battle | 14.4s |
| 10 | The Legend of Zelda | 14.4s |
