"""
File extractor for JSON Tools.

Handles extracting specific components from downloaded archives.
"""

import fnmatch
import shutil
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Set, Callable, Dict

from Utils import local_path


@dataclass
class Component:
    """Definition of an installable component."""
    name: str
    display_name: str
    description: str
    source_paths: List[str]  # Paths within the archive
    source_patterns: List[str] = field(default_factory=list)  # Glob patterns for matching
    required: bool = False
    size_estimate_mb: float = 0.0


@dataclass
class ExtractionResult:
    """Result of an extraction operation."""
    success: bool
    extracted_files: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    skipped_files: List[str] = field(default_factory=list)


# Define available components
COMPONENTS: Dict[str, Component] = {
    "core": Component(
        name="core",
        display_name="Core Tools",
        description="Exporter, Rule Builder, and World Generator",
        source_paths=["exporter", "rule_builder", "world_generator"],
        required=True,
        size_estimate_mb=2.0,
    ),
    "scripts": Component(
        name="scripts",
        display_name="Scripts",
        description="Utility scripts for testing and setup",
        source_paths=["scripts"],
        required=False,
        size_estimate_mb=0.5,
    ),
    "frontend": Component(
        name="frontend",
        display_name="Frontend",
        description="Web UI for viewing game logic (excludes presets)",
        source_paths=["frontend"],
        required=False,
        size_estimate_mb=5.0,
    ),
    "presets": Component(
        name="presets",
        display_name="Presets",
        description="Pre-generated game data (~75MB)",
        source_paths=["frontend/presets"],
        required=False,
        size_estimate_mb=75.0,
    ),
    "docs": Component(
        name="docs",
        display_name="Documentation",
        description="JSON Tools documentation",
        source_paths=["docs/json"],
        required=False,
        size_estimate_mb=0.2,
    ),
    "worldgen_worlds": Component(
        name="worldgen_worlds",
        display_name="WorldGen Worlds",
        description="Auto-generated world packages from JSON rules (~15MB)",
        source_paths=[],
        source_patterns=["worlds/*_worldgen", "worlds/*_worldgen/*"],
        required=False,
        size_estimate_mb=15.0,
    ),
    "demo_worlds": Component(
        name="demo_worlds",
        display_name="Demo Worlds",
        description="Example/demo worlds (bakingadventure, codingadventure, etc.)",
        source_paths=[
            "worlds/bakingadventure",
            "worlds/codingadventure",
            "worlds/mathadventure",
            "worlds/metamath",
            "worlds/toem_original",
            "worlds/toem_rule_builder",
        ],
        required=False,
        size_estimate_mb=1.0,
    ),
    "tracker": Component(
        name="tracker",
        display_name="Tracker Integration",
        description="PopTracker integration world for auto-tracking",
        source_paths=["worlds/tracker"],
        required=False,
        size_estimate_mb=0.5,
    ),
    "testing": Component(
        name="testing",
        display_name="Testing Infrastructure",
        description="Test configuration files (package.json, playwright, vitest)",
        source_paths=[
            "package.json",
            "package-lock.json",
            "playwright.config.js",
            "vitest.config.js",
            "tests",
        ],
        required=False,
        size_estimate_mb=1.0,
    ),
    "romless_patches": Component(
        name="romless_patches",
        display_name="ROM-less Generation Patches",
        description="Patches for worlds to generate without ROM files (for testing)",
        source_paths=[
            "docs/json/developer/diffs",
        ],
        required=False,
        size_estimate_mb=0.1,
    ),
}

# Patterns to always exclude
EXCLUDE_PATTERNS: Set[str] = {
    "__pycache__",
    ".pyc",
    ".pyo",
    ".DS_Store",
    ".git",
    ".gitignore",
    ".github",
    "CC",  # Claude Code specific files
}

# Patterns to exclude from frontend (unless presets is selected)
FRONTEND_EXCLUDE_IF_NO_PRESETS: Set[str] = {
    "presets",
}


def get_extractable_components() -> Dict[str, Component]:
    """Get all available components."""
    return COMPONENTS.copy()


def should_extract_file(
    path: str,
    components: List[str],
    archive_root: str
) -> bool:
    """
    Determine if a file should be extracted based on selected components.

    Args:
        path: Path within the archive.
        components: List of component names to install.
        archive_root: Root directory name in the archive.

    Returns:
        True if the file should be extracted.
    """
    # Remove archive root prefix
    if path.startswith(archive_root + "/"):
        rel_path = path[len(archive_root) + 1:]
    else:
        rel_path = path

    # Check exclusion patterns
    path_parts = Path(rel_path).parts
    for part in path_parts:
        for pattern in EXCLUDE_PATTERNS:
            if pattern in part:
                return False

    # Check if path matches any selected component
    for comp_name in components:
        if comp_name not in COMPONENTS:
            continue
        comp = COMPONENTS[comp_name]

        # Check exact source paths
        for source_path in comp.source_paths:
            if rel_path.startswith(source_path + "/") or rel_path == source_path:
                # Special case: exclude presets from frontend if presets not selected
                if comp_name == "frontend" and "presets" not in components:
                    if "presets" in rel_path:
                        return False
                return True

        # Check glob patterns
        for pattern in comp.source_patterns:
            if fnmatch.fnmatch(rel_path, pattern):
                return True

    return False


