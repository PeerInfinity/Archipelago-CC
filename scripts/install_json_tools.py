#!/usr/bin/env python3
"""
End-to-end installation test script for JSON Tools.

This is a developer tool for testing the installation pipeline — not intended
for end users. It verifies that JSON Tools can be installed from scratch into
a fresh Archipelago clone and that the resulting installation works correctly.

Steps:

1. Clones the official Archipelago repository
2. Creates a virtual environment and installs dependencies
3. Downloads and installs the JSON Tools Installer apworld
4. Runs the installer to download, patch, and optionally apply ROM-less patches
5. Sets up the development environment
6. Runs verification tests (spoiler + UT fuzz) on a single game

Usage:
    # Install stable version with default components (tests with Adventure)
    python scripts/install_json_tools.py

    # Install dev version with all components
    python scripts/install_json_tools.py --dev --all

    # Install with ROM-less patches (auto-selects ALTTP for testing)
    python scripts/install_json_tools.py --romless

    # Install to a specific directory
    python scripts/install_json_tools.py --target-dir /path/to/install

    # Fresh install (delete existing target directory first)
    python scripts/install_json_tools.py --fresh --target-dir /path/to/install

    # Skip tests
    python scripts/install_json_tools.py --skip-tests

    # Verify apworld requirements auto-install (MetaMath's metamath-py)
    python scripts/install_json_tools.py --test-apworld-deps

    # Verify the uninstall path restores the pre-install clone
    # (combine with --skip-setup to keep the snapshot diff clean)
    python scripts/install_json_tools.py --test-uninstall --skip-setup

Options:
    --dev               Use development branch (PeerInfinity/Archipelago-CC @ main)
                        Default is stable (PeerInfinity/Archipelago @ JSONExport)
    --all               Install all components (frontend, presets, docs, etc.)
    --romless           Install and apply ROM-less patches (enables ALTTP testing)
    --patch-mode MODE   Patching mode: monkey (default) or none
    --fresh             Delete existing target directory before cloning
    --target-dir DIR    Install to specified directory (default: ./archipelago-json-tools)
    --test MODE         Test mode: auto (default), adventure, alttp, or none
    --skip-tests        Same as --test none
    --skip-clone        Skip cloning (assume Archipelago already exists in target dir)
    --skip-setup        Skip development environment setup
    --test-apworld-deps Seed custom_worlds/ with metamath.apworld before installing,
                        then verify the installer auto-installed its requirements
                        (metamathpy imports, MetaMath generates)
    --test-uninstall    After install (and tests), run the uninstall path and
                        assert the clone matches a pre-install file snapshot
    --dry-run           Show what would be done without making changes
    --help              Show this help message
"""

import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Repo this script lives in — source of local test fixtures
# (the tracked metamath.apworld and the MetaMath template)
SCRIPT_REPO_ROOT = Path(__file__).resolve().parents[1]


# Repository configuration
OFFICIAL_ARCHIPELAGO_REPO = "https://github.com/ArchipelagoMW/Archipelago.git"

# JSON Tools sources
STABLE_REPO = "PeerInfinity/Archipelago"
STABLE_BRANCH = "JSONExport"
DEV_REPO = "PeerInfinity/Archipelago-CC"
DEV_BRANCH = "main"

# Default target directory
DEFAULT_TARGET_DIR = "archipelago-json-tools"


def print_header(text: str) -> None:
    """Print a section header."""
    print(f"\n{'=' * 70}")
    print(f"  {text}")
    print('=' * 70)


def print_status(label: str, value: str, ok: bool = True) -> None:
    """Print a status line."""
    symbol = "[OK]" if ok else "[!!]"
    print(f"  {symbol} {label}: {value}")


