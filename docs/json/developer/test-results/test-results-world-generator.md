# World Generator Test Results

**Generated:** 2025-12-27 22:02:56 UTC

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

**Total Templates:** 64

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 64 | 0 | 64 |
| Original Spoiler Test | 64 | 0 | 64 |
| Stage 1: World Generation | 64 | 0 | 64 |
| Stage 2: Seed Generation | 56 | 8 | 64 |
| Stage 3: WorldGen Spoiler Test | 56 | 0 | 56 |
| Stage 4: Cross-Validation | 55 | 1 | 56 |

## Canonical Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aquaria | ✅ | ✅ | ✅ | ❌ | - | - |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TUNIC | ✅ | ✅ | ✅ | ❌ | - | - |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VVVVVV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wargroove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yoshi's Island | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shapez | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

**Total Templates:** 64

| Step | Passed | Failed | Total |
|------|--------|--------|-------|
| Original Generation | 64 | 0 | 64 |
| Original Spoiler Test | 64 | 0 | 64 |
| Stage 1: World Generation | 64 | 0 | 64 |
| Stage 2: Seed Generation | 56 | 8 | 64 |
| Stage 3: WorldGen Spoiler Test | 56 | 0 | 56 |
| Stage 4: Cross-Validation | 28 | 28 | 56 |

