# World Generator Test Results

**Generated:** 2025-12-28 03:53:36 UTC

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

**Total Templates:** 64

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 64 | 0 | 64 |
| Original Spoiler Test | 64 | 0 | 64 |
| Stage 1: World Generation | 64 | 0 | 64 |
| Stage 2: Seed Generation | 62 | 2 | 64 |
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
| Celeste (Open World) | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ❌ | - | - |
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

**Total Templates:** 64

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 64 | 0 | 64 |
| Original Spoiler Test | 64 | 0 | 64 |
| Stage 1: World Generation | 64 | 0 | 64 |
| Stage 2: Seed Generation | 62 | 2 | 64 |
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
| Celeste (Open World) | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Total | 298.8s | 716.1s | 5.5s | 230.1s | 619.5s | 597.3s |
| Average | 4.7s | 11.2s | 0.1s | 3.6s | 10.0s | 9.6s |
| Max | 26.7s | 67.6s | 0.2s | 17.7s | 24.8s | 24.8s |
| Min | 2.7s | 5.5s | 0.1s | 2.4s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (26.7s) | Kirby's Dream Land 3 (67.6s) | A Link to the Past (0.2s) | The Wind Waker (17.7s) | Dark Souls III (24.8s) | Dark Souls III (24.8s) |
| Fastest | ChocolateChipCookies (2.7s) | Lufia II Ancient Cave (5.5s) | VVVVVV (0.1s) | Celeste (Open World) (2.4s) | ChocolateChipCookies (5.5s) | ChocolateChipCookies (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 6.0s | 16.6s | 0.1s | 3.9s | 13.7s | 13.7s |
| A Link to the Past | 15.5s | 20.2s | 0.2s | 5.9s | 17.8s | 16.8s |
| A Short Hike | 3.0s | 13.5s | 0.1s | 2.8s | 9.5s | 9.5s |
| APQuest | 3.2s | 8.9s | 0.1s | 3.1s | 5.7s | 5.7s |
| Adventure | 3.2s | 7.0s | 0.1s | 3.0s | 5.6s | 5.6s |
| Aquaria | 7.7s | 10.2s | 0.1s | 3.5s | 8.7s | 8.8s |
| Bumper Stickers | 3.0s | 11.2s | 0.1s | 2.9s | 8.6s | 8.6s |
| Castlevania - Circle of the Moon | 3.1s | 8.2s | 0.1s | 3.0s | 5.6s | 5.6s |
| Castlevania 64 | 3.5s | 9.7s | 0.1s | 3.4s | 6.7s | 6.6s |
| Celeste (Open World) | 8.6s | 19.1s | 0.1s | 2.4s | - | - |
| Celeste 64 | 3.0s | 6.7s | 0.1s | 3.0s | 7.7s | 6.7s |
| ChecksFinder | 3.1s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.5s | 0.1s | 2.7s | 5.5s | 5.5s |
| Choo-Choo Charles | 3.1s | 9.7s | 0.1s | 3.2s | 10.8s | 10.8s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.9s | 8.6s | 8.6s |
| DLCQuest | 3.4s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| DOOM 1993 | 3.3s | 12.7s | 0.1s | 3.1s | 12.7s | 12.7s |
| DOOM II | 3.3s | 14.7s | 0.1s | 3.2s | 14.7s | 14.7s |
| Dark Souls III | 5.2s | 25.8s | 0.1s | 3.5s | 24.8s | 24.8s |
| Donkey Kong Country 3 | 3.1s | 14.6s | 0.1s | 2.9s | 14.5s | 14.5s |
| Factorio | 3.9s | 9.7s | 0.1s | 3.3s | 9.7s | 9.7s |
| Faxanadu | 3.2s | 6.7s | 0.1s | 3.1s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 4.1s | 10.6s | 0.1s | 3.3s | 10.6s | 10.6s |
| Heretic | 3.6s | 14.7s | 0.1s | 3.5s | 14.8s | 14.7s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 3.0s | 6.6s | 6.6s |
| Inscryption | 3.4s | 6.7s | 0.1s | 3.3s | 6.8s | 6.8s |
| Kirby's Dream Land 3 | 5.0s | 67.6s | 0.1s | 2.5s | - | - |
| Landstalker - The Treasures of King Nole | 3.3s | 8.6s | 0.1s | 3.1s | 17.7s | 8.6s |
| Links Awakening DX | 7.1s | 16.7s | 0.1s | 4.0s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.2s | 5.5s | 0.1s | 3.1s | 5.5s | 5.5s |
| Mario & Luigi Superstar Saga | 4.0s | 9.7s | 0.1s | 4.2s | 9.7s | 9.7s |
| MathProof2p2e4 | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Mega Man 2 | 2.9s | 6.6s | 0.1s | 2.9s | 6.5s | 6.5s |
| MegaMan Battle Network 3 | 3.3s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Metamath | 10.2s | 5.7s | 0.1s | 3.3s | 5.7s | 5.7s |
| Muse Dash | 3.1s | 7.6s | 0.1s | 2.9s | 9.7s | 7.6s |
| Noita | 2.9s | 5.6s | 0.1s | 2.9s | 5.7s | 5.6s |
| Old School Runescape | 4.8s | 8.7s | 0.1s | 3.4s | 8.6s | 8.7s |
| Overcooked! 2 | 3.1s | 21.6s | 0.1s | 3.1s | 21.7s | 21.6s |
| Paint | 3.0s | 7.8s | 0.1s | 3.3s | 7.8s | 6.8s |
| Risk of Rain 2 | 3.6s | 6.7s | 0.1s | 3.6s | 6.7s | 6.7s |
| Saving Princess | 2.8s | 5.5s | 0.1s | 2.9s | 6.5s | 5.5s |
| Shivers | 3.4s | 9.7s | 0.1s | 3.2s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 4.3s | 13.7s | 0.1s | 3.9s | 16.7s | 13.7s |
| Starcraft 2 | 7.8s | 19.9s | 0.1s | 7.1s | 17.9s | 17.9s |
| Subnautica | 26.7s | 14.7s | 0.1s | 5.8s | 14.6s | 14.6s |
| Super Mario 64 | 3.0s | 12.8s | 0.1s | 3.0s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.2s | 8.7s | 0.1s | 3.6s | 7.7s | 7.7s |
| Super Mario World | 4.5s | 6.5s | 0.1s | 3.3s | 6.5s | 6.5s |
| TOEM original | 3.0s | 9.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| TOEM rule builder | 3.1s | 9.7s | 0.1s | 3.1s | 9.7s | 9.7s |
| TUNIC | 5.5s | 12.5s | 0.1s | 3.8s | 12.6s | 12.6s |
| Terraria | 3.3s | 21.0s | 0.1s | 3.1s | 20.8s | 20.8s |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | 3.1s | 10.7s | 8.7s |
| The Messenger | 3.9s | 13.9s | 0.1s | 3.5s | 13.9s | 13.9s |
| The Wind Waker | 16.9s | 9.7s | 0.1s | 17.7s | 9.6s | 9.7s |
| Timespinner | 3.8s | 7.7s | 0.1s | 3.5s | 6.6s | 6.6s |
| Undertale | 3.2s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 2.9s | 5.5s | 0.1s | 2.9s | 5.5s | 5.5s |
| Wargroove | 3.2s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| WebDevJourney | 3.1s | 8.7s | 0.1s | 3.1s | 8.7s | 8.7s |
| Yoshi's Island | 3.6s | 9.5s | 0.1s | 5.6s | 8.5s | 8.5s |
| shapez | 4.8s | 6.8s | 0.1s | 3.3s | 6.7s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.7s |
| 2 | The Wind Waker | 16.9s |
| 3 | A Link to the Past | 15.5s |
| 4 | Metamath | 10.2s |
| 5 | Celeste (Open World) | 8.6s |
| 6 | Starcraft 2 | 7.8s |
| 7 | Aquaria | 7.7s |
| 8 | Links Awakening DX | 7.1s |
| 9 | A Hat in Time | 6.0s |
| 10 | TUNIC | 5.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 67.6s |
| 2 | Dark Souls III | 25.8s |
| 3 | Overcooked! 2 | 21.6s |
| 4 | Terraria | 21.0s |
| 5 | A Link to the Past | 20.2s |
| 6 | Starcraft 2 | 19.9s |
| 7 | Celeste (Open World) | 19.1s |
| 8 | Links Awakening DX | 16.7s |
| 9 | A Hat in Time | 16.6s |
| 10 | Heretic | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | Celeste (Open World) | 0.1s |
| 3 | Starcraft 2 | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Adventure | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 17.7s |
| 2 | Starcraft 2 | 7.1s |
| 3 | A Link to the Past | 5.9s |
| 4 | Subnautica | 5.8s |
| 5 | Yoshi's Island | 5.6s |
| 6 | Mario & Luigi Superstar Saga | 4.2s |
| 7 | Links Awakening DX | 4.0s |
| 8 | Sonic Adventure 2 Battle | 3.9s |
| 9 | A Hat in Time | 3.9s |
| 10 | TUNIC | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Overcooked! 2 | 21.7s |
| 3 | Terraria | 20.8s |
| 4 | Starcraft 2 | 17.9s |
| 5 | A Link to the Past | 17.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Sonic Adventure 2 Battle | 16.7s |
| 9 | Heretic | 14.8s |
| 10 | DOOM II | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Overcooked! 2 | 21.6s |
| 3 | Terraria | 20.8s |
| 4 | Starcraft 2 | 17.9s |
| 5 | A Link to the Past | 16.8s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Heretic | 14.7s |
| 8 | DOOM II | 14.7s |
| 9 | Subnautica | 14.6s |
| 10 | Donkey Kong Country 3 | 14.5s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 299.1s | 711.9s | 5.6s | 233.8s | 621.9s | 735.2s |
| Average | 4.7s | 11.1s | 0.1s | 3.7s | 10.0s | 11.9s |
| Max | 27.1s | 68.8s | 0.2s | 18.4s | 24.8s | 23.6s |
| Min | 2.8s | 5.4s | 0.1s | 2.5s | 5.5s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.1s) | Kirby's Dream Land 3 (68.8s) | Celeste (Open World) (0.2s) | The Wind Waker (18.4s) | Dark Souls III (24.8s) | Terraria (23.6s) |
| Fastest | ChocolateChipCookies (2.8s) | Metamath (5.4s) | Inscryption (0.1s) | Kirby's Dream Land 3 (2.5s) | Metamath (5.5s) | Metamath (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 6.0s | 18.2s | 0.1s | 3.9s | 13.8s | 13.7s |
| A Link to the Past | 15.0s | 18.7s | 0.1s | 6.0s | 18.9s | 14.7s |
| A Short Hike | 3.2s | 13.2s | 0.1s | 3.0s | 9.6s | 9.6s |
| APQuest | 3.1s | 6.2s | 0.1s | 3.0s | 5.6s | 5.7s |
| Adventure | 3.6s | 8.7s | 0.1s | 3.5s | 5.8s | 14.7s |
| Aquaria | 6.6s | 11.3s | 0.1s | 3.0s | 8.5s | 13.9s |
| Bumper Stickers | 3.1s | 10.3s | 0.1s | 2.9s | 8.8s | 14.2s |
| Castlevania - Circle of the Moon | 3.2s | 9.5s | 0.1s | 3.1s | 5.7s | 14.4s |
| Castlevania 64 | 3.6s | 9.8s | 0.1s | 3.4s | 6.7s | 6.7s |
| Celeste (Open World) | 8.3s | 17.5s | 0.2s | 2.7s | - | - |
| Celeste 64 | 3.3s | 6.7s | 0.1s | 3.0s | 7.6s | 14.3s |
| ChecksFinder | 3.0s | 6.9s | 0.1s | 3.3s | 6.8s | 6.7s |
| ChocolateChipCookies | 2.8s | 5.6s | 0.1s | 2.8s | 5.7s | 14.2s |
| Choo-Choo Charles | 3.1s | 9.7s | 0.1s | 3.2s | 9.7s | 9.7s |
| Civilization VI | 3.4s | 8.8s | 0.1s | 3.4s | 8.8s | 17.9s |
| DLCQuest | 2.9s | 5.5s | 0.1s | 2.8s | 5.5s | 5.4s |
| DOOM 1993 | 3.4s | 12.7s | 0.1s | 3.2s | 12.7s | 14.3s |
| DOOM II | 3.4s | 14.7s | 0.1s | 3.5s | 15.8s | 14.4s |
| Dark Souls III | 5.2s | 25.8s | 0.1s | 3.6s | 24.8s | 17.4s |
| Donkey Kong Country 3 | 3.1s | 13.6s | 0.1s | 3.0s | 13.7s | 14.9s |
| Factorio | 4.0s | 9.7s | 0.1s | 3.3s | 9.7s | 9.7s |
| Faxanadu | 3.1s | 6.8s | 0.1s | 3.3s | 8.9s | 14.7s |
| Final Fantasy Mystic Quest | 4.2s | 10.7s | 0.1s | 3.3s | 10.7s | 10.7s |
| Heretic | 3.6s | 14.9s | 0.1s | 3.6s | 15.7s | 14.4s |
| Hylics 2 | 4.3s | 6.8s | 0.1s | 3.5s | 6.8s | 6.8s |
| Inscryption | 2.8s | 6.4s | 0.1s | 2.8s | 6.4s | 6.5s |
| Kirby's Dream Land 3 | 5.1s | 68.8s | 0.1s | 2.5s | - | - |
| Landstalker - The Treasures of King Nole | 3.4s | 8.7s | 0.1s | 3.2s | 17.7s | 14.3s |
| Links Awakening DX | 7.1s | 16.7s | 0.1s | 4.3s | 17.8s | 17.9s |
| Lufia II Ancient Cave | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 4.0s | 9.7s | 0.1s | 4.2s | 9.7s | 9.7s |
| MathProof2p2e4 | 3.0s | 5.7s | 0.1s | 3.2s | 5.8s | 14.6s |
| Mega Man 2 | 3.0s | 6.6s | 0.1s | 3.0s | 6.7s | 6.6s |
| MegaMan Battle Network 3 | 3.3s | 8.7s | 0.1s | 3.0s | 8.7s | 17.4s |
| Meritous | 3.3s | 5.8s | 0.1s | 3.2s | 5.8s | 14.6s |
| Metamath | 10.1s | 5.4s | 0.1s | 2.8s | 5.5s | 5.4s |
| Muse Dash | 3.2s | 7.6s | 0.1s | 2.9s | 9.7s | 14.3s |
| Noita | 3.1s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Old School Runescape | 4.9s | 8.7s | 0.1s | 3.9s | 8.8s | 8.8s |
| Overcooked! 2 | 3.1s | 20.7s | 0.1s | 3.1s | 20.8s | 14.3s |
| Paint | 2.9s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.6s | 6.8s | 0.1s | 3.7s | 7.8s | 7.8s |
| Saving Princess | 2.9s | 5.6s | 0.1s | 3.0s | 6.6s | 14.2s |
| Shivers | 3.4s | 9.7s | 0.1s | 3.3s | 9.7s | 14.5s |
| Sonic Adventure 2 Battle | 5.0s | 13.8s | 0.1s | 4.6s | 16.8s | 14.7s |
| Starcraft 2 | 6.6s | 18.6s | 0.1s | 5.9s | 17.6s | 17.6s |
| Subnautica | 27.1s | 14.7s | 0.1s | 6.0s | 14.7s | 17.6s |
| Super Mario 64 | 3.2s | 12.7s | 0.1s | 3.1s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.2s | 8.7s | 0.1s | 4.0s | 7.8s | 7.8s |
| Super Mario World | 4.3s | 6.6s | 0.1s | 3.2s | 6.6s | 6.6s |
| TOEM original | 2.9s | 8.7s | 0.1s | 2.9s | 9.7s | 8.7s |
| TOEM rule builder | 3.1s | 9.7s | 0.1s | 3.2s | 9.8s | 9.9s |
| TUNIC | 6.1s | 12.7s | 0.1s | 3.9s | 12.7s | 11.7s |
| Terraria | 3.1s | 20.8s | 0.1s | 3.1s | 19.8s | 23.6s |
| The Legend of Zelda | 4.9s | 9.0s | 0.1s | 3.5s | 10.8s | 14.6s |
| The Messenger | 3.2s | 13.8s | 0.1s | 3.0s | 13.6s | 13.7s |
| The Wind Waker | 17.4s | 9.7s | 0.1s | 18.4s | 9.6s | 14.3s |
| Timespinner | 3.9s | 7.7s | 0.1s | 3.5s | 6.6s | 14.3s |
| Undertale | 3.2s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| VVVVVV | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Wargroove | 3.0s | 6.6s | 0.1s | 3.0s | 6.6s | 6.6s |
| WebDevJourney | 3.1s | 8.8s | 0.1s | 3.3s | 8.8s | 14.7s |
| Yoshi's Island | 3.8s | 9.8s | 0.1s | 5.7s | 8.6s | 8.6s |
| shapez | 4.6s | 6.7s | 0.1s | 3.2s | 6.6s | 14.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.1s |
| 2 | The Wind Waker | 17.4s |
| 3 | A Link to the Past | 15.0s |
| 4 | Metamath | 10.1s |
| 5 | Celeste (Open World) | 8.3s |
| 6 | Links Awakening DX | 7.1s |
| 7 | Starcraft 2 | 6.6s |
| 8 | Aquaria | 6.6s |
| 9 | TUNIC | 6.1s |
| 10 | A Hat in Time | 6.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 68.8s |
| 2 | Dark Souls III | 25.8s |
| 3 | Terraria | 20.8s |
| 4 | Overcooked! 2 | 20.7s |
| 5 | A Link to the Past | 18.7s |
| 6 | Starcraft 2 | 18.6s |
| 7 | A Hat in Time | 18.2s |
| 8 | Celeste (Open World) | 17.5s |
| 9 | Links Awakening DX | 16.7s |
| 10 | Heretic | 14.9s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 0.2s |
| 2 | A Link to the Past | 0.1s |
| 3 | A Hat in Time | 0.1s |
| 4 | Adventure | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | APQuest | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | Starcraft 2 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 18.4s |
| 2 | A Link to the Past | 6.0s |
| 3 | Subnautica | 6.0s |
| 4 | Starcraft 2 | 5.9s |
| 5 | Yoshi's Island | 5.7s |
| 6 | Sonic Adventure 2 Battle | 4.6s |
| 7 | Links Awakening DX | 4.3s |
| 8 | Mario & Luigi Superstar Saga | 4.2s |
| 9 | Super Mario Land 2 | 4.0s |
| 10 | TUNIC | 3.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Overcooked! 2 | 20.8s |
| 3 | Terraria | 19.8s |
| 4 | A Link to the Past | 18.9s |
| 5 | Links Awakening DX | 17.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Starcraft 2 | 17.6s |
| 8 | Sonic Adventure 2 Battle | 16.8s |
| 9 | DOOM II | 15.8s |
| 10 | Heretic | 15.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.6s |
| 2 | Civilization VI | 17.9s |
| 3 | Links Awakening DX | 17.9s |
| 4 | Starcraft 2 | 17.6s |
| 5 | Subnautica | 17.6s |
| 6 | Dark Souls III | 17.4s |
| 7 | MegaMan Battle Network 3 | 17.4s |
| 8 | Donkey Kong Country 3 | 14.9s |
| 9 | Sonic Adventure 2 Battle | 14.7s |
| 10 | Faxanadu | 14.7s |
