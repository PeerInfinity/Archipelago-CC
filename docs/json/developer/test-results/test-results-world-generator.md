# World Generator Test Results

**Generated:** 2025-12-04 23:42:59 UTC
**Seed:** N/A

This report shows the results of round-trip testing the world generator.
Each game's rules.json is converted to a `_test` world, and the generated
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
- **World Gen**: World generator created _test world from rules.json
- **Test Gen**: _test world seed generation
- **Test Spoiler**: Spoiler test on _test world
- **Cross-Validation**: Original sphere log validates against _test world

## Summary

| Metric | Count |
|--------|-------|
| Total Templates | 1 |
| Successful Original Generations | 1 |
| Failed Original Generations | 0 |
| Successful Test World Generations | 1 |
| Failed Test World Generations | 0 |
| Cross-Validation Passed | 1 |
| Cross-Validation Failed | 0 |

## Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Failures

No failures recorded.
