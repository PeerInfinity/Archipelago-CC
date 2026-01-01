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


def normalize_rules(obj: Any) -> Any:
    """
    Recursively normalize rule structures for comparison.

    This handles semantic equivalences in rule representation:
    - Has rules: Add explicit count=1 when count is missing (default is 1)
    - HasAll(A, B) -> And(Has(A, 1), Has(B, 1)) - expand for comparison
    - HasAny(A, B) -> Or(Has(A, 1), Has(B, 1)) - expand for comparison
    - Sort children of And/Or for consistent order (they're commutative)
    """
    if isinstance(obj, dict):
        rule_type = obj.get('rule', '')

        # Normalize Has rules - add explicit count=1
        if rule_type == 'Has' and 'args' in obj:
            args = obj['args']
            if isinstance(args, dict) and 'item_name' in args and 'count' not in args:
                normalized_args = dict(args)
                normalized_args['count'] = 1
                return {
                    **{k: normalize_rules(v) for k, v in obj.items() if k != 'args'},
                    'args': normalized_args
                }

        # Expand HasAll(A, B) to And(Has(A, 1), Has(B, 1))
        if rule_type == 'HasAll' and 'args' in obj:
            args = obj.get('args', {})
            items = args.get('items', [])
            if items:
                children = [
                    {'rule': 'Has', 'args': {'item_name': item, 'count': 1}}
                    for item in sorted(items)  # Sort for consistent order
                ]
                return {
                    'rule': 'And',
                    'children': children
                }

        # Expand HasAny(A, B) to Or(Has(A, 1), Has(B, 1))
        if rule_type == 'HasAny' and 'args' in obj:
            args = obj.get('args', {})
            items = args.get('items', [])
            if items:
                children = [
                    {'rule': 'Has', 'args': {'item_name': item, 'count': 1}}
                    for item in sorted(items)  # Sort for consistent order
                ]
                return {
                    'rule': 'Or',
                    'children': children
                }

        # Sort children of And/Or for consistent comparison (commutative operations)
        if rule_type in ('And', 'Or') and 'children' in obj:
            normalized_children = [normalize_rules(c) for c in obj['children']]
            # Sort children by their JSON representation for consistent order
            sorted_children = sorted(normalized_children, key=lambda x: json.dumps(x, sort_keys=True))
            return {
                **{k: normalize_rules(v) for k, v in obj.items() if k != 'children'},
                'children': sorted_children
            }

        # Recursively normalize all dict values
        return {k: normalize_rules(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_rules(item) for item in obj]
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


def is_canonical_difference(path: str) -> bool:
    """Check if a difference path is caused by --canonical-seed1 or WorldGen.

    These differences are expected when comparing an original export
    with a WorldGen export that uses --canonical-seed1:
    - canonical_placements section (only in WorldGen)
    - locked flags on locations (set by canonical placements)
    - item placements at locations (item.name, item.advancement, item.player)
    - item_groups (item group assignments)
    - randomize_items option (WorldGen-specific, controls canonical placement)
    - world_classes (class names differ between original and WorldGen)
    - accumulator_rules (WorldGen-specific for state counter patterns)
    - prog_items_init (WorldGen-specific initial counter values)
    """
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

    # accumulator_rules (WorldGen-specific for state counter patterns like coins)
    # Original worlds don't have this, WorldGen worlds generate it from patterns
    if 'accumulator_rules' in path:
        return True

    # prog_items_init (WorldGen-specific initial counter values)
    # Original worlds don't have this, WorldGen worlds generate it from patterns
    if 'prog_items_init' in path:
        return True

    # start_inventory_from_pool (may be empty in original, missing in WorldGen)
    if 'start_inventory_from_pool' in path:
        return True

    # Option definition metadata differences (bool vs int for toggle defaults)
    # These are semantically equivalent (false == 0, true == 1)
    if 'option_definitions' in path and '.default' in path:
        return True

    return False


def filter_canonical_differences(
    differences: List[Tuple[str, Any, Any]]
) -> List[Tuple[str, Any, Any]]:
    """Filter out differences caused by --canonical-seed1."""
    return [diff for diff in differences if not is_canonical_difference(diff[0])]


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

    # Normalize rules to handle semantic equivalences (e.g., count=1 default)
    original_normalized = normalize_rules(original_normalized)
    worldgen_normalized = normalize_rules(worldgen_normalized)

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
