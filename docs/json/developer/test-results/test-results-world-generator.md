# World Generator Test Results

**Generated:** 2025-12-28 00:15:35 UTC

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
| Stage 2: Seed Generation | 61 | 3 | 64 |
| Stage 3: WorldGen Spoiler Test | 59 | 2 | 61 |
| Stage 4: Cross-Validation | 59 | 2 | 61 |

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
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
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
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TUNIC | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Stage 2: Seed Generation | 61 | 3 | 64 |
| Stage 3: WorldGen Spoiler Test | 59 | 2 | 61 |
| Stage 4: Cross-Validation | 30 | 31 | 61 |

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
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TUNIC | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Total | 298.2s | 713.0s | 5.6s | 228.4s | 617.2s | 605.9s |
| Average | 4.7s | 11.1s | 0.1s | 3.6s | 10.1s | 9.9s |
| Max | 27.4s | 70.9s | 0.2s | 18.4s | 24.8s | 29.8s |
| Min | 2.8s | 5.6s | 0.1s | 2.6s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.4s) | Kirby's Dream Land 3 (70.9s) | A Link to the Past (0.2s) | The Wind Waker (18.4s) | Dark Souls III (24.8s) | TUNIC (29.8s) |
| Fastest | ChocolateChipCookies (2.8s) | Undertale (5.6s) | shapez (0.1s) | A Link to the Past (2.6s) | APQuest (5.5s) | APQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 6.2s | 17.8s | 0.1s | 3.7s | 13.7s | 13.7s |
| A Link to the Past | 16.0s | 19.5s | 0.2s | 2.6s | - | - |
| A Short Hike | 3.2s | 10.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| APQuest | 2.9s | 6.3s | 0.1s | 2.8s | 5.5s | 5.5s |
| Adventure | 3.4s | 8.6s | 0.1s | 3.2s | 5.7s | 5.8s |
| Aquaria | 7.3s | 8.9s | 0.1s | 3.2s | 7.7s | 7.7s |
| Bumper Stickers | 3.3s | 9.3s | 0.1s | 3.1s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.4s | 10.2s | 0.1s | 3.2s | 5.7s | 5.7s |
| Castlevania 64 | 3.5s | 7.9s | 0.1s | 3.4s | 6.6s | 6.7s |
| Celeste (Open World) | 6.6s | 18.1s | 0.2s | 2.8s | - | - |
| Celeste 64 | 3.1s | 6.7s | 0.1s | 3.2s | 7.7s | 6.7s |
| ChecksFinder | 3.0s | 6.8s | 0.1s | 2.9s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Choo-Choo Charles | 2.9s | 10.5s | 0.1s | 2.9s | 10.5s | 10.5s |
| Civilization VI | 3.3s | 8.8s | 0.1s | 3.2s | 8.8s | 8.7s |
| DLCQuest | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.7s |
| DOOM 1993 | 3.5s | 12.8s | 0.1s | 3.2s | 12.8s | 12.8s |
| DOOM II | 3.6s | 15.8s | 0.1s | 3.4s | 15.8s | 15.8s |
| Dark Souls III | 5.2s | 25.8s | 0.1s | 3.5s | 24.8s | 24.8s |
| Donkey Kong Country 3 | 3.4s | 14.9s | 0.1s | 3.2s | 14.8s | 14.8s |
| Factorio | 3.9s | 9.7s | 0.1s | 3.3s | 9.7s | 9.7s |
| Faxanadu | 3.0s | 6.6s | 0.1s | 2.9s | 8.7s | 6.6s |
| Final Fantasy Mystic Quest | 4.2s | 10.7s | 0.1s | 3.4s | 10.7s | 10.7s |
| Heretic | 3.3s | 15.6s | 0.1s | 3.1s | 15.5s | 15.6s |
| Hylics 2 | 4.2s | 6.7s | 0.1s | 3.4s | 6.7s | 6.7s |
| Inscryption | 3.0s | 6.6s | 0.1s | 3.0s | 6.6s | 6.7s |
| Kirby's Dream Land 3 | 5.0s | 70.9s | 0.1s | 2.7s | - | - |
| Landstalker - The Treasures of King Nole | 3.5s | 8.7s | 0.1s | 3.3s | 17.8s | 8.7s |
| Links Awakening DX | 5.2s | 16.8s | 0.1s | 3.3s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 3.4s | 5.7s | 0.1s | 3.5s | 5.7s | 5.8s |
| Mario & Luigi Superstar Saga | 4.0s | 9.7s | 0.1s | 4.4s | 9.7s | 9.8s |
| MathProof2p2e4 | 2.8s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Mega Man 2 | 3.0s | 6.6s | 0.1s | 2.9s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 3.1s | 8.6s | 0.1s | 2.9s | 17.1s | 8.5s |
| Meritous | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Metamath | 10.4s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Muse Dash | 3.4s | 7.7s | 0.1s | 3.1s | 9.7s | 7.8s |
| Noita | 3.1s | 5.8s | 0.1s | 3.1s | 5.7s | 5.7s |
| Old School Runescape | 4.8s | 8.7s | 0.1s | 3.5s | 8.7s | 8.7s |
| Overcooked! 2 | 3.5s | 21.8s | 0.1s | 3.3s | 21.8s | 21.8s |
| Paint | 3.0s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.4s | 6.7s | 0.1s | 3.3s | 6.7s | 6.7s |
| Saving Princess | 3.0s | 5.7s | 0.1s | 2.9s | 6.6s | 5.6s |
| Shivers | 3.1s | 9.5s | 0.1s | 3.1s | 9.6s | 9.5s |
| Sonic Adventure 2 Battle | 4.8s | 13.8s | 0.1s | 4.3s | 16.8s | 13.8s |
| Starcraft 2 | 7.1s | 19.8s | 0.1s | 6.1s | 16.8s | 16.8s |
| Subnautica | 27.4s | 14.7s | 0.1s | 6.3s | 14.8s | 14.7s |
| Super Mario 64 | 3.3s | 12.8s | 0.1s | 3.2s | 12.8s | 12.8s |
| Super Mario Land 2 | 4.2s | 8.7s | 0.1s | 3.7s | 14.4s | 14.5s |
| Super Mario World | 4.6s | 6.7s | 0.1s | 3.4s | 6.7s | 6.7s |
| TOEM original | 3.0s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| TOEM rule builder | 2.9s | 8.6s | 0.1s | 2.9s | 8.7s | 8.7s |
| TUNIC | 5.8s | 12.7s | 0.1s | 3.9s | 12.7s | 29.8s |
| Terraria | 2.9s | 20.6s | 0.1s | 3.0s | 20.6s | 20.6s |
| The Legend of Zelda | 4.7s | 8.8s | 0.1s | 3.4s | 10.8s | 8.8s |
| The Messenger | 3.4s | 13.8s | 0.1s | 3.2s | 13.8s | 13.9s |
| The Wind Waker | 17.2s | 9.8s | 0.1s | 18.4s | 9.7s | 9.7s |
| Timespinner | 4.4s | 7.7s | 0.1s | 3.8s | 7.7s | 7.7s |
| Undertale | 3.2s | 5.6s | 0.1s | 3.0s | 5.6s | 5.7s |
| VVVVVV | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Wargroove | 3.1s | 6.7s | 0.1s | 3.0s | 6.7s | 6.6s |
| WebDevJourney | 2.9s | 8.7s | 0.1s | 2.9s | 8.7s | 8.6s |
| Yoshi's Island | 3.8s | 9.7s | 0.1s | 6.2s | 8.7s | 8.7s |
| shapez | 4.4s | 6.5s | 0.1s | 3.1s | 6.6s | 6.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.4s |
| 2 | The Wind Waker | 17.2s |
| 3 | A Link to the Past | 16.0s |
| 4 | Metamath | 10.4s |
| 5 | Aquaria | 7.3s |
| 6 | Starcraft 2 | 7.1s |
| 7 | Celeste (Open World) | 6.6s |
| 8 | A Hat in Time | 6.2s |
| 9 | TUNIC | 5.8s |
| 10 | Links Awakening DX | 5.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 70.9s |
| 2 | Dark Souls III | 25.8s |
| 3 | Overcooked! 2 | 21.8s |
| 4 | Terraria | 20.6s |
| 5 | Starcraft 2 | 19.8s |
| 6 | A Link to the Past | 19.5s |
| 7 | Celeste (Open World) | 18.1s |
| 8 | A Hat in Time | 17.8s |
| 9 | Links Awakening DX | 16.8s |
| 10 | DOOM II | 15.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.2s |
| 2 | Celeste (Open World) | 0.2s |
| 3 | A Hat in Time | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | Adventure | 0.1s |
| 7 | Aquaria | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 18.4s |
| 2 | Subnautica | 6.3s |
| 3 | Yoshi's Island | 6.2s |
| 4 | Starcraft 2 | 6.1s |
| 5 | Mario & Luigi Superstar Saga | 4.4s |
| 6 | Sonic Adventure 2 Battle | 4.3s |
| 7 | TUNIC | 3.9s |
| 8 | Timespinner | 3.8s |
| 9 | Super Mario Land 2 | 3.7s |
| 10 | A Hat in Time | 3.7s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Overcooked! 2 | 21.8s |
| 3 | Terraria | 20.6s |
| 4 | Landstalker - The Treasures of King Nole | 17.8s |
| 5 | MegaMan Battle Network 3 | 17.1s |
| 6 | Sonic Adventure 2 Battle | 16.8s |
| 7 | Starcraft 2 | 16.8s |
| 8 | Links Awakening DX | 16.7s |
| 9 | DOOM II | 15.8s |
| 10 | Heretic | 15.5s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | TUNIC | 29.8s |
| 2 | Dark Souls III | 24.8s |
| 3 | Overcooked! 2 | 21.8s |
| 4 | Terraria | 20.6s |
| 5 | Starcraft 2 | 16.8s |
| 6 | Links Awakening DX | 16.7s |
| 7 | DOOM II | 15.8s |
| 8 | Heretic | 15.6s |
| 9 | Donkey Kong Country 3 | 14.8s |
| 10 | Subnautica | 14.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 298.0s | 724.8s | 5.6s | 228.6s | 619.5s | 743.4s |
| Average | 4.7s | 11.3s | 0.1s | 3.6s | 10.2s | 12.2s |
| Max | 26.9s | 69.1s | 0.2s | 18.2s | 24.8s | 29.8s |
| Min | 2.8s | 5.6s | 0.1s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (26.9s) | Kirby's Dream Land 3 (69.1s) | Celeste (Open World) (0.2s) | The Wind Waker (18.2s) | Dark Souls III (24.8s) | TUNIC (29.8s) |
| Fastest | MathProof2p2e4 (2.8s) | Undertale (5.6s) | shapez (0.1s) | Kirby's Dream Land 3 (2.5s) | APQuest (5.6s) | Undertale (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 6.4s | 18.2s | 0.1s | 3.9s | 14.7s | 13.8s |
| A Link to the Past | 14.4s | 20.2s | 0.1s | 2.7s | - | - |
| A Short Hike | 3.3s | 10.4s | 0.1s | 3.1s | 9.7s | 9.7s |
| APQuest | 3.2s | 6.2s | 0.1s | 2.9s | 5.6s | 5.6s |
| Adventure | 3.1s | 8.7s | 0.1s | 2.9s | 5.6s | 14.2s |
| Aquaria | 7.6s | 9.8s | 0.1s | 3.2s | 8.7s | 14.6s |
| Bumper Stickers | 3.1s | 11.4s | 0.1s | 2.9s | 8.7s | 14.2s |
| Castlevania - Circle of the Moon | 3.3s | 18.0s | 0.1s | 3.1s | 5.7s | 14.4s |
| Castlevania 64 | 3.7s | 10.3s | 0.1s | 3.2s | 6.6s | 6.7s |
| Celeste (Open World) | 7.0s | 16.4s | 0.2s | 3.0s | - | - |
| Celeste 64 | 3.2s | 6.7s | 0.1s | 3.2s | 7.7s | 14.5s |
| ChecksFinder | 2.9s | 6.7s | 0.1s | 2.8s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.9s | 5.7s | 0.1s | 2.9s | 5.6s | 14.3s |
| Choo-Choo Charles | 3.1s | 10.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s | 17.4s |
| DLCQuest | 3.3s | 5.6s | 0.1s | 3.0s | 5.7s | 5.6s |
| DOOM 1993 | 3.4s | 12.7s | 0.1s | 3.1s | 12.7s | 14.3s |
| DOOM II | 3.5s | 15.8s | 0.1s | 3.6s | 15.8s | 14.7s |
| Dark Souls III | 5.4s | 24.7s | 0.1s | 3.6s | 24.8s | 17.1s |
| Donkey Kong Country 3 | 3.5s | 14.9s | 0.1s | 3.4s | 14.9s | 15.4s |
| Factorio | 4.0s | 9.8s | 0.1s | 3.5s | 9.8s | 9.7s |
| Faxanadu | 3.0s | 6.6s | 0.1s | 2.9s | 8.6s | 14.2s |
| Final Fantasy Mystic Quest | 4.1s | 10.7s | 0.1s | 3.4s | 10.7s | 10.7s |
| Heretic | 3.6s | 14.9s | 0.1s | 3.3s | 14.7s | 14.4s |
| Hylics 2 | 3.9s | 6.7s | 0.1s | 3.1s | 6.6s | 6.6s |
| Inscryption | 3.2s | 6.7s | 0.1s | 3.0s | 6.7s | 6.6s |
| Kirby's Dream Land 3 | 4.8s | 69.1s | 0.1s | 2.5s | - | - |
| Landstalker - The Treasures of King Nole | 3.4s | 8.7s | 0.1s | 3.3s | 17.8s | 14.5s |
| Links Awakening DX | 5.5s | 16.8s | 0.1s | 3.3s | 17.7s | 16.8s |
| Lufia II Ancient Cave | 3.6s | 5.8s | 0.1s | 3.6s | 5.8s | 5.8s |
| Mario & Luigi Superstar Saga | 4.1s | 9.7s | 0.1s | 4.5s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.8s | 5.6s | 0.1s | 2.9s | 5.6s | 14.2s |
| Mega Man 2 | 3.1s | 6.7s | 0.1s | 2.9s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 3.3s | 8.7s | 0.1s | 2.9s | 17.4s | 17.4s |
| Meritous | 2.9s | 5.6s | 0.1s | 2.9s | 5.7s | 14.3s |
| Metamath | 10.1s | 5.7s | 0.1s | 2.9s | 5.7s | 5.6s |
| Muse Dash | 3.3s | 7.7s | 0.1s | 3.0s | 9.7s | 14.3s |
| Noita | 3.0s | 5.7s | 0.1s | 3.1s | 5.7s | 5.8s |
| Old School Runescape | 4.9s | 8.6s | 0.1s | 3.4s | 8.7s | 8.7s |
| Overcooked! 2 | 3.6s | 21.9s | 0.1s | 3.5s | 22.0s | 14.8s |
| Paint | 3.0s | 7.7s | 0.1s | 3.1s | 6.7s | 6.8s |
| Risk of Rain 2 | 3.5s | 6.6s | 0.1s | 3.2s | 6.6s | 6.7s |
| Saving Princess | 3.0s | 5.6s | 0.1s | 2.9s | 6.7s | 14.3s |
| Shivers | 3.3s | 9.7s | 0.1s | 3.1s | 9.7s | 14.4s |
| Sonic Adventure 2 Battle | 4.3s | 13.7s | 0.1s | 4.2s | 16.8s | 14.7s |
| Starcraft 2 | 7.2s | 19.8s | 0.1s | 6.2s | 16.9s | 16.8s |
| Subnautica | 26.9s | 14.7s | 0.1s | 6.0s | 14.7s | 17.8s |
| Super Mario 64 | 3.1s | 12.8s | 0.1s | 3.2s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.2s | 8.7s | 0.1s | 3.6s | 14.5s | 14.6s |
| Super Mario World | 5.0s | 6.8s | 0.1s | 3.8s | 6.8s | 6.8s |
| TOEM original | 3.0s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| TOEM rule builder | 2.9s | 8.7s | 0.1s | 2.9s | 8.7s | 8.6s |
| TUNIC | 5.9s | 12.8s | 0.1s | 4.0s | 12.7s | 29.8s |
| Terraria | 3.0s | 20.9s | 0.1s | 3.0s | 19.8s | 23.6s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | 3.1s | 10.7s | 14.5s |
| The Messenger | 3.4s | 13.9s | 0.1s | 3.1s | 13.8s | 13.9s |
| The Wind Waker | 17.4s | 9.7s | 0.1s | 18.2s | 9.7s | 14.3s |
| Timespinner | 4.2s | 7.8s | 0.1s | 3.9s | 7.7s | 14.6s |
| Undertale | 3.0s | 5.6s | 0.1s | 3.1s | 5.7s | 5.6s |
| VVVVVV | 3.3s | 5.8s | 0.1s | 3.3s | 5.8s | 5.8s |
| Wargroove | 3.1s | 6.7s | 0.1s | 3.2s | 6.7s | 6.7s |
| WebDevJourney | 2.9s | 8.7s | 0.1s | 2.9s | 8.6s | 14.2s |
| Yoshi's Island | 3.9s | 9.8s | 0.1s | 6.0s | 8.7s | 8.7s |
| shapez | 4.5s | 6.6s | 0.1s | 3.1s | 6.6s | 14.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.9s |
| 2 | The Wind Waker | 17.4s |
| 3 | A Link to the Past | 14.4s |
| 4 | Metamath | 10.1s |
| 5 | Aquaria | 7.6s |
| 6 | Starcraft 2 | 7.2s |
| 7 | Celeste (Open World) | 7.0s |
| 8 | A Hat in Time | 6.4s |
| 9 | TUNIC | 5.9s |
| 10 | Links Awakening DX | 5.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 69.1s |
| 2 | Dark Souls III | 24.7s |
| 3 | Overcooked! 2 | 21.9s |
| 4 | Terraria | 20.9s |
| 5 | A Link to the Past | 20.2s |
| 6 | Starcraft 2 | 19.8s |
| 7 | A Hat in Time | 18.2s |
| 8 | Castlevania - Circle of the Moon | 18.0s |
| 9 | Links Awakening DX | 16.8s |
| 10 | Celeste (Open World) | 16.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 0.2s |
| 2 | A Link to the Past | 0.1s |
| 3 | A Hat in Time | 0.1s |
| 4 | Aquaria | 0.1s |
| 5 | Castlevania - Circle of the Moon | 0.1s |
| 6 | Starcraft 2 | 0.1s |
| 7 | A Short Hike | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 18.2s |
| 2 | Starcraft 2 | 6.2s |
| 3 | Subnautica | 6.0s |
| 4 | Yoshi's Island | 6.0s |
| 5 | Mario & Luigi Superstar Saga | 4.5s |
| 6 | Sonic Adventure 2 Battle | 4.2s |
| 7 | TUNIC | 4.0s |
| 8 | A Hat in Time | 3.9s |
| 9 | Timespinner | 3.9s |
| 10 | Super Mario World | 3.8s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Overcooked! 2 | 22.0s |
| 3 | Terraria | 19.8s |
| 4 | Landstalker - The Treasures of King Nole | 17.8s |
| 5 | Links Awakening DX | 17.7s |
| 6 | MegaMan Battle Network 3 | 17.4s |
| 7 | Starcraft 2 | 16.9s |
| 8 | Sonic Adventure 2 Battle | 16.8s |
| 9 | DOOM II | 15.8s |
| 10 | Donkey Kong Country 3 | 14.9s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | TUNIC | 29.8s |
| 2 | Terraria | 23.6s |
| 3 | Subnautica | 17.8s |
| 4 | MegaMan Battle Network 3 | 17.4s |
| 5 | Civilization VI | 17.4s |
| 6 | Dark Souls III | 17.1s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Starcraft 2 | 16.8s |
| 9 | Donkey Kong Country 3 | 15.4s |
| 10 | Overcooked! 2 | 14.8s |
