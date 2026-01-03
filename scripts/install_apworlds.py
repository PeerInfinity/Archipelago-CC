#!/usr/bin/env python3
"""
CLI tool to bulk install APWorlds from silasary's index.

Usage:
    python scripts/install_apworlds.py                    # List available worlds
    python scripts/install_apworlds.py --install-all      # Install all available worlds
    python scripts/install_apworlds.py --install actraiser zelda3  # Install specific worlds
"""

import argparse
import sys
import os

# Add the root directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def install_world_silent(world, repositories):
    """Install a world without showing a messagebox."""
    from worlds.LauncherComponents import _install_apworld

    path = repositories.download_remote_world(world["latest_version"])
    _install_apworld(path)


def main():
    parser = argparse.ArgumentParser(description="Bulk install APWorlds from remote repositories")
    parser.add_argument("--install-all", action="store_true", help="Install all available (non-installed) worlds")
    parser.add_argument("--install", nargs="+", metavar="WORLD", help="Install specific worlds by ID (e.g., actraiser, zelda3)")
    parser.add_argument("--list", action="store_true", help="List all available worlds")
    parser.add_argument("--list-installed", action="store_true", help="List installed worlds")
    parser.add_argument("--include-after-dark", action="store_true", help="Include 'After Dark' (18+) worlds")
    parser.add_argument("--include-manuals", action="store_true", help="Include Manual worlds")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be installed without installing")
    args = parser.parse_args()

    # Import after path setup
    from worlds.apworld_manager.world_manager import (
        repositories, refresh_apworld_table, SortStages
    )
    from worlds.apworld_manager import RepoWorld

    # Configure settings for what to show
    if args.include_after_dark:
        RepoWorld.settings.show_after_dark = True
    if args.include_manuals:
        RepoWorld.settings.show_manuals = True

    print("Loading repositories...")
    repositories.load_repos_from_settings()
    print("Refreshing world list...")
    repositories.refresh()

    apworlds = refresh_apworld_table()

    if args.list_installed:
        print("\n=== Installed APWorlds (custom_worlds/) ===")
        installed = [w for w in apworlds if w['installed']]
        for world in sorted(installed, key=lambda x: x['title'].lower()):
            version = world.get('installed_version', '?')
            print(f"  {world['title']} (v{version})")
        print(f"Total: {len(installed)} apworlds")

        # Also show bundled worlds
        from worlds import AutoWorld
        bundled = []
        for name, world in AutoWorld.AutoWorldRegister.world_types.items():
            if not world.zip_path:  # Unpacked = bundled
                bundled.append(name)
        print(f"\n=== Bundled Worlds (worlds/) ===")
        for name in sorted(bundled, key=str.lower):
            print(f"  {name}")
        print(f"Total: {len(bundled)} bundled")
        return

    if args.list or (not args.install_all and not args.install):
        print("\n=== Available Worlds (not installed) ===")
        available = [w for w in apworlds if not w['installed'] and w['sort'] not in (SortStages.BUNDLED,)]
        for world in sorted(available, key=lambda x: x['title'].lower()):
            latest = world.get('latest_version')
            version = latest.world_version if latest else '?'
            flags = []
            if world.get('after_dark'):
                flags.append("18+")
            if world['title'].lower().startswith('manual_'):
                flags.append("manual")
            flag_str = f" [{', '.join(flags)}]" if flags else ""
            # Get the world ID from latest_version
            world_id = latest.id if latest else "?"
            print(f"  {world_id}: {world['title']} (v{version}){flag_str}")
        print(f"\nTotal: {len(available)} available")

        # Also show worlds with updates
        updates = [w for w in apworlds if w['installed'] and w['update_available']]
        if updates:
            print("\n=== Updates Available ===")
            for world in sorted(updates, key=lambda x: x['title'].lower()):
                latest = world.get('latest_version')
                old_ver = world.get('installed_version', '?')
                new_ver = latest.world_version if latest else '?'
                print(f"  {world['title']}: {old_ver} -> {new_ver}")
        return

    # Determine which worlds to install
    to_install = []

    if args.install_all:
        to_install = [w for w in apworlds
                      if not w['installed']
                      and w['latest_version'] is not None
                      and w['sort'] not in (SortStages.BUNDLED,)]
        # Filter out after_dark and manuals unless explicitly included
        if not args.include_after_dark:
            to_install = [w for w in to_install if not w.get('after_dark')]
        if not args.include_manuals:
            to_install = [w for w in to_install if not w['title'].lower().startswith('manual_')]

    elif args.install:
        requested = set(name.lower() for name in args.install)
        for world in apworlds:
            latest = world.get('latest_version')
            if latest and latest.id.lower() in requested:
                to_install.append(world)
                requested.discard(latest.id.lower())

        if requested:
            print(f"Warning: Could not find worlds: {', '.join(requested)}")

    if not to_install:
        print("No worlds to install.")
        return

    print(f"\n{'Would install' if args.dry_run else 'Installing'} {len(to_install)} worlds:\n")

    success = 0
    failed = []

    for i, world in enumerate(sorted(to_install, key=lambda x: x['title'].lower()), 1):
        latest = world['latest_version']
        print(f"[{i}/{len(to_install)}] {world['title']} (v{latest.world_version})...", end=" ", flush=True)

        if args.dry_run:
            print("(dry run)")
            success += 1
            continue

        try:
            install_world_silent(world, repositories)
            print("OK")
            success += 1
        except Exception as e:
            print(f"FAILED: {e}")
            failed.append((world['title'], str(e)))

    print(f"\nDone: {success} installed, {len(failed)} failed")

    if failed:
        print("\nFailed installations:")
        for name, error in failed:
            print(f"  {name}: {error}")


if __name__ == "__main__":
    main()
