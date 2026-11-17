"""The Upstream Rules Add-on (worlds/upstream_rules_addon, packed to apworlds/upstream_rules_addon.apworld).

Here, in the fork: the packed file is what the source packs to, its vendored exporter has no fork-only import
left, the source folder installs no hook, and the add-on's own steps (export, strips, gate, cap, inject, the
lost-injection warning) on a real filled room exported by this tree's exporter.

What needs a PRISTINE upstream generator (the packed apworld in custom_worlds/, AP's own Main.py calling the
wrapped call_all, the vendored exporter running from inside the zip) runs in CI against upstream Archipelago at a
pinned tag: .github/workflows/upstream-rules-addon.yml → scripts/test/upstream_rules_addon_pristine.py.
"""
import ast
import gc
import json
import logging
import zipfile
from pathlib import Path
from unittest import mock

import pytest

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "worlds" / "upstream_rules_addon"
PACKED = REPO / "apworlds" / "upstream_rules_addon.apworld"

from scripts.build import pack_upstream_rules_addon as packer  # noqa: E402

import worlds.upstream_rules_addon as addon  # noqa: E402
from worlds.upstream_rules_addon import _addon, _unused_fields  # noqa: E402

GAMES = ("APQuest", "Baking Adventure", "TOEM original")


# ------------------------------------------------------------------------------- the packed file
def test_the_committed_apworld_is_what_the_source_packs_to(tmp_path):
    """A change to the add-on, the exporter or a vendored module that doesn't re-pack goes red here.
    Re-pack: python scripts/build/pack_upstream_rules_addon.py"""
    assert packer.stale_entries(PACKED) == [], "re-pack: python scripts/build/pack_upstream_rules_addon.py"
    fresh = packer.pack(tmp_path / "upstream_rules_addon.apworld")
    with zipfile.ZipFile(fresh) as a, zipfile.ZipFile(PACKED) as b:
        assert a.namelist() == b.namelist(), "same entries in the same (sorted) order"
        assert [i.date_time for i in a.infolist()] == [i.date_time for i in b.infolist()]


def test_the_pack_holds_the_addon_and_the_vendored_exporter():
    with zipfile.ZipFile(PACKED) as packed:
        names = set(packed.namelist())
        manifest = json.loads(packed.read("upstream_rules_addon/archipelago.json"))
        notice = packed.read("upstream_rules_addon/LICENSE").decode("utf-8")
        vendored = json.loads(packed.read("upstream_rules_addon/_vendor/VENDORED.json"))["sources"]
    for name in ("__init__.py", "_addon.py", "_unused_fields.py", "LICENSE", "archipelago.json",
                 "_vendor/__init__.py", "_vendor/_recipe_settings.py", "_vendor/_rule_builder_ast_utils.py",
                 "_vendor/_embedded_rules.py", "_vendor/_sanitization.py",
                 "_vendor/exporter/exporter.py", "_vendor/exporter/games/__init__.py",
                 "_vendor/exporter/converter/cli.py"):     # converter/__init__ imports cli: without it, AST fallback
        assert f"upstream_rules_addon/{name}" in names, name
    assert not any("/test" in n or n.endswith(".pyc") or "__pycache__" in n for n in names)
    assert manifest["game"] == "Upstream Rules Addon" and manifest["minimum_ap_version"] == "0.6.8"
    assert manifest["world_version"] == addon.__version__ and manifest["compatible_version"]
    assert notice.startswith("MIT License") and "Permission is hereby granted" in notice
    assert "exporter/exporter.py" in vendored and "rule_builder/_ast_utils.py" in vendored


def test_no_fork_only_import_is_left_in_the_vendored_tree():
    with zipfile.ZipFile(PACKED) as packed:
        problems = []
        for name in packed.namelist():
            if name.endswith(".py"):
                problems += packer._fork_only_imports(name, packed.read(name).decode("utf-8"))
    assert problems == []


