"""
Access rules for Yacht Dice WorldGen.

This module sets access rules using the dice simulation logic from the
original Yacht Dice world. Since the helper function is too complex to
export directly, we import it from the original implementation.
"""

from typing import TYPE_CHECKING

from worlds.generic.Rules import set_rule

# Import the scoring logic from the original yacht dice world
from worlds.yachtdice.Rules import dice_simulation_state_change

if TYPE_CHECKING:
    from worlds.AutoWorld import World


# Settings extracted from the original rules.json export
FRAGS_PER_DICE = 4
FRAGS_PER_ROLL = 4
DIFFICULTY = 2
ALLOWED_CATEGORIES = [
    "Category Choice",
    "Category Inverse Choice",
    "Category Ones",
    "Category Twos",
    "Category Threes",
    "Category Fours",
    "Category Fives",
    "Category Sixes",
    "Category Pair",
    "Category Three of a Kind",
    "Category Four of a Kind",
    "Category Tiny Straight",
    "Category Small Straight",
    "Category Large Straight",
    "Category Full House",
    "Category Yacht",
]


def set_rules(world: "World") -> None:
    """Set access rules for all locations and entrances."""
    player = world.player
    multiworld = world.multiworld

    # Set rules for all score locations using the dice simulation logic
    for location in multiworld.get_locations(player):
        # Extract the score threshold from the location name (e.g., "42 score" -> 42)
        loc_name = location.name
        if loc_name.endswith(" score"):
            try:
                score_threshold = int(loc_name.replace(" score", ""))
                set_rule(
                    location,
                    lambda state, threshold=score_threshold, p=player: (
                        dice_simulation_state_change(
                            state, p, FRAGS_PER_DICE, FRAGS_PER_ROLL,
                            ALLOWED_CATEGORIES, DIFFICULTY
                        ) >= threshold
                    )
                )
            except ValueError:
                # Not a score location, skip
                pass

    # Set completion condition
    multiworld.completion_condition[player] = lambda state: state.has("Victory", player)
