# World Generator Test Results

**Generated:** 2025-12-17 04:00:24 UTC
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
| Test World Generation | 71 | 0 | 71 |
| Test Seed Generation | 53 | 18 | 71 |
| Test Spoiler Test | 50 | 3 | 53 |
| Cross-Validation | 37 | 16 | 53 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 71

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 71 | 0 | 71 |
| Original Spoiler Test | 71 | 0 | 71 |
| Test World Generation | 71 | 0 | 71 |
| Test Seed Generation | 53 | 18 | 71 |
| Test Spoiler Test | 50 | 3 | 53 |
| Cross-Validation | 17 | 36 | 53 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ❌ | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 326.4s | 898.6s | 6.0s | 196.5s | 615.1s |
| Average | 4.6s | 12.7s | 0.1s | 2.8s | 11.6s |
| Max | 27.5s | 76.7s | 0.2s | 4.0s | 55.1s |
| Min | 2.7s | 5.6s | 0.1s | 0.4s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (27.5s) | Stardew Valley (76.7s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (4.0s) | Kirby's Dream Land 3 (55.1s) |
| Fastest | MathProof2p2e4 (2.7s) | Metamath (5.6s) | Yacht Dice (0.1s) | A Link to the Past (0.4s) | Metamath (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.9s | 18.0s | 0.1s | 2.8s | - |
| A Link to the Past | 9.8s | 19.2s | 0.1s | 0.4s | - |
| A Short Hike | 3.2s | 11.0s | 0.1s | 3.0s | 9.7s |
| APQuest | 2.9s | 7.5s | 0.1s | 2.7s | 5.6s |
| Adventure | 3.1s | 6.6s | 0.1s | 2.9s | 5.7s |
| Aquaria | 7.2s | 11.1s | 0.1s | 2.8s | 7.7s |
| Bomb Rush Cyberfunk | 11.2s | 22.5s | 0.1s | 2.5s | - |
| Bumper Stickers | 2.8s | 10.2s | 0.1s | 2.8s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 8.7s | 0.1s | 2.9s | 5.7s |
| Castlevania 64 | 3.0s | 10.9s | 0.1s | 2.7s | 6.6s |
| Celeste (Open World) | 4.1s | 14.9s | 0.1s | 4.0s | 15.0s |
| Celeste 64 | 3.0s | 6.7s | 0.1s | 2.7s | 7.7s |
| ChecksFinder | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Choo-Choo Charles | 3.0s | 10.7s | 0.1s | 3.0s | 9.8s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.7s | 8.7s |
| DLCQuest | 3.0s | 5.7s | 0.1s | 2.7s | 5.6s |
| DOOM 1993 | 2.9s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.1s | 15.8s | 0.1s | 3.0s | 15.8s |
| Dark Souls III | 4.7s | 24.8s | 0.1s | 3.0s | 24.8s |
| Donkey Kong Country 3 | 3.1s | 14.8s | 0.1s | 3.0s | 14.8s |
| Factorio | 3.4s | 9.7s | 0.1s | 2.7s | 9.7s |
| Faxanadu | 3.0s | 6.7s | 0.1s | 2.9s | 8.7s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 2.8s | 10.7s |
| Heretic | 3.3s | 15.8s | 0.1s | 3.1s | 14.8s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.7s | 6.7s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s |
| Kingdom Hearts | 8.8s | 29.9s | 0.1s | 2.7s | - |
| Kingdom Hearts 2 | 5.2s | 40.9s | 0.2s | 2.5s | - |
| Kirby's Dream Land 3 | 4.6s | 54.0s | 0.1s | 3.0s | 55.1s |
| Landstalker - The Treasures of King Nole | 3.4s | 8.8s | 0.1s | 3.1s | 18.9s |
| Lingo | 3.2s | 5.7s | 0.1s | 2.9s | 40.8s |
| Links Awakening DX | 9.8s | 17.9s | 0.1s | 2.8s | - |
| Lufia II Ancient Cave | 2.8s | 5.7s | 0.1s | 2.7s | 5.6s |
| Mario & Luigi Superstar Saga | 3.9s | 9.8s | 0.1s | 3.2s | 8.7s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.7s | 7.7s |
| Meritous | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s |
| Metamath | 11.2s | 5.6s | 0.1s | 2.6s | 5.6s |
| Muse Dash | 3.1s | 7.8s | 0.1s | 2.8s | - |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Old School Runescape | 4.6s | 8.8s | 0.1s | 3.0s | 8.8s |
| Overcooked! 2 | 3.0s | 21.8s | 0.1s | 2.8s | 19.8s |
| Paint | 3.1s | 6.7s | 0.1s | 2.9s | 14.5s |
| Risk of Rain 2 | 2.9s | 6.7s | 0.1s | 2.7s | 6.6s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.7s | 6.7s |
| Secret of Evermore | 4.3s | 7.7s | 0.1s | 2.7s | 44.3s |
| Shivers | 3.5s | 9.7s | 0.1s | 3.0s | 9.7s |
| Sonic Adventure 2 Battle | 3.4s | 13.7s | 0.1s | 2.7s | 16.7s |
| Starcraft 2 | 6.5s | 33.0s | 0.1s | 2.8s | - |
| Stardew Valley | 5.4s | 76.7s | 0.2s | 2.7s | - |
| Subnautica | 27.5s | 14.8s | 0.1s | 2.8s | - |
| Super Mario 64 | 2.9s | 12.8s | 0.1s | 2.7s | 12.7s |
| Super Mario Land 2 | 4.5s | 7.8s | 0.1s | 2.7s | - |
| Super Mario World | 3.9s | 6.7s | 0.1s | 2.8s | 6.7s |
| Super Metroid | 11.5s | 10.7s | 0.1s | 2.8s | 11.7s |
| TOEM original | 2.7s | 8.7s | 0.1s | 2.7s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.9s | 9.7s |
| Terraria | 2.9s | 19.8s | 0.1s | 2.5s | - |
| The Legend of Zelda | 4.7s | 8.8s | 0.1s | 3.1s | 10.8s |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 17.4s | 9.9s | 0.1s | 2.7s | - |
| Timespinner | 3.1s | 7.6s | 0.1s | 2.6s | - |
| Undertale | 3.1s | 5.7s | 0.1s | 2.6s | - |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.7s | 5.6s |
| Wargroove | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s |
| WebDevJourney | 2.7s | 8.7s | 0.1s | 2.7s | 8.7s |
| Yacht Dice | 3.5s | 8.7s | 0.1s | 2.6s | - |
| Yoshi's Island | 3.5s | 9.6s | 0.1s | 2.5s | - |
| shapez | 4.4s | 6.8s | 0.1s | 3.0s | 6.8s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.5s |
| 2 | The Wind Waker | 17.4s |
| 3 | Super Metroid | 11.5s |
| 4 | Bomb Rush Cyberfunk | 11.2s |
| 5 | Metamath | 11.2s |
| 6 | Links Awakening DX | 9.8s |
| 7 | A Link to the Past | 9.8s |
| 8 | Kingdom Hearts | 8.8s |
| 9 | Aquaria | 7.2s |
| 10 | Starcraft 2 | 6.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 76.7s |
| 2 | Kirby's Dream Land 3 | 54.0s |
| 3 | Kingdom Hearts 2 | 40.9s |
| 4 | Starcraft 2 | 33.0s |
| 5 | Kingdom Hearts | 29.9s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 22.5s |
| 8 | Overcooked! 2 | 21.8s |
| 9 | Terraria | 19.8s |
| 10 | A Link to the Past | 19.2s |

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
| 9 | Adventure | 0.1s |
| 10 | Aquaria | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 4.0s |
| 2 | Mario & Luigi Superstar Saga | 3.2s |
| 3 | Landstalker - The Treasures of King Nole | 3.1s |
| 4 | Heretic | 3.1s |
| 5 | The Legend of Zelda | 3.1s |
| 6 | Dark Souls III | 3.0s |
| 7 | Donkey Kong Country 3 | 3.0s |
| 8 | Kirby's Dream Land 3 | 3.0s |
| 9 | shapez | 3.0s |
| 10 | Old School Runescape | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 55.1s |
| 2 | Secret of Evermore | 44.3s |
| 3 | Lingo | 40.8s |
| 4 | Dark Souls III | 24.8s |
| 5 | Overcooked! 2 | 19.8s |
| 6 | Landstalker - The Treasures of King Nole | 18.9s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | DOOM II | 15.8s |
| 9 | Celeste (Open World) | 15.0s |
| 10 | Heretic | 14.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 324.4s | 900.3s | 5.9s | 200.1s | 620.8s |
| Average | 4.6s | 12.7s | 0.1s | 2.8s | 11.7s |
| Max | 27.3s | 79.4s | 0.2s | 4.0s | 56.8s |
| Min | 2.5s | 5.5s | 0.1s | 0.4s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (27.3s) | Stardew Valley (79.4s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (4.0s) | Kirby's Dream Land 3 (56.8s) |
| Fastest | Noita (2.5s) | Metamath (5.5s) | Noita (0.1s) | A Link to the Past (0.4s) | Metamath (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.9s | 14.4s | 0.1s | 2.6s | - |
| A Link to the Past | 9.0s | 19.1s | 0.1s | 0.4s | - |
| A Short Hike | 3.1s | 10.3s | 0.1s | 2.9s | 9.7s |
| APQuest | 3.0s | 10.8s | 0.1s | 2.8s | 5.7s |
| Adventure | 3.1s | 6.6s | 0.1s | 2.7s | 5.6s |
| Aquaria | 7.5s | 11.9s | 0.1s | 3.0s | 7.7s |
| Bomb Rush Cyberfunk | 11.2s | 23.5s | 0.1s | 2.9s | - |
| Bumper Stickers | 3.2s | 12.7s | 0.1s | 2.9s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 7.5s | 0.1s | 2.9s | 5.7s |
| Castlevania 64 | 2.8s | 7.7s | 0.1s | 2.6s | 6.5s |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 4.0s | 14.8s |
| Celeste 64 | 2.8s | 6.5s | 0.1s | 2.5s | 7.5s |
| ChecksFinder | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.9s | 5.8s |
| Choo-Choo Charles | 3.0s | 9.7s | 0.1s | 2.9s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s |
| DLCQuest | 3.1s | 5.8s | 0.1s | 2.9s | 5.7s |
| DOOM 1993 | 3.2s | 12.8s | 0.1s | 3.1s | 12.8s |
| DOOM II | 3.2s | 15.8s | 0.1s | 3.1s | 15.8s |
| Dark Souls III | 4.4s | 24.6s | 0.1s | 2.9s | 23.6s |
| Donkey Kong Country 3 | 3.1s | 13.7s | 0.1s | 2.9s | 14.7s |
| Factorio | 3.2s | 9.5s | 0.1s | 2.6s | 9.5s |
| Faxanadu | 3.0s | 6.7s | 0.1s | 3.0s | 8.8s |
| Final Fantasy Mystic Quest | 3.9s | 10.8s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.3s | 15.8s | 0.1s | 3.1s | 14.7s |
| Hylics 2 | 3.9s | 6.7s | 0.1s | 2.9s | 6.7s |
| Inscryption | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s |
| Kingdom Hearts | 8.7s | 29.1s | 0.1s | 2.9s | - |
| Kingdom Hearts 2 | 5.5s | 42.1s | 0.2s | 2.8s | - |
| Kirby's Dream Land 3 | 4.2s | 56.5s | 0.1s | 3.0s | 56.8s |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 3.0s | 17.8s |
| Lingo | 3.0s | 5.5s | 0.1s | 2.8s | 43.0s |
| Links Awakening DX | 10.2s | 16.8s | 0.1s | 3.0s | - |
| Lufia II Ancient Cave | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 9.8s | 0.1s | 3.1s | 8.7s |
| MathProof2p2e4 | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mega Man 2 | 2.9s | 6.8s | 0.1s | 2.7s | 6.7s |
| MegaMan Battle Network 3 | 3.3s | 8.7s | 0.1s | 2.9s | 8.7s |
| Meritous | 3.1s | 5.7s | 0.1s | 2.8s | 5.7s |
| Metamath | 10.1s | 5.5s | 0.1s | 2.5s | 5.5s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.5s | 5.5s | 0.1s | 2.6s | 5.5s |
| Old School Runescape | 4.4s | 8.8s | 0.1s | 3.0s | 8.7s |
| Overcooked! 2 | 3.0s | 21.9s | 0.1s | 2.9s | 19.8s |
| Paint | 2.8s | 6.7s | 0.1s | 2.9s | 14.4s |
| Risk of Rain 2 | 3.1s | 6.7s | 0.1s | 2.9s | 6.7s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s |
| Secret of Evermore | 4.7s | 7.8s | 0.1s | 2.9s | 45.7s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.9s | 9.7s |
| Sonic Adventure 2 Battle | 3.0s | 13.5s | 0.1s | 2.6s | 16.5s |
| Starcraft 2 | 6.4s | 33.8s | 0.1s | 2.7s | - |
| Stardew Valley | 5.0s | 79.4s | 0.2s | 3.1s | - |
| Subnautica | 27.3s | 14.8s | 0.1s | 2.8s | - |
| Super Mario 64 | 3.0s | 12.9s | 0.1s | 3.0s | 12.7s |
| Super Mario Land 2 | 4.1s | 7.7s | 0.1s | 2.7s | - |
| Super Mario World | 4.1s | 6.7s | 0.1s | 3.0s | 6.7s |
| Super Metroid | 11.6s | 10.7s | 0.1s | 3.0s | 12.7s |
| TOEM original | 3.0s | 8.7s | 0.1s | 2.9s | 9.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.8s | 9.7s |
| Terraria | 2.7s | 20.6s | 0.1s | 2.4s | - |
| The Legend of Zelda | 4.7s | 8.7s | 0.1s | 3.0s | 10.7s |
| The Messenger | 3.0s | 12.6s | 0.1s | 2.4s | - |
| The Wind Waker | 17.5s | 9.9s | 0.1s | 2.8s | - |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.8s | - |
| Undertale | 3.0s | 5.7s | 0.1s | 2.7s | - |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Wargroove | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s |
| WebDevJourney | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s |
| Yacht Dice | 3.7s | 8.7s | 0.1s | 2.7s | - |
| Yoshi's Island | 3.3s | 9.5s | 0.1s | 2.4s | - |
| shapez | 4.3s | 6.7s | 0.1s | 2.9s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.3s |
| 2 | The Wind Waker | 17.5s |
| 3 | Super Metroid | 11.6s |
| 4 | Bomb Rush Cyberfunk | 11.2s |
| 5 | Links Awakening DX | 10.2s |
| 6 | Metamath | 10.1s |
| 7 | A Link to the Past | 9.0s |
| 8 | Kingdom Hearts | 8.7s |
| 9 | Aquaria | 7.5s |
| 10 | Starcraft 2 | 6.4s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 79.4s |
| 2 | Kirby's Dream Land 3 | 56.5s |
| 3 | Kingdom Hearts 2 | 42.1s |
| 4 | Starcraft 2 | 33.8s |
| 5 | Kingdom Hearts | 29.1s |
| 6 | Dark Souls III | 24.6s |
| 7 | Bomb Rush Cyberfunk | 23.5s |
| 8 | Overcooked! 2 | 21.9s |
| 9 | Terraria | 20.6s |
| 10 | A Link to the Past | 19.1s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.1s |
| 4 | Subnautica | 0.1s |
| 5 | Kingdom Hearts | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Bomb Rush Cyberfunk | 0.1s |
| 8 | Starcraft 2 | 0.1s |
| 9 | A Hat in Time | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 4.0s |
| 2 | Mario & Luigi Superstar Saga | 3.1s |
| 3 | DOOM II | 3.1s |
| 4 | Heretic | 3.1s |
| 5 | DOOM 1993 | 3.1s |
| 6 | Stardew Valley | 3.1s |
| 7 | Old School Runescape | 3.0s |
| 8 | Final Fantasy Mystic Quest | 3.0s |
| 9 | Kirby's Dream Land 3 | 3.0s |
| 10 | Landstalker - The Treasures of King Nole | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.8s |
| 2 | Secret of Evermore | 45.7s |
| 3 | Lingo | 43.0s |
| 4 | Dark Souls III | 23.6s |
| 5 | Overcooked! 2 | 19.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.8s |
| 7 | Sonic Adventure 2 Battle | 16.5s |
| 8 | DOOM II | 15.8s |
| 9 | Celeste (Open World) | 14.8s |
| 10 | Donkey Kong Country 3 | 14.7s |