def test_the_pack_refuses_a_fork_only_import_it_cannot_rewrite():
    assert packer._fork_only_imports("x.py", "from world_generator.extractors import y\n") == \
        ["x.py:1: world_generator.extractors"]
    rewritten = packer._rewrite("from exporter.games import a\nif True:\n    from exporter import b\n"
                                "from rule_builder._ast_utils import c\n"
                                "from worlds.json_tools_installer.json_tools_settings import d\n")
    assert packer._fork_only_imports("x.py", rewritten) == []
    assert "worlds.upstream_rules_addon._vendor.exporter.games" in rewritten


def test_the_vendored_settings_are_the_minimal_spoilers_recipe():
    values = packer._recipe_values()
    assert values["rules_json_format"] == "rule_builder" and values["resolve_options_to_constants"] is True
    assert values["save_rules_json"] is True and values["use_tracking_mode_config"] is False
    for key in packer.RECIPE_OFF:
        assert values[key] is False
    namespace = {}
    exec(packer._recipe_settings_source(), namespace)  # noqa: S102 - our own generated source
    assert namespace["get_json_tools_settings"]().rules_json_format == "rule_builder"


def test_the_source_manifest_and_settings_defaults():
    manifest = json.loads((SOURCE / "archipelago.json").read_text(encoding="utf-8"))
    assert manifest == {"game": "Upstream Rules Addon", "minimum_ap_version": "0.6.8",
                        "world_version": addon.__version__}
    defaults = addon.UpstreamRulesAddonSettings()
    assert bool(defaults.enabled) is True and int(defaults.max_kb) == 1024
    assert list(defaults.exclude_games) == ["APCalc", "DepGraph", "Metamath"]
    assert str(defaults.strip_level) == "play" == _unused_fields.DEFAULT_LEVEL
    assert addon.UpstreamRulesAddonWorld.hidden is True
    with pytest.raises(RuntimeError):
        addon.UpstreamRulesAddonWorld.stage_assert_generate(None)


def test_the_source_folder_installs_no_hook():
    """The fork loads worlds/upstream_rules_addon as a folder: no _vendor, so its generation is unchanged."""
    from worlds import AutoWorld
    assert addon.is_built() is False
    assert not getattr(AutoWorld.call_all, "_upstream_rules_addon", False)


def test_the_hook_runs_the_real_stage_first_then_the_addon(monkeypatch):
    from worlds import AutoWorld
    calls = []
    monkeypatch.setattr(addon, "_original_call_all", lambda mw, name, *args: calls.append(("real", name)))
    monkeypatch.setattr(addon, "on_pre_output", lambda mw: calls.append(("addon", "pre_output")))
    monkeypatch.setattr(addon, "on_modify_multidata", lambda mw, md: calls.append(("addon", "modify_multidata")))
    monkeypatch.setattr(AutoWorld, "call_all", AutoWorld.call_all)   # restored after the test
    assert addon.install_hook() and AutoWorld.call_all is addon._call_all
    AutoWorld.call_all(None, "pre_output")
    AutoWorld.call_all(None, "generate_basic")
    AutoWorld.call_all(None, "modify_multidata", {})
    assert calls == [("real", "pre_output"), ("addon", "pre_output"), ("real", "generate_basic"),
                     ("real", "modify_multidata"), ("addon", "modify_multidata")]
    monkeypatch.setattr(addon, "on_pre_output", mock.Mock(side_effect=RuntimeError("boom")))
    AutoWorld.call_all(None, "pre_output")          # an add-on failure never fails the stage


