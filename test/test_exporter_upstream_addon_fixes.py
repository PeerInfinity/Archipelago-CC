"""U1 of the upstream rules add-on: the three exporter fixes it needs. The add-on
runs this exporter zipped, inside an upstream generator, and sends each slot's
`_P<n>` document in slot_data, which every client of the room can read.

1. Handler discovery lists modules with `pkgutil.iter_modules`, so a ZIPPED copy
   of the exporter finds every handler (`os.listdir` saw none inside a zip, and
   every game then fell back to the generic handler without a word). On a folder
   it finds exactly the set the old `os.listdir` scan found. Finding none warns.
2. A slot's `_P<n>` document is cut to the slot: `helpers` carries its own entry
   only (`{}` when it has none), and `items[p]` lists only this world's items, never
   another player's item placed in this world (whose ID is another game's: the web
   client's ID check refused such a document, "N item ID(s) differ").
3. `game_directory` comes from the world class's module, not a fork-only data file.
"""
import json
import logging
import os
import subprocess
import sys
import textwrap
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT / "exporter" / "games"


def _listdir_modules(subdir):
    """What the old discovery scanned: `<subdir>/*.py`, not starting with `_`."""
    return sorted(f[:-3] for f in os.listdir(GAMES_DIR / subdir)
                  if f.endswith(".py") and not f.startswith("_"))


# ------------------------------------------------------------------ 1. discovery
def test_folder_discovery_lists_the_same_modules_as_the_old_scan():
    from exporter import games
    for subdir in games.HANDLER_DIRECTORIES:
        assert games._handler_module_names(f"exporter.games.{subdir}") == _listdir_modules(subdir), subdir


def test_folder_discovery_registers_a_handler_per_handler_module():
    from exporter import games
    discovered = games._discover_handlers()
    assert discovered == games.GAME_HANDLERS
    names = set()
    for subdir in games.HANDLER_DIRECTORIES:
        names |= set(_listdir_modules(subdir))
    # Every registered handler is one of the scanned modules, and there are many.
    assert set(discovered) <= names
    assert len(discovered) >= 40, len(discovered)


def test_zero_handlers_is_not_silent(monkeypatch, caplog):
    from exporter import games
    monkeypatch.setattr(games, "HANDLER_DIRECTORIES", ["no_such_handler_dir"])
    with caplog.at_level(logging.WARNING, logger=games.logger.name):
        assert games._discover_handlers() == {}
    assert any("Discovered 0 game export handlers" in r.getMessage() for r in caplog.records), caplog.text


ZIP_DRIVER = textwrap.dedent(r'''
    import json, sys
    zip_path, root = sys.argv[1:3]
    sys.path.insert(0, root)
    sys.path.insert(0, zip_path)   # `exporter` resolves from the zip, the rest from the tree
    import exporter.games as games
    from exporter.games import _get_world_directory
    print("RESULT " + json.dumps({
        "file": games.__file__,
        "handlers": sorted(games.GAME_HANDLERS),
        # a worldgen world resolves to its parent's handler by module spec, not by file path
        "worldgen": _get_world_directory(type("W", (), {"__module__": "worlds.tunic_worldgen"})()),
    }))
''')


def test_a_zipped_exporter_finds_every_handler(tmp_path):
    from exporter import games
    zip_path = tmp_path / "exporter.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for path in (ROOT / "exporter").rglob("*.py"):
            zf.write(path, path.relative_to(ROOT).as_posix())
    driver = tmp_path / "driver.py"
    driver.write_text(ZIP_DRIVER, encoding="utf-8")
    proc = subprocess.run([sys.executable, str(driver), str(zip_path), str(ROOT)],
                          capture_output=True, text=True, cwd=tmp_path, timeout=600)
    lines = [l for l in proc.stdout.splitlines() if l.startswith("RESULT ")]
    assert proc.returncode == 0 and lines, proc.stderr[-4000:]
    result = json.loads(lines[-1][len("RESULT "):])
    assert result["file"].startswith(str(zip_path)), result["file"]
    assert result["handlers"] == sorted(games.GAME_HANDLERS)
    assert result["worldgen"] == _get_expected_worldgen_dir()


def _get_expected_worldgen_dir():
    from exporter.games import _get_world_directory
    return _get_world_directory(type("W", (), {"__module__": "worlds.tunic_worldgen"})())


# ---------------------------------------------------- 2–3. a 3-player room, exported
# Fork worlds pytest loads (conftest drops the upstream ones), three games so every
# world holds other players' items. None exports helpers: the helpers cut is pinned
# below on a synthetic document, and in the room only as "no other slot's".
GAMES = ("APQuest", "Baking Adventure", "TOEM original")


