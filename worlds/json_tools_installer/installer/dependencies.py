"""
Dependency installer for JSON Tools.

Installs Python packages required by JSON Tools components (exporter, etc.)
that aren't included in vanilla Archipelago's dependencies.
"""

import logging
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import List, Optional, Tuple

from Utils import local_path, user_path, is_frozen

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


# The bundled pip can only be invoked once per process: a second in-process
# run deadlocks (observed hanging the installer GUI inside the frozen
# Launcher). Flows batch all packages into one call; this flag guards
# against any second attempt.
_frozen_pip_invoked = False


def _install_packages_frozen(packages: List[str]) -> Tuple[bool, str]:
    """
    Install packages on a frozen (compiled) Archipelago install.

    A pip subprocess can't work there — sys.executable is the frozen exe,
    which doesn't understand `-m pip`. Instead, run the bundled pip
    in-process with --target pointed at lib/, the only writable directory
    on the frozen sys.path.
    """
    global _frozen_pip_invoked
    target = Path(local_path()) / "lib"

    if _frozen_pip_invoked:
        return False, (
            "The bundled pip already ran once in this Archipelago session and "
            "cannot run again. Restart Archipelago and run the installer again "
            f"to install: {', '.join(packages)}"
        )

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

    # No console interaction: the frozen Launcher is a GUI app whose
    # stdout/stderr may be absent or an undrained pipe — pip's progress and
    # version-check output must not touch them.
    args = [
        "install", "--upgrade", "--target", str(target),
        "--progress-bar", "off", "--no-color", "--disable-pip-version-check",
    ]
    if ca_bundle:
        args += ["--cert", ca_bundle]
    args += packages
    logger.info(f"Running bundled pip in-process: pip {' '.join(args)}")

    import contextlib
    import io
    output = io.StringIO()
    _frozen_pip_invoked = True
    try:
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            rc = pip_main(args)
    except SystemExit as e:
        rc = e.code if isinstance(e.code, int) else 1
    except Exception as e:
        logger.warning(f"Bundled pip output:\n{output.getvalue()[-2000:]}")
        return False, f"Bundled pip failed: {e}"

    logger.info(f"Bundled pip output:\n{output.getvalue()[-2000:]}")
    if rc == 0:
        return True, f"Installed into lib/: {', '.join(packages)}"
    return False, (
        f"Bundled pip exited with code {rc}: "
        f"{output.getvalue()[-500:].strip()}"
    )


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


def scan_apworld_requirements() -> List[str]:
    """
    Collect requirement strings from custom_worlds/*.apworld files.

    Archipelago's module installer only scans worlds/ directories on source
    installs — an apworld's requirements.txt is never read by anything else,
    and compiled installs can't pip-install at all. This scan feeds those
    requirements through the frozen-capable installer (e.g. MetaMath's
    metamath-py).

    Returns:
        Deduplicated list of requirement strings, in discovery order.
    """
    requirements: List[str] = []
    seen = set()

    folder = Path(user_path("custom_worlds"))
    if not folder.is_dir():
        return requirements

    for apworld in sorted(folder.glob("*.apworld")):
        try:
            with zipfile.ZipFile(apworld) as zf:
                # Match by content, not filename stem — apworld files can be
                # renamed without renaming the world directory inside.
                candidates = [
                    n for n in zf.namelist()
                    if n == "requirements.txt" or (
                        n.endswith("/requirements.txt") and n.count("/") == 1
                    )
                ]
                for candidate in candidates:
                    data = zf.read(candidate).decode("utf-8")
                    for line in data.splitlines():
                        line = line.split("#", 1)[0].strip()
                        if line and line not in seen:
                            seen.add(line)
                            requirements.append(line)
        except Exception as e:
            logger.warning(f"Could not read requirements from {apworld.name}: {e}")

    return requirements


def check_missing_requirements(requirements: List[str]) -> List[str]:
    """
    Filter a requirement list down to distributions that aren't installed.

    Checks by distribution name (importlib.metadata) rather than import name —
    the two often differ (metamath-py installs as metamathpy). Version
    specifiers are not evaluated; any installed version satisfies.
    """
    import importlib.metadata

    missing = []
    for req in requirements:
        dist_name = re.split(r"[<>=!~;\[\s]", req, maxsplit=1)[0].strip()
        if not dist_name:
            continue
        try:
            importlib.metadata.distribution(dist_name)
        except importlib.metadata.PackageNotFoundError:
            missing.append(req)
    return missing


def install_apworld_dependencies() -> Tuple[bool, str]:
    """
    Install any missing requirements declared by apworlds in custom_worlds/.

    Returns:
        Tuple of (success, message).
    """
    requirements = scan_apworld_requirements()
    if not requirements:
        return True, "No apworld requirements found"

    missing = check_missing_requirements(requirements)
    if not missing:
        return True, (
            f"All apworld requirements already installed "
            f"({len(requirements)} checked)"
        )

    logger.info(f"Installing apworld requirements: {missing}")
    return install_packages(missing)


def install_all_dependencies() -> Tuple[bool, str]:
    """
    Install JSON Tools' own missing packages AND missing apworld
    requirements in a single pip invocation.

    Install flows must use this instead of calling
    install_missing_dependencies + install_apworld_dependencies in
    sequence: on frozen installs the bundled pip can only run once per
    process (a second in-process invocation deadlocks).

    Returns:
        Tuple of (success, message).
    """
    missing = check_missing_packages()
    apworld_missing = check_missing_requirements(scan_apworld_requirements())
    combined = missing + [r for r in apworld_missing if r not in missing]

    if not combined:
        return True, "All dependencies already installed"

    logger.info(f"Installing dependencies (single pip run): {combined}")
    ok, msg = install_packages(combined)
    return ok, msg