def run_command(
    cmd: List[str],
    description: str,
    cwd: Optional[Path] = None,
    check: bool = True,
    capture_output: bool = True,
    env: Optional[dict] = None,
    stdin_text: Optional[str] = None,
) -> Tuple[bool, str, str]:
    """
    Run a command and return (success, stdout, stderr).

    If stdin_text is provided, it is piped to the process's stdin.
    This is useful for auto-answering interactive prompts.
    """
    print(f"\n  Running: {description}")
    print(f"  Command: {' '.join(str(c) for c in cmd)}")

    try:
        # Merge environment if provided
        full_env = os.environ.copy()
        if env:
            full_env.update(env)

        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=capture_output,
            text=True,
            env=full_env,
            input=stdin_text,
        )

        if result.stdout and not capture_output:
            print(result.stdout)

        if result.returncode != 0:
            if check:
                print(f"  [FAIL] Command failed with exit code {result.returncode}")
                if result.stderr:
                    print(f"  Error: {result.stderr[:500]}")
            return False, result.stdout or "", result.stderr or ""

        print("  [OK] Command completed successfully")
        return True, result.stdout or "", result.stderr or ""

    except Exception as e:
        print(f"  [FAIL] Error running command: {e}")
        return False, "", str(e)


def get_python_executable(venv_path: Path) -> Path:
    """Get the Python executable path for a virtual environment."""
    if sys.platform == "win32":
        return venv_path / "Scripts" / "python.exe"
    return venv_path / "bin" / "python"


def get_pip_executable(venv_path: Path) -> Path:
    """Get the pip executable path for a virtual environment."""
    if sys.platform == "win32":
        return venv_path / "Scripts" / "pip.exe"
    return venv_path / "bin" / "pip"


def clone_archipelago(target_dir: Path, fresh: bool = False, dry_run: bool = False) -> bool:
    """Clone the official Archipelago repository."""
    print_header("Cloning Official Archipelago Repository")

    if fresh and target_dir.exists():
        if dry_run:
            print(f"  [DRY RUN] Would delete existing directory: {target_dir}")
        else:
            print(f"  Deleting existing directory (--fresh): {target_dir}")
            shutil.rmtree(target_dir)

    if target_dir.exists():
        print(f"  Target directory already exists: {target_dir}")
        # Check if it's a git repository
        if (target_dir / ".git").exists():
            print("  [OK] Existing git repository found")
            return True
        else:
            print("  [WARN] Directory exists but is not a git repository")
            print("  Please remove it or use --skip-clone")
            return False

    if dry_run:
        print(f"  [DRY RUN] Would clone {OFFICIAL_ARCHIPELAGO_REPO} to {target_dir}")
        return True

    success, _, _ = run_command(
        ["git", "clone", OFFICIAL_ARCHIPELAGO_REPO, str(target_dir)],
        f"Clone Archipelago to {target_dir}",
    )
    return success


def setup_venv(target_dir: Path, dry_run: bool = False) -> bool:
    """Set up Python virtual environment and install dependencies."""
    print_header("Setting Up Python Virtual Environment")

    venv_path = target_dir / ".venv"
    python_exe = get_python_executable(venv_path)
    pip_exe = get_pip_executable(venv_path)

    if dry_run:
        print(f"  [DRY RUN] Would create venv at {venv_path}")
        print(f"  [DRY RUN] Would install requirements")
        return True

    # Create venv if it doesn't exist
    if not venv_path.exists():
        success, _, _ = run_command(
            [sys.executable, "-m", "venv", str(venv_path)],
            "Create virtual environment",
        )
        if not success:
            return False
    else:
        print(f"  [OK] Virtual environment already exists at {venv_path}")

    # Install requirements
    requirements_file = target_dir / "requirements.txt"
    if requirements_file.exists():
        success, _, _ = run_command(
            [str(pip_exe), "install", "-r", str(requirements_file)],
            "Install Python requirements",
            cwd=target_dir,
        )
        if not success:
            return False

    # Install setuptools for pkg_resources (needed by some worlds)
    success, _, _ = run_command(
        [str(pip_exe), "install", "setuptools"],
        "Install setuptools (for pkg_resources)",
        cwd=target_dir,
    )
    if not success:
        print("  [WARN] Failed to install setuptools, continuing anyway")

    return True


