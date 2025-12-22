# World Generator Test Results

**Generated:** 2025-12-22 20:45:37 UTC
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
| Total | 312.9s | 856.3s | 6.3s | 176.7s | 556.2s | 592.4s |
| Average | 4.6s | 12.6s | 0.1s | 2.8s | 10.1s | 10.8s |
| Max | 26.9s | 73.7s | 0.5s | 3.9s | 24.7s | 58.3s |
| Min | 2.7s | 5.6s | 0.1s | 2.4s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (26.9s) | Stardew Valley (73.7s) | Kingdom Hearts 2 (0.5s) | Celeste (Open World) (3.9s) | Dark Souls III (24.7s) | Super Metroid (58.3s) |
| Fastest | MathProof2p2e4 (2.7s) | Metamath (5.6s) | WebDevJourney (0.1s) | The Messenger (2.4s) | Metamath (5.6s) | MathProof2p2e4 (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 4.7s | 15.5s | 0.1s | 2.6s | - | - |
| A Link to the Past | 10.1s | 18.8s | 0.1s | - | - | - |
| A Short Hike | 3.0s | 12.6s | 0.1s | 2.7s | 9.7s | 9.6s |
| APQuest | 2.9s | 10.4s | 0.1s | 2.7s | 5.6s | 5.6s |
| Adventure | 2.9s | 8.8s | 0.1s | 2.7s | 5.7s | 5.6s |
| Aquaria | 6.9s | 9.6s | 0.1s | 2.7s | 8.7s | 7.7s |
| Bomb Rush Cyberfunk | 12.8s | 24.2s | 0.1s | 3.5s | 20.0s | 15.1s |
| Bumper Stickers | 3.0s | 9.5s | 0.1s | 2.9s | 8.7s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 6.2s | 0.1s | 2.7s | 5.7s | 5.6s |
| Castlevania 64 | 2.9s | 9.4s | 0.1s | 2.6s | 6.5s | 6.5s |
| Celeste (Open World) | 3.9s | 14.8s | 0.1s | 3.9s | 14.8s | 14.7s |
| Celeste 64 | 2.9s | 6.7s | 0.1s | 2.7s | 7.6s | 6.7s |
| ChecksFinder | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.8s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| DLCQuest | 3.5s | 5.9s | 0.1s | 3.1s | - | - |
| DOOM 1993 | 3.2s | 12.8s | 0.1s | 3.1s | 12.8s | 12.8s |
| DOOM II | 3.1s | 15.7s | 0.1s | 2.8s | 14.7s | 14.7s |
| Dark Souls III | 4.5s | 25.6s | 0.1s | 3.0s | 24.7s | 24.6s |
| Donkey Kong Country 3 | 3.0s | 13.7s | 0.1s | - | - | - |
| Factorio | 3.4s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Faxanadu | 2.8s | 6.7s | 0.1s | 2.7s | 8.6s | 6.6s |
| Final Fantasy Mystic Quest | 3.9s | 10.7s | 0.1s | 2.9s | 10.7s | 10.7s |
| Heretic | 3.1s | 14.8s | 0.1s | 2.8s | 14.7s | 14.7s |
| Hylics 2 | 3.7s | 6.7s | 0.1s | 2.7s | 6.6s | 6.7s |
| Inscryption | 3.3s | 6.9s | 0.1s | 3.3s | 6.8s | 6.8s |
| Kingdom Hearts | 8.8s | 28.8s | 0.1s | 2.6s | - | - |
| Kingdom Hearts 2 | 5.6s | 43.1s | 0.5s | 3.4s | 14.7s | 14.8s |
| Kirby's Dream Land 3 | 4.3s | 57.5s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.8s | 17.7s | 8.6s |
| Links Awakening DX | 9.4s | 16.8s | 0.1s | 3.2s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 9.7s | 0.1s | 2.9s | 9.7s | 9.8s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| MegaMan Battle Network 3 | 3.6s | 8.8s | 0.1s | 3.2s | 8.8s | 8.9s |
| Meritous | 3.0s | 5.8s | 0.1s | 3.0s | 5.7s | 5.7s |
| Metamath | 11.2s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Muse Dash | 2.8s | 7.5s | 0.1s | 2.4s | - | - |
| Noita | 2.7s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Old School Runescape | 4.4s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Overcooked! 2 | 3.0s | 20.8s | 0.1s | 2.5s | - | - |
| Paint | 2.8s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.7s | 6.7s |
| Saving Princess | 2.8s | 5.8s | 0.1s | 2.7s | 6.6s | 5.6s |
| Shivers | 3.6s | 9.8s | 0.1s | 3.2s | 9.8s | 9.8s |
| Sonic Adventure 2 Battle | 3.3s | 13.8s | 0.1s | 3.1s | 16.8s | 13.8s |
| Starcraft 2 | 6.2s | 14.5s | 0.1s | 3.1s | 17.8s | 14.5s |
| Stardew Valley | 5.3s | 73.7s | 0.2s | 2.5s | - | - |
| Subnautica | 26.9s | 14.7s | 0.1s | 2.7s | 14.7s | 14.7s |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.8s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.8s | 7.7s | 0.1s | 2.8s | 7.7s | 14.5s |
| Super Mario World | 4.0s | 6.6s | 0.1s | - | - | - |
| Super Metroid | 11.2s | 10.7s | 0.1s | 2.8s | 11.7s | 58.3s |
| TOEM original | 2.7s | 8.7s | 0.1s | 2.7s | 8.7s | 8.6s |
| TOEM rule builder | 3.3s | 9.8s | 0.1s | 3.2s | 9.8s | 9.8s |
| Terraria | 3.1s | 20.9s | 0.1s | 3.0s | 20.9s | 20.9s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.1s | 12.7s | 0.1s | 2.4s | - | - |
| The Wind Waker | 15.8s | 9.8s | 0.1s | 2.8s | 9.7s | 9.7s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.8s | 14.4s | 14.5s |
| Undertale | 2.9s | 5.7s | 0.1s | - | - | - |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.8s | 5.7s | 5.6s |
| Wargroove | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| Yoshi's Island | 4.2s | 9.9s | 0.1s | 3.5s | 9.9s | 9.8s |
| shapez | 4.5s | 6.7s | 0.1s | 2.9s | 6.7s | 14.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.9s |
| 2 | The Wind Waker | 15.8s |
| 3 | Bomb Rush Cyberfunk | 12.8s |
| 4 | Super Metroid | 11.2s |
| 5 | Metamath | 11.2s |
| 6 | A Link to the Past | 10.1s |
| 7 | Links Awakening DX | 9.4s |
| 8 | Kingdom Hearts | 8.8s |
| 9 | Aquaria | 6.9s |
| 10 | Starcraft 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 73.7s |
| 2 | Kirby's Dream Land 3 | 57.5s |
| 3 | Kingdom Hearts 2 | 43.1s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Dark Souls III | 25.6s |
| 6 | Bomb Rush Cyberfunk | 24.2s |
| 7 | Terraria | 20.9s |
| 8 | Overcooked! 2 | 20.8s |
| 9 | A Link to the Past | 18.8s |
| 10 | Links Awakening DX | 16.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
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
| 1 | Celeste (Open World) | 3.9s |
| 2 | Bomb Rush Cyberfunk | 3.5s |
| 3 | Yoshi's Island | 3.5s |
| 4 | Kingdom Hearts 2 | 3.4s |
| 5 | Inscryption | 3.3s |
| 6 | Links Awakening DX | 3.2s |
| 7 | MegaMan Battle Network 3 | 3.2s |
| 8 | Shivers | 3.2s |
| 9 | TOEM rule builder | 3.2s |
| 10 | Starcraft 2 | 3.1s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.7s |
| 2 | Terraria | 20.9s |
| 3 | Bomb Rush Cyberfunk | 20.0s |
| 4 | Starcraft 2 | 17.8s |
| 5 | Landstalker - The Treasures of King Nole | 17.7s |
| 6 | Links Awakening DX | 16.8s |
| 7 | Sonic Adventure 2 Battle | 16.8s |
| 8 | Celeste (Open World) | 14.8s |
| 9 | Heretic | 14.7s |
| 10 | DOOM II | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 58.3s |
| 2 | Dark Souls III | 24.6s |
| 3 | Terraria | 20.9s |
| 4 | Links Awakening DX | 16.8s |
| 5 | Bomb Rush Cyberfunk | 15.1s |
| 6 | Kingdom Hearts 2 | 14.8s |
| 7 | Celeste (Open World) | 14.7s |
| 8 | Heretic | 14.7s |
| 9 | Subnautica | 14.7s |
| 10 | DOOM II | 14.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Total | 309.7s | 850.8s | 6.3s | 183.0s | 569.5s | 733.7s |
| Average | 4.6s | 12.5s | 0.1s | 3.0s | 10.2s | 13.1s |
| Max | 26.4s | 71.8s | 0.5s | 8.2s | 23.7s | 66.5s |
| Min | 2.5s | 5.5s | 0.1s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (26.4s) | Stardew Valley (71.8s) | Kingdom Hearts 2 (0.5s) | Stardew Valley (8.2s) | Dark Souls III (23.7s) | Super Metroid (66.5s) |
| Fastest | TOEM original (2.5s) | Saving Princess (5.5s) | WebDevJourney (0.1s) | Muse Dash (2.5s) | Adventure (5.6s) | Lufia II Ancient Cave (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 4.7s | 17.2s | 0.1s | 2.9s | 13.7s | 17.1s |
| A Link to the Past | 10.0s | 21.8s | 0.1s | - | - | - |
| A Short Hike | 3.0s | 11.6s | 0.1s | 2.8s | 9.7s | 9.6s |
| APQuest | 3.0s | 7.1s | 0.1s | 2.7s | 5.7s | 5.6s |
| Adventure | 3.2s | 8.5s | 0.1s | 3.0s | 5.6s | 14.1s |
| Aquaria | 6.4s | 10.6s | 0.1s | 2.6s | 8.5s | 14.2s |
| Bomb Rush Cyberfunk | 11.3s | 24.8s | 0.1s | 3.0s | 18.7s | 14.6s |
| Bumper Stickers | 2.9s | 9.8s | 0.1s | 2.8s | 8.7s | 14.3s |
| Castlevania - Circle of the Moon | 3.1s | 6.2s | 0.1s | 2.7s | 5.6s | 14.3s |
| Castlevania 64 | 3.1s | 8.0s | 0.1s | 2.7s | 6.6s | 6.7s |
| Celeste (Open World) | 3.9s | 14.7s | 0.1s | 4.0s | 14.8s | 14.8s |
| Celeste 64 | 2.8s | 6.6s | 0.1s | 2.7s | 7.7s | 14.2s |
| ChecksFinder | 2.9s | 6.6s | 0.1s | 2.7s | 6.6s | 6.7s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.8s | 5.6s | 14.3s |
| Choo-Choo Charles | 3.2s | 10.6s | 0.1s | 3.1s | 10.7s | 10.7s |
| Civilization VI | 2.7s | 8.5s | 0.1s | 2.6s | 8.5s | 17.0s |
| DLCQuest | 3.1s | 5.7s | 0.1s | 2.7s | - | - |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s | 14.3s |
| DOOM II | 3.2s | 14.7s | 0.1s | 2.9s | 15.7s | 14.6s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 3.1s | 23.7s | 17.1s |
| Donkey Kong Country 3 | 2.9s | 13.7s | 0.1s | - | - | - |
| Factorio | 3.4s | 9.7s | 0.1s | 2.7s | 9.7s | 9.7s |
| Faxanadu | 2.9s | 6.7s | 0.1s | 2.8s | 8.6s | 14.3s |
| Final Fantasy Mystic Quest | 3.9s | 10.7s | 0.1s | 2.9s | 10.7s | 10.7s |
| Heretic | 3.5s | 15.7s | 0.1s | 3.3s | 15.7s | 14.4s |
| Hylics 2 | 3.5s | 6.5s | 0.1s | 2.6s | 6.5s | 6.5s |
| Inscryption | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s | 6.6s |
| Kingdom Hearts | 8.9s | 28.8s | 0.1s | 3.0s | - | - |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.5s | 3.5s | 14.6s | 14.6s |
| Kirby's Dream Land 3 | 4.6s | 55.0s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.0s | 8.7s | 0.1s | 3.0s | 17.8s | 14.5s |
| Links Awakening DX | 9.6s | 16.7s | 0.1s | 3.2s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 2.9s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 9.7s | 0.1s | 2.9s | 9.7s | 9.8s |
| MathProof2p2e4 | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 14.3s |
| Mega Man 2 | 2.6s | 6.5s | 0.1s | 2.5s | 6.5s | 6.5s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.9s | 8.7s | 17.4s |
| Meritous | 2.9s | 5.6s | 0.1s | 2.7s | 5.7s | 14.3s |
| Metamath | 11.2s | 5.6s | 0.1s | 3.0s | 5.7s | 5.8s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.5s | - | - |
| Noita | 2.7s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Old School Runescape | 4.4s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Overcooked! 2 | 3.0s | 21.8s | 0.1s | 2.7s | - | - |
| Paint | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.2s | 7.6s | 0.1s | 3.1s | 7.6s | 7.6s |
| Saving Princess | 2.5s | 5.5s | 0.1s | 2.5s | 6.5s | 13.9s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.9s | 9.7s | 14.4s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.9s | 16.7s | 14.5s |
| Starcraft 2 | 6.2s | 14.5s | 0.1s | 3.5s | 17.9s | 14.7s |
| Stardew Valley | 5.6s | 71.8s | 0.3s | 8.2s | - | - |
| Subnautica | 26.4s | 14.7s | 0.1s | 3.0s | 14.8s | 17.3s |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.8s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.7s | 0.1s | 2.8s | 7.8s | 14.6s |
| Super Mario World | 4.0s | 6.7s | 0.1s | - | - | - |
| Super Metroid | 11.2s | 10.7s | 0.1s | 3.1s | 12.7s | 66.5s |
| TOEM original | 2.5s | 9.5s | 0.1s | 2.6s | 9.5s | 9.5s |
| TOEM rule builder | 3.1s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.9s | 19.8s | 23.6s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.4s | 12.8s | 0.1s | 2.6s | - | - |
| The Wind Waker | 16.0s | 9.7s | 0.1s | 2.8s | 9.7s | 14.3s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.8s | 14.3s | 14.3s |
| Undertale | 2.9s | 5.7s | 0.1s | - | - | - |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.7s | 5.6s | 5.6s |
| Wargroove | 3.1s | 6.6s | 0.1s | 3.0s | 6.6s | 6.6s |
| WebDevJourney | 2.6s | 8.5s | 0.1s | 2.6s | 8.5s | 13.9s |
| Yoshi's Island | 3.6s | 9.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| shapez | 4.2s | 6.7s | 0.1s | 2.8s | 6.7s | 14.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.4s |
| 2 | The Wind Waker | 16.0s |
| 3 | Bomb Rush Cyberfunk | 11.3s |
| 4 | Super Metroid | 11.2s |
| 5 | Metamath | 11.2s |
| 6 | A Link to the Past | 10.0s |
| 7 | Links Awakening DX | 9.6s |
| 8 | Kingdom Hearts | 8.9s |
| 9 | Aquaria | 6.4s |
| 10 | Starcraft 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.8s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Bomb Rush Cyberfunk | 24.8s |
| 6 | Dark Souls III | 24.8s |
| 7 | Overcooked! 2 | 21.8s |
| 8 | A Link to the Past | 21.8s |
| 9 | Terraria | 20.8s |
| 10 | A Hat in Time | 17.2s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
| 2 | Stardew Valley | 0.3s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | A Link to the Past | 0.1s |
| 7 | Castlevania 64 | 0.1s |
| 8 | A Short Hike | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Adventure | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 8.2s |
| 2 | Celeste (Open World) | 4.0s |
| 3 | Kingdom Hearts 2 | 3.5s |
| 4 | Starcraft 2 | 3.5s |
| 5 | Heretic | 3.3s |
| 6 | Links Awakening DX | 3.2s |
| 7 | Super Metroid | 3.1s |
| 8 | Risk of Rain 2 | 3.1s |
| 9 | Choo-Choo Charles | 3.1s |
| 10 | Dark Souls III | 3.1s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.7s |
| 2 | Terraria | 19.8s |
| 3 | Bomb Rush Cyberfunk | 18.7s |
| 4 | Starcraft 2 | 17.9s |
| 5 | Landstalker - The Treasures of King Nole | 17.8s |
| 6 | Links Awakening DX | 16.7s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | DOOM II | 15.7s |
| 9 | Heretic | 15.7s |
| 10 | Celeste (Open World) | 14.8s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 66.5s |
| 2 | Terraria | 23.6s |
| 3 | MegaMan Battle Network 3 | 17.4s |
| 4 | Subnautica | 17.3s |
| 5 | Dark Souls III | 17.1s |
| 6 | A Hat in Time | 17.1s |
| 7 | Civilization VI | 17.0s |
| 8 | Links Awakening DX | 16.7s |
| 9 | Celeste (Open World) | 14.8s |
| 10 | Starcraft 2 | 14.7s |
