"""Overwrite semantics, installed-component detection, and removal across
all three receiving locations (root, frozen_dest subdir, custom_worlds
apworlds), plus pattern components (worldgen_worlds)."""
import json

from worlds.json_tools_installer.installer import extractor
from worlds.json_tools_installer.installer.extractor import (
    COMPONENTS,
    CUSTOM_WORLDS_DIR_NAME,
)

from .sandbox_utils import build_archive, component_entries, entry_for

# A frozen_dest component and a frozen_apworld component, picked from
# metadata so the tests survive component renames.
FROZEN_DEST_COMPONENT = sorted(
    n for n, c in COMPONENTS.items() if c.frozen_dest and c.source_paths)[0]
APWORLD_COMPONENT = sorted(
    n for n, c in COMPONENTS.items()
    if c.frozen_apworld and len(c.source_paths) == 1)[0]
PATTERN_COMPONENT = sorted(
    n for n, c in COMPONENTS.items() if c.source_patterns)[0]
PLAIN_COMPONENT = sorted(
    n for n, c in COMPONENTS.items()
    if c.source_paths and not c.frozen_dest and not c.frozen_apworld
    and not c.unsupported_frozen and not c.clean_before_extract
    and n not in ("frontend", "presets", "world_source"))[0]


def apworld_component_world() -> str:
    return COMPONENTS[APWORLD_COMPONENT].source_paths[0].split("/")[-1]


def pattern_world_name() -> str:
    """A world name matching the pattern component's directory pattern."""
    pattern = [p for p in COMPONENTS[PATTERN_COMPONENT].source_patterns
               if not p.endswith("/*")][0]
    # e.g. "worlds/*_worldgen" -> "zz_probe_worldgen"
    world_glob = pattern.split("/")[-1]
    assert world_glob.startswith("*"), pattern
    return "zz_probe" + world_glob[1:]


def test_overwrite_false_skips_existing_files(tmp_path, frozen):
    frozen(False)
    entries = component_entries([PLAIN_COMPONENT])
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()

    # Pre-create one of the destination files with sentinel content
    existing_rel = sorted(entries)[0]
    existing = dest / existing_rel
    existing.parent.mkdir(parents=True, exist_ok=True)
    existing.write_bytes(b"# pre-existing\n")

    result = extractor.extract_tools(
        archive, [PLAIN_COMPONENT], dest_root=dest, overwrite=False)

    assert result.success, result.errors
    assert existing.read_bytes() == b"# pre-existing\n"
    assert existing_rel in result.skipped_files
    assert existing_rel not in result.extracted_files
    # the rest still extracted
    for rel, data in entries.items():
        if rel != existing_rel:
            assert (dest / rel).read_bytes() == data, rel


def test_overwrite_false_skips_existing_apworlds_whole(tmp_path, frozen):
    frozen(True)
    world = apworld_component_world()
    entries = {
        f"worlds/{world}/__init__.py": b"# new",
        f"worlds/{world}/archipelago.json": json.dumps({"game": world}).encode(),
    }
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()

    apworld = dest / CUSTOM_WORLDS_DIR_NAME / f"{world}.apworld"
    apworld.parent.mkdir(parents=True)
    apworld.write_bytes(b"sentinel-not-a-zip")

    result = extractor.extract_tools(
        archive, [APWORLD_COMPONENT], dest_root=dest, overwrite=False)

    assert result.success, result.errors
    assert apworld.read_bytes() == b"sentinel-not-a-zip"
    assert result.extracted_files == []
    assert sorted(result.skipped_files) == sorted(entries)


def test_detection_source_install(tmp_path, frozen):
    frozen(False)
    components = [FROZEN_DEST_COMPONENT, PLAIN_COMPONENT]
    archive = tmp_path / "archive.zip"
    build_archive(archive, component_entries(components))
    dest = tmp_path / "dest"
    dest.mkdir()
    extractor.extract_tools(archive, components, dest_root=dest)

    assert set(extractor.list_installed_components(root=dest)) == set(components)


def test_detection_frozen_install(tmp_path, frozen):
    frozen(True)
    world = apworld_component_world()
    entries = component_entries([FROZEN_DEST_COMPONENT])
    entries[f"worlds/{world}/__init__.py"] = b"# w"
    entries[f"worlds/{world}/archipelago.json"] = json.dumps({"game": world}).encode()
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()
    extractor.extract_tools(
        archive, [FROZEN_DEST_COMPONENT, APWORLD_COMPONENT], dest_root=dest)

    installed = set(extractor.list_installed_components(root=dest))
    assert installed == {FROZEN_DEST_COMPONENT, APWORLD_COMPONENT}


