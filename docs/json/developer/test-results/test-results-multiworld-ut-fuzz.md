# Multiworld UT Fuzz Assembly Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[📖 Learn about this test](../tests/test-multiworld-ut-fuzz.md)

**Generated:** 2026-02-06 03:29:20

**Source Data Created:** 2026-02-06T03:29:14.367374

**Source Data Last Updated:** 2026-02-06T03:29:18.978475

**Seed Mode:** Fixed (seed=1)

**Runs Per Test:** 3

**Max Players:** 10

**Templates Considered:** 2

## Summary

- **Total Games Tested:** 2
- **Games Passed:** 2
- **Games Failed:** 0
- **Games Pending (< 2 players):** 0
- **Rejected Games:** 0

## Test Results

| Game Name | World Dir | Player # | MW Size | Status | Success Rate |
|-----------|-----------|:--------:|:-------:|:------:|:------------:|
| Adventure | adventure | 1 | 2 | ✅ Passed | **100%** (3/3) |
| Dark Souls III | dark_souls_3 | 2 | 2 | ✅ Passed | **100%** (3/3) |

## Successfully Integrated Games

The following 2 games successfully integrate into a multiworld:

| # | World Directory | Game Name |
|:-:|-----------------|----------|
| 1 | adventure | Adventure |
| 2 | dark_souls_3 | Dark Souls III |

## Notes

- **Player #:** The player number this game was assigned in the multiworld
- **MW Size:** Number of games in the multiworld when tested (may differ from player # due to second pass)
- **Status:**
  - ✅ Passed: All test runs succeeded
  - ✅ Passed (2nd): Passed in second pass (tested with full multiworld)
  - ❌ Failed: One or more validation failures (generation succeeded but validation failed)
  - ❌ Failed (2nd): Failed in second pass
  - 🔴 All Gen Failed: All generation attempts failed (could not generate multiworld)
  - ⏳ Pending: Game added but not tested yet (need 2+ players)
  - ⚠️ Error: Infrastructure error during testing
- **Success Rate:** Percentage of test runs that passed

### About This Test

The Multiworld UT Fuzz Assembly test validates that games can coexist in a multiworld:

1. Games are added one-by-one to a growing multiworld
2. Each game uses randomly generated options (via fuzz.py)
3. After adding a game, the full multiworld is generated multiple times
4. Each player's victory condition is validated (can the game be completed?)
5. If a player's victory condition fails, the game is removed from the multiworld
6. **Second Pass:** Games added when there were fewer than 2 players are retested with the full multiworld

This test catches issues where certain game combinations or option combinations cause problems in multiworld generation or sphere validation.
