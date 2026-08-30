"""
Guard against stale tracked apworlds.

The distributed apworlds under apworlds/ are tracked release artifacts built
from world sources by the pack scripts. Twice during the 2026-07 frozen-install
arc, installer source changes shipped WITHOUT a repack — downloaders got the
old code while the repo looked current. This test packs each apworld fresh
into a temp location and compares CONTENT (entry names + per-file bytes)
against the tracked artifact.

Content, not bytes: the pack scripts are only content-deterministic — zip
entries embed filesystem mtimes, so byte-level comparison of two packs of
identical sources can differ. (release-checklist-autonomous.md §7.1 notes
this.)

On failure: rerun the pack script named in the assertion and commit the
updated apworlds/<name>.apworld.
"""

import importlib.util
import zipfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
APWORLDS_DIR = REPO_ROOT / "apworlds"
SCRIPTS_BUILD = REPO_ROOT / "scripts" / "build"

# Worlds packed by scripts/build/pack_apworld.py into tracked artifacts
# (release-checklist-autonomous.md §7.1)
PACKED_WORLDS = ["metamath", "depgraph", "jta", "bakingadventure", "codingadventure"]


def _load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_BUILD / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _zip_contents(path: Path) -> dict:
    with zipfile.ZipFile(path) as zf:
        return {name: zf.read(name) for name in zf.namelist() if not name.endswith("/")}


def _assert_content_equal(tracked: Path, fresh: Path, repack_hint: str):
    tracked_contents = _zip_contents(tracked)
    fresh_contents = _zip_contents(fresh)

    missing = sorted(set(fresh_contents) - set(tracked_contents))
    extra = sorted(set(tracked_contents) - set(fresh_contents))
    changed = sorted(
        name for name in set(tracked_contents) & set(fresh_contents)
        if tracked_contents[name] != fresh_contents[name]
    )
    assert not (missing or extra or changed), (
        f"{tracked.name} is stale relative to its source.\n"
        f"  missing from tracked: {missing}\n"
        f"  only in tracked: {extra}\n"
        f"  content changed: {changed}\n"
        f"Rebuild it with: {repack_hint}\n"
        f"then commit the updated {tracked.relative_to(REPO_ROOT)}"
    )


def test_json_tools_installer_apworld_fresh(tmp_path, capsys):
    tracked = APWORLDS_DIR / "json_tools_installer.apworld"
    assert tracked.is_file(), f"tracked artifact missing: {tracked}"

    packer = _load_script("pack_json_tools_installer")
    fresh = tmp_path / "json_tools_installer.apworld"
    assert packer.create_apworld(fresh), "pack script failed"
    capsys.readouterr()  # swallow the script's prints

    _assert_content_equal(
        tracked, fresh, "python scripts/build/pack_json_tools_installer.py"
    )


@pytest.mark.parametrize("world_name", PACKED_WORLDS)
def test_world_apworld_fresh(world_name, tmp_path, capsys):
    tracked = APWORLDS_DIR / f"{world_name}.apworld"
    if not tracked.is_file():
        pytest.skip(f"{tracked.name} is not a tracked artifact")
    if not (REPO_ROOT / "worlds" / world_name).is_dir():
        pytest.skip(f"worlds/{world_name} not present")

    packer = _load_script("pack_apworld")
    fresh = tmp_path / f"{world_name}.apworld"
    assert packer.pack_apworld(world_name, output_path=fresh), "pack script failed"
    capsys.readouterr()

    _assert_content_equal(
        tracked, fresh, f"python scripts/build/pack_apworld.py {world_name}"
    )