## Random Detailed Results

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Validation |
|------|--------------|------------------|-----------|----------|------------------|------------------|
| A Hat in Time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Link to the Past | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| A Short Hike | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| APQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Aquaria | ✅ | ✅ | ✅ | ❌ | - | - |
| Bumper Stickers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania - Circle of the Moon | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Castlevania 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Celeste (Open World) | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Celeste 64 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| ChecksFinder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - |
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
| Lufia II Ancient Cave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mario & Luigi Superstar Saga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Mega Man 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MegaMan Battle Network 3 | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Meritous | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Metamath | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Muse Dash | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old School Runescape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overcooked! 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Paint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk of Rain 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saving Princess | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Shivers | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Sonic Adventure 2 Battle | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Starcraft 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Subnautica | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Super Mario 64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Super Mario Land 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Super Mario World | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM original | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOEM rule builder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TUNIC | ✅ | ✅ | ✅ | ❌ | - | - |
| Terraria | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Legend of Zelda | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| The Messenger | ✅ | ✅ | ✅ | ❌ | - | - |
| The Wind Waker | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Timespinner | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
| Undertale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 291.0s | 718.5s | 5.6s | 214.6s | 541.6s | 530.3s |
| Average | 4.5s | 11.2s | 0.1s | 3.4s | 9.7s | 9.5s |
| Max | 26.8s | 68.6s | 0.1s | 18.9s | 24.7s | 24.7s |
| Min | 2.8s | 5.6s | 0.1s | 2.5s | 5.6s | 5.6s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (26.8s) | Kirby's Dream Land 3 (68.6s) | A Link to the Past (0.1s) | The Wind Waker (18.9s) | Dark Souls III (24.7s) | Dark Souls III (24.7s) |
| Fastest | VVVVVV (2.8s) | Metamath (5.6s) | shapez (0.1s) | Overcooked! 2 (2.5s) | Metamath (5.6s) | VVVVVV (5.6s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 6.3s | 15.5s | 0.1s | 3.2s | 13.7s | 13.8s |
| A Link to the Past | 14.7s | 21.4s | 0.1s | 5.0s | 17.7s | 24.6s |
| A Short Hike | 3.7s | 13.2s | 0.1s | 3.4s | 9.8s | 9.8s |
| APQuest | 3.1s | 9.2s | 0.1s | 3.2s | 5.7s | 5.7s |
| Adventure | 3.1s | 8.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| Aquaria | 7.0s | 8.2s | 0.1s | 2.6s | - | - |
| Bumper Stickers | 3.1s | 11.9s | 0.1s | 2.8s | 8.6s | 8.6s |
| Castlevania - Circle of the Moon | 3.3s | 9.0s | 0.1s | 3.0s | 5.7s | 5.7s |
| Castlevania 64 | 3.5s | 7.4s | 0.1s | 2.9s | 6.6s | 6.6s |
| Celeste (Open World) | 4.6s | 18.5s | 0.1s | 3.8s | 14.7s | 14.7s |
| Celeste 64 | 3.2s | 6.7s | 0.1s | 3.0s | 7.7s | 6.7s |
| ChecksFinder | 2.9s | 6.8s | 0.1s | 2.9s | 6.6s | 6.6s |
| ChocolateChipCookies | 3.2s | 5.8s | 0.1s | 3.3s | 5.8s | 5.8s |
| Choo-Choo Charles | 3.0s | 9.7s | 0.1s | 3.0s | 10.7s | 10.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.5s | - | - |
| DLCQuest | 3.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| DOOM 1993 | 3.2s | 12.7s | 0.1s | 2.9s | 12.7s | 12.7s |
| DOOM II | 3.5s | 15.8s | 0.1s | 3.1s | 15.8s | 15.9s |
| Dark Souls III | 5.1s | 24.8s | 0.1s | 3.2s | 24.7s | 24.7s |
| Donkey Kong Country 3 | 3.0s | 13.7s | 0.1s | 2.8s | 13.7s | 13.7s |
| Factorio | 3.9s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Faxanadu | 3.0s | 6.6s | 0.1s | 2.9s | 8.7s | 6.6s |
| Final Fantasy Mystic Quest | 4.6s | 10.9s | 0.1s | 3.5s | 10.9s | 10.8s |
| Heretic | 3.5s | 14.7s | 0.1s | 3.0s | 14.8s | 14.7s |
| Hylics 2 | 3.8s | 6.7s | 0.1s | 3.0s | 6.6s | 6.7s |
| Inscryption | 3.0s | 6.6s | 0.1s | 2.8s | 6.6s | 6.6s |
| Kirby's Dream Land 3 | 4.6s | 68.6s | 0.1s | 2.5s | - | - |
| Landstalker - The Treasures of King Nole | 3.2s | 8.8s | 0.1s | 3.0s | 17.7s | 8.7s |
| Links Awakening DX | 5.1s | 16.7s | 0.1s | 3.2s | 16.8s | 16.8s |
| Lufia II Ancient Cave | 3.1s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 4.0s | 9.7s | 0.1s | 4.1s | 9.7s | 10.7s |
| MathProof2p2e4 | 2.9s | 5.6s | 0.1s | 2.9s | 5.7s | 5.6s |
| Mega Man 2 | 3.5s | 6.8s | 0.1s | 3.3s | 6.8s | 6.8s |
| MegaMan Battle Network 3 | 3.3s | 8.9s | 0.1s | 2.9s | 8.7s | 8.7s |
| Meritous | 2.9s | 5.7s | 0.1s | 2.9s | 5.7s | 5.7s |
| Metamath | 10.2s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Muse Dash | 3.1s | 7.6s | 0.1s | 2.8s | 9.7s | 7.6s |
| Noita | 2.9s | 5.7s | 0.1s | 2.9s | 5.6s | 5.7s |
| Old School Runescape | 4.8s | 8.7s | 0.1s | 3.0s | 8.6s | 8.7s |
| Overcooked! 2 | 3.1s | 20.8s | 0.1s | 2.5s | - | - |
| Paint | 3.0s | 7.7s | 0.1s | 3.0s | 6.7s | 6.7s |
| Risk of Rain 2 | 3.4s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| Saving Princess | 3.4s | 5.8s | 0.1s | 3.3s | 6.8s | 5.8s |
| Shivers | 3.3s | 9.7s | 0.1s | 3.1s | 9.7s | 9.7s |
| Sonic Adventure 2 Battle | 4.4s | 13.7s | 0.1s | 3.0s | 16.8s | 13.7s |
| Starcraft 2 | 7.0s | 24.8s | 0.1s | 2.5s | - | - |
| Subnautica | 26.8s | 14.6s | 0.1s | 5.8s | 14.7s | 14.7s |
| Super Mario 64 | 3.1s | 12.7s | 0.1s | 3.0s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.1s | 8.7s | 0.1s | 2.5s | - | - |
| Super Mario World | 4.3s | 6.8s | 0.1s | 2.8s | 6.6s | 6.6s |
| TOEM original | 3.0s | 8.7s | 0.1s | 3.0s | 8.7s | 8.7s |
| TOEM rule builder | 3.0s | 8.7s | 0.1s | 2.9s | 8.6s | 8.7s |
| TUNIC | 6.6s | 12.9s | 0.1s | 3.0s | - | - |
| Terraria | 3.0s | 20.8s | 0.1s | 3.0s | 19.8s | 19.8s |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | 3.1s | 10.7s | 8.7s |
| The Messenger | 3.3s | 13.8s | 0.1s | 2.5s | - | - |
| The Wind Waker | 16.2s | 9.6s | 0.1s | 18.9s | 9.6s | 9.6s |
| Timespinner | 4.0s | 7.7s | 0.1s | 3.1s | 6.7s | 7.7s |
| Undertale | 3.1s | 5.6s | 0.1s | 2.9s | 5.6s | 5.6s |
| VVVVVV | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Wargroove | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s | 6.6s |
| WebDevJourney | 3.0s | 8.6s | 0.1s | 2.9s | 8.7s | 8.7s |
| Yoshi's Island | 4.4s | 10.0s | 0.1s | 6.3s | 8.8s | 8.8s |
| shapez | 4.3s | 6.7s | 0.1s | 3.0s | 6.6s | 6.6s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 26.8s |
| 2 | The Wind Waker | 16.2s |
| 3 | A Link to the Past | 14.7s |
| 4 | Metamath | 10.2s |
| 5 | Aquaria | 7.0s |
| 6 | Starcraft 2 | 7.0s |
| 7 | TUNIC | 6.6s |
| 8 | A Hat in Time | 6.3s |
| 9 | Links Awakening DX | 5.1s |
| 10 | Dark Souls III | 5.1s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 68.6s |
| 2 | Starcraft 2 | 24.8s |
| 3 | Dark Souls III | 24.8s |
| 4 | A Link to the Past | 21.4s |
| 5 | Terraria | 20.8s |
| 6 | Overcooked! 2 | 20.8s |
| 7 | Celeste (Open World) | 18.5s |
| 8 | Links Awakening DX | 16.7s |
| 9 | DOOM II | 15.8s |
| 10 | A Hat in Time | 15.5s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | Celeste (Open World) | 0.1s |
| 3 | A Short Hike | 0.1s |
| 4 | Starcraft 2 | 0.1s |
| 5 | A Hat in Time | 0.1s |
| 6 | Aquaria | 0.1s |
| 7 | Castlevania - Circle of the Moon | 0.1s |
| 8 | Castlevania 64 | 0.1s |
| 9 | APQuest | 0.1s |
| 10 | Adventure | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 18.9s |
| 2 | Yoshi's Island | 6.3s |
| 3 | Subnautica | 5.8s |
| 4 | A Link to the Past | 5.0s |
| 5 | Mario & Luigi Superstar Saga | 4.1s |
| 6 | Celeste (Open World) | 3.8s |
| 7 | Final Fantasy Mystic Quest | 3.5s |
| 8 | A Short Hike | 3.4s |
| 9 | Mega Man 2 | 3.3s |
| 10 | Saving Princess | 3.3s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.7s |
| 2 | Terraria | 19.8s |
| 3 | Landstalker - The Treasures of King Nole | 17.7s |
| 4 | A Link to the Past | 17.7s |
| 5 | Links Awakening DX | 16.8s |
| 6 | Sonic Adventure 2 Battle | 16.8s |
| 7 | DOOM II | 15.8s |
| 8 | Heretic | 14.8s |
| 9 | Celeste (Open World) | 14.7s |
| 10 | Subnautica | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 24.7s |
| 2 | A Link to the Past | 24.6s |
| 3 | Terraria | 19.8s |
| 4 | Links Awakening DX | 16.8s |
| 5 | DOOM II | 15.9s |
| 6 | Heretic | 14.7s |
| 7 | Celeste (Open World) | 14.7s |
| 8 | Subnautica | 14.7s |
| 9 | A Hat in Time | 13.8s |
| 10 | Sonic Adventure 2 Battle | 13.7s |

---

## Random Processing Times

Processing times for each test phase. Times are in seconds.

### Summary Statistics

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Total | 284.8s | 704.6s | 5.4s | 212.4s | 541.1s | 648.9s |
| Average | 4.4s | 11.0s | 0.1s | 3.3s | 9.7s | 11.6s |
| Max | 27.0s | 67.6s | 0.1s | 20.8s | 23.7s | 23.7s |
| Min | 2.8s | 5.5s | 0.1s | 2.4s | 5.5s | 5.5s |

### Slowest and Fastest Games

| Metric | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|--------|--------------|------------------|-----------|----------|------------------|-----------|
| Slowest | Subnautica (27.0s) | Kirby's Dream Land 3 (67.6s) | A Link to the Past (0.1s) | The Wind Waker (20.8s) | Dark Souls III (23.7s) | Terraria (23.7s) |
| Fastest | VVVVVV (2.8s) | DLCQuest (5.5s) | Metamath (0.1s) | The Messenger (2.4s) | Undertale (5.5s) | Undertale (5.5s) |

### Individual Game Processing Times

| Game | Original Gen | Original Spoiler | World Gen | Seed Gen | WorldGen Spoiler | Cross-Val |
|------|--------------|------------------|-----------|----------|------------------|-----------|
| A Hat in Time | 6.1s | 15.7s | 0.1s | 3.2s | 13.7s | 13.7s |
| A Link to the Past | 14.4s | 19.3s | 0.1s | 4.8s | 17.7s | 14.4s |
| A Short Hike | 3.3s | 10.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| APQuest | 3.1s | 7.7s | 0.1s | 2.8s | 5.7s | 5.6s |
| Adventure | 3.2s | 9.1s | 0.1s | 2.9s | 5.7s | 14.2s |
| Aquaria | 6.5s | 10.0s | 0.1s | 2.5s | - | - |
| Bumper Stickers | 3.0s | 9.8s | 0.1s | 2.8s | 8.6s | 14.2s |
| Castlevania - Circle of the Moon | 3.3s | 7.3s | 0.1s | 2.9s | 5.7s | 14.3s |
| Castlevania 64 | 3.6s | 7.8s | 0.1s | 2.9s | 6.5s | 6.5s |
| Celeste (Open World) | 4.5s | 16.0s | 0.1s | 4.0s | 14.7s | 14.5s |
| Celeste 64 | 3.1s | 6.7s | 0.1s | 3.0s | 7.7s | 14.4s |
| ChecksFinder | 2.8s | 6.8s | 0.1s | 2.8s | 6.6s | 6.6s |
| ChocolateChipCookies | 2.8s | 5.7s | 0.1s | 2.9s | 5.7s | 14.2s |
| Choo-Choo Charles | 3.0s | 10.7s | 0.1s | 2.9s | 10.7s | 9.7s |
| Civilization VI | 3.0s | 8.7s | 0.1s | 2.6s | - | - |
| DLCQuest | 3.0s | 5.5s | 0.1s | 2.9s | 5.5s | 5.5s |
| DOOM 1993 | 3.3s | 12.7s | 0.1s | 2.9s | 12.7s | 14.3s |
| DOOM II | 3.4s | 14.7s | 0.1s | 3.0s | 15.7s | 14.4s |
| Dark Souls III | 5.0s | 24.7s | 0.1s | 3.2s | 23.7s | 17.2s |
| Donkey Kong Country 3 | 3.0s | 13.6s | 0.1s | 2.8s | 13.7s | 14.8s |
| Factorio | 3.8s | 9.7s | 0.1s | 3.0s | 9.7s | 9.7s |
| Faxanadu | 2.9s | 6.6s | 0.1s | 2.9s | 8.6s | 14.3s |
| Final Fantasy Mystic Quest | 4.2s | 10.7s | 0.1s | 3.1s | 10.7s | 10.7s |
| Heretic | 3.4s | 14.8s | 0.1s | 3.2s | 14.8s | 14.5s |
| Hylics 2 | 3.9s | 6.7s | 0.1s | 3.1s | 6.7s | 6.7s |
| Inscryption | 2.9s | 6.5s | 0.1s | 2.8s | 6.6s | 6.5s |
| Kirby's Dream Land 3 | 4.6s | 67.6s | 0.1s | 2.5s | - | - |
| Landstalker - The Treasures of King Nole | 3.2s | 8.6s | 0.1s | 3.1s | 17.8s | 14.4s |
| Links Awakening DX | 5.1s | 17.6s | 0.1s | 3.3s | 17.6s | 17.6s |
| Lufia II Ancient Cave | 3.0s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Mario & Luigi Superstar Saga | 3.9s | 9.7s | 0.1s | 4.2s | 9.7s | 9.7s |
| MathProof2p2e4 | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 14.2s |
| Mega Man 2 | 3.0s | 6.7s | 0.1s | 2.9s | 6.7s | 6.7s |
| MegaMan Battle Network 3 | 3.1s | 8.7s | 0.1s | 3.0s | 8.7s | 17.5s |
| Meritous | 3.0s | 5.7s | 0.1s | 2.9s | 5.6s | 14.3s |
| Metamath | 10.3s | 5.5s | 0.1s | 2.7s | 5.5s | 5.5s |
| Muse Dash | 3.1s | 7.7s | 0.1s | 2.9s | 9.7s | 14.3s |
| Noita | 2.9s | 5.6s | 0.1s | 2.9s | 5.7s | 5.7s |
| Old School Runescape | 4.6s | 8.5s | 0.1s | 3.0s | 8.5s | 8.6s |
| Overcooked! 2 | 3.1s | 20.7s | 0.1s | 2.5s | - | - |
| Paint | 2.9s | 6.7s | 0.1s | 3.0s | 6.6s | 6.7s |
| Risk of Rain 2 | 3.3s | 6.7s | 0.1s | 2.9s | 6.7s | 6.6s |
| Saving Princess | 3.0s | 5.6s | 0.1s | 2.9s | 6.7s | 14.3s |
| Shivers | 3.3s | 9.7s | 0.1s | 3.1s | 9.7s | 14.4s |
| Sonic Adventure 2 Battle | 4.5s | 13.7s | 0.1s | 3.1s | 16.8s | 14.7s |
| Starcraft 2 | 6.9s | 25.7s | 0.1s | 2.4s | - | - |
| Subnautica | 27.0s | 14.7s | 0.1s | 5.9s | 14.7s | 18.0s |
| Super Mario 64 | 3.0s | 12.7s | 0.1s | 3.0s | 12.7s | 12.7s |
| Super Mario Land 2 | 4.0s | 8.6s | 0.1s | 2.5s | - | - |
| Super Mario World | 4.2s | 6.6s | 0.1s | 2.8s | 6.6s | 6.6s |
| TOEM original | 3.0s | 8.7s | 0.1s | 2.9s | 9.7s | 9.7s |
| TOEM rule builder | 2.9s | 8.7s | 0.1s | 2.8s | 8.7s | 8.6s |
| TUNIC | 5.9s | 12.7s | 0.1s | 2.6s | - | - |
| Terraria | 3.2s | 19.8s | 0.1s | 3.0s | 19.8s | 23.7s |
| The Legend of Zelda | 4.4s | 8.7s | 0.1s | 3.2s | 10.7s | 14.5s |
| The Messenger | 3.1s | 13.7s | 0.1s | 2.4s | - | - |
| The Wind Waker | 15.8s | 9.6s | 0.1s | 20.8s | 9.8s | 14.3s |
| Timespinner | 3.9s | 7.7s | 0.1s | 3.1s | 6.7s | 14.5s |
| Undertale | 3.1s | 5.5s | 0.1s | 2.9s | 5.5s | 5.5s |
| VVVVVV | 2.8s | 5.6s | 0.1s | 2.8s | 5.6s | 5.6s |
| Wargroove | 3.0s | 6.6s | 0.1s | 3.0s | 6.7s | 6.7s |
| WebDevJourney | 2.9s | 8.6s | 0.1s | 2.9s | 8.7s | 14.2s |
| Yoshi's Island | 3.9s | 9.7s | 0.1s | 5.6s | 8.7s | 8.7s |
| shapez | 4.4s | 6.6s | 0.1s | 3.0s | 6.7s | 14.5s |

### Top 10 Longest Processing Times

#### Original Generation

| Rank | Game | Time |
|------|------|------|
| 1 | Subnautica | 27.0s |
| 2 | The Wind Waker | 15.8s |
| 3 | A Link to the Past | 14.4s |
| 4 | Metamath | 10.3s |
| 5 | Starcraft 2 | 6.9s |
| 6 | Aquaria | 6.5s |
| 7 | A Hat in Time | 6.1s |
| 8 | TUNIC | 5.9s |
| 9 | Links Awakening DX | 5.1s |
| 10 | Dark Souls III | 5.0s |

#### Original Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Kirby's Dream Land 3 | 67.6s |
| 2 | Starcraft 2 | 25.7s |
| 3 | Dark Souls III | 24.7s |
| 4 | Overcooked! 2 | 20.7s |
| 5 | Terraria | 19.8s |
| 6 | A Link to the Past | 19.3s |
| 7 | Links Awakening DX | 17.6s |
| 8 | Celeste (Open World) | 16.0s |
| 9 | A Hat in Time | 15.7s |
| 10 | Heretic | 14.8s |

#### World Generation

| Rank | Game | Time |
|------|------|------|
| 1 | A Link to the Past | 0.1s |
| 2 | Celeste (Open World) | 0.1s |
| 3 | A Hat in Time | 0.1s |
| 4 | A Short Hike | 0.1s |
| 5 | Castlevania - Circle of the Moon | 0.1s |
| 6 | Starcraft 2 | 0.1s |
| 7 | APQuest | 0.1s |
| 8 | Adventure | 0.1s |
| 9 | Aquaria | 0.1s |
| 10 | Bumper Stickers | 0.1s |

#### Seed Generation

| Rank | Game | Time |
|------|------|------|
| 1 | The Wind Waker | 20.8s |
| 2 | Subnautica | 5.9s |
| 3 | Yoshi's Island | 5.6s |
| 4 | A Link to the Past | 4.8s |
| 5 | Mario & Luigi Superstar Saga | 4.2s |
| 6 | Celeste (Open World) | 4.0s |
| 7 | Links Awakening DX | 3.3s |
| 8 | Heretic | 3.2s |
| 9 | Dark Souls III | 3.2s |
| 10 | A Hat in Time | 3.2s |

#### WorldGen Spoiler Test

| Rank | Game | Time |
|------|------|------|
| 1 | Dark Souls III | 23.7s |
| 2 | Terraria | 19.8s |
| 3 | Landstalker - The Treasures of King Nole | 17.8s |
| 4 | A Link to the Past | 17.7s |
| 5 | Links Awakening DX | 17.6s |
| 6 | Sonic Adventure 2 Battle | 16.8s |
| 7 | DOOM II | 15.7s |
| 8 | Heretic | 14.8s |
| 9 | Celeste (Open World) | 14.7s |
| 10 | Subnautica | 14.7s |

#### Cross-Validation

| Rank | Game | Time |
|------|------|------|
| 1 | Terraria | 23.7s |
| 2 | Subnautica | 18.0s |
| 3 | Links Awakening DX | 17.6s |
| 4 | MegaMan Battle Network 3 | 17.5s |
| 5 | Dark Souls III | 17.2s |
| 6 | Donkey Kong Country 3 | 14.8s |
| 7 | Sonic Adventure 2 Battle | 14.7s |
| 8 | Timespinner | 14.5s |
| 9 | Celeste (Open World) | 14.5s |
| 10 | shapez | 14.5s |
