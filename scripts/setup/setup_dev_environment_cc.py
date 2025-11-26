#!/usr/bin/env python3
"""
Simplified setup script for Archipelago JSON Export Tools development environment.
Designed for cloud/container environments (e.g., Claude Code) with limited capabilities.

This version skips steps that may not work in restricted environments:
- ModuleUpdate.py (may have network/download issues)
- Template generation (may require full Archipelago setup)
- Launcher.py for host.yaml (may require GUI or full setup)
- Node.js dependencies (may have network issues)
"""
import os
import sys
import subprocess
import shutil
from pathlib import Path


def safe_print(text):
    """
    Print text safely, falling back to ASCII if encoding fails.
    """
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))


def print_step(step_num, step_name):
    """Print a formatted step header"""
    print(f"\n{'='*60}")
    print(f"STEP {step_num}: {step_name}")
    print('='*60)


def run_command(cmd, description, shell=False, check_exit=True, cwd=None):
    """Run a command and handle errors"""
    print(f"\nRunning: {description}")
    print(f"Command: {cmd}")

    try:
        if shell:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
        else:
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)

        if result.stdout:
            print("Output:", result.stdout.strip())
        if result.stderr and result.returncode != 0:
            print("Error output:", result.stderr.strip())

        if check_exit and result.returncode != 0:
            safe_print(f"[FAIL] Command failed with exit code {result.returncode}")
            return False
        else:
            safe_print("[OK] Command completed successfully")
            return True

    except Exception as e:
        safe_print(f"[FAIL] Error running command: {e}")
        return False


def check_command_exists(cmd):
    """Check if a command exists in PATH"""
    return shutil.which(cmd) is not None


def main():
    safe_print("[START] Archipelago JSON Export Tools - Cloud Environment Setup")
    print("This is a simplified setup for cloud/container environments.")
    print("Some steps are skipped that may not work in restricted environments.")

    # Get the project root directory (parent of scripts directory)
    script_dir = Path(__file__).parent.absolute()
    project_root = script_dir.parent.parent
    os.chdir(project_root)

    print(f"\nProject root: {project_root}")

    # Step 1: Check Prerequisites
    print_step(1, "Checking Prerequisites")

    # Check Python
    if not check_command_exists("python") and not check_command_exists("python3"):
        safe_print("[FAIL] Python not found. Please install Python 3.8+ first.")
        return False

    # On Unix-like systems, prefer python3
    python_cmd = "python3" if check_command_exists("python3") else "python"
    safe_print(f"[OK] Python found: {python_cmd}")

    # Check Node.js (informational only)
    if check_command_exists("node") and check_command_exists("npm"):
        safe_print("[OK] Node.js and npm found (not used in this setup)")
    else:
        safe_print("[INFO] Node.js/npm not found (not required for this setup)")

    # Step 2: Set Up Python Virtual Environment
    print_step(2, "Setting Up Python Virtual Environment")

    venv_path = project_root / ".venv"
    if venv_path.exists():
        safe_print("[OK] Virtual environment already exists")
    else:
        print("Creating virtual environment...")
        if not run_command([python_cmd, "-m", "venv", ".venv"], "Create virtual environment"):
            return False

    # Determine paths for venv
    pip_cmd = str(venv_path / "bin" / "pip")
    python_venv = str(venv_path / "bin" / "python")

    # Upgrade pip first to avoid warnings
    print("Upgrading pip...")
    run_command([pip_cmd, "install", "--upgrade", "pip"], "Upgrade pip", check_exit=False)

    # Install base requirements
    print("Installing base Python requirements...")
    if not run_command([pip_cmd, "install", "-r", "requirements.txt"], "Install base requirements"):
        safe_print("[WARN] Some requirements may have failed to install")
        print("Continuing with setup...")

    # Step 3: Skipped Steps (informational)
    print_step(3, "Skipped Steps (Cloud Environment)")

    print("The following steps are skipped in cloud environments:")
    print("  - ModuleUpdate.py (game-specific dependencies)")
    print("  - Template generation (requires full Archipelago setup)")
    print("  - host.yaml creation (requires Launcher.py)")
    print("  - Node.js dependencies (npm install)")
    safe_print("[INFO] These can be run manually if needed")

    # Step 4: Verify Setup
    print_step(4, "Verifying Setup")

    print("Checking virtual environment...")
    result = subprocess.run([python_venv, "--version"], capture_output=True, text=True)
    if result.returncode == 0:
        safe_print(f"[OK] Python in venv: {result.stdout.strip()}")
    else:
        safe_print("[FAIL] Virtual environment verification failed")
        return False

    print("Checking if key files exist...")
    key_files = [
        ("requirements.txt", "Python requirements"),
        ("frontend/index.html", "Frontend application"),
        (".venv", "Virtual environment")
    ]

    all_present = True
    for file_path, description in key_files:
        if (project_root / file_path).exists():
            safe_print(f"[OK] {description}: {file_path}")
        else:
            safe_print(f"[MISSING] {file_path}")
            all_present = False

    # Final Instructions
    print_step("COMPLETE", "Setup Complete!")

    safe_print("[SUCCESS] Cloud environment setup is complete!")
    print("\nWhat was set up:")
    print("  - Python virtual environment (.venv)")
    print("  - Base Python requirements")

    print("\nTo activate the virtual environment:")
    print("   source .venv/bin/activate")

    print("\nTo run additional setup steps manually (if needed):")
    print(f"   {python_venv} ModuleUpdate.py --yes")
    print(f"   {python_venv} Launcher.py --update_settings")

    return True


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        safe_print("\n\n[WARN] Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        safe_print(f"\n\n[FAIL] Unexpected error: {e}")
        sys.exit(1)
