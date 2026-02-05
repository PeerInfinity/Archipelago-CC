# Fuzz Tests

[← Back to Test Results Summary](../test-results/test-results-summary.md)

## Overview

Fuzz tests validate that games work correctly with **randomized option configurations**, not just default settings. They catch option-dependent bugs that wouldn't be found with standard tests.

Unlike the regular spoiler tests (which use default template settings), fuzz tests:
1. Generate **random values** for all game options
2. Run tests with these randomized configurations
3. Repeat multiple times (typically 10 runs per game)
4. Track pass rates to identify which games have option-sensitive issues

## Types of Fuzz Tests

| Test | What It Tests | Test Results |
|------|---------------|--------------|
| **UT Fuzz (Original)** | Universal Tracker logic against Python sphere calculations | [View](../test-results/test-results-ut-fuzz-original.md) |
| **UT Fuzz (Worldgen)** | Worldgen UT (regenerates world from rules.json) | [View](../test-results/test-results-ut-fuzz-worldgen.md) |
| **UT Fuzz (Hybrid)** | Worldgen UT preferring native support | [View](../test-results/test-results-ut-fuzz-hybrid.md) |
| **UT Fuzz (Pickle)** | Pickle-based UT (loads serialized multiworld) | [View](../test-results/test-results-ut-fuzz-pickle.md) |
| **Spoiler Fuzz** | Frontend spoiler playthrough | [View](../test-results/test-results-spoiler-fuzz.md) |
| **Multiworld UT Fuzz** | Multiworld assembly with UT validation | [View](../test-results/test-results-multiworld-ut-fuzz.md) |

## UT Fuzz Tests

UT Fuzz tests compare **Universal Tracker's** logic calculations against **Python's sphere calculations** during seed generation.

### What Is Universal Tracker?

Universal Tracker (UT) is a client that tracks game completion progress without playing the actual game. It determines which locations are **in logic** (accessible based on collected items) by creating an **internal multiworld** and syncing it with the real multiworld on the server.

This is the same logic calculation that Archipelago's Python code performs during seed generation. The UT Fuzz test validates that UT's logic matches Python's by:

1. Generating a seed with random options
2. Iterating through each sphere from the Python multiworld (via `get_sendable_spheres()`)
3. At each sphere, having UT calculate what's in logic (via `updateTracker()`)
4. Comparing the locations Python says are in this sphere with what UT says is in logic

### Known Gaps in UT

UT has a fundamental limitation: if a game has **randomness in logic** that isn't solely tied to items (e.g., random starting location, entrance randomizer, random goals), UT's internal multiworld may be desynced from the real one. Games can address this by implementing `interpret_slot_data` or `re_gen_passthrough` hooks to pass the randomized results to UT.

### UT Versions

There are four versions of Universal Tracker tested:

