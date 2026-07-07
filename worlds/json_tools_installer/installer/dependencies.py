"""
Dependency installer for JSON Tools.

Installs Python packages required by JSON Tools components (exporter, etc.)
that aren't included in vanilla Archipelago's dependencies.
"""

import logging
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional, Tuple

from Utils import local_path, is_frozen

logger = logging.getLogger(__name__)

# Packages required by JSON Tools components beyond vanilla AP's deps
REQUIRED_PACKAGES = [
    "astunparse>=1.6.3",
    "dill>=0.3.8",
]


def check_missing_packages() -> List[str]:
    """
    Check which required packages are not installed.

    Returns:
        List of package requirement strings that are missing.
    """
    missing = []
    for req in REQUIRED_PACKAGES:
        # Extract package name (before any version specifier)
        pkg_name = req.split(">=")[0].split("==")[0].split("<")[0].strip()
        try:
            __import__(pkg_name)
        except ImportError:
            missing.append(req)
    return missing


def _frozen_ca_bundle() -> Optional[str]:
    """
    Get a real CA-bundle file path usable inside a frozen build.

    pip's vendored certifi resolves cacert.pem to a path inside
    lib/library.zip, which can't be opened as a file — TLS downloads fail.
    The standalone certifi package (also bundled) extracts the bundle to a
    temp file on demand; fall back to extracting it ourselves.
    """
    try:
        import certifi
        path = certifi.where()
        if Path(path).is_file():
            return path
    except Exception:
        pass
    try:
        from importlib import resources
        data = resources.files("certifi").joinpath("cacert.pem").read_bytes()
        fd, tmp_path = tempfile.mkstemp(suffix=".pem")
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        return tmp_path
    except Exception:
        return None


def _install_packages_frozen(packages: List[str]) -> Tuple[bool, str]:
    """
    Install packages on a frozen (compiled) Archipelago install.

    A pip subprocess can't work there — sys.executable is the frozen exe,
    which doesn't understand `-m pip`. Instead, run the bundled pip
    in-process with --target pointed at lib/, the only writable directory
    on the frozen sys.path.
    """
    target = Path(local_path()) / "lib"
    try:
        from pip._internal.cli.main import main as pip_main
    except ImportError:
        return False, (
            "pip is not bundled in this Archipelago build; cannot install "
            f"dependencies ({', '.join(packages)}). Extract them manually "
            f"into {target}."
        )

    ca_bundle = _frozen_ca_bundle()
    if ca_bundle:
        # pip's vendored certifi has no cacert.pem inside library.zip, and
        # pip's vendored requests calls certifi.where() at import time —
        # --cert alone can't prevent that crash. Point the vendored certifi
        # at a real bundle before pip imports its network stack.
        try:
            from pip._vendor import certifi as vendored_certifi
            vendored_certifi.where = lambda: ca_bundle
            vendored_certifi.core.where = lambda: ca_bundle
        except Exception as e:
            logger.debug(f"Could not patch pip's vendored certifi: {e}")

    # Console-script creation needs distlib's launcher exe templates
    # (t64.exe etc.), which are also missing from library.zip. We don't
    # need the scripts — only the importable packages — so skip making them.
    try:
        from pip._vendor.distlib import scripts as distlib_scripts
        distlib_scripts.ScriptMaker.make_multiple = (
            lambda self, specifications, options=None: []
        )
    except Exception as e:
        logger.debug(f"Could not patch distlib ScriptMaker: {e}")

    args = ["install", "--upgrade", "--target", str(target)]
    if ca_bundle:
        args += ["--cert", ca_bundle]
    args += packages
    logger.info(f"Running bundled pip in-process: pip {' '.join(args)}")
    try:
        rc = pip_main(args)
    except SystemExit as e:
        rc = e.code if isinstance(e.code, int) else 1
    except Exception as e:
        return False, f"Bundled pip failed: {e}"

    if rc == 0:
        return True, f"Installed into lib/: {', '.join(packages)}"
    return False, f"Bundled pip exited with code {rc}"


def install_packages(packages: List[str]) -> Tuple[bool, str]:
    """
    Install Python packages using pip.

    Args:
        packages: List of package requirement strings to install.

    Returns:
        Tuple of (success, output_message).
    """
    if not packages:
        return True, "No packages to install"

    if is_frozen():
        return _install_packages_frozen(packages)

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", *packages],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode == 0:
            return True, f"Installed: {', '.join(packages)}"
        else:
            return False, f"pip failed: {result.stderr.strip()}"

    except subprocess.TimeoutExpired:
        return False, "pip install timed out"
    except Exception as e:
        return False, f"Failed to run pip: {e}"


def install_missing_dependencies() -> Tuple[bool, str]:
    """
    Check for and install any missing dependencies.

    Returns:
        Tuple of (success, message).
    """
    missing = check_missing_packages()
    if not missing:
        return True, "All dependencies already installed"

    logger.info(f"Installing missing dependencies: {missing}")
    return install_packages(missing)
