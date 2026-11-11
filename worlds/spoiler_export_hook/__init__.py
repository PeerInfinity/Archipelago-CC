"""Spoiler Export Hook: optional helper apworld.

It computes, once per seed, the sphere walk over every filled location and hands each asking slot a compact
own-slot record for its slot_data. The individual apworlds call it through `_spoiler_hook_client.py`; this
module has no stage hook of its own, because AP runs stage_* only for classes with a player in the seed.

Unlike exporter/sphere_logger.py this never touches location.item (no pruning pass: all locations are
wanted), has no module globals (the result lives on the multiworld) and takes no per-step state copies or
reachability sweeps. Nothing here may fail generation: the client catches everything and records a reason.
"""
import json
import logging
import time
from typing import Any, ClassVar

from worlds.AutoWorld import WebWorld, World

__version__ = "1.1.0"

#: Client copies this helper can serve. A helper keeps old entries while their callers exist.
SUPPORTED_CLIENT_APIS = frozenset({1})
#: The slot_data record's shape; the frontend names the versions it reads.
FORMAT = 1
OPTION = "spoiler_data_in_slot_data"
#: The option's value that adds each step's sender. Any other non-zero value is own slot only.
OWN_SLOT_WITH_SENDERS = 2
#: The Toggle that adds each step's newly reachable regions. Read with getattr: an older client copy lacks it.
REGIONS_OPTION = "spoiler_data_include_regions"
SLOT_DATA_KEY = "spoiler_data"
#: Above this a slot sends a reason instead (measured maximum is far lower; see the design note).
MAX_SLOT_BYTES = 1024 * 1024

_CACHE_ATTR = "_spoiler_export_hook_result"
logger = logging.getLogger("SpoilerExportHook")


def _wanted(world: World) -> bool:
    option = getattr(world.options, OPTION, None)
    return bool(option is not None and option.value)


def _with_senders(world: World) -> bool:
    return getattr(world.options, OPTION).value == OWN_SLOT_WITH_SENDERS


def _with_regions(world: World) -> bool:
    option = getattr(world.options, REGIONS_OPTION, None)
    return bool(option is not None and option.value)


def _code(address: Any, name: str, known: Any):
    """The AP id only where the game's DataPackage gives back this exact name.

    Otherwise the name: an event has no id; some ids are absent from the package (Ocarina of Time's Skull Mask);
    and some items carry an id that the package resolves to a different name (ALttP's Progressive Bow gets the name Progressive Bow (Alt)).
    """
    return address if isinstance(address, int) and known.get(address) == name else name


def walk(multiworld, region_players=()) -> dict:
    """The sphere walk: [(label, location)] in collection order, one pass, one state, no writes.

    For each player in region_players it also records the regions first reachable at the start and after each
    step, read from CollectionState's own reachable-region cache (the one can_reach already keeps current). AP
    marks only the collected item's owner stale, so a player's regions can change only on a step that gives it
    an item. These equal the exporter logger's new_accessible_regions for that player (measured, six-game seed).
    """
    from BaseClasses import CollectionState
    state = CollectionState(multiworld)
    seen = {player: set() for player in region_players}

    def new_regions(player):
        if state.stale[player]:
            state.update_reachable_regions(player)
        reach = state.reachable_regions[player]
        if len(reach) == len(seen[player]):
            return []
        fresh = sorted(region.name for region in reach if region.player == player and region not in seen[player])
        seen[player].update(reach)
        return fresh

    start_regions = {player: new_regions(player) for player in seen}
    step_regions = {player: {} for player in seen}
    candidates = set(multiworld.get_filled_locations())
    steps = []
    sphere = 0
    while candidates:
        reachable = {location for location in candidates if state.can_reach(location)}
        if not reachable:
            break
        for index, location in enumerate(sorted(reachable, key=lambda loc: (loc.player, loc.name)), 1):
            state.collect(location.item, True, location)
            label = f"{sphere}.{index}"
            steps.append((label, location))
            owner = location.item.player
            if owner in seen:
                fresh = new_regions(owner)
                if fresh:
                    step_regions[owner][label] = fresh
        candidates -= reachable
        sphere += 1
    return {"steps": steps, "unreachable": len(candidates), "spheres": sphere,
            "start_regions": start_regions, "step_regions": step_regions}


