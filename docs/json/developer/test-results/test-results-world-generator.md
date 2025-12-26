# World Generator Test Results

**Generated:** 2025-12-26 03:21:04 UTC

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
| Stage 3: WorldGen Spoiler Test | 63 | 0 | 63 |
| Stage 4: Cross-Validation | 63 | 0 | 63 |

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
| Stage 3: WorldGen Spoiler Test | 63 | 0 | 63 |
| Stage 4: Cross-Validation | 31 | 32 | 63 |

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
| Total | 282.6s | 681.2s | 5.6s | 219.2s | 672.0s | 648.6s |
| Average | 4.5s | 10.8s | 0.1s | 3.5s | 10.7s | 10.3s |
| Max | 28.9s | 56.0s | 0.2s | 19.7s | 56.0s | 55.0s |
| Min | 2.7s | 5.5s | 0.1s | 2.7s | 5.6s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (28.9s) | Kirby's Dream Land 3 (56.0s) | Subnautica (0.2s) | The Wind Waker (19.7s) | Kirby's Dream Land 3 (56.0s) | Kirby's Dream Land 3 (55.0s) |
| Fastest | ChocolateChipCookies (2.7s) | Saving Princess (5.5s) | shapez (0.1s) | Meritous (2.7s) | ChocolateChipCookies (5.6s) | Saving Princess (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.2s | 15.2s | 0.1s | 3.4s | 13.7s | 13.7s |
| A Link to the Past | 10.6s | 21.3s | 0.2s | 6.2s | 17.8s | 16.8s |
| A Short Hike | 3.2s | 12.6s | 0.1s | 2.9s | 9.6s | 9.6s |
| APQuest | 3.0s | 7.1s | 0.1s | 2.8s | 5.7s | 5.7s |
| Adventure | 3.1s | 9.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Aquaria | 7.2s | 9.4s | 0.1s | 3.0s | 7.7s | 7.7s |
| Bumper Stickers | 3.0s | 10.6s | 0.1s | 2.8s | 8.6s | 8.7s |
| Castlevania - Circle of the Moon | 3.2s | 9.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Castlevania 64 | 3.7s | 7.3s | 0.1s | 3.5s | 6.7s | 6.7s |
| Celeste (Open World) | 4.8s | 16.7s | 0.2s | 4.4s | 14.9s | 14.9s |
| Celeste 64 | 3.1s | 6.7s | 0.1s | 3.0s | 7.7s | 6.7s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.8s | 0.1s | 2.8s | 5.6s | 5.5s |
| Choo-Choo Charles | 3.0s | 9.7s | 0.1s | 3.0s | 10.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.8s | 8.7s | 8.6s |
| DLCQuest | 3.2s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| DOOM 1993 | 3.1s | 12.7s | 0.1s | 3.0s | 12.7s | 12.7s |
| DOOM II | 3.3s | 14.7s | 0.1s | 3.0s | 15.8s | 14.8s |
| Dark Souls III | 5.2s | 25.8s | 0.1s | 3.6s | 25.9s | 25.9s |
| Donkey Kong Country 3 | 3.2s | 14.9s | 0.1s | 3.2s | 14.8s | 14.8s |
| Factorio | 3.6s | 9.7s | 0.1s | 3.2s | 9.7s | 9.7s |
| Faxanadu | 3.1s | 6.7s | 0.1s | 3.1s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 4.1s | 10.6s | 0.1s | 3.1s | 10.6s | 10.6s |
| Heretic | 3.4s | 14.8s | 0.1s | 3.2s | 14.8s | 14.8s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 2.8s | 6.6s | 6.6s |
| Inscryption | 3.1s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| Kirby's Dream Land 3 | 4.8s | 56.0s | 0.1s | 3.2s | 56.0s | 55.0s |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 3.0s | 17.7s | 8.7s |
| Links Awakening DX | 9.9s | 17.8s | 0.1s | 3.8s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.1s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 4.0s | 9.7s | 0.1s | 3.6s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 2.7s | 5.7s | 5.6s |
| Mega Man 2 | 3.0s | 6.7s | 0.1s | 2.9s | 6.5s | 6.6s |
| MegaMan Battle Network 3 | 3.2s | 8.7s | 0.1s | 2.8s | 8.8s | 8.6s |
| Meritous | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s | 5.6s |
| Metamath | 10.3s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.9s | 9.7s | 7.6s |
| Noita | 2.9s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Old School Runescape | 4.8s | 8.7s | 0.1s | 3.4s | 8.8s | 8.8s |
| Overcooked! 2 | 3.3s | 21.9s | 0.1s | 3.2s | 21.8s | 21.9s |
| Paint | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.3s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| Saving Princess | 2.9s | 5.5s | 0.1s | 2.9s | 6.5s | 5.5s |
| Shivers | 3.4s | 9.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 4.0s | 13.7s | 0.1s | 3.8s | 16.7s | 13.7s |
| Starcraft 2 | 7.0s | 20.0s | 0.1s | 5.9s | 16.8s | 16.8s |
| Subnautica | 28.9s | 10.8s | 0.2s | 3.5s | 9.7s | 9.7s |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 2.9s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.1s | 7.8s | 0.1s | 3.3s | 7.8s | 7.8s |
| Super Mario World | 4.5s | 6.7s | 0.1s | 3.2s | 6.7s | 6.8s |
| TOEM original | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s | 9.7s |
| TOEM rule builder | 3.0s | 9.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Terraria | 3.0s | 20.7s | 0.1s | 3.0s | 20.7s | 20.7s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | 3.0s | 10.7s | 8.7s |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.9s | 12.8s | 12.8s |
| The Wind Waker | 16.3s | 9.7s | 0.1s | 19.7s | 9.7s | 9.7s |
| Timespinner | 3.7s | 7.6s | 0.1s | 3.4s | 6.6s | 6.7s |
| Undertale | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 3.2s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Wargroove | 3.1s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| WebDevJourney | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s | 8.6s |
| Yoshi's Island | 3.9s | 9.7s | 0.1s | 5.7s | 8.7s | 8.7s |
| shapez | 4.2s | 6.6s | 0.1s | 3.0s | 6.5s | 6.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 28.9s |
| 2 | The Wind Waker | 16.3s |
| 3 | A Link to the Past | 10.6s |
| 4 | Metamath | 10.3s |
| 5 | Links Awakening DX | 9.9s |
| 6 | Aquaria | 7.2s |
| 7 | Starcraft 2 | 7.0s |
| 8 | Dark Souls III | 5.2s |
| 9 | A Hat in Time | 5.2s |
| 10 | Old School Runescape | 4.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.0s |
| 2 | Dark Souls III | 25.8s |
| 3 | Overcooked! 2 | 21.9s |
| 4 | A Link to the Past | 21.3s |
| 5 | Terraria | 20.7s |
| 6 | Starcraft 2 | 20.0s |
| 7 | Links Awakening DX | 17.8s |
| 8 | Celeste (Open World) | 16.7s |
| 9 | A Hat in Time | 15.2s |
| 10 | Donkey Kong Country 3 | 14.9s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | Celeste (Open World) | 0.2s |
| 4 | Aquaria | 0.1s |
| 5 | Starcraft 2 | 0.1s |
| 6 | A Hat in Time | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 19.7s |
| 2 | A Link to the Past | 6.2s |
| 3 | Starcraft 2 | 5.9s |
| 4 | Yoshi's Island | 5.7s |
| 5 | Celeste (Open World) | 4.4s |
| 6 | Links Awakening DX | 3.8s |
| 7 | Sonic Adventure 2 Battle | 3.8s |
| 8 | Mario & Luigi Superstar Saga | 3.6s |
| 9 | Dark Souls III | 3.6s |
| 10 | Subnautica | 3.5s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.0s |
| 2 | Dark Souls III | 25.9s |
| 3 | Overcooked! 2 | 21.8s |
| 4 | Terraria | 20.7s |
| 5 | A Link to the Past | 17.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Starcraft 2 | 16.8s |
| 9 | Sonic Adventure 2 Battle | 16.7s |
| 10 | DOOM II | 15.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 55.0s |
| 2 | Dark Souls III | 25.9s |
| 3 | Overcooked! 2 | 21.9s |
| 4 | Terraria | 20.7s |
| 5 | Links Awakening DX | 16.8s |
| 6 | Starcraft 2 | 16.8s |
| 7 | A Link to the Past | 16.8s |
| 8 | Celeste (Open World) | 14.9s |
| 9 | DOOM II | 14.8s |
| 10 | Donkey Kong Country 3 | 14.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 278.8s | 693.8s | 5.5s | 216.0s | 668.0s | 746.7s |
| Average | 4.4s | 11.0s | 0.1s | 3.4s | 10.6s | 11.9s |
| Max | 28.3s | 54.5s | 0.2s | 17.7s | 54.9s | 24.1s |
| Min | 2.7s | 5.4s | 0.1s | 2.6s | 5.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (28.3s) | Kirby's Dream Land 3 (54.5s) | Subnautica (0.2s) | The Wind Waker (17.7s) | Kirby's Dream Land 3 (54.9s) | Terraria (24.1s) |
| Fastest | TOEM original (2.7s) | Noita (5.4s) | WebDevJourney (0.1s) | TOEM original (2.6s) | Noita (5.4s) | Undertale (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.7s | 17.1s | 0.1s | 3.3s | 13.6s | 13.5s |
| A Link to the Past | 10.6s | 21.4s | 0.2s | 6.3s | 18.8s | 14.4s |
| A Short Hike | 3.3s | 11.4s | 0.1s | 3.2s | 9.8s | 9.8s |
| APQuest | 3.3s | 13.1s | 0.1s | 3.1s | 5.6s | 5.6s |
| Adventure | 3.0s | 11.1s | 0.1s | 2.9s | 5.6s | 14.2s |
| Aquaria | 6.7s | 10.2s | 0.1s | 2.9s | 7.5s | 14.0s |
| Bumper Stickers | 2.9s | 9.8s | 0.1s | 2.7s | 8.6s | 14.2s |
| Castlevania - Circle of the Moon | 3.0s | 10.9s | 0.1s | 2.8s | 5.5s | 13.9s |
| Castlevania 64 | 3.6s | 9.6s | 0.1s | 3.4s | 6.7s | 6.7s |
| Celeste (Open World) | 4.5s | 20.2s | 0.2s | 4.2s | 14.7s | 14.6s |
| Celeste 64 | 2.9s | 6.5s | 0.1s | 2.7s | 7.5s | 13.9s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.9s | 5.8s | 0.1s | 3.1s | 6.0s | 14.4s |
| Choo-Choo Charles | 3.2s | 10.6s | 0.1s | 3.1s | 10.6s | 10.6s |
| Civilization VI | 2.9s | 8.6s | 0.1s | 2.8s | 8.7s | 17.3s |
| DLCQuest | 3.1s | 5.5s | 0.1s | 2.9s | 5.5s | 5.5s |
| DOOM 1993 | 3.1s | 12.7s | 0.1s | 3.0s | 12.7s | 14.2s |
| DOOM II | 3.1s | 15.5s | 0.1s | 2.9s | 15.5s | 13.9s |
| Dark Souls III | 5.3s | 24.8s | 0.1s | 3.5s | 24.8s | 17.3s |
| Donkey Kong Country 3 | 3.1s | 13.8s | 0.1s | 3.0s | 13.7s | 15.0s |
| Factorio | 3.4s | 9.5s | 0.1s | 2.8s | 9.5s | 9.5s |
| Faxanadu | 3.1s | 6.7s | 0.1s | 3.0s | 8.7s | 14.4s |
| Final Fantasy Mystic Quest | 4.3s | 10.8s | 0.1s | 3.5s | 10.9s | 10.9s |
| Heretic | 3.6s | 15.7s | 0.1s | 3.5s | 15.7s | 14.3s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.7s |
| Inscryption | 3.0s | 6.5s | 0.1s | 2.8s | 6.5s | 6.5s |
| Kirby's Dream Land 3 | 4.6s | 54.5s | 0.1s | 3.3s | 54.9s | 17.4s |
| Landstalker - The Treasures of King Nole | 3.0s | 8.6s | 0.1s | 3.0s | 17.5s | 13.9s |
| Links Awakening DX | 10.0s | 17.8s | 0.1s | 3.8s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.0s | 5.6s | 0.1s | 3.0s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.6s | 9.6s | 0.1s | 3.3s | 9.5s | 9.6s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s | 14.4s |
| Mega Man 2 | 3.4s | 7.0s | 0.1s | 3.3s | 6.8s | 6.8s |
| MegaMan Battle Network 3 | 3.4s | 8.7s | 0.1s | 3.1s | 8.6s | 17.3s |
| Meritous | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 14.2s |
| Metamath | 10.6s | 5.5s | 0.1s | 2.7s | 5.5s | 5.5s |
| Muse Dash | 3.0s | 7.6s | 0.1s | 2.8s | 9.7s | 14.2s |
| Noita | 2.7s | 5.4s | 0.1s | 2.7s | 5.4s | 5.4s |
| Old School Runescape | 5.0s | 8.8s | 0.1s | 3.3s | 8.7s | 8.7s |
| Overcooked! 2 | 3.1s | 20.8s | 0.1s | 3.1s | 20.8s | 14.3s |
| Paint | 2.7s | 7.7s | 0.1s | 2.8s | 6.5s | 6.5s |
| Risk of Rain 2 | 3.2s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| Saving Princess | 3.4s | 5.8s | 0.1s | 3.0s | 6.8s | 14.5s |
| Shivers | 3.5s | 9.7s | 0.1s | 3.3s | 9.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.0s | 13.7s | 0.1s | 3.8s | 16.7s | 14.4s |
| Starcraft 2 | 6.6s | 19.7s | 0.1s | 5.7s | 16.7s | 16.7s |
| Subnautica | 28.3s | 10.8s | 0.2s | 3.6s | 9.7s | 17.0s |
| Super Mario 64 | 2.8s | 12.5s | 0.1s | 2.7s | 12.5s | 12.5s |
| Super Mario Land 2 | 4.3s | 7.7s | 0.1s | 3.2s | 7.7s | 7.7s |
| Super Mario World | 4.4s | 6.7s | 0.1s | 3.1s | 6.7s | 6.6s |
| TOEM original | 2.7s | 9.5s | 0.1s | 2.6s | 9.5s | 9.5s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Terraria | 3.4s | 20.8s | 0.1s | 3.3s | 20.9s | 24.1s |
| The Legend of Zelda | 4.5s | 8.6s | 0.1s | 3.4s | 10.6s | 14.3s |
| The Messenger | 3.2s | 12.8s | 0.1s | 3.0s | 12.8s | 12.8s |
| The Wind Waker | 15.0s | 9.5s | 0.1s | 17.7s | 9.5s | 13.9s |
| Timespinner | 3.7s | 7.6s | 0.1s | 3.4s | 6.6s | 14.3s |
| Undertale | 2.8s | 5.5s | 0.1s | 2.6s | 5.4s | 5.4s |
| VVVVVV | 3.2s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Wargroove | 2.9s | 6.6s | 0.1s | 2.8s | 6.6s | 6.6s |
| WebDevJourney | 2.7s | 8.5s | 0.1s | 2.6s | 8.5s | 13.9s |
| Yoshi's Island | 3.8s | 9.7s | 0.1s | 5.6s | 8.7s | 8.7s |
| shapez | 4.9s | 6.8s | 0.1s | 3.1s | 6.7s | 14.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 28.3s |
| 2 | The Wind Waker | 15.0s |
| 3 | A Link to the Past | 10.6s |
| 4 | Metamath | 10.6s |
| 5 | Links Awakening DX | 10.0s |
| 6 | Aquaria | 6.7s |
| 7 | Starcraft 2 | 6.6s |
| 8 | Dark Souls III | 5.3s |
| 9 | Old School Runescape | 5.0s |
| 10 | shapez | 4.9s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 54.5s |
| 2 | Dark Souls III | 24.8s |
| 3 | A Link to the Past | 21.4s |
| 4 | Terraria | 20.8s |
| 5 | Overcooked! 2 | 20.8s |
| 6 | Celeste (Open World) | 20.2s |
| 7 | Starcraft 2 | 19.7s |
| 8 | Links Awakening DX | 17.8s |
| 9 | A Hat in Time | 17.1s |
| 10 | Heretic | 15.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | Celeste (Open World) | 0.2s |
| 4 | A Short Hike | 0.1s |
| 5 | Castlevania 64 | 0.1s |
| 6 | Starcraft 2 | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Aquaria | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 17.7s |
| 2 | A Link to the Past | 6.3s |
| 3 | Starcraft 2 | 5.7s |
| 4 | Yoshi's Island | 5.6s |
| 5 | Celeste (Open World) | 4.2s |
| 6 | Links Awakening DX | 3.8s |
| 7 | Sonic Adventure 2 Battle | 3.8s |
| 8 | Subnautica | 3.6s |
| 9 | Dark Souls III | 3.5s |
| 10 | Heretic | 3.5s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 54.9s |
| 2 | Dark Souls III | 24.8s |
| 3 | Terraria | 20.9s |
| 4 | Overcooked! 2 | 20.8s |
| 5 | A Link to the Past | 18.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.5s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Sonic Adventure 2 Battle | 16.7s |
| 9 | Starcraft 2 | 16.7s |
| 10 | Heretic | 15.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 24.1s |
| 2 | Kirby's Dream Land 3 | 17.4s |
| 3 | Civilization VI | 17.3s |
| 4 | Dark Souls III | 17.3s |
| 5 | MegaMan Battle Network 3 | 17.3s |
| 6 | Subnautica | 17.0s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Starcraft 2 | 16.7s |
| 9 | Donkey Kong Country 3 | 15.0s |
| 10 | shapez | 14.7s |
