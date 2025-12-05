# World Generator Test Results

**Generated:** 2025-12-05 03:30:21 UTC
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
| Total Templates | 7 |
| Successful Original Generations | 7 |
| Failed Original Generations | 0 |
| Successful Test World Generations | 7 |
| Failed Test World Generations | 0 |
| Cross-Validation Passed | 0 |
| Cross-Validation Failed | 0 |

## Detailed Results

| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |
|------|--------------|---------------|-----------|----------|--------------|------------------|
| A Short Hike | ✅ | ✅ | ✅ | ❌ | - | - |
| APQuest | ✅ | ✅ | ✅ | ❌ | - | - |
| Adventure | ✅ | ✅ | ✅ | ❌ | - | - |
| Aquaria | ✅ | ✅ | ✅ | ❌ | - | - |
| Bomb Rush Cyberfunk | ✅ | ✅ | ✅ | ❌ | - | - |
| Bumper Stickers | ✅ | ✅ | ✅ | ❌ | - | - |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ❌ | - | - |

## Failures

**7 games had errors:**

### A Short Hike

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### APQuest

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Adventure

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Aquaria

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Bomb Rush Cyberfunk

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Bumper Stickers

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Choo-Choo Charles

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?