# ------------------------------------------------------------------------------- the strips
def test_strip_unused_removes_exactly_the_listed_fields():
    doc = {"keep": 1, **{k: 1 for k in _unused_fields.TOP},
           "world": {"1": {"options": {}, **{k: 1 for k in _unused_fields.WORLD}}},
           "items": {"1": {"Sword": {"id": 5, **{k: 1 for k in _unused_fields.ITEM}}}},
           "regions": {"1": {"R": {"locations": [{"name": "L", "id": 9, **{k: 1 for k in _unused_fields.LOCATION}}]}}}}
    assert _unused_fields.strip_unused(doc) == {"keep": 1, "world": {"1": {"options": {}}},
                                                "items": {"1": {"Sword": {"id": 5}}},
                                                "regions": {"1": {"R": {"locations": [{"name": "L", "id": 9}]}}}}


def test_the_editor_level_keeps_the_fields_and_play_is_the_default():
    doc = {"items": {"1": {"Sword": {"id": 5, "classification": "progression", "type": "Sword"}}},
           "world": {"1": {"world_class_name": "W"}}, "archipelago_version": "0.6.9"}
    assert _unused_fields.strip_unused(json.loads(json.dumps(doc)), "editor") == doc
    assert _unused_fields.strip_unused(json.loads(json.dumps(doc))) == \
        _unused_fields.strip_unused(json.loads(json.dumps(doc)), "play") == \
        {"items": {"1": {"Sword": {"id": 5, "type": "Sword"}}}, "world": {"1": {}}}
    assert set(_unused_fields.LEVELS) == {"play", "editor"}
    with pytest.raises(KeyError):
        _unused_fields.strip_unused({}, "nonsense")


def test_an_item_id_that_is_not_an_integer_becomes_none():
    """ALttP's prizes carry ROM bytes as id; the client's ID check refused the whole server document over them."""
    from worlds.upstream_rules_addon._addon import ids_the_server_knows
    doc = {"items": {"2": {"Crystal 1": {"id": [2, 52, 100, 64, 127, 6]}, "Bow": {"id": 59}, "Event": {"id": None},
                           "Odd": {"id": True}, "Text": {"id": "12"}}}}
    assert ids_the_server_knows(doc) == {"items": {"2": {"Crystal 1": {"id": None}, "Bow": {"id": 59},
                                                         "Event": {"id": None}, "Odd": {"id": None},
                                                         "Text": {"id": None}}}}


def test_the_committed_alttp_preset_has_the_prize_ids_the_add_on_clears():
    """The premise, on the fork's own preset (the add-on's ALttP doc equals it after the strips)."""
    preset = json.loads((REPO / "frontend/presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json")
                        .read_text(encoding="utf-8"))
    odd = sorted(n for n, it in preset["items"]["1"].items() if isinstance(it.get("id"), list))
    assert "Crystal 1" in odd and "Red Pendant" in odd and len(odd) == 10
    cleared = _addon.ids_the_server_knows(preset)
    assert all(isinstance(it.get("id"), int) or it.get("id") is None for it in cleared["items"]["1"].values())


def test_fields_the_client_reads_are_never_stripped():
    """Known readers (rules-feature-inventory census): KH2's helpers read option_definitions, SM's logic reads item
    type, and the client reads world options and the top-level dungeons."""
    assert "option_definitions" not in _unused_fields.WORLD and "options" not in _unused_fields.WORLD
    assert "type" not in _unused_fields.ITEM
    assert "dungeons" not in _unused_fields.TOP


# ------------------------------------------------------------------------------- a real room
@pytest.fixture(scope="module")
def room():
    """A 3-game room, filled; the exporter's settings forced to the add-on's recipe (CI's host.yaml has none)."""
    from worlds import AutoWorldRegister
    from test.general import setup_multiworld
    from Fill import distribute_items_restrictive
    multiworld = setup_multiworld([AutoWorldRegister.world_types[g] for g in GAMES], seed=4801)
    distribute_items_restrictive(multiworld)
    return multiworld


@pytest.fixture
def recipe(monkeypatch):
    import worlds.json_tools_installer.json_tools_settings as jts
    namespace = {}
    exec(packer._recipe_settings_source(), namespace)  # noqa: S102 - our own generated source
    monkeypatch.setattr(jts, "get_json_tools_settings", namespace["get_json_tools_settings"])


