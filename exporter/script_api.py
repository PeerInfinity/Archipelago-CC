"""Python source <-> the rules.json ``helpers`` format, for scripts written by hand.

Both directions reuse the production code paths rather than re-implementing them:

- ``python_to_helpers`` runs the exporter's analyzer exactly as an export does for
  a worldgen world's Rules.py (``HelperDiscoveryMixin._analyze_worldgen_helpers``).
- ``helpers_to_python`` runs world_generator's helper codegen exactly as
  ``generate_rules_py`` does (``make_helper_generator`` / ``generate_helper_functions``
  / ``render_helpers_section``).

The frontend runs this module under Pyodide, which has only the standard library and
only the files ``frontend/modules/helperScript/helperScriptFiles.json`` lists — so
nothing here may import Archipelago (``BaseClasses``, ``worlds``, ``Utils``) or
``exporter.exporter``. ``test/test_exporter_script_api.py`` holds that line.

A helper is a top-level function whose first two parameters are ``state, player``;
further parameters (and their defaults) become the helper's ``params``/``defaults``.
Calls between the script's own functions stay ``{"type": "helper"}`` references.

⚠ ``python_to_helpers`` IMPORTS the source (the analyzer reads functions through
``inspect``), so its top-level statements run. In the browser that is the user's own
code in their own tab; anywhere else, treat the source as code you are executing.
"""

import ast
import importlib
import itertools
import logging
import os
import sys
import tempfile
from typing import Any, Dict, List, Optional

_module_counter = itertools.count()


class _CollectWarnings(logging.Handler):
    """Collects WARNING+ records the analyzer emits while one conversion runs."""

    def __init__(self) -> None:
        super().__init__(logging.WARNING)
        self.messages: List[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.messages.append(record.getMessage())


def _helper_function_names(tree: ast.Module, warnings: List[str]) -> List[str]:
    names = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        params = [a.arg for a in node.args.posonlyargs + node.args.args]
        if params[:2] == ['state', 'player']:
            names.append(node.name)
        else:
            warnings.append(f"{node.name}: skipped — a helper's first two parameters are (state, player)")
    return names


def _error_nodes(rule: Any, path: str = '') -> List[str]:
    """Paths of the analyzer's ``{"type": "error"}`` nodes inside a converted body."""
    found = []
    if isinstance(rule, dict):
        if rule.get('type') == 'error':
            found.append(f"{path or '<body>'}: {rule.get('message', 'error')}")
        for key, value in rule.items():
            found.extend(_error_nodes(value, f"{path}.{key}" if path else key))
    elif isinstance(rule, list):
        for i, value in enumerate(rule):
            found.extend(_error_nodes(value, f"{path}[{i}]"))
    return found


def python_to_helpers(source: str) -> Dict[str, Any]:
    """Convert Python source to a ``helpers`` dict (the per-player value of rules.json's
    ``helpers`` block).

    Returns ``{"helpers": {...}, "warnings": [...], "errors": [...]}``. A function the
    analyzer cannot convert is left out of ``helpers`` and named in ``errors``.
    """
    from exporter.analyzer import clear_caches
    from exporter.games.base import GenericGameExportHandler

    warnings: List[str] = []
    errors: List[str] = []
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        return {'helpers': {}, 'warnings': [], 'errors': [f"line {e.lineno}: {e.msg}"]}

    names = _helper_function_names(tree, warnings)
    if not names:
        warnings.append("no helper functions found (a helper is `def name(state, player, ...)`)")
        return {'helpers': {}, 'warnings': warnings, 'errors': errors}

    # A unique module per call: the analyzer caches file contents and ASTs by
    # filename, and an edited script must not be answered from the last one.
    module_name = f"_helper_script_{os.getpid()}_{next(_module_counter)}"
    collector = _CollectWarnings()
    root = logging.getLogger()
    with tempfile.TemporaryDirectory() as tmp:
        with open(os.path.join(tmp, f"{module_name}.py"), 'w', encoding='utf-8') as f:
            f.write(source)
        sys.path.insert(0, tmp)
        root.addHandler(collector)
        try:
            try:
                module = importlib.import_module(module_name)
            except Exception as e:
                return {'helpers': {}, 'warnings': warnings,
                        'errors': [f"running the script failed: {type(e).__name__}: {e}"]}
            handler_cls = type('_ScriptHandler', (GenericGameExportHandler,),
                               {'HELPERS_TO_PRESERVE': frozenset(names)})
            helpers = handler_cls()._analyze_worldgen_helpers(module, None)
        finally:
            root.removeHandler(collector)
            sys.path.remove(tmp)
            sys.modules.pop(module_name, None)
            clear_caches()

    for name in names:
        if name not in helpers:
            errors.append(f"{name}: could not be converted")
    for name, definition in helpers.items():
        body = definition.get('body', definition) if isinstance(definition, dict) else definition
        warnings.extend(f"{name}: {where}" for where in _error_nodes(body))
    if errors:
        warnings.extend(collector.messages)

    # Source order, not dir() order: the order a person wrote is the order they read.
    ordered = {name: helpers[name] for name in names if name in helpers}
    return {'helpers': ordered, 'warnings': warnings, 'errors': errors}


def helpers_to_python(helpers: Dict[str, Any], *, rules: Optional[Dict[str, Any]] = None,
                      player_id: str = '1') -> Dict[str, Any]:
    """Convert a ``helpers`` dict to Python source.

    ``rules`` is an optional rules.json document supplying the game's option
    definitions; without them an option comes back as a world attribute.

    Returns ``{"code": "...", "warnings": [...], "errors": [...]}``.
    """
    from world_generator.extractors import extract_game_metadata, extract_helpers
    from world_generator._template_rules import (
        generate_helper_functions, make_helper_generator, render_helpers_section,
    )

    warnings: List[str] = []
    doc = dict(rules or {})
    doc['helpers'] = {player_id: helpers}
    extracted = extract_helpers(doc, player_id)
    for name in helpers:
        if name not in extracted:
            warnings.append(f"{name}: skipped — a helper definition is a rule object")
    metadata = extract_game_metadata(doc, player_id)
    try:
        generator = make_helper_generator(metadata.game_name, metadata, extracted)
        section = render_helpers_section(generator, generate_helper_functions(generator, extracted))
    except Exception as e:
        return {'code': '', 'warnings': warnings, 'errors': [f"{type(e).__name__}: {e}"]}

    imports = ''.join(line for flag, line in (
        (generator.uses_math, 'import math\n'),
        (generator.uses_logging, 'import logging\n'),
    ) if flag)
    return {'code': imports + section.lstrip('\n'), 'warnings': warnings, 'errors': []}
