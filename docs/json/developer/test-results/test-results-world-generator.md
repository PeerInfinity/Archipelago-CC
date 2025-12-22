# World Generator Test Results

**Generated:** 2025-12-22 23:42:30 UTC
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
| Original Spoiler Test | 66 | 2 | 68 |
| Test World Generation | 62 | 6 | 68 |
| Test Seed Generation | 56 | 12 | 68 |
| Test Spoiler Test | 55 | 1 | 56 |
| Cross-Validation | 49 | 7 | 56 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bomb Rush Cyberfunk | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 68

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 68 | 0 | 68 |
| Original Spoiler Test | 66 | 2 | 68 |
| Test World Generation | 62 | 6 | 68 |
| Test Seed Generation | 56 | 12 | 68 |
| Test Spoiler Test | 55 | 1 | 56 |
| Cross-Validation | 23 | 33 | 56 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ❌ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Total | 306.5s | 856.2s | 6.3s | 175.1s | 598.0s | 659.3s |
| Average | 4.5s | 12.6s | 0.1s | 2.8s | 10.7s | 11.8s |
| Max | 26.4s | 71.8s | 0.5s | 3.9s | 24.8s | 58.6s |
| Min | 2.6s | 5.6s | 0.1s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (26.4s) | Stardew Valley (71.8s) | Kingdom Hearts 2 (0.5s) | Celeste (Open World) (3.9s) | Dark Souls III (24.8s) | Super Metroid (58.6s) |
| Fastest | ChocolateChipCookies (2.6s) | Noita (5.6s) | WebDevJourney (0.1s) | Castlevania - Circle of the Moon (2.5s) | Noita (5.6s) | Metamath (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 4.7s | 14.3s | 0.1s | 2.7s | 13.7s | 17.4s |
| A Link to the Past | 10.3s | 20.6s | 0.1s | - | - | - |
| A Short Hike | 3.0s | 14.2s | 0.1s | 2.8s | 9.7s | 9.7s |
| APQuest | 2.9s | 8.4s | 0.1s | 2.5s | - | - |
| Adventure | 2.9s | 6.3s | 0.1s | 2.7s | 5.6s | 5.6s |
| Aquaria | 7.0s | 11.8s | 0.1s | 2.8s | 8.7s | 8.7s |
| Bomb Rush Cyberfunk | 9.9s | 21.1s | 0.1s | 2.9s | 19.8s | 19.3s |
| Bumper Stickers | 3.2s | 10.2s | 0.1s | 3.1s | 8.8s | 8.7s |
| Castlevania - Circle of the Moon | 2.9s | 6.2s | 0.1s | 2.5s | - | - |
| Castlevania 64 | 3.0s | 8.0s | 0.1s | 2.7s | 6.6s | 6.6s |
| Celeste (Open World) | 3.9s | 14.7s | 0.1s | 3.9s | 14.8s | 14.7s |
| Celeste 64 | 3.0s | 6.8s | 0.1s | 2.9s | 7.7s | 6.7s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.8s | 6.7s | 6.6s |
| ChocolateChipCookies | 2.6s | 5.6s | 0.1s | 2.7s | 5.6s | 5.7s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| DLCQuest | 3.0s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| DOOM 1993 | 3.2s | 13.8s | 0.1s | 2.9s | 13.8s | 13.8s |
| DOOM II | 3.1s | 14.7s | 0.1s | 2.8s | 14.7s | 14.7s |
| Dark Souls III | 4.7s | 24.8s | 0.1s | 3.1s | 24.8s | 24.8s |
| Donkey Kong Country 3 | 2.8s | 13.8s | 0.1s | - | - | - |
| Factorio | 3.7s | 9.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.8s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 2.8s | 10.8s | 10.7s |
| Heretic | 3.1s | 14.9s | 0.1s | 2.8s | 14.7s | 14.7s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.7s | 6.7s | 6.6s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.8s | 6.6s | 6.7s |
| Kingdom Hearts | 8.8s | 28.8s | 0.1s | 2.9s | 22.8s | 14.8s |
| Kingdom Hearts 2 | 5.4s | 46.1s | 0.5s | 3.5s | 14.9s | 55.7s |
| Kirby's Dream Land 3 | 4.5s | 55.0s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.0s | 8.6s | 0.1s | 2.7s | 17.7s | 8.6s |
| Links Awakening DX | 9.8s | 16.9s | 0.1s | 3.3s | 17.8s | 16.8s |
| Lufia II Ancient Cave | 2.8s | 5.6s | 0.1s | 2.8s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 10.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.5s | - | - |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Meritous | 3.1s | 5.7s | 0.1s | 3.1s | 5.7s | 5.7s |
| Metamath | 10.1s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Muse Dash | 2.9s | 7.7s | 0.1s | 2.7s | 9.7s | 7.7s |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Old School Runescape | 4.5s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| Overcooked! 2 | 3.0s | 20.8s | 0.1s | 3.0s | 19.8s | 14.4s |
| Paint | 2.7s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.7s | 6.6s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s | 5.7s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.4s | 13.7s | 0.1s | 3.1s | 17.8s | 13.9s |
| Starcraft 2 | 6.0s | 20.7s | 0.1s | 3.1s | 17.8s | 20.6s |
| Stardew Valley | 5.5s | 71.8s | 0.3s | 2.6s | - | - |
| Subnautica | 26.4s | 14.6s | 0.1s | 2.8s | 14.7s | 14.7s |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.8s | 0.1s | 2.5s | - | - |
| Super Mario World | 3.9s | 6.6s | 0.1s | - | - | - |
| Super Metroid | 11.2s | 10.7s | 0.1s | 2.7s | 11.6s | 58.6s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| Terraria | 3.0s | 21.7s | 0.1s | 3.2s | 22.0s | 22.8s |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.6s | - | - |
| The Wind Waker | 15.8s | 9.7s | 0.1s | 2.7s | 9.7s | 9.6s |
| Timespinner | 3.4s | 7.7s | 0.1s | 2.9s | 7.7s | 7.7s |
| Undertale | 3.0s | 5.7s | 0.1s | - | - | - |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s | 5.6s |
| Wargroove | 2.7s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Yoshi's Island | 3.6s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| shapez | 4.4s | 6.8s | 0.1s | 2.7s | 6.6s | 6.8s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.4s |
| 2 | The Wind Waker | 15.8s |
| 3 | Super Metroid | 11.2s |
| 4 | A Link to the Past | 10.3s |
| 5 | Metamath | 10.1s |
| 6 | Bomb Rush Cyberfunk | 9.9s |
| 7 | Links Awakening DX | 9.8s |
| 8 | Kingdom Hearts | 8.8s |
| 9 | Aquaria | 7.0s |
| 10 | Starcraft 2 | 6.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.8s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 46.1s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Dark Souls III | 24.8s |
| 6 | Terraria | 21.7s |
| 7 | Bomb Rush Cyberfunk | 21.1s |
| 8 | Overcooked! 2 | 20.8s |
| 9 | Starcraft 2 | 20.7s |
| 10 | A Link to the Past | 20.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
| 2 | Stardew Valley | 0.3s |
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
| 2 | Kingdom Hearts 2 | 3.5s |
| 3 | Links Awakening DX | 3.3s |
| 4 | Terraria | 3.2s |
| 5 | Dark Souls III | 3.1s |
| 6 | Bumper Stickers | 3.1s |
| 7 | Starcraft 2 | 3.1s |
| 8 | Sonic Adventure 2 Battle | 3.1s |
| 9 | Meritous | 3.1s |
| 10 | Overcooked! 2 | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Kingdom Hearts | 22.8s |
| 3 | Terraria | 22.0s |
| 4 | Overcooked! 2 | 19.8s |
| 5 | Bomb Rush Cyberfunk | 19.8s |
| 6 | Links Awakening DX | 17.8s |
| 7 | Sonic Adventure 2 Battle | 17.8s |
| 8 | Starcraft 2 | 17.8s |
| 9 | Landstalker - The Treasures of King Nole | 17.7s |
| 10 | Kingdom Hearts 2 | 14.9s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 58.6s |
| 2 | Kingdom Hearts 2 | 55.7s |
| 3 | Dark Souls III | 24.8s |
| 4 | Terraria | 22.8s |
| 5 | Starcraft 2 | 20.6s |
| 6 | Bomb Rush Cyberfunk | 19.3s |
| 7 | A Hat in Time | 17.4s |
| 8 | Links Awakening DX | 16.8s |
| 9 | Kingdom Hearts | 14.8s |
| 10 | Celeste (Open World) | 14.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Total | 303.0s | 856.6s | 6.3s | 179.4s | 593.2s | 743.4s |
| Average | 4.5s | 12.6s | 0.1s | 2.9s | 10.6s | 13.3s |
| Max | 26.7s | 72.8s | 0.5s | 8.2s | 23.8s | 62.0s |
| Min | 2.6s | 5.4s | 0.1s | 2.5s | 5.4s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (26.7s) | Stardew Valley (72.8s) | Kingdom Hearts 2 (0.5s) | Stardew Valley (8.2s) | Dark Souls III (23.8s) | Super Metroid (62.0s) |
| Fastest | MathProof2p2e4 (2.6s) | MathProof2p2e4 (5.4s) | MathProof2p2e4 (0.1s) | Adventure (2.5s) | Adventure (5.4s) | Noita (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 4.6s | 16.8s | 0.1s | 3.0s | 13.8s | 17.5s |
| A Link to the Past | 9.8s | 20.9s | 0.1s | - | - | - |
| A Short Hike | 2.9s | 10.9s | 0.1s | 2.7s | 9.6s | 9.7s |
| APQuest | 2.9s | 8.8s | 0.1s | 2.6s | - | - |
| Adventure | 2.7s | 7.7s | 0.1s | 2.5s | 5.4s | 13.8s |
| Aquaria | 7.0s | 12.1s | 0.1s | 2.8s | 7.7s | 14.7s |
| Bomb Rush Cyberfunk | 9.8s | 20.3s | 0.1s | 3.0s | 19.8s | 19.3s |
| Bumper Stickers | 2.9s | 11.8s | 0.1s | 2.7s | 8.6s | 14.2s |
| Castlevania - Circle of the Moon | 3.0s | 7.0s | 0.1s | 2.6s | - | - |
| Castlevania 64 | 3.2s | 7.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Celeste (Open World) | 3.9s | 14.7s | 0.1s | 3.9s | 14.8s | 14.6s |
| Celeste 64 | 2.7s | 6.6s | 0.1s | 2.7s | 7.6s | 14.3s |
| ChecksFinder | 2.6s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 14.3s |
| Choo-Choo Charles | 2.6s | 10.6s | 0.1s | 2.6s | 9.5s | 9.5s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s | 17.4s |
| DLCQuest | 3.0s | 5.7s | 0.1s | 2.8s | 5.7s | 5.6s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s | 14.3s |
| DOOM II | 3.2s | 15.9s | 0.1s | 3.0s | 15.7s | 14.4s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 3.2s | 23.8s | 17.4s |
| Donkey Kong Country 3 | 2.9s | 14.7s | 0.1s | - | - | - |
| Factorio | 3.3s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Faxanadu | 2.7s | 6.6s | 0.1s | 2.7s | 8.7s | 14.3s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 3.0s | 10.7s | 10.8s |
| Heretic | 3.0s | 15.6s | 0.1s | 2.8s | 15.5s | 14.0s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 2.8s | 6.7s | 6.7s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.7s | 6.7s | 6.7s |
| Kingdom Hearts | 9.0s | 29.0s | 0.1s | 3.1s | 23.8s | 14.9s |
| Kingdom Hearts 2 | 5.2s | 41.9s | 0.5s | 3.6s | 14.6s | 17.7s |
| Kirby's Dream Land 3 | 4.7s | 55.6s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.8s | 17.7s | 14.3s |
| Links Awakening DX | 9.2s | 16.7s | 0.1s | 3.3s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.7s | 9.7s | 0.1s | 2.8s | 9.8s | 9.7s |
| MathProof2p2e4 | 2.6s | 5.4s | 0.1s | 2.5s | 5.5s | 13.8s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.6s | - | - |
| MegaMan Battle Network 3 | 3.0s | 7.7s | 0.1s | 2.8s | 7.7s | 17.4s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.7s | 5.7s | 14.2s |
| Metamath | 11.2s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.9s | 9.7s | 14.4s |
| Noita | 2.7s | 5.7s | 0.1s | 2.6s | 5.6s | 5.6s |
| Old School Runescape | 4.2s | 8.6s | 0.1s | 2.8s | 8.7s | 8.7s |
| Overcooked! 2 | 2.9s | 20.8s | 0.1s | 2.8s | 19.7s | 14.2s |
| Paint | 2.8s | 7.7s | 0.1s | 2.9s | 7.7s | 7.8s |
| Risk of Rain 2 | 2.7s | 6.5s | 0.1s | 2.5s | 6.5s | 6.5s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.8s | 6.7s | 14.3s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.8s | 9.7s | 14.4s |
| Sonic Adventure 2 Battle | 3.1s | 13.7s | 0.1s | 2.9s | 16.7s | 14.4s |
| Starcraft 2 | 6.2s | 20.8s | 0.1s | 3.3s | 17.8s | 14.5s |
| Stardew Valley | 5.6s | 72.8s | 0.3s | 8.2s | - | - |
| Subnautica | 26.7s | 14.9s | 0.1s | 2.7s | 14.7s | 17.7s |
| Super Mario 64 | 2.8s | 12.7s | 0.1s | 2.8s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.7s | 7.8s | 0.1s | 2.5s | - | - |
| Super Mario World | 4.0s | 6.7s | 0.1s | - | - | - |
| Super Metroid | 10.1s | 10.5s | 0.1s | 2.6s | 12.6s | 62.0s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| TOEM rule builder | 2.7s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.8s | 19.8s | 23.6s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.3s | 12.9s | 0.1s | 2.7s | - | - |
| The Wind Waker | 16.0s | 9.7s | 0.1s | 2.7s | 9.6s | 14.3s |
| Timespinner | 3.1s | 7.6s | 0.1s | 2.7s | 7.7s | 14.3s |
| Undertale | 2.8s | 5.7s | 0.1s | - | - | - |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s | 5.7s |
| Wargroove | 2.6s | 6.4s | 0.1s | 2.5s | 6.5s | 6.4s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s | 14.2s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| shapez | 4.1s | 6.7s | 0.1s | 2.7s | 6.6s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.7s |
| 2 | The Wind Waker | 16.0s |
| 3 | Metamath | 11.2s |
| 4 | Super Metroid | 10.1s |
| 5 | A Link to the Past | 9.8s |
| 6 | Bomb Rush Cyberfunk | 9.8s |
| 7 | Links Awakening DX | 9.2s |
| 8 | Kingdom Hearts | 9.0s |
| 9 | Aquaria | 7.0s |
| 10 | Starcraft 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 72.8s |
| 2 | Kirby's Dream Land 3 | 55.6s |
| 3 | Kingdom Hearts 2 | 41.9s |
| 4 | Kingdom Hearts | 29.0s |
| 5 | Dark Souls III | 24.8s |
| 6 | A Link to the Past | 20.9s |
| 7 | Overcooked! 2 | 20.8s |
| 8 | Starcraft 2 | 20.8s |
| 9 | Terraria | 20.8s |
| 10 | Bomb Rush Cyberfunk | 20.3s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
| 2 | Stardew Valley | 0.3s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | A Link to the Past | 0.1s |
| 7 | Aquaria | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | A Short Hike | 0.1s |
| 10 | APQuest | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 8.2s |
| 2 | Celeste (Open World) | 3.9s |
| 3 | Kingdom Hearts 2 | 3.6s |
| 4 | Links Awakening DX | 3.3s |
| 5 | Starcraft 2 | 3.3s |
| 6 | Dark Souls III | 3.2s |
| 7 | Kingdom Hearts | 3.1s |
| 8 | A Hat in Time | 3.0s |
| 9 | Bomb Rush Cyberfunk | 3.0s |
| 10 | DOOM II | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.8s |
| 2 | Kingdom Hearts | 23.8s |
| 3 | Bomb Rush Cyberfunk | 19.8s |
| 4 | Terraria | 19.8s |
| 5 | Overcooked! 2 | 19.7s |
| 6 | Starcraft 2 | 17.8s |
| 7 | Landstalker - The Treasures of King Nole | 17.7s |
| 8 | Links Awakening DX | 16.8s |
| 9 | Sonic Adventure 2 Battle | 16.7s |
| 10 | DOOM II | 15.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 62.0s |
| 2 | Terraria | 23.6s |
| 3 | Bomb Rush Cyberfunk | 19.3s |
| 4 | Kingdom Hearts 2 | 17.7s |
| 5 | Subnautica | 17.7s |
| 6 | A Hat in Time | 17.5s |
| 7 | Civilization VI | 17.4s |
| 8 | Dark Souls III | 17.4s |
| 9 | MegaMan Battle Network 3 | 17.4s |
| 10 | Links Awakening DX | 16.8s |
