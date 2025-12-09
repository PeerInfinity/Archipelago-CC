# Exporting Helper Functions as Rule Definitions

This guide explains how to minimize custom JavaScript code for game exporters by exporting helper function definitions to `rules.json` instead of requiring frontend JavaScript implementations.

## Overview

Many games use helper functions in their access rules (e.g., `can_cut_half`, `has_sword`). Previously, each helper required a corresponding JavaScript implementation in the frontend. With automatic helper export, the Python analyzer extracts helper function logic and exports it as rule definitions that the frontend can evaluate directly.

## How It Works

1. **During rule analysis**: When the analyzer encounters a helper function call, it registers the helper name and automatically detects its module path
2. **After analysis**: The exporter analyzes each registered helper function and converts it to a rule structure
3. **In rules.json**: Helper definitions are stored in the `helpers` section, keyed by player ID
4. **At runtime**: The frontend rule engine looks up helper definitions before falling back to JavaScript

## Testing Helper Export

To test helper export for a specific game, generate a multiworld and check the output:

```bash
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/shapez.yaml" --multi 1 --seed 1
```

Replace `shapez.yaml` with the template file for your game. The generated `rules.json` will contain the exported helper definitions.

## Configuring a Game Exporter

### Step 1: Enable Automatic Export

Set `AUTO_EXPORT_DISCOVERED_HELPERS = True` to export discovered helpers:

```python
class MyGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'mygame'

    # Enable automatic helper export (defaults to False)
    AUTO_EXPORT_DISCOVERED_HELPERS = True
```

Module paths (`HELPER_MODULES` and `ITEM_NAME_MODULES`) are automatically detected during rule analysis. When the analyzer encounters a helper function call, it extracts the module path from the function object. You only need to specify these manually if helpers are defined in modules not referenced during normal rule analysis.

### Step 2: Blacklist Complex Helpers

Some helpers are too complex to analyze (loops, closures, dynamic logic). Add them to the blacklist:

```python
HELPERS_TO_EXPORT_BLACKLIST = {
    'complex_helper_with_loops',      # Has for/while loops
    'helper_with_closures',           # Uses closure variables
    'dynamic_helper',                 # Logic depends on runtime data
}
```

These helpers will remain as helper calls in the rules, requiring JavaScript implementations.

### Step 3: Export Required Settings (If Needed)

If a helper uses settings/options that aren't already exported, override `get_settings_data`:

```python
def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
    settings = super().get_settings_data(world, multiworld, player)

    # Add game-specific settings used by helpers
    settings['my_option'] = world.options.my_option.value

    return settings
```

The frontend resolves `name` nodes from settings when evaluating helper definitions.

## What Helpers Can Be Exported

Helpers that work well:
- Simple item checks: `return state.has("Sword", player)`
- Multiple item checks: `return state.has_any(("Sword", "Axe"), player)`
- Boolean combinations: `return has_sword() and has_shield()`
- Conditional logic: `return can_attack() if settings.hard_mode else True`
- Nested helper calls: `return can_fight() and can_swim()`

Helpers that need blacklisting:
- **Loops**: `for item in items: if state.has(item)...`
- **Complex math**: Float calculations, counters with non-trivial logic
- **Closure variables**: Helpers that capture variables from their call site
- **Dynamic data**: Logic that depends on runtime state beyond items/settings

## Frontend Requirements

The frontend infrastructure is already set up. When you enable helper export:

1. Helper definitions are stored in `rules.json` under `helpers[playerId][helperName]`
2. The rule engine checks for definitions before calling JavaScript
3. Settings are available for resolving `name` nodes in helper definitions

### Removing JavaScript Helpers

After enabling export, you can remove JavaScript helper implementations that are now exported. Keep only:

1. **Blacklisted helpers** - These still need JavaScript
2. **Utility functions** - `has`, `has_any`, `has_all`, `count` (used by blacklisted helpers)
3. **Dependencies of blacklisted helpers** - Any helpers called directly by blacklisted ones

Example of what to keep vs remove for shapez:

**Removed** (now in rules.json):
- `can_make_stitched_shape`
- `can_build_mam`
- `can_make_east_windmill`
- `can_make_half_half_shape`
- `can_make_half_shape`

**Kept** (blacklisted or dependencies):
- `has_x_belt_multiplier` - Blacklisted (has loops)
- `has_logic_list_building` - Blacklisted (uses closures)
- `can_cut_half`, `can_stack`, etc. - Called by `has_logic_list_building`

## Testing Procedure

Follow this iterative procedure when enabling helper export for a game:

### Step 1: Establish Baseline (Before Changes)

First, confirm tests pass with the existing implementation:

```bash
# Generate multiworld with current code
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/GameName.yaml" --multi 1 --seed 1

# Run spoiler test to confirm baseline passes
npm test -- --mode=test-spoilers --game=gamename --seed=1
```

If the baseline test fails, fix those issues before proceeding.

### Step 2: Make Experimental Changes

Enable helper export in the game's exporter:

```python
AUTO_EXPORT_DISCOVERED_HELPERS = True
```

