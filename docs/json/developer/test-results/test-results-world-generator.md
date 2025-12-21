# World Generator Test Results

**Generated:** 2025-12-21 19:50:39 UTC
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
| Test Seed Generation | 69 | 0 | 69 |
| Test Spoiler Test | 68 | 1 | 69 |
| Cross-Validation | 2 | 65 | 67 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yacht Dice | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Test Seed Generation | 69 | 0 | 69 |
| Test Spoiler Test | 68 | 1 | 69 |
| Cross-Validation | 2 | 65 | 67 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Metroid | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yacht Dice | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | Error |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 312.9s | 885.5s | 6.8s | 198.7s | 870.1s |
| Average | 4.5s | 12.8s | 0.1s | 2.9s | 12.6s |
| Max | 26.6s | 71.7s | 0.6s | 4.0s | 81.6s |
| Min | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.6s) | Stardew Valley (71.7s) | Kingdom Hearts 2 (0.6s) | Muse Dash (4.0s) | Kirby's Dream Land 3 (81.6s) |
| Fastest | ChocolateChipCookies (2.7s) | MathProof2p2e4 (5.6s) | Yacht Dice (0.1s) | MathProof2p2e4 (2.6s) | Adventure (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.7s | 16.7s | 0.1s | 2.8s | 13.7s |
| A Link to the Past | 10.1s | 20.9s | 0.2s | 2.9s | 15.7s |
| A Short Hike | 3.2s | 10.9s | 0.1s | 2.8s | 9.7s |
| APQuest | 3.0s | 10.3s | 0.1s | 2.8s | 5.7s |
| Adventure | 2.9s | 6.7s | 0.1s | 2.7s | 5.6s |
| Aquaria | 7.2s | 10.9s | 0.1s | 2.9s | 7.7s |
| Bomb Rush Cyberfunk | 11.3s | 24.1s | 0.2s | 2.8s | 18.7s |
| Bumper Stickers | 2.9s | 12.5s | 0.1s | 2.8s | 8.6s |
| Castlevania - Circle of the Moon | 3.0s | 6.3s | 0.1s | 2.8s | 5.7s |
| Castlevania 64 | 3.1s | 15.6s | 0.1s | 2.8s | 6.7s |
| Celeste (Open World) | 4.0s | 14.8s | 0.1s | 3.9s | 16.8s |
| Celeste 64 | 2.9s | 6.7s | 0.1s | 2.7s | 7.7s |
| ChecksFinder | 2.8s | 6.7s | 0.1s | 2.8s | 6.7s |
| ChocolateChipCookies | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Choo-Choo Charles | 2.8s | 9.7s | 0.1s | 2.8s | 10.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s |
| DLCQuest | 3.0s | 5.7s | 0.1s | 2.7s | 5.6s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.8s | 13.7s |
| DOOM II | 3.2s | 15.7s | 0.1s | 2.9s | 17.8s |
| Dark Souls III | 4.8s | 25.9s | 0.1s | 3.4s | 31.9s |
| Donkey Kong Country 3 | 3.0s | 13.8s | 0.1s | 3.5s | 15.1s |
| Factorio | 3.4s | 9.7s | 0.1s | 2.7s | 9.7s |
| Faxanadu | 2.9s | 6.7s | 0.1s | 2.8s | 8.7s |
| Final Fantasy Mystic Quest | 3.8s | 10.7s | 0.1s | 2.8s | 11.7s |
| Heretic | 3.1s | 14.7s | 0.1s | 2.8s | 17.7s |
| Hylics 2 | 3.9s | 6.7s | 0.1s | 3.0s | 6.7s |
| Inscryption | 2.8s | 6.6s | 0.1s | 2.7s | 6.6s |
| Kingdom Hearts | 8.9s | 28.8s | 0.1s | 2.9s | 24.8s |
| Kingdom Hearts 2 | 5.3s | 42.0s | 0.6s | 3.1s | 47.0s |
| Kirby's Dream Land 3 | 4.6s | 56.0s | 0.1s | 3.2s | 81.6s |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.8s | 19.7s |
| Links Awakening DX | 9.4s | 16.8s | 0.1s | 3.1s | 17.8s |
| Lufia II Ancient Cave | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s |
| Mario & Luigi Superstar Saga | 3.7s | 9.7s | 0.1s | 2.8s | 9.7s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s |
| Mega Man 2 | 2.9s | 6.7s | 0.1s | 3.0s | 6.7s |
| MegaMan Battle Network 3 | 3.0s | 7.7s | 0.1s | 2.7s | 8.7s |
| Meritous | 2.9s | 5.7s | 0.1s | 2.8s | 5.8s |
| Metamath | 10.2s | 5.6s | 0.1s | 2.7s | 5.7s |
| Muse Dash | 3.0s | 7.7s | 0.1s | 4.0s | 7.8s |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.7s |
| Old School Runescape | 4.3s | 8.7s | 0.1s | 3.8s | 8.8s |
| Overcooked! 2 | 3.2s | 21.8s | 0.1s | 2.9s | 21.8s |
| Paint | 2.9s | 7.8s | 0.1s | 2.7s | 18.6s |
| Risk of Rain 2 | 2.8s | 6.7s | 0.1s | 2.7s | 7.6s |
| Saving Princess | 2.9s | 5.7s | 0.1s | 2.9s | 6.7s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.2s | 13.7s | 0.1s | 2.8s | 16.7s |
| Starcraft 2 | 6.2s | 28.8s | 0.1s | 3.1s | 16.8s |
| Stardew Valley | 5.8s | 71.7s | 0.4s | 3.3s | 42.1s |
| Subnautica | 26.6s | 14.7s | 0.1s | 2.7s | 9.7s |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.7s | 12.7s |
| Super Mario Land 2 | 3.9s | 7.9s | 0.1s | 2.9s | 7.7s |
| Super Mario World | 4.0s | 6.7s | 0.1s | 2.8s | 6.7s |
| Super Metroid | 11.3s | 10.7s | 0.1s | 2.7s | 11.6s |
| TOEM original | 2.8s | 9.7s | 0.1s | 3.0s | 9.8s |
| TOEM rule builder | 2.8s | 8.6s | 0.1s | 2.7s | 9.7s |
| Terraria | 2.9s | 20.8s | 0.1s | 2.8s | 19.8s |
| The Legend of Zelda | 4.6s | 8.7s | 0.1s | 2.8s | 9.7s |
| The Messenger | 3.5s | 12.8s | 0.1s | 3.0s | 9.7s |
| The Wind Waker | 15.9s | 9.7s | 0.1s | 2.8s | 8.7s |
| Timespinner | 3.3s | 7.7s | 0.1s | 2.7s | 6.7s |
| Undertale | 3.0s | 5.7s | 0.1s | 2.8s | 5.7s |
| VVVVVV | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Wargroove | 2.7s | 6.7s | 0.1s | 2.7s | 6.6s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.9s | 8.7s |
| Yacht Dice | 3.4s | 8.7s | 0.1s | 2.7s | 5.6s |
| Yoshi's Island | 3.5s | 9.7s | 0.1s | 2.8s | 8.7s |
| shapez | 4.2s | 6.7s | 0.1s | 2.7s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.6s |
| 2 | The Wind Waker | 15.9s |
| 3 | Bomb Rush Cyberfunk | 11.3s |
| 4 | Super Metroid | 11.3s |
| 5 | Metamath | 10.2s |
| 6 | A Link to the Past | 10.1s |
| 7 | Links Awakening DX | 9.4s |
| 8 | Kingdom Hearts | 8.9s |
| 9 | Aquaria | 7.2s |
| 10 | Starcraft 2 | 6.2s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.7s |
| 2 | Kirby's Dream Land 3 | 56.0s |
| 3 | Kingdom Hearts 2 | 42.0s |
| 4 | Kingdom Hearts | 28.8s |
| 5 | Starcraft 2 | 28.8s |
| 6 | Dark Souls III | 25.9s |
| 7 | Bomb Rush Cyberfunk | 24.1s |
| 8 | Overcooked! 2 | 21.8s |
| 9 | A Link to the Past | 20.9s |
| 10 | Terraria | 20.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.6s |
| 2 | Stardew Valley | 0.4s |
| 3 | A Link to the Past | 0.2s |
| 4 | Bomb Rush Cyberfunk | 0.2s |
| 5 | Starcraft 2 | 0.1s |
| 6 | The Wind Waker | 0.1s |
| 7 | Yoshi's Island | 0.1s |
| 8 | Aquaria | 0.1s |
| 9 | Celeste (Open World) | 0.1s |
| 10 | A Hat in Time | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Muse Dash | 4.0s |
| 2 | Celeste (Open World) | 3.9s |
| 3 | Old School Runescape | 3.8s |
| 4 | Donkey Kong Country 3 | 3.5s |
| 5 | Dark Souls III | 3.4s |
| 6 | Stardew Valley | 3.3s |
| 7 | Kirby's Dream Land 3 | 3.2s |
| 8 | Kingdom Hearts 2 | 3.1s |
| 9 | Links Awakening DX | 3.1s |
| 10 | Starcraft 2 | 3.1s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 81.6s |
| 2 | Kingdom Hearts 2 | 47.0s |
| 3 | Stardew Valley | 42.1s |
| 4 | Dark Souls III | 31.9s |
| 5 | Kingdom Hearts | 24.8s |
| 6 | Overcooked! 2 | 21.8s |
| 7 | Terraria | 19.8s |
| 8 | Landstalker - The Treasures of King Nole | 19.7s |
| 9 | Bomb Rush Cyberfunk | 18.7s |
| 10 | Paint | 18.6s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Total | 322.1s | 885.8s | 7.0s | 202.8s | 873.1s |
| Average | 4.7s | 12.8s | 0.1s | 2.9s | 12.7s |
| Max | 26.6s | 71.7s | 0.6s | 4.0s | 80.0s |
| Min | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|--------|--------------|---------------|-----------|----------|--------------|
| Slowest | Subnautica (26.6s) | Stardew Valley (71.7s) | Kingdom Hearts 2 (0.6s) | Kirby's Dream Land 3 (4.0s) | Kirby's Dream Land 3 (80.0s) |
| Fastest | ChecksFinder (2.7s) | Undertale (5.6s) | WebDevJourney (0.1s) | MathProof2p2e4 (2.6s) | MathProof2p2e4 (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler |
|------|--------------|---------------|-----------|----------|--------------|
| A Hat in Time | 4.7s | 17.0s | 0.1s | 2.7s | 13.7s |
| A Link to the Past | 10.2s | 22.5s | 0.2s | 2.9s | 15.8s |
| A Short Hike | 3.0s | 11.3s | 0.1s | 2.7s | 9.7s |
| APQuest | 3.0s | 7.4s | 0.1s | 2.8s | 5.7s |
| Adventure | 3.1s | 7.5s | 0.1s | 2.7s | 5.6s |
| Aquaria | 7.1s | 12.4s | 0.1s | 2.8s | 8.7s |
| Bomb Rush Cyberfunk | 12.3s | 27.5s | 0.2s | 3.2s | 20.0s |
| Bumper Stickers | 3.2s | 9.3s | 0.1s | 3.1s | 8.7s |
| Castlevania - Circle of the Moon | 3.3s | 10.0s | 0.1s | 2.9s | 5.7s |
| Castlevania 64 | 3.0s | 9.4s | 0.1s | 2.8s | 6.7s |
| Celeste (Open World) | 3.9s | 14.8s | 0.1s | 3.8s | 16.8s |
| Celeste 64 | 3.0s | 6.8s | 0.1s | 2.8s | 7.7s |
| ChecksFinder | 2.7s | 6.6s | 0.1s | 2.7s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.8s | 5.7s |
| Choo-Choo Charles | 3.0s | 9.7s | 0.1s | 2.8s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.7s | 8.7s |
| DLCQuest | 3.4s | 5.8s | 0.1s | 3.2s | 5.9s |
| DOOM 1993 | 3.2s | 12.8s | 0.1s | 3.1s | 14.8s |
| DOOM II | 3.4s | 15.8s | 0.1s | 3.1s | 17.8s |
| Dark Souls III | 4.8s | 25.8s | 0.1s | 3.2s | 30.8s |
| Donkey Kong Country 3 | 2.9s | 13.6s | 0.1s | 2.7s | 14.7s |
| Factorio | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.7s | 8.7s |
| Final Fantasy Mystic Quest | 3.9s | 10.8s | 0.1s | 3.0s | 11.8s |
| Heretic | 3.4s | 14.9s | 0.1s | 2.9s | 17.7s |
| Hylics 2 | 3.7s | 6.7s | 0.1s | 2.7s | 6.6s |
| Inscryption | 3.2s | 6.8s | 0.1s | 3.1s | 6.9s |
| Kingdom Hearts | 9.2s | 29.1s | 0.1s | 3.1s | 24.9s |
| Kingdom Hearts 2 | 5.6s | 43.2s | 0.6s | 3.6s | 49.1s |
| Kirby's Dream Land 3 | 4.6s | 55.0s | 0.1s | 4.0s | 80.0s |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.8s | 19.7s |
| Links Awakening DX | 9.7s | 16.8s | 0.1s | 3.2s | 17.8s |
| Lufia II Ancient Cave | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Mario & Luigi Superstar Saga | 3.8s | 9.8s | 0.1s | 2.9s | 9.7s |
| MathProof2p2e4 | 2.9s | 5.7s | 0.1s | 2.6s | 5.6s |
| Mega Man 2 | 2.8s | 6.6s | 0.1s | 2.8s | 6.7s |
| MegaMan Battle Network 3 | 3.4s | 8.9s | 0.1s | 3.2s | 9.0s |
| Meritous | 3.0s | 5.7s | 0.1s | 3.0s | 5.7s |
| Metamath | 11.3s | 5.7s | 0.1s | 2.9s | 5.7s |
| Muse Dash | 3.0s | 7.6s | 0.1s | 2.8s | 7.7s |
| Noita | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s |
| Old School Runescape | 4.6s | 8.7s | 0.1s | 3.6s | 8.8s |
| Overcooked! 2 | 3.0s | 20.7s | 0.1s | 2.8s | 21.8s |
| Paint | 2.8s | 6.9s | 0.1s | 2.8s | 18.9s |
| Risk of Rain 2 | 3.1s | 6.7s | 0.1s | 2.7s | 7.6s |
| Saving Princess | 2.8s | 5.7s | 0.1s | 2.7s | 6.7s |
| Shivers | 3.6s | 9.9s | 0.1s | 3.2s | 10.0s |
| Sonic Adventure 2 Battle | 3.4s | 13.7s | 0.1s | 3.1s | 16.8s |
| Starcraft 2 | 6.5s | 28.9s | 0.1s | 3.2s | 16.8s |
| Stardew Valley | 5.6s | 71.7s | 0.3s | 3.5s | 40.6s |
| Subnautica | 26.6s | 14.6s | 0.1s | 2.7s | 9.6s |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 2.9s | 12.7s |
| Super Mario Land 2 | 3.8s | 7.7s | 0.1s | 2.8s | 7.7s |
| Super Mario World | 4.1s | 6.7s | 0.1s | 2.9s | 6.7s |
| Super Metroid | 11.9s | 10.7s | 0.1s | 2.7s | 11.7s |
| TOEM original | 2.8s | 8.7s | 0.1s | 2.8s | 9.7s |
| TOEM rule builder | 3.1s | 9.8s | 0.1s | 3.2s | 9.9s |
| Terraria | 3.1s | 20.8s | 0.1s | 3.1s | 19.9s |
| The Legend of Zelda | 4.8s | 8.8s | 0.1s | 2.9s | 9.8s |
| The Messenger | 3.3s | 12.8s | 0.1s | 2.8s | 9.7s |
| The Wind Waker | 16.0s | 9.8s | 0.1s | 2.7s | 8.7s |
| Timespinner | 3.4s | 7.7s | 0.1s | 2.8s | 7.7s |
| Undertale | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s |
| VVVVVV | 2.9s | 5.7s | 0.1s | 2.8s | 5.7s |
| Wargroove | 2.8s | 6.7s | 0.1s | 2.7s | 6.6s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.7s | 8.6s |
| Yacht Dice | 3.8s | 8.8s | 0.1s | 3.0s | 5.8s |
| Yoshi's Island | 3.8s | 9.8s | 0.1s | 3.1s | 8.7s |
| shapez | 4.5s | 6.8s | 0.1s | 2.9s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.6s |
| 2 | The Wind Waker | 16.0s |
| 3 | Bomb Rush Cyberfunk | 12.3s |
| 4 | Super Metroid | 11.9s |
| 5 | Metamath | 11.3s |
| 6 | A Link to the Past | 10.2s |
| 7 | Links Awakening DX | 9.7s |
| 8 | Kingdom Hearts | 9.2s |
| 9 | Aquaria | 7.1s |
| 10 | Starcraft 2 | 6.5s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.7s |
| 2 | Kirby's Dream Land 3 | 55.0s |
| 3 | Kingdom Hearts 2 | 43.2s |
| 4 | Kingdom Hearts | 29.1s |
| 5 | Starcraft 2 | 28.9s |
| 6 | Bomb Rush Cyberfunk | 27.5s |
| 7 | Dark Souls III | 25.8s |
| 8 | A Link to the Past | 22.5s |
| 9 | Terraria | 20.8s |
| 10 | Overcooked! 2 | 20.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.6s |
| 2 | Stardew Valley | 0.3s |
| 3 | A Link to the Past | 0.2s |
| 4 | Bomb Rush Cyberfunk | 0.2s |
| 5 | Starcraft 2 | 0.1s |
| 6 | The Wind Waker | 0.1s |
| 7 | Yoshi's Island | 0.1s |
| 8 | Celeste (Open World) | 0.1s |
| 9 | A Hat in Time | 0.1s |
| 10 | Aquaria | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 4.0s |
| 2 | Celeste (Open World) | 3.8s |
| 3 | Kingdom Hearts 2 | 3.6s |
| 4 | Old School Runescape | 3.6s |
| 5 | Stardew Valley | 3.5s |
| 6 | Bomb Rush Cyberfunk | 3.2s |
| 7 | Starcraft 2 | 3.2s |
| 8 | DLCQuest | 3.2s |
| 9 | MegaMan Battle Network 3 | 3.2s |
| 10 | Shivers | 3.2s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 80.0s |
| 2 | Kingdom Hearts 2 | 49.1s |
| 3 | Stardew Valley | 40.6s |
| 4 | Dark Souls III | 30.8s |
| 5 | Kingdom Hearts | 24.9s |
| 6 | Overcooked! 2 | 21.8s |
| 7 | Bomb Rush Cyberfunk | 20.0s |
| 8 | Terraria | 19.9s |
| 9 | Landstalker - The Treasures of King Nole | 19.7s |
| 10 | Paint | 18.9s |
