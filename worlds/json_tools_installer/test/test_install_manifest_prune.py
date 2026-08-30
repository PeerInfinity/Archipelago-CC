"""Install-manifest ownership tracking and stale-file pruning.

The installer's components extract over whatever is already there, so an
upgrade between two sources that ship different file sets used to leave the
old source's files behind — importable Python among them (an exporter game
handler deleted upstream is still discovered and imported by
exporter.games._discover_handlers, which scans the directory). extract_tools
now records what each component wrote and drops what the next install of the
same component no longer ships.

All expectations derive from COMPONENTS metadata, never literal paths.
"""
import json

from worlds.json_tools_installer.installer import extractor
from worlds.json_tools_installer.installer.extractor import (
    COMPONENTS,
    CUSTOM_WORLDS_DIR_NAME,
)

from .sandbox_utils import build_archive, component_entries, entry_for

FROZEN_DEST_COMPONENT = sorted(
    n for n, c in COMPONENTS.items() if c.frozen_dest and c.source_paths)[0]
PATTERN_COMPONENT = sorted(
    n for n, c in COMPONENTS.items() if c.source_patterns and c.frozen_apworld)[0]
PLAIN_COMPONENT = sorted(
    n for n, c in COMPONENTS.items()
    if c.source_paths and not c.frozen_dest and not c.frozen_apworld
    and not c.unsupported_frozen and not c.clean_before_extract
    and n not in ("frontend", "presets", "world_source"))[0]


def component_dir(name: str) -> str:
    """A directory-shaped source path of a component."""
    for source_path in COMPONENTS[name].source_paths:
        if entry_for(source_path) != source_path:
            return source_path
    raise AssertionError(f"{name} has no directory-shaped source path")


def pattern_world(stem: str) -> str:
    """A world directory name matching the pattern component's world glob."""
    glob = [p for p in COMPONENTS[PATTERN_COMPONENT].source_patterns
            if not p.endswith("/*")][0].split("/")[-1]
    assert glob.startswith("*"), glob
    return stem + glob[1:]


def extract(archive, components, dest):
    return extractor.extract_tools(archive, components, dest_root=dest)


def test_manifest_records_what_each_component_wrote(tmp_path, frozen):
    frozen(False)
    archive = tmp_path / "archive.zip"
    entries = component_entries([PLAIN_COMPONENT])
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()

    result = extract(archive, [PLAIN_COMPONENT], dest)

    assert result.success, result.errors
    assert sorted(result.installed_paths[PLAIN_COMPONENT]) == sorted(entries)
    manifest_path = extractor.get_install_manifest_path(dest)
    assert manifest_path.is_file()
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert payload["manifest_version"] == extractor.INSTALL_MANIFEST_VERSION
    assert sorted(payload["components"][PLAIN_COMPONENT]) == sorted(entries)
    assert extractor.load_install_manifest(dest)[PLAIN_COMPONENT] == \
        sorted(entries)


def test_upgrade_prunes_files_the_new_source_dropped(tmp_path, frozen):
    """The guigui upgrade shape: source A ships a module source B deleted."""
    frozen(True)
    comp_dir = component_dir(FROZEN_DEST_COMPONENT)
    dropped = f"{comp_dir}/gone/dropped_handler.py"
    kept = f"{comp_dir}/kept_handler.py"

    old_archive = tmp_path / "old.zip"
    build_archive(old_archive, {
        entry_for(comp_dir): b"# pkg\n",
        kept: b"# old kept\n",
        dropped: b"# stale handler\n",
    })
    new_archive = tmp_path / "new.zip"
    build_archive(new_archive, {
        entry_for(comp_dir): b"# pkg\n",
        kept: b"# new kept\n",
    })
    dest = tmp_path / "dest"
    dest.mkdir()
    frozen_root = dest / COMPONENTS[FROZEN_DEST_COMPONENT].frozen_dest

    extract(old_archive, [FROZEN_DEST_COMPONENT], dest)
    assert (frozen_root / dropped).is_file()

    result = extract(new_archive, [FROZEN_DEST_COMPONENT], dest)

    assert result.success, result.errors
    assert not (frozen_root / dropped).exists(), \
        "stale module left importable after the upgrade"
    assert (frozen_root / kept).read_bytes() == b"# new kept\n"
    assert result.removed_files == [f"{COMPONENTS[FROZEN_DEST_COMPONENT].frozen_dest}"
                                    f"/{dropped}"]
    # the emptied directory goes too, but the component root stays
    assert not (frozen_root / comp_dir / "gone").exists()
    assert (frozen_root / comp_dir).is_dir()


