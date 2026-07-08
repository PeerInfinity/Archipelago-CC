"""frozen_apworld routing: worlds pack into custom_worlds/<w>.apworld with
worlds/-stripped arcnames, exclusions and manifest-less worlds warn, and
manifests get the container version stamped at packing time.

Note: since the worldgen-on-vanilla-rule_builder flip, no real component has
frozen_exclude_worlds any more (toem_rule_builder ships a vendored _ext and
packs normally) — exclusion behavior is exercised via a synthetic component.
"""
import json
import zipfile

import pytest

from worlds.json_tools_installer.installer import extractor
from worlds.json_tools_installer.installer.extractor import (
    APWORLD_COMPATIBLE_VERSION,
    COMPONENTS,
    CUSTOM_WORLDS_DIR_NAME,
    Component,
    stamp_container_version,
)

from .sandbox_utils import build_archive

# Real world-shaped components (currently demo_worlds and tracker)
APWORLD_COMPONENTS = sorted(
    name for name, comp in COMPONENTS.items()
    if comp.frozen_apworld and comp.source_paths
)


def world_names(component_name: str) -> list:
    return [sp.split("/")[-1] for sp in COMPONENTS[component_name].source_paths]


def apworld_component_archive(tmp_path):
    """Archive holding every world of every real frozen_apworld component."""
    entries = {}
    for name in APWORLD_COMPONENTS:
        for world in world_names(name):
            entries[f"worlds/{world}/__init__.py"] = f"# {world}\n".encode()
            entries[f"worlds/{world}/archipelago.json"] = json.dumps(
                {"game": world, "minimum_ap_version": "0.6.2"}
            ).encode()
            entries[f"worlds/{world}/docs/setup_en.md"] = b"# setup\n"
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    return archive, entries


def test_metadata_expectations():
    assert APWORLD_COMPONENTS, "no frozen_apworld components left to test"
    demo_worlds = [n for n in APWORLD_COMPONENTS if len(world_names(n)) > 1]
    assert demo_worlds, "expected a multi-world frozen_apworld component"
    # Regression: toem_rule_builder runs on vanilla rule_builder via its
    # vendored _ext package and must no longer be excluded from packing.
    for name in APWORLD_COMPONENTS:
        assert COMPONENTS[name].frozen_exclude_worlds == [], name


def test_frozen_packs_apworlds(tmp_path, frozen):
    frozen(True)
    archive, _entries = apworld_component_archive(tmp_path)
    dest = tmp_path / "dest"
    dest.mkdir()
    result = extractor.extract_tools(archive, APWORLD_COMPONENTS, dest_root=dest)

    assert result.success, result.errors
    assert result.warnings == [], result.warnings
    # nothing lands in a root worlds/ directory
    assert not (dest / "worlds").exists()
    for name in APWORLD_COMPONENTS:
        for world in world_names(name):
            apworld = dest / CUSTOM_WORLDS_DIR_NAME / f"{world}.apworld"
            assert apworld.exists(), world
            with zipfile.ZipFile(apworld) as zf:
                names = set(zf.namelist())
                assert names == {
                    f"{world}/__init__.py",
                    f"{world}/archipelago.json",
                    f"{world}/docs/setup_en.md",
                }, names
                manifest = json.loads(zf.read(f"{world}/archipelago.json"))
            assert manifest["game"] == world
            assert manifest["minimum_ap_version"] == "0.6.2"
            assert manifest["compatible_version"] == APWORLD_COMPATIBLE_VERSION


def test_source_extracts_world_directories(tmp_path, frozen):
    frozen(False)
    archive, entries = apworld_component_archive(tmp_path)
    dest = tmp_path / "dest"
    dest.mkdir()
    result = extractor.extract_tools(archive, APWORLD_COMPONENTS, dest_root=dest)

    assert result.success, result.errors
    assert result.warnings == []
    assert not (dest / CUSTOM_WORLDS_DIR_NAME).exists()
    for rel, data in entries.items():
        assert (dest / rel).read_bytes() == data, rel
    # source manifests are not stamped
    for name in APWORLD_COMPONENTS:
        for world in world_names(name):
            manifest = json.loads(
                (dest / "worlds" / world / "archipelago.json").read_bytes())
            assert "compatible_version" not in manifest


@pytest.fixture
def synthetic_component(monkeypatch):
    """Inject a world-shaped component with one excluded world."""
    comp = Component(
        name="zz_probe_worlds",
        display_name="Probe Worlds",
        description="synthetic test component",
        source_paths=["worlds/zz_kept", "worlds/zz_excluded"],
        frozen_apworld=True,
        frozen_exclude_worlds=["zz_excluded"],
    )
    monkeypatch.setitem(extractor.COMPONENTS, comp.name, comp)
    return comp


def test_frozen_excluded_world_skipped_with_single_warning(
        tmp_path, frozen, synthetic_component):
    frozen(True)
    entries = {
        "worlds/zz_kept/__init__.py": b"# kept",
        "worlds/zz_kept/archipelago.json": b'{"game": "zz_kept"}',
        # two files so the one-warning-per-world dedup is actually exercised
        "worlds/zz_excluded/__init__.py": b"# excluded",
        "worlds/zz_excluded/Rules.py": b"# excluded rules",
    }
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()
    result = extractor.extract_tools(
        archive, [synthetic_component.name], dest_root=dest)

    assert result.success, result.errors
    assert (dest / CUSTOM_WORLDS_DIR_NAME / "zz_kept.apworld").exists()
    assert not (dest / CUSTOM_WORLDS_DIR_NAME / "zz_excluded.apworld").exists()
    excluded_warnings = [w for w in result.warnings if "zz_excluded" in w]
    assert len(excluded_warnings) == 1, result.warnings
    assert not any("zz_excluded" in f for f in result.extracted_files)


def test_manifest_less_world_gets_deprecation_warning(
        tmp_path, frozen, synthetic_component, monkeypatch):
    monkeypatch.setattr(synthetic_component, "frozen_exclude_worlds", [])
    frozen(True)
    entries = {
        "worlds/zz_kept/__init__.py": b"# kept",
        "worlds/zz_kept/Rules.py": b"# rules",
    }
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()
    result = extractor.extract_tools(
        archive, [synthetic_component.name], dest_root=dest)

    assert result.success, result.errors
    assert (dest / CUSTOM_WORLDS_DIR_NAME / "zz_kept.apworld").exists()
    warnings = [w for w in result.warnings if "zz_kept.apworld" in w]
    assert len(warnings) == 1, result.warnings
    assert "archipelago.json" in warnings[0]
    assert "0.7.0" in warnings[0]


def test_stamp_container_version_injects_and_preserves():
    manifest = {"game": "X", "minimum_ap_version": "0.6.2"}
    stamped = json.loads(stamp_container_version(json.dumps(manifest).encode()))
    assert stamped["compatible_version"] == APWORLD_COMPATIBLE_VERSION
    assert stamped["game"] == "X"
    assert stamped["minimum_ap_version"] == "0.6.2"


def test_stamp_container_version_keeps_existing_value():
    manifest = {"game": "X", "compatible_version": 3}
    stamped = json.loads(stamp_container_version(json.dumps(manifest).encode()))
    assert stamped["compatible_version"] == 3


def test_stamp_container_version_leaves_malformed_untouched():
    data = b"not json at all {"
    assert stamp_container_version(data) == data
