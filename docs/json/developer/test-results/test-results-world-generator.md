# World Generator Test Results

**Generated:** 2025-12-27 05:12:45 UTC

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
| Original Spoiler Test | 50 | 13 | 63 |
| Stage 1: World Generation | 63 | 0 | 63 |
| Stage 2: Seed Generation | 52 | 11 | 63 |
| Stage 3: WorldGen Spoiler Test | 50 | 2 | 52 |
| Stage 4: Cross-Validation | 43 | 9 | 52 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Civilization VI | ✅ | ❌ | ✅ | ❌ | - | - |
| DLCQuest | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kirby's Dream Land 3 | ✅ | ❌ | ✅ | ❌ | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ❌ | ✅ | ✅ | ❌ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ❌ | - | - |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ❌ | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ❌ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ❌ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| VVVVVV | ✅ | ❌ | ✅ | ❌ | - | - |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ❌ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 63

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 63 | 0 | 63 |
| Original Spoiler Test | 50 | 13 | 63 |
| Stage 1: World Generation | 63 | 0 | 63 |
| Stage 2: Seed Generation | 52 | 11 | 63 |
| Stage 3: WorldGen Spoiler Test | 50 | 2 | 52 |
| Stage 4: Cross-Validation | 19 | 33 | 52 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Civilization VI | ✅ | ❌ | ✅ | ❌ | - | - |
| DLCQuest | ✅ | ❌ | ✅ | ✅ | ❌ | Error |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kirby's Dream Land 3 | ✅ | ❌ | ✅ | ❌ | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ❌ | ✅ | ✅ | ❌ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ❌ | - | - |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ❌ | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ❌ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ❌ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| VVVVVV | ✅ | ❌ | ✅ | ❌ | - | - |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ❌ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 280.6s | 743.8s | 5.4s | 194.3s | 531.2s | 550.7s |
| Average | 4.5s | 11.8s | 0.1s | 3.1s | 10.2s | 10.6s |
| Max | 27.1s | 29.9s | 0.1s | 16.7s | 24.8s | 24.7s |
| Min | 2.6s | 5.5s | 0.1s | 0.4s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.1s) | Kirby's Dream Land 3 (29.9s) | Celeste (Open World) (0.1s) | The Wind Waker (16.7s) | Dark Souls III (24.8s) | Dark Souls III (24.7s) |
| Fastest | MathProof2p2e4 (2.6s) | Metamath (5.5s) | Metamath (0.1s) | A Link to the Past (0.4s) | Metamath (5.4s) | Metamath (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.9s | 18.2s | 0.1s | 3.0s | 13.7s | 13.7s |
| A Link to the Past | 14.1s | 18.2s | 0.1s | 0.4s | - | - |
| A Short Hike | 3.2s | 14.5s | 0.1s | 2.9s | 9.7s | 9.7s |
| APQuest | 3.0s | 8.2s | 0.1s | 2.8s | 5.7s | 5.6s |
| Adventure | 3.4s | 10.1s | 0.1s | 3.0s | 5.7s | 5.7s |
| Aquaria | 6.5s | 11.3s | 0.1s | 2.8s | 8.5s | 8.5s |
| Bumper Stickers | 3.1s | 10.2s | 0.1s | 2.7s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.4s | 8.9s | 0.1s | 2.9s | 5.7s | 5.7s |
| Castlevania 64 | 3.5s | 10.3s | 0.1s | 2.8s | 6.6s | 6.8s |
| Celeste (Open World) | 4.4s | 17.7s | 0.1s | 3.7s | 14.8s | 14.8s |
| Celeste 64 | 3.0s | 6.7s | 0.1s | 2.8s | 7.6s | 6.6s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.6s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.8s | 5.6s | 5.6s |
| Choo-Choo Charles | 3.0s | 9.8s | 0.1s | 2.9s | 10.7s | 10.7s |
| Civilization VI | 3.2s | 14.6s | 0.1s | 2.7s | - | - |
| DLCQuest | 2.9s | 13.9s | 0.1s | 2.7s | 13.9s | 6.5s |
| DOOM 1993 | 3.3s | 12.7s | 0.1s | 2.9s | 12.7s | 12.8s |
| DOOM II | 3.4s | 15.8s | 0.1s | 3.0s | 15.8s | 15.8s |
| Dark Souls III | 5.1s | 25.8s | 0.1s | 3.3s | 24.8s | 24.7s |
| Donkey Kong Country 3 | 3.0s | 13.8s | 0.1s | 2.7s | 13.7s | 17.7s |
| Factorio | 3.7s | 9.7s | 0.1s | 2.7s | 9.7s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.7s | 8.6s | 6.6s |
| Final Fantasy Mystic Quest | 4.2s | 14.8s | 0.1s | 3.1s | 10.7s | 14.4s |
| Heretic | 3.4s | 14.8s | 0.1s | 3.0s | 14.8s | 14.8s |
| Hylics 2 | 4.0s | 6.7s | 0.1s | 3.1s | 6.8s | 6.8s |
| Inscryption | 2.8s | 6.5s | 0.1s | 2.6s | 6.5s | 6.5s |
| Kirby's Dream Land 3 | 4.8s | 29.9s | 0.1s | 2.7s | - | - |
| Landstalker - The Treasures of King Nole | 3.4s | 14.5s | 0.1s | 3.0s | 18.8s | 14.5s |
| Links Awakening DX | 9.6s | 16.8s | 0.1s | 3.2s | 16.8s | 16.7s |
| Lufia II Ancient Cave | 2.9s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.8s | 9.7s | 0.1s | 4.0s | 9.7s | 23.7s |
| MathProof2p2e4 | 2.6s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Mega Man 2 | 3.1s | 6.6s | 0.1s | 2.9s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.4s | 17.5s | 0.1s | 2.8s | 8.7s | 14.4s |
| Meritous | 3.0s | 5.7s | 0.1s | 2.9s | 5.8s | 5.7s |
| Metamath | 9.7s | 5.5s | 0.1s | 2.6s | 5.4s | 5.4s |
| Muse Dash | 3.2s | 7.7s | 0.1s | 2.8s | 9.7s | 7.7s |
| Noita | 3.1s | 5.7s | 0.1s | 3.0s | 5.8s | 5.7s |
| Old School Runescape | 4.4s | 14.3s | 0.1s | 2.9s | 14.3s | 14.3s |
| Overcooked! 2 | 3.1s | 20.8s | 0.1s | 3.0s | 21.7s | 20.7s |
| Paint | 3.0s | 7.8s | 0.1s | 2.6s | - | - |
| Risk of Rain 2 | 3.0s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| Saving Princess | 3.0s | 5.7s | 0.1s | 2.9s | 6.7s | 5.7s |
| Shivers | 3.4s | 9.7s | 0.1s | 2.6s | - | - |
| Sonic Adventure 2 Battle | 4.3s | 13.8s | 0.1s | 3.0s | 16.8s | 13.8s |
| Starcraft 2 | 6.4s | 25.7s | 0.1s | 2.4s | - | - |
| Subnautica | 27.1s | 14.3s | 0.1s | 5.9s | 14.7s | 14.4s |
| Super Mario 64 | 3.2s | 12.7s | 0.1s | 2.9s | 12.8s | 12.7s |
| Super Mario Land 2 | 4.1s | 14.4s | 0.1s | 2.6s | - | - |
| Super Mario World | 4.2s | 6.6s | 0.1s | 2.8s | 6.7s | 14.3s |
| TOEM original | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| TOEM rule builder | 2.7s | 8.6s | 0.1s | 2.6s | 8.6s | 8.6s |
| Terraria | 3.4s | 20.8s | 0.1s | 2.9s | 19.8s | 19.8s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | 3.1s | 10.7s | 8.7s |
| The Messenger | 3.4s | 14.0s | 0.1s | 2.8s | - | - |
| The Wind Waker | 14.5s | 17.0s | 0.1s | 16.7s | 9.5s | 9.5s |
| Timespinner | 3.9s | 14.3s | 0.1s | 2.7s | - | - |
| Undertale | 3.2s | 5.8s | 0.1s | 2.9s | 5.7s | 14.4s |
| VVVVVV | 2.8s | 14.3s | 0.1s | 2.6s | - | - |
| Wargroove | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| WebDevJourney | 2.9s | 8.6s | 0.1s | 2.8s | 8.7s | 8.7s |
| Yoshi's Island | 3.5s | 14.2s | 0.1s | 2.5s | - | - |
| shapez | 4.4s | 6.7s | 0.1s | 3.0s | 6.6s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.1s |
| 2 | The Wind Waker | 14.5s |
| 3 | A Link to the Past | 14.1s |
| 4 | Metamath | 9.7s |
| 5 | Links Awakening DX | 9.6s |
| 6 | Aquaria | 6.5s |
| 7 | Starcraft 2 | 6.4s |
| 8 | A Hat in Time | 5.9s |
| 9 | Dark Souls III | 5.1s |
| 10 | Kirby's Dream Land 3 | 4.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 29.9s |
| 2 | Dark Souls III | 25.8s |
| 3 | Starcraft 2 | 25.7s |
| 4 | Terraria | 20.8s |
| 5 | Overcooked! 2 | 20.8s |
| 6 | A Link to the Past | 18.2s |
| 7 | A Hat in Time | 18.2s |
| 8 | Celeste (Open World) | 17.7s |
| 9 | MegaMan Battle Network 3 | 17.5s |
| 10 | The Wind Waker | 17.0s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 0.1s |
| 2 | A Link to the Past | 0.1s |
| 3 | A Hat in Time | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | Adventure | 0.1s |
| 6 | Bumper Stickers | 0.1s |
| 7 | Castlevania - Circle of the Moon | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | Starcraft 2 | 0.1s |
| 10 | APQuest | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 16.7s |
| 2 | Subnautica | 5.9s |
| 3 | Mario & Luigi Superstar Saga | 4.0s |
| 4 | Celeste (Open World) | 3.7s |
| 5 | Dark Souls III | 3.3s |
| 6 | Links Awakening DX | 3.2s |
| 7 | Hylics 2 | 3.1s |
| 8 | Final Fantasy Mystic Quest | 3.1s |
| 9 | The Legend of Zelda | 3.1s |
| 10 | Landstalker - The Treasures of King Nole | 3.0s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Overcooked! 2 | 21.7s |
| 3 | Terraria | 19.8s |
| 4 | Landstalker - The Treasures of King Nole | 18.8s |
| 5 | Sonic Adventure 2 Battle | 16.8s |
| 6 | Links Awakening DX | 16.8s |
| 7 | DOOM II | 15.8s |
| 8 | Heretic | 14.8s |
| 9 | Celeste (Open World) | 14.8s |
| 10 | Subnautica | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.7s |
| 2 | Mario & Luigi Superstar Saga | 23.7s |
| 3 | Overcooked! 2 | 20.7s |
| 4 | Terraria | 19.8s |
| 5 | Donkey Kong Country 3 | 17.7s |
| 6 | Links Awakening DX | 16.7s |
| 7 | DOOM II | 15.8s |
| 8 | Heretic | 14.8s |
| 9 | Celeste (Open World) | 14.8s |
| 10 | Landstalker - The Treasures of King Nole | 14.5s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 281.8s | 745.7s | 5.4s | 197.0s | 536.1s | 657.1s |
| Average | 4.5s | 11.8s | 0.1s | 3.1s | 10.3s | 12.6s |
| Max | 27.3s | 30.0s | 0.2s | 19.1s | 23.7s | 23.8s |
| Min | 2.6s | 5.6s | 0.1s | 0.4s | 5.4s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.3s) | Kirby's Dream Land 3 (30.0s) | Celeste (Open World) (0.2s) | The Wind Waker (19.1s) | Dark Souls III (23.7s) | Mario & Luigi Superstar Saga (23.8s) |
| Fastest | Choo-Choo Charles (2.6s) | ChocolateChipCookies (5.6s) | shapez (0.1s) | A Link to the Past (0.4s) | APQuest (5.4s) | APQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.8s | 16.5s | 0.1s | 3.1s | 13.7s | 13.7s |
| A Link to the Past | 14.6s | 21.9s | 0.1s | 0.4s | - | - |
| A Short Hike | 3.3s | 11.2s | 0.1s | 2.8s | 9.7s | 9.7s |
| APQuest | 2.8s | 9.8s | 0.1s | 2.5s | 5.4s | 5.5s |
| Adventure | 3.1s | 8.4s | 0.1s | 2.8s | 5.6s | 14.3s |
| Aquaria | 7.1s | 10.7s | 0.1s | 3.1s | 7.7s | 14.5s |
| Bumper Stickers | 2.9s | 11.8s | 0.1s | 2.7s | 8.6s | 14.2s |
| Castlevania - Circle of the Moon | 3.4s | 9.4s | 0.1s | 2.7s | 5.6s | 14.4s |
| Castlevania 64 | 3.4s | 7.1s | 0.1s | 2.8s | 6.7s | 6.7s |
| Celeste (Open World) | 5.1s | 19.4s | 0.2s | 4.3s | 16.0s | 14.9s |
| Celeste 64 | 3.1s | 6.7s | 0.1s | 2.8s | 7.7s | 14.3s |
| ChecksFinder | 2.7s | 6.6s | 0.1s | 2.8s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 14.2s |
| Choo-Choo Charles | 2.6s | 10.5s | 0.1s | 2.6s | 10.5s | 10.5s |
| Civilization VI | 3.0s | 14.6s | 0.1s | 2.6s | - | - |
| DLCQuest | 3.2s | 14.2s | 0.1s | 2.9s | 14.3s | 14.4s |
| DOOM 1993 | 3.2s | 12.7s | 0.1s | 2.8s | 12.7s | 14.3s |
| DOOM II | 3.2s | 15.8s | 0.1s | 3.0s | 15.8s | 14.4s |
| Dark Souls III | 5.0s | 24.8s | 0.1s | 3.1s | 23.7s | 17.2s |
| Donkey Kong Country 3 | 3.3s | 14.9s | 0.1s | 2.9s | 14.7s | 15.3s |
| Factorio | 3.6s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Faxanadu | 2.9s | 6.6s | 0.1s | 2.8s | 8.7s | 14.4s |
| Final Fantasy Mystic Quest | 4.2s | 14.5s | 0.1s | 3.0s | 10.7s | 14.4s |
| Heretic | 3.1s | 15.6s | 0.1s | 2.8s | 15.5s | 14.1s |
| Hylics 2 | 3.9s | 6.8s | 0.1s | 3.0s | 6.7s | 6.7s |
| Inscryption | 3.0s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Kirby's Dream Land 3 | 4.6s | 30.0s | 0.1s | 2.5s | - | - |
| Landstalker - The Treasures of King Nole | 3.2s | 14.5s | 0.1s | 3.0s | 18.7s | 14.4s |
| Links Awakening DX | 9.8s | 16.7s | 0.1s | 3.3s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 3.3s | 5.9s | 0.1s | 2.8s | 5.6s | 5.8s |
| Mario & Luigi Superstar Saga | 3.8s | 9.7s | 0.1s | 4.0s | 9.7s | 23.8s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.8s | 5.7s | 14.3s |
| Mega Man 2 | 3.1s | 6.6s | 0.1s | 2.8s | 6.7s | 6.6s |
| MegaMan Battle Network 3 | 2.9s | 17.2s | 0.1s | 2.6s | 8.5s | 13.9s |
| Meritous | 2.7s | 5.6s | 0.1s | 2.9s | 5.7s | 14.3s |
| Metamath | 9.9s | 5.6s | 0.1s | 2.8s | 5.7s | 5.6s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.7s | 9.7s | 14.3s |
| Noita | 2.9s | 5.7s | 0.1s | 3.0s | 5.8s | 5.8s |
| Old School Runescape | 4.3s | 14.3s | 0.1s | 2.9s | 14.3s | 14.3s |
| Overcooked! 2 | 3.4s | 23.1s | 0.1s | 3.1s | 22.9s | 14.8s |
| Paint | 2.9s | 7.7s | 0.1s | 2.6s | - | - |
| Risk of Rain 2 | 3.0s | 6.6s | 0.1s | 2.8s | 6.7s | 6.7s |
| Saving Princess | 3.0s | 5.6s | 0.1s | 2.8s | 6.6s | 14.3s |
| Shivers | 3.0s | 9.6s | 0.1s | 2.4s | - | - |
| Sonic Adventure 2 Battle | 4.2s | 13.7s | 0.1s | 3.0s | 16.7s | 14.6s |
| Starcraft 2 | 6.8s | 24.9s | 0.1s | 2.7s | - | - |
| Subnautica | 27.3s | 14.3s | 0.1s | 5.8s | 14.7s | 14.2s |
| Super Mario 64 | 3.3s | 12.7s | 0.1s | 3.1s | 12.8s | 12.7s |
| Super Mario Land 2 | 4.0s | 14.4s | 0.1s | 2.6s | - | - |
| Super Mario World | 4.5s | 6.8s | 0.1s | 2.9s | 6.7s | 14.7s |
| TOEM original | 2.8s | 9.8s | 0.1s | 2.8s | 9.7s | 8.7s |
| TOEM rule builder | 2.8s | 8.6s | 0.1s | 2.8s | 9.7s | 9.7s |
| Terraria | 3.0s | 20.8s | 0.1s | 2.9s | 20.8s | 23.7s |
| The Legend of Zelda | 4.0s | 8.5s | 0.1s | 2.8s | 10.5s | 14.0s |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.7s | - | - |
| The Wind Waker | 16.5s | 17.4s | 0.1s | 19.1s | 9.7s | 14.4s |
| Timespinner | 3.7s | 14.3s | 0.1s | 2.6s | - | - |
| Undertale | 3.3s | 5.6s | 0.1s | 2.7s | 5.7s | 14.2s |
| VVVVVV | 2.8s | 14.3s | 0.1s | 2.5s | - | - |
| Wargroove | 3.1s | 6.8s | 0.1s | 2.8s | 6.6s | 6.7s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s | 14.3s |
| Yoshi's Island | 3.6s | 14.3s | 0.1s | 2.7s | - | - |
| shapez | 4.3s | 6.7s | 0.1s | 3.0s | 6.7s | 14.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.3s |
| 2 | The Wind Waker | 16.5s |
| 3 | A Link to the Past | 14.6s |
| 4 | Metamath | 9.9s |
| 5 | Links Awakening DX | 9.8s |
| 6 | Aquaria | 7.1s |
| 7 | Starcraft 2 | 6.8s |
| 8 | A Hat in Time | 5.8s |
| 9 | Celeste (Open World) | 5.1s |
| 10 | Dark Souls III | 5.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 30.0s |
| 2 | Starcraft 2 | 24.9s |
| 3 | Dark Souls III | 24.8s |
| 4 | Overcooked! 2 | 23.1s |
| 5 | A Link to the Past | 21.9s |
| 6 | Terraria | 20.8s |
| 7 | Celeste (Open World) | 19.4s |
| 8 | The Wind Waker | 17.4s |
| 9 | MegaMan Battle Network 3 | 17.2s |
| 10 | Links Awakening DX | 16.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 0.2s |
| 2 | A Link to the Past | 0.1s |
| 3 | Starcraft 2 | 0.1s |
| 4 | A Hat in Time | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Castlevania - Circle of the Moon | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 19.1s |
| 2 | Subnautica | 5.8s |
| 3 | Celeste (Open World) | 4.3s |
| 4 | Mario & Luigi Superstar Saga | 4.0s |
| 5 | Links Awakening DX | 3.3s |
| 6 | Super Mario 64 | 3.1s |
| 7 | Dark Souls III | 3.1s |
| 8 | Overcooked! 2 | 3.1s |
| 9 | A Hat in Time | 3.1s |
| 10 | Aquaria | 3.1s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.7s |
| 2 | Overcooked! 2 | 22.9s |
| 3 | Terraria | 20.8s |
| 4 | Landstalker - The Treasures of King Nole | 18.7s |
| 5 | Links Awakening DX | 16.7s |
| 6 | Sonic Adventure 2 Battle | 16.7s |
| 7 | Celeste (Open World) | 16.0s |
| 8 | DOOM II | 15.8s |
| 9 | Heretic | 15.5s |
| 10 | Donkey Kong Country 3 | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Mario & Luigi Superstar Saga | 23.8s |
| 2 | Terraria | 23.7s |
| 3 | Dark Souls III | 17.2s |
| 4 | Links Awakening DX | 16.7s |
| 5 | Donkey Kong Country 3 | 15.3s |
| 6 | Celeste (Open World) | 14.9s |
| 7 | Overcooked! 2 | 14.8s |
| 8 | Super Mario World | 14.7s |
| 9 | Sonic Adventure 2 Battle | 14.6s |
| 10 | Aquaria | 14.5s |
