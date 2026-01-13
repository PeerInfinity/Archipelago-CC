# World Generator Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

**Generated:** 2026-01-13 03:59:27 UTC

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

**Total Templates:** 60

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 60 | 0 | 60 |
| Original Spoiler Test | 60 | 0 | 60 |
| Stage 1: World Generation | 0 | 60 | 60 |
| Stage 2: Seed Generation | 0 | 60 | 60 |
| Stage 3: Rules Comparison | 0 | 0 | 0 |
| Stage 4: WorldGen Spoiler Test | 0 | 0 | 0 |
| Stage 5: Cross-Validation | 0 | 0 | 0 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | Rules Comp | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ❌ | - | - | - | - |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - | - |
| A Short Hike | ✅ | ✅ | ❌ | - | - | - | - |
| APQuest | ✅ | ✅ | ❌ | - | - | - | - |
| Adventure | ✅ | ✅ | ❌ | - | - | - | - |
| Aquaria | ✅ | ✅ | ❌ | - | - | - | - |
| Baking Adventure | ✅ | ✅ | ❌ | - | - | - | - |
| Bumper Stickers | ✅ | ✅ | ❌ | - | - | - | - |
| Castlevania - Circle of the Moon | ✅ | ✅ | ❌ | - | - | - | - |
| Castlevania 64 | ✅ | ✅ | ❌ | - | - | - | - |
| Celeste 64 | ✅ | ✅ | ❌ | - | - | - | - |
| ChecksFinder | ✅ | ✅ | ❌ | - | - | - | - |
| Choo-Choo Charles | ✅ | ✅ | ❌ | - | - | - | - |
| Civilization VI | ✅ | ✅ | ❌ | - | - | - | - |
| Coding Adventure | ✅ | ✅ | ❌ | - | - | - | - |
| DLCQuest | ✅ | ✅ | ❌ | - | - | - | - |
| DOOM 1993 | ✅ | ✅ | ❌ | - | - | - | - |
| DOOM II | ✅ | ✅ | ❌ | - | - | - | - |
| Dark Souls III | ✅ | ✅ | ❌ | - | - | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - | - |
| Factorio | ✅ | ✅ | ❌ | - | - | - | - |
| Faxanadu | ✅ | ✅ | ❌ | - | - | - | - |
| Final Fantasy Mystic Quest | ✅ | ✅ | ❌ | - | - | - | - |
| Heretic | ✅ | ✅ | ❌ | - | - | - | - |
| Hylics 2 | ✅ | ✅ | ❌ | - | - | - | - |
| Inscryption | ✅ | ✅ | ❌ | - | - | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ❌ | - | - | - | - |
| Links Awakening DX | ✅ | ✅ | ❌ | - | - | - | - |
| Lufia II Ancient Cave | ✅ | ✅ | ❌ | - | - | - | - |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ❌ | - | - | - | - |
| Math Adventure | ✅ | ✅ | ❌ | - | - | - | - |
| Mega Man 2 | ✅ | ✅ | ❌ | - | - | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ❌ | - | - | - | - |
| Meritous | ✅ | ✅ | ❌ | - | - | - | - |
| Metamath | ✅ | ✅ | ❌ | - | - | - | - |
| Muse Dash | ✅ | ✅ | ❌ | - | - | - | - |
| Noita | ✅ | ✅ | ❌ | - | - | - | - |
| Old School Runescape | ✅ | ✅ | ❌ | - | - | - | - |
| Overcooked! 2 | ✅ | ✅ | ❌ | - | - | - | - |
| Paint | ✅ | ✅ | ❌ | - | - | - | - |
| Risk of Rain 2 | ✅ | ✅ | ❌ | - | - | - | - |
| Saving Princess | ✅ | ✅ | ❌ | - | - | - | - |
| Shivers | ✅ | ✅ | ❌ | - | - | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ❌ | - | - | - | - |
| Subnautica | ✅ | ✅ | ❌ | - | - | - | - |
| Super Mario 64 | ✅ | ✅ | ❌ | - | - | - | - |
| Super Mario Land 2 | ✅ | ✅ | ❌ | - | - | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - | - |
| TOEM original | ✅ | ✅ | ❌ | - | - | - | - |
| TOEM rule builder | ✅ | ✅ | ❌ | - | - | - | - |
| Terraria | ✅ | ✅ | ❌ | - | - | - | - |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - | - |
| The Messenger | ✅ | ✅ | ❌ | - | - | - | - |
| The Wind Waker | ✅ | ✅ | ❌ | - | - | - | - |
| Timespinner | ✅ | ✅ | ❌ | - | - | - | - |
| Undertale | ✅ | ✅ | ❌ | - | - | - | - |
| VVVVVV | ✅ | ✅ | ❌ | - | - | - | - |
| Wargroove | ✅ | ✅ | ❌ | - | - | - | - |
| Yoshi's Island | ✅ | ✅ | ❌ | - | - | - | - |
| shapez | ✅ | ✅ | ❌ | - | - | - | - |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 60

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 60 | 0 | 60 |
| Original Spoiler Test | 60 | 0 | 60 |
| Stage 1: World Generation | 60 | 0 | 60 |
| Stage 2: Seed Generation | 60 | 0 | 60 |
| Stage 3: Rules Comparison | 0 | 60 | 60 |
| Stage 4: WorldGen Spoiler Test | 60 | 0 | 60 |
| Stage 5: Cross-Validation | 38 | 22 | 60 |

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
| Factorio | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Error |
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
| Total | 213.8s | 403.2s | 5.3s | 0.0s | 0.0s | 0.0s |
| Average | 3.6s | 6.7s | 0.1s | 0.0s | 0.0s | 0.0s |
| Max | 11.1s | 18.7s | 0.2s | 0.0s | 0.0s | 0.0s |
| Min | 2.7s | 5.4s | 0.1s | N/A | N/A | N/A |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (11.1s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | N/A | N/A | N/A |
| Fastest | Paint (2.7s) | shapez (5.4s) | Donkey Kong Country 3 (0.1s) | N/A | N/A | N/A |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.4s | 8.3s | 0.2s | - | - | - |
| A Link to the Past | 7.9s | 12.3s | 0.2s | - | - | - |
| A Short Hike | 3.4s | 7.7s | 0.2s | - | - | - |
| APQuest | 3.2s | 6.8s | 0.1s | - | - | - |
| Adventure | 3.1s | 7.3s | 0.1s | - | - | - |
| Aquaria | 4.1s | 8.1s | 0.2s | - | - | - |
| Baking Adventure | 3.2s | 6.8s | 0.2s | - | - | - |
| Bumper Stickers | 2.9s | 6.9s | 0.1s | - | - | - |
| Castlevania - Circle of the Moon | 3.2s | 9.6s | 0.1s | - | - | - |
| Castlevania 64 | 3.3s | 11.4s | 0.1s | - | - | - |
| Celeste 64 | 3.0s | 5.8s | 0.1s | - | - | - |
| ChecksFinder | 2.9s | 5.6s | 0.1s | - | - | - |
| Choo-Choo Charles | 3.2s | 7.7s | 0.1s | - | - | - |
| Civilization VI | 3.1s | 5.7s | 0.1s | - | - | - |
| Coding Adventure | 2.9s | 5.6s | 0.1s | - | - | - |
| DLCQuest | 3.1s | 5.6s | 0.1s | - | - | - |
| DOOM 1993 | 3.6s | 6.8s | 0.1s | - | - | - |
| DOOM II | 3.2s | 7.5s | 0.1s | - | - | - |
| Dark Souls III | 4.0s | 18.7s | 0.1s | - | - | - |
| Donkey Kong Country 3 | 2.9s | 5.4s | 0.1s | - | - | - |
| Factorio | 3.5s | 5.7s | 0.1s | - | - | - |
| Faxanadu | 3.0s | 5.7s | 0.1s | - | - | - |
| Final Fantasy Mystic Quest | 4.0s | 6.7s | 0.1s | - | - | - |
| Heretic | 3.6s | 7.7s | 0.1s | - | - | - |
| Hylics 2 | 3.2s | 5.6s | 0.1s | - | - | - |
| Inscryption | 2.9s | 5.6s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.3s | 5.7s | 0.1s | - | - | - |
| Links Awakening DX | 5.4s | 7.6s | 0.1s | - | - | - |
| Lufia II Ancient Cave | 3.2s | 5.6s | 0.1s | - | - | - |
| Mario & Luigi Superstar Saga | 3.5s | 7.4s | 0.1s | - | - | - |
| Math Adventure | 2.9s | 5.6s | 0.1s | - | - | - |
| Mega Man 2 | 3.0s | 5.6s | 0.1s | - | - | - |
| MegaMan Battle Network 3 | 3.2s | 5.7s | 0.1s | - | - | - |
| Meritous | 3.0s | 5.8s | 0.1s | - | - | - |
| Metamath | 11.1s | 5.7s | 0.1s | - | - | - |
| Muse Dash | 3.0s | 5.6s | 0.1s | - | - | - |
| Noita | 3.1s | 5.6s | 0.1s | - | - | - |
| Old School Runescape | 3.5s | 5.5s | 0.1s | - | - | - |
| Overcooked! 2 | 3.2s | 7.6s | 0.1s | - | - | - |
| Paint | 2.7s | 5.4s | 0.1s | - | - | - |
| Risk of Rain 2 | 3.3s | 5.6s | 0.1s | - | - | - |
| Saving Princess | 2.9s | 5.6s | 0.1s | - | - | - |
| Shivers | 3.3s | 5.6s | 0.1s | - | - | - |
| Sonic Adventure 2 Battle | 4.4s | 5.7s | 0.1s | - | - | - |
| Subnautica | 3.7s | 9.7s | 0.1s | - | - | - |
| Super Mario 64 | 3.0s | 5.6s | 0.1s | - | - | - |
| Super Mario Land 2 | 3.6s | 5.7s | 0.1s | - | - | - |
| Super Mario World | 4.1s | 5.6s | 0.1s | - | - | - |
| TOEM original | 2.9s | 5.6s | 0.1s | - | - | - |
| TOEM rule builder | 2.7s | 5.4s | 0.1s | - | - | - |
| Terraria | 3.0s | 7.7s | 0.1s | - | - | - |
| The Legend of Zelda | 3.7s | 5.6s | 0.1s | - | - | - |
| The Messenger | 3.3s | 8.8s | 0.1s | - | - | - |
| The Wind Waker | 5.0s | 5.7s | 0.1s | - | - | - |
| Timespinner | 4.0s | 5.6s | 0.1s | - | - | - |
| Undertale | 3.0s | 5.6s | 0.1s | - | - | - |
| VVVVVV | 3.0s | 5.7s | 0.1s | - | - | - |
| Wargroove | 2.7s | 5.5s | 0.1s | - | - | - |
| Yoshi's Island | 3.8s | 6.6s | 0.1s | - | - | - |
| shapez | 3.4s | 5.4s | 0.1s | - | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 11.1s |
| 2 | A Link to the Past | 7.9s |
| 3 | Links Awakening DX | 5.4s |
| 4 | The Wind Waker | 5.0s |
| 5 | Sonic Adventure 2 Battle | 4.4s |
| 6 | A Hat in Time | 4.4s |
| 7 | Aquaria | 4.1s |
| 8 | Super Mario World | 4.1s |
| 9 | Final Fantasy Mystic Quest | 4.0s |
| 10 | Timespinner | 4.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past | 12.3s |
| 3 | Castlevania 64 | 11.4s |
| 4 | Subnautica | 9.7s |
| 5 | Castlevania - Circle of the Moon | 9.6s |
| 6 | The Messenger | 8.8s |
| 7 | A Hat in Time | 8.3s |
| 8 | Aquaria | 8.1s |
| 9 | A Short Hike | 7.7s |
| 10 | Choo-Choo Charles | 7.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.2s |
| 3 | A Short Hike | 0.2s |
| 4 | Aquaria | 0.2s |
| 5 | Baking Adventure | 0.2s |
| 6 | APQuest | 0.1s |
| 7 | Adventure | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Castlevania 64 | 0.1s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 221.0s | 414.1s | 5.5s | 199.8s | 377.7s | 558.8s |
| Average | 3.7s | 6.9s | 0.1s | 3.3s | 6.3s | 9.3s |
| Max | 10.2s | 18.7s | 0.2s | 5.8s | 17.7s | 32.8s |
| Min | 2.7s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Metamath (10.2s) | Dark Souls III (18.7s) | A Link to the Past (0.2s) | A Link to the Past (5.8s) | Dark Souls III (17.7s) | Dark Souls III (32.8s) |
| Fastest | Meritous (2.7s) | Civilization VI (5.4s) | Meritous (0.1s) | Meritous (2.7s) | APQuest (5.4s) | Meritous (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.1s | 10.1s | 0.2s | 4.3s | 6.8s | 7.9s |
| A Link to the Past | 7.9s | 14.1s | 0.2s | 5.8s | 9.7s | 14.3s |
| A Short Hike | 3.3s | 9.3s | 0.2s | 3.1s | 5.7s | 5.6s |
| APQuest | 2.8s | 7.0s | 0.1s | 2.7s | 5.4s | 5.4s |
| Adventure | 3.1s | 9.8s | 0.1s | 2.9s | 5.7s | 5.6s |
| Aquaria | 4.2s | 7.5s | 0.2s | 3.3s | 5.7s | 5.7s |
| Baking Adventure | 3.1s | 9.8s | 0.1s | 2.9s | 5.6s | 14.2s |
| Bumper Stickers | 3.0s | 8.7s | 0.1s | 2.9s | 5.5s | 13.8s |
| Castlevania - Circle of the Moon | 3.2s | 8.3s | 0.2s | 3.0s | 5.6s | 5.6s |
| Castlevania 64 | 3.9s | 10.4s | 0.2s | 3.6s | 5.7s | 5.7s |
| Celeste 64 | 3.5s | 5.8s | 0.1s | 3.3s | 5.7s | 14.6s |
| ChecksFinder | 3.1s | 5.8s | 0.1s | 2.8s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.2s | 7.7s | 0.1s | 3.1s | 7.7s | 7.7s |
| Civilization VI | 2.8s | 5.4s | 0.1s | 2.9s | 5.4s | 13.8s |
| Coding Adventure | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 14.1s |
| DLCQuest | 3.2s | 5.6s | 0.1s | 3.0s | 5.6s | 5.8s |
| DOOM 1993 | 3.6s | 6.7s | 0.1s | 3.3s | 6.7s | 14.3s |
| DOOM II | 3.4s | 7.5s | 0.1s | 3.3s | 7.5s | 13.9s |
| Dark Souls III | 4.1s | 18.7s | 0.1s | 4.0s | 17.7s | 32.8s |
| Donkey Kong Country 3 | 3.4s | 5.7s | 0.1s | 3.3s | 5.7s | 14.4s |
| Factorio | 4.1s | 5.9s | 0.1s | 3.7s | 5.8s | 5.8s |
| Faxanadu | 3.1s | 5.7s | 0.1s | 2.9s | 5.6s | 14.0s |
| Final Fantasy Mystic Quest | 4.2s | 6.8s | 0.1s | 3.5s | 6.7s | 6.7s |
| Heretic | 3.3s | 7.5s | 0.1s | 3.2s | 7.5s | 14.0s |
| Hylics 2 | 3.3s | 5.6s | 0.1s | 3.1s | 5.6s | 5.6s |
| Inscryption | 3.0s | 5.6s | 0.1s | 3.1s | 5.7s | 5.6s |
| Landstalker - The Treasures of King Nole | 3.5s | 5.6s | 0.1s | 3.1s | 5.6s | 14.4s |
| Links Awakening DX | 5.7s | 7.5s | 0.1s | 3.8s | 7.5s | 7.5s |
| Lufia II Ancient Cave | 3.3s | 5.6s | 0.1s | 3.2s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.9s | 7.7s | 0.1s | 4.7s | 7.7s | 7.8s |
| Math Adventure | 3.2s | 5.7s | 0.1s | 3.2s | 5.8s | 14.5s |
| Mega Man 2 | 3.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| MegaMan Battle Network 3 | 3.3s | 5.6s | 0.1s | 3.2s | 5.7s | 14.3s |
| Meritous | 2.7s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |
| Metamath | 10.2s | 5.7s | 0.1s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 5.7s | 0.1s | 3.1s | 5.6s | 5.7s |
| Noita | 3.1s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Old School Runescape | 3.7s | 5.5s | 0.1s | 3.5s | 5.5s | 5.5s |
| Overcooked! 2 | 3.2s | 7.7s | 0.1s | 3.2s | 7.6s | 14.3s |
| Paint | 3.2s | 5.7s | 0.1s | 3.3s | 5.9s | 5.7s |
| Risk of Rain 2 | 3.8s | 5.7s | 0.1s | 3.8s | 5.8s | 5.8s |
| Saving Princess | 3.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Shivers | 3.3s | 5.6s | 0.1s | 3.3s | 5.6s | 14.3s |
| Sonic Adventure 2 Battle | 4.2s | 5.4s | 0.1s | 3.9s | 5.4s | 13.8s |
| Subnautica | 3.7s | 9.6s | 0.1s | 3.5s | 9.6s | 14.3s |
| Super Mario 64 | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Super Mario Land 2 | 3.7s | 5.7s | 0.1s | 3.8s | 5.7s | 5.7s |
| Super Mario World | 4.3s | 5.6s | 0.1s | 3.3s | 5.5s | 5.5s |
| TOEM original | 2.9s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| TOEM rule builder | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Terraria | 3.5s | 7.8s | 0.1s | 3.5s | 7.8s | 7.8s |
| The Legend of Zelda | 3.9s | 5.6s | 0.1s | 3.0s | 5.6s | 14.2s |
| The Messenger | 3.4s | 8.8s | 0.1s | 3.3s | 8.8s | 8.8s |
| The Wind Waker | 4.5s | 5.4s | 0.1s | 4.8s | 5.5s | 13.8s |
| Timespinner | 3.9s | 5.6s | 0.1s | 3.8s | 5.6s | 5.6s |
| Undertale | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.7s |
| VVVVVV | 3.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Wargroove | 2.9s | 5.5s | 0.1s | 3.0s | 5.5s | 5.5s |
| Yoshi's Island | 3.9s | 6.6s | 0.1s | 3.9s | 5.6s | 5.6s |
| shapez | 4.1s | 5.7s | 0.1s | 3.4s | 5.7s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Metamath | 10.2s |
| 2 | A Link to the Past | 7.9s |
| 3 | Links Awakening DX | 5.7s |
| 4 | A Hat in Time | 5.1s |
| 5 | The Wind Waker | 4.5s |
| 6 | Super Mario World | 4.3s |
| 7 | Final Fantasy Mystic Quest | 4.2s |
| 8 | Sonic Adventure 2 Battle | 4.2s |
| 9 | Aquaria | 4.2s |
| 10 | Factorio | 4.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 18.7s |
| 2 | A Link to the Past | 14.1s |
| 3 | Castlevania 64 | 10.4s |
| 4 | A Hat in Time | 10.1s |
| 5 | Baking Adventure | 9.8s |
| 6 | Adventure | 9.8s |
| 7 | Subnautica | 9.6s |
| 8 | A Short Hike | 9.3s |
| 9 | The Messenger | 8.8s |
| 10 | Bumper Stickers | 8.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | A Hat in Time | 0.2s |
| 3 | Castlevania 64 | 0.2s |
| 4 | A Short Hike | 0.2s |
| 5 | Aquaria | 0.2s |
| 6 | Castlevania - Circle of the Moon | 0.2s |
| 7 | Adventure | 0.1s |
| 8 | Baking Adventure | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 5.8s |
| 2 | The Wind Waker | 4.8s |
| 3 | Mario & Luigi Superstar Saga | 4.7s |
| 4 | A Hat in Time | 4.3s |
| 5 | Dark Souls III | 4.0s |
| 6 | Sonic Adventure 2 Battle | 3.9s |
| 7 | Yoshi's Island | 3.9s |
| 8 | Risk of Rain 2 | 3.8s |
| 9 | Timespinner | 3.8s |
| 10 | Links Awakening DX | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 17.7s |
| 2 | A Link to the Past | 9.7s |
| 3 | Subnautica | 9.6s |
| 4 | The Messenger | 8.8s |
| 5 | Terraria | 7.8s |
| 6 | Mario & Luigi Superstar Saga | 7.7s |
| 7 | Choo-Choo Charles | 7.7s |
| 8 | Overcooked! 2 | 7.6s |
| 9 | Links Awakening DX | 7.5s |
| 10 | Heretic | 7.5s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 32.8s |
| 2 | Celeste 64 | 14.6s |
| 3 | Math Adventure | 14.5s |
| 4 | Landstalker - The Treasures of King Nole | 14.4s |
| 5 | Donkey Kong Country 3 | 14.4s |
| 6 | A Link to the Past | 14.3s |
| 7 | MegaMan Battle Network 3 | 14.3s |
| 8 | shapez | 14.3s |
| 9 | Shivers | 14.3s |
| 10 | DOOM 1993 | 14.3s |
