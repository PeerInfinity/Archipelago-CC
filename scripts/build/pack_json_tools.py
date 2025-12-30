#!/usr/bin/env python3
"""
Package JSON Tools into an APWorld file.

This script packages the rule_builder, exporter, world_generator modules,
and optionally the frontend, into a distributable .apworld file.

Usage:
    python scripts/build/pack_json_tools.py [options]

Options:
    --include-frontend    Include frontend files in apworld (excludes presets/)
    --output PATH         Output path (default: apworlds/json_tools.apworld)
    --version VERSION     Version string (default: 1.0.0)
    --dry-run             Show what would be packaged without creating file
"""

import argparse
import fnmatch
import json
import os
import sys
import zipfile
from pathlib import Path
from typing import List, Set


# Get project root (two levels up from this script)
PROJECT_ROOT = Path(__file__).parent.parent.parent

# Modules to package
MODULES_TO_PACKAGE = [
    "rule_builder",
    "exporter",
    "world_generator",
]

# Patterns to exclude from all modules
EXCLUDE_PATTERNS = [
    "__pycache__",
    "*.pyc",
    "*.pyo",
    ".DS_Store",
    "*.egg-info",
    ".git",
    ".gitignore",
]

# Additional patterns to exclude from specific paths
FRONTEND_EXCLUDE_PATTERNS = [
    "presets",           # Large preset files - can be regenerated
    "presets/*",
    "test-results",      # Test output
    "test-results/*",
    "playwright_tests_config*.json",  # Test configs
    "*.log",
]

# Minimum AP version required
MIN_AP_VERSION = "0.6.5"


def should_exclude(path: Path, exclude_patterns: List[str]) -> bool:
    """Check if a path should be excluded based on patterns."""
    path_str = str(path)
    path_name = path.name

    for pattern in exclude_patterns:
        # Check if any part of the path matches
        if fnmatch.fnmatch(path_name, pattern):
            return True
        # Check full path for directory patterns
        for part in path.parts:
            if fnmatch.fnmatch(part, pattern):
                return True
    return False


def collect_module_files(module_name: str, base_path: Path) -> List[tuple[Path, str]]:
    """
    Collect all files from a module directory.

    Returns list of (source_path, archive_path) tuples.
    """
    module_path = base_path / module_name
    if not module_path.exists():
        print(f"Warning: Module {module_name} not found at {module_path}")
        return []

    files = []
    for path in module_path.rglob("*"):
        if path.is_file() and not should_exclude(path, EXCLUDE_PATTERNS):
            # Archive path: json_tools/module_name/...
            rel_path = path.relative_to(base_path)
            archive_path = f"json_tools/{rel_path}"
            files.append((path, archive_path))

    return files


def collect_frontend_files(base_path: Path) -> List[tuple[Path, str]]:
    """
    Collect frontend files, excluding presets and test files.

    Returns list of (source_path, archive_path) tuples.
    """
    frontend_path = base_path / "frontend"
    if not frontend_path.exists():
        print(f"Warning: Frontend not found at {frontend_path}")
        return []

    all_exclude = EXCLUDE_PATTERNS + FRONTEND_EXCLUDE_PATTERNS
    files = []

    for path in frontend_path.rglob("*"):
        if path.is_file():
            rel_to_frontend = path.relative_to(frontend_path)
            if not should_exclude(rel_to_frontend, all_exclude):
                archive_path = f"json_tools/frontend/{rel_to_frontend}"
                files.append((path, archive_path))

    return files


def generate_init_py() -> str:
    """Generate the main __init__.py for the json_tools package."""
    return '''"""
JSON Tools - Export and import game logic as JSON.

This APWorld provides tools for:
- Exporting game rules to JSON format
- Generating worlds from JSON rules
- Viewing game logic in a web UI

Components are available in the Archipelago Launcher after installation.
"""

from worlds.AutoWorld import World
from typing import ClassVar

# Import and register launcher components
from . import components as _components


class JSONToolsWorld(World):
    """
    Minimal hidden world to satisfy AutoWorldRegister.
    JSON Tools is a utility package, not a playable game.
    """
    game = "JSON Tools"
    hidden = True

    # Empty mappings - no actual items or locations
    item_name_to_id = {}
    location_name_to_id = {}

    # Prevent this from being selected as a game
    @classmethod
    def stage_assert_generate(cls, multiworld) -> None:
        raise RuntimeError("JSON Tools is a utility package, not a playable game.")
'''