def compact_for(multiworld, walked: dict, player: int, with_senders: bool = False, with_regions: bool = False) -> dict:
    """Own slot: its own locations, and each item it receives, with the walk step of each.

    With senders, a row whose item comes from another player's location gains a fourth element, [player, location],
    the location checked against that player's own DataPackage. Every other row, and the format, stay the same.

    With regions (the walk must have been asked for this player's), the record gains
    "regions": {"start": [names], "steps": [[row index, [names first reachable after that row]]...]}.
    """
    world = multiworld.worlds[player]
    start = [_code(item.code, item.name, world.item_id_to_name) for item in multiworld.precollected_items.get(player, [])]
    rows = []
    for label, location in walked["steps"]:
        own = location.player == player
        received = location.item.player == player
        if own or received:
            row = [label,
                   _code(location.address, location.name, world.location_id_to_name) if own else None,
                   _code(location.item.code, location.item.name, world.item_id_to_name) if received else None]
            if with_senders and not own:
                sender_table = multiworld.worlds[location.player].location_id_to_name
                row.append([location.player, _code(location.address, location.name, sender_table)])
            rows.append(row)
    record = {"format": FORMAT, "seed_name": str(multiworld.seed_name), "player": player,
              "start": sorted(start, key=str), "steps": rows, "unreachable": walked["unreachable"]}
    if with_regions:
        by_label = walked["step_regions"][player]
        record["regions"] = {"start": walked["start_regions"][player],
                             "steps": [[index, by_label[row[0]]] for index, row in enumerate(rows) if row[0] in by_label]}
    return record


def prepare(multiworld) -> dict:
    """Compute once per seed for every slot that asks, whichever class called first. Idempotent."""
    result = getattr(multiworld, _CACHE_ATTR, None)
    if result is not None:
        return result
    players = [player for player, world in multiworld.worlds.items() if _wanted(world)]
    if multiworld.is_race:
        logger.warning("Spoiler data is not added to slot_data in a race seed (asked by %d slot(s)).", len(players))
        result = {"omitted": {player: {"reason": "race"} for player in players}, "data": {}, "seconds": 0.0}
    else:
        started = time.perf_counter()
        region_players = [player for player in players if _with_regions(multiworld.worlds[player])]
        walked = walk(multiworld, region_players) if players else {"steps": [], "unreachable": 0}
        data, omitted = {}, {}
        for player in players:
            world = multiworld.worlds[player]
            record = compact_for(multiworld, walked, player, _with_senders(world), player in region_players)
            size = len(json.dumps(record, separators=(",", ":")))
            if size > MAX_SLOT_BYTES:
                omitted[player] = {"reason": "over_cap", "size_bytes": size, "cap_bytes": MAX_SLOT_BYTES}
            else:
                data[player] = record
        result = {"omitted": omitted, "data": data, "seconds": time.perf_counter() - started}
        logger.info("Spoiler data computed once for %d slot(s) in %.3f s.", len(players), result["seconds"])
    setattr(multiworld, _CACHE_ATTR, result)
    return result


def slot_data_for(multiworld, player: int) -> dict:
    """What fill_slot_data merges. Reads the cached result only (it runs in the output thread pool)."""
    result = getattr(multiworld, _CACHE_ATTR, None)
    if result is None:
        return {"spoiler_data_omitted": {"reason": "not_prepared"}}
    if player in result["data"]:
        return {SLOT_DATA_KEY: result["data"][player]}
    return {"spoiler_data_omitted": result["omitted"].get(player, {"reason": "not_prepared"})}


class SpoilerExportHookWeb(WebWorld):
    tutorials = []
    game_info_languages = []


class SpoilerExportHookWorld(World):
    """Hidden: a utility package, as worlds/json_tools_installer is. Never a player's game."""
    game = "Spoiler Export Hook"
    hidden = True
    web = SpoilerExportHookWeb()
    item_name_to_id: ClassVar[dict] = {}
    location_name_to_id: ClassVar[dict] = {}

    @classmethod
    def stage_assert_generate(cls, multiworld) -> None:
        raise RuntimeError("Spoiler Export Hook is a helper, not a playable game.")