def test_prune_removes_stale_apworlds(tmp_path, frozen):
    """A world the new source no longer ships must not stay loadable (the
    real case: two *_worldgen worlds exist in the stable source only)."""
    frozen(True)
    kept = pattern_world("zz_kept")
    gone = pattern_world("zz_gone")
    manifest = json.dumps({"game": "zz"}).encode()

    old_archive = tmp_path / "old.zip"
    build_archive(old_archive, {
        f"worlds/{kept}/__init__.py": b"# w",
        f"worlds/{kept}/archipelago.json": manifest,
        f"worlds/{gone}/__init__.py": b"# stale",
        f"worlds/{gone}/archipelago.json": manifest,
    })
    new_archive = tmp_path / "new.zip"
    build_archive(new_archive, {
        f"worlds/{kept}/__init__.py": b"# w2",
        f"worlds/{kept}/archipelago.json": manifest,
    })
    dest = tmp_path / "dest"
    dest.mkdir()
    custom_worlds = dest / CUSTOM_WORLDS_DIR_NAME

    extract(old_archive, [PATTERN_COMPONENT], dest)
    assert (custom_worlds / f"{gone}.apworld").is_file()

    result = extract(new_archive, [PATTERN_COMPONENT], dest)

    assert result.success, result.errors
    assert not (custom_worlds / f"{gone}.apworld").exists()
    assert (custom_worlds / f"{kept}.apworld").is_file()
    assert result.removed_files == [
        f"{CUSTOM_WORLDS_DIR_NAME}/{gone}.apworld"]


def test_components_not_reinstalled_are_left_alone(tmp_path, frozen):
    """Installing a narrower selection must not uninstall the rest."""
    frozen(False)
    archive = tmp_path / "archive.zip"
    entries = component_entries([PLAIN_COMPONENT, FROZEN_DEST_COMPONENT])
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()

    extract(archive, [PLAIN_COMPONENT, FROZEN_DEST_COMPONENT], dest)
    other_files = [dest / rel for rel in
                   component_entries([FROZEN_DEST_COMPONENT])]

    narrower = tmp_path / "narrower.zip"
    build_archive(narrower, component_entries([PLAIN_COMPONENT]))
    result = extract(narrower, [PLAIN_COMPONENT], dest)

    assert result.removed_files == []
    for path in other_files:
        assert path.is_file(), path
    # ... and the untouched component keeps its record
    assert FROZEN_DEST_COMPONENT in extractor.load_install_manifest(dest)


def test_skipped_files_are_not_read_as_dropped(tmp_path, frozen):
    """overwrite=False keeps existing files; they are still shipped, so the
    next run must not prune them."""
    frozen(False)
    archive = tmp_path / "archive.zip"
    entries = component_entries([PLAIN_COMPONENT])
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()

    extract(archive, [PLAIN_COMPONENT], dest)
    result = extractor.extract_tools(
        archive, [PLAIN_COMPONENT], dest_root=dest, overwrite=False)

    assert result.skipped_files
    assert result.removed_files == []
    for rel in entries:
        assert (dest / rel).is_file(), rel


def test_failed_extraction_does_not_prune(tmp_path, frozen):
    """A partial file list is not evidence that a file was dropped."""
    frozen(False)
    comp_dir = component_dir(PLAIN_COMPONENT)
    old_archive = tmp_path / "old.zip"
    build_archive(old_archive, {
        entry_for(comp_dir): b"# pkg\n",
        f"{comp_dir}/dropped.py": b"# stale\n",
    })
    dest = tmp_path / "dest"
    dest.mkdir()
    extract(old_archive, [PLAIN_COMPONENT], dest)

    broken = tmp_path / "broken.zip"
    broken.write_bytes(b"not a zip at all")
    result = extract(broken, [PLAIN_COMPONENT], dest)

    assert not result.success
    assert result.removed_files == []
    assert (dest / comp_dir / "dropped.py").is_file()


def test_prune_refuses_paths_outside_the_destination(tmp_path, frozen):
    """A hand-edited or corrupted manifest cannot be used to delete
    arbitrary files."""
    outside = tmp_path / "outside.py"
    outside.write_bytes(b"# not the installer's\n")
    dest = tmp_path / "dest"
    dest.mkdir()

    removed = extractor.prune_stale_files(
        {PLAIN_COMPONENT: ["../outside.py", str(outside)]},
        {PLAIN_COMPONENT: []},
        dest,
        [dest],
    )

    assert removed == []
    assert outside.is_file()


def test_deselecting_a_nested_component_keeps_its_files(tmp_path, frozen):
    """frontend/presets belongs to 'presets' but is claimed by 'frontend'
    whenever both are selected. Reinstalling Frontend alone must not read
    the installed presets as dropped."""
    frozen(False)
    nested = "frontend/presets"
    assert COMPONENTS["presets"].source_paths == [nested]
    preset_file = f"{nested}/somegame/rules.json"

    both = tmp_path / "both.zip"
    build_archive(both, {
        "frontend/index.html": b"<html>",
        preset_file: b"{}",
    })
    dest = tmp_path / "dest"
    dest.mkdir()
    extract(both, ["frontend", "presets"], dest)
    assert (dest / preset_file).is_file()

    frontend_only = tmp_path / "frontend_only.zip"
    build_archive(frontend_only, {"frontend/index.html": b"<html2>"})
    result = extract(frontend_only, ["frontend"], dest)

    assert result.removed_files == []
    assert (dest / preset_file).is_file()


