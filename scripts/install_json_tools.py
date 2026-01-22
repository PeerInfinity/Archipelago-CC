#!/usr/bin/env python3
"""
Standalone installation script for JSON Tools.

This script automates the complete setup process for JSON Tools in a fresh
Archipelago installation. It:

1. Clones the official Archipelago repository
2. Creates a virtual environment and installs dependencies
3. Downloads and installs the JSON Tools Installer apworld
4. Runs the installer to download and patch JSON Tools components
5. Sets up the development environment
6. Optionally applies ROM-less patches for testing ROM-based games
7. Runs a verification test (Adventure by default, or ALTTP with --romless)

Usage:
    # Install stable version with default components (tests with Adventure)
    python scripts/install_json_tools.py

    # Install dev version with all components
    python scripts/install_json_tools.py --dev --all

    # Install with ROM-less patches (tests with ALTTP)
    python scripts/install_json_tools.py --romless

    # Install to a specific directory
    python scripts/install_json_tools.py --target-dir /path/to/install

    # Skip tests
    python scripts/install_json_tools.py --skip-tests

    # Run the full fuzzer test
    python scripts/install_json_tools.py --test fuzzer

Options:
    --dev               Use development branch (PeerInfinity/Archipelago-CC @ main)
                        Default is stable (PeerInfinity/Archipelago @ JSONExport)
    --all               Install all components (frontend, presets, docs, etc.)
    --romless           Install and apply ROM-less patches (enables ALTTP testing)
    --target-dir DIR    Install to specified directory (default: ./archipelago-json-tools)
    --test MODE         Test mode: adventure (default), alttp (needs --romless), fuzzer, none
    --skip-tests        Same as --test none
    --skip-clone        Skip cloning (assume Archipelago already exists in target dir)
    --skip-setup        Skip development environment setup
    --dry-run           Show what would be done without making changes
    --help              Show this help message
"""

import argparse
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path
from typing import List, Optional, Tuple


# Repository configuration
OFFICIAL_ARCHIPELAGO_REPO = "https://github.com/ArchipelagoMW/Archipelago.git"

# JSON Tools sources
STABLE_REPO = "PeerInfinity/Archipelago"
STABLE_BRANCH = "JSONExport"
DEV_REPO = "PeerInfinity/Archipelago-CC"
DEV_BRANCH = "main"

