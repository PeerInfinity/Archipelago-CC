from typing import Callable, Dict, NamedTuple, Optional, TYPE_CHECKING
from BaseClasses import CollectionState, ItemClassification
from ..Names import LocNames, RegNames, ItemNames

if TYPE_CHECKING:
    from .. import HeroCoreWorld

class HeroCoreLocData(NamedTuple):
    region: str
    valid: Callable[["HeroCoreWorld"], bool] = lambda world: True
    logic: Callable[["HeroCoreWorld", CollectionState], bool] = lambda world, state: True
    locked_item: Callable[["HeroCoreWorld"], str] = lambda world: None
    locked_item_class: Callable[["HeroCoreWorld"], str] = lambda world: ItemClassification.progression

locations_powerups: Dict[str, int] = {
    LocNames.Powerups["A,4"]: 0x103,
    LocNames.Powerups["A,12"]: 0x10B,
    LocNames.Powerups["B,5"]: 0x114,
    LocNames.Powerups["B,7"]: 0x116,
    LocNames.Powerups["F,14"]: 0x15D,
    LocNames.Powerups["F,15"]: 0x15E,
    LocNames.Powerups["G,10"]: 0x169,
    LocNames.Powerups["H,5"]: 0x174,
    LocNames.Powerups["I,2"]: 0x181,
    LocNames.Powerups["I,14"]: 0x18D,
    LocNames.Powerups["J,2"]: 0x191,
    LocNames.Powerups["J,7"]: 0x196,
    LocNames.Powerups["J,10"]: 0x199,
    LocNames.Powerups["L,1"]: 0x1B0,
    LocNames.Powerups["L,5"]: 0x1B4,
    LocNames.Powerups["L,7"]: 0x1B6,
    LocNames.Powerups["N,9"]: 0x1D8,
    LocNames.Powerups["O,12"]: 0x1EB
}

locations_levelups: Dict[str, int] = {
    LocNames.Eliminator: 1,
    LocNames.Level_Ups["A,4"]: 0x203,
    LocNames.Level_Ups["A,12"]: 0x20B,
    LocNames.Level_Ups["B,5"]: 0x214,
    LocNames.Level_Ups["B,7"]: 0x216,
    LocNames.Level_Ups["F,14"]: 0x25D,
    LocNames.Level_Ups["F,15"]: 0x25E,
    LocNames.Level_Ups["G,10"]: 0x269,
    LocNames.Level_Ups["H,5"]: 0x274,
    LocNames.Level_Ups["I,2"]: 0x281,
    LocNames.Level_Ups["I,14"]: 0x28D,
    LocNames.Level_Ups["J,2"]: 0x291,
    LocNames.Level_Ups["J,7"]: 0x296,
    LocNames.Level_Ups["J,10"]: 0x299,
    LocNames.Level_Ups["L,1"]: 0x2B0,
    LocNames.Level_Ups["L,5"]: 0x2B4,
    LocNames.Level_Ups["L,7"]: 0x2B6,
    LocNames.Level_Ups["N,9"]: 0x2D8,
    LocNames.Level_Ups["O,12"]: 0x2EB
}

# 0xABC
#   |
#   V
# A = location type
# B = X coordinate
# C = Y coordinate

locations_generators: Dict[str, int] = {
    LocNames.Generators["A,9"]: 0x308,
    LocNames.Generators["B,9"]: 0x318,
    LocNames.Generators["B,11"]: 0x31A,
    LocNames.Generators["C,6"]: 0x325,
    LocNames.Generators["D,11"]: 0x33A,
    LocNames.Generators["E,3"]: 0x342,
    LocNames.Generators["G,4"]: 0x363,
    LocNames.Generators["G,9"]: 0x368,
    LocNames.Generators["H,1"]: 0x370,
    LocNames.Generators["H,4"]: 0x373,
    LocNames.Generators["H,11"]: 0x37A,
    LocNames.Generators["H,14"]: 0x37D,
    LocNames.Generators["I,4"]: 0x383,
    LocNames.Generators["I,7"]: 0x386,
    LocNames.Generators["J,2"]: 0x391,
    LocNames.Generators["K,4"]: 0x3A3,
    LocNames.Generators["L,10"]: 0x3B9,
    LocNames.Generators["L,15"]: 0x3BE,
    LocNames.Generators["M,4"]: 0x3C3,
    LocNames.Generators["M,6"]: 0x3C5,
    LocNames.Generators["M,11"]: 0x3CA
}

