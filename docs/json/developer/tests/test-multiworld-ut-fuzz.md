# Multiworld UT Fuzz Test

[← Back to Fuzz Tests Overview](./test-fuzz.md) | [View Test Results](../test-results/test-results-multiworld-ut-fuzz.md)

## Overview

The Multiworld UT Fuzz test validates that games can work together in a **multiworld** configuration with **randomized options**. Unlike single-player fuzz tests that test one game at a time, this test builds an increasingly large multiworld by adding games one-by-one and validating the entire multiworld after each addition.

## How It Works

### Assembly Process

1. **Start with an empty multiworld** directory
2. **For each game template:**
   - Generate a random YAML configuration using `fuzz.py`
   - Add the YAML to the multiworld directory
   - Attempt to generate a combined seed with all games
   - Run validation on the generated multiworld
   - If validation passes, keep the game; if it fails, remove it
3. **Track results** for each game tested

### Dual Validation

The test runs **both** validation methods for every test run:

| Mode | What It Checks |
|------|----------------|
| **Sphere Validation** | All locations are reachable with all items collected |
| **UT Validation** | Universal Tracker's logic matches Python's sphere calculations |

A test only passes if **both** validations pass for all players. This catches both:
- Logic bugs where locations are unreachable (sphere validation)
- Mismatches between UT's worldgen-based tracking and Python's logic (UT validation)

## Understanding "Unreachable Locations"

When a test fails with "X unreachable locations" (sphere validation), it means:

1. The multiworld was **successfully generated** (generation succeeded)
2. The validation then collected **all items** in the game
3. Even with all items, **some locations could not be reached**

This is determined by calling `full_state.can_reach(location)` for every location after collecting all items via `multiworld.get_all_state()`.

## Understanding UT Validation Failures

When a test fails with "UT mismatch" or "locations in Python but not UT", it means:

1. The multiworld was **successfully generated**
2. Universal Tracker's worldgen-based logic disagrees with Python's sphere calculations
3. Locations that Python says are in logic are **not in logic according to UT**

This typically indicates issues with rule export/import or differences in how the Rule Builder evaluates conditions.

### What Causes Unreachable Locations?

| Cause | Description |
|-------|-------------|
| **Logic Bug** | Access rules are too restrictive or incorrect |
| **Entrance Randomizer Issues** | Shuffled entrances create unreachable areas |
| **Option Conflicts** | Certain option combinations create impossible configurations |
| **Cross-World Interactions** | Items from other players affect accessibility unexpectedly |

### Example Error

```
Player 1 (Super Mario Land 2): 101 unreachable locations
```

This means Player 1's game (Super Mario Land 2) has 101 locations that cannot be reached even with all items. The validation is checking the Python multiworld's logic, not Universal Tracker.

## Test Results Interpretation

### Status Types

| Status | Meaning |
|--------|---------|
| **✅ Passed** | All validation runs succeeded |
| **❌ Failed** | One or more validation failures occurred |
| **🔴 All Gen Failed** | All generation attempts failed (couldn't even generate the multiworld) |
| **⏳ Pending** | Game added but not yet tested (need 2+ players) |
| **⚠️ Error** | Infrastructure error during testing |

### Success Rate Breakdown

The success rate shows: `X% (success/total, Y gen fail)`

- **success**: Runs where generation AND validation both succeeded
- **total**: Total number of test runs attempted
- **gen fail**: Runs where generation failed (option-related errors, timeouts)

Example: `67% (2/3, 1 gen fail)` means:
- 3 total runs
- 1 run had a generation failure (e.g., timeout or option conflict)
- 2 runs generated successfully
- Both successful generations passed validation
- Result: 2/3 = 67% success rate

### Generation Failures vs Validation Failures

| Type | When It Occurs | Counted As |
|------|----------------|------------|
| **Generation Failure** | Seed couldn't be generated (timeout, option conflict, fill error) | Tracked separately, doesn't count as test failure |
| **Validation Failure** | Seed generated but locations are unreachable | Counts as test failure |

Generation failures are often caused by:
- Option combinations that create impossible fills
- Timeouts during complex generation
- Game-specific validation errors

These are tracked separately because they indicate option incompatibility, not logic bugs.

## Player Attribution

When a validation failure occurs, the error shows which **player** failed:

```
Players failed: 1
  - Player 1: Player 1 (Super Mario Land 2): 9 unreachable locations
```

**Important:** The failure is attributed to the **newly added game**, even if a different player in the multiworld actually failed. This is because adding a new game changes the item distribution and can affect other games' accessibility.

For example:
- Testing "TOEM original" (newly added as Player 10)
- Player 1 "Super Mario Land 2" fails validation
- The test marks "TOEM original" as failed

This happens because:
1. Adding TOEM original changed how items are distributed across the multiworld
2. This redistribution may have moved critical items away from Super Mario Land 2
3. The specific random option combination created an incompatible configuration

## Running the Test

### Basic Usage

```bash
# Run with default settings (3 runs per game, seed=1)
python scripts/test/test-multiworld-ut-fuzz.py

# Custom number of runs
python scripts/test/test-multiworld-ut-fuzz.py --runs 5

# Custom seed
python scripts/test/test-multiworld-ut-fuzz.py --seed 42

# Longer timeout for slow games
python scripts/test/test-multiworld-ut-fuzz.py --timeout 120
```

### Output

Results are saved to:
- `scripts/output/multiworld-ut-fuzz/test-results-fixed-seed.json` (seed=1)
- `scripts/output/multiworld-ut-fuzz/test-results-random-seed.json` (random seeds)

The markdown report is generated at:
- `docs/json/developer/test-results/test-results-multiworld-ut-fuzz.md`

## Files and Components

| Component | Path |
|-----------|------|
| Test script | `scripts/test/test-multiworld-ut-fuzz.py` |
| Fuzzer hook | `worlds/tracker/fuzzer_hook.py` |
| Results JSON | `scripts/output/multiworld-ut-fuzz/` |
| Chart generator | `scripts/docs/generate_multiworld_ut_fuzz_chart.py` |
| Results markdown | `docs/json/developer/test-results/test-results-multiworld-ut-fuzz.md` |

## Ignored Error Patterns

Certain generation errors are "ignored" (not counted as failures) because they're expected from random option combinations:

- Fill errors: "Not enough filler/trap items", "No more spots to place"
- Pool errors: "Failed to limit item pool size", "Too many locations created"
- Game-specific: "Invalid OC2 settings", "OC2 needs at least"
- Option conflicts: "You cannot make bosses required when progression dungeons are disabled"

See `IGNORED_ERROR_PATTERNS` in `worlds/tracker/fuzzer_hook.py` for the full list.

## Relationship to Other Tests

| Test | Single-Player | Multi-Player | Random Options |
|------|:-------------:|:------------:|:--------------:|
| Spoiler Test | ✅ | ❌ | ❌ |
| UT Fuzz Test | ✅ | ❌ | ✅ |
| **Multiworld UT Fuzz** | ❌ | ✅ | ✅ |
| Multiclient Test | ❌ | ✅ | ❌ |

The Multiworld UT Fuzz test is unique in testing both multiworld compatibility AND random option combinations together.

## Related Documentation

- [Fuzz Tests Overview](./test-fuzz.md) - General fuzz testing concepts
- [Universal Tracker Modifications](../diffs/universal-tracker-modifications.md) - UT implementation details
- [Fuzzer Debugging Guide](../guides/fuzzer-debugging.md) - Debugging fuzz test failures
