"""
Regression guard: loop_costs and procgen_metadata survive the
world_generator -> export round-trip, PER PLAYER.

Both keys are per-player maps (APWORLD SUBSTRATE CHANGE P1a, user ruling
2026-09-27): `{"<p>": block}`, the shape `preset_sidecars` has. A world
package is ONE slot's world, so it holds one block per key:
world_generator writes the source's `[player]` entry into
`_worldgen_loop_costs.json` / `_worldgen_procgen_metadata.json`, and the
export handler re-injects each package's block under ITS exporting player
(`export_data[KEY][str(player)]`). The runtime loops module enters loop mode
for a slot whose `loop_costs` entry is present.

These tests cover the re-injection half directly (two worlds land under
their own players), the generator's write half on the committed four-player
fixture (slot 2 carries a block, slot 3 does not), and the exporter's key
lists (both keys ordered, both sliced per player).
"""
import importlib
import json
import sys
from pathlib import Path

import pytest

from exporter.games.base.handler import BaseGameExportHandler


ROOT = Path(__file__).resolve().parent.parent

SAMPLE_LOOP_COSTS = {
    "version": "1.0",
    "regions": {
        "region_2_2": {"moveCost": 50, "xpEffect": "cost"},
        "region_2_1": {"moveCost": 55, "xpEffect": "cost"},
    },
    "locations": {
        "region_2_2__loc_0": 50,
        "region_2_1__loc_0": 55,
    },
    "defaultRegionCost": 50,
    "defaultLocationCost": 10,
    "defaultRegionXpEffect": "cost",
}
OTHER_LOOP_COSTS = {**SAMPLE_LOOP_COSTS, "defaultRegionCost": 99}
SAMPLE_METADATA = {"driver": "grid-growth", "region_count": 2, "grid_dims": {"width": 2, "height": 1}}

_MODULES = []


def _make_fake_world(tmp_path, name="fake_loop_world", *, files=None):
    """Build a fake world object whose package directory holds `files`
    ({filename: contents}), so the handler's importlib-based file lookup
    resolves to them."""
    if files is None:
        files = {"_worldgen_loop_costs.json": SAMPLE_LOOP_COSTS}
    pkg_dir = tmp_path / name
    pkg_dir.mkdir(exist_ok=True)
    (pkg_dir / "__init__.py").write_text("", encoding="utf-8")
    for fname, contents in files.items():
        (pkg_dir / fname).write_text(json.dumps(contents), encoding="utf-8")

    if str(tmp_path) not in sys.path:
        sys.path.insert(0, str(tmp_path))
    importlib.invalidate_caches()
    module = importlib.import_module(name)
    _MODULES.append(name)

    FakeWorld = type("FakeWorld", (), {})
    FakeWorld.__module__ = name
    return FakeWorld(), module


@pytest.fixture
def cleanup_fake_module(tmp_path):
    yield
    while _MODULES:
        sys.modules.pop(_MODULES.pop(), None)
    sys.path[:] = [p for p in sys.path if p != str(tmp_path)]


def test_loop_costs_reinjected_under_the_exporting_player(tmp_path, cleanup_fake_module):
    """The handler reads _worldgen_loop_costs.json and sets
    export_data['loop_costs'][str(player)] — never the top level."""
    world, _ = _make_fake_world(tmp_path)
    handler = BaseGameExportHandler()
    export_data = {}

    handler._inject_worldgen_loop_costs(world, export_data, 1)

    assert export_data == {"loop_costs": {"1": SAMPLE_LOOP_COSTS}}


def test_two_worlds_land_under_their_own_players(tmp_path, cleanup_fake_module):
    """Two worldgen worlds in one multiworld: each package's block lands under
    ITS player (the old first-wins rule is gone), for both keys."""
    a, _ = _make_fake_world(tmp_path, "fake_world_a", files={
        "_worldgen_loop_costs.json": SAMPLE_LOOP_COSTS,
        "_worldgen_procgen_metadata.json": SAMPLE_METADATA,
    })
    b, _ = _make_fake_world(tmp_path, "fake_world_b", files={
        "_worldgen_loop_costs.json": OTHER_LOOP_COSTS,
    })
    handler = BaseGameExportHandler()
    export_data = {}

    for world, player in ((a, 1), (b, 3)):
        handler._inject_worldgen_procgen_metadata(world, export_data, player)
        handler._inject_worldgen_loop_costs(world, export_data, player)

    assert export_data["loop_costs"] == {"1": SAMPLE_LOOP_COSTS, "3": OTHER_LOOP_COSTS}
    # world b ships no metadata file: slot 3 carries no entry
    assert export_data["procgen_metadata"] == {"1": SAMPLE_METADATA}


def test_no_key_when_the_package_ships_none(tmp_path, cleanup_fake_module):
    """No package file -> no key added (non-loop worlds stay byte-identical)."""
    world, _ = _make_fake_world(tmp_path, files={})
    handler = BaseGameExportHandler()
    export_data = {}

    handler._inject_worldgen_loop_costs(world, export_data, 1)
    handler._inject_worldgen_procgen_metadata(world, export_data, 1)

    assert export_data == {}


def _export_key_lists():
    """The exporter's key order and per-player key list — module-level since
    P1b′ lifted them out of the export function (they were locals, read off
    its source as literals until then)."""
    from exporter.exporter import DESIRED_KEY_ORDER, PLAYER_SPECIFIC_KEYS
    return {"DESIRED_KEY_ORDER": DESIRED_KEY_ORDER, "PLAYER_SPECIFIC_KEYS": PLAYER_SPECIFIC_KEYS}


def test_both_keys_ordered_and_sliced_per_player():
    """Both keys are in the ORDERED list (no not-in-order warning; the
    pipeline's order, procgen_metadata before loop_costs) and in
    `PLAYER_SPECIFIC_KEYS`, which is what makes a `_P<n>` export slice them
    to its own slot's entry — or drop the key when the slot has none."""
    lists = _export_key_lists()
    order = lists["DESIRED_KEY_ORDER"]
    assert order.index("procgen_metadata") + 1 == order.index("loop_costs")
    assert order.index("preset_sidecars") < order.index("procgen_metadata")
    for key in ("procgen_metadata", "loop_costs"):
        assert key in lists["PLAYER_SPECIFIC_KEYS"], key


FOUR = ROOT / "frontend/presets/multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json"


def test_generator_writes_the_players_block_alone_or_none(tmp_path):
    """The write half, on the committed four-player fixture: its
    procgen_metadata is `{"1": b, "2": b}`, so generating slot 2 writes the
    package file holding `b` alone (the block, not the map), and generating
    slot 3 (a bounce slot with no entry) writes none."""
    from world_generator.generator import WorldGenerator

    source = json.loads(FOUR.read_text(encoding="utf-8"))
    carried = sorted(source["procgen_metadata"])
    assert "2" in carried and "3" not in carried, carried  # the premise, read off the fixture

    for player in ("2", "3"):
        gen = WorldGenerator(str(FOUR), output_dir=str(tmp_path / f"p{player}"), force=True, player_id=player)
        gen.load()
        gen.generate()

    written = tmp_path / "p2" / "_worldgen_procgen_metadata.json"
    assert json.loads(written.read_text(encoding="utf-8")) == source["procgen_metadata"]["2"]
    assert not (tmp_path / "p3" / "_worldgen_procgen_metadata.json").exists()
    assert not (tmp_path / "p2" / "_worldgen_loop_costs.json").exists()  # the fixture carries no loop_costs
