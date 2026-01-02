"""
File templates for generating Archipelago world files.

Each template function takes extracted data and returns the Python source code
for that file.
"""

import json
import re
from typing import Any, Dict, List, Set
from .constants import BUILTIN_SETTINGS
from .extractors import ExtractedData, ItemData, LocationData, ExitData, HelperData, DungeonData, BossData
from .rule_codegen import RuleCodeGenerator, HelperCodeGenerator, is_trivial_rule


def sanitize_class_name(name: str) -> str:
    """Sanitize a name to be a valid Python identifier.

    Removes all characters that are not alphanumeric (keeps letters and digits).
    """
    return re.sub(r'[^a-zA-Z0-9]', '', name)


def sanitize_option_name(name: str) -> str:
    """Sanitize an option name to be a valid Python identifier.

    Replaces non-alphanumeric characters (except underscores) with underscores.
    Collapses multiple consecutive underscores into one.
    """
    # Replace any non-alphanumeric character (except underscore) with underscore
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    # Collapse multiple underscores into one
    sanitized = re.sub(r'_+', '_', sanitized)
    # Remove leading/trailing underscores
    return sanitized.strip('_')


def is_valid_identifier(name: str) -> bool:
    """Check if a string is a valid Python identifier.

    Python identifiers must start with a letter or underscore, and contain
    only letters, digits, and underscores. They also cannot be keywords.
    """
    import keyword
    return name.isidentifier() and not keyword.iskeyword(name)


def _extract_region_dependencies(rule: dict, helpers: Dict[str, 'HelperData'] = None, visited_helpers: Set[str] = None) -> List[str]:
    """Extract region names from can_reach calls in a rule.

    This finds all state.can_reach("RegionName", "Region") calls
    that indicate the rule depends on a region's accessibility.
    Also resolves helper function calls to find can_reach calls in helper bodies.

    Returns dependencies in the order they are encountered (preserves input order).

    Args:
        rule: The rule dict to analyze
        helpers: Dictionary of helper name to HelperData for resolving helper calls
        visited_helpers: Set of already visited helper names to prevent infinite recursion
    """
    dependencies = []

    if not isinstance(rule, dict):
        return dependencies

    if helpers is None:
        helpers = {}
    if visited_helpers is None:
        visited_helpers = set()

    rule_type = rule.get('type', '')

    # Check for state_method can_reach calls
    if rule_type == 'state_method' and rule.get('method') == 'can_reach':
        args = rule.get('args', [])
        if len(args) >= 2:
            # args[0] should be the target name, args[1] should be the type
            target_arg = args[0]
            type_arg = args[1]

            # Get the target name value
            target_name = None
            if isinstance(target_arg, dict) and target_arg.get('type') == 'constant':
                target_name = target_arg.get('value')

            # Get the target type
            target_type = None
            if isinstance(type_arg, dict) and type_arg.get('type') == 'constant':
                target_type = type_arg.get('value')

            # Only include Region dependencies (not Location or Entrance)
            if target_name and target_type == 'Region':
                if target_name not in dependencies:
                    dependencies.append(target_name)

    # Check for state_method can_reach_region calls (takes 1 arg: region name)
    if rule_type == 'state_method' and rule.get('method') == 'can_reach_region':
        args = rule.get('args', [])
        if len(args) >= 1:
            region_arg = args[0]
            region_name = None
            if isinstance(region_arg, dict) and region_arg.get('type') == 'constant':
                region_name = region_arg.get('value')
            if region_name and region_name not in dependencies:
                dependencies.append(region_name)

    # Check for can_reach type (used in helper bodies)
    if rule_type == 'can_reach':
        region = rule.get('region')
        if isinstance(region, dict) and region.get('type') == 'constant':
            region_name = region.get('value')
            if region_name and region_name not in dependencies:
                dependencies.append(region_name)
        elif isinstance(region, str):
            if region not in dependencies:
                dependencies.append(region)

    # Check for helper calls and resolve them
    # Handle both formats:
    # 1. type='helper' with name='helper_name' (standard format)
    # 2. _original_ast_type='helper' with rule='helper_name' (AST export format)
    helper_name = None
    if rule_type == 'helper':
        helper_name = rule.get('name', '')
    elif rule.get('_original_ast_type') == 'helper':
        # AST export format: helper name is in 'rule' field
        helper_name = rule.get('rule', '')

    if helper_name and helper_name not in visited_helpers and helper_name in helpers:
        visited_helpers.add(helper_name)
        helper_data = helpers[helper_name]
        if helper_data.body:
            for dep in _extract_region_dependencies(helper_data.body, helpers, visited_helpers):
                if dep not in dependencies:
                    dependencies.append(dep)

    # Recurse into nested rules
    for key in ('conditions', 'children', 'if_true', 'if_false', 'test', 'args', 'left', 'right', 'statements'):
        value = rule.get(key)
        if isinstance(value, list):
            for item in value:
                for dep in _extract_region_dependencies(item, helpers, visited_helpers):
                    if dep not in dependencies:
                        dependencies.append(dep)
        elif isinstance(value, dict):
            for dep in _extract_region_dependencies(value, helpers, visited_helpers):
                if dep not in dependencies:
                    dependencies.append(dep)

    # Check helper body field for inline helpers
    body = rule.get('body')
    if body:
        for dep in _extract_region_dependencies(body, helpers, visited_helpers):
            if dep not in dependencies:
                dependencies.append(dep)

    return dependencies


def _rule_uses_helpers(rule: dict) -> bool:
    """Check if a rule uses any helper function calls."""
    if not isinstance(rule, dict):
        return False

    rule_type = rule.get('type', '')
    if rule_type == 'helper':
        return True

    # Recursively check all dict and list values
    for value in rule.values():
        if isinstance(value, dict):
            if _rule_uses_helpers(value):
                return True
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict) and _rule_uses_helpers(item):
                    return True

    return False


def _rule_needs_lambda(rule: dict) -> bool:
    """
    Check if a rule needs to use lambda-based generation instead of Rule Builder.

    Returns True if the rule contains:
    - Block statements (loops, assignments, etc.) that aren't AST_block
    - Dynamic references (setting_value, placement_lookup, etc.) that need
      runtime access to world options/attributes

    Note: Most rule types including helpers, not, compare, and conditional
    can now be handled by RuleCodeGenerator with the new Rule Builder classes.
    AST_block rules can also be handled by RuleCodeGenerator.
    """
    if not isinstance(rule, dict):
        return False

    # AST_block rules can be handled by RuleCodeGenerator
    # even if they contain nested block types
    rule_name = rule.get('rule', '')
    if rule_name == 'AST_block':
        return False

    rule_type = rule.get('type', '')

    # Block statements require lambda (for loops, assignments, etc.)
    if rule_type == 'block':
        return True

    # Dynamic references need lambda to generate proper runtime access patterns
    # These are evaluated to constants in Rule Builder but should be preserved
    # as dynamic option/attribute access for proper re-export
    if rule_type in ('setting_value',):
        return True

    # AST format dynamic references also need lambda
    # AST_function_call is included because it may reference 'location' or 'entrance'
    # variables that are substituted at generation time via set_context(), and
    # dungeon.boss patterns are now supported via _Dungeon/_Boss wrapper classes.
    if rule_name in ('AST_setting_value', 'AST_placement_lookup', 'AST_placement_search', 'AST_function_call'):
        return True

    # Recursively check all dict and list values
    for value in rule.values():
        if isinstance(value, dict):
            if _rule_needs_lambda(value):
                return True
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict) and _rule_needs_lambda(item):
                    return True

    return False


def generate_items_py(data: ExtractedData) -> str:
    """Generate Items.py file content."""
    game_name = data.metadata.game_name
    class_name = sanitize_class_name(game_name)

    # Check if any items have hint_text
    has_hint_text = any(item.hint_text for item in data.items.values())

    # Build item table entries (preserve original order from JSON)
    item_entries = []
    for item_name, item_data in data.items.items():
        classification = _classification_to_enum(item_data.classification)
        item_id = 'None' if item_data.item_id is None else str(item_data.item_id)

        # Escape item name for Python string
        name_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')

        # Build optional hint_text argument
        if item_data.hint_text:
            hint_escaped = item_data.hint_text.replace('\\', '\\\\').replace('"', '\\"')
            hint_arg = f', "{hint_escaped}"'
        else:
            hint_arg = ''

        item_entries.append(
            f'    "{name_escaped}": ItemData({item_id}, {classification}{hint_arg}),'
        )

    item_table_content = '\n'.join(item_entries)

    # Generate hint_text parameter in ItemData if needed
    hint_text_param = ', hint_text: Optional[str] = None' if has_hint_text else ''
    hint_text_assign = '\n        self.hint_text = hint_text' if has_hint_text else ''

    return f'''"""
Item definitions for {game_name}.

Auto-generated by world_generator.
"""

from typing import Dict, Optional
from BaseClasses import ItemClassification, Item


class {class_name}Item(Item):
    """Item class for {game_name}."""
    game: str = "{game_name}"


class ItemData:
    """Data container for item definitions."""

    def __init__(self, item_id: Optional[int], classification: ItemClassification{hint_text_param}):
        self.id = item_id
        self.classification = classification{hint_text_assign}


item_table: Dict[str, ItemData] = {{
{item_table_content}
}}
'''


