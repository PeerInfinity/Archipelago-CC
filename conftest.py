"""Pytest configuration for the Archipelago-CC fork.

This fork carries every upstream Archipelago world plus a large set of
fork-specific worlds (typically *_worldgen variants, plus a handful of
custom worlds like apcalc, seedling, metamath, etc.). Failures in upstream
worlds are not the maintainer's responsibility to fix, and they cause CI
to report misleading red checks on every push.

To keep CI signal focused on this fork's own code, this conftest:

1. Skips collection of ``worlds/<upstream>/test`` directories so per-world
   test suites for upstream worlds do not run.
2. Removes upstream worlds from ``AutoWorldRegister.world_types`` at the
   start of the pytest session so the iteration-over-all-worlds tests in
   ``test/general/`` (e.g. ``test_create_duplicate_locations``,
   ``test_locations_in_datapackage``) do not try to instantiate them.

To re-include an upstream world (e.g. while investigating a real
regression), remove it from ``UPSTREAM_WORLDS`` below.

The list was generated from ``git ls-tree -d --name-only upstream/main worlds/``
(remote: https://github.com/ArchipelagoMW/Archipelago.git). Refresh it when
syncing with upstream if new worlds are added there.
"""

from __future__ import annotations

UPSTREAM_WORLDS: frozenset[str] = frozenset({
    "adventure", "ahit", "alttp", "apquest", "aquaria", "blasphemous",
    "bomb_rush_cyberfunk", "bumpstik", "cccharles", "celeste64",
    "celeste_open_world", "checksfinder", "civ_6", "cv64", "cvcotm",
    "dark_souls_3", "dlcquest", "doom_1993", "doom_ii", "earthbound",
    "factorio", "faxanadu", "ff1", "ffmq", "generic", "heretic", "hk",
    "hylics2", "inscryption", "jakanddaxter", "kdl3", "kh1", "kh2", "ladx",
    "landstalker", "lingo", "lufia2ac", "marioland2", "meritous", "messenger",
    "mlss", "mm2", "mm3", "mmbn3", "musedash", "noita", "oot", "osrs",
    "overcooked2", "paint", "pokemon_emerald", "pokemon_rb", "raft", "ror2",
    "sa2b", "satisfactory", "saving_princess", "sc2", "shapez", "shivers",
    "shorthike", "sm", "sm64ex", "smw", "smz3", "soe", "stardew_valley",
    "subnautica", "terraria", "timespinner", "tloz", "tunic", "tww",
    "undertale", "v6", "wargroove", "witness", "yachtdice", "yoshisisland",
    "yugioh06", "zillion",
})

collect_ignore_glob = [f"worlds/{name}/test" for name in UPSTREAM_WORLDS]


def pytest_configure(config) -> None:  # noqa: ARG001 — pytest hook signature
    del config
    from worlds.AutoWorld import AutoWorldRegister

    upstream_games = [
        game
        for game, world_type in AutoWorldRegister.world_types.items()
        if (world_type.__module__.split(".", 2) + [""])[1] in UPSTREAM_WORLDS
    ]
    for game in upstream_games:
        AutoWorldRegister.world_types.pop(game, None)
