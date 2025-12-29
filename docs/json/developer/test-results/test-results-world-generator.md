# World Generator Test Results

**Generated:** 2025-12-29 00:28:57 UTC

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

**Total Templates:** 61

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 61 | 0 | 61 |
| Original Spoiler Test | 61 | 0 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 61 | 0 | 61 |
| Stage 3: WorldGen Spoiler Test | 61 | 0 | 61 |
| Stage 4: Cross-Validation | 61 | 0 | 61 |

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

**Total Templates:** 61

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 61 | 0 | 61 |
| Original Spoiler Test | 61 | 0 | 61 |
| Stage 1: World Generation | 61 | 0 | 61 |
| Stage 2: Seed Generation | 61 | 0 | 61 |
| Stage 3: WorldGen Spoiler Test | 61 | 0 | 61 |
| Stage 4: Cross-Validation | 31 | 30 | 61 |

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
| Total | 280.2s | 609.3s | 5.3s | 217.6s | 597.4s | 577.3s |
| Average | 4.6s | 10.0s | 0.1s | 3.6s | 9.8s | 9.5s |
| Max | 27.1s | 24.8s | 0.1s | 17.9s | 24.9s | 24.8s |
| Min | 2.8s | 5.7s | 0.1s | 2.8s | 5.6s | 5.7s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.1s) | Dark Souls III (24.8s) | A Link to the Past (0.1s) | The Wind Waker (17.9s) | Dark Souls III (24.9s) | Dark Souls III (24.8s) |
| Fastest | ChocolateChipCookies (2.8s) | Noita (5.7s) | WebDevJourney (0.1s) | MathProof2p2e4 (2.8s) | APQuest (5.6s) | VVVVVV (5.7s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 6.1s | 18.6s | 0.1s | 3.7s | 13.8s | 13.7s |
| A Link to the Past | 14.9s | 18.5s | 0.1s | 5.5s | 17.8s | 16.7s |
| A Short Hike | 3.1s | 13.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| APQuest | 3.0s | 6.2s | 0.1s | 3.0s | 5.6s | 5.7s |
| Adventure | 3.3s | 9.8s | 0.1s | 3.2s | 5.7s | 5.8s |
| Aquaria | 7.5s | 12.0s | 0.1s | 3.2s | 7.7s | 7.7s |
| Bumper Stickers | 3.1s | 9.3s | 0.1s | 2.9s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.4s | 7.3s | 0.1s | 3.1s | 5.7s | 5.7s |
| Castlevania 64 | 3.6s | 12.0s | 0.1s | 3.4s | 6.7s | 6.7s |
| Celeste 64 | 3.2s | 9.3s | 0.1s | 2.9s | 7.7s | 6.7s |
| ChecksFinder | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.8s | 5.8s | 0.1s | 2.8s | 5.6s | 5.7s |
| Choo-Choo Charles | 3.0s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| DLCQuest | 3.3s | 5.7s | 0.1s | 3.1s | 5.8s | 5.8s |
| DOOM 1993 | 3.5s | 12.8s | 0.1s | 3.2s | 12.7s | 12.7s |
| DOOM II | 3.5s | 14.8s | 0.1s | 3.4s | 14.8s | 14.8s |
| Dark Souls III | 5.3s | 24.8s | 0.1s | 3.6s | 24.9s | 24.8s |
| Donkey Kong Country 3 | 3.2s | 13.7s | 0.1s | 3.2s | 13.7s | 13.7s |
| Factorio | 3.8s | 9.7s | 0.1s | 3.1s | 9.7s | 9.7s |
| Faxanadu | 3.0s | 6.7s | 0.1s | 3.0s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 4.4s | 10.7s | 0.1s | 3.4s | 10.7s | 10.8s |
| Heretic | 3.5s | 14.7s | 0.1s | 3.2s | 14.8s | 14.7s |
| Hylics 2 | 4.0s | 6.7s | 0.1s | 3.1s | 6.6s | 6.7s |
| Inscryption | 3.3s | 6.7s | 0.1s | 3.2s | 6.7s | 6.8s |
| Landstalker - The Treasures of King Nole | 3.3s | 8.7s | 0.1s | 3.1s | 17.8s | 8.7s |
| Links Awakening DX | 7.0s | 16.8s | 0.1s | 3.8s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.5s | 5.7s | 0.1s | 3.1s | 5.6s | 5.7s |
| Mario & Luigi Superstar Saga | 3.9s | 9.7s | 0.1s | 4.4s | 9.7s | 9.9s |
| MathProof2p2e4 | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Mega Man 2 | 3.0s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.2s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| Meritous | 2.9s | 5.8s | 0.1s | 2.9s | 5.7s | 5.7s |
| Metamath | 10.5s | 5.7s | 0.1s | 2.9s | 5.7s | 5.8s |
| Muse Dash | 3.4s | 7.7s | 0.1s | 3.1s | 9.7s | 7.8s |
| Noita | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Old School Runescape | 5.0s | 8.7s | 0.1s | 3.4s | 8.7s | 8.7s |
| Overcooked! 2 | 3.4s | 20.9s | 0.1s | 3.1s | 20.8s | 20.8s |
| Paint | 3.0s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.4s | 6.7s | 0.1s | 3.3s | 6.7s | 6.7s |
| Saving Princess | 3.1s | 5.7s | 0.1s | 3.1s | 6.7s | 5.7s |
| Shivers | 3.3s | 9.7s | 0.1s | 3.1s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 4.4s | 13.7s | 0.1s | 3.9s | 16.7s | 13.7s |
| Subnautica | 27.1s | 14.7s | 0.1s | 6.0s | 14.7s | 14.7s |
| Super Mario 64 | 3.3s | 12.7s | 0.1s | 3.2s | 12.8s | 12.8s |
| Super Mario Land 2 | 4.1s | 7.7s | 0.1s | 3.7s | 7.7s | 7.7s |
| Super Mario World | 4.6s | 6.7s | 0.1s | 3.2s | 6.6s | 6.7s |
| TOEM original | 3.1s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| TOEM rule builder | 3.0s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| TUNIC | 6.0s | 12.7s | 0.1s | 4.2s | 11.8s | 11.7s |
| Terraria | 3.3s | 20.8s | 0.1s | 3.3s | 19.9s | 20.8s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | 3.1s | 10.7s | 8.7s |
| The Messenger | 3.4s | 13.8s | 0.1s | 3.1s | 13.8s | 13.8s |
| The Wind Waker | 17.4s | 9.7s | 0.1s | 17.9s | 9.7s | 9.7s |
| Timespinner | 4.1s | 7.7s | 0.1s | 3.9s | 7.7s | 7.7s |
| Undertale | 3.1s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Wargroove | 3.1s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| WebDevJourney | 3.0s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| Yoshi's Island | 3.9s | 9.8s | 0.1s | 5.8s | 8.7s | 8.7s |
| shapez | 4.8s | 6.7s | 0.1s | 3.2s | 6.7s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.1s |
| 2 | The Wind Waker | 17.4s |
| 3 | A Link to the Past | 14.9s |
| 4 | Metamath | 10.5s |
| 5 | Aquaria | 7.5s |
| 6 | Links Awakening DX | 7.0s |
| 7 | A Hat in Time | 6.1s |
| 8 | TUNIC | 6.0s |
| 9 | Dark Souls III | 5.3s |
| 10 | Old School Runescape | 5.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Overcooked! 2 | 20.9s |
| 3 | Terraria | 20.8s |
| 4 | A Hat in Time | 18.6s |
| 5 | A Link to the Past | 18.5s |
| 6 | Links Awakening DX | 16.8s |
| 7 | DOOM II | 14.8s |
| 8 | Heretic | 14.7s |
| 9 | Subnautica | 14.7s |
| 10 | The Messenger | 13.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | A Hat in Time | 0.1s |
| 3 | Adventure | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | Celeste 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 17.9s |
| 2 | Subnautica | 6.0s |
| 3 | Yoshi's Island | 5.8s |
| 4 | A Link to the Past | 5.5s |
| 5 | Mario & Luigi Superstar Saga | 4.4s |
| 6 | TUNIC | 4.2s |
| 7 | Sonic Adventure 2 Battle | 3.9s |
| 8 | Timespinner | 3.9s |
| 9 | Links Awakening DX | 3.8s |
| 10 | A Hat in Time | 3.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.9s |
| 2 | Overcooked! 2 | 20.8s |
| 3 | Terraria | 19.9s |
| 4 | A Link to the Past | 17.8s |
| 5 | Landstalker - The Treasures of King Nole | 17.8s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | Heretic | 14.8s |
| 9 | DOOM II | 14.8s |
| 10 | Subnautica | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Terraria | 20.8s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | Links Awakening DX | 16.8s |
| 5 | A Link to the Past | 16.7s |
| 6 | DOOM II | 14.8s |
| 7 | Heretic | 14.7s |
| 8 | Subnautica | 14.7s |
| 9 | The Messenger | 13.8s |
| 10 | A Hat in Time | 13.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 279.4s | 605.2s | 5.2s | 220.3s | 599.8s | 718.2s |
| Average | 4.6s | 9.9s | 0.1s | 3.6s | 9.8s | 11.8s |
| Max | 27.2s | 24.8s | 0.1s | 18.2s | 23.8s | 23.9s |
| Min | 2.8s | 5.5s | 0.1s | 2.8s | 5.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.2s) | Dark Souls III (24.8s) | A Link to the Past (0.1s) | The Wind Waker (18.2s) | Dark Souls III (23.8s) | Terraria (23.9s) |
| Fastest | Meritous (2.8s) | Meritous (5.5s) | Meritous (0.1s) | Meritous (2.8s) | Meritous (5.5s) | VVVVVV (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 6.2s | 15.7s | 0.1s | 3.9s | 13.8s | 13.8s |
| A Link to the Past | 14.6s | 18.5s | 0.1s | 5.6s | 18.7s | 14.5s |
| A Short Hike | 3.1s | 12.8s | 0.1s | 3.0s | 9.5s | 9.5s |
| APQuest | 3.2s | 8.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Adventure | 3.0s | 6.5s | 0.1s | 2.9s | 5.6s | 14.3s |
| Aquaria | 7.8s | 12.2s | 0.1s | 3.4s | 7.7s | 14.6s |
| Bumper Stickers | 3.0s | 13.3s | 0.1s | 2.9s | 8.7s | 14.5s |
| Castlevania - Circle of the Moon | 3.2s | 7.8s | 0.1s | 3.1s | 5.7s | 14.4s |
| Castlevania 64 | 3.5s | 7.6s | 0.1s | 3.5s | 6.7s | 6.7s |
| Celeste 64 | 3.2s | 9.3s | 0.1s | 3.2s | 7.7s | 14.6s |
| ChecksFinder | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| ChocolateChipCookies | 3.0s | 5.6s | 0.1s | 3.0s | 5.7s | 14.3s |
| Choo-Choo Charles | 2.9s | 9.5s | 0.1s | 2.9s | 9.6s | 9.5s |
| Civilization VI | 3.1s | 8.7s | 0.1s | 3.0s | 8.7s | 17.6s |
| DLCQuest | 3.1s | 5.6s | 0.1s | 2.9s | 5.7s | 5.6s |
| DOOM 1993 | 3.7s | 12.7s | 0.1s | 3.5s | 12.8s | 14.5s |
| DOOM II | 3.3s | 14.7s | 0.1s | 3.2s | 14.7s | 14.4s |
| Dark Souls III | 5.2s | 24.8s | 0.1s | 3.5s | 23.8s | 17.3s |
| Donkey Kong Country 3 | 3.1s | 14.8s | 0.1s | 3.2s | 14.7s | 15.2s |
| Factorio | 3.8s | 9.7s | 0.1s | 3.4s | 9.8s | 9.8s |
| Faxanadu | 3.1s | 6.7s | 0.1s | 3.1s | 8.7s | 14.6s |
| Final Fantasy Mystic Quest | 4.5s | 10.8s | 0.1s | 3.5s | 10.7s | 10.7s |
| Heretic | 3.4s | 14.6s | 0.1s | 3.3s | 15.6s | 14.1s |
| Hylics 2 | 4.0s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| Inscryption | 3.0s | 6.6s | 0.1s | 2.9s | 6.6s | 6.7s |
| Landstalker - The Treasures of King Nole | 3.5s | 8.7s | 0.1s | 3.4s | 17.8s | 14.5s |
| Links Awakening DX | 6.7s | 16.8s | 0.1s | 3.9s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.4s | 5.6s | 0.1s | 3.3s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 4.0s | 9.7s | 0.1s | 4.4s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.9s | 5.7s | 0.1s | 3.1s | 5.7s | 14.6s |
| Mega Man 2 | 3.1s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.3s | 8.7s | 0.1s | 3.1s | 8.7s | 17.5s |
| Meritous | 2.8s | 5.5s | 0.1s | 2.8s | 5.5s | 14.0s |
| Metamath | 11.0s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.9s | 9.7s | 14.4s |
| Noita | 3.1s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Old School Runescape | 4.7s | 8.7s | 0.1s | 3.4s | 8.7s | 8.7s |
| Overcooked! 2 | 3.4s | 20.8s | 0.1s | 3.2s | 20.8s | 14.5s |
| Paint | 3.0s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.4s | 6.7s | 0.1s | 3.6s | 6.8s | 6.8s |
| Saving Princess | 3.0s | 5.7s | 0.1s | 3.0s | 6.7s | 14.5s |
| Shivers | 3.3s | 9.7s | 0.1s | 3.4s | 9.7s | 14.5s |
| Sonic Adventure 2 Battle | 4.4s | 13.6s | 0.1s | 4.0s | 16.6s | 14.2s |
| Subnautica | 27.2s | 14.8s | 0.1s | 6.2s | 14.7s | 18.1s |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 3.0s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.5s | 8.7s | 0.1s | 3.9s | 7.7s | 7.7s |
| Super Mario World | 4.3s | 6.7s | 0.1s | 3.2s | 6.6s | 6.7s |
| TOEM original | 3.1s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| TOEM rule builder | 3.1s | 8.8s | 0.1s | 2.9s | 8.7s | 8.7s |
| TUNIC | 5.9s | 12.8s | 0.1s | 4.5s | 12.8s | 12.8s |
| Terraria | 3.1s | 20.9s | 0.1s | 3.1s | 20.9s | 23.9s |
| The Legend of Zelda | 4.3s | 8.6s | 0.1s | 3.2s | 10.8s | 14.6s |
| The Messenger | 3.4s | 13.7s | 0.1s | 3.0s | 13.7s | 13.7s |
| The Wind Waker | 17.8s | 9.8s | 0.1s | 18.2s | 9.7s | 14.6s |
| Timespinner | 3.9s | 6.7s | 0.1s | 3.4s | 6.7s | 14.5s |
| Undertale | 3.3s | 5.7s | 0.1s | 3.0s | 5.6s | 5.7s |
| VVVVVV | 2.9s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Wargroove | 3.1s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| WebDevJourney | 3.0s | 8.7s | 0.1s | 3.0s | 8.7s | 14.5s |
| Yoshi's Island | 3.9s | 9.9s | 0.1s | 6.3s | 8.8s | 8.8s |
| shapez | 4.6s | 6.7s | 0.1s | 3.3s | 6.7s | 14.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.2s |
| 2 | The Wind Waker | 17.8s |
| 3 | A Link to the Past | 14.6s |
| 4 | Metamath | 11.0s |
| 5 | Aquaria | 7.8s |
| 6 | Links Awakening DX | 6.7s |
| 7 | A Hat in Time | 6.2s |
| 8 | TUNIC | 5.9s |
| 9 | Dark Souls III | 5.2s |
| 10 | Old School Runescape | 4.7s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Terraria | 20.9s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | A Link to the Past | 18.5s |
| 5 | Links Awakening DX | 16.8s |
| 6 | A Hat in Time | 15.7s |
| 7 | Subnautica | 14.8s |
| 8 | Donkey Kong Country 3 | 14.8s |
| 9 | DOOM II | 14.7s |
| 10 | Heretic | 14.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | A Hat in Time | 0.1s |
| 3 | Aquaria | 0.1s |
| 4 | APQuest | 0.1s |
| 5 | Adventure | 0.1s |
| 6 | Bumper Stickers | 0.1s |
| 7 | Castlevania - Circle of the Moon | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | Celeste 64 | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 18.2s |
| 2 | Yoshi's Island | 6.3s |
| 3 | Subnautica | 6.2s |
| 4 | A Link to the Past | 5.6s |
| 5 | TUNIC | 4.5s |
| 6 | Mario & Luigi Superstar Saga | 4.4s |
| 7 | Sonic Adventure 2 Battle | 4.0s |
| 8 | Super Mario Land 2 | 3.9s |
| 9 | Links Awakening DX | 3.9s |
| 10 | A Hat in Time | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.8s |
| 2 | Terraria | 20.9s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | A Link to the Past | 18.7s |
| 5 | Landstalker - The Treasures of King Nole | 17.8s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Sonic Adventure 2 Battle | 16.6s |
| 8 | Heretic | 15.6s |
| 9 | Donkey Kong Country 3 | 14.7s |
| 10 | Subnautica | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.9s |
| 2 | Subnautica | 18.1s |
| 3 | Civilization VI | 17.6s |
| 4 | MegaMan Battle Network 3 | 17.5s |
| 5 | Dark Souls III | 17.3s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Donkey Kong Country 3 | 15.2s |
| 8 | shapez | 14.7s |
| 9 | Aquaria | 14.6s |
| 10 | MathProof2p2e4 | 14.6s |