def generate_locations_py(data: ExtractedData) -> str:
    """Generate Locations.py file content."""
    game_name = data.metadata.game_name
    class_name = sanitize_class_name(game_name)

    # Always import LocationProgressType since it's used in LocationData type annotation
    has_progress_type = True  # Always True - LocationData.__init__ references it

    # Build location table entries (preserve original order from JSON)
    location_entries = []
    for loc_name, loc_data in data.locations.items():
        loc_id = 'None' if loc_data.location_id is None else str(loc_data.location_id)
        region_escaped = loc_data.region.replace('\\', '\\\\').replace('"', '\\"')
        name_escaped = loc_name.replace('\\', '\\\\').replace('"', '\\"')
        is_event = 'True' if loc_data.is_event else 'False'

        # Build optional arguments
        optional_args = []
        if loc_data.progress_type:
            optional_args.append(f'progress_type=LocationProgressType.{loc_data.progress_type}')
        if not loc_data.show_in_spoiler:
            optional_args.append('show_in_spoiler=False')
        if loc_data.access:
            # Serialize access data as a Python dict literal
            # Note: JSON uses true/false, Python uses True/False
            access_str = json.dumps(loc_data.access).replace('true', 'True').replace('false', 'False').replace('null', 'None')
            optional_args.append(f'access={access_str}')
        if loc_data.extra_attributes:
            # Serialize extra_attributes as a Python dict literal
            extra_str = json.dumps(loc_data.extra_attributes).replace('true', 'True').replace('false', 'False').replace('null', 'None')
            optional_args.append(f'extra_attributes={extra_str}')

        if optional_args:
            optional_str = ', ' + ', '.join(optional_args)
        else:
            optional_str = ''

        location_entries.append(
            f'    "{name_escaped}": LocationData("{region_escaped}", "{name_escaped}", {loc_id}, {is_event}{optional_str}),'
        )

    location_table_content = '\n'.join(location_entries)

    # Generate import for LocationProgressType if needed
    progress_type_import = ", LocationProgressType" if has_progress_type else ""

    return f'''"""
Location definitions for {game_name}.

Auto-generated by world_generator.
"""

from typing import Any, Dict, Optional
from BaseClasses import Location{progress_type_import}


class {class_name}Location(Location):
    """Location class for {game_name}."""
    game: str = "{game_name}"


class LocationData:
    """Data container for location definitions."""

    def __init__(self, region: str, name: str, location_id: Optional[int], event: bool = False,
                 progress_type: "LocationProgressType" = None, show_in_spoiler: bool = True,
                 access: Optional[Dict[str, Any]] = None, extra_attributes: Optional[Dict[str, Any]] = None):
        self.region = region
        self.name = name
        self.location_id = location_id
        self.event = event
        self.progress_type = progress_type
        self.show_in_spoiler = show_in_spoiler
        self.access = access  # Game-specific access data
        self.extra_attributes = extra_attributes or {{}}  # Game-specific attributes


location_table: Dict[str, LocationData] = {{
{location_table_content}
}}
'''


def _generate_dungeon_classes_and_data(data: ExtractedData, game_name: str) -> tuple:
    """Generate Dungeon/Boss wrapper classes and dungeon data.

    Returns:
        Tuple of (dungeon_classes_code, dungeon_data_code, dungeon_setup_code, has_dungeons)
    """
    if not data.dungeons:
        return "", "", "", False

    # Note: Defeat rule functions are generated in Rules.py (see generate_rules_py)
    # because they need access to helper functions defined there.

    # Build boss function mapping for reference in dungeon data
    boss_func_mapping = {}  # (dungeon_name, boss_key) -> function_name
    for dungeon_name, dungeon_data in data.dungeons.items():
        for boss_key, boss_data in dungeon_data.bosses.items():
            if boss_data.defeat_rule:
                safe_dungeon = re.sub(r'[^a-zA-Z0-9]', '_', dungeon_name)
                safe_key = 'default' if boss_key == 'None' else boss_key
                func_name = f"_can_defeat_{safe_dungeon}_{safe_key}"
                boss_func_mapping[(dungeon_name, boss_key)] = func_name

    # Generate dungeon classes
    dungeon_classes = '''
# Dungeon and Boss wrapper classes for WorldGen
class _Boss:
    """Boss wrapper for WorldGen dungeons."""
    def __init__(self, name: str, defeat_func_name: str = None):
        self.name = name
        self._defeat_func_name = defeat_func_name
        self._defeat_func = None  # Set by set_rules() via setup_dungeon_bosses()
        self.player = None  # Set when dungeon is created

    def can_defeat(self, state) -> bool:
        """Check if this boss can be defeated."""
        if self._defeat_func is None:
            return True
        return self._defeat_func(state, self.player)

    @property
    def defeat_rule(self):
        """Property for exporter compatibility - returns the defeat function."""
        return self._defeat_func


class _Dungeon:
    """Dungeon wrapper for WorldGen."""
    def __init__(self, name: str, player: int):
        self.name = name
        self.player = player
        self.bosses: Dict[str, _Boss] = {}
        self.regions: list = []  # List of Region objects, populated by create_regions()

    @property
    def boss(self) -> _Boss:
        """Get the default boss (key 'None')."""
        return self.bosses.get('None')

    @boss.setter
    def boss(self, value: _Boss):
        """Set the default boss."""
        self.bosses['None'] = value

'''

    # Generate dungeon data structure
    dungeon_data_entries = []
    for dungeon_name, dungeon_data in data.dungeons.items():
        escaped_name = dungeon_name.replace('\\', '\\\\').replace('"', '\\"')

        # Build bosses dict - store function name as string for later lookup
        boss_entries = []
        for boss_key, boss_data in dungeon_data.bosses.items():
            escaped_boss_name = boss_data.name.replace('\\', '\\\\').replace('"', '\\"')
            func_name = boss_func_mapping.get((dungeon_name, boss_key))
            func_name_str = f'"{func_name}"' if func_name else 'None'
            boss_entries.append(f'        "{boss_key}": ("{escaped_boss_name}", {func_name_str}),')

        bosses_content = '\n'.join(boss_entries) if boss_entries else ''

        # Build regions list
        regions_list = ', '.join(f'"{r.replace(chr(34), chr(92)+chr(34))}"' for r in dungeon_data.regions)

        dungeon_data_entries.append(f'''    "{escaped_name}": {{
        "regions": [{regions_list}],
        "bosses": {{
{bosses_content}
        }},
    }},''')

    dungeon_data_code = '''
# Dungeon data (name -> {regions, bosses})
# Boss defeat functions are defined in Rules.py and wired up by set_rules()
DUNGEON_DATA = {
''' + '\n'.join(dungeon_data_entries) + '''
}
'''

    # Generate dungeon setup code - creates dungeons but defeat functions are wired later
    dungeon_setup_code = '''
    # Create dungeon objects (defeat functions are wired up by set_rules())
    dungeons = {}
    for dungeon_name, dungeon_info in DUNGEON_DATA.items():
        dungeon = _Dungeon(dungeon_name, player)
        for boss_key, (boss_name, defeat_func_name) in dungeon_info["bosses"].items():
            boss = _Boss(boss_name, defeat_func_name)
            boss.player = player
            dungeon.bosses[boss_key] = boss
        dungeons[dungeon_name] = dungeon

    # Assign dungeons to regions
    for region_name, dungeon_name in REGION_DUNGEONS.items():
        if region_name in regions and dungeon_name in dungeons:
            regions[region_name].dungeon = dungeons[dungeon_name]

    # Populate dungeon.regions in the original order from DUNGEON_DATA
    # (not REGION_DUNGEONS order, which may differ)
    for dungeon_name, dungeon_info in DUNGEON_DATA.items():
        if dungeon_name in dungeons:
            for region_name in dungeon_info["regions"]:
                if region_name in regions:
                    dungeons[dungeon_name].regions.append(regions[region_name])
'''

    return dungeon_classes, dungeon_data_code, dungeon_setup_code, True


