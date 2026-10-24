"""The rules_json_format fallback is KEPT, and VISIBLE (the user's ruling, 2026-10-11).

When `rule_builder` or `both` is requested and the Rule Builder output cannot be
produced, `export_game_rules` still writes AST format — that behaviour is
unchanged. What these rows pin is that it is never silent:

1. the log names requested vs written format and the REAL cause (exception
   type, message, raising frame) — not an assumed "not installed";
2. every slot's `exporter["<p>"]` block of every written file carries a
   `format_fallback` record that validates against the schema;
3. the run's fallbacks drain into one `WARNING: N rules file(s) …` line, which
   the JSON Tools `Main.main` wrapper logs last.

Each forced failure runs in a SUBPROCESS: the import failures need a fresh
interpreter in which `exporter.converter` raises while `exporter.exporter`
imports it, and reloading the exporter in-process would leave every other
test's `from exporter.exporter import …` bound to the old module.
"""
import json
import os
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

try:  # absent in CI's dependency-free unittests tier (as test_schema_validation.py)
    import jsonschema
except ImportError:
    jsonschema = None

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = json.loads((ROOT / "frontend/schema/rules.schema.json").read_text(encoding="utf-8"))
RECORD_SCHEMA = SCHEMA["properties"]["exporter"]["patternProperties"]["^[0-9]+$"]["properties"]["format_fallback"]


def _check_record_against_schema(record):
    """The record against its schema declaration, without jsonschema: required
    keys, no undeclared key, strings, enums."""
    props = RECORD_SCHEMA["properties"]
    assert set(RECORD_SCHEMA["required"]) <= set(record), record
    assert RECORD_SCHEMA["additionalProperties"] is False and set(record) <= set(props), record
    for key, value in record.items():
        assert isinstance(value, str), (key, value)
        if "enum" in props[key]:
            assert value in props[key]["enum"], (key, value)

DRIVER = textwrap.dedent(r'''
    import importlib.abc, importlib.machinery, json, logging, sys
    mode, fmt, outdir = sys.argv[1:4]
    compiled = len(sys.argv) > 4 and sys.argv[4] == "compiled"

    if mode in ("AttributeError", "ImportError"):
        # exporter.converter raises while it executes: the shape of a real bug in
        # the import chain (AttributeError) or of a missing dependency (ImportError).
        class _Loader(importlib.abc.Loader):
            def create_module(self, spec):
                return None
            def exec_module(self, module):
                exec(compile(f"raise {mode}('forced by the test')", "<forced-converter>", "exec"), module.__dict__)
        class _Finder(importlib.abc.MetaPathFinder):
            def find_spec(self, name, path, target=None):
                if name == "exporter.converter":
                    return importlib.machinery.ModuleSpec(name, _Loader())
                return None
        sys.meta_path.insert(0, _Finder())

    logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(levelname)s %(message)s")

    import worlds.json_tools_installer.json_tools_settings as jts
    _real = jts.get_json_tools_settings
    class _Overrides:
        save_rules_json = True
        use_tracking_mode_config = False
        def __getattr__(self, name):
            return getattr(_real(), name)
    jts.get_json_tools_settings = lambda: _Overrides()

    # The multiworld exists BEFORE the exporter is first imported, and the import
    # happens inside a function whose frame holds it — as in the JSON Tools hook.
    # Generate.py asserts the MultiWorld is freed after a run; a kept import
    # exception (its frames' f_back chain) would keep it alive.
    from worlds import AutoWorldRegister
    from test.general import setup_multiworld
    from Fill import distribute_items_restrictive
    assert "exporter.exporter" not in sys.modules, "the exporter was imported before the multiworld existed"
    world = AutoWorldRegister.world_types["APQuest"]
    multiworld = setup_multiworld([world, world], seed=1)
    distribute_items_restrictive(multiworld)  # every location gets an item, as in a real run

    def export(multiworld):
        import exporter.exporter as ex
        if compiled:
            # A compiled (frozen) install, without freezing the interpreter itself.
            from exporter import format_fallback as ff
            ff.is_compiled_install = lambda: True
        if mode == "convert":
            def _broken_convert(data):
                raise ValueError("conversion forced to fail by the test")
            ex.convert_rules_file_to_rule_builder = _broken_convert
        kwargs = {"rules_json_format": fmt}
        if mode == "hook":
            # The JSON Tools hook fell back before calling (its own rule_builder probe).
            kwargs = {"rules_json_format": "ast", "format_fallback_from": {
                "requested": fmt, "reason": "hook probe forced to fail by the test"}}
        try:
            return ex.export_game_rules(multiworld, outdir, "T", save_presets=False, **kwargs)
        finally:
            # As the JSON Tools hook does after every export.
            from exporter.games import clear_handler_cache
            ex.clear_rule_cache()
            clear_handler_cache()

    results = export(multiworld)
    import gc, weakref
    weak = weakref.ref(multiworld)
    del multiworld
    gc.collect()
    from exporter import format_fallback
    entries = format_fallback.drain()
    print("RESULT " + json.dumps({"results": results, "entries": entries, "leaked": weak() is not None,
                                  "summary": format_fallback.summary_line(entries)}))
''')


