#!/usr/bin/env python3
"""
Command-line interface for rule format conversion.

Usage:
    python -m exporter.converter.cli rule_builder_input.json -o cc_output.json
    python -m exporter.converter.cli rule_builder_input.json --format cc
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional


def convert_file(
    input_path: str,
    output_path: Optional[str] = None,
    format: str = 'cc',
    indent: int = 2,
    verbose: bool = False
) -> int:
    """
    Convert a rules file between formats.

    Args:
        input_path: Path to input JSON file
        output_path: Path for output JSON file (default: stdout)
        format: Target format ('cc' for Archipelago-CC)
        indent: JSON indentation (default: 2)
        verbose: Print warnings and info

    Returns:
        Exit code (0 for success, 1 for error)
    """
    # Import converter (avoid import issues at module level)
    from .rule_builder_to_cc import convert_rules_file_to_cc

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

        # Convert based on format
        if format == 'cc':
            converted, warnings = convert_rules_file_to_cc(data)

            if verbose and warnings:
                print(f"\nWarnings ({len(warnings)}):", file=sys.stderr)
                for w in warnings:
                    print(f"  - {w}", file=sys.stderr)
                print(file=sys.stderr)
        else:
            print(f"Error: Unknown format '{format}'. Supported: cc", file=sys.stderr)
            return 1

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

        return 0

    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def main():
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description='Convert between Archipelago rule JSON formats',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Convert Rule Builder format to Archipelago-CC format
  python -m exporter.converter.cli rules.json -o rules_cc.json

  # Convert and print to stdout
  python -m exporter.converter.cli rules.json

  # Convert with verbose output
  python -m exporter.converter.cli rules.json -o output.json -v

Supported formats:
  cc    Archipelago-CC format (default)
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
        default='cc',
        choices=['cc'],
        help='Target format (default: cc)'
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
        format=args.format,
        indent=indent,
        verbose=args.verbose
    ))


if __name__ == '__main__':
    main()