def _export(multiworld, **kw):
    args = dict(enabled=True, max_kb=1024, exclude_games=[])
    args.update(kw)
    return _addon.export_room(multiworld, addon.__name__, **args)


@pytest.fixture(scope="module")
def exported(room, tmp_path_factory):
    import worlds.json_tools_installer.json_tools_settings as jts
    namespace = {}
    exec(packer._recipe_settings_source(), namespace)  # noqa: S102
    with mock.patch.object(jts, "get_json_tools_settings", namespace["get_json_tools_settings"]):
        keep = tmp_path_factory.mktemp("raw")
        result = _export(room, keep_dir=str(keep))
    raw = {p: json.loads((keep / f"AP_{room.seed_name}_P{p}_rules.json").read_text(encoding="utf-8"))
           for p in room.player_ids}
    return result, raw


def test_every_slot_gets_an_envelope(room, exported):
    result, _ = exported
    assert sorted(result) == list(room.player_ids)
    for p, entry in result.items():
        envelope = entry["envelope"]
        assert envelope["format"] == 1 and envelope["player"] == str(p) and envelope["source"] == "upstream_rules_addon"
        assert envelope["doc"]["world"][str(p)]
        assert entry["bytes"] == _addon.envelope_bytes(envelope)


def test_the_doc_is_the_raw_export_after_the_three_strips(exported):
    from world_generator._embedded_rules import strip_placements
    result, raw = exported
    for p, entry in result.items():
        expected = _unused_fields.strip_unused(_addon.ids_the_server_knows(
            _addon.strip_room(strip_placements(json.loads(json.dumps(raw[p]))))))
        assert entry["envelope"]["doc"] == expected


def test_the_doc_carries_no_placement_and_no_seed_fact(room, exported):
    result, raw = exported
    for p, entry in result.items():
        doc = entry["envelope"]["doc"]
        for key in ("seed_name", "player_names", "sphere_log", "canonical_placements", "generation_seed",
                    "itempool_counts"):
            assert key not in doc
        locations = [loc for region in doc["regions"][str(p)].values() for loc in region.get("locations", [])]
        assert locations and not [loc["name"] for loc in locations if loc.get("id") is not None and "item" in loc]
        placed = [loc for region in raw[p]["regions"][str(p)].values() for loc in region.get("locations", [])
                  if loc.get("id") is not None and isinstance(loc.get("item"), dict)]
        assert placed, "the premise: the raw export pairs locations with their items"


def test_every_per_player_map_holds_only_the_slot(exported):
    result, _ = exported
    for p, entry in result.items():
        doc = entry["envelope"]["doc"]
        maps = {k: v for k, v in doc.items() if isinstance(v, dict) and v and all(str(x).isdigit() for x in v)}
        assert maps and all(list(v) == [str(p)] for v in maps.values()), {k: list(v) for k, v in maps.items()}


def test_the_editor_level_keeps_classifications_but_never_placements(room, recipe, caplog):
    play = _export(room)
    editor = _export(room, strip_level="editor")
    with caplog.at_level(logging.WARNING, logger="UpstreamRulesAddon"):
        unknown = _export(room, strip_level="nonsense")
    assert any("unknown strip_level 'nonsense'" in r.getMessage() for r in caplog.records)
    for p in room.player_ids:
        kept, cut = editor[p]["envelope"]["doc"], play[p]["envelope"]["doc"]
        assert unknown[p]["envelope"]["doc"] == cut
        assert any("classification" in it for it in kept["items"][str(p)].values())
        assert not any("classification" in it for it in cut["items"][str(p)].values())
        assert "itempool_counts" not in kept and "seed_name" not in kept
        located = [loc for region in kept["regions"][str(p)].values() for loc in region.get("locations", [])
                   if loc.get("id") is not None]
        assert located and not [loc for loc in located if "item" in loc]
        assert editor[p]["bytes"] > play[p]["bytes"]


