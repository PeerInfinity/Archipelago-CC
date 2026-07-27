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
from typing import Iterable, List, Optional, Set, Callable, Dict

from Utils import local_path, is_frozen

# Container manifest version stamped into archipelago.json when packing an
# .apworld zip. Per the apworld spec this key must NOT appear in world SOURCE
# manifests (test_world_manifest enforces it) — packing tools inject it.
# 0.6.7 logs a deprecation warning for apworlds without it and 0.7.0 will
# refuse them.
APWORLD_COMPATIBLE_VERSION = 5


def stamp_container_version(manifest_bytes: bytes) -> bytes:
    """Return archipelago.json content with compatible_version injected."""
    import json
    try:
        manifest = json.loads(manifest_bytes.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return manifest_bytes  # leave malformed manifests untouched
    manifest.setdefault("compatible_version", APWORLD_COMPATIBLE_VERSION)
    return json.dumps(manifest, indent=4).encode("utf-8")


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
    # World-shaped components: on frozen installs, pack each worlds/<name>/
    # directory as a source-bearing custom_worlds/<name>.apworld instead of
    # extracting to the root worlds/ directory (which frozen installs never
    # load — their bundled worlds run from lib/worlds/*.apworld).
    frozen_apworld: bool = False
    # World directories to skip when packing apworlds on frozen installs
    # (e.g. worlds that import the extended rule_builder, which cannot load
    # there). Each skip is reported as a warning.
    frozen_exclude_worlds: List[str] = field(default_factory=list)
    # Overlay components replace files that already exist in a vanilla
    # install (e.g. upstream_fixes overwrites vanilla world files). Their
    # presence cannot be detected from the filesystem, and removing their
    # source_paths would delete the vanilla files — so detection and removal
    # skip them entirely (the install config records them instead).
    overlay: bool = False
    # The component's destination also receives user-generated content (a
    # generation run writes its own presets into frontend/presets), so it is
    # never wholesale-cleaned: the installer cannot tell its own shipped
    # files there from the user's. Precise, manifest-recorded pruning still
    # applies — that only touches files this installer wrote.
    user_writable: bool = False


@dataclass
class ExtractionResult:
    """Result of an extraction operation."""
    success: bool
    extracted_files: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    skipped_files: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    # component name -> destination paths this extraction wrote (recorded in
    # the install manifest so the NEXT install can prune what it drops)
    installed_paths: Dict[str, List[str]] = field(default_factory=dict)
    # manifest-recorded files removed because this extraction no longer ships
    # them (see prune_stale_files)
    removed_files: List[str] = field(default_factory=list)


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
        # Generation runs write presets here too; see Component.user_writable.
        user_writable=True,
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
        overlay=True,
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
        frozen_apworld=True,
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
        frozen_apworld=True,
        # toem_rule_builder ships a vendored _ext compat package (see
        # world_generator/ext_template/) and runs on vanilla rule_builder,
        # so it no longer needs excluding on frozen installs.
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
        # Generated worlds carry a vendored _ext compat package that falls
        # back to vanilla rule_builder.rules, so they load on compiled
        # installs; pack them as custom_worlds apworlds there.
        frozen_apworld=True,
    ),
}

