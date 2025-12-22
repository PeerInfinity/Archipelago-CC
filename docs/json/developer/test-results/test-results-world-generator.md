# World Generator Test Results

**Generated:** 2025-12-22 00:46:46 UTC
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

- **Original Gen**: Original world seed generation
- **Original Test**: Spoiler test on original world
- **World Gen**: World generator created _worldgen world from rules.json
- **Test Gen**: _worldgen world seed generation
- **Test Spoiler**: Spoiler test on _worldgen world
- **Cross-Validation**: Original sphere log validates against _worldgen world

---

# Canonical Mode Results

Tests run with `--canonical-seed1` (items placed in original locations).

## Canonical Summary

**Total Templates:** 69

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 69 | 0 | 69 |
| Original Spoiler Test | 69 | 0 | 69 |
| Test World Generation | 63 | 6 | 69 |
| Test Seed Generation | 44 | 25 | 69 |
| Test Spoiler Test | 41 | 3 | 44 |
| Cross-Validation | 36 | 8 | 44 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ❌ | - | - |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DLCQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 69

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 69 | 0 | 69 |
| Original Spoiler Test | 69 | 0 | 69 |
| Test World Generation | 63 | 6 | 69 |
| Test Seed Generation | 44 | 25 | 69 |
| Test Spoiler Test | 41 | 3 | 44 |
| Cross-Validation | 20 | 24 | 44 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ❌ | - | - |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DLCQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Total | 315.5s | 880.0s | 6.8s | 176.5s | 431.0s | 490.7s |
| Average | 4.6s | 12.8s | 0.1s | 2.8s | 9.8s | 11.2s |
| Max | 26.7s | 73.5s | 0.7s | 3.8s | 20.7s | 64.8s |
| Min | 2.7s | 5.6s | 0.1s | 2.4s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (26.7s) | Stardew Valley (73.5s) | Kingdom Hearts 2 (0.7s) | Celeste (Open World) (3.8s) | Mario & Luigi Superstar Saga (20.7s) | Super Metroid (64.8s) |
| Fastest | MathProof2p2e4 (2.7s) | Metamath (5.6s) | Wargroove (0.1s) | Castlevania 64 (2.4s) | Adventure (5.6s) | Adventure (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 4.9s | 17.0s | 0.1s | 2.7s | - | - |
| A Link to the Past | 10.2s | 24.3s | 0.1s | - | - | - |
| A Short Hike | 3.1s | 13.6s | 0.1s | 2.7s | 9.7s | 9.7s |
| APQuest | 3.0s | 6.4s | 0.1s | 2.8s | 5.7s | 5.7s |
| Adventure | 2.9s | 6.8s | 0.1s | 2.7s | 5.6s | 5.6s |
| Aquaria | 7.0s | 11.2s | 0.1s | 2.8s | 7.7s | 14.4s |
| Bomb Rush Cyberfunk | 12.1s | 25.7s | 0.2s | 2.8s | - | - |
| Bumper Stickers | 3.2s | 9.3s | 0.1s | 3.0s | 8.8s | 8.8s |
| Castlevania - Circle of the Moon | 3.0s | 6.1s | 0.1s | 2.5s | - | - |
| Castlevania 64 | 2.8s | 7.8s | 0.1s | 2.4s | - | - |
| Celeste (Open World) | 4.0s | 14.7s | 0.1s | 3.8s | 14.8s | 14.8s |
| Celeste 64 | 3.0s | 6.8s | 0.1s | 2.9s | 7.7s | 6.7s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.7s | 6.7s | 14.3s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.8s | 5.6s | 5.7s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.8s | 9.7s | 9.8s |
| Civilization VI | 2.9s | 8.6s | 0.1s | 2.7s | 8.7s | 14.4s |
| DLCQuest | 3.2s | 5.8s | 0.1s | 2.8s | - | - |
| DOOM 1993 | 3.3s | 12.9s | 0.1s | 3.1s | 12.8s | 12.9s |
| DOOM II | 3.2s | 15.7s | 0.1s | 2.8s | 14.7s | 15.7s |
| Dark Souls III | 4.4s | 24.6s | 0.1s | 2.4s | - | - |
| Donkey Kong Country 3 | 3.0s | 13.7s | 0.1s | - | - | - |
| Factorio | 3.6s | 9.7s | 0.1s | 2.9s | 9.7s | 14.5s |
| Faxanadu | 2.8s | 6.7s | 0.1s | 2.7s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 3.8s | 10.8s | 0.1s | 2.8s | 10.7s | 10.8s |
| Heretic | 3.1s | 14.7s | 0.1s | 2.8s | 14.7s | 14.7s |
| Hylics 2 | 3.7s | 6.7s | 0.1s | 2.7s | 6.6s | 6.7s |
| Inscryption | 3.0s | 6.8s | 0.1s | 3.0s | 6.8s | 6.8s |
| Kingdom Hearts | 9.0s | 27.8s | 0.1s | 2.5s | - | - |
| Kingdom Hearts 2 | 5.7s | 42.8s | 0.7s | 2.8s | - | - |
| Kirby's Dream Land 3 | 4.2s | 56.4s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.8s | 17.7s | 8.7s |
| Links Awakening DX | 9.6s | 16.8s | 0.1s | 3.3s | 17.8s | 17.8s |
| Lufia II Ancient Cave | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 9.8s | 0.1s | 3.0s | 20.7s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.8s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.7s |
| MegaMan Battle Network 3 | 3.3s | 8.8s | 0.1s | 3.1s | 17.8s | 8.8s |
| Meritous | 3.1s | 5.8s | 0.1s | 3.0s | 5.8s | 14.6s |
| Metamath | 10.0s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Muse Dash | 2.7s | 7.5s | 0.1s | 2.4s | - | - |
| Noita | 2.8s | 5.7s | 0.1s | 2.7s | 5.6s | 5.7s |
| Old School Runescape | 4.5s | 8.7s | 0.1s | 3.0s | 8.7s | 8.8s |
| Overcooked! 2 | 3.1s | 21.8s | 0.1s | 2.6s | - | - |
| Paint | 2.8s | 7.7s | 0.1s | 2.9s | 6.7s | 6.8s |
| Risk of Rain 2 | 2.8s | 6.7s | 0.1s | 2.6s | - | - |
| Saving Princess | 2.8s | 5.6s | 0.1s | 2.7s | 6.6s | 5.6s |
| Shivers | 3.4s | 9.8s | 0.1s | 3.0s | 9.8s | 14.6s |
| Sonic Adventure 2 Battle | 3.5s | 13.8s | 0.1s | 3.1s | 16.9s | 13.8s |
| Starcraft 2 | 6.3s | 27.8s | 0.1s | 3.3s | 14.6s | 18.2s |
| Stardew Valley | 5.2s | 73.5s | 0.3s | 2.5s | - | - |
| Subnautica | 26.7s | 14.7s | 0.1s | 2.6s | - | - |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 2.9s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.7s | 0.1s | 2.6s | - | - |
| Super Mario World | 4.2s | 6.7s | 0.1s | - | - | - |
| Super Metroid | 11.3s | 10.7s | 0.1s | 2.9s | 12.7s | 64.8s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| TOEM rule builder | 3.0s | 9.8s | 0.1s | 3.0s | 9.8s | 9.8s |
| Terraria | 3.2s | 21.0s | 0.1s | 2.8s | - | - |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.0s | 12.7s | 0.1s | 2.4s | - | - |
| The Wind Waker | 15.8s | 9.8s | 0.1s | 2.8s | 9.7s | 9.7s |
| Timespinner | 3.5s | 7.7s | 0.1s | 2.7s | - | - |
| Undertale | 3.0s | 5.6s | 0.1s | - | - | - |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.9s | 5.8s | 5.7s |
| Wargroove | 2.7s | 6.6s | 0.1s | 2.7s | 6.7s | 6.7s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| Yacht Dice | 3.6s | 8.8s | 0.1s | 2.8s | - | - |
| Yoshi's Island | 4.0s | 9.8s | 0.1s | 3.1s | 8.8s | 8.8s |
| shapez | 4.2s | 6.6s | 0.1s | 2.5s | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.7s |
| 2 | The Wind Waker | 15.8s |
| 3 | Bomb Rush Cyberfunk | 12.1s |
| 4 | Super Metroid | 11.3s |
| 5 | A Link to the Past | 10.2s |
| 6 | Metamath | 10.0s |
| 7 | Links Awakening DX | 9.6s |
| 8 | Kingdom Hearts | 9.0s |
| 9 | Aquaria | 7.0s |
| 10 | Starcraft 2 | 6.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 73.5s |
| 2 | Kirby's Dream Land 3 | 56.4s |
| 3 | Kingdom Hearts 2 | 42.8s |
| 4 | Kingdom Hearts | 27.8s |
| 5 | Starcraft 2 | 27.8s |
| 6 | Bomb Rush Cyberfunk | 25.7s |
| 7 | Dark Souls III | 24.6s |
| 8 | A Link to the Past | 24.3s |
| 9 | Overcooked! 2 | 21.8s |
| 10 | Terraria | 21.0s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.7s |
| 2 | Stardew Valley | 0.3s |
| 3 | Bomb Rush Cyberfunk | 0.2s |
| 4 | Starcraft 2 | 0.1s |
| 5 | Yoshi's Island | 0.1s |
| 6 | The Wind Waker | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Link to the Past | 0.1s |
| 9 | A Short Hike | 0.1s |
| 10 | Aquaria | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.8s |
| 2 | Starcraft 2 | 3.3s |
| 3 | Links Awakening DX | 3.3s |
| 4 | DOOM 1993 | 3.1s |
| 5 | MegaMan Battle Network 3 | 3.1s |
| 6 | Sonic Adventure 2 Battle | 3.1s |
| 7 | Yoshi's Island | 3.1s |
| 8 | Mario & Luigi Superstar Saga | 3.0s |
| 9 | Meritous | 3.0s |
| 10 | Shivers | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Mario & Luigi Superstar Saga | 20.7s |
| 2 | MegaMan Battle Network 3 | 17.8s |
| 3 | Links Awakening DX | 17.8s |
| 4 | Landstalker - The Treasures of King Nole | 17.7s |
| 5 | Sonic Adventure 2 Battle | 16.9s |
| 6 | Celeste (Open World) | 14.8s |
| 7 | DOOM II | 14.7s |
| 8 | Heretic | 14.7s |
| 9 | Starcraft 2 | 14.6s |
| 10 | DOOM 1993 | 12.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 64.8s |
| 2 | Starcraft 2 | 18.2s |
| 3 | Links Awakening DX | 17.8s |
| 4 | DOOM II | 15.7s |
| 5 | Celeste (Open World) | 14.8s |
| 6 | Heretic | 14.7s |
| 7 | Shivers | 14.6s |
| 8 | Meritous | 14.6s |
| 9 | Factorio | 14.5s |
| 10 | Aquaria | 14.4s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Total | 309.5s | 886.8s | 6.6s | 176.0s | 469.2s | 566.9s |
| Average | 4.5s | 12.9s | 0.1s | 2.8s | 10.7s | 12.9s |
| Max | 24.3s | 71.7s | 0.6s | 3.8s | 52.3s | 65.6s |
| Min | 2.7s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (24.3s) | Stardew Valley (71.7s) | Kingdom Hearts 2 (0.6s) | Celeste (Open World) (3.8s) | Starcraft 2 (52.3s) | Super Metroid (65.6s) |
| Fastest | Noita (2.7s) | Meritous (5.5s) | Noita (0.1s) | Subnautica (2.5s) | Noita (5.5s) | Noita (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 4.5s | 17.9s | 0.1s | 2.5s | - | - |
| A Link to the Past | 10.1s | 19.4s | 0.1s | - | - | - |
| A Short Hike | 3.0s | 12.4s | 0.1s | 2.9s | 9.7s | 9.7s |
| APQuest | 2.9s | 13.4s | 0.1s | 2.7s | 5.6s | 5.6s |
| Adventure | 3.0s | 6.8s | 0.1s | 2.9s | 5.7s | 14.3s |
| Aquaria | 7.3s | 12.1s | 0.1s | 2.8s | 7.7s | 14.4s |
| Bomb Rush Cyberfunk | 10.8s | 26.9s | 0.1s | 2.7s | - | - |
| Bumper Stickers | 2.9s | 10.5s | 0.1s | 2.6s | 8.5s | 14.0s |
| Castlevania - Circle of the Moon | 3.1s | 9.3s | 0.1s | 2.6s | - | - |
| Castlevania 64 | 3.0s | 7.8s | 0.1s | 2.5s | - | - |
| Celeste (Open World) | 3.9s | 14.6s | 0.1s | 3.8s | 14.6s | 14.3s |
| Celeste 64 | 2.8s | 6.8s | 0.1s | 2.8s | 7.7s | 14.3s |
| ChecksFinder | 2.7s | 6.6s | 0.1s | 2.8s | 6.7s | 14.3s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 14.2s |
| Choo-Choo Charles | 3.0s | 10.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s | 14.5s |
| DLCQuest | 3.3s | 5.7s | 0.1s | 2.7s | - | - |
| DOOM 1993 | 2.9s | 12.6s | 0.1s | 2.8s | 12.6s | 14.1s |
| DOOM II | 3.1s | 15.8s | 0.1s | 2.9s | 15.7s | 14.3s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 2.5s | - | - |
| Donkey Kong Country 3 | 2.9s | 14.6s | 0.1s | - | - | - |
| Factorio | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s | 14.3s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.9s | 8.7s | 14.4s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 2.9s | 10.7s | 10.7s |
| Heretic | 3.3s | 14.9s | 0.1s | 3.1s | 15.8s | 14.6s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 2.8s | 6.6s | 6.7s |
| Inscryption | 3.2s | 6.7s | 0.1s | 3.0s | 6.8s | 6.7s |
| Kingdom Hearts | 9.0s | 28.8s | 0.1s | 2.6s | - | - |
| Kingdom Hearts 2 | 5.0s | 42.8s | 0.6s | 2.5s | - | - |
| Kirby's Dream Land 3 | 4.5s | 55.0s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.5s | 0.1s | 2.8s | 18.6s | 14.0s |
| Links Awakening DX | 9.5s | 16.8s | 0.1s | 3.3s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 2.7s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 9.7s | 0.1s | 2.9s | 20.8s | 9.7s |
| MathProof2p2e4 | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s | 14.3s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.4s | 8.7s | 0.1s | 3.0s | 17.3s | 17.4s |
| Meritous | 2.7s | 5.5s | 0.1s | 2.7s | 5.5s | 14.0s |
| Metamath | 11.4s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Muse Dash | 2.9s | 7.7s | 0.1s | 2.6s | - | - |
| Noita | 2.7s | 5.5s | 0.1s | 2.6s | 5.5s | 5.5s |
| Old School Runescape | 4.4s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| Overcooked! 2 | 3.0s | 20.8s | 0.1s | 2.8s | - | - |
| Paint | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s | 6.7s |
| Risk of Rain 2 | 3.1s | 6.7s | 0.1s | 2.7s | - | - |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s | 14.3s |
| Shivers | 3.4s | 9.6s | 0.1s | 2.9s | 9.6s | 14.1s |
| Sonic Adventure 2 Battle | 3.0s | 13.6s | 0.1s | 2.9s | 16.6s | 14.1s |
| Starcraft 2 | 6.3s | 28.8s | 0.1s | 3.3s | 52.3s | 18.1s |
| Stardew Valley | 5.7s | 71.7s | 0.4s | 3.2s | - | - |
| Subnautica | 24.3s | 15.6s | 0.1s | 2.5s | - | - |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.9s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.8s | 7.7s | 0.1s | 2.6s | - | - |
| Super Mario World | 3.9s | 6.6s | 0.1s | - | - | - |
| Super Metroid | 11.7s | 10.8s | 0.1s | 3.0s | 12.7s | 65.6s |
| TOEM original | 2.8s | 8.7s | 0.1s | 3.0s | 9.7s | 8.7s |
| TOEM rule builder | 3.1s | 9.7s | 0.1s | 2.7s | 9.6s | 9.7s |
| Terraria | 2.7s | 20.6s | 0.1s | 2.5s | - | - |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.6s | - | - |
| The Wind Waker | 14.3s | 9.5s | 0.1s | 2.8s | 9.6s | 14.0s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.5s | - | - |
| Undertale | 2.9s | 5.7s | 0.1s | - | - | - |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Wargroove | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.7s | 8.6s | 14.3s |
| Yacht Dice | 3.7s | 9.7s | 0.1s | 2.7s | - | - |
| Yoshi's Island | 3.4s | 9.5s | 0.1s | 2.8s | 8.5s | 8.5s |
| shapez | 4.2s | 6.7s | 0.1s | 2.5s | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 24.3s |
| 2 | The Wind Waker | 14.3s |
| 3 | Super Metroid | 11.7s |
| 4 | Metamath | 11.4s |
| 5 | Bomb Rush Cyberfunk | 10.8s |
| 6 | A Link to the Past | 10.1s |
| 7 | Links Awakening DX | 9.5s |
| 8 | Kingdom Hearts | 9.0s |
| 9 | Aquaria | 7.3s |
| 10 | Starcraft 2 | 6.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.7s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 42.8s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Starcraft 2 | 28.8s |
| 6 | Bomb Rush Cyberfunk | 26.9s |
| 7 | Dark Souls III | 24.8s |
| 8 | Overcooked! 2 | 20.8s |
| 9 | Terraria | 20.6s |
| 10 | A Link to the Past | 19.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.6s |
| 2 | Stardew Valley | 0.4s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Link to the Past | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | The Wind Waker | 0.1s |
| 8 | Yoshi's Island | 0.1s |
| 9 | A Hat in Time | 0.1s |
| 10 | Adventure | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.8s |
| 2 | Links Awakening DX | 3.3s |
| 3 | Starcraft 2 | 3.3s |
| 4 | Stardew Valley | 3.2s |
| 5 | Heretic | 3.1s |
| 6 | MegaMan Battle Network 3 | 3.0s |
| 7 | TOEM original | 3.0s |
| 8 | Inscryption | 3.0s |
| 9 | Choo-Choo Charles | 3.0s |
| 10 | Super Metroid | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Starcraft 2 | 52.3s |
| 2 | Mario & Luigi Superstar Saga | 20.8s |
| 3 | Landstalker - The Treasures of King Nole | 18.6s |
| 4 | MegaMan Battle Network 3 | 17.3s |
| 5 | Links Awakening DX | 16.8s |
| 6 | Sonic Adventure 2 Battle | 16.6s |
| 7 | Heretic | 15.8s |
| 8 | DOOM II | 15.7s |
| 9 | Celeste (Open World) | 14.6s |
| 10 | Super Metroid | 12.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 65.6s |
| 2 | Starcraft 2 | 18.1s |
| 3 | MegaMan Battle Network 3 | 17.4s |
| 4 | Links Awakening DX | 16.8s |
| 5 | Heretic | 14.6s |
| 6 | Civilization VI | 14.5s |
| 7 | Aquaria | 14.4s |
| 8 | Faxanadu | 14.4s |
| 9 | Adventure | 14.3s |
| 10 | DOOM II | 14.3s |
