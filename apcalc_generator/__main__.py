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
        '--ops', type=int, default=1,
        help='Operation buttons per sphere (default: 1)',
    )
    parser.add_argument(
        '--nums', type=int, default=1,
        help='Number buttons per sphere (default: 1)',
    )
    parser.add_argument(
        '--trash', type=int, default=1,
        help='Trash items per sphere (default: 1)',
    )
    parser.add_argument(
        '--max-branches', type=int, default=3,
        help='Max child nodes per parent (default: 3)',
    )
    parser.add_argument(
        '--divide-sphere', type=int, default=None,
        help='Which sphere gets / (default: auto, typically 2)',
    )
    parser.add_argument(
        '-o', '--output', type=str, default='apcalc_rules.json',
        help='Output file path (default: apcalc_rules.json)',
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Print summary without writing file',
    )
    parser.add_argument(
        '-v', '--verbose', action='store_true',
        help='Print detailed generation log',
    )

    args = parser.parse_args()

    config = APCalcConfig(
        num_spheres=args.spheres,
        ops_per_sphere=args.ops,
        nums_per_sphere=args.nums,
        trash_per_sphere=args.trash,
        max_branches=args.max_branches,
        seed=args.seed,
        divide_sphere=args.divide_sphere,
    )

    total_per_sphere = config.ops_per_sphere + config.nums_per_sphere + config.trash_per_sphere
    print(f'Generating APCalc: {config.num_spheres} spheres, '
          f'{total_per_sphere} locations/sphere '
          f'({config.ops_per_sphere} ops + {config.nums_per_sphere} nums + {config.trash_per_sphere} trash), '
          f'seed={config.seed}')

    log_fn = print if args.verbose else None

    try:
        game_data = generate(config, log=log_fn)
    except RuntimeError as e:
        print(f'Generation failed: {e}', file=sys.stderr)
        return 1

    nodes = game_data['nodes']
    print(f'\nGenerated {len(nodes)} nodes')

    # Print summary
    for sphere in range(config.num_spheres):
        sphere_nodes = [n for n in nodes if n.sphere == sphere]
        values = [n.value for n in sphere_nodes]
        items = [n.item for n in sphere_nodes]
        print(f'  Sphere {sphere}: {len(sphere_nodes)} nodes, values={values}, items={items}')

    if args.dry_run:
        print('(dry run — no file written)')
        return 0

    rules_data = export_rules_json(game_data)
    write_rules_json(rules_data, args.output)
    return 0


if __name__ == '__main__':
    exit(main())
