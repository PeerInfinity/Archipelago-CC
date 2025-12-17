# World Generator Test Results

**Generated:** 2025-12-17 05:28:00 UTC
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
| Test Seed Generation | 59 | 12 | 71 |
| Test Spoiler Test | 56 | 3 | 59 |
| Cross-Validation | 41 | 18 | 59 |

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
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
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
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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

**Total Templates:** 71

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 71 | 0 | 71 |
| Original Spoiler Test | 71 | 0 | 71 |
| Test World Generation | 71 | 0 | 71 |
| Test Seed Generation | 59 | 12 | 71 |
| Test Spoiler Test | 56 | 3 | 59 |
| Cross-Validation | 19 | 40 | 59 |

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
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
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
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Total | 321.5s | 897.5s | 6.0s | 198.3s | 674.9s |
| Average | 4.5s | 12.6s | 0.1s | 2.8s | 11.4s |
| Max | 26.5s | 78.8s | 0.2s | 3.8s | 56.1s |
| Min | 2.6s | 5.5s | 0.1s | 0.4s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.5s) | Stardew Valley (78.8s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (3.8s) | Kirby's Dream Land 3 (56.1s) |
| Fastest | TOEM rule builder (2.6s) | Meritous (5.5s) | TOEM rule builder (0.1s) | A Link to the Past (0.4s) | Meritous (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.8s | 16.6s | 0.1s | 2.6s | - |
| A Link to the Past | 10.5s | 22.6s | 0.1s | 0.4s | - |
| A Short Hike | 3.0s | 10.7s | 0.1s | 2.7s | 9.6s |
| APQuest | 2.9s | 7.3s | 0.1s | 2.9s | 5.7s |
| Adventure | 3.0s | 6.8s | 0.1s | 2.8s | 5.7s |
| Aquaria | 7.2s | 8.5s | 0.1s | 3.0s | 7.8s |
| Bomb Rush Cyberfunk | 11.2s | 22.6s | 0.1s | 2.5s | - |
| Bumper Stickers | 2.9s | 10.8s | 0.1s | 2.7s | 8.7s |
| Castlevania - Circle of the Moon | 2.8s | 8.2s | 0.1s | 2.6s | 5.5s |
| Castlevania 64 | 3.2s | 7.5s | 0.1s | 2.9s | 6.7s |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 3.8s | 14.8s |
| Celeste 64 | 3.3s | 6.8s | 0.1s | 2.7s | 7.7s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s |
| ChocolateChipCookies | 2.7s | 5.6s | 0.1s | 2.9s | 5.7s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.9s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s |
| DLCQuest | 3.0s | 5.8s | 0.1s | 2.7s | 5.6s |
| DOOM 1993 | 3.0s | 12.8s | 0.1s | 2.8s | 12.7s |
| DOOM II | 2.9s | 15.6s | 0.1s | 2.7s | 15.5s |
| Dark Souls III | 5.0s | 24.9s | 0.1s | 3.3s | 25.8s |
| Donkey Kong Country 3 | 3.0s | 14.9s | 0.1s | 2.9s | 14.7s |
| Factorio | 3.5s | 9.7s | 0.1s | 2.7s | 9.7s |
| Faxanadu | 2.9s | 6.6s | 0.1s | 2.7s | 8.6s |
| Final Fantasy Mystic Quest | 3.7s | 10.7s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.2s | 14.8s | 0.1s | 3.0s | 14.8s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 3.0s | 6.7s |
| Inscryption | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s |
| Kingdom Hearts | 8.1s | 29.7s | 0.1s | 2.5s | - |
| Kingdom Hearts 2 | 5.2s | 41.0s | 0.2s | 2.5s | - |
| Kirby's Dream Land 3 | 4.7s | 56.0s | 0.1s | 3.2s | 56.1s |
| Landstalker - The Treasures of King Nole | 3.3s | 8.7s | 0.1s | 3.0s | 18.9s |
| Lingo | 3.5s | 5.8s | 0.1s | 2.9s | 40.8s |
| Links Awakening DX | 9.5s | 16.7s | 0.1s | 2.5s | - |
| Lufia II Ancient Cave | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mario & Luigi Superstar Saga | 3.9s | 9.8s | 0.1s | 3.2s | 8.7s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 3.0s | 5.7s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.7s | 7.7s |
| Meritous | 2.7s | 5.5s | 0.1s | 2.6s | 5.5s |
| Metamath | 10.4s | 5.7s | 0.1s | 2.8s | 5.7s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.8s | - |
| Noita | 2.9s | 5.8s | 0.1s | 2.8s | 5.7s |
| Old School Runescape | 4.4s | 8.7s | 0.1s | 2.8s | 8.7s |
| Overcooked! 2 | 2.9s | 21.9s | 0.1s | 2.9s | 19.9s |
| Paint | 2.9s | 7.9s | 0.1s | 2.9s | 6.8s |
| Risk of Rain 2 | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.7s | 6.6s |
| Secret of Evermore | 4.4s | 7.7s | 0.1s | 2.7s | 44.2s |
| Shivers | 2.8s | 9.5s | 0.1s | 2.6s | 9.5s |
| Sonic Adventure 2 Battle | 3.4s | 13.7s | 0.1s | 3.0s | 16.8s |
| Starcraft 2 | 6.5s | 32.8s | 0.1s | 2.8s | - |
| Stardew Valley | 5.7s | 78.8s | 0.2s | 2.7s | - |
| Subnautica | 26.5s | 14.7s | 0.1s | 3.8s | 15.2s |
| Super Mario 64 | 2.8s | 12.9s | 0.1s | 2.8s | 12.7s |
| Super Mario Land 2 | 4.1s | 7.7s | 0.1s | 2.7s | - |
| Super Mario World | 4.0s | 6.7s | 0.1s | 2.9s | 6.7s |
| Super Metroid | 11.3s | 10.7s | 0.1s | 2.7s | 11.7s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.7s | 8.6s |
| TOEM rule builder | 2.6s | 9.5s | 0.1s | 2.6s | 9.5s |
| Terraria | 3.0s | 20.8s | 0.1s | 3.0s | 20.8s |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | 3.1s | 10.8s |
| The Messenger | 3.4s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 16.7s | 9.8s | 0.1s | 2.8s | 9.7s |
| Timespinner | 3.1s | 7.8s | 0.1s | 2.7s | 6.6s |
| Undertale | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s |
| Wargroove | 2.7s | 6.6s | 0.1s | 2.7s | 6.6s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.7s | 8.6s |
| Yacht Dice | 3.1s | 8.5s | 0.1s | 2.5s | - |
| Yoshi's Island | 3.6s | 9.7s | 0.1s | 3.1s | 8.7s |
| shapez | 4.3s | 6.7s | 0.1s | 3.0s | 6.8s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.5s |
| 2 | The Wind Waker | 16.7s |
| 3 | Super Metroid | 11.3s |
| 4 | Bomb Rush Cyberfunk | 11.2s |
| 5 | A Link to the Past | 10.5s |
| 6 | Metamath | 10.4s |
| 7 | Links Awakening DX | 9.5s |
| 8 | Kingdom Hearts | 8.1s |
| 9 | Aquaria | 7.2s |
| 10 | Starcraft 2 | 6.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 78.8s |
| 2 | Kirby's Dream Land 3 | 56.0s |
| 3 | Kingdom Hearts 2 | 41.0s |
| 4 | Starcraft 2 | 32.8s |
| 5 | Kingdom Hearts | 29.7s |
| 6 | Dark Souls III | 24.9s |
| 7 | Bomb Rush Cyberfunk | 22.6s |
| 8 | A Link to the Past | 22.6s |
| 9 | Overcooked! 2 | 21.9s |
| 10 | Terraria | 20.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.1s |
| 4 | Subnautica | 0.1s |
| 5 | Starcraft 2 | 0.1s |
| 6 | A Hat in Time | 0.1s |
| 7 | Aquaria | 0.1s |
| 8 | Bomb Rush Cyberfunk | 0.1s |
| 9 | Kingdom Hearts | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.8s |
| 2 | Subnautica | 3.8s |
| 3 | Dark Souls III | 3.3s |
| 4 | Kirby's Dream Land 3 | 3.2s |
| 5 | Mario & Luigi Superstar Saga | 3.2s |
| 6 | Yoshi's Island | 3.1s |
| 7 | The Legend of Zelda | 3.1s |
| 8 | Aquaria | 3.0s |
| 9 | shapez | 3.0s |
| 10 | Final Fantasy Mystic Quest | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.1s |
| 2 | Secret of Evermore | 44.2s |
| 3 | Lingo | 40.8s |
| 4 | Dark Souls III | 25.8s |
| 5 | Terraria | 20.8s |
| 6 | Overcooked! 2 | 19.9s |
| 7 | Landstalker - The Treasures of King Nole | 18.9s |
| 8 | Sonic Adventure 2 Battle | 16.8s |
| 9 | DOOM II | 15.5s |
| 10 | Subnautica | 15.2s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 313.5s | 897.8s | 5.9s | 196.4s | 668.3s |
| Average | 4.4s | 12.6s | 0.1s | 2.8s | 11.3s |
| Max | 24.1s | 78.8s | 0.2s | 4.0s | 54.5s |
| Min | 2.5s | 5.6s | 0.1s | 0.4s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (24.1s) | Stardew Valley (78.8s) | Kingdom Hearts 2 (0.2s) | Celeste (Open World) (4.0s) | Kirby's Dream Land 3 (54.5s) |
| Fastest | ChecksFinder (2.5s) | Metamath (5.6s) | Faxanadu (0.1s) | A Link to the Past (0.4s) | Adventure (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.7s | 16.3s | 0.1s | 2.5s | - |
| A Link to the Past | 9.9s | 21.4s | 0.1s | 0.4s | - |
| A Short Hike | 2.8s | 12.5s | 0.1s | 2.5s | 9.4s |
| APQuest | 2.8s | 6.6s | 0.1s | 2.8s | 5.7s |
| Adventure | 2.9s | 7.4s | 0.1s | 2.7s | 5.6s |
| Aquaria | 7.2s | 11.5s | 0.1s | 3.1s | 7.8s |
| Bomb Rush Cyberfunk | 10.9s | 24.1s | 0.1s | 2.8s | - |
| Bumper Stickers | 3.0s | 11.9s | 0.1s | 2.9s | 8.7s |
| Castlevania - Circle of the Moon | 3.0s | 8.0s | 0.1s | 2.7s | 5.7s |
| Castlevania 64 | 3.0s | 7.8s | 0.1s | 2.7s | 6.6s |
| Celeste (Open World) | 4.0s | 13.8s | 0.1s | 4.0s | 14.8s |
| Celeste 64 | 3.1s | 6.8s | 0.1s | 2.7s | 7.7s |
| ChecksFinder | 2.5s | 6.4s | 0.1s | 2.6s | 6.5s |
| ChocolateChipCookies | 3.0s | 5.6s | 0.1s | 2.6s | 5.6s |
| Choo-Choo Charles | 2.8s | 10.7s | 0.1s | 2.8s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.8s |
| DLCQuest | 2.9s | 5.8s | 0.1s | 2.7s | 5.6s |
| DOOM 1993 | 3.1s | 12.8s | 0.1s | 3.0s | 12.8s |
| DOOM II | 3.1s | 15.8s | 0.1s | 2.9s | 15.7s |
| Dark Souls III | 4.6s | 24.7s | 0.1s | 3.0s | 23.7s |
| Donkey Kong Country 3 | 2.9s | 13.7s | 0.1s | 2.8s | 13.7s |
| Factorio | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 2.6s | 6.4s | 0.1s | 2.6s | 8.5s |
| Final Fantasy Mystic Quest | 3.6s | 10.7s | 0.1s | 2.8s | 10.7s |
| Heretic | 3.0s | 14.8s | 0.1s | 2.8s | 14.7s |
| Hylics 2 | 3.8s | 6.8s | 0.1s | 2.8s | 6.7s |
| Inscryption | 2.8s | 6.8s | 0.1s | 2.7s | 6.6s |
| Kingdom Hearts | 8.6s | 28.9s | 0.1s | 2.7s | - |
| Kingdom Hearts 2 | 5.4s | 42.0s | 0.2s | 2.6s | - |
| Kirby's Dream Land 3 | 4.5s | 55.0s | 0.1s | 3.1s | 54.5s |
| Landstalker - The Treasures of King Nole | 3.1s | 8.8s | 0.1s | 2.9s | 17.7s |
| Lingo | 3.3s | 5.7s | 0.1s | 3.0s | 40.8s |
| Links Awakening DX | 8.6s | 16.6s | 0.1s | 2.5s | - |
| Lufia II Ancient Cave | 2.7s | 5.7s | 0.1s | 2.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.6s | 9.7s | 0.1s | 2.9s | 8.7s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mega Man 2 | 2.7s | 6.6s | 0.1s | 2.6s | 6.6s |
| MegaMan Battle Network 3 | 3.2s | 8.7s | 0.1s | 2.9s | 7.7s |
| Meritous | 2.9s | 5.7s | 0.1s | 2.7s | 5.7s |
| Metamath | 10.9s | 5.6s | 0.1s | 2.7s | 5.6s |
| Muse Dash | 2.9s | 7.7s | 0.1s | 2.6s | - |
| Noita | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Old School Runescape | 3.9s | 8.5s | 0.1s | 2.6s | 8.5s |
| Overcooked! 2 | 2.9s | 20.8s | 0.1s | 2.7s | 19.8s |
| Paint | 2.7s | 6.8s | 0.1s | 2.7s | 6.7s |
| Risk of Rain 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.7s | 6.6s |
| Secret of Evermore | 4.6s | 7.7s | 0.1s | 2.9s | 45.4s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.8s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.2s | 32.9s | 0.1s | 2.7s | - |
| Stardew Valley | 5.5s | 78.8s | 0.2s | 3.4s | - |
| Subnautica | 24.1s | 14.5s | 0.1s | 3.7s | 14.8s |
| Super Mario 64 | 2.9s | 12.9s | 0.1s | 2.7s | 12.7s |
| Super Mario Land 2 | 4.0s | 7.7s | 0.1s | 2.5s | - |
| Super Mario World | 4.0s | 6.7s | 0.1s | 2.8s | 6.7s |
| Super Metroid | 11.4s | 10.7s | 0.1s | 2.8s | 11.7s |
| TOEM original | 2.9s | 9.7s | 0.1s | 2.8s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.8s | 9.7s |
| Terraria | 2.9s | 19.8s | 0.1s | 2.8s | 19.8s |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | 3.0s | 10.7s |
| The Messenger | 3.2s | 12.8s | 0.1s | 2.6s | - |
| The Wind Waker | 15.1s | 9.5s | 0.1s | 2.7s | 9.5s |
| Timespinner | 3.1s | 7.7s | 0.1s | 2.8s | 6.6s |
| Undertale | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Wargroove | 2.7s | 6.6s | 0.1s | 2.6s | 6.7s |
| WebDevJourney | 2.9s | 8.7s | 0.1s | 2.9s | 8.7s |
| Yacht Dice | 3.4s | 8.7s | 0.1s | 2.6s | - |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 8.7s |
| shapez | 4.2s | 6.7s | 0.1s | 2.8s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 24.1s |
| 2 | The Wind Waker | 15.1s |
| 3 | Super Metroid | 11.4s |
| 4 | Bomb Rush Cyberfunk | 10.9s |
| 5 | Metamath | 10.9s |
| 6 | A Link to the Past | 9.9s |
| 7 | Kingdom Hearts | 8.6s |
| 8 | Links Awakening DX | 8.6s |
| 9 | Aquaria | 7.2s |
| 10 | Starcraft 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 78.8s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Starcraft 2 | 32.9s |
| 5 | Kingdom Hearts | 28.9s |
| 6 | Dark Souls III | 24.7s |
| 7 | Bomb Rush Cyberfunk | 24.1s |
| 8 | A Link to the Past | 21.4s |
| 9 | Overcooked! 2 | 20.8s |
| 10 | Terraria | 19.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Stardew Valley | 0.2s |
| 3 | A Link to the Past | 0.1s |
| 4 | Kingdom Hearts | 0.1s |
| 5 | Subnautica | 0.1s |
| 6 | Starcraft 2 | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | Bomb Rush Cyberfunk | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 4.0s |
| 2 | Subnautica | 3.7s |
| 3 | Stardew Valley | 3.4s |
| 4 | Kirby's Dream Land 3 | 3.1s |
| 5 | Aquaria | 3.1s |
| 6 | Dark Souls III | 3.0s |
| 7 | Lingo | 3.0s |
| 8 | The Legend of Zelda | 3.0s |
| 9 | DOOM 1993 | 3.0s |
| 10 | Mario & Luigi Superstar Saga | 2.9s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 54.5s |
| 2 | Secret of Evermore | 45.4s |
| 3 | Lingo | 40.8s |
| 4 | Dark Souls III | 23.7s |
| 5 | Overcooked! 2 | 19.8s |
| 6 | Terraria | 19.8s |
| 7 | Landstalker - The Treasures of King Nole | 17.7s |
| 8 | Sonic Adventure 2 Battle | 16.7s |
| 9 | DOOM II | 15.7s |
| 10 | Subnautica | 14.8s |
