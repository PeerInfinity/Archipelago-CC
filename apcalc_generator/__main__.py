"""CLI entry point: python -m apcalc_generator"""

import argparse
import sys

from .generator import APCalcConfig, generate
from .export import export_rules_json, write_rules_json


def main():
    parser = argparse.ArgumentParser(
        description='Generate APCalc rules.json for Archipelago',
    )
    parser.add_argument(
        '--seed', type=int, default=42,
        help='Random seed for generation (default: 42)',
    )
    parser.add_argument(
        '--spheres', type=int, default=5,
        help='Number of spheres including sphere 0 (default: 5)',
    )
    parser.add_argument(
        '--locations', type=str, default='3',
        help='Locations per sphere: single number or comma-separated list (default: 3)',
    )
    parser.add_argument(
        '--max-branches', type=int, default=3,
        help='Max child nodes per parent (default: 3)',
    )
    parser.add_argument(
        '-o', '--output', type=str, default='apcalc_rules.json',
        help='Output file path (default: apcalc_rules.json)',
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Print summary without writing file',
    )

    args = parser.parse_args()

    # Parse locations
    parts = args.locations.split(',')
    if len(parts) == 1:
        locations_per_sphere = [int(parts[0])] * args.spheres
    else:
        locations_per_sphere = [int(p.strip()) for p in parts]
        if len(locations_per_sphere) < args.spheres:
            # Extend with last value
            last = locations_per_sphere[-1]
            while len(locations_per_sphere) < args.spheres:
                locations_per_sphere.append(last)

    config = APCalcConfig(
        num_spheres=args.spheres,
        locations_per_sphere=locations_per_sphere,
        max_branches=args.max_branches,
        seed=args.seed,
    )

    print(f'Generating APCalc: {config.num_spheres} spheres, '
          f'locations={config.locations_per_sphere}, '
          f'seed={config.seed}')

    try:
        game_data = generate(config)
    except RuntimeError as e:
        print(f'Generation failed: {e}', file=sys.stderr)
        return 1

    nodes = game_data['nodes']
    print(f'Generated {len(nodes)} nodes')

    # Print summary
    for sphere in range(config.num_spheres):
        sphere_nodes = [n for n in nodes if n.sphere == sphere]
        values = [n.value for n in sphere_nodes]
        items = [n.item for n in sphere_nodes]
        print(f'  Sphere {sphere}: values={values}, items={items}')

    if args.dry_run:
        print('(dry run — no file written)')
        return 0

    rules_data = export_rules_json(game_data)
    write_rules_json(rules_data, args.output)
    return 0


if __name__ == '__main__':
    exit(main())
