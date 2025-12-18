# World Generator Test Results

**Generated:** 2025-12-18 06:07:01 UTC
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
| Total | 306.8s | 877.8s | 5.9s | 194.2s | 735.5s |
| Average | 4.4s | 12.7s | 0.1s | 2.8s | 11.5s |
| Max | 24.0s | 77.7s | 0.2s | 3.6s | 55.6s |
| Min | 2.5s | 5.5s | 0.1s | 2.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (24.0s) | Stardew Valley (77.7s) | Kingdom Hearts 2 (0.2s) | Starcraft 2 (3.6s) | Kirby's Dream Land 3 (55.6s) |
| Fastest | MathProof2p2e4 (2.5s) | Noita (5.5s) | Wargroove (0.1s) | Wargroove (2.5s) | Noita (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.2s | 18.1s | 0.1s | 2.6s | 17.1s |
| A Link to the Past | 9.7s | 19.4s | 0.2s | 3.4s | 21.9s |
| A Short Hike | 2.9s | 12.0s | 0.1s | 2.8s | 9.7s |
| APQuest | 3.0s | 8.7s | 0.1s | 2.8s | 5.7s |
| Adventure | 2.6s | 7.1s | 0.1s | 2.5s | 5.5s |
| Aquaria | 7.2s | 8.7s | 0.1s | 2.9s | 7.7s |
| Bomb Rush Cyberfunk | 11.6s | 22.6s | 0.1s | 2.9s | 29.3s |
| Bumper Stickers | 2.9s | 9.5s | 0.1s | 2.8s | 8.7s |
| Castlevania - Circle of the Moon | 3.3s | 7.7s | 0.1s | 3.0s | 5.7s |
| Castlevania 64 | 3.1s | 9.3s | 0.1s | 2.8s | 6.7s |
| Celeste (Open World) | 3.8s | 14.6s | 0.1s | 3.5s | 14.6s |
| Celeste 64 | 2.9s | 6.7s | 0.1s | 2.8s | 7.7s |
| ChecksFinder | 2.7s | 6.6s | 0.1s | 2.7s | 6.6s |
| ChocolateChipCookies | 2.6s | 5.7s | 0.1s | 2.8s | 5.7s |
| Choo-Choo Charles | 2.6s | 9.5s | 0.1s | 2.6s | 9.5s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s |
| DLCQuest | 3.2s | 5.7s | 0.1s | 2.8s | 5.7s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.3s | 15.8s | 0.1s | 3.1s | 15.8s |
| Dark Souls III | 4.9s | 24.8s | 0.1s | 3.1s | 24.8s |
| Donkey Kong Country 3 | 2.8s | 14.6s | 0.1s | 2.7s | 14.5s |
| Factorio | 3.4s | 9.7s | 0.1s | 2.7s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.7s | 8.7s |
| Final Fantasy Mystic Quest | 3.8s | 10.8s | 0.1s | 2.9s | 10.7s |
| Heretic | 2.8s | 14.6s | 0.1s | 2.6s | 14.6s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.8s | 14.3s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.8s | 6.6s |
| Kingdom Hearts | 9.1s | 30.0s | 0.1s | 3.2s | 23.9s |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.2s | 3.5s | 14.8s |
| Kirby's Dream Land 3 | 4.6s | 55.0s | 0.1s | 3.1s | 55.6s |
| Landstalker - The Treasures of King Nole | 3.0s | 8.5s | 0.1s | 2.7s | 18.6s |
| Links Awakening DX | 9.2s | 16.8s | 0.1s | 3.1s | 16.8s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Mario & Luigi Superstar Saga | 3.6s | 9.7s | 0.1s | 2.9s | 8.7s |
| MathProof2p2e4 | 2.5s | 5.5s | 0.1s | 2.5s | 5.5s |
| Mega Man 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 7.7s |
| Meritous | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Metamath | 10.9s | 5.8s | 0.1s | 2.9s | 5.7s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.6s | 5.5s | 0.1s | 2.5s | 5.5s |
| Old School Runescape | 4.3s | 8.7s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 2.9s | 20.8s | 0.1s | 2.8s | 19.7s |
| Paint | 2.8s | 6.8s | 0.1s | 2.7s | 6.7s |
| Risk of Rain 2 | 2.6s | 6.5s | 0.1s | 2.5s | 6.5s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.5s | 28.9s | 0.1s | 3.6s | 15.0s |
| Stardew Valley | 5.7s | 77.7s | 0.2s | 2.7s | - |
| Subnautica | 24.0s | 14.5s | 0.1s | 3.0s | 14.3s |
| Super Mario 64 | 2.8s | 12.7s | 0.1s | 2.8s | 12.7s |
| Super Mario Land 2 | 3.8s | 7.8s | 0.1s | 2.5s | - |
| Super Mario World | 4.1s | 6.7s | 0.1s | 2.8s | 6.7s |
| Super Metroid | 10.4s | 10.5s | 0.1s | 2.5s | 11.5s |
| TOEM original | 2.8s | 9.7s | 0.1s | 2.8s | 8.7s |
| TOEM rule builder | 3.0s | 9.7s | 0.1s | 2.8s | 9.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.8s | 19.8s |
| The Legend of Zelda | 4.8s | 8.8s | 0.1s | 3.0s | 10.8s |
| The Messenger | 3.3s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 14.5s | 9.5s | 0.1s | 2.7s | 14.0s |
| Timespinner | 3.2s | 7.6s | 0.1s | 2.7s | 6.7s |
| Undertale | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.7s | 5.7s |
| Wargroove | 2.6s | 6.5s | 0.1s | 2.5s | 6.5s |
| WebDevJourney | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s |
| Yacht Dice | 3.6s | 8.7s | 0.1s | 2.6s | - |
| Yoshi's Island | 3.6s | 9.7s | 0.1s | 2.8s | 8.7s |
| shapez | 4.5s | 6.7s | 0.1s | 3.0s | 6.8s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 24.0s |
| 2 | The Wind Waker | 14.5s |
| 3 | Bomb Rush Cyberfunk | 11.6s |
| 4 | Metamath | 10.9s |
| 5 | Super Metroid | 10.4s |
| 6 | A Link to the Past | 9.7s |
| 7 | Links Awakening DX | 9.2s |
| 8 | Kingdom Hearts | 9.1s |
| 9 | Aquaria | 7.2s |
| 10 | Starcraft 2 | 6.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 77.7s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Kingdom Hearts | 30.0s |
| 5 | Starcraft 2 | 28.9s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 22.6s |
| 8 | Terraria | 20.8s |
| 9 | Overcooked! 2 | 20.8s |
| 10 | A Link to the Past | 19.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.2s |
| 4 | Starcraft 2 | 0.1s |
| 5 | Bomb Rush Cyberfunk | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Castlevania - Circle of the Moon | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | A Hat in Time | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Starcraft 2 | 3.6s |
| 2 | Celeste (Open World) | 3.5s |
| 3 | Kingdom Hearts 2 | 3.5s |
| 4 | A Link to the Past | 3.4s |
| 5 | Kingdom Hearts | 3.2s |
| 6 | Dark Souls III | 3.1s |
| 7 | Kirby's Dream Land 3 | 3.1s |
| 8 | DOOM II | 3.1s |
| 9 | Links Awakening DX | 3.1s |
| 10 | The Legend of Zelda | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 55.6s |
| 2 | Bomb Rush Cyberfunk | 29.3s |
| 3 | Dark Souls III | 24.8s |
| 4 | Kingdom Hearts | 23.9s |
| 5 | A Link to the Past | 21.9s |
| 6 | Terraria | 19.8s |
| 7 | Overcooked! 2 | 19.7s |
| 8 | Landstalker - The Treasures of King Nole | 18.6s |
| 9 | A Hat in Time | 17.1s |
| 10 | Links Awakening DX | 16.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 313.5s | 876.7s | 5.9s | 198.8s | 788.2s |
| Average | 4.5s | 12.7s | 0.1s | 2.9s | 12.3s |
| Max | 27.0s | 76.6s | 0.2s | 3.9s | 61.5s |
| Min | 2.6s | 5.6s | 0.1s | 2.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (27.0s) | Stardew Valley (76.6s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (3.9s) | Starcraft 2 (61.5s) |
| Fastest | Mega Man 2 (2.6s) | Saving Princess (5.6s) | Mega Man 2 (0.1s) | Super Mario Land 2 (2.5s) | Castlevania - Circle of the Moon (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.8s | 14.3s | 0.1s | 2.9s | 17.5s |
| A Link to the Past | 9.8s | 22.0s | 0.2s | 3.4s | 23.9s |
| A Short Hike | 3.0s | 11.5s | 0.1s | 2.7s | 9.6s |
| APQuest | 3.0s | 7.6s | 0.1s | 2.9s | 5.7s |
| Adventure | 3.0s | 8.4s | 0.1s | 2.9s | 5.7s |
| Aquaria | 6.8s | 10.0s | 0.1s | 2.8s | 7.7s |
| Bomb Rush Cyberfunk | 11.5s | 24.4s | 0.1s | 3.0s | 29.4s |
| Bumper Stickers | 2.8s | 10.6s | 0.1s | 2.6s | 8.6s |
| Castlevania - Circle of the Moon | 2.9s | 9.7s | 0.1s | 2.7s | 5.6s |
| Castlevania 64 | 3.1s | 8.2s | 0.1s | 2.8s | 6.7s |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 3.9s | 14.8s |
| Celeste 64 | 3.0s | 6.8s | 0.1s | 2.7s | 7.6s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.7s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 3.0s | 10.8s | 0.1s | 3.0s | 10.8s |
| Civilization VI | 3.1s | 8.7s | 0.1s | 2.7s | 8.5s |
| DLCQuest | 3.1s | 5.7s | 0.1s | 2.9s | 5.7s |
| DOOM 1993 | 2.9s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.0s | 14.8s | 0.1s | 2.8s | 14.7s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 3.1s | 23.8s |
| Donkey Kong Country 3 | 3.0s | 13.7s | 0.1s | 2.8s | 13.7s |
| Factorio | 3.4s | 9.7s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.7s | 8.7s |
| Final Fantasy Mystic Quest | 3.9s | 10.8s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.2s | 14.9s | 0.1s | 3.1s | 15.8s |
| Hylics 2 | 3.7s | 6.5s | 0.1s | 2.7s | 14.4s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.9s | 6.7s |
| Kingdom Hearts | 8.5s | 27.8s | 0.1s | 3.0s | 22.8s |
| Kingdom Hearts 2 | 5.1s | 41.3s | 0.2s | 3.6s | 14.6s |
| Kirby's Dream Land 3 | 4.4s | 54.6s | 0.1s | 3.1s | 56.0s |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 2.9s | 17.7s |
| Links Awakening DX | 9.1s | 16.8s | 0.1s | 3.2s | 16.8s |
| Lufia II Ancient Cave | 2.8s | 5.8s | 0.1s | 2.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.8s | 9.8s | 0.1s | 3.1s | 8.8s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mega Man 2 | 2.6s | 6.5s | 0.1s | 2.6s | 6.6s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.6s | 5.6s |
| Metamath | 9.9s | 5.6s | 0.1s | 2.7s | 5.6s |
| Muse Dash | 2.9s | 7.6s | 0.1s | 2.6s | - |
| Noita | 2.8s | 5.6s | 0.1s | 2.7s | 5.7s |
| Old School Runescape | 4.4s | 8.7s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 3.1s | 20.8s | 0.1s | 2.8s | 19.8s |
| Paint | 2.9s | 7.9s | 0.1s | 3.0s | 7.7s |
| Risk of Rain 2 | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.9s | 6.7s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.8s | 9.7s |
| Sonic Adventure 2 Battle | 3.1s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.1s | 28.8s | 0.1s | 3.3s | 61.5s |
| Stardew Valley | 5.5s | 76.6s | 0.2s | 3.4s | - |
| Subnautica | 27.0s | 14.7s | 0.1s | 3.1s | 14.6s |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.8s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.8s | 0.1s | 2.5s | - |
| Super Mario World | 4.3s | 6.7s | 0.1s | 3.0s | 6.8s |
| Super Metroid | 11.9s | 10.7s | 0.1s | 3.1s | 12.7s |
| TOEM original | 2.8s | 9.6s | 0.1s | 2.8s | 9.7s |
| TOEM rule builder | 3.1s | 8.7s | 0.1s | 2.8s | 9.7s |
| Terraria | 2.8s | 19.8s | 0.1s | 2.7s | 19.7s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | 2.8s | 10.7s |
| The Messenger | 3.3s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 16.8s | 9.8s | 0.1s | 2.8s | 14.4s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.8s | 6.7s |
| Undertale | 2.9s | 5.6s | 0.1s | 2.7s | 5.6s |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Wargroove | 3.0s | 6.7s | 0.1s | 2.8s | 6.7s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 3.0s | 8.7s |
| Yacht Dice | 3.5s | 8.8s | 0.1s | 2.6s | - |
| Yoshi's Island | 3.4s | 9.7s | 0.1s | 2.8s | 8.6s |
| shapez | 4.2s | 6.6s | 0.1s | 2.7s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.0s |
| 2 | The Wind Waker | 16.8s |
| 3 | Super Metroid | 11.9s |
| 4 | Bomb Rush Cyberfunk | 11.5s |
| 5 | Metamath | 9.9s |
| 6 | A Link to the Past | 9.8s |
| 7 | Links Awakening DX | 9.1s |
| 8 | Kingdom Hearts | 8.5s |
| 9 | Aquaria | 6.8s |
| 10 | Starcraft 2 | 6.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 76.6s |
| 2 | Kirby's Dream Land 3 | 54.6s |
| 3 | Kingdom Hearts 2 | 41.3s |
| 4 | Starcraft 2 | 28.8s |
| 5 | Kingdom Hearts | 27.8s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 24.4s |
| 8 | A Link to the Past | 22.0s |
| 9 | Overcooked! 2 | 20.8s |
| 10 | Terraria | 19.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.2s |
| 4 | Bomb Rush Cyberfunk | 0.1s |
| 5 | Castlevania 64 | 0.1s |
| 6 | Starcraft 2 | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Aquaria | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.9s |
| 2 | Kingdom Hearts 2 | 3.6s |
| 3 | A Link to the Past | 3.4s |
| 4 | Stardew Valley | 3.4s |
| 5 | Starcraft 2 | 3.3s |
| 6 | Links Awakening DX | 3.2s |
| 7 | Mario & Luigi Superstar Saga | 3.1s |
| 8 | Subnautica | 3.1s |
| 9 | Kirby's Dream Land 3 | 3.1s |
| 10 | Dark Souls III | 3.1s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Starcraft 2 | 61.5s |
| 2 | Kirby's Dream Land 3 | 56.0s |
| 3 | Bomb Rush Cyberfunk | 29.4s |
| 4 | A Link to the Past | 23.9s |
| 5 | Dark Souls III | 23.8s |
| 6 | Kingdom Hearts | 22.8s |
| 7 | Overcooked! 2 | 19.8s |
| 8 | Terraria | 19.7s |
| 9 | Landstalker - The Treasures of King Nole | 17.7s |
| 10 | A Hat in Time | 17.5s |
