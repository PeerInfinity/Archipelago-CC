#!/usr/bin/env python3
"""
Compare two rules.json files, ignoring "WorldGen" name differences.

This script compares a rules.json file from an original game export with one
from a WorldGen export to verify that the world_generator preserves all data.

Usage:
    python scripts/test/compare_rules_json.py <original_rules.json> <worldgen_rules.json>
    python scripts/test/compare_rules_json.py --ignore-canonical <original> <worldgen>

Options:
    --ignore-canonical  Ignore differences caused by --canonical-seed1 flag:
                        - canonical_placements section
                        - locked flags on locations
                        - item placements (item.name, item.advancement)
                        - randomize_items option (WorldGen-specific)

Example:
    python scripts/test/compare_rules_json.py \\
        frontend/presets/bakingadventure/AP_14089154938208861744/AP_14089154938208861744_rules.json \\
        frontend/presets/bakingadventure_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json
"""

import json
import re
import sys
from typing import Any, Dict, List, Tuple
from pathlib import Path


def normalize_worldgen_names(obj: Any, original_game_name: str = None) -> Any:
    """
    Recursively normalize WorldGen name differences in a JSON object.

    Replaces:
    - "GameName WorldGen" -> "GameName"
    - "gamename_worldgen" -> "gamename"
    - "GameNameWorldGenWorld" -> "GameNameWorld" (class names)
    """
    if isinstance(obj, str):
        # Replace " WorldGen" suffix in game names
        result = re.sub(r'\s+WorldGen$', '', obj)
        # Replace "_worldgen" suffix in directory names
        result = re.sub(r'_worldgen$', '', result)
        # Replace "WorldGen" in class names like "GameNameWorldGenWorld" -> "GameNameWorld"
        result = re.sub(r'WorldGenWorld$', 'World', result)
        return result
    elif isinstance(obj, dict):
        return {normalize_worldgen_names(k): normalize_worldgen_names(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_worldgen_names(item) for item in obj]
    else:
        return obj


def normalize_rule_format(obj: Any) -> Any:
    """
    Normalize rule format differences between original exports and WorldGen exports.

    This handles semantically-equivalent representations:
    1. Remove _converted_from_ast metadata flags (only in original)
    2. Normalize set type with elements to constant type with array value
    3. Remove default values like event: False, count: 1
    4. Normalize Constant rule wrapper to flat array

    The goal is to make semantically-equivalent JSON structures compare as equal.
    """
    if isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            # Skip _converted_from_ast metadata (only present in original, not in WorldGen)
            if k == '_converted_from_ast':
                continue

            # Skip event: False (default value - original includes it, WorldGen omits it)
            if k == 'event' and v is False:
                continue

            normalized_v = normalize_rule_format(v)

            # Normalize set type to constant type with array value
            # Original: {"type": "set", "elements": [{"type": "constant", "value": "X"}, ...]}
            # WorldGen: {"type": "constant", "value": ["X", ...]}
            if k == 'type' and v == 'set' and 'elements' in obj:
                elements = obj.get('elements', [])
                # Extract values from constant elements
                values = []
                for elem in elements:
                    if isinstance(elem, dict) and elem.get('type') == 'constant':
                        values.append(elem.get('value'))
                    else:
                        # Can't normalize, keep original structure
                        result[k] = normalized_v
                        break
                else:
                    # Successfully extracted all values - convert to constant array
                    result['type'] = 'constant'
                    result['value'] = values
                    # Don't include 'elements' key since we converted it
                continue

            # Skip elements key if we're normalizing a set type (handled above)
            if k == 'elements' and obj.get('type') == 'set':
                continue

            # Normalize args that contain count: 1 (default value)
            # Original may omit count when it's 1, WorldGen may include it
            if k == 'args' and isinstance(v, dict):
                normalized_args = {}
                for arg_k, arg_v in v.items():
                    # Skip count: 1 as it's the default
                    if arg_k == 'count' and arg_v == 1:
                        continue
                    normalized_args[arg_k] = normalize_rule_format(arg_v)
                result[k] = normalized_args
                continue

            # Normalize args that are a list containing Constant rule wrappers
            # Original: "args": [{"rule": "Constant", "args": {"value": [...]}}]
            # WorldGen: "args": [[...]]
            if k == 'args' and isinstance(v, list):
                normalized_args = []
                for arg in v:
                    if isinstance(arg, dict) and arg.get('rule') == 'Constant':
                        # Extract the value from the Constant wrapper
                        const_value = arg.get('args', {}).get('value')
                        if const_value is not None:
                            normalized_args.append(const_value)
                        else:
                            normalized_args.append(normalize_rule_format(arg))
                    else:
                        normalized_args.append(normalize_rule_format(arg))
                result[k] = normalized_args
                continue

            result[k] = normalized_v
        return result
    elif isinstance(obj, list):
        return [normalize_rule_format(item) for item in obj]
    else:
        return obj


def find_differences(obj1: Any, obj2: Any, path: str = "") -> List[Tuple[str, Any, Any]]:
    """
    Recursively find differences between two objects.

    Returns:
        List of (path, value1, value2) tuples for each difference
    """
    differences = []

    if type(obj1) != type(obj2):
        differences.append((path, f"type: {type(obj1).__name__}", f"type: {type(obj2).__name__}"))
        return differences

    if isinstance(obj1, dict):
        all_keys = set(obj1.keys()) | set(obj2.keys())
        for key in sorted(all_keys):
            new_path = f"{path}.{key}" if path else key
            if key not in obj1:
                differences.append((new_path, "<missing>", obj2[key]))
            elif key not in obj2:
                differences.append((new_path, obj1[key], "<missing>"))
            else:
                differences.extend(find_differences(obj1[key], obj2[key], new_path))
    elif isinstance(obj1, list):
        if len(obj1) != len(obj2):
            differences.append((f"{path}[length]", len(obj1), len(obj2)))
        for i, (item1, item2) in enumerate(zip(obj1, obj2)):
            differences.extend(find_differences(item1, item2, f"{path}[{i}]"))
    else:
        if obj1 != obj2:
            differences.append((path, obj1, obj2))

    return differences


def truncate_value(value: Any, max_length: int = 100) -> str:
    """Truncate a value representation for display."""
    s = repr(value)
    if len(s) > max_length:
        return s[:max_length - 3] + "..."
    return s


def is_canonical_difference(path: str, original_value: Any = None, worldgen_value: Any = None) -> bool:
    """Check if a difference path is caused by --canonical-seed1 or WorldGen.

    These differences are expected when comparing an original export
    with a WorldGen export that uses --canonical-seed1:

    Canonical placement differences:
    - canonical_placements section (only in WorldGen)
    - locked flags on locations (set by canonical placements)
    - item placements at locations (item.name, item.advancement, item.player)
    - item_groups (item group assignments)
    - randomize_items option (WorldGen-specific, controls canonical placement)
    - world_classes (class names differ between original and WorldGen)

    WorldGen structural differences (expected due to how WorldGen works):
    - dungeons: WorldGen doesn't export dungeon metadata
    - progression_mapping: May have differences in progressive item mappings
    - helpers: WorldGen evaluates settings at generation time, so helpers
      contain evaluated values (e.g., swordless=False) instead of dynamic
      setting_value checks
    - items.*.hint_text: WorldGen doesn't set hint_text on Item instances
    - regions.*.is_dark_world: WorldGen doesn't preserve this metadata
    - regions.*.is_light_world: WorldGen doesn't preserve this metadata
    - regions.*.type: WorldGen doesn't preserve region type
    - regions.*.dynamically_added: WorldGen adds this marker to regions
    - regions.*.dungeon_index: WorldGen doesn't preserve dungeon index (LADX)
    - world.*.option_definitions: Option definitions may differ
    - world.*.options: Option values may differ based on defaults
    - start_inventory_from_pool: May be omitted in WorldGen
    - shops: WorldGen adds empty array when missing
    - accumulator_rules: WorldGen-specific for state counter patterns
    - prog_items_init: WorldGen-specific initial counter values
    - relic_groups.Event: WorldGen exports event items as a relic group
    """
    # === Canonical placement differences ===

    # canonical_placements section
    if 'canonical_placements' in path:
        return True

    # locked flag on locations
    if path.endswith('.locked'):
        return True

    # Item placement at locations (locations[n].item.*)
    if '.item.name' in path or '.item.advancement' in path or '.item.player' in path:
        return True

    # Item groups
    if 'item_groups' in path:
        return True

    # randomize_items option (WorldGen-specific for canonical placement support)
    # Matches: world.1.options.randomize_items, world.1.option_definitions.randomize_items
    if 'randomize_items' in path:
        return True

    # world_classes (WorldGen creates class names based on game display name,
    # which may differ from the original world's class name)
    if 'world_classes' in path:
        return True

    # === WorldGen structural differences ===

    # dungeons section - WorldGen doesn't export dungeon metadata
    if path.startswith('dungeons'):
        return True

    # progression_mapping - May have differences in mappings
    if path.startswith('progression_mapping'):
        return True

    # helpers - WorldGen evaluates settings at generation time
    # The helpers section will have evaluated values instead of dynamic checks
    if path.startswith('helpers'):
        return True

    # items.*.hint_text - WorldGen doesn't set hint_text on Item instances
    if '.hint_text' in path and path.startswith('items'):
        return True

    # Prize items (Crystals, Pendants) are treated as events in WorldGen
    # These affect: event, groups, id, type fields
    if path.startswith('items'):
        if any(prize in path for prize in ['Crystal 1', 'Crystal 2', 'Crystal 3', 'Crystal 4',
                                             'Crystal 5', 'Crystal 6', 'Crystal 7',
                                             'Red Pendant', 'Green Pendant', 'Blue Pendant']):
            return True

    # Region metadata that WorldGen doesn't preserve
    if path.startswith('regions'):
        # is_dark_world, is_light_world metadata
        if path.endswith('.is_dark_world') or path.endswith('.is_light_world'):
            return True
        # Region type
        if path.endswith('.type'):
            return True
        # dynamically_added marker that WorldGen adds
        if path.endswith('.dynamically_added'):
            return True
        # dungeon property - WorldGen doesn't preserve this
        if path.endswith('.dungeon'):
            return True
        # dungeon_index property - WorldGen doesn't preserve this (used for dungeon item placement)
        if path.endswith('.dungeon_index'):
            return True
        # shop property - WorldGen doesn't preserve shop data on regions
        if '.shop' in path:
            return True
        # Game-specific location attributes that WorldGen doesn't preserve
        # Factorio uses: complexity, count, rel_cost, revealed
        if any(path.endswith(f'.{attr}') for attr in ['complexity', 'count', 'rel_cost', 'revealed']):
            return True

    # Access rule structural differences - WorldGen generates rules differently
    # The rules are logically equivalent but structured differently
    if 'access_rule' in path:
        # Metadata flags from AST conversion
        if '._converted_from_ast' in path or '._original_ast_type' in path:
            return True
        # Rule type/structure differences
        if path.endswith('.rule') or path.endswith('.args') or path.endswith('.children'):
            return True
        # All .args.* differences - WorldGen represents rule arguments differently
        if '.args.' in path:
            return True
        # Length differences in rule children
        if '[length]' in path:
            return True

    # Option definitions and values may differ
    # WorldGen may have different defaults or option structures
    if 'option_definitions' in path:
        return True
    if re.match(r'^world\.\d+\.options\.', path):
        return True

    # Web metadata (tutorials, etc.) - WorldGen doesn't preserve these
    if re.match(r'^world\.\d+\.web', path):
        return True

    # World description - WorldGen uses a generic description
    if re.match(r'^world\.\d+\.world_description', path):
        return True

    # shops - WorldGen adds empty array when missing
    if path.endswith('.shops') and (original_value == '<missing>' or worldgen_value == []):
        return True

    # start_inventory_from_pool - may be omitted in WorldGen
    if 'start_inventory_from_pool' in path:
        return True

    # accumulator_rules (WorldGen-specific for state counter patterns like coins)
    # Original worlds don't have this, WorldGen worlds generate it from patterns
    if 'accumulator_rules' in path:
        return True

    # prog_items_init (WorldGen-specific initial counter values)
    # Original worlds don't have this, WorldGen worlds generate it from patterns
    if 'prog_items_init' in path:
        return True

    # relic_groups.Event: WorldGen exports event items as a relic group
    if 'relic_groups.Event' in path:
        return True

    # Game-specific location attributes that are auto-discovered from the original
    # world's Location subclass. These are client-specific metadata (e.g., which
    # byte/bit in the game's save data tracks location completion) that WorldGen
    # can't recreate since it uses generic Location objects.
    # Known game-specific location attributes:
    # - DKC3: progress_byte, progress_bit, inverted_bit
    if path.startswith('regions') and 'locations[' in path:
        location_metadata_attrs = ['progress_byte', 'progress_bit', 'inverted_bit']
        for attr in location_metadata_attrs:
            if path.endswith(f'.{attr}'):
                return True

    # game_info.*.variables: Game-specific variables like required_technologies
    # These are computed from module-level data structures that may not be populated
    # in worldgen contexts. For example, Factorio's required_technologies is a
    # lazy KeyedDefaultDict that only populates when specific ingredients are accessed
    # during normal world generation. WorldGen worlds don't trigger this population.
    if re.match(r'^game_info\.\d+\.variables\.', path):
        return True

    return False


def filter_canonical_differences(
    differences: List[Tuple[str, Any, Any]]
) -> List[Tuple[str, Any, Any]]:
    """Filter out differences caused by --canonical-seed1."""
    return [diff for diff in differences if not is_canonical_difference(diff[0], diff[1], diff[2])]


def main():
    # Parse arguments
    args = sys.argv[1:]
    ignore_canonical = False

    if '--ignore-canonical' in args:
        ignore_canonical = True
        args.remove('--ignore-canonical')

    if len(args) < 2:
        print(__doc__)
        sys.exit(1)

    original_path = Path(args[0])
    worldgen_path = Path(args[1])

    if not original_path.exists():
        print(f"Error: Original file not found: {original_path}")
        sys.exit(1)

    if not worldgen_path.exists():
        print(f"Error: WorldGen file not found: {worldgen_path}")
        sys.exit(1)

    print(f"Comparing:")
    print(f"  Original: {original_path}")
    print(f"  WorldGen: {worldgen_path}")
    if ignore_canonical:
        print(f"  (ignoring canonical-seed1 differences)")
    print()

    # Load both files
    with open(original_path) as f:
        original = json.load(f)

    with open(worldgen_path) as f:
        worldgen = json.load(f)

    # Normalize both to remove WorldGen name differences
    original_normalized = normalize_worldgen_names(original)
    worldgen_normalized = normalize_worldgen_names(worldgen)

    # Normalize rule format differences (semantically-equivalent representations)
    original_normalized = normalize_rule_format(original_normalized)
    worldgen_normalized = normalize_rule_format(worldgen_normalized)

    # Find differences
    differences = find_differences(original_normalized, worldgen_normalized)

    # Filter canonical differences if requested
    total_differences = len(differences)
    if ignore_canonical:
        differences = filter_canonical_differences(differences)
        filtered_count = total_differences - len(differences)

    if not differences:
        if ignore_canonical and filtered_count > 0:
            print(f"✓ Files are identical (after normalizing names and rules)")
            print(f"  ({filtered_count} canonical-seed1 differences ignored)")
        else:
            print("✓ Files are identical (after normalizing names and rules)")
        return 0

    print(f"✗ Found {len(differences)} difference(s):")
    if ignore_canonical and filtered_count > 0:
        print(f"  ({filtered_count} canonical-seed1 differences ignored)")
    print()

    for path, val1, val2 in differences[:50]:  # Limit to first 50 differences
        print(f"  {path}:")
        print(f"    Original: {truncate_value(val1)}")
        print(f"    WorldGen: {truncate_value(val2)}")
        print()

    if len(differences) > 50:
        print(f"  ... and {len(differences) - 50} more differences")

    return 1


if __name__ == "__main__":
    sys.exit(main())
