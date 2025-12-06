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
class GameMetadata:
    """Extracted game metadata."""
    game_name: str
    game_directory: str
    world_class_name: str
    archipelago_version: str
    schema_version: int


@dataclass
class ItemData:
    """Extracted item data."""
    name: str
    item_id: Optional[int]
    classification: str  # 'progression', 'useful', 'trap', 'filler'
    groups: List[str] = field(default_factory=list)
    max_count: int = 1
    is_event: bool = False


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
    original_placements: Dict[str, str]  # location -> item
    itempool_counts: Dict[str, int] = field(default_factory=dict)  # item -> count
    locked_placements: Dict[str, str] = field(default_factory=dict)  # location -> item (must be placed via place_locked_item)
    starting_items: Dict[str, int] = field(default_factory=dict)  # item -> count (precollected items)
    accumulator_rules: List[Dict[str, Any]] = field(default_factory=list)  # Rules for state counters (e.g., coins)
    prog_items_init: Dict[str, int] = field(default_factory=dict)  # Initial values for prog_items counters


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

    return GameMetadata(
        game_name=game_name,
        game_directory=json_data.get('game_directory', game_name.lower().replace(' ', '_')),
        world_class_name=world_class_name,
        archipelago_version=json_data.get('archipelago_version', '0.0.0'),
        schema_version=json_data.get('schema_version', 1),
    )


def _determine_classification(item_data: Dict[str, Any]) -> str:
    """Determine item classification from JSON flags."""
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

        items[item_name] = ItemData(
            name=item_name,
            item_id=item_id,
            classification=_determine_classification(item_info),
            groups=groups,
            max_count=item_info.get('max_count', 1),
            is_event=is_event,
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

            locations[loc_name] = LocationData(
                name=loc_name,
                location_id=loc_id,
                region=region_name,
                access_rule=loc_info.get('access_rule'),
                is_event=is_event,
                locked=is_locked,
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

        regions[region_name] = RegionData(
            name=region_name,
            locations=location_names,
            exits=exit_names,
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
    counter_items = set()
    for item_name, item_data in items.items():
        if item_data.item_id is None and item_name.startswith(' '):
            # This looks like a counter item (e.g., " coins")
            counter_items.add(item_name)

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

    # Get starting items from JSON
    starting_items = extract_starting_items(json_data)

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
        itempool_counts=itempool_counts,
        locked_placements=locked_placements,
        starting_items=starting_items,
        accumulator_rules=accumulator_rules,
        prog_items_init=prog_items_init,
    )