def test_over_the_cap_sends_the_reason(room, recipe):
    result = _export(room, max_kb=1)
    assert {r["omitted"]["reason"] for r in result.values()} == {"over_cap"}
    assert all(r["omitted"]["cap_kb"] == 1 and r["omitted"]["size_kb"] >= 1 for r in result.values())


def test_off_or_excluded_does_no_work(room, recipe):
    with mock.patch.object(_addon, "load_exporter") as load:
        assert _export(room, enabled=False) == {}
        assert _export(room, exclude_games=list(GAMES)) == {}
    load.assert_not_called()
    assert sorted(_export(room, exclude_games=["APQuest"])) == [p for p in room.player_ids if room.game[p] != "APQuest"]


def test_a_race_room_gets_its_docs_too(room, recipe):
    """Robert, 2026-11-16: "Strip, and send in race". The doc holds no placements."""
    room.is_race = True
    try:
        result = _export(room)
    finally:
        room.is_race = False
    assert all("envelope" in r for r in result.values())


def test_an_export_that_raises_is_export_failed_and_generation_goes_on(room, recipe, caplog):
    ex, _, _ = _addon.load_exporter(addon.__name__)
    with mock.patch.object(ex, "export_game_rules", side_effect=ValueError("broken")):
        result = _export(room)
    assert {r["omitted"]["reason"] for r in result.values()} == {"export_failed"}
    assert all("ValueError: broken" in r["omitted"]["error"] for r in result.values())


def test_zero_handlers_refuses_the_whole_export(room, recipe):
    import exporter.games as games
    with mock.patch.object(games, "GAME_HANDLERS", {}):
        result = _export(room)
    assert {r["omitted"]["reason"] for r in result.values()} == {"export_failed"}
    assert "0 game handlers" in next(iter(result.values()))["omitted"]["error"]


def test_a_rule_the_exporter_could_not_analyse_omits_that_slot(room, recipe):
    ex, _, root = _addon.load_exporter(addon.__name__)
    real = ex.export_game_rules
    victim = next(p for p in room.player_ids if room.game[p] == "APQuest")
    location = next(iter(room.get_locations(victim))).name

    def degraded(*args, **kwargs):
        logging.getLogger(f"{root}.exporter").warning(
            f"Failed to analyze or expand rule for Location '{location}' using runtime analysis.")
        return real(*args, **kwargs)
    with mock.patch.object(ex, "export_game_rules", degraded):
        result = _export(room)
    assert result[victim]["omitted"] == {"reason": "export_degraded", "source": "upstream_rules_addon",
                                         "unanalysed_rules": 1}
    assert all("envelope" in r for p, r in result.items() if p != victim)


def test_the_gate_counts_a_shared_name_for_each_slot_and_an_unknown_one_for_all():
    gate = _addon.DegradedRuleCounter({"Shared": {1, 2}, "Own": {3}})
    for name in ("Shared", "Own", "Nowhere"):
        gate.emit(logging.makeLogRecord({"msg": f"Failed to analyze or expand rule for Exit '{name}' using x"}))
    gate.emit(logging.makeLogRecord({"msg": "something else"}))
    assert [gate.count(p) for p in (1, 2, 3, 4)] == [2, 2, 2, 1]


def test_a_format_fallback_is_degraded(room, recipe):
    ex, _, _ = _addon.load_exporter(addon.__name__)
    real = ex.export_game_rules

    def fallback(multiworld, out, base, **kwargs):
        written = real(multiworld, out, base, **kwargs)
        for p in multiworld.player_ids:
            path = Path(out) / f"{base}_P{p}_rules.json"
            doc = json.loads(path.read_text(encoding="utf-8"))
            doc.setdefault("exporter", {})[str(p)] = {"format_fallback": {"reason": "converter failed"}}
            path.write_text(json.dumps(doc), encoding="utf-8")
        return written
    with mock.patch.object(ex, "export_game_rules", fallback):
        result = _export(room)
    assert all(r["omitted"]["reason"] == "export_degraded" and r["omitted"]["format_fallback"] == "converter failed"
               for r in result.values())