def test_remove_component_clears_root_and_frozen_dest(tmp_path, frozen):
    comp = COMPONENTS[FROZEN_DEST_COMPONENT]
    archive = tmp_path / "archive.zip"
    build_archive(archive, component_entries([FROZEN_DEST_COMPONENT]))
    dest = tmp_path / "dest"
    dest.mkdir()

    # install into both locations (as a stale source layout + frozen layout would)
    frozen(False)
    extractor.extract_tools(archive, [FROZEN_DEST_COMPONENT], dest_root=dest)
    # The root copy stands in for one an OLDER installer left behind, so drop
    # the ownership record it just wrote — otherwise the frozen install
    # legitimately prunes it as a superseded layout.
    extractor.clear_install_manifest(dest)
    frozen(True)
    extractor.extract_tools(archive, [FROZEN_DEST_COMPONENT], dest_root=dest)
    for source_path in comp.source_paths:
        assert (dest / entry_for(source_path)).exists()
        assert (dest / comp.frozen_dest / entry_for(source_path)).exists()

    assert extractor.remove_component(FROZEN_DEST_COMPONENT, root=dest)
    for source_path in comp.source_paths:
        assert not (dest / source_path).exists()
        assert not (dest / comp.frozen_dest / source_path).exists()
    assert FROZEN_DEST_COMPONENT not in extractor.list_installed_components(root=dest)


def test_remove_component_clears_apworlds_and_world_dirs(tmp_path, frozen):
    world = apworld_component_world()
    entries = {
        f"worlds/{world}/__init__.py": b"# w",
        f"worlds/{world}/archipelago.json": json.dumps({"game": world}).encode(),
    }
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()

    frozen(True)
    extractor.extract_tools(archive, [APWORLD_COMPONENT], dest_root=dest)
    # A stale root worlds/ copy an OLDER installer left behind — laid down by
    # hand, since a current extraction would either record it (precise prune)
    # or clear it (pre-manifest fallback).
    for rel, data in entries.items():
        stale = dest / rel
        stale.parent.mkdir(parents=True, exist_ok=True)
        stale.write_bytes(data)
    assert (dest / "worlds" / world).is_dir()
    assert (dest / CUSTOM_WORLDS_DIR_NAME / f"{world}.apworld").exists()

    assert extractor.remove_component(APWORLD_COMPONENT, root=dest)
    assert not (dest / "worlds" / world).exists()
    assert not (dest / CUSTOM_WORLDS_DIR_NAME / f"{world}.apworld").exists()


def test_overlay_component_never_detected_or_removed(tmp_path, frozen):
    """Overlay components (upstream_fixes) replace files that exist in
    vanilla installs. Regression: presence-based detection reported them
    installed on every source install, so uninstall deleted the vanilla
    files they would have overlaid."""
    frozen(False)
    overlay_components = [
        n for n, c in COMPONENTS.items() if c.overlay and c.source_paths]
    assert overlay_components, "no overlay components left to test"

    dest = tmp_path / "dest"
    for name in overlay_components:
        comp = COMPONENTS[name]
        # lay down the "vanilla" files at the overlay's source paths
        for source_path in comp.source_paths:
            target = dest / source_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b"# vanilla content\n")

        assert name not in extractor.list_installed_components(root=dest)
        assert extractor.remove_component(name, root=dest) is False
        for source_path in comp.source_paths:
            assert (dest / source_path).read_bytes() == b"# vanilla content\n", \
                f"remove_component deleted vanilla file {source_path}"


def test_pattern_component_source_detection(tmp_path, frozen):
    frozen(False)
    world = pattern_world_name()
    entries = {
        f"worlds/{world}/__init__.py": b"# wg",
        f"worlds/{world}/archipelago.json": json.dumps({"game": world}).encode(),
    }
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()
    result = extractor.extract_tools(archive, [PATTERN_COMPONENT], dest_root=dest)

    assert result.success, result.errors
    assert (dest / "worlds" / world / "__init__.py").exists()
    assert PATTERN_COMPONENT in extractor.list_installed_components(root=dest)


def test_pattern_component_frozen_pack_detect_remove(tmp_path, frozen):
    frozen(True)
    world = pattern_world_name()
    entries = {
        f"worlds/{world}/__init__.py": b"# wg",
        f"worlds/{world}/archipelago.json": json.dumps({"game": world}).encode(),
    }
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()
    result = extractor.extract_tools(archive, [PATTERN_COMPONENT], dest_root=dest)

    assert result.success, result.errors
    apworld = dest / CUSTOM_WORLDS_DIR_NAME / f"{world}.apworld"
    assert apworld.exists()
    assert not (dest / "worlds").exists()
    # detected via the custom_worlds glob, removed the same way
    assert PATTERN_COMPONENT in extractor.list_installed_components(root=dest)
    assert extractor.remove_component(PATTERN_COMPONENT, root=dest)
    assert not apworld.exists()
    assert PATTERN_COMPONENT not in extractor.list_installed_components(root=dest)
