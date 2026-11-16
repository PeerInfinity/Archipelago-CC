"""What the Upstream Rules Add-on does at generation time: export, strip, gate, inject.

Called from the ``AutoWorld.call_all`` wrap in ``__init__.py``:

- ``export_room`` after the real ``pre_output`` (the room is filled; main thread, before the output pool): one
  export of every slot, the strips, the quality gate and the cap, one result per wanted slot.
- ``inject`` after the real ``modify_multidata`` (inside ``Main.write_multidata``, before
  ``convert_to_base_types`` and the pickle): each result goes into ``multidata["slot_data"][slot]`` as
  ``worldgen_rules`` (the envelope the web client reads) or ``worldgen_rules_omitted`` (the reason).

Nothing here may fail generation: every error becomes ``worldgen_rules_omitted`` with a reason.
"""
import importlib
import json
import logging
import os
import re
import sys
import tempfile
import time
from typing import Any, Dict, Iterable, Optional, Tuple

from ._unused_fields import DEFAULT_LEVEL, LEVELS, strip_unused

logger = logging.getLogger("UpstreamRulesAddon")

#: = WORLDGEN_RULES_FORMAT (world_generator/_embedded_rules.py; the client's localRulesOverlay.js).
FORMAT = 1
SLOT_DATA_KEY = "worldgen_rules"
OMITTED_KEY = "worldgen_rules_omitted"
#: Who sent the document; the client may name it (U3). The client ignores keys it does not read.
SOURCE = "upstream_rules_addon"

_FAILED = re.compile(r"^Failed to analyze or expand rule for (Location|Exit|Entrance) '(.+?)' using")


# ------------------------------------------------------------------------------------------- the exporter
def load_exporter(package: str) -> Tuple[Any, Any, str]:
    """(exporter.exporter module, strip_placements, the exporter package's name).

    The built apworld carries its own copy under ``<package>._vendor`` (scripts/build/pack_upstream_rules_addon.py
    writes it, with its imports rewritten to live there). The source folder has none; it then uses the generator
    tree's own ``exporter`` (the fork), which is how the fork's tests drive it.
    """
    vendor = f"{package}._vendor"
    try:
        importlib.import_module(vendor)
    except ModuleNotFoundError as error:
        if error.name != vendor:
            raise
        ex = importlib.import_module("exporter.exporter")
        strip = importlib.import_module("world_generator._embedded_rules").strip_placements
        return ex, strip, "exporter"
    ex = importlib.import_module(f"{vendor}.exporter.exporter")
    strip = importlib.import_module(f"{vendor}._embedded_rules").strip_placements
    return ex, strip, f"{vendor}.exporter"


def _clear_exporter_caches(root: str) -> None:
    """The exporter's caches hold the MultiWorld; upstream Generate.py asserts (in __debug__) that it is freed."""
    for module_name, function_name in ((f"{root}.exporter", "clear_rule_cache"),
                                       (f"{root}.games", "clear_handler_cache"),
                                       (f"{root}.analyzer.cache", "clear_caches")):
        module = sys.modules.get(module_name)
        if module is not None and hasattr(module, function_name):
            try:
                getattr(module, function_name)()
            except Exception:
                logger.debug("clearing %s.%s failed", module_name, function_name, exc_info=True)


# ------------------------------------------------------------------------------------------------ strips
def strip_room(doc: Dict[str, Any]) -> Dict[str, Any]:
    """What a room's document carries beyond the embed recipe that the add-on drops: ``itempool_counts``.

    The pool changes by seed (Starcraft 2's differs between two seeds), so it says which items this seed holds;
    its only reader is the in-app test inventory. (Foreign items in ``items[p]`` and other slots' ``helpers`` were
    the prototype's other room strips; the exporter no longer writes them, sdc-addon-u1-exporter-fixes.)
    """
    doc.pop("itempool_counts", None)
    return doc


