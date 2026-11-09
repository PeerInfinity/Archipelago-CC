"""Thin client for the optional Spoiler Export Hook apworld. Copied byte-for-byte into each apworld that uses it.

The import is at call time on purpose: a folder world loads before every .apworld, and an .apworld's import
spec is registered only just before that apworld loads, so a module-level import depends on load order.
"""
import importlib
import logging

HOOK_MODULE = "worlds.spoiler_export_hook"
OPTION = "spoiler_data_in_slot_data"
OMITTED_KEY = "spoiler_data_omitted"
CLIENT_API = 1

_NOTES = {
    "hook_absent": "the Spoiler Export Hook apworld is not installed",
    "hook_broken": "the Spoiler Export Hook apworld failed to import",
    "hook_failed": "the Spoiler Export Hook failed while computing",
    "api_mismatch": "this apworld and the installed Spoiler Export Hook are incompatible versions",
}


def wanted(world) -> bool:
    option = getattr(world.options, OPTION, None)
    return bool(option is not None and option.value)


def _load_hook():
    try:
        hook = importlib.import_module(HOOK_MODULE)
    except ModuleNotFoundError as error:
        return None, "hook_absent" if error.name == HOOK_MODULE else "hook_broken"
    except Exception:
        return None, "hook_broken"
    if CLIENT_API not in getattr(hook, "SUPPORTED_CLIENT_APIS", ()):
        return None, "api_mismatch"
    return hook, None


def _omit(multiworld, game, players, reason):
    """Remember why, and warn once per seed per reason however many classes hit it."""
    state = multiworld.__dict__.setdefault("_spoiler_hook_client", {"omitted": {}, "warned": set()})
    for player in players:
        state["omitted"][player] = reason
    if reason not in state["warned"]:
        state["warned"].add(reason)
        logging.warning("Spoiler data skipped: %s. Slots that asked for %s get none; generation continues. "
                        "(first seen for %s, slots %s)", _NOTES[reason], OPTION, game, sorted(players))


def prepare(world_class, multiworld) -> None:
    """Call from the world's stage_pre_output classmethod."""
    players = [player for player in multiworld.get_game_players(world_class.game)
               if wanted(multiworld.worlds[player])]
    if not players:
        return
    hook, reason = _load_hook()
    if hook is None:
        _omit(multiworld, world_class.game, players, reason)
        return
    state = multiworld.__dict__.setdefault("_spoiler_hook_client", {"omitted": {}, "warned": set()})
    if "hook_failed" in state["warned"]:  # one failed walk per seed, not one per world class
        _omit(multiworld, world_class.game, players, "hook_failed")
        return
    try:
        hook.prepare(multiworld)
    except Exception:
        logging.exception("Spoiler Export Hook raised; continuing without spoiler data.")
        _omit(multiworld, world_class.game, players, "hook_failed")


def slot_data(world) -> dict:
    """Merge into fill_slot_data's result. Empty unless this slot asked."""
    if not wanted(world):
        return {}
    state = getattr(world.multiworld, "_spoiler_hook_client", None)
    if state and world.player in state["omitted"]:
        return {OMITTED_KEY: {"reason": state["omitted"][world.player]}}
    hook, reason = _load_hook()
    if hook is None:
        return {OMITTED_KEY: {"reason": reason}}
    try:
        return hook.slot_data_for(world.multiworld, world.player)
    except Exception:
        logging.exception("Spoiler Export Hook raised; continuing without spoiler data.")
        return {OMITTED_KEY: {"reason": "hook_failed"}}
