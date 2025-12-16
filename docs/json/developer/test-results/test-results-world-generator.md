# World Generator Test Results

**Generated:** 2025-12-16 06:11:13 UTC
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

**Total Templates:** 73

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 73 | 0 | 73 |
| Original Spoiler Test | 73 | 0 | 73 |
| Test World Generation | 71 | 2 | 73 |
| Test Seed Generation | 45 | 28 | 73 |
| Test Spoiler Test | 39 | 6 | 45 |
| Cross-Validation | 30 | 14 | 44 |

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
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lingo | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Paint | ✅ | ✅ | ✅ | ❌ | - | - |
| Raft | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ❌ | - | - |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ❌ | - | - |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ❌ | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ❌ | - | - |
| The Messenger | ✅ | ✅ | ❌ | - | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| The Witness | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ❌ | Error |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 73

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 73 | 0 | 73 |
| Original Spoiler Test | 73 | 0 | 73 |
| Test World Generation | 71 | 2 | 73 |
| Test Seed Generation | 45 | 28 | 73 |
| Test Spoiler Test | 39 | 6 | 45 |
| Cross-Validation | 15 | 30 | 45 |

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
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kingdom Hearts | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Lingo | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Paint | ✅ | ✅ | ✅ | ❌ | - | - |
| Raft | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ❌ | - | - |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ❌ | - | - |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ❌ | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ❌ | - | - |
| The Messenger | ✅ | ✅ | ❌ | - | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ❌ | - | - |
| The Witness | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ❌ | - | - |
| Undertale | ✅ | ✅ | ✅ | ❌ | - | - |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ❌ | - | - |
| shapez | ✅ | ✅ | ✅ | ✅ | ❌ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 333.0s | 921.9s | 5.9s | 197.8s | 1024.6s |
| Average | 4.6s | 12.6s | 0.1s | 2.8s | 22.8s |
| Max | 26.7s | 78.7s | 0.1s | 4.3s | 300.0s |
| Min | 2.7s | 5.6s | 0.1s | 2.5s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.7s) | Stardew Valley (78.7s) | Kingdom Hearts 2 (0.1s) | The Witness (4.3s) | Raft (300.0s) |
| Fastest | MathProof2p2e4 (2.7s) | Undertale (5.6s) | VVVVVV (0.1s) | Undertale (2.5s) | VVVVVV (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.6s | 18.3s | 0.1s | 2.5s | - |
| A Link to the Past | 10.0s | 20.0s | 0.1s | 2.7s | - |
| A Short Hike | 3.1s | 10.2s | 0.1s | 2.8s | 9.7s |
| APQuest | 3.1s | 6.2s | 0.1s | 2.7s | 5.7s |
| Adventure | 3.0s | 7.2s | 0.1s | 2.9s | 5.8s |
| Aquaria | 7.3s | 9.6s | 0.1s | 2.8s | 7.7s |
| Bomb Rush Cyberfunk | 11.1s | 23.6s | 0.1s | - | - |
| Bumper Stickers | 2.9s | 11.5s | 0.1s | 2.7s | 8.6s |
| Castlevania - Circle of the Moon | 3.2s | 9.8s | 0.1s | 2.9s | 5.7s |
| Castlevania 64 | 3.0s | 10.0s | 0.1s | 2.9s | 6.7s |
| Celeste (Open World) | 3.9s | 14.8s | 0.1s | 3.7s | 14.8s |
| Celeste 64 | 3.1s | 6.7s | 0.1s | 2.9s | 7.7s |
| ChecksFinder | 2.7s | 6.6s | 0.1s | 2.8s | 6.7s |
| ChocolateChipCookies | 2.9s | 5.6s | 0.1s | 2.8s | 5.7s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.9s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s |
| DLCQuest | 2.9s | 5.7s | 0.1s | 2.7s | 5.6s |
| DOOM 1993 | 2.9s | 12.7s | 0.1s | 2.7s | 12.7s |
| DOOM II | 3.2s | 15.8s | 0.1s | 3.0s | 15.8s |
| Dark Souls III | 4.6s | 24.8s | 0.1s | 3.2s | 24.8s |
| Donkey Kong Country 3 | 3.0s | 14.8s | 0.1s | 2.5s | - |
| Factorio | 3.5s | 9.7s | 0.1s | 2.9s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.8s | 8.7s |
| Final Fantasy Mystic Quest | 3.9s | 10.7s | 0.1s | 3.0s | 10.8s |
| Heretic | 3.1s | 14.8s | 0.1s | 3.0s | 14.8s |
| Hylics 2 | 3.7s | 6.7s | 0.1s | 2.8s | 6.7s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.6s | 6.6s |
| Kingdom Hearts | 9.0s | 29.9s | 0.1s | 2.8s | - |
| Kingdom Hearts 2 | 5.2s | 41.9s | 0.1s | 2.5s | - |
| Kirby's Dream Land 3 | 4.5s | 55.0s | 0.1s | 3.1s | 20.5s |
| Landstalker - The Treasures of King Nole | 3.2s | 8.8s | 0.1s | 2.8s | 17.7s |
| Lingo | 3.4s | 6.7s | 0.1s | 2.7s | - |
| Links Awakening DX | 9.3s | 16.8s | 0.1s | 2.8s | - |
| Lufia II Ancient Cave | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s |
| Mario & Luigi Superstar Saga | 3.6s | 9.7s | 0.1s | 3.1s | 8.9s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.6s | 6.6s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 7.7s |
| Meritous | 3.1s | 5.7s | 0.1s | 2.9s | 5.7s |
| Metamath | 10.0s | 5.7s | 0.1s | 2.6s | 5.6s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.6s | - |
| Noita | 3.4s | 5.7s | 0.1s | 2.8s | 5.7s |
| Old School Runescape | 4.2s | 8.7s | 0.1s | 2.7s | - |
| Overcooked! 2 | 3.0s | 21.8s | 0.1s | 2.7s | - |
| Paint | 2.8s | 6.7s | 0.1s | 2.7s | - |
| Raft | 2.8s | 9.7s | 0.1s | 3.1s | 300.0s |
| Risk of Rain 2 | 2.8s | 6.6s | 0.1s | 2.7s | 14.4s |
| Saving Princess | 2.7s | 5.6s | 0.1s | 2.5s | - |
| Secret of Evermore | 4.7s | 7.7s | 0.1s | 3.0s | 46.6s |
| Shivers | 3.0s | 9.7s | 0.1s | 2.7s | 23.6s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.5s | - |
| Starcraft 2 | 6.4s | 37.8s | 0.1s | 2.6s | - |
| Stardew Valley | 5.4s | 78.7s | 0.1s | 2.8s | - |
| Subnautica | 26.7s | 14.9s | 0.1s | 2.7s | - |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 2.7s | - |
| Super Mario Land 2 | 4.0s | 7.8s | 0.1s | 2.7s | - |
| Super Mario World | 3.9s | 6.6s | 0.1s | 2.7s | 6.6s |
| Super Metroid | 11.2s | 10.7s | 0.1s | 2.5s | - |
| TOEM original | 3.1s | 9.7s | 0.1s | 2.9s | 9.8s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.7s | 9.6s |
| Terraria | 3.0s | 19.8s | 0.1s | 2.6s | - |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | 2.6s | - |
| The Messenger | 3.2s | 12.8s | 0.1s | - | - |
| The Wind Waker | 17.6s | 9.8s | 0.1s | 2.7s | - |
| The Witness | 7.7s | 5.8s | 0.1s | 4.3s | 269.8s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.7s | - |
| Undertale | 2.8s | 5.6s | 0.1s | 2.5s | - |
| VVVVVV | 2.7s | 5.7s | 0.1s | 2.6s | 5.6s |
| Wargroove | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.7s | 8.6s |
| Yacht Dice | 3.5s | 8.7s | 0.1s | 2.6s | - |
| Yoshi's Island | 3.7s | 9.7s | 0.1s | 2.6s | - |
| shapez | 4.2s | 6.7s | 0.1s | 2.8s | 14.4s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.7s |
| 2 | The Wind Waker | 17.6s |
| 3 | Super Metroid | 11.2s |
| 4 | Bomb Rush Cyberfunk | 11.1s |
| 5 | Metamath | 10.0s |
| 6 | A Link to the Past | 10.0s |
| 7 | Links Awakening DX | 9.3s |
| 8 | Kingdom Hearts | 9.0s |
| 9 | The Witness | 7.7s |
| 10 | Aquaria | 7.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 78.7s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 41.9s |
| 4 | Starcraft 2 | 37.8s |
| 5 | Kingdom Hearts | 29.9s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 23.6s |
| 8 | Overcooked! 2 | 21.8s |
| 9 | A Link to the Past | 20.0s |
| 10 | Terraria | 19.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.1s |
| 2 | A Link to the Past | 0.1s |
| 3 | Stardew Valley | 0.1s |
| 4 | Lingo | 0.1s |
| 5 | Subnautica | 0.1s |
| 6 | Kingdom Hearts | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | Castlevania - Circle of the Moon | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Witness | 4.3s |
| 2 | Celeste (Open World) | 3.7s |
| 3 | Dark Souls III | 3.2s |
| 4 | Raft | 3.1s |
| 5 | Mario & Luigi Superstar Saga | 3.1s |
| 6 | Kirby's Dream Land 3 | 3.1s |
| 7 | DOOM II | 3.0s |
| 8 | Final Fantasy Mystic Quest | 3.0s |
| 9 | Secret of Evermore | 3.0s |
| 10 | Heretic | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Raft | 300.0s |
| 2 | The Witness | 269.8s |
| 3 | Secret of Evermore | 46.6s |
| 4 | Dark Souls III | 24.8s |
| 5 | Shivers | 23.6s |
| 6 | Kirby's Dream Land 3 | 20.5s |
| 7 | Landstalker - The Treasures of King Nole | 17.7s |
| 8 | DOOM II | 15.8s |
| 9 | Celeste (Open World) | 14.8s |
| 10 | Heretic | 14.8s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 329.2s | 911.9s | 5.8s | 198.1s | 954.1s |
| Average | 4.5s | 12.5s | 0.1s | 2.8s | 21.2s |
| Max | 26.8s | 77.8s | 0.2s | 4.0s | 300.0s |
| Min | 2.5s | 5.4s | 0.1s | 2.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.8s) | Stardew Valley (77.8s) | Kingdom Hearts 2 (0.2s) | The Witness (4.0s) | Raft (300.0s) |
| Fastest | Mega Man 2 (2.5s) | Undertale (5.4s) | Undertale (0.1s) | Super Mario 64 (2.5s) | DLCQuest (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.6s | 16.3s | 0.1s | 2.5s | - |
| A Link to the Past | 10.6s | 19.4s | 0.1s | 2.8s | - |
| A Short Hike | 3.0s | 12.5s | 0.1s | 2.7s | 9.7s |
| APQuest | 2.8s | 6.6s | 0.1s | 2.7s | 5.6s |
| Adventure | 2.8s | 6.1s | 0.1s | 2.6s | 5.6s |
| Aquaria | 7.3s | 8.7s | 0.1s | 2.8s | 7.8s |
| Bomb Rush Cyberfunk | 10.0s | 23.1s | 0.1s | - | - |
| Bumper Stickers | 2.9s | 10.6s | 0.1s | 2.7s | 8.6s |
| Castlevania - Circle of the Moon | 3.1s | 8.8s | 0.1s | 2.8s | 5.6s |
| Castlevania 64 | 3.0s | 11.3s | 0.1s | 2.8s | 6.7s |
| Celeste (Open World) | 3.9s | 13.8s | 0.1s | 3.8s | 14.7s |
| Celeste 64 | 3.3s | 6.8s | 0.1s | 2.9s | 7.7s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.9s | 6.7s |
| ChocolateChipCookies | 2.6s | 5.6s | 0.1s | 2.7s | 5.6s |
| Choo-Choo Charles | 2.7s | 9.7s | 0.1s | 2.7s | 9.6s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.6s |
| DLCQuest | 2.7s | 5.5s | 0.1s | 2.6s | 5.5s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 12.7s |
| DOOM II | 3.1s | 15.8s | 0.1s | 2.9s | 15.7s |
| Dark Souls III | 4.7s | 24.8s | 0.1s | 3.1s | 23.8s |
| Donkey Kong Country 3 | 3.3s | 14.8s | 0.1s | 2.6s | - |
| Factorio | 3.7s | 9.8s | 0.1s | 3.0s | 9.8s |
| Faxanadu | 2.9s | 6.7s | 0.1s | 2.7s | 8.7s |
| Final Fantasy Mystic Quest | 3.7s | 10.7s | 0.1s | 2.8s | 10.7s |
| Heretic | 3.0s | 14.8s | 0.1s | 2.8s | 14.7s |
| Hylics 2 | 3.7s | 6.6s | 0.1s | 2.8s | 6.7s |
| Inscryption | 2.6s | 6.5s | 0.1s | 2.6s | 6.5s |
| Kingdom Hearts | 8.7s | 29.0s | 0.1s | 2.9s | - |
| Kingdom Hearts 2 | 5.2s | 40.9s | 0.2s | 2.5s | - |
| Kirby's Dream Land 3 | 4.5s | 55.0s | 0.1s | 3.2s | 17.6s |
| Landstalker - The Treasures of King Nole | 3.1s | 8.6s | 0.1s | 2.9s | 17.7s |
| Lingo | 3.6s | 6.8s | 0.1s | 3.0s | - |
| Links Awakening DX | 9.2s | 16.8s | 0.1s | 2.8s | - |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Mario & Luigi Superstar Saga | 3.5s | 9.7s | 0.1s | 2.9s | 8.7s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.8s | 5.7s |
| Mega Man 2 | 2.5s | 6.4s | 0.1s | 2.6s | 6.5s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 7.7s |
| Meritous | 3.0s | 5.7s | 0.1s | 2.9s | 5.7s |
| Metamath | 10.3s | 5.6s | 0.1s | 2.7s | 5.6s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 2.6s | - |
| Noita | 3.4s | 5.7s | 0.1s | 3.0s | 5.8s |
| Old School Runescape | 4.2s | 8.6s | 0.1s | 2.5s | - |
| Overcooked! 2 | 2.9s | 21.9s | 0.1s | 2.7s | - |
| Paint | 2.6s | 6.7s | 0.1s | 2.5s | - |
| Raft | 2.9s | 9.7s | 0.1s | 3.2s | 300.0s |
| Risk of Rain 2 | 2.6s | 6.5s | 0.1s | 2.8s | 14.1s |
| Saving Princess | 2.8s | 5.6s | 0.1s | 2.6s | - |
| Secret of Evermore | 4.5s | 7.7s | 0.1s | 3.0s | 45.7s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.8s | 23.6s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.6s | - |
| Starcraft 2 | 6.7s | 37.9s | 0.1s | 2.8s | - |
| Stardew Valley | 5.5s | 77.8s | 0.1s | 3.2s | - |
| Subnautica | 26.8s | 14.8s | 0.1s | 2.6s | - |
| Super Mario 64 | 2.9s | 12.6s | 0.1s | 2.5s | - |
| Super Mario Land 2 | 4.0s | 7.9s | 0.1s | 2.8s | - |
| Super Mario World | 3.7s | 6.4s | 0.1s | 2.8s | 6.5s |
| Super Metroid | 11.5s | 10.7s | 0.1s | 2.6s | - |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s |
| TOEM rule builder | 2.8s | 8.7s | 0.1s | 2.8s | 9.7s |
| Terraria | 2.8s | 19.7s | 0.1s | 2.6s | - |
| The Legend of Zelda | 4.8s | 8.8s | 0.1s | 2.8s | - |
| The Messenger | 3.1s | 12.8s | 0.1s | - | - |
| The Wind Waker | 16.8s | 9.7s | 0.1s | 2.5s | - |
| The Witness | 7.3s | 5.6s | 0.1s | 4.0s | 206.7s |
| Timespinner | 3.5s | 7.7s | 0.1s | 2.7s | - |
| Undertale | 2.8s | 5.4s | 0.1s | 2.5s | - |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Wargroove | 2.9s | 6.6s | 0.1s | 2.8s | 6.7s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s |
| Yacht Dice | 3.4s | 8.6s | 0.1s | 2.6s | - |
| Yoshi's Island | 3.8s | 9.7s | 0.1s | 2.8s | - |
| shapez | 4.2s | 6.7s | 0.1s | 2.7s | 14.3s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.8s |
| 2 | The Wind Waker | 16.8s |
| 3 | Super Metroid | 11.5s |
| 4 | A Link to the Past | 10.6s |
| 5 | Metamath | 10.3s |
| 6 | Bomb Rush Cyberfunk | 10.0s |
| 7 | Links Awakening DX | 9.2s |
| 8 | Kingdom Hearts | 8.7s |
| 9 | Aquaria | 7.3s |
| 10 | The Witness | 7.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 77.8s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 40.9s |
| 4 | Starcraft 2 | 37.9s |
| 5 | Kingdom Hearts | 29.0s |
| 6 | Dark Souls III | 24.8s |
| 7 | Bomb Rush Cyberfunk | 23.1s |
| 8 | Overcooked! 2 | 21.9s |
| 9 | Terraria | 19.7s |
| 10 | A Link to the Past | 19.4s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.2s |
| 2 | Lingo | 0.1s |
| 3 | Stardew Valley | 0.1s |
| 4 | A Link to the Past | 0.1s |
| 5 | Subnautica | 0.1s |
| 6 | Kingdom Hearts | 0.1s |
| 7 | Starcraft 2 | 0.1s |
| 8 | A Hat in Time | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | A Short Hike | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Witness | 4.0s |
| 2 | Celeste (Open World) | 3.8s |
| 3 | Kirby's Dream Land 3 | 3.2s |
| 4 | Raft | 3.2s |
| 5 | Stardew Valley | 3.2s |
| 6 | Dark Souls III | 3.1s |
| 7 | Factorio | 3.0s |
| 8 | Lingo | 3.0s |
| 9 | Noita | 3.0s |
| 10 | Secret of Evermore | 3.0s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Raft | 300.0s |
| 2 | The Witness | 206.7s |
| 3 | Secret of Evermore | 45.7s |
| 4 | Dark Souls III | 23.8s |
| 5 | Shivers | 23.6s |
| 6 | Landstalker - The Treasures of King Nole | 17.7s |
| 7 | Kirby's Dream Land 3 | 17.6s |
| 8 | DOOM II | 15.7s |
| 9 | Celeste (Open World) | 14.7s |
| 10 | Heretic | 14.7s |
