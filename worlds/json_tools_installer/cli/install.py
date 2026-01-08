"""
CLI for installing/updating JSON Tools.

Usage:
    python -m worlds.json_tools_installer.cli.install [options]

Examples:
    # Install stable version with default components
    python -m worlds.json_tools_installer.cli.install

    # Install dev version with all components
    python -m worlds.json_tools_installer.cli.install --version dev --all

    # Install specific components
    python -m worlds.json_tools_installer.cli.install --frontend --presets

    # Update existing installation
    python -m worlds.json_tools_installer.cli.install --update

    # Uninstall
    python -m worlds.json_tools_installer.cli.install --uninstall
"""

import argparse
import sys
import tempfile
from pathlib import Path

from ..config import (
    load_config,
    save_config,
    update_installation_info,
    clear_installation,
    InstallerConfig,
)
from ..installer.version_detector import detect_ap_version, get_version_support_status
from ..installer.downloader import (
    download_archive,
    get_download_url,
    get_latest_commit_hash,
    check_connectivity,
)
from ..installer.extractor import (
    extract_tools,
    get_extractable_components,
    list_installed_components,
    remove_component,
    COMPONENTS,
)
from ..installer.patcher import (
    apply_bundled_patches,
    revert_patches,
    get_patch_summary,
)


def print_header(text: str) -> None:
    """Print a section header."""
    print(f"\n{'=' * 60}")
    print(f"  {text}")
    print('=' * 60)


def print_status(label: str, value: str, ok: bool = True) -> None:
    """Print a status line."""
    symbol = "[OK]" if ok else "[!!]"
    print(f"  {symbol} {label}: {value}")


def progress_callback(current: int, total: int) -> None:
    """Print download progress."""
    if total > 0:
        pct = current * 100 // total
        bar_len = 40
        filled = bar_len * current // total
        bar = '=' * filled + '-' * (bar_len - filled)
        print(f"\r  Downloading: [{bar}] {pct}%", end="", flush=True)


def extract_progress_callback(filename: str, current: int, total: int) -> None:
    """Print extraction progress."""
    pct = current * 100 // total
    # Truncate filename if too long
    if len(filename) > 40:
        filename = "..." + filename[-37:]
    print(f"\r  Extracting: {current}/{total} ({pct}%) - {filename:<40}", end="", flush=True)


def do_install(
    config: InstallerConfig,
    version: str,
    components: list,
    dry_run: bool = False,
    use_monkey_patch: bool = False,
    use_bundled_patches: bool = False,
) -> bool:
    """
    Perform the installation.

    Args:
        config: Installer configuration.
        version: Version to install ("stable" or "dev").
        components: List of component names to install.
        dry_run: If True, only show what would be done.
        use_monkey_patch: If True, use runtime patching instead of file patches.
        use_bundled_patches: If True, use bundled patch files instead of downloading.

    Returns:
        True if successful.
    """
    source = config.get_source(version)

    print_header(f"Installing JSON Tools ({version})")
    print(f"  Source: {source.repo} @ {source.branch}")
    print(f"  Components: {', '.join(components)}")

    if dry_run:
        print("\n  [DRY RUN] Would download and install the above.")
        return True

    # Check connectivity
    print("\n  Checking connectivity...")
    if not check_connectivity():
        print("  [ERROR] Cannot reach GitHub. Check your internet connection.")
        return False
    print("  [OK] GitHub is reachable")

    # Get latest commit hash
    commit_hash = get_latest_commit_hash(source)
    if commit_hash:
        print(f"  [OK] Latest commit: {commit_hash[:12]}")

    # Download archive
    print(f"\n  Downloading from: {get_download_url(source)}")

    with tempfile.TemporaryDirectory() as temp_dir:
        archive_path = Path(temp_dir) / "archive.zip"

        result = download_archive(
            source,
            dest_path=archive_path,
            progress_callback=progress_callback,
        )
        print()  # New line after progress bar

        if not result.success:
            print(f"  [ERROR] Download failed: {result.error}")
            return False

        print(f"  [OK] Downloaded {result.size_bytes / 1024 / 1024:.1f} MB")

        # Extract components
        print("\n  Extracting files...")

        extract_result = extract_tools(
            archive_path,
            components,
            progress_callback=extract_progress_callback,
        )
        print()  # New line after progress

        if not extract_result.success:
            print("  [ERROR] Extraction failed:")
            for error in extract_result.errors:
                print(f"    - {error}")
            return False

        print(f"  [OK] Extracted {len(extract_result.extracted_files)} files")

        if extract_result.skipped_files:
            print(f"  [INFO] Skipped {len(extract_result.skipped_files)} existing files")

        # Apply patches (unless using monkey patching)
        if use_monkey_patch:
            print("\n  Setting up monkey patching...")
            from ..monkey_patches import install_hooks
            hook_results = install_hooks()
            success_count = sum(1 for v in hook_results.values() if v)
            print(f"  [OK] Installed {success_count}/{len(hook_results)} runtime hooks")
            config.patches.method = "monkey"
        else:
            # Default: use bundled/downloaded patches
            print("\n  Applying patches from downloaded patch files...")
            patch_result = apply_bundled_patches(config)

            if patch_result.warnings:
                for warning in patch_result.warnings:
                    print(f"  [WARN] {warning}")

            if not patch_result.success:
                print("  [ERROR] Patching failed:")
                for error in patch_result.errors:
                    print(f"    - {error}")
                return False

            if patch_result.patched_files:
                print(f"  [OK] Patched {len(patch_result.patched_files)} files")
                for f in patch_result.patched_files:
                    print(f"    - {f}")

    # Update config
    update_installation_info(config, version, components, commit_hash)

    print_header("Installation Complete")
    print("  JSON Tools has been installed successfully!")
    print("\n  Next steps:")
    print("  1. Restart Archipelago to load the new tools")
    print("  2. Configure host.yaml (run scripts/setup/update_host_settings.py)")
    print("  3. Generate a seed to test the installation")

    return True


