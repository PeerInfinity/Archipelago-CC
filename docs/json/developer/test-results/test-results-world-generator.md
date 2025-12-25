# World Generator Test Results

**Generated:** 2025-12-25 20:39:46 UTC

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

**Original World Tests** (prerequisite - must pass before worldgen testing):
- **Original Gen**: Generate a seed with the original Archipelago world
- **Original Spoiler**: Validate the original world's sphere log against its rules.json

**World Generator Tests** (the actual round-trip test):
- **World Gen** (Stage 1): Create `_worldgen` Python world files from rules.json
- **Seed Gen** (Stage 2): Generate a seed with the `_worldgen` world
- **WorldGen Spoiler** (Stage 3): Validate the `_worldgen` world's sphere log against its rules
- **Cross-Validation** (Stage 4): Validate the **original** sphere log against `_worldgen` rules (proves equivalent logic)

---

# Canonical Mode Results

Tests run with `--canonical-seed1` (items placed in original locations).

## Canonical Summary

**Total Templates:** 63

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 63 | 0 | 63 |
| Original Spoiler Test | 61 | 2 | 63 |
| Stage 1: World Generation | 62 | 1 | 63 |
| Stage 2: Seed Generation | 53 | 10 | 63 |
| Stage 3: WorldGen Spoiler Test | 52 | 1 | 53 |
| Stage 4: Cross-Validation | 52 | 1 | 53 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Donkey Kong Country 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ❌ | - | - | - |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ❌ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ❌ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ❌ | - | - |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 63

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 63 | 0 | 63 |
| Original Spoiler Test | 61 | 2 | 63 |
| Stage 1: World Generation | 62 | 1 | 63 |
| Stage 2: Seed Generation | 53 | 10 | 63 |
| Stage 3: WorldGen Spoiler Test | 52 | 1 | 53 |
| Stage 4: Cross-Validation | 25 | 28 | 53 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ❌ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
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
| Factorio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Faxanadu | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heretic | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Hylics 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inscryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kirby's Dream Land 3 | ✅ | ✅ | ✅ | ❌ | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Links Awakening DX | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lufia II Ancient Cave | ✅ | ✅ | ❌ | - | - | - |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ❌ | - | - |
| Overcooked! 2 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ❌ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terraria | ✅ | ❌ | ✅ | ❌ | - | - |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ❌ | - | - |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ❌ | - | - |

---

# Processing Times