def generate_components_py() -> str:
    """Generate the components.py for launcher integration."""
    return '''"""
Launcher components for JSON Tools.

These components appear in the Archipelago Launcher and provide
access to JSON Tools functionality.
"""

from worlds.LauncherComponents import Component, Type, components, launch


def launch_frontend_server(*args):
    """Start an HTTP server for the JSON Tools frontend."""
    import http.server
    import socketserver
    import webbrowser
    import threading
    from pathlib import Path

    # Find frontend directory
    frontend_path = Path(__file__).parent / "frontend"
    if not frontend_path.exists():
        from Utils import messagebox
        messagebox("Error", "Frontend files not found. They may not have been included in this APWorld.", error=True)
        return

    PORT = 8000

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(frontend_path), **kwargs)

    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"JSON Tools Frontend server running at http://localhost:{PORT}")
            print("Press Ctrl+C to stop the server")

            # Open browser after short delay
            def open_browser():
                import time
                time.sleep(0.5)
                webbrowser.open(f"http://localhost:{PORT}")

            threading.Thread(target=open_browser, daemon=True).start()
            httpd.serve_forever()
    except OSError as e:
        from Utils import messagebox
        messagebox("Error", f"Could not start server on port {PORT}: {e}", error=True)


def launch_world_generator(*args):
    """Launch the world generator CLI."""
    from .world_generator.cli import main
    main(list(args))


def launch_info(*args):
    """Show information about JSON Tools."""
    from Utils import messagebox

    info = """JSON Tools for Archipelago

This package provides tools for exporting and importing game logic as JSON.

Components:
- Frontend Server: View game logic in a web browser
- World Generator: Create worlds from JSON rules files

For the exporter functionality to work, patches must be applied to
the Archipelago core files. See the documentation for details.

Repository: https://github.com/PeerInfinity/Archipelago-CC
"""
    messagebox("JSON Tools Info", info)


# Register components with the launcher
components.extend([
    Component(
        "JSON Tools Info",
        func=launch_info,
        component_type=Type.MISC,
        description="Information about JSON Tools"
    ),
    Component(
        "JSON Tools Frontend",
        func=launch_frontend_server,
        component_type=Type.TOOL,
        description="Start web UI for viewing game logic"
    ),
    Component(
        "World Generator",
        func=launch_world_generator,
        component_type=Type.TOOL,
        cli=True,
        description="Generate worlds from JSON rules"
    ),
])
'''


def generate_manifest(version: str) -> dict:
    """Generate the archipelago.json manifest."""
    return {
        "game": "JSON Tools",
        "compatible_version": 7,
        "version": version,
        "minimum_ap_version": MIN_AP_VERSION,
        "world_version": version,
    }


def create_apworld(
    output_path: Path,
    include_frontend: bool = False,
    version: str = "1.0.0",
    dry_run: bool = False
) -> bool:
    """
    Create the JSON Tools apworld.

    Args:
        output_path: Path to write the .apworld file
        include_frontend: Whether to include frontend files
        version: Version string for the manifest
        dry_run: If True, only print what would be done

    Returns:
        True if successful, False otherwise
    """
    print(f"Creating JSON Tools APWorld v{version}")
    print(f"Output: {output_path}")
    print(f"Include frontend: {include_frontend}")
    print()

    all_files: List[tuple[Path, str]] = []

    # Collect module files
    for module in MODULES_TO_PACKAGE:
        print(f"Collecting {module}...")
        files = collect_module_files(module, PROJECT_ROOT)
        print(f"  Found {len(files)} files")
        all_files.extend(files)

    # Collect frontend if requested
    if include_frontend:
        print("Collecting frontend (excluding presets)...")
        files = collect_frontend_files(PROJECT_ROOT)
        print(f"  Found {len(files)} files")
        all_files.extend(files)

    # Generate package files
    generated_files = [
        ("json_tools/__init__.py", generate_init_py()),
        ("json_tools/components.py", generate_components_py()),
        ("json_tools/archipelago.json", json.dumps(generate_manifest(version), indent=2)),
    ]

    print(f"\nTotal files to package: {len(all_files) + len(generated_files)}")

    if dry_run:
        print("\n=== DRY RUN - Files that would be included ===")
        print("\nGenerated files:")
        for path, _ in generated_files:
            print(f"  {path}")
        print(f"\nModule/Frontend files: {len(all_files)}")
        for src, dst in sorted(all_files, key=lambda x: x[1])[:20]:
            print(f"  {dst}")
        if len(all_files) > 20:
            print(f"  ... and {len(all_files) - 20} more")
        return True

    # Create output directory
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Create the apworld zip
    print(f"\nWriting {output_path}...")
    try:
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            # Add generated files
            for path, content in generated_files:
                zf.writestr(path, content)

            # Add collected files
            for src_path, archive_path in all_files:
                zf.write(src_path, archive_path)

        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"Created {output_path} ({size_mb:.2f} MB)")
        return True

    except Exception as e:
        print(f"Error creating apworld: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Package JSON Tools into an APWorld file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "--include-frontend",
        action="store_true",
        help="Include frontend files (excludes presets/)"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=PROJECT_ROOT / "apworlds" / "json_tools.apworld",
        help="Output path (default: apworlds/json_tools.apworld)"
    )
    parser.add_argument(
        "--version", "-v",
        default="1.0.0",
        help="Version string (default: 1.0.0)"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Show what would be packaged without creating file"
    )

    args = parser.parse_args()

    success = create_apworld(
        output_path=args.output,
        include_frontend=args.include_frontend,
        version=args.version,
        dry_run=args.dry_run
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
