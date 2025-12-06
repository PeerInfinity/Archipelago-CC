# Exporting Helper Functions as Rule Definitions

This guide explains how to minimize custom JavaScript code for game exporters by exporting helper function definitions to `rules.json` instead of requiring frontend JavaScript implementations.

## Overview

Many games use helper functions in their access rules (e.g., `can_cut_half`, `has_sword`). Previously, each helper required a corresponding JavaScript implementation in the frontend. With automatic helper export, the Python analyzer extracts helper function logic and exports it as rule definitions that the frontend can evaluate directly.

## How It Works

1. **During rule analysis**: When the analyzer encounters a helper function call, it registers the helper name
2. **After analysis**: The exporter analyzes each registered helper function and converts it to a rule structure
3. **In rules.json**: Helper definitions are stored in the `helpers` section, keyed by player ID
4. **At runtime**: The frontend rule engine looks up helper definitions before falling back to JavaScript

## Configuring a Game Exporter

### Step 1: Set Module Paths

In your game's exporter class, specify where to find helper functions and item name constants:

```python
class MyGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'mygame'

    # Module paths containing helper functions
    HELPER_MODULES = ['worlds.mygame.regions']

    # Module paths containing item name classes (e.g., ITEMS.sword)
    ITEM_NAME_MODULES = ['worlds.mygame.data.strings']
```

### Step 2: Enable Automatic Export

Set `AUTO_EXPORT_DISCOVERED_HELPERS = True` to export discovered helpers:

```python
class MyGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'mygame'
    HELPER_MODULES = ['worlds.mygame.regions']
    ITEM_NAME_MODULES = ['worlds.mygame.data.strings']

    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
```

### Step 3: Blacklist Complex Helpers

Some helpers are too complex to analyze (loops, closures, dynamic logic). Add them to the blacklist:

```python
HELPERS_TO_EXPORT_BLACKLIST = {
    'complex_helper_with_loops',      # Has for/while loops
    'helper_with_closures',           # Uses closure variables
    'dynamic_helper',                 # Logic depends on runtime data
}
```

These helpers will remain as helper calls in the rules, requiring JavaScript implementations.

### Step 4: Export Required Settings (If Needed)

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

## Testing

After enabling helper export:

1. Regenerate the game's preset files
2. Run the spoiler test: `npm test --mode=test-spoilers --game=mygame --seed=1`
3. Check for mismatches between Python and frontend evaluation
4. If helpers fail, add them to the blacklist and keep their JavaScript

## Example: Complete Configuration

```python
from typing import Dict, Any
from .generic import GenericGameExportHandler


class MyGameExportHandler(GenericGameExportHandler):
    """Export handler for My Game."""
    GAME_NAME = 'mygame'

    # Where to find helper functions
    HELPER_MODULES = ['worlds.mygame.regions', 'worlds.mygame.rules']

    # Where to find item name constants (ITEMS.sword, etc.)
    ITEM_NAME_MODULES = ['worlds.mygame.data.items']

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

## Troubleshooting

### "Helper function X NOT FOUND in snapshotInterface"
The helper definition lookup failed. Check:
1. Is `AUTO_EXPORT_DISCOVERED_HELPERS = True`?
2. Is the helper in `HELPER_MODULES`?
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
