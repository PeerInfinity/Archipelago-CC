# World Generator Test Results

**Generated:** 2025-12-26 00:57:40 UTC

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
| Stage 2: Seed Generation | 62 | 1 | 63 |
| Stage 3: WorldGen Spoiler Test | 61 | 1 | 62 |
| Stage 4: Cross-Validation | 61 | 1 | 62 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Stage 2: Seed Generation | 62 | 1 | 63 |
| Stage 3: WorldGen Spoiler Test | 61 | 1 | 62 |
| Stage 4: Cross-Validation | 30 | 32 | 62 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Total | 279.6s | 683.2s | 5.5s | 218.0s | 668.4s | 647.0s |
| Average | 4.4s | 10.8s | 0.1s | 3.5s | 10.8s | 10.4s |
| Max | 28.6s | 56.0s | 0.2s | 19.2s | 56.0s | 54.9s |
| Min | 2.6s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (28.6s) | Kirby's Dream Land 3 (56.0s) | Celeste (Open World) (0.2s) | The Wind Waker (19.2s) | Kirby's Dream Land 3 (56.0s) | Kirby's Dream Land 3 (54.9s) |
| Fastest | ChocolateChipCookies (2.6s) | Undertale (5.6s) | shapez (0.1s) | Super Mario Land 2 (2.6s) | Adventure (5.6s) | Metamath (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.0s | 14.4s | 0.1s | 3.4s | 13.7s | 13.8s |
| A Link to the Past | 10.7s | 19.9s | 0.1s | 6.3s | 17.8s | 16.8s |
| A Short Hike | 3.1s | 13.0s | 0.1s | 2.9s | 9.7s | 9.6s |
| APQuest | 3.0s | 6.3s | 0.1s | 2.8s | 5.6s | 5.6s |
| Adventure | 3.1s | 10.2s | 0.1s | 2.9s | 5.6s | 5.6s |
| Aquaria | 7.0s | 8.4s | 0.1s | 3.0s | 7.7s | 7.7s |
| Bumper Stickers | 3.0s | 10.0s | 0.1s | 2.8s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.3s | 10.3s | 0.1s | 3.0s | 5.6s | 5.6s |
| Castlevania 64 | 3.6s | 10.2s | 0.1s | 3.4s | 6.7s | 6.7s |
| Celeste (Open World) | 4.8s | 19.2s | 0.2s | 4.4s | 14.8s | 14.8s |
| Celeste 64 | 3.0s | 6.7s | 0.1s | 3.0s | 7.7s | 6.7s |
| ChecksFinder | 2.9s | 6.8s | 0.1s | 2.9s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.6s | 5.6s | 0.1s | 2.8s | 5.6s | 5.7s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.8s | 8.6s | 8.6s |
| DLCQuest | 3.1s | 5.7s | 0.1s | 3.0s | 5.7s | 5.6s |
| DOOM 1993 | 3.2s | 12.7s | 0.1s | 3.1s | 12.7s | 12.7s |
| DOOM II | 3.3s | 15.8s | 0.1s | 3.0s | 14.7s | 15.7s |
| Dark Souls III | 5.1s | 25.8s | 0.1s | 3.5s | 24.8s | 24.8s |
| Donkey Kong Country 3 | 3.4s | 14.8s | 0.1s | 3.2s | 14.8s | 14.8s |
| Factorio | 3.6s | 9.7s | 0.1s | 3.1s | 9.7s | 9.7s |
| Faxanadu | 3.0s | 6.7s | 0.1s | 3.1s | 8.7s | 6.8s |
| Final Fantasy Mystic Quest | 3.9s | 10.7s | 0.1s | 3.2s | 10.7s | 10.7s |
| Heretic | 3.3s | 14.8s | 0.1s | 3.2s | 14.8s | 14.7s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 2.9s | 6.6s | 6.6s |
| Inscryption | 3.0s | 6.8s | 0.1s | 2.9s | 6.7s | 6.6s |
| Kirby's Dream Land 3 | 4.7s | 56.0s | 0.1s | 3.3s | 56.0s | 54.9s |
| Landstalker - The Treasures of King Nole | 3.2s | 8.8s | 0.1s | 3.1s | 17.7s | 8.7s |
| Links Awakening DX | 10.0s | 16.8s | 0.1s | 3.5s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.9s | 9.7s | 0.1s | 3.5s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 3.0s | 5.7s | 5.8s |
| Mega Man 2 | 2.9s | 6.6s | 0.1s | 2.9s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 5.7s |
| Metamath | 10.1s | 5.7s | 0.1s | 2.8s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 3.0s | 9.7s | 7.7s |
| Noita | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.7s |
| Old School Runescape | 4.6s | 8.7s | 0.1s | 3.1s | 8.7s | 8.7s |
| Overcooked! 2 | 3.3s | 21.9s | 0.1s | 3.2s | 21.8s | 21.9s |
| Paint | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.3s | 6.7s | 0.1s | 3.4s | 6.7s | 6.8s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 3.0s | 6.7s | 5.7s |
| Shivers | 3.3s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 4.1s | 14.2s | 0.1s | 4.0s | 16.8s | 13.8s |
| Starcraft 2 | 6.9s | 18.8s | 0.1s | 5.8s | 16.8s | 16.8s |
| Subnautica | 28.6s | 10.9s | 0.1s | 3.0s | 17.4s | 16.6s |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 2.9s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.0s | 7.7s | 0.1s | 2.6s | - | - |
| Super Mario World | 4.5s | 6.8s | 0.1s | 3.3s | 6.7s | 6.7s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| TOEM rule builder | 2.9s | 9.7s | 0.1s | 3.0s | 9.8s | 9.8s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.9s | 19.8s | 19.8s |
| The Legend of Zelda | 4.3s | 8.7s | 0.1s | 3.1s | 10.7s | 8.7s |
| The Messenger | 3.2s | 12.8s | 0.1s | 3.2s | 12.9s | 12.9s |
| The Wind Waker | 16.0s | 9.7s | 0.1s | 19.2s | 9.7s | 9.7s |
| Timespinner | 3.7s | 7.7s | 0.1s | 3.4s | 6.7s | 6.7s |
| Undertale | 3.0s | 5.6s | 0.1s | 2.9s | 5.7s | 5.6s |
| VVVVVV | 3.0s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Wargroove | 3.2s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| WebDevJourney | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Yoshi's Island | 3.9s | 9.7s | 0.1s | 6.0s | 8.8s | 8.8s |
| shapez | 4.2s | 6.7s | 0.1s | 2.9s | 6.6s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 28.6s |
| 2 | The Wind Waker | 16.0s |
| 3 | A Link to the Past | 10.7s |
| 4 | Metamath | 10.1s |
| 5 | Links Awakening DX | 10.0s |
| 6 | Aquaria | 7.0s |
| 7 | Starcraft 2 | 6.9s |
| 8 | Dark Souls III | 5.1s |
| 9 | A Hat in Time | 5.0s |
| 10 | Celeste (Open World) | 4.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.0s |
| 2 | Dark Souls III | 25.8s |
| 3 | Overcooked! 2 | 21.9s |
| 4 | Terraria | 20.8s |
| 5 | A Link to the Past | 19.9s |
| 6 | Celeste (Open World) | 19.2s |
| 7 | Starcraft 2 | 18.8s |
| 8 | Links Awakening DX | 16.8s |
| 9 | DOOM II | 15.8s |
| 10 | Heretic | 14.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 0.2s |
| 2 | A Link to the Past | 0.1s |
| 3 | Starcraft 2 | 0.1s |
| 4 | Subnautica | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Castlevania 64 | 0.1s |
| 8 | A Short Hike | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 19.2s |
| 2 | A Link to the Past | 6.3s |
| 3 | Yoshi's Island | 6.0s |
| 4 | Starcraft 2 | 5.8s |
| 5 | Celeste (Open World) | 4.4s |
| 6 | Sonic Adventure 2 Battle | 4.0s |
| 7 | Mario & Luigi Superstar Saga | 3.5s |
| 8 | Dark Souls III | 3.5s |
| 9 | Links Awakening DX | 3.5s |
| 10 | Risk of Rain 2 | 3.4s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.0s |
| 2 | Dark Souls III | 24.8s |
| 3 | Overcooked! 2 | 21.8s |
| 4 | Terraria | 19.8s |
| 5 | A Link to the Past | 17.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Subnautica | 17.4s |
| 8 | Sonic Adventure 2 Battle | 16.8s |
| 9 | Starcraft 2 | 16.8s |
| 10 | Links Awakening DX | 16.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 54.9s |
| 2 | Dark Souls III | 24.8s |
| 3 | Overcooked! 2 | 21.9s |
| 4 | Terraria | 19.8s |
| 5 | Starcraft 2 | 16.8s |
| 6 | Links Awakening DX | 16.8s |
| 7 | A Link to the Past | 16.8s |
| 8 | Subnautica | 16.6s |
| 9 | DOOM II | 15.7s |
| 10 | Celeste (Open World) | 14.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 280.2s | 693.7s | 5.5s | 218.7s | 670.1s | 743.2s |
| Average | 4.4s | 11.0s | 0.1s | 3.5s | 10.8s | 12.0s |
| Max | 28.4s | 55.0s | 0.2s | 19.3s | 54.5s | 23.7s |
| Min | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (28.4s) | Kirby's Dream Land 3 (55.0s) | Celeste (Open World) (0.2s) | The Wind Waker (19.3s) | Kirby's Dream Land 3 (54.5s) | Terraria (23.7s) |
| Fastest | ChecksFinder (2.7s) | Metamath (5.6s) | shapez (0.1s) | Super Mario Land 2 (2.6s) | MathProof2p2e4 (5.6s) | Metamath (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.4s | 16.1s | 0.1s | 3.7s | 13.8s | 13.8s |
| A Link to the Past | 10.0s | 21.5s | 0.1s | 5.9s | 17.7s | 14.3s |
| A Short Hike | 3.2s | 11.5s | 0.1s | 3.0s | 9.7s | 9.8s |
| APQuest | 2.9s | 8.8s | 0.1s | 2.7s | 5.6s | 5.6s |
| Adventure | 3.1s | 11.1s | 0.1s | 3.0s | 5.6s | 14.2s |
| Aquaria | 7.0s | 10.3s | 0.1s | 2.9s | 7.7s | 14.4s |
| Bumper Stickers | 3.0s | 12.6s | 0.1s | 2.8s | 8.7s | 14.3s |
| Castlevania - Circle of the Moon | 3.4s | 10.2s | 0.1s | 3.1s | 5.7s | 14.4s |
| Castlevania 64 | 3.4s | 9.6s | 0.1s | 3.4s | 6.7s | 6.7s |
| Celeste (Open World) | 4.7s | 19.3s | 0.2s | 4.4s | 14.8s | 14.8s |
| Celeste 64 | 3.3s | 6.7s | 0.1s | 3.2s | 7.7s | 14.6s |
| ChecksFinder | 2.7s | 6.8s | 0.1s | 2.7s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 14.5s |
| Choo-Choo Charles | 2.8s | 10.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Civilization VI | 3.1s | 8.7s | 0.1s | 2.8s | 8.7s | 17.4s |
| DLCQuest | 3.1s | 5.7s | 0.1s | 2.9s | 5.7s | 5.6s |
| DOOM 1993 | 3.1s | 12.7s | 0.1s | 3.0s | 12.7s | 14.3s |
| DOOM II | 3.4s | 15.7s | 0.1s | 3.4s | 15.8s | 14.5s |
| Dark Souls III | 4.9s | 24.8s | 0.1s | 3.3s | 23.8s | 17.4s |
| Donkey Kong Country 3 | 3.2s | 14.9s | 0.1s | 3.2s | 14.8s | 15.1s |
| Factorio | 3.9s | 9.8s | 0.1s | 3.3s | 9.8s | 9.8s |
| Faxanadu | 2.9s | 6.6s | 0.1s | 2.8s | 8.6s | 14.2s |
| Final Fantasy Mystic Quest | 4.1s | 10.8s | 0.1s | 3.3s | 10.8s | 10.8s |
| Heretic | 3.2s | 14.8s | 0.1s | 3.1s | 14.7s | 14.4s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 2.8s | 6.7s | 6.7s |
| Inscryption | 3.0s | 6.6s | 0.1s | 2.8s | 6.6s | 6.6s |
| Kirby's Dream Land 3 | 4.7s | 55.0s | 0.1s | 3.3s | 54.5s | 17.5s |
| Landstalker - The Treasures of King Nole | 3.5s | 8.7s | 0.1s | 3.3s | 17.8s | 14.4s |
| Links Awakening DX | 9.7s | 16.7s | 0.1s | 3.7s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.2s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 4.2s | 9.8s | 0.1s | 3.8s | 9.8s | 9.8s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 14.2s |
| Mega Man 2 | 3.0s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 8.6s | 17.4s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.8s | 5.7s | 14.2s |
| Metamath | 9.8s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 7.6s | 0.1s | 2.9s | 9.7s | 14.3s |
| Noita | 3.2s | 5.7s | 0.1s | 3.1s | 5.6s | 5.7s |
| Old School Runescape | 4.5s | 8.7s | 0.1s | 3.1s | 8.7s | 8.7s |
| Overcooked! 2 | 3.3s | 21.8s | 0.1s | 3.2s | 21.8s | 14.5s |
| Paint | 3.1s | 7.9s | 0.1s | 3.1s | 6.8s | 6.7s |
| Risk of Rain 2 | 3.0s | 6.6s | 0.1s | 2.9s | 6.6s | 6.7s |
| Saving Princess | 3.0s | 5.8s | 0.1s | 3.0s | 6.7s | 14.5s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.9s | 9.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.1s | 13.7s | 0.1s | 4.0s | 16.7s | 14.6s |
| Starcraft 2 | 6.7s | 19.8s | 0.1s | 5.8s | 16.8s | 16.8s |
| Subnautica | 28.4s | 10.8s | 0.1s | 3.0s | 20.4s | 16.6s |
| Super Mario 64 | 3.2s | 12.7s | 0.1s | 3.1s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.1s | 7.7s | 0.1s | 2.6s | - | - |
| Super Mario World | 4.5s | 6.7s | 0.1s | 3.3s | 6.7s | 6.7s |
| TOEM original | 3.0s | 9.8s | 0.1s | 3.0s | 9.7s | 9.8s |
| TOEM rule builder | 2.7s | 8.7s | 0.1s | 2.7s | 8.6s | 8.6s |
| Terraria | 3.1s | 21.0s | 0.1s | 3.1s | 19.9s | 23.7s |
| The Legend of Zelda | 4.3s | 8.8s | 0.1s | 3.1s | 10.7s | 14.3s |
| The Messenger | 3.3s | 12.9s | 0.1s | 3.1s | 12.8s | 12.8s |
| The Wind Waker | 16.1s | 9.7s | 0.1s | 19.3s | 9.7s | 14.3s |
| Timespinner | 3.7s | 7.6s | 0.1s | 3.4s | 6.7s | 14.3s |
| Undertale | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Wargroove | 3.1s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| WebDevJourney | 3.1s | 8.7s | 0.1s | 3.0s | 8.8s | 14.4s |
| Yoshi's Island | 3.8s | 9.7s | 0.1s | 5.5s | 8.6s | 8.7s |
| shapez | 4.4s | 6.7s | 0.1s | 3.0s | 6.7s | 14.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 28.4s |
| 2 | The Wind Waker | 16.1s |
| 3 | A Link to the Past | 10.0s |
| 4 | Metamath | 9.8s |
| 5 | Links Awakening DX | 9.7s |
| 6 | Aquaria | 7.0s |
| 7 | Starcraft 2 | 6.7s |
| 8 | A Hat in Time | 5.4s |
| 9 | Dark Souls III | 4.9s |
| 10 | Celeste (Open World) | 4.7s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 55.0s |
| 2 | Dark Souls III | 24.8s |
| 3 | Overcooked! 2 | 21.8s |
| 4 | A Link to the Past | 21.5s |
| 5 | Terraria | 21.0s |
| 6 | Starcraft 2 | 19.8s |
| 7 | Celeste (Open World) | 19.3s |
| 8 | Links Awakening DX | 16.7s |
| 9 | A Hat in Time | 16.1s |
| 10 | DOOM II | 15.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 0.2s |
| 2 | A Hat in Time | 0.1s |
| 3 | A Link to the Past | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | Subnautica | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Castlevania - Circle of the Moon | 0.1s |
| 8 | A Short Hike | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 19.3s |
| 2 | A Link to the Past | 5.9s |
| 3 | Starcraft 2 | 5.8s |
| 4 | Yoshi's Island | 5.5s |
| 5 | Celeste (Open World) | 4.4s |
| 6 | Sonic Adventure 2 Battle | 4.0s |
| 7 | Mario & Luigi Superstar Saga | 3.8s |
| 8 | A Hat in Time | 3.7s |
| 9 | Links Awakening DX | 3.7s |
| 10 | Timespinner | 3.4s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 54.5s |
| 2 | Dark Souls III | 23.8s |
| 3 | Overcooked! 2 | 21.8s |
| 4 | Subnautica | 20.4s |
| 5 | Terraria | 19.9s |
| 6 | Landstalker - The Treasures of King Nole | 17.8s |
| 7 | A Link to the Past | 17.7s |
| 8 | Links Awakening DX | 16.8s |
| 9 | Starcraft 2 | 16.8s |
| 10 | Sonic Adventure 2 Battle | 16.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.7s |
| 2 | Kirby's Dream Land 3 | 17.5s |
| 3 | Civilization VI | 17.4s |
| 4 | Dark Souls III | 17.4s |
| 5 | MegaMan Battle Network 3 | 17.4s |
| 6 | Starcraft 2 | 16.8s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Subnautica | 16.6s |
| 9 | Donkey Kong Country 3 | 15.1s |
| 10 | Celeste (Open World) | 14.8s |
