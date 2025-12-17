"""
Data extractors for parsing JSON rules files.

These functions extract structured data from the JSON rules file format
and prepare it for code generation.
"""

import re
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field


def sanitize_identifier(name: str) -> str:
    """Sanitize a name to be a valid Python identifier.

    Removes all characters that are not alphanumeric (keeps letters and digits).
    """
    return re.sub(r'[^a-zA-Z0-9]', '', name)


@dataclass
class TutorialData:
    """Tutorial information."""
    name: str
    description: str
    language: str
    file_name: str
    link: str
    authors: List[str] = field(default_factory=list)


@dataclass
class GameMetadata:
    """Extracted game metadata."""
    game_name: str
    game_directory: str
    world_class_name: str
    archipelago_version: str
    schema_version: int
    base_id: Optional[int] = None
    web_theme: Optional[str] = None
    web_tutorials: List[TutorialData] = field(default_factory=list)
    world_description: Optional[str] = None
    slot_data_fields: Dict[str, Any] = field(default_factory=dict)  # Fields returned by fill_slot_data
    game_options: Dict[str, Any] = field(default_factory=dict)  # Game-specific options from settings
    resolved_settings: Dict[str, Any] = field(default_factory=dict)  # Resolved setting values from seed
    collect_all_items_for_rules: bool = False  # When True, Has() rules check all items, not just progression


@dataclass
class ItemData:
    """Extracted item data."""
    name: str
    item_id: Optional[int]
    classification: str  # 'progression', 'useful', 'trap', 'filler', 'progression_skip_balancing', etc.
    groups: List[str] = field(default_factory=list)
    max_count: int = 1
    is_event: bool = False
    hint_text: Optional[str] = None  # Display name if different from name


@dataclass
class LocationData:
    """Extracted location data."""
    name: str
    location_id: Optional[int]
    region: str
    access_rule: Optional[Dict[str, Any]] = None
    is_event: bool = False
    original_item: Optional[str] = None  # For seed=1 placement
    locked: bool = False  # True if item was placed via place_locked_item
    progress_type: Optional[str] = None  # 'EXCLUDED', 'PRIORITY', or None for DEFAULT
    show_in_spoiler: bool = True  # Whether to show in spoiler log
    access: Optional[Dict[str, Any]] = None  # Game-specific access data (e.g., Lingo AccessRequirements)


@dataclass
class ExitData:
    """Extracted exit/entrance data."""
    name: str
    source_region: str
    target_region: str
    access_rule: Optional[Dict[str, Any]] = None


@dataclass
class RegionData:
    """Extracted region data."""
    name: str
    locations: List[str] = field(default_factory=list)
    exits: List[str] = field(default_factory=list)
    hint_text: Optional[str] = None  # Display name if different from name


def _param_is_used_in_body(param_name: str, body: Any) -> bool:
    """
    Check if a parameter name is referenced anywhere in a rule body.

    Since helper bodies can be fully expanded (with params like 'damaging_items'
    becoming direct item checks), we need to detect unused params and exclude
    them from the function signature to avoid "missing required argument" errors.

    Args:
        param_name: The parameter name to search for
        body: The rule body (dict, list, or primitive)

    Returns:
        True if the param_name appears to be referenced in the body
    """
    if body is None:
        return False

    if isinstance(body, dict):
        # Check for explicit param reference (type: param_ref, variable, etc.)
        if body.get('type') in ('param_ref', 'variable', 'param'):
            if body.get('name') == param_name or body.get('param') == param_name:
                return True
        # Check if param name appears as a value
        for key, value in body.items():
            if key == param_name:
                return True
            if isinstance(value, str) and param_name in value:
                return True
            if _param_is_used_in_body(param_name, value):
                return True
    elif isinstance(body, list):
        for item in body:
            if _param_is_used_in_body(param_name, item):
                return True
    elif isinstance(body, str) and param_name in body:
        return True

    return False


