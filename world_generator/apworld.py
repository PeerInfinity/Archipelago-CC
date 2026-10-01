"""
Pack a world directory into an .apworld archive, and build one straight from a
rules file.

This is the one packing rule for generated worlds. Two callers share it:

- ``scripts/build/pack_apworld.py`` packs a directory under ``worlds/``;
- the frontend's apworld editor runs ``build_apworld`` inside Pyodide to turn
  the document being edited into a downloadable ``.apworld``
  (``frontend/modules/apworldEditor/apworldBuild.js``).

Only the standard library is imported here, because the browser has nothing
else.

AP loads an apworld as the package named by its single top-level directory,
and it refuses one whose FILE name differs from that directory
(``ModuleNotFoundError: No module named 'worlds.<file stem>'``). So the archive
is always ``<game_directory>.apworld`` with ``<game_directory>/`` at its root;
``build_apworld`` returns the name rather than letting a caller guess it.
"""

import contextlib
import io
import json
import tempfile
import zipfile
from pathlib import Path
from typing import Callable, Optional, Union

# Container manifest version stamped into archipelago.json at packing time.
# Source manifests must not carry this key (see test_world_manifest); AP
# 0.6.7+ warns about packed apworlds that lack it and 0.7.0 will refuse them.
# (worlds/json_tools_installer/installer/extractor.py keeps its own copy: that
# package ships as an apworld itself and cannot import this one.)
APWORLD_COMPATIBLE_VERSION = 5


def stamp_container_version(manifest_bytes: bytes) -> bytes:
    """Return archipelago.json content with compatible_version injected."""
    manifest = json.loads(manifest_bytes.decode("utf-8"))
    manifest.setdefault("compatible_version", APWORLD_COMPATIBLE_VERSION)
    return json.dumps(manifest, indent=4).encode("utf-8")


def write_world_to_zip(
    zf: zipfile.ZipFile,
    world_dir: Path,
    on_add: Optional[Callable[[str], None]] = None,
) -> None:
    """Add every file under ``world_dir`` to ``zf`` as ``<world_dir.name>/...``.

    Skips ``__pycache__`` and ``.pyc``; stamps the top-level archipelago.json.
    """
    root = world_dir.parent
    for path in world_dir.rglob("*"):
        if not path.is_file():
            continue
        if "__pycache__" in path.parts or path.suffix == ".pyc":
            continue
        relative_path = str(path.relative_to(root))
        if path.name == "archipelago.json" and path.parent == world_dir:
            zf.writestr(relative_path, stamp_container_version(path.read_bytes()))
        else:
            zf.write(path, relative_path)
        if on_add:
            on_add(relative_path)


def pack_world_dir(world_dir: Path, output: Union[Path, io.BytesIO]) -> None:
    """Write ``world_dir`` as an .apworld to a path or a byte buffer."""
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        write_world_to_zip(zf, world_dir)


def build_apworld(
    rules_path: Union[str, Path],
    game_name: Optional[str] = None,
    canonical_seed: Optional[int] = None,
    player_id: str = "1",
) -> dict:
    """Generate a world from a rules file and pack it, entirely in a temp dir.

    Returns ``{"file_name", "game_name", "game_directory", "data"}`` where
    ``data`` is the .apworld's bytes and ``file_name`` is the only name AP
    will load it under.
    """
    from .generator import WorldGenerator

    probe = WorldGenerator(str(rules_path), game_name=game_name, player_id=player_id)
    probe.load()
    assert probe.data is not None
    metadata = probe.data.metadata

    with tempfile.TemporaryDirectory() as tmp:
        world_dir = Path(tmp) / metadata.game_directory
        # generate() prints "next steps" naming the temp directory, which is
        # gone by the time anyone reads them.
        with contextlib.redirect_stdout(io.StringIO()):
            WorldGenerator(
                str(rules_path),
                output_dir=str(world_dir),
                game_name=game_name,
                force=True,
                canonical_seed=canonical_seed,
                player_id=player_id,
            ).generate()
        buffer = io.BytesIO()
        pack_world_dir(world_dir, buffer)

    return {
        "file_name": f"{metadata.game_directory}.apworld",
        "game_name": metadata.game_name,
        "game_directory": metadata.game_directory,
        "data": buffer.getvalue(),
    }