def download_apworld(version: str, target_dir: Path, dry_run: bool = False) -> Optional[Path]:
    """Download the JSON Tools Installer apworld file."""
    print_header(f"Downloading JSON Tools Installer APWorld ({version})")

    if version == "dev":
        repo = DEV_REPO
        branch = DEV_BRANCH
    else:
        repo = STABLE_REPO
        branch = STABLE_BRANCH

    url = f"https://github.com/{repo}/raw/{branch}/apworlds/json_tools_installer.apworld"
    print(f"  Source: {repo} @ {branch}")
    print(f"  URL: {url}")

    if dry_run:
        print("  [DRY RUN] Would download apworld file")
        return target_dir / "apworlds" / "json_tools_installer.apworld"

    # Create apworlds directory
    apworlds_dir = target_dir / "apworlds"
    apworlds_dir.mkdir(exist_ok=True)

    apworld_path = apworlds_dir / "json_tools_installer.apworld"

    try:
        print("  Downloading...")
        urllib.request.urlretrieve(url, apworld_path)
        print(f"  [OK] Downloaded to {apworld_path}")
        return apworld_path
    except Exception as e:
        print(f"  [FAIL] Download failed: {e}")
        return None


def extract_apworld(apworld_path: Path, target_dir: Path, dry_run: bool = False) -> bool:
    """Extract the apworld (which is a zip file) to worlds/json_tools_installer."""
    print_header("Extracting JSON Tools Installer")

    worlds_dir = target_dir / "worlds"
    installer_dir = worlds_dir / "json_tools_installer"

    if dry_run:
        print(f"  [DRY RUN] Would extract {apworld_path} to {installer_dir}")
        return True

    # Remove existing directory if present
    if installer_dir.exists():
        print(f"  Removing existing directory: {installer_dir}")
        shutil.rmtree(installer_dir)

    try:
        print(f"  Extracting {apworld_path}...")
        with zipfile.ZipFile(apworld_path, 'r') as zip_ref:
            # Check if the apworld has a containing directory or not
            namelist = zip_ref.namelist()
            has_containing_dir = all('/' in name for name in namelist if name)

            if has_containing_dir:
                # Files are in a subdirectory, extract to worlds/
                first_component = namelist[0].split('/')[0]
                zip_ref.extractall(worlds_dir)
                extracted_dir = worlds_dir / first_component
                if extracted_dir.exists() and extracted_dir.name != "json_tools_installer":
                    extracted_dir.rename(installer_dir)
            else:
                # Files are at root level, extract directly to json_tools_installer/
                installer_dir.mkdir(parents=True, exist_ok=True)
                zip_ref.extractall(installer_dir)

        if installer_dir.exists():
            print(f"  [OK] Extracted to {installer_dir}")
            return True
        else:
            print("  [FAIL] Could not find extracted directory")
            return False

    except Exception as e:
        print(f"  [FAIL] Extraction failed: {e}")
        return False


def run_installer(
    target_dir: Path,
    version: str,
    install_all: bool,
    patch_mode: str = "monkey",
    romless: bool = False,
    upstream_fixes: bool = False,
    dry_run: bool = False,
) -> bool:
    """Run the JSON Tools installer."""
    print_header(f"Running JSON Tools Installer ({version}, {patch_mode} patching)")

    venv_path = target_dir / ".venv"
    python_exe = get_python_executable(venv_path)

    cmd = [
        str(python_exe),
        "-m", "worlds.json_tools_installer",
        "install",
        "--version", version,
        "--yes",  # Skip confirmation prompts
    ]

    if patch_mode == "none":
        cmd.append("--no-patch")
    # monkey patching is the default, no flag needed

    if install_all:
        cmd.append("--all")

    if romless:
        cmd.append("--apply-romless-patches")

    if upstream_fixes:
        cmd.append("--upstream-fixes")

    if dry_run:
        print(f"  [DRY RUN] Would run: {' '.join(cmd)}")
        return True

    # Run the installer (pipe newlines to auto-answer any "press enter" prompts
    # from Archipelago's ModuleUpdate.py)
    success, _, _ = run_command(
        cmd,
        f"Install JSON Tools ({version})",
        cwd=target_dir,
        capture_output=False,
        stdin_text="\n",
    )

    return success


def setup_dev_environment(target_dir: Path, dry_run: bool = False) -> bool:
    """Run the development environment setup script."""
    print_header("Setting Up Development Environment")

    venv_path = target_dir / ".venv"
    python_exe = get_python_executable(venv_path)
    setup_script = target_dir / "scripts" / "setup" / "setup_dev_environment.py"

    if not setup_script.exists():
        print(f"  [WARN] Setup script not found: {setup_script}")
        print("  Skipping development environment setup")
        return True

    if dry_run:
        print(f"  [DRY RUN] Would run: {python_exe} {setup_script}")
        return True

    success, _, _ = run_command(
        [str(python_exe), str(setup_script)],
        "Run setup_dev_environment.py",
        cwd=target_dir,
        capture_output=False,
    )

    return success