def generate_regions_py(data: ExtractedData) -> str:
    """Generate Regions.py file content."""
    game_name = data.metadata.game_name
    class_name = sanitize_class_name(game_name)

    # Build region list - preserve exactly what's in the original data
    # Note: We no longer add "Menu" automatically. Instead, if the original world
    # doesn't have Menu, we set origin_region_name in the world class to point
    # to the actual start region (see generate_init_py).
    region_names = list(data.regions.keys())
    # Escape quotes in region names
    region_list = ', '.join(f'"{r.replace(chr(34), chr(92)+chr(34))}"' for r in region_names)

    # Build region hints dict (only for regions with hint_text different from name)
    hint_entries = []
    for region_name, region_data in data.regions.items():
        if region_data.hint_text and region_data.hint_text != region_name:
            escaped_name = region_name.replace('\\', '\\\\').replace('"', '\\"')
            escaped_hint = region_data.hint_text.replace('\\', '\\\\').replace('"', '\\"')
            hint_entries.append(f'    "{escaped_name}": "{escaped_hint}",')
    region_hints_content = '\n'.join(hint_entries)

    # Build list of dynamically added regions
    dynamically_added_regions = []
    for region_name, region_data in data.regions.items():
        if region_data.dynamically_added:
            escaped_name = region_name.replace('\\', '\\\\').replace('"', '\\"')
            dynamically_added_regions.append(f'"{escaped_name}"')

    # Build region dungeons dict (region -> dungeon name mapping)
    dungeon_entries = []
    for region_name, region_data in data.regions.items():
        if region_data.dungeon:
            escaped_name = region_name.replace('\\', '\\\\').replace('"', '\\"')
            escaped_dungeon = region_data.dungeon.replace('\\', '\\\\').replace('"', '\\"')
            dungeon_entries.append(f'    "{escaped_name}": "{escaped_dungeon}",')
    region_dungeons_content = '\n'.join(dungeon_entries)

    # Build entrance connections
    entrance_lines = []

    # Note: We no longer add MenuToStart entrance. The world uses origin_region_name instead.

    for exit_name, exit_data in data.exits.items():
        source = exit_data.source_region.replace('"', '\\"')
        target = exit_data.target_region.replace('"', '\\"')
        name = exit_name.replace('"', '\\"')
        entrance_lines.append(
            f'    _create_entrance(regions["{source}"], regions["{target}"], "{name}")'
        )

    entrances_content = '\n'.join(entrance_lines)

    # Generate region hints dict section (only if there are hints)
    region_hints_section = ""
    if hint_entries:
        region_hints_section = f'''
# Region display names (hint text)
REGION_HINTS: Dict[str, str] = {{
{region_hints_content}
}}
'''

    # Generate dynamically added regions set (if any)
    dynamically_added_section = ""
    if dynamically_added_regions:
        dynamically_added_list = ', '.join(dynamically_added_regions)
        dynamically_added_section = f'''
# Regions that were added after sphere calculation (from original export)
DYNAMICALLY_ADDED_REGIONS = {{{dynamically_added_list}}}
'''

    # Generate region dungeons dict section (if any)
    region_dungeons_section = ""
    if dungeon_entries:
        region_dungeons_section = f'''
# Region to dungeon mapping
REGION_DUNGEONS: Dict[str, str] = {{
{region_dungeons_content}
}}
'''

    # Build region extra attributes dict (only for regions with extra_attributes)
    region_extra_entries = []
    for region_name, region_data in data.regions.items():
        if region_data.extra_attributes:
            escaped_name = region_name.replace('\\', '\\\\').replace('"', '\\"')
            # Serialize extra_attributes as a Python dict literal
            extra_str = json.dumps(region_data.extra_attributes).replace('true', 'True').replace('false', 'False').replace('null', 'None')
            region_extra_entries.append(f'    "{escaped_name}": {extra_str},')
    region_extra_content = '\n'.join(region_extra_entries)

    # Generate region extra attributes section (if any)
    region_extra_section = ""
    if region_extra_entries:
        region_extra_section = f'''
# Region extra attributes (game-specific, e.g., code)
REGION_EXTRA_ATTRIBUTES: Dict[str, Dict[str, Any]] = {{
{region_extra_content}
}}
'''

    # Check if any locations have extra attributes
    has_location_extra_attrs = any(
        loc_data.extra_attributes for loc_data in data.locations.values()
    )

    # Generate the hint lookup in create_regions
    hint_lookup = "REGION_HINTS.get(region_name)" if hint_entries else "None"

    # Determine imports needed
    typing_import = "Dict, Set, Any" if region_extra_entries or has_location_extra_attrs else "Dict, Set"

    # Generate code to apply region extra attributes
    region_extra_apply = ""
    if region_extra_entries:
        region_extra_apply = '''
    # Apply region extra attributes (game-specific, e.g., code)
    for region_name, extra_attrs in REGION_EXTRA_ATTRIBUTES.items():
        if region_name in regions:
            for attr_name, attr_value in extra_attrs.items():
                setattr(regions[region_name], attr_name, attr_value)
'''

    # Generate dungeon classes and data if dungeons exist
    dungeon_classes, dungeon_data_code, dungeon_setup_code, has_dungeons = \
        _generate_dungeon_classes_and_data(data, game_name)

    # Generate code to apply dungeon attributes to regions
    region_dungeons_apply = ""
    if has_dungeons:
        # Use full dungeon object setup
        region_dungeons_apply = dungeon_setup_code
    elif dungeon_entries:
        # Fallback: simple string assignment if no dungeon data but region mapping exists
        region_dungeons_apply = '''
    # Apply dungeon assignments to regions (string names only)
    for region_name, dungeon_name in REGION_DUNGEONS.items():
        if region_name in regions:
            regions[region_name].dungeon = dungeon_name
'''

    # Generate code to apply location extra attributes
    location_extra_apply = ""
    if has_location_extra_attrs:
        location_extra_apply = '''
        # Apply extra attributes (game-specific, e.g., type_string, price)
        for attr_name, attr_value in location_data.extra_attributes.items():
            setattr(location, attr_name, attr_value)
'''

    # Build dungeon section (classes + data)
    dungeon_section = ""
    if has_dungeons:
        dungeon_section = dungeon_classes + dungeon_data_code

    return f'''"""
Region definitions for {game_name}.

Auto-generated by world_generator.
"""

from typing import {typing_import}
from BaseClasses import MultiWorld, Region, Entrance
from .Locations import location_table, {class_name}Location
{dungeon_section}
{region_hints_section}{dynamically_added_section}{region_dungeons_section}{region_extra_section}
def create_regions(multiworld: MultiWorld, player: int) -> None:
    """Create all regions, locations, and connections."""

    # Create all regions
    region_names = [{region_list}]

    regions = {{}}
    for region_name in region_names:
        hint = {hint_lookup}
        region = Region(region_name, player, multiworld, hint)
        regions[region_name] = region
        multiworld.regions.append(region)

    # Mark dynamically added regions (these won't appear in sphere log comparisons)
    try:
        _dynamically_added = DYNAMICALLY_ADDED_REGIONS
    except NameError:
        _dynamically_added = set()
    for region_name in _dynamically_added:
        if region_name in regions:
            regions[region_name].dynamically_added = True
{region_extra_apply}{region_dungeons_apply}
    # Add locations to regions
    for location_name, location_data in location_table.items():
        region = regions[location_data.region]
        location = {class_name}Location(
            player,
            location_name,
            location_data.location_id,
            region
        )

        # Apply location properties from location_data
        if location_data.event:
            location.event = True
        if location_data.progress_type is not None:
            location.progress_type = location_data.progress_type
        if not location_data.show_in_spoiler:
            location.show_in_spoiler = False
{location_extra_apply}
        region.locations.append(location)

    # Create entrances
{entrances_content}


def _create_entrance(source: Region, target: Region, name: str) -> Entrance:
    """Helper to create and connect an entrance."""
    entrance = Entrance(source.player, name, source)
    entrance.connect(target)
    source.exits.append(entrance)
    return entrance
'''