locations_computers: Dict[str, int] = {
    LocNames.Computers["B,12"]: 0x41B,
    LocNames.Computers["D,2"]: 0x431,
    LocNames.Computers["D,3"]: 0x432,
    LocNames.Computers["D,4"]: 0x433,
    LocNames.Computers["D,9"]: 0x438,
    LocNames.Computers["D,13"]: 0x43C,
    LocNames.Computers["F,3"]: 0x452,
    LocNames.Computers["F,7"]: 0x456,
    LocNames.Computers["F,13"]: 0x45C,
    LocNames.Computers["H,2"]: 0x471,
    LocNames.Computers["H,3"]: 0x472,
    LocNames.Computers["H,5"]: 0x474,
    LocNames.Computers["I,6"]: 0x485,
    LocNames.Computers["I,12"]: 0x48B,
    LocNames.Computers["I,14"]: 0x48D,
    LocNames.Computers["J,3"]: 0x492,
    LocNames.Computers["J,9"]: 0x498,
    LocNames.Computers["J,12"]: 0x49B,
    LocNames.Computers["K,1"]: 0x4A0,
    LocNames.Computers["K,4"]: 0x4A3,
    LocNames.Computers["K,5"]: 0x4A4,
    LocNames.Computers["K,8"]: 0x4A7,
    LocNames.Computers["K,12"]: 0x4AB,
    LocNames.Computers["L,2"]: 0x4B1,
    LocNames.Computers["L,3"]: 0x4B2,
    LocNames.Computers["M,10"]: 0x4C9,
    LocNames.Computers["N,4"]: 0x4D3,
    LocNames.Computers["O,4"]: 0x4E3
}

locations_saves: Dict[str, int] = {
    LocNames.Saves["A,3"]: 0x502,
    LocNames.Saves["A,8"]: 0x507,
    LocNames.Saves["B,10"]: 0x519,
    LocNames.Saves["C,5"]: 0x524,
    LocNames.Saves["C,11"]: 0x52A,
    LocNames.Saves["D,5"]: 0x534,
    LocNames.Saves["D,14"]: 0x53D,
    LocNames.Saves["D,15"]: 0x53E,
    LocNames.Saves["E,2"]: 0x541,
    LocNames.Saves["E,8"]: 0x547,
    LocNames.Saves["E,11"]: 0x54A,
    LocNames.Saves["F,2"]: 0x551,
    LocNames.Saves["F,8"]: 0x557,
    LocNames.Saves["F,12"]: 0x55B,
    LocNames.Saves["G,1"]: 0x560,
    LocNames.Saves["G,3"]: 0x562,
    LocNames.Saves["G,5"]: 0x564,
    LocNames.Saves["G,11"]: 0x56A,
    LocNames.Saves["G,12"]: 0x56B,
    LocNames.Saves["H,6"]: 0x575,
    LocNames.Saves["H,15"]: 0x57E,
    LocNames.Saves["I,1"]: 0x580,
    LocNames.Saves["I,10"]: 0x589,
    LocNames.Saves["J,3"]: 0x592,
    LocNames.Saves["J,4"]: 0x593,
    LocNames.Saves["J,5"]: 0x594,
    LocNames.Saves["J,8"]: 0x597,
    LocNames.Saves["J,11"]: 0x59A,
    LocNames.Saves["J,15"]: 0x59E,
    LocNames.Saves["K,1"]: 0x5A0,
    LocNames.Saves["L,4"]: 0x5B3,
    LocNames.Saves["L,8"]: 0x5B7,
    LocNames.Saves["L,12"]: 0x5BB,
    LocNames.Saves["L,15"]: 0x5BE,
    LocNames.Saves["M,4"]: 0x5C3,
    LocNames.Saves["M,11"]: 0x5CA,
    LocNames.Saves["N,5"]: 0x5D4,
    LocNames.Saves["N,9"]: 0x5D8,
    LocNames.Saves["O,8"]: 0x5E7
}

