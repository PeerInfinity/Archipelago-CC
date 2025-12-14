# World Generator Test Results

**Generated:** 2025-12-06 05:39:24 UTC
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
| Total Templates | 80 |
| Successful Original Generations | 80 |
| Failed Original Generations | 0 |
| Successful Test World Generations | 80 |
| Failed Test World Generations | 0 |
| Successful Test Seed Generations | 62 |
| Failed Test Seed Generations | 18 |
| Cross-Validation Passed | 26 |
| Cross-Validation Failed | 35 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Blasphemous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Factorio | ✅ | ✅ | ✅ | ❌ | - | - |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Jak and Daxter The Precursor Legacy | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lingo | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ❌ | - | - |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Pokemon Emerald | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pokemon Red and Blue | ✅ | ✅ | ✅ | ❌ | - | - |
| Raft | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| SMZ3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Saving Princess | ✅ | ✅ | ✅ | ❌ | - | - |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Metroid | ✅ | ✅ | ✅ | ❌ | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TUNIC | ✅ | ✅ | ✅ | ❌ | - | - |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Witness | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yu-Gi-Oh! 2006 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

## Canonical Failures

**54 games had errors:**

### A Hat in Time

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### A Link to the Past

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### APQuest

**Testing phase:**
- Test world generation failed: raise FillError(

### Aquaria

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Blasphemous

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Bomb Rush Cyberfunk

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Castlevania - Circle of the Moon

**Testing phase:**
- Test world generation failed: raise FillError(

### Castlevania 64

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Celeste 64

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### DLCQuest

**Testing phase:**
- Test world spoiler test failed: Spoiler test failed
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Donkey Kong Country 3

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Factorio

**Testing phase:**
- Test world generation failed: raise FillError(

### Jak and Daxter The Precursor Legacy

**Testing phase:**
- Test world generation failed: raise FillError(

### Kingdom Hearts

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Kingdom Hearts 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Kirby's Dream Land 3

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Lingo

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Links Awakening DX

**Testing phase:**
- Test world generation failed: raise FillError(

### Mario & Luigi Superstar Saga

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Mega Man 2

**Testing phase:**
- Test world generation failed: raise FillError(

### MegaMan Battle Network 3

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Muse Dash

**Testing phase:**
- Test world generation failed: raise FillError(

### Old School Runescape

**Testing phase:**
- Test world generation failed: AssertionError: item code None should be event, location.address should then also be None. Location:  Points: Cook's Assistant, Item: 1 QP (Cook's Assistant)

### Overcooked! 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Paint

**Testing phase:**
- Test world spoiler test failed: Spoiler test failed
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Pokemon Red and Blue

**Testing phase:**
- Test world generation failed: raise FillError(

### Raft

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Risk of Rain 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### SMZ3

**Testing phase:**
- Test world generation failed: raise FillError(

### Saving Princess

**Testing phase:**
- Test world generation failed: raise FillError(

### Secret of Evermore

**Testing phase:**
- Test world spoiler test failed: Spoiler test failed
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Shivers

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Sonic Adventure 2 Battle

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Starcraft 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Stardew Valley

**Testing phase:**
- Test world generation failed: raise FillError(

### Subnautica

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Super Mario 64

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Super Mario Land 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Super Metroid

**Testing phase:**
- Test world generation failed: AssertionError: item code None should be event, location.address should then also be None. Location:  Ridley, Item: Ridley

### TOEM original

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### TOEM rule builder

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### TUNIC

**Testing phase:**
- Test world generation failed: raise FillError(

### Terraria

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### The Legend of Zelda

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### The Messenger

**Testing phase:**
- Test world generation failed: raise FillError(

### The Wind Waker

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### The Witness

**Testing phase:**
- Test world generation failed: raise FillError(

### Timespinner

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### VVVVVV

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Wargroove

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Yacht Dice

**Testing phase:**
- Test world generation failed: AssertionError: item code None should be event, location.address should then also be None. Location:  777 score, Item: Victory

### Yoshi's Island

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Yu-Gi-Oh! 2006

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### shapez

**Testing phase:**
- Test world generation failed: KeyError: 'Achievements needing a MAM'

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

| Metric | Count |
|--------|-------|
| Total Templates | 80 |
| Successful Original Generations | 80 |
| Failed Original Generations | 0 |
| Successful Test World Generations | 80 |
| Failed Test World Generations | 0 |
| Successful Test Seed Generations | 60 |
| Failed Test Seed Generations | 20 |
| Cross-Validation Passed | 12 |
| Cross-Validation Failed | 47 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Blasphemous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ❌ | - | - |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| DOOM 1993 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| DOOM II | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Dark Souls III | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Factorio | ✅ | ✅ | ✅ | ❌ | - | - |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Jak and Daxter The Precursor Legacy | ✅ | ✅ | ✅ | ❌ | - | - |
| Kingdom Hearts | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kingdom Hearts 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Lingo | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ❌ | - | - |
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Pokemon Emerald | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pokemon Red and Blue | ✅ | ✅ | ✅ | ❌ | - | - |
| Raft | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| SMZ3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Saving Princess | ✅ | ✅ | ✅ | ❌ | - | - |
| Secret of Evermore | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Stardew Valley | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Metroid | ✅ | ✅ | ✅ | ❌ | - | - |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| TUNIC | ✅ | ✅ | ✅ | ❌ | - | - |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Witness | ✅ | ✅ | ✅ | ❌ | - | - |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yu-Gi-Oh! 2006 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

## Random Failures

**68 games had errors:**

### A Hat in Time

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### A Link to the Past

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### APQuest

**Testing phase:**
- Test world generation failed: raise FillError(f"No more spots to place {len(unplaced_items)} items. Remaining locations are invalid.\n"

### Adventure

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Aquaria

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Blasphemous

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Bomb Rush Cyberfunk

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Bumper Stickers

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Castlevania - Circle of the Moon

**Testing phase:**
- Test world generation failed: raise FillError(f"No more spots to place {len(unplaced_items)} items. Remaining locations are invalid.\n"

### Castlevania 64

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Celeste (Open World)

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Celeste 64

**Testing phase:**
- Test world generation failed: raise FillError(

### Civilization VI

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### DLCQuest

**Testing phase:**
- Test world spoiler test failed: Spoiler test failed
- Cross-validation failed: original sphere log incompatible with _worldgen world

### DOOM 1993

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### DOOM II

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Dark Souls III

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Donkey Kong Country 3

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Factorio

**Testing phase:**
- Test world generation failed: raise FillError(

### Faxanadu

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Final Fantasy Mystic Quest

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Heretic

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Jak and Daxter The Precursor Legacy

**Testing phase:**
- Test world generation failed: raise FillError(

### Kingdom Hearts

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Kingdom Hearts 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Kirby's Dream Land 3

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Landstalker - The Treasures of King Nole

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Lingo

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Links Awakening DX

**Testing phase:**
- Test world generation failed: raise FillError(

### Mario & Luigi Superstar Saga

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Mega Man 2

**Testing phase:**
- Test world generation failed: raise FillError(

### MegaMan Battle Network 3

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Meritous

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Metamath

**Testing phase:**
- Test world generation failed: raise FillError(

### Muse Dash

**Testing phase:**
- Test world generation failed: raise FillError(f"No more spots to place {len(unplaced_items)} items. Remaining locations are invalid.\n"

### Old School Runescape

**Testing phase:**
- Test world generation failed: AssertionError: item code None should be event, location.address should then also be None. Location:  Points: Cook's Assistant, Item: 1 QP (Cook's Assistant)

### Overcooked! 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Paint

**Testing phase:**
- Test world spoiler test failed: Spoiler test failed
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Pokemon Red and Blue

**Testing phase:**
- Test world generation failed: raise FillError(

### Raft

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Risk of Rain 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### SMZ3

**Testing phase:**
- Test world generation failed: raise FillError(

### Saving Princess

**Testing phase:**
- Test world generation failed: raise FillError(

### Secret of Evermore

**Testing phase:**
- Test world spoiler test failed: Spoiler test failed
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Shivers

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Sonic Adventure 2 Battle

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Starcraft 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Stardew Valley

**Testing phase:**
- Test world generation failed: raise FillError(f"No more spots to place {len(unplaced_items)} items. Remaining locations are invalid.\n"

### Subnautica

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Super Mario 64

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Super Mario Land 2

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Super Metroid

**Testing phase:**
- Test world generation failed: AssertionError: item code None should be event, location.address should then also be None. Location:  Ridley, Item: Ridley

### TOEM original

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### TOEM rule builder

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### TUNIC

**Testing phase:**
- Test world generation failed: raise FillError(

### Terraria

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### The Legend of Zelda

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### The Messenger

**Testing phase:**
- Test world generation failed: raise FillError(

### The Wind Waker

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### The Witness

**Testing phase:**
- Test world generation failed: raise FillError(

### Timespinner

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Undertale

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### VVVVVV

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Wargroove

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Yacht Dice

**Testing phase:**
- Test world generation failed: AssertionError: item code None should be event, location.address should then also be None. Location:  777 score, Item: Victory

### Yoshi's Island

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### Yu-Gi-Oh! 2006

**Testing phase:**
- Cross-validation failed: original sphere log incompatible with _worldgen world

### shapez

**Testing phase:**
- Test world generation failed: KeyError: 'Achievements needing a MAM'
