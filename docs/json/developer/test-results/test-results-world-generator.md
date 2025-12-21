# World Generator Test Results

**Generated:** 2025-12-21 22:13:30 UTC
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
| Test Seed Generation | 37 | 32 | 69 |
| Test Spoiler Test | 37 | 0 | 37 |
| Cross-Validation | 22 | 14 | 36 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ❌ | - | - |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ❌ | - | - |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Inscryption | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Meritous | ✅ | ✅ | ✅ | ❌ | - | - |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ❌ | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

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
| Test Seed Generation | 38 | 31 | 69 |
| Test Spoiler Test | 38 | 0 | 38 |
| Cross-Validation | 10 | 27 | 37 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past | ✅ | ✅ | ❌ | - | - | - |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ❌ | - | - |
| Donkey Kong Country 3 | ✅ | ✅ | ❌ | - | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ❌ | - | - |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Inscryption | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ❌ | - | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Meritous | ✅ | ✅ | ✅ | ❌ | - | - |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ❌ | - | - |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ❌ | - | - | - |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ❌ | - | - | - |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ❌ | - | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yacht Dice | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 313.1s | 882.5s | 6.7s | 171.9s | 365.6s |
| Average | 4.5s | 12.8s | 0.1s | 2.7s | 9.9s |
| Max | 26.4s | 72.8s | 0.7s | 3.7s | 19.8s |
| Min | 2.6s | 5.6s | 0.1s | 2.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.4s) | Stardew Valley (72.8s) | Kingdom Hearts 2 (0.7s) | Celeste (Open World) (3.7s) | Bomb Rush Cyberfunk (19.8s) |
| Fastest | ChocolateChipCookies (2.6s) | Undertale (5.6s) | Yacht Dice (0.1s) | The Wind Waker (2.5s) | VVVVVV (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.8s | 15.3s | 0.1s | 2.5s | - |
| A Link to the Past | 9.8s | 18.3s | 0.1s | - | - |
| A Short Hike | 3.0s | 13.9s | 0.1s | 2.7s | 9.7s |
| APQuest | 2.8s | 6.8s | 0.1s | 2.5s | - |
| Adventure | 3.0s | 8.8s | 0.1s | 2.8s | 5.7s |
| Aquaria | 7.2s | 11.1s | 0.1s | 3.0s | 7.8s |
| Bomb Rush Cyberfunk | 11.5s | 25.2s | 0.1s | 2.9s | 19.8s |
| Bumper Stickers | 2.9s | 12.7s | 0.1s | 2.8s | 8.7s |
| Castlevania - Circle of the Moon | 2.9s | 9.9s | 0.1s | 2.5s | - |
| Castlevania 64 | 3.1s | 10.7s | 0.1s | 2.6s | - |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 3.7s | 14.8s |
| Celeste 64 | 2.8s | 6.7s | 0.1s | 2.7s | 7.6s |
| ChecksFinder | 2.7s | 6.6s | 0.1s | 2.7s | 6.6s |
| ChocolateChipCookies | 2.6s | 5.7s | 0.1s | 2.6s | 5.6s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.9s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.7s | - |
| DLCQuest | 3.1s | 5.7s | 0.1s | 2.9s | 5.7s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.1s | 14.7s | 0.1s | 2.8s | 14.7s |
| Dark Souls III | 5.0s | 25.9s | 0.1s | 2.6s | - |
| Donkey Kong Country 3 | 2.9s | 13.7s | 0.1s | - | - |
| Factorio | 3.4s | 9.7s | 0.1s | 2.7s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.5s | - |
| Final Fantasy Mystic Quest | 3.7s | 10.7s | 0.1s | 2.8s | 10.7s |
| Heretic | 3.2s | 14.8s | 0.1s | 2.9s | 14.8s |
| Hylics 2 | 3.9s | 6.7s | 0.1s | 2.9s | 6.7s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.6s | - |
| Kingdom Hearts | 8.9s | 28.9s | 0.1s | 2.5s | - |
| Kingdom Hearts 2 | 5.3s | 42.9s | 0.7s | 2.6s | - |
| Kirby's Dream Land 3 | 4.8s | 54.6s | 0.1s | - | - |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 2.8s | 17.7s |
| Links Awakening DX | 9.2s | 16.8s | 0.1s | 3.1s | 16.8s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 9.7s | 0.1s | 2.8s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.8s | 0.1s | 2.7s | 5.6s |
| Mega Man 2 | 3.0s | 6.7s | 0.1s | 2.8s | - |
| MegaMan Battle Network 3 | 3.2s | 8.7s | 0.1s | 2.6s | - |
| Meritous | 2.9s | 5.7s | 0.1s | 2.6s | - |
| Metamath | 9.8s | 5.6s | 0.1s | 2.5s | - |
| Muse Dash | 3.2s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.8s | 5.7s | 0.1s | 2.7s | 5.7s |
| Old School Runescape | 4.3s | 8.7s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 3.0s | 21.8s | 0.1s | 2.9s | 19.7s |
| Paint | 2.7s | 6.7s | 0.1s | 2.7s | 6.7s |
| Risk of Rain 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s |
| Saving Princess | 3.1s | 5.7s | 0.1s | 3.0s | 6.7s |
| Shivers | 3.3s | 9.7s | 0.1s | 2.6s | - |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.9s | 16.7s |
| Starcraft 2 | 6.2s | 28.8s | 0.1s | 2.5s | - |
| Stardew Valley | 5.8s | 72.8s | 0.3s | 2.6s | - |
| Subnautica | 26.4s | 14.7s | 0.1s | 2.7s | 9.7s |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.5s | - |
| Super Mario Land 2 | 3.8s | 7.8s | 0.1s | 2.5s | - |
| Super Mario World | 3.8s | 6.6s | 0.1s | - | - |
| Super Metroid | 11.6s | 10.7s | 0.1s | 2.9s | 12.7s |
| TOEM original | 3.1s | 9.7s | 0.1s | 2.9s | 9.7s |
| TOEM rule builder | 2.9s | 8.7s | 0.1s | 2.8s | 9.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.6s | - |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | - | - |
| The Messenger | 3.3s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 15.8s | 9.7s | 0.1s | 2.5s | - |
| Timespinner | 3.2s | 7.7s | 0.1s | 2.5s | - |
| Undertale | 2.9s | 5.6s | 0.1s | - | - |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Wargroove | 2.8s | 6.6s | 0.1s | 2.8s | 6.6s |
| WebDevJourney | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s |
| Yacht Dice | 3.7s | 8.8s | 0.1s | 2.8s | 5.7s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.6s | - |
| shapez | 4.1s | 6.6s | 0.1s | 2.5s | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.4s |
| 2 | The Wind Waker | 15.8s |
| 3 | Super Metroid | 11.6s |
| 4 | Bomb Rush Cyberfunk | 11.5s |
| 5 | A Link to the Past | 9.8s |
| 6 | Metamath | 9.8s |
| 7 | Links Awakening DX | 9.2s |
| 8 | Kingdom Hearts | 8.9s |
| 9 | Aquaria | 7.2s |
| 10 | Starcraft 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 72.8s |
| 2 | Kirby's Dream Land 3 | 54.6s |
| 3 | Kingdom Hearts 2 | 42.9s |
| 4 | Kingdom Hearts | 28.9s |
| 5 | Starcraft 2 | 28.8s |
| 6 | Dark Souls III | 25.9s |
| 7 | Bomb Rush Cyberfunk | 25.2s |
| 8 | Overcooked! 2 | 21.8s |
| 9 | Terraria | 20.8s |
| 10 | A Link to the Past | 18.3s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.7s |
| 2 | Stardew Valley | 0.3s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | The Wind Waker | 0.1s |
| 6 | Yoshi's Island | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Link to the Past | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.7s |
| 2 | Links Awakening DX | 3.1s |
| 3 | Aquaria | 3.0s |
| 4 | Saving Princess | 3.0s |
| 5 | Bomb Rush Cyberfunk | 2.9s |
| 6 | Hylics 2 | 2.9s |
| 7 | TOEM original | 2.9s |
| 8 | Choo-Choo Charles | 2.9s |
| 9 | DLCQuest | 2.9s |
| 10 | Heretic | 2.9s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Bomb Rush Cyberfunk | 19.8s |
| 2 | Overcooked! 2 | 19.7s |
| 3 | Landstalker - The Treasures of King Nole | 17.7s |
| 4 | Links Awakening DX | 16.8s |
| 5 | Sonic Adventure 2 Battle | 16.7s |
| 6 | Heretic | 14.8s |
| 7 | Celeste (Open World) | 14.8s |
| 8 | DOOM II | 14.7s |
| 9 | DOOM 1993 | 12.7s |
| 10 | Super Metroid | 12.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 313.1s | 883.3s | 6.7s | 175.3s | 378.5s |
| Average | 4.5s | 12.8s | 0.1s | 2.8s | 10.0s |
| Max | 27.1s | 71.8s | 0.6s | 4.0s | 19.8s |
| Min | 2.7s | 5.6s | 0.1s | 2.4s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (27.1s) | Stardew Valley (71.8s) | Kingdom Hearts 2 (0.6s) | Celeste (Open World) (4.0s) | Overcooked! 2 (19.8s) |
| Fastest | ChocolateChipCookies (2.7s) | Metamath (5.6s) | Celeste 64 (0.1s) | Super Mario 64 (2.4s) | Adventure (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.9s | 14.8s | 0.1s | 3.0s | 13.7s |
| A Link to the Past | 9.4s | 21.2s | 0.1s | - | - |
| A Short Hike | 3.1s | 14.5s | 0.1s | 2.9s | 9.7s |
| APQuest | 3.0s | 7.1s | 0.1s | 2.7s | - |
| Adventure | 2.9s | 8.3s | 0.1s | 2.7s | 5.6s |
| Aquaria | 6.9s | 10.6s | 0.1s | 2.8s | 7.7s |
| Bomb Rush Cyberfunk | 11.4s | 27.1s | 0.2s | 2.9s | 18.8s |
| Bumper Stickers | 3.1s | 9.3s | 0.1s | 2.9s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 8.7s | 0.1s | 2.7s | - |
| Castlevania 64 | 3.1s | 10.0s | 0.1s | 2.6s | - |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 4.0s | 14.8s |
| Celeste 64 | 2.7s | 6.5s | 0.1s | 2.6s | 7.5s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 2.9s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.7s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.8s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.5s | - |
| DLCQuest | 3.0s | 5.7s | 0.1s | 2.9s | 5.6s |
| DOOM 1993 | 3.1s | 12.7s | 0.1s | 3.1s | 12.8s |
| DOOM II | 3.2s | 15.8s | 0.1s | 3.0s | 15.8s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 2.6s | - |
| Donkey Kong Country 3 | 3.0s | 14.8s | 0.1s | - | - |
| Factorio | 3.3s | 9.5s | 0.1s | 2.6s | 9.5s |
| Faxanadu | 2.9s | 6.7s | 0.1s | 2.7s | - |
| Final Fantasy Mystic Quest | 4.0s | 10.7s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.2s | 14.7s | 0.1s | 2.9s | 14.7s |
| Hylics 2 | 3.7s | 6.6s | 0.1s | 2.7s | 6.6s |
| Inscryption | 2.8s | 6.7s | 0.1s | 2.5s | - |
| Kingdom Hearts | 9.1s | 28.9s | 0.1s | 2.7s | - |
| Kingdom Hearts 2 | 5.5s | 42.8s | 0.6s | 2.7s | - |
| Kirby's Dream Land 3 | 4.5s | 56.0s | 0.1s | - | - |
| Landstalker - The Treasures of King Nole | 3.2s | 8.7s | 0.1s | 3.1s | 17.9s |
| Links Awakening DX | 9.2s | 17.6s | 0.1s | 3.1s | 17.6s |
| Lufia II Ancient Cave | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mario & Luigi Superstar Saga | 3.8s | 9.8s | 0.1s | 2.9s | 9.7s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Mega Man 2 | 2.8s | 6.7s | 0.1s | 2.5s | - |
| MegaMan Battle Network 3 | 3.0s | 8.7s | 0.1s | 2.6s | - |
| Meritous | 3.0s | 5.7s | 0.1s | 2.7s | - |
| Metamath | 9.9s | 5.6s | 0.1s | 2.6s | - |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.9s | 5.7s | 0.1s | 3.0s | 5.8s |
| Old School Runescape | 4.3s | 8.5s | 0.1s | 2.7s | 8.5s |
| Overcooked! 2 | 3.1s | 21.9s | 0.1s | 2.9s | 19.8s |
| Paint | 2.9s | 7.9s | 0.1s | 3.0s | 6.8s |
| Risk of Rain 2 | 2.9s | 6.6s | 0.1s | 2.8s | 6.7s |
| Saving Princess | 2.7s | 5.7s | 0.1s | 2.7s | 6.6s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.6s | - |
| Sonic Adventure 2 Battle | 3.4s | 13.7s | 0.1s | 3.0s | 16.8s |
| Starcraft 2 | 6.3s | 28.8s | 0.1s | 2.6s | - |
| Stardew Valley | 5.6s | 71.8s | 0.3s | 3.1s | - |
| Subnautica | 27.1s | 14.7s | 0.1s | 3.0s | 9.8s |
| Super Mario 64 | 2.8s | 12.5s | 0.1s | 2.4s | - |
| Super Mario Land 2 | 4.0s | 7.8s | 0.1s | 2.6s | - |
| Super Mario World | 4.1s | 6.7s | 0.1s | - | - |
| Super Metroid | 11.6s | 10.7s | 0.1s | 2.9s | 12.7s |
| TOEM original | 2.8s | 8.6s | 0.1s | 2.8s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.7s | 8.7s |
| Terraria | 3.0s | 20.8s | 0.1s | 2.7s | - |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | - | - |
| The Messenger | 3.3s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 15.8s | 9.7s | 0.1s | 2.8s | - |
| Timespinner | 3.2s | 7.5s | 0.1s | 2.4s | - |
| Undertale | 3.0s | 5.7s | 0.1s | - | - |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Wargroove | 2.8s | 6.6s | 0.1s | 2.7s | 6.7s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.7s | 8.6s |
| Yacht Dice | 3.4s | 8.7s | 0.1s | 2.7s | 5.7s |
| Yoshi's Island | 3.6s | 9.7s | 0.1s | 2.7s | - |
| shapez | 4.2s | 6.7s | 0.1s | 2.6s | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.1s |
| 2 | The Wind Waker | 15.8s |
| 3 | Super Metroid | 11.6s |
| 4 | Bomb Rush Cyberfunk | 11.4s |
| 5 | Metamath | 9.9s |
| 6 | A Link to the Past | 9.4s |
| 7 | Links Awakening DX | 9.2s |
| 8 | Kingdom Hearts | 9.1s |
| 9 | Aquaria | 6.9s |
| 10 | Starcraft 2 | 6.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.8s |
| 2 | Kirby's Dream Land 3 | 56.0s |
| 3 | Kingdom Hearts 2 | 42.8s |
| 4 | Kingdom Hearts | 28.9s |
| 5 | Starcraft 2 | 28.8s |
| 6 | Bomb Rush Cyberfunk | 27.1s |
| 7 | Dark Souls III | 24.8s |
| 8 | Overcooked! 2 | 21.9s |
| 9 | A Link to the Past | 21.2s |
| 10 | Terraria | 20.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.6s |
| 2 | Stardew Valley | 0.3s |
| 3 | Bomb Rush Cyberfunk | 0.2s |
| 4 | Starcraft 2 | 0.1s |
| 5 | Yoshi's Island | 0.1s |
| 6 | The Wind Waker | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Link to the Past | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 4.0s |
| 2 | Stardew Valley | 3.1s |
| 3 | Links Awakening DX | 3.1s |
| 4 | Landstalker - The Treasures of King Nole | 3.1s |
| 5 | DOOM 1993 | 3.1s |
| 6 | Subnautica | 3.0s |
| 7 | Noita | 3.0s |
| 8 | Sonic Adventure 2 Battle | 3.0s |
| 9 | DOOM II | 3.0s |
| 10 | A Hat in Time | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Overcooked! 2 | 19.8s |
| 2 | Bomb Rush Cyberfunk | 18.8s |
| 3 | Landstalker - The Treasures of King Nole | 17.9s |
| 4 | Links Awakening DX | 17.6s |
| 5 | Sonic Adventure 2 Battle | 16.8s |
| 6 | DOOM II | 15.8s |
| 7 | Celeste (Open World) | 14.8s |
| 8 | Heretic | 14.7s |
| 9 | A Hat in Time | 13.7s |
| 10 | DOOM 1993 | 12.8s |
