# World Generator Test Results

**Generated:** 2025-12-22 05:44:47 UTC
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

**Total Templates:** 68

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 68 | 0 | 68 |
| Original Spoiler Test | 67 | 1 | 68 |
| Test World Generation | 62 | 6 | 68 |
| Test Seed Generation | 53 | 15 | 68 |
| Test Spoiler Test | 50 | 3 | 53 |
| Cross-Validation | 40 | 13 | 53 |

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
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
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
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 68

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 68 | 0 | 68 |
| Original Spoiler Test | 67 | 1 | 68 |
| Test World Generation | 62 | 6 | 68 |
| Test Seed Generation | 54 | 14 | 68 |
| Test Spoiler Test | 51 | 3 | 54 |
| Cross-Validation | 22 | 32 | 54 |

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
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
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
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Total | 314.2s | 852.3s | 6.4s | 175.3s | 538.9s | 579.6s |
| Average | 4.6s | 12.5s | 0.1s | 2.8s | 10.2s | 10.9s |
| Max | 26.9s | 72.9s | 0.5s | 3.9s | 22.8s | 58.8s |
| Min | 2.7s | 5.6s | 0.1s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (26.9s) | Stardew Valley (72.9s) | Kingdom Hearts 2 (0.5s) | Celeste (Open World) (3.9s) | Kingdom Hearts (22.8s) | Super Metroid (58.8s) |
| Fastest | ChecksFinder (2.7s) | Undertale (5.6s) | WebDevJourney (0.1s) | Super Mario Land 2 (2.5s) | Metamath (5.6s) | Castlevania - Circle of the Moon (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 5.0s | 15.2s | 0.1s | 2.6s | - | - |
| A Link to the Past | 10.1s | 18.9s | 0.1s | - | - | - |
| A Short Hike | 3.0s | 12.0s | 0.1s | 2.7s | 9.7s | 9.7s |
| APQuest | 3.2s | 7.2s | 0.1s | 2.9s | 5.7s | 5.7s |
| Adventure | 2.9s | 7.2s | 0.1s | 2.7s | 5.7s | 5.6s |
| Aquaria | 7.4s | 9.4s | 0.1s | 2.8s | 8.7s | 8.7s |
| Bomb Rush Cyberfunk | 11.6s | 24.5s | 0.1s | 2.8s | 18.7s | 14.8s |
| Bumper Stickers | 3.3s | 12.0s | 0.1s | 3.0s | 8.8s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 6.9s | 0.1s | 2.7s | 5.7s | 5.6s |
| Castlevania 64 | 3.2s | 8.9s | 0.1s | 3.0s | 6.8s | 6.8s |
| Celeste (Open World) | 4.1s | 14.8s | 0.1s | 3.9s | 14.8s | 14.8s |
| Celeste 64 | 2.9s | 6.7s | 0.1s | 2.9s | 7.7s | 6.7s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.8s | 10.7s | 9.8s |
| Civilization VI | 3.0s | 8.8s | 0.1s | 2.8s | 8.7s | 8.7s |
| DLCQuest | 3.0s | 5.6s | 0.1s | 2.8s | 5.6s | 5.7s |
| DOOM 1993 | 3.3s | 12.9s | 0.1s | 3.1s | 12.8s | 12.8s |
| DOOM II | 3.2s | 14.7s | 0.1s | 2.9s | 14.7s | 15.7s |
| Dark Souls III | 5.0s | 25.8s | 0.1s | 2.8s | - | - |
| Donkey Kong Country 3 | 3.0s | 14.7s | 0.1s | - | - | - |
| Factorio | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Faxanadu | 2.8s | 6.7s | 0.1s | 2.7s | 8.6s | 6.7s |
| Final Fantasy Mystic Quest | 3.9s | 10.8s | 0.1s | 3.0s | 10.7s | 10.7s |
| Heretic | 3.2s | 14.7s | 0.1s | 2.9s | 14.7s | 14.8s |
| Hylics 2 | 4.0s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.7s | 6.7s | 6.6s |
| Kingdom Hearts | 8.8s | 28.8s | 0.1s | 2.9s | 22.8s | 13.9s |
| Kingdom Hearts 2 | 5.8s | 43.1s | 0.5s | 2.8s | - | - |
| Kirby's Dream Land 3 | 4.8s | 56.7s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.9s | 17.7s | 8.7s |
| Links Awakening DX | 9.5s | 16.8s | 0.1s | 3.1s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 9.7s | 0.1s | 2.9s | 20.7s | 9.7s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 2.7s | 5.7s | 5.7s |
| Mega Man 2 | 3.0s | 6.7s | 0.1s | 2.7s | 6.6s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 7.7s | 0.1s | 2.7s | 7.6s | 14.3s |
| Meritous | 3.1s | 5.8s | 0.1s | 3.0s | 5.7s | 14.6s |
| Metamath | 10.0s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 7.8s | 0.1s | 2.8s | - | - |
| Noita | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Old School Runescape | 4.5s | 8.7s | 0.1s | 2.8s | 8.8s | 17.9s |
| Overcooked! 2 | 3.0s | 20.9s | 0.1s | 2.8s | 19.8s | 14.3s |
| Paint | 2.8s | 7.8s | 0.1s | 2.9s | 7.7s | 6.7s |
| Risk of Rain 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s | 14.4s |
| Saving Princess | 3.1s | 5.7s | 0.1s | 2.7s | 6.7s | 5.7s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.7s | 9.7s | 14.3s |
| Sonic Adventure 2 Battle | 3.6s | 13.8s | 0.1s | 3.1s | 16.8s | 13.8s |
| Starcraft 2 | 6.2s | 14.5s | 0.1s | 3.1s | 18.8s | 14.5s |
| Stardew Valley | 5.8s | 72.9s | 0.2s | 2.8s | - | - |
| Subnautica | 26.9s | 14.8s | 0.1s | 2.8s | 14.9s | 15.1s |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.7s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.8s | 7.7s | 0.1s | 2.5s | - | - |
| Super Mario World | 4.0s | 6.8s | 0.1s | - | - | - |
| Super Metroid | 11.4s | 10.7s | 0.1s | 2.8s | 12.7s | 58.8s |
| TOEM original | 3.0s | 9.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| Terraria | 3.2s | 20.9s | 0.1s | 2.7s | - | - |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.3s | 12.9s | 0.1s | 2.8s | - | - |
| The Wind Waker | 15.8s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.6s | - | - |
| Undertale | 2.9s | 5.6s | 0.1s | - | - | - |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Wargroove | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| WebDevJourney | 3.0s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 14.3s | 14.3s |
| shapez | 4.5s | 6.7s | 0.1s | 3.0s | 6.7s | 14.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.9s |
| 2 | The Wind Waker | 15.8s |
| 3 | Bomb Rush Cyberfunk | 11.6s |
| 4 | Super Metroid | 11.4s |
| 5 | A Link to the Past | 10.1s |
| 6 | Metamath | 10.0s |
| 7 | Links Awakening DX | 9.5s |
| 8 | Kingdom Hearts | 8.8s |
| 9 | Aquaria | 7.4s |
| 10 | Starcraft 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 72.9s |
| 2 | Kirby's Dream Land 3 | 56.7s |
| 3 | Kingdom Hearts 2 | 43.1s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Dark Souls III | 25.8s |
| 6 | Bomb Rush Cyberfunk | 24.5s |
| 7 | Overcooked! 2 | 20.9s |
| 8 | Terraria | 20.9s |
| 9 | A Link to the Past | 18.9s |
| 10 | Links Awakening DX | 16.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.1s |
| 4 | Bomb Rush Cyberfunk | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | Starcraft 2 | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.9s |
| 2 | Links Awakening DX | 3.1s |
| 3 | Sonic Adventure 2 Battle | 3.1s |
| 4 | Starcraft 2 | 3.1s |
| 5 | DOOM 1993 | 3.1s |
| 6 | The Wind Waker | 3.0s |
| 7 | Bumper Stickers | 3.0s |
| 8 | Castlevania 64 | 3.0s |
| 9 | Meritous | 3.0s |
| 10 | Final Fantasy Mystic Quest | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts | 22.8s |
| 2 | Mario & Luigi Superstar Saga | 20.7s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | Starcraft 2 | 18.8s |
| 5 | Bomb Rush Cyberfunk | 18.7s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Sonic Adventure 2 Battle | 16.8s |
| 8 | Links Awakening DX | 16.8s |
| 9 | Subnautica | 14.9s |
| 10 | Celeste (Open World) | 14.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 58.8s |
| 2 | Old School Runescape | 17.9s |
| 3 | Links Awakening DX | 16.8s |
| 4 | DOOM II | 15.7s |
| 5 | Subnautica | 15.1s |
| 6 | Bomb Rush Cyberfunk | 14.8s |
| 7 | Celeste (Open World) | 14.8s |
| 8 | Heretic | 14.8s |
| 9 | shapez | 14.7s |
| 10 | Meritous | 14.6s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Total | 310.9s | 857.1s | 6.3s | 180.8s | 552.0s | 692.2s |
| Average | 4.6s | 12.6s | 0.1s | 2.9s | 10.2s | 12.8s |
| Max | 26.9s | 71.8s | 0.5s | 8.3s | 22.7s | 58.7s |
| Min | 2.6s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (26.9s) | Stardew Valley (71.8s) | Kingdom Hearts 2 (0.5s) | Stardew Valley (8.3s) | Kingdom Hearts (22.7s) | Super Metroid (58.7s) |
| Fastest | ChecksFinder (2.6s) | DLCQuest (5.5s) | TOEM rule builder (0.1s) | Super Mario Land 2 (2.5s) | DLCQuest (5.5s) | DLCQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 5.1s | 18.6s | 0.1s | 3.1s | 13.7s | 17.2s |
| A Link to the Past | 9.9s | 21.8s | 0.1s | - | - | - |
| A Short Hike | 2.9s | 14.7s | 0.1s | 2.6s | 9.6s | 9.6s |
| APQuest | 3.0s | 7.0s | 0.1s | 2.8s | 5.7s | 5.7s |
| Adventure | 2.9s | 7.0s | 0.1s | 2.6s | 5.6s | 14.2s |
| Aquaria | 7.6s | 9.7s | 0.1s | 2.8s | 7.7s | 14.7s |
| Bomb Rush Cyberfunk | 10.4s | 25.6s | 0.1s | 2.9s | 19.7s | 14.4s |
| Bumper Stickers | 3.3s | 11.5s | 0.1s | 2.9s | 8.8s | 14.6s |
| Castlevania - Circle of the Moon | 3.0s | 7.7s | 0.1s | 2.7s | 5.6s | 14.2s |
| Castlevania 64 | 2.9s | 8.4s | 0.1s | 2.7s | 6.7s | 6.6s |
| Celeste (Open World) | 4.2s | 14.8s | 0.1s | 4.1s | 14.8s | 14.9s |
| Celeste 64 | 2.9s | 6.7s | 0.1s | 2.8s | 7.6s | 14.2s |
| ChecksFinder | 2.6s | 6.6s | 0.1s | 2.6s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.8s | 5.7s | 14.3s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.8s | 9.6s | 9.7s |
| Civilization VI | 3.2s | 8.7s | 0.1s | 2.9s | 8.7s | 17.5s |
| DLCQuest | 2.9s | 5.5s | 0.1s | 2.8s | 5.5s | 5.5s |
| DOOM 1993 | 3.4s | 12.8s | 0.1s | 3.1s | 12.8s | 14.6s |
| DOOM II | 3.1s | 14.7s | 0.1s | 2.8s | 15.7s | 14.3s |
| Dark Souls III | 4.7s | 24.8s | 0.1s | 2.6s | - | - |
| Donkey Kong Country 3 | 3.3s | 14.7s | 0.1s | - | - | - |
| Factorio | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Faxanadu | 2.7s | 6.6s | 0.1s | 2.6s | 8.6s | 14.2s |
| Final Fantasy Mystic Quest | 3.8s | 10.8s | 0.1s | 2.9s | 10.7s | 10.7s |
| Heretic | 3.1s | 14.7s | 0.1s | 2.8s | 14.7s | 14.3s |
| Hylics 2 | 3.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Inscryption | 2.8s | 6.5s | 0.1s | 2.7s | 6.5s | 6.5s |
| Kingdom Hearts | 8.9s | 28.8s | 0.1s | 3.0s | 22.7s | 13.8s |
| Kingdom Hearts 2 | 5.7s | 43.1s | 0.5s | 2.8s | - | - |
| Kirby's Dream Land 3 | 4.4s | 54.6s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.4s | 8.8s | 0.1s | 3.1s | 17.8s | 14.5s |
| Links Awakening DX | 9.8s | 16.8s | 0.1s | 3.3s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 2.6s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.8s | 9.7s | 0.1s | 2.9s | 20.7s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 14.2s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 8.6s | 0.1s | 2.7s | 8.5s | 14.1s |
| Meritous | 3.2s | 5.8s | 0.1s | 2.9s | 5.7s | 14.5s |
| Metamath | 10.8s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Muse Dash | 2.9s | 7.7s | 0.1s | 2.6s | - | - |
| Noita | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Old School Runescape | 4.4s | 8.7s | 0.1s | 2.9s | 8.7s | 17.7s |
| Overcooked! 2 | 2.9s | 20.7s | 0.1s | 2.8s | 19.7s | 14.2s |
| Paint | 2.8s | 7.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 14.3s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.7s | 6.6s | 14.5s |
| Shivers | 3.0s | 9.6s | 0.1s | 2.7s | 9.6s | 14.1s |
| Sonic Adventure 2 Battle | 3.6s | 13.9s | 0.1s | 3.0s | 16.8s | 14.7s |
| Starcraft 2 | 6.1s | 14.5s | 0.1s | 3.2s | 18.8s | 14.4s |
| Stardew Valley | 5.4s | 71.8s | 0.2s | 8.3s | - | - |
| Subnautica | 26.9s | 14.7s | 0.1s | 3.0s | 14.9s | 15.0s |
| Super Mario 64 | 2.9s | 12.6s | 0.1s | 2.8s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.7s | 7.8s | 0.1s | 2.5s | - | - |
| Super Mario World | 4.0s | 6.7s | 0.1s | - | - | - |
| Super Metroid | 11.2s | 10.7s | 0.1s | 2.7s | 11.7s | 58.7s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.9s | 9.8s | 9.7s |
| TOEM rule builder | 2.7s | 9.5s | 0.1s | 2.7s | 9.5s | 9.6s |
| Terraria | 3.2s | 20.9s | 0.1s | 2.8s | - | - |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.5s | - | - |
| The Wind Waker | 16.2s | 9.7s | 0.1s | 3.0s | 9.7s | 14.5s |
| Timespinner | 3.3s | 7.6s | 0.1s | 2.6s | - | - |
| Undertale | 2.8s | 5.6s | 0.1s | - | - | - |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Wargroove | 2.8s | 6.6s | 0.1s | 2.6s | 6.6s | 6.6s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.9s | 8.7s | 14.3s |
| Yoshi's Island | 3.5s | 9.6s | 0.1s | 2.8s | 14.0s | 14.0s |
| shapez | 4.6s | 6.7s | 0.1s | 3.0s | 6.8s | 14.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.9s |
| 2 | The Wind Waker | 16.2s |
| 3 | Super Metroid | 11.2s |
| 4 | Metamath | 10.8s |
| 5 | Bomb Rush Cyberfunk | 10.4s |
| 6 | A Link to the Past | 9.9s |
| 7 | Links Awakening DX | 9.8s |
| 8 | Kingdom Hearts | 8.9s |
| 9 | Aquaria | 7.6s |
| 10 | Starcraft 2 | 6.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.8s |
| 2 | Kirby's Dream Land 3 | 54.6s |
| 3 | Kingdom Hearts 2 | 43.1s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Bomb Rush Cyberfunk | 25.6s |
| 6 | Dark Souls III | 24.8s |
| 7 | A Link to the Past | 21.8s |
| 8 | Terraria | 20.9s |
| 9 | Overcooked! 2 | 20.7s |
| 10 | A Hat in Time | 18.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.1s |
| 4 | A Hat in Time | 0.1s |
| 5 | Aquaria | 0.1s |
| 6 | Bomb Rush Cyberfunk | 0.1s |
| 7 | Bumper Stickers | 0.1s |
| 8 | Starcraft 2 | 0.1s |
| 9 | A Short Hike | 0.1s |
| 10 | APQuest | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 8.3s |
| 2 | Celeste (Open World) | 4.1s |
| 3 | Links Awakening DX | 3.3s |
| 4 | Starcraft 2 | 3.2s |
| 5 | DOOM 1993 | 3.1s |
| 6 | Landstalker - The Treasures of King Nole | 3.1s |
| 7 | A Hat in Time | 3.1s |
| 8 | The Wind Waker | 3.0s |
| 9 | Sonic Adventure 2 Battle | 3.0s |
| 10 | shapez | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts | 22.7s |
| 2 | Mario & Luigi Superstar Saga | 20.7s |
| 3 | Overcooked! 2 | 19.7s |
| 4 | Bomb Rush Cyberfunk | 19.7s |
| 5 | Starcraft 2 | 18.8s |
| 6 | Landstalker - The Treasures of King Nole | 17.8s |
| 7 | Sonic Adventure 2 Battle | 16.8s |
| 8 | Links Awakening DX | 16.7s |
| 9 | DOOM II | 15.7s |
| 10 | Subnautica | 14.9s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 58.7s |
| 2 | Old School Runescape | 17.7s |
| 3 | Civilization VI | 17.5s |
| 4 | A Hat in Time | 17.2s |
| 5 | Links Awakening DX | 16.7s |
| 6 | Subnautica | 15.0s |
| 7 | Celeste (Open World) | 14.9s |
| 8 | Aquaria | 14.7s |
| 9 | Sonic Adventure 2 Battle | 14.7s |
| 10 | shapez | 14.7s |