def do_uninstall(config: InstallerConfig, dry_run: bool = False) -> bool:
    """
    Uninstall JSON Tools.

    Returns:
        True if successful.
    """
    print_header("Uninstalling JSON Tools")

    # Revert patches first
    print("  Reverting patches...")
    if not dry_run:
        patch_result = revert_patches(config)
        if patch_result.patched_files:
            for f in patch_result.patched_files:
                print(f"    - {f}")
        if patch_result.errors:
            print("  [WARN] Some patches could not be reverted:")
            for error in patch_result.errors:
                print(f"    - {error}")

    # Remove installed components
    installed = list_installed_components()
    print(f"\n  Removing components: {', '.join(installed)}")

    if not dry_run:
        for comp in installed:
            if remove_component(comp):
                print(f"    - Removed {comp}")

        clear_installation(config)

    print("\n  [OK] Uninstallation complete")
    return True


def main(args=None):
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description="Install or update JSON Tools for Archipelago",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Version selection
    parser.add_argument(
        "--version", "-v",
        choices=["stable", "dev"],
        default="stable",
        help="Version to install (default: stable)",
    )

    # Component selection
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="Install all components",
    )
    parser.add_argument(
        "--core",
        action="store_true",
        default=True,
        help="Install core tools (default: True)",
    )
    parser.add_argument(
        "--scripts",
        action="store_true",
        default=True,
        help="Install scripts (default: True)",
    )
    parser.add_argument(
        "--frontend",
        action="store_true",
        help="Install frontend web UI",
    )
    parser.add_argument(
        "--presets",
        action="store_true",
        help="Install presets (requires --frontend)",
    )
    parser.add_argument(
        "--docs",
        action="store_true",
        help="Install documentation",
    )
    parser.add_argument(
        "--worldgen-worlds",
        action="store_true",
        help="Install auto-generated world packages from JSON rules",
    )
    parser.add_argument(
        "--demo-worlds",
        action="store_true",
        help="Install example/demo worlds (bakingadventure, etc.)",
    )
    parser.add_argument(
        "--tracker",
        action="store_true",
        help="Install PopTracker integration world",
    )
    parser.add_argument(
        "--testing",
        action="store_true",
        help="Install testing infrastructure (package.json, playwright, vitest)",
    )
    parser.add_argument(
        "--romless-patches",
        action="store_true",
        help="Install ROM-less generation patches (for testing without ROMs)",
    )

    # Actions
    parser.add_argument(
        "--update", "-u",
        action="store_true",
        help="Update existing installation",
    )
    parser.add_argument(
        "--uninstall",
        action="store_true",
        help="Uninstall JSON Tools",
    )
    parser.add_argument(
        "--revert-patches",
        action="store_true",
        help="Revert patches only (keep tools)",
    )

    # Options
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--monkey-patch",
        action="store_true",
        help="Use runtime monkey patching instead of file patches",
    )
    parser.add_argument(
        "--use-bundled-patches",
        action="store_true",
        help="Use bundled patch files instead of downloading",
    )

    parsed = parser.parse_args(args)

    # Load config
    config = load_config()

    # Check AP version
    version_info = detect_ap_version()
    print(f"\nArchipelago Version: {version_info.version_string}")
    print(f"Support Status: {get_version_support_status(version_info)}")

    if not version_info.is_supported:
        print(f"\n[WARNING] {version_info.notes}")
        if not parsed.dry_run:
            response = input("Continue anyway? [y/N]: ")
            if response.lower() != 'y':
                print("Aborted.")
                return 1

    # Handle actions
    if parsed.uninstall:
        success = do_uninstall(config, parsed.dry_run)
        return 0 if success else 1

    if parsed.revert_patches:
        print_header("Reverting Patches")
        if not parsed.dry_run:
            result = revert_patches(config)
            for f in result.patched_files:
                print(f"  - {f}")
            if result.errors:
                for e in result.errors:
                    print(f"  [ERROR] {e}")
                return 1
        return 0

    # Determine components to install
    components = []
    if parsed.all:
        components = list(COMPONENTS.keys())
    else:
        if parsed.core:
            components.append("core")
        if parsed.scripts:
            components.append("scripts")
        if parsed.frontend:
            components.append("frontend")
        if parsed.presets:
            components.append("presets")
            if "frontend" not in components:
                components.append("frontend")
        if parsed.docs:
            components.append("docs")
        if parsed.worldgen_worlds:
            components.append("worldgen_worlds")
        if parsed.demo_worlds:
            components.append("demo_worlds")
        if parsed.tracker:
            components.append("tracker")
        if parsed.testing:
            components.append("testing")
        if parsed.romless_patches:
            components.append("romless_patches")

    if not components:
        components = ["core", "scripts"]

    # For update, use existing config's version if not specified
    version = parsed.version
    if parsed.update and config.installation.version:
        version = config.installation.version
        print(f"\nUpdating existing {version} installation...")

    success = do_install(
        config,
        version,
        components,
        parsed.dry_run,
        parsed.monkey_patch,
        parsed.use_bundled_patches,
    )
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
