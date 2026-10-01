#!/usr/bin/env python3
"""
Simple script to pack a world directory into an .apworld file.
Usage: python scripts/build/pack_apworld.py <world_name>
Example: python scripts/build/pack_apworld.py metamath
"""

import sys
import zipfile
from pathlib import Path

# The packing rule lives in world_generator/apworld.py, shared with the
# frontend's in-browser apworld build. This script runs from scripts/build/,
# so put the project root on the path before importing it.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from world_generator.apworld import write_world_to_zip  # noqa: E402


def pack_apworld(world_name: str, output_path: Path | None = None):
    """Pack a world directory into an .apworld file.

    Args:
        world_name: Directory name under worlds/.
        output_path: Where to write the apworld (default:
            apworlds/<world_name>.apworld in the project root). Used by the
            packed-apworld freshness test to pack into a temp location.
    """
    # Get the project root (two levels up from scripts/build/)
    project_root = Path(__file__).parent.parent.parent
    worlds_dir = project_root / "worlds"
    world_dir = worlds_dir / world_name

    # Check if world directory exists
    if not world_dir.exists():
        print(f"Error: World directory '{world_dir}' not found.")
        return False

    if output_path is None:
        # Create output directory if it doesn't exist
        output_dir = project_root / "apworlds"
        output_dir.mkdir(exist_ok=True)
        apworld_file = output_dir / f"{world_name}.apworld"
    else:
        apworld_file = Path(output_path)
        apworld_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"Packing world '{world_name}' from {world_dir}")
    print(f"Creating {apworld_file}")

    try:
        with zipfile.ZipFile(apworld_file, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            write_world_to_zip(zf, world_dir, on_add=lambda rel: print(f"  Added: {rel}"))

        print(f"\nSuccessfully created {apworld_file}")
        print(f"File size: {apworld_file.stat().st_size / 1024:.2f} KB")
        return True

    except Exception as e:
        print(f"Error creating apworld: {e}")
        return False


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    world_name = sys.argv[1]
    success = pack_apworld(world_name)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()