# World Generator Test Results

**Generated:** 2025-12-24 03:35:25 UTC

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
- **WorldGen Spoiler** (Stage 3): Validate the `_worldgen` world's sphere log against its rules
- **Cross-Validation** (Stage 4): Validate the **original** sphere log against `_worldgen` rules (proves equivalent logic)

---

# Canonical Mode Results

Tests run with `--canonical-seed1` (items placed in original locations).

## Canonical Summary

**Total Templates:** 63

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 63 | 0 | 63 |
| Original Spoiler Test | 63 | 0 | 63 |
| Stage 1: World Generation | 63 | 0 | 63 |
| Stage 2: Seed Generation | 63 | 0 | 63 |
| Stage 3: WorldGen Spoiler Test | 62 | 1 | 63 |
| Stage 4: Cross-Validation | 60 | 3 | 63 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 63

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 63 | 0 | 63 |
| Original Spoiler Test | 63 | 0 | 63 |
| Stage 1: World Generation | 63 | 0 | 63 |
| Stage 2: Seed Generation | 63 | 0 | 63 |
| Stage 3: WorldGen Spoiler Test | 62 | 1 | 63 |
| Stage 4: Cross-Validation | 29 | 34 | 63 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 268.4s | 690.6s | 5.5s | 207.6s | 682.0s | 652.4s |
| Average | 4.3s | 11.0s | 0.1s | 3.3s | 10.8s | 10.4s |
| Max | 27.4s | 57.7s | 0.3s | 19.8s | 57.1s | 45.3s |
| Min | 2.6s | 5.4s | 0.1s | 2.5s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.4s) | Kirby's Dream Land 3 (57.7s) | Overcooked! 2 (0.3s) | The Wind Waker (19.8s) | Kirby's Dream Land 3 (57.1s) | Kirby's Dream Land 3 (45.3s) |
| Fastest | VVVVVV (2.6s) | VVVVVV (5.4s) | VVVVVV (0.1s) | VVVVVV (2.5s) | VVVVVV (5.4s) | VVVVVV (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.1s | 14.6s | 0.1s | 3.1s | 17.8s | 17.7s |
| A Link to the Past | 10.0s | 18.8s | 0.1s | 5.8s | 21.0s | 23.6s |
| A Short Hike | 3.0s | 14.1s | 0.1s | 2.7s | 9.7s | 9.7s |
| APQuest | 3.0s | 8.4s | 0.1s | 2.7s | 5.6s | 5.6s |
| Adventure | 2.9s | 6.7s | 0.1s | 2.7s | 5.8s | 5.6s |
| Aquaria | 7.2s | 12.2s | 0.1s | 3.0s | 7.7s | 7.7s |
| Bumper Stickers | 3.2s | 12.2s | 0.1s | 3.0s | 8.8s | 8.7s |
| Castlevania - Circle of the Moon | 2.9s | 10.4s | 0.1s | 2.6s | 5.6s | 5.6s |
| Castlevania 64 | 2.8s | 9.0s | 0.1s | 2.5s | 6.5s | 6.5s |
| Celeste (Open World) | 4.2s | 19.9s | 0.1s | 3.7s | 14.8s | 14.9s |
| Celeste 64 | 3.0s | 6.9s | 0.1s | 2.9s | 7.8s | 6.8s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.8s | 9.7s | 10.7s |
| Civilization VI | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s | 8.6s |
| DLCQuest | 3.1s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| DOOM 1993 | 3.2s | 12.8s | 0.1s | 3.1s | 12.8s | 12.8s |
| DOOM II | 3.1s | 15.7s | 0.1s | 2.8s | 15.7s | 15.7s |
| Dark Souls III | 4.4s | 24.6s | 0.1s | 3.0s | 24.6s | 24.6s |
| Donkey Kong Country 3 | 2.9s | 13.7s | 0.1s | 2.8s | 13.7s | 13.7s |
| Factorio | 3.8s | 9.8s | 0.1s | 3.1s | 9.8s | 9.8s |
| Faxanadu | 2.8s | 6.7s | 0.1s | 2.8s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 3.7s | 10.7s | 0.1s | 2.8s | 10.7s | 10.7s |
| Heretic | 3.2s | 14.7s | 0.1s | 2.9s | 14.7s | 14.8s |
| Hylics 2 | 3.7s | 6.7s | 0.1s | 2.9s | 6.6s | 6.6s |
| Inscryption | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Kirby's Dream Land 3 | 4.8s | 57.7s | 0.1s | 3.2s | 57.1s | 45.3s |
| Landstalker - The Treasures of King Nole | 3.0s | 8.8s | 0.1s | 2.8s | 17.7s | 8.6s |
| Links Awakening DX | 8.6s | 16.6s | 0.1s | 2.9s | 16.6s | 16.5s |
| Lufia II Ancient Cave | 2.8s | 5.7s | 0.1s | 2.7s | 5.7s | 5.6s |
| Mario & Luigi Superstar Saga | 4.0s | 9.8s | 0.1s | 3.7s | 9.8s | 9.8s |
| MathProof2p2e4 | 2.7s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s | 6.7s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Meritous | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Metamath | 10.2s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Muse Dash | 3.2s | 7.8s | 0.1s | 2.9s | 9.8s | 7.7s |
| Noita | 2.6s | 5.6s | 0.1s | 2.7s | 5.6s | 5.7s |
| Old School Runescape | 4.0s | 8.5s | 0.1s | 2.6s | 8.5s | 8.4s |
| Overcooked! 2 | 4.0s | 21.0s | 0.3s | 3.8s | 20.8s | 20.9s |
| Paint | 3.0s | 7.8s | 0.1s | 3.0s | 6.8s | 6.8s |
| Risk of Rain 2 | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s | 6.8s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.7s | 6.6s | 5.6s |
| Shivers | 3.1s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s | 13.7s |
| Starcraft 2 | 6.5s | 17.9s | 0.1s | 4.0s | 16.8s | 16.8s |
| Subnautica | 27.4s | 14.8s | 0.1s | 5.9s | 14.8s | 14.8s |
| Super Mario 64 | 2.8s | 12.7s | 0.1s | 2.7s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.6s | 7.5s | 0.1s | 2.6s | 7.5s | 7.5s |
| Super Mario World | 4.1s | 6.7s | 0.1s | 2.8s | 6.7s | 6.6s |
| TOEM original | 3.2s | 9.8s | 0.1s | 3.0s | 9.8s | 9.7s |
| TOEM rule builder | 2.7s | 9.7s | 0.1s | 2.9s | 9.7s | 8.7s |
| Terraria | 2.8s | 20.8s | 0.1s | 2.9s | 19.8s | 19.8s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | 2.9s | 10.7s | 8.7s |
| The Messenger | 3.0s | 12.8s | 0.1s | 2.7s | 12.8s | 12.8s |
| The Wind Waker | 16.4s | 9.8s | 0.1s | 19.8s | 9.7s | 9.7s |
| Timespinner | 3.7s | 7.8s | 0.1s | 2.9s | 7.8s | 7.8s |
| Undertale | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| VVVVVV | 2.6s | 5.4s | 0.1s | 2.5s | 5.4s | 5.4s |
| Wargroove | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s | 6.7s |
| WebDevJourney | 3.1s | 8.8s | 0.1s | 3.0s | 8.7s | 8.7s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 5.5s | 8.7s | 8.7s |
| shapez | 4.2s | 6.8s | 0.1s | 2.9s | 6.7s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.4s |
| 2 | The Wind Waker | 16.4s |
| 3 | Metamath | 10.2s |
| 4 | A Link to the Past | 10.0s |
| 5 | Links Awakening DX | 8.6s |
| 6 | Aquaria | 7.2s |
| 7 | Starcraft 2 | 6.5s |
| 8 | A Hat in Time | 5.1s |
| 9 | Kirby's Dream Land 3 | 4.8s |
| 10 | The Legend of Zelda | 4.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 57.7s |
| 2 | Dark Souls III | 24.6s |
| 3 | Overcooked! 2 | 21.0s |
| 4 | Terraria | 20.8s |
| 5 | Celeste (Open World) | 19.9s |
| 6 | A Link to the Past | 18.8s |
| 7 | Starcraft 2 | 17.9s |
| 8 | Links Awakening DX | 16.6s |
| 9 | DOOM II | 15.7s |
| 10 | Subnautica | 14.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 0.3s |
| 2 | A Link to the Past | 0.1s |
| 3 | Celeste (Open World) | 0.1s |
| 4 | A Hat in Time | 0.1s |
| 5 | APQuest | 0.1s |
| 6 | Adventure | 0.1s |
| 7 | Aquaria | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Starcraft 2 | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 19.8s |
| 2 | Subnautica | 5.9s |
| 3 | A Link to the Past | 5.8s |
| 4 | Yoshi's Island | 5.5s |
| 5 | Starcraft 2 | 4.0s |
| 6 | Overcooked! 2 | 3.8s |
| 7 | Celeste (Open World) | 3.7s |
| 8 | Mario & Luigi Superstar Saga | 3.7s |
| 9 | Kirby's Dream Land 3 | 3.2s |
| 10 | A Hat in Time | 3.1s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 57.1s |
| 2 | Dark Souls III | 24.6s |
| 3 | A Link to the Past | 21.0s |
| 4 | Overcooked! 2 | 20.8s |
| 5 | Terraria | 19.8s |
| 6 | A Hat in Time | 17.8s |
| 7 | Landstalker - The Treasures of King Nole | 17.7s |
| 8 | Starcraft 2 | 16.8s |
| 9 | Sonic Adventure 2 Battle | 16.7s |
| 10 | Links Awakening DX | 16.6s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 45.3s |
| 2 | Dark Souls III | 24.6s |
| 3 | A Link to the Past | 23.6s |
| 4 | Overcooked! 2 | 20.9s |
| 5 | Terraria | 19.8s |
| 6 | A Hat in Time | 17.7s |
| 7 | Starcraft 2 | 16.8s |
| 8 | Links Awakening DX | 16.5s |
| 9 | DOOM II | 15.7s |
| 10 | Celeste (Open World) | 14.9s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 265.5s | 677.6s | 5.5s | 205.7s | 686.2s | 748.7s |
| Average | 4.2s | 10.8s | 0.1s | 3.3s | 10.9s | 11.9s |
| Max | 27.1s | 56.6s | 0.3s | 20.1s | 56.7s | 23.7s |
| Min | 2.5s | 5.4s | 0.1s | 2.4s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.1s) | Kirby's Dream Land 3 (56.6s) | Overcooked! 2 (0.3s) | The Wind Waker (20.1s) | Kirby's Dream Land 3 (56.7s) | Terraria (23.7s) |
| Fastest | ChecksFinder (2.5s) | MathProof2p2e4 (5.4s) | Wargroove (0.1s) | ChecksFinder (2.4s) | Lufia II Ancient Cave (5.4s) | Lufia II Ancient Cave (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.7s | 15.1s | 0.1s | 2.9s | 17.4s | 17.4s |
| A Link to the Past | 8.9s | 18.1s | 0.1s | 5.0s | 25.7s | 14.0s |
| A Short Hike | 3.0s | 13.1s | 0.1s | 2.8s | 9.7s | 9.7s |
| APQuest | 2.9s | 8.1s | 0.1s | 2.7s | 5.6s | 5.6s |
| Adventure | 3.0s | 6.3s | 0.1s | 2.8s | 5.7s | 14.3s |
| Aquaria | 7.0s | 9.6s | 0.1s | 3.0s | 7.7s | 14.5s |
| Bumper Stickers | 3.1s | 9.8s | 0.1s | 2.9s | 8.7s | 14.4s |
| Castlevania - Circle of the Moon | 3.0s | 6.4s | 0.1s | 2.7s | 5.7s | 14.3s |
| Castlevania 64 | 3.4s | 8.2s | 0.1s | 2.9s | 6.7s | 6.6s |
| Celeste (Open World) | 3.9s | 19.8s | 0.1s | 3.6s | 14.5s | 14.1s |
| Celeste 64 | 2.8s | 6.7s | 0.1s | 2.7s | 7.7s | 14.3s |
| ChecksFinder | 2.5s | 6.6s | 0.1s | 2.4s | 6.5s | 6.4s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.8s | 5.7s | 14.3s |
| Choo-Choo Charles | 2.9s | 10.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.8s | 8.7s | 17.5s |
| DLCQuest | 3.0s | 5.7s | 0.1s | 2.8s | 5.7s | 5.6s |
| DOOM 1993 | 3.1s | 12.8s | 0.1s | 3.0s | 12.8s | 14.5s |
| DOOM II | 3.1s | 15.7s | 0.1s | 2.9s | 15.8s | 14.4s |
| Dark Souls III | 5.3s | 25.8s | 0.1s | 3.2s | 24.8s | 17.4s |
| Donkey Kong Country 3 | 2.6s | 14.5s | 0.1s | 2.6s | 14.4s | 14.5s |
| Factorio | 3.4s | 9.8s | 0.1s | 2.9s | 9.7s | 9.7s |
| Faxanadu | 2.6s | 6.4s | 0.1s | 2.6s | 8.5s | 13.8s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 2.9s | 10.7s | 10.7s |
| Heretic | 3.2s | 14.8s | 0.1s | 3.0s | 14.7s | 14.4s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| Kirby's Dream Land 3 | 4.6s | 56.6s | 0.1s | 3.4s | 56.7s | 17.6s |
| Landstalker - The Treasures of King Nole | 3.1s | 8.6s | 0.1s | 2.9s | 17.8s | 14.4s |
| Links Awakening DX | 10.1s | 16.9s | 0.1s | 3.4s | 17.9s | 16.9s |
| Lufia II Ancient Cave | 2.5s | 5.5s | 0.1s | 2.4s | 5.4s | 5.4s |
| Mario & Luigi Superstar Saga | 3.6s | 9.7s | 0.1s | 3.2s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.5s | 5.4s | 0.1s | 2.5s | 5.5s | 13.8s |
| Mega Man 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.6s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.8s | 8.7s | 17.4s |
| Meritous | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 14.3s |
| Metamath | 10.6s | 5.7s | 0.1s | 2.7s | 5.7s | 5.7s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.9s | 9.7s | 14.5s |
| Noita | 2.7s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Old School Runescape | 4.6s | 8.7s | 0.1s | 3.0s | 8.7s | 8.8s |
| Overcooked! 2 | 3.6s | 20.8s | 0.3s | 3.5s | 20.6s | 14.2s |
| Paint | 2.8s | 7.8s | 0.1s | 2.8s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.6s | 6.5s | 0.1s | 2.6s | 6.6s | 6.5s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s | 14.3s |
| Shivers | 3.1s | 9.7s | 0.1s | 3.0s | 9.7s | 14.3s |
| Sonic Adventure 2 Battle | 3.3s | 13.7s | 0.1s | 2.9s | 16.7s | 14.4s |
| Starcraft 2 | 6.2s | 17.8s | 0.1s | 4.1s | 16.8s | 14.5s |
| Subnautica | 27.1s | 14.8s | 0.1s | 6.1s | 14.8s | 17.7s |
| Super Mario 64 | 2.8s | 12.7s | 0.1s | 2.8s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.0s | 7.7s | 0.1s | 3.0s | 7.7s | 7.7s |
| Super Mario World | 3.7s | 6.4s | 0.1s | 2.5s | 6.4s | 6.4s |
| TOEM original | 2.7s | 8.6s | 0.1s | 2.7s | 8.7s | 8.7s |
| TOEM rule builder | 2.6s | 9.5s | 0.1s | 2.6s | 9.5s | 9.5s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.9s | 20.8s | 23.7s |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | 2.9s | 10.7s | 14.3s |
| The Messenger | 3.4s | 12.9s | 0.1s | 2.8s | 12.8s | 12.8s |
| The Wind Waker | 16.1s | 9.7s | 0.1s | 20.1s | 9.7s | 14.4s |
| Timespinner | 3.4s | 7.7s | 0.1s | 3.0s | 7.7s | 14.6s |
| Undertale | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Wargroove | 2.5s | 6.4s | 0.1s | 2.5s | 6.5s | 6.5s |
| WebDevJourney | 2.8s | 8.6s | 0.1s | 3.0s | 8.7s | 14.3s |
| Yoshi's Island | 3.3s | 9.4s | 0.1s | 4.9s | 8.4s | 8.4s |
| shapez | 4.2s | 6.7s | 0.1s | 2.9s | 6.6s | 14.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.1s |
| 2 | The Wind Waker | 16.1s |
| 3 | Metamath | 10.6s |
| 4 | Links Awakening DX | 10.1s |
| 5 | A Link to the Past | 8.9s |
| 6 | Aquaria | 7.0s |
| 7 | Starcraft 2 | 6.2s |
| 8 | Dark Souls III | 5.3s |
| 9 | A Hat in Time | 4.7s |
| 10 | Kirby's Dream Land 3 | 4.6s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.6s |
| 2 | Dark Souls III | 25.8s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | Terraria | 20.8s |
| 5 | Celeste (Open World) | 19.8s |
| 6 | A Link to the Past | 18.1s |
| 7 | Starcraft 2 | 17.8s |
| 8 | Links Awakening DX | 16.9s |
| 9 | DOOM II | 15.7s |
| 10 | A Hat in Time | 15.1s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 0.3s |
| 2 | Castlevania 64 | 0.1s |
| 3 | Celeste (Open World) | 0.1s |
| 4 | A Hat in Time | 0.1s |
| 5 | A Link to the Past | 0.1s |
| 6 | A Short Hike | 0.1s |
| 7 | Adventure | 0.1s |
| 8 | Aquaria | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 20.1s |
| 2 | Subnautica | 6.1s |
| 3 | A Link to the Past | 5.0s |
| 4 | Yoshi's Island | 4.9s |
| 5 | Starcraft 2 | 4.1s |
| 6 | Celeste (Open World) | 3.6s |
| 7 | Overcooked! 2 | 3.5s |
| 8 | Links Awakening DX | 3.4s |
| 9 | Kirby's Dream Land 3 | 3.4s |
| 10 | Mario & Luigi Superstar Saga | 3.2s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.7s |
| 2 | A Link to the Past | 25.7s |
| 3 | Dark Souls III | 24.8s |
| 4 | Terraria | 20.8s |
| 5 | Overcooked! 2 | 20.6s |
| 6 | Links Awakening DX | 17.9s |
| 7 | Landstalker - The Treasures of King Nole | 17.8s |
| 8 | A Hat in Time | 17.4s |
| 9 | Starcraft 2 | 16.8s |
| 10 | Sonic Adventure 2 Battle | 16.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.7s |
| 2 | Subnautica | 17.7s |
| 3 | Kirby's Dream Land 3 | 17.6s |
| 4 | Civilization VI | 17.5s |
| 5 | A Hat in Time | 17.4s |
| 6 | Dark Souls III | 17.4s |
| 7 | MegaMan Battle Network 3 | 17.4s |
| 8 | Links Awakening DX | 16.9s |
| 9 | Timespinner | 14.6s |
| 10 | Muse Dash | 14.5s |
