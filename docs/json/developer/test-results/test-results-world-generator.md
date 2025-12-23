# World Generator Test Results

**Generated:** 2025-12-23 19:04:26 UTC

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

**Total Templates:** 66

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 66 | 0 | 66 |
| Original Spoiler Test | 65 | 1 | 66 |
| Stage 1: World Generation | 60 | 6 | 66 |
| Stage 2: Seed Generation | 58 | 8 | 66 |
| Stage 3: WorldGen Spoiler Test | 57 | 1 | 58 |
| Stage 4: Cross-Validation | 55 | 3 | 58 |

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
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
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
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 66

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 66 | 0 | 66 |
| Original Spoiler Test | 65 | 1 | 66 |
| Stage 1: World Generation | 60 | 6 | 66 |
| Stage 2: Seed Generation | 58 | 8 | 66 |
| Stage 3: WorldGen Spoiler Test | 57 | 1 | 58 |
| Stage 4: Cross-Validation | 27 | 31 | 58 |

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
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
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
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
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
| Total | 289.7s | 826.8s | 5.8s | 196.2s | 589.2s | 567.1s |
| Average | 4.4s | 12.5s | 0.1s | 3.3s | 10.2s | 9.8s |
| Max | 26.8s | 73.9s | 0.3s | 20.2s | 25.9s | 24.9s |
| Min | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (26.8s) | Stardew Valley (73.9s) | Overcooked! 2 (0.3s) | The Wind Waker (20.2s) | Dark Souls III (25.9s) | Dark Souls III (24.9s) |
| Fastest | MathProof2p2e4 (2.7s) | Undertale (5.6s) | shapez (0.1s) | APQuest (2.6s) | MathProof2p2e4 (5.6s) | Metamath (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.7s | 16.4s | 0.1s | 2.8s | 17.4s | 17.4s |
| A Link to the Past | 10.1s | 19.2s | 0.1s | - | - | - |
| A Short Hike | 3.0s | 10.2s | 0.1s | 2.7s | 9.7s | 9.7s |
| APQuest | 2.8s | 11.2s | 0.1s | 2.6s | 5.6s | 5.6s |
| Adventure | 3.0s | 9.3s | 0.1s | 2.7s | 5.7s | 5.6s |
| Aquaria | 7.0s | 9.4s | 0.1s | 3.1s | 8.7s | 8.7s |
| Bumper Stickers | 3.2s | 9.8s | 0.1s | 2.9s | 8.8s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 7.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Castlevania 64 | 3.3s | 10.4s | 0.1s | 3.0s | 6.7s | 6.7s |
| Celeste (Open World) | 4.2s | 15.3s | 0.1s | 3.6s | 14.7s | 14.7s |
| Celeste 64 | 2.8s | 6.6s | 0.1s | 2.7s | 7.6s | 6.6s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 2.7s | 6.7s | 6.6s |
| ChocolateChipCookies | 2.7s | 5.6s | 0.1s | 2.8s | 5.7s | 5.8s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.7s | 9.7s | 9.7s |
| Civilization VI | 2.8s | 8.6s | 0.1s | 2.8s | 8.7s | 8.7s |
| DLCQuest | 3.1s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| DOOM 1993 | 3.2s | 12.8s | 0.1s | 3.0s | 12.8s | 12.8s |
| DOOM II | 3.2s | 15.3s | 0.1s | 2.8s | 14.7s | 14.7s |
| Dark Souls III | 5.2s | 25.9s | 0.1s | 3.4s | 25.9s | 24.9s |
| Donkey Kong Country 3 | 2.9s | 13.7s | 0.1s | - | - | - |
| Factorio | 3.4s | 9.7s | 0.1s | 2.7s | 9.7s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.8s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 2.9s | 10.7s | 10.7s |
| Heretic | 3.1s | 14.7s | 0.1s | 2.8s | 14.7s | 14.7s |
| Hylics 2 | 3.7s | 6.7s | 0.1s | 2.9s | 6.6s | 6.6s |
| Inscryption | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Kingdom Hearts | 8.9s | 28.8s | 0.1s | 2.9s | 22.8s | 14.9s |
| Kingdom Hearts 2 | 5.6s | 43.1s | 0.1s | 2.8s | - | - |
| Kirby's Dream Land 3 | 4.9s | 55.7s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.0s | 8.6s | 0.1s | 2.8s | 17.7s | 8.7s |
| Links Awakening DX | 9.1s | 16.7s | 0.1s | 3.0s | 16.8s | 16.7s |
| Lufia II Ancient Cave | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 9.7s | 0.1s | 3.3s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.8s | 0.1s | 2.6s | 5.6s | 5.6s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| Meritous | 2.9s | 5.7s | 0.1s | 3.0s | 5.7s | 5.7s |
| Metamath | 10.9s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Muse Dash | 3.2s | 7.8s | 0.1s | 3.0s | 9.8s | 7.8s |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Old School Runescape | 4.2s | 8.6s | 0.1s | 2.8s | 8.6s | 8.6s |
| Overcooked! 2 | 3.9s | 21.0s | 0.3s | 3.8s | 20.8s | 20.9s |
| Paint | 2.8s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.7s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s | 5.6s |
| Shivers | 3.2s | 9.8s | 0.1s | 3.0s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.3s | 13.8s | 0.1s | 3.0s | 16.8s | 13.7s |
| Starcraft 2 | 6.1s | 20.7s | 0.1s | 3.6s | 16.8s | 20.6s |
| Stardew Valley | 5.9s | 73.9s | 0.2s | 2.9s | - | - |
| Subnautica | 26.8s | 14.7s | 0.1s | 5.9s | 14.7s | 14.8s |
| Super Mario 64 | 2.8s | 12.6s | 0.1s | 2.7s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.7s | 0.1s | 2.9s | 7.7s | 7.7s |
| Super Mario World | 4.0s | 6.6s | 0.1s | - | - | - |
| TOEM original | 2.7s | 8.6s | 0.1s | 2.6s | 8.7s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.7s | 8.6s | 8.6s |
| Terraria | 3.0s | 20.8s | 0.1s | 3.0s | 20.8s | 20.8s |
| The Legend of Zelda | 4.7s | 8.8s | 0.1s | - | - | - |
| The Messenger | 3.1s | 12.8s | 0.1s | 2.8s | 12.8s | 12.8s |
| The Wind Waker | 16.7s | 9.8s | 0.1s | 20.2s | 9.8s | 9.8s |
| Timespinner | 3.5s | 7.8s | 0.1s | 3.0s | 6.7s | 7.6s |
| Undertale | 2.8s | 5.6s | 0.1s | - | - | - |
| VVVVVV | 2.7s | 5.7s | 0.1s | 2.7s | 5.7s | 5.6s |
| Wargroove | 2.8s | 6.6s | 0.1s | 3.0s | 6.7s | 6.7s |
| WebDevJourney | 2.7s | 8.7s | 0.1s | 2.7s | 8.7s | 8.6s |
| Yoshi's Island | 3.6s | 9.7s | 0.1s | 5.3s | 8.6s | 8.7s |
| shapez | 4.3s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.8s |
| 2 | The Wind Waker | 16.7s |
| 3 | Metamath | 10.9s |
| 4 | A Link to the Past | 10.1s |
| 5 | Links Awakening DX | 9.1s |
| 6 | Kingdom Hearts | 8.9s |
| 7 | Aquaria | 7.0s |
| 8 | Starcraft 2 | 6.1s |
| 9 | Stardew Valley | 5.9s |
| 10 | Kingdom Hearts 2 | 5.6s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 73.9s |
| 2 | Kirby's Dream Land 3 | 55.7s |
| 3 | Kingdom Hearts 2 | 43.1s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Dark Souls III | 25.9s |
| 6 | Overcooked! 2 | 21.0s |
| 7 | Terraria | 20.8s |
| 8 | Starcraft 2 | 20.7s |
| 9 | A Link to the Past | 19.2s |
| 10 | Links Awakening DX | 16.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 0.3s |
| 2 | Stardew Valley | 0.2s |
| 3 | Celeste (Open World) | 0.1s |
| 4 | Kingdom Hearts 2 | 0.1s |
| 5 | A Link to the Past | 0.1s |
| 6 | A Hat in Time | 0.1s |
| 7 | A Short Hike | 0.1s |
| 8 | Aquaria | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 20.2s |
| 2 | Subnautica | 5.9s |
| 3 | Yoshi's Island | 5.3s |
| 4 | Overcooked! 2 | 3.8s |
| 5 | Celeste (Open World) | 3.6s |
| 6 | Starcraft 2 | 3.6s |
| 7 | Dark Souls III | 3.4s |
| 8 | Mario & Luigi Superstar Saga | 3.3s |
| 9 | Aquaria | 3.1s |
| 10 | Links Awakening DX | 3.0s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 25.9s |
| 2 | Kingdom Hearts | 22.8s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | Terraria | 20.8s |
| 5 | Landstalker - The Treasures of King Nole | 17.7s |
| 6 | A Hat in Time | 17.4s |
| 7 | Starcraft 2 | 16.8s |
| 8 | Sonic Adventure 2 Battle | 16.8s |
| 9 | Links Awakening DX | 16.8s |
| 10 | Celeste (Open World) | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.9s |
| 2 | Overcooked! 2 | 20.9s |
| 3 | Terraria | 20.8s |
| 4 | Starcraft 2 | 20.6s |
| 5 | A Hat in Time | 17.4s |
| 6 | Links Awakening DX | 16.7s |
| 7 | Kingdom Hearts | 14.9s |
| 8 | Subnautica | 14.8s |
| 9 | Celeste (Open World) | 14.7s |
| 10 | DOOM II | 14.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 285.8s | 844.1s | 5.8s | 195.5s | 587.6s | 692.3s |
| Average | 4.3s | 12.8s | 0.1s | 3.3s | 10.1s | 11.9s |
| Max | 26.8s | 71.8s | 0.3s | 20.0s | 23.8s | 23.6s |
| Min | 2.6s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (26.8s) | Stardew Valley (71.8s) | Overcooked! 2 (0.3s) | The Wind Waker (20.0s) | Kingdom Hearts (23.8s) | Terraria (23.6s) |
| Fastest | ChecksFinder (2.6s) | MathProof2p2e4 (5.5s) | Undertale (0.1s) | APQuest (2.5s) | APQuest (5.5s) | APQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.5s | 16.1s | 0.1s | 2.9s | 17.2s | 17.1s |
| A Link to the Past | 9.8s | 18.2s | 0.1s | - | - | - |
| A Short Hike | 3.0s | 12.1s | 0.1s | 2.7s | 9.7s | 9.6s |
| APQuest | 2.8s | 8.9s | 0.1s | 2.5s | 5.5s | 5.5s |
| Adventure | 2.9s | 12.3s | 0.1s | 2.7s | 5.6s | 14.2s |
| Aquaria | 7.0s | 16.2s | 0.1s | 3.0s | 7.7s | 14.4s |
| Bumper Stickers | 3.3s | 12.0s | 0.1s | 3.0s | 8.7s | 14.4s |
| Castlevania - Circle of the Moon | 3.1s | 9.9s | 0.1s | 2.8s | 5.7s | 14.3s |
| Castlevania 64 | 3.1s | 9.3s | 0.1s | 2.8s | 6.7s | 6.7s |
| Celeste (Open World) | 4.2s | 18.9s | 0.1s | 3.9s | 14.8s | 14.7s |
| Celeste 64 | 2.7s | 6.5s | 0.1s | 2.7s | 7.5s | 13.9s |
| ChecksFinder | 2.6s | 6.7s | 0.1s | 2.7s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 14.3s |
| Choo-Choo Charles | 2.8s | 10.7s | 0.1s | 2.7s | 10.6s | 10.5s |
| Civilization VI | 2.8s | 8.6s | 0.1s | 2.8s | 8.7s | 17.4s |
| DLCQuest | 3.0s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| DOOM 1993 | 3.4s | 12.8s | 0.1s | 3.1s | 12.8s | 14.5s |
| DOOM II | 3.2s | 15.8s | 0.1s | 3.0s | 15.7s | 14.4s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 3.2s | 23.8s | 17.4s |
| Donkey Kong Country 3 | 3.0s | 14.7s | 0.1s | - | - | - |
| Factorio | 3.3s | 9.6s | 0.1s | 2.6s | 9.5s | 9.5s |
| Faxanadu | 2.7s | 6.6s | 0.1s | 2.7s | 8.6s | 14.3s |
| Final Fantasy Mystic Quest | 3.7s | 10.7s | 0.1s | 2.8s | 10.7s | 10.7s |
| Heretic | 3.1s | 15.6s | 0.1s | 2.7s | 15.6s | 14.2s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.9s | 6.6s | 6.6s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.7s | 6.6s | 6.6s |
| Kingdom Hearts | 9.0s | 28.9s | 0.1s | 3.2s | 23.8s | 15.0s |
| Kingdom Hearts 2 | 5.7s | 42.0s | 0.1s | 3.1s | - | - |
| Kirby's Dream Land 3 | 4.6s | 56.0s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 3.0s | 17.7s | 14.4s |
| Links Awakening DX | 8.7s | 17.6s | 0.1s | 3.1s | 17.6s | 17.6s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.6s | 9.7s | 0.1s | 3.2s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.5s | 0.1s | 2.6s | 5.5s | 14.0s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.7s | 8.7s | 17.3s |
| Meritous | 3.1s | 5.7s | 0.1s | 3.0s | 5.8s | 14.4s |
| Metamath | 10.2s | 5.6s | 0.1s | 2.8s | 5.7s | 5.7s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.8s | 9.7s | 14.4s |
| Noita | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Old School Runescape | 4.1s | 8.5s | 0.1s | 2.8s | 8.5s | 8.5s |
| Overcooked! 2 | 3.8s | 21.0s | 0.3s | 3.7s | 19.8s | 14.6s |
| Paint | 2.7s | 7.8s | 0.1s | 2.7s | 6.6s | 6.6s |
| Risk of Rain 2 | 2.7s | 6.5s | 0.1s | 2.6s | 6.5s | 6.5s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.7s | 6.6s | 14.2s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.9s | 9.7s | 14.3s |
| Sonic Adventure 2 Battle | 3.5s | 13.9s | 0.1s | 3.2s | 16.8s | 14.6s |
| Starcraft 2 | 6.3s | 20.8s | 0.1s | 3.9s | 16.8s | 14.7s |
| Stardew Valley | 5.6s | 71.8s | 0.2s | 3.6s | - | - |
| Subnautica | 26.8s | 15.7s | 0.1s | 5.9s | 14.7s | 17.5s |
| Super Mario 64 | 2.8s | 12.5s | 0.1s | 2.7s | 12.5s | 12.5s |
| Super Mario Land 2 | 3.9s | 7.7s | 0.1s | 2.8s | 7.7s | 7.7s |
| Super Mario World | 3.8s | 6.6s | 0.1s | - | - | - |
| TOEM original | 2.7s | 9.5s | 0.1s | 2.6s | 9.5s | 9.5s |
| TOEM rule builder | 2.8s | 8.6s | 0.1s | 2.7s | 8.8s | 8.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.8s | 19.8s | 23.6s |
| The Legend of Zelda | 4.8s | 8.8s | 0.1s | - | - | - |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.9s | 12.9s | 12.8s |
| The Wind Waker | 16.2s | 9.7s | 0.1s | 20.0s | 9.7s | 14.3s |
| Timespinner | 3.3s | 7.7s | 0.1s | 3.0s | 6.7s | 14.4s |
| Undertale | 3.0s | 5.5s | 0.1s | - | - | - |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Wargroove | 2.7s | 6.6s | 0.1s | 2.6s | 6.6s | 6.6s |
| WebDevJourney | 2.7s | 8.5s | 0.1s | 2.6s | 8.5s | 14.0s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 5.3s | 8.7s | 8.7s |
| shapez | 4.2s | 6.7s | 0.1s | 2.9s | 6.6s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.8s |
| 2 | The Wind Waker | 16.2s |
| 3 | Metamath | 10.2s |
| 4 | A Link to the Past | 9.8s |
| 5 | Kingdom Hearts | 9.0s |
| 6 | Links Awakening DX | 8.7s |
| 7 | Aquaria | 7.0s |
| 8 | Starcraft 2 | 6.3s |
| 9 | Kingdom Hearts 2 | 5.7s |
| 10 | Stardew Valley | 5.6s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.8s |
| 2 | Kirby's Dream Land 3 | 56.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Kingdom Hearts | 28.9s |
| 5 | Dark Souls III | 24.8s |
| 6 | Overcooked! 2 | 21.0s |
| 7 | Starcraft 2 | 20.8s |
| 8 | Terraria | 20.8s |
| 9 | Celeste (Open World) | 18.9s |
| 10 | A Link to the Past | 18.2s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 0.3s |
| 2 | Stardew Valley | 0.2s |
| 3 | Celeste (Open World) | 0.1s |
| 4 | Kingdom Hearts 2 | 0.1s |
| 5 | A Link to the Past | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | A Hat in Time | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 20.0s |
| 2 | Subnautica | 5.9s |
| 3 | Yoshi's Island | 5.3s |
| 4 | Celeste (Open World) | 3.9s |
| 5 | Starcraft 2 | 3.9s |
| 6 | Overcooked! 2 | 3.7s |
| 7 | Stardew Valley | 3.6s |
| 8 | Sonic Adventure 2 Battle | 3.2s |
| 9 | Mario & Luigi Superstar Saga | 3.2s |
| 10 | Kingdom Hearts | 3.2s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts | 23.8s |
| 2 | Dark Souls III | 23.8s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | Terraria | 19.8s |
| 5 | Landstalker - The Treasures of King Nole | 17.7s |
| 6 | Links Awakening DX | 17.6s |
| 7 | A Hat in Time | 17.2s |
| 8 | Starcraft 2 | 16.8s |
| 9 | Sonic Adventure 2 Battle | 16.8s |
| 10 | DOOM II | 15.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.6s |
| 2 | Links Awakening DX | 17.6s |
| 3 | Subnautica | 17.5s |
| 4 | Civilization VI | 17.4s |
| 5 | Dark Souls III | 17.4s |
| 6 | MegaMan Battle Network 3 | 17.3s |
| 7 | A Hat in Time | 17.1s |
| 8 | Kingdom Hearts | 15.0s |
| 9 | Celeste (Open World) | 14.7s |
| 10 | Starcraft 2 | 14.7s |