### Step 3: Test Changes

Regenerate and run tests:

```bash
# Regenerate with helper export enabled
python Generate.py --weights_file_path "Templates/GameName.yaml" --multi 1 --seed 1

# Run spoiler test
npm test -- --mode=test-spoilers --game=gamename --seed=1
```

### Step 4: Iterate

If tests fail:
1. Check which helpers caused mismatches
2. Add problematic helpers to `HELPERS_TO_EXPORT_BLACKLIST`
3. Re-run tests
4. Repeat until tests pass

### Step 5: Remove JavaScript Helpers

Only after tests pass:
1. Remove or simplify the game's `helpers.js` file
2. Keep only blacklisted helpers and their dependencies
3. Run tests again to confirm

### Step 6: Commit

Only commit when all tests pass. Never commit failing changes.

## Example: Complete Configuration

```python
from typing import Dict, Any
from .generic import GenericGameExportHandler


class MyGameExportHandler(GenericGameExportHandler):
    """Export handler for My Game."""
    GAME_NAME = 'mygame'

    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Helpers too complex for automatic export
    HELPERS_TO_EXPORT_BLACKLIST = {
        'count_keys_in_dungeon',   # Has counting loop
        'check_sequence',          # Uses closure from call site
    }

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export settings used by helpers."""
        settings = super().get_settings_data(world, multiworld, player)

        # Add settings referenced by helpers
        settings['hard_mode'] = world.options.hard_mode.value
        settings['key_shuffle'] = world.options.key_shuffle.value

        return settings
```

Note: `HELPER_MODULES` and `ITEM_NAME_MODULES` are omitted because they are automatically detected. Only specify them if helpers are in modules not referenced during rule analysis.

## Default Settings

The base class (`BaseGameExportHandler`) defines these defaults:

```python
# Module paths - empty by default (auto-detected during analysis)
HELPER_MODULES: List[str] = []
ITEM_NAME_MODULES: List[str] = []

# Auto-export configuration
AUTO_EXPORT_DISCOVERED_HELPERS: bool = False  # Must enable explicitly
HELPERS_TO_EXPORT_WHITELIST: Set[str] = set()  # Manual whitelist (always exported)
HELPERS_TO_EXPORT_BLACKLIST: Set[str] = set()  # Manual blacklist (never exported)

# Helper preservation
HELPERS_TO_PRESERVE: Set[str] = set()        # Preserve as helper calls
AUTO_PRESERVE_LARGE_HELPERS: bool = False    # Auto-preserve large helpers
HELPER_INLINE_THRESHOLD: int = 0             # Node count threshold

# Computed settings - game-specific option mappings
COMPUTED_SETTINGS: Dict[str, Callable] = {}
```

## Success Stories

The following games have successfully removed their custom JavaScript helper files entirely by using automatic helper export:

- **shapez** - Complex shape-building logic now fully exported
- **Adventure** - Classic Atari game rules exported
- **Bumper Stickers** - Puzzle game logic exported
- **ChecksFinder** - All rules exported
- **DOOM 1993** - FPS game logic exported
- **DOOM II** - FPS game logic exported
- **Donkey Kong Country 3** - Platformer rules exported
- **Faxanadu** - Action RPG rules exported
- **Metamath** - Mathematical puzzle logic exported
- **Super Mario World** - Platformer rules exported

These games now use `GenericGameExportHandler` with minimal or no customization. The frontend evaluates all rules directly from `rules.json` without needing game-specific JavaScript logic.

**Benefits achieved:**
- Removed maintenance burden of keeping Python and JavaScript in sync
- Automatic discovery of helpers eliminates manual module configuration
- Frontend rule evaluation is consistent with Python logic
- New helpers are automatically exported without code changes

## Troubleshooting

### "Helper function X NOT FOUND in snapshotInterface"
The helper definition lookup failed. Check:
1. Is `AUTO_EXPORT_DISCOVERED_HELPERS = True`?
2. Is the helper called during rule analysis? (auto-detection requires the helper to be referenced)
3. Is it blacklisted? (should be if complex)
4. Is `helpers` in `getStaticGameData()` in statePersistence.js?

### Mismatch between Python and frontend
The helper evaluates differently. Common causes:
1. Helper uses unresolved variables - add to settings export
2. Helper has complex logic - add to blacklist
3. Nested helper not exported - check if inner helper is in modules

### Helper uses ITEMS.sword but item name not resolved
Add the module containing item constants to `ITEM_NAME_MODULES`.

## File Locations

- **Base handler**: `exporter/games/base.py` - Core helper export infrastructure
- **Game exporter**: `exporter/games/<game>.py` - Game-specific configuration
- **Frontend helpers**: `frontend/modules/shared/gameLogic/<game>/helpers.js`
- **Rule engine**: `frontend/modules/shared/ruleEngine.js` - Helper definition lookup
- **State interface**: `frontend/modules/shared/stateInterface.js` - getStaticData()
- **State persistence**: `frontend/modules/stateManager/core/statePersistence.js` - getStaticGameData()
