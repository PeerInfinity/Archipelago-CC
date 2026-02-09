# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-09 21:02:16 UTC

**Source Data Created:** 2026-02-09 21:02:16

**Source Data Last Updated:** 2026-02-09 21:02:16

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
| Stage 3: Rules Comparison | 62 | 0 | 62 |
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
| Total | 233.9s | 428.5s | 32.8s | 208.0s | 408.0s | 408.4s |
| Average | 3.8s | 6.9s | 0.5s | 3.4s | 6.6s | 6.6s |
| Max | 11.1s | 21.8s | 0.6s | 6.1s | 21.8s | 21.8s |
| Min | 2.7s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.1s) | Satisfactory (21.8s) | Dark Souls III (0.6s) | A Link to the Past (6.1s) | Satisfactory (21.8s) | Satisfactory (21.8s) |
| Fastest | Bumper Stickers (2.7s) | Muse Dash (5.5s) | Inscryption (0.5s) | Bumper Stickers (2.8s) | Baking Adventure (5.5s) | Baking Adventure (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.8s | 9.1s | 0.6s | 4.2s | 6.7s | 6.8s |
| A Link to the Past | 6.9s | 10.0s | 0.6s | 6.1s | 8.8s | 8.8s |
| A Short Hike | 3.0s | 7.0s | 0.5s | 3.1s | 5.7s | 5.7s |
| APQuest | 3.0s | 7.6s | 0.5s | 3.1s | 5.7s | 5.7s |
| Adventure | 3.0s | 8.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Aquaria | 4.2s | 6.1s | 0.5s | 3.2s | 5.6s | 5.6s |
| Baking Adventure | 2.8s | 7.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| Bumper Stickers | 2.7s | 7.4s | 0.5s | 2.8s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 3.4s | 9.8s | 0.6s | 3.4s | 5.7s | 5.7s |
| Castlevania 64 | 3.4s | 6.2s | 0.5s | 3.4s | 5.6s | 5.6s |
| Celeste 64 | 3.3s | 5.7s | 0.6s | 3.3s | 5.7s | 5.7s |
| ChecksFinder | 3.0s | 5.8s | 0.5s | 3.0s | 5.7s | 5.7s |
| Choo-Choo Charles | 3.0s | 7.7s | 0.5s | 3.0s | 7.7s | 7.7s |
| Civilization VI | 8.3s | 5.7s | 0.5s | 3.2s | 5.7s | 5.7s |
| Coding Adventure | 2.9s | 5.7s | 0.5s | 2.8s | 5.6s | 5.6s |
| DLCQuest | 3.1s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| DOOM 1993 | 3.4s | 6.5s | 0.5s | 3.2s | 6.6s | 6.6s |
| DOOM II | 3.3s | 7.6s | 0.5s | 3.1s | 7.6s | 7.6s |
| Dark Souls III | 4.3s | 18.8s | 0.6s | 4.1s | 19.8s | 19.8s |
| Donkey Kong Country 3 | 3.0s | 5.8s | 0.5s | 3.1s | 5.7s | 5.7s |
| EarthBound | 4.3s | 5.8s | 0.6s | 3.9s | 5.7s | 5.7s |
| Factorio | 3.7s | 5.7s | 0.6s | 3.4s | 5.7s | 5.7s |
| Faxanadu | 3.0s | 5.7s | 0.5s | 2.9s | 5.6s | 5.7s |
| Final Fantasy Mystic Quest | 3.9s | 6.8s | 0.6s | 3.5s | 6.7s | 6.7s |
| Heretic | 3.5s | 7.7s | 0.5s | 3.3s | 7.7s | 7.7s |
| Hylics 2 | 3.4s | 5.7s | 0.5s | 3.0s | 5.6s | 5.6s |
| Inscryption | 3.0s | 5.6s | 0.5s | 3.0s | 5.5s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.1s | 5.8s | 0.5s | 3.0s | 5.6s | 5.6s |
| Links Awakening DX | 6.5s | 8.8s | 0.6s | 4.0s | 8.8s | 8.8s |
| Lufia II Ancient Cave | 3.3s | 5.6s | 0.5s | 3.3s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 4.2s | 7.8s | 0.6s | 4.6s | 7.7s | 7.7s |
| Math Adventure | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Mega Man 2 | 3.0s | 5.8s | 0.5s | 3.0s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 3.4s | 5.7s | 0.5s | 3.1s | 5.7s | 5.7s |
| Meritous | 2.9s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Metamath | 11.1s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 5.5s | 0.5s | 3.2s | 5.5s | 5.6s |
| Noita | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Old School Runescape | 4.3s | 5.7s | 0.5s | 3.8s | 5.7s | 5.8s |
| Overcooked! 2 | 3.3s | 7.7s | 0.5s | 3.3s | 7.7s | 7.7s |
| Paint | 3.4s | 5.8s | 0.6s | 3.4s | 5.7s | 5.7s |
| Risk of Rain 2 | 3.5s | 5.7s | 0.5s | 3.5s | 5.7s | 5.7s |
| Satisfactory | 4.9s | 21.8s | 0.6s | 3.7s | 21.8s | 21.8s |
| Saving Princess | 3.1s | 5.8s | 0.5s | 3.0s | 5.6s | 5.6s |
| Shivers | 3.2s | 5.7s | 0.5s | 3.1s | 5.6s | 5.6s |
| Sonic Adventure 2 Battle | 4.5s | 5.7s | 0.6s | 4.2s | 5.7s | 5.7s |
| Subnautica | 3.1s | 7.6s | 0.5s | 3.5s | 7.5s | 7.5s |
| Super Mario 64 | 3.1s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.7s | 5.8s | 0.6s | 4.0s | 5.8s | 5.8s |
| Super Mario World | 4.4s | 5.6s | 0.5s | 3.3s | 5.7s | 5.6s |
| TOEM original | 3.3s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| TOEM rule builder | 3.1s | 5.7s | 0.6s | 3.0s | 5.7s | 5.7s |
| Terraria | 3.1s | 7.7s | 0.5s | 3.0s | 7.7s | 7.7s |
| The Legend of Zelda | 3.8s | 5.7s | 0.6s | 3.1s | 5.6s | 5.7s |
| The Messenger | 3.4s | 9.8s | 0.5s | 3.2s | 9.8s | 9.9s |
| The Wind Waker | 5.4s | 5.7s | 0.5s | 5.2s | 5.6s | 5.7s |
| Timespinner | 4.1s | 5.7s | 0.5s | 3.9s | 5.6s | 5.5s |
| Undertale | 2.9s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| VVVVVV | 3.1s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Wargroove | 3.0s | 5.8s | 0.5s | 2.9s | 5.7s | 5.7s |
| Yoshi's Island | 4.4s | 6.8s | 0.6s | 4.2s | 5.7s | 5.7s |
| shapez | 4.0s | 5.7s | 0.5s | 3.2s | 5.7s | 5.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.1s |
| 2 | Civilization VI | 8.3s |
| 3 | A Link to the Past | 6.9s |
| 4 | Links Awakening DX | 6.5s |
| 5 | The Wind Waker | 5.4s |
| 6 | Satisfactory | 4.9s |
| 7 | A Hat in Time | 4.8s |
| 8 | Sonic Adventure 2 Battle | 4.5s |
| 9 | Super Mario World | 4.4s |
| 10 | Yoshi's Island | 4.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.8s |
| 3 | A Link to the Past | 10.0s |
| 4 | Castlevania - Circle of the Moon | 9.8s |
| 5 | The Messenger | 9.8s |
| 6 | A Hat in Time | 9.1s |
| 7 | Links Awakening DX | 8.8s |
| 8 | Adventure | 8.6s |
| 9 | Mario & Luigi Superstar Saga | 7.8s |
| 10 | Choo-Choo Charles | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 0.6s |
| 2 | EarthBound | 0.6s |
| 3 | Mario & Luigi Superstar Saga | 0.6s |
| 4 | A Hat in Time | 0.6s |
| 5 | Links Awakening DX | 0.6s |
| 6 | Satisfactory | 0.6s |
| 7 | Yoshi's Island | 0.6s |
| 8 | A Link to the Past | 0.6s |
| 9 | Celeste 64 | 0.6s |
| 10 | Factorio | 0.6s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 6.1s |
| 2 | The Wind Waker | 5.2s |
| 3 | Mario & Luigi Superstar Saga | 4.6s |
| 4 | Sonic Adventure 2 Battle | 4.2s |
| 5 | A Hat in Time | 4.2s |
| 6 | Yoshi's Island | 4.2s |
| 7 | Dark Souls III | 4.1s |
| 8 | Links Awakening DX | 4.0s |
| 9 | Super Mario Land 2 | 4.0s |
| 10 | EarthBound | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 19.8s |
| 3 | The Messenger | 9.8s |
| 4 | Links Awakening DX | 8.8s |
| 5 | A Link to the Past | 8.8s |
| 6 | Mario & Luigi Superstar Saga | 7.7s |
| 7 | Choo-Choo Charles | 7.7s |
| 8 | Heretic | 7.7s |
| 9 | Terraria | 7.7s |
| 10 | Overcooked! 2 | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 19.8s |
| 3 | The Messenger | 9.9s |
| 4 | A Link to the Past | 8.8s |
| 5 | Links Awakening DX | 8.8s |
| 6 | Mario & Luigi Superstar Saga | 7.7s |
| 7 | Overcooked! 2 | 7.7s |
| 8 | Terraria | 7.7s |
| 9 | Choo-Choo Charles | 7.7s |
| 10 | Heretic | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 221.4s | 430.2s | 31.8s | 202.5s | 404.9s | 575.8s |
| Average | 3.6s | 6.9s | 0.5s | 3.3s | 6.5s | 9.3s |
| Max | 9.7s | 21.9s | 0.6s | 5.7s | 21.8s | 32.7s |
| Min | 2.7s | 5.5s | 0.5s | 2.7s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (9.7s) | Satisfactory (21.9s) | Satisfactory (0.6s) | A Link to the Past (5.7s) | Satisfactory (21.8s) | Dark Souls III (32.7s) |
| Fastest | Baking Adventure (2.7s) | The Legend of Zelda (5.5s) | Saving Princess (0.5s) | APQuest (2.7s) | APQuest (5.4s) | APQuest (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.0s | 8.2s | 0.5s | 3.9s | 6.7s | 6.7s |
| A Link to the Past | 6.7s | 11.0s | 0.6s | 5.7s | 8.7s | 14.4s |
| A Short Hike | 3.2s | 9.1s | 0.6s | 3.4s | 5.7s | 5.7s |
| APQuest | 2.7s | 7.3s | 0.5s | 2.7s | 5.4s | 5.4s |
| Adventure | 3.1s | 6.6s | 0.5s | 3.1s | 5.8s | 5.7s |
| Aquaria | 4.0s | 7.5s | 0.5s | 3.2s | 5.8s | 5.6s |
| Baking Adventure | 2.7s | 11.6s | 0.5s | 2.8s | 5.6s | 14.2s |
| Bumper Stickers | 2.8s | 9.3s | 0.5s | 2.8s | 5.6s | 14.3s |
| Castlevania - Circle of the Moon | 3.0s | 6.9s | 0.5s | 3.2s | 5.6s | 5.6s |
| Castlevania 64 | 3.0s | 7.1s | 0.5s | 3.1s | 5.7s | 5.6s |
| Celeste 64 | 3.0s | 5.8s | 0.5s | 3.0s | 5.7s | 14.2s |
| ChecksFinder | 3.0s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.2s | 7.8s | 0.6s | 3.3s | 7.8s | 7.8s |
| Civilization VI | 7.2s | 5.5s | 0.5s | 2.8s | 5.5s | 13.8s |
| Coding Adventure | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 14.4s |
| DLCQuest | 3.0s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| DOOM 1993 | 3.2s | 6.7s | 0.5s | 3.1s | 6.7s | 14.4s |
| DOOM II | 3.4s | 7.7s | 0.5s | 3.2s | 7.7s | 14.3s |
| Dark Souls III | 3.8s | 18.7s | 0.5s | 3.8s | 17.7s | 32.7s |
| Donkey Kong Country 3 | 2.9s | 5.6s | 0.5s | 2.9s | 5.6s | 14.1s |
| EarthBound | 3.7s | 5.7s | 0.5s | 3.4s | 5.6s | 5.7s |
| Factorio | 3.6s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Faxanadu | 3.2s | 5.7s | 0.6s | 3.1s | 5.7s | 14.4s |
| Final Fantasy Mystic Quest | 3.3s | 6.5s | 0.5s | 3.2s | 6.5s | 6.5s |
| Heretic | 3.7s | 7.7s | 0.6s | 3.5s | 7.8s | 14.5s |
| Hylics 2 | 3.1s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Inscryption | 2.9s | 5.6s | 0.5s | 3.0s | 5.6s | 5.7s |
| Landstalker - The Treasures of King Nole | 3.1s | 5.6s | 0.5s | 3.2s | 5.7s | 5.7s |
| Links Awakening DX | 5.9s | 8.7s | 0.5s | 3.9s | 8.7s | 8.7s |
| Lufia II Ancient Cave | 3.0s | 5.6s | 0.5s | 2.9s | 5.5s | 5.6s |
| Mario & Luigi Superstar Saga | 3.6s | 7.7s | 0.5s | 4.2s | 7.6s | 7.6s |
| Math Adventure | 2.9s | 5.8s | 0.5s | 2.9s | 5.6s | 14.1s |
| Mega Man 2 | 3.2s | 5.7s | 0.6s | 3.1s | 5.7s | 5.7s |
| MegaMan Battle Network 3 | 2.9s | 5.5s | 0.5s | 2.8s | 5.4s | 13.9s |
| Meritous | 3.0s | 5.7s | 0.5s | 3.0s | 5.7s | 5.7s |
| Metamath | 9.7s | 5.6s | 0.5s | 2.8s | 5.7s | 5.6s |
| Muse Dash | 3.0s | 5.6s | 0.5s | 3.1s | 5.7s | 5.7s |
| Noita | 2.9s | 5.6s | 0.5s | 2.9s | 5.7s | 5.6s |
| Old School Runescape | 3.8s | 5.6s | 0.5s | 3.6s | 5.7s | 5.7s |
| Overcooked! 2 | 3.0s | 7.6s | 0.5s | 3.1s | 7.6s | 14.2s |
| Paint | 2.9s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Risk of Rain 2 | 3.5s | 5.7s | 0.5s | 3.2s | 5.6s | 5.6s |
| Satisfactory | 5.1s | 21.9s | 0.6s | 4.4s | 21.8s | 17.8s |
| Saving Princess | 2.7s | 5.6s | 0.5s | 2.8s | 5.5s | 5.5s |
| Shivers | 3.3s | 5.7s | 0.5s | 3.3s | 5.7s | 14.5s |
| Sonic Adventure 2 Battle | 4.2s | 5.6s | 0.5s | 4.1s | 5.6s | 14.2s |
| Subnautica | 3.1s | 7.6s | 0.5s | 3.3s | 7.6s | 14.3s |
| Super Mario 64 | 3.2s | 5.6s | 0.5s | 3.1s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.5s | 5.7s | 0.5s | 3.9s | 5.7s | 5.8s |
| Super Mario World | 4.2s | 5.7s | 0.5s | 3.1s | 5.6s | 5.6s |
| TOEM original | 2.9s | 5.7s | 0.5s | 2.9s | 5.6s | 5.7s |
| TOEM rule builder | 3.0s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Terraria | 3.4s | 7.7s | 0.6s | 3.2s | 7.7s | 7.8s |
| The Legend of Zelda | 3.3s | 5.5s | 0.5s | 2.8s | 5.5s | 13.8s |
| The Messenger | 3.5s | 9.9s | 0.5s | 3.4s | 9.8s | 9.8s |
| The Wind Waker | 5.1s | 5.6s | 0.5s | 5.1s | 5.6s | 14.2s |
| Timespinner | 3.8s | 5.6s | 0.5s | 3.8s | 5.6s | 5.6s |
| Undertale | 3.0s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 2.8s | 5.6s | 0.5s | 3.1s | 5.7s | 5.7s |
| Wargroove | 2.7s | 5.6s | 0.5s | 2.7s | 5.6s | 5.6s |
| Yoshi's Island | 4.0s | 5.6s | 0.5s | 3.8s | 5.6s | 5.7s |
| shapez | 3.9s | 5.7s | 0.5s | 3.2s | 5.6s | 14.2s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 9.7s |
| 2 | Civilization VI | 7.2s |
| 3 | A Link to the Past | 6.7s |
| 4 | Links Awakening DX | 5.9s |
| 5 | The Wind Waker | 5.1s |
| 6 | Satisfactory | 5.1s |
| 7 | Sonic Adventure 2 Battle | 4.2s |
| 8 | Super Mario World | 4.2s |
| 9 | Aquaria | 4.0s |
| 10 | Yoshi's Island | 4.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.9s |
| 2 | Dark Souls III | 18.7s |
| 3 | Baking Adventure | 11.6s |
| 4 | A Link to the Past | 11.0s |
| 5 | The Messenger | 9.9s |
| 6 | Bumper Stickers | 9.3s |
| 7 | A Short Hike | 9.1s |
| 8 | Links Awakening DX | 8.7s |
| 9 | A Hat in Time | 8.2s |
| 10 | Choo-Choo Charles | 7.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 0.6s |
| 2 | Terraria | 0.6s |
| 3 | A Link to the Past | 0.6s |
| 4 | A Short Hike | 0.6s |
| 5 | Choo-Choo Charles | 0.6s |
| 6 | Faxanadu | 0.6s |
| 7 | Heretic | 0.6s |
| 8 | Mega Man 2 | 0.6s |
| 9 | Shivers | 0.5s |
| 10 | The Messenger | 0.5s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.7s |
| 2 | The Wind Waker | 5.1s |
| 3 | Satisfactory | 4.4s |
| 4 | Mario & Luigi Superstar Saga | 4.2s |
| 5 | Sonic Adventure 2 Battle | 4.1s |
| 6 | Super Mario Land 2 | 3.9s |
| 7 | A Hat in Time | 3.9s |
| 8 | Links Awakening DX | 3.9s |
| 9 | Timespinner | 3.8s |
| 10 | Dark Souls III | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 17.7s |
| 3 | The Messenger | 9.8s |
| 4 | A Link to the Past | 8.7s |
| 5 | Links Awakening DX | 8.7s |
| 6 | Choo-Choo Charles | 7.8s |
| 7 | Heretic | 7.8s |
| 8 | Terraria | 7.7s |
| 9 | DOOM II | 7.7s |
| 10 | Subnautica | 7.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.7s |
| 2 | Satisfactory | 17.8s |
| 3 | Heretic | 14.5s |
| 4 | Shivers | 14.5s |
| 5 | DOOM 1993 | 14.4s |
| 6 | A Link to the Past | 14.4s |
| 7 | Faxanadu | 14.4s |
| 8 | Coding Adventure | 14.4s |
| 9 | Bumper Stickers | 14.3s |
| 10 | DOOM II | 14.3s |
