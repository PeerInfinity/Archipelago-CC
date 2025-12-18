# World Generator Test Results

**Generated:** 2025-12-18 03:53:09 UTC
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
| Original Spoiler Test | 66 | 3 | 69 |
| Test World Generation | 69 | 0 | 69 |
| Test Seed Generation | 57 | 12 | 69 |
| Test Spoiler Test | 53 | 4 | 57 |
| Cross-Validation | 38 | 19 | 57 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Kingdom Hearts 2 | ✅ | ❌ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ❌ | - | - |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ❌ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Original Spoiler Test | 66 | 3 | 69 |
| Test World Generation | 69 | 0 | 69 |
| Test Seed Generation | 57 | 12 | 69 |
| Test Spoiler Test | 53 | 4 | 57 |
| Cross-Validation | 18 | 39 | 57 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Kingdom Hearts 2 | ✅ | ❌ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ❌ | - | - |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ❌ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Total | 315.9s | 878.9s | 6.0s | 195.8s | 641.4s |
| Average | 4.6s | 12.7s | 0.1s | 2.8s | 11.3s |
| Max | 26.6s | 78.7s | 0.2s | 3.7s | 57.1s |
| Min | 2.4s | 5.6s | 0.1s | 2.4s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.6s) | Stardew Valley (78.7s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (3.7s) | Kirby's Dream Land 3 (57.1s) |
| Fastest | MathProof2p2e4 (2.4s) | MathProof2p2e4 (5.6s) | Wargroove (0.1s) | Wargroove (2.4s) | MathProof2p2e4 (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.7s | 17.2s | 0.1s | 2.6s | - |
| A Link to the Past | 9.9s | 19.0s | 0.1s | 3.1s | 17.6s |
| A Short Hike | 3.3s | 10.2s | 0.1s | 3.0s | 9.8s |
| APQuest | 3.0s | 9.6s | 0.1s | 2.8s | 5.7s |
| Adventure | 2.6s | 9.1s | 0.1s | 2.5s | 5.4s |
| Aquaria | 7.1s | 8.3s | 0.1s | 2.6s | - |
| Bomb Rush Cyberfunk | 11.6s | 21.4s | 0.1s | 3.0s | 29.5s |
| Bumper Stickers | 3.0s | 14.8s | 0.1s | 2.9s | 8.7s |
| Castlevania - Circle of the Moon | 3.2s | 10.3s | 0.1s | 3.0s | 5.7s |
| Castlevania 64 | 3.2s | 8.3s | 0.1s | 2.9s | 6.7s |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 3.7s | 14.8s |
| Celeste 64 | 2.9s | 6.6s | 0.1s | 2.6s | 7.6s |
| ChecksFinder | 3.0s | 6.8s | 0.1s | 2.9s | 6.8s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Choo-Choo Charles | 2.5s | 9.5s | 0.1s | 2.5s | 9.5s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s |
| DLCQuest | 3.0s | 5.8s | 0.1s | 2.9s | 5.7s |
| DOOM 1993 | 3.1s | 12.8s | 0.1s | 2.9s | 12.8s |
| DOOM II | 3.3s | 16.8s | 0.1s | 3.3s | 16.9s |
| Dark Souls III | 4.9s | 25.8s | 0.1s | 3.3s | 24.8s |
| Donkey Kong Country 3 | 3.0s | 13.7s | 0.1s | 2.8s | 13.7s |
| Factorio | 3.4s | 9.7s | 0.1s | 2.6s | 9.6s |
| Faxanadu | 3.1s | 6.8s | 0.1s | 3.0s | 8.8s |
| Final Fantasy Mystic Quest | 3.9s | 10.7s | 0.1s | 2.9s | 10.8s |
| Heretic | 2.7s | 14.6s | 0.1s | 2.5s | 14.5s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 2.7s | 14.3s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s |
| Kingdom Hearts | 9.1s | 31.1s | 0.1s | 3.0s | 24.8s |
| Kingdom Hearts 2 | 5.4s | 14.8s | 0.2s | 2.7s | - |
| Kirby's Dream Land 3 | 4.7s | 55.0s | 0.1s | 3.3s | 57.1s |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 2.8s | 17.7s |
| Links Awakening DX | 9.3s | 16.7s | 0.1s | 3.0s | 16.7s |
| Lufia II Ancient Cave | 3.0s | 5.8s | 0.1s | 2.9s | 5.8s |
| Mario & Luigi Superstar Saga | 3.7s | 23.9s | 0.1s | 3.1s | 8.7s |
| MathProof2p2e4 | 2.4s | 5.6s | 0.1s | 2.4s | 5.4s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.9s | 7.7s |
| Meritous | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s |
| Metamath | 11.1s | 5.6s | 0.1s | 3.0s | 5.8s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.8s | - |
| Noita | 2.8s | 5.7s | 0.1s | 2.8s | 5.6s |
| Old School Runescape | 4.3s | 8.6s | 0.1s | 2.7s | 8.6s |
| Overcooked! 2 | 3.2s | 22.0s | 0.1s | 3.1s | 19.9s |
| Paint | 2.8s | 6.8s | 0.1s | 2.6s | - |
| Risk of Rain 2 | 2.6s | 6.5s | 0.1s | 2.5s | 6.5s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.9s | 9.7s |
| Sonic Adventure 2 Battle | 3.4s | 13.8s | 0.1s | 3.0s | 16.8s |
| Starcraft 2 | 6.7s | 34.8s | 0.1s | 2.8s | - |
| Stardew Valley | 5.7s | 78.7s | 0.2s | 2.8s | - |
| Subnautica | 26.6s | 14.3s | 0.1s | 2.6s | - |
| Super Mario 64 | 2.8s | 12.6s | 0.1s | 2.7s | 12.6s |
| Super Mario Land 2 | 4.2s | 8.0s | 0.1s | 2.9s | - |
| Super Mario World | 4.2s | 6.7s | 0.1s | 2.9s | 6.7s |
| Super Metroid | 10.0s | 10.5s | 0.1s | 2.5s | 12.5s |
| TOEM original | 2.7s | 8.8s | 0.1s | 2.8s | 9.7s |
| TOEM rule builder | 2.9s | 8.7s | 0.1s | 2.9s | 9.8s |
| Terraria | 3.0s | 20.9s | 0.1s | 2.7s | - |
| The Legend of Zelda | 5.0s | 8.8s | 0.1s | 3.2s | 10.7s |
| The Messenger | 3.4s | 12.9s | 0.1s | 2.8s | - |
| The Wind Waker | 17.1s | 9.7s | 0.1s | 2.8s | 14.4s |
| Timespinner | 3.2s | 7.6s | 0.1s | 2.7s | 6.6s |
| Undertale | 3.1s | 5.8s | 0.1s | 3.0s | 5.8s |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s |
| Wargroove | 2.5s | 6.4s | 0.1s | 2.4s | 6.4s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s |
| Yacht Dice | 3.4s | 8.7s | 0.1s | 2.7s | - |
| Yoshi's Island | 3.7s | 9.7s | 0.1s | 3.0s | 8.7s |
| shapez | 4.8s | 6.7s | 0.1s | 3.0s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.6s |
| 2 | The Wind Waker | 17.1s |
| 3 | Bomb Rush Cyberfunk | 11.6s |
| 4 | Metamath | 11.1s |
| 5 | Super Metroid | 10.0s |
| 6 | A Link to the Past | 9.9s |
| 7 | Links Awakening DX | 9.3s |
| 8 | Kingdom Hearts | 9.1s |
| 9 | Aquaria | 7.1s |
| 10 | Starcraft 2 | 6.7s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 78.7s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Starcraft 2 | 34.8s |
| 4 | Kingdom Hearts | 31.1s |
| 5 | Dark Souls III | 25.8s |
| 6 | Mario & Luigi Superstar Saga | 23.9s |
| 7 | Overcooked! 2 | 22.0s |
| 8 | Bomb Rush Cyberfunk | 21.4s |
| 9 | Terraria | 20.9s |
| 10 | A Link to the Past | 19.0s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | Aquaria | 0.1s |
| 6 | Bomb Rush Cyberfunk | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Short Hike | 0.1s |
| 9 | Castlevania 64 | 0.1s |
| 10 | Celeste (Open World) | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.7s |
| 2 | DOOM II | 3.3s |
| 3 | Dark Souls III | 3.3s |
| 4 | Kirby's Dream Land 3 | 3.3s |
| 5 | The Legend of Zelda | 3.2s |
| 6 | A Link to the Past | 3.1s |
| 7 | Overcooked! 2 | 3.1s |
| 8 | Mario & Luigi Superstar Saga | 3.1s |
| 9 | Castlevania - Circle of the Moon | 3.0s |
| 10 | shapez | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 57.1s |
| 2 | Bomb Rush Cyberfunk | 29.5s |
| 3 | Dark Souls III | 24.8s |
| 4 | Kingdom Hearts | 24.8s |
| 5 | Overcooked! 2 | 19.9s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | A Link to the Past | 17.6s |
| 8 | DOOM II | 16.9s |
| 9 | Sonic Adventure 2 Battle | 16.8s |
| 10 | Links Awakening DX | 16.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 312.6s | 872.4s | 5.9s | 194.8s | 685.7s |
| Average | 4.5s | 12.6s | 0.1s | 2.8s | 12.0s |
| Max | 26.5s | 79.0s | 0.2s | 3.9s | 66.9s |
| Min | 2.6s | 5.6s | 0.1s | 2.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.5s) | Stardew Valley (79.0s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (3.9s) | A Link to the Past (66.9s) |
| Fastest | ChecksFinder (2.6s) | Metamath (5.6s) | shapez (0.1s) | Yacht Dice (2.5s) | Metamath (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.6s | 16.6s | 0.1s | 2.7s | - |
| A Link to the Past | 10.4s | 22.7s | 0.2s | 3.4s | 66.9s |
| A Short Hike | 2.9s | 13.8s | 0.1s | 2.7s | 9.6s |
| APQuest | 2.9s | 7.5s | 0.1s | 2.7s | 5.6s |
| Adventure | 3.0s | 6.5s | 0.1s | 3.0s | 5.8s |
| Aquaria | 7.0s | 8.3s | 0.1s | 2.5s | - |
| Bomb Rush Cyberfunk | 11.2s | 22.6s | 0.1s | 2.9s | 29.4s |
| Bumper Stickers | 2.9s | 9.8s | 0.1s | 2.7s | 8.7s |
| Castlevania - Circle of the Moon | 2.9s | 8.5s | 0.1s | 2.6s | 5.6s |
| Castlevania 64 | 3.4s | 11.1s | 0.1s | 3.0s | 6.7s |
| Celeste (Open World) | 3.9s | 13.7s | 0.1s | 3.9s | 14.8s |
| Celeste 64 | 3.1s | 6.6s | 0.1s | 2.8s | 7.7s |
| ChecksFinder | 2.6s | 6.7s | 0.1s | 2.7s | 6.6s |
| ChocolateChipCookies | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Choo-Choo Charles | 2.9s | 10.8s | 0.1s | 3.0s | 9.8s |
| Civilization VI | 2.8s | 8.8s | 0.1s | 2.7s | 8.7s |
| DLCQuest | 2.9s | 5.6s | 0.1s | 2.8s | 5.7s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 2.9s | 14.7s | 0.1s | 2.7s | 14.7s |
| Dark Souls III | 5.1s | 25.9s | 0.1s | 3.2s | 23.8s |
| Donkey Kong Country 3 | 2.9s | 13.7s | 0.1s | 2.7s | 13.7s |
| Factorio | 3.6s | 9.7s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 2.7s | 6.6s | 0.1s | 2.7s | 8.6s |
| Final Fantasy Mystic Quest | 3.7s | 10.8s | 0.1s | 2.8s | 10.7s |
| Heretic | 3.1s | 15.0s | 0.1s | 3.1s | 15.8s |
| Hylics 2 | 3.7s | 6.6s | 0.1s | 2.7s | 14.3s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s |
| Kingdom Hearts | 8.4s | 27.8s | 0.1s | 2.9s | 22.7s |
| Kingdom Hearts 2 | 5.2s | 14.8s | 0.2s | 2.9s | - |
| Kirby's Dream Land 3 | 4.9s | 57.7s | 0.1s | 3.4s | 57.0s |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.9s | 17.7s |
| Links Awakening DX | 9.6s | 16.8s | 0.1s | 3.4s | 16.8s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 24.3s | 0.1s | 3.0s | 8.7s |
| MathProof2p2e4 | 2.8s | 5.8s | 0.1s | 2.9s | 5.7s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.7s | 6.7s |
| MegaMan Battle Network 3 | 2.9s | 8.7s | 0.1s | 2.8s | 7.7s |
| Meritous | 2.8s | 5.7s | 0.1s | 2.8s | 5.6s |
| Metamath | 10.9s | 5.6s | 0.1s | 2.6s | 5.6s |
| Muse Dash | 3.2s | 7.7s | 0.1s | 2.8s | - |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Old School Runescape | 4.5s | 8.7s | 0.1s | 3.0s | 8.7s |
| Overcooked! 2 | 2.9s | 20.7s | 0.1s | 2.8s | 19.7s |
| Paint | 2.8s | 6.7s | 0.1s | 2.6s | - |
| Risk of Rain 2 | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s |
| Saving Princess | 2.7s | 5.7s | 0.1s | 2.7s | 6.7s |
| Shivers | 3.0s | 9.6s | 0.1s | 2.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.0s | 31.7s | 0.1s | 2.6s | - |
| Stardew Valley | 5.7s | 79.0s | 0.2s | 3.6s | - |
| Subnautica | 26.5s | 14.5s | 0.1s | 2.5s | - |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 2.9s | 12.7s |
| Super Mario Land 2 | 3.8s | 7.7s | 0.1s | 2.5s | - |
| Super Mario World | 4.1s | 6.7s | 0.1s | 2.8s | 6.7s |
| Super Metroid | 11.8s | 10.8s | 0.1s | 2.9s | 12.8s |
| TOEM original | 2.7s | 8.6s | 0.1s | 2.7s | 8.7s |
| TOEM rule builder | 2.7s | 8.6s | 0.1s | 2.7s | 9.7s |
| Terraria | 3.0s | 19.8s | 0.1s | 2.6s | - |
| The Legend of Zelda | 4.4s | 8.6s | 0.1s | 2.7s | 10.6s |
| The Messenger | 3.4s | 12.9s | 0.1s | 2.8s | - |
| The Wind Waker | 16.5s | 9.7s | 0.1s | 2.8s | 14.3s |
| Timespinner | 3.4s | 7.7s | 0.1s | 2.8s | 6.6s |
| Undertale | 2.8s | 5.6s | 0.1s | 2.6s | 5.6s |
| VVVVVV | 2.7s | 5.7s | 0.1s | 2.8s | 5.7s |
| Wargroove | 3.0s | 6.8s | 0.1s | 2.9s | 6.7s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s |
| Yacht Dice | 3.3s | 9.7s | 0.1s | 2.5s | - |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 8.7s |
| shapez | 4.0s | 6.6s | 0.1s | 2.6s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.5s |
| 2 | The Wind Waker | 16.5s |
| 3 | Super Metroid | 11.8s |
| 4 | Bomb Rush Cyberfunk | 11.2s |
| 5 | Metamath | 10.9s |
| 6 | A Link to the Past | 10.4s |
| 7 | Links Awakening DX | 9.6s |
| 8 | Kingdom Hearts | 8.4s |
| 9 | Aquaria | 7.0s |
| 10 | Starcraft 2 | 6.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 79.0s |
| 2 | Kirby's Dream Land 3 | 57.7s |
| 3 | Starcraft 2 | 31.7s |
| 4 | Kingdom Hearts | 27.8s |
| 5 | Dark Souls III | 25.9s |
| 6 | Mario & Luigi Superstar Saga | 24.3s |
| 7 | A Link to the Past | 22.7s |
| 8 | Bomb Rush Cyberfunk | 22.6s |
| 9 | Overcooked! 2 | 20.7s |
| 10 | Terraria | 19.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.2s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Bomb Rush Cyberfunk | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | Subnautica | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.9s |
| 2 | Stardew Valley | 3.6s |
| 3 | A Link to the Past | 3.4s |
| 4 | Links Awakening DX | 3.4s |
| 5 | Kirby's Dream Land 3 | 3.4s |
| 6 | Dark Souls III | 3.2s |
| 7 | Heretic | 3.1s |
| 8 | Choo-Choo Charles | 3.0s |
| 9 | Castlevania 64 | 3.0s |
| 10 | Mario & Luigi Superstar Saga | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 66.9s |
| 2 | Kirby's Dream Land 3 | 57.0s |
| 3 | Bomb Rush Cyberfunk | 29.4s |
| 4 | Dark Souls III | 23.8s |
| 5 | Kingdom Hearts | 22.7s |
| 6 | Overcooked! 2 | 19.7s |
| 7 | Landstalker - The Treasures of King Nole | 17.7s |
| 8 | Links Awakening DX | 16.8s |
| 9 | Sonic Adventure 2 Battle | 16.7s |
| 10 | Heretic | 15.8s |
