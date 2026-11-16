"""Upstream Rules Add-on: an optional helper apworld for hosts.

Installed in a generator's ``custom_worlds/``, it makes every slot of a room carry its rules document in
slot_data as ``worldgen_rules``: the envelope the web client already reads, so a player can connect to a room of
upstream games with no preset file and have the client build the room from the server alone. Host guide:
``docs/json/features/upstream-rules-addon.md``.

How it reaches a pristine Archipelago:
- AP runs ``stage_*`` only for classes with a player, and this world never has one. So at IMPORT time the
  module wraps ``worlds.AutoWorld.call_all`` (``Main.py`` calls it as ``AutoWorld.call_all``, an attribute lookup
  at call time, so the wrapper is what runs).
- After the real ``pre_output`` it exports every wanted slot once (``_addon.export_room``); after the real
  ``modify_multidata`` it writes the results into ``multidata["slot_data"]`` (``_addon.inject``).
- When ``pre_output`` ran with results and no injection followed before the multiworld is freed, it logs one
  warning (AP renamed or moved ``modify_multidata``; the room then has no documents and the client refuses
  with its no-preset message).

Only the BUILT apworld acts (``apworlds/upstream_rules_addon.apworld``, packed by
``scripts/build/pack_upstream_rules_addon.py``, which adds the vendored exporter under ``_vendor``). The source
folder in the fork's ``worlds/`` installs no hook, so the fork's own generation is unchanged; tests drive it with
``UPSTREAM_RULES_ADDON_ACTIVE=1`` or by calling ``_addon`` directly.
"""
import functools
import importlib.util
import logging
import os
import weakref
from typing import Any, ClassVar

import settings
from worlds import AutoWorld
from worlds.AutoWorld import WebWorld, World

from . import _addon

__version__ = "1.0.0"
logger = logging.getLogger("UpstreamRulesAddon")

#: The games whose own clients build their rules (the builder games); the add-on never sends theirs.
BUILDER_GAMES = ("APCalc", "DepGraph", "Metamath")
_RUN_ATTR = "_upstream_rules_addon_run"
_ACTIVE_ENV = "UPSTREAM_RULES_ADDON_ACTIVE"


class UpstreamRulesAddonSettings(settings.Group):
    class Enabled(settings.Bool):
        """Send each slot's rules document in slot_data (worldgen_rules), so the web client can play the room
        without a preset file. Installing the add-on turns it on; set false to keep it installed but idle."""

    class MaxKb(int):
        """Per-slot cap on the document, in KB (compact JSON). Over it, the slot gets worldgen_rules_omitted
        with reason over_cap, and the client asks for a preset file instead."""

    class ExcludeGames(list):
        """Games that never get a document (their client builds the rules itself, or the host does not want it)."""

    class StripLevel(str):
        """How much of each document is left out beyond placements: "play" (the default) leaves out the fields the
        client never needs to play; "editor" keeps them, so the APWorld Editor opened on the server's document shows
        item classifications and the meta rows. Placements are never sent."""

    enabled: Enabled | bool = True
    max_kb: MaxKb = MaxKb(1024)
    exclude_games: ExcludeGames = ExcludeGames(list(BUILDER_GAMES))
    strip_level: StripLevel = StripLevel("play")


class UpstreamRulesAddonWeb(WebWorld):
    tutorials = []
    game_info_languages = []


class UpstreamRulesAddonWorld(World):
    """Hidden helper: sends upstream worlds' rules documents to the web client. Not a game."""
    game = "Upstream Rules Addon"
    hidden = True
    web = UpstreamRulesAddonWeb()
    settings_key = "upstream_rules_addon"
    settings: ClassVar[UpstreamRulesAddonSettings]
    item_name_to_id = {}
    location_name_to_id = {}

    @classmethod
    def stage_assert_generate(cls, multiworld) -> None:
        raise RuntimeError("Upstream Rules Addon is a helper for hosts, not a playable game.")


def host_settings():
    """The host.yaml section, or its defaults when the settings cannot be read."""
    try:
        return settings.get_settings().upstream_rules_addon
    except Exception:
        return UpstreamRulesAddonSettings()


def is_built() -> bool:
    """True for the packed apworld (it carries ``_vendor``); False for the source folder."""
    try:
        return importlib.util.find_spec(f"{__name__}._vendor") is not None
    except Exception:
        return False


class _Run:
    """What one generation did, kept apart from the multiworld so the warning can outlive it."""
    __slots__ = ("pending", "injected", "seed_name")

    def __init__(self, pending: int, seed_name: str):
        self.pending = pending
        self.injected = False
        self.seed_name = seed_name


def _warn_if_never_injected(run: _Run) -> None:
    if run.pending and not run.injected:
        logger.warning("Upstream Rules Add-on: seed %s: %d slot result(s) were computed after pre_output, but "
                       "AP never called modify_multidata through AutoWorld.call_all, so the room carries no rules "
                       "documents. This Archipelago version is not supported by this add-on version.",
                       run.seed_name, run.pending)


def on_pre_output(multiworld) -> None:
    cfg = host_settings()
    result = _addon.export_room(multiworld, __name__, enabled=bool(cfg.enabled), max_kb=int(cfg.max_kb),
                                exclude_games=list(cfg.exclude_games or ()),
                                strip_level=str(getattr(cfg, "strip_level", "play") or "play"),
                                keep_dir=os.environ.get("UPSTREAM_RULES_ADDON_KEEP"))
    run = _Run(len(result), multiworld.seed_name)
    setattr(multiworld, _RUN_ATTR, (run, result))
    if result:
        weakref.finalize(multiworld, _warn_if_never_injected, run)


def on_modify_multidata(multiworld, multidata) -> None:
    run, result = getattr(multiworld, _RUN_ATTR, (None, None))
    if run is None:
        return
    _addon.inject(result, multidata)
    run.injected = True


_original_call_all = AutoWorld.call_all


@functools.wraps(_original_call_all)
def _call_all(multiworld, method_name: str, *args: Any) -> None:
    _original_call_all(multiworld, method_name, *args)
    try:
        if method_name == "pre_output":
            on_pre_output(multiworld)
        elif method_name == "modify_multidata" and args:
            on_modify_multidata(multiworld, args[0])
    except Exception:
        logger.exception("Upstream Rules Add-on hook failed; generation continues without it")


_call_all._upstream_rules_addon = True


def install_hook() -> bool:
    """Wrap AutoWorld.call_all once. Returns whether the hook is (now) installed."""
    if getattr(AutoWorld.call_all, "_upstream_rules_addon", False):
        return True
    AutoWorld.call_all = _call_all
    return True


if is_built() or os.environ.get(_ACTIVE_ENV) == "1":
    install_hook()