@pytest.fixture(scope="module")
def room(tmp_path_factory):
    """A 3-game room, filled, exported by `export_game_rules` (no presets saved)."""
    from worlds import AutoWorldRegister
    from test.general import setup_multiworld
    from Fill import distribute_items_restrictive
    import worlds.json_tools_installer.json_tools_settings as jts
    import exporter.exporter as ex
    from exporter.games import clear_handler_cache

    real = jts.get_json_tools_settings

    class _Overrides:
        save_rules_json = True
        use_tracking_mode_config = False

        def __getattr__(self, name):
            return getattr(real(), name)

    jts.get_json_tools_settings = lambda: _Overrides()
    try:
        multiworld = setup_multiworld([AutoWorldRegister.world_types[g] for g in GAMES], seed=4801)
        distribute_items_restrictive(multiworld)
        out = tmp_path_factory.mktemp("room")
        ex.export_game_rules(multiworld, str(out), "R", save_presets=False, rules_json_format="rule_builder")
    finally:
        jts.get_json_tools_settings = real
        ex.clear_rule_cache()
        clear_handler_cache()
    docs = {str(p): json.loads((out / f"R_P{p}_rules.json").read_text(encoding="utf-8"))
            for p in multiworld.player_ids}
    combined = json.loads((out / "R_rules.json").read_text(encoding="utf-8"))
    return multiworld, combined, docs


def test_the_room_places_foreign_items_in_every_world(room):
    """The premise: each world holds another player's item, so a doc that kept
    them would show it."""
    multiworld, _, _ = room
    for p in multiworld.player_ids:
        assert any(loc.item and loc.item.player != p for loc in multiworld.get_locations(p)), p


def test_items_list_only_this_worlds_items(room):
    multiworld, combined, docs = room
    for p, doc in docs.items():
        world = multiworld.worlds[int(p)]
        for source in (doc["items"][p], combined["items"][p]):
            for name, item in source.items():
                if item.get("id") is None:
                    continue
                # the client's ID check: every ID-bearing item is this game's, by this game's ID
                assert world.item_name_to_id.get(name) == item["id"], (p, name, item["id"])


def test_helpers_carry_only_the_slots_own_entry(room):
    _, combined, docs = room
    for p, doc in docs.items():
        assert set(doc["helpers"]) <= {p}, (p, list(doc["helpers"]))
        assert doc["helpers"] == ({p: combined["helpers"][p]} if p in combined.get("helpers", {}) else {})
    # the combined export keeps every slot's
    assert set(combined["helpers"]) == {p for p in docs if docs[p]["helpers"]}


def test_helpers_slice_keeps_the_slot_and_gives_a_slot_without_any_an_empty_map():
    """A slot with no helpers used to get every other slot's whole map (ChecksFinder
    beside TUNIC: 67 KB). Now: its own entry, or `{}`; the combined doc keeps all."""
    from exporter.exporter import create_ordered_export_data
    doc = {"helpers": {"1": {"can_a": {"body": 1}}, "3": {"can_c": {"body": 3}}},
           "items": {"1": {}, "2": {}, "3": {}}}
    assert create_ordered_export_data(doc, player_id="1")["helpers"] == {"1": {"can_a": {"body": 1}}}
    assert create_ordered_export_data(doc, player_id="2")["helpers"] == {}
    assert create_ordered_export_data(doc, player_id="3")["helpers"] == {"3": {"can_c": {"body": 3}}}
    assert create_ordered_export_data(doc)["helpers"] == doc["helpers"]
    # a document without the key stays without it
    assert "helpers" not in create_ordered_export_data({"items": {"1": {}}}, player_id="1")


def test_game_directory_is_the_world_modules(room):
    multiworld, combined, docs = room
    for p, doc in docs.items():
        assert doc["game_directory"] == type(multiworld.worlds[int(p)]).__module__.split(".")[1]
    assert combined["game_name"] == "Multiworld" and combined["game_directory"] == "multiworld"


def test_a_slot_document_is_the_slice_of_the_combined_one(room):
    """The `_P<n>` file is what `create_ordered_export_data` makes of the combined
    document (as test_export_player_slicing.py holds the committed fixture to)."""
    from exporter.exporter import create_ordered_export_data
    _, combined, docs = room
    for p, doc in docs.items():
        sliced = create_ordered_export_data(combined, game_name=doc["game_name"], player_id=p,
                                            game_directory=doc["game_directory"])
        assert json.loads(json.dumps(sliced)) == doc, p


def test_world_directory_of_falls_back_to_the_name_lookup():
    from exporter.exporter import world_directory_of, get_world_directory_name
    outside = type("W", (), {"__module__": "somewhere.else"})()
    assert world_directory_of(outside, "Starcraft 2") == get_world_directory_name("Starcraft 2") == "sc2"
    assert world_directory_of(None, None) is None
    zipped = type("W", (), {"__module__": "worlds.some_apworld.world"})()
    assert world_directory_of(zipped, "Anything") == "some_apworld"