@dataclass
class HelperData:
    """Extracted helper function data."""
    name: str
    params: List[str] = field(default_factory=list)  # Parameters (excluding state/player)
    body: Optional[Dict[str, Any]] = None  # The rule body
    defaults: Dict[str, Any] = field(default_factory=dict)  # Default parameter values


@dataclass
class ExtractedData:
    """All extracted data from a JSON rules file."""
    metadata: GameMetadata
    items: Dict[str, ItemData]
    locations: Dict[str, LocationData]
    regions: Dict[str, RegionData]
    exits: Dict[str, ExitData]
    item_groups: List[str]
    item_name_groups: Dict[str, List[str]]  # group_name -> [item_names]
    start_region: str
    original_placements: Dict[str, str]  # location -> item (from locked items at generation time)
    helpers: Dict[str, HelperData] = field(default_factory=dict)  # Helper function definitions
    itempool_counts: Dict[str, int] = field(default_factory=dict)  # item -> count
    locked_placements: Dict[str, str] = field(default_factory=dict)  # location -> item (must ALWAYS be placed via place_locked_item, e.g., events)
    starting_items: Dict[str, int] = field(default_factory=dict)  # item -> count (precollected items)
    accumulator_rules: List[Dict[str, Any]] = field(default_factory=list)  # Rules for state counters (e.g., coins)
    prog_items_init: Dict[str, int] = field(default_factory=dict)  # Initial values for prog_items counters
    canonical_placements: Dict[str, str] = field(default_factory=dict)  # location -> item (vanilla/original locations from world class)
    progression_mapping: Dict[str, List[str]] = field(default_factory=dict)  # progressive_item -> [component_items] in order


def extract_game_metadata(json_data: Dict[str, Any]) -> GameMetadata:
    """Extract game metadata from JSON."""
    game_name = json_data.get('game_name', 'UnknownGame')

    # Get world class name from the data or derive from game name
    world_classes = json_data.get('world_classes', {})
    world_class_name = None
    if world_classes:
        # Get first player's world class
        world_class_name = list(world_classes.values())[0]

    if not world_class_name:
        # Derive from game name: "My Game" -> "MyGameWorld"
        world_class_name = sanitize_identifier(game_name) + 'World'

    # Extract game_info for player 1 (contains new metadata fields)
    game_info = json_data.get('game_info', {}).get('1', {})

    # Extract base_id
    base_id = game_info.get('base_id')

    # Extract web theme
    web_theme = game_info.get('web_theme')

    # Extract tutorials
    web_tutorials = []
    tutorials_data = game_info.get('web_tutorials', [])
    for t in tutorials_data:
        web_tutorials.append(TutorialData(
            name=t.get('name', ''),
            description=t.get('description', ''),
            language=t.get('language', 'English'),
            file_name=t.get('file_name', ''),
            link=t.get('link', ''),
            authors=t.get('authors', []),
        ))

    # Extract world description (docstring)
    world_description = game_info.get('world_description')

    # Extract slot_data fields
    slot_data_fields = game_info.get('slot_data', {})

    # Extract game options from settings (for generating dynamic fill_slot_data)
    settings = json_data.get('settings', {}).get('1', {})
    game_options = settings.get('options', {})

    # Extract resolved settings for evaluating setting_value nodes in helpers
    # These are the actual values used in the seed, stored at the top level of settings
    # Also include game_options since many setting_value nodes reference world.options.X.value
    resolved_settings = {k: v for k, v in settings.items()
                        if k not in ('game', 'options', 'world_directory', 'assume_bidirectional_exits', 'use_resolved_items')}
    # Merge in game options for settings like goal, castle_skip, etc.
    resolved_settings.update(game_options)

    return GameMetadata(
        game_name=game_name,
        game_directory=json_data.get('game_directory', game_name.lower().replace(' ', '_')),
        world_class_name=world_class_name,
        archipelago_version=json_data.get('archipelago_version', '0.0.0'),
        schema_version=json_data.get('schema_version', 1),
        base_id=base_id,
        web_theme=web_theme,
        web_tutorials=web_tutorials,
        world_description=world_description,
        slot_data_fields=slot_data_fields,
        game_options=game_options,
        resolved_settings=resolved_settings,
        collect_all_items_for_rules=settings.get('collect_all_items_for_rules', False),
    )


