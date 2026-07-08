"""Shared helpers for the installer unit tests.

Kept out of conftest so tests can import them explicitly; not collected as a
test module (does not match the ``python_files`` patterns).
"""
import zipfile
from pathlib import Path, PurePosixPath
from typing import Dict, Iterable, Union

from worlds.json_tools_installer.installer.extractor import COMPONENTS

# Arbitrary GitHub-style archive root; extract_tools derives it from the
# archive contents, so the exact name carries no meaning.
ARCHIVE_ROOT = "Archipelago-CC-main"


def build_archive(path: Path, entries: Dict[str, Union[bytes, str]]) -> None:
    """Write a synthetic GitHub-archive-shaped zip with the given entries.

    ``entries`` maps archive-relative paths (without the archive root) to
    file contents.
    """
    with zipfile.ZipFile(path, "w") as zf:
        for rel, data in entries.items():
            zf.writestr(f"{ARCHIVE_ROOT}/{rel}", data)


def entry_for(source_path: str) -> str:
    """Archive entry representing a component source path.

    Directory-shaped source paths get a representative file inside them;
    file-shaped ones (with a suffix) are used as-is.
    """
    if PurePosixPath(source_path).suffix:
        return source_path
    return source_path + "/__init__.py"


def component_entries(component_names: Iterable[str]) -> Dict[str, bytes]:
    """One archive entry per source path of each named component, with
    per-entry unique contents (so byte-identity checks are meaningful)."""
    entries: Dict[str, bytes] = {}
    for name in component_names:
        for source_path in COMPONENTS[name].source_paths:
            entries[entry_for(source_path)] = f"# {name}: {source_path}\n".encode()
    return entries