def ids_the_server_knows(doc: Dict[str, Any]) -> Dict[str, Any]:
    """An item ``id`` that is not an integer becomes ``None``, as an event's is.

    AP item IDs are integers. A Link to the Past's prizes (Crystal 1–7, the three Pendants) are events placed on
    ID-less prize locations, but the exporter writes their ``ItemData`` code, a tuple of ROM bytes, as ``id``. The
    client's ID check compares every non-null ``id`` with the room's DataPackage and refused the whole document:
    "10 item ID(s) differ from the server's: Crystal 1, …" (measured live, ALttP at slot 2, this slice). The client's
    procgen code already reads an array ``id`` as no ID (procgenPipelineEngine.js).
    """
    for items in (doc.get("items") or {}).values():
        for item in (items.values() if isinstance(items, dict) else ()):
            if isinstance(item, dict) and item.get("id") is not None and (
                    isinstance(item["id"], bool) or not isinstance(item["id"], int)):
                item["id"] = None
    return doc


def strip(doc: Dict[str, Any], strip_placements, level: str = DEFAULT_LEVEL) -> Dict[str, Any]:
    """Every change the add-on makes, in order: placements (the embed recipe's), the room's strip, item IDs the
    server knows, the unused fields at ``level`` (``_unused_fields.LEVELS``)."""
    return strip_unused(ids_the_server_knows(strip_room(strip_placements(doc))), level)


