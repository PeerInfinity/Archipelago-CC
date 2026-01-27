# World Generator Game-Specific Handlers

## Overview

Refactor game-specific logic out of the core world generator files into a handler pattern, mirroring the existing `exporter/games/` structure.

## Current State

Game-specific code is mixed into core world generator files:

| File | Game-Specific Code | Game |
|------|-------------------|------|
| `world_generator/templates.py` | `_check_for_bunny_rules()` | ALttP |
| `world_generator/templates.py` | `check_bunny_accessibility` helper template | ALttP |
| `world_generator/templates.py` | `no_logic` mode early return (glitches_required == 4) | ALttP |
| `world_generator/rule_codegen.py` | `_convert_bunny_accessibility_check()` | ALttP |
| `world_generator/rule_codegen.py` | `bunny_accessibility_check` in converters dict | ALttP |

## Proposed Structure

```
world_generator/
├── games/
│   ├── __init__.py          # Registry and get_handler()
│   ├── generic.py           # GenericWorldGenHandler base class
│   └── alttp.py             # ALttPWorldGenHandler
├── templates.py             # Calls into handler, no game-specific code
├── rule_codegen.py          # Calls into handler for custom converters
└── ...
```

## Implementation

### Step 1: Create Base Handler Class

**File: `world_generator/games/generic.py`**

```python
"""Base class for game-specific world generation handlers."""

from typing import Any, Callable, Dict, List, Optional, Set, TYPE_CHECKING

if TYPE_CHECKING:
    from world_generator.extractors import ExtractedData


class GenericWorldGenHandler:
    """Base handler for game-specific world generation logic.

    Subclass this for games that need custom rule converters,
    helper functions, or other game-specific generation behavior.
    """

    # Game name(s) this handler applies to
    GAME_NAMES: List[str] = []

    def __init__(self, data: "ExtractedData"):
        """Initialize with extracted world data."""
        self.data = data

    # --- Rule Codegen Hooks ---

    def get_rule_converters(self) -> Dict[str, Callable]:
        """Return custom rule type converters for RuleCodeGenerator.

        Returns:
            Dict mapping rule type names to converter functions.
            Converter signature: (self: RuleCodeGenerator, rule: Dict) -> str
        """
        return {}

    def get_helper_rule_converters(self) -> Dict[str, Callable]:
        """Return custom rule type converters for HelperCodeGenerator.

        Returns:
            Dict mapping rule type names to converter functions.
        """
        return {}

    # --- Template Generation Hooks ---

    def get_extra_imports(self) -> List[str]:
        """Return additional import lines needed for Rules.py.

        Returns:
            List of import statement strings (without newlines).
        """
        return []

    def get_helper_functions(self) -> List[str]:
        """Return helper function definitions to add to Rules.py.

        Returns:
            List of complete function definition strings.
        """
        return []

    def get_rules_preamble(self) -> Optional[str]:
        """Return code to insert at the start of set_rules().

        Use for early-return conditions like no_logic mode.

        Returns:
            Code string to insert, or None.
        """
        return None

    def needs_collection_state_import(self) -> bool:
        """Return True if CollectionState import is needed for helpers."""
        return False

    # --- Detection Methods ---

    def has_custom_rules(self) -> bool:
        """Return True if this game has rules requiring custom handling.

        Override to check data for game-specific rule patterns.
        """
        return False
```

### Step 2: Create ALttP Handler

**File: `world_generator/games/alttp.py`**