def _run(tmp_path, mode, fmt, compiled=False):
    driver = tmp_path / "driver.py"
    driver.write_text(DRIVER, encoding="utf-8")
    out = tmp_path / "out"
    proc = subprocess.run(
        [sys.executable, str(driver), mode, fmt, str(out)] + (["compiled"] if compiled else []),
        cwd=ROOT, capture_output=True, text=True, timeout=600,
        env={**os.environ, "PYTHONPATH": str(ROOT)},
    )
    assert proc.returncode == 0, proc.stderr[-4000:]
    line = [l for l in proc.stdout.splitlines() if l.startswith("RESULT ")][-1]
    return json.loads(line[len("RESULT "):]), proc.stderr, out


CASES = [
    # (mode, requested format, expected cause fragment, rule_builder_output)
    ("AttributeError", "rule_builder",
     "failed to import: AttributeError: forced by the test (at <forced-converter>:1)", "not written"),
    ("AttributeError", "both",
     "failed to import: AttributeError: forced by the test (at <forced-converter>:1)", "not written"),
    ("ImportError", "rule_builder",
     "failed to import: ImportError: forced by the test (at <forced-converter>:1)", "not written"),
    ("ImportError", "both",
     "failed to import: ImportError: forced by the test (at <forced-converter>:1)", "not written"),
    ("convert", "rule_builder",
     "converting to Rule Builder format raised ValueError: conversion forced to fail by the test (at ", "not written"),
    ("convert", "both",
     "converting to Rule Builder format raised ValueError: conversion forced to fail by the test (at ", "dropped"),
    ("hook", "rule_builder", "hook probe forced to fail by the test", "not written"),
]


@pytest.mark.parametrize("mode,fmt,cause,rb_output", CASES, ids=[f"{c[0]}-{c[1]}" for c in CASES])
def test_a_fallback_is_logged_recorded_and_summarised(tmp_path, mode, fmt, cause, rb_output):
    payload, stderr, _ = _run(tmp_path, mode, fmt)
    assert payload["leaked"] is False, "the MultiWorld outlived the export (Generate.py's leak assert)"

    # 1. The log: ERROR, requested vs written, the real cause.
    errors = [l for l in stderr.splitlines() if l.startswith("ERROR rules_json_format fallback:")]
    assert len(errors) == 1, stderr[-4000:]
    assert f"requested '{fmt}', writing 'ast'" in errors[0]
    assert cause in errors[0]
    assert "not installed" not in stderr
    if mode in ("AttributeError", "ImportError"):
        assert "exporter.converter import failed — full traceback:" in stderr

    # 2. The record, in every slot of every written file; the files validate.
    written = {k: v for k, v in payload["results"].items()}
    assert "rules_combined" in written and "rules_p1" in written and "rules_p2" in written
    if mode == "convert" and fmt == "both":
        assert "rules_combined_ast" in written  # the AST half is still written
    else:
        assert "rules_combined_ast" not in written  # behaviour unchanged: no _rules-ast.json
    for key, path in written.items():
        doc = json.loads(Path(path).read_text(encoding="utf-8"))
        if jsonschema is not None:
            jsonschema.validate(doc, SCHEMA)
        slots = ["1", "2"] if key.endswith("combined") or key.endswith("combined_ast") else [key[len("rules_p"):].split("_")[0]]
        for slot in slots:
            record = doc["exporter"][slot]["format_fallback"]
            _check_record_against_schema(record)
            assert record["requested"] == fmt
            assert record["written"] == "ast"
            assert cause in record["reason"]
            assert record["rule_builder_output"] == rb_output
        assert "format_fallback" not in doc  # per-player only, never top level

    # 3. The summary: the AST-instead files, never the _rules-ast.json.
    expected_paths = [written["rules_combined"], written["rules_p1"], written["rules_p2"]]
    assert payload["summary"] == (
        f"WARNING: 3 rules file(s) written in ast instead of {fmt}: {', '.join(expected_paths)}")


