# World Generator Test Results

**Generated:** 2025-12-05 00:01:02 UTC
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
| Total Templates | 31 |
| Successful Original Generations | 31 |
| Failed Original Generations | 0 |
| Successful Test World Generations | 31 |
| Failed Test World Generations | 0 |
| Cross-Validation Passed | 7 |
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
| Celeste 64 | ✅ | ✅ | ✅ | ❌ | - | - |
| ChecksFinder | ✅ | ✅ | ✅ | ❌ | - | - |
| ChocolateChipCookies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Choo-Choo Charles | ✅ | ✅ | ✅ | ❌ | - | - |
| Civilization VI | ✅ | ✅ | ✅ | ❌ | - | - |
| DLCQuest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOOM 1993 | ✅ | ✅ | ✅ | ❌ | - | - |
| DOOM II | ✅ | ✅ | ✅ | ❌ | - | - |
| Faxanadu | ✅ | ✅ | ✅ | ❌ | - | - |
| Final Fantasy Mystic Quest | ✅ | ✅ | ✅ | ❌ | - | - |
| Heretic | ✅ | ✅ | ✅ | ❌ | - | - |
| Hylics 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Inscryption | ✅ | ✅ | ✅ | ❌ | - | - |
| Landstalker - The Treasures of King Nole | ✅ | ✅ | ✅ | ❌ | - | - |
| Lingo | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MathProof2p2e4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mega Man 2 | ✅ | ✅ | ✅ | ❌ | - | - |
| Meritous | ✅ | ✅ | ✅ | ❌ | - | - |
| Muse Dash | ✅ | ✅ | ✅ | ❌ | - | - |
| Noita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paint | ✅ | ✅ | ✅ | ❌ | - | - |
| Saving Princess | ✅ | ✅ | ✅ | ❌ | - | - |
| WebDevJourney | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Yacht Dice | ✅ | ✅ | ✅ | ❌ | - | - |
| Zillion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Failures

**24 games had errors:**

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

### Celeste 64

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### ChecksFinder

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Choo-Choo Charles

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Civilization VI

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### DOOM 1993

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### DOOM II

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Faxanadu

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Final Fantasy Mystic Quest

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Heretic

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Hylics 2

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Inscryption

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Landstalker - The Treasures of King Nole

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Mega Man 2

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Meritous

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Muse Dash

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Paint

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Saving Princess

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?

### Yacht Dice

- Test world seed generation failed: SyntaxError: invalid syntax. Perhaps you forgot a comma?
