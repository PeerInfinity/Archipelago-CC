# Solved Helper Issues for Kingdom Hearts 1

This document tracks helper issues that have been resolved.

## Solved Issues

### 1. Missing `has_x_worlds` parameter handling
**Issue**: The `has_x_worlds` function only accepted 2 arguments (num_of_worlds, keyblades_unlock_chests) but the Python version takes 4 arguments (num_of_worlds, keyblades_unlock_chests, logic_difficulty, hundred_acre_wood).

**Solution**: Updated the function signature to accept all 4 arguments and added LOGIC_MINIMAL check (returns true if logic_difficulty >= 15).

### 2. Missing `has_emblems` parameter handling
**Issue**: The `has_emblems` function didn't pass the logic_difficulty and hundred_acre_wood arguments to has_x_worlds.

**Solution**: Updated the function to accept and pass through all required arguments.

### 3. Missing `has_parasite_cage` helper
**Issue**: The `has_parasite_cage` helper was blacklisted from export but not implemented in JavaScript.

**Solution**: Implemented the helper matching the Python logic:
- Requires "Monstro" item
- Requires "High Jump" OR (logic_difficulty > 0 AND "Progressive Glide")
- Requires the `worlds` parameter to be true

### 4. Missing `has_key_item` helper
**Issue**: The `has_key_item` helper was blacklisted from export but not implemented in JavaScript.

**Solution**: Implemented the helper with full WORLD_KEY_ITEMS mapping and special case handling for:
- Stacking world items (2x world item = has key item)
- Jack-In-The-Box / Forget-Me-Not Halloween Town bundle
- Crystal Trident keyblade locking special case

### 5. Missing `has_puppies` helper
**Issue**: The `has_puppies` helper was blacklisted from export but not implemented in JavaScript.

**Solution**: Implemented the helper: `(puppyCount * puppy_value) >= puppies_required`

### 6. Missing `has_lucky_emblems` helper
**Issue**: The `has_lucky_emblems` helper was blacklisted from export but not implemented in JavaScript.

**Solution**: Implemented the helper: `emblemCount >= required_amt`

### 7. Missing `has_defensive_tools` parameter handling
**Issue**: The `has_defensive_tools` function didn't accept the logic_difficulty parameter.

**Solution**: Updated the function to accept logic_difficulty and added LOGIC_MINIMAL check.

### 8. Missing `has_final_rest_door` helper
**Issue**: The `has_final_rest_door` helper was blacklisted from export but not implemented in JavaScript.

**Solution**: Implemented the helper with:
- If requirement is "lucky_emblems": check Lucky Emblem count
- Otherwise: check for "Final Door Key" item