def run_verification_tests(
    target_dir: Path,
    game_name: str,
    template_name: str,
    dry_run: bool = False,
) -> bool:
    """Run spoiler and UT fuzz verification tests for a single game.

    Runs two tests:
    1. Spoiler test via test-all-templates.py
    2. UT fuzz test via test-all-ut-fuzz.py (1 run)

    Returns True only if both pass.
    """
    print_header(f"Running Verification Tests ({game_name})")

    venv_path = target_dir / ".venv"
    python_exe = get_python_executable(venv_path)
    spoiler_script = target_dir / "scripts" / "test" / "test-all-templates.py"
    fuzz_script = target_dir / "scripts" / "test" / "test-all-ut-fuzz.py"

    if dry_run:
        print(f"  [DRY RUN] Would run spoiler test: {python_exe} {spoiler_script} --include-list \"{template_name}\"")
        print(f"  [DRY RUN] Would run UT fuzz test: {python_exe} {fuzz_script} --runs 10 --include-list \"{template_name}\"")
        return True

    all_passed = True

    # Test 1: Spoiler test
    if not spoiler_script.exists():
        print(f"  [WARN] Spoiler test script not found: {spoiler_script}")
        all_passed = False
    else:
        print(f"  Running spoiler test for {game_name}...\n")
        success, _, _ = run_command(
            [str(python_exe), str(spoiler_script), "--include-list", template_name],
            f"Spoiler test ({game_name})",
            cwd=target_dir,
            capture_output=False,
        )
        if success:
            print(f"\n  [OK] Spoiler test passed!")
        else:
            print(f"\n  [FAIL] Spoiler test failed")
            all_passed = False

    # Test 2: UT fuzz test
    if not fuzz_script.exists():
        print(f"  [WARN] UT fuzz test script not found: {fuzz_script}")
        all_passed = False
    else:
        print(f"\n  Running UT fuzz test for {game_name}...\n")
        success, _, _ = run_command(
            [str(python_exe), str(fuzz_script), "--runs", "10", "--include-list", template_name],
            f"UT fuzz test ({game_name})",
            cwd=target_dir,
            capture_output=False,
        )
        if success:
            print(f"\n  [OK] UT fuzz test passed!")
        else:
            print(f"\n  [FAIL] UT fuzz test failed")
            all_passed = False

    return all_passed


def seed_metamath_apworld(target_dir: Path, dry_run: bool = False) -> bool:
    """Drop the tracked metamath.apworld into the clone's custom_worlds/.

    Done BEFORE the installer runs, so the installer's apworld-requirements
    scan finds it and auto-installs metamath-py alongside the core deps.
    """
    print_header("Seeding custom_worlds with metamath.apworld (--test-apworld-deps)")

    source = SCRIPT_REPO_ROOT / "apworlds" / "metamath.apworld"
    if not source.exists():
        print(f"  [FAIL] Fixture apworld not found: {source}")
        return False

    dest = target_dir / "custom_worlds" / "metamath.apworld"
    if dry_run:
        print(f"  [DRY RUN] Would copy {source} to {dest}")
        return True

    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, dest)
    print_status("Copied", str(dest))
    return True


