"""exporter.script_api — Python source <-> the rules.json ``helpers`` format.

The frontend runs this module under Pyodide, where nothing but the standard
library exists and only the files ``helperScriptFiles.json`` (plus
``worldGeneratorFiles.json``) list are served, so the isolation test here is
what catches a change that would only fail in the browser.
"""

import json
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

from exporter.script_api import helpers_to_python, python_to_helpers

ROOT = Path(__file__).resolve().parent.parent

SCRIPT = '''
def has_light(state, player):
    return state.has("Lantern", player) or state.has("Torch", player)

def can_enter_cave(state, player, keys=2):
    return has_light(state, player) and state.has("Cave Key", player, keys)

def not_a_helper(x):
    return x
'''


def _alttp_worldgen_rules() -> dict:
    found = sorted((ROOT / "frontend" / "presets" / "alttp_worldgen").glob("AP_*/AP_*_rules.json"))
    if not found:
        pytest.skip("no alttp_worldgen preset")
    return json.loads(found[0].read_text(encoding="utf-8"))


def test_functions_become_helpers_and_calls_stay_references():
    result = python_to_helpers(SCRIPT)
    assert result["errors"] == []
    helpers = result["helpers"]
    assert list(helpers) == ["has_light", "can_enter_cave"]  # source order
    assert helpers["has_light"] == {"type": "or", "conditions": [
        {"type": "item_check", "item": "Lantern"},
        {"type": "item_check", "item": "Torch"},
    ]}
    cave = helpers["can_enter_cave"]
    assert cave["params"] == ["keys"] and cave["defaults"] == {"keys": 2}
    assert cave["body"]["conditions"][0] == {"type": "helper", "name": "has_light"}


def test_a_function_without_state_player_is_skipped_by_name():
    warnings = python_to_helpers(SCRIPT)["warnings"]
    assert any(w.startswith("not_a_helper: skipped") for w in warnings)


def test_a_syntax_error_is_an_error_not_an_exception():
    result = python_to_helpers("def broken(state, player)\n    return True\n")
    assert result["helpers"] == {} and result["errors"][0].startswith("line 1:")


def test_a_failing_script_is_an_error_not_an_exception():
    result = python_to_helpers("raise ValueError('nope')\ndef h(state, player):\n    return True\n")
    assert result["helpers"] == {}
    assert "ValueError: nope" in result["errors"][0]


def test_an_edited_script_is_not_answered_from_the_last_one():
    first = python_to_helpers("def h(state, player):\n    return state.has('A', player)\n")
    second = python_to_helpers("def h(state, player):\n    return state.has('B', player)\n")
    assert first["helpers"]["h"]["item"] == "A"
    assert second["helpers"]["h"]["item"] == "B"


def test_hand_written_script_round_trips():
    helpers = python_to_helpers(SCRIPT)["helpers"]
    back = helpers_to_python(helpers)
    assert back["errors"] == []
    assert python_to_helpers(back["code"])["helpers"] == helpers


def test_alttp_worldgen_helpers_round_trip_exactly():
    """Every helper the committed preset exports survives JSON -> Python -> JSON
    unchanged (36/36 on 2026-10-20). Options need the document's option
    definitions; without them they read back as world attributes."""
    rules = _alttp_worldgen_rules()
    helpers = rules["helpers"]["1"]
    code = helpers_to_python(helpers, rules=rules)
    assert code["errors"] == []
    back = python_to_helpers(code["code"])
    assert back["errors"] == []
    assert back["helpers"] == helpers


def _manifest_files(manifest: str) -> tuple[str, list[str]]:
    data = json.loads((ROOT / manifest).read_text(encoding="utf-8"))
    return data["package"], data["files"]


def test_round_trip_with_only_the_served_files_and_the_standard_library(tmp_path):
    """Exactly the files the page serves, in an interpreter with no site
    packages at all (-I -S: not even the venv's, so no astunparse) — the same
    situation as Pyodide."""
    for manifest in ("frontend/modules/helperScript/helperScriptFiles.json",
                     "frontend/modules/apworldBuild/worldGeneratorFiles.json"):
        package, files = _manifest_files(manifest)
        for rel in files:
            target = tmp_path / package / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / package / rel, target)
    rules = _alttp_worldgen_rules()
    (tmp_path / "rules.json").write_text(json.dumps(rules), encoding="utf-8")
    script = textwrap.dedent(f"""
        import json, sys
        sys.path.insert(0, {str(tmp_path)!r})
        from exporter.script_api import helpers_to_python, python_to_helpers
        rules = json.load(open({str(tmp_path / "rules.json")!r}))
        helpers = rules["helpers"]["1"]
        back = python_to_helpers(helpers_to_python(helpers, rules=rules)["code"])
        assert back["errors"] == [], back["errors"]
        assert back["helpers"] == helpers
        leaked = sorted(m for m in sys.modules
                        if m.split(".")[0] in ("BaseClasses", "worlds", "Utils", "Options", "astunparse")
                        or m == "exporter.exporter")
        assert not leaked, leaked
        print("ok", len(helpers))
    """)
    result = subprocess.run([sys.executable, "-I", "-S", "-c", script],
                            capture_output=True, text=True, cwd=tmp_path, timeout=300)
    assert result.returncode == 0, result.stderr[-3000:]
    assert result.stdout.strip().startswith("ok ")
