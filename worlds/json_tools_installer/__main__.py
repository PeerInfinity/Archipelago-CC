"""
CLI entry point for JSON Tools Installer.

Allows running the installer directly:
    python -m worlds.json_tools_installer install
    python -m worlds.json_tools_installer status
    python -m worlds.json_tools_installer --help
"""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        prog="json_tools_installer",
        description="JSON Tools Installer for Archipelago",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Install command
    install_parser = subparsers.add_parser("install", help="Install or update JSON Tools")
    install_parser.add_argument("--version", "-v", choices=["stable", "dev"], default="stable")
    install_parser.add_argument("--all", "-a", action="store_true", help="Install all components")
    install_parser.add_argument("--frontend", action="store_true", help="Include frontend")
    install_parser.add_argument("--presets", action="store_true", help="Include presets")
    install_parser.add_argument("--docs", action="store_true", help="Include documentation")
    install_parser.add_argument("--worldgen-worlds", action="store_true", help="Include worldgen worlds")
    install_parser.add_argument("--demo-worlds", action="store_true", help="Include demo worlds")
    install_parser.add_argument("--tracker", action="store_true", help="Include tracker")
    install_parser.add_argument("--testing", action="store_true", help="Include testing infrastructure")
    install_parser.add_argument("--romless-patches", action="store_true", help="Include romless patches")
    install_parser.add_argument("--monkey-patch", action="store_true", help="Use runtime patching")
    install_parser.add_argument("--uninstall", action="store_true", help="Uninstall")
    install_parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompts")
    install_parser.add_argument("--dry-run", "-n", action="store_true")

    # Status command
    status_parser = subparsers.add_parser("status", help="Check installation status")
    status_parser.add_argument("--verbose", "-v", action="store_true")
    status_parser.add_argument("--config", "-c", action="store_true")

    # Config command
    config_parser = subparsers.add_parser("config", help="View or modify configuration")
    config_parser.add_argument("--show", action="store_true", help="Show current config")
    config_parser.add_argument("--stable-repo", help="Set stable repository")
    config_parser.add_argument("--stable-branch", help="Set stable branch")
    config_parser.add_argument("--dev-repo", help="Set dev repository")
    config_parser.add_argument("--dev-branch", help="Set dev branch")

    args = parser.parse_args()

    if args.command == "install":
        from .cli.install import main as install_main
        # Convert args to list for install_main
        install_args = []
        if args.version:
            install_args.extend(["--version", args.version])
        if args.all:
            install_args.append("--all")
        if args.frontend:
            install_args.append("--frontend")
        if args.presets:
            install_args.append("--presets")
        if args.docs:
            install_args.append("--docs")
        if args.worldgen_worlds:
            install_args.append("--worldgen-worlds")
        if args.demo_worlds:
            install_args.append("--demo-worlds")
        if args.tracker:
            install_args.append("--tracker")
        if args.testing:
            install_args.append("--testing")
        if args.romless_patches:
            install_args.append("--romless-patches")
        if args.monkey_patch:
            install_args.append("--monkey-patch")
        if args.uninstall:
            install_args.append("--uninstall")
        if args.yes:
            install_args.append("--yes")
        if args.dry_run:
            install_args.append("--dry-run")
        return install_main(install_args)

    elif args.command == "status":
        from .cli.status import main as status_main
        status_args = []
        if args.verbose:
            status_args.append("--verbose")
        if args.config:
            status_args.append("--config")
        return status_main(status_args)

    elif args.command == "config":
        from .config import load_config, save_config
        config = load_config()

        modified = False
        if args.stable_repo:
            config.stable_source.repo = args.stable_repo
            modified = True
        if args.stable_branch:
            config.stable_source.branch = args.stable_branch
            modified = True
        if args.dev_repo:
            config.dev_source.repo = args.dev_repo
            modified = True
        if args.dev_branch:
            config.dev_source.branch = args.dev_branch
            modified = True

        if modified:
            save_config(config)
            print("Configuration updated.")

        if args.show or not modified:
            print(f"Stable: {config.stable_source.repo} @ {config.stable_source.branch}")
            print(f"Dev: {config.dev_source.repo} @ {config.dev_source.branch}")

        return 0

    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
