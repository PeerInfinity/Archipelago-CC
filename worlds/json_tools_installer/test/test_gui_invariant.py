"""GUI component-selection invariant (import-only, no window).

Regression guard for the rule_builder checkbox/property desync: every
``comp_<name>`` BooleanProperty default must equal ``name in
DEFAULT_COMPONENTS`` — the checkbox build syncs them at runtime, but stale
property defaults briefly show (and, in past sessions, installed) the wrong
selection."""
import pytest

from worlds.json_tools_installer.installer.extractor import (
    COMPONENTS,
    DEFAULT_COMPONENTS,
)


def _installer_app():
    pytest.importorskip("kivy")
    try:
        from worlds.json_tools_installer.gui import installer_gui
    except Exception as e:  # kivy present but not importable headless
        pytest.skip(f"installer GUI not importable in this environment: {e}")
    return installer_gui.InstallerApp


def test_component_property_defaults_match_default_components():
    app_cls = _installer_app()
    checked = []
    for name in COMPONENTS:
        prop = getattr(app_cls, f"comp_{name}", None)
        if prop is None:
            # not every component has a GUI checkbox (e.g. upstream_fixes
            # is deliberately CLI-only)
            continue
        assert prop.defaultvalue == (name in DEFAULT_COMPONENTS), (
            f"comp_{name} default is {prop.defaultvalue} but "
            f"{name!r} {'IS' if name in DEFAULT_COMPONENTS else 'is NOT'} "
            f"in DEFAULT_COMPONENTS")
        checked.append(name)
    assert checked, "no comp_<name> properties found — GUI layout changed?"


def test_every_default_component_has_a_checkbox_property():
    app_cls = _installer_app()
    for name in sorted(DEFAULT_COMPONENTS):
        assert getattr(app_cls, f"comp_{name}", None) is not None, (
            f"default component {name!r} has no comp_{name} GUI property")
