from typing import Dict

from Options import Choice, Option, Toggle, Range, DeathLink

class Difficulty(Choice):
    """Game Difficulty"""
    display_name = "Game Difficulty"
    option_standard = 0
    option_tricky = 1
    option_unreasonable = 2
    default = 0

class BossLocations(Toggle):
    """If enabled, adds an extra location and Seal for each boss."""
    display_name = "Boss Locations"
    default = False

class Ending(Choice):
    """The ending required for you to complete your run in Archipelago."""
    option_bloody = 0
    option_bloodless = 1
    default = 0

class DeathLinkAmnesty(Range):
    """Amount of Deaths to take before sending a DeathLink signal, for balancing difficulty"""
    range_start = 0
    range_end = 30
    default = 15

seedling_options: Dict[str, type(Option)] = {
    "difficulty": Difficulty, "boss_locations": BossLocations, "ending": Ending, "deathlink": DeathLink, "deathlink_amnesty": DeathLinkAmnesty
}