# --- pre-manifest fallback -------------------------------------------------
# Every install made before ownership tracking existed carries no record, so
# the precise prune has nothing to work from. The fallback clears such a
# component's own destination before extracting over it.

def stage_pre_manifest_install(tmp_path, dest, components, extra):
    """Install `components`, add `extra` files, then drop the record — the
    shape of an install made by an installer predating manifests."""
    archive = tmp_path / "pre_manifest.zip"
    entries = dict(component_entries(components))
    entries.update(extra)
    build_archive(archive, entries)
    extract(archive, components, dest)
    extractor.clear_install_manifest(dest)


def test_fallback_clears_a_component_with_no_record(tmp_path, frozen):
    frozen(True)
    comp_dir = component_dir(FROZEN_DEST_COMPONENT)
    stale = f"{comp_dir}/handlers/stale_handler.py"
    dest = tmp_path / "dest"
    dest.mkdir()
    frozen_root = dest / COMPONENTS[FROZEN_DEST_COMPONENT].frozen_dest

    stage_pre_manifest_install(
        tmp_path, dest, [FROZEN_DEST_COMPONENT], {stale: b"# stale handler\n"})
    assert (frozen_root / stale).is_file()

    new_archive = tmp_path / "new.zip"
    build_archive(new_archive, component_entries([FROZEN_DEST_COMPONENT]))
    result = extract(new_archive, [FROZEN_DEST_COMPONENT], dest)

    assert result.success, result.errors
    assert not (frozen_root / stale).exists(), \
        "pre-manifest leftover still importable"
    assert f"{COMPONENTS[FROZEN_DEST_COMPONENT].frozen_dest}/{stale}" \
        in result.removed_files
    # what the new source ships is there, and now recorded
    assert (frozen_root / entry_for(comp_dir)).is_file()
    assert FROZEN_DEST_COMPONENT in extractor.load_install_manifest(dest)


def test_fallback_clears_stale_apworlds_with_no_record(tmp_path, frozen):
    frozen(True)
    kept = pattern_world("zz_kept")
    gone = pattern_world("zz_gone")
    manifest = json.dumps({"game": "zz"}).encode()
    dest = tmp_path / "dest"
    dest.mkdir()
    custom_worlds = dest / CUSTOM_WORLDS_DIR_NAME

    stage_pre_manifest_install(tmp_path, dest, [PATTERN_COMPONENT], {
        f"worlds/{kept}/__init__.py": b"# w",
        f"worlds/{kept}/archipelago.json": manifest,
        f"worlds/{gone}/__init__.py": b"# stale",
        f"worlds/{gone}/archipelago.json": manifest,
    })
    assert (custom_worlds / f"{gone}.apworld").is_file()

    new_archive = tmp_path / "new.zip"
    build_archive(new_archive, {
        f"worlds/{kept}/__init__.py": b"# w2",
        f"worlds/{kept}/archipelago.json": manifest,
    })
    result = extract(new_archive, [PATTERN_COMPONENT], dest)

    assert result.success, result.errors
    assert not (custom_worlds / f"{gone}.apworld").exists()
    assert (custom_worlds / f"{kept}.apworld").is_file()


def test_fallback_keeps_another_components_nested_files(tmp_path, frozen):
    """frontend/presets belongs to 'presets'; cleaning 'frontend' without it
    selected must not touch them."""
    frozen(False)
    preset_file = "frontend/presets/somegame/rules.json"
    dest = tmp_path / "dest"
    dest.mkdir()

    stage_pre_manifest_install(tmp_path, dest, ["frontend", "presets"], {
        "frontend/index.html": b"<html>",
        preset_file: b"{}",
    })
    assert (dest / preset_file).is_file()

    frontend_only = tmp_path / "frontend_only.zip"
    build_archive(frontend_only, {"frontend/index.html": b"<html2>"})
    result = extract(frontend_only, ["frontend"], dest)

    assert result.success, result.errors
    assert (dest / preset_file).is_file(), "cleaned another component's files"
    assert (dest / "frontend" / "index.html").read_bytes() == b"<html2>"


