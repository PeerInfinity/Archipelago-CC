"""
Regression guard: loop_costs survives the world_generator -> export
round-trip.

A loop-mode procgen rules.json carries a top-level `loop_costs` block
(per-region moveCost + xpEffect, per-location cost, defaults). The
runtime loops module auto-enters loop mode whenever loop_costs is
present, so it must survive being world-generated into a Python world
package and re-exported. The mechanism mirrors procgen_metadata:
world_generator writes `_worldgen_loop_costs.json` into the package, and
the export handler re-injects it into export_data['loop_costs'].

These tests cover the re-injection half directly (the part that makes
loop_costs reappear in the exported rules.json). The world_generator
write half is a verbatim mirror of the adjacent procgen_metadata /
sidecars writes and is exercised end-to-end by the manual round-trip
(see scripts/procgen/dump-sphere-growth.js --enable-loop-mode).
"""
import importlib
import json
import sys

import pytest

from exporter.games.base.handler import BaseGameExportHandler


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


def _make_fake_world(tmp_path, *, write_sidecar=True, contents=SAMPLE_LOOP_COSTS):
    """Build a fake world object whose package directory optionally holds
    a `_worldgen_loop_costs.json`, so the handler's importlib-based file
    lookup resolves to it.
    """
    pkg_dir = tmp_path / "fake_loop_world"
    pkg_dir.mkdir(exist_ok=True)
    (pkg_dir / "__init__.py").write_text("", encoding="utf-8")
    if write_sidecar:
        (pkg_dir / "_worldgen_loop_costs.json").write_text(
            json.dumps(contents), encoding="utf-8")

    sys.path.insert(0, str(tmp_path))
    importlib.invalidate_caches()
    module = importlib.import_module("fake_loop_world")

    class FakeWorld:
        pass

    FakeWorld.__module__ = "fake_loop_world"
    return FakeWorld(), module


@pytest.fixture
def cleanup_fake_module():
    yield
    sys.modules.pop("fake_loop_world", None)
    # Drop any tmp paths we pushed onto sys.path.
    sys.path[:] = [p for p in sys.path if "fake_loop_world" not in p]


def test_loop_costs_reinjected_from_sidecar(tmp_path, cleanup_fake_module):
    """The handler reads _worldgen_loop_costs.json and sets
    export_data['loop_costs']."""
    world, _ = _make_fake_world(tmp_path)
    handler = BaseGameExportHandler()
    export_data = {}

    handler._inject_worldgen_loop_costs(world, export_data)

    assert export_data.get("loop_costs") == SAMPLE_LOOP_COSTS


def test_loop_costs_first_wins(tmp_path, cleanup_fake_module):
    """loop_costs is top-level and first-wins — an already-present value
    is not overwritten by a later world's sidecar."""
    world, _ = _make_fake_world(tmp_path)
    handler = BaseGameExportHandler()
    existing = {"version": "1.0", "regions": {}, "locations": {},
                "defaultRegionCost": 99, "defaultLocationCost": 99}
    export_data = {"loop_costs": existing}

    handler._inject_worldgen_loop_costs(world, export_data)

    assert export_data["loop_costs"] == existing  # untouched


def test_no_loop_costs_when_sidecar_absent(tmp_path, cleanup_fake_module):
    """No sidecar file -> no loop_costs key added (non-loop worlds stay
    byte-identical)."""
    world, _ = _make_fake_world(tmp_path, write_sidecar=False)
    handler = BaseGameExportHandler()
    export_data = {}

    handler._inject_worldgen_loop_costs(world, export_data)

    assert "loop_costs" not in export_data


def test_loop_costs_in_export_key_order():
    """The exporter's key ordering lists loop_costs (top-level, after
    preset_sidecars) so it isn't appended with a not-in-order warning."""
    import exporter.exporter as exporter_mod
    source = __import__("inspect").getsource(exporter_mod)
    # The desired_key_order list must contain 'loop_costs' as a top-level
    # (not player-specific) key.
    assert "'loop_costs'," in source
