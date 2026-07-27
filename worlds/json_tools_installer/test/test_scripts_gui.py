"""Scripts menu commands per install type (import-only, no window).

Regression guard for "ArchipelagoLauncher.exe: error: unrecognized arguments:
-m": the menu used to be a module-level constant whose every command was
[sys.executable, "-m", ...], and on a compiled build sys.executable is the
launcher, which rejects those arguments outright. The table is now built per
call so the frozen variants can run in-process or remap.
"""
import sys

import pytest


def _scripts_gui():
    pytest.importorskip("kivy")
    try:
        from worlds.json_tools_installer.gui import scripts_gui
    except Exception as e:  # kivy present but not importable headless
        pytest.skip(f"scripts GUI not importable in this environment: {e}")
    return scripts_gui


@pytest.fixture
def sg(monkeypatch):
    return _scripts_gui()


@pytest.fixture
def frozen_sg(sg, monkeypatch):
    """The scripts GUI believing it runs on a compiled Archipelago."""
    monkeypatch.setattr(sg, "is_frozen", lambda: True)
    return sg


def _all_actions(categories):
    for category, actions in categories.items():
        for action in actions:
            yield category, action


def test_table_is_built_per_call(sg):
    """A module-level constant would freeze sys.executable-based commands at
    import time, before anything can know what it is running on."""
    assert not hasattr(sg, "SCRIPT_CATEGORIES")
    assert callable(sg.build_script_categories)


def test_source_install_commands_are_unchanged(sg, monkeypatch):
    monkeypatch.setattr(sg, "is_frozen", lambda: False)
    categories = sg.build_script_categories()

    assert categories["Dev Server"][0].command == [
        sys.executable, "-m", "http.server", "8000"]
    for category, action in _all_actions(categories):
        assert action.unsupported is None, (category, action.name)
        assert action.handler is None, (category, action.name)


def test_frozen_commands_never_pass_python_arguments(frozen_sg):
    """The launcher exe takes a component name, not -m/-c/script.py."""
    categories = frozen_sg.build_script_categories()
    for category, action in _all_actions(categories):
        if action.unsupported or not action.command:
            continue
        if action.command[0] != sys.executable:
            continue  # sibling executable or npm — not the launcher
        for arg in action.command[1:]:
            assert arg not in ("-m", "-c"), (category, action.name)
            assert not arg.endswith(".py"), (category, action.name)


def test_frozen_dev_server_runs_in_process(frozen_sg):
    dev_server = frozen_sg.build_script_categories()["Dev Server"]
    start, stop = dev_server[0], dev_server[1]

    assert start.command is None and start.handler is not None
    assert stop.command is None and stop.handler is not None
    assert start.unsupported is None and stop.unsupported is None


def test_in_process_dev_server_starts_and_stops(sg, monkeypatch):
    # port 0: never collide with a dev server the developer already runs
    monkeypatch.setattr(sg, "DEV_SERVER_PORT", 0)
    assert sg._dev_server is None

    try:
        message = sg._start_dev_server()
        assert "Dev server running" in message, message
        assert sg._dev_server is not None
        assert sg._dev_server_thread is not None and sg._dev_server_thread.is_alive()
        assert "already running" in sg._start_dev_server()
    finally:
        stopped = sg._stop_dev_server()

    assert stopped == "Dev server stopped."
    assert sg._dev_server is None
    assert sg._stop_dev_server() == "No dev server was started from this window."


def test_frozen_unsupported_actions_say_why(frozen_sg):
    categories = frozen_sg.build_script_categories()
    unsupported = [a for _, a in _all_actions(categories) if a.unsupported]

    assert unsupported, "nothing marked unsupported — frozen remap went missing?"
    for action in unsupported:
        assert action.unsupported.strip(), action.name


def test_frozen_host_configuration_uses_the_launcher_itself(frozen_sg):
    setup = {a.name: a for a in frozen_sg.build_script_categories()["Setup"]}
    assert setup["Set Up Host Configuration"].command == [
        sys.executable, "--update_settings"]


def test_frozen_generation_remaps_to_sibling_executable(frozen_sg, tmp_path, monkeypatch):
    exe = tmp_path / "ArchipelagoGenerate"
    exe.write_text("")
    monkeypatch.setattr(sys, "executable", str(tmp_path / "ArchipelagoLauncher"))

    action = frozen_sg.build_script_categories()["Quick Actions"][0]
    assert action.unsupported is None
    assert action.command[0] == str(exe)
    assert "Generate.py" not in action.command


def test_frozen_generation_disabled_without_sibling_executable(frozen_sg, tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "executable", str(tmp_path / "ArchipelagoLauncher"))

    action = frozen_sg.build_script_categories()["Quick Actions"][0]
    assert action.unsupported is not None


def test_dev_server_serves_js_with_module_safe_mime(sg):
    # Windows registry often maps .js to text/plain; browsers refuse ES
    # modules with a non-JavaScript MIME type, which broke the served
    # frontend ("Failed to fetch dynamically imported module: .../init.js").
    handler = sg.DevServerHandler.__new__(sg.DevServerHandler)
    assert handler.guess_type("frontend/init.js") == "text/javascript"
    assert handler.guess_type("frontend/x.mjs") == "text/javascript"
    assert handler.guess_type("frontend/settings/settings.json") == "application/json"
    assert handler.guess_type("presets/log.jsonl") == "application/json"


def test_dev_server_end_to_end_mime_and_no_cache(sg, monkeypatch, tmp_path):
    import urllib.request

    (tmp_path / "probe.js").write_text("export const x = 1;\n")
    monkeypatch.setattr(sg, "DEV_SERVER_PORT", 0)
    monkeypatch.setattr(sg, "local_path", lambda *a: str(tmp_path))

    try:
        message = sg._start_dev_server()
        assert "/frontend/" in message  # start message names the app URL
        port = sg._dev_server.server_address[1]
        with urllib.request.urlopen(
            f"http://127.0.0.1:{port}/probe.js"
        ) as response:
            assert response.headers["Content-Type"].startswith("text/javascript")
            assert response.headers["Cache-Control"] == "no-cache"
            assert response.read() == b"export const x = 1;\n"
    finally:
        sg._stop_dev_server()
