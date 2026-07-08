"""Manifest validity sweep: every tracked apworld artifact AND every apworld
the frozen extractor would pack from this repo's world directories must pass
APWorldContainer.read().

Permanent guard for the compatible_version class of bugs: AP 0.6.7 logs a
deprecation warning for apworlds without it and 0.7.0 will refuse to load
them, so a failure here is a release blocker, not a style nit."""
from pathlib import Path

import pytest

from worlds.Files import APWorldContainer
from worlds.json_tools_installer.installer import extractor
from worlds.json_tools_installer.installer.extractor import (
    COMPONENTS,
    CUSTOM_WORLDS_DIR_NAME,
)

from .sandbox_utils import build_archive

REPO_ROOT = Path(__file__).resolve().parents[3]


def tracked_apworlds():
    return sorted((REPO_ROOT / "apworlds").glob("*.apworld"))


def frozen_apworld_world_dirs():
    """(component, world_dir) for every world a frozen install would pack."""
    pairs = []
    for name, comp in COMPONENTS.items():
        if not comp.frozen_apworld:
            continue
        dirs = [REPO_ROOT / sp for sp in comp.source_paths]
        for pattern in comp.source_patterns:
            if pattern.endswith("/*"):
                continue  # recursive file pattern, not a world dir pattern
            dirs.extend(sorted(REPO_ROOT.glob(pattern)))
        pairs.extend((name, d) for d in dirs if d.is_dir())
    return pairs


def test_sweep_is_not_vacuous():
    assert tracked_apworlds(), "no tracked apworlds found — wrong repo root?"
    assert frozen_apworld_world_dirs(), "no frozen_apworld world dirs found"


@pytest.mark.parametrize(
    "apworld_path", tracked_apworlds(), ids=lambda p: p.name)
def test_tracked_apworld_manifest_valid(apworld_path):
    APWorldContainer(str(apworld_path)).read()  # raises InvalidDataError if bad


@pytest.mark.parametrize(
    "comp_name,world_dir", frozen_apworld_world_dirs(),
    ids=lambda v: v if isinstance(v, str) else v.name)
def test_packed_apworld_manifest_valid(comp_name, world_dir, tmp_path, frozen):
    """Pack the real world dir's manifest the way a frozen install would and
    validate the result. Only the manifest and a stub module are packed —
    manifest validity is what is under test, not world content."""
    frozen(True)
    world = world_dir.name
    entries = {f"worlds/{world}/__init__.py": b"# stub\n"}
    manifest_path = world_dir / "archipelago.json"
    if manifest_path.exists():
        entries[f"worlds/{world}/archipelago.json"] = manifest_path.read_bytes()

    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()
    result = extractor.extract_tools(archive, [comp_name], dest_root=dest)
    assert result.success, result.errors

    apworld = dest / CUSTOM_WORLDS_DIR_NAME / f"{world}.apworld"
    assert apworld.exists(), f"{world} was not packed"
    # A world dir without archipelago.json fails here by design: the frozen
    # install would ship a deprecated (soon rejected) apworld.
    APWorldContainer(str(apworld)).read()
