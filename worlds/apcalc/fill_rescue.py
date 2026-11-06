"""A fill rescue for APCalc: re-order the progression pool only when AP's fill would fail.

Why. An APCalc puzzle at the default options is a narrow chain. Sphere 0 holds 4 locations,
spheres 1-6 hold about 4 each, and 21 of those ~28 early locations must take a Button (each
sphere's 3 buttons are what open the next). The final sphere's many Junk nodes sit behind
nearly every button. AP's main fill (`Fill.fill_restrictive`) places the progression pool in
its shuffled order. Each item goes to the first open location reachable without it, assuming
every still-unplaced item is collected. Early in that order nearly every location qualifies,
so unrelated buttons can take all 4 sphere-0 slots. The button that opens sphere 1 then
has nowhere to go, the swap step runs out of swaps, and fill raises
"No more spots to place N items". About 1 seed in 300 does this at the default options
(2026-11-05). The puzzle itself is fine: the generator's own placement solves it. No puzzle
trait separates the failing seeds from the passing ones (start size, single-button openers,
pool size), so a fix keyed on the puzzle would move passing seeds too.

What. `rescue_progression_fill` runs as `stage_fill_hook`, the last world hook before the
main progression fill. It dry-runs that fill on copies of the pool and locations, exactly as
`distribute_items_restrictive` is about to call it, and then undoes every placement. If no
APCalc item is left unplaced, it changes nothing. It does not touch `multiworld.random`, so
the real fill, and everything after it, is the same as without the hook. Only when the dry run
strands an APCalc item does it re-order the progression pool from a derived RNG, up to
`RESCUE_ATTEMPTS` orders. It keeps the first order whose dry run places everything. A seed that
fills today keeps its placements; only a seed that would raise changes.

Limits. The dry run mirrors the `panic_method="swap"` branch with no priority locations.
When priority locations exist it skips (that branch reorders the pool itself), and a room's
real fill then runs unchanged. Another world's `stage_fill_hook` that sorts after APCalcWorld
and edits the pools makes the dry run approximate; even then the hook only reorders a room
whose dry run failed.
"""

import random
from typing import TYPE_CHECKING, Iterable, List, Optional

from BaseClasses import LocationProgressType

if TYPE_CHECKING:
    from BaseClasses import Item, Location, MultiWorld

RESCUE_ATTEMPTS = 8


def _dry_run(multiworld: "MultiWorld", default_locations: List["Location"],
             progitempool: List["Item"]) -> List["Item"]:
    """The main progression fill on copies, then undone. Returns the items it could not place."""
    from Fill import fill_restrictive, sweep_from_pool

    locations = list(default_locations)
    pool = list(progitempool)
    single_player = multiworld.players == 1 and not multiworld.groups
    state = sweep_from_pool(multiworld.state)
    try:
        # allow_partial: the real call raises at this point; here the leftover pool is the answer.
        fill_restrictive(multiworld, state, locations, pool, swap=True, allow_partial=True,
                         name="APCalc fill dry run", single_player_placement=single_player)
    finally:
        for location in default_locations:
            if location.item is not None:
                location.item.location = None
                location.item = None
                location.locked = False
    return pool


def _strands(unplaced: Iterable["Item"], players: set) -> bool:
    return any(item.player in players for item in unplaced)


def rescue_progression_fill(multiworld: "MultiWorld", progitempool: List["Item"],
                            fill_locations: List["Location"], game: str) -> Optional[int]:
    """Re-order `progitempool` in place if the main fill would strand an item of `game`.

    Returns None when nothing was needed (or possible), otherwise the attempt that worked
    (1..RESCUE_ATTEMPTS-1). Attempt 0 is the pool's own order.
    """
    players = set(multiworld.get_game_players(game))
    if not players or not progitempool:
        return None
    if any(loc.progress_type == LocationProgressType.PRIORITY for loc in fill_locations):
        return None
    default_locations = [loc for loc in fill_locations
                         if loc.progress_type == LocationProgressType.DEFAULT]

    if not _strands(_dry_run(multiworld, default_locations, progitempool), players):
        return None

    original = list(progitempool)
    for attempt in range(1, RESCUE_ATTEMPTS):
        order = list(original)
        # A string seed hashes the same on every platform and Python version (random version 2).
        random.Random(f"APCalc fill rescue {multiworld.seed} {attempt}").shuffle(order)
        if not _strands(_dry_run(multiworld, default_locations, order), players):
            progitempool[:] = order
            return attempt
    return None
