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

| Metric | Count |
|--------|-------|
| Total Templates | 73 |
| Successful Original Generations | 73 |
| Failed Original Generations | 0 |
| Successful Test World Generations | 71 |
| Failed Test World Generations | 2 |
| Successful Test Seed Generations | 45 |
| Failed Test Seed Generations | 28 |
| Cross-Validation Passed | 30 |
| Cross-Validation Failed | 14 |

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

| Metric | Count |
|--------|-------|
| Total Templates | 73 |
| Successful Original Generations | 73 |
| Failed Original Generations | 0 |
| Successful Test World Generations | 71 |
| Failed Test World Generations | 2 |
| Successful Test Seed Generations | 45 |
| Failed Test Seed Generations | 28 |
| Cross-Validation Passed | 15 |
| Cross-Validation Failed | 30 |

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