def generate_rules_py(data: ExtractedData) -> str:
    """Generate Rules.py file content.

    Uses a hybrid approach:
    - Rule Builder for most rules (item checks, and/or, helpers, etc.)
    - Lambda expressions only for complex rules with blocks (loops, assignments)
    """
    game_name = data.metadata.game_name

    # Build helper bodies dict for explain support
    helper_bodies = {
        name: helper_data.body
        for name, helper_data in data.helpers.items()
        if helper_data.body
    }

    # Build helper params dict for proper argument binding
    helper_params = {
        name: helper_data.params
        for name, helper_data in data.helpers.items()
        if helper_data.params
    }

    # Build helper defaults dict for default parameter values
    helper_defaults = {
        name: helper_data.defaults
        for name, helper_data in data.helpers.items()
        if helper_data.defaults
    }

    rule_builder_generator = RuleCodeGenerator(game_name, data.metadata.resolved_values)
    rule_builder_generator.set_helpers(set(data.helpers.keys()), helper_bodies, helper_params, helper_defaults, data.original_placements)

    helper_generator = HelperCodeGenerator(
        game_name,
        resolved_values=data.metadata.resolved_values,
        option_definitions=data.metadata.option_definitions
    )
    helper_generator.set_known_helpers(set(data.helpers.keys()))
    helper_generator.set_placements(data.original_placements)

    # Check if any rules need helpers or lambda
    has_helpers = bool(data.helpers)
    needs_lambda = False

    for exit_data in data.exits.values():
        if exit_data.access_rule and _rule_needs_lambda(exit_data.access_rule):
            needs_lambda = True
            break

    if not needs_lambda:
        for loc_data in data.locations.values():
            if loc_data.access_rule and _rule_needs_lambda(loc_data.access_rule):
                needs_lambda = True
                break

    # Generate helper functions
    helper_functions = []
    if has_helpers:
        # Pre-scan all helper bodies for NamedTuple types
        # This is needed so constructor calls can be resolved before code generation
        for helper_data in data.helpers.values():
            if helper_data.body:
                helper_generator.prescan_for_namedtuples(helper_data.body)

        for helper_name, helper_data in data.helpers.items():
            func_code = helper_generator.generate_helper_function(
                helper_name,
                helper_data.params,
                helper_data.body,
                helper_data.defaults
            )
            helper_functions.append(func_code)

    # Collect all rules
    entrance_rules = []
    location_rules = []
    indirect_conditions = []  # (entrance_name, region_name) pairs

    # Process entrance rules (preserve original order)
    for exit_name, exit_data in data.exits.items():
        if not is_trivial_rule(exit_data.access_rule):
            exit_escaped = exit_name.replace('\\', '\\\\').replace('"', '\\"')

            # Extract region dependencies for indirect condition registration
            # Pass helpers dict so helper calls can be resolved to find can_reach calls
            region_deps = _extract_region_dependencies(exit_data.access_rule, data.helpers)
            for region_name in region_deps:
                indirect_conditions.append((exit_name, region_name))

            if _rule_needs_lambda(exit_data.access_rule):
                # Use lambda with helper code generator
                # Set context so 'entrance' variable references can be substituted
                helper_generator.set_context(entrance=exit_name)
                rule_expr = helper_generator._generate_expression(exit_data.access_rule)
                helper_generator.set_context()  # Clear context
                entrance_rules.append(
                    f'    multiworld.get_entrance("{exit_escaped}", player).access_rule = \\\n'
                    f'        lambda state: {rule_expr}'
                )
            else:
                # Use Rule Builder
                rule_code = rule_builder_generator.generate(exit_data.access_rule)
                entrance_rules.append(
                    f'    world.set_rule(\n'
                    f'        multiworld.get_entrance("{exit_escaped}", player),\n'
                    f'        {rule_code}\n'
                    f'    )'
                )

    # Process location rules (preserve original order)
    for loc_name, loc_data in data.locations.items():
        if not is_trivial_rule(loc_data.access_rule):
            loc_escaped = loc_name.replace('\\', '\\\\').replace('"', '\\"')

            if _rule_needs_lambda(loc_data.access_rule):
                # Use lambda with helper code generator
                # Set context so 'location' variable references can be substituted
                helper_generator.set_context(location=loc_name)
                rule_expr = helper_generator._generate_expression(loc_data.access_rule)
                helper_generator.set_context()  # Clear context
                location_rules.append(
                    f'    multiworld.get_location("{loc_escaped}", player).access_rule = \\\n'
                    f'        lambda state: {rule_expr}'
                )
            else:
                # Use Rule Builder
                rule_code = rule_builder_generator.generate(loc_data.access_rule)
                location_rules.append(
                    f'    world.set_rule(\n'
                    f'        multiworld.get_location("{loc_escaped}", player),\n'
                    f'        {rule_code}\n'
                    f'    )'
                )

    # Build imports
    rule_builder_imports = rule_builder_generator.get_imports()
    rule_builder_imports_str = ', '.join(rule_builder_imports)

    # Generate boss defeat rule functions if dungeons exist
    defeat_rule_functions = []
    defeat_func_names = []
    if data.dungeons:
        for dungeon_name, dungeon_data in data.dungeons.items():
            for boss_key, boss_data in dungeon_data.bosses.items():
                if boss_data.defeat_rule:
                    safe_dungeon = re.sub(r'[^a-zA-Z0-9]', '_', dungeon_name)
                    safe_key = 'default' if boss_key == 'None' else boss_key
                    func_name = f"_can_defeat_{safe_dungeon}_{safe_key}"
                    defeat_func_names.append(func_name)

                    try:
                        rule_expr = helper_generator._generate_expression(boss_data.defeat_rule)
                        defeat_rule_functions.append(f'''
def {func_name}(state: "CollectionState", player: int) -> bool:
    """Defeat rule for {boss_data.name} in {dungeon_name}."""
    return {rule_expr}
{func_name}._internal_function = True
''')
                    except Exception as e:
                        defeat_rule_functions.append(f'''
def {func_name}(state: "CollectionState", player: int) -> bool:
    """Defeat rule for {boss_data.name} in {dungeon_name} (fallback: {e})."""
    return True
{func_name}._internal_function = True
''')

    # Build helper section
    helpers_section = ''
    if helper_functions:
        # Generate NamedTuple class definitions if any were encountered
        namedtuple_classes = helper_generator.generate_namedtuple_classes()
        if namedtuple_classes:
            helpers_section = '\n\n# NamedTuple types for helper functions\n' + namedtuple_classes + '\n'
            helpers_section += '\n# Helper functions\n' + '\n\n\n'.join(helper_functions) + '\n'
        else:
            helpers_section = '\n\n# Helper functions\n' + '\n\n\n'.join(helper_functions) + '\n'

    # Add defeat rule functions after helpers
    if defeat_rule_functions:
        helpers_section += '\n\n# Boss defeat rule functions\n' + '\n'.join(defeat_rule_functions)

    # Build indirect condition registrations
    indirect_section = ''
    if indirect_conditions:
        indirect_lines = []
        for entrance_name, region_name in indirect_conditions:
            entrance_escaped = entrance_name.replace('\\', '\\\\').replace('"', '\\"')
            region_escaped = region_name.replace('\\', '\\\\').replace('"', '\\"')
            indirect_lines.append(
                f'    multiworld.register_indirect_condition(\n'
                f'        world.get_region("{region_escaped}"),\n'
                f'        multiworld.get_entrance("{entrance_escaped}", player)\n'
                f'    )'
            )
        indirect_section = '\n    # Register indirect conditions for proper sphere calculation\n' + '\n'.join(indirect_lines)

    # Build rule sections
    entrance_section = ''
    if entrance_rules:
        entrance_section = '\n    # Entrance rules\n' + '\n\n'.join(entrance_rules)

    location_section = ''
    if location_rules:
        location_section = '\n    # Location rules\n' + '\n\n'.join(location_rules)

    rules_content = entrance_section + indirect_section + location_section
    if not rules_content.strip():
        rules_content = '    pass  # No non-trivial rules'

    # Add dungeon boss setup call if dungeons exist
    dungeon_setup_section = ''
    dungeon_setup_function = ''
    if defeat_func_names:
        # Add call to setup function at end of set_rules
        dungeon_setup_section = '''

    # Wire up boss defeat functions to dungeon objects
    _setup_dungeon_bosses(multiworld, player)'''

        # Generate the setup function
        func_lookups = []
        for func_name in defeat_func_names:
            func_lookups.append(f'        "{func_name}": {func_name},')
        func_lookup_content = '\n'.join(func_lookups)

        dungeon_setup_function = f'''


def _setup_dungeon_bosses(multiworld, player: int) -> None:
    """Wire up boss defeat functions to dungeon objects.

    This is called at the end of set_rules() to connect the defeat
    rule functions to the Boss objects created in Regions.py.
    """
    # Map function names to actual functions
    defeat_funcs = {{
{func_lookup_content}
    }}

    # Find all regions and wire up their dungeon bosses
    for region in multiworld.get_regions(player):
        if hasattr(region, 'dungeon') and region.dungeon is not None:
            dungeon = region.dungeon
            if hasattr(dungeon, 'bosses'):
                for boss in dungeon.bosses.values():
                    if hasattr(boss, '_defeat_func_name') and boss._defeat_func_name:
                        func = defeat_funcs.get(boss._defeat_func_name)
                        if func:
                            boss._defeat_func = func
'''

    # Build import section
    imports_section = ''
    if rule_builder_imports:
        imports_section = f'\nfrom rule_builder import {rule_builder_imports_str}\n'

    # Add CollectionState import if we have helpers, lambda rules, or dungeons
    collection_state_import = ''
    if has_helpers or needs_lambda or defeat_rule_functions:
        collection_state_import = 'from BaseClasses import CollectionState\n'

    # Add math import if needed for sqrt, floor, etc.
    math_import = ''
    if helper_generator.uses_math:
        math_import = 'import math\n'

    # Add placement function imports if placement_lookup/search is used
    placement_lookup_import = ''
    if helper_generator.uses_placement_lookup:
        placement_lookup_import = 'from worlds.generic.Rules import location_item_name, item_name_in_location_names\n'

    # Note: Helper definitions for frontend evaluation are no longer stored as AST
    # in the generated Rules.py. Instead, when the exporter runs on a worldgen world,
    # it analyzes the Python helper functions and converts them back to AST format.
    # This keeps the generated code clean and readable.

    typing_import_str = 'TYPE_CHECKING'

    return f'''"""
Access rules for {game_name}.

Auto-generated by world_generator.
"""

from typing import {typing_import_str}
{math_import}
{placement_lookup_import}{collection_state_import}{imports_section}
if TYPE_CHECKING:
    from BaseClasses import CollectionState
    from worlds.AutoWorld import World
{helpers_section}

def set_rules(world: "World") -> None:
    """Set access rules for all locations and entrances."""
    player = world.player
    multiworld = world.multiworld
{rules_content}{dungeon_setup_section}
{dungeon_setup_function}'''


def _extract_setting_values(rule: dict, settings: Set[str]) -> None:
    """Extract setting names referenced via setting_value nodes in a rule.

    Recursively traverses the rule tree and adds any setting names found
    in setting_value nodes to the provided set.
    """
    if not isinstance(rule, dict):
        return

    if rule.get('type') == 'setting_value':
        setting_name = rule.get('setting')
        if setting_name and isinstance(setting_name, str):
            # Handle dot notation (e.g., "options.difficulty") - take first part
            settings.add(setting_name.split('.')[0])

    for value in rule.values():
        if isinstance(value, dict):
            _extract_setting_values(value, settings)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    _extract_setting_values(item, settings)


def _collect_rule_settings(data: ExtractedData) -> Set[str]:
    """Collect all settings used in rules via setting_value nodes."""
    settings: Set[str] = set()

    for helper_data in data.helpers.values():
        if helper_data.body:
            _extract_setting_values(helper_data.body, settings)

    for loc_data in data.locations.values():
        if loc_data.access_rule:
            _extract_setting_values(loc_data.access_rule, settings)

    for exit_data in data.exits.values():
        if exit_data.access_rule:
            _extract_setting_values(exit_data.access_rule, settings)

    return settings - BUILTIN_SETTINGS


