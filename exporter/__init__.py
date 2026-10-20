"""Handles parsing and exporting of game rules to frontend-compatible format."""

import importlib
import logging

logger = logging.getLogger(__name__)

# The public names resolve LAZILY (PEP 562): importing a subpackage such as
# `exporter.analyzer` must not drag in `exporter.exporter`, which imports all of
# Archipelago. That keeps the analyzer loadable on its own — under Pyodide the
# page serves only the files `exporter.script_api` needs (helperScriptFiles.json).
# `from exporter import export_game_rules` works exactly as before; a failure to
# import the defining module still surfaces as that ImportError.
#
# Note: get_game_export_handler and clear_handler_cache are intentionally NOT
# exported here to avoid triggering world loading on package import.
# Import them directly from exporter.games if needed:
#   from exporter.games import get_game_export_handler, clear_handler_cache
_LAZY_EXPORTS = {
    'export_game_rules': '.exporter',
    'clear_rule_cache': '.exporter',
    'analyze_rule': '.analyzer',
    # Pickle exporter
    'export_multiworld_pickle': '.pickle_exporter',
    'load_multiworld_pickle': '.pickle_exporter',
    'load_pickle_metadata': '.pickle_exporter',
    'find_pickle_for_seed': '.pickle_exporter',
    'PICKLE_EXTENSION': '.pickle_exporter',
    'METADATA_EXTENSION': '.pickle_exporter',
}

__all__ = [
    'export_game_rules',
    'analyze_rule',
    'clear_rule_cache',
    # Pickle exporter
    'export_multiworld_pickle',
    'load_multiworld_pickle',
    'load_pickle_metadata',
    'find_pickle_for_seed',
    'PICKLE_EXTENSION',
    'METADATA_EXTENSION',
]


def __getattr__(name):
    module_name = _LAZY_EXPORTS.get(name)
    if module_name is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    value = getattr(importlib.import_module(module_name, __name__), name)
    globals()[name] = value
    return value


def __dir__():
    return sorted(set(globals()) | set(__all__))