# Default components to install
DEFAULT_COMPONENTS = {
    "exporter",
    "rule_builder",  # Extended rule_builder enables rule_builder-format rule
                     # export (ast fallback otherwise). world_generator and
                     # generated worlds no longer hard-require it — they fall
                     # back to vanilla rule_builder.rules plus their vendored
                     # _ext compat package. Replaces vanilla rule_builder/;
                     # skipped with a warning on frozen installs.
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


def resolve_components(components: Iterable[str]) -> List[str]:
    """
    Apply install-target rules to a selected component list.

    Compiled (frozen) Archipelago builds ship their worlds as .pyc-only, so
    the exporter's AST analysis has no source to read and every location
    exports ``"access_rule": null``. The 'world_source' component (upstream
    source matching the installed AP version, downloaded separately) is what
    makes rule export work there, so on a frozen target it is a dependency of
    the exporter, not an option. This is the single point both the CLI and the
    GUI go through — component selection in either one lands here.

    Order is preserved and nothing is removed; extract_tools separately drops
    components that cannot work on frozen installs.

    Args:
        components: Selected component names.

    Returns:
        The effective component list for this install target.
    """
    resolved = list(components)
    if is_frozen() and "exporter" in resolved and "world_source" not in resolved:
        resolved.append("world_source")
    return resolved

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

# Directory (under the AP user dir / install root) that receives packed
# .apworld files on frozen installs. Archipelago itself loads worlds from it.
CUSTOM_WORLDS_DIR_NAME = "custom_worlds"


# Ownership record: which destination files each component's LAST extraction
# wrote. Nothing else proves the installer owns a file — component
# destinations are shared with vanilla content (docs/), user content
# (frontend/presets/) and hand-dropped apworlds — so pruning is confined to
# what this file records.
INSTALL_MANIFEST_FILENAME = "json_tools_install_manifest.json"
INSTALL_MANIFEST_VERSION = 1


def get_install_manifest_path(dest_root: Optional[Path] = None) -> Path:
    """Path of the install manifest for a destination root."""
    if dest_root is None:
        dest_root = Path(local_path())
    return dest_root / INSTALL_MANIFEST_FILENAME


def load_install_manifest(dest_root: Optional[Path] = None) -> Dict[str, List[str]]:
    """Load the previous extraction's per-component file record.

    Returns an empty mapping when no manifest exists (a first install, or one
    made by an installer predating manifests) — in which case nothing is
    pruned, because nothing is proven owned.
    """
    import json
    path = get_install_manifest_path(dest_root)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    components = data.get("components")
    if not isinstance(components, dict):
        return {}
    return {
        name: [p for p in paths if isinstance(p, str)]
        for name, paths in components.items()
        if isinstance(paths, list)
    }


def save_install_manifest(
    manifest: Dict[str, List[str]],
    dest_root: Optional[Path] = None,
) -> None:
    """Persist the per-component file record."""
    import json
    path = get_install_manifest_path(dest_root)
    payload = {
        "manifest_version": INSTALL_MANIFEST_VERSION,
        "updated_at": datetime.now().isoformat(),
        "components": {name: sorted(paths) for name, paths in manifest.items()},
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def clear_install_manifest(dest_root: Optional[Path] = None) -> None:
    """Drop the ownership record (used by uninstall)."""
    path = get_install_manifest_path(dest_root)
    if path.is_file():
        path.unlink()


def _manifest_key(path: Path, dest_root: Path) -> str:
    """Manifest entry for a destination path: relative to dest_root when it
    lives under it, absolute otherwise (custom_worlds can sit outside
    dest_root on frozen macOS)."""
    try:
        return path.relative_to(dest_root).as_posix()
    except ValueError:
        return path.as_posix()


def _manifest_path(entry: str, dest_root: Path) -> Path:
    path = Path(entry)
    return path if path.is_absolute() else dest_root / path


def _is_protected(entry: str, protected: Iterable[str]) -> bool:
    return any(entry == prefix or entry.startswith(prefix + "/")
               for prefix in protected)


def _resolve_roots(allowed_roots: Iterable[Path]) -> List[Path]:
    resolved = []
    for root in allowed_roots:
        try:
            resolved.append(root.resolve())
        except OSError:
            continue
    return resolved


def _within_roots(path: Path, resolved_roots: Iterable[Path]) -> bool:
    """Whether path sits inside one of the allowed destination roots."""
    try:
        resolved = path.resolve()
    except OSError:
        return False
    return any(root in resolved.parents for root in resolved_roots)


def _remove_file(path: Path, resolved_roots: List[Path]) -> bool:
    """Delete one file, refusing anything outside the destination roots."""
    if not _within_roots(path, resolved_roots):
        return False  # never delete outside a component destination
    if not path.is_file():
        return False
    try:
        path.unlink()
    except OSError:
        return False
    return True


def _remove_empty_dirs(directories: Iterable[Path],
                       resolved_roots: List[Path]) -> None:
    """Remove directories emptied by removals, deepest first, stopping at
    the allowed roots themselves."""
    for directory in sorted(directories, key=lambda p: len(p.parts),
                            reverse=True):
        while True:
            try:
                resolved_dir = directory.resolve()
            except OSError:
                break
            if resolved_dir in resolved_roots:
                break
            if not _within_roots(directory, resolved_roots):
                break
            if not directory.is_dir() or any(directory.iterdir()):
                break
            try:
                directory.rmdir()
            except OSError:
                break
            directory = directory.parent


def user_writable_prefixes() -> List[str]:
    """Destination prefixes that also receive user-generated content.

    Always off-limits to wholesale cleaning, selected or not: the installer
    cannot tell a preset it shipped from one a generation run produced.
    """
    prefixes: List[str] = []
    for comp in COMPONENTS.values():
        if not comp.user_writable:
            continue
        for source_path in comp.source_paths:
            prefixes.append(source_path)
            if comp.frozen_dest:
                prefixes.append(f"{comp.frozen_dest}/{source_path}")
    return prefixes


def clean_unrecorded_component(
    targets: Iterable[Path],
    dest_root: Path,
    allowed_roots: List[Path],
    protected: Optional[List[str]] = None,
) -> List[str]:
    """Clear a component's own destination territory.

    The fallback for a component with no manifest record: an install made by
    an installer that predated ownership tracking left files nobody can name,
    and some of them run (a deleted exporter game handler is still imported by
    the directory scan that discovers handlers). This is the same territory
    remove_component owns, minus anything protected — another component's
    nested paths and user-writable destinations.

    Args:
        targets: Destination paths (files or directories) to clear.
        dest_root: Destination root the manifest entries resolve against.
        allowed_roots: Directories a removal may target.
        protected: Destination prefixes that must survive.

    Returns:
        The manifest entries actually removed.
    """
    protected = protected or []
    resolved_roots = _resolve_roots(allowed_roots)
    removed: List[str] = []
    emptied: Set[Path] = set()

    for target in targets:
        if target.is_file():
            files = [target]
        elif target.is_dir():
            files = [p for p in target.rglob("*") if p.is_file()]
        else:
            continue  # nothing installed there
        for path in files:
            entry = _manifest_key(path, dest_root)
            if _is_protected(entry, protected):
                continue
            if _remove_file(path, resolved_roots):
                removed.append(entry)
                emptied.add(path.parent)

    _remove_empty_dirs(emptied, resolved_roots)
    return removed


def protected_prefixes(selected: Iterable[str]) -> List[str]:
    """Destination prefixes belonging to components NOT being installed.

    Component territories nest: frontend/presets is the 'presets' component's
    but is claimed by 'frontend' whenever presets are selected too. Without
    this, reinstalling Frontend with Presets deselected would read every
    installed preset as dropped and delete it.
    """
    selected = set(selected)
    prefixes: List[str] = []
    for name, comp in COMPONENTS.items():
        if name in selected:
            continue
        for source_path in comp.source_paths:
            prefixes.append(source_path)
            if comp.frozen_dest:
                prefixes.append(f"{comp.frozen_dest}/{source_path}")
    return prefixes


def prune_stale_files(
    previous: Dict[str, List[str]],
    current: Dict[str, List[str]],
    dest_root: Path,
    allowed_roots: List[Path],
    protected: Optional[List[str]] = None,
) -> List[str]:
    """Remove files a previous install wrote that this one no longer ships.

    Only files recorded in ``previous`` for a component present in
    ``current`` are considered: components not being reinstalled are left
    alone (dropping them would be a surprise uninstall), and files the
    installer never recorded are never touched.

    Args:
        previous: Component -> file entries from the last extraction.
        current: Component -> file entries this extraction just wrote.
        dest_root: Destination root the relative entries resolve against.
        allowed_roots: Directories a removal may target; anything resolving
            outside all of them is refused.
        protected: Destination prefixes another, unselected component owns
            (see protected_prefixes).

    Returns:
        The manifest entries actually removed.
    """
    removed: List[str] = []
    protected = protected or []
    resolved_roots = _resolve_roots(allowed_roots)

    for comp_name, current_entries in current.items():
        stale = set(previous.get(comp_name, [])) - set(current_entries)
        emptied: Set[Path] = set()
        for entry in sorted(stale):
            if _is_protected(entry, protected):
                continue
            path = _manifest_path(entry, dest_root)
            if _remove_file(path, resolved_roots):
                removed.append(entry)
                emptied.add(path.parent)
        _remove_empty_dirs(emptied, resolved_roots)
    return removed


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


def component_apworld_paths(comp: Component, root: Path) -> List[Path]:
    """
    Candidate custom_worlds/<world>.apworld paths for a frozen_apworld
    component (where frozen installs receive its worlds). Checks both the
    given root and the real user directory (they differ on frozen macOS).
    """
    if not comp.frozen_apworld:
        return []
    folders = [root / CUSTOM_WORLDS_DIR_NAME]
    try:
        from Utils import user_path
        user_folder = Path(user_path(CUSTOM_WORLDS_DIR_NAME))
        if user_folder not in folders:
            folders.append(user_folder)
    except Exception:
        pass
    paths = []
    for source_path in comp.source_paths:
        world_name = source_path.split("/")[-1]
        for folder in folders:
            paths.append(folder / f"{world_name}.apworld")
    # Pattern-based components (e.g. worldgen_worlds: "worlds/*_worldgen")
    # have no fixed world names — glob custom_worlds for matching apworlds.
    for pattern in comp.source_patterns:
        if pattern.endswith("/*"):
            continue  # recursive file pattern, not a world directory pattern
        world_glob = pattern.split("/")[-1]
        for folder in folders:
            paths.extend(folder.glob(f"{world_glob}.apworld"))
    return paths


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
        # Real install: custom_worlds lives in the user directory (which on
        # frozen macOS differs from local_path). Explicit dest_root means a
        # test/sandbox — keep everything under it.
        from Utils import user_path
        custom_worlds_root = Path(user_path(CUSTOM_WORLDS_DIR_NAME))
    else:
        dest_root = Path(dest_root)
        custom_worlds_root = dest_root / CUSTOM_WORLDS_DIR_NAME

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

    # Destination files written per component, for the install manifest.
    installed_paths: Dict[str, Set[str]] = {}

    def record(comp_name: Optional[str], path: Path) -> None:
        if comp_name:
            installed_paths.setdefault(comp_name, set()).add(
                _manifest_key(path, dest_root))

    # Per-world apworld zips being written (frozen_apworld routing).
    # Defined before the try so the finally can always close them.
    apworld_zips: Dict[str, zipfile.ZipFile] = {}
    apworld_has_manifest: Set[str] = set()
    skipped_apworlds: Set[str] = set()
    excluded_worlds_warned: Set[str] = set()

    def apworld_route(comp: Optional[Component], rel_path: str):
        """Return (world_name, arcname) if this file should be packed
        into a custom_worlds apworld, else None."""
        if not (frozen and comp and comp.frozen_apworld):
            return None
        parts = rel_path.split("/")
        if len(parts) < 3 or parts[0] != "worlds":
            return None
        return parts[1], "/".join(parts[1:])

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

            # Pre-manifest fallback: a component whose destination exists but
            # carries NO ownership record was installed by an installer that
            # predated manifests, so nothing can say which of its files the
            # new source dropped. Clear its own territory before extracting
            # over it — otherwise the leftovers keep running (deleted exporter
            # game handlers are still imported by the discovery scan). Only
            # components this archive actually ships are cleared, and only
            # when overwriting: overwrite=False means keep what is there.
            if overwrite:
                previous_manifest = load_install_manifest(dest_root)
                shipped: Set[str] = set()
                for file_path in files_to_extract:
                    if archive_root and file_path.startswith(archive_root + "/"):
                        shipped_rel = file_path[len(archive_root) + 1:]
                    else:
                        shipped_rel = file_path
                    shipped_comp = matching_component(shipped_rel, components)
                    if shipped_comp:
                        shipped.add(shipped_comp)
                fallback_protected = (protected_prefixes(components)
                                      + user_writable_prefixes())
                for comp_name in components:
                    comp = COMPONENTS.get(comp_name)
                    if not comp or comp_name not in shipped:
                        continue
                    if comp_name in previous_manifest:
                        continue  # recorded: the precise prune handles it
                    if comp.overlay or comp.clean_before_extract:
                        continue  # vanilla files / already wiped above
                    targets = [dest_for(comp_name, source_path)
                               for source_path in comp.source_paths]
                    targets.extend(component_apworld_paths(comp, dest_root))
                    result.removed_files.extend(clean_unrecorded_component(
                        targets, dest_root, [dest_root, custom_worlds_root],
                        fallback_protected))

            total = len(files_to_extract)

            for i, file_path in enumerate(files_to_extract):
                # Calculate destination path (remove archive root)
                if archive_root and file_path.startswith(archive_root + "/"):
                    rel_path = file_path[len(archive_root) + 1:]
                else:
                    rel_path = file_path

                comp_name = matching_component(rel_path, components)
                comp = COMPONENTS.get(comp_name) if comp_name else None

                # Report progress
                if progress_callback:
                    progress_callback(rel_path, i + 1, total)

                route = apworld_route(comp, rel_path)
                if route is not None:
                    world_name, arcname = route
                    if comp and world_name in comp.frozen_exclude_worlds:
                        if world_name not in excluded_worlds_warned:
                            excluded_worlds_warned.add(world_name)
                            result.warnings.append(
                                f"Skipped world '{world_name}' on this compiled "
                                f"Archipelago install: it requires the extended "
                                f"Rule Builder, which cannot load here"
                            )
                        continue
                    if world_name in skipped_apworlds:
                        result.skipped_files.append(rel_path)
                        continue
                    try:
                        if world_name not in apworld_zips:
                            apworld_path = custom_worlds_root / f"{world_name}.apworld"
                            if apworld_path.exists() and not overwrite:
                                skipped_apworlds.add(world_name)
                                result.skipped_files.append(rel_path)
                                # Kept on disk and still shipped by this
                                # source — record it so the prune step does
                                # not read the skip as "dropped".
                                record(comp_name, apworld_path)
                                continue
                            custom_worlds_root.mkdir(parents=True, exist_ok=True)
                            apworld_zips[world_name] = zipfile.ZipFile(
                                apworld_path, "w", zipfile.ZIP_DEFLATED
                            )
                            record(comp_name, apworld_path)
                        file_data = zf.read(file_path)
                        if arcname.endswith("/archipelago.json"):
                            file_data = stamp_container_version(file_data)
                            apworld_has_manifest.add(world_name)
                        apworld_zips[world_name].writestr(arcname, file_data)
                        result.extracted_files.append(rel_path)
                    except Exception as e:
                        result.errors.append(f"{rel_path}: {str(e)}")
                        result.success = False
                    continue

                dest_path = dest_for(comp_name, rel_path)

                # Check if file exists
                if dest_path.exists() and not overwrite:
                    result.skipped_files.append(rel_path)
                    record(comp_name, dest_path)  # still shipped; not dropped
                    continue

                try:
                    # Create parent directories
                    dest_path.parent.mkdir(parents=True, exist_ok=True)

                    # Extract file
                    with zf.open(file_path) as src:
                        with open(dest_path, "wb") as dst:
                            shutil.copyfileobj(src, dst)

                    result.extracted_files.append(rel_path)
                    record(comp_name, dest_path)

                except Exception as e:
                    result.errors.append(f"{rel_path}: {str(e)}")
                    result.success = False

    except zipfile.BadZipFile as e:
        result.success = False
        result.errors.append(f"Invalid zip file: {str(e)}")
    except Exception as e:
        result.success = False
        result.errors.append(f"Extraction failed: {str(e)}")
    finally:
        for world_name, apworld_zip in apworld_zips.items():
            try:
                apworld_zip.close()
            except Exception as e:
                result.errors.append(f"{world_name}.apworld: {str(e)}")
                result.success = False
            if world_name not in apworld_has_manifest:
                result.warnings.append(
                    f"{world_name}.apworld was packed without an "
                    f"archipelago.json manifest; Archipelago logs a "
                    f"deprecation warning for it and will refuse it in 0.7.0"
                )

    result.installed_paths = {
        name: sorted(paths) for name, paths in installed_paths.items()
    }

    # Ownership bookkeeping: drop what the PREVIOUS install of these same
    # components wrote and this one no longer ships (e.g. exporter game
    # handlers deleted upstream, which the discovery scan would otherwise
    # keep importing), then record the new file set. Components with no
    # record were already handled by the pre-extraction fallback above.
    # Skipped on a failed extraction — a partial file list is not evidence
    # a file was dropped.
    if result.success:
        try:
            previous = load_install_manifest(dest_root)
            result.removed_files.extend(prune_stale_files(
                previous, result.installed_paths, dest_root,
                [dest_root, custom_worlds_root],
                protected_prefixes(components)))
            previous.update(result.installed_paths)
            save_install_manifest(previous, dest_root)
        except OSError as e:
            result.warnings.append(f"Could not update the install manifest: {e}")

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
        if comp.overlay:
            # Overlay source_paths exist in vanilla installs too — file
            # presence proves nothing, so never report (or remove) them
            # based on it.
            continue
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

        # Frozen installs receive world-shaped components as custom_worlds
        # apworlds instead
        if not is_installed and comp.frozen_apworld:
            is_installed = any(p.exists() for p in component_apworld_paths(comp, root))

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
    if comp.overlay:
        # Removing an overlay component's source_paths would delete the
        # vanilla files it overlaid (regression: uninstall on a source
        # install deleted worlds/alttp/Rules.py etc.). Restoring vanilla
        # requires re-cloning those files; refuse instead.
        return False
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

    # Remove apworlds written to custom_worlds on frozen installs
    for apworld_path in component_apworld_paths(comp, root):
        if apworld_path.exists():
            apworld_path.unlink()
            removed = True

    # Restore backup for components that replaced vanilla directories
    if comp.clean_before_extract and removed:
        restore_component_backup(component_name, root)

    return removed
