"""
File templates for generating Archipelago world files.

Each template function takes extracted data and returns the Python source code
for that file.
"""

import json
import re
from typing import Dict, List, Set
from .constants import BUILTIN_SETTINGS
from .extractors import ExtractedData, ItemData, LocationData, ExitData, HelperData
from .rule_codegen import RuleCodeGenerator, HelperCodeGenerator, is_trivial_rule


def sanitize_class_name(name: str) -> str:
    """Sanitize a name to be a valid Python identifier.

    Removes all characters that are not alphanumeric (keeps letters and digits).
    """
    return re.sub(r'[^a-zA-Z0-9]', '', name)


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
    if rule_type == 'helper':
        helper_name = rule.get('name', '')
        if helper_name and helper_name not in visited_helpers and helper_name in helpers:
            visited_helpers.add(helper_name)
            helper_data = helpers[helper_name]
            if helper_data.body:
                for dep in _extract_region_dependencies(helper_data.body, helpers, visited_helpers):
                    if dep not in dependencies:
                        dependencies.append(dep)

    # Recurse into nested rules
    for key in ('conditions', 'children', 'if_true', 'if_false', 'test', 'args', 'left', 'right'):
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
    - Block statements (loops, assignments, etc.)

    Note: Most rule types including helpers, not, compare, and conditional
    can now be handled by RuleCodeGenerator with the new Rule Builder classes.
    """
    if not isinstance(rule, dict):
        return False

    rule_type = rule.get('type', '')

    # Only block statements require lambda (for loops, assignments, etc.)
    if rule_type == 'block':
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
                 access: Optional[Dict[str, Any]] = None):
        self.region = region
        self.name = name
        self.location_id = location_id
        self.event = event
        self.progress_type = progress_type
        self.show_in_spoiler = show_in_spoiler
        self.access = access  # Game-specific access data (e.g., Lingo AccessRequirements)


location_table: Dict[str, LocationData] = {{
{location_table_content}
}}
'''


def generate_regions_py(data: ExtractedData) -> str:
    """Generate Regions.py file content."""
    game_name = data.metadata.game_name
    class_name = sanitize_class_name(game_name)

    # Build region list - always include Menu (required by Archipelago)
    # Preserve original order from JSON (Menu first if not already present)
    region_names = list(data.regions.keys())
    if "Menu" not in region_names:
        region_names.insert(0, "Menu")
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

    # Build entrance connections
    entrance_lines = []

    # Add entrance from Menu to start region if Menu wasn't in original data
    if "Menu" not in data.regions:
        start_region = data.start_region.replace('"', '\\"')
        entrance_lines.append(
            f'    _create_entrance(regions["Menu"], regions["{start_region}"], "MenuToStart")'
        )

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

    # Generate the hint lookup in create_regions
    hint_lookup = "REGION_HINTS.get(region_name)" if hint_entries else "None"

    return f'''"""
Region definitions for {game_name}.

Auto-generated by world_generator.
"""

from typing import Dict
from BaseClasses import MultiWorld, Region, Entrance
from .Locations import location_table, {class_name}Location

{region_hints_section}
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

    rule_builder_generator = RuleCodeGenerator(game_name, data.metadata.resolved_settings)
    rule_builder_generator.set_helpers(set(data.helpers.keys()), helper_bodies, helper_params, helper_defaults, data.original_placements)

    helper_generator = HelperCodeGenerator(game_name, data.metadata.resolved_settings)
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
                rule_expr = helper_generator._generate_expression(exit_data.access_rule)
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
                rule_expr = helper_generator._generate_expression(loc_data.access_rule)
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

    # Build helper section
    helpers_section = ''
    if helper_functions:
        helpers_section = '\n\n# Helper functions\n' + '\n\n\n'.join(helper_functions) + '\n'

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

    # Build import section
    imports_section = ''
    if rule_builder_imports:
        imports_section = f'\nfrom rule_builder import {rule_builder_imports_str}\n'

    # Add CollectionState import if we have helpers or lambda rules
    collection_state_import = ''
    if has_helpers or needs_lambda:
        collection_state_import = 'from BaseClasses import CollectionState\n'

    # Add math import if needed for sqrt, floor, etc.
    math_import = ''
    if helper_generator.uses_math:
        math_import = 'import math\n'

    # Build helper definitions dict for exporter
    # This stores helper bodies so they can be looked up by name instead of inlined at every call site
    helper_definitions_section = ''
    if helper_bodies:
        helper_defs = {}
        for helper_name, body in helper_bodies.items():
            # Expand nested helper references so body is self-contained
            expanded_body = rule_builder_generator._expand_helper_refs(body)
            # Include params if available for proper argument binding
            if helper_name in helper_params and helper_params[helper_name]:
                helper_defs[helper_name] = {
                    'params': helper_params[helper_name],
                    'body': expanded_body
                }
            else:
                helper_defs[helper_name] = expanded_body

        # Format as Python dict literal using repr() for valid Python syntax
        # (json.dumps produces JSON false/true/null, we need Python False/True/None)
        import pprint
        helper_defs_str = pprint.pformat(helper_defs, indent=4, width=120)
        helper_definitions_section = f'''

# Helper definitions for frontend evaluation
# These are looked up by name instead of being inlined at every call site
_HELPER_DEFINITIONS = {helper_defs_str}


def get_helper_definitions() -> dict:
    """Return helper definitions for frontend evaluation."""
    return _HELPER_DEFINITIONS
'''

    return f'''"""
