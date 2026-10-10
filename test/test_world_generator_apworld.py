"""world_generator.apworld — the .apworld the CLI and the browser build.

The frontend's apworld editor runs ``build_apworld`` inside Pyodide, where
nothing but the standard library exists, so the stdlib-only test here is what
catches a generator change that would only fail in the browser.
"""

import json
import shutil
import subprocess
import sys
import textwrap
import zipfile
from io import BytesIO
from pathlib import Path

import pytest

from world_generator import WorldGenerator
from world_generator.apworld import APWORLD_COMPATIBLE_VERSION, build_apworld

ROOT = Path(__file__).resolve().parent.parent


def _a_preset_rules_file() -> Path:
    found = sorted((ROOT / "frontend" / "presets" / "adventure").glob("AP_*/AP_*_rules.json"))
    if not found:
        pytest.skip("no adventure preset to build from")
    return found[0]


def _entries(data: bytes) -> dict:
    with zipfile.ZipFile(BytesIO(data)) as zf:
        return {name: zf.read(name) for name in zf.namelist()}


def test_archive_is_named_and_rooted_by_its_game_directory():
    built = build_apworld(_a_preset_rules_file())
    assert built["file_name"] == f"{built['game_directory']}.apworld"
    entries = _entries(built["data"])
    assert entries, "empty archive"
    assert all(name.startswith(built["game_directory"] + "/") for name in entries)
    assert f"{built['game_directory']}/__init__.py" in entries
    assert not any("__pycache__" in name or name.endswith(".pyc") for name in entries)


def test_manifest_is_stamped_and_contents_match_a_plain_generate(tmp_path):
    rules = _a_preset_rules_file()
    built = build_apworld(rules)
    gd = built["game_directory"]

    world_dir = tmp_path / gd
    WorldGenerator(str(rules), output_dir=str(world_dir), force=True).generate()

    entries = _entries(built["data"])
    on_disk = {
        f"{gd}/{p.relative_to(world_dir).as_posix()}": p.read_bytes()
        for p in world_dir.rglob("*") if p.is_file() and "__pycache__" not in p.parts
    }
    assert set(entries) == set(on_disk)

    manifest_name = f"{gd}/archipelago.json"
    packed = json.loads(entries.pop(manifest_name))
    source = json.loads(on_disk.pop(manifest_name))
    assert "compatible_version" not in source
    assert packed == {**source, "compatible_version": APWORLD_COMPATIBLE_VERSION}
    assert entries == on_disk


def test_game_name_override_renames_the_directory_and_the_game():
    built = build_apworld(_a_preset_rules_file(), game_name="Adventure Apworld Test")
    assert built["game_name"] == "Adventure Apworld Test"
    assert built["game_directory"] == "adventure_apworld_test"
    manifest = json.loads(_entries(built["data"])["adventure_apworld_test/archipelago.json"])
    assert manifest["game"] == "Adventure Apworld Test"


def test_builds_with_only_the_standard_library(tmp_path):
    """A copy of the package alone, in an isolated interpreter (-I: no site
    packages, no cwd on the path) — the same situation as Pyodide."""
    shutil.copytree(ROOT / "world_generator", tmp_path / "world_generator",
                    ignore=shutil.ignore_patterns("__pycache__"))
    script = textwrap.dedent(f"""
        import sys
        sys.path.insert(0, {str(tmp_path)!r})
        from world_generator.apworld import build_apworld
        built = build_apworld({str(_a_preset_rules_file())!r})
        print(built["file_name"], len(built["data"]))
    """)
    result = subprocess.run([sys.executable, "-I", "-c", script],
                            capture_output=True, text=True, cwd=tmp_path, timeout=120)
    assert result.returncode == 0, result.stderr[-3000:]
    assert result.stdout.strip().endswith(tuple("0123456789"))


# A minimal hand-written rules.json: no world_attributes block, which an export
# always carries. The generator used to crash on it ("cannot access local
# variable 'shop_wrapper_section'") because the template's two shop sections
# were only assigned inside the world_attributes branch.
_HAND_WRITTEN_RULES = {
    "schema_version": 3,
    "game_name": "Tiny Mod",
    "game_directory": "tiny_mod",
    "archipelago_version": "0.0.0",
    "generation_seed": 1,
    "player_names": {"1": "Player1"},
    "regions": {"1": {
        "Menu": {"name": "Menu", "locations": [], "exits": [
            {"name": "Enter Village", "connected_region": "Village", "access_rule": {"rule": "True_"}}]},
        "Village": {"name": "Village", "exits": [
            {"name": "Cave Door", "connected_region": "Cave",
             "access_rule": {"rule": "Has", "args": {"item_name": "Lantern"}}}],
            "locations": [
                {"name": "Village Chest", "id": 1, "access_rule": {"rule": "True_"}},
                {"name": "Blacksmith Reward", "id": 2,
                 "access_rule": {"rule": "Has", "args": {"item_name": "Iron Ore"}}}]},
        "Cave": {"name": "Cave", "exits": [], "locations": [
            {"name": "Cave Chest", "id": 3, "access_rule": {"rule": "True_"}},
            {"name": "Cave Boss", "id": 4, "access_rule": {"rule": "Has", "args": {"item_name": "Sword"}}},
            {"name": "Victory", "id": None, "access_rule": {"rule": "Has", "args": {"item_name": "Sword"}},
             "item": {"name": "Victory", "player": 1, "advancement": True, "type": "None"},
             "locked": True, "event": True}]},
    }},
    "start_regions": {"1": {"default": ["Menu"], "available": []}},
    "items": {"1": {
        name: {"name": name, "id": i, "groups": [], "classification": cls, "type": None, "max_count": 1}
        for i, (name, cls) in enumerate([("Lantern", "progression"), ("Iron Ore", "progression"),
                                         ("Sword", "progression"), ("Gold", "filler")], start=1)
    } | {"Victory": {"name": "Victory", "id": None, "groups": [], "classification": "progression",
                     "type": "Event", "max_count": 1}}},
    "item_groups": {"1": []},
    "itempool_counts": {"1": {"Lantern": 1, "Iron Ore": 1, "Sword": 1, "Gold": 1}},
    "world": {"1": {"game": "Tiny Mod"}},
    "game_info": {"1": {"completion_condition": {"rule": "Has", "args": {"item_name": "Victory"}}}},
}


def test_builds_a_hand_written_rules_file_without_world_attributes(tmp_path):
    assert "world_attributes" not in _HAND_WRITTEN_RULES
    rules = tmp_path / "rules.json"
    rules.write_text(json.dumps(_HAND_WRITTEN_RULES))
    built = build_apworld(rules)
    assert built["file_name"] == "tiny_mod.apworld"
    init_source = _entries(built["data"])["tiny_mod/__init__.py"].decode()
    compile(init_source, "tiny_mod/__init__.py", "exec")
    assert "_ShopWrapper" not in init_source
