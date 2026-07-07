"""
File extractor for JSON Tools.

Handles extracting specific components from downloaded archives.
"""

import fnmatch
import shutil
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Set, Callable, Dict

from Utils import local_path, is_frozen


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
    detect_path: Optional[str] = None  # If set, use this path instead of source_paths for install detection
    clean_before_extract: bool = False  # If True, remove source_paths directories before extracting
    # Subdirectory of the AP root to extract into on frozen (compiled) installs.
    # Frozen sys.path is only lib/library.zip + lib/, so importable packages
    # must live under lib/ — the install root itself is not importable.
    frozen_dest: Optional[str] = None
    # If set, the component cannot work on frozen installs; extraction skips it
    # and reports this reason as a warning.
    unsupported_frozen: Optional[str] = None


@dataclass
class ExtractionResult:
    """Result of an extraction operation."""
    success: bool
    extracted_files: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    skipped_files: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def _ap_base_version() -> str:
    """Base AP version (e.g. '0.6.8'), used to locate version-specific patches.

    The romless patch snapshot lives under json_tools_patches/<version>/romless
    and MUST match the AP version being packed/installed — shipping an older
    snapshot overwrites world files with stale code (see
    scripts/build/generate_romless_patches.py).
    """
    try:
        from Utils import __version__
        return __version__.split("-")[0]
    except Exception:
        # Fall back to the newest snapshot present so packing still works.
        patches_root = Path(local_path()) / "json_tools_patches"
        if patches_root.exists():
            versions = sorted(
                (p.name for p in patches_root.iterdir()
                 if p.is_dir() and (p / "romless").exists()),
                key=lambda v: tuple(int(x) for x in v.split(".") if x.isdigit()),
            )
            if versions:
                return versions[-1]
        return "0.6.8"


