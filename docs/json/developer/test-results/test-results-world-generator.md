# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-13 02:04:08 UTC

**Source Data Created:** 2026-02-13 02:04:07

**Source Data Last Updated:** 2026-02-13 02:04:07

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
| Stage 3: Rules Comparison | 61 | 1 | 62 |
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
| Total | 226.6s | 434.7s | 33.5s | 204.3s | 408.1s | 409.5s |
| Average | 3.7s | 7.0s | 0.5s | 3.3s | 6.6s | 6.6s |
| Max | 11.2s | 21.6s | 0.6s | 5.7s | 20.5s | 21.5s |
| Min | 2.8s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.2s) | Satisfactory (21.6s) | Dark Souls III (0.6s) | A Link to the Past (5.7s) | Satisfactory (20.5s) | Satisfactory (21.5s) |
| Fastest | Math Adventure (2.8s) | Mega Man 2 (5.5s) | Mega Man 2 (0.5s) | Metamath (2.8s) | A Short Hike (5.5s) | Mega Man 2 (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.1s | 11.8s | 0.5s | 3.9s | 6.8s | 6.7s |
| A Link to the Past | 6.4s | 11.9s | 0.6s | 5.7s | 8.7s | 8.7s |
| A Short Hike | 2.9s | 6.7s | 0.5s | 3.0s | 5.5s | 5.5s |
| APQuest | 2.8s | 6.8s | 0.5s | 2.8s | 5.7s | 5.7s |
| Adventure | 3.0s | 7.3s | 0.5s | 3.0s | 5.7s | 5.7s |
| Aquaria | 3.9s | 6.1s | 0.5s | 3.0s | 5.6s | 5.7s |
| Baking Adventure | 2.8s | 7.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Bumper Stickers | 2.8s | 10.4s | 0.5s | 2.8s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.5s | 8.4s | 0.6s | 3.5s | 5.8s | 5.8s |
| Castlevania 64 | 3.3s | 8.0s | 0.6s | 3.4s | 5.7s | 5.7s |
| Celeste 64 | 2.9s | 5.7s | 0.5s | 3.1s | 5.7s | 5.8s |
| ChecksFinder | 2.8s | 5.7s | 0.5s | 2.8s | 5.7s | 5.7s |
| Choo-Choo Charles | 2.9s | 7.5s | 0.5s | 2.8s | 7.5s | 7.5s |
| Civilization VI | 8.2s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Coding Adventure | 2.9s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| DLCQuest | 3.0s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| DOOM 1993 | 3.4s | 6.7s | 0.6s | 3.3s | 6.7s | 6.7s |
| DOOM II | 3.5s | 7.7s | 0.5s | 3.2s | 7.7s | 7.7s |
| Dark Souls III | 4.3s | 18.9s | 0.6s | 4.4s | 19.8s | 19.8s |
| Donkey Kong Country 3 | 3.1s | 5.7s | 0.5s | 3.1s | 5.7s | 5.7s |
| EarthBound | 3.6s | 5.7s | 0.6s | 3.7s | 5.8s | 5.8s |
| Factorio | 3.5s | 5.7s | 0.5s | 3.2s | 5.7s | 5.7s |
| Faxanadu | 2.8s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| Final Fantasy Mystic Quest | 3.5s | 6.8s | 0.5s | 3.4s | 6.8s | 6.8s |
| Heretic | 3.5s | 7.7s | 0.6s | 3.4s | 7.7s | 7.7s |
| Hylics 2 | 3.0s | 5.7s | 0.5s | 2.9s | 5.6s | 5.6s |
| Inscryption | 3.0s | 5.9s | 0.5s | 3.0s | 5.7s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.2s | 5.7s | 0.5s | 3.1s | 5.6s | 5.7s |
| Links Awakening DX | 6.4s | 9.0s | 0.6s | 4.1s | 8.9s | 8.9s |
| Lufia II Ancient Cave | 3.2s | 5.7s | 0.5s | 3.2s | 5.7s | 5.8s |
| Mario & Luigi Superstar Saga | 3.8s | 7.7s | 0.6s | 4.5s | 7.7s | 7.7s |
| Math Adventure | 2.8s | 5.7s | 0.5s | 2.8s | 5.7s | 5.7s |
| Mega Man 2 | 2.8s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| MegaMan Battle Network 3 | 3.2s | 5.8s | 0.6s | 2.9s | 5.7s | 5.7s |
| Meritous | 3.0s | 5.8s | 0.5s | 3.0s | 5.7s | 5.7s |
| Metamath | 11.2s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 5.8s | 0.5s | 3.2s | 5.7s | 5.7s |
| Noita | 2.9s | 5.7s | 0.5s | 2.9s | 5.6s | 5.6s |
| Old School Runescape | 4.4s | 5.8s | 0.6s | 3.9s | 5.8s | 5.8s |
| Overcooked! 2 | 3.3s | 7.7s | 0.6s | 3.4s | 7.7s | 7.8s |
| Paint | 3.0s | 5.7s | 0.5s | 3.2s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.2s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| Satisfactory | 4.5s | 21.6s | 0.5s | 3.4s | 20.5s | 21.5s |
| Saving Princess | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Shivers | 3.2s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| Sonic Adventure 2 Battle | 4.3s | 5.6s | 0.5s | 3.9s | 5.7s | 5.7s |
| Subnautica | 3.2s | 7.7s | 0.5s | 3.4s | 7.7s | 7.7s |
| Super Mario 64 | 3.2s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.9s | 5.8s | 0.6s | 4.1s | 5.9s | 5.8s |
| Super Mario World | 4.4s | 5.7s | 0.5s | 3.4s | 5.7s | 5.7s |
| TOEM original | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| TOEM rule builder | 2.9s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Terraria | 2.9s | 7.5s | 0.5s | 2.8s | 7.5s | 7.5s |
| The Legend of Zelda | 3.7s | 5.7s | 0.6s | 3.0s | 5.7s | 5.7s |
| The Messenger | 3.4s | 9.8s | 0.6s | 3.3s | 9.8s | 9.8s |
| The Wind Waker | 5.0s | 5.6s | 0.5s | 5.6s | 5.6s | 5.6s |
| Timespinner | 4.0s | 5.7s | 0.6s | 3.9s | 5.7s | 5.7s |
| Undertale | 3.0s | 5.6s | 0.5s | 2.9s | 5.7s | 5.6s |
| VVVVVV | 3.2s | 5.8s | 0.6s | 3.2s | 5.8s | 5.8s |
| Wargroove | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Yoshi's Island | 4.1s | 6.8s | 0.6s | 4.0s | 5.7s | 5.7s |
| shapez | 3.8s | 5.7s | 0.5s | 3.2s | 5.7s | 5.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.2s |
| 2 | Civilization VI | 8.2s |
| 3 | Links Awakening DX | 6.4s |
| 4 | A Link to the Past | 6.4s |
| 5 | The Wind Waker | 5.0s |
| 6 | Satisfactory | 4.5s |
| 7 | Super Mario World | 4.4s |
| 8 | Old School Runescape | 4.4s |
| 9 | Sonic Adventure 2 Battle | 4.3s |
| 10 | Dark Souls III | 4.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.6s |
| 2 | Dark Souls III | 18.9s |
| 3 | A Link to the Past | 11.9s |
| 4 | A Hat in Time | 11.8s |
| 5 | Bumper Stickers | 10.4s |
| 6 | The Messenger | 9.8s |
| 7 | Links Awakening DX | 9.0s |
| 8 | Castlevania - Circle of the Moon | 8.4s |
| 9 | Castlevania 64 | 8.0s |
| 10 | Heretic | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 0.6s |
| 2 | Super Mario Land 2 | 0.6s |
| 3 | Links Awakening DX | 0.6s |
| 4 | Castlevania - Circle of the Moon | 0.6s |
| 5 | Mario & Luigi Superstar Saga | 0.6s |
| 6 | MegaMan Battle Network 3 | 0.6s |
| 7 | Old School Runescape | 0.6s |
| 8 | A Link to the Past | 0.6s |
| 9 | Heretic | 0.6s |
| 10 | DOOM 1993 | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.7s |
| 2 | The Wind Waker | 5.6s |
| 3 | Mario & Luigi Superstar Saga | 4.5s |
| 4 | Dark Souls III | 4.4s |
| 5 | Links Awakening DX | 4.1s |
| 6 | Super Mario Land 2 | 4.1s |
| 7 | Yoshi's Island | 4.0s |
| 8 | Old School Runescape | 3.9s |
| 9 | A Hat in Time | 3.9s |
| 10 | Sonic Adventure 2 Battle | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 20.5s |
| 2 | Dark Souls III | 19.8s |
| 3 | The Messenger | 9.8s |
| 4 | Links Awakening DX | 8.9s |
| 5 | A Link to the Past | 8.7s |
| 6 | Overcooked! 2 | 7.7s |
| 7 | Mario & Luigi Superstar Saga | 7.7s |
| 8 | Heretic | 7.7s |
| 9 | Subnautica | 7.7s |
| 10 | DOOM II | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.5s |
| 2 | Dark Souls III | 19.8s |
| 3 | The Messenger | 9.8s |
| 4 | Links Awakening DX | 8.9s |
| 5 | A Link to the Past | 8.7s |
| 6 | Overcooked! 2 | 7.8s |
| 7 | Mario & Luigi Superstar Saga | 7.7s |
| 8 | Subnautica | 7.7s |
| 9 | Heretic | 7.7s |
| 10 | DOOM II | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 222.5s | 434.7s | 33.1s | 202.5s | 405.9s | 550.6s |
| Average | 3.6s | 7.0s | 0.5s | 3.3s | 6.5s | 8.9s |
| Max | 10.1s | 21.9s | 0.6s | 5.5s | 21.8s | 32.7s |
| Min | 2.6s | 5.4s | 0.5s | 2.7s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.1s) | Satisfactory (21.9s) | Satisfactory (0.6s) | A Link to the Past (5.5s) | Satisfactory (21.8s) | Dark Souls III (32.7s) |
| Fastest | ChecksFinder (2.6s) | Math Adventure (5.4s) | Math Adventure (0.5s) | ChecksFinder (2.7s) | shapez (5.5s) | ChecksFinder (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 3.9s | 10.2s | 0.5s | 3.9s | 6.7s | 6.7s |
| A Link to the Past | 6.0s | 12.2s | 0.5s | 5.5s | 8.5s | 14.4s |
| A Short Hike | 3.0s | 10.1s | 0.5s | 3.0s | 5.7s | 5.7s |
| APQuest | 2.8s | 7.8s | 0.5s | 2.8s | 5.7s | 5.7s |
| Adventure | 2.9s | 8.4s | 0.5s | 2.9s | 5.7s | 5.7s |
| Aquaria | 4.1s | 6.4s | 0.6s | 3.2s | 5.7s | 5.7s |
| Baking Adventure | 2.7s | 10.4s | 0.5s | 2.7s | 5.6s | 5.6s |
| Bumper Stickers | 3.1s | 9.4s | 0.6s | 2.9s | 5.7s | 14.4s |
| Castlevania - Circle of the Moon | 3.4s | 6.3s | 0.6s | 3.5s | 5.6s | 5.7s |
| Castlevania 64 | 3.4s | 6.3s | 0.6s | 3.5s | 5.7s | 5.7s |
| Celeste 64 | 2.9s | 5.7s | 0.5s | 3.0s | 5.8s | 14.3s |
| ChecksFinder | 2.6s | 5.4s | 0.5s | 2.7s | 5.5s | 5.5s |
| Choo-Choo Charles | 3.0s | 7.7s | 0.6s | 3.0s | 7.7s | 7.7s |
| Civilization VI | 8.0s | 5.7s | 0.5s | 2.9s | 5.7s | 14.3s |
| Coding Adventure | 2.9s | 5.7s | 0.5s | 2.8s | 5.7s | 5.7s |
| DLCQuest | 3.1s | 5.7s | 0.5s | 2.8s | 5.7s | 5.7s |
| DOOM 1993 | 3.2s | 6.7s | 0.5s | 3.1s | 6.6s | 14.3s |
| DOOM II | 3.7s | 7.8s | 0.6s | 3.4s | 7.7s | 14.4s |
| Dark Souls III | 4.1s | 18.8s | 0.6s | 4.3s | 17.8s | 32.7s |
| Donkey Kong Country 3 | 3.2s | 5.7s | 0.5s | 3.3s | 5.7s | 14.4s |
| EarthBound | 3.6s | 5.7s | 0.5s | 3.5s | 5.7s | 5.7s |
| Factorio | 3.3s | 5.5s | 0.5s | 3.1s | 5.5s | 5.5s |
| Faxanadu | 2.9s | 5.7s | 0.5s | 2.8s | 5.7s | 14.3s |
| Final Fantasy Mystic Quest | 3.4s | 6.7s | 0.6s | 3.2s | 6.7s | 6.7s |
| Heretic | 3.4s | 7.8s | 0.6s | 3.3s | 7.7s | 14.5s |
| Hylics 2 | 3.1s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Inscryption | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.4s | 5.7s | 0.5s | 3.3s | 5.7s | 5.8s |
| Links Awakening DX | 6.2s | 8.9s | 0.6s | 4.0s | 8.6s | 8.6s |
| Lufia II Ancient Cave | 3.3s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 7.7s | 0.6s | 4.2s | 7.7s | 7.7s |
| Math Adventure | 2.6s | 5.4s | 0.5s | 2.7s | 5.5s | 5.5s |
| Mega Man 2 | 2.9s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 3.1s | 5.7s | 0.5s | 2.9s | 5.7s | 14.3s |
| Meritous | 2.8s | 5.6s | 0.5s | 2.9s | 5.7s | 5.7s |
| Metamath | 10.1s | 5.7s | 0.5s | 2.8s | 5.7s | 5.7s |
| Muse Dash | 3.0s | 5.6s | 0.5s | 3.0s | 5.7s | 5.6s |
| Noita | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Old School Runescape | 4.2s | 5.7s | 0.5s | 3.6s | 5.6s | 5.6s |
| Overcooked! 2 | 3.4s | 7.8s | 0.6s | 3.4s | 7.7s | 14.6s |
| Paint | 2.9s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.1s | 5.5s | 0.5s | 3.1s | 5.5s | 5.5s |
| Satisfactory | 4.6s | 21.9s | 0.6s | 4.2s | 21.8s | 15.7s |
| Saving Princess | 2.8s | 5.6s | 0.5s | 2.8s | 5.7s | 5.7s |
| Shivers | 3.1s | 5.7s | 0.6s | 3.2s | 5.7s | 14.4s |
| Sonic Adventure 2 Battle | 4.3s | 5.7s | 0.5s | 4.1s | 5.7s | 14.4s |
| Subnautica | 3.1s | 7.7s | 0.5s | 3.3s | 7.7s | 14.3s |
| Super Mario 64 | 3.4s | 5.7s | 0.5s | 3.2s | 5.7s | 5.8s |
| Super Mario Land 2 | 3.9s | 5.7s | 0.6s | 3.9s | 5.6s | 5.6s |
| Super Mario World | 4.5s | 5.9s | 0.6s | 3.3s | 5.7s | 5.7s |
| TOEM original | 2.9s | 5.6s | 0.5s | 2.8s | 5.7s | 5.7s |
| TOEM rule builder | 2.7s | 5.5s | 0.5s | 2.7s | 5.5s | 5.5s |
| Terraria | 3.0s | 7.7s | 0.5s | 2.9s | 7.7s | 7.7s |
| The Legend of Zelda | 3.6s | 5.7s | 0.6s | 3.0s | 5.7s | 14.3s |
| The Messenger | 3.2s | 10.0s | 0.6s | 3.2s | 9.8s | 9.8s |
| The Wind Waker | 5.2s | 5.7s | 0.6s | 5.5s | 5.7s | 14.5s |
| Timespinner | 3.8s | 5.8s | 0.5s | 3.6s | 5.7s | 5.7s |
| Undertale | 3.1s | 5.7s | 0.6s | 2.9s | 5.7s | 5.7s |
| VVVVVV | 3.2s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Wargroove | 3.0s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Yoshi's Island | 3.8s | 5.7s | 0.6s | 3.8s | 5.7s | 5.7s |
| shapez | 3.6s | 5.5s | 0.5s | 3.1s | 5.5s | 13.9s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.1s |
| 2 | Civilization VI | 8.0s |
| 3 | Links Awakening DX | 6.2s |
| 4 | A Link to the Past | 6.0s |
| 5 | The Wind Waker | 5.2s |
| 6 | Satisfactory | 4.6s |
| 7 | Super Mario World | 4.5s |
| 8 | Sonic Adventure 2 Battle | 4.3s |
| 9 | Old School Runescape | 4.2s |
| 10 | Dark Souls III | 4.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.9s |
| 2 | Dark Souls III | 18.8s |
| 3 | A Link to the Past | 12.2s |
| 4 | Baking Adventure | 10.4s |
| 5 | A Hat in Time | 10.2s |
| 6 | A Short Hike | 10.1s |
| 7 | The Messenger | 10.0s |
| 8 | Bumper Stickers | 9.4s |
| 9 | Links Awakening DX | 8.9s |
| 10 | Adventure | 8.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 0.6s |
| 2 | DOOM II | 0.6s |
| 3 | The Legend of Zelda | 0.6s |
| 4 | Bumper Stickers | 0.6s |
| 5 | Links Awakening DX | 0.6s |
| 6 | Mario & Luigi Superstar Saga | 0.6s |
| 7 | Shivers | 0.6s |
| 8 | Aquaria | 0.6s |
| 9 | Castlevania - Circle of the Moon | 0.6s |
| 10 | Castlevania 64 | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.5s |
| 2 | The Wind Waker | 5.5s |
| 3 | Dark Souls III | 4.3s |
| 4 | Satisfactory | 4.2s |
| 5 | Mario & Luigi Superstar Saga | 4.2s |
| 6 | Sonic Adventure 2 Battle | 4.1s |
| 7 | Links Awakening DX | 4.0s |
| 8 | A Hat in Time | 3.9s |
| 9 | Super Mario Land 2 | 3.9s |
| 10 | Yoshi's Island | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 17.8s |
| 3 | The Messenger | 9.8s |
| 4 | Links Awakening DX | 8.6s |
| 5 | A Link to the Past | 8.5s |
| 6 | Overcooked! 2 | 7.7s |
| 7 | Choo-Choo Charles | 7.7s |
| 8 | Heretic | 7.7s |
| 9 | DOOM II | 7.7s |
| 10 | Terraria | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.7s |
| 2 | Satisfactory | 15.7s |
| 3 | Overcooked! 2 | 14.6s |
| 4 | The Wind Waker | 14.5s |
| 5 | Heretic | 14.5s |
| 6 | DOOM II | 14.4s |
| 7 | Donkey Kong Country 3 | 14.4s |
| 8 | Sonic Adventure 2 Battle | 14.4s |
| 9 | Shivers | 14.4s |
| 10 | Bumper Stickers | 14.4s |
