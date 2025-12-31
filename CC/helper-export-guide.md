# Exporting Helper Functions as Rule Definitions

This guide explains how to minimize custom JavaScript code for game exporters by exporting helper function definitions to `rules.json` instead of requiring frontend JavaScript implementations.

## Overview

Many games use helper functions in their access rules (e.g., `can_cut_half`, `has_sword`). Previously, each helper required a corresponding JavaScript implementation in the frontend. With automatic helper export, the Python analyzer extracts helper function logic and exports it as rule definitions that the frontend can evaluate directly.

### Goal: Complete Removal

The ultimate goal is to **completely remove** all game-specific files:

1. **Custom exporter** (`exporter/games/<game>.py`) - Delete entirely, letting the system fall back to `GenericGameExportHandler`
2. **JavaScript helpers** (`frontend/modules/shared/gameLogic/<game>/helpers.js`) - Delete entirely
3. **Game logic module** (`frontend/modules/shared/gameLogic/<game>/`) - Delete the entire directory
4. **Registry entry** (`gameLogicRegistry.js`) - Remove the game from the registry

When all four are removed, the game uses only generic infrastructure with rules fully inlined in `rules.json`.

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

### Step 1: Verify Automatic Export Is Enabled

`GenericGameExportHandler` enables automatic helper export by default. You only need to explicitly set this if inheriting from `BaseGameExportHandler`:

```python
class MyGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'mygame'
    # AUTO_EXPORT_DISCOVERED_HELPERS = True  # Already the default!
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

If a helper uses settings/options that aren't already exported, override `get_world_data`:

```python
def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
    world_data = super().get_world_data(world, multiworld, player)

    # Add game-specific settings used by helpers
    world_data['my_option'] = world.options.my_option.value

    return world_data
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
- **Dynamic data**: Logic that depends on runtime state beyond items/settings

### Closure Functions

Closure functions (functions defined inside other functions that capture variables from their scope) are automatically handled:

- **Parameterless closures** (e.g., `def basement_key_rule(state): ...` inside another function): These are analyzed during rule analysis with their captured variables already resolved, and the result is cached for export. The exported definition is "fully resolved" with concrete values.

- **Closures with parameters**: These cannot be cached because different call sites may pass different arguments. They must either be defined at module level (so they can be re-analyzed) or fall back to JavaScript implementations.

## Frontend Requirements

The frontend infrastructure is already set up. When you enable helper export:

1. Helper definitions are stored in `rules.json` under `helpers[playerId][helperName]`
2. The rule engine checks for definitions before calling JavaScript
3. Settings are available for resolving `name` nodes in helper definitions

### Generic `has` and `count` Functions

The generic `has` and `count` functions in `frontend/modules/shared/gameLogic/generic/genericLogic.js` combine patterns from multiple game implementations to work universally:

```javascript
has(snapshot, staticData, itemName) {
  // 1. Check flags (events, checked locations, etc.)
  if (snapshot?.flags?.includes(itemName)) return true;

  // 2. Check events
  if (snapshot?.events?.includes(itemName)) return true;

  // 3. Check inventory
  if (snapshot?.inventory?.[itemName] > 0) return true;

  // 4. Check progression_mapping for progressive items
  // (e.g., "Fighter Sword" resolves from "Progressive Sword" at level 1)
  // ...
}
```

**Patterns combined from different games:**

| Pattern | Source Games | Purpose |
|---------|--------------|---------|
| Check `flags` array | AHIT, KDL3, Pokemon Emerald, SM, Yugioh06 | Event items stored as flags |
| Check `events` array | AHIT, KDL3, Pokemon Emerald, SM, Yugioh06 | Game events/triggers |
| Check `inventory` | All games | Standard item counts |
| Check `progression_mapping` | ALTTP | Progressive items (e.g., Progressive Sword → Fighter Sword) |

This unified implementation means most games can use `genericLogic.helperFunctions` without needing custom `has`/`count` implementations. Games with truly unique requirements can still provide custom implementations in their game logic module.

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

### Step 4b: Add Support for New Rule Types (Alternative)

If progress is stalled because blacklisting would require excluding too many helpers (defeating the purpose of automatic export), consider adding support for the missing rule type instead. This is a one-time infrastructure improvement that benefits all games.

**Identifying the missing rule type:**
1. Run the spoiler test and check browser console for: `[evaluateRule] Unknown rule type: <type>`
2. Or examine the generated `rules.json` to find rule structures with unfamiliar `type` values
3. Compare helper definitions in `rules.json` to the original Python code to understand what pattern isn't being handled

**Files to modify (in order):**

| File | Purpose |
|------|---------|
| `exporter/analyzer/ast_visitors.py` | Convert Python AST pattern to rule JSON |
| `frontend/modules/shared/ruleEngine.js` | Evaluate the rule type at runtime |

**Example: Adding `group_count` support (from commit c859b4cfe)**

1. **Analyzer** - Handle `state.count_group(group_name, player)`:
```python
elif method == 'count_group' and len(filtered_args) >= 1:
    group_arg = filtered_args[0]
    if isinstance(group_arg, dict) and group_arg.get('type') == 'constant':
        group_value = group_arg.get('value')
    elif isinstance(group_arg, str):
        group_value = group_arg
    else:
        group_value = group_arg
    result = {'type': 'group_count', 'group': group_value}
```

