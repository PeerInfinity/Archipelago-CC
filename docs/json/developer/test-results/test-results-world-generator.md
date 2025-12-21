# World Generator Test Results

**Generated:** 2025-12-21 23:29:56 UTC
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
| Test Seed Generation | 37 | 32 | 69 |
| Test Spoiler Test | 37 | 0 | 37 |
| Cross-Validation | 22 | 14 | 36 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ❌ | - | - |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Inscryption | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Meritous | ✅ | ✅ | ✅ | ❌ | - | - |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ❌ | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Test Seed Generation | 38 | 31 | 69 |
| Test Spoiler Test | 38 | 0 | 38 |
| Cross-Validation | 10 | 27 | 37 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ❌ | - | - |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Inscryption | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Meritous | ✅ | ✅ | ✅ | ❌ | - | - |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ❌ | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yacht Dice | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 317.6s | 889.4s | 6.7s | 174.4s | 366.1s |
| Average | 4.6s | 12.9s | 0.1s | 2.8s | 9.9s |
| Max | 27.1s | 74.8s | 0.6s | 4.0s | 19.8s |
| Min | 2.7s | 5.6s | 0.1s | 2.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (27.1s) | Stardew Valley (74.8s) | Kingdom Hearts 2 (0.6s) | Celeste (Open World) (4.0s) | Overcooked! 2 (19.8s) |
| Fastest | ChecksFinder (2.7s) | Meritous (5.6s) | Yacht Dice (0.1s) | Inscryption (2.5s) | Adventure (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.9s | 14.9s | 0.1s | 2.7s | - |
| A Link to the Past | 10.1s | 19.8s | 0.1s | - | - |
| A Short Hike | 3.0s | 13.0s | 0.1s | 2.7s | 9.7s |
| APQuest | 3.0s | 9.5s | 0.1s | 2.6s | - |
| Adventure | 3.0s | 7.7s | 0.1s | 2.7s | 5.6s |
| Aquaria | 7.1s | 9.6s | 0.1s | 2.8s | 7.7s |
| Bomb Rush Cyberfunk | 11.3s | 23.2s | 0.1s | 2.9s | 19.8s |
| Bumper Stickers | 3.0s | 9.8s | 0.1s | 2.8s | 8.6s |
| Castlevania - Circle of the Moon | 3.1s | 10.4s | 0.1s | 2.6s | - |
| Castlevania 64 | 3.2s | 14.6s | 0.1s | 2.7s | - |
| Celeste (Open World) | 4.2s | 14.8s | 0.1s | 4.0s | 14.8s |
| Celeste 64 | 2.9s | 6.8s | 0.1s | 3.0s | 7.8s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.7s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.8s | 5.7s |
| Choo-Choo Charles | 2.9s | 9.8s | 0.1s | 2.8s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.6s | - |
| DLCQuest | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.2s | 15.8s | 0.1s | 2.9s | 14.7s |
| Dark Souls III | 5.1s | 25.9s | 0.1s | 2.8s | - |
| Donkey Kong Country 3 | 3.1s | 14.9s | 0.1s | - | - |
| Factorio | 3.6s | 9.7s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 2.8s | 6.7s | 0.1s | 2.5s | - |
| Final Fantasy Mystic Quest | 3.9s | 10.7s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.3s | 14.9s | 0.1s | 2.9s | 14.7s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.8s | 6.7s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.5s | - |
| Kingdom Hearts | 8.9s | 29.0s | 0.1s | 2.6s | - |
| Kingdom Hearts 2 | 5.3s | 41.9s | 0.6s | 2.6s | - |
| Kirby's Dream Land 3 | 4.9s | 57.7s | 0.1s | - | - |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 3.0s | 17.8s |
| Links Awakening DX | 9.7s | 16.8s | 0.1s | 3.5s | 17.8s |
| Lufia II Ancient Cave | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 9.7s | 0.1s | 2.9s | 9.7s |
| MathProof2p2e4 | 2.9s | 5.6s | 0.1s | 2.7s | 5.6s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.6s | - |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.6s | - |
| Meritous | 2.9s | 5.6s | 0.1s | 2.6s | - |
| Metamath | 10.7s | 5.7s | 0.1s | 2.6s | - |
| Muse Dash | 3.2s | 7.8s | 0.1s | 2.8s | - |
| Noita | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Old School Runescape | 4.5s | 8.7s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 3.1s | 21.8s | 0.1s | 2.8s | 19.8s |
| Paint | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s |
| Risk of Rain 2 | 3.0s | 6.6s | 0.1s | 2.7s | 6.6s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s |
| Shivers | 3.3s | 9.7s | 0.1s | 2.6s | - |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.9s | 16.7s |
| Starcraft 2 | 6.3s | 28.9s | 0.1s | 2.6s | - |
| Stardew Valley | 5.8s | 74.8s | 0.3s | 2.8s | - |
| Subnautica | 27.1s | 14.8s | 0.1s | 2.8s | 9.7s |
| Super Mario 64 | 2.9s | 12.8s | 0.1s | 2.6s | - |
| Super Mario Land 2 | 3.8s | 7.8s | 0.1s | 2.5s | - |
| Super Mario World | 4.1s | 6.7s | 0.1s | - | - |
| Super Metroid | 11.4s | 10.7s | 0.1s | 2.8s | 11.7s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.8s | 9.7s |
| TOEM rule builder | 2.8s | 9.7s | 0.1s | 2.9s | 9.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.6s | - |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | - | - |
| The Messenger | 3.6s | 12.9s | 0.1s | 2.7s | - |
| The Wind Waker | 16.2s | 9.7s | 0.1s | 2.6s | - |
| Timespinner | 3.4s | 7.7s | 0.1s | 2.6s | - |
| Undertale | 2.9s | 5.7s | 0.1s | - | - |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Wargroove | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.9s | 8.7s |
| Yacht Dice | 3.5s | 8.8s | 0.1s | 2.8s | 5.7s |
| Yoshi's Island | 3.6s | 9.7s | 0.1s | 2.6s | - |
| shapez | 4.4s | 6.7s | 0.1s | 2.6s | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.1s |
| 2 | The Wind Waker | 16.2s |
| 3 | Super Metroid | 11.4s |
| 4 | Bomb Rush Cyberfunk | 11.3s |
| 5 | Metamath | 10.7s |
| 6 | A Link to the Past | 10.1s |
| 7 | Links Awakening DX | 9.7s |
| 8 | Kingdom Hearts | 8.9s |
| 9 | Aquaria | 7.1s |
| 10 | Starcraft 2 | 6.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 74.8s |
| 2 | Kirby's Dream Land 3 | 57.7s |
| 3 | Kingdom Hearts 2 | 41.9s |
| 4 | Kingdom Hearts | 29.0s |
| 5 | Starcraft 2 | 28.9s |
| 6 | Dark Souls III | 25.9s |
| 7 | Bomb Rush Cyberfunk | 23.2s |
| 8 | Overcooked! 2 | 21.8s |
| 9 | Terraria | 20.8s |
| 10 | A Link to the Past | 19.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.6s |
| 2 | Stardew Valley | 0.3s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | The Wind Waker | 0.1s |
| 6 | Yoshi's Island | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Link to the Past | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 4.0s |
| 2 | Links Awakening DX | 3.5s |
| 3 | Celeste 64 | 3.0s |
| 4 | Landstalker - The Treasures of King Nole | 3.0s |
| 5 | Final Fantasy Mystic Quest | 3.0s |
| 6 | Sonic Adventure 2 Battle | 2.9s |
| 7 | DOOM II | 2.9s |
| 8 | Mario & Luigi Superstar Saga | 2.9s |
| 9 | Noita | 2.9s |
| 10 | DLCQuest | 2.9s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 19.8s |
| 2 | Bomb Rush Cyberfunk | 19.8s |
| 3 | Links Awakening DX | 17.8s |
| 4 | Landstalker - The Treasures of King Nole | 17.8s |
| 5 | Sonic Adventure 2 Battle | 16.7s |
| 6 | Celeste (Open World) | 14.8s |
| 7 | DOOM II | 14.7s |
| 8 | Heretic | 14.7s |
| 9 | DOOM 1993 | 12.7s |
| 10 | Super Metroid | 11.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 312.1s | 889.0s | 6.7s | 175.1s | 381.5s |
| Average | 4.5s | 12.9s | 0.1s | 2.8s | 10.0s |
| Max | 26.5s | 72.7s | 0.6s | 3.9s | 19.8s |
| Min | 2.7s | 5.6s | 0.1s | 2.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.5s) | Stardew Valley (72.7s) | Kingdom Hearts 2 (0.6s) | Celeste (Open World) (3.9s) | Overcooked! 2 (19.8s) |
| Fastest | Noita (2.7s) | Metamath (5.6s) | Yacht Dice (0.1s) | Starcraft 2 (2.5s) | Noita (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.7s | 15.4s | 0.1s | 2.8s | 13.7s |
| A Link to the Past | 9.9s | 23.4s | 0.1s | - | - |
| A Short Hike | 3.1s | 13.9s | 0.1s | 2.8s | 9.7s |
| APQuest | 2.9s | 7.6s | 0.1s | 2.8s | - |
| Adventure | 3.1s | 9.8s | 0.1s | 2.8s | 5.7s |
| Aquaria | 6.9s | 11.7s | 0.1s | 2.9s | 8.8s |
| Bomb Rush Cyberfunk | 11.6s | 24.8s | 0.1s | 3.0s | 18.7s |
| Bumper Stickers | 3.0s | 14.6s | 0.1s | 2.8s | 8.6s |
| Castlevania - Circle of the Moon | 2.9s | 6.9s | 0.1s | 2.5s | - |
| Castlevania 64 | 3.2s | 10.5s | 0.1s | 2.6s | - |
| Celeste (Open World) | 3.9s | 14.8s | 0.1s | 3.9s | 14.8s |
| Celeste 64 | 2.8s | 6.8s | 0.1s | 2.7s | 7.6s |
| ChecksFinder | 2.7s | 6.6s | 0.1s | 2.7s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 3.0s | 10.8s | 0.1s | 3.0s | 10.7s |
| Civilization VI | 2.8s | 8.7s | 0.1s | 2.7s | - |
| DLCQuest | 3.0s | 5.6s | 0.1s | 2.9s | 5.7s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.9s | 12.7s |
| DOOM II | 3.1s | 14.8s | 0.1s | 2.8s | 15.7s |
| Dark Souls III | 4.9s | 24.8s | 0.1s | 2.7s | - |
| Donkey Kong Country 3 | 2.9s | 13.7s | 0.1s | - | - |
| Factorio | 3.4s | 9.7s | 0.1s | 2.7s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.6s | - |
| Final Fantasy Mystic Quest | 3.8s | 10.8s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.3s | 15.9s | 0.1s | 3.1s | 15.8s |
| Hylics 2 | 3.7s | 6.7s | 0.1s | 2.9s | 6.7s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.6s | - |
| Kingdom Hearts | 8.8s | 27.9s | 0.1s | 2.5s | - |
| Kingdom Hearts 2 | 5.5s | 41.9s | 0.6s | 2.6s | - |
| Kirby's Dream Land 3 | 4.8s | 55.6s | 0.1s | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.9s | 17.7s |
| Links Awakening DX | 9.4s | 16.7s | 0.1s | 3.3s | 16.7s |
| Lufia II Ancient Cave | 2.8s | 5.6s | 0.1s | 2.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 9.7s | 0.1s | 3.0s | 9.7s |
| MathProof2p2e4 | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.7s | - |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.6s | - |
| Meritous | 2.9s | 5.6s | 0.1s | 2.6s | - |
| Metamath | 9.6s | 5.6s | 0.1s | 2.5s | - |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.7s | - |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Old School Runescape | 4.5s | 8.8s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 3.1s | 21.8s | 0.1s | 2.8s | 19.8s |
| Paint | 2.8s | 6.8s | 0.1s | 2.9s | 6.7s |
| Risk of Rain 2 | 3.0s | 7.7s | 0.1s | 2.9s | 6.7s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.9s | 6.7s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.6s | - |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.9s | 16.7s |
| Starcraft 2 | 6.1s | 28.8s | 0.1s | 2.5s | - |
| Stardew Valley | 5.6s | 72.7s | 0.3s | 3.2s | - |
| Subnautica | 26.5s | 14.7s | 0.1s | 2.7s | 9.7s |
| Super Mario 64 | 2.8s | 12.7s | 0.1s | 2.5s | - |
| Super Mario Land 2 | 3.9s | 7.8s | 0.1s | 2.6s | - |
| Super Mario World | 4.0s | 6.8s | 0.1s | - | - |
| Super Metroid | 11.6s | 10.7s | 0.1s | 2.9s | 12.7s |
| TOEM original | 3.0s | 9.8s | 0.1s | 2.9s | 9.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s |
| Terraria | 2.9s | 19.7s | 0.1s | 2.7s | - |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | - | - |
| The Messenger | 3.3s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 15.5s | 9.8s | 0.1s | 2.6s | - |
| Timespinner | 3.2s | 7.7s | 0.1s | 2.5s | - |
| Undertale | 2.9s | 5.6s | 0.1s | - | - |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Wargroove | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s |
| WebDevJourney | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s |
| Yacht Dice | 3.5s | 8.7s | 0.1s | 2.8s | 5.7s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.6s | - |
| shapez | 4.1s | 6.6s | 0.1s | 2.5s | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.5s |
| 2 | The Wind Waker | 15.5s |
| 3 | Super Metroid | 11.6s |
| 4 | Bomb Rush Cyberfunk | 11.6s |
| 5 | A Link to the Past | 9.9s |
| 6 | Metamath | 9.6s |
| 7 | Links Awakening DX | 9.4s |
| 8 | Kingdom Hearts | 8.8s |
| 9 | Aquaria | 6.9s |
| 10 | Starcraft 2 | 6.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 72.7s |
| 2 | Kirby's Dream Land 3 | 55.6s |
| 3 | Kingdom Hearts 2 | 41.9s |
| 4 | Starcraft 2 | 28.8s |
| 5 | Kingdom Hearts | 27.9s |
| 6 | Bomb Rush Cyberfunk | 24.8s |
| 7 | Dark Souls III | 24.8s |
| 8 | A Link to the Past | 23.4s |
| 9 | Overcooked! 2 | 21.8s |
| 10 | Terraria | 19.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.6s |
| 2 | Stardew Valley | 0.3s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | The Wind Waker | 0.1s |
| 6 | Yoshi's Island | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Link to the Past | 0.1s |
| 9 | A Short Hike | 0.1s |
| 10 | Aquaria | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.9s |
| 2 | Links Awakening DX | 3.3s |
| 3 | Stardew Valley | 3.2s |
| 4 | Heretic | 3.1s |
| 5 | Final Fantasy Mystic Quest | 3.0s |
| 6 | Mario & Luigi Superstar Saga | 3.0s |
| 7 | Bomb Rush Cyberfunk | 3.0s |
| 8 | Choo-Choo Charles | 3.0s |
| 9 | Super Metroid | 2.9s |
| 10 | TOEM original | 2.9s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 19.8s |
| 2 | Bomb Rush Cyberfunk | 18.7s |
| 3 | Landstalker - The Treasures of King Nole | 17.7s |
| 4 | Links Awakening DX | 16.7s |
| 5 | Sonic Adventure 2 Battle | 16.7s |
| 6 | Heretic | 15.8s |
| 7 | DOOM II | 15.7s |
| 8 | Celeste (Open World) | 14.8s |
| 9 | A Hat in Time | 13.7s |
| 10 | Super Metroid | 12.7s |