def test_fallback_keeps_user_writable_destinations(tmp_path, frozen):
    """Presets are user-generated as well as shipped, so even when the
    presets component IS selected its destination is never wholesale-cleaned."""
    frozen(False)
    assert COMPONENTS["presets"].user_writable
    generated = "frontend/presets/usergame/AP_1_rules.json"
    dest = tmp_path / "dest"
    dest.mkdir()

    stage_pre_manifest_install(tmp_path, dest, ["frontend", "presets"], {
        "frontend/index.html": b"<html>",
        "frontend/presets/shipped/rules.json": b"{}",
    })
    # a preset a generation run produced, which no archive ever shipped
    user_preset = dest / generated
    user_preset.parent.mkdir(parents=True, exist_ok=True)
    user_preset.write_bytes(b'{"mine": true}')

    new_archive = tmp_path / "new.zip"
    build_archive(new_archive, {
        "frontend/index.html": b"<html2>",
        "frontend/presets/shipped/rules.json": b"{}",
    })
    result = extract(new_archive, ["frontend", "presets"], dest)

    assert result.success, result.errors
    assert user_preset.read_bytes() == b'{"mine": true}'


def test_fallback_skips_components_not_selected(tmp_path, frozen):
    frozen(False)
    dest = tmp_path / "dest"
    dest.mkdir()
    stage_pre_manifest_install(
        tmp_path, dest, [PLAIN_COMPONENT, FROZEN_DEST_COMPONENT], {})
    untouched = [dest / rel
                 for rel in component_entries([FROZEN_DEST_COMPONENT])]

    narrower = tmp_path / "narrower.zip"
    build_archive(narrower, component_entries([PLAIN_COMPONENT]))
    result = extract(narrower, [PLAIN_COMPONENT], dest)

    assert result.success, result.errors
    for path in untouched:
        assert path.is_file(), path


def test_fallback_no_op_when_destination_absent(tmp_path, frozen):
    frozen(False)
    dest = tmp_path / "dest"
    dest.mkdir()
    archive = tmp_path / "archive.zip"
    build_archive(archive, component_entries([PLAIN_COMPONENT]))

    result = extract(archive, [PLAIN_COMPONENT], dest)

    assert result.success, result.errors
    assert result.removed_files == []


def test_fallback_skips_components_the_archive_does_not_ship(tmp_path, frozen):
    """Never clear a destination this extraction will not repopulate."""
    frozen(False)
    comp_dir = component_dir(PLAIN_COMPONENT)
    dest = tmp_path / "dest"
    dest.mkdir()
    stage_pre_manifest_install(tmp_path, dest, [PLAIN_COMPONENT], {})
    installed = dest / entry_for(comp_dir)
    assert installed.is_file()

    other = tmp_path / "other.zip"
    build_archive(other, component_entries([FROZEN_DEST_COMPONENT]))
    result = extract(other, [PLAIN_COMPONENT, FROZEN_DEST_COMPONENT], dest)

    assert result.removed_files == []
    assert installed.is_file()


def test_fallback_does_not_run_with_overwrite_false(tmp_path, frozen):
    frozen(False)
    comp_dir = component_dir(PLAIN_COMPONENT)
    stale = f"{comp_dir}/stale.py"
    dest = tmp_path / "dest"
    dest.mkdir()
    stage_pre_manifest_install(
        tmp_path, dest, [PLAIN_COMPONENT], {stale: b"# stale\n"})

    new_archive = tmp_path / "new.zip"
    build_archive(new_archive, component_entries([PLAIN_COMPONENT]))
    result = extractor.extract_tools(
        new_archive, [PLAIN_COMPONENT], dest_root=dest, overwrite=False)

    assert result.removed_files == []
    assert (dest / stale).is_file()


def test_recorded_component_uses_the_precise_prune_not_the_fallback(
        tmp_path, frozen):
    """With a record, only recorded files are dropped — an unrecorded file
    sitting in the same destination survives."""
    frozen(False)
    comp_dir = component_dir(PLAIN_COMPONENT)
    archive = tmp_path / "archive.zip"
    build_archive(archive, component_entries([PLAIN_COMPONENT]))
    dest = tmp_path / "dest"
    dest.mkdir()
    extract(archive, [PLAIN_COMPONENT], dest)  # writes the record

    foreign = dest / comp_dir / "not_from_any_archive.py"
    foreign.parent.mkdir(parents=True, exist_ok=True)
    foreign.write_bytes(b"# someone else's\n")

    result = extract(archive, [PLAIN_COMPONENT], dest)

    assert result.removed_files == []
    assert foreign.is_file()


def test_clear_install_manifest(tmp_path, frozen):
    frozen(False)
    archive = tmp_path / "archive.zip"
    build_archive(archive, component_entries([PLAIN_COMPONENT]))
    dest = tmp_path / "dest"
    dest.mkdir()
    extract(archive, [PLAIN_COMPONENT], dest)
    assert extractor.get_install_manifest_path(dest).is_file()

    extractor.clear_install_manifest(dest)

    assert not extractor.get_install_manifest_path(dest).is_file()
    assert extractor.load_install_manifest(dest) == {}