# ------------------------------------------------------------------------------- inject + warning
def test_inject_writes_envelopes_and_reasons_and_leaves_a_worlds_own_doc_alone():
    result = {1: {"envelope": {"format": 1}}, 2: {"omitted": {"reason": "over_cap"}}, 3: {"envelope": {"x": 1}},
              4: {"envelope": {"x": 1}}, 5: {"envelope": {"x": 1}}, 6: {"envelope": {"x": 1}}}
    own = {"format": 1, "player": "3", "doc": {"mine": True}}
    multidata = {"slot_data": {1: {"a": 1}, 2: {}, 3: {"worldgen_rules": own},
                               4: {"worldgen_rules_omitted": {"reason": "over_cap"}}, 5: ("not", "a dict")}}
    assert _addon.inject(result, multidata) == 3
    sd = multidata["slot_data"]
    assert sd[1] == {"a": 1, "worldgen_rules": {"format": 1}}
    assert sd[2] == {"worldgen_rules_omitted": {"reason": "over_cap"}}
    assert sd[3] == {"worldgen_rules": own} and sd[4] == {"worldgen_rules_omitted": {"reason": "over_cap"}}
    assert sd[5] == ("not", "a dict") and sd[6] == {"worldgen_rules": {"x": 1}}


class _FakeWorld:
    seed_name = "123"


def _settings(**kw):
    values = dict(enabled=True, max_kb=1024, exclude_games=[])
    values.update(kw)
    return type("S", (), values)()


def test_a_lost_injection_warns_once_when_the_multiworld_is_freed(monkeypatch, caplog):
    monkeypatch.setattr(addon, "host_settings", _settings)
    monkeypatch.setattr(_addon, "export_room", lambda *a, **k: {1: {"envelope": {}}})
    with caplog.at_level(logging.WARNING, logger="UpstreamRulesAddon"):
        world = _FakeWorld()
        addon.on_pre_output(world)
        del world
        gc.collect()
    warnings = [r for r in caplog.records if "never called modify_multidata" in r.getMessage()]
    assert len(warnings) == 1 and "seed 123" in warnings[0].getMessage()


def test_an_injection_that_happened_does_not_warn(monkeypatch, caplog):
    monkeypatch.setattr(addon, "host_settings", _settings)
    monkeypatch.setattr(_addon, "export_room", lambda *a, **k: {1: {"envelope": {"e": 1}}})
    multidata = {"slot_data": {1: {}}}
    with caplog.at_level(logging.WARNING, logger="UpstreamRulesAddon"):
        world = _FakeWorld()
        addon.on_pre_output(world)
        addon.on_modify_multidata(world, multidata)
        del world
        gc.collect()
    assert multidata["slot_data"][1] == {"worldgen_rules": {"e": 1}}
    assert not [r for r in caplog.records if "never called" in r.getMessage()]


def test_no_results_means_no_warning(monkeypatch, caplog):
    monkeypatch.setattr(addon, "host_settings", lambda: _settings(enabled=False))
    with caplog.at_level(logging.WARNING, logger="UpstreamRulesAddon"):
        world = _FakeWorld()
        addon.on_pre_output(world)
        del world
        gc.collect()
    assert not caplog.records


def test_the_source_has_no_module_level_fork_import():
    """The add-on's own files must import on pristine upstream: nothing from exporter/, world_generator/, scripts/."""
    for path in SOURCE.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in tree.body:
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                module = getattr(node, "module", None) or ""
                names = [module] if isinstance(node, ast.ImportFrom) else [a.name for a in node.names]
                assert not [n for n in names if n.split(".")[0] in ("exporter", "world_generator", "scripts")], path