## Canonical Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 276.5s | 672.6s | 5.3s | 191.1s | 529.7s | 509.5s |
| Average | 4.4s | 10.7s | 0.1s | 3.1s | 10.0s | 9.6s |
| Max | 29.9s | 55.5s | 0.1s | 19.7s | 26.3s | 26.2s |
| Min | 2.5s | 5.5s | 0.1s | 0.4s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (29.9s) | Kirby's Dream Land 3 (55.5s) | Celeste (Open World) (0.1s) | The Wind Waker (19.7s) | A Link to the Past (26.3s) | A Link to the Past (26.2s) |
| Fastest | MathProof2p2e4 (2.5s) | MathProof2p2e4 (5.5s) | TOEM rule builder (0.1s) | VVVVVV (0.4s) | MathProof2p2e4 (5.5s) | MathProof2p2e4 (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 5.0s | 17.1s | 0.1s | 3.5s | 13.7s | 13.7s |
| A Link to the Past | 9.2s | 18.6s | 0.1s | 5.4s | 26.3s | 26.2s |
| A Short Hike | 3.2s | 10.4s | 0.1s | 3.0s | 9.7s | 9.7s |
| APQuest | 3.0s | 8.7s | 0.1s | 2.8s | 5.6s | 5.6s |
| Adventure | 3.2s | 10.8s | 0.1s | 3.2s | 5.7s | 5.7s |
| Aquaria | 7.2s | 10.5s | 0.1s | 3.1s | 7.7s | 7.7s |
| Bumper Stickers | 3.0s | 11.9s | 0.1s | 2.9s | 8.7s | 8.6s |
| Castlevania - Circle of the Moon | 3.1s | 8.3s | 0.1s | 2.9s | 5.6s | 5.6s |
| Castlevania 64 | 3.4s | 7.2s | 0.1s | 3.1s | 6.6s | 6.6s |
| Celeste (Open World) | 4.4s | 15.4s | 0.1s | 4.0s | 14.7s | 13.7s |
| Celeste 64 | 3.0s | 6.7s | 0.1s | 3.0s | 7.7s | 6.7s |
| ChecksFinder | 2.5s | 6.5s | 0.1s | 2.5s | 6.5s | 6.5s |
| ChocolateChipCookies | 2.7s | 5.6s | 0.1s | 2.7s | 5.6s | 5.6s |
| Choo-Choo Charles | 2.9s | 9.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Civilization VI | 3.1s | 8.7s | 0.1s | 2.9s | 8.7s | 8.7s |
| DLCQuest | 3.1s | 5.6s | 0.1s | 3.0s | 5.7s | 5.6s |
| DOOM 1993 | 3.2s | 12.7s | 0.1s | 3.1s | 12.7s | 12.7s |
| DOOM II | 3.2s | 14.7s | 0.1s | 3.0s | 14.7s | 14.8s |
| Dark Souls III | 5.0s | 24.7s | 0.1s | 3.3s | 24.7s | 24.7s |
| Donkey Kong Country 3 | 3.0s | 13.7s | 0.1s | 2.8s | 13.7s | 13.7s |
| Factorio | 3.6s | 9.7s | 0.1s | 3.1s | 9.7s | 9.7s |
| Faxanadu | 2.7s | 6.4s | 0.1s | 2.6s | 8.5s | 6.5s |
| Final Fantasy Mystic Quest | 4.1s | 10.7s | 0.1s | 3.2s | 10.7s | 10.7s |
| Heretic | 3.3s | 14.8s | 0.1s | 3.1s | 14.7s | 14.7s |
| Hylics 2 | 3.9s | 6.7s | 0.1s | 2.8s | 6.7s | 6.7s |
| Inscryption | 3.1s | 6.6s | 0.1s | 3.0s | 6.7s | 6.7s |
| Kirby's Dream Land 3 | 4.8s | 55.5s | 0.1s | 0.4s | - | - |
| Landstalker - The Treasures of King Nole | 3.1s | 8.7s | 0.1s | 2.9s | 17.8s | 8.6s |
| Links Awakening DX | 9.3s | 16.7s | 0.1s | 3.3s | 16.7s | 16.7s |
| Lufia II Ancient Cave | 2.9s | 5.6s | 0.1s | - | - | - |
| Mario & Luigi Superstar Saga | 3.9s | 9.7s | 0.1s | 3.6s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.5s | 5.5s | 0.1s | 2.5s | 5.5s | 5.5s |
| Mega Man 2 | 3.0s | 6.6s | 0.1s | 3.0s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.1s | 8.8s | 0.1s | 2.8s | 8.7s | 8.7s |
| Meritous | 2.9s | 5.7s | 0.1s | 3.0s | 5.8s | 5.7s |
| Metamath | 11.4s | 5.7s | 0.1s | 2.6s | - | - |
| Muse Dash | 3.2s | 7.7s | 0.1s | 3.0s | 9.7s | 7.7s |
| Noita | 2.8s | 5.6s | 0.1s | 2.9s | 5.6s | 5.7s |
| Old School Runescape | 4.4s | 8.8s | 0.1s | 0.4s | - | - |
| Overcooked! 2 | 3.0s | 20.8s | 0.1s | 3.0s | 20.8s | 20.8s |
| Paint | 2.9s | 7.9s | 0.1s | 3.0s | 6.7s | 6.7s |
| Risk of Rain 2 | 2.8s | 6.5s | 0.1s | 2.8s | 6.5s | 6.5s |
| Saving Princess | 2.9s | 5.6s | 0.1s | 3.0s | 6.7s | 5.7s |
| Shivers | 3.3s | 9.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 4.3s | 13.7s | 0.1s | 4.1s | 16.8s | 13.8s |
| Starcraft 2 | 6.9s | 18.0s | 0.1s | 0.4s | - | - |
| Subnautica | 29.9s | 10.8s | 0.1s | 2.7s | - | - |
| Super Mario 64 | 2.9s | 12.7s | 0.1s | 3.0s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.0s | 14.3s | 0.1s | 0.4s | - | - |
| Super Mario World | 4.1s | 6.6s | 0.1s | 3.0s | 6.6s | 6.6s |
| TOEM original | 2.7s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| TOEM rule builder | 2.5s | 8.5s | 0.1s | 2.5s | 8.5s | 9.5s |
| Terraria | 3.0s | 14.4s | 0.1s | 0.5s | - | - |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | 3.0s | 10.7s | 8.7s |
| The Messenger | 3.4s | 12.9s | 0.1s | 3.1s | 12.8s | 12.9s |
| The Wind Waker | 16.3s | 9.7s | 0.1s | 19.7s | 9.7s | 9.7s |
| Timespinner | 3.8s | 7.7s | 0.1s | 3.5s | 6.6s | 6.7s |
| Undertale | 2.9s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| VVVVVV | 2.7s | 5.5s | 0.1s | 0.4s | - | - |
| Wargroove | 2.9s | 6.6s | 0.1s | 2.7s | 6.6s | 6.6s |
| WebDevJourney | 2.8s | 8.7s | 0.1s | 2.8s | 8.7s | 8.7s |
| Yoshi's Island | 3.4s | 9.4s | 0.1s | 5.1s | 8.5s | 8.5s |
| shapez | 4.2s | 6.7s | 0.1s | 2.6s | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 29.9s |
| 2 | The Wind Waker | 16.3s |
| 3 | Metamath | 11.4s |
| 4 | Links Awakening DX | 9.3s |
| 5 | A Link to the Past | 9.2s |
| 6 | Aquaria | 7.2s |
| 7 | Starcraft 2 | 6.9s |
| 8 | Dark Souls III | 5.0s |
| 9 | A Hat in Time | 5.0s |
| 10 | Kirby's Dream Land 3 | 4.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 55.5s |
| 2 | Dark Souls III | 24.7s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | A Link to the Past | 18.6s |
| 5 | Starcraft 2 | 18.0s |
| 6 | A Hat in Time | 17.1s |
| 7 | Links Awakening DX | 16.7s |
| 8 | Celeste (Open World) | 15.4s |
| 9 | Heretic | 14.8s |
| 10 | DOOM II | 14.7s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Celeste (Open World) | 0.1s |
| 2 | Subnautica | 0.1s |
| 3 | Aquaria | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | A Link to the Past | 0.1s |
| 7 | A Short Hike | 0.1s |
| 8 | APQuest | 0.1s |
| 9 | Adventure | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 19.7s |
| 2 | A Link to the Past | 5.4s |
| 3 | Yoshi's Island | 5.1s |
| 4 | Sonic Adventure 2 Battle | 4.1s |
| 5 | Celeste (Open World) | 4.0s |
| 6 | Mario & Luigi Superstar Saga | 3.6s |
| 7 | Timespinner | 3.5s |
| 8 | A Hat in Time | 3.5s |
| 9 | Links Awakening DX | 3.3s |
| 10 | Dark Souls III | 3.3s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 26.3s |
| 2 | Dark Souls III | 24.7s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | Landstalker - The Treasures of King Nole | 17.8s |
| 5 | Sonic Adventure 2 Battle | 16.8s |
| 6 | Links Awakening DX | 16.7s |
| 7 | Heretic | 14.7s |
| 8 | Celeste (Open World) | 14.7s |
| 9 | DOOM II | 14.7s |
| 10 | A Hat in Time | 13.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 26.2s |
| 2 | Dark Souls III | 24.7s |
| 3 | Overcooked! 2 | 20.8s |
| 4 | Links Awakening DX | 16.7s |
| 5 | DOOM II | 14.8s |
| 6 | Heretic | 14.7s |
| 7 | Sonic Adventure 2 Battle | 13.8s |
| 8 | A Hat in Time | 13.7s |
| 9 | Celeste (Open World) | 13.7s |
| 10 | Donkey Kong Country 3 | 13.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 274.6s | 672.1s | 5.3s | 190.9s | 522.4s | 622.2s |
| Average | 4.4s | 10.7s | 0.1s | 3.1s | 9.9s | 11.7s |
| Max | 28.9s | 56.1s | 0.1s | 19.7s | 23.7s | 17.4s |
| Min | 2.6s | 5.5s | 0.1s | 0.4s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (28.9s) | Kirby's Dream Land 3 (56.1s) | A Link to the Past (0.1s) | The Wind Waker (19.7s) | Dark Souls III (23.7s) | Civilization VI (17.4s) |
| Fastest | ChocolateChipCookies (2.6s) | Lufia II Ancient Cave (5.5s) | WebDevJourney (0.1s) | VVVVVV (0.4s) | MathProof2p2e4 (5.6s) | APQuest (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 4.8s | 14.1s | 0.1s | 3.4s | 13.6s | 13.5s |
| A Link to the Past | 10.2s | 19.1s | 0.1s | 5.8s | 17.5s | 14.3s |
| A Short Hike | 3.1s | 13.9s | 0.1s | 2.8s | 9.6s | 9.6s |
| APQuest | 2.9s | 7.9s | 0.1s | 2.7s | 5.6s | 5.6s |
| Adventure | 3.1s | 8.0s | 0.1s | 2.9s | 5.6s | 14.2s |
| Aquaria | 6.9s | 8.4s | 0.1s | 3.0s | 7.7s | 14.4s |
| Bumper Stickers | 3.2s | 10.3s | 0.1s | 2.8s | 8.7s | 14.4s |
| Castlevania - Circle of the Moon | 3.3s | 8.0s | 0.1s | 3.1s | 5.7s | 14.3s |
| Castlevania 64 | 3.5s | 9.9s | 0.1s | 3.2s | 6.6s | 6.6s |
| Celeste (Open World) | 4.2s | 15.0s | 0.1s | 4.1s | 14.5s | 14.2s |
| Celeste 64 | 2.9s | 6.5s | 0.1s | 2.8s | 7.5s | 14.0s |
| ChecksFinder | 2.7s | 6.7s | 0.1s | 2.7s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.6s | 5.6s | 0.1s | 2.6s | 5.6s | 14.1s |
| Choo-Choo Charles | 2.8s | 10.7s | 0.1s | 2.8s | 9.7s | 9.7s |
| Civilization VI | 2.9s | 8.7s | 0.1s | 2.8s | 8.6s | 17.4s |
| DLCQuest | 3.1s | 5.6s | 0.1s | 3.0s | 5.7s | 5.6s |
| DOOM 1993 | 3.4s | 12.8s | 0.1s | 3.3s | 12.8s | 14.4s |
| DOOM II | 3.4s | 15.8s | 0.1s | 3.2s | 15.7s | 14.3s |
| Dark Souls III | 5.0s | 24.8s | 0.1s | 3.3s | 23.7s | 17.1s |
| Donkey Kong Country 3 | 2.8s | 14.6s | 0.1s | 2.9s | 14.5s | 14.5s |
| Factorio | 3.4s | 9.5s | 0.1s | 3.0s | 9.5s | 9.5s |
| Faxanadu | 2.9s | 6.6s | 0.1s | 2.8s | 8.6s | 14.2s |
| Final Fantasy Mystic Quest | 3.9s | 10.7s | 0.1s | 3.0s | 10.7s | 10.7s |
| Heretic | 3.2s | 14.8s | 0.1s | 3.1s | 14.7s | 14.3s |
| Hylics 2 | 3.8s | 6.6s | 0.1s | 2.8s | 6.6s | 6.6s |
| Inscryption | 2.9s | 6.6s | 0.1s | 2.9s | 6.7s | 6.6s |
| Kirby's Dream Land 3 | 5.0s | 56.1s | 0.1s | 0.4s | - | - |
| Landstalker - The Treasures of King Nole | 3.4s | 8.8s | 0.1s | 3.2s | 17.7s | 14.4s |
| Links Awakening DX | 9.6s | 16.7s | 0.1s | 3.6s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 2.8s | 5.5s | 0.1s | - | - | - |
| Mario & Luigi Superstar Saga | 3.8s | 9.6s | 0.1s | 3.4s | 9.6s | 9.6s |
| MathProof2p2e4 | 2.7s | 5.6s | 0.1s | 2.6s | 5.6s | 14.2s |
| Mega Man 2 | 2.9s | 6.6s | 0.1s | 2.8s | 6.6s | 6.7s |
| MegaMan Battle Network 3 | 3.1s | 7.6s | 0.1s | 2.8s | 8.7s | 17.3s |
| Meritous | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 14.2s |
| Metamath | 11.0s | 5.6s | 0.1s | 2.5s | - | - |
| Muse Dash | 3.3s | 7.8s | 0.1s | 3.0s | 9.7s | 14.4s |
| Noita | 3.0s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Old School Runescape | 4.5s | 8.7s | 0.1s | 0.4s | - | - |
| Overcooked! 2 | 2.9s | 21.6s | 0.1s | 2.8s | 21.6s | 14.0s |
| Paint | 2.8s | 7.7s | 0.1s | 2.9s | 6.5s | 6.5s |
| Risk of Rain 2 | 3.0s | 6.6s | 0.1s | 2.9s | 6.6s | 6.6s |
| Saving Princess | 2.8s | 5.6s | 0.1s | 2.8s | 6.6s | 14.2s |
| Shivers | 3.2s | 9.7s | 0.1s | 2.9s | 9.7s | 14.3s |
| Sonic Adventure 2 Battle | 4.0s | 13.7s | 0.1s | 3.9s | 16.7s | 14.4s |
| Starcraft 2 | 6.7s | 17.8s | 0.1s | 0.4s | - | - |
| Subnautica | 28.9s | 10.9s | 0.1s | 2.8s | - | - |
| Super Mario 64 | 3.2s | 12.8s | 0.1s | 3.0s | 12.7s | 12.7s |
| Super Mario Land 2 | 3.9s | 14.4s | 0.1s | 0.4s | - | - |
| Super Mario World | 3.9s | 6.5s | 0.1s | 2.9s | 6.5s | 6.5s |
| TOEM original | 2.7s | 9.5s | 0.1s | 2.7s | 9.5s | 9.5s |
| TOEM rule builder | 2.7s | 8.6s | 0.1s | 2.7s | 8.6s | 8.6s |
| Terraria | 2.9s | 14.3s | 0.1s | 0.4s | - | - |
| The Legend of Zelda | 4.3s | 8.6s | 0.1s | 3.0s | 10.7s | 14.4s |
| The Messenger | 3.2s | 12.9s | 0.1s | 3.0s | 12.8s | 12.8s |
| The Wind Waker | 15.9s | 9.7s | 0.1s | 19.7s | 9.7s | 14.3s |
| Timespinner | 3.8s | 7.7s | 0.1s | 3.7s | 6.7s | 14.5s |
| Undertale | 3.1s | 5.7s | 0.1s | 3.0s | 5.6s | 5.6s |
| VVVVVV | 2.8s | 5.6s | 0.1s | 0.4s | - | - |
| Wargroove | 2.7s | 6.4s | 0.1s | 2.6s | 6.5s | 6.4s |
| WebDevJourney | 2.7s | 8.5s | 0.1s | 2.9s | 8.5s | 13.9s |
| Yoshi's Island | 3.6s | 9.6s | 0.1s | 5.4s | 8.6s | 8.7s |
| shapez | 4.1s | 6.6s | 0.1s | 2.5s | - | - |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 28.9s |
| 2 | The Wind Waker | 15.9s |
| 3 | Metamath | 11.0s |
| 4 | A Link to the Past | 10.2s |
| 5 | Links Awakening DX | 9.6s |
| 6 | Aquaria | 6.9s |
| 7 | Starcraft 2 | 6.7s |
| 8 | Dark Souls III | 5.0s |
| 9 | Kirby's Dream Land 3 | 5.0s |
| 10 | A Hat in Time | 4.8s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 56.1s |
| 2 | Dark Souls III | 24.8s |
| 3 | Overcooked! 2 | 21.6s |
| 4 | A Link to the Past | 19.1s |
| 5 | Starcraft 2 | 17.8s |
| 6 | Links Awakening DX | 16.7s |
| 7 | DOOM II | 15.8s |
| 8 | Celeste (Open World) | 15.0s |
| 9 | Heretic | 14.8s |
| 10 | Donkey Kong Country 3 | 14.6s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | Subnautica | 0.1s |
| 3 | Aquaria | 0.1s |
| 4 | Celeste (Open World) | 0.1s |
| 5 | Starcraft 2 | 0.1s |
| 6 | A Short Hike | 0.1s |
| 7 | Adventure | 0.1s |
| 8 | Bumper Stickers | 0.1s |
| 9 | Castlevania - Circle of the Moon | 0.1s |
| 10 | Castlevania 64 | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 19.7s |
| 2 | A Link to the Past | 5.8s |
| 3 | Yoshi's Island | 5.4s |
| 4 | Celeste (Open World) | 4.1s |
| 5 | Sonic Adventure 2 Battle | 3.9s |
| 6 | Timespinner | 3.7s |
| 7 | Links Awakening DX | 3.6s |
| 8 | Mario & Luigi Superstar Saga | 3.4s |
| 9 | A Hat in Time | 3.4s |
| 10 | DOOM 1993 | 3.3s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.7s |
| 2 | Overcooked! 2 | 21.6s |
| 3 | Landstalker - The Treasures of King Nole | 17.7s |
| 4 | A Link to the Past | 17.5s |
| 5 | Links Awakening DX | 16.8s |
| 6 | Sonic Adventure 2 Battle | 16.7s |
| 7 | DOOM II | 15.7s |
| 8 | Heretic | 14.7s |
| 9 | Celeste (Open World) | 14.5s |
| 10 | Donkey Kong Country 3 | 14.5s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Civilization VI | 17.4s |
| 2 | MegaMan Battle Network 3 | 17.3s |
| 3 | Dark Souls III | 17.1s |
| 4 | Links Awakening DX | 16.8s |
| 5 | Timespinner | 14.5s |
| 6 | Donkey Kong Country 3 | 14.5s |
| 7 | Aquaria | 14.4s |
| 8 | DOOM 1993 | 14.4s |
| 9 | Muse Dash | 14.4s |
| 10 | Bumper Stickers | 14.4s |