def _determine_classification(item_data: Dict[str, Any]) -> str:
    """Determine item classification from JSON data.

    First checks for the new 'classification' field, then falls back to
    legacy boolean flags for backwards compatibility.
    """
    # New format: direct classification string
    if 'classification' in item_data:
        return item_data['classification']

    # Legacy format: boolean flags (for backwards compatibility)
    if item_data.get('event', False):
        return 'progression'
    if item_data.get('trap', False):
        return 'trap'
    if item_data.get('advancement', False):
        return 'progression'
    if item_data.get('useful', False):
        return 'useful'
    return 'filler'


def extract_items(json_data: Dict[str, Any]) -> Tuple[Dict[str, ItemData], List[str], Dict[str, List[str]]]:
    """
    Extract items and item groups from JSON.

    Returns:
        Tuple of (items dict, item_groups list, item_name_groups dict)
    """
    items: Dict[str, ItemData] = {}
    item_groups: List[str] = []
    item_name_groups: Dict[str, List[str]] = {}

    # Get items for player 1
    items_data = json_data.get('items', {}).get('1', {})

    for item_name, item_info in items_data.items():
        item_id = item_info.get('id')
        is_event = item_id is None or item_info.get('event', False)
        groups = item_info.get('groups', [])
        hint_text = item_info.get('hint_text')  # Only set if different from name

        items[item_name] = ItemData(
            name=item_name,
            item_id=item_id,
            classification=_determine_classification(item_info),
            groups=groups,
            max_count=item_info.get('max_count', 1),
            is_event=is_event,
            hint_text=hint_text,
        )

        # Build item_name_groups mapping
        for group in groups:
            if group not in item_name_groups:
                item_name_groups[group] = []
            item_name_groups[group].append(item_name)

    # Get item groups
    groups_data = json_data.get('item_groups', {}).get('1', [])
    item_groups = list(groups_data) if groups_data else []

    return items, item_groups, item_name_groups


def extract_locations(json_data: Dict[str, Any]) -> Tuple[Dict[str, LocationData], Dict[str, str], Dict[str, str]]:
    """
    Extract locations from JSON regions.

    Returns:
        Tuple of (locations dict, original_placements dict, locked_placements dict)
    """
    locations: Dict[str, LocationData] = {}
    original_placements: Dict[str, str] = {}
    locked_placements: Dict[str, str] = {}

    regions_data = json_data.get('regions', {}).get('1', {})

    for region_name, region_info in regions_data.items():
        for loc_info in region_info.get('locations', []):
            loc_name = loc_info.get('name', '')
            loc_id = loc_info.get('id')
            is_event = loc_id is None
            is_locked = loc_info.get('locked', False)
            progress_type = loc_info.get('progress_type')  # 'EXCLUDED', 'PRIORITY', or None
            show_in_spoiler = loc_info.get('show_in_spoiler', True)

            locations[loc_name] = LocationData(
                name=loc_name,
                location_id=loc_id,
                region=region_name,
                access_rule=loc_info.get('access_rule'),
                is_event=is_event,
                locked=is_locked,
                progress_type=progress_type,
                show_in_spoiler=show_in_spoiler,
                access=loc_info.get('access'),  # Game-specific access data (e.g., Lingo AccessRequirements)
            )

            # Track original item placement for seed=1 mode
            item_info = loc_info.get('item')
            if item_info:
                item_name = item_info.get('name', '')
                original_placements[loc_name] = item_name
                # If the location is locked, also track it as a locked placement
                if is_locked and item_name:
                    locked_placements[loc_name] = item_name

    return locations, original_placements, locked_placements


