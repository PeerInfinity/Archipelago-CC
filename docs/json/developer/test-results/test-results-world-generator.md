# World Generator Test Results

**Generated:** 2025-12-17 03:35:49 UTC
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
| The Messenger | ✅ | ✅ | ❌ | - | - | - |
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
| Test World Generation | 69 | 2 | 71 |
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
| The Messenger | ✅ | ✅ | ❌ | - | - | - |
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
| Total | 322.8s | 900.4s | 5.9s | 190.2s | 615.2s |
| Average | 4.5s | 12.7s | 0.1s | 2.8s | 11.6s |
| Max | 26.8s | 80.8s | 0.2s | 3.7s | 56.0s |
| Min | 2.7s | 5.6s | 0.1s | 0.4s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.8s) | Stardew Valley (80.8s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (3.7s) | Kirby's Dream Land 3 (56.0s) |
| Fastest | VVVVVV (2.7s) | MathProof2p2e4 (5.6s) | shapez (0.1s) | A Link to the Past (0.4s) | Meritous (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.6s | 14.3s | 0.1s | 2.5s | - |
| A Link to the Past | 10.7s | 20.9s | 0.1s | 0.4s | - |
| A Short Hike | 3.0s | 12.9s | 0.1s | 2.7s | 9.7s |
| APQuest | 3.0s | 7.3s | 0.1s | 2.9s | 5.7s |
| Adventure | 2.9s | 7.0s | 0.1s | 2.7s | 5.6s |
| Aquaria | 7.1s | 10.5s | 0.1s | 2.7s | 7.6s |
| Bomb Rush Cyberfunk | 11.0s | 21.8s | 0.1s | - | - |
| Bumper Stickers | 3.0s | 13.5s | 0.1s | 2.8s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 6.6s | 0.1s | 2.7s | 5.6s |
| Castlevania 64 | 3.1s | 10.2s | 0.1s | 2.7s | 6.6s |
| Celeste (Open World) | 3.9s | 14.7s | 0.1s | 3.7s | 14.7s |
| Celeste 64 | 3.4s | 6.8s | 0.1s | 3.0s | 7.7s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.7s | 6.6s |
| ChocolateChipCookies | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.8s | 9.7s |
| Civilization VI | 2.8s | 8.6s | 0.1s | 2.8s | 8.7s |
| DLCQuest | 3.0s | 5.8s | 0.1s | 2.7s | 5.6s |
| DOOM 1993 | 3.1s | 12.7s | 0.1s | 2.9s | 12.7s |
| DOOM II | 3.1s | 14.7s | 0.1s | 2.8s | 14.7s |
| Dark Souls III | 4.8s | 25.8s | 0.1s | 3.1s | 24.8s |
| Donkey Kong Country 3 | 2.8s | 13.8s | 0.1s | 2.7s | 13.7s |
| Factorio | 3.8s | 9.8s | 0.1s | 2.9s | 9.7s |
| Faxanadu | 2.9s | 6.7s | 0.1s | 2.7s | 8.7s |
| Final Fantasy Mystic Quest | 4.0s | 10.8s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.0s | 14.8s | 0.1s | 2.8s | 14.7s |
| Hylics 2 | 3.7s | 6.6s | 0.1s | 2.7s | 6.7s |
| Inscryption | 3.0s | 6.8s | 0.1s | 2.8s | 6.7s |
| Kingdom Hearts | 8.6s | 28.9s | 0.1s | 2.5s | - |
| Kingdom Hearts 2 | 5.5s | 41.9s | 0.2s | 2.7s | - |
| Kirby's Dream Land 3 | 4.5s | 55.0s | 0.1s | 3.1s | 56.0s |
| Landstalker - The Treasures of King Nole | 3.0s | 8.6s | 0.1s | 2.8s | 17.7s |
| Lingo | 3.6s | 5.8s | 0.1s | 3.1s | 41.6s |
| Links Awakening DX | 9.1s | 16.8s | 0.1s | 2.6s | - |
| Lufia II Ancient Cave | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 10.8s | 0.1s | 3.0s | 8.7s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Mega Man 2 | 2.9s | 6.7s | 0.1s | 2.7s | 6.6s |
| MegaMan Battle Network 3 | 3.2s | 8.7s | 0.1s | 2.9s | 7.7s |
| Meritous | 2.9s | 5.6s | 0.1s | 2.6s | 5.6s |
| Metamath | 9.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Muse Dash | 2.9s | 7.6s | 0.1s | 2.5s | - |
| Noita | 3.1s | 5.8s | 0.1s | 2.9s | 5.8s |
| Old School Runescape | 4.3s | 8.7s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 3.1s | 22.0s | 0.1s | 3.0s | 19.9s |
| Paint | 2.7s | 6.7s | 0.1s | 2.8s | 14.4s |
| Risk of Rain 2 | 2.9s | 6.6s | 0.1s | 2.8s | 6.7s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 3.0s | 6.8s |
| Secret of Evermore | 4.6s | 7.7s | 0.1s | 2.9s | 45.2s |
| Shivers | 3.0s | 9.7s | 0.1s | 2.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.0s | 32.8s | 0.1s | 2.6s | - |
| Stardew Valley | 5.8s | 80.8s | 0.2s | 2.8s | - |
| Subnautica | 26.8s | 14.7s | 0.1s | 2.6s | - |
| Super Mario 64 | 3.1s | 12.9s | 0.1s | 2.9s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.7s | 0.1s | 2.7s | - |
| Super Mario World | 3.9s | 6.6s | 0.1s | 2.8s | 6.7s |
| Super Metroid | 11.5s | 10.8s | 0.1s | 3.0s | 12.8s |
| TOEM original | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s |
| TOEM rule builder | 2.7s | 8.6s | 0.1s | 2.7s | 9.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.6s | - |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | 2.8s | 10.7s |
| The Messenger | 3.6s | 12.9s | 0.1s | - | - |
| The Wind Waker | 17.4s | 9.8s | 0.1s | 2.6s | - |
| Timespinner | 3.4s | 7.7s | 0.1s | 2.7s | - |
| Undertale | 3.0s | 5.6s | 0.1s | 2.6s | - |
| VVVVVV | 2.7s | 5.7s | 0.1s | 2.7s | 5.7s |
| Wargroove | 2.8s | 6.7s | 0.1s | 3.0s | 6.8s |
| WebDevJourney | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s |
| Yacht Dice | 3.5s | 8.7s | 0.1s | 2.5s | - |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.6s | - |
| shapez | 4.1s | 6.6s | 0.1s | 2.7s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.8s |
| 2 | The Wind Waker | 17.4s |
| 3 | Super Metroid | 11.5s |
| 4 | Bomb Rush Cyberfunk | 11.0s |
| 5 | A Link to the Past | 10.7s |
| 6 | Metamath | 9.7s |
| 7 | Links Awakening DX | 9.1s |
| 8 | Kingdom Hearts | 8.6s |
| 9 | Aquaria | 7.1s |
| 10 | Starcraft 2 | 6.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 80.8s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 41.9s |
| 4 | Starcraft 2 | 32.8s |
| 5 | Kingdom Hearts | 28.9s |
| 6 | Dark Souls III | 25.8s |
| 7 | Overcooked! 2 | 22.0s |
| 8 | Bomb Rush Cyberfunk | 21.8s |
| 9 | A Link to the Past | 20.9s |
| 10 | Terraria | 20.8s |

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
| 8 | APQuest | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.7s |
| 2 | Lingo | 3.1s |
| 3 | Dark Souls III | 3.1s |
| 4 | Kirby's Dream Land 3 | 3.1s |
| 5 | Super Metroid | 3.0s |
| 6 | Final Fantasy Mystic Quest | 3.0s |
| 7 | Mario & Luigi Superstar Saga | 3.0s |
| 8 | Saving Princess | 3.0s |
| 9 | Celeste 64 | 3.0s |
| 10 | Wargroove | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.0s |
| 2 | Secret of Evermore | 45.2s |
| 3 | Lingo | 41.6s |
| 4 | Dark Souls III | 24.8s |
| 5 | Overcooked! 2 | 19.9s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | Heretic | 14.7s |
| 9 | Celeste (Open World) | 14.7s |
| 10 | DOOM II | 14.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 319.4s | 902.4s | 5.9s | 193.3s | 620.1s |
| Average | 4.5s | 12.7s | 0.1s | 2.8s | 11.7s |
| Max | 26.7s | 77.8s | 0.2s | 3.7s | 55.9s |
| Min | 2.5s | 5.5s | 0.1s | 0.4s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.7s) | Stardew Valley (77.8s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (3.7s) | Kirby's Dream Land 3 (55.9s) |
| Fastest | Saving Princess (2.5s) | Saving Princess (5.5s) | Wargroove (0.1s) | A Link to the Past (0.4s) | DLCQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.3s | 16.6s | 0.1s | 2.4s | - |
| A Link to the Past | 10.1s | 21.9s | 0.1s | 0.4s | - |
| A Short Hike | 3.0s | 10.7s | 0.1s | 2.8s | 9.7s |
| APQuest | 2.8s | 7.3s | 0.1s | 2.6s | 5.6s |
| Adventure | 3.3s | 7.4s | 0.1s | 3.2s | 5.9s |
| Aquaria | 7.8s | 9.4s | 0.1s | 3.0s | 7.8s |
| Bomb Rush Cyberfunk | 10.1s | 22.6s | 0.1s | - | - |
| Bumper Stickers | 2.9s | 11.4s | 0.1s | 2.9s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 8.6s | 0.1s | 2.8s | 5.7s |
| Castlevania 64 | 3.1s | 9.7s | 0.1s | 2.8s | 6.7s |
| Celeste (Open World) | 3.8s | 14.6s | 0.1s | 3.7s | 14.6s |
| Celeste 64 | 3.1s | 6.6s | 0.1s | 2.8s | 7.7s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.8s | 6.7s |
| ChocolateChipCookies | 2.6s | 5.6s | 0.1s | 2.6s | 5.6s |
| Choo-Choo Charles | 3.2s | 10.9s | 0.1s | 3.2s | 10.9s |
| Civilization VI | 3.1s | 8.8s | 0.1s | 3.0s | 8.8s |
| DLCQuest | 2.7s | 5.6s | 0.1s | 2.6s | 5.5s |
| DOOM 1993 | 2.9s | 12.7s | 0.1s | 3.1s | 12.8s |
| DOOM II | 3.1s | 15.7s | 0.1s | 2.9s | 15.8s |
| Dark Souls III | 4.8s | 24.8s | 0.1s | 3.1s | 23.8s |
| Donkey Kong Country 3 | 2.8s | 14.7s | 0.1s | 2.7s | 14.5s |
| Factorio | 3.5s | 9.7s | 0.1s | 2.9s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.8s | 8.7s |
| Final Fantasy Mystic Quest | 3.6s | 10.7s | 0.1s | 2.8s | 10.7s |
| Heretic | 3.5s | 16.0s | 0.1s | 3.3s | 15.9s |
| Hylics 2 | 4.1s | 6.8s | 0.1s | 2.9s | 6.8s |
| Inscryption | 2.6s | 6.5s | 0.1s | 2.5s | 6.5s |
| Kingdom Hearts | 8.7s | 29.9s | 0.1s | 2.9s | - |
| Kingdom Hearts 2 | 5.2s | 42.0s | 0.2s | 2.7s | - |
| Kirby's Dream Land 3 | 4.5s | 54.6s | 0.1s | 3.2s | 55.9s |
| Landstalker - The Treasures of King Nole | 3.0s | 8.6s | 0.1s | 2.8s | 18.6s |
| Lingo | 3.4s | 5.7s | 0.1s | 3.0s | 41.0s |
| Links Awakening DX | 9.5s | 16.8s | 0.1s | 2.7s | - |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s |
| Mario & Luigi Superstar Saga | 4.1s | 11.0s | 0.1s | 3.4s | 8.9s |
| MathProof2p2e4 | 3.0s | 5.8s | 0.1s | 3.0s | 5.8s |
| Mega Man 2 | 2.6s | 6.5s | 0.1s | 2.6s | 6.5s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 3.0s | 7.7s |
| Meritous | 3.0s | 5.7s | 0.1s | 2.7s | 5.7s |
| Metamath | 9.8s | 5.7s | 0.1s | 2.7s | 5.6s |
| Muse Dash | 2.8s | 7.5s | 0.1s | 2.5s | - |
| Noita | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Old School Runescape | 4.3s | 8.7s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 2.9s | 20.8s | 0.1s | 2.8s | 19.7s |
| Paint | 3.1s | 7.9s | 0.1s | 3.2s | 14.8s |
| Risk of Rain 2 | 3.3s | 6.8s | 0.1s | 2.9s | 6.7s |
| Saving Princess | 2.5s | 5.5s | 0.1s | 2.5s | 6.5s |
| Secret of Evermore | 4.4s | 7.7s | 0.1s | 3.0s | 45.9s |
| Shivers | 3.1s | 9.8s | 0.1s | 2.9s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 5.8s | 33.6s | 0.1s | 2.5s | - |
| Stardew Valley | 5.6s | 77.8s | 0.2s | 3.4s | - |
| Subnautica | 26.7s | 14.7s | 0.1s | 2.6s | - |
| Super Mario 64 | 2.8s | 12.7s | 0.1s | 2.8s | 12.7s |
| Super Mario Land 2 | 4.5s | 7.9s | 0.1s | 3.0s | - |
| Super Mario World | 4.4s | 6.8s | 0.1s | 3.0s | 6.8s |
| Super Metroid | 10.2s | 10.5s | 0.1s | 2.6s | 12.5s |
| TOEM original | 2.7s | 9.8s | 0.1s | 3.0s | 9.8s |
| TOEM rule builder | 2.8s | 8.6s | 0.1s | 2.7s | 9.7s |
| Terraria | 3.0s | 20.8s | 0.1s | 2.6s | - |
| The Legend of Zelda | 4.1s | 8.5s | 0.1s | 2.8s | 10.5s |
| The Messenger | 3.3s | 12.8s | 0.1s | - | - |
| The Wind Waker | 16.9s | 9.7s | 0.1s | 2.6s | - |
| Timespinner | 3.1s | 7.6s | 0.1s | 2.5s | - |
| Undertale | 3.3s | 5.8s | 0.1s | 2.9s | - |
| VVVVVV | 3.0s | 5.8s | 0.1s | 3.0s | 5.8s |
| Wargroove | 2.6s | 6.5s | 0.1s | 2.5s | 6.5s |
| WebDevJourney | 2.7s | 8.8s | 0.1s | 3.0s | 8.8s |
| Yacht Dice | 3.4s | 8.7s | 0.1s | 2.6s | - |
| Yoshi's Island | 3.7s | 9.7s | 0.1s | 2.6s | - |
| shapez | 3.9s | 6.5s | 0.1s | 2.7s | 6.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.7s |
| 2 | The Wind Waker | 16.9s |
| 3 | Super Metroid | 10.2s |
| 4 | A Link to the Past | 10.1s |
| 5 | Bomb Rush Cyberfunk | 10.1s |
| 6 | Metamath | 9.8s |
| 7 | Links Awakening DX | 9.5s |
| 8 | Kingdom Hearts | 8.7s |
| 9 | Aquaria | 7.8s |
| 10 | Starcraft 2 | 5.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 77.8s |
| 2 | Kirby's Dream Land 3 | 54.6s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Starcraft 2 | 33.6s |
| 5 | Kingdom Hearts | 29.9s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 22.6s |
| 8 | A Link to the Past | 21.9s |
| 9 | Terraria | 20.8s |
| 10 | Overcooked! 2 | 20.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.1s |
| 4 | Subnautica | 0.1s |
| 5 | Kingdom Hearts | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Starcraft 2 | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.7s |
| 2 | Mario & Luigi Superstar Saga | 3.4s |
| 3 | Stardew Valley | 3.4s |
| 4 | Heretic | 3.3s |
| 5 | Choo-Choo Charles | 3.2s |
| 6 | Kirby's Dream Land 3 | 3.2s |
| 7 | Adventure | 3.2s |
| 8 | Paint | 3.2s |
| 9 | DOOM 1993 | 3.1s |
| 10 | Dark Souls III | 3.1s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 55.9s |
| 2 | Secret of Evermore | 45.9s |
| 3 | Lingo | 41.0s |
| 4 | Dark Souls III | 23.8s |
| 5 | Overcooked! 2 | 19.7s |
| 6 | Landstalker - The Treasures of King Nole | 18.6s |
| 7 | Sonic Adventure 2 Battle | 16.7s |
| 8 | Heretic | 15.9s |
| 9 | DOOM II | 15.8s |
| 10 | Paint | 14.8s |
