"""`assume_bidirectional_exits` is PER PLAYER: its one home is
`exporter["<p>"].assume_bidirectional_exits` (rules F1; user ruling 2026-10-03:
*"If there are presets that set the bidirectional flag at the top level, then
that's a bug. The flag should be specific to one player."*).

Three rows, one per leg of the key's Python path:
- the SLICER: a `_P<n>` export carries `exporter[n]` and no other slot's block;
- the HANDLER: the game's handler constant decides, and failing that a
  world_generator world's `assume_bidirectional_exits` class attribute is
  written back into the exporting slot's block (no attribute, no key — the
  frontend auto-detects);
- the ROUND TRIP: a committed `procgen_maze` preset (which carries the flag in
  `exporter["1"]`) → world_generator → the generated world class → the
  handler's exporter settings give the SAME value back. Until F1 world_generator
  skipped the key and the round trip lost it.
"""
import importlib
import json
import sys
from pathlib import Path

import pytest

from exporter.exporter import PLAYER_SPECIFIC_KEYS, create_ordered_export_data
from exporter.games.base.handler import BaseGameExportHandler


ROOT = Path(__file__).resolve().parent.parent
MAZE = ROOT / "frontend/presets/procgen_maze/AP_1/AP_1_rules.json"
KEY = "assume_bidirectional_exits"


def test_a_player_slice_carries_only_its_own_exporter_block():
    """Three slots that DISAGREE: each `_P<n>` slice keeps slot n's block alone,
    and a slot with no block gets no `exporter` entry for another slot."""
    combined = {
        "regions": {"1": {}, "2": {}, "3": {}},
        "exporter": {"1": {KEY: True}, "2": {KEY: False}},
    }
    assert "exporter" in PLAYER_SPECIFIC_KEYS
    for slot, expected in (("1", {"1": {KEY: True}}), ("2", {"2": {KEY: False}})):
        sliced = create_ordered_export_data(combined, player_id=slot)
        assert sliced["exporter"] == expected, slot
        assert KEY not in sliced, slot
    sliced3 = create_ordered_export_data(combined, player_id="3")
    assert all(p == "3" for p in sliced3.get("exporter", {})), sliced3.get("exporter")


class _Handler(BaseGameExportHandler):
    pass


class _HandlerFalse(BaseGameExportHandler):
    ASSUME_BIDIRECTIONAL_EXITS = False


def _world(**attrs):
    return type("FakeWorld", (), attrs)()


def test_the_handler_constant_wins_and_a_world_attribute_fills_in():
    assert _Handler().get_exporter_settings() == {}
    assert _Handler().get_exporter_settings(_world()) == {}
    assert _Handler().get_exporter_settings(_world(assume_bidirectional_exits=True)) == {KEY: True}
    assert _Handler().get_exporter_settings(_world(assume_bidirectional_exits=False)) == {KEY: False}
    # The game's own handler decides over a world's attribute.
    assert _HandlerFalse().get_exporter_settings(_world(assume_bidirectional_exits=True)) == {KEY: False}
    # A non-bool attribute is not a statement.
    assert _Handler().get_exporter_settings(_world(assume_bidirectional_exits="yes")) == {}


_MODULES = []
_GAMES = []


@pytest.fixture
def generated_world_import(tmp_path):
    """Imports a generated package for one row, then UNREGISTERS it: importing a
    world registers its game in AP's global `AutoWorldRegister`, which every
    later test in the session would otherwise see."""
    from worlds.AutoWorld import AutoWorldRegister

    yield tmp_path
    while _GAMES:
        AutoWorldRegister.world_types.pop(_GAMES.pop(), None)
    while _MODULES:
        for name in [m for m in sys.modules if m == _MODULES[-1] or m.startswith(_MODULES[-1] + ".")]:
            sys.modules.pop(name, None)
        _MODULES.pop()
    sys.path[:] = [p for p in sys.path if p != str(tmp_path)]


@pytest.mark.parametrize("value", [True, False])
def test_the_world_generator_round_trip_keeps_the_slots_flag(generated_world_import, value):
    """procgen_maze preset → world_generator → the generated world's class →
    the handler: `exporter["1"]` comes back with the value the source slot
    stated. `False` is the source edited in memory (no committed preset says
    false), so the row cannot pass by a default."""
    from world_generator.generator import WorldGenerator

    tmp_path = generated_world_import
    source = json.loads(MAZE.read_text(encoding="utf-8"))
    assert source["exporter"]["1"][KEY] is True and KEY not in source  # the premise, read off the preset
    source["exporter"]["1"][KEY] = value
    src = tmp_path / "source_rules.json"
    src.write_text(json.dumps(source), encoding="utf-8")

    pkg = f"f1_bidir_roundtrip_{str(value).lower()}"
    game = f"F1 Bidir Roundtrip {value}"  # a unique game: the import registers it (fixture)
    gen = WorldGenerator(str(src), output_dir=str(tmp_path / pkg), game_name=game, force=True, player_id="1")
    gen.load()
    gen.generate()

    init_py = (tmp_path / pkg / "__init__.py").read_text(encoding="utf-8")
    assert f"{KEY}: ClassVar[bool] = {value}" in init_py

    # Import the generated package the way AP would, then hand its world class
    # to the handler.
    if str(tmp_path) not in sys.path:
        sys.path.insert(0, str(tmp_path))
    importlib.invalidate_caches()
    _MODULES.append(pkg)
    _GAMES.append(game)
    importlib.import_module(pkg)
    from worlds.AutoWorld import AutoWorldRegister
    world_cls = AutoWorldRegister.world_types[game]
    world = object.__new__(world_cls)
    assert _Handler().get_exporter_settings(world) == {KEY: value}


def test_a_source_without_the_flag_generates_no_attribute(tmp_path):
    """Absent ⇒ auto-detect is preserved: no flag in the source slot, no class
    attribute, so the export states none."""
    from world_generator.generator import WorldGenerator

    source = json.loads(MAZE.read_text(encoding="utf-8"))
    source["exporter"] = {}
    src = tmp_path / "source_rules.json"
    src.write_text(json.dumps(source), encoding="utf-8")
    gen = WorldGenerator(str(src), output_dir=str(tmp_path / "out"), force=True, player_id="1")
    gen.load()
    gen.generate()
    assert KEY not in (tmp_path / "out" / "__init__.py").read_text(encoding="utf-8")
