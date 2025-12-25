# World Generator Test Results

**Generated:** 2025-12-25 03:54:07 UTC

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
| Original Spoiler Test | 62 | 1 | 63 |
| Stage 1: World Generation | 61 | 2 | 63 |
| Stage 2: Seed Generation | 51 | 12 | 63 |
| Stage 3: WorldGen Spoiler Test | 50 | 1 | 51 |
| Stage 4: Cross-Validation | 49 | 2 | 51 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ❌ | - | - |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ❌ | - | - | - |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ❌ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 63

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 63 | 0 | 63 |
| Original Spoiler Test | 62 | 1 | 63 |
| Stage 1: World Generation | 61 | 2 | 63 |
| Stage 2: Seed Generation | 51 | 12 | 63 |
| Stage 3: WorldGen Spoiler Test | 50 | 1 | 51 |
| Stage 4: Cross-Validation | 23 | 28 | 51 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ❌ | - | - |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ❌ | - | - | - |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ❌ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 278.2s | 692.5s | 5.4s | 187.2s | 501.2s | 474.6s |
| Average | 4.4s | 11.0s | 0.1s | 3.1s | 9.8s | 9.3s |
| Max | 28.1s | 55.6s | 0.1s | 20.8s | 24.7s | 24.8s |
| Min | 2.7s | 5.6s | 0.1s | 0.4s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (28.1s) | Kirby's Dream Land 3 (55.6s) | Celeste (Open World) (0.1s) | The Wind Waker (20.8s) | Dark Souls III (24.7s) | Dark Souls III (24.8s) |
| Fastest | ChecksFinder (2.7s) | VVVVVV (5.6s) | shapez (0.1s) | Mega Man 2 (0.4s) | VVVVVV (5.6s) | VVVVVV (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.0s | 15.2s | 0.1s | 3.3s | 17.4s | 17.4s |
| A Link to the Past | 10.5s | 20.9s | 0.1s | - | - | - |
| A Short Hike | 3.2s | 12.8s | 0.1s | 2.9s | 9.7s | 9.7s |
| APQuest | 3.0s | 11.4s | 0.1s | 3.0s | 5.7s | 5.7s |
| Adventure | 3.1s | 9.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Aquaria | 7.0s | 11.1s | 0.1s | 3.0s | 7.7s | 7.7s |
| Bumper Stickers | 3.0s | 13.1s | 0.1s | 2.7s | 8.6s | 8.7s |
| Castlevania - Circle of the Moon | 3.2s | 7.4s | 0.1s | 2.9s | 5.6s | 5.6s |
| Castlevania 64 | 3.5s | 9.3s | 0.1s | 0.4s | - | - |
| Celeste (Open World) | 4.6s | 19.4s | 0.1s | 4.2s | 14.8s | 14.8s |
| Celeste 64 | 3.0s | 6.6s | 0.1s | 2.9s | 7.6s | 6.6s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Choo-Choo Charles | 2.9s | 9.8s | 0.1s | 3.1s | 10.8s | 10.8s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| DLCQuest | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| DOOM 1993 | 3.2s | 12.7s | 0.1s | 3.0s | 12.7s | 12.8s |
| DOOM II | 3.2s | 14.7s | 0.1s | 3.0s | 15.7s | 14.7s |
| Dark Souls III | 5.0s | 24.8s | 0.1s | 3.3s | 24.7s | 24.8s |
| Donkey Kong Country 3 | 3.2s | 14.8s | 0.1s | 2.9s | 13.7s | 13.7s |
| Factorio | 3.5s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Faxanadu | 2.9s | 6.7s | 0.1s | 2.9s | 8.6s | 6.6s |
| Final Fantasy Mystic Quest | 4.1s | 10.8s | 0.1s | 0.4s | - | - |
| Heretic | 3.5s | 15.9s | 0.1s | 3.3s | 15.8s | 15.8s |
| Hylics 2 | 3.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Inscryption | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Kirby's Dream Land 3 | 4.7s | 55.6s | 0.1s | 2.5s | - | - |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 3.0s | 17.7s | 8.7s |
| Links Awakening DX | 9.6s | 16.7s | 0.1s | 3.4s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 3.1s | 5.7s | 0.1s | - | - | - |
| Mario & Luigi Superstar Saga | 3.8s | 9.7s | 0.1s | 3.5s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mega Man 2 | 3.1s | 6.7s | 0.1s | 0.4s | - | - |
| MegaMan Battle Network 3 | 3.3s | 8.7s | 0.1s | 3.0s | 8.7s | 8.8s |
| Meritous | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Metamath | 10.2s | 5.7s | 0.1s | 0.4s | - | - |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.9s | 9.7s | 7.7s |
| Noita | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Old School Runescape | 4.6s | 8.6s | 0.1s | 3.1s | 8.7s | 8.6s |
| Overcooked! 2 | 3.2s | 21.7s | 0.1s | 3.0s | 19.8s | 14.3s |
| Paint | 2.8s | 7.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.3s | 6.7s | 0.1s | 3.0s | 6.6s | 6.6s |
| Saving Princess | 3.0s | 5.7s | 0.1s | 2.9s | 6.7s | 5.7s |
| Shivers | 3.4s | 9.8s | 0.1s | 3.1s | 9.7s | 9.8s |
| Sonic Adventure 2 Battle | 4.2s | 13.7s | 0.1s | 3.9s | 16.8s | 13.7s |
| Starcraft 2 | 6.8s | 17.8s | 0.1s | 0.4s | - | - |
| Subnautica | 28.1s | 15.1s | 0.1s | 2.6s | - | - |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 2.9s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.0s | 7.8s | 0.1s | 2.5s | - | - |
| Super Mario World | 4.3s | 6.7s | 0.1s | 3.1s | 6.6s | 6.6s |
| TOEM original | 2.8s | 8.8s | 0.1s | 2.7s | 8.7s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Terraria | 3.1s | 20.8s | 0.1s | 0.4s | - | - |
| The Legend of Zelda | 4.7s | 8.7s | 0.1s | 3.2s | 10.8s | 8.8s |
| The Messenger | 3.2s | 12.8s | 0.1s | 3.0s | 12.9s | 12.9s |
| The Wind Waker | 16.0s | 9.7s | 0.1s | 20.8s | 9.8s | 9.7s |
| Timespinner | 3.7s | 7.7s | 0.1s | 3.5s | 6.7s | 6.6s |
| Undertale | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Wargroove | 3.0s | 6.7s | 0.1s | 2.8s | 6.7s | 6.6s |
| WebDevJourney | 2.8s | 8.6s | 0.1s | 2.7s | 8.6s | 8.6s |
| Yoshi's Island | 3.7s | 9.7s | 0.1s | 5.5s | 8.7s | 8.7s |
| shapez | 4.3s | 6.7s | 0.1s | 2.6s | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 28.1s |
| 2 | The Wind Waker | 16.0s |
| 3 | A Link to the Past | 10.5s |
| 4 | Metamath | 10.2s |
| 5 | Links Awakening DX | 9.6s |
| 6 | Aquaria | 7.0s |
| 7 | Starcraft 2 | 6.8s |
| 8 | A Hat in Time | 5.0s |
| 9 | Dark Souls III | 5.0s |
| 10 | Kirby's Dream Land 3 | 4.7s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 55.6s |
| 2 | Dark Souls III | 24.8s |
| 3 | Overcooked! 2 | 21.7s |
| 4 | A Link to the Past | 20.9s |
| 5 | Terraria | 20.8s |
| 6 | Celeste (Open World) | 19.4s |
| 7 | Starcraft 2 | 17.8s |
| 8 | Links Awakening DX | 16.7s |
| 9 | Heretic | 15.9s |
| 10 | A Hat in Time | 15.2s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 0.1s |
| 2 | Subnautica | 0.1s |
| 3 | A Link to the Past | 0.1s |
| 4 | A Hat in Time | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Aquaria | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 20.8s |
| 2 | Yoshi's Island | 5.5s |
| 3 | Celeste (Open World) | 4.2s |
| 4 | Sonic Adventure 2 Battle | 3.9s |
| 5 | Mario & Luigi Superstar Saga | 3.5s |
| 6 | Timespinner | 3.5s |
| 7 | Links Awakening DX | 3.4s |
| 8 | A Hat in Time | 3.3s |
| 9 | Dark Souls III | 3.3s |
| 10 | Heretic | 3.3s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.7s |
| 2 | Overcooked! 2 | 19.8s |
| 3 | Landstalker - The Treasures of King Nole | 17.7s |
| 4 | A Hat in Time | 17.4s |
| 5 | Sonic Adventure 2 Battle | 16.8s |
| 6 | Links Awakening DX | 16.7s |
| 7 | Heretic | 15.8s |
| 8 | DOOM II | 15.7s |
| 9 | Celeste (Open World) | 14.8s |
| 10 | Donkey Kong Country 3 | 13.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | A Hat in Time | 17.4s |
| 3 | Links Awakening DX | 16.7s |
| 4 | Heretic | 15.8s |
| 5 | Celeste (Open World) | 14.8s |
| 6 | DOOM II | 14.7s |
| 7 | Overcooked! 2 | 14.3s |
| 8 | Donkey Kong Country 3 | 13.7s |
| 9 | Sonic Adventure 2 Battle | 13.7s |
| 10 | The Messenger | 12.9s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 272.4s | 681.4s | 5.3s | 182.4s | 498.5s | 602.8s |
| Average | 4.3s | 10.8s | 0.1s | 3.0s | 9.8s | 11.8s |
| Max | 25.8s | 58.7s | 0.1s | 16.7s | 24.8s | 17.4s |
| Min | 2.7s | 5.4s | 0.1s | 0.4s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (25.8s) | Kirby's Dream Land 3 (58.7s) | Celeste (Open World) (0.1s) | The Wind Waker (16.7s) | Dark Souls III (24.8s) | A Hat in Time (17.4s) |
| Fastest | ChocolateChipCookies (2.7s) | DLCQuest (5.4s) | Metamath (0.1s) | Starcraft 2 (0.4s) | DLCQuest (5.4s) | DLCQuest (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.2s | 14.3s | 0.1s | 3.4s | 17.5s | 17.4s |
| A Link to the Past | 11.0s | 21.4s | 0.1s | - | - | - |
| A Short Hike | 3.1s | 10.7s | 0.1s | 2.9s | 9.7s | 9.6s |
| APQuest | 2.9s | 9.2s | 0.1s | 2.7s | 5.6s | 5.6s |
| Adventure | 3.0s | 7.1s | 0.1s | 2.8s | 5.6s | 14.4s |
| Aquaria | 6.3s | 10.9s | 0.1s | 2.7s | 7.5s | 13.9s |
| Bumper Stickers | 2.9s | 10.0s | 0.1s | 2.7s | 8.7s | 14.0s |
| Castlevania - Circle of the Moon | 3.2s | 10.6s | 0.1s | 3.0s | 5.7s | 14.3s |
| Castlevania 64 | 3.6s | 9.6s | 0.1s | 0.4s | - | - |
| Celeste (Open World) | 4.5s | 15.7s | 0.1s | 4.2s | 14.8s | 14.7s |
| Celeste 64 | 3.0s | 6.6s | 0.1s | 2.9s | 7.6s | 14.3s |
| ChecksFinder | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.7s | 5.7s | 14.2s |
| Choo-Choo Charles | 2.9s | 9.6s | 0.1s | 2.8s | 10.7s | 9.7s |
| Civilization VI | 2.9s | 8.6s | 0.1s | 2.7s | 8.7s | 17.3s |
| DLCQuest | 2.9s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |
| DOOM 1993 | 3.2s | 12.6s | 0.1s | 3.1s | 12.6s | 14.0s |
| DOOM II | 3.3s | 15.8s | 0.1s | 3.1s | 15.8s | 14.5s |
| Dark Souls III | 5.0s | 25.8s | 0.1s | 3.5s | 24.8s | 17.3s |
| Donkey Kong Country 3 | 3.1s | 13.7s | 0.1s | 3.0s | 13.7s | 15.0s |
| Factorio | 3.6s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Faxanadu | 3.1s | 6.6s | 0.1s | 3.0s | 8.7s | 14.3s |
| Final Fantasy Mystic Quest | 4.0s | 10.7s | 0.1s | 0.4s | - | - |
| Heretic | 3.3s | 14.8s | 0.1s | 3.1s | 14.8s | 14.4s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| Inscryption | 2.7s | 6.5s | 0.1s | 2.6s | 6.4s | 6.5s |
| Kirby's Dream Land 3 | 4.6s | 58.7s | 0.1s | 2.5s | - | - |
| Landstalker - The Treasures of King Nole | 3.5s | 8.9s | 0.1s | 3.2s | 17.8s | 14.4s |
| Links Awakening DX | 9.8s | 16.8s | 0.1s | 3.7s | 16.7s | 16.8s |
| Lufia II Ancient Cave | 3.0s | 5.7s | 0.1s | - | - | - |
| Mario & Luigi Superstar Saga | 3.9s | 9.7s | 0.1s | 3.5s | 9.7s | 9.7s |
| MathProof2p2e4 | 3.0s | 5.6s | 0.1s | 2.8s | 5.7s | 14.4s |
| Mega Man 2 | 3.0s | 6.6s | 0.1s | 0.4s | - | - |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 8.6s | 17.4s |
| Meritous | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 14.2s |
| Metamath | 10.1s | 5.5s | 0.1s | 0.4s | - | - |
| Muse Dash | 3.1s | 7.5s | 0.1s | 2.9s | 9.6s | 14.0s |
| Noita | 3.1s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Old School Runescape | 4.6s | 8.8s | 0.1s | 3.4s | 8.7s | 8.7s |
| Overcooked! 2 | 3.1s | 20.8s | 0.1s | 3.0s | 19.8s | 14.2s |
| Paint | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.5s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| Saving Princess | 2.9s | 5.6s | 0.1s | 2.8s | 6.6s | 14.3s |
| Shivers | 3.2s | 9.7s | 0.1s | 3.0s | 9.7s | 14.4s |
| Sonic Adventure 2 Battle | 4.0s | 14.2s | 0.1s | 3.7s | 16.7s | 14.5s |
| Starcraft 2 | 6.3s | 16.6s | 0.1s | 0.4s | - | - |
| Subnautica | 25.8s | 14.8s | 0.1s | 2.5s | - | - |
| Super Mario 64 | 3.1s | 12.7s | 0.1s | 3.0s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.8s | 0.1s | 2.6s | - | - |
| Super Mario World | 4.2s | 6.6s | 0.1s | 3.1s | 6.6s | 6.6s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| TOEM rule builder | 3.1s | 9.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Terraria | 3.0s | 20.8s | 0.1s | 0.4s | - | - |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | 3.0s | 10.7s | 14.4s |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.9s | 12.8s | 12.8s |
| The Wind Waker | 14.1s | 9.4s | 0.1s | 16.7s | 9.4s | 13.8s |
| Timespinner | 3.9s | 7.5s | 0.1s | 3.5s | 6.5s | 14.1s |
| Undertale | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Wargroove | 2.9s | 6.6s | 0.1s | 2.8s | 6.6s | 6.6s |
| WebDevJourney | 3.0s | 8.7s | 0.1s | 2.8s | 8.7s | 14.2s |
| Yoshi's Island | 3.8s | 9.7s | 0.1s | 5.5s | 8.7s | 8.7s |
| shapez | 4.2s | 6.8s | 0.1s | 2.5s | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 25.8s |
| 2 | The Wind Waker | 14.1s |
| 3 | A Link to the Past | 11.0s |
| 4 | Metamath | 10.1s |
| 5 | Links Awakening DX | 9.8s |
| 6 | Starcraft 2 | 6.3s |
| 7 | Aquaria | 6.3s |
| 8 | A Hat in Time | 5.2s |
| 9 | Dark Souls III | 5.0s |
| 10 | Old School Runescape | 4.6s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 58.7s |
| 2 | Dark Souls III | 25.8s |
| 3 | A Link to the Past | 21.4s |
| 4 | Terraria | 20.8s |
| 5 | Overcooked! 2 | 20.8s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Starcraft 2 | 16.6s |
| 8 | DOOM II | 15.8s |
| 9 | Celeste (Open World) | 15.7s |
| 10 | Subnautica | 14.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 0.1s |
| 2 | A Link to the Past | 0.1s |
| 3 | Subnautica | 0.1s |
| 4 | A Hat in Time | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Castlevania - Circle of the Moon | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Aquaria | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 16.7s |
| 2 | Yoshi's Island | 5.5s |
| 3 | Celeste (Open World) | 4.2s |
| 4 | Sonic Adventure 2 Battle | 3.7s |
| 5 | Links Awakening DX | 3.7s |
| 6 | Mario & Luigi Superstar Saga | 3.5s |
| 7 | Dark Souls III | 3.5s |
| 8 | Timespinner | 3.5s |
| 9 | A Hat in Time | 3.4s |
| 10 | Old School Runescape | 3.4s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Overcooked! 2 | 19.8s |
| 3 | Landstalker - The Treasures of King Nole | 17.8s |
| 4 | A Hat in Time | 17.5s |
| 5 | Links Awakening DX | 16.7s |
| 6 | Sonic Adventure 2 Battle | 16.7s |
| 7 | DOOM II | 15.8s |
| 8 | Celeste (Open World) | 14.8s |
| 9 | Heretic | 14.8s |
| 10 | Donkey Kong Country 3 | 13.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | A Hat in Time | 17.4s |
| 2 | MegaMan Battle Network 3 | 17.4s |
| 3 | Civilization VI | 17.3s |
| 4 | Dark Souls III | 17.3s |
| 5 | Links Awakening DX | 16.8s |
| 6 | Donkey Kong Country 3 | 15.0s |
| 7 | Celeste (Open World) | 14.7s |
| 8 | DOOM II | 14.5s |
| 9 | Sonic Adventure 2 Battle | 14.5s |
| 10 | Landstalker - The Treasures of King Nole | 14.4s |
