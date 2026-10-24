"""
Downloader for original (upstream) Archipelago world source code.

Compiled Archipelago builds ship their bundled worlds as source-free
.pyc-only apworlds — and the core modules (BaseClasses.py etc.) as
source-free .pyc inside library.zip. The exporter's AST analysis needs
the original .py text (the .pyc line numbers refer to it), so this
module downloads the upstream release tag matching the installed AP
version and stores its .py files (minus web/test-only trees) under
json_tools_world_source/<version>/ in the Archipelago root.

The version match is a correctness requirement, not hygiene: lambda
extraction works by line number, so source from a different version
would silently produce wrong rule text. The exporter fallback only
reads from the folder matching the running AP version.

The folder is deliberately NOT importable: on frozen installs the AP
root is not on sys.path, so this copy can never shadow or interfere
with the real bundled worlds.
"""

import json
import logging
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional, Tuple

from Utils import local_path, is_frozen

from .downloader import _download_once

logger = logging.getLogger(__name__)

WORLD_SOURCE_DIR = "json_tools_world_source"
UPSTREAM_TAG_URL = "https://github.com/ArchipelagoMW/Archipelago/archive/refs/tags/{version}.zip"

# Source trees that never contribute rule code at generation time
EXCLUDED_TREES = ("test/", "WebHostLib/", "docs/", ".github/", "typings/")


def ap_base_version() -> str:
    """Base AP version (e.g. '0.6.7') of the running installation."""
    from Utils import __version__
    return __version__.split("-")[0]


def get_world_source_root(version: Optional[str] = None) -> Path:
    """Root directory holding world source for the given AP version."""
    return Path(local_path(WORLD_SOURCE_DIR, version or ap_base_version()))


def is_world_source_installed(version: Optional[str] = None) -> bool:
    """Check whether world source for the given AP version is present."""
    return (get_world_source_root(version) / "manifest.json").is_file()


def install_world_source(
    progress_callback: Optional[Callable[[int, int], None]] = None,
    max_retries: int = 3,
) -> Tuple[bool, str]:
    """
    Download upstream world source matching the installed AP version.

    Only useful on compiled installs — source installs already have the
    real .py files, so this is skipped there.

    Args:
        progress_callback: Optional callback(bytes_downloaded, bytes_total).
        max_retries: Download attempts before giving up.

    Returns:
        Tuple of (success, message).
    """
    if not is_frozen():
        return True, (
            "Skipped world source download: this is a source install, "
            "world source files are already present"
        )

    version = ap_base_version()
    if is_world_source_installed(version):
        return True, f"World source for AP {version} already installed"

    url = UPSTREAM_TAG_URL.format(version=version)
    dest_root = get_world_source_root(version)

    with tempfile.TemporaryDirectory() as td:
        archive_path = Path(td) / "ap_source.zip"

        result = None
        for attempt in range(max_retries):
            result = _download_once(url, archive_path, progress_callback)
            if result.success:
                break
            logger.warning(
                f"World source download attempt {attempt + 1} failed: {result.error}"
            )
        if result is None or not result.success:
            error = result.error if result else "no download attempted"
            return False, f"Could not download AP {version} source: {error}"

        extracted = 0
        try:
            with zipfile.ZipFile(archive_path, "r") as zf:
                for entry in zf.namelist():
                    if entry.endswith("/"):
                        continue
                    # Strip the archive root (Archipelago-<version>/)
                    parts = entry.split("/", 1)
                    if len(parts) != 2:
                        continue
                    rel_path = parts[1]
                    if not rel_path.endswith(".py"):
                        continue
                    if rel_path.startswith(EXCLUDED_TREES):
                        continue
                    if ".." in Path(rel_path).parts:
                        continue

                    dest_path = dest_root / rel_path
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(entry) as src, open(dest_path, "wb") as dst:
                        dst.write(src.read())
                    extracted += 1
        except Exception as e:
            return False, f"Failed to extract world source: {e}"

        if not extracted:
            return False, f"AP {version} source archive contained no worlds/**/*.py files"

    manifest = {
        "ap_version": version,
        "source_url": url,
        "extracted_files": extracted,
        "installed_at": datetime.now().isoformat(),
        "note": "Original world source for the exporter's AST analysis; "
                "not importable and not used by Archipelago itself.",
    }
    try:
        with open(dest_root / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
    except Exception as e:
        return False, f"Failed to write world source manifest: {e}"

    return True, f"Installed world source for AP {version} ({extracted} files)"