def extract_regions(json_data: Dict[str, Any]) -> Tuple[Dict[str, RegionData], Dict[str, ExitData]]:
    """
    Extract regions and exits from JSON.

    Returns:
        Tuple of (regions dict, exits dict)
    """
    regions: Dict[str, RegionData] = {}
    exits: Dict[str, ExitData] = {}

    regions_data = json_data.get('regions', {}).get('1', {})

    for region_name, region_info in regions_data.items():
        location_names = [loc.get('name', '') for loc in region_info.get('locations', [])]
        exit_names = [exit_info.get('name', '') for exit_info in region_info.get('exits', [])]
        hint_text = region_info.get('hint_text')  # Only set if different from name

        regions[region_name] = RegionData(
            name=region_name,
            locations=location_names,
            exits=exit_names,
            hint_text=hint_text,
        )

        # Extract exits
        for exit_info in region_info.get('exits', []):
            exit_name = exit_info.get('name', '')
            exits[exit_name] = ExitData(
                name=exit_name,
                source_region=region_name,
                target_region=exit_info.get('connected_region', ''),
                access_rule=exit_info.get('access_rule'),
            )

    # Create missing regions that are referenced by exits but not defined
    # This handles cases where exits connect to regions that aren't top-level
    for exit_data in exits.values():
        target = exit_data.target_region
        if target and target not in regions:
            regions[target] = RegionData(
                name=target,
                locations=[],
                exits=[],
                hint_text=None,
            )

    return regions, exits


def extract_start_region(json_data: Dict[str, Any]) -> str:
    """Extract the starting region name."""
    start_regions = json_data.get('start_regions', {}).get('1', {})
    default_starts = start_regions.get('default', [])

    if default_starts:
        return str(default_starts[0])

    # Fallback to Menu if it exists
    regions = json_data.get('regions', {}).get('1', {})
    if 'Menu' in regions:
        return 'Menu'

    # Return first region as fallback
    if regions:
        return str(list(regions.keys())[0])

    return 'Menu'


def extract_itempool_counts(json_data: Dict[str, Any]) -> Dict[str, int]:
    """
    Extract item pool counts from JSON.

    The itempool_counts field contains the actual number of each item
    that should be created in the item pool.

    Returns:
        Dict mapping item name to count
    """
    itempool_counts: Dict[str, int] = {}

    # Get itempool_counts for player 1
    counts_data = json_data.get('itempool_counts', {}).get('1', {})

    for item_name, count in counts_data.items():
        if isinstance(count, int) and count > 0:
            itempool_counts[item_name] = count

    return itempool_counts


def extract_starting_items(json_data: Dict[str, Any]) -> Dict[str, int]:
    """Extract starting items from JSON (precollected items)."""
    starting = {}
    starting_data = json_data.get('starting_items', {}).get('1', [])

    for item in starting_data:
        if isinstance(item, str):
            starting[item] = starting.get(item, 0) + 1
        elif isinstance(item, dict):
            name = item.get('name', '')
            count = item.get('count', 1)
            if name:
                starting[name] = starting.get(name, 0) + count

    return starting