@pytest.mark.parametrize("mode", ["AttributeError", "ImportError", "hook", "convert"])
def test_on_a_compiled_install_an_import_fallback_is_a_warning(tmp_path, mode):
    """The user's ruling (2026-10-12): on a compiled install the extended Rule
    Builder cannot load, so an IMPORT-time fallback is expected and logs at
    WARNING (its traceback at DEBUG). A conversion error is never expected: ERROR.
    The record and the summary are unchanged."""
    payload, stderr, _ = _run(tmp_path, mode, "rule_builder", compiled=True)
    lines = stderr.splitlines()
    warnings = [l for l in lines if l.startswith("WARNING rules_json_format fallback:")]
    errors = [l for l in lines if l.startswith("ERROR rules_json_format fallback:")]
    if mode == "convert":
        assert len(errors) == 1 and not warnings, stderr[-4000:]
    else:
        assert len(warnings) == 1 and not errors, stderr[-4000:]
        assert "requested 'rule_builder', writing 'ast'" in warnings[0]
        assert not [l for l in lines if l.startswith("ERROR ")], stderr[-4000:]
    assert payload["entries"] and payload["summary"].startswith("WARNING: 3 rules file(s) written in ast")


def test_a_normal_export_has_no_record_and_no_summary(tmp_path):
    payload, stderr, _ = _run(tmp_path, "none", "rule_builder")
    assert payload["leaked"] is False
    assert "rules_json_format fallback" not in stderr
    assert payload["entries"] == [] and payload["summary"] is None
    for path in payload["results"].values():
        doc = json.loads(Path(path).read_text(encoding="utf-8"))
        assert all("format_fallback" not in block for block in doc.get("exporter", {}).values())


def test_the_main_wrapper_logs_the_summary_last(monkeypatch, caplog):
    """hooks.py's Main.main wrapper drains the run's fallbacks after the export
    (and after its spoiler-disabled fallback export), as the last thing it logs."""
    import Main
    from exporter import format_fallback  # pyright: ignore[reportAttributeAccessIssue]
    from worlds.json_tools_installer.monkey_patches import hooks

    order = []

    def fake_main(*_args, **_kwargs):
        order.append("main")
        format_fallback.note(format_fallback.make_record("rule_builder", "ast", "cause"), ["/o/T_rules.json"])
        return None

    monkeypatch.setattr(Main, "main", fake_main)
    monkeypatch.setattr(hooks, "_installed_hooks", {})
    monkeypatch.setattr(hooks, "_original_functions", {})
    monkeypatch.setattr(hooks, "_patch_fill_slot_data_subclasses", lambda: 0)
    import BaseClasses
    monkeypatch.setattr(BaseClasses.Spoiler, "to_file", BaseClasses.Spoiler.to_file)
    assert hooks._install_export_hook()
    with caplog.at_level("WARNING"):
        Main.main(None, None)
    assert caplog.records[-1].getMessage() == \
        "WARNING: 1 rules file(s) written in ast instead of rule_builder: /o/T_rules.json"
    assert format_fallback.drain() == []
