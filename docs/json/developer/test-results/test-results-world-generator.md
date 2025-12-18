# World Generator Test Results

**Generated:** 2025-12-18 04:24:04 UTC
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
| Test Seed Generation | 61 | 8 | 69 |
| Test Spoiler Test | 56 | 5 | 61 |
| Cross-Validation | 39 | 22 | 61 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ❌ | ✅ | ❌ | - | - |
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
| Original Spoiler Test | 66 | 3 | 69 |
| Test World Generation | 69 | 0 | 69 |
| Test Seed Generation | 61 | 8 | 69 |
| Test Spoiler Test | 56 | 5 | 61 |
| Cross-Validation | 18 | 43 | 61 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ❌ | ✅ | ❌ | - | - |
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
| Total | 296.7s | 874.9s | 5.7s | 188.2s | 700.7s |
| Average | 4.3s | 12.7s | 0.1s | 2.7s | 11.5s |
| Max | 23.5s | 79.7s | 0.2s | 3.4s | 58.4s |
| Min | 2.4s | 5.4s | 0.1s | 2.3s | 5.4s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (23.5s) | Stardew Valley (79.7s) | Kingdom Hearts 2 (0.2s) | Starcraft 2 (3.4s) | Kirby's Dream Land 3 (58.4s) |
| Fastest | MathProof2p2e4 (2.4s) | Noita (5.4s) | Wargroove (0.1s) | Subnautica (2.3s) | Noita (5.4s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.1s | 14.8s | 0.1s | 2.5s | 16.9s |
| A Link to the Past | 9.8s | 20.3s | 0.2s | 3.4s | 21.5s |
| A Short Hike | 3.1s | 12.2s | 0.1s | 2.9s | 9.7s |
| APQuest | 2.8s | 10.1s | 0.1s | 2.6s | 5.6s |
| Adventure | 2.6s | 8.0s | 0.1s | 2.5s | 5.5s |
| Aquaria | 7.1s | 12.1s | 0.1s | 2.7s | - |
| Bomb Rush Cyberfunk | 10.4s | 24.5s | 0.1s | 2.8s | 29.4s |
| Bumper Stickers | 2.9s | 13.6s | 0.1s | 2.7s | 8.6s |
| Castlevania - Circle of the Moon | 3.0s | 6.9s | 0.1s | 2.7s | 5.7s |
| Castlevania 64 | 2.9s | 12.6s | 0.1s | 2.7s | 6.5s |
| Celeste (Open World) | 3.6s | 14.6s | 0.1s | 3.3s | 14.5s |
| Celeste 64 | 3.0s | 6.6s | 0.1s | 2.7s | 7.7s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 2.9s | 6.7s |
| ChocolateChipCookies | 2.6s | 5.6s | 0.1s | 2.6s | 5.6s |
| Choo-Choo Charles | 2.6s | 10.5s | 0.1s | 2.5s | 10.6s |
| Civilization VI | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s |
| DLCQuest | 2.9s | 5.5s | 0.1s | 2.7s | 5.5s |
| DOOM 1993 | 2.9s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.0s | 15.8s | 0.1s | 2.8s | 14.8s |
| Dark Souls III | 4.5s | 24.6s | 0.1s | 3.0s | 24.7s |
| Donkey Kong Country 3 | 2.6s | 13.6s | 0.1s | 2.4s | 14.5s |
| Factorio | 3.4s | 9.7s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 3.0s | 6.7s | 0.1s | 2.9s | 8.7s |
| Final Fantasy Mystic Quest | 3.6s | 10.7s | 0.1s | 2.7s | 10.7s |
| Heretic | 2.8s | 14.7s | 0.1s | 2.6s | 14.5s |
| Hylics 2 | 3.6s | 6.7s | 0.1s | 3.0s | 14.4s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.7s | 6.5s |
| Kingdom Hearts | 8.6s | 28.9s | 0.1s | 2.9s | 23.8s |
| Kingdom Hearts 2 | 5.2s | 14.6s | 0.2s | 2.6s | - |
| Kirby's Dream Land 3 | 4.2s | 57.7s | 0.1s | 3.0s | 58.4s |
| Landstalker - The Treasures of King Nole | 2.8s | 8.4s | 0.1s | 2.4s | 17.5s |
| Links Awakening DX | 9.4s | 16.7s | 0.1s | 3.1s | 16.8s |
| Lufia II Ancient Cave | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mario & Luigi Superstar Saga | 3.5s | 23.3s | 0.1s | 2.9s | 8.6s |
| MathProof2p2e4 | 2.4s | 5.5s | 0.1s | 2.4s | 5.4s |
| Mega Man 2 | 2.7s | 6.7s | 0.1s | 2.9s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.8s | 8.5s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s |
| Metamath | 10.0s | 5.6s | 0.1s | 2.7s | 5.6s |
| Muse Dash | 2.8s | 7.5s | 0.1s | 2.5s | - |
| Noita | 2.5s | 5.4s | 0.1s | 2.4s | 5.4s |
| Old School Runescape | 4.4s | 8.7s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 3.1s | 21.8s | 0.1s | 3.0s | 19.8s |
| Paint | 2.7s | 6.6s | 0.1s | 2.6s | 6.6s |
| Risk of Rain 2 | 2.6s | 6.4s | 0.1s | 2.5s | 6.5s |
| Saving Princess | 2.7s | 5.7s | 0.1s | 2.8s | 6.7s |
| Shivers | 3.1s | 9.6s | 0.1s | 2.7s | 9.5s |
| Sonic Adventure 2 Battle | 3.1s | 13.6s | 0.1s | 2.7s | 16.7s |
| Starcraft 2 | 6.2s | 28.8s | 0.1s | 3.4s | 14.8s |
| Stardew Valley | 5.2s | 79.7s | 0.2s | 2.6s | - |
| Subnautica | 23.5s | 13.8s | 0.1s | 2.3s | - |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.7s | 12.7s |
| Super Mario Land 2 | 4.0s | 7.8s | 0.1s | 2.7s | - |
| Super Mario World | 3.9s | 6.6s | 0.1s | 2.7s | 6.6s |
| Super Metroid | 10.2s | 10.5s | 0.1s | 2.5s | 12.5s |
| TOEM original | 2.7s | 8.7s | 0.1s | 2.9s | 9.7s |
| TOEM rule builder | 2.7s | 9.6s | 0.1s | 2.7s | 9.6s |
| Terraria | 2.8s | 19.8s | 0.1s | 2.8s | 19.8s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | 2.8s | 10.7s |
| The Messenger | 3.0s | 12.7s | 0.1s | 2.5s | - |
| The Wind Waker | 14.2s | 9.4s | 0.1s | 2.5s | 13.8s |
| Timespinner | 3.3s | 7.6s | 0.1s | 2.8s | 6.6s |
| Undertale | 3.1s | 5.7s | 0.1s | 2.8s | 5.7s |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s |
| Wargroove | 2.5s | 6.4s | 0.1s | 2.5s | 6.4s |
| WebDevJourney | 2.7s | 8.7s | 0.1s | 2.8s | 8.7s |
| Yacht Dice | 3.3s | 8.6s | 0.1s | 2.5s | - |
| Yoshi's Island | 3.4s | 9.7s | 0.1s | 2.8s | 8.6s |
| shapez | 4.2s | 6.7s | 0.1s | 2.8s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 23.5s |
| 2 | The Wind Waker | 14.2s |
| 3 | Bomb Rush Cyberfunk | 10.4s |
| 4 | Super Metroid | 10.2s |
| 5 | Metamath | 10.0s |
| 6 | A Link to the Past | 9.8s |
| 7 | Links Awakening DX | 9.4s |
| 8 | Kingdom Hearts | 8.6s |
| 9 | Aquaria | 7.1s |
| 10 | Starcraft 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 79.7s |
| 2 | Kirby's Dream Land 3 | 57.7s |
| 3 | Kingdom Hearts | 28.9s |
| 4 | Starcraft 2 | 28.8s |
| 5 | Dark Souls III | 24.6s |
| 6 | Bomb Rush Cyberfunk | 24.5s |
| 7 | Mario & Luigi Superstar Saga | 23.3s |
| 8 | Overcooked! 2 | 21.8s |
| 9 | A Link to the Past | 20.3s |
| 10 | Terraria | 19.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | A Link to the Past | 0.2s |
| 3 | Stardew Valley | 0.2s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Short Hike | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Bomb Rush Cyberfunk | 0.1s |
| 8 | A Hat in Time | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Starcraft 2 | 3.4s |
| 2 | A Link to the Past | 3.4s |
| 3 | Celeste (Open World) | 3.3s |
| 4 | Links Awakening DX | 3.1s |
| 5 | Dark Souls III | 3.0s |
| 6 | Kirby's Dream Land 3 | 3.0s |
| 7 | Hylics 2 | 3.0s |
| 8 | Overcooked! 2 | 3.0s |
| 9 | Kingdom Hearts | 2.9s |
| 10 | TOEM original | 2.9s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 58.4s |
| 2 | Bomb Rush Cyberfunk | 29.4s |
| 3 | Dark Souls III | 24.7s |
| 4 | Kingdom Hearts | 23.8s |
| 5 | A Link to the Past | 21.5s |
| 6 | Overcooked! 2 | 19.8s |
| 7 | Terraria | 19.8s |
| 8 | Landstalker - The Treasures of King Nole | 17.5s |
| 9 | A Hat in Time | 16.9s |
| 10 | Links Awakening DX | 16.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 317.7s | 865.8s | 6.0s | 202.3s | 755.0s |
| Average | 4.6s | 12.5s | 0.1s | 2.9s | 12.4s |
| Max | 26.7s | 76.8s | 0.2s | 4.0s | 62.7s |
| Min | 2.7s | 5.6s | 0.1s | 2.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.7s) | Stardew Valley (76.8s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (4.0s) | Starcraft 2 (62.7s) |
| Fastest | TOEM original (2.7s) | Saving Princess (5.6s) | Yacht Dice (0.1s) | Aquaria (2.5s) | Meritous (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.9s | 14.4s | 0.1s | 3.0s | 17.7s |
| A Link to the Past | 9.6s | 18.5s | 0.2s | 3.4s | 23.6s |
| A Short Hike | 3.1s | 14.5s | 0.1s | 3.0s | 9.7s |
| APQuest | 3.2s | 6.4s | 0.1s | 2.9s | 5.7s |
| Adventure | 3.0s | 6.5s | 0.1s | 2.8s | 5.7s |
| Aquaria | 7.1s | 8.4s | 0.1s | 2.5s | - |
| Bomb Rush Cyberfunk | 11.5s | 24.1s | 0.1s | 3.0s | 29.7s |
| Bumper Stickers | 2.9s | 9.2s | 0.1s | 2.7s | 8.6s |
| Castlevania - Circle of the Moon | 3.2s | 9.7s | 0.1s | 2.9s | 5.7s |
| Castlevania 64 | 3.0s | 9.7s | 0.1s | 2.8s | 6.7s |
| Celeste (Open World) | 4.1s | 14.8s | 0.1s | 4.0s | 14.8s |
| Celeste 64 | 2.9s | 6.8s | 0.1s | 2.8s | 7.7s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 3.0s | 6.7s |
| ChocolateChipCookies | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 3.0s | 10.8s | 0.1s | 3.0s | 9.7s |
| Civilization VI | 2.8s | 8.6s | 0.1s | 2.7s | 8.7s |
| DLCQuest | 3.2s | 5.9s | 0.1s | 3.0s | 5.9s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.2s | 15.8s | 0.1s | 3.1s | 15.9s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 3.1s | 23.8s |
| Donkey Kong Country 3 | 3.1s | 14.8s | 0.1s | 3.0s | 14.7s |
| Factorio | 3.4s | 9.8s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 2.9s | 6.7s | 0.1s | 2.9s | 8.7s |
| Final Fantasy Mystic Quest | 4.1s | 10.9s | 0.1s | 3.0s | 10.7s |
| Heretic | 3.2s | 14.8s | 0.1s | 3.0s | 14.8s |
| Hylics 2 | 3.7s | 6.7s | 0.1s | 2.7s | 14.5s |
| Inscryption | 3.0s | 6.8s | 0.1s | 3.0s | 6.8s |
| Kingdom Hearts | 8.9s | 29.1s | 0.1s | 3.1s | 23.8s |
| Kingdom Hearts 2 | 5.2s | 14.6s | 0.2s | 2.9s | - |
| Kirby's Dream Land 3 | 4.5s | 54.6s | 0.1s | 3.2s | 56.0s |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 3.0s | 17.8s |
| Links Awakening DX | 9.3s | 16.8s | 0.1s | 3.4s | 16.8s |
| Lufia II Ancient Cave | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mario & Luigi Superstar Saga | 4.0s | 24.7s | 0.1s | 3.1s | 8.7s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s |
| MegaMan Battle Network 3 | 3.2s | 8.8s | 0.1s | 3.1s | 8.8s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s |
| Metamath | 10.1s | 5.7s | 0.1s | 2.8s | 5.7s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Old School Runescape | 4.3s | 8.7s | 0.1s | 2.9s | 8.8s |
| Overcooked! 2 | 3.1s | 21.8s | 0.1s | 3.0s | 19.8s |
| Paint | 3.0s | 7.8s | 0.1s | 3.1s | 7.8s |
| Risk of Rain 2 | 3.0s | 6.7s | 0.1s | 2.8s | 6.7s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.7s | 6.6s |
| Shivers | 3.3s | 9.8s | 0.1s | 2.8s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.9s | 16.7s |
| Starcraft 2 | 6.5s | 28.9s | 0.1s | 3.6s | 62.7s |
| Stardew Valley | 5.5s | 76.8s | 0.2s | 3.5s | - |
| Subnautica | 26.7s | 14.5s | 0.1s | 2.8s | - |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.8s | 12.7s |
| Super Mario Land 2 | 4.0s | 7.9s | 0.1s | 2.7s | - |
| Super Mario World | 4.4s | 6.8s | 0.1s | 2.9s | 6.7s |
| Super Metroid | 11.8s | 10.7s | 0.1s | 3.0s | 12.8s |
| TOEM original | 2.7s | 8.7s | 0.1s | 2.7s | 8.7s |
| TOEM rule builder | 3.0s | 9.8s | 0.1s | 3.0s | 9.8s |
| Terraria | 2.8s | 19.8s | 0.1s | 2.8s | 19.8s |
| The Legend of Zelda | 4.8s | 8.8s | 0.1s | 3.0s | 10.7s |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 16.9s | 9.7s | 0.1s | 3.0s | 14.6s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.8s | 6.7s |
| Undertale | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s |
| VVVVVV | 3.0s | 5.7s | 0.1s | 2.8s | 5.7s |
| Wargroove | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s |
| WebDevJourney | 2.7s | 8.6s | 0.1s | 2.8s | 8.7s |
| Yacht Dice | 3.6s | 8.8s | 0.1s | 2.9s | - |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 8.7s |
| shapez | 4.4s | 6.7s | 0.1s | 2.9s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.7s |
| 2 | The Wind Waker | 16.9s |
| 3 | Super Metroid | 11.8s |
| 4 | Bomb Rush Cyberfunk | 11.5s |
| 5 | Metamath | 10.1s |
| 6 | A Link to the Past | 9.6s |
| 7 | Links Awakening DX | 9.3s |
| 8 | Kingdom Hearts | 8.9s |
| 9 | Aquaria | 7.1s |
| 10 | Starcraft 2 | 6.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 76.8s |
| 2 | Kirby's Dream Land 3 | 54.6s |
| 3 | Kingdom Hearts | 29.1s |
| 4 | Starcraft 2 | 28.9s |
| 5 | Dark Souls III | 24.8s |
| 6 | Mario & Luigi Superstar Saga | 24.7s |
| 7 | Bomb Rush Cyberfunk | 24.1s |
| 8 | Overcooked! 2 | 21.8s |
| 9 | Terraria | 19.8s |
| 10 | A Link to the Past | 18.5s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.2s |
| 4 | A Hat in Time | 0.1s |
| 5 | Bomb Rush Cyberfunk | 0.1s |
| 6 | Starcraft 2 | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Aquaria | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Subnautica | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 4.0s |
| 2 | Starcraft 2 | 3.6s |
| 3 | Stardew Valley | 3.5s |
| 4 | A Link to the Past | 3.4s |
| 5 | Links Awakening DX | 3.4s |
| 6 | Kirby's Dream Land 3 | 3.2s |
| 7 | Kingdom Hearts | 3.1s |
| 8 | Mario & Luigi Superstar Saga | 3.1s |
| 9 | Dark Souls III | 3.1s |
| 10 | Paint | 3.1s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Starcraft 2 | 62.7s |
| 2 | Kirby's Dream Land 3 | 56.0s |
| 3 | Bomb Rush Cyberfunk | 29.7s |
| 4 | Kingdom Hearts | 23.8s |
| 5 | Dark Souls III | 23.8s |
| 6 | A Link to the Past | 23.6s |
| 7 | Overcooked! 2 | 19.8s |
| 8 | Terraria | 19.8s |
| 9 | Landstalker - The Treasures of King Nole | 17.8s |
| 10 | A Hat in Time | 17.7s |
