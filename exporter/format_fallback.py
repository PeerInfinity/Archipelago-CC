# exporter/format_fallback.py

"""The rules_json_format fallback, made visible.

When a run asks for the Rule Builder format ("rule_builder" or "both") and the
exporter cannot produce it, the exporter still writes AST format (the user's
ruling, 2026-10-11: keep the fallback). This module makes that visible in three
places:

1. the log: one line per fallback naming requested vs written format and
   the real cause (the exception type, message and raising frame). ERROR, except
   an import-time fallback on a compiled (frozen) install, where the extended
   Rule Builder cannot load and the fallback is expected: WARNING (the user's
   ruling, 2026-10-12);
2. the output file: a ``format_fallback`` record in every slot's
   ``exporter["<player>"]`` block (declared in frontend/schema/rules.schema.json);
   absent on a normal export, so normal output is byte-identical;
3. the end of the run: :func:`summary_line`, printed by the JSON Tools
   ``Main.main`` wrapper (worlds/json_tools_installer/monkey_patches/hooks.py)
   after all other output.
"""

import logging
import os
import traceback
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

RECORD_KEY = "format_fallback"

# Fallbacks recorded since the last drain(): one entry per export_game_rules
# call that fell back. The Main.main wrapper drains it at the end of a run.
_fallbacks: List[Dict[str, Any]] = []

# The full traceback of an import failure is logged once per process (at
# ERROR, so it is seen at the default log level; at DEBUG when the fallback is
# expected); every later fallback for the same cause logs only its one-line cause.
_traceback_logged: set = set()


def describe_exception(exc: BaseException) -> str:
    """``Type: message (at file:line)``, the raising frame being the deepest one."""
    text = f"{type(exc).__name__}: {exc}"
    tb = traceback.extract_tb(exc.__traceback__) if exc.__traceback__ else []
    if tb:
        frame = tb[-1]
        filename = frame.filename
        try:
            relative = os.path.relpath(filename)
            if not relative.startswith(os.pardir):  # repo-relative when inside the cwd
                filename = relative
        except ValueError:  # another drive on Windows
            pass
        text += f" (at {filename}:{frame.lineno})"
    return text


def format_traceback(exc: BaseException) -> str:
    return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)).rstrip()


def is_compiled_install() -> bool:
    """A compiled (frozen) Archipelago, where the extended Rule Builder cannot
    load, so an import-time fallback is expected on every run."""
    try:
        from Utils import is_frozen
        return bool(is_frozen())
    except Exception:
        return False


def log_traceback_once(what: str, traceback_text: str, expected: bool = False) -> None:
    if what in _traceback_logged:
        return
    _traceback_logged.add(what)
    logger.log(logging.DEBUG if expected else logging.ERROR,
               "%s — full traceback:\n%s", what, traceback_text)


def make_record(requested: str, written: str, reason: str,
                rule_builder_output: str = "not written") -> Dict[str, str]:
    return {
        "requested": requested,
        "written": written,
        "reason": reason,
        "rule_builder_output": rule_builder_output,
    }


def log_fallback(record: Dict[str, str], expected: bool = False) -> None:
    """ERROR, or WARNING when ``expected`` (an import-time fallback on a compiled install)."""
    logger.log(
        logging.WARNING if expected else logging.ERROR,
        "rules_json_format fallback: requested '%s', writing '%s' (Rule Builder output %s). Cause: %s",
        record["requested"], record["written"], record["rule_builder_output"], record["reason"],
    )


def stamp(data: Dict[str, Any], record: Dict[str, str], player_ids) -> None:
    """Put ``record`` into every slot's ``exporter["<player>"]`` block (created if absent)."""
    exporter_block = data.setdefault("exporter", {})
    for player in player_ids:
        slot = exporter_block.setdefault(str(player), {})
        slot[RECORD_KEY] = dict(record)


def note(record: Dict[str, str], paths: List[str]) -> None:
    _fallbacks.append({**record, "paths": list(paths)})


def drain() -> List[Dict[str, Any]]:
    entries = list(_fallbacks)
    _fallbacks.clear()
    return entries


def summary_line(entries: List[Dict[str, Any]]) -> Optional[str]:
    """The end-of-run line, or None when nothing fell back."""
    if not entries:
        return None
    paths = [p for e in entries for p in e["paths"]]
    written = sorted({e["written"] for e in entries})
    requested = sorted({e["requested"] for e in entries})
    return (f"WARNING: {len(paths)} rules file(s) written in {'/'.join(written)} "
            f"instead of {'/'.join(requested)}: {', '.join(paths)}")
