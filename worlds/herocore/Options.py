from typing import List, TYPE_CHECKING, Dict
from dataclasses import dataclass
from worlds.AutoWorld import PerGameCommonOptions
from Options import Range, Toggle, DeathLink, Choice, DefaultOnToggle, OptionGroup

#if TYPE_CHECKING:
#    from . import HeroCoreWorld

class Difficulty(Choice):
    """
    What game difficulty your world will be played on.
    """
    display_name="Difficulty"
    default=1
    option_normal=1
    option_hard=2
    option_annihilation=3

class GoalComputers(Range):
    """
    How many computers are required for you to enter the Final Boss room and complete the game.
    """
    display_name = "Goal Computers"
    default = 0
    range_start = 0
    range_end = 10

class ShufflePowerUps(DefaultOnToggle):
    """
    If enabled, the Powerups obtained from defeating bosses will contain random items,
    and the Blade, Suit, Blaster, and Pattern Scanner Power Ups can appear anywhere in the multiworld.
    Otherwise, they will be locked behind bosses at their vanilla locations.
    If your chosen difficulty is Annihilation, this option does nothing.
    """

class ShuffleLevelUps(Toggle):
    """
    If enabled, the Levelups obtained from defeating bosses will contain random items, 
    and your Levelups can appear anywhere in the multiworld.
    Otherwise they will be locked to their vanilla locations.
    If your chosen difficulty is Annihilation, this option does nothing.
    """
    display_name = "Shuffle Level Ups"

class ExpelSkips(Toggle):
    """
    Whether or not the logic should expect the player to use Expel to kill otherwise out-of-reach enemies.
    In Normal and Hard, this will allow you to enter a few areas without the Suit upgrades.
    In Annihilation, this option does nothing.
    """
    display_name = "Expel Skips"

class ShuffleComputers(DefaultOnToggle):
    """
    If enabled, Computers will contain random items, and your Computer items can appear anywhere in the multiworld.
    Otherwise, the computers will be locked to their vanilla locations.
    """
    display_name = "Shuffle Computers"

class SecretLocations(Toggle):
    """
    If enabled, a variety of miscellaneous locations will contain random items.
    This includes the Ship Scan and the Shapeshift Computer in all difficulties,
    Zero, the Expel Computer, and the Speedrun Times Computer in Normal and Hard,
    a hidden Flower in Hard, and a Gravestone in Annihilation
    """
    display_name = "Miscellaneous Locations"

class ShuffleSaves(Choice):
    """
    If enabled, each Save Point in the game will contain a random item,
    and items containing a warp to each Save Point can appear anywhere in the multiworld.
    You can still warp to Save Points that you reach, even if you don't have the respective item.
    You may also additionally choose to remove the Pattern Scanner from your world.
    """
    display_name = "Shuffle Saves"
    default = 0
    option_off = 0
    option_shuffle_saves = 1
    option_shuffle_saves_no_scanner = 2

class ShuffleDoors(Toggle):
    """
    If enabled, defeating all enemies in a room containing a locked door will send a random item,
    and items that open doors in a given room can appear anywhere in the multiworld.
    """
    display_name = "Shuffle Doors"

class ShuffleGenerators(DefaultOnToggle):
    """
    If enabled, destroying a generator will send a random item, 
    and items that remove barriers around a generator can appear anywhere in the multiworld.
    """

@dataclass
class HeroCoreOptions(PerGameCommonOptions):
    difficulty:       Difficulty
    goal_computers: GoalComputers

    powerups: ShufflePowerUps
    level_ups:   ShuffleLevelUps
    computers:  ShuffleComputers
    generators: ShuffleGenerators
    save_points: ShuffleSaves 
    doors: ShuffleDoors

    miscellaneous_locations: SecretLocations
    expel_skips: ExpelSkips
    deathlink:  DeathLink

hero_core_option_groups = [
    OptionGroup("Goal Options", [
        Difficulty,
        GoalComputers
    ]),
    OptionGroup("Shuffle Options", [
        ShufflePowerUps,
        ShuffleLevelUps,
        ShuffleComputers,
        ShuffleGenerators,
        ShuffleSaves,
        ShuffleDoors
    ]),
    OptionGroup("Miscellaneous", [
        SecretLocations,
        ExpelSkips,
        DeathLink
    ])
]