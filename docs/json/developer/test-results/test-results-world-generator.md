# World Generator Test Results

**Generated:** 2025-12-22 20:14:48 UTC
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
| Test Seed Generation | 55 | 13 | 68 |
| Test Spoiler Test | 53 | 2 | 55 |
| Cross-Validation | 48 | 7 | 55 |

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
| DLCQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
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
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Test Seed Generation | 56 | 12 | 68 |
| Test Spoiler Test | 54 | 2 | 56 |
| Cross-Validation | 24 | 32 | 56 |

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
| DLCQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
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
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Total | 307.6s | 858.5s | 6.3s | 170.8s | 555.4s | 600.3s |
| Average | 4.5s | 12.6s | 0.1s | 2.8s | 10.1s | 10.9s |
| Max | 27.9s | 74.7s | 0.5s | 3.9s | 25.8s | 64.3s |
| Min | 2.5s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (27.9s) | Stardew Valley (74.7s) | Kingdom Hearts 2 (0.5s) | Celeste (Open World) (3.9s) | Dark Souls III (25.8s) | Super Metroid (64.3s) |
| Fastest | ChocolateChipCookies (2.5s) | VVVVVV (5.5s) | WebDevJourney (0.1s) | Hylics 2 (2.5s) | VVVVVV (5.5s) | ChocolateChipCookies (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 5.1s | 17.1s | 0.1s | 2.7s | - | - |
| A Link to the Past | 9.8s | 20.6s | 0.1s | - | - | - |
| A Short Hike | 2.9s | 12.9s | 0.1s | 2.7s | 9.7s | 9.7s |
| APQuest | 2.7s | 6.6s | 0.1s | 2.6s | 5.5s | 5.5s |
| Adventure | 2.7s | 8.2s | 0.1s | 2.6s | 5.5s | 5.5s |
| Aquaria | 6.2s | 9.4s | 0.1s | 2.6s | 8.5s | 8.5s |
| Bomb Rush Cyberfunk | 11.3s | 26.3s | 0.1s | 2.8s | 18.8s | 14.8s |
| Bumper Stickers | 3.0s | 9.2s | 0.1s | 2.8s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.2s | 8.8s | 0.1s | 2.9s | 5.7s | 5.7s |
| Castlevania 64 | 3.2s | 8.4s | 0.1s | 2.8s | 6.7s | 6.7s |
| Celeste (Open World) | 4.2s | 14.8s | 0.1s | 3.9s | 14.9s | 14.8s |
| Celeste 64 | 2.8s | 6.7s | 0.1s | 2.7s | 7.6s | 6.6s |
| ChecksFinder | 2.6s | 6.6s | 0.1s | 2.6s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.5s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |
| Choo-Choo Charles | 2.7s | 10.6s | 0.1s | 2.7s | 10.6s | 10.6s |
| Civilization VI | 2.7s | 8.6s | 0.1s | 2.5s | 8.5s | 8.6s |
| DLCQuest | 3.0s | 5.8s | 0.1s | 2.6s | - | - |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s | 12.7s |
| DOOM II | 3.3s | 15.8s | 0.1s | 3.0s | 15.8s | 15.8s |
| Dark Souls III | 4.8s | 25.8s | 0.1s | 3.2s | 25.8s | 25.8s |
| Donkey Kong Country 3 | 3.1s | 14.8s | 0.1s | - | - | - |
| Factorio | 3.4s | 9.7s | 0.1s | 2.7s | 9.7s | 9.7s |
| Faxanadu | 2.7s | 6.7s | 0.1s | 2.7s | 8.6s | 6.6s |
| Final Fantasy Mystic Quest | 3.6s | 10.5s | 0.1s | 2.7s | 10.5s | 10.5s |
| Heretic | 3.1s | 15.7s | 0.1s | 2.7s | 15.5s | 15.6s |
| Hylics 2 | 3.4s | 6.5s | 0.1s | 2.5s | 6.6s | 6.5s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.6s |
| Kingdom Hearts | 9.1s | 28.8s | 0.1s | 2.7s | - | - |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.5s | 3.3s | 14.6s | 14.6s |
| Kirby's Dream Land 3 | 4.6s | 56.0s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.4s | 8.7s | 0.1s | 3.0s | 17.8s | 8.7s |
| Links Awakening DX | 9.2s | 16.8s | 0.1s | 3.1s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.4s | 9.5s | 0.1s | 2.6s | 9.5s | 9.5s |
| MathProof2p2e4 | 2.6s | 5.5s | 0.1s | 2.6s | 5.5s | 5.5s |
| Mega Man 2 | 2.6s | 6.5s | 0.1s | 2.5s | 6.6s | 6.5s |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Meritous | 2.9s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Metamath | 11.3s | 5.7s | 0.1s | 2.8s | 5.6s | 5.7s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.6s | - | - |
| Noita | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Old School Runescape | 4.3s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Overcooked! 2 | 2.9s | 20.8s | 0.1s | 2.5s | - | - |
| Paint | 2.6s | 6.5s | 0.1s | 2.6s | 6.5s | 7.5s |
| Risk of Rain 2 | 2.8s | 7.5s | 0.1s | 2.6s | 6.5s | 6.5s |
| Saving Princess | 2.6s | 5.6s | 0.1s | 2.5s | 6.5s | 5.5s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s | 13.7s |
| Starcraft 2 | 6.5s | 14.6s | 0.1s | 3.3s | 17.8s | 14.6s |
| Stardew Valley | 5.7s | 74.7s | 0.3s | 2.6s | - | - |
| Subnautica | 27.9s | 14.8s | 0.1s | 2.8s | 14.7s | 14.7s |
| Super Mario 64 | 2.8s | 12.7s | 0.1s | 2.8s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.8s | 7.7s | 0.1s | 2.8s | 7.7s | 14.5s |
| Super Mario World | 3.7s | 6.5s | 0.1s | - | - | - |
| Super Metroid | 10.4s | 10.6s | 0.1s | 2.7s | 12.5s | 64.3s |
| TOEM original | 2.6s | 9.6s | 0.1s | 2.5s | 9.5s | 9.5s |
| TOEM rule builder | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s | 9.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.9s | 19.8s | 19.8s |
| The Legend of Zelda | 4.7s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.4s | 12.9s | 0.1s | 2.6s | - | - |
| The Wind Waker | 17.1s | 9.8s | 0.1s | 3.0s | 9.7s | 9.7s |
| Timespinner | 3.2s | 7.7s | 0.1s | 2.8s | 14.4s | 14.3s |
| Undertale | 2.8s | 5.6s | 0.1s | - | - | - |
| VVVVVV | 2.6s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |
| Wargroove | 2.7s | 6.5s | 0.1s | 2.7s | 6.5s | 6.5s |
| WebDevJourney | 2.6s | 8.6s | 0.1s | 2.5s | 8.6s | 8.6s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| shapez | 4.2s | 6.7s | 0.1s | 2.8s | 6.7s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.9s |
| 2 | The Wind Waker | 17.1s |
| 3 | Metamath | 11.3s |
| 4 | Bomb Rush Cyberfunk | 11.3s |
| 5 | Super Metroid | 10.4s |
| 6 | A Link to the Past | 9.8s |
| 7 | Links Awakening DX | 9.2s |
| 8 | Kingdom Hearts | 9.1s |
| 9 | Starcraft 2 | 6.5s |
| 10 | Aquaria | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 74.7s |
| 2 | Kirby's Dream Land 3 | 56.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Bomb Rush Cyberfunk | 26.3s |
| 6 | Dark Souls III | 25.8s |
| 7 | Overcooked! 2 | 20.8s |
| 8 | Terraria | 20.8s |
| 9 | A Link to the Past | 20.6s |
| 10 | A Hat in Time | 17.1s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
| 2 | Stardew Valley | 0.3s |
| 3 | A Hat in Time | 0.1s |
| 4 | A Link to the Past | 0.1s |
| 5 | Bomb Rush Cyberfunk | 0.1s |
| 6 | Starcraft 2 | 0.1s |
| 7 | Castlevania - Circle of the Moon | 0.1s |
| 8 | A Short Hike | 0.1s |
| 9 | Bumper Stickers | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.9s |
| 2 | Starcraft 2 | 3.3s |
| 3 | Kingdom Hearts 2 | 3.3s |
| 4 | Dark Souls III | 3.2s |
| 5 | Links Awakening DX | 3.1s |
| 6 | Landstalker - The Treasures of King Nole | 3.0s |
| 7 | DOOM II | 3.0s |
| 8 | The Wind Waker | 3.0s |
| 9 | Castlevania - Circle of the Moon | 2.9s |
| 10 | Noita | 2.9s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 25.8s |
| 2 | Terraria | 19.8s |
| 3 | Bomb Rush Cyberfunk | 18.8s |
| 4 | Starcraft 2 | 17.8s |
| 5 | Landstalker - The Treasures of King Nole | 17.8s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | DOOM II | 15.8s |
| 9 | Heretic | 15.5s |
| 10 | Celeste (Open World) | 14.9s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 64.3s |
| 2 | Dark Souls III | 25.8s |
| 3 | Terraria | 19.8s |
| 4 | Links Awakening DX | 16.8s |
| 5 | DOOM II | 15.8s |
| 6 | Heretic | 15.6s |
| 7 | Celeste (Open World) | 14.8s |
| 8 | Bomb Rush Cyberfunk | 14.8s |
| 9 | Subnautica | 14.7s |
| 10 | Kingdom Hearts 2 | 14.6s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Total | 313.5s | 845.3s | 6.4s | 183.9s | 570.7s | 731.0s |
| Average | 4.6s | 12.4s | 0.1s | 3.0s | 10.2s | 13.1s |
| Max | 26.8s | 70.6s | 0.6s | 8.2s | 23.7s | 60.8s |
| Min | 2.7s | 5.6s | 0.1s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (26.8s) | Stardew Valley (70.6s) | Kingdom Hearts 2 (0.6s) | Stardew Valley (8.2s) | Dark Souls III (23.7s) | Super Metroid (60.8s) |
| Fastest | ChocolateChipCookies (2.7s) | Metamath (5.6s) | WebDevJourney (0.1s) | Muse Dash (2.5s) | VVVVVV (5.6s) | APQuest (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 5.0s | 14.6s | 0.1s | 2.9s | 13.7s | 17.0s |
| A Link to the Past | 9.7s | 18.8s | 0.1s | - | - | - |
| A Short Hike | 3.2s | 13.6s | 0.1s | 2.9s | 9.7s | 9.7s |
| APQuest | 3.0s | 6.9s | 0.1s | 2.7s | 5.6s | 5.6s |
| Adventure | 3.0s | 6.2s | 0.1s | 2.8s | 5.7s | 14.3s |
| Aquaria | 7.2s | 9.6s | 0.1s | 3.0s | 8.7s | 14.6s |
| Bomb Rush Cyberfunk | 11.4s | 22.4s | 0.1s | 3.2s | 18.9s | 14.9s |
| Bumper Stickers | 3.0s | 10.7s | 0.1s | 3.1s | 8.8s | 14.9s |
| Castlevania - Circle of the Moon | 3.0s | 8.6s | 0.1s | 2.8s | 5.6s | 14.2s |
| Castlevania 64 | 3.0s | 9.9s | 0.1s | 2.7s | 6.6s | 6.6s |
| Celeste (Open World) | 4.1s | 14.7s | 0.1s | 3.9s | 14.8s | 14.6s |
| Celeste 64 | 2.8s | 6.8s | 0.1s | 2.6s | 7.6s | 14.2s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.6s | 0.1s | 2.8s | 5.6s | 14.2s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s | 17.4s |
| DLCQuest | 3.0s | 5.9s | 0.1s | 2.7s | - | - |
| DOOM 1993 | 3.1s | 12.7s | 0.1s | 3.1s | 12.8s | 14.8s |
| DOOM II | 3.1s | 14.7s | 0.1s | 3.0s | 15.8s | 14.4s |
| Dark Souls III | 4.7s | 24.7s | 0.1s | 3.0s | 23.7s | 17.0s |
| Donkey Kong Country 3 | 3.1s | 13.8s | 0.1s | - | - | - |
| Factorio | 3.4s | 9.7s | 0.1s | 2.7s | 9.7s | 9.6s |
| Faxanadu | 2.9s | 6.7s | 0.1s | 2.9s | 8.7s | 14.4s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 2.8s | 10.7s | 10.7s |
| Heretic | 3.3s | 14.7s | 0.1s | 3.0s | 14.8s | 14.5s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| Inscryption | 2.9s | 6.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| Kingdom Hearts | 9.1s | 28.8s | 0.1s | 2.7s | - | - |
| Kingdom Hearts 2 | 6.2s | 41.9s | 0.6s | 3.5s | 15.0s | 15.1s |
| Kirby's Dream Land 3 | 4.4s | 54.0s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.3s | 8.7s | 0.1s | 2.9s | 17.7s | 14.4s |
| Links Awakening DX | 9.2s | 16.7s | 0.1s | 3.2s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.9s | 5.8s | 0.1s | 2.8s | 5.7s | 14.3s |
| Mega Man 2 | 2.9s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.1s | 8.8s | 0.1s | 2.9s | 8.7s | 17.6s |
| Meritous | 3.5s | 5.7s | 0.1s | 3.1s | 5.8s | 14.7s |
| Metamath | 9.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Muse Dash | 2.9s | 7.6s | 0.1s | 2.5s | - | - |
| Noita | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Old School Runescape | 4.2s | 8.6s | 0.1s | 2.8s | 8.6s | 8.7s |
| Overcooked! 2 | 3.2s | 21.8s | 0.1s | 2.8s | - | - |
| Paint | 2.7s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Saving Princess | 2.9s | 5.7s | 0.1s | 2.7s | 6.7s | 14.3s |
| Shivers | 3.2s | 9.8s | 0.1s | 2.9s | 9.7s | 14.5s |
| Sonic Adventure 2 Battle | 3.9s | 13.9s | 0.1s | 2.9s | 16.9s | 14.9s |
| Starcraft 2 | 6.2s | 14.5s | 0.1s | 3.4s | 17.8s | 14.5s |
| Stardew Valley | 5.4s | 70.6s | 0.2s | 8.2s | - | - |
| Subnautica | 26.8s | 15.7s | 0.1s | 2.8s | 14.7s | 16.9s |
| Super Mario 64 | 2.8s | 12.7s | 0.1s | 2.7s | 12.7s | 12.6s |
| Super Mario Land 2 | 4.1s | 7.8s | 0.1s | 3.0s | 7.8s | 14.8s |
| Super Mario World | 4.0s | 6.7s | 0.1s | - | - | - |
| Super Metroid | 11.7s | 10.7s | 0.1s | 2.9s | 12.7s | 60.8s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| TOEM rule builder | 3.0s | 9.8s | 0.1s | 2.9s | 9.7s | 9.8s |
| Terraria | 3.5s | 20.9s | 0.1s | 3.1s | 20.9s | 24.1s |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.1s | 12.8s | 0.1s | 2.5s | - | - |
| The Wind Waker | 15.7s | 9.7s | 0.1s | 2.9s | 9.7s | 14.3s |
| Timespinner | 3.2s | 7.6s | 0.1s | 2.7s | 14.3s | 14.3s |
| Undertale | 3.0s | 5.6s | 0.1s | - | - | - |
| VVVVVV | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 5.7s |
| Wargroove | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| WebDevJourney | 2.9s | 8.7s | 0.1s | 2.7s | 8.7s | 14.3s |
| Yoshi's Island | 3.7s | 9.8s | 0.1s | 3.0s | 9.8s | 9.8s |
| shapez | 5.2s | 6.8s | 0.1s | 3.2s | 6.8s | 14.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.8s |
| 2 | The Wind Waker | 15.7s |
| 3 | Super Metroid | 11.7s |
| 4 | Bomb Rush Cyberfunk | 11.4s |
| 5 | Metamath | 9.7s |
| 6 | A Link to the Past | 9.7s |
| 7 | Links Awakening DX | 9.2s |
| 8 | Kingdom Hearts | 9.1s |
| 9 | Aquaria | 7.2s |
| 10 | Kingdom Hearts 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 70.6s |
| 2 | Kirby's Dream Land 3 | 54.0s |
| 3 | Kingdom Hearts 2 | 41.9s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Dark Souls III | 24.7s |
| 6 | Bomb Rush Cyberfunk | 22.4s |
| 7 | Overcooked! 2 | 21.8s |
| 8 | Terraria | 20.9s |
| 9 | A Link to the Past | 18.8s |
| 10 | Links Awakening DX | 16.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.6s |
| 2 | Stardew Valley | 0.2s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | A Hat in Time | 0.1s |
| 5 | A Link to the Past | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Starcraft 2 | 0.1s |
| 8 | A Short Hike | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Adventure | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 8.2s |
| 2 | Celeste (Open World) | 3.9s |
| 3 | Kingdom Hearts 2 | 3.5s |
| 4 | Starcraft 2 | 3.4s |
| 5 | Bomb Rush Cyberfunk | 3.2s |
| 6 | Links Awakening DX | 3.2s |
| 7 | shapez | 3.2s |
| 8 | Meritous | 3.1s |
| 9 | DOOM 1993 | 3.1s |
| 10 | Terraria | 3.1s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.7s |
| 2 | Terraria | 20.9s |
| 3 | Bomb Rush Cyberfunk | 18.9s |
| 4 | Starcraft 2 | 17.8s |
| 5 | Landstalker - The Treasures of King Nole | 17.7s |
| 6 | Sonic Adventure 2 Battle | 16.9s |
| 7 | Links Awakening DX | 16.7s |
| 8 | DOOM II | 15.8s |
| 9 | Kingdom Hearts 2 | 15.0s |
| 10 | Heretic | 14.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 60.8s |
| 2 | Terraria | 24.1s |
| 3 | MegaMan Battle Network 3 | 17.6s |
| 4 | Civilization VI | 17.4s |
| 5 | A Hat in Time | 17.0s |
| 6 | Dark Souls III | 17.0s |
| 7 | Subnautica | 16.9s |
| 8 | Links Awakening DX | 16.7s |
| 9 | Kingdom Hearts 2 | 15.1s |
| 10 | Bumper Stickers | 14.9s |
