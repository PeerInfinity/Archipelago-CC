# World Generator Test Results

**Generated:** 2025-12-23 21:53:30 UTC

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
| Stage 1: World Generation | 66 | 0 | 66 |
| Stage 2: Seed Generation | 64 | 2 | 66 |
| Stage 3: WorldGen Spoiler Test | 63 | 1 | 64 |
| Stage 4: Cross-Validation | 57 | 7 | 64 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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

**Total Templates:** 66

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 66 | 0 | 66 |
| Original Spoiler Test | 65 | 1 | 66 |
| Stage 1: World Generation | 66 | 0 | 66 |
| Stage 2: Seed Generation | 64 | 2 | 66 |
| Stage 3: WorldGen Spoiler Test | 63 | 1 | 64 |
| Stage 4: Cross-Validation | 28 | 36 | 64 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Total | 283.8s | 821.6s | 5.9s | 214.2s | 704.0s | 649.2s |
| Average | 4.3s | 12.4s | 0.1s | 3.2s | 11.0s | 10.1s |
| Max | 26.6s | 74.9s | 0.3s | 20.5s | 56.6s | 25.8s |
| Min | 2.6s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (26.6s) | Stardew Valley (74.9s) | Overcooked! 2 (0.3s) | The Wind Waker (20.5s) | Kirby's Dream Land 3 (56.6s) | Dark Souls III (25.8s) |
| Fastest | TOEM rule builder (2.6s) | Saving Princess (5.5s) | TOEM rule builder (0.1s) | Saving Princess (2.5s) | Adventure (5.5s) | Adventure (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.9s | 16.9s | 0.1s | 3.1s | 17.7s | 17.7s |
| A Link to the Past | 9.7s | 19.5s | 0.1s | 5.1s | 19.8s | 21.5s |
| A Short Hike | 3.0s | 11.1s | 0.1s | 2.7s | 9.7s | 9.7s |
| APQuest | 2.9s | 7.7s | 0.1s | 2.8s | 5.6s | 5.6s |
| Adventure | 2.8s | 7.2s | 0.1s | 2.6s | 5.5s | 5.5s |
| Aquaria | 6.9s | 9.3s | 0.1s | 2.9s | 8.7s | 8.7s |
| Bumper Stickers | 2.9s | 10.6s | 0.1s | 2.7s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 6.2s | 0.1s | 2.7s | 5.6s | 5.7s |
| Castlevania 64 | 3.3s | 7.2s | 0.1s | 3.0s | 6.7s | 6.7s |
| Celeste (Open World) | 4.2s | 17.1s | 0.1s | 3.8s | 14.8s | 14.8s |
| Celeste 64 | 2.9s | 6.7s | 0.1s | 3.0s | 7.8s | 6.8s |
| ChecksFinder | 2.6s | 6.7s | 0.1s | 2.6s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.6s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.9s | 9.8s | 9.7s |
| Civilization VI | 2.7s | 8.5s | 0.1s | 2.6s | 8.5s | 8.5s |
| DLCQuest | 2.9s | 5.6s | 0.1s | 2.8s | 5.6s | 5.7s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.9s | 12.7s | 12.7s |
| DOOM II | 3.1s | 15.7s | 0.1s | 2.9s | 15.7s | 15.7s |
| Dark Souls III | 5.0s | 24.8s | 0.1s | 3.3s | 24.8s | 25.8s |
| Donkey Kong Country 3 | 3.0s | 13.7s | 0.1s | 2.8s | 13.7s | 17.4s |
| Factorio | 3.5s | 9.8s | 0.1s | 3.0s | 9.8s | 9.8s |
| Faxanadu | 2.7s | 6.6s | 0.1s | 2.6s | 8.6s | 6.6s |
| Final Fantasy Mystic Quest | 3.7s | 10.7s | 0.1s | 2.8s | 10.7s | 10.7s |
| Heretic | 3.1s | 14.7s | 0.1s | 2.8s | 14.7s | 14.8s |
| Hylics 2 | 3.5s | 6.5s | 0.1s | 2.8s | 6.5s | 6.5s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| Kingdom Hearts | 8.9s | 28.8s | 0.1s | 2.9s | 23.8s | 14.9s |
| Kingdom Hearts 2 | 5.2s | 42.0s | 0.1s | 2.6s | - | - |
| Kirby's Dream Land 3 | 4.7s | 57.0s | 0.1s | 3.4s | 56.6s | 14.6s |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.9s | 17.7s | 8.7s |
| Links Awakening DX | 9.6s | 17.8s | 0.1s | 3.1s | 17.8s | 17.9s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.6s | 9.8s | 0.1s | 3.2s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.8s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mega Man 2 | 2.7s | 6.5s | 0.1s | 2.6s | 6.5s | 6.5s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.8s | 8.6s | 7.7s |
| Meritous | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Metamath | 9.8s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Muse Dash | 3.2s | 7.7s | 0.1s | 2.9s | 9.7s | 7.7s |
| Noita | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Old School Runescape | 4.4s | 8.7s | 0.1s | 3.0s | 8.8s | 8.8s |
| Overcooked! 2 | 3.8s | 19.9s | 0.3s | 3.7s | 20.8s | 19.8s |
| Paint | 2.7s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s | 6.6s |
| Saving Princess | 2.6s | 5.5s | 0.1s | 2.5s | 6.5s | 5.5s |
| Shivers | 3.0s | 9.7s | 0.1s | 2.9s | 9.6s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.9s | 16.7s | 13.7s |
| Starcraft 2 | 6.2s | 20.7s | 0.1s | 3.7s | 16.8s | 20.8s |
| Stardew Valley | 5.8s | 74.9s | 0.2s | 2.9s | - | - |
| Subnautica | 26.6s | 14.7s | 0.1s | 5.7s | 14.7s | 14.7s |
| Super Mario 64 | 2.9s | 12.8s | 0.1s | 3.0s | 12.8s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.7s | 0.1s | 2.8s | 7.7s | 7.7s |
| Super Mario World | 3.8s | 6.6s | 0.1s | 2.7s | 6.7s | 14.4s |
| TOEM original | 2.7s | 8.6s | 0.1s | 2.8s | 8.6s | 9.7s |
| TOEM rule builder | 2.6s | 9.5s | 0.1s | 2.6s | 9.5s | 9.5s |
| Terraria | 2.8s | 20.8s | 0.1s | 2.8s | 19.8s | 19.8s |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | 3.1s | 10.8s | 8.8s |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.8s | 12.8s | 12.9s |
| The Wind Waker | 16.1s | 9.8s | 0.1s | 20.5s | 9.7s | 9.7s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.9s | 7.7s | 6.7s |
| Undertale | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Wargroove | 2.7s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| WebDevJourney | 2.7s | 8.6s | 0.1s | 2.8s | 8.6s | 8.7s |
| Yoshi's Island | 3.4s | 9.5s | 0.1s | 5.0s | 8.5s | 8.5s |
| shapez | 4.3s | 6.8s | 0.1s | 2.9s | 6.6s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.6s |
| 2 | The Wind Waker | 16.1s |
| 3 | Metamath | 9.8s |
| 4 | A Link to the Past | 9.7s |
| 5 | Links Awakening DX | 9.6s |
| 6 | Kingdom Hearts | 8.9s |
| 7 | Aquaria | 6.9s |
| 8 | Starcraft 2 | 6.2s |
| 9 | Stardew Valley | 5.8s |
| 10 | Kingdom Hearts 2 | 5.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 74.9s |
| 2 | Kirby's Dream Land 3 | 57.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Dark Souls III | 24.8s |
| 6 | Terraria | 20.8s |
| 7 | Starcraft 2 | 20.7s |
| 8 | Overcooked! 2 | 19.9s |
| 9 | A Link to the Past | 19.5s |
| 10 | Links Awakening DX | 17.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 0.3s |
| 2 | Stardew Valley | 0.2s |
| 3 | Celeste (Open World) | 0.1s |
| 4 | Kingdom Hearts 2 | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | A Link to the Past | 0.1s |
| 7 | Aquaria | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 20.5s |
| 2 | Subnautica | 5.7s |
| 3 | A Link to the Past | 5.1s |
| 4 | Yoshi's Island | 5.0s |
| 5 | Celeste (Open World) | 3.8s |
| 6 | Starcraft 2 | 3.7s |
| 7 | Overcooked! 2 | 3.7s |
| 8 | Kirby's Dream Land 3 | 3.4s |
| 9 | Dark Souls III | 3.3s |
| 10 | Mario & Luigi Superstar Saga | 3.2s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.6s |
| 2 | Dark Souls III | 24.8s |
| 3 | Kingdom Hearts | 23.8s |
| 4 | Overcooked! 2 | 20.8s |
| 5 | Terraria | 19.8s |
| 6 | A Link to the Past | 19.8s |
| 7 | Links Awakening DX | 17.8s |
| 8 | Landstalker - The Treasures of King Nole | 17.7s |
| 9 | A Hat in Time | 17.7s |
| 10 | Starcraft 2 | 16.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 25.8s |
| 2 | A Link to the Past | 21.5s |
| 3 | Starcraft 2 | 20.8s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | Terraria | 19.8s |
| 6 | Links Awakening DX | 17.9s |
| 7 | A Hat in Time | 17.7s |
| 8 | Donkey Kong Country 3 | 17.4s |
| 9 | DOOM II | 15.7s |
| 10 | Kingdom Hearts | 14.9s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 282.9s | 826.4s | 5.9s | 211.6s | 702.7s | 768.6s |
| Average | 4.3s | 12.5s | 0.1s | 3.2s | 11.0s | 12.0s |
| Max | 26.4s | 71.7s | 0.3s | 19.0s | 54.5s | 23.6s |
| Min | 2.6s | 5.5s | 0.1s | 2.6s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (26.4s) | Stardew Valley (71.7s) | Overcooked! 2 (0.3s) | The Wind Waker (19.0s) | Kirby's Dream Land 3 (54.5s) | Terraria (23.6s) |
| Fastest | Noita (2.6s) | Undertale (5.5s) | Undertale (0.1s) | ChocolateChipCookies (2.6s) | Undertale (5.5s) | Undertale (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.6s | 16.5s | 0.1s | 2.9s | 17.2s | 17.2s |
| A Link to the Past | 9.9s | 19.3s | 0.1s | 5.2s | 26.0s | 14.3s |
| A Short Hike | 3.0s | 12.0s | 0.1s | 2.6s | 9.7s | 9.6s |
| APQuest | 2.8s | 8.5s | 0.1s | 2.7s | 5.6s | 5.6s |
| Adventure | 2.9s | 6.5s | 0.1s | 2.6s | 5.7s | 14.2s |
| Aquaria | 7.0s | 11.5s | 0.1s | 3.0s | 7.7s | 14.4s |
| Bumper Stickers | 2.9s | 11.0s | 0.1s | 2.7s | 8.7s | 14.3s |
| Castlevania - Circle of the Moon | 3.0s | 8.5s | 0.1s | 2.8s | 5.6s | 14.3s |
| Castlevania 64 | 3.0s | 10.5s | 0.1s | 2.7s | 6.7s | 6.7s |
| Celeste (Open World) | 4.1s | 17.0s | 0.1s | 3.8s | 14.7s | 14.5s |
| Celeste 64 | 2.8s | 6.5s | 0.1s | 2.7s | 7.5s | 14.2s |
| ChecksFinder | 2.7s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.6s | 5.6s | 14.2s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.8s | 9.7s | 10.8s |
| Civilization VI | 2.7s | 8.6s | 0.1s | 2.7s | 8.6s | 17.3s |
| DLCQuest | 3.0s | 5.6s | 0.1s | 2.9s | 5.7s | 5.6s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.9s | 12.7s | 14.3s |
| DOOM II | 3.1s | 15.8s | 0.1s | 3.0s | 15.7s | 14.4s |
| Dark Souls III | 4.7s | 24.8s | 0.1s | 3.1s | 23.7s | 17.2s |
| Donkey Kong Country 3 | 2.8s | 13.7s | 0.1s | 2.7s | 13.7s | 14.9s |
| Factorio | 3.4s | 9.6s | 0.1s | 2.7s | 9.6s | 9.5s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.7s | 8.6s | 14.2s |
| Final Fantasy Mystic Quest | 3.7s | 10.7s | 0.1s | 2.7s | 10.7s | 10.7s |
| Heretic | 3.1s | 14.7s | 0.1s | 2.9s | 14.7s | 14.3s |
| Hylics 2 | 3.6s | 6.6s | 0.1s | 2.9s | 6.6s | 6.6s |
| Inscryption | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s | 6.6s |
| Kingdom Hearts | 8.9s | 28.9s | 0.1s | 3.1s | 23.8s | 15.0s |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.1s | 2.9s | - | - |
| Kirby's Dream Land 3 | 4.5s | 55.0s | 0.1s | 3.1s | 54.5s | 14.4s |
| Landstalker - The Treasures of King Nole | 3.0s | 8.7s | 0.1s | 2.8s | 17.7s | 14.3s |
| Links Awakening DX | 8.9s | 17.6s | 0.1s | 3.2s | 17.6s | 17.6s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.6s | 9.7s | 0.1s | 3.2s | 9.7s | 9.6s |
| MathProof2p2e4 | 2.6s | 5.6s | 0.1s | 2.6s | 5.6s | 14.2s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.8s | 8.6s | 17.5s |
| Meritous | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 14.2s |
| Metamath | 11.3s | 5.7s | 0.1s | 2.8s | 5.7s | 5.6s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.7s | 9.7s | 14.3s |
| Noita | 2.6s | 5.7s | 0.1s | 2.6s | 5.7s | 5.6s |
| Old School Runescape | 4.1s | 9.7s | 0.1s | 2.8s | 8.6s | 8.5s |
| Overcooked! 2 | 3.9s | 20.9s | 0.3s | 3.7s | 19.8s | 14.6s |
| Paint | 2.7s | 7.8s | 0.1s | 2.7s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.7s | 6.6s | 14.2s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.9s | 9.7s | 14.4s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.9s | 16.7s | 14.4s |
| Starcraft 2 | 6.3s | 20.7s | 0.1s | 3.8s | 16.8s | 14.4s |
| Stardew Valley | 5.5s | 71.7s | 0.2s | 3.5s | - | - |
| Subnautica | 26.4s | 14.8s | 0.1s | 5.7s | 14.6s | 17.4s |
| Super Mario 64 | 2.8s | 12.6s | 0.1s | 2.7s | 12.5s | 12.5s |
| Super Mario Land 2 | 4.0s | 7.7s | 0.1s | 2.8s | 7.7s | 7.7s |
| Super Mario World | 3.9s | 6.6s | 0.1s | 2.7s | 6.6s | 14.3s |
| TOEM original | 2.7s | 8.7s | 0.1s | 2.7s | 8.6s | 8.6s |
| TOEM rule builder | 2.7s | 8.6s | 0.1s | 2.7s | 8.6s | 8.6s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.8s | 20.8s | 23.6s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | 2.9s | 10.7s | 14.4s |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.8s | 12.8s | 12.8s |
| The Wind Waker | 16.0s | 9.7s | 0.1s | 19.0s | 9.7s | 14.3s |
| Timespinner | 3.2s | 7.6s | 0.1s | 2.9s | 6.7s | 14.3s |
| Undertale | 2.8s | 5.5s | 0.1s | 2.6s | 5.5s | 5.5s |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Wargroove | 2.7s | 6.6s | 0.1s | 2.6s | 6.6s | 6.6s |
| WebDevJourney | 2.7s | 8.7s | 0.1s | 2.7s | 8.7s | 14.2s |
| Yoshi's Island | 3.4s | 9.7s | 0.1s | 5.3s | 8.6s | 8.6s |
| shapez | 4.4s | 6.6s | 0.1s | 2.9s | 6.7s | 14.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.4s |
| 2 | The Wind Waker | 16.0s |
| 3 | Metamath | 11.3s |
| 4 | A Link to the Past | 9.9s |
| 5 | Kingdom Hearts | 8.9s |
| 6 | Links Awakening DX | 8.9s |
| 7 | Aquaria | 7.0s |
| 8 | Starcraft 2 | 6.3s |
| 9 | Stardew Valley | 5.5s |
| 10 | Kingdom Hearts 2 | 5.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.7s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Kingdom Hearts | 28.9s |
| 5 | Dark Souls III | 24.8s |
| 6 | Overcooked! 2 | 20.9s |
| 7 | Terraria | 20.8s |
| 8 | Starcraft 2 | 20.7s |
| 9 | A Link to the Past | 19.3s |
| 10 | Links Awakening DX | 17.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 0.3s |
| 2 | Stardew Valley | 0.2s |
| 3 | Celeste (Open World) | 0.1s |
| 4 | A Link to the Past | 0.1s |
| 5 | Kingdom Hearts 2 | 0.1s |
| 6 | A Hat in Time | 0.1s |
| 7 | Aquaria | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 19.0s |
| 2 | Subnautica | 5.7s |
| 3 | Yoshi's Island | 5.3s |
| 4 | A Link to the Past | 5.2s |
| 5 | Celeste (Open World) | 3.8s |
| 6 | Starcraft 2 | 3.8s |
| 7 | Overcooked! 2 | 3.7s |
| 8 | Stardew Valley | 3.5s |
| 9 | Links Awakening DX | 3.2s |
| 10 | Mario & Luigi Superstar Saga | 3.2s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 54.5s |
| 2 | A Link to the Past | 26.0s |
| 3 | Kingdom Hearts | 23.8s |
| 4 | Dark Souls III | 23.7s |
| 5 | Terraria | 20.8s |
| 6 | Overcooked! 2 | 19.8s |
| 7 | Landstalker - The Treasures of King Nole | 17.7s |
| 8 | Links Awakening DX | 17.6s |
| 9 | A Hat in Time | 17.2s |
| 10 | Starcraft 2 | 16.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.6s |
| 2 | Links Awakening DX | 17.6s |
| 3 | MegaMan Battle Network 3 | 17.5s |
| 4 | Subnautica | 17.4s |
| 5 | Civilization VI | 17.3s |
| 6 | Dark Souls III | 17.2s |
| 7 | A Hat in Time | 17.2s |
| 8 | Kingdom Hearts | 15.0s |
| 9 | Donkey Kong Country 3 | 14.9s |
| 10 | Overcooked! 2 | 14.6s |