def extract_canonical_placements(json_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Extract canonical placements from JSON.

    Canonical placements are the vanilla/original item locations as defined
    by the world class. These are used for seed=1 mode to place items in
    their original positions.

    Returns:
        Dict mapping location name to item name
    """
    canonical_data = json_data.get('canonical_placements', {}).get('1', {})
    return dict(canonical_data)


def extract_progression_mapping(json_data: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Extract progression mapping from JSON.

    Progression mapping defines how progressive items map to their component items.
    For example, 'progressive-processing' might map to ['steel-processing', 'oil-processing', ...].
    When a progressive item is collected, it grants access to the next uncollected component.

    Returns:
        Dict mapping progressive item name to ordered list of component item names
    """
    progression_data = json_data.get('progression_mapping', {}).get('1', {})
    result: Dict[str, List[str]] = {}

    for prog_name, prog_info in progression_data.items():
        # Skip additive type mappings - they use a different format and are handled
        # separately by compute_state_counter_accumulator_rules
        if prog_info.get('type') == 'additive':
            continue

        # prog_info has structure: {'items': [{'name': '...', 'level': N}, ...], 'base_item': '...'}
        items_list = prog_info.get('items', [])

        # Ensure items_list is actually a list (not a dict from additive mappings)
        if not isinstance(items_list, list):
            continue

        # Sort by level to ensure correct order
        sorted_items = sorted(items_list, key=lambda x: x.get('level', 0))
        component_names = [item.get('name') for item in sorted_items if item.get('name')]
        if component_names:
            result[prog_name] = component_names

    return result


def compute_state_counter_accumulator_rules(
    items: Dict[str, 'ItemData'],
    original_placements: Dict[str, str]
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """
    Compute accumulator rules and prog_items_init for state counter patterns.

    Some games (like DLCQuest) use state counters where collecting items like
    "60 coins" contributes to a " coins" counter. The rules check Has(" coins", X)
    but the actual items collected are "60 coins", "4 coins", etc.

    Instead of precollecting all items (which breaks sphere progression), this
    generates accumulator_rules that tell the frontend how to parse item names
    and accumulate values into counters.

    Returns:
        Tuple of (accumulator_rules, prog_items_init)
        - accumulator_rules: List of rule dicts with pattern, extract_value, target
        - prog_items_init: Dict mapping counter names to initial value (0)
    """
    accumulator_rules = []
    prog_items_init = {}

    # Find items that are used in rules but have id=None (event/counter items)
    # and have a name pattern like " coins" or " coins freemium"
    # Use a list to preserve input order for deterministic output
    counter_items = []
    for item_name, item_data in items.items():
        if item_data.item_id is None and item_name.startswith(' '):
            # This looks like a counter item (e.g., " coins")
            if item_name not in counter_items:
                counter_items.append(item_name)

    if not counter_items:
        return accumulator_rules, prog_items_init

    # For each counter, find items that contribute to it and build a regex pattern
    # Check both the items dict and original_placements for matching items
    for counter_name in counter_items:
        suffix = counter_name.strip()  # e.g., "coins" from " coins"

        # Check if there are items matching the pattern "N <suffix>"
        has_matching_items = False

        # Check in items dict
        for item_name in items.keys():
            if item_name.endswith(suffix) and item_name != counter_name:
                try:
                    parts = item_name.split()
                    if len(parts) >= 2 and parts[-1] == suffix:
                        int(parts[0])  # Verify it's a number
                        has_matching_items = True
                        break
                except (ValueError, IndexError):
                    pass

        # Also check in original_placements
        if not has_matching_items:
            for loc_name, item_name in original_placements.items():
                if item_name.endswith(suffix) and item_name != counter_name:
                    try:
                        parts = item_name.split()
                        if len(parts) >= 2 and parts[-1] == suffix:
                            int(parts[0])  # Verify it's a number
                            has_matching_items = True
                            break
                    except (ValueError, IndexError):
                        pass

        if has_matching_items:
            # Generate regex pattern: ^(\d+) suffix$ (handles singular/plural)
            # Use word boundary or space before suffix to avoid partial matches
            if suffix.endswith('s'):
                # e.g., "coins" -> match "coin" or "coins"
                pattern = f'^(\\d+) {suffix[:-1]}s?$'
            else:
                pattern = f'^(\\d+) {suffix}s?$'

            accumulator_rules.append({
                'pattern': pattern,
                'extract_value': True,
                'target': counter_name,
                'discriminator': None
            })
            prog_items_init[counter_name] = 0

    return accumulator_rules, prog_items_init


def extract_helpers(json_data: Dict[str, Any]) -> Dict[str, HelperData]:
    """
    Extract helper function definitions from JSON.

    Helpers are stored in rules.json in two formats:
    1. Simple helpers (no params): Just a rule body directly
       {"can_stack": {"type": "item_check", "item": "Stacker"}}

    2. Parameterized helpers: Have params, body, and optional defaults
       {"has_x_belt_multiplier": {"params": ["needed"], "body": {...}, "defaults": {...}}}

    Returns:
        Dict mapping helper name to HelperData
    """
    helpers: Dict[str, HelperData] = {}
    helpers_data = json_data.get('helpers', {}).get('1', {})

    for helper_name, helper_def in helpers_data.items():
        if not isinstance(helper_def, dict):
            continue

        if 'params' in helper_def or 'body' in helper_def:
            # Parameterized helper with explicit params/body structure
            raw_params = helper_def.get('params', [])
            body = helper_def.get('body', helper_def)
            defaults = helper_def.get('defaults', {})

            # Filter out params that are not actually used in the body
            # This handles cases where the body was expanded and no longer
            # references the original parameter (e.g., _has_damaging_item)
            used_params = [p for p in raw_params if _param_is_used_in_body(p, body)]

            # Also filter defaults to only include used params
            used_defaults = {k: v for k, v in defaults.items() if k in used_params}

            helpers[helper_name] = HelperData(
                name=helper_name,
                params=used_params,
                body=body,
                defaults=used_defaults
            )
        else:
            # Simple helper - the entire helper_def is the body
            helpers[helper_name] = HelperData(
                name=helper_name,
                params=[],
                body=helper_def,
                defaults={}
            )

    return helpers


def extract_all(json_data: Dict[str, Any]) -> ExtractedData:
    """
    Extract all data from a JSON rules file.

    Args:
        json_data: Parsed JSON rules file

    Returns:
        ExtractedData containing all extracted information
    """
    metadata = extract_game_metadata(json_data)
    items, item_groups, item_name_groups = extract_items(json_data)
    locations, original_placements, locked_placements = extract_locations(json_data)
    regions, exits = extract_regions(json_data)
    start_region = extract_start_region(json_data)
    itempool_counts = extract_itempool_counts(json_data)
    helpers = extract_helpers(json_data)

    # Get starting items from JSON
    starting_items = extract_starting_items(json_data)

    # Get canonical placements from JSON (vanilla/original item locations)
    canonical_placements = extract_canonical_placements(json_data)

    # Get progression mapping for progressive items (e.g., progressive-processing -> [steel-processing, oil-processing, ...])
    progression_mapping = extract_progression_mapping(json_data)

    # Compute accumulator rules for state counter patterns (for frontend export)
    accumulator_rules, prog_items_init = compute_state_counter_accumulator_rules(items, original_placements)

    # For games with state counters, we also need to precollect counter items
    # for generation to work (rules check Has(" coins", X) which needs items in inventory)
    # The exporter will filter these out from starting_items since the frontend
    # uses accumulator_rules instead. But we DO need to set prog_items_init to the
    # same total so the test world's sphere 0 matches the original sphere log.
    if accumulator_rules:
        # Calculate total for each counter from items in original_placements
        for rule in accumulator_rules:
            import re
            pattern = rule['pattern']
            target = rule['target']
            total = 0
            for loc_name, item_name in original_placements.items():
                match = re.match(pattern, item_name)
                if match:
                    try:
                        value = int(match.group(1))
                        total += value
                    except (ValueError, IndexError):
                        pass
            if total > 0:
                starting_items[target] = starting_items.get(target, 0) + total
                # Also update prog_items_init so the frontend test world matches
                # the original sphere log (which has the precollected total at sphere 0)
                prog_items_init[target] = total

    # Extract QP items for OSRS-like games that have quest points
    # Pattern: "N QP (Quest Name)" where N is the quest point value
    import re
    qp_pattern = re.compile(r'^(\d+)\s*QP\s*\((.+)\)$')
    qp_items = {}
    for item_name in items.keys():
        match = qp_pattern.match(item_name)
        if match:
            qp_value = int(match.group(1))
            qp_items[item_name] = qp_value
    if qp_items:
        metadata.resolved_settings['qp_items'] = qp_items

    return ExtractedData(
        metadata=metadata,
        items=items,
        locations=locations,
        regions=regions,
        exits=exits,
        item_groups=item_groups,
        item_name_groups=item_name_groups,
        start_region=start_region,
        original_placements=original_placements,
        helpers=helpers,
        itempool_counts=itempool_counts,
        locked_placements=locked_placements,
        starting_items=starting_items,
        accumulator_rules=accumulator_rules,
        prog_items_init=prog_items_init,
        canonical_placements=canonical_placements,
        progression_mapping=progression_mapping,
    )