# Define available components (order matters for GUI display)
COMPONENTS: Dict[str, Component] = {
    "exporter": Component(
        name="exporter",
        display_name="Exporter",
        description="Export game logic to JSON format",
        source_paths=["exporter"],
        required=False,
        size_estimate_mb=0.5,
        frozen_dest="lib",
    ),
    "rule_builder": Component(
        name="rule_builder",
        display_name="Rule Builder",
        description="Extended Rule Builder (WARNING: replaces vanilla rule_builder/)",
        source_paths=["rule_builder"],
        required=False,
        size_estimate_mb=0.5,
        detect_path="rule_builder/_ast_utils.py",  # CC-specific; vanilla has its own rule_builder
        clean_before_extract=True,  # Vanilla has different files that must be removed
        unsupported_frozen=(
            "vanilla rule_builder is bundled inside lib/library.zip on compiled "
            "installs and takes sys.path precedence, so the extended Rule Builder "
            "cannot replace it; rule exports fall back to 'ast' format"
        ),
    ),
    "world_generator": Component(
        name="world_generator",
        display_name="World Generator",
        description="Generate world packages from JSON rules",
        source_paths=["world_generator"],
        required=False,
        size_estimate_mb=1.0,
        frozen_dest="lib",
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
        display_name="Frontend Presets",
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
    "scripts": Component(
        name="scripts",
        display_name="Scripts",
        description="Utility scripts for testing and setup",
        source_paths=["scripts"],
        required=False,
        size_estimate_mb=0.5,
    ),
    "romless_patches": Component(
        name="romless_patches",
        display_name="ROM-less Generation Patches",
        description="Patched world files for generation without ROMs",
        source_paths=[f"json_tools_patches/{_ap_base_version()}/romless"],
        required=False,
        size_estimate_mb=0.3,
        unsupported_frozen=(
            "compiled installs run their worlds from lib/worlds/*.apworld and "
            "lib/library.zip, which file patches cannot reach — the patched "
            "files would land in the unused root worlds/ directory"
        ),
    ),
    "upstream_fixes": Component(
        name="upstream_fixes",
        display_name="Upstream Bug Fixes",
        description="Fork fixes for upstream world bugs (overlaid onto vanilla worlds)",
        # Individual fork-fixed world files overlaid directly onto the cloned
        # vanilla worlds. These are general correctness fixes (NOT romless), e.g.
        # the ALttP bunny-rules fix and shapez UT-accuracy fix; without them the
        # installed env runs vanilla's buggy logic and UT worldgen fuzz mismatches.
        # Pulled live from the version-matched fork archive (no stored snapshot to
        # go stale). See docs/json/upstream-bugs/ and
        # docs/json/developer/diffs/diff-files/{alttp-bunny-rules,world-minor-fixes}.diff
        source_paths=[
            "worlds/alttp/Rules.py",        # bunny-rules late-binding/invocation fix
            "worlds/shapez/__init__.py",    # don't force-clear early_balancer option (UT accuracy)
            "worlds/landstalker/Hints.py",  # deterministic hint ordering (sorted set)
            "worlds/lufia2ac/Options.py",   # deterministic boss group ordering (list not set)
        ],
        required=False,
        size_estimate_mb=0.2,
        unsupported_frozen=(
            "compiled installs run their worlds from lib/worlds/*.apworld, "
            "which file overlays cannot reach — the fixed files would land "
            "in the unused root worlds/ directory"
        ),
    ),
    "tracker": Component(
        name="tracker",
        display_name="Tracker Integration",
        description="Auto-tracking world based on Universal Tracker",
        source_paths=["worlds/tracker"],
        required=False,
        size_estimate_mb=0.5,
    ),
    "testing": Component(
        name="testing",
        display_name="Testing Infrastructure",
        description="Test config files (package.json, playwright, vitest, fuzz)",
        source_paths=[
            "fuzz.py",
            "package.json",
            "package-lock.json",
            "playwright.config.js",
            "vitest.config.js",
            "tests",
        ],
        required=False,
        size_estimate_mb=1.0,
    ),
    "demo_worlds": Component(
        name="demo_worlds",
        display_name="Demo Worlds",
        description="Example worlds (bakingadventure, codingadventure, etc.)",
        source_paths=[
            "worlds/bakingadventure",
            "worlds/codingadventure",
            "worlds/metamath",
            "worlds/toem_original",
            "worlds/toem_rule_builder",
        ],
        required=False,
        size_estimate_mb=1.0,
    ),
    "world_source": Component(
        name="world_source",
        display_name="Original World Source",
        description="Upstream world source for full rule export on compiled installs "
                    "(downloaded separately from the matching Archipelago release)",
        # Not extracted from the fork archive — installed by
        # installer.world_source.install_world_source(), which downloads the
        # upstream release tag matching the installed AP version. The
        # source_paths entry exists for detection and removal only.
        source_paths=["json_tools_world_source"],
        required=False,
        size_estimate_mb=15.0,
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
}

# Default components to install
DEFAULT_COMPONENTS = {
    "exporter",
    "rule_builder",  # world_generator hard-imports fork rule_builder symbols
                     # (BOOLEAN_RULE_TYPES, RuleWorldMixin, ...); vanilla AP's
                     # rule_builder lacks them, so without this the installed
                     # world_generator can't import and UT worldgen-mode
                     # tracking fails. Replaces vanilla rule_builder/.
    "world_generator",
    "frontend",
    "docs",
    "scripts",
    "romless_patches",
    "tracker",
    "testing",
}
# NOTE: "upstream_fixes" is intentionally NOT a default component. It overlays
# fork-modified world files onto vanilla worlds, so it is opt-in (CLI
# --upstream-fixes, or included by --all) until the patched files are reviewed
# against the current upstream versions.

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


BACKUP_DIR_NAME = "json_tools_backups"
COMPONENT_BACKUP_SUBDIR = "components"


def get_component_backup_root(dest_root: Optional[Path] = None) -> Path:
    """Get the root directory for component backups."""
    if dest_root is None:
        dest_root = Path(local_path())
    return dest_root / BACKUP_DIR_NAME / COMPONENT_BACKUP_SUBDIR


def backup_component_directory(
    source_dir: Path,
    component_name: str,
    dest_root: Optional[Path] = None,
) -> Optional[Path]:
    """
    Back up a component directory before it is overwritten.

    Creates a timestamped copy in json_tools_backups/components/{component_name}/.

    Args:
        source_dir: The directory to back up.
        component_name: Name of the component (used for backup subdirectory).
        dest_root: Archipelago root directory.

    Returns:
        Path to the backup directory, or None if nothing to back up.
    """
    if not source_dir.is_dir():
        return None

    backup_root = get_component_backup_root(dest_root)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = backup_root / component_name / timestamp

    backup_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source_dir, backup_dir)
    return backup_dir


def restore_component_backup(
    component_name: str,
    dest_root: Optional[Path] = None,
) -> bool:
    """
    Restore the most recent backup of a component.

    Removes the current component directory and replaces it with the
    latest backup.

    Args:
        component_name: Name of the component to restore.
        dest_root: Archipelago root directory.

    Returns:
        True if a backup was found and restored.
    """
    if dest_root is None:
        dest_root = Path(local_path())

    if component_name not in COMPONENTS:
        return False

    comp = COMPONENTS[component_name]
    backup_root = get_component_backup_root(dest_root)
    backup_comp_dir = backup_root / component_name

    if not backup_comp_dir.is_dir():
        return False

    # Find the most recent backup (sorted by timestamp directory name)
    backups = sorted(backup_comp_dir.iterdir(), reverse=True)
    if not backups:
        return False

    latest_backup = backups[0]

    # Restore each source path
    for source_path in comp.source_paths:
        target = dest_root / source_path
        if target.is_dir():
            shutil.rmtree(target)
        shutil.copytree(latest_backup, target)

    return True


def list_component_backups(
    component_name: str,
    dest_root: Optional[Path] = None,
) -> List[str]:
    """List available backups for a component (as timestamp strings)."""
    backup_root = get_component_backup_root(dest_root)
    backup_comp_dir = backup_root / component_name

    if not backup_comp_dir.is_dir():
        return []

    return sorted([d.name for d in backup_comp_dir.iterdir() if d.is_dir()], reverse=True)


def get_extractable_components() -> Dict[str, Component]:
    """Get all available components."""
    return COMPONENTS.copy()


def matching_component(
    rel_path: str,
    components: List[str],
) -> Optional[str]:
    """
    Find which selected component (if any) claims a file path.

    Args:
        rel_path: Path within the archive, with the archive root removed.
        components: List of component names to install.

    Returns:
        The name of the first matching component, or None.
    """
    # Check exclusion patterns
    path_parts = Path(rel_path).parts
    for part in path_parts:
        for pattern in EXCLUDE_PATTERNS:
            if pattern in part:
                return None

    for comp_name in components:
        if comp_name not in COMPONENTS:
            continue
        comp = COMPONENTS[comp_name]

        # Check exact source paths
        for source_path in comp.source_paths:
            if rel_path.startswith(source_path + "/") or rel_path == source_path:
                # Special case: exclude presets from frontend if presets not selected
                if comp_name == "frontend" and "presets" not in components:
                    if rel_path.startswith("frontend/presets/"):
                        return None
                return comp_name

        # Check glob patterns
        for pattern in comp.source_patterns:
            if fnmatch.fnmatch(rel_path, pattern):
                return comp_name

    return None


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
    if path.startswith(archive_root + "/"):
        rel_path = path[len(archive_root) + 1:]
    else:
        rel_path = path

    return matching_component(rel_path, components) is not None


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

    # On frozen (compiled) installs, drop components that cannot work there
    # and redirect importable packages into lib/ (the only writable sys.path
    # entry — the install root itself is not importable).
    frozen = is_frozen()
    if frozen:
        effective_components = []
        for comp_name in components:
            comp = COMPONENTS.get(comp_name)
            if comp and comp.unsupported_frozen:
                result.warnings.append(
                    f"Skipped '{comp_name}' on this compiled Archipelago install: "
                    f"{comp.unsupported_frozen}"
                )
            else:
                effective_components.append(comp_name)
        components = effective_components

    def dest_for(comp_name: Optional[str], rel_path: str) -> Path:
        comp = COMPONENTS.get(comp_name) if comp_name else None
        if frozen and comp and comp.frozen_dest:
            return dest_root / comp.frozen_dest / rel_path
        return dest_root / rel_path

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

            # Back up and clean directories for components that require it
            # AFTER validating the zip, so a bad download doesn't leave
            # the install broken
            for comp_name in components:
                comp = COMPONENTS.get(comp_name)
                if comp and comp.clean_before_extract:
                    for source_path in comp.source_paths:
                        clean_path = dest_for(comp_name, source_path)
                        if clean_path.is_dir():
                            backup_component_directory(clean_path, comp_name, dest_root)
                            shutil.rmtree(clean_path)

            total = len(files_to_extract)

            for i, file_path in enumerate(files_to_extract):
                # Calculate destination path (remove archive root)
                if archive_root and file_path.startswith(archive_root + "/"):
                    rel_path = file_path[len(archive_root) + 1:]
                else:
                    rel_path = file_path

                dest_path = dest_for(matching_component(rel_path, components), rel_path)

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

        # Components with frozen_dest may live under lib/ (compiled installs)
        # as well as the root (source installs / older layouts).
        check_roots = [root]
        if comp.frozen_dest:
            check_roots.append(root / comp.frozen_dest)

        # Use detect_path if set, otherwise check source_paths
        if comp.detect_path:
            is_installed = any((r / comp.detect_path).exists() for r in check_roots)
        else:
            for source_path in comp.source_paths:
                if any((r / source_path).exists() for r in check_roots):
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

    For components with clean_before_extract (e.g. rule_builder), restores
    the most recent backup if one exists, so the vanilla version is put back.

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

    check_roots = [root]
    if comp.frozen_dest:
        check_roots.append(root / comp.frozen_dest)

    for source_path in comp.source_paths:
        for check_root in check_roots:
            path = check_root / source_path
            if path.exists():
                if path.is_dir():
                    shutil.rmtree(path)
                else:
                    path.unlink()
                removed = True

    # Restore backup for components that replaced vanilla directories
    if comp.clean_before_extract and removed:
        restore_component_backup(component_name, root)

    return removed
