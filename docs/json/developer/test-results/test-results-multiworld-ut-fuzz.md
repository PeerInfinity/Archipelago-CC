# Multiworld UT Fuzz Assembly Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

**Generated:** 2026-01-11 22:54:04

**Source Data Created:** 2026-01-11T22:49:34.992745

**Source Data Last Updated:** 2026-01-11T22:54:01.474136

**Seed Mode:** Fixed (seed=1)

**Runs Per Test:** 1

**Max Players:** 20

**Templates Considered:** 55

## Summary

- **Total Games Tested:** 20
- **Games in Final Multiworld:** 20
- **Games Passed:** 20
- **Games Failed:** 0
- **Games Pending (< 2 players):** 0
- **Games Tested in Second Pass:** 1
- **Rejected Games:** 0

## Final Multiworld Composition

The following 20 games successfully integrate into a multiworld:

| # | World Directory | Game Name |
|:-:|-----------------|----------|
| 1 | shorthike | A Short Hike |
| 2 | apquest | APQuest |
| 3 | adventure | Adventure |
| 4 | aquaria | Aquaria |
| 5 | bakingadventure | Baking Adventure |
| 6 | bumpstik | Bumper Stickers |
| 7 | cvcotm | Castlevania - Circle of the Moon |
| 8 | celeste64 | Celeste 64 |
| 9 | checksfinder | ChecksFinder |
| 10 | cccharles | Choo-Choo Charles |
| 11 | civ_6 | Civilization VI |
| 12 | codingadventure | Coding Adventure |
| 13 | dlcquest | DLCQuest |
| 14 | doom_1993 | DOOM 1993 |
| 15 | doom_ii | DOOM II |
| 16 | dark_souls_3 | Dark Souls III |
| 17 | dkc3 | Donkey Kong Country 3 |
| 18 | factorio | Factorio |
| 19 | faxanadu | Faxanadu |
| 20 | ffmq | Final Fantasy Mystic Quest |

## Test Results

| Game Name | World Dir | Player # | MW Size | Status | Success Rate |
|-----------|-----------|:--------:|:-------:|:------:|:------------:|
| A Short Hike | shorthike | 1 | 20 | ✅ Passed (2nd) | **100%** (1/1) |
| APQuest | apquest | 2 | 2 | ✅ Passed | **100%** (1/1) |
| Adventure | adventure | 3 | 3 | ✅ Passed | **100%** (1/1) |
| Aquaria | aquaria | 4 | 4 | ✅ Passed | **100%** (1/1) |
| Baking Adventure | bakingadventure | 5 | 5 | ✅ Passed | **100%** (1/1) |
| Bumper Stickers | bumpstik | 6 | 6 | ✅ Passed | **100%** (1/1) |
| Castlevania - Circle of the Moon | cvcotm | 7 | 7 | ✅ Passed | **100%** (1/1) |
| Celeste 64 | celeste64 | 8 | 8 | ✅ Passed | **100%** (1/1) |
| ChecksFinder | checksfinder | 9 | 9 | ✅ Passed | **100%** (1/1) |
| Choo-Choo Charles | cccharles | 10 | 10 | ✅ Passed | **100%** (1/1) |
| Civilization VI | civ_6 | 11 | 11 | ✅ Passed | **100%** (1/1) |
| Coding Adventure | codingadventure | 12 | 12 | ✅ Passed | **100%** (1/1) |
| DLCQuest | dlcquest | 13 | 13 | ✅ Passed | **100%** (1/1) |
| DOOM 1993 | doom_1993 | 14 | 14 | ✅ Passed | **100%** (1/1) |
| DOOM II | doom_ii | 15 | 15 | ✅ Passed | **100%** (1/1) |
| Dark Souls III | dark_souls_3 | 16 | 16 | ✅ Passed | **100%** (1/1) |
| Donkey Kong Country 3 | dkc3 | 17 | 17 | ✅ Passed | **100%** (1/1) |
| Factorio | factorio | 18 | 18 | ✅ Passed | **100%** (1/1) |
| Faxanadu | faxanadu | 19 | 19 | ✅ Passed | **100%** (1/1) |
| Final Fantasy Mystic Quest | ffmq | 20 | 20 | ✅ Passed | **100%** (1/1) |
## Notes

- **Player #:** The player number this game was assigned in the multiworld
- **MW Size:** Number of games in the multiworld when tested (may differ from player # due to second pass)
- **Status:**
  - ✅ Passed: All test runs succeeded
  - ✅ Passed (2nd): Passed in second pass (tested with full multiworld)
  - ❌ Failed: One or more test runs failed, game was removed from multiworld
  - ❌ Failed (2nd): Failed in second pass
  - ⏳ Pending: Game added but not tested yet (need 2+ players)
  - ⚠️ Error: Infrastructure error during testing
- **Success Rate:** Percentage of test runs that passed

### About This Test

The Multiworld UT Fuzz Assembly test validates that games can coexist in a multiworld:

1. Games are added one-by-one to a growing multiworld
2. Each game uses randomly generated options (via fuzz.py)
3. After adding a game, the full multiworld is generated multiple times
4. Each player in the multiworld is validated using Universal Tracker
5. If validation fails, the game is removed from the multiworld
6. **Second Pass:** Games added when there were fewer than 2 players are retested with the full multiworld

This test catches issues where certain game combinations or option combinations cause problems in multiworld generation or UT validation.
