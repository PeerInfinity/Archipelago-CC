# World Generator Test Results

**Generated:** 2025-12-23 04:58:43 UTC

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

**Total Templates:** 68

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 68 | 0 | 68 |
| Original Spoiler Test | 65 | 3 | 68 |
| Stage 1: World Generation | 62 | 6 | 68 |
| Stage 2: Seed Generation | 59 | 9 | 68 |
| Stage 3: WorldGen Spoiler Test | 59 | 0 | 59 |
| Stage 4: Cross-Validation | 55 | 4 | 59 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bomb Rush Cyberfunk | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
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
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
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

**Total Templates:** 68

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 68 | 0 | 68 |
| Original Spoiler Test | 65 | 3 | 68 |
| Stage 1: World Generation | 62 | 6 | 68 |
| Stage 2: Seed Generation | 59 | 9 | 68 |
| Stage 3: WorldGen Spoiler Test | 59 | 0 | 59 |
| Stage 4: Cross-Validation | 28 | 31 | 59 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
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
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Super Metroid | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
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
| Total | 310.7s | 915.7s | 6.5s | 175.1s | 627.9s | 650.3s |
| Average | 4.6s | 13.5s | 0.1s | 2.8s | 10.6s | 11.0s |
| Max | 26.5s | 72.7s | 0.5s | 3.9s | 43.9s | 73.2s |
| Min | 2.6s | 5.6s | 0.1s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (26.5s) | Stardew Valley (72.7s) | Kingdom Hearts 2 (0.5s) | Overcooked! 2 (3.9s) | Super Metroid (43.9s) | Super Metroid (73.2s) |
| Fastest | Saving Princess (2.6s) | Saving Princess (5.6s) | WebDevJourney (0.1s) | Kingdom Hearts (2.5s) | Lufia II Ancient Cave (5.6s) | Saving Princess (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.8s | 16.6s | 0.1s | 2.8s | 13.8s | 13.7s |
| A Link to the Past | 11.0s | 20.7s | 0.1s | - | - | - |
| A Short Hike | 3.1s | 12.7s | 0.1s | 2.7s | 9.6s | 9.7s |
| APQuest | 3.1s | 9.0s | 0.1s | 2.7s | 5.6s | 5.7s |
| Adventure | 2.9s | 8.3s | 0.1s | 2.7s | 5.7s | 5.6s |
| Aquaria | 6.8s | 9.5s | 0.1s | 2.7s | 7.6s | 7.6s |
| Bomb Rush Cyberfunk | 10.0s | 22.2s | 0.1s | 2.9s | 19.8s | 19.2s |
| Bumper Stickers | 3.0s | 11.2s | 0.1s | 2.7s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 2.9s | 8.2s | 0.1s | 2.7s | 5.6s | 5.6s |
| Castlevania 64 | 3.1s | 8.3s | 0.1s | 2.8s | 6.7s | 6.7s |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 3.8s | 14.8s | 14.8s |
| Celeste 64 | 3.1s | 6.8s | 0.1s | 2.9s | 7.7s | 6.7s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.9s | 5.7s | 0.1s | 2.8s | 5.6s | 5.7s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Civilization VI | 2.7s | 8.6s | 0.1s | 2.6s | 8.6s | 8.6s |
| DLCQuest | 3.0s | 5.6s | 0.1s | 2.8s | 5.7s | 5.6s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s | 12.7s |
| DOOM II | 3.1s | 15.7s | 0.1s | 2.8s | 15.7s | 15.7s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 3.1s | 24.8s | 24.8s |
| Donkey Kong Country 3 | 3.0s | 13.8s | 0.1s | - | - | - |
| Factorio | 3.8s | 9.7s | 0.1s | 3.1s | 9.8s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.7s | 8.6s | 6.6s |
| Final Fantasy Mystic Quest | 4.0s | 10.8s | 0.1s | 3.0s | 10.7s | 10.7s |
| Heretic | 3.2s | 14.8s | 0.1s | 3.0s | 14.8s | 14.7s |
| Hylics 2 | 3.6s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| Inscryption | 2.9s | 6.8s | 0.1s | 2.8s | 6.7s | 6.7s |
| Kingdom Hearts | 8.9s | 28.9s | 0.1s | 2.5s | - | - |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.5s | 2.6s | - | - |
| Kirby's Dream Land 3 | 4.5s | 55.0s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.3s | 8.6s | 0.1s | 2.8s | 17.8s | 8.7s |
| Links Awakening DX | 9.7s | 16.8s | 0.1s | 3.1s | 17.8s | 17.9s |
| Lufia II Ancient Cave | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 5.7s |
| Mario & Luigi Superstar Saga | 3.9s | 9.8s | 0.1s | 2.9s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mega Man 2 | 2.7s | 6.6s | 0.1s | 2.6s | 6.7s | 6.6s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Meritous | 2.9s | 5.6s | 0.1s | 2.7s | 5.6s | 5.7s |
| Metamath | 10.9s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Muse Dash | 2.9s | 7.7s | 0.1s | 2.8s | 9.7s | 7.7s |
| Noita | 2.8s | 5.6s | 0.1s | 2.8s | 5.7s | 5.7s |
| Old School Runescape | 4.5s | 8.7s | 0.1s | 3.1s | 8.8s | 8.7s |
| Overcooked! 2 | 4.0s | 21.0s | 0.3s | 3.9s | 20.9s | 19.9s |
| Paint | 2.9s | 6.7s | 0.1s | 2.8s | 6.8s | 7.7s |
| Risk of Rain 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Saving Princess | 2.6s | 5.6s | 0.1s | 2.6s | 6.6s | 5.6s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.8s | 9.7s | 17.4s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.8s | 13.7s |
| Starcraft 2 | 6.2s | 20.8s | 0.1s | 3.1s | 17.8s | 20.6s |
| Stardew Valley | 5.5s | 72.7s | 0.3s | 2.7s | - | - |
| Subnautica | 26.5s | 14.7s | 0.1s | 2.8s | 14.7s | 14.7s |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.2s | 7.7s | 0.1s | 2.8s | 7.7s | 7.8s |
| Super Mario World | 4.2s | 6.7s | 0.1s | - | - | - |
| Super Metroid | 11.2s | 70.4s | 0.1s | 2.9s | 43.9s | 73.2s |
| TOEM original | 2.7s | 8.6s | 0.1s | 2.6s | 8.6s | 8.6s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s | 9.7s |
| Terraria | 2.9s | 19.8s | 0.1s | 2.8s | 19.8s | 19.8s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.8s | 12.8s | 12.8s |
| The Wind Waker | 15.9s | 9.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Timespinner | 3.4s | 7.7s | 0.1s | 2.8s | 7.6s | 7.7s |
| Undertale | 2.9s | 5.6s | 0.1s | - | - | - |
| VVVVVV | 3.0s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Wargroove | 2.8s | 6.7s | 0.1s | 2.7s | 6.7s | 6.6s |
| WebDevJourney | 2.7s | 8.6s | 0.1s | 2.6s | 8.6s | 8.6s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| shapez | 4.2s | 6.6s | 0.1s | 2.7s | 6.7s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.5s |
| 2 | The Wind Waker | 15.9s |
| 3 | Super Metroid | 11.2s |
| 4 | A Link to the Past | 11.0s |
| 5 | Metamath | 10.9s |
| 6 | Bomb Rush Cyberfunk | 10.0s |
| 7 | Links Awakening DX | 9.7s |
| 8 | Kingdom Hearts | 8.9s |
| 9 | Aquaria | 6.8s |
| 10 | Starcraft 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 72.7s |
| 2 | Super Metroid | 70.4s |
| 3 | Kirby's Dream Land 3 | 55.0s |
| 4 | Kingdom Hearts 2 | 42.0s |
| 5 | Kingdom Hearts | 28.9s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 22.2s |
| 8 | Overcooked! 2 | 21.0s |
| 9 | Starcraft 2 | 20.8s |
| 10 | A Link to the Past | 20.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
| 2 | Overcooked! 2 | 0.3s |
| 3 | Stardew Valley | 0.3s |
| 4 | Bomb Rush Cyberfunk | 0.1s |
| 5 | A Link to the Past | 0.1s |
| 6 | A Hat in Time | 0.1s |
| 7 | Aquaria | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | Starcraft 2 | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 3.9s |
| 2 | Celeste (Open World) | 3.8s |
| 3 | Dark Souls III | 3.1s |
| 4 | Starcraft 2 | 3.1s |
| 5 | Links Awakening DX | 3.1s |
| 6 | Old School Runescape | 3.1s |
| 7 | Factorio | 3.1s |
| 8 | Heretic | 3.0s |
| 9 | Final Fantasy Mystic Quest | 3.0s |
| 10 | Mario & Luigi Superstar Saga | 2.9s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 43.9s |
| 2 | Dark Souls III | 24.8s |
| 3 | Overcooked! 2 | 20.9s |
| 4 | Terraria | 19.8s |
| 5 | Bomb Rush Cyberfunk | 19.8s |
| 6 | Links Awakening DX | 17.8s |
| 7 | Starcraft 2 | 17.8s |
| 8 | Landstalker - The Treasures of King Nole | 17.8s |
| 9 | Sonic Adventure 2 Battle | 16.8s |
| 10 | DOOM II | 15.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 73.2s |
| 2 | Dark Souls III | 24.8s |
| 3 | Starcraft 2 | 20.6s |
| 4 | Overcooked! 2 | 19.9s |
| 5 | Terraria | 19.8s |
| 6 | Bomb Rush Cyberfunk | 19.2s |
| 7 | Links Awakening DX | 17.9s |
| 8 | Shivers | 17.4s |
| 9 | DOOM II | 15.7s |
| 10 | Celeste (Open World) | 14.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 307.4s | 905.5s | 6.5s | 179.6s | 625.1s | 779.7s |
| Average | 4.5s | 13.3s | 0.1s | 2.9s | 10.6s | 13.2s |
| Max | 26.7s | 72.7s | 0.5s | 3.9s | 43.0s | 84.5s |
| Min | 2.6s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (26.7s) | Stardew Valley (72.7s) | Kingdom Hearts 2 (0.5s) | Overcooked! 2 (3.9s) | Super Metroid (43.0s) | Super Metroid (84.5s) |
| Fastest | MathProof2p2e4 (2.6s) | MathProof2p2e4 (5.6s) | WebDevJourney (0.1s) | Adventure (2.7s) | Adventure (5.6s) | Noita (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.7s | 16.2s | 0.1s | 2.8s | 13.7s | 13.7s |
| A Link to the Past | 10.2s | 19.2s | 0.1s | - | - | - |
| A Short Hike | 3.1s | 11.1s | 0.1s | 3.0s | 9.7s | 9.7s |
| APQuest | 2.9s | 6.6s | 0.1s | 2.8s | 5.7s | 5.6s |
| Adventure | 2.9s | 6.5s | 0.1s | 2.7s | 5.6s | 14.2s |
| Aquaria | 7.0s | 9.8s | 0.1s | 2.8s | 7.7s | 14.4s |
| Bomb Rush Cyberfunk | 9.8s | 19.8s | 0.1s | 3.2s | 19.8s | 19.6s |
| Bumper Stickers | 2.9s | 10.2s | 0.1s | 2.7s | 8.7s | 14.2s |
| Castlevania - Circle of the Moon | 3.1s | 8.6s | 0.1s | 2.8s | 5.7s | 14.3s |
| Castlevania 64 | 3.1s | 7.2s | 0.1s | 2.9s | 6.7s | 6.7s |
| Celeste (Open World) | 3.9s | 14.8s | 0.1s | 3.8s | 14.7s | 14.6s |
| Celeste 64 | 2.9s | 6.8s | 0.1s | 2.9s | 7.7s | 14.4s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.7s | 5.7s | 14.3s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.8s | 9.6s | 9.6s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s | 17.4s |
| DLCQuest | 3.0s | 5.6s | 0.1s | 2.9s | 5.7s | 5.7s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.9s | 12.7s | 14.3s |
| DOOM II | 3.4s | 15.8s | 0.1s | 3.0s | 15.8s | 14.4s |
| Dark Souls III | 4.8s | 24.7s | 0.1s | 3.2s | 23.7s | 17.4s |
| Donkey Kong Country 3 | 2.9s | 13.8s | 0.1s | - | - | - |
| Factorio | 3.6s | 9.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Faxanadu | 2.9s | 6.6s | 0.1s | 2.8s | 8.7s | 14.3s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 2.9s | 10.7s | 10.7s |
| Heretic | 3.1s | 14.7s | 0.1s | 2.9s | 14.7s | 14.3s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.8s | 6.7s | 6.6s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.9s | 6.7s | 6.7s |
| Kingdom Hearts | 9.1s | 29.0s | 0.1s | 3.1s | - | - |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.5s | 2.9s | - | - |
| Kirby's Dream Land 3 | 4.6s | 55.6s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.0s | 8.6s | 0.1s | 2.9s | 17.7s | 14.3s |
| Links Awakening DX | 9.6s | 17.8s | 0.1s | 3.4s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.6s | 5.6s | 0.1s | 2.7s | 5.6s | 14.3s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 8.6s | 0.1s | 2.9s | 8.7s | 17.5s |
| Meritous | 2.9s | 5.7s | 0.1s | 2.8s | 5.6s | 14.3s |
| Metamath | 10.0s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Muse Dash | 2.9s | 7.7s | 0.1s | 2.7s | 9.7s | 14.3s |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Old School Runescape | 4.3s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| Overcooked! 2 | 4.0s | 21.1s | 0.3s | 3.9s | 20.9s | 14.7s |
| Paint | 2.7s | 6.7s | 0.1s | 2.8s | 6.7s | 7.7s |
| Risk of Rain 2 | 2.8s | 6.7s | 0.1s | 2.9s | 6.7s | 6.8s |
| Saving Princess | 2.8s | 5.6s | 0.1s | 2.8s | 6.6s | 14.3s |
| Shivers | 3.0s | 9.7s | 0.1s | 2.9s | 9.7s | 14.4s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.9s | 16.7s | 14.4s |
| Starcraft 2 | 6.4s | 20.8s | 0.1s | 3.3s | 17.8s | 14.5s |
| Stardew Valley | 5.5s | 72.7s | 0.3s | 3.5s | - | - |
| Subnautica | 26.7s | 14.7s | 0.1s | 2.7s | 14.7s | 17.4s |
| Super Mario 64 | 2.8s | 12.8s | 0.1s | 2.8s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.1s | 7.8s | 0.1s | 2.9s | 7.7s | 7.7s |
| Super Mario World | 4.3s | 6.7s | 0.1s | - | - | - |
| Super Metroid | 11.2s | 69.8s | 0.1s | 3.2s | 43.0s | 84.5s |
| TOEM original | 2.7s | 8.7s | 0.1s | 2.8s | 8.6s | 8.7s |
| TOEM rule builder | 2.7s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Terraria | 2.9s | 19.8s | 0.1s | 2.8s | 19.8s | 23.7s |
| The Legend of Zelda | 4.7s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.8s | 12.8s | 12.8s |
| The Wind Waker | 15.6s | 9.7s | 0.1s | 2.7s | 9.7s | 14.2s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.9s | 7.7s | 14.7s |
| Undertale | 3.0s | 5.7s | 0.1s | - | - | - |
| VVVVVV | 2.8s | 5.6s | 0.1s | 2.7s | 5.7s | 5.7s |
| Wargroove | 2.8s | 6.6s | 0.1s | 2.7s | 6.7s | 6.6s |
| WebDevJourney | 2.8s | 8.8s | 0.1s | 2.8s | 8.7s | 14.2s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| shapez | 4.1s | 6.6s | 0.1s | 2.7s | 6.6s | 14.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.7s |
| 2 | The Wind Waker | 15.6s |
| 3 | Super Metroid | 11.2s |
| 4 | A Link to the Past | 10.2s |
| 5 | Metamath | 10.0s |
| 6 | Bomb Rush Cyberfunk | 9.8s |
| 7 | Links Awakening DX | 9.6s |
| 8 | Kingdom Hearts | 9.1s |
| 9 | Aquaria | 7.0s |
| 10 | Starcraft 2 | 6.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 72.7s |
| 2 | Super Metroid | 69.8s |
| 3 | Kirby's Dream Land 3 | 55.6s |
| 4 | Kingdom Hearts 2 | 42.0s |
| 5 | Kingdom Hearts | 29.0s |
| 6 | Dark Souls III | 24.7s |
| 7 | Overcooked! 2 | 21.1s |
| 8 | Starcraft 2 | 20.8s |
| 9 | Bomb Rush Cyberfunk | 19.8s |
| 10 | Terraria | 19.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
| 2 | Overcooked! 2 | 0.3s |
| 3 | Stardew Valley | 0.3s |
| 4 | Bomb Rush Cyberfunk | 0.1s |
| 5 | A Link to the Past | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Starcraft 2 | 0.1s |
| 8 | A Hat in Time | 0.1s |
| 9 | A Short Hike | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 3.9s |
| 2 | Celeste (Open World) | 3.8s |
| 3 | Stardew Valley | 3.5s |
| 4 | Links Awakening DX | 3.4s |
| 5 | Starcraft 2 | 3.3s |
| 6 | Dark Souls III | 3.2s |
| 7 | Bomb Rush Cyberfunk | 3.2s |
| 8 | Super Metroid | 3.2s |
| 9 | Kingdom Hearts | 3.1s |
| 10 | DOOM II | 3.0s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 43.0s |
| 2 | Dark Souls III | 23.7s |
| 3 | Overcooked! 2 | 20.9s |
| 4 | Bomb Rush Cyberfunk | 19.8s |
| 5 | Terraria | 19.8s |
| 6 | Starcraft 2 | 17.8s |
| 7 | Landstalker - The Treasures of King Nole | 17.7s |
| 8 | Links Awakening DX | 16.8s |
| 9 | Sonic Adventure 2 Battle | 16.7s |
| 10 | DOOM II | 15.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 84.5s |
| 2 | Terraria | 23.7s |
| 3 | Bomb Rush Cyberfunk | 19.6s |
| 4 | MegaMan Battle Network 3 | 17.5s |
| 5 | Civilization VI | 17.4s |
| 6 | Dark Souls III | 17.4s |
| 7 | Subnautica | 17.4s |
| 8 | Links Awakening DX | 16.8s |
| 9 | Overcooked! 2 | 14.7s |
| 10 | Timespinner | 14.7s |
