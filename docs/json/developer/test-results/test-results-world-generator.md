# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-world-generator.md)

**Generated:** 2026-02-10 00:30:19 UTC

**Source Data Created:** 2026-02-10 00:30:19

**Source Data Last Updated:** 2026-02-10 00:30:19

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
| Total | 222.4s | 425.7s | 31.7s | 199.4s | 404.5s | 408.0s |
| Average | 3.6s | 6.9s | 0.5s | 3.2s | 6.5s | 6.6s |
| Max | 10.9s | 21.8s | 0.6s | 5.9s | 21.7s | 21.7s |
| Min | 2.7s | 5.6s | 0.5s | 2.7s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.9s) | Satisfactory (21.8s) | Satisfactory (0.6s) | A Link to the Past (5.9s) | Satisfactory (21.7s) | Satisfactory (21.7s) |
| Fastest | APQuest (2.7s) | Metamath (5.6s) | Saving Princess (0.5s) | APQuest (2.7s) | VVVVVV (5.6s) | Saving Princess (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.0s | 7.1s | 0.5s | 3.6s | 6.6s | 6.7s |
| A Link to the Past | 6.7s | 12.0s | 0.6s | 5.9s | 8.7s | 9.8s |
| A Short Hike | 2.9s | 8.1s | 0.5s | 3.1s | 5.6s | 5.6s |
| APQuest | 2.7s | 6.1s | 0.5s | 2.7s | 5.6s | 5.6s |
| Adventure | 2.8s | 7.0s | 0.5s | 2.8s | 5.6s | 5.6s |
| Aquaria | 4.0s | 6.3s | 0.5s | 3.2s | 5.6s | 5.6s |
| Baking Adventure | 2.9s | 6.5s | 0.5s | 2.9s | 5.6s | 5.6s |
| Bumper Stickers | 2.9s | 9.5s | 0.5s | 2.9s | 5.6s | 5.6s |
| Castlevania - Circle of the Moon | 2.9s | 6.2s | 0.5s | 3.0s | 5.6s | 5.6s |
| Castlevania 64 | 3.3s | 11.1s | 0.5s | 3.4s | 5.6s | 5.7s |
| Celeste 64 | 2.9s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| ChecksFinder | 2.9s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.0s | 7.6s | 0.5s | 3.0s | 7.7s | 7.7s |
| Civilization VI | 7.9s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Coding Adventure | 2.7s | 5.7s | 0.5s | 2.8s | 5.6s | 5.6s |
| DLCQuest | 3.1s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| DOOM 1993 | 3.5s | 6.8s | 0.5s | 3.3s | 6.7s | 6.7s |
| DOOM II | 3.5s | 7.6s | 0.5s | 3.2s | 7.6s | 7.7s |
| Dark Souls III | 3.7s | 18.7s | 0.5s | 3.6s | 18.7s | 18.7s |
| Donkey Kong Country 3 | 3.0s | 5.7s | 0.5s | 3.1s | 5.6s | 5.7s |
| EarthBound | 3.7s | 5.7s | 0.5s | 3.5s | 5.7s | 5.7s |
| Factorio | 3.5s | 5.7s | 0.5s | 3.3s | 5.7s | 5.6s |
| Faxanadu | 2.9s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Final Fantasy Mystic Quest | 3.4s | 6.6s | 0.5s | 3.2s | 6.6s | 6.6s |
| Heretic | 3.3s | 7.6s | 0.5s | 3.2s | 7.7s | 7.7s |
| Hylics 2 | 3.1s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Inscryption | 3.0s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.3s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Links Awakening DX | 5.8s | 8.7s | 0.5s | 3.5s | 8.7s | 8.7s |
| Lufia II Ancient Cave | 3.2s | 5.6s | 0.5s | 3.2s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.6s | 7.7s | 0.5s | 4.1s | 7.7s | 7.8s |
| Math Adventure | 2.9s | 5.6s | 0.5s | 2.9s | 5.7s | 5.7s |
| Mega Man 2 | 2.9s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.0s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Meritous | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Metamath | 10.9s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Muse Dash | 3.2s | 5.6s | 0.5s | 3.2s | 5.7s | 5.7s |
| Noita | 2.9s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Old School Runescape | 3.7s | 5.7s | 0.5s | 3.3s | 5.6s | 5.6s |
| Overcooked! 2 | 3.3s | 7.7s | 0.5s | 3.2s | 7.7s | 7.8s |
| Paint | 2.9s | 5.7s | 0.5s | 3.0s | 5.6s | 5.7s |
| Risk of Rain 2 | 3.4s | 5.6s | 0.5s | 3.5s | 5.7s | 5.7s |
| Satisfactory | 4.7s | 21.8s | 0.6s | 3.6s | 21.7s | 21.7s |
| Saving Princess | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Shivers | 3.0s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Sonic Adventure 2 Battle | 4.3s | 5.6s | 0.5s | 4.1s | 5.7s | 6.8s |
| Subnautica | 3.3s | 7.6s | 0.5s | 3.5s | 7.6s | 7.7s |
| Super Mario 64 | 3.3s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Super Mario Land 2 | 3.4s | 5.7s | 0.5s | 3.6s | 5.6s | 5.7s |
| Super Mario World | 4.4s | 5.7s | 0.5s | 3.3s | 5.7s | 5.6s |
| TOEM original | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| TOEM rule builder | 2.9s | 5.7s | 0.5s | 2.9s | 5.7s | 5.7s |
| Terraria | 3.0s | 7.7s | 0.5s | 3.0s | 7.7s | 7.7s |
| The Legend of Zelda | 3.5s | 5.8s | 0.5s | 2.9s | 5.6s | 5.6s |
| The Messenger | 3.1s | 9.9s | 0.5s | 3.0s | 8.7s | 9.8s |
| The Wind Waker | 5.1s | 5.6s | 0.5s | 5.2s | 5.6s | 5.6s |
| Timespinner | 4.1s | 5.7s | 0.5s | 3.9s | 5.7s | 5.7s |
| Undertale | 3.0s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Wargroove | 3.0s | 5.6s | 0.5s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 4.0s | 5.6s | 0.5s | 3.8s | 5.6s | 5.7s |
| shapez | 3.8s | 5.7s | 0.5s | 3.2s | 5.7s | 5.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.9s |
| 2 | Civilization VI | 7.9s |
| 3 | A Link to the Past | 6.7s |
| 4 | Links Awakening DX | 5.8s |
| 5 | The Wind Waker | 5.1s |
| 6 | Satisfactory | 4.7s |
| 7 | Super Mario World | 4.4s |
| 8 | Sonic Adventure 2 Battle | 4.3s |
| 9 | Timespinner | 4.1s |
| 10 | A Hat in Time | 4.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.8s |
| 2 | Dark Souls III | 18.7s |
| 3 | A Link to the Past | 12.0s |
| 4 | Castlevania 64 | 11.1s |
| 5 | The Messenger | 9.9s |
| 6 | Bumper Stickers | 9.5s |
| 7 | Links Awakening DX | 8.7s |
| 8 | A Short Hike | 8.1s |
| 9 | Overcooked! 2 | 7.7s |
| 10 | Mario & Luigi Superstar Saga | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 0.6s |
| 2 | A Link to the Past | 0.6s |
| 3 | Lufia II Ancient Cave | 0.5s |
| 4 | Mario & Luigi Superstar Saga | 0.5s |
| 5 | Dark Souls III | 0.5s |
| 6 | Links Awakening DX | 0.5s |
| 7 | Super Mario Land 2 | 0.5s |
| 8 | Castlevania 64 | 0.5s |
| 9 | DOOM 1993 | 0.5s |
| 10 | Factorio | 0.5s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.9s |
| 2 | The Wind Waker | 5.2s |
| 3 | Sonic Adventure 2 Battle | 4.1s |
| 4 | Mario & Luigi Superstar Saga | 4.1s |
| 5 | Timespinner | 3.9s |
| 6 | Yoshi's Island | 3.8s |
| 7 | Dark Souls III | 3.6s |
| 8 | A Hat in Time | 3.6s |
| 9 | Satisfactory | 3.6s |
| 10 | Super Mario Land 2 | 3.6s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.7s |
| 2 | Dark Souls III | 18.7s |
| 3 | The Messenger | 8.7s |
| 4 | A Link to the Past | 8.7s |
| 5 | Links Awakening DX | 8.7s |
| 6 | Overcooked! 2 | 7.7s |
| 7 | Mario & Luigi Superstar Saga | 7.7s |
| 8 | Choo-Choo Charles | 7.7s |
| 9 | Terraria | 7.7s |
| 10 | Heretic | 7.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.7s |
| 2 | Dark Souls III | 18.7s |
| 3 | A Link to the Past | 9.8s |
| 4 | The Messenger | 9.8s |
| 5 | Links Awakening DX | 8.7s |
| 6 | Overcooked! 2 | 7.8s |
| 7 | Mario & Luigi Superstar Saga | 7.8s |
| 8 | DOOM II | 7.7s |
| 9 | Terraria | 7.7s |
| 10 | Choo-Choo Charles | 7.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 219.2s | 420.6s | 30.9s | 196.4s | 400.9s | 569.8s |
| Average | 3.5s | 6.8s | 0.5s | 3.2s | 6.5s | 9.2s |
| Max | 11.3s | 20.6s | 0.6s | 5.9s | 21.5s | 32.7s |
| Min | 2.5s | 5.4s | 0.4s | 2.6s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.3s) | Satisfactory (20.6s) | Factorio (0.6s) | A Link to the Past (5.9s) | Satisfactory (21.5s) | Dark Souls III (32.7s) |
| Fastest | TOEM original (2.5s) | Yoshi's Island (5.4s) | TOEM original (0.4s) | TOEM original (2.6s) | TOEM original (5.4s) | TOEM original (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 3.6s | 7.0s | 0.5s | 3.5s | 6.4s | 6.4s |
| A Link to the Past | 6.5s | 11.6s | 0.6s | 5.9s | 8.7s | 14.4s |
| A Short Hike | 2.8s | 7.3s | 0.5s | 2.8s | 5.4s | 5.5s |
| APQuest | 2.8s | 6.1s | 0.5s | 2.7s | 5.6s | 5.6s |
| Adventure | 2.8s | 6.7s | 0.5s | 2.8s | 5.6s | 5.6s |
| Aquaria | 4.2s | 8.8s | 0.5s | 3.3s | 5.6s | 5.6s |
| Baking Adventure | 2.7s | 7.5s | 0.5s | 2.8s | 5.6s | 14.2s |
| Bumper Stickers | 2.8s | 8.9s | 0.5s | 2.8s | 5.5s | 14.5s |
| Castlevania - Circle of the Moon | 3.0s | 6.1s | 0.5s | 3.0s | 5.6s | 5.6s |
| Castlevania 64 | 3.4s | 9.6s | 0.5s | 3.4s | 5.7s | 5.6s |
| Celeste 64 | 2.6s | 5.5s | 0.4s | 2.7s | 5.4s | 13.7s |
| ChecksFinder | 2.9s | 5.7s | 0.5s | 2.8s | 5.6s | 5.7s |
| Choo-Choo Charles | 2.8s | 7.5s | 0.5s | 2.7s | 7.4s | 7.5s |
| Civilization VI | 8.1s | 5.6s | 0.5s | 2.8s | 5.6s | 14.2s |
| Coding Adventure | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 14.1s |
| DLCQuest | 3.2s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| DOOM 1993 | 3.3s | 6.6s | 0.5s | 3.2s | 6.7s | 14.5s |
| DOOM II | 3.3s | 7.5s | 0.5s | 3.2s | 7.5s | 13.9s |
| Dark Souls III | 3.7s | 18.7s | 0.5s | 3.7s | 17.7s | 32.7s |
| Donkey Kong Country 3 | 3.0s | 5.7s | 0.5s | 3.1s | 5.7s | 14.2s |
| EarthBound | 3.4s | 5.4s | 0.5s | 3.2s | 5.4s | 5.4s |
| Factorio | 3.8s | 5.7s | 0.6s | 3.2s | 5.7s | 5.7s |
| Faxanadu | 2.7s | 5.6s | 0.5s | 2.6s | 5.4s | 13.8s |
| Final Fantasy Mystic Quest | 3.4s | 6.7s | 0.5s | 3.2s | 6.7s | 6.7s |
| Heretic | 3.4s | 7.6s | 0.5s | 3.2s | 7.6s | 14.2s |
| Hylics 2 | 3.3s | 5.6s | 0.5s | 3.1s | 5.6s | 5.6s |
| Inscryption | 2.9s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.1s | 5.6s | 0.5s | 3.0s | 5.5s | 5.5s |
| Links Awakening DX | 5.8s | 8.7s | 0.5s | 3.6s | 8.6s | 8.7s |
| Lufia II Ancient Cave | 3.2s | 5.6s | 0.5s | 3.2s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.3s | 6.4s | 0.5s | 3.7s | 7.4s | 7.4s |
| Math Adventure | 2.9s | 5.6s | 0.5s | 2.8s | 5.6s | 14.2s |
| Mega Man 2 | 2.8s | 5.4s | 0.5s | 2.7s | 5.4s | 5.5s |
| MegaMan Battle Network 3 | 3.0s | 5.7s | 0.5s | 2.8s | 5.6s | 14.2s |
| Meritous | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Metamath | 11.3s | 5.6s | 0.5s | 3.0s | 5.6s | 5.6s |
| Muse Dash | 3.0s | 5.6s | 0.5s | 3.0s | 5.6s | 5.7s |
| Noita | 2.8s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| Old School Runescape | 3.8s | 5.6s | 0.5s | 3.4s | 5.6s | 5.6s |
| Overcooked! 2 | 3.3s | 7.7s | 0.5s | 3.3s | 7.7s | 14.4s |
| Paint | 2.6s | 5.4s | 0.4s | 2.7s | 5.4s | 5.4s |
| Risk of Rain 2 | 3.4s | 5.6s | 0.5s | 3.2s | 5.6s | 5.6s |
| Satisfactory | 4.4s | 20.6s | 0.5s | 3.9s | 21.5s | 15.1s |
| Saving Princess | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Shivers | 3.0s | 5.6s | 0.5s | 3.0s | 5.6s | 14.4s |
| Sonic Adventure 2 Battle | 4.5s | 5.7s | 0.5s | 4.4s | 5.7s | 14.2s |
| Subnautica | 3.3s | 7.7s | 0.5s | 3.4s | 7.6s | 14.2s |
| Super Mario 64 | 3.1s | 5.5s | 0.5s | 3.0s | 5.5s | 5.5s |
| Super Mario Land 2 | 3.5s | 5.7s | 0.5s | 3.6s | 5.7s | 5.6s |
| Super Mario World | 4.4s | 5.7s | 0.5s | 3.3s | 5.7s | 5.7s |
| TOEM original | 2.5s | 5.4s | 0.4s | 2.6s | 5.4s | 5.4s |
| TOEM rule builder | 2.9s | 5.7s | 0.5s | 2.8s | 5.6s | 5.6s |
| Terraria | 2.9s | 7.5s | 0.5s | 2.7s | 7.4s | 7.4s |
| The Legend of Zelda | 3.5s | 5.6s | 0.5s | 2.9s | 5.6s | 14.2s |
| The Messenger | 3.1s | 9.7s | 0.5s | 3.1s | 9.7s | 9.7s |
| The Wind Waker | 5.3s | 5.6s | 0.6s | 5.4s | 5.7s | 14.6s |
| Timespinner | 3.9s | 5.6s | 0.5s | 3.8s | 5.6s | 5.6s |
| Undertale | 2.9s | 5.5s | 0.5s | 2.8s | 5.5s | 5.5s |
| VVVVVV | 2.8s | 5.6s | 0.5s | 2.8s | 5.6s | 5.6s |
| Wargroove | 3.0s | 5.7s | 0.5s | 2.9s | 5.6s | 5.6s |
| Yoshi's Island | 3.5s | 5.4s | 0.5s | 3.5s | 5.4s | 5.4s |
| shapez | 3.8s | 5.8s | 0.5s | 3.2s | 5.7s | 14.2s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.3s |
| 2 | Civilization VI | 8.1s |
| 3 | A Link to the Past | 6.5s |
| 4 | Links Awakening DX | 5.8s |
| 5 | The Wind Waker | 5.3s |
| 6 | Sonic Adventure 2 Battle | 4.5s |
| 7 | Super Mario World | 4.4s |
| 8 | Satisfactory | 4.4s |
| 9 | Aquaria | 4.2s |
| 10 | Timespinner | 3.9s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 20.6s |
| 2 | Dark Souls III | 18.7s |
| 3 | A Link to the Past | 11.6s |
| 4 | The Messenger | 9.7s |
| 5 | Castlevania 64 | 9.6s |
| 6 | Bumper Stickers | 8.9s |
| 7 | Aquaria | 8.8s |
| 8 | Links Awakening DX | 8.7s |
| 9 | Overcooked! 2 | 7.7s |
| 10 | Subnautica | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Factorio | 0.6s |
| 2 | A Link to the Past | 0.6s |
| 3 | The Wind Waker | 0.6s |
| 4 | Sonic Adventure 2 Battle | 0.5s |
| 5 | Aquaria | 0.5s |
| 6 | DLCQuest | 0.5s |
| 7 | DOOM 1993 | 0.5s |
| 8 | Dark Souls III | 0.5s |
| 9 | Overcooked! 2 | 0.5s |
| 10 | Risk of Rain 2 | 0.5s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.9s |
| 2 | The Wind Waker | 5.4s |
| 3 | Sonic Adventure 2 Battle | 4.4s |
| 4 | Satisfactory | 3.9s |
| 5 | Timespinner | 3.8s |
| 6 | Mario & Luigi Superstar Saga | 3.7s |
| 7 | Dark Souls III | 3.7s |
| 8 | Super Mario Land 2 | 3.6s |
| 9 | Links Awakening DX | 3.6s |
| 10 | A Hat in Time | 3.5s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Satisfactory | 21.5s |
| 2 | Dark Souls III | 17.7s |
| 3 | The Messenger | 9.7s |
| 4 | A Link to the Past | 8.7s |
| 5 | Links Awakening DX | 8.6s |
| 6 | Overcooked! 2 | 7.7s |
| 7 | Heretic | 7.6s |
| 8 | Subnautica | 7.6s |
| 9 | DOOM II | 7.5s |
| 10 | Mario & Luigi Superstar Saga | 7.4s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.7s |
| 2 | Satisfactory | 15.1s |
| 3 | The Wind Waker | 14.6s |
| 4 | DOOM 1993 | 14.5s |
| 5 | Bumper Stickers | 14.5s |
| 6 | A Link to the Past | 14.4s |
| 7 | Overcooked! 2 | 14.4s |
| 8 | Shivers | 14.4s |
| 9 | Donkey Kong Country 3 | 14.2s |
| 10 | Heretic | 14.2s |