# Expected failures file path (relative to project root)
EXPECTED_FAILURES_DOC = "docs/json/developer/test-results/test-results-ut-fuzz-modified.md"

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
) -> Tuple[bool, str, str]:
    """
    Run a command and return (success, stdout, stderr).
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


def clone_archipelago(target_dir: Path, dry_run: bool = False) -> bool:
    """Clone the official Archipelago repository."""
    print_header("Cloning Official Archipelago Repository")

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
    dry_run: bool = False,
) -> bool:
    """Run the JSON Tools installer."""
    print_header(f"Running JSON Tools Installer ({version})")

    venv_path = target_dir / ".venv"
    python_exe = get_python_executable(venv_path)

    cmd = [
        str(python_exe),
        "-m", "worlds.json_tools_installer",
        "install",
        "--version", version,
        "--monkey-patch",  # Use runtime patching for compatibility with newer AP versions
        "--yes",  # Skip confirmation prompts
    ]

    if install_all:
        cmd.append("--all")

    if dry_run:
        print(f"  [DRY RUN] Would run: {' '.join(cmd)}")
        return True

    # Run the installer
    success, _, _ = run_command(
        cmd,
        f"Install JSON Tools ({version})",
        cwd=target_dir,
        capture_output=False,
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


def apply_romless_patches(target_dir: Path, dry_run: bool = False) -> bool:
    """Apply ROM-less patches to allow generation without ROM files.

    This delegates to scripts/setup/apply_romless_patches.py which uses
    the world-init-files.diff to patch world files. The diff-based approach
    will fail cleanly if the Archipelago version doesn't match.

    Note: ROM-less generation also requires skip_required_files support in
    settings.py, which should be provided by the core JSON Tools patches.
    If that support is missing, the world patches will fail at runtime.
    """
    print_header("Applying ROM-less Patches")

    venv_path = target_dir / ".venv"
    python_exe = get_python_executable(venv_path)
    patch_script = target_dir / "scripts" / "setup" / "apply_romless_patches.py"

    if dry_run:
        print(f"  [DRY RUN] Would run: {python_exe} {patch_script}")
        return True

    if not patch_script.exists():
        print(f"  [SKIP] ROM-less patches script not found: {patch_script}")
        print("  (romless_patches component may not be installed)")
        return True  # Not a failure, just skip

    success, _, _ = run_command(
        [str(python_exe), str(patch_script)],
        "Apply ROM-less patches to world files",
        cwd=target_dir,
        capture_output=False,
    )

    if not success:
        print("  [FAIL] Failed to apply ROM-less patches")
        print("  This may indicate an incompatible Archipelago version.")
        print("  ROM-less generation will not be available.")
        return False

    return True


def run_adventure_test(target_dir: Path, dry_run: bool = False) -> bool:
    """Run a quick verification test using Adventure (no ROM required)."""
    print_header("Running Verification Test (Adventure)")

    venv_path = target_dir / ".venv"
    python_exe = get_python_executable(venv_path)
    test_script = target_dir / "scripts" / "test" / "test-all-templates.py"

    if dry_run:
        print(f"  [DRY RUN] Would run: {python_exe} {test_script} --include-list \"Adventure.yaml\"")
        return True

    if not test_script.exists():
        print(f"  [WARN] Test script not found: {test_script}")
        return False

    print("  Running Adventure template test...")
    print("  This verifies the installation is working correctly.\n")

    success, stdout, stderr = run_command(
        [str(python_exe), str(test_script), "--include-list", "Adventure.yaml"],
        "Run Adventure test",
        cwd=target_dir,
        capture_output=False,
    )

    if success:
        print("\n  [OK] Adventure test passed!")
    else:
        print("\n  [FAIL] Adventure test failed")

    return success


def run_alttp_test(target_dir: Path, dry_run: bool = False) -> bool:
    """Run a quick verification test using A Link to the Past."""
    print_header("Running Verification Test (A Link to the Past)")

    venv_path = target_dir / ".venv"
    python_exe = get_python_executable(venv_path)
    test_script = target_dir / "scripts" / "test" / "test-all-templates.py"

    if dry_run:
        print(f"  [DRY RUN] Would run: {python_exe} {test_script} --include-list \"A Link to the Past.yaml\"")
        return True

    if not test_script.exists():
        print(f"  [WARN] Test script not found: {test_script}")
        return False

    print("  Running A Link to the Past template test...")
    print("  This verifies the installation is working correctly.\n")

    success, stdout, stderr = run_command(
        [str(python_exe), str(test_script), "--include-list", "A Link to the Past.yaml"],
        "Run A Link to the Past test",
        cwd=target_dir,
        capture_output=False,
    )

    if success:
        print("\n  [OK] A Link to the Past test passed!")
    else:
        print("\n  [FAIL] A Link to the Past test failed")

    return success


def run_fuzzer_test(target_dir: Path, dry_run: bool = False) -> Optional[dict]:
    """Run the UT fuzzer test with 1 run per game."""
    print_header("Running UT Fuzzer Test")

    venv_path = target_dir / ".venv"
    python_exe = get_python_executable(venv_path)
    test_script = target_dir / "scripts" / "test" / "test-all-ut-fuzz.py"

    if dry_run:
        print(f"  [DRY RUN] Would run: {python_exe} {test_script} --runs 1")
        return {"dry_run": True}

    if not test_script.exists():
        print(f"  [WARN] Test script not found: {test_script}")
        return None

    print("  Running fuzzer test with 1 run per game...")
    print("  This may take a while...\n")

    success, stdout, stderr = run_command(
        [str(python_exe), str(test_script), "--runs", "1"],
        "Run UT fuzzer test (1 run per game)",
        cwd=target_dir,
        capture_output=False,
    )

    # Try to load the results file
    results_file = target_dir / "scripts" / "output" / "ut-fuzz" / "test-results.json"
    if results_file.exists():
        try:
            import json
            with open(results_file) as f:
                return json.load(f)
        except Exception as e:
            print(f"  [WARN] Could not parse results file: {e}")

    return {"success": success}


def parse_expected_failures(doc_path: Path) -> set:
    """Parse the expected failures documentation to get the list of excluded games."""
    excluded_games = set()

    if not doc_path.exists():
        print(f"  [WARN] Expected failures doc not found: {doc_path}")
        return excluded_games

    try:
        content = doc_path.read_text()

        # Look for the "Excluded Templates" section
        in_excluded_section = False
        for line in content.split('\n'):
            if '## Excluded Templates' in line:
                in_excluded_section = True
                continue

            if in_excluded_section:
                # Stop at next section
                if line.startswith('## ') or line.startswith('### '):
                    if 'Unexpected' not in line:
                        break

                # Parse table rows like: | Template Name.yaml | Reason |
                if line.startswith('|') and '.yaml' in line:
                    parts = line.split('|')
                    if len(parts) >= 2:
                        template = parts[1].strip()
                        if template and not template.startswith('-'):
                            excluded_games.add(template)

        return excluded_games

    except Exception as e:
        print(f"  [WARN] Could not parse expected failures: {e}")
        return excluded_games


def compare_results(
    target_dir: Path,
    test_results: Optional[dict],
    dry_run: bool = False,
) -> bool:
    """Compare test results to expected failures."""
    print_header("Comparing Results to Expected Failures")

    if dry_run:
        print("  [DRY RUN] Would compare results to expected failures")
        return True

    if not test_results:
        print("  [WARN] No test results available for comparison")
        return False

    expected_failures_path = target_dir / EXPECTED_FAILURES_DOC
    expected_excluded = parse_expected_failures(expected_failures_path)

    print(f"  Expected excluded templates: {len(expected_excluded)}")

    # Get actual failures from results
    actual_failures = set()
    actual_passes = set()

    if "games" in test_results:
        for game_name, game_data in test_results.get("games", {}).items():
            if game_data.get("failures", 0) > 0 or game_data.get("timeouts", 0) > 0:
                # Convert game name to template format
                template = f"{game_name}.yaml"
                actual_failures.add(template)
            else:
                template = f"{game_name}.yaml"
                actual_passes.add(template)

    # Analyze results
    expected_and_failed = expected_excluded & actual_failures
    expected_but_passed = expected_excluded & actual_passes
    unexpected_failures = actual_failures - expected_excluded

    print(f"\n  Results Summary:")
    print(f"  ----------------")
    print(f"  Total games tested: {len(actual_failures) + len(actual_passes)}")
    print(f"  Passed: {len(actual_passes)}")
    print(f"  Failed: {len(actual_failures)}")
    print(f"")
    print(f"  Expected failures (failed as expected): {len(expected_and_failed)}")
    print(f"  Unexpected passes (excluded but passed): {len(expected_but_passed)}")
    print(f"  Unexpected failures (not excluded): {len(unexpected_failures)}")

    if expected_but_passed:
        print(f"\n  Unexpected passes (these excluded games now pass):")
        for game in sorted(expected_but_passed):
            print(f"    - {game}")

    if unexpected_failures:
        print(f"\n  Unexpected failures (these need investigation):")
        for game in sorted(unexpected_failures):
            print(f"    - {game}")

    # Return True if no unexpected failures
    return len(unexpected_failures) == 0


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
        "--test",
        choices=["adventure", "alttp", "fuzzer", "none"],
        default=None,  # Will be set based on --romless
        help="Test mode: adventure (default), alttp (requires --romless), fuzzer, or none",
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Same as --test none",
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Show what would be done without making changes",
    )

    args = parser.parse_args()

    # Handle --skip-tests as alias for --test none
    if args.skip_tests:
        args.test = "none"

    # Default test based on --romless
    if args.test is None:
        args.test = "alttp" if args.romless else "adventure"

    version = "dev" if args.dev else "stable"
    target_dir = args.target_dir.resolve()

    print_header("JSON Tools Installation Script")
    print(f"  Version: {version}")
    print(f"  Target: {target_dir}")
    print(f"  Install all: {args.all}")
    print(f"  ROM-less patches: {args.romless}")
    print(f"  Test: {args.test}")
    if args.dry_run:
        print("  Mode: DRY RUN")

    # Step 1: Clone Archipelago
    if not args.skip_clone:
        if not clone_archipelago(target_dir, args.dry_run):
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

    # Step 5: Run installer
    if not run_installer(target_dir, version, args.all, args.dry_run):
        print("\n[FAIL] Failed to run JSON Tools installer")
        return 1

    # Step 6: Set up development environment
    if not args.skip_setup:
        if not setup_dev_environment(target_dir, args.dry_run):
            print("\n[WARN] Development environment setup had issues")
            # Don't fail on this
    else:
        print("\n[SKIP] Skipping development environment setup (--skip-setup)")

    # Step 7: Apply ROM-less patches (if requested)
    if args.romless:
        apply_romless_patches(target_dir, args.dry_run)
    else:
        print("\n[SKIP] Skipping ROM-less patches (use --romless to enable)")

    # Step 8: Run tests
    test_results = None
    results_ok = True

    if args.test == "adventure":
        results_ok = run_adventure_test(target_dir, args.dry_run)
    elif args.test == "alttp":
        results_ok = run_alttp_test(target_dir, args.dry_run)
    elif args.test == "fuzzer":
        test_results = run_fuzzer_test(target_dir, args.dry_run)
        if test_results:
            results_ok = compare_results(target_dir, test_results, args.dry_run)
        else:
            results_ok = False
    else:
        print("\n[SKIP] Skipping tests (--test none)")

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