```python
"""ALttP-specific world generation handler."""

from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

from .generic import GenericWorldGenHandler

if TYPE_CHECKING:
    from world_generator.extractors import ExtractedData


class ALttPWorldGenHandler(GenericWorldGenHandler):
    """Handler for A Link to the Past world generation."""

    GAME_NAMES = ['A Link to the Past', 'A Link to the Past WorldGen', 'alttp', 'alttp_worldgen']

    def __init__(self, data: "ExtractedData"):
        super().__init__(data)
        self._has_bunny_rules = None  # Cached result

    def has_custom_rules(self) -> bool:
        """Check if bunny accessibility rules are present."""
        return self._check_for_bunny_rules()

    def get_rule_converters(self) -> Dict[str, Callable]:
        """Return bunny_accessibility_check converter."""
        return {
            'bunny_accessibility_check': self._convert_bunny_accessibility_check,
        }

    def get_extra_imports(self) -> List[str]:
        """Return pathfinding import if bunny rules present."""
        if self._check_for_bunny_rules():
            return ['from rule_builder.pathfinding import can_reach_via_bunny_path']
        return []

    def get_helper_functions(self) -> List[str]:
        """Return bunny accessibility helper if needed."""
        if self._check_for_bunny_rules():
            return [self._get_bunny_helper_template()]
        return []

    def get_rules_preamble(self) -> Optional[str]:
        """Return no_logic early return if applicable."""
        return self._get_no_logic_preamble()

    def needs_collection_state_import(self) -> bool:
        """Bunny helper needs CollectionState."""
        return self._check_for_bunny_rules()

    # --- Private Methods ---

    def _check_for_bunny_rules(self) -> bool:
        """Check if any rules use bunny_accessibility_check type."""
        if self._has_bunny_rules is not None:
            return self._has_bunny_rules

        def has_bunny_check(rule: Any) -> bool:
            if not isinstance(rule, dict):
                return False
            if rule.get('type') == 'bunny_accessibility_check':
                return True
            if rule.get('rule') == 'AST_bunny_accessibility_check':
                return True
            for value in rule.values():
                if isinstance(value, dict):
                    if has_bunny_check(value):
                        return True
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict) and has_bunny_check(item):
                            return True
            return False

        # Check locations, exits, helpers
        for loc_data in self.data.locations.values():
            if loc_data.access_rule and has_bunny_check(loc_data.access_rule):
                self._has_bunny_rules = True
                return True

        for exit_data in self.data.exits.values():
            if exit_data.access_rule and has_bunny_check(exit_data.access_rule):
                self._has_bunny_rules = True
                return True

        for helper_data in self.data.helpers.values():
            if helper_data.body and has_bunny_check(helper_data.body):
                self._has_bunny_rules = True
                return True

        self._has_bunny_rules = False
        return False

    def _convert_bunny_accessibility_check(self, codegen, rule: Dict[str, Any]) -> str:
        """Convert bunny_accessibility_check to a HelperCall.

        Args:
            codegen: The RuleCodeGenerator instance
            rule: The rule dict to convert
        """
        codegen.required_imports.add('HelperCall')

        args = rule.get('args', {})
        location_name = args.get('location_name', '') or rule.get('location_name', '')
        target_region = args.get('target_region', '') or rule.get('target_region', '')

        location_escaped = codegen._escape_string(location_name)

        if target_region:
            region_escaped = codegen._escape_string(target_region)
            return f'HelperCall(helper_func=check_bunny_accessibility, helper_name="check_bunny_accessibility", args=("{location_escaped}", "{region_escaped}"))'
        else:
            return f'HelperCall(helper_func=check_bunny_accessibility, helper_name="check_bunny_accessibility", args=("{location_escaped}",))'

    def _get_bunny_helper_template(self) -> str:
        """Return the check_bunny_accessibility helper function."""
        return '''
# Bunny accessibility helper for ALttP-style path-dependent rules
def check_bunny_accessibility(state: "CollectionState", player: int, location_name: str = None, target_region: str = None) -> bool:
    """Check if a location/region is accessible considering bunny form.

    Returns True if:
    1. Player has Moon Pearl, OR
    2. There's a path from a link region without needing Moon Pearl

    Reads inverted mode and glitch mode from world options at evaluation time.
    """
    # Quick check: Moon Pearl always allows access
    if state.has('Moon Pearl', player):
        return True

    # Get options from world
    world = state.multiworld.worlds[player]
    is_inverted = getattr(world.options, 'mode', None)
    if is_inverted is not None:
        is_inverted = str(is_inverted) == 'inverted' or getattr(is_inverted, 'value', 0) == 2
    else:
        is_inverted = False

    glitch_mode = getattr(world.options, 'glitches_required', None)
    if glitch_mode is not None:
        glitch_value = getattr(glitch_mode, 'value', 0)
        glitch_names = {0: 'no_glitches', 1: 'minor_glitches', 2: 'overworld_glitches',
                       3: 'hybrid_major_glitches', 4: 'no_logic'}
        glitch_mode = glitch_names.get(glitch_value, 'no_glitches')
    else:
        glitch_mode = 'no_glitches'

    # Determine target region for pathfinding
    region_name = target_region
    if not region_name and location_name:
        try:
            location = state.multiworld.get_location(location_name, player)
            region_name = location.parent_region.name
        except (KeyError, AttributeError):
            return False

    if not region_name:
        return False

    return can_reach_via_bunny_path(state, player, region_name, is_inverted, glitch_mode)
check_bunny_accessibility._internal_function = True
'''

    def _get_no_logic_preamble(self) -> Optional[str]:
        """Return no_logic early return code if applicable."""
        option_defs = self.data.metadata.option_definitions
        if 'glitches_required' not in option_defs:
            return None

        glitch_opt = option_defs['glitches_required']
        name_lookup = glitch_opt.get('name_lookup', {})

        no_logic_value = None
        for value, name in name_lookup.items():
            if name == 'no_logic':
                no_logic_value = value
                break

        if no_logic_value is None:
            return None

        return f'''
    # For no_logic mode, skip all rules (for single-player)
    if hasattr(world.options, 'glitches_required') and world.options.glitches_required.value == {no_logic_value}:
        if multiworld.players == 1:
            for exit in multiworld.get_region('Menu', player).exits:
                exit.hide_path = True
            return
'''
```

