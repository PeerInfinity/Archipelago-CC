"""
Command-line interface for the world generator.

Usage:
    python -m exporter.converter.world_generator input.json [-o output_dir] [--force] [--dry-run]
"""

import argparse
import logging
import sys
from pathlib import Path

from .generator import WorldGenerator


def setup_logging(verbose: bool = False) -> None:
    """Configure logging."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(levelname)s: %(message)s'
    )


def main() -> int:
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description='Generate Archipelago world from JSON rules file',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Generate world from JSON (auto-detect output directory)
  python -m exporter.converter.world_generator frontend/presets/mygame/AP_*/AP_*_rules.json

  # Specify output directory
  python -m exporter.converter.world_generator input.json -o worlds/mygame/

  # Preview what would be generated
  python -m exporter.converter.world_generator input.json --dry-run

  # Overwrite existing files
  python -m exporter.converter.world_generator input.json --force
'''
    )

    parser.add_argument(
        'input',
        type=str,
        help='Path to JSON rules file'
    )

    parser.add_argument(
        '-o', '--output',
        type=str,
        default=None,
        help='Output directory for generated world (default: worlds/<game_directory>/)'
    )

    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite existing files'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be generated without writing files'
    )

    parser.add_argument(
        '--validate',
        action='store_true',
        help='Validate the JSON file and report issues'
    )

    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output'
    )

    args = parser.parse_args()

    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)

    # Validate input file
    input_path = Path(args.input)
    if not input_path.exists():
        logger.error(f"Input file not found: {input_path}")
        return 1

    if not input_path.suffix == '.json':
        logger.warning(f"Input file does not have .json extension: {input_path}")

    try:
        # Create generator
        generator = WorldGenerator(
            json_path=str(input_path),
            output_dir=args.output,
            force=args.force,
        )

        # Load and validate
        generator.load()

        if args.validate or args.verbose:
            issues = generator.validate()
            if issues:
                print("\nValidation results:")
                for issue in issues:
                    print(f"  {issue}")
                print()

                # Stop if there are errors in validate-only mode
                if args.validate:
                    has_errors = any(issue.startswith('ERROR') for issue in issues)
                    return 1 if has_errors else 0

        if not args.validate:
            # Generate the world
            generator.generate(dry_run=args.dry_run)

        return 0

    except FileExistsError as e:
        logger.error(str(e))
        return 1
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {input_path}: {e}")
        return 1
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
