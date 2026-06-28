#!/usr/bin/env python3
"""
Generate the ROM-less patch snapshot for the current AP version.

The fork maintains its ROM-less world patches *in place* inside ``worlds/``
(each patched ``__init__.py`` checks ``skip_required_files`` / uses
``check_rom_available`` so generation can run without a ROM). The JSON Tools
installer, however, ships and applies a *snapshot* of those patched files from
``json_tools_patches/<version>/romless/``. That snapshot must match the AP
version it will be applied to: applying a snapshot from an older AP version can
overwrite a world ``__init__.py`` with stale code whose imports no longer exist
upstream (e.g. ``check_enemizer`` removed in 0.6.8), which de-registers the
world and breaks generation/spoiler tests.

This script (re)generates ``json_tools_patches/<version>/romless/`` from the
repo's current (already-patched) world files plus the infrastructure files, and
writes a ``manifest.json`` with the patched hashes. Run it whenever the AP
version changes (after an upstream sync) or when a romless world's patched
``__init__.py`` is edited.

Usage:
    python scripts/build/generate_romless_patches.py            # use detected AP version
    python scripts/build/generate_romless_patches.py --version 0.6.8
    python scripts/build/generate_romless_patches.py --dry-run
"""

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

# Worlds that carry ROM-less patches. Keep in sync with
# worlds/json_tools_installer/installer/romless_patcher.py:ROMLESS_WORLDS
ROMLESS_WORLDS = [
    "alttp",
    "ff1",
    "lufia2ac",
    "mmbn3",
    "oot",
    "smw",
    "soe",
    "tloz",
    "yoshisisland",
]

# Infrastructure files the romless world patches depend on. Keep in sync with
# worlds/json_tools_installer/installer/romless_patcher.py:ROMLESS_INFRASTRUCTURE_FILES
ROMLESS_INFRASTRUCTURE_FILES = [
    "settings.py",
    "worlds/RomlessUtils.py",
]


def get_repo_root() -> Path:
    """Locate the repository root (has worlds/ and BaseClasses.py)."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "worlds").exists() and (parent / "BaseClasses.py").exists():
            return parent
    raise RuntimeError("Could not find repository root")


def detect_version(repo_root: Path) -> str:
    """Read the AP base version (e.g. '0.6.8') from Utils.__version__."""
    sys.path.insert(0, str(repo_root))
    try:
        from Utils import __version__
    except ImportError as exc:  # pragma: no cover - defensive
        raise RuntimeError(f"Could not import AP version from Utils: {exc}")
    # Strip any pre-release suffix ("0.6.8-rc1" -> "0.6.8").
    return __version__.split("-")[0]


def file_hash(path: Path) -> str:
    sha256 = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--version", help="AP version to label the snapshot "
                        "(default: detected from Utils.__version__)")
    parser.add_argument("--dry-run", "-n", action="store_true",
                        help="Show what would be written without writing")
    args = parser.parse_args()

    repo_root = get_repo_root()
    version = args.version or detect_version(repo_root)

    out_dir = repo_root / "json_tools_patches" / version / "romless"
    print(f"Repository root: {repo_root}")
    print(f"AP version:      {version}")
    print(f"Output dir:      {out_dir}")

    manifest = {"version": version, "infrastructure_files": {}, "files": {}}
    missing = []

    # Validate sources first so a partial snapshot is never written.
    planned = []  # (src, dest, manifest_section, manifest_key)
    for world in ROMLESS_WORLDS:
        src = repo_root / "worlds" / world / "__init__.py"
        if not src.exists():
            missing.append(f"worlds/{world}/__init__.py")
            continue
        dest = out_dir / world / "__init__.py"
        planned.append((src, dest, "files", f"worlds/{world}/__init__.py"))

    for infra in ROMLESS_INFRASTRUCTURE_FILES:
        src = repo_root / infra
        if not src.exists():
            missing.append(infra)
            continue
        dest = out_dir / infra
        planned.append((src, dest, "infrastructure_files", infra))

    if missing:
        print("\n[ERROR] Missing source files (cannot snapshot):")
        for m in missing:
            print(f"  - {m}")
        return 1

    if args.dry_run:
        print("\n[DRY RUN] Would write:")
    else:
        # Clean the target dir so removed worlds don't linger.
        if out_dir.exists():
            shutil.rmtree(out_dir)

    for src, dest, section, key in planned:
        digest = file_hash(src)
        manifest[section][key] = {"patched_sha256": digest}
        if args.dry_run:
            print(f"  {key}  ({digest[:12]})")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)

    if args.dry_run:
        print(f"\n[DRY RUN] Would write manifest with "
              f"{len(manifest['files'])} world(s) + "
              f"{len(manifest['infrastructure_files'])} infra file(s).")
        return 0

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"\n[OK] Wrote {len(manifest['files'])} world patch(es) + "
          f"{len(manifest['infrastructure_files'])} infra file(s)")
    print(f"     Manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
