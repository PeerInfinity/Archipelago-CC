# World Generator Test Results

**Generated:** 2025-12-22 23:12:39 UTC
**Seed:** 1
**Mode:** Canonical (seed1 placement)

This report shows the results of round-trip testing the world generator.
Each game's rules.json is converted to a `_worldgen` world, and the generated
world is validated to produce equivalent game logic.

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

## Summary

**Total Templates:** 68

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 68 | 0 | 68 |
| Original Spoiler Test | 66 | 2 | 68 |
| Test World Generation | 62 | 6 | 68 |
| Test Seed Generation | 56 | 12 | 68 |
| Test Spoiler Test | 55 | 1 | 56 |
| Cross-Validation | 49 | 7 | 56 |

## Detailed Results

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

## Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Total | 299.2s | 862.2s | 6.3s | 172.4s | 596.6s | 652.5s |
| Average | 4.4s | 12.7s | 0.1s | 2.8s | 10.7s | 11.7s |
| Max | 23.6s | 71.7s | 0.5s | 3.6s | 24.8s | 58.8s |
| Min | 2.5s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|--------|--------------|---------------|-----------|----------|--------------|-----------|
| Slowest | Subnautica (23.6s) | Stardew Valley (71.7s) | Kingdom Hearts 2 (0.5s) | Celeste (Open World) (3.6s) | Dark Souls III (24.8s) | Super Metroid (58.8s) |
| Fastest | Noita (2.5s) | Noita (5.5s) | Super Mario 64 (0.1s) | Celeste 64 (2.5s) | Noita (5.5s) | Noita (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Val |
|------|--------------|---------------|-----------|----------|--------------|-----------|
| A Hat in Time | 4.3s | 17.1s | 0.1s | 2.6s | 13.5s | 17.1s |
| A Link to the Past | 8.8s | 20.7s | 0.1s | - | - | - |
| A Short Hike | 3.1s | 13.5s | 0.1s | 2.8s | 9.7s | 9.7s |
| APQuest | 2.8s | 10.4s | 0.1s | 2.5s | - | - |
| Adventure | 3.1s | 7.2s | 0.1s | 2.8s | 5.6s | 5.7s |
| Aquaria | 7.2s | 11.5s | 0.1s | 2.9s | 8.7s | 8.7s |
| Bomb Rush Cyberfunk | 9.8s | 20.8s | 0.1s | 2.9s | 19.8s | 19.3s |
| Bumper Stickers | 2.9s | 12.1s | 0.1s | 2.7s | 8.6s | 8.6s |
| Castlevania - Circle of the Moon | 3.1s | 7.6s | 0.1s | 2.6s | - | - |
| Castlevania 64 | 3.2s | 7.8s | 0.1s | 2.8s | 6.7s | 6.7s |
| Celeste (Open World) | 3.7s | 14.6s | 0.1s | 3.6s | 14.6s | 14.6s |
| Celeste 64 | 2.6s | 6.5s | 0.1s | 2.5s | 7.5s | 6.5s |
| ChecksFinder | 2.7s | 6.6s | 0.1s | 2.7s | 6.7s | 6.7s |
| ChocolateChipCookies | 2.6s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Choo-Choo Charles | 2.9s | 10.7s | 0.1s | 2.9s | 10.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| DLCQuest | 3.0s | 5.6s | 0.1s | 2.8s | 5.7s | 5.7s |
| DOOM 1993 | 3.0s | 12.7s | 0.1s | 2.7s | 12.7s | 12.7s |
| DOOM II | 3.2s | 15.8s | 0.1s | 2.9s | 15.7s | 15.9s |
| Dark Souls III | 4.9s | 25.8s | 0.1s | 3.3s | 24.8s | 24.8s |
| Donkey Kong Country 3 | 2.7s | 14.7s | 0.1s | - | - | - |
| Factorio | 3.1s | 9.5s | 0.1s | 2.5s | 9.5s | 9.6s |
| Faxanadu | 2.8s | 6.6s | 0.1s | 2.9s | 8.7s | 6.7s |
| Final Fantasy Mystic Quest | 3.7s | 10.7s | 0.1s | 2.8s | 10.7s | 10.7s |
| Heretic | 3.2s | 14.9s | 0.1s | 2.9s | 14.7s | 14.7s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Inscryption | 2.9s | 6.7s | 0.1s | 2.7s | 6.7s | 6.7s |
| Kingdom Hearts | 9.0s | 29.0s | 0.1s | 3.0s | 23.8s | 15.0s |
| Kingdom Hearts 2 | 5.2s | 41.9s | 0.5s | 3.3s | 14.6s | 51.5s |
| Kirby's Dream Land 3 | 4.7s | 55.6s | 0.1s | - | - | - |
| Landstalker - The Treasures of King Nole | 2.9s | 8.4s | 0.1s | 2.6s | 17.6s | 8.5s |
| Links Awakening DX | 8.5s | 17.6s | 0.1s | 2.9s | 17.6s | 17.6s |
| Lufia II Ancient Cave | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Mario & Luigi Superstar Saga | 3.5s | 9.7s | 0.1s | 2.8s | 9.7s | 9.8s |
| MathProof2p2e4 | 2.8s | 5.7s | 0.1s | 2.8s | 5.6s | 5.7s |
| Mega Man 2 | 2.9s | 6.7s | 0.1s | 2.7s | - | - |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Metamath | 11.2s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.8s | 9.7s | 7.7s |
| Noita | 2.5s | 5.5s | 0.1s | 2.6s | 5.5s | 5.5s |
| Old School Runescape | 3.8s | 8.5s | 0.1s | 2.6s | 8.5s | 8.5s |
| Overcooked! 2 | 3.0s | 21.8s | 0.1s | 2.9s | 19.8s | 14.3s |
| Paint | 2.7s | 6.6s | 0.1s | 2.6s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Saving Princess | 2.9s | 5.7s | 0.1s | 2.8s | 6.7s | 5.7s |
| Shivers | 3.1s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 3.1s | 13.7s | 0.1s | 2.8s | 16.7s | 13.7s |
| Starcraft 2 | 6.3s | 20.8s | 0.1s | 3.2s | 17.8s | 20.7s |
| Stardew Valley | 5.8s | 71.7s | 0.3s | 2.7s | - | - |
| Subnautica | 23.6s | 14.5s | 0.1s | 2.6s | 14.5s | 14.5s |
| Super Mario 64 | 2.6s | 12.5s | 0.1s | 2.5s | 12.5s | 12.5s |
| Super Mario Land 2 | 3.9s | 7.8s | 0.1s | 2.6s | - | - |
| Super Mario World | 3.8s | 6.6s | 0.1s | - | - | - |
| Super Metroid | 11.5s | 10.7s | 0.1s | 2.9s | 12.7s | 58.8s |
| TOEM original | 2.9s | 9.8s | 0.1s | 2.9s | 9.7s | 9.7s |
| TOEM rule builder | 2.9s | 8.7s | 0.1s | 2.7s | 8.7s | 8.7s |
| Terraria | 2.8s | 20.8s | 0.1s | 2.8s | 19.8s | 19.8s |
| The Legend of Zelda | 4.5s | 8.7s | 0.1s | - | - | - |
| The Messenger | 3.5s | 12.8s | 0.1s | 2.6s | - | - |
| The Wind Waker | 14.0s | 9.5s | 0.1s | 2.6s | 9.5s | 9.5s |
| Timespinner | 3.0s | 7.5s | 0.1s | 2.5s | 7.5s | 7.5s |
| Undertale | 2.9s | 5.6s | 0.1s | - | - | - |
| VVVVVV | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 5.6s |
| Wargroove | 2.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.6s |
| WebDevJourney | 3.0s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| Yoshi's Island | 3.8s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| shapez | 4.1s | 6.6s | 0.1s | 2.7s | 6.6s | 6.7s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 23.6s |
| 2 | The Wind Waker | 14.0s |
| 3 | Super Metroid | 11.5s |
| 4 | Metamath | 11.2s |
| 5 | Bomb Rush Cyberfunk | 9.8s |
| 6 | Kingdom Hearts | 9.0s |
| 7 | A Link to the Past | 8.8s |
| 8 | Links Awakening DX | 8.5s |
| 9 | Aquaria | 7.2s |
| 10 | Starcraft 2 | 6.3s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Stardew Valley | 71.7s |
| 2 | Kirby's Dream Land 3 | 55.6s |
| 3 | Kingdom Hearts 2 | 41.9s |
| 4 | Kingdom Hearts | 29.0s |
| 5 | Dark Souls III | 25.8s |
| 6 | Overcooked! 2 | 21.8s |
| 7 | Bomb Rush Cyberfunk | 20.8s |
| 8 | Starcraft 2 | 20.8s |
| 9 | Terraria | 20.8s |
| 10 | A Link to the Past | 20.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Kingdom Hearts 2 | 0.5s |
| 2 | Stardew Valley | 0.3s |
| 3 | Bomb Rush Cyberfunk | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | Aquaria | 0.1s |
| 6 | Castlevania 64 | 0.1s |
| 7 | A Hat in Time | 0.1s |
| 8 | A Link to the Past | 0.1s |
| 9 | A Short Hike | 0.1s |
| 10 | APQuest | 0.1s |

#### Test Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 3.6s |
| 2 | Dark Souls III | 3.3s |
| 3 | Kingdom Hearts 2 | 3.3s |
| 4 | Starcraft 2 | 3.2s |
| 5 | Kingdom Hearts | 3.0s |
| 6 | Metamath | 2.9s |
| 7 | Faxanadu | 2.9s |
| 8 | DOOM II | 2.9s |
| 9 | Overcooked! 2 | 2.9s |
| 10 | Choo-Choo Charles | 2.9s |

#### Test Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.8s |
| 2 | Kingdom Hearts | 23.8s |
| 3 | Overcooked! 2 | 19.8s |
| 4 | Terraria | 19.8s |
| 5 | Bomb Rush Cyberfunk | 19.8s |
| 6 | Starcraft 2 | 17.8s |
| 7 | Links Awakening DX | 17.6s |
| 8 | Landstalker - The Treasures of King Nole | 17.6s |
| 9 | Sonic Adventure 2 Battle | 16.7s |
| 10 | DOOM II | 15.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Super Metroid | 58.8s |
| 2 | Kingdom Hearts 2 | 51.5s |
| 3 | Dark Souls III | 24.8s |
| 4 | Starcraft 2 | 20.7s |
| 5 | Terraria | 19.8s |
| 6 | Bomb Rush Cyberfunk | 19.3s |
| 7 | Links Awakening DX | 17.6s |
| 8 | A Hat in Time | 17.1s |
| 9 | DOOM II | 15.9s |
| 10 | Kingdom Hearts | 15.0s |
