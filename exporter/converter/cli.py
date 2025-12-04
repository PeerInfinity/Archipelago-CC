#!/usr/bin/env python3
"""
Command-line interface for rule format conversion.

Usage:
    # Convert Rule Builder -> Archipelago-CC
    python -m exporter.converter.cli input.json -o output.json --format cc

    # Convert Archipelago-CC -> Rule Builder
    python -m exporter.converter.cli input.json -o output.json --format rb

    # Auto-detect input format
    python -m exporter.converter.cli input.json -o output.json
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional, Tuple, Dict, Any, List


def detect_format(data: Dict[str, Any]) -> str:
    """
    Auto-detect the format of a rules file.

    Args:
        data: Parsed JSON data

    Returns:
        'rb' for Rule Builder format, 'cc' for Archipelago-CC format, 'unknown' otherwise
    """
    # Check for Rule Builder format indicators
    if 'regions' in data:
        regions = data['regions']
        if regions:
            # Check first region's first location/exit for format indicators
            for player_regions in regions.values():
                for region_data in player_regions.values():
                    # Check exits
                    for exit_data in region_data.get('exits', []):
                        rule = exit_data.get('access_rule', {})
                        if isinstance(rule, dict):
                            if 'rule' in rule and 'options' in rule:
                                return 'rb'  # Rule Builder format
                            if 'type' in rule:
                                return 'cc'  # Archipelago-CC format

                    # Check locations
                    for loc_data in region_data.get('locations', []):
                        rule = loc_data.get('access_rule', {})
                        if isinstance(rule, dict):
                            if 'rule' in rule and 'options' in rule:
                                return 'rb'
                            if 'type' in rule:
                                return 'cc'

    return 'unknown'


def convert_file(
    input_path: str,
    output_path: Optional[str] = None,
    target_format: Optional[str] = None,
    indent: int = 2,
    verbose: bool = False
) -> int:
    """
    Convert a rules file between formats.

    Args:
        input_path: Path to input JSON file
        output_path: Path for output JSON file (default: stdout)
        target_format: Target format ('cc' or 'rb', None for auto-detect and convert)
        indent: JSON indentation (default: 2)
        verbose: Print warnings and info

    Returns:
        Exit code (0 for success, 1 for error)
    """
    # Import converters (avoid import issues at module level)
    from .rule_builder_to_cc import convert_rules_file_to_cc
    from .cc_to_rule_builder import convert_rules_file_to_rule_builder

    try:
        # Read input file
        input_file = Path(input_path)
        if not input_file.exists():
            print(f"Error: Input file not found: {input_path}", file=sys.stderr)
            return 1

        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if verbose:
            print(f"Loaded {input_path}", file=sys.stderr)

        # Detect input format
        input_format = detect_format(data)
        if verbose:
            print(f"Detected input format: {input_format}", file=sys.stderr)

        # Determine target format
        if target_format is None:
            # Auto-convert to opposite format
            if input_format == 'rb':
                target_format = 'cc'
            elif input_format == 'cc':
                target_format = 'rb'
            else:
                print("Error: Could not auto-detect input format. Please specify --format", file=sys.stderr)
                return 1

        if verbose:
            print(f"Target format: {target_format}", file=sys.stderr)

        # Perform conversion
        if target_format == 'cc':
            if input_format == 'cc':
                print("Warning: Input already in CC format, no conversion needed", file=sys.stderr)
                converted, warnings = data, []
            else:
                converted, warnings = convert_rules_file_to_cc(data)
                if verbose:
                    print(f"Converted from Rule Builder to Archipelago-CC format", file=sys.stderr)

        elif target_format == 'rb':
            if input_format == 'rb':
                print("Warning: Input already in Rule Builder format, no conversion needed", file=sys.stderr)
                converted, warnings = data, []
            else:
                converted, warnings = convert_rules_file_to_rule_builder(data)
                if verbose:
                    print(f"Converted from Archipelago-CC to Rule Builder format", file=sys.stderr)

        else:
            print(f"Error: Unknown target format '{target_format}'. Supported: cc, rb", file=sys.stderr)
            return 1

        # Report warnings
        if verbose and warnings:
            print(f"\nWarnings ({len(warnings)}):", file=sys.stderr)
            for w in warnings:
                print(f"  - {w}", file=sys.stderr)
            print(file=sys.stderr)

        # Output result
        output_json = json.dumps(converted, indent=indent, ensure_ascii=False)

        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output_json)
            if verbose:
                print(f"Wrote {output_path}", file=sys.stderr)
        else:
            print(output_json)

        # Summary
        if verbose:
            print(f"\nConversion complete: {len(warnings)} warnings", file=sys.stderr)

        return 0

    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if verbose:
            import traceback
            traceback.print_exc()
        return 1


def main():
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description='Convert between Archipelago rule JSON formats',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Auto-detect and convert to opposite format
  python -m exporter.converter input.json -o output.json

  # Explicitly convert Rule Builder -> Archipelago-CC
  python -m exporter.converter input.json -o output.json --format cc

  # Explicitly convert Archipelago-CC -> Rule Builder
  python -m exporter.converter input.json -o output.json --format rb

  # Convert with verbose output
  python -m exporter.converter input.json -o output.json -v

  # Output to stdout (for piping)
  python -m exporter.converter input.json --format cc

Supported formats:
  cc    Archipelago-CC format (this repository)
  rb    Rule Builder format (PR #5048)

Round-trip conversion:
  Both converters preserve metadata to enable lossless round-trips.
  Converting A -> B -> A or B -> A -> B will produce identical results
  for compatible rule types.
        """
    )

    parser.add_argument(
        'input',
        help='Input JSON file path'
    )

    parser.add_argument(
        '-o', '--output',
        help='Output JSON file path (default: stdout)'
    )

    parser.add_argument(
        '-f', '--format',
        choices=['cc', 'rb'],
        help='Target format (default: auto-detect and convert to opposite)'
    )

    parser.add_argument(
        '--indent',
        type=int,
        default=2,
        help='JSON indentation (default: 2, use 0 for compact)'
    )

    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Print warnings and progress information'
    )

    args = parser.parse_args()

    indent = args.indent if args.indent > 0 else None

    sys.exit(convert_file(
        input_path=args.input,
        output_path=args.output,
        target_format=args.format,
        indent=indent,
        verbose=args.verbose
    ))


if __name__ == '__main__':
    main()