### Step 3: Create Handler Registry

**File: `world_generator/games/__init__.py`**

```python
"""Game-specific world generation handlers."""

from typing import Optional, TYPE_CHECKING

from .generic import GenericWorldGenHandler
from .alttp import ALttPWorldGenHandler

if TYPE_CHECKING:
    from world_generator.extractors import ExtractedData

# Registry of game handlers
_HANDLERS = [
    ALttPWorldGenHandler,
]


def get_handler(game_name: str, data: "ExtractedData") -> GenericWorldGenHandler:
    """Get the appropriate handler for a game.

    Args:
        game_name: The game name to find a handler for
        data: The extracted world data

    Returns:
        Game-specific handler if one exists, otherwise GenericWorldGenHandler
    """
    game_name_lower = game_name.lower().replace(' ', '_').replace('-', '_')

    for handler_class in _HANDLERS:
        for name in handler_class.GAME_NAMES:
            if name.lower().replace(' ', '_').replace('-', '_') == game_name_lower:
                return handler_class(data)

    return GenericWorldGenHandler(data)


__all__ = [
    'GenericWorldGenHandler',
    'ALttPWorldGenHandler',
    'get_handler',
]
```

### Step 4: Update templates.py

Remove game-specific code and call into handler:

```python
# In generate_rules_py():

from world_generator.games import get_handler

def generate_rules_py(data: ExtractedData, ...):
    # Get game-specific handler
    handler = get_handler(data.metadata.game_name, data)

    # ... existing code ...

    # Replace _check_for_bunny_rules() call:
    # OLD: needs_bunny_helper = _check_for_bunny_rules(data)
    # NEW:
    needs_custom_helpers = handler.has_custom_rules()

    # Replace bunny helper generation:
    # OLD: if needs_bunny_helper: bunny_helper_section = '...'
    # NEW:
    custom_helpers = handler.get_helper_functions()
    if custom_helpers:
        helpers_section += '\n'.join(custom_helpers)

    # Replace bunny import:
    # OLD: bunny_import_section = 'from rule_builder.pathfinding...'
    # NEW:
    extra_imports = handler.get_extra_imports()
    extra_import_section = '\n'.join(extra_imports) + '\n' if extra_imports else ''

    # Replace no_logic handling:
    # OLD: no_logic_handling = '...' (inline ALttP-specific code)
    # NEW:
    rules_preamble = handler.get_rules_preamble() or ''

    # Replace CollectionState import condition:
    # OLD: if has_helpers or needs_lambda or defeat_rule_functions or needs_bunny_helper:
    # NEW:
    if has_helpers or needs_lambda or defeat_rule_functions or handler.needs_collection_state_import():
        collection_state_import = 'from BaseClasses import CollectionState\n'
```

### Step 5: Update rule_codegen.py

Remove game-specific converters and allow handler injection:

```python
class RuleCodeGenerator:
    def __init__(self, ..., game_handler=None):
        # ... existing init ...
        self._game_handler = game_handler

        # Merge handler converters into converters dict
        if game_handler:
            custom_converters = game_handler.get_rule_converters()
            # Wrap converters to pass self
            for rule_type, converter in custom_converters.items():
                self._custom_converters[rule_type] = converter

    def _convert_rule(self, rule: Dict[str, Any]) -> str:
        rule_type = rule.get('type', '')

        # Check custom converters first
        if rule_type in self._custom_converters:
            return self._custom_converters[rule_type](self, rule)

        # ... rest of existing logic ...
```

## Migration Steps

1. Create `world_generator/games/` directory structure
2. Implement `GenericWorldGenHandler` base class
3. Implement `ALttPWorldGenHandler` with extracted logic
4. Create registry in `__init__.py`
5. Update `templates.py` to use handler
6. Update `rule_codegen.py` to accept handler
7. Remove `_check_for_bunny_rules()` from templates.py
8. Remove `_convert_bunny_accessibility_check()` from rule_codegen.py
9. Test with ALttP world generation
10. Verify generated Rules.py matches current output

## Future Extensions

Other games can add handlers as needed:

- `world_generator/games/dlcquest.py` - If DLCQuest needs custom generation
- `world_generator/games/oot.py` - For OoT age-based state handling
- `world_generator/games/sm.py` - For Super Metroid AccessFrom patterns

## Benefits

1. **Separation of concerns**: Game-specific logic isolated from core generator
2. **Easier maintenance**: ALttP changes don't require modifying core files
3. **Consistent pattern**: Matches existing exporter/games/ structure
4. **Extensibility**: New games can add handlers without touching core code
5. **Testability**: Handlers can be unit tested independently