def get_clone_ap_version(target_dir: Path) -> Optional[str]:
    """Base AP version of the clone (via its venv's Utils.__version__)."""
    python_exe = get_python_executable(target_dir / ".venv")
    try:
        result = subprocess.run(
            [str(python_exe), "-c",
             "import Utils; print(Utils.__version__.split('-')[0])"],
            cwd=target_dir, capture_output=True, text=True, timeout=120,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def stage_metamath_yaml(target_dir: Path, dry_run: bool = False) -> Optional[str]:
    """Copy the MetaMath template into the clone, adapted to its AP version.

    Applies the known cross-version edits: requires.version is lowered to the
    clone's actual AP version and the world-version game pin is dropped (the
    apworld's world_version need not match the template's).

    Returns the weights_file_path value to pass to Generate.py, or None.
    """
    template = SCRIPT_REPO_ROOT / "Players" / "Templates" / "Metamath.yaml"
    if not template.exists():
        print(f"  [FAIL] MetaMath template not found: {template}")
        return None

    rel_path = os.path.join("Templates", "Metamath.yaml")
    if dry_run:
        print(f"  [DRY RUN] Would stage {template} as Players/{rel_path}")
        return rel_path

    version = get_clone_ap_version(target_dir)
    if not version:
        print("  [FAIL] Could not read the clone's AP version")
        return None

    text = template.read_text(encoding="utf-8-sig")
    # Replace the whole requires: block with a version-only one
    text, count = re.subn(
        r"^requires:\n(?:[ \t]+.*\n)*",
        f"requires:\n  version: {version}\n",
        text, count=1, flags=re.MULTILINE,
    )
    if not count:
        print("  [WARN] Template has no requires: block; staging unmodified")

    dest = target_dir / "Players" / "Templates" / "Metamath.yaml"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")
    print_status("Staged", f"{dest} (requires.version -> {version})")
    return rel_path


def verify_apworld_dependencies(target_dir: Path, dry_run: bool = False) -> bool:
    """Verify the installer satisfied the seeded apworld's requirements.

    Two checks: metamathpy (the import name of metamath-py — the dist-name /
    import-name mismatch is the regression this guards) imports in the
    clone's venv, and MetaMath actually generates a seed there.
    """
    print_header("Verifying APWorld Dependencies (--test-apworld-deps)")

    python_exe = get_python_executable(target_dir / ".venv")

    if dry_run:
        print("  [DRY RUN] Would import metamathpy and generate MetaMath")
        return True

    success, _, stderr = run_command(
        [str(python_exe), "-c", "import metamathpy"],
        "Import metamathpy in the clone's venv",
        cwd=target_dir,
    )
    if not success:
        print(f"  [FAIL] metamathpy did not import: {stderr[:300]}")
        return False

    weights_rel = stage_metamath_yaml(target_dir, dry_run)
    if not weights_rel:
        return False

    success, _, _ = run_command(
        [str(python_exe), "Generate.py",
         "--weights_file_path", weights_rel, "--multi", "1", "--seed", "1"],
        "Generate a MetaMath seed",
        cwd=target_dir,
        capture_output=False,
        stdin_text="\n",
    )
    if success:
        print("\n  [OK] MetaMath generated with auto-installed requirements")
    else:
        print("\n  [FAIL] MetaMath generation failed")
    return success


# Trees the snapshot never records: build/runtime state that install and
# uninstall legitimately touch, plus fixture locations this script seeds.
SNAPSHOT_EXCLUDED_PARTS = {
    ".git", ".venv", "__pycache__", "logs", "output", "custom_worlds",
    "Players", "metamath_data",  # set.mm download cache (--test-apworld-deps)
}
# Diffs the uninstall round-trip accepts: state AP itself creates on first
# run, and the installer's own backup/config bookkeeping (kept on uninstall
# so a re-install can still restore/reuse them).
UNINSTALL_ALLOWED_DIFF_PREFIXES = (
    "host.yaml",
    "json_tools_backups/",
    "json_tools_config.json",
)


def take_snapshot(target_dir: Path) -> Dict[str, str]:
    """relpath -> sha1 for every file the uninstall round-trip compares."""
    snapshot = {}
    for path in sorted(target_dir.rglob("*")):
        if not path.is_file() or path.suffix == ".pyc":
            continue
        rel = path.relative_to(target_dir)
        if any(part in SNAPSHOT_EXCLUDED_PARTS for part in rel.parts):
            continue
        snapshot[rel.as_posix()] = hashlib.sha1(path.read_bytes()).hexdigest()
    return snapshot


def run_uninstall_roundtrip(
    target_dir: Path,
    pre_snapshot: Dict[str, str],
    dry_run: bool = False,
) -> bool:
    """Run the uninstall path and diff the clone against the pre-install
    snapshot. Fails on any unexplained added/removed/changed file — this is
    what verifies the vanilla rule_builder/ backup restore, among others."""
    print_header("Uninstall Round-Trip (--test-uninstall)")

    python_exe = get_python_executable(target_dir / ".venv")

    if dry_run:
        print("  [DRY RUN] Would run the uninstaller and diff against snapshot")
        return True

    success, _, _ = run_command(
        [str(python_exe), "-m", "worlds.json_tools_installer",
         "install", "--uninstall", "--yes"],
        "Uninstall JSON Tools",
        cwd=target_dir,
        capture_output=False,
        stdin_text="\n",
    )
    if not success:
        print("  [FAIL] Uninstaller exited non-zero")
        return False

    post_snapshot = take_snapshot(target_dir)

    def unexplained(paths):
        return sorted(
            p for p in paths
            if not p.startswith(UNINSTALL_ALLOWED_DIFF_PREFIXES))

    added = unexplained(set(post_snapshot) - set(pre_snapshot))
    removed = unexplained(set(pre_snapshot) - set(post_snapshot))
    changed = unexplained(
        p for p in set(pre_snapshot) & set(post_snapshot)
        if pre_snapshot[p] != post_snapshot[p])

    ok = not (added or removed or changed)
    print(f"\n  Snapshot diff vs pre-install ({len(pre_snapshot)} files tracked):")
    for label, paths in (("Added", added), ("Removed", removed), ("Changed", changed)):
        print(f"    {label}: {len(paths)}")
        for p in paths[:20]:
            print(f"      - {p}")
        if len(paths) > 20:
            print(f"      ... and {len(paths) - 20} more")

    if ok:
        print("\n  [OK] Uninstall restored the pre-install state "
              "(vanilla rule_builder/ included)")
    else:
        print("\n  [FAIL] Uninstall left unexplained differences (see above)")
    return ok


def main():
    parser = argparse.ArgumentParser(
        description="Install JSON Tools into a fresh Archipelago installation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--dev",
        action="store_true",
        help="Use development branch instead of stable",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Install all components (frontend, presets, docs, etc.)",
    )
    parser.add_argument(
        "--target-dir",
        type=Path,
        default=Path(DEFAULT_TARGET_DIR),
        help=f"Target directory for installation (default: {DEFAULT_TARGET_DIR})",
    )
    parser.add_argument(
        "--skip-clone",
        action="store_true",
        help="Skip cloning (assume Archipelago already exists)",
    )
    parser.add_argument(
        "--skip-setup",
        action="store_true",
        help="Skip development environment setup",
    )
    parser.add_argument(
        "--romless",
        action="store_true",
        help="Install and apply ROM-less patches (allows testing ROM-based games without ROMs)",
    )
    parser.add_argument(
        "--upstream-fixes",
        action="store_true",
        help="Overlay fork fixes for upstream world bugs (e.g. ALttP bunny rules) "
             "onto the vanilla worlds. Opt-in; needed for ALttP worldgen UT-fuzz to pass",
    )
    parser.add_argument(
        "--patch-mode",
        choices=["monkey", "none"],
        default="monkey",
        help="Patching mode: monkey (default, runtime patching) or none",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Delete existing target directory before cloning",
    )
    parser.add_argument(
        "--test",
        choices=["auto", "adventure", "alttp", "none"],
        default=None,  # Will be set to "auto" below
        help="Test mode: auto (default, picks ALTTP if --romless else Adventure), adventure, alttp, or none",
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Same as --test none",
    )
    parser.add_argument(
        "--test-apworld-deps",
        action="store_true",
        help="Seed custom_worlds/ with metamath.apworld before installing and "
             "verify its requirements were auto-installed (metamathpy imports, "
             "MetaMath generates). Incompatible with --all (demo_worlds would "
             "register MetaMath twice)",
    )
    parser.add_argument(
        "--test-uninstall",
        action="store_true",
        help="After install (and tests), run the uninstall path and assert the "
             "clone matches the pre-install file snapshot. Best combined with "
             "--skip-setup so dev-environment changes don't muddy the diff",
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Show what would be done without making changes",
    )

    args = parser.parse_args()

    if args.test_apworld_deps and args.all:
        parser.error("--test-apworld-deps cannot be combined with --all: "
                     "the demo_worlds component also carries MetaMath, and a "
                     "second copy in custom_worlds/ would double-register the game")

    # Handle --skip-tests as alias for --test none
    if args.skip_tests:
        args.test = "none"

    # Default test mode
    if args.test is None:
        args.test = "auto"

    version = "dev" if args.dev else "stable"
    target_dir = args.target_dir.resolve()

    print_header("JSON Tools Installation Script")
    print(f"  Version: {version}")
    print(f"  Target: {target_dir}")
    print(f"  Install all: {args.all}")
    print(f"  Patch mode: {args.patch_mode}")
    print(f"  ROM-less patches: {args.romless}")
    print(f"  Test: {args.test}")
    if args.dry_run:
        print("  Mode: DRY RUN")

    # Step 1: Clone Archipelago
    if not args.skip_clone:
        if not clone_archipelago(target_dir, args.fresh, args.dry_run):
            print("\n[FAIL] Failed to clone Archipelago repository")
            return 1
    else:
        print("\n[SKIP] Skipping clone (--skip-clone)")
        if not target_dir.exists():
            print(f"[FAIL] Target directory does not exist: {target_dir}")
            return 1

    # Step 2: Set up virtual environment
    if not setup_venv(target_dir, args.dry_run):
        print("\n[FAIL] Failed to set up virtual environment")
        return 1

    # Step 3: Download apworld
    apworld_path = download_apworld(version, target_dir, args.dry_run)
    if not apworld_path and not args.dry_run:
        print("\n[FAIL] Failed to download apworld")
        return 1

    # Step 4: Extract apworld
    if apworld_path and not extract_apworld(apworld_path, target_dir, args.dry_run):
        print("\n[FAIL] Failed to extract apworld")
        return 1

    # Step 4.5: Seed apworld fixture BEFORE installing so the installer's
    # requirements scan picks it up (--test-apworld-deps)
    if args.test_apworld_deps:
        if not seed_metamath_apworld(target_dir, args.dry_run):
            print("\n[FAIL] Failed to seed metamath.apworld")
            return 1

    # Step 4.8: Snapshot the pre-install state (--test-uninstall)
    pre_snapshot: Optional[Dict[str, str]] = None
    if args.test_uninstall and not args.dry_run:
        print_header("Taking Pre-Install Snapshot (--test-uninstall)")
        pre_snapshot = take_snapshot(target_dir)
        print_status("Files tracked", str(len(pre_snapshot)))

    # Step 5: Run installer (includes romless patches if requested)
    if not run_installer(target_dir, version, args.all, args.patch_mode, args.romless,
                         args.upstream_fixes, args.dry_run):
        print("\n[FAIL] Failed to run JSON Tools installer")
        return 1

    # Step 6: Set up development environment
    if not args.skip_setup:
        if not setup_dev_environment(target_dir, args.dry_run):
            print("\n[WARN] Development environment setup had issues")
            # Don't fail on this
    else:
        print("\n[SKIP] Skipping development environment setup (--skip-setup)")

    # Step 8: Run tests
    results_ok = True

    if args.test == "none":
        print("\n[SKIP] Skipping tests (--test none)")
    else:
        if args.test == "auto":
            game_name = "A Link to the Past" if args.romless else "Adventure"
        elif args.test == "alttp":
            game_name = "A Link to the Past"
        else:
            game_name = "Adventure"
        template_name = f"{game_name}.yaml"
        results_ok = run_verification_tests(target_dir, game_name, template_name, args.dry_run)

    # Step 8.5: Verify apworld requirements auto-install (--test-apworld-deps)
    if args.test_apworld_deps:
        if not verify_apworld_dependencies(target_dir, args.dry_run):
            results_ok = False

    # Step 9: Uninstall round-trip (--test-uninstall) — only meaningful after
    # a successful install + verification
    if args.test_uninstall:
        if not results_ok:
            print("\n[SKIP] Skipping uninstall round-trip: earlier steps failed")
        elif not run_uninstall_roundtrip(target_dir, pre_snapshot or {}, args.dry_run):
            results_ok = False

    # Final summary
    print_header("Installation Complete!")
    print(f"  JSON Tools has been installed to: {target_dir}")
    print(f"\n  To use:")
    print(f"    cd {target_dir}")
    if sys.platform == "win32":
        print(f"    .venv\\Scripts\\activate")
    else:
        print(f"    source .venv/bin/activate")
    print(f"    python -m http.server 8000")
    print(f"\n  Then open: http://localhost:8000/frontend/")

    if not results_ok:
        print("\n  [WARN] Some unexpected test failures occurred")
        print("  Check the output above for details")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
