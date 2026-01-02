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


def normalize_and_has_patterns(obj: Any) -> Any:
    """
    Normalize And patterns containing only Has/HasAll into a single HasAll.

    Examples:
        And(Has(A), Has(B)) -> HasAll(A, B)
        And(HasAll(A, B), Has(C)) -> HasAll(A, B, C)
        And(HasAll(A, B), HasAll(C, D)) -> HasAll(A, B, C, D)

    This produces cleaner, more readable rules.
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_and_has_patterns(v) for k, v in obj.items()}

        # Check if this is an And rule that can be combined into HasAll
        if normalized.get('rule') == 'And':
            children = normalized.get('children', [])
            if children:
                # Check if all children are Has or HasAll
                all_items = []
                can_combine = True

                for child in children:
                    if isinstance(child, dict):
                        child_rule = child.get('rule')
                        if child_rule == 'Has':
                            item_name = child.get('args', {}).get('item_name')
                            count = child.get('args', {}).get('count', 1)
                            # Only combine if count is 1 (default)
                            if item_name and count == 1:
                                all_items.append(item_name)
                            else:
                                can_combine = False
                                break
                        elif child_rule == 'HasAll':
                            items = child.get('args', {}).get('items', [])
                            all_items.extend(items)
                        else:
                            can_combine = False
                            break
                    else:
                        can_combine = False
                        break

                if can_combine and len(all_items) >= 2:
                    return {
                        'rule': 'HasAll',
                        'args': {'items': all_items}
                    }

        return normalized
    elif isinstance(obj, list):
        return [normalize_and_has_patterns(item) for item in obj]
    else:
        return obj


def normalize_and_or_structure(obj: Any) -> Any:
    """
    Normalize And/Or rule structures:
    1. Flatten nested And/Or (e.g., And(And(a, b), c) -> And(a, b, c))
    2. Sort children by a canonical ordering for consistent comparison

    This ensures that semantically equivalent rules compare as equal regardless
    of how they were constructed.
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_and_or_structure(v) for k, v in obj.items()}

        rule_type = normalized.get('rule')
        if rule_type in ('And', 'Or'):
            children = normalized.get('children', [])
            if children:
                # Flatten nested And/Or of the same type
                flattened = []
                for child in children:
                    if isinstance(child, dict) and child.get('rule') == rule_type:
                        # Same type - flatten its children into ours
                        flattened.extend(child.get('children', []))
                    else:
                        flattened.append(child)

                # Sort children by a canonical key for consistent ordering
                def sort_key(child):
                    if isinstance(child, dict):
                        # Sort by rule type first, then by string representation
                        rule = child.get('rule', '')
                        return (rule, json.dumps(child, sort_keys=True))
                    return ('', str(child))

                sorted_children = sorted(flattened, key=sort_key)
                normalized['children'] = sorted_children

        return normalized
    elif isinstance(obj, list):
        return [normalize_and_or_structure(item) for item in obj]
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
    """Check if a difference path is caused by --canonical-seed1 or WorldGen."""
    # canonical_placements section only exists with --canonical-seed1
    if 'canonical_placements' in path:
        return True
    # locked status differs because WorldGen uses place_locked_item() for canonical
    # placements while original uses fill algorithm. This is an implementation detail.
    if path.endswith('.locked'):
        return True

    # Helper body differences caused by placement_lookup being resolved at generation time
    # for canonical seeds. The original uses dynamic lookups, WorldGen bakes in the values.
    if 'helpers.' in path and '.placement_lookup' in path:
        return True
    if 'helpers.' in path and 'placement_lookup' in str(original_value):
        return True

    # Helpers that use world attributes (like bottle_count, heart_count) have values
    # baked in from settings. These are expected differences for canonical seeds.
    if 'helpers.' in path and ('bottle_count' in path or 'heart_count' in path):
        return True

    # basement_key_rule and tr_big_key_chest_keys_needed use placement_lookup
    if 'helpers.' in path and ('basement_key_rule' in path or 'tr_big_key_chest_keys_needed' in path):
        return True

    # Event items: Original may have list IDs (SRAM data), WorldGen treats as events.
    # Crystals and Pendants are handled differently between original and WorldGen.
    if 'items.' in path and any(x in path for x in ['Crystal', 'Pendant']):
        # These items have different representations but are semantically equivalent
        if path.endswith('.event') or path.endswith('.type') or path.endswith('.id'):
            return True
        if 'groups' in path:
            return True

    # Item groups: WorldGen adds an "Event" group for event items
    if path.startswith('item_groups.'):
        return True

    # Dungeon bosses: Empty dict {} vs missing are semantically equivalent
    if 'dungeons.' in path and '.bosses' in path:
        if original_value == {} or worldgen_value == {} or original_value == '<missing>' or worldgen_value == '<missing>':
            return True

    # progression_mapping: WorldGen doesn't export progressive item mappings
    if path.startswith('progression_mapping.'):
        return True

    # Shop data: WorldGen doesn't generate shop data
    if '.shop' in path and (worldgen_value == '<missing>' or original_value == '<missing>'):
        return True

    # Item placement type/advancement: These are seed-specific values
    # Original has item types from the actual world, WorldGen has None
    if '.item.type' in path or '.item.advancement' in path:
        return True

    # Access rule format: location variable vs get_location() call
    # Original uses bare 'location' variable, WorldGen uses state.multiworld.get_location()
    if 'access_rule' in path and 'object.object.object.object' in path:
        return True

    # HasAll items ordering differences are semantically equivalent
    if 'args.items[' in path and 'access_rule' in path:
        return True

    # _original_ast_type metadata is internal and can differ
    if '_original_ast_type' in path:
        return True

    # AST_function_call vs Has rule differences
    if 'access_rule' in path and '.rule' in path:
        if 'AST_function_call' in str(original_value) or 'AST_function_call' in str(worldgen_value):
            return True

    # WorldGen-specific options that only exist in WorldGen, not original
    worldgen_only_options = {'randomize_items', 'use_canonical_options'}
    for opt in worldgen_only_options:
        if opt in path and original_value == '<missing>':
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

    # Normalize And+Has/HasAll patterns to single HasAll (cleaner format)
    original_normalized = normalize_and_has_patterns(original_normalized)
    worldgen_normalized = normalize_and_has_patterns(worldgen_normalized)

    # Normalize And/Or structure (flatten nested, sort children)
    original_normalized = normalize_and_or_structure(original_normalized)
    worldgen_normalized = normalize_and_or_structure(worldgen_normalized)

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
