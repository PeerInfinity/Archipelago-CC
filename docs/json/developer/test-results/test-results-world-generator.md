# World Generator Test Results

**Generated:** 2025-12-17 00:44:10 UTC
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

**Total Templates:** 71

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 71 | 0 | 71 |
| Original Spoiler Test | 71 | 0 | 71 |
| Test World Generation | 69 | 2 | 71 |
| Test Seed Generation | 51 | 20 | 71 |
| Test Spoiler Test | 45 | 6 | 51 |
| Cross-Validation | 36 | 15 | 51 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ❌ | - | - | - |
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
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lingo | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Paint | ✅ | ✅ | ✅ | ❌ | - | - |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ❌ | - | - |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ❌ | - | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ❌ | Error |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 71

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 71 | 0 | 71 |
| Original Spoiler Test | 71 | 0 | 71 |
| Test World Generation | 69 | 2 | 71 |
| Test Seed Generation | 51 | 20 | 71 |
| Test Spoiler Test | 45 | 6 | 51 |
| Cross-Validation | 17 | 34 | 51 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ❌ | - | - | - |
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
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Lingo | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Paint | ✅ | ✅ | ✅ | ❌ | - | - |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ❌ | - | - |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ❌ | - | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ❌ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 321.9s | 903.6s | 5.9s | 190.2s | 582.4s |
| Average | 4.5s | 12.7s | 0.1s | 2.8s | 11.4s |
| Max | 26.7s | 75.6s | 0.2s | 3.8s | 44.2s |
| Min | 2.6s | 5.6s | 0.1s | 0.4s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.7s) | Stardew Valley (75.6s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (3.8s) | Secret of Evermore (44.2s) |
| Fastest | ChecksFinder (2.6s) | Noita (5.6s) | Yacht Dice (0.1s) | A Link to the Past (0.4s) | Noita (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 5.0s | 17.3s | 0.1s | 2.6s | - |
| A Link to the Past | 9.7s | 20.2s | 0.1s | 0.4s | - |
| A Short Hike | 2.9s | 12.6s | 0.1s | 2.7s | 9.6s |
| APQuest | 2.9s | 10.2s | 0.1s | 2.9s | 5.7s |
| Adventure | 3.2s | 9.2s | 0.1s | 3.0s | 5.7s |
| Aquaria | 7.1s | 11.0s | 0.1s | 2.8s | 7.7s |
| Bomb Rush Cyberfunk | 11.1s | 22.6s | 0.1s | - | - |
| Bumper Stickers | 2.8s | 13.6s | 0.1s | 2.6s | 8.6s |
| Castlevania - Circle of the Moon | 2.9s | 6.8s | 0.1s | 2.7s | 5.6s |
| Castlevania 64 | 3.0s | 7.8s | 0.1s | 2.7s | 6.6s |
| Celeste (Open World) | 4.1s | 14.8s | 0.1s | 3.8s | 14.8s |
| Celeste 64 | 3.0s | 6.7s | 0.1s | 2.7s | 7.6s |
| ChecksFinder | 2.6s | 6.6s | 0.1s | 2.6s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.8s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 3.1s | 9.7s | 0.1s | 3.1s | 10.8s |
| Civilization VI | 2.8s | 8.7s | 0.1s | 2.7s | 8.6s |
| DLCQuest | 3.0s | 5.7s | 0.1s | 2.8s | 5.7s |
| DOOM 1993 | 2.9s | 12.7s | 0.1s | 2.7s | 12.7s |
| DOOM II | 3.0s | 14.7s | 0.1s | 2.8s | 15.7s |
| Dark Souls III | 4.7s | 24.8s | 0.1s | 3.1s | 24.8s |
| Donkey Kong Country 3 | 3.1s | 14.8s | 0.1s | 2.9s | 13.7s |
| Factorio | 3.3s | 9.7s | 0.1s | 2.7s | 9.7s |
| Faxanadu | 2.7s | 6.6s | 0.1s | 2.7s | 8.6s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.3s | 14.8s | 0.1s | 3.2s | 14.9s |
| Hylics 2 | 3.7s | 6.6s | 0.1s | 2.7s | 6.6s |
| Inscryption | 2.9s | 6.8s | 0.1s | 2.8s | 6.7s |
| Kingdom Hearts | 8.6s | 28.8s | 0.1s | 2.6s | - |
| Kingdom Hearts 2 | 5.1s | 40.9s | 0.2s | 2.5s | - |
| Kirby's Dream Land 3 | 4.4s | 54.0s | 0.1s | 3.1s | 20.6s |
| Landstalker - The Treasures of King Nole | 3.3s | 8.7s | 0.1s | 2.8s | 17.8s |
| Lingo | 3.2s | 5.6s | 0.1s | 2.9s | 40.7s |
| Links Awakening DX | 9.1s | 16.7s | 0.1s | 2.5s | - |
| Lufia II Ancient Cave | 2.9s | 5.8s | 0.1s | 3.0s | 5.8s |
| Mario & Luigi Superstar Saga | 3.9s | 9.9s | 0.1s | 3.3s | 8.8s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Mega Man 2 | 3.0s | 6.6s | 0.1s | 2.8s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 8.6s | 0.1s | 2.7s | 7.6s |
| Meritous | 3.0s | 5.6s | 0.1s | 2.7s | 5.6s |
| Metamath | 11.1s | 5.6s | 0.1s | 2.7s | 5.6s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s |
| Old School Runescape | 4.3s | 8.6s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 3.1s | 22.9s | 0.1s | 3.0s | 14.6s |
| Paint | 3.0s | 6.8s | 0.1s | 2.8s | - |
| Risk of Rain 2 | 2.9s | 6.6s | 0.1s | 2.7s | 6.6s |
| Saving Princess | 2.9s | 5.7s | 0.1s | 2.6s | - |
| Secret of Evermore | 4.3s | 7.6s | 0.1s | 2.6s | 44.2s |
| Shivers | 3.0s | 9.7s | 0.1s | 2.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.1s | 13.8s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.6s | 38.9s | 0.1s | 2.6s | - |
| Stardew Valley | 5.3s | 75.6s | 0.2s | 2.6s | - |
| Subnautica | 26.7s | 14.7s | 0.1s | 2.6s | - |
| Super Mario 64 | 2.9s | 12.8s | 0.1s | 3.0s | 12.8s |
| Super Mario Land 2 | 4.4s | 7.8s | 0.1s | 2.8s | - |
| Super Mario World | 3.8s | 6.6s | 0.1s | 2.8s | 6.6s |
| Super Metroid | 11.7s | 10.7s | 0.1s | 3.6s | 34.1s |
| TOEM original | 2.7s | 8.6s | 0.1s | 2.6s | 8.6s |
| TOEM rule builder | 2.7s | 8.7s | 0.1s | 2.7s | 9.7s |
| Terraria | 2.8s | 19.8s | 0.1s | 2.5s | - |
| The Legend of Zelda | 4.9s | 8.7s | 0.1s | 2.9s | 10.7s |
| The Messenger | 3.1s | 12.8s | 0.1s | - | - |
| The Wind Waker | 17.0s | 9.8s | 0.1s | 2.5s | - |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.8s | - |
| Undertale | 3.2s | 5.8s | 0.1s | 2.9s | - |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Wargroove | 2.8s | 6.7s | 0.1s | 3.0s | 6.8s |
| WebDevJourney | 2.8s | 8.6s | 0.1s | 2.6s | 8.6s |
| Yacht Dice | 3.3s | 8.7s | 0.1s | 2.5s | - |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.5s | - |
| shapez | 4.5s | 6.7s | 0.1s | 2.8s | 14.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.7s |
| 2 | The Wind Waker | 17.0s |
| 3 | Super Metroid | 11.7s |
| 4 | Bomb Rush Cyberfunk | 11.1s |
| 5 | Metamath | 11.1s |
| 6 | A Link to the Past | 9.7s |
| 7 | Links Awakening DX | 9.1s |
| 8 | Kingdom Hearts | 8.6s |
| 9 | Aquaria | 7.1s |
| 10 | Starcraft 2 | 6.6s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 75.6s |
| 2 | Kirby's Dream Land 3 | 54.0s |
| 3 | Kingdom Hearts 2 | 40.9s |
| 4 | Starcraft 2 | 38.9s |
| 5 | Kingdom Hearts | 28.8s |
| 6 | Dark Souls III | 24.8s |
| 7 | Overcooked! 2 | 22.9s |
| 8 | Bomb Rush Cyberfunk | 22.6s |
| 9 | A Link to the Past | 20.2s |
| 10 | Terraria | 19.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.1s |
| 4 | Subnautica | 0.1s |
| 5 | Starcraft 2 | 0.1s |
| 6 | A Hat in Time | 0.1s |
| 7 | Kingdom Hearts | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | Bomb Rush Cyberfunk | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.8s |
| 2 | Super Metroid | 3.6s |
| 3 | Mario & Luigi Superstar Saga | 3.3s |
| 4 | Heretic | 3.2s |
| 5 | Choo-Choo Charles | 3.1s |
| 6 | Kirby's Dream Land 3 | 3.1s |
| 7 | Dark Souls III | 3.1s |
| 8 | Lufia II Ancient Cave | 3.0s |
| 9 | Overcooked! 2 | 3.0s |
| 10 | Super Mario 64 | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Secret of Evermore | 44.2s |
| 2 | Lingo | 40.7s |
| 3 | Super Metroid | 34.1s |
| 4 | Dark Souls III | 24.8s |
| 5 | Kirby's Dream Land 3 | 20.6s |
| 6 | Landstalker - The Treasures of King Nole | 17.8s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | DOOM II | 15.7s |
| 9 | Heretic | 14.9s |
| 10 | Celeste (Open World) | 14.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 319.6s | 896.5s | 5.8s | 190.5s | 579.9s |
| Average | 4.5s | 12.6s | 0.1s | 2.8s | 11.4s |
| Max | 28.0s | 77.7s | 0.2s | 4.1s | 44.6s |
| Min | 2.5s | 5.4s | 0.1s | 0.4s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (28.0s) | Stardew Valley (77.7s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (4.1s) | Secret of Evermore (44.6s) |
| Fastest | Wargroove (2.5s) | DLCQuest (5.4s) | Wargroove (0.1s) | A Link to the Past (0.4s) | DLCQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.7s | 15.5s | 0.1s | 2.6s | - |
| A Link to the Past | 9.8s | 18.3s | 0.1s | 0.4s | - |
| A Short Hike | 3.4s | 10.9s | 0.1s | 3.0s | 9.7s |
| APQuest | 2.8s | 7.2s | 0.1s | 2.6s | 5.6s |
| Adventure | 3.0s | 6.3s | 0.1s | 2.8s | 5.7s |
| Aquaria | 6.7s | 12.2s | 0.1s | 2.7s | 7.5s |
| Bomb Rush Cyberfunk | 9.8s | 22.8s | 0.1s | - | - |
| Bumper Stickers | 3.0s | 10.0s | 0.1s | 2.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 8.7s | 0.1s | 2.8s | 5.6s |
| Castlevania 64 | 3.0s | 9.0s | 0.1s | 2.7s | 6.6s |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 4.1s | 14.9s |
| Celeste 64 | 3.0s | 6.8s | 0.1s | 2.7s | 7.7s |
| ChecksFinder | 3.0s | 6.7s | 0.1s | 2.8s | 6.7s |
| ChocolateChipCookies | 2.6s | 5.7s | 0.1s | 2.7s | 5.6s |
| Choo-Choo Charles | 3.0s | 10.7s | 0.1s | 2.9s | 9.7s |
| Civilization VI | 2.8s | 8.5s | 0.1s | 2.6s | 8.6s |
| DLCQuest | 2.7s | 5.4s | 0.1s | 2.5s | 5.5s |
| DOOM 1993 | 3.0s | 12.8s | 0.1s | 2.9s | 12.7s |
| DOOM II | 3.1s | 14.7s | 0.1s | 3.0s | 15.7s |
| Dark Souls III | 4.7s | 24.8s | 0.1s | 3.0s | 23.7s |
| Donkey Kong Country 3 | 3.0s | 13.8s | 0.1s | 2.9s | 14.7s |
| Factorio | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 3.2s | 6.8s | 0.1s | 2.9s | 8.7s |
| Final Fantasy Mystic Quest | 3.7s | 10.7s | 0.1s | 2.8s | 10.7s |
| Heretic | 3.2s | 14.9s | 0.1s | 3.0s | 15.8s |
| Hylics 2 | 3.6s | 6.5s | 0.1s | 2.7s | 6.5s |
| Inscryption | 2.6s | 6.5s | 0.1s | 2.5s | 6.5s |
| Kingdom Hearts | 8.7s | 29.9s | 0.1s | 2.8s | - |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.2s | 2.6s | - |
| Kirby's Dream Land 3 | 4.5s | 55.0s | 0.1s | 3.2s | 17.5s |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 3.0s | 17.9s |
| Lingo | 3.3s | 5.7s | 0.1s | 3.1s | 41.9s |
| Links Awakening DX | 10.2s | 17.9s | 0.1s | 2.9s | - |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Mario & Luigi Superstar Saga | 3.8s | 9.7s | 0.1s | 3.1s | 8.7s |
| MathProof2p2e4 | 2.6s | 5.5s | 0.1s | 2.7s | 5.6s |
| Mega Man 2 | 2.6s | 6.4s | 0.1s | 2.5s | 6.4s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 7.7s |
| Meritous | 3.0s | 5.6s | 0.1s | 2.7s | 5.6s |
| Metamath | 9.8s | 5.6s | 0.1s | 2.8s | 5.7s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.8s | 5.7s | 0.1s | 3.0s | 5.7s |
| Old School Runescape | 4.8s | 8.7s | 0.1s | 3.1s | 8.7s |
| Overcooked! 2 | 2.9s | 21.7s | 0.1s | 2.8s | 14.2s |
| Paint | 2.8s | 6.7s | 0.1s | 2.7s | - |
| Risk of Rain 2 | 2.8s | 6.5s | 0.1s | 2.8s | 6.5s |
| Saving Princess | 2.5s | 5.4s | 0.1s | 2.3s | - |
| Secret of Evermore | 4.5s | 7.7s | 0.1s | 2.8s | 44.6s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.8s | 9.7s |
| Sonic Adventure 2 Battle | 3.1s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.3s | 37.8s | 0.1s | 2.6s | - |
| Stardew Valley | 5.4s | 77.7s | 0.2s | 3.3s | - |
| Subnautica | 28.0s | 14.8s | 0.1s | 2.7s | - |
| Super Mario 64 | 2.8s | 12.7s | 0.1s | 2.7s | 12.7s |
| Super Mario Land 2 | 4.1s | 7.8s | 0.1s | 2.6s | - |
| Super Mario World | 3.8s | 6.6s | 0.1s | 2.9s | 6.6s |
| Super Metroid | 10.2s | 10.5s | 0.1s | 3.3s | 34.8s |
| TOEM original | 2.8s | 9.7s | 0.1s | 2.7s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.8s | 9.7s |
| Terraria | 2.9s | 19.8s | 0.1s | 2.6s | - |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | 2.9s | 10.7s |
| The Messenger | 3.2s | 12.8s | 0.1s | - | - |
| The Wind Waker | 18.6s | 9.8s | 0.1s | 2.6s | - |
| Timespinner | 3.1s | 7.7s | 0.1s | 2.5s | - |
| Undertale | 3.0s | 5.7s | 0.1s | 2.6s | - |
| VVVVVV | 2.6s | 5.5s | 0.1s | 2.8s | 5.6s |
| Wargroove | 2.5s | 6.4s | 0.1s | 2.5s | 6.4s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s |
| Yacht Dice | 3.5s | 8.7s | 0.1s | 2.6s | - |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.6s | - |
| shapez | 4.3s | 6.7s | 0.1s | 3.0s | 14.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 28.0s |
| 2 | The Wind Waker | 18.6s |
| 3 | Super Metroid | 10.2s |
| 4 | Links Awakening DX | 10.2s |
| 5 | Bomb Rush Cyberfunk | 9.8s |
| 6 | Metamath | 9.8s |
| 7 | A Link to the Past | 9.8s |
| 8 | Kingdom Hearts | 8.7s |
| 9 | Aquaria | 6.7s |
| 10 | Starcraft 2 | 6.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 77.7s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Starcraft 2 | 37.8s |
| 5 | Kingdom Hearts | 29.9s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 22.8s |
| 8 | Overcooked! 2 | 21.7s |
| 9 | Terraria | 19.8s |
| 10 | A Link to the Past | 18.3s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.1s |
| 4 | Subnautica | 0.1s |
| 5 | Kingdom Hearts | 0.1s |
| 6 | Starcraft 2 | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Short Hike | 0.1s |
| 9 | Celeste (Open World) | 0.1s |
| 10 | Links Awakening DX | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 4.1s |
| 2 | Stardew Valley | 3.3s |
| 3 | Super Metroid | 3.3s |
| 4 | Kirby's Dream Land 3 | 3.2s |
| 5 | Mario & Luigi Superstar Saga | 3.1s |
| 6 | Old School Runescape | 3.1s |
| 7 | Lingo | 3.1s |
| 8 | Dark Souls III | 3.0s |
| 9 | shapez | 3.0s |
| 10 | Landstalker - The Treasures of King Nole | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Secret of Evermore | 44.6s |
| 2 | Lingo | 41.9s |
| 3 | Super Metroid | 34.8s |
| 4 | Dark Souls III | 23.7s |
| 5 | Landstalker - The Treasures of King Nole | 17.9s |
| 6 | Kirby's Dream Land 3 | 17.5s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | Heretic | 15.8s |
| 9 | DOOM II | 15.7s |
| 10 | Celeste (Open World) | 14.9s |
