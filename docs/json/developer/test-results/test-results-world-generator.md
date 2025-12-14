# World Generator Test Results

**Generated:** 2025-12-14 20:12:18 UTC
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
| Total Templates | 1 |
| Successful Original Generations | 1 |
| Failed Original Generations | 0 |
| Successful Test World Generations | 1 |
| Failed Test World Generations | 0 |
| Successful Test Seed Generations | 1 |
| Failed Test Seed Generations | 0 |
| Cross-Validation Passed | 1 |
| Cross-Validation Failed | 0 |

## Canonical Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# Random Mode Results

Tests run with standard randomized item placement.

## Random Summary

| Metric | Count |
|--------|-------|
| Total Templates | 1 |
| Successful Original Generations | 1 |
| Failed Original Generations | 0 |
| Successful Test World Generations | 1 |
| Failed Test World Generations | 0 |
| Successful Test Seed Generations | 1 |
| Failed Test Seed Generations | 0 |
| Cross-Validation Passed | 0 |
| Cross-Validation Failed | 1 |

## Random Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | Error |
