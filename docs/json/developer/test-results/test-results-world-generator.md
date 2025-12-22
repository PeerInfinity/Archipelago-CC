# World Generator Test Results

**Generated:** 2025-12-22 03:36:32 UTC
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
| Test Seed Generation | 54 | 15 | 69 |
| Test Spoiler Test | 51 | 3 | 54 |
| Cross-Validation | 41 | 12 | 53 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Yacht Dice | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Test World Generation | 63 | 6 | 69 |
| Test Seed Generation | 55 | 14 | 69 |
| Test Spoiler Test | 52 | 3 | 55 |
| Cross-Validation | 23 | 31 | 54 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
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
| Yacht Dice | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 316.1s | 879.7s | 6.8s | 177.0s | 561.0s |
| Average | 4.6s | 12.7s | 0.1s | 2.8s | 10.4s |
| Max | 26.8s | 74.9s | 0.6s | 3.7s | 44.2s |
| Min | 2.6s | 5.6s | 0.1s | 2.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.8s) | Stardew Valley (74.9s) | Kingdom Hearts 2 (0.6s) | Celeste (Open World) (3.7s) | Starcraft 2 (44.2s) |
| Fastest | TOEM original (2.6s) | Saving Princess (5.6s) | Yacht Dice (0.1s) | Terraria (2.5s) | Yacht Dice (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.7s | 14.8s | 0.1s | 2.6s | - |
| A Link to the Past | 10.3s | 18.4s | 0.1s | - | - |
| A Short Hike | 3.1s | 12.7s | 0.1s | 2.8s | 9.7s |
| APQuest | 3.1s | 6.9s | 0.1s | 2.9s | 5.7s |
| Adventure | 3.0s | 9.0s | 0.1s | 2.8s | 5.7s |
| Aquaria | 6.9s | 9.5s | 0.1s | 2.7s | 7.6s |
| Bomb Rush Cyberfunk | 11.7s | 22.5s | 0.1s | 2.8s | 18.8s |
| Bumper Stickers | 2.9s | 13.2s | 0.1s | 2.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 6.2s | 0.1s | 2.9s | 5.6s |
| Castlevania 64 | 3.2s | 10.5s | 0.1s | 3.1s | 6.9s |
| Celeste (Open World) | 3.9s | 14.8s | 0.1s | 3.7s | 14.8s |
| Celeste 64 | 2.9s | 6.8s | 0.1s | 2.8s | 7.7s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.8s | 6.7s |
| ChocolateChipCookies | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 2.9s | 9.8s | 0.1s | 2.9s | 9.7s |
| Civilization VI | 2.8s | 8.6s | 0.1s | 2.6s | 8.6s |
| DLCQuest | 3.0s | 5.7s | 0.1s | 2.8s | 5.7s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.2s | 15.8s | 0.1s | 2.8s | 14.7s |
| Dark Souls III | 5.0s | 25.9s | 0.1s | 2.7s | - |
| Donkey Kong Country 3 | 2.9s | 14.8s | 0.1s | - | - |
| Factorio | 3.6s | 9.7s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 2.8s | 6.7s | 0.1s | 2.8s | 8.7s |
| Final Fantasy Mystic Quest | 4.1s | 10.7s | 0.1s | 2.9s | 10.8s |
| Heretic | 3.2s | 14.9s | 0.1s | 2.9s | 14.8s |
| Hylics 2 | 3.6s | 6.6s | 0.1s | 2.6s | 6.6s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.8s | 6.6s |
| Kingdom Hearts | 9.0s | 29.9s | 0.1s | 2.9s | 22.8s |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.6s | 2.6s | - |
| Kirby's Dream Land 3 | 4.8s | 57.0s | 0.1s | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.8s | 17.7s |
| Links Awakening DX | 9.6s | 16.8s | 0.1s | 3.2s | 16.8s |
| Lufia II Ancient Cave | 2.8s | 5.7s | 0.1s | 3.0s | 5.7s |
| Mario & Luigi Superstar Saga | 3.8s | 9.7s | 0.1s | 3.1s | 20.9s |
| MathProof2p2e4 | 2.8s | 5.8s | 0.1s | 2.7s | 5.7s |
| Mega Man 2 | 2.7s | 6.6s | 0.1s | 2.6s | 6.6s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 8.7s |
| Meritous | 2.8s | 5.7s | 0.1s | 2.7s | 5.7s |
| Metamath | 10.8s | 5.6s | 0.1s | 2.7s | 5.8s |
| Muse Dash | 3.2s | 7.8s | 0.1s | 2.9s | - |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Old School Runescape | 4.4s | 8.7s | 0.1s | 2.9s | 8.7s |
| Overcooked! 2 | 3.1s | 21.9s | 0.1s | 2.9s | 19.8s |
| Paint | 2.9s | 7.7s | 0.1s | 2.8s | 6.8s |
| Risk of Rain 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.6s | 6.6s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.8s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.5s | 28.8s | 0.1s | 3.2s | 44.2s |
| Stardew Valley | 5.7s | 74.9s | 0.4s | 2.9s | - |
| Subnautica | 26.8s | 14.7s | 0.1s | 2.8s | 14.7s |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.8s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.8s | 0.1s | 2.7s | - |
| Super Mario World | 4.1s | 6.7s | 0.1s | - | - |
| Super Metroid | 11.2s | 10.8s | 0.1s | 2.8s | 11.7s |
| TOEM original | 2.6s | 8.6s | 0.1s | 2.6s | 8.6s |
| TOEM rule builder | 2.9s | 8.7s | 0.1s | 2.9s | 8.7s |
| Terraria | 2.9s | 19.8s | 0.1s | 2.5s | - |
| The Legend of Zelda | 4.8s | 8.7s | 0.1s | - | - |
| The Messenger | 3.6s | 13.0s | 0.1s | 2.9s | - |
| The Wind Waker | 16.0s | 9.7s | 0.1s | 2.8s | 9.7s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.6s | - |
| Undertale | 2.9s | 5.7s | 0.1s | - | - |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Wargroove | 2.9s | 6.7s | 0.1s | 2.7s | 6.7s |
| WebDevJourney | 2.7s | 8.6s | 0.1s | 2.6s | 8.6s |
| Yacht Dice | 3.5s | 8.7s | 0.1s | 2.6s | 5.6s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 8.7s |
| shapez | 4.4s | 6.7s | 0.1s | 2.7s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.8s |
| 2 | The Wind Waker | 16.0s |
| 3 | Bomb Rush Cyberfunk | 11.7s |
| 4 | Super Metroid | 11.2s |
| 5 | Metamath | 10.8s |
| 6 | A Link to the Past | 10.3s |
| 7 | Links Awakening DX | 9.6s |
| 8 | Kingdom Hearts | 9.0s |
| 9 | Aquaria | 6.9s |
| 10 | Starcraft 2 | 6.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 74.9s |
| 2 | Kirby's Dream Land 3 | 57.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Kingdom Hearts | 29.9s |
| 5 | Starcraft 2 | 28.8s |
| 6 | Dark Souls III | 25.9s |
| 7 | Bomb Rush Cyberfunk | 22.5s |
| 8 | Overcooked! 2 | 21.9s |
| 9 | Terraria | 19.8s |
| 10 | A Link to the Past | 18.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.6s |
| 2 | Stardew Valley | 0.4s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | The Wind Waker | 0.1s |
| 6 | Yoshi's Island | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Link to the Past | 0.1s |
| 9 | A Short Hike | 0.1s |
| 10 | APQuest | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.7s |
| 2 | Starcraft 2 | 3.2s |
| 3 | Links Awakening DX | 3.2s |
| 4 | Castlevania 64 | 3.1s |
| 5 | Mario & Luigi Superstar Saga | 3.1s |
| 6 | Lufia II Ancient Cave | 3.0s |
| 7 | Stardew Valley | 2.9s |
| 8 | Choo-Choo Charles | 2.9s |
| 9 | Final Fantasy Mystic Quest | 2.9s |
| 10 | Heretic | 2.9s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Starcraft 2 | 44.2s |
| 2 | Kingdom Hearts | 22.8s |
| 3 | Mario & Luigi Superstar Saga | 20.9s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | Bomb Rush Cyberfunk | 18.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Links Awakening DX | 16.8s |
| 8 | Sonic Adventure 2 Battle | 16.7s |
| 9 | Heretic | 14.8s |
| 10 | Celeste (Open World) | 14.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 314.1s | 881.6s | 6.8s | 183.9s | 578.4s |
| Average | 4.6s | 12.8s | 0.1s | 2.9s | 10.5s |
| Max | 26.4s | 72.7s | 0.7s | 8.3s | 43.2s |
| Min | 2.5s | 5.4s | 0.1s | 2.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.4s) | Stardew Valley (72.7s) | Kingdom Hearts 2 (0.7s) | Stardew Valley (8.3s) | Starcraft 2 (43.2s) |
| Fastest | MathProof2p2e4 (2.5s) | MathProof2p2e4 (5.4s) | Wargroove (0.1s) | Adventure (2.4s) | MathProof2p2e4 (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.6s | 16.9s | 0.1s | 2.8s | 13.7s |
| A Link to the Past | 11.2s | 23.8s | 0.1s | - | - |
| A Short Hike | 2.9s | 11.1s | 0.1s | 2.7s | 9.6s |
| APQuest | 3.0s | 9.0s | 0.1s | 2.8s | 5.7s |
| Adventure | 2.7s | 10.3s | 0.1s | 2.4s | 5.5s |
| Aquaria | 7.0s | 10.0s | 0.1s | 2.8s | 7.7s |
| Bomb Rush Cyberfunk | 11.2s | 22.6s | 0.1s | 2.9s | 18.7s |
| Bumper Stickers | 3.2s | 11.6s | 0.1s | 2.9s | 8.8s |
| Castlevania - Circle of the Moon | 3.1s | 6.9s | 0.1s | 2.8s | 5.7s |
| Castlevania 64 | 3.1s | 8.0s | 0.1s | 2.8s | 6.6s |
| Celeste (Open World) | 3.9s | 14.8s | 0.1s | 3.8s | 14.7s |
| Celeste 64 | 3.3s | 6.9s | 0.1s | 3.0s | 7.8s |
| ChecksFinder | 2.6s | 6.6s | 0.1s | 2.6s | 6.6s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 2.6s | 10.5s | 0.1s | 2.6s | 9.5s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s |
| DLCQuest | 2.9s | 5.6s | 0.1s | 2.7s | 5.6s |
| DOOM 1993 | 3.2s | 12.8s | 0.1s | 3.0s | 12.8s |
| DOOM II | 3.2s | 15.8s | 0.1s | 2.9s | 15.8s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 2.6s | - |
| Donkey Kong Country 3 | 2.9s | 13.8s | 0.1s | - | - |
| Factorio | 4.0s | 9.9s | 0.1s | 3.2s | 9.8s |
| Faxanadu | 2.7s | 6.6s | 0.1s | 2.7s | 8.6s |
| Final Fantasy Mystic Quest | 3.9s | 10.8s | 0.1s | 2.9s | 10.7s |
| Heretic | 2.9s | 14.6s | 0.1s | 2.8s | 15.6s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.8s | 6.7s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s |
| Kingdom Hearts | 9.0s | 28.9s | 0.1s | 3.1s | 22.8s |
| Kingdom Hearts 2 | 5.5s | 44.2s | 0.7s | 2.7s | - |
| Kirby's Dream Land 3 | 4.6s | 55.0s | 0.1s | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.6s | 0.1s | 2.8s | 17.7s |
| Links Awakening DX | 10.2s | 17.9s | 0.1s | 3.6s | 17.9s |
| Lufia II Ancient Cave | 2.6s | 5.6s | 0.1s | 2.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 9.8s | 0.1s | 2.9s | 20.7s |
| MathProof2p2e4 | 2.5s | 5.4s | 0.1s | 2.5s | 5.4s |
| Mega Man 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 8.6s | 0.1s | 2.7s | 7.6s |
| Meritous | 3.1s | 5.8s | 0.1s | 2.9s | 5.8s |
| Metamath | 10.4s | 5.7s | 0.1s | 2.9s | 5.7s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Old School Runescape | 5.0s | 8.8s | 0.1s | 3.4s | 9.9s |
| Overcooked! 2 | 3.0s | 20.8s | 0.1s | 2.7s | 19.7s |
| Paint | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s |
| Risk of Rain 2 | 2.6s | 6.5s | 0.1s | 2.5s | 6.5s |
| Saving Princess | 2.9s | 5.8s | 0.1s | 2.9s | 6.7s |
| Shivers | 3.0s | 9.6s | 0.1s | 2.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.5s | 13.8s | 0.1s | 3.0s | 16.8s |
| Starcraft 2 | 6.4s | 28.8s | 0.1s | 3.3s | 43.2s |
| Stardew Valley | 5.6s | 72.7s | 0.3s | 8.3s | - |
| Subnautica | 26.4s | 14.7s | 0.1s | 2.7s | 14.6s |
| Super Mario 64 | 3.3s | 12.8s | 0.1s | 3.3s | 13.9s |
| Super Mario Land 2 | 3.7s | 7.7s | 0.1s | 2.5s | - |
| Super Mario World | 4.1s | 6.7s | 0.1s | - | - |
| Super Metroid | 10.3s | 10.5s | 0.1s | 2.6s | 12.5s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.8s | 9.7s |
| TOEM rule builder | 2.7s | 8.6s | 0.1s | 2.7s | 8.6s |
| Terraria | 3.1s | 20.9s | 0.1s | 2.7s | - |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | - | - |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 15.7s | 9.6s | 0.1s | 2.8s | 9.7s |
| Timespinner | 3.6s | 7.8s | 0.1s | 3.0s | - |
| Undertale | 2.8s | 5.6s | 0.1s | - | - |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Wargroove | 2.7s | 6.5s | 0.1s | 2.5s | 6.4s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s |
| Yacht Dice | 3.3s | 8.7s | 0.1s | 2.7s | 5.6s |
| Yoshi's Island | 4.0s | 9.9s | 0.1s | 3.0s | 8.8s |
| shapez | 4.3s | 6.7s | 0.1s | 2.8s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.4s |
| 2 | The Wind Waker | 15.7s |
| 3 | A Link to the Past | 11.2s |
| 4 | Bomb Rush Cyberfunk | 11.2s |
| 5 | Metamath | 10.4s |
| 6 | Super Metroid | 10.3s |
| 7 | Links Awakening DX | 10.2s |
| 8 | Kingdom Hearts | 9.0s |
| 9 | Aquaria | 7.0s |
| 10 | Starcraft 2 | 6.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 72.7s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 44.2s |
| 4 | Kingdom Hearts | 28.9s |
| 5 | Starcraft 2 | 28.8s |
| 6 | Dark Souls III | 24.8s |
| 7 | A Link to the Past | 23.8s |
| 8 | Bomb Rush Cyberfunk | 22.6s |
| 9 | Terraria | 20.9s |
| 10 | Overcooked! 2 | 20.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.7s |
| 2 | Stardew Valley | 0.3s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | Yoshi's Island | 0.1s |
| 6 | A Link to the Past | 0.1s |
| 7 | The Wind Waker | 0.1s |
| 8 | A Hat in Time | 0.1s |
| 9 | Celeste (Open World) | 0.1s |
| 10 | Links Awakening DX | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 8.3s |
| 2 | Celeste (Open World) | 3.8s |
| 3 | Links Awakening DX | 3.6s |
| 4 | Old School Runescape | 3.4s |
| 5 | Super Mario 64 | 3.3s |
| 6 | Starcraft 2 | 3.3s |
| 7 | Factorio | 3.2s |
| 8 | Kingdom Hearts | 3.1s |
| 9 | Sonic Adventure 2 Battle | 3.0s |
| 10 | DOOM 1993 | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Starcraft 2 | 43.2s |
| 2 | Kingdom Hearts | 22.8s |
| 3 | Mario & Luigi Superstar Saga | 20.7s |
| 4 | Overcooked! 2 | 19.7s |
| 5 | Bomb Rush Cyberfunk | 18.7s |
| 6 | Links Awakening DX | 17.9s |
| 7 | Landstalker - The Treasures of King Nole | 17.7s |
| 8 | Sonic Adventure 2 Battle | 16.8s |
| 9 | DOOM II | 15.8s |
| 10 | Heretic | 15.6s |