def _generate_option_class_from_definition(setting_name: str, option_def: Dict[str, Any]) -> tuple:
    """Generate an option class from an option definition.

    Args:
        setting_name: The name of the setting (e.g., 'bat_logic')
        option_def: The option definition dict with type, default, etc.

    Returns:
        Tuple of (class_code, field_code, import_name) or (None, None, None) if unsupported.
    """
    class_name = ''.join(word.capitalize() for word in setting_name.split('_'))
    display_name = option_def.get('display_name', ' '.join(word.capitalize() for word in setting_name.split('_')))
    # Escape double quotes in display names to generate valid Python code
    display_name_escaped = display_name.replace('"', '\\"')
    option_type = option_def.get('type')
    default = option_def.get('default', 0)

    if option_type == 'choice':
        # Generate Choice option with option_<name> = <value> for each choice
        name_lookup = option_def.get('name_lookup', {})

        # Properly quote string default values
        if isinstance(default, str):
            default_repr = f'"{default}"'
        else:
            default_repr = default

        # If name_lookup is empty, this is a TextChoice (accepts arbitrary text)
        if not name_lookup:
            class_code = f'''
class {class_name}(TextChoice):
    """Option for {display_name}."""
    display_name = "{display_name_escaped}"

    default = {default_repr}
'''
            return class_code, f'    {setting_name}: {class_name}', 'TextChoice'

        # Check if all keys are numeric (convertible to int)
        # Some games use TextChoice with string keys (e.g., "random-2p", "M", "MA")
        try:
            sorted_items = sorted(name_lookup.items(), key=lambda x: int(x[0]))
        except ValueError:
            # Non-numeric keys indicate a TextChoice or similar complex option
            # Fall back to TextChoice for these cases
            class_code = f'''
class {class_name}(TextChoice):
    """Option for {display_name}."""
    display_name = "{display_name_escaped}"

    default = {default_repr}
'''
            return class_code, f'    {setting_name}: {class_name}', 'TextChoice'

        option_lines = []
        for value_str, name in sorted_items:
            # Sanitize the option name to be a valid Python identifier
            safe_name = sanitize_option_name(name)
            option_lines.append(f'    option_{safe_name} = {value_str}')
        options_code = '\n'.join(option_lines)

        class_code = f'''
class {class_name}(Choice):
    """Option for {display_name}."""
    display_name = "{display_name_escaped}"
{options_code}
    default = {default_repr}
'''
        return class_code, f'    {setting_name}: {class_name}', 'Choice'

    elif option_type == 'range':
        range_start = option_def.get('range_start', 0)
        range_end = option_def.get('range_end', 100)

        # Properly quote string default values
        if isinstance(default, str):
            default_repr = f'"{default}"'
        else:
            default_repr = default

        # Check if default is outside the range - need to use NamedRange with special_range_names
        default_outside_range = (
            isinstance(default, (int, float)) and
            (default < range_start or default > range_end)
        )

        if default_outside_range:
            # Use NamedRange with special_range_names for defaults outside the range
            class_code = f'''
class {class_name}(NamedRange):
    """Option for {display_name}."""
    display_name = "{display_name_escaped}"
    range_start = {range_start}
    range_end = {range_end}
    default = {default_repr}
    special_range_names = {{"default": {default_repr}}}
'''
            return class_code, f'    {setting_name}: {class_name}', 'NamedRange'
        else:
            class_code = f'''
class {class_name}(Range):
    """Option for {display_name}."""
    display_name = "{display_name_escaped}"
    range_start = {range_start}
    range_end = {range_end}
    default = {default_repr}
'''
            return class_code, f'    {setting_name}: {class_name}', 'Range'

    elif option_type == 'default_on_toggle':
        class_code = f'''
class {class_name}(DefaultOnToggle):
    """Option for {display_name}."""
    display_name = "{display_name_escaped}"
'''
        return class_code, f'    {setting_name}: {class_name}', 'DefaultOnToggle'

    elif option_type == 'toggle':
        # Get the default value, preserving boolean type if present
        toggle_default = option_def.get('default', False)
        # Normalize to Python boolean for consistency
        if toggle_default == 0 or toggle_default is False:
            default_repr = 'False'
        else:
            default_repr = 'True'
        class_code = f'''
class {class_name}(Toggle):
    """Option for {display_name}."""
    display_name = "{display_name_escaped}"
    default = {default_repr}
'''
        return class_code, f'    {setting_name}: {class_name}', 'Toggle'

    elif option_type == 'removed':
        # Deprecated/removed options - use Removed class
        # Default is typically an empty string
        default_str = option_def.get('default', '')
        if isinstance(default_str, str):
            default_repr = f'"{default_str}"'
        else:
            default_repr = repr(default_str)
        class_code = f'''
class {class_name}(Removed):
    """Deprecated option for {display_name}."""
    default = {default_repr}
'''
        return class_code, f'    {setting_name}: {class_name}', 'Removed'

    elif option_type == 'freetext':
        # Free text options (like entrance_shuffle_seed)
        default_str = option_def.get('default', '')
        if isinstance(default_str, str):
            default_repr = f'"{default_str}"'
        else:
            default_repr = repr(default_str)
        class_code = f'''
class {class_name}(FreeText):
    """Option for {display_name}."""
    display_name = "{display_name_escaped}"
    default = {default_repr}
'''
        return class_code, f'    {setting_name}: {class_name}', 'FreeText'

    elif option_type == 'plando_connections':
        # Plando connections - inherits from PlandoConnections
        # Must define entrances and exits (required by PlandoConnections metaclass)
        # Using empty sets since plando is not used in worldgen testing
        class_code = f'''
class {class_name}(PlandoConnections):
    """Plando connections for {display_name}."""
    entrances = frozenset()
    exits = frozenset()
'''
        return class_code, f'    {setting_name}: {class_name}', 'PlandoConnections'

    elif option_type == 'plando_texts':
        # Plando texts - inherits from PlandoTexts
        class_code = f'''
class {class_name}(PlandoTexts):
    """Plando texts for {display_name}."""
'''
        return class_code, f'    {setting_name}: {class_name}', 'PlandoTexts'

    elif option_type == 'start_inventory_pool':
        # Start inventory from pool option - inherits from StartInventoryPool
        class_code = f'''
class {class_name}(StartInventoryPool):
    """Start inventory from pool for {display_name}."""
'''
        return class_code, f'    {setting_name}: {class_name}', 'StartInventoryPool'

    return None, None, None


def generate_options_py(data: ExtractedData) -> str:
    """Generate Options.py file content."""
    game_name = data.metadata.game_name
    class_name = sanitize_class_name(game_name)
    option_definitions = data.metadata.option_definitions

    imports_needed = {'Toggle'}  # Always need Toggle for RandomizeItems
    option_classes = []
    option_fields = []

    # These options are always inherited from PerGameCommonOptions and should not be regenerated
    # unless they have non-standard defaults
    always_skip_options = {
        'progression_balancing', 'local_items', 'non_local_items',
        'start_inventory', 'start_hints', 'start_location_hints', 'exclude_locations',
        'priority_locations', 'item_links', 'plando_items',
        'randomize_items',  # Defined in hardcoded template with default=True
        'use_canonical_options',  # Defined in hardcoded template with default=True
    }

    # Standard defaults for common options - if the game uses different defaults,
    # we need to generate a custom class
    common_option_defaults = {
        'accessibility': 0,  # Standard Accessibility default is 0 (full)
    }

    # Check if accessibility needs a custom class (different default than standard)
    custom_accessibility = False
    accessibility_def = option_definitions.get('accessibility', {})
    if accessibility_def.get('default', 0) != common_option_defaults.get('accessibility', 0):
        custom_accessibility = True
        # Generate custom accessibility class
        acc_default = accessibility_def.get('default', 0)
        name_lookup = accessibility_def.get('name_lookup', {})

        # Build the options
        option_lines = []
        for value, name in sorted(name_lookup.items(), key=lambda x: int(x[0])):
            option_lines.append(f"    option_{name} = {value}")

        acc_class = f'''
class Accessibility(Choice):
    """Accessibility option with game-specific default."""
    display_name = "Accessibility"
{chr(10).join(option_lines)}
    default = {acc_default}
'''
        option_classes.append(acc_class)
        option_fields.append('    accessibility: Accessibility')
        imports_needed.add('Choice')

    skip_options = always_skip_options.copy()
    if not custom_accessibility:
        skip_options.add('accessibility')
    else:
        # Already handled above
        skip_options.add('accessibility')

    # Generate option classes from definitions
    for setting_name in sorted(option_definitions.keys()):
        if setting_name in skip_options:
            continue

        option_def = option_definitions[setting_name]
        class_code, field_code, import_name = _generate_option_class_from_definition(setting_name, option_def)
        if class_code:
            option_classes.append(class_code)
            option_fields.append(field_code)
            imports_needed.add(import_name)

    imports_str = ', '.join(sorted(imports_needed))
    option_classes_str = ''.join(option_classes)
    option_fields_str = ('\n' + '\n'.join(option_fields)) if option_fields else ''

    return f'''"""
Game options for {game_name}.

Auto-generated by world_generator.
"""

from dataclasses import dataclass
from Options import {imports_str}, PerGameCommonOptions


class RandomizeItems(Toggle):
    """Enable item randomization.

    When disabled, items will be placed in their original locations.
    """
    display_name = "Randomize Items"
    default = True


class UseCanonicalOptions(Toggle):
    """Use canonical options for seed 1.

    When enabled and generating seed 1, options will be loaded from the
    _worldgen_options.json file to reproduce the exact original seed.
    This ensures deterministic output matching the original world export.
    """
    display_name = "Use Canonical Options"
    default = True
{option_classes_str}

@dataclass
class {class_name}Options(PerGameCommonOptions):
    """Options for {game_name}."""
    randomize_items: RandomizeItems
    use_canonical_options: UseCanonicalOptions{option_fields_str}
'''