locations_doors: Dict[str, int] = {
    LocNames.Doors["A,4"]: 0x603,
    LocNames.Doors["A,5"]: 0x604,
    LocNames.Doors["A,7"]: 0x606,
    LocNames.Doors["A,8"]: 0x607,
    LocNames.Doors["A,12"]: 0x60B,
    LocNames.Doors["B,4"]: 0x613,
    LocNames.Doors["B,5"]: 0x614,
    LocNames.Doors["B,6"]: 0x615,
    LocNames.Doors["B,7"]: 0x616,
    LocNames.Doors["B,8"]: 0x617,
    LocNames.Doors["C,8"]: 0x627,
    LocNames.Doors["C,9"]: 0x628,
    LocNames.Doors["C,10"]: 0x629,
    LocNames.Doors["C,11"]: 0x62A,
    LocNames.Doors["C,12"]: 0x62B,
    LocNames.Doors["D,2"]: 0x631,
    LocNames.Doors["D,3"]: 0x632,
    LocNames.Doors["D,10"]: 0x639,
    LocNames.Doors["D,12"]: 0x63B,
    LocNames.Doors["D,14"]: 0x63D,
    LocNames.Doors["E,4"]: 0x643,
    LocNames.Doors["E,5"]: 0x644,
    LocNames.Doors["E,8"]: 0x647,
    LocNames.Doors["E,9"]: 0x648,
    LocNames.Doors["E,12"]: 0x64B,
    LocNames.Doors["E,13"]: 0x64C,
    LocNames.Doors["E,14"]: 0x64D,
    LocNames.Doors["E,15"]: 0x64E,
    LocNames.Doors["F,2"]: 0x651,
    LocNames.Doors["F,5"]: 0x654,
    LocNames.Doors["F,6"]: 0x655,
    LocNames.Doors["F,9"]: 0x658,
    LocNames.Doors["F,13"]: 0x65C,
    LocNames.Doors["F,14"]: 0x65D,
    LocNames.Doors["F,15"]: 0x65E,
    LocNames.Doors["G,1"]: 0x660,
    LocNames.Doors["G,6"]: 0x665,
    LocNames.Doors["G,10"]: 0x669,
    LocNames.Doors["H,2"]: 0x671,
    LocNames.Doors["H,3"]: 0x672,
    LocNames.Doors["H,4"]: 0x673,
    LocNames.Doors["H,5"]: 0x674,
    LocNames.Doors["H,6"]: 0x675,
    LocNames.Doors["H,7"]: 0x676,
    LocNames.Doors["H,12"]: 0x67B,
    LocNames.Doors["H,14"]: 0x67D,
    LocNames.Doors["I,2"]: 0x681,
    LocNames.Doors["I,3"]: 0x682,
    LocNames.Doors["I,4"]: 0x683,
    LocNames.Doors["I,5"]: 0x684,
    LocNames.Doors["I,6"]: 0x685,
    LocNames.Doors["I,11"]: 0x68A,
    LocNames.Doors["I,13"]: 0x68C,
    LocNames.Doors["I,14"]: 0x68D,
    LocNames.Doors["I,15"]: 0x68E,
    LocNames.Doors["J,1"]: 0x690,
    LocNames.Doors["J,2"]: 0x691,
    LocNames.Doors["J,7"]: 0x696,
    LocNames.Doors["J,10"]: 0x699,
    LocNames.Doors["J,11"]: 0x69A,
    LocNames.Doors["J,13"]: 0x69C,
    LocNames.Doors["K,2"]: 0x6A1,
    LocNames.Doors["K,3"]: 0x6A2,
    LocNames.Doors["K,7"]: 0x6A6,
    LocNames.Doors["K,9"]: 0x6A8,
    LocNames.Doors["K,14"]: 0x6AD,
    LocNames.Doors["K,15"]: 0x6AE,
    LocNames.Doors["L,1"]: 0x6B0,
    LocNames.Doors["L,2"]: 0x6B1,
    LocNames.Doors["L,5"]: 0x6B4,
    LocNames.Doors["L,7"]: 0x6B6,
    LocNames.Doors["L,8"]: 0x6B7,
    LocNames.Doors["L,11"]: 0x6BA,
    LocNames.Doors["L,13"]: 0x6BC,
    LocNames.Doors["M,2"]: 0x6C1,
    LocNames.Doors["M,3"]: 0x6C2,
    LocNames.Doors["M,6"]: 0x6C5,
    LocNames.Doors["M,7"]: 0x6C6,
    LocNames.Doors["M,10"]: 0x6C9,
    LocNames.Doors["N,4"]: 0x6D3,
    LocNames.Doors["N,8"]: 0x6D7,
    LocNames.Doors["N,9"]: 0x6D8,
    LocNames.Doors["N,11"]: 0x6DA,
    LocNames.Doors["N,12"]: 0x6DB,
    LocNames.Doors["O,7"]: 0x6E6,
    LocNames.Doors["O,9"]: 0x6E8,
    LocNames.Doors["O,10"]: 0x6E9,
    LocNames.Doors["O,11"]: 0x6EA,
    LocNames.Doors["O,12"]: 0x6EB
}

locations_battle_doors: Dict[str, int] = {
    LocNames.Battle_Doors["B,6"]: 0x715,
    LocNames.Battle_Doors["E,3"]: 0x742,
    LocNames.Battle_Doors["H,2"]: 0x771,
    LocNames.Battle_Doors["J,7"]: 0x796,
    LocNames.Battle_Doors["K,2"]: 0x7A1,
    LocNames.Battle_Doors["O,4"]: 0x7E3
}

locations_miscellaneous: Dict[str, int] = {
    LocNames.ShipScan: 2,
    LocNames.Zero: 3,
    LocNames.Expel: 4,
    LocNames.Speedrun: 5,
    LocNames.Shapeshift: 6,
    LocNames.Flower: 7,
    LocNames.Grave: 8,
    LocNames.Tetron: 9,
    LocNames.WarMachine: 10
}

location_table = {
    **locations_powerups,
    **locations_levelups,
    **locations_generators,
    **locations_computers,
    **locations_saves,
    **locations_doors,
    **locations_battle_doors,
    **locations_miscellaneous
}

