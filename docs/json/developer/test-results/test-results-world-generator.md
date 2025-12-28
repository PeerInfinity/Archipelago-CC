# World Generator Test Results

**Generated:** 2025-12-28 18:03:02 UTC

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

**Total Templates:** 62

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 62 | 0 | 62 |
| Original Spoiler Test | 62 | 0 | 62 |
| Stage 1: World Generation | 62 | 0 | 62 |
| Stage 2: Seed Generation | 62 | 0 | 62 |
| Stage 3: WorldGen Spoiler Test | 62 | 0 | 62 |
| Stage 4: Cross-Validation | 62 | 0 | 62 |

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
| TUNIC | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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

**Total Templates:** 62

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 62 | 0 | 62 |
| Original Spoiler Test | 62 | 0 | 62 |
| Stage 1: World Generation | 62 | 0 | 62 |
| Stage 2: Seed Generation | 62 | 0 | 62 |
| Stage 3: WorldGen Spoiler Test | 62 | 0 | 62 |
| Stage 4: Cross-Validation | 32 | 30 | 62 |

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
| TUNIC | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Total | 280.6s | 631.9s | 5.3s | 223.5s | 617.5s | 597.3s |
| Average | 4.5s | 10.2s | 0.1s | 3.6s | 10.0s | 9.6s |
| Max | 27.0s | 23.8s | 0.1s | 17.7s | 23.8s | 23.8s |
| Min | 2.7s | 5.5s | 0.1s | 2.8s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.0s) | Dark Souls III (23.8s) | Aquaria (0.1s) | The Wind Waker (17.7s) | Dark Souls III (23.8s) | Dark Souls III (23.8s) |
| Fastest | ChocolateChipCookies (2.7s) | Undertale (5.5s) | Undertale (0.1s) | VVVVVV (2.8s) | Undertale (5.5s) | Undertale (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 6.0s | 18.0s | 0.1s | 3.8s | 13.8s | 13.7s |
| A Link to the Past | 13.5s | 22.1s | 0.1s | 5.4s | 17.6s | 16.6s |
| A Short Hike | 3.2s | 13.2s | 0.1s | 2.9s | 9.7s | 9.7s |
| APQuest | 3.0s | 10.0s | 0.1s | 2.9s | 5.7s | 5.7s |
| Adventure | 3.1s | 12.2s | 0.1s | 2.9s | 5.6s | 5.7s |
| Aquaria | 7.8s | 9.2s | 0.1s | 3.6s | 7.8s | 8.8s |
| Bumper Stickers | 3.0s | 11.1s | 0.1s | 2.9s | 8.5s | 8.5s |
| Castlevania - Circle of the Moon | 3.2s | 7.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Castlevania 64 | 3.5s | 7.9s | 0.1s | 3.4s | 6.7s | 6.7s |
| Celeste 64 | 3.2s | 9.8s | 0.1s | 3.0s | 7.7s | 6.7s |
| ChecksFinder | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s | 6.8s |
| ChocolateChipCookies | 2.7s | 5.5s | 0.1s | 2.9s | 5.5s | 5.5s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| DLCQuest | 3.2s | 5.7s | 0.1s | 2.9s | 5.7s | 5.6s |
| DOOM 1993 | 3.7s | 12.8s | 0.1s | 3.6s | 12.8s | 12.8s |
| DOOM II | 3.3s | 15.6s | 0.1s | 3.2s | 15.6s | 15.6s |
| Dark Souls III | 5.0s | 23.8s | 0.1s | 3.4s | 23.8s | 23.8s |
| Donkey Kong Country 3 | 3.1s | 13.8s | 0.1s | 3.0s | 13.7s | 13.7s |
| Factorio | 3.8s | 9.7s | 0.1s | 3.2s | 9.7s | 9.8s |
| Faxanadu | 3.0s | 6.7s | 0.1s | 3.0s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 4.2s | 10.6s | 0.1s | 3.4s | 10.6s | 10.6s |
| Heretic | 3.5s | 14.8s | 0.1s | 3.2s | 14.8s | 14.7s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| Inscryption | 3.0s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| Landstalker - The Treasures of King Nole | 3.5s | 8.8s | 0.1s | 3.4s | 18.8s | 8.9s |
| Links Awakening DX | 6.6s | 17.6s | 0.1s | 3.8s | 17.7s | 17.7s |
| Lufia II Ancient Cave | 3.2s | 5.7s | 0.1s | 3.1s | 5.6s | 5.7s |
| Mario & Luigi Superstar Saga | 3.9s | 9.7s | 0.1s | 4.3s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Mega Man 2 | 3.0s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 8.5s | 0.1s | 2.8s | 8.5s | 8.5s |
| Meritous | 2.8s | 5.8s | 0.1s | 2.8s | 5.7s | 5.6s |
| Metamath | 11.2s | 5.6s | 0.1s | 2.8s | 5.7s | 5.7s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 3.0s | 9.7s | 7.7s |
| Noita | 3.2s | 5.8s | 0.1s | 3.4s | 5.9s | 5.9s |
| Old School Runescape | 4.4s | 8.6s | 0.1s | 3.5s | 8.6s | 8.6s |
| Overcooked! 2 | 3.1s | 20.8s | 0.1s | 3.0s | 20.8s | 20.8s |
| Paint | 2.9s | 6.7s | 0.1s | 3.0s | 6.8s | 6.7s |
| Risk of Rain 2 | 3.3s | 6.7s | 0.1s | 3.5s | 6.8s | 6.7s |
| Saving Princess | 3.0s | 5.7s | 0.1s | 3.0s | 6.7s | 5.7s |
| Shivers | 3.1s | 9.5s | 0.1s | 3.1s | 9.6s | 9.6s |
| Sonic Adventure 2 Battle | 4.2s | 13.7s | 0.1s | 3.8s | 16.7s | 13.7s |
| Starcraft 2 | 7.0s | 17.8s | 0.1s | 6.3s | 17.0s | 17.9s |
| Subnautica | 27.0s | 14.7s | 0.1s | 6.0s | 14.7s | 14.7s |
| Super Mario 64 | 3.4s | 12.8s | 0.1s | 3.6s | 12.9s | 12.9s |
| Super Mario Land 2 | 3.9s | 8.6s | 0.1s | 3.6s | 7.7s | 7.6s |
| Super Mario World | 4.4s | 6.6s | 0.1s | 3.2s | 6.7s | 6.7s |
| TOEM original | 2.9s | 8.7s | 0.1s | 3.0s | 9.7s | 8.7s |
| TOEM rule builder | 2.9s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| TUNIC | 6.0s | 12.8s | 0.1s | 4.0s | 11.8s | 12.8s |
| Terraria | 2.9s | 20.6s | 0.1s | 3.0s | 20.6s | 20.6s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | 3.0s | 10.7s | 8.7s |
| The Messenger | 3.5s | 13.9s | 0.1s | 3.4s | 14.0s | 13.9s |
| The Wind Waker | 17.1s | 9.8s | 0.1s | 17.7s | 9.7s | 9.7s |
| Timespinner | 4.4s | 7.8s | 0.1s | 4.5s | 7.9s | 7.9s |
| Undertale | 3.0s | 5.5s | 0.1s | 2.9s | 5.5s | 5.5s |
| VVVVVV | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 5.7s |
| Wargroove | 3.0s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| WebDevJourney | 2.9s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| Yoshi's Island | 3.9s | 9.7s | 0.1s | 5.9s | 8.7s | 8.7s |
| shapez | 4.2s | 6.5s | 0.1s | 3.1s | 6.5s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.0s |
| 2 | The Wind Waker | 17.1s |
| 3 | A Link to the Past | 13.5s |
| 4 | Metamath | 11.2s |
| 5 | Aquaria | 7.8s |
| 6 | Starcraft 2 | 7.0s |
| 7 | Links Awakening DX | 6.6s |
| 8 | TUNIC | 6.0s |
| 9 | A Hat in Time | 6.0s |
| 10 | Dark Souls III | 5.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.8s |
| 2 | A Link to the Past | 22.1s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | Terraria | 20.6s |
| 5 | A Hat in Time | 18.0s |
| 6 | Starcraft 2 | 17.8s |
| 7 | Links Awakening DX | 17.6s |
| 8 | DOOM II | 15.6s |
| 9 | Heretic | 14.8s |
| 10 | Subnautica | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Aquaria | 0.1s |
| 2 | A Hat in Time | 0.1s |
| 3 | A Link to the Past | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Adventure | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | Celeste 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 17.7s |
| 2 | Starcraft 2 | 6.3s |
| 3 | Subnautica | 6.0s |
| 4 | Yoshi's Island | 5.9s |
| 5 | A Link to the Past | 5.4s |
| 6 | Timespinner | 4.5s |
| 7 | Mario & Luigi Superstar Saga | 4.3s |
| 8 | TUNIC | 4.0s |
| 9 | Links Awakening DX | 3.8s |
| 10 | A Hat in Time | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.8s |
| 2 | Overcooked! 2 | 20.8s |
| 3 | Terraria | 20.6s |
| 4 | Landstalker - The Treasures of King Nole | 18.8s |
| 5 | Links Awakening DX | 17.7s |
| 6 | A Link to the Past | 17.6s |
| 7 | Starcraft 2 | 17.0s |
| 8 | Sonic Adventure 2 Battle | 16.7s |
| 9 | DOOM II | 15.6s |
| 10 | Heretic | 14.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.8s |
| 2 | Overcooked! 2 | 20.8s |
| 3 | Terraria | 20.6s |
| 4 | Starcraft 2 | 17.9s |
| 5 | Links Awakening DX | 17.7s |
| 6 | A Link to the Past | 16.6s |
| 7 | DOOM II | 15.6s |
| 8 | Heretic | 14.7s |
| 9 | Subnautica | 14.7s |
| 10 | The Messenger | 13.9s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 286.2s | 621.6s | 5.3s | 223.9s | 612.2s | 732.9s |
| Average | 4.6s | 10.0s | 0.1s | 3.6s | 9.9s | 11.8s |
| Max | 27.3s | 24.9s | 0.1s | 18.4s | 23.8s | 23.7s |
| Min | 2.7s | 5.5s | 0.1s | 2.7s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.3s) | Dark Souls III (24.9s) | A Link to the Past (0.1s) | The Wind Waker (18.4s) | Dark Souls III (23.8s) | Terraria (23.7s) |
| Fastest | Noita (2.7s) | Noita (5.5s) | Super Mario 64 (0.1s) | Noita (2.7s) | Noita (5.5s) | Noita (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.8s | 14.6s | 0.1s | 3.6s | 13.7s | 13.7s |
| A Link to the Past | 15.1s | 23.4s | 0.1s | 5.6s | 17.8s | 14.5s |
| A Short Hike | 3.3s | 12.0s | 0.1s | 3.0s | 9.7s | 9.7s |
| APQuest | 3.1s | 9.2s | 0.1s | 2.9s | 5.7s | 5.7s |
| Adventure | 3.3s | 6.2s | 0.1s | 3.1s | 5.7s | 14.4s |
| Aquaria | 6.6s | 10.0s | 0.1s | 3.0s | 7.5s | 14.0s |
| Bumper Stickers | 3.0s | 9.9s | 0.1s | 2.9s | 8.7s | 14.4s |
| Castlevania - Circle of the Moon | 3.3s | 8.8s | 0.1s | 3.1s | 5.7s | 14.5s |
| Castlevania 64 | 3.5s | 10.4s | 0.1s | 3.3s | 6.7s | 6.7s |
| Celeste 64 | 3.5s | 8.0s | 0.1s | 3.2s | 7.7s | 14.7s |
| ChecksFinder | 2.8s | 6.6s | 0.1s | 2.8s | 6.7s | 6.7s |
| ChocolateChipCookies | 3.0s | 5.8s | 0.1s | 2.9s | 5.7s | 14.5s |
| Choo-Choo Charles | 3.1s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Civilization VI | 3.1s | 8.7s | 0.1s | 3.0s | 8.7s | 17.6s |
| DLCQuest | 3.3s | 5.7s | 0.1s | 3.2s | 5.7s | 5.7s |
| DOOM 1993 | 3.1s | 12.6s | 0.1s | 3.0s | 12.5s | 14.0s |
| DOOM II | 3.4s | 14.7s | 0.1s | 3.2s | 14.7s | 14.5s |
| Dark Souls III | 5.3s | 24.9s | 0.1s | 3.6s | 23.8s | 17.4s |
| Donkey Kong Country 3 | 3.1s | 13.7s | 0.1s | 3.0s | 13.7s | 15.1s |
| Factorio | 4.0s | 9.8s | 0.1s | 3.4s | 9.8s | 9.8s |
| Faxanadu | 2.9s | 6.6s | 0.1s | 2.9s | 8.7s | 14.3s |
| Final Fantasy Mystic Quest | 4.5s | 10.8s | 0.1s | 3.4s | 10.8s | 10.8s |
| Heretic | 3.6s | 14.9s | 0.1s | 3.4s | 14.8s | 14.6s |
| Hylics 2 | 3.9s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| Inscryption | 3.1s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| Landstalker - The Treasures of King Nole | 3.0s | 8.5s | 0.1s | 2.9s | 17.5s | 14.0s |
| Links Awakening DX | 6.8s | 16.8s | 0.1s | 3.9s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.3s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.9s | 9.7s | 0.1s | 4.2s | 9.7s | 9.7s |
| MathProof2p2e4 | 3.0s | 5.7s | 0.1s | 3.1s | 5.7s | 14.5s |
| Mega Man 2 | 3.4s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.3s | 8.8s | 0.1s | 3.0s | 8.7s | 17.6s |
| Meritous | 3.0s | 5.7s | 0.1s | 3.1s | 5.7s | 14.5s |
| Metamath | 10.7s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Muse Dash | 3.3s | 7.7s | 0.1s | 3.1s | 9.7s | 14.5s |
| Noita | 2.7s | 5.5s | 0.1s | 2.7s | 5.5s | 5.5s |
| Old School Runescape | 4.6s | 8.7s | 0.1s | 3.4s | 8.7s | 8.7s |
| Overcooked! 2 | 3.3s | 20.9s | 0.1s | 3.3s | 20.9s | 14.6s |
| Paint | 2.9s | 6.8s | 0.1s | 3.0s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.6s | 6.7s | 0.1s | 3.5s | 6.7s | 6.7s |
| Saving Princess | 2.9s | 5.7s | 0.1s | 3.0s | 6.7s | 14.4s |
| Shivers | 3.4s | 9.8s | 0.1s | 3.1s | 9.7s | 14.5s |
| Sonic Adventure 2 Battle | 4.5s | 13.7s | 0.1s | 4.0s | 16.8s | 14.6s |
| Starcraft 2 | 7.5s | 17.9s | 0.1s | 6.4s | 16.9s | 16.9s |
| Subnautica | 27.3s | 14.8s | 0.1s | 6.4s | 14.8s | 17.9s |
| Super Mario 64 | 2.8s | 12.5s | 0.1s | 2.8s | 12.5s | 12.5s |
| Super Mario Land 2 | 4.0s | 8.7s | 0.1s | 3.6s | 7.7s | 7.7s |
| Super Mario World | 4.6s | 6.8s | 0.1s | 3.4s | 6.7s | 6.7s |
| TOEM original | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| TOEM rule builder | 3.1s | 8.7s | 0.1s | 3.1s | 8.7s | 8.8s |
| TUNIC | 5.8s | 11.7s | 0.1s | 4.0s | 12.8s | 11.7s |
| Terraria | 3.2s | 19.8s | 0.1s | 3.0s | 19.8s | 23.7s |
| The Legend of Zelda | 4.7s | 8.7s | 0.1s | 3.3s | 10.7s | 14.6s |
| The Messenger | 3.6s | 14.0s | 0.1s | 3.3s | 13.9s | 13.9s |
| The Wind Waker | 17.9s | 9.8s | 0.1s | 18.4s | 9.7s | 14.5s |
| Timespinner | 3.7s | 7.5s | 0.1s | 3.4s | 6.5s | 14.0s |
| Undertale | 3.1s | 5.7s | 0.1s | 2.9s | 5.6s | 5.7s |
| VVVVVV | 3.0s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Wargroove | 3.1s | 6.7s | 0.1s | 2.9s | 6.7s | 6.8s |
| WebDevJourney | 3.1s | 8.7s | 0.1s | 3.1s | 8.7s | 14.5s |
| Yoshi's Island | 3.8s | 9.7s | 0.1s | 5.8s | 8.7s | 8.7s |
| shapez | 4.8s | 6.7s | 0.1s | 3.1s | 6.7s | 14.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.3s |
| 2 | The Wind Waker | 17.9s |
| 3 | A Link to the Past | 15.1s |
| 4 | Metamath | 10.7s |
| 5 | Starcraft 2 | 7.5s |
| 6 | Links Awakening DX | 6.8s |
| 7 | Aquaria | 6.6s |
| 8 | A Hat in Time | 5.8s |
| 9 | TUNIC | 5.8s |
| 10 | Dark Souls III | 5.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.9s |
| 2 | A Link to the Past | 23.4s |
| 3 | Overcooked! 2 | 20.9s |
| 4 | Terraria | 19.8s |
| 5 | Starcraft 2 | 17.9s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Heretic | 14.9s |
| 8 | Subnautica | 14.8s |
| 9 | DOOM II | 14.7s |
| 10 | A Hat in Time | 14.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | Starcraft 2 | 0.1s |
| 3 | A Hat in Time | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | APQuest | 0.1s |
| 6 | Adventure | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | Celeste 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 18.4s |
| 2 | Starcraft 2 | 6.4s |
| 3 | Subnautica | 6.4s |
| 4 | Yoshi's Island | 5.8s |
| 5 | A Link to the Past | 5.6s |
| 6 | Mario & Luigi Superstar Saga | 4.2s |
| 7 | Sonic Adventure 2 Battle | 4.0s |
| 8 | TUNIC | 4.0s |
| 9 | Links Awakening DX | 3.9s |
| 10 | A Hat in Time | 3.6s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.8s |
| 2 | Overcooked! 2 | 20.9s |
| 3 | Terraria | 19.8s |
| 4 | A Link to the Past | 17.8s |
| 5 | Landstalker - The Treasures of King Nole | 17.5s |
| 6 | Starcraft 2 | 16.9s |
| 7 | Sonic Adventure 2 Battle | 16.8s |
| 8 | Links Awakening DX | 16.8s |
| 9 | Heretic | 14.8s |
| 10 | Subnautica | 14.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.7s |
| 2 | Subnautica | 17.9s |
| 3 | MegaMan Battle Network 3 | 17.6s |
| 4 | Civilization VI | 17.6s |
| 5 | Dark Souls III | 17.4s |
| 6 | Starcraft 2 | 16.9s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Donkey Kong Country 3 | 15.1s |
| 9 | Celeste 64 | 14.7s |
| 10 | Sonic Adventure 2 Battle | 14.6s |