Access rules for {game_name}.

Auto-generated by world_generator.
"""

from typing import TYPE_CHECKING
{math_import}
{collection_state_import}{imports_section}
if TYPE_CHECKING:
    from BaseClasses import CollectionState
    from worlds.AutoWorld import World
{helpers_section}{helper_definitions_section}

def set_rules(world: "World") -> None:
    """Set access rules for all locations and entrances."""
    player = world.player
    multiworld = world.multiworld
{rules_content}
'''


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


def _generate_option_class(setting_name: str, default_value) -> tuple:
    """Generate an option class for a setting.

    Returns:
        Tuple of (class_code, field_code, import_name) or (None, None, None) if unsupported type.
    """
    class_name = ''.join(word.capitalize() for word in setting_name.split('_'))
    display_name = ' '.join(word.capitalize() for word in setting_name.split('_'))

    if isinstance(default_value, bool):
        class_code = f'''
class {class_name}(Toggle):
    """Option for {display_name}."""
    display_name = "{display_name}"
    default = {default_value}
'''
        return class_code, f'    {setting_name}: {class_name}', 'Toggle'

    if isinstance(default_value, int):
        # Handle negative defaults by adjusting range_start
        range_start = min(0, default_value)
        if default_value <= 10:
            range_end = max(100, default_value * 2)
        elif default_value <= 100:
            range_end = max(100, default_value + 50)
        else:
            range_end = default_value * 2

        class_code = f'''
class {class_name}(Range):
    """Option for {display_name}."""
    display_name = "{display_name}"
    range_start = {range_start}
    range_end = {range_end}
    default = {default_value}
'''
        return class_code, f'    {setting_name}: {class_name}', 'Range'

    return None, None, None


def generate_options_py(data: ExtractedData) -> str:
    """Generate Options.py file content."""
    game_name = data.metadata.game_name
    class_name = sanitize_class_name(game_name)
    resolved_settings = data.metadata.resolved_settings

    used_settings = _collect_rule_settings(data)
    imports_needed = {'Toggle'}  # Always need Toggle for RandomizeItems
    option_classes = []
    option_fields = []

    for setting_name in sorted(used_settings):
        default_value = resolved_settings.get(setting_name, 0)
        class_code, field_code, import_name = _generate_option_class(setting_name, default_value)
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
{option_classes_str}

@dataclass
class {class_name}Options(PerGameCommonOptions):
    """Options for {game_name}."""
    randomize_items: RandomizeItems{option_fields_str}
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
        """Push starting items and disable randomization for seed 1."""
        self._push_starting_items()
        if self.multiworld.seed == 1:
            self.options.randomize_items.value = False
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
                        group = match.group(1)
                        if group:
                            value = int(group)
                        else:
                            value = rule.get("default_value", 1)
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
                        group = match.group(1)
                        if group:
                            value = int(group)
                        else:
                            value = rule.get("default_value", 1)
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
    if data.world_attributes:
        init_attrs = []
        for attr_name, attr_value in data.world_attributes.items():
            # Format the value appropriately
            if isinstance(attr_value, dict):
                # Format dict with integer keys properly (e.g., hat_yarn_costs)
                dict_items = ', '.join(f'{k!r}: {v!r}' for k, v in attr_value.items())
                init_attrs.append(f'        self.{attr_name} = {{{dict_items}}}')
            elif isinstance(attr_value, list):
                init_attrs.append(f'        self.{attr_name} = {attr_value!r}')
            else:
                init_attrs.append(f'        self.{attr_name} = {attr_value!r}')

        init_attrs_content = '\n'.join(init_attrs)
        init_section = f'''
    def __init__(self, multiworld: "MultiWorld", player: int):
        super().__init__(multiworld, player)
        # Game-specific world attributes
{init_attrs_content}
'''

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

    return f'''"""
{game_name} world implementation for Archipelago.

Auto-generated by world_generator.
"""

from typing import ClassVar, Dict, Any, TYPE_CHECKING
from BaseClasses import Item, ItemClassification, Tutorial
from worlds.AutoWorld import WebWorld, World
from rule_builder import RuleWorldMixin

if TYPE_CHECKING:
    from BaseClasses import CollectionState, MultiWorld

from .Items import item_table, {class_name}Item
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
{base_id_section}
    # Disable rule caching - requires CollectionState.rule_cache from PR #5048
    rule_caching_enabled: ClassVar[bool] = False{use_auto_indirect_conditions_section}

    item_name_to_id: ClassVar[Dict[str, int]] = {{
        name: data.id for name, data in item_table.items() if data.id is not None
    }}

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
        return {class_name}Item(name, data.classification, data.id, self.player)

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