locations_normal: Dict[str, HeroCoreLocData] = {
    LocNames.Powerups["J,10"]: HeroCoreLocData(
        region = RegNames.Normal["J,10"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Suit
    ),
    LocNames.Powerups["L,5"]: HeroCoreLocData(
        region = RegNames.Normal["L,5"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blade
    ),
    LocNames.Powerups["L,1"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blaster,
        locked_item_class = lambda world: ItemClassification.useful
    ),
    LocNames.Powerups["J,7"]: HeroCoreLocData(
        region = RegNames.Normal["J,7"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blaster,
        locked_item_class = lambda world: ItemClassification.useful
    ),
    LocNames.Powerups["A,4"]: HeroCoreLocData(
        region = RegNames.Normal["A,4"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blade
    ),
    LocNames.Powerups["I,2"]: HeroCoreLocData(
        region = RegNames.Normal["I,2"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Suit
    ),
    LocNames.Powerups["B,7"]: HeroCoreLocData(
        region = RegNames.Normal["B,7"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blade
    ),
    LocNames.Powerups["G,10"]: HeroCoreLocData(
        region = RegNames.Normal["G,10"],
        locked_item = lambda world: (None if (world.options.powerups or world.options.save_points.value == 2)
                                     else ItemNames.Scanner)
    ),
    LocNames.Powerups["F,14"]: HeroCoreLocData(
        region = RegNames.Normal["F,14"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Suit
    ),
    LocNames.Level_Ups["J,10"]: HeroCoreLocData(
        region = RegNames.Normal["J,10"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["L,5"]: HeroCoreLocData(
        region = RegNames.Normal["L,5"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["L,1"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["J,7"]: HeroCoreLocData(
        region = RegNames.Normal["J,7"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["A,4"]: HeroCoreLocData(
        region = RegNames.Normal["A,4"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["I,2"]: HeroCoreLocData(
        region = RegNames.Normal["I,2"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["B,7"]: HeroCoreLocData(
        region = RegNames.Normal["B,7"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["G,10"]: HeroCoreLocData(
        region = RegNames.Normal["G,10"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["F,14"]: HeroCoreLocData(
        region = RegNames.Normal["F,14"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Eliminator: HeroCoreLocData(
        region = RegNames.Menu,
        valid = lambda world: world.options.difficulty.value <= 2,
        logic = lambda world, state: state.has(ItemNames.Level, world.player, 9),
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Generators["E,3"]: HeroCoreLocData(
        region = RegNames.Normal["E,3"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["E,3"]
    ),
    LocNames.Generators["I,4"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["I,4"]
    ),
    LocNames.Generators["K,4"]: HeroCoreLocData(
        region = RegNames.Normal["J,4"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["K,4"]
    ),
    LocNames.Generators["C,6"]: HeroCoreLocData(
        region = RegNames.Normal["C,6"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["C,6"]
    ),
    LocNames.Generators["M,6"]: HeroCoreLocData(
        region = RegNames.Normal["M,6"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["M,6"]
    ),
    LocNames.Generators["B,9"]: HeroCoreLocData(
        region = RegNames.Normal["B,9"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["B,9"]
    ),
    LocNames.Generators["G,9"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["G,9"]
    ),
    LocNames.Generators["D,11"]: HeroCoreLocData(
        region = RegNames.Normal["D,11"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["D,11"]
    ),
    LocNames.Generators["H,11"]: HeroCoreLocData(
        region = RegNames.Normal["H,11"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["H,11"]
    ),
    LocNames.Generators["M,11"]: HeroCoreLocData(
        region = RegNames.Normal["M,11"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["M,11"]
    ),
    LocNames.Computers["L,2"]: HeroCoreLocData(
        region = RegNames.Normal["L,2"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["D,3"]: HeroCoreLocData(
        region = RegNames.Normal["D,3"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["O,4"]: HeroCoreLocData(
        region = RegNames.Normal["O,4"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["I,6"]: HeroCoreLocData(
        region = RegNames.Normal["I,6"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["D,9"]: HeroCoreLocData(
        region = RegNames.Normal["D,9"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["J,9"]: HeroCoreLocData(
        region = RegNames.Normal["J,9"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["B,12"]: HeroCoreLocData(
        region = RegNames.Normal["B,12"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["J,12"]: HeroCoreLocData(
        region = RegNames.Normal["J,12"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["D,13"]: HeroCoreLocData(
        region = RegNames.Normal["D,13"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["I,14"]: HeroCoreLocData(
        region = RegNames.Normal["I,14"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Saves["F,2"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["J,3"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["M,4"]: HeroCoreLocData(
        region = RegNames.Normal["M,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["D,5"]: HeroCoreLocData(
        region = RegNames.Normal["D,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["G,5"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["N,5"]: HeroCoreLocData(
        region = RegNames.Normal["M,5"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["A,8"]: HeroCoreLocData(
        region = RegNames.Normal["A,7"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["F,8"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["L,8"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["N,9"]: HeroCoreLocData(
        region = RegNames.Normal["N,6"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["I,10"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["C,11"]: HeroCoreLocData(
        region = RegNames.Normal["B,9"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["G,11"]: HeroCoreLocData(
        region = RegNames.Normal["G,10"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["F,12"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["L,12"]: HeroCoreLocData(
        region = RegNames.Normal["L,11"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["D,15"]: HeroCoreLocData(
        region = RegNames.Normal["D,15"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["H,15"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["L,15"]: HeroCoreLocData(
        region = RegNames.Normal["L,13"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Doors["L,1"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["D,2"]: HeroCoreLocData(
        region = RegNames.Normal["D,2"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,2"]: HeroCoreLocData(
        region = RegNames.Normal["I,2"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["H,3"]: HeroCoreLocData(
        region = RegNames.Normal["H,3"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,3"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors,
        logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
    ),
    LocNames.Doors["A,4"]: HeroCoreLocData(
        region = RegNames.Normal["A,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["B,4"]: HeroCoreLocData(
        region = RegNames.Normal["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,4"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["N,4"]: HeroCoreLocData(
        region = RegNames.Normal["M,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,5"]: HeroCoreLocData(
        region = RegNames.Normal["I,5"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["L,5"]: HeroCoreLocData(
        region = RegNames.Normal["L,5"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["G,6"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["A,7"]: HeroCoreLocData(
        region = RegNames.Normal["A,7"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["B,7"]: HeroCoreLocData(
        region = RegNames.Normal["B,7"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["J,7"]: HeroCoreLocData(
        region = RegNames.Normal["J,7"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["K,7"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["M,7"]: HeroCoreLocData(
        region = RegNames.Normal["N,6"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["B,8"]: HeroCoreLocData(
        region = RegNames.Normal["B,8"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,8"]: HeroCoreLocData(
        region = RegNames.Normal["D,8"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["C,9"]: HeroCoreLocData(
        region = RegNames.Normal["C,9"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,9"]: HeroCoreLocData(
        region = RegNames.Normal["E,9"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["K,9"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["D,10"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["G,10"]: HeroCoreLocData(
        region = RegNames.Normal["G,10"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["J,10"]: HeroCoreLocData(
        region = RegNames.Normal["J,10"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["M,10"]: HeroCoreLocData(
        region = RegNames.Normal["N,6"],
        valid = lambda world: world.options.doors,
        logic = lambda world, state: (world.options.expel_skips or
                                      state.has(ItemNames.Suit, world.player, 2))
    ),
    LocNames.Doors["I,11"]: HeroCoreLocData(
        region = RegNames.Normal["I,11"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["J,11"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["L,11"]: HeroCoreLocData(
        region = RegNames.Normal["L,11"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["A,12"]: HeroCoreLocData(
        region = RegNames.Normal["A,10"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["H,12"]: HeroCoreLocData(
        region = RegNames.Normal["H,12"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,13"]: HeroCoreLocData(
        region = RegNames.Normal["E,13"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,13"]: HeroCoreLocData(
        region = RegNames.Normal["F,13"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,13"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["J,13"]: HeroCoreLocData(
        region = RegNames.Normal["L,11"],
        valid = lambda world: world.options.doors,
        logic = lambda world, state: (world.options.expel_skips or
                                      state.has(ItemNames.Suit, world.player, 2))
    ),
    LocNames.Doors["L,13"]: HeroCoreLocData(
        region = RegNames.Normal["L,13"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["D,14"]: HeroCoreLocData(
        region = RegNames.Normal["D,14"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,14"]: HeroCoreLocData(
        region = RegNames.Normal["E,14"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,14"]: HeroCoreLocData(
        region = RegNames.Normal["F,14"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["H,14"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,15"]: HeroCoreLocData(
        region = RegNames.Normal["D,15"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,15"]: HeroCoreLocData(
        region = RegNames.Normal["F,15"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,15"]: HeroCoreLocData(
        region = RegNames.Normal["J,14"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Battle_Doors["H,2"]: HeroCoreLocData(
        region = RegNames.Normal["H,2"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Battle_Doors["K,2"]: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Battle_Doors["B,6"]: HeroCoreLocData(
        region = RegNames.Normal["D,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.ShipScan: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.Zero: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.Speedrun: HeroCoreLocData(
        region = RegNames.Normal["D,1"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.Shapeshift: HeroCoreLocData(
        region = RegNames.Normal["J,6"],
        valid = lambda world: world.options.miscellaneous_locations,
        logic = lambda world, state: state.has_all_counts({ItemNames.Level: 10, ItemNames.Suit: 3}, world.player)
    ),
    LocNames.Expel: HeroCoreLocData(
        region = RegNames.Normal["O,12"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.Tetron: HeroCoreLocData(
        region = RegNames.Normal["H,8"],
        locked_item = lambda world: ItemNames.Victory
    )
}

locations_hard: Dict[str, HeroCoreLocData] = {
    LocNames.Powerups["H,5"]: HeroCoreLocData(
        region = RegNames.Hard["H,5"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blade
    ),
    LocNames.Powerups["N,9"]: HeroCoreLocData(
        region = RegNames.Hard["N,9"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blade
    ),
    LocNames.Powerups["L,7"]: HeroCoreLocData(
        region = RegNames.Hard["K,7"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Suit
    ),
    LocNames.Powerups["B,5"]: HeroCoreLocData(
        region = RegNames.Hard["B,5"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blaster,
        locked_item_class = lambda world: ItemClassification.useful
    ),
    LocNames.Powerups["I,14"]: HeroCoreLocData(
        region = RegNames.Hard["I,14"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blaster,
        locked_item_class = lambda world: ItemClassification.useful
    ),
    LocNames.Powerups["F,15"]: HeroCoreLocData(
        region = RegNames.Hard["F,15"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Blade
    ),
    LocNames.Powerups["O,12"]: HeroCoreLocData(
        region = RegNames.Hard["O,12"],
        locked_item = lambda world: (None if (world.options.powerups or world.options.save_points.value == 2)
                                     else ItemNames.Scanner)
    ),
    LocNames.Powerups["A,12"]: HeroCoreLocData(
        region = RegNames.Hard["A,11"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Suit
    ),
    LocNames.Powerups["J,2"]: HeroCoreLocData(
        region = RegNames.Hard["J,2"],
        locked_item = lambda world: None if world.options.powerups else ItemNames.Suit
    ),
    LocNames.Level_Ups["H,5"]: HeroCoreLocData(
        region = RegNames.Hard["H,5"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["N,9"]: HeroCoreLocData(
        region = RegNames.Hard["N,9"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["L,7"]: HeroCoreLocData(
        region = RegNames.Hard["K,7"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["B,5"]: HeroCoreLocData(
        region = RegNames.Hard["B,5"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["I,14"]: HeroCoreLocData(
        region = RegNames.Hard["I,14"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["F,15"]: HeroCoreLocData(
        region = RegNames.Hard["F,15"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["O,12"]: HeroCoreLocData(
        region = RegNames.Hard["O,12"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["A,12"]: HeroCoreLocData(
        region = RegNames.Hard["A,11"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Level_Ups["J,2"]: HeroCoreLocData(
        region = RegNames.Hard["J,2"],
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level
    ),
    LocNames.Eliminator: HeroCoreLocData(
        region = RegNames.Menu,
        logic = lambda world, state: state.has(ItemNames.Level, world.player, 9),
        locked_item = lambda world: None if world.options.level_ups else ItemNames.Level,
    ),
    LocNames.Generators["E,3"]: HeroCoreLocData(
        region = RegNames.Hard["E,1"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["E,3"]
    ),
    LocNames.Generators["H,4"]: HeroCoreLocData(
        region = RegNames.Hard["G,2"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["H,4"]
    ),
    LocNames.Generators["M,4"]: HeroCoreLocData(
        region = RegNames.Hard["J,4"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["M,4"]
    ),
    LocNames.Generators["C,6"]: HeroCoreLocData(
        region = RegNames.Hard["C,6"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["C,6"]
    ),
    LocNames.Generators["I,7"]: HeroCoreLocData(
        region = RegNames.Hard["I,7"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["I,7"]
    ),
    LocNames.Generators["A,9"]: HeroCoreLocData(
        region = RegNames.Hard["A,9"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["A,9"]
    ),
    LocNames.Generators["L,10"]: HeroCoreLocData(
        region = RegNames.Hard["L,10"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["L,10"]
    ),
    LocNames.Generators["B,11"]: HeroCoreLocData(
        region = RegNames.Hard["B,11"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["B,11"]
    ),
    LocNames.Generators["H,14"]: HeroCoreLocData(
        region = RegNames.Hard["H,13"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["H,14"]
    ),
    LocNames.Generators["L,15"]: HeroCoreLocData(
        region = RegNames.Hard["L,15"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["L,15"]
    ),
    LocNames.Computers["J,3"]: HeroCoreLocData(
        region = RegNames.Hard["J,3"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["N,4"]: HeroCoreLocData(
        region = RegNames.Hard["N,4"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["I,6"]: HeroCoreLocData(
        region = RegNames.Hard["I,6"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["F,7"]: HeroCoreLocData(
        region = RegNames.Hard["F,7"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["K,8"]: HeroCoreLocData(
        region = RegNames.Hard["K,8"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["M,10"]: HeroCoreLocData(
        region = RegNames.Hard["M,10"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["B,12"]: HeroCoreLocData(
        region = RegNames.Hard["B,12"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["I,12"]: HeroCoreLocData(
        region = RegNames.Hard["I,12"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["K,12"]: HeroCoreLocData(
        region = RegNames.Hard["K,12"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["F,13"]: HeroCoreLocData(
        region = RegNames.Hard["F,13"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Saves["G,1"]: HeroCoreLocData(
        region = RegNames.Hard["G,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["K,1"]: HeroCoreLocData(
        region = RegNames.Hard["J,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["E,2"]: HeroCoreLocData(
        region = RegNames.Hard["E,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["G,3"]: HeroCoreLocData(
        region = RegNames.Hard["G,2"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["J,4"]: HeroCoreLocData(
        region = RegNames.Hard["J,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["C,5"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["N,5"]: HeroCoreLocData(
        region = RegNames.Hard["N,5"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["H,6"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["E,8"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["J,8"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["O,8"]: HeroCoreLocData(
        region = RegNames.Hard["O,8"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["B,10"]: HeroCoreLocData(
        region = RegNames.Hard["A,10"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["E,11"]: HeroCoreLocData(
        region = RegNames.Hard["E,10"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["J,11"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["M,11"]: HeroCoreLocData(
        region = RegNames.Hard["M,11"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["G,12"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["D,14"]: HeroCoreLocData(
        region = RegNames.Hard["D,14"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["J,15"]: HeroCoreLocData(
        region = RegNames.Hard["J,14"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Doors["J,1"]: HeroCoreLocData(
        region = RegNames.Hard["J,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["L,1"]: HeroCoreLocData(
        region = RegNames.Hard["J,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["H,2"]: HeroCoreLocData(
        region = RegNames.Hard["G,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["J,2"]: HeroCoreLocData(
        region = RegNames.Hard["J,2"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["K,2"]: HeroCoreLocData(
        region = RegNames.Hard["K,2"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["L,2"]: HeroCoreLocData(
        region = RegNames.Hard["L,2"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["K,3"]: HeroCoreLocData(
        region = RegNames.Hard["K,3"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["B,4"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,4"]: HeroCoreLocData(
        region = RegNames.Hard["G,2"],
        valid = lambda world: world.options.doors,
        logic = lambda world, state: (world.options.expel_skips or state.has(ItemNames.Suit, world.player, 2))
    ),
    LocNames.Doors["A,5"]: HeroCoreLocData(
        region = RegNames.Hard["A,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["B,5"]: HeroCoreLocData(
        region = RegNames.Hard["B,5"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,5"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,5"]: HeroCoreLocData(
        region = RegNames.Hard["F,5"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["H,5"]: HeroCoreLocData(
        region = RegNames.Hard["H,5"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,5"]: HeroCoreLocData(
        region = RegNames.Hard["I,5"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["L,5"]: HeroCoreLocData(
        region = RegNames.Hard["J,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["B,6"]: HeroCoreLocData(
        region = RegNames.Hard["A,6"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,6"]: HeroCoreLocData(
        region = RegNames.Hard["F,6"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["G,6"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["M,6"]: HeroCoreLocData(
        region = RegNames.Hard["J,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["A,7"]: HeroCoreLocData(
        region = RegNames.Hard["A,7"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["H,7"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["L,7"]: HeroCoreLocData(
        region = RegNames.Hard["K,7"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["O,7"]: HeroCoreLocData(
        region = RegNames.Hard["N,5"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["A,8"]: HeroCoreLocData(
        region = RegNames.Hard["A,8"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["C,8"]: HeroCoreLocData(
        region = RegNames.Hard["B,8"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["L,8"]: HeroCoreLocData(
        region = RegNames.Hard["L,8"],
        valid = lambda world: world.options.doors,
        logic = lambda world, state: state.has(ItemNames.Suit, world.player, 2)
    ),
    LocNames.Doors["N,8"]: HeroCoreLocData(
        region = RegNames.Hard["N,5"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,9"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["N,9"]: HeroCoreLocData(
        region = RegNames.Hard["N,9"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["O,9"]: HeroCoreLocData(
        region = RegNames.Hard["O,9"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["C,10"]: HeroCoreLocData(
        region = RegNames.Hard["C,10"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["O,10"]: HeroCoreLocData(
        region = RegNames.Hard["O,10"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["C,11"]: HeroCoreLocData(
        region = RegNames.Hard["C,11"],
        valid = lambda world: world.options.doors,
        logic = lambda world, state: (state.has(ItemNames.Blade, world.player, 2) or
                                      state.has(ItemNames.Barriers["B,11"], world.player))
    ),
    LocNames.Doors["N,11"]: HeroCoreLocData(
        region = RegNames.Hard["N,11"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["O,11"]: HeroCoreLocData(
        region = RegNames.Hard["O,11"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["A,12"]: HeroCoreLocData(
        region = RegNames.Hard["A,11"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["C,12"]: HeroCoreLocData(
        region = RegNames.Hard["C,12"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["D,12"]: HeroCoreLocData(
        region = RegNames.Hard["D,12"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,12"]: HeroCoreLocData(
        region = RegNames.Hard["E,10"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["H,12"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["N,12"]: HeroCoreLocData(
        region = RegNames.Hard["N,12"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["O,12"]: HeroCoreLocData(
        region = RegNames.Hard["O,12"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,13"]: HeroCoreLocData(
        region = RegNames.Hard["D,13"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,13"]: HeroCoreLocData(
        region = RegNames.Hard["I,13"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,14"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,14"]: HeroCoreLocData(
        region = RegNames.Hard["I,14"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["K,14"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,15"]: HeroCoreLocData(
        region = RegNames.Hard["D,14"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,15"]: HeroCoreLocData(
        region = RegNames.Hard["F,15"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["K,15"]: HeroCoreLocData(
        region = RegNames.Hard["J,14"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Battle_Doors["O,4"]: HeroCoreLocData(
        region = RegNames.Hard["O,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Battle_Doors["J,7"]: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.ShipScan: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.Zero: HeroCoreLocData(
        region = RegNames.Hard["B,4"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.Expel: HeroCoreLocData(
        region = RegNames.Hard["D,1"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.Shapeshift: HeroCoreLocData(
        region = RegNames.Hard["K,3"],
        valid = lambda world: world.options.miscellaneous_locations,
        logic = lambda world, state: state.has_all_counts({ItemNames.Suit: 3, ItemNames.Level: 10}, world.player)
    ),
    LocNames.Speedrun: HeroCoreLocData(
        region = RegNames.Hard["J,4"],
        valid = lambda world: world.options.miscellaneous_locations,
        logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["M,6"], world.player))
    ),
    LocNames.Flower: HeroCoreLocData(
        region = RegNames.Hard["A,10"],
        valid = lambda world: world.options.miscellaneous_locations,
        logic = lambda world, state: state.has(ItemNames.Barriers["A,9"], world.player)
    ),
    LocNames.Tetron: HeroCoreLocData(
        region = RegNames.Hard["H,8"],
        locked_item = lambda world: ItemNames.Victory
    )
}

locations_annihilation: Dict[str, HeroCoreLocData] = {
    LocNames.Generators["H,1"]: HeroCoreLocData(
        region = RegNames.Annihilation["H,1"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["H,1"]
    ),
    LocNames.Generators["J,2"]: HeroCoreLocData(
        region = RegNames.Annihilation["J,2"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["J,2"]
    ),
    LocNames.Generators["G,4"]: HeroCoreLocData(
        region = RegNames.Annihilation["G,4"],
        locked_item = lambda world: None if world.options.generators else ItemNames.Barriers["G,4"]
    ),
    LocNames.Computers["K,1"]: HeroCoreLocData(
        region = RegNames.Annihilation["I,1"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["D,2"]: HeroCoreLocData(
        region = RegNames.Annihilation["E,1"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["H,2"]: HeroCoreLocData(
        region = RegNames.Annihilation["G,2"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["F,3"]: HeroCoreLocData(
        region = RegNames.Annihilation["G,2"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["H,3"]: HeroCoreLocData(
        region = RegNames.Annihilation["G,2"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["L,3"]: HeroCoreLocData(
        region = RegNames.Annihilation["L,1"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["D,4"]: HeroCoreLocData(
        region = RegNames.Annihilation["D,4"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["K,4"]: HeroCoreLocData(
        region = RegNames.Annihilation["H,4"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["H,5"]: HeroCoreLocData(
        region = RegNames.Annihilation["G,5"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Computers["K,5"]: HeroCoreLocData(
        region = RegNames.Annihilation["I,5"],
        locked_item = lambda world: None if world.options.computers else ItemNames.Computer,
        locked_item_class = lambda world: (ItemClassification.progression if world.options.goal_computers.value >= 1
                                           else ItemClassification.filler)
    ),
    LocNames.Saves["I,1"]: HeroCoreLocData(
        region = RegNames.Annihilation["I,1"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["A,3"]: HeroCoreLocData(
        region = RegNames.Annihilation["A,3"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["G,3"]: HeroCoreLocData(
        region = RegNames.Annihilation["G,2"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["L,4"]: HeroCoreLocData(
        region = RegNames.Annihilation["H,4"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["G,5"]: HeroCoreLocData(
        region = RegNames.Annihilation["G,5"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Saves["J,5"]: HeroCoreLocData(
        region = RegNames.Annihilation["I,5"],
        valid = lambda world: world.options.save_points
    ),
    LocNames.Doors["G,1"]: HeroCoreLocData(
        region = RegNames.Annihilation["E,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,2"]: HeroCoreLocData(
        region = RegNames.Annihilation["F,2"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["K,2"]: HeroCoreLocData(
        region = RegNames.Annihilation["I,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["M,2"]: HeroCoreLocData(
        region = RegNames.Annihilation["L,1"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["D,3"]: HeroCoreLocData(
        region = RegNames.Annihilation["A,3"],
        valid = lambda world: world.options.doors,
        locked_item = lambda world: None if world.options.save_points else ItemNames.Doors["D,3"]
    ),
    LocNames.Doors["K,3"]: HeroCoreLocData(
        region = RegNames.Annihilation["K,3"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["M,3"]: HeroCoreLocData(
        region = RegNames.Annihilation["M,3"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["E,4"]: HeroCoreLocData(
        region = RegNames.Annihilation["E,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["H,4"]: HeroCoreLocData(
        region = RegNames.Annihilation["H,4"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["F,5"]: HeroCoreLocData(
        region = RegNames.Annihilation["E,5"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["H,6"]: HeroCoreLocData(
        region = RegNames.Annihilation["H,6"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Doors["I,6"]: HeroCoreLocData(
        region = RegNames.Annihilation["I,6"],
        valid = lambda world: world.options.doors
    ),
    LocNames.Battle_Doors["E,3"]: HeroCoreLocData(
        region = RegNames.Annihilation["E,3"],
        valid = lambda world: world.options.doors,
        locked_item = lambda world: None if world.options.save_points else ItemNames.Battle_Doors["E,3"]
    ),
    LocNames.ShipScan: HeroCoreLocData(
        region = RegNames.Annihilation["L,1"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.Shapeshift: HeroCoreLocData(
        region = RegNames.Annihilation["L,1"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.Grave: HeroCoreLocData(
        region = RegNames.Annihilation["G,5"],
        valid = lambda world: world.options.miscellaneous_locations
    ),
    LocNames.WarMachine: HeroCoreLocData(
        region = RegNames.Annihilation["L,5"],
        locked_item = lambda world: ItemNames.Victory
    )
}