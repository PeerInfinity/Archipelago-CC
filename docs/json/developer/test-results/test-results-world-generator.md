# World Generator Test Results

**Generated:** 2025-12-18 20:36:03 UTC
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
| Test World Generation | 69 | 0 | 69 |
| Test Seed Generation | 64 | 5 | 69 |
| Test Spoiler Test | 57 | 7 | 64 |
| Cross-Validation | 40 | 24 | 64 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 69

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 69 | 0 | 69 |
| Original Spoiler Test | 69 | 0 | 69 |
| Test World Generation | 69 | 0 | 69 |
| Test Seed Generation | 64 | 5 | 69 |
| Test Spoiler Test | 57 | 7 | 64 |
| Cross-Validation | 19 | 45 | 64 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 324.9s | 878.7s | 6.1s | 206.9s | 746.0s |
| Average | 4.7s | 12.7s | 0.1s | 3.0s | 11.7s |
| Max | 26.6s | 77.7s | 0.2s | 3.9s | 55.5s |
| Min | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.6s) | Stardew Valley (77.7s) | Kingdom Hearts 2 (0.2s) | Mario & Luigi Superstar Saga (3.9s) | Kirby's Dream Land 3 (55.5s) |
| Fastest | ChecksFinder (2.7s) | Undertale (5.6s) | shapez (0.1s) | Super Mario Land 2 (2.6s) | Castlevania - Circle of the Moon (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.7s | 14.9s | 0.1s | 2.8s | 17.5s |
| A Link to the Past | 10.6s | 22.6s | 0.2s | 3.6s | 23.1s |
| A Short Hike | 3.0s | 10.3s | 0.1s | 2.8s | 9.7s |
| APQuest | 3.8s | 6.4s | 0.1s | 3.4s | 5.9s |
| Adventure | 3.0s | 6.9s | 0.1s | 2.9s | 5.7s |
| Aquaria | 7.3s | 8.9s | 0.1s | 2.9s | 7.7s |
| Bomb Rush Cyberfunk | 11.8s | 22.6s | 0.1s | 3.1s | 30.1s |
| Bumper Stickers | 2.9s | 10.7s | 0.1s | 2.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.1s | 7.9s | 0.1s | 2.7s | 5.6s |
| Castlevania 64 | 3.1s | 7.8s | 0.1s | 2.8s | 6.7s |
| Celeste (Open World) | 3.9s | 13.7s | 0.1s | 3.7s | 14.7s |
| Celeste 64 | 3.1s | 6.9s | 0.1s | 3.0s | 7.8s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.8s | 6.7s |
| ChocolateChipCookies | 3.5s | 5.9s | 0.1s | 3.6s | 5.9s |
| Choo-Choo Charles | 3.0s | 9.9s | 0.1s | 3.0s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.9s | 8.7s |
| DLCQuest | 3.3s | 5.7s | 0.1s | 3.1s | 5.8s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.2s | 15.8s | 0.1s | 2.9s | 14.8s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 3.2s | 24.8s |
| Donkey Kong Country 3 | 2.9s | 13.7s | 0.1s | 2.8s | 13.7s |
| Factorio | 3.6s | 9.8s | 0.1s | 3.1s | 9.8s |
| Faxanadu | 2.8s | 6.7s | 0.1s | 2.8s | 8.7s |
| Final Fantasy Mystic Quest | 4.9s | 11.1s | 0.1s | 3.6s | 11.0s |
| Heretic | 3.2s | 15.9s | 0.1s | 3.0s | 14.8s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.8s | 14.4s |
| Inscryption | 3.1s | 6.8s | 0.1s | 3.0s | 6.7s |
| Kingdom Hearts | 8.8s | 28.8s | 0.1s | 2.9s | 23.8s |
| Kingdom Hearts 2 | 5.2s | 41.9s | 0.2s | 3.4s | 14.7s |
| Kirby's Dream Land 3 | 4.6s | 56.0s | 0.1s | 3.2s | 55.5s |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.8s | 17.7s |
| Links Awakening DX | 10.0s | 17.9s | 0.1s | 3.4s | 17.9s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.8s | 5.7s |
| Mario & Luigi Superstar Saga | 4.6s | 9.9s | 0.1s | 3.9s | 10.1s |
| MathProof2p2e4 | 2.9s | 5.9s | 0.1s | 2.9s | 5.7s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s |
| MegaMan Battle Network 3 | 3.2s | 8.8s | 0.1s | 3.1s | 8.8s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.7s | 5.7s |
| Metamath | 10.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Old School Runescape | 4.6s | 8.8s | 0.1s | 3.0s | 8.8s |
| Overcooked! 2 | 2.9s | 20.8s | 0.1s | 3.0s | 19.8s |
| Paint | 3.5s | 8.0s | 0.1s | 3.9s | 8.1s |
| Risk of Rain 2 | 3.0s | 6.8s | 0.1s | 2.9s | 6.7s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s |
| Shivers | 3.4s | 9.8s | 0.1s | 3.0s | 9.9s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.4s | 28.8s | 0.1s | 3.4s | 14.8s |
| Stardew Valley | 5.6s | 77.7s | 0.2s | 2.7s | - |
| Subnautica | 26.6s | 14.7s | 0.1s | 3.2s | 14.6s |
| Super Mario 64 | 3.2s | 12.8s | 0.1s | 3.0s | 12.8s |
| Super Mario Land 2 | 3.8s | 7.7s | 0.1s | 2.6s | - |
| Super Mario World | 5.2s | 7.0s | 0.1s | 3.6s | 7.0s |
| Super Metroid | 12.1s | 10.8s | 0.1s | 3.0s | 12.8s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s |
| TOEM rule builder | 2.9s | 9.8s | 0.1s | 2.9s | 9.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.9s | 19.8s |
| The Legend of Zelda | 4.7s | 8.7s | 0.1s | 2.8s | 10.7s |
| The Messenger | 3.3s | 12.8s | 0.1s | 2.7s | - |
| The Wind Waker | 16.5s | 9.7s | 0.1s | 2.8s | 14.4s |
| Timespinner | 3.5s | 7.8s | 0.1s | 2.9s | 6.7s |
| Undertale | 3.0s | 5.6s | 0.1s | 2.9s | 5.7s |
| VVVVVV | 3.6s | 6.0s | 0.1s | 3.7s | 6.0s |
| Wargroove | 3.1s | 6.7s | 0.1s | 2.9s | 6.7s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s |
| Yacht Dice | 3.6s | 8.8s | 0.1s | 2.7s | - |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 8.7s |
| shapez | 4.2s | 6.7s | 0.1s | 2.8s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.6s |
| 2 | The Wind Waker | 16.5s |
| 3 | Super Metroid | 12.1s |
| 4 | Bomb Rush Cyberfunk | 11.8s |
| 5 | Metamath | 10.7s |
| 6 | A Link to the Past | 10.6s |
| 7 | Links Awakening DX | 10.0s |
| 8 | Kingdom Hearts | 8.8s |
| 9 | Aquaria | 7.3s |
| 10 | Starcraft 2 | 6.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 77.7s |
| 2 | Kirby's Dream Land 3 | 56.0s |
| 3 | Kingdom Hearts 2 | 41.9s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Starcraft 2 | 28.8s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 22.6s |
| 8 | A Link to the Past | 22.6s |
| 9 | Terraria | 20.8s |
| 10 | Overcooked! 2 | 20.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.2s |
| 4 | Bomb Rush Cyberfunk | 0.1s |
| 5 | Starcraft 2 | 0.1s |
| 6 | A Hat in Time | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Aquaria | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Final Fantasy Mystic Quest | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Mario & Luigi Superstar Saga | 3.9s |
| 2 | Paint | 3.9s |
| 3 | Celeste (Open World) | 3.7s |
| 4 | VVVVVV | 3.7s |
| 5 | A Link to the Past | 3.6s |
| 6 | Final Fantasy Mystic Quest | 3.6s |
| 7 | Super Mario World | 3.6s |
| 8 | ChocolateChipCookies | 3.6s |
| 9 | APQuest | 3.4s |
| 10 | Links Awakening DX | 3.4s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 55.5s |
| 2 | Bomb Rush Cyberfunk | 30.1s |
| 3 | Dark Souls III | 24.8s |
| 4 | Kingdom Hearts | 23.8s |
| 5 | A Link to the Past | 23.1s |
| 6 | Overcooked! 2 | 19.8s |
| 7 | Terraria | 19.8s |
| 8 | Links Awakening DX | 17.9s |
| 9 | Landstalker - The Treasures of King Nole | 17.7s |
| 10 | A Hat in Time | 17.5s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 313.8s | 871.5s | 6.0s | 201.5s | 791.1s |
| Average | 4.5s | 12.6s | 0.1s | 2.9s | 12.4s |
| Max | 26.9s | 77.7s | 0.2s | 4.0s | 63.7s |
| Min | 2.6s | 5.6s | 0.1s | 2.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.9s) | Stardew Valley (77.7s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (4.0s) | Starcraft 2 (63.7s) |
| Fastest | MathProof2p2e4 (2.6s) | MathProof2p2e4 (5.6s) | Yacht Dice (0.1s) | Muse Dash (2.5s) | Adventure (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.8s | 15.2s | 0.1s | 3.0s | 17.5s |
| A Link to the Past | 9.8s | 19.4s | 0.2s | 3.4s | 24.0s |
| A Short Hike | 3.0s | 13.7s | 0.1s | 2.7s | 9.7s |
| APQuest | 3.1s | 6.2s | 0.1s | 2.8s | 5.7s |
| Adventure | 2.8s | 6.0s | 0.1s | 2.7s | 5.6s |
| Aquaria | 7.0s | 8.2s | 0.1s | 2.8s | 7.7s |
| Bomb Rush Cyberfunk | 11.2s | 22.9s | 0.1s | 3.0s | 29.3s |
| Bumper Stickers | 3.0s | 12.3s | 0.1s | 2.8s | 8.7s |
| Castlevania - Circle of the Moon | 3.1s | 6.5s | 0.1s | 2.9s | 5.7s |
| Castlevania 64 | 3.1s | 7.2s | 0.1s | 2.8s | 6.7s |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 4.0s | 14.8s |
| Celeste 64 | 3.0s | 6.6s | 0.1s | 2.7s | 7.6s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.7s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 2.7s | 10.7s | 0.1s | 2.8s | 9.7s |
| Civilization VI | 2.8s | 8.6s | 0.1s | 2.7s | 8.7s |
| DLCQuest | 3.0s | 5.7s | 0.1s | 2.8s | 5.7s |
| DOOM 1993 | 3.1s | 12.7s | 0.1s | 2.9s | 12.7s |
| DOOM II | 3.2s | 15.8s | 0.1s | 3.0s | 15.7s |
| Dark Souls III | 4.7s | 24.8s | 0.1s | 3.1s | 23.7s |
| Donkey Kong Country 3 | 3.0s | 13.7s | 0.1s | 2.9s | 14.8s |
| Factorio | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 2.8s | 6.8s | 0.1s | 2.8s | 8.7s |
| Final Fantasy Mystic Quest | 3.8s | 10.8s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.0s | 14.7s | 0.1s | 3.2s | 15.8s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.7s | 14.4s |
| Inscryption | 2.8s | 6.7s | 0.1s | 2.7s | 6.7s |
| Kingdom Hearts | 9.0s | 29.0s | 0.1s | 3.1s | 23.8s |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.2s | 3.9s | 14.8s |
| Kirby's Dream Land 3 | 4.5s | 54.6s | 0.1s | 3.2s | 55.5s |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 3.0s | 17.8s |
| Links Awakening DX | 9.1s | 16.8s | 0.1s | 3.3s | 16.8s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.8s | 5.6s |
| Mario & Luigi Superstar Saga | 3.8s | 9.8s | 0.1s | 3.1s | 8.7s |
| MathProof2p2e4 | 2.6s | 5.6s | 0.1s | 3.0s | 5.8s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.8s | 7.8s |
| Meritous | 2.9s | 5.6s | 0.1s | 2.9s | 5.7s |
| Metamath | 11.4s | 5.7s | 0.1s | 2.9s | 5.7s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.5s | - |
| Noita | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Old School Runescape | 4.4s | 8.6s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 2.9s | 20.8s | 0.1s | 2.8s | 19.8s |
| Paint | 2.8s | 8.0s | 0.1s | 2.8s | 6.7s |
| Risk of Rain 2 | 2.8s | 6.6s | 0.1s | 3.0s | 6.8s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.7s | 6.7s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.8s | 9.7s |
| Sonic Adventure 2 Battle | 3.3s | 13.7s | 0.1s | 3.0s | 16.8s |
| Starcraft 2 | 6.4s | 28.9s | 0.1s | 3.6s | 63.7s |
| Stardew Valley | 5.4s | 77.7s | 0.2s | 3.5s | - |
| Subnautica | 26.9s | 14.7s | 0.1s | 3.3s | 14.7s |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.8s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.8s | 0.1s | 2.6s | - |
| Super Mario World | 4.2s | 6.7s | 0.1s | 2.9s | 6.8s |
| Super Metroid | 11.3s | 10.7s | 0.1s | 3.1s | 12.8s |
| TOEM original | 2.7s | 8.7s | 0.1s | 2.7s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.8s | 9.7s |
| Terraria | 3.0s | 20.8s | 0.1s | 2.8s | 20.8s |
| The Legend of Zelda | 4.8s | 8.7s | 0.1s | 2.9s | 10.7s |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 16.9s | 9.7s | 0.1s | 3.0s | 14.5s |
| Timespinner | 3.2s | 7.6s | 0.1s | 2.8s | 6.7s |
| Undertale | 3.0s | 5.6s | 0.1s | 2.8s | 5.7s |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.8s | 5.6s |
| Wargroove | 2.8s | 6.6s | 0.1s | 2.9s | 6.7s |
| WebDevJourney | 2.7s | 8.6s | 0.1s | 2.7s | 8.6s |
| Yacht Dice | 3.4s | 8.7s | 0.1s | 2.6s | - |
| Yoshi's Island | 3.6s | 9.7s | 0.1s | 2.9s | 8.7s |
| shapez | 4.3s | 6.7s | 0.1s | 2.8s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.9s |
| 2 | The Wind Waker | 16.9s |
| 3 | Metamath | 11.4s |
| 4 | Super Metroid | 11.3s |
| 5 | Bomb Rush Cyberfunk | 11.2s |
| 6 | A Link to the Past | 9.8s |
| 7 | Links Awakening DX | 9.1s |
| 8 | Kingdom Hearts | 9.0s |
| 9 | Aquaria | 7.0s |
| 10 | Starcraft 2 | 6.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 77.7s |
| 2 | Kirby's Dream Land 3 | 54.6s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Kingdom Hearts | 29.0s |
| 5 | Starcraft 2 | 28.9s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 22.9s |
| 8 | Terraria | 20.8s |
| 9 | Overcooked! 2 | 20.8s |
| 10 | A Link to the Past | 19.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | Stardew Valley | 0.2s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Bomb Rush Cyberfunk | 0.1s |
| 8 | Castlevania - Circle of the Moon | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | Subnautica | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 4.0s |
| 2 | Kingdom Hearts 2 | 3.9s |
| 3 | Starcraft 2 | 3.6s |
| 4 | Stardew Valley | 3.5s |
| 5 | A Link to the Past | 3.4s |
| 6 | Subnautica | 3.3s |
| 7 | Links Awakening DX | 3.3s |
| 8 | Kirby's Dream Land 3 | 3.2s |
| 9 | Heretic | 3.2s |
| 10 | Kingdom Hearts | 3.1s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Starcraft 2 | 63.7s |
| 2 | Kirby's Dream Land 3 | 55.5s |
| 3 | Bomb Rush Cyberfunk | 29.3s |
| 4 | A Link to the Past | 24.0s |
| 5 | Kingdom Hearts | 23.8s |
| 6 | Dark Souls III | 23.7s |
| 7 | Terraria | 20.8s |
| 8 | Overcooked! 2 | 19.8s |
| 9 | Landstalker - The Treasures of King Nole | 17.8s |
| 10 | A Hat in Time | 17.5s |