| Version | Description |
|---------|-------------|
| **Original** | The original UT from [FarisTheAncient/Archipelago](https://github.com/FarisTheAncient/Archipelago). Uses each game's native integration (if available) to determine what's in logic. |
| **Worldgen** | Uses worldgen-based tracking for all worlds. Generates a temporary worldgen world from the rules.json and uses it for logic calculations. |
| **Hybrid** | Prefers native game support when available, falling back to worldgen-based tracking otherwise. Best of both worlds. |
| **Pickle** | Loads the multiworld directly from a pickle file. Fastest mode - preserves exact lambdas without regeneration or AST conversion. Requires `dill` library. |

### Why Test Multiple Versions?

- **Original** tests games' native UT integration
- **Worldgen** tests the worldgen/JSON export path
- **Hybrid** tests the production configuration
- **Pickle** tests direct multiworld serialization (fastest, preserves exact rules)

Comparing results between versions helps identify:
- Games that work better with native vs worldgen tracking
- Issues specific to the worldgen export process
- Games that need custom handling
- Differences between pickle (exact lambdas) vs worldgen (AST-converted rules)

## Spoiler Fuzz Test

The Spoiler Fuzz test runs the **frontend spoiler playthrough** with randomized option configurations.

### How It Works

1. Generate random YAML configuration for a game
2. Run `Generate.py` to create a seed
3. Run the frontend spoiler test (`npm test -- --mode=test-spoilers`)
4. Track whether the game is completable
5. Repeat 10 times per game

### What It Tests

- The **exporter** handles various option combinations
- The **frontend Rule Builder** evaluates rules correctly with different options
- Games are **completable** regardless of option settings

## Multiworld UT Fuzz Test

Tests multiworld assembly by incrementally adding games that passed single-player UT fuzz tests.

### How It Works

1. Start with games that passed single-player UT fuzz
2. For each game:
   - Generate a random YAML configuration
   - Add it to the multiworld
   - Generate the combined seed
   - Validate using UT
   - Keep the game if it passes, remove if it fails
3. Track which games successfully integrated

### What It Tests

- Games work correctly in **multiworld** with random options
- Random option combinations are **compatible** across games
- UT validation works for **multi-player** seeds

## Understanding Results

### Pass Rates

| Symbol | Meaning |
|--------|---------|
| ✅ | 100% pass rate (all runs succeeded) |
| ⚠️ X% | 90-99% pass rate (most runs succeeded) |
| 🔶 X% | 50-89% pass rate (some failures) |
| ❌ X% | <50% pass rate (most runs failed) |
| — | No test results (game not tested or export unavailable) |

### Failure Types

| Type | Description |
|------|-------------|
| **Gen Fail** | Seed generation failed with the random options |
| **Test Fail** | Test failed (UT mismatch or spoiler test failure) |
| **Timeout** | Test exceeded time limit |
| **Ignored** | Run was ignored (e.g., option combination not applicable) |

## Running Fuzz Tests

### UT Fuzz Test

```bash
# Test all games with 10 runs each (worldgen UT)
python scripts/test/test-all-ut-fuzz.py --runs 10

# Test specific game
python scripts/test/test-all-ut-fuzz.py --runs 10 --include-list Adventure.yaml

# Test with original UT
python scripts/test/test-all-ut-fuzz.py --runs 10 --ut-version original

# Test with hybrid UT (prefer native support)
python scripts/test/test-all-ut-fuzz.py --runs 10 --prefer-native-ut

# Test with pickle-based UT (fastest, preserves exact lambdas)
python scripts/test/test-all-ut-fuzz.py --runs 10 --ut-version pickle
```

### Spoiler Fuzz Test

```bash
# Test all games with 10 runs each
python scripts/test/test-all-spoiler-fuzz.py --runs 10

# Test specific game
python scripts/test/test-all-spoiler-fuzz.py --runs 10 --include-list Adventure.yaml
```

### Multiworld UT Fuzz Test

```bash
# Test multiworld assembly
python scripts/test/test-multiworld-ut-fuzz.py --runs 5
```

## Files and Directories

| Item | Path |
|------|------|
| UT Fuzz test script | `scripts/test/test-all-ut-fuzz.py` |
| Spoiler Fuzz test script | `scripts/test/test-all-spoiler-fuzz.py` |
| Multiworld UT Fuzz script | `scripts/test/test-multiworld-ut-fuzz.py` |
| Fuzzer core | `fuzz.py` |
| UT Fuzzer hook | `worlds/tracker/fuzzer_hook.py` |
| UT Fuzz results | `scripts/output/ut-fuzz/` |
| Spoiler Fuzz results | `scripts/output/spoiler-fuzz/` |
| Universal Tracker | `worlds/tracker/` |

## Relationship to Other Tests

| Test | Uses Default Options | Uses Random Options |
|------|---------------------|---------------------|
| Spoiler Test | ✅ | ❌ |
| Multiclient Test | ✅ | ❌ |
| Multiworld Test | ✅ | ❌ |
| **Spoiler Fuzz** | ❌ | ✅ |
| **UT Fuzz** | ❌ | ✅ |

The fuzz tests complement the standard tests by covering the option space that default-only tests miss.

## Related Documentation

- [Spoiler Tests](./test-spoilers.md) - Standard spoiler tests with default options
- [Fuzzer Modifications](../diffs/fuzzer-modifications.md) - Changes to the fuzzer for this fork
- [Universal Tracker Modifications](../diffs/universal-tracker-modifications.md) - UT changes for this fork
- [Template Types](./template-types.md) - Original vs WorldGen templates