def envelope_bytes(envelope: Dict[str, Any]) -> int:
    return len(json.dumps(envelope, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


# ----------------------------------------------------------------------------------------- quality gate
class DegradedRuleCounter(logging.Handler):
    """Counts the exporter's "Failed to analyze or expand rule for <kind> '<name>'" warnings per slot.

    Such a rule is written degraded, so the document would describe different logic; that slot is omitted
    instead. A name shared by several slots counts for each of them; a warning naming nothing known counts for
    every slot.
    """

    def __init__(self, owners: Dict[str, set]):
        super().__init__(logging.WARNING)
        self.owners = owners
        self.per_slot: Dict[int, int] = {}
        self.unattributed = 0

    def emit(self, record: logging.LogRecord) -> None:
        try:
            match = _FAILED.match(record.getMessage())
        except Exception:
            return
        if not match:
            return
        slots = self.owners.get(match.group(2))
        if not slots:
            self.unattributed += 1
            return
        for slot in slots:
            self.per_slot[slot] = self.per_slot.get(slot, 0) + 1

    def count(self, slot: int) -> int:
        return self.per_slot.get(slot, 0) + self.unattributed


def _owners(multiworld, players: Iterable[int]) -> Dict[str, set]:
    owners: Dict[str, set] = {}
    for player in players:
        for location in multiworld.get_locations(player):
            owners.setdefault(location.name, set()).add(player)
        for entrance in multiworld.get_entrances(player):
            owners.setdefault(entrance.name, set()).add(player)
    return owners


# ------------------------------------------------------------------------------------------------ export
def wanted_players(multiworld, exclude_games) -> list:
    excluded = set(exclude_games or ())
    return [p for p in multiworld.player_ids if multiworld.game[p] not in excluded]


def _omitted(reason: str, **extra) -> Dict[str, Any]:
    return {"omitted": {"reason": reason, "source": SOURCE, **extra}}


def export_room(multiworld, package: str, *, enabled: bool, max_kb: int, exclude_games,
                strip_level: str = DEFAULT_LEVEL, keep_dir: Optional[str] = None) -> Dict[int, Dict[str, Any]]:
    """One result per wanted slot: ``{"envelope": ..., "bytes": n}`` or ``{"omitted": {"reason": ...}}``."""
    if strip_level not in LEVELS:
        logger.warning("Upstream Rules Add-on: unknown strip_level %r (known: %s); using %r",
                       strip_level, ", ".join(LEVELS), DEFAULT_LEVEL)
        strip_level = DEFAULT_LEVEL
    if not enabled:
        logger.info("Upstream Rules Add-on: off (host.yaml upstream_rules_addon.enabled is false); no slot gets rules")
        return {}
    wanted = wanted_players(multiworld, exclude_games)
    if not wanted:
        logger.info("Upstream Rules Add-on: every game in this room is in exclude_games; no slot gets rules")
        return {}
    cap_kb = int(max_kb)
    started = time.perf_counter()
    result: Dict[int, Dict[str, Any]] = {}
    root = None
    handler_count = 0
    gate = DegradedRuleCounter(_owners(multiworld, multiworld.player_ids))
    gate_logger = None
    try:
        ex, strip_placements, root = load_exporter(package)
        gate_logger = logging.getLogger(root)
        gate_logger.addHandler(gate)
        handler_count = len(getattr(sys.modules.get(f"{root}.games"), "GAME_HANDLERS", None) or {})
        if handler_count == 0:
            raise RuntimeError("the exporter discovered 0 game handlers")
        with tempfile.TemporaryDirectory(prefix="upstream-rules-addon-") as scratch:
            base = "AP_" + multiworld.seed_name
            ex.export_game_rules(multiworld, scratch, base, save_presets=False, rules_json_format="rule_builder")
            several = len(multiworld.player_ids) > 1
            for p in wanted:
                name = f"{base}_P{p}_rules.json" if several else f"{base}_rules.json"
                path = os.path.join(scratch, name)
                if not os.path.exists(path):
                    result[p] = _omitted("export_failed", error=f"the exporter wrote no {name}")
                    continue
                with open(path, encoding="utf-8") as f:
                    raw = f.read()
                if keep_dir:
                    os.makedirs(keep_dir, exist_ok=True)
                    with open(os.path.join(keep_dir, name), "w", encoding="utf-8") as f:
                        f.write(raw)
                doc = json.loads(raw)
                degraded = gate.count(p)
                fallback = ((doc.get("exporter") or {}).get(str(p)) or {}).get("format_fallback")
                if degraded or fallback:
                    result[p] = _omitted("export_degraded", unanalysed_rules=degraded,
                                         **({"format_fallback": fallback.get("reason")} if fallback else {}))
                    continue
                envelope = {"format": FORMAT, "player": str(p), "source": SOURCE,
                            "doc": strip(doc, strip_placements, strip_level)}
                size = envelope_bytes(envelope)
                if size > cap_kb * 1024:
                    result[p] = _omitted("over_cap", size_kb=round(size / 1024), cap_kb=cap_kb)
                else:
                    result[p] = {"envelope": envelope, "bytes": size}
    except Exception as error:   # never fail generation
        logger.exception("Upstream Rules Add-on: the export failed; every slot gets worldgen_rules_omitted")
        return {p: _omitted("export_failed", error=f"{type(error).__name__}: {error}") for p in wanted}
    finally:
        if gate_logger is not None:
            gate_logger.removeHandler(gate)
        if root:
            _clear_exporter_caches(root)
    sent = sum(1 for r in result.values() if "envelope" in r)
    logger.info("Upstream Rules Add-on: %d of %d slot(s) get their rules (%.2f s, %d export handlers, strip_level %s)%s",
                sent, len(wanted), time.perf_counter() - started, handler_count, strip_level,
                "".join(f"; slot {p}: {r['omitted']['reason']}" for p, r in result.items() if "omitted" in r))
    return result


# ------------------------------------------------------------------------------------------------ inject
def inject(result: Dict[int, Dict[str, Any]], multidata: Dict[str, Any]) -> int:
    """Put each result into the multidata's slot_data. Returns how many slots were written.

    A slot whose world already sends its own document (``worldgen_rules`` or ``worldgen_rules_omitted``: the
    world_generator packages, Baking/Coding Adventure) is left alone, and so is a slot_data that is not a dict.
    """
    written = 0
    slot_datas = multidata["slot_data"]
    for p, entry in result.items():
        slot_data = slot_datas.get(p)
        if slot_data is None:
            slot_data = slot_datas[p] = {}
        if not isinstance(slot_data, dict):
            continue
        if SLOT_DATA_KEY in slot_data or OMITTED_KEY in slot_data:
            continue
        if "envelope" in entry:
            slot_data[SLOT_DATA_KEY] = entry["envelope"]
        else:
            slot_data[OMITTED_KEY] = entry["omitted"]
        written += 1
    return written