def generate_init_py(data: ExtractedData, canonical_seed1: bool = False) -> str:
    """Generate __init__.py (main world file) content.

    Args:
        data: Extracted game data
        canonical_seed1: If True, include seed=1 canonical placement behavior
    """
    game_name = data.metadata.game_name
    class_name = sanitize_class_name(game_name)
    world_class = data.metadata.world_class_name

    # Build canonical placements dict (only needed if canonical_seed1 is enabled)
    # Use canonical_placements if available, otherwise fall back to original_placements
    placement_entries = []
    canonical_class_attr_entries = []  # For the class attribute (exporter to read)
    if canonical_seed1:
        # Prefer canonical_placements (from world class attribute) over original_placements
        placements_source = data.canonical_placements if data.canonical_placements else data.original_placements
        for loc_name, item_name in placements_source.items():
            if item_name:  # Skip empty placements
                loc_escaped = loc_name.replace('\\', '\\\\').replace('"', '\\"')
                item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
                placement_entries.append(f'        "{loc_escaped}": "{item_escaped}",')
                canonical_class_attr_entries.append(f'        "{loc_escaped}": "{item_escaped}",')

    placements_content = '\n'.join(placement_entries)
    canonical_class_attr_content = '\n'.join(canonical_class_attr_entries)

    # Find victory location and item
    victory_location = None
    victory_item = None
    for loc_name, loc_data in data.locations.items():
        if loc_data.is_event:
            item_name = data.original_placements.get(loc_name, '')
            if 'victory' in item_name.lower() or 'victory' in loc_name.lower():
                victory_location = loc_name
                victory_item = item_name
                break

    victory_section = ''
    if victory_location and victory_item:
        victory_section = f'''
    def generate_basic(self) -> None:
        """Place victory event item."""
        victory_location = self.multiworld.get_location("{victory_location}", self.player)

        # Only place if not already filled (e.g., by _place_original_items)
        if victory_location.item is None:
            victory_item = {class_name}Item(
                "{victory_item}",
                item_table["{victory_item}"].classification,
                None,
                self.player
            )
            victory_location.place_locked_item(victory_item)

        # Set completion condition
        self.multiworld.completion_condition[self.player] = \\
            lambda state: state.has("{victory_item}", self.player)
'''

    # Generate canonical seed1 sections only if enabled
    if canonical_seed1:
        generate_early_section = '''
    def generate_early(self) -> None:
        """Push starting items and load canonical options for seed 1."""
        self._push_starting_items()
        if self.multiworld.seed == 1:
            self.options.randomize_items.value = False
            if self.options.use_canonical_options.value:
                self._load_canonical_options()

    def _load_canonical_options(self) -> None:
        """Load options from _worldgen_options.json for canonical seed generation.

        This ensures that when generating seed 1, the same options are used
        as in the original export, producing identical output.
        """
        # Find the options file in the same directory as this module
        world_dir = os.path.dirname(os.path.abspath(__file__))
        options_path = os.path.join(world_dir, '_worldgen_options.json')

        if not os.path.exists(options_path):
            return  # No options file, use defaults

        try:
            with open(options_path, 'r') as f:
                options_data = json.load(f)
        except (json.JSONDecodeError, IOError):
            return  # Can't read options, use defaults

        if not options_data:
            return

        # Map option names from JSON (snake_case) to option attributes
        for option_name, option_value in options_data.items():
            # Get the option attribute if it exists
            if not hasattr(self.options, option_name):
                continue

            option_obj = getattr(self.options, option_name)

            # Handle different option types
            if isinstance(option_value, bool):
                # Toggle options
                option_obj.value = int(option_value)
            elif isinstance(option_value, int):
                # Range or Choice options with numeric value
                option_obj.value = option_value
            elif isinstance(option_value, str):
                # Choice options with string value - need to look up the value
                # Try to find the corresponding option_* attribute
                option_attr_name = f"option_{option_value}"
                if hasattr(option_obj.__class__, option_attr_name):
                    option_obj.value = getattr(option_obj.__class__, option_attr_name)
                else:
                    # Try to use the string directly if the class has a from_text method
                    try:
                        option_obj.value = option_obj.__class__.from_text(option_value).value
                    except (ValueError, KeyError, AttributeError):
                        pass  # Keep existing value
'''
        # Use pre_fill() for canonical placements like the original bakingadventure does
        # This ensures items are created first, then placed/removed from pool later
        create_items_section = f'''
    def create_items(self) -> None:
'''
        # Add pre_fill section for canonical placement
        pre_fill_section = f'''
    def pre_fill(self) -> None:
        """Pre-fill items if not randomizing."""
        if not self.options.randomize_items.value:
            self._place_original_items()

    def _place_original_items(self) -> None:
        """Place items in their canonical locations when not randomized."""
        for location_name, item_name in self.canonical_placements.items():
            location = self.multiworld.get_location(location_name, self.player)

            # Skip if already filled (e.g., by _place_locked_items or generate_basic)
            if location.item is not None:
                continue

            item = self.create_item(item_name)
            location.place_locked_item(item)

            # Remove the item from the pool if it exists
            for pool_item in self.multiworld.itempool[:]:
                if pool_item.name == item_name and pool_item.player == self.player:
                    self.multiworld.itempool.remove(pool_item)
                    break
'''
    else:
        pre_fill_section = ''
        generate_early_section = '''
    def generate_early(self) -> None:
        """Push starting items as precollected."""
        self._push_starting_items()
'''
        create_items_section = '''
    def create_items(self) -> None:
'''

    # Build locked_placements dictionary
    # When canonical_placements is available, LOCKED_PLACEMENTS should only contain
    # items that are ALWAYS locked (like Victory events), not items that are
    # canonical but should be randomizable.
    # We determine this by checking if the item is an event (id=None).
    locked_entries = []
    if data.canonical_placements:
        # Only include truly locked items (events) - not canonical placements
        for loc_name, item_name in data.locked_placements.items():
            if item_name:
                # Check if this is an event item (id=None)
                item_data = data.items.get(item_name)
                if item_data and item_data.is_event:
                    loc_escaped = loc_name.replace('\\', '\\\\').replace('"', '\\"')
                    item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
                    locked_entries.append(f'    "{loc_escaped}": "{item_escaped}",')
    else:
        # No canonical_placements - use all locked placements as before
        for loc_name, item_name in data.locked_placements.items():
            if item_name:
                loc_escaped = loc_name.replace('\\', '\\\\').replace('"', '\\"')
                item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
                locked_entries.append(f'    "{loc_escaped}": "{item_escaped}",')

    locked_content = '\n'.join(locked_entries)

    # Build starting_items dictionary (preserve original order)
    starting_entries = []
    for item_name, count in data.starting_items.items():
        if count > 0:
            item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
            starting_entries.append(f'    "{item_escaped}": {count},')

    starting_content = '\n'.join(starting_entries)

    # Build accumulator_rules list (for state counter patterns like coins)
    accumulator_rules_content = ''
    if data.accumulator_rules:
        rules_items = []
        for rule in data.accumulator_rules:
            # Use raw string for pattern - don't escape backslashes since r"..." preserves them
            pattern_escaped = rule['pattern'].replace('"', '\\"')
            target_escaped = rule['target'].replace('\\', '\\\\').replace('"', '\\"')
            rules_items.append(
                f'        {{"pattern": r"{pattern_escaped}", "extract_value": {rule["extract_value"]}, '
                f'"target": "{target_escaped}", "discriminator": None}},'
            )
        accumulator_rules_content = '\n'.join(rules_items)

    # Build prog_items_init dictionary (initial values for state counters)
    prog_items_init_content = ''
    if data.prog_items_init:
        init_entries = []
        for item_name, value in data.prog_items_init.items():
            item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
            init_entries.append(f'        "{item_escaped}": {value},')
        prog_items_init_content = '\n'.join(init_entries)

    # Generate accumulator_rules section (for state counter patterns like coins)
    collect_remove_section = ''
    if accumulator_rules_content:
        accumulator_rules_section = f'''
    # Accumulator rules for state counters (e.g., coins)
    # These tell the exporter how to parse items like "60 coins" -> add 60 to " coins" counter
    accumulator_rules: ClassVar[list] = [
{accumulator_rules_content}
    ]
'''
        # Generate collect/remove methods for accumulator rules
        collect_remove_section = '''
    def collect(self, state: "CollectionState", item: "Item") -> bool:
        """Collect item and track cumulative counters from accumulator rules."""
        import re
        change = super().collect(state, item)
        if change:
            for rule in self.accumulator_rules:
                match = re.match(rule["pattern"], item.name)
                if match:
                    if rule["extract_value"]:
                        value = int(match.group(1))
                    else:
                        value = 1
                    state.prog_items[item.player][rule["target"]] += value
                    break
        return change

    def remove(self, state: "CollectionState", item: "Item") -> bool:
        """Remove item and update cumulative counters from accumulator rules."""
        import re
        change = super().remove(state, item)
        if change:
            for rule in self.accumulator_rules:
                match = re.match(rule["pattern"], item.name)
                if match:
                    if rule["extract_value"]:
                        value = int(match.group(1))
                    else:
                        value = 1
                    state.prog_items[item.player][rule["target"]] -= value
                    break
        return change
'''
    else:
        accumulator_rules_section = ''

    # Generate prog_items_init section (initial counter values)
    if prog_items_init_content:
        prog_items_init_section = f'''
    # Initial values for prog_items accumulators
    prog_items_init: ClassVar[dict] = {{
{prog_items_init_content}
    }}
'''
    else:
        prog_items_init_section = ''

    # Generate progression_mapping section (for progressive items like progressive-processing)
    progression_mapping_section = ''
    collect_item_section = ''
    if data.progression_mapping:
        prog_map_entries = []
        for prog_name, components in data.progression_mapping.items():
            prog_escaped = prog_name.replace('\\', '\\\\').replace('"', '\\"')
            components_list = ', '.join(f'"{c.replace(chr(92), chr(92)+chr(92)).replace(chr(34), chr(92)+chr(34))}"' for c in components)
            prog_map_entries.append(f'        "{prog_escaped}": [{components_list}],')
        prog_map_content = '\n'.join(prog_map_entries)

        progression_mapping_section = f'''
    # Progressive item mapping: progressive_item -> [component_items_in_order]
    # When collecting a progressive item, it grants access to the next uncollected component
    progression_mapping: ClassVar[Dict[str, list]] = {{
{prog_map_content}
    }}
'''

        collect_item_section = '''
    def collect_item(self, state, item, remove=False):
        """Handle progressive item collection.

        When a progressive item is collected, this returns the name of the next
        uncollected component item. This allows rules that check for component
        items (e.g., state.has("steel-processing")) to work correctly when the
        player has collected the progressive version (e.g., "progressive-processing").
        """
        if item.advancement and item.name in self.progression_mapping:
            components = self.progression_mapping[item.name]
            if remove:
                # When removing, find the last component the player has
                for component_name in reversed(components):
                    if state.has(component_name, item.player):
                        return component_name
            else:
                # When collecting, find the first component the player doesn't have
                for component_name in components:
                    if not state.has(component_name, item.player):
                        return component_name

        return super().collect_item(state, item, remove)
'''

    # Generate canonical_placements class attribute (for exporter to read)
    if canonical_seed1 and canonical_class_attr_content:
        canonical_placements_section = f'''
    # Canonical item placements - where items belong in the "vanilla" game
    # Used by exporter to distinguish canonical placements from always-locked items
    canonical_placements: ClassVar[Dict[str, str]] = {{
{canonical_class_attr_content}
    }}
'''
    else:
        canonical_placements_section = ''

    # Generate __init__ method for world_attributes (game-specific instance attributes)
    init_section = ''
    needs_types_import = False
    if data.world_attributes:
        init_attrs = []
        for attr_name, attr_value in data.world_attributes.items():
            # Format the value appropriately
            if isinstance(attr_value, dict):
                # Check if this dict has string keys that suggest attribute access
                # (e.g., difficulty_requirements) vs integer keys that suggest dict access
                has_string_keys = all(isinstance(k, str) for k in attr_value.keys())
                has_nested_values = not any(isinstance(v, dict) for v in attr_value.values())

                # Check if all keys are valid Python identifiers for SimpleNamespace
                # Only check isidentifier() if we know all keys are strings (has_string_keys)
                all_valid_identifiers = has_string_keys and all(k.isidentifier() for k in attr_value.keys())

                if has_string_keys and has_nested_values and attr_value and all_valid_identifiers:
                    # Use SimpleNamespace for dicts with valid identifier keys (attribute access pattern)
                    needs_types_import = True
                    # Check if all keys are valid Python identifiers
                    all_valid_identifiers = all(is_valid_identifier(k) for k in attr_value.keys())
                    if all_valid_identifiers:
                        # Use keyword argument form: SimpleNamespace(key=val, ...)
                        dict_items = ', '.join(f'{k}={v!r}' for k, v in attr_value.items())
                        init_attrs.append(f'        self.{attr_name} = types.SimpleNamespace({dict_items})')
                    else:
                        # Use dictionary unpacking: SimpleNamespace(**{"key with space": val, ...})
                        dict_items = ', '.join(f'{k!r}: {v!r}' for k, v in attr_value.items())
                        init_attrs.append(f'        self.{attr_name} = types.SimpleNamespace(**{{{dict_items}}})')
                else:
                    # Keep as dict for integer keys or nested dicts
                    dict_items = ', '.join(f'{k!r}: {v!r}' for k, v in attr_value.items())
                    init_attrs.append(f'        self.{attr_name} = {{{dict_items}}}')
            elif isinstance(attr_value, list):
                # Special handling for shops - convert dicts to ShopWrapper objects
                if attr_name == 'shops' and attr_value and isinstance(attr_value[0], dict):
                    # Shops need special handling - convert to ShopWrapper objects in __init__
                    init_attrs.append(f'        self.{attr_name} = self._create_shops({attr_value!r})')
                else:
                    init_attrs.append(f'        self.{attr_name} = {attr_value!r}')
            else:
                init_attrs.append(f'        self.{attr_name} = {attr_value!r}')

        init_attrs_content = '\n'.join(init_attrs)

        # Check if we need the ShopWrapper class (for games with shops)
        has_shops = 'shops' in data.world_attributes and data.world_attributes['shops']
        shop_wrapper_section = ''
        create_shops_method = ''
        if has_shops:
            shop_wrapper_section = '''

class _RegionWrapper:
    """Wrapper for region to provide can_reach interface for worldgen shops."""
    def __init__(self, region_name: str, world):
        self.name = region_name
        self._world = world

    def can_reach(self, state) -> bool:
        """Check if the region is reachable."""
        try:
            region = self._world.multiworld.get_region(self.name, self._world.player)
            return state.can_reach_region(self.name, self._world.player)
        except KeyError:
            return False


class _ShopWrapper:
    """Wrapper for shop data to provide has/has_unlimited interface for worldgen."""
    def __init__(self, shop_data: dict, world):
        self._data = shop_data
        self.region = _RegionWrapper(shop_data.get('region', ''), world)
        self.inventory = shop_data.get('inventory', [])
        self.room_id = shop_data.get('room_id', 0)
        self.shopkeeper_config = shop_data.get('shopkeeper_config', 0)
        self.custom = shop_data.get('custom', False)
        self.locked = shop_data.get('locked', False)
        self.sram_offset = shop_data.get('sram_offset', 0)

    def has_unlimited(self, item: str) -> bool:
        """Check if the shop has unlimited supply of an item."""
        for inv in self.inventory:
            if inv is None:
                continue
            if inv.get('max'):
                if inv.get('replacement') == item:
                    return True
            elif inv.get('item') == item:
                return True
        return False

    def has(self, item: str) -> bool:
        """Check if the shop has an item."""
        for inv in self.inventory:
            if inv is None:
                continue
            if inv.get('item') == item:
                return True
            if inv.get('replacement') == item:
                return True
        return False

'''
            create_shops_method = '''
    def _create_shops(self, shops_data: list) -> list:
        """Convert shop data dicts to ShopWrapper objects."""
        return [_ShopWrapper(shop, self) for shop in shops_data]
'''

        init_section = f'''
    def __init__(self, multiworld: "MultiWorld", player: int):
        super().__init__(multiworld, player)
        # Game-specific world attributes
{init_attrs_content}
{create_shops_method}'''

    # Build itempool_counts dictionary
    # When canonical_placements is available, we use the full itempool_counts
    # (items are either in the pool for randomization, or placed canonically for seed=1).
    # Subtract event items and starting items from the pool.
    itempool_entries = []
    if data.canonical_placements:
        # Count only event items that are locked (these are subtracted from pool)
        event_item_counts: Dict[str, int] = {}
        for loc_name, item_name in data.locked_placements.items():
            if item_name:
                item_data = data.items.get(item_name)
                if item_data and item_data.is_event:
                    event_item_counts[item_name] = event_item_counts.get(item_name, 0) + 1

        for item_name, count in data.itempool_counts.items():
            # Subtract event items and starting items from the count
            adjusted_count = count - event_item_counts.get(item_name, 0)
            adjusted_count -= data.starting_items.get(item_name, 0)
            if adjusted_count > 0:
                # Skip event items entirely (they shouldn't be in the pool)
                item_data = data.items.get(item_name)
                if item_data and item_data.is_event:
                    continue
                item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
                itempool_entries.append(f'    "{item_escaped}": {adjusted_count},')
    else:
        # No canonical_placements - subtract all locked items and starting items
        locked_item_counts: Dict[str, int] = {}
        for loc_name, item_name in data.locked_placements.items():
            if item_name:
                locked_item_counts[item_name] = locked_item_counts.get(item_name, 0) + 1

        for item_name, count in data.itempool_counts.items():
            # Subtract locked items and starting items from the count
            adjusted_count = count - locked_item_counts.get(item_name, 0)
            adjusted_count -= data.starting_items.get(item_name, 0)
            if adjusted_count > 0:
                item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
                itempool_entries.append(f'    "{item_escaped}": {adjusted_count},')

    itempool_content = '\n'.join(itempool_entries)

    # Build item_name_groups dictionary (preserve original order)
    item_name_groups_entries = []
    for group_name, item_names in data.item_name_groups.items():
        group_escaped = group_name.replace('\\', '\\\\').replace('"', '\\"')
        items_list = ', '.join(f'"{item.replace(chr(92), chr(92)+chr(92)).replace(chr(34), chr(92)+chr(34))}"' for item in item_names)
        item_name_groups_entries.append(f'        "{group_escaped}": frozenset([{items_list}]),')

    item_name_groups_content = '\n'.join(item_name_groups_entries)

    # Build web theme
    web_theme = data.metadata.web_theme or "ocean"

    # Build tutorials content
    tutorials_content = "[]"
    if data.metadata.web_tutorials:
        tutorial_entries = []
        for t in data.metadata.web_tutorials:
            name_escaped = t.name.replace('\\', '\\\\').replace('"', '\\"')
            desc_escaped = t.description.replace('\\', '\\\\').replace('"', '\\"')
            lang_escaped = t.language.replace('\\', '\\\\').replace('"', '\\"')
            file_escaped = t.file_name.replace('\\', '\\\\').replace('"', '\\"')
            link_escaped = t.link.replace('\\', '\\\\').replace('"', '\\"')
            authors_list = ', '.join(f'"{a}"' for a in t.authors)
            tutorial_entries.append(
                f'        Tutorial(\n'
                f'            "{name_escaped}",\n'
                f'            "{desc_escaped}",\n'
                f'            "{lang_escaped}",\n'
                f'            "{file_escaped}",\n'
                f'            "{link_escaped}",\n'
                f'            [{authors_list}]\n'
                f'        )'
            )
        if tutorial_entries:
            tutorials_content = "[\n" + ",\n".join(tutorial_entries) + "\n    ]"

    # Build world docstring
    if data.metadata.world_description:
        # Format as a proper docstring
        world_docstring = '    """\n'
        for line in data.metadata.world_description.split('\n'):
            world_docstring += f'    {line}\n'
        world_docstring += '    """'
    else:
        world_docstring = f'    """\n    {game_name} for Archipelago.\n\n    Auto-generated world implementation.\n    """'

    # Build base_id section
    if data.metadata.base_id is not None:
        base_id_section = f'\n    base_id: ClassVar[int] = {data.metadata.base_id}'
    else:
        base_id_section = ''

    # Build origin_region_name section
    # This specifies the true starting region for the exporter, even when Menu is added
    if data.start_region and data.start_region != "Menu":
        start_region_escaped = data.start_region.replace('\\', '\\\\').replace('"', '\\"')
        origin_region_name_section = f'\n    origin_region_name: str = "{start_region_escaped}"'
    else:
        origin_region_name_section = ''

    # Build use_auto_indirect_conditions section
    # When True, use auto sweep algorithm for region dependencies instead of explicit
    # This is needed for worlds that set access_rule directly without registering indirect_connections
    if data.metadata.use_auto_indirect_conditions:
        use_auto_indirect_conditions_section = '''
    # Use auto indirect conditions since entrance rules have region dependencies
    # that aren't registered via RuleBuilder.set_rule()
    explicit_indirect_conditions: ClassVar[bool] = False'''
    else:
        use_auto_indirect_conditions_section = ''

    # Build fill_slot_data content
    # Check if slot_data fields match option names - if so, generate dynamic references
    # NOTE: We only dynamically reference 'randomize_items' since that's the only option
    # the world generator creates. Other options from the original game are not available.
    slot_data_fields = data.metadata.slot_data_fields
    # Only these options are generated by the world generator
    generated_options = {'randomize_items'}
    if slot_data_fields:
        slot_data_entries = []
        for key, value in slot_data_fields.items():
            key_escaped = key.replace('\\', '\\\\').replace('"', '\\"')
            # Check if this key matches an option we generate - if so, reference it dynamically
            if key in generated_options:
                slot_data_entries.append(f'            "{key_escaped}": self.options.{key}.value,')
            elif isinstance(value, bool):
                slot_data_entries.append(f'            "{key_escaped}": {str(value)},')
            elif isinstance(value, (int, float)):
                slot_data_entries.append(f'            "{key_escaped}": {value},')
            elif isinstance(value, str):
                value_escaped = value.replace('\\', '\\\\').replace('"', '\\"')
                slot_data_entries.append(f'            "{key_escaped}": "{value_escaped}",')
            else:
                # For complex types, try to represent as string
                slot_data_entries.append(f'            "{key_escaped}": {repr(value)},')
        slot_data_content = '\n'.join(slot_data_entries)
        fill_slot_data_section = f'''
    def fill_slot_data(self) -> Dict[str, Any]:
        """Return data for the client."""
        return {{
{slot_data_content}
        }}
'''
    else:
        fill_slot_data_section = '''
    def fill_slot_data(self) -> Dict[str, Any]:
        """Return data for the client."""
        return {}
'''

    # Build optional imports
    types_import = 'import types\n' if needs_types_import else ''
    # Add json and os imports for canonical options loading
    canonical_imports = 'import json\nimport os\n' if canonical_seed1 else ''

    # Check if any items have hint_text for create_item method
    has_hint_text = any(item.hint_text for item in data.items.values())
    hint_text_code = '''        if data.hint_text:
            item._hint_text = data.hint_text
''' if has_hint_text else ''

    return f'''"""
{game_name} world implementation for Archipelago.

Auto-generated by world_generator.
"""
{canonical_imports}{types_import}
from typing import ClassVar, Dict, Any, TYPE_CHECKING
from BaseClasses import Item, ItemClassification, Tutorial
from worlds.AutoWorld import WebWorld, World
from rule_builder import RuleWorldMixin

if TYPE_CHECKING:
    from BaseClasses import CollectionState, MultiWorld

from .Items import item_table, ItemData, {class_name}Item
from .Locations import location_table, {class_name}Location
from .Options import {class_name}Options
from .Regions import create_regions
from .Rules import set_rules


# Item pool counts from original generation (excluding locked placements)
ITEMPOOL_COUNTS: Dict[str, int] = {{
{itempool_content}
}}

# Locked placements - items that must be placed via place_locked_item
LOCKED_PLACEMENTS: Dict[str, str] = {{
{locked_content}
}}

# Starting items - items the player begins with (precollected)
STARTING_ITEMS: Dict[str, int] = {{
{starting_content}
}}
{shop_wrapper_section}

class {class_name}Web(WebWorld):
    """Web interface for {game_name}."""
    theme = "{web_theme}"
    tutorials = {tutorials_content}


class {world_class}(RuleWorldMixin, World):
{world_docstring}

    game: ClassVar[str] = "{game_name}"
    web: ClassVar[WebWorld] = {class_name}Web()

    options_dataclass = {class_name}Options
    options: {class_name}Options
{base_id_section}{origin_region_name_section}
    # Disable rule caching - requires CollectionState.rule_cache from PR #5048
    rule_caching_enabled: ClassVar[bool] = False{use_auto_indirect_conditions_section}

    item_name_to_id: ClassVar[Dict[str, int]] = {{
        name: data.id for name, data in item_table.items() if data.id is not None
    }}

    # Expose item_table as item_name_to_item for exporter compatibility
    # This allows the exporter handler to find item classifications
    item_name_to_item: ClassVar[Dict[str, "ItemData"]] = item_table

    location_name_to_id: ClassVar[Dict[str, int]] = {{
        name: data.location_id for name, data in location_table.items()
        if data.location_id is not None
    }}

    item_name_groups: ClassVar[Dict[str, frozenset]] = {{
{item_name_groups_content}
    }}
{accumulator_rules_section}{prog_items_init_section}{progression_mapping_section}{canonical_placements_section}{init_section}{generate_early_section}
    def create_regions(self) -> None:
        """Create regions, locations, and connections."""
        create_regions(self.multiworld, self.player)

    def set_rules(self) -> None:
        """Set access rules."""
        set_rules(self)
{collect_remove_section}{create_items_section}        """Create randomized item pool."""
        # First, place any locked items
        self._place_locked_items()

        # Then create the random item pool
        item_pool = []

        for item_name, count in ITEMPOOL_COUNTS.items():
            # Skip event items
            if item_name not in item_table or item_table[item_name].id is None:
                continue

            item_data = item_table[item_name]
            for _ in range(count):
                item = {class_name}Item(
                    item_name,
                    item_data.classification,
                    item_data.id,
                    self.player
                )
                item_pool.append(item)

        self.multiworld.itempool += item_pool

    def _place_locked_items(self) -> None:
        """Place items that must be in specific locations (locked placements)."""
        for location_name, item_name in LOCKED_PLACEMENTS.items():
            if item_name and item_name in item_table:
                location = self.multiworld.get_location(location_name, self.player)
                item_data = item_table[item_name]
                item = {class_name}Item(
                    item_name,
                    item_data.classification,
                    item_data.id,
                    self.player
                )
                location.place_locked_item(item)

    def _push_starting_items(self) -> None:
        """Push starting items as precollected (for state counters like coins)."""
        for item_name, count in STARTING_ITEMS.items():
            if item_name in item_table:
                for _ in range(count):
                    item = self.create_item(item_name)
                    self.multiworld.push_precollected(item)
{victory_section}{pre_fill_section}
    def create_item(self, name: str) -> Item:
        """Create an item by name."""
        data = item_table[name]
        item = {class_name}Item(name, data.classification, data.id, self.player)
{hint_text_code}        return item

{collect_item_section}{fill_slot_data_section}'''


def _classification_to_enum(classification: str) -> str:
    """Convert classification string to ItemClassification enum.

    Handles combined classifications like 'progression|useful' by splitting
    and joining the corresponding enum values.
    """
    mapping = {
        'progression': 'ItemClassification.progression',
        'progression_skip_balancing': 'ItemClassification.progression_skip_balancing',
        'progression_deprioritized': 'ItemClassification.progression_deprioritized',
        'progression_deprioritized_skip_balancing': 'ItemClassification.progression_deprioritized_skip_balancing',
        'useful': 'ItemClassification.useful',
        'trap': 'ItemClassification.trap',
        'filler': 'ItemClassification.filler',
    }

    # Handle combined classifications (e.g., 'progression|useful')
    if '|' in classification:
        parts = classification.split('|')
        enum_parts = []
        for part in parts:
            part = part.strip()
            if part in mapping:
                enum_parts.append(mapping[part])
        if enum_parts:
            return ' | '.join(enum_parts)
        # Fallback if no valid parts found
        return 'ItemClassification.filler'

    return mapping.get(classification, 'ItemClassification.filler')
