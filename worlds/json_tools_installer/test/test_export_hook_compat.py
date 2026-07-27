"""Version-skew guard: the installer apworld (custom_worlds/) and the exporter
package (installed separately) update independently. An old exporter whose
export_game_rules lacks the staging_dir parameter must be driven with its
legacy calling convention — artifacts into the ZIP staging directory it will
mirror — instead of crashing the whole export with a TypeError (reported by
guigui0246, 2026-07-27).
"""
import sys
import types

import pytest

from worlds.json_tools_installer import export_hook


@pytest.fixture(autouse=True)
def _reset_probe_cache():
    export_hook.exporter_supports_staging_dir.cache_clear()
    export_hook._legacy_exporter_warned = False
    yield
    export_hook.exporter_supports_staging_dir.cache_clear()
    export_hook._legacy_exporter_warned = False


def _install_fake_exporter(monkeypatch, export_game_rules):
    """Register a minimal fake exporter package in sys.modules."""
    exporter_mod = types.ModuleType("exporter")
    exporter_mod.export_game_rules = export_game_rules
    exporter_mod.clear_rule_cache = lambda: None
    games_mod = types.ModuleType("exporter.games")
    games_mod.clear_handler_cache = lambda: None
    pickle_mod = types.ModuleType("exporter.pickle_exporter")
    pickle_mod.export_multiworld_pickle = lambda *a, **kw: None
    exporter_mod.games = games_mod
    exporter_mod.pickle_exporter = pickle_mod
    monkeypatch.setitem(sys.modules, "exporter", exporter_mod)
    monkeypatch.setitem(sys.modules, "exporter.games", games_mod)
    monkeypatch.setitem(sys.modules, "exporter.pickle_exporter", pickle_mod)


class _Settings:
    update_frontend_presets = False
    skip_preset_copy_if_rules_identical = False
    rules_json_format = "ast"
    clear_game_presets = False
    clear_all_presets = False


class _MultiWorld:
    worlds = {}


def _run_hook(monkeypatch, export_game_rules, staging_dir: "str | None" = "/tmp/staging"):
    _install_fake_exporter(monkeypatch, export_game_rules)
    monkeypatch.setattr(
        "worlds.json_tools_installer.json_tools_settings.get_json_tools_settings",
        lambda: _Settings(),
    )
    export_hook.export_post_output_hook(
        _MultiWorld(), "/tmp/output", "AP_1", staging_dir=staging_dir
    )


def test_probe_detects_new_signature(monkeypatch):
    def new_style(multiworld, output_dir, filename_base, *a, staging_dir=None, **kw):
        pass

    _install_fake_exporter(monkeypatch, new_style)
    assert export_hook.exporter_supports_staging_dir() is True


def test_probe_detects_legacy_signature(monkeypatch):
    def legacy(multiworld, output_dir, filename_base, *a, **kw):
        pass

    _install_fake_exporter(monkeypatch, legacy)
    assert export_hook.exporter_supports_staging_dir() is False


def test_probe_none_when_exporter_missing(monkeypatch):
    monkeypatch.setitem(sys.modules, "exporter", None)
    assert export_hook.exporter_supports_staging_dir() is None


def test_new_exporter_receives_staging_dir(monkeypatch):
    calls = []

    def new_style(multiworld, output_dir, filename_base, *a, staging_dir=None, **kw):
        calls.append({"output_dir": output_dir, "staging_dir": staging_dir})

    _run_hook(monkeypatch, new_style)
    assert calls == [{"output_dir": "/tmp/output", "staging_dir": "/tmp/staging"}]


def test_legacy_exporter_called_with_old_convention(monkeypatch, caplog):
    calls = []

    def legacy(multiworld, output_dir, filename_base, *a, **kw):
        assert "staging_dir" not in kw
        calls.append(output_dir)

    with caplog.at_level("WARNING"):
        _run_hook(monkeypatch, legacy)
    # Old behavior reproduced: artifacts go to the staging dir it mirrors.
    assert calls == ["/tmp/staging"]
    assert any("legacy calling convention" in r.message for r in caplog.records)


def test_legacy_exporter_without_staging_dir_skips(monkeypatch, caplog):
    calls = []

    def legacy(multiworld, output_dir, filename_base, *a, **kw):
        calls.append(output_dir)

    with caplog.at_level("WARNING"):
        _run_hook(monkeypatch, legacy, staging_dir=None)
    # Mirroring the shared output dir into presets would sweep every seed's
    # zips along; the safe legacy fallback is to skip.
    assert calls == []
    assert any("skipping rules export" in r.message for r in caplog.records)