def extract_tools(
    archive_path: Path,
    components: List[str],
    dest_root: Optional[Path] = None,
    progress_callback: Optional[Callable[[str, int, int], None]] = None,
    overwrite: bool = True,
) -> ExtractionResult:
    """
    Extract selected components from an archive.

    Args:
        archive_path: Path to the downloaded zip archive.
        components: List of component names to extract.
        dest_root: Destination root directory (default: Archipelago root).
        progress_callback: Optional callback(filename, current, total).
        overwrite: Whether to overwrite existing files.

    Returns:
        ExtractionResult with extracted files and any errors.
    """
    if dest_root is None:
        dest_root = Path(local_path())

    result = ExtractionResult(success=True)

    try:
        with zipfile.ZipFile(archive_path, "r") as zf:
            # Get list of all files
            all_files = zf.namelist()

            # Determine archive root (GitHub archives have repo-branch/ prefix)
            archive_root = ""
            if all_files:
                first_part = all_files[0].split("/")[0]
                if all(f.startswith(first_part + "/") for f in all_files if f):
                    archive_root = first_part

            # Filter files to extract
            files_to_extract = [
                f for f in all_files
                if not f.endswith("/")  # Skip directories
                and should_extract_file(f, components, archive_root)
            ]

            total = len(files_to_extract)

            for i, file_path in enumerate(files_to_extract):
                # Calculate destination path (remove archive root)
                if archive_root and file_path.startswith(archive_root + "/"):
                    rel_path = file_path[len(archive_root) + 1:]
                else:
                    rel_path = file_path

                dest_path = dest_root / rel_path

                # Report progress
                if progress_callback:
                    progress_callback(rel_path, i + 1, total)

                # Check if file exists
                if dest_path.exists() and not overwrite:
                    result.skipped_files.append(rel_path)
                    continue

                try:
                    # Create parent directories
                    dest_path.parent.mkdir(parents=True, exist_ok=True)

                    # Extract file
                    with zf.open(file_path) as src:
                        with open(dest_path, "wb") as dst:
                            shutil.copyfileobj(src, dst)

                    result.extracted_files.append(rel_path)

                except Exception as e:
                    result.errors.append(f"{rel_path}: {str(e)}")
                    result.success = False

    except zipfile.BadZipFile as e:
        result.success = False
        result.errors.append(f"Invalid zip file: {str(e)}")
    except Exception as e:
        result.success = False
        result.errors.append(f"Extraction failed: {str(e)}")

    return result


def get_component_size_estimate(components: List[str]) -> float:
    """
    Get estimated total size in MB for selected components.

    Args:
        components: List of component names.

    Returns:
        Estimated size in megabytes.
    """
    total = 0.0
    for comp_name in components:
        if comp_name in COMPONENTS:
            total += COMPONENTS[comp_name].size_estimate_mb
    return total


def list_installed_components(root: Optional[Path] = None) -> List[str]:
    """
    Check which components are currently installed.

    Args:
        root: Root directory to check (default: Archipelago root).

    Returns:
        List of installed component names.
    """
    if root is None:
        root = Path(local_path())

    installed = []

    for comp_name, comp in COMPONENTS.items():
        is_installed = False

        # Check if any source path exists
        for source_path in comp.source_paths:
            check_path = root / source_path
            if check_path.exists():
                is_installed = True
                break

        # Check if any source pattern matches existing files
        if not is_installed and comp.source_patterns:
            for pattern in comp.source_patterns:
                # Skip recursive patterns (e.g., "worlds/*_worldgen/*")
                # Only check top-level directory patterns
                if pattern.endswith("/*"):
                    continue
                # Use glob to find matching paths
                matches = list(root.glob(pattern))
                if matches:
                    is_installed = True
                    break

        if is_installed:
            installed.append(comp_name)

    return installed


def remove_component(
    component_name: str,
    root: Optional[Path] = None,
) -> bool:
    """
    Remove an installed component.

    Args:
        component_name: Name of the component to remove.
        root: Root directory (default: Archipelago root).

    Returns:
        True if successfully removed.
    """
    if component_name not in COMPONENTS:
        return False

    if root is None:
        root = Path(local_path())

    comp = COMPONENTS[component_name]
    removed = False

    for source_path in comp.source_paths:
        path = root / source_path
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            removed = True

    return removed