2. **Frontend Rule Engine** - Evaluate the new type:
```javascript
case 'group_count': {
  const groupName = evaluateRule(rule.group, context, depth + 1);
  if (groupName === undefined) {
    result = undefined;
  } else if (typeof context.countGroup === 'function') {
    result = context.countGroup(groupName) ?? 0;
  } else {
    result = undefined;
  }
  break;
}
```

**Recent examples of rule type additions:**
- `c859b4cfe` - Add `group_count` for `state.count_group()` method
- `d14f7433d` - Add `block`, `assign`, `return`, `for_range` for imperative code
- `84a156ebb` - Add Entrance type support to `can_reach` method

After adding rule type support, return to Step 3 and re-test.

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

    def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export world data used by helpers."""
        world_data = super().get_world_data(world, multiworld, player)

        # Add settings referenced by helpers
        world_data['hard_mode'] = world.options.hard_mode.value
        world_data['key_shuffle'] = world.options.key_shuffle.value

        return world_data
```

Note: `HELPER_MODULES` and `ITEM_NAME_MODULES` are omitted because they are automatically detected. Only specify them if helpers are in modules not referenced during rule analysis.

## Default Settings

`GenericGameExportHandler` (the recommended base class) enables most auto-discovery by default:

```python
# Auto-export is ENABLED by default in GenericGameExportHandler
AUTO_EXPORT_DISCOVERED_HELPERS: bool = True   # Helpers exported automatically

# Auto-discovery is ENABLED by default
AUTO_DISCOVER_WORLD_HELPER_MODULES: bool = True  # Find helpers in world/*.py
AUTO_DISCOVER_WORLD_ATTRIBUTES: bool = True      # Export world attributes
AUTO_DISCOVER_REGION_ATTRIBUTES: bool = True     # Export region attributes
AUTO_DISCOVER_LOCATION_ATTRIBUTES: bool = True   # Export location attributes

# Module paths - empty by default (auto-detected during analysis)
HELPER_MODULES: List[str] = []     # Auto-discovered from world directory
ITEM_NAME_MODULES: List[str] = []  # Only needed for ITEMS.sword style constants

# Manual control (for edge cases)
HELPERS_TO_EXPORT_WHITELIST: Set[str] = set()  # Always export these
HELPERS_TO_EXPORT_BLACKLIST: Set[str] = set()  # Never export these (too complex)
HELPERS_TO_PRESERVE: Set[str] = set()          # Don't inline during analysis

# World attribute export (alternative to overriding get_world_data)
WORLD_ATTRIBUTES: Dict[str, Callable] = {}     # {name: lambda world, mw, player: value}
```

**Note:** Most games don't need to configure anything - auto-discovery handles:
- All world options (`world.options.*`) → exported automatically
- Item data (names, IDs, classifications) → discovered automatically
- Helper functions → discovered and exported automatically
- World/region/location attributes → discovered automatically

## Success Stories

The following games have achieved **complete removal** of all game-specific files (custom exporter, JavaScript helpers, game logic directory, and registry entry):

- **A Link to the Past** - Complex helper functions (can_buy, can_defeat_boss, etc.) exported with imperative block support
- **Adventure** - Classic Atari game rules exported
- **Bumper Stickers** - Puzzle game logic exported
- **ChecksFinder** - All rules exported
- **DOOM 1993** - FPS game logic exported
- **DOOM II** - FPS game logic exported
- **Donkey Kong Country 3** - Platformer rules exported
- **Faxanadu** - Action RPG rules exported
- **Metamath** - Mathematical puzzle logic exported
- **shapez** - Complex shape-building logic now fully exported
- **Shivers** - Ixupi capture helpers inlined as has_all patterns
- **Sonic Adventure 2 Battle** - Platform game rules exported
- **Super Mario World** - Platformer rules exported
- **Timespinner** - Time-manipulation game rules exported
- **Undertale** - RPG game rules exported

These games use only the generic infrastructure. No custom Python exporter, no JavaScript helper files, no game logic directory, and no entry in the game logic registry.

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

- **Base handler**: `exporter/games/base/handler.py` - Core export infrastructure
- **Helper discovery**: `exporter/games/base/helper_discovery.py` - Auto-discovery logic
- **World data**: `exporter/games/base/world_data.py` - World/option export
- **Rule expansion**: `exporter/games/base/rule_expansion.py` - Rule transformation
- **Generic handler**: `exporter/games/generic.py` - Recommended base class
- **Game exporter**: `exporter/games/<game>.py` - Game-specific configuration
- **Frontend helpers**: `frontend/modules/shared/gameLogic/<game>/helpers.js`
- **Rule engine**: `frontend/modules/shared/ruleEngine.js` - Helper definition lookup
- **State interface**: `frontend/modules/shared/stateInterface.js` - getStaticData()
- **State persistence**: `frontend/modules/stateManager/core/statePersistence.js` - getStaticGameData()
