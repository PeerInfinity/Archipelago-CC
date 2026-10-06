from typing import Callable, Dict, List, TYPE_CHECKING, NamedTuple
from BaseClasses import CollectionState
from ..Names import RegNames, ItemNames

if TYPE_CHECKING:
	from .. import HeroCoreWorld

class ExitData(NamedTuple):
	valid: Callable[["HeroCoreWorld"], bool] = lambda world: True
	logic: Callable[["HeroCoreWorld", CollectionState], bool] = lambda world, state: True

region_exit_table_normal: Dict[str, Dict[str, ExitData]] = {
	RegNames.Menu: {
		RegNames.Normal["L,13"]: ExitData(),
		RegNames.Normal["A,7"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["A,8"]], world.player)
		),
		RegNames.Normal["B,9"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["C,11"]], world.player)
		),
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: state.has_any([
				ItemNames.Scanner,
				ItemNames.Saves["F,2"],
				ItemNames.Saves["F,8"],
				ItemNames.Saves["F,12"],
				ItemNames.Saves["G,5"],
				ItemNames.Saves["H,15"],
				ItemNames.Saves["I,10"],
				ItemNames.Saves["J,3"],
				ItemNames.Saves["L,8"]
				], world.player)
		),
		RegNames.Normal["D,4"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["D,5"]], world.player)
		),
		RegNames.Normal["D,15"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["D,15"]], world.player)
		),
		RegNames.Normal["G,10"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["G,11"]], world.player)
		),
		RegNames.Normal["L,11"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["L,12"]], world.player)
		),
		RegNames.Normal["M,4"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["M,4"]], world.player)
		),
		RegNames.Normal["M,5"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["N,5"]], world.player)
		),
		RegNames.Normal["N,6"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["N,9"]], world.player)
		)
	},
	RegNames.Normal["A,4"]: {},
	RegNames.Normal["A,7"]: {
		RegNames.Normal["A,10"]: ExitData(
			logic = lambda world, state: state.has_all_counts({ItemNames.Blade: 2, ItemNames.Suit: 2}, world.player)
		),
		RegNames.Normal["B,7"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["A,7"], world.player))
		),
		RegNames.Normal["B,8"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["B,8"], world.player)
		)
	},
	RegNames.Normal["A,10"]: {
		RegNames.Normal["A,7"]: ExitData(
			logic = lambda world, state: state.has_all_counts({ItemNames.Blade: 2, ItemNames.Suit: 2}, world.player)
		),
		RegNames.Normal["B,9"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["B,9"], world.player)
		),
		RegNames.Normal["B,12"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["A,12"], world.player))
		)
	},
	RegNames.Normal["B,4"]: {
		RegNames.Normal["A,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["B,4"], world.player))
		)
	},
	RegNames.Normal["B,7"]: {
		RegNames.Normal["A,7"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["B,7"], world.player))
		),
		RegNames.Normal["C,7"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["B,7"], world.player))
		)
	},
	RegNames.Normal["B,8"]: {
		RegNames.Normal["A,7"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["B,8"], world.player))
		),
		RegNames.Normal["C,9"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["C,9"], world.player)
		)
	},
	RegNames.Normal["B,9"]: {
		RegNames.Normal["A,10"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["B,9"], world.player)
		),
		RegNames.Normal["C,9"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["B,9"], world.player)
		),
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["D,11"], world.player)
		)
	},
	RegNames.Normal["B,12"]: {},
	RegNames.Normal["C,6"]: {},
	RegNames.Normal["C,7"]: {
		RegNames.Normal["B,7"]: ExitData(),
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		)
	},
	RegNames.Normal["C,9"]: {
		RegNames.Normal["B,8"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["C,9"], world.player))
		),
		RegNames.Normal["B,9"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["B,9"], world.player)
		)
	},
	RegNames.Normal["D,1"]: {
		RegNames.Normal["B,9"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["D,11"], world.player)
		),
		RegNames.Normal["C,7"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		),
		RegNames.Normal["D,2"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 1)
		),
		RegNames.Normal["D,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["E,3"], world.player)
		),
		RegNames.Normal["D,8"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		),
		RegNames.Normal["D,11"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["D,10"], world.player))
		),
		RegNames.Normal["E,3"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,4"], world.player))
		),
		RegNames.Normal["F,13"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		),
		RegNames.Normal["H,3"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Blade, world.player, 3) or
								 state.has(ItemNames.Barriers["I,4"], world.player))
		),
		RegNames.Normal["H,8"]: ExitData(
			logic = lambda world, state: state.has_all_counts({ItemNames.Barriers["G,9"]: 1,
													  ItemNames.Computer: world.options.goal_computers.value},
													  world.player)
		),
		RegNames.Normal["H,11"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,11"], world.player)
		),
		RegNames.Normal["H,12"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		),
		RegNames.Normal["I,5"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		),
		RegNames.Normal["I,14"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["I,13"], world.player))
		),
		RegNames.Normal["J,7"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["K,7"], world.player))
		),
		RegNames.Normal["J,9"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["K,9"], world.player))
		),
		RegNames.Normal["J,10"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["J,11"], world.player))
		),
		RegNames.Normal["J,12"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["J,11"], world.player))
		),
		RegNames.Normal["J,14"]: ExitData(),
		RegNames.Normal["L,2"]: ExitData(
			logic = lambda world, state: (not world.options.doors or
								 state.has(ItemNames.Battle_Doors["K,2"], world.player))
		),
		RegNames.Normal["L,4"]: ExitData(),
		RegNames.Normal["L,11"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 1)
		),
		RegNames.Normal["N,6"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Blade, ItemNames.Doors["M,10"]], world.player)
		),
	},
	RegNames.Normal["D,2"]: {
		RegNames.Normal["D,3"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["D,2"], world.player))
		)
	},
	RegNames.Normal["D,3"]: {},
	RegNames.Normal["D,4"]: {
		RegNames.Normal["B,4"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Blade, world.player, 2) or
								 state.has(ItemNames.Barriers["C,6"], world.player))
		),
		RegNames.Normal["C,6"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Barriers["C,6"], ItemNames.Battle_Doors["B,6"]],
											  world.player)
		),
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["E,3"], world.player)
		)
	},
	RegNames.Normal["D,8"]: {
		RegNames.Normal["E,9"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,8"], world.player))
		)
	},
	RegNames.Normal["D,9"]: {},
	RegNames.Normal["D,11"]: {},
	RegNames.Normal["D,13"]: {},
	RegNames.Normal["D,14"]: {
		RegNames.Normal["D,13"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["D,14"], world.player))
		)
	},
	RegNames.Normal["D,15"]: {
		RegNames.Normal["F,15"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,15"], world.player))
		)
	},
	RegNames.Normal["E,3"]: {},
	RegNames.Normal["E,9"]: {
		RegNames.Normal["D,9"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,9"], world.player))
		)
	},
	RegNames.Normal["E,13"]: {
		RegNames.Normal["E,14"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,13"], world.player))
		)
	},
	RegNames.Normal["E,14"]: {
		RegNames.Normal["D,14"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,14"], world.player))
		)
	},
	RegNames.Normal["F,13"]: {
		RegNames.Normal["E,13"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["F,13"], world.player))
		)
	},
	RegNames.Normal["F,14"]: {},
	RegNames.Normal["F,15"]: {
		RegNames.Normal["F,14"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["F,15"], world.player))
		)
	},
	RegNames.Normal["G,10"]: {
		RegNames.Normal["H,11"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,11"], world.player)
		)
	},
	RegNames.Normal["H,2"]: {
		RegNames.Normal["I,2"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Battle_Doors["H,2"],
																	  world.player))
		)
	},
	RegNames.Normal["H,3"]: {
		RegNames.Normal["H,2"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["H,3"], world.player))
		)
	},
	RegNames.Normal["H,8"]: {},
	RegNames.Normal["H,11"]: {
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,11"], world.player)
		),
		RegNames.Normal["G,10"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,11"], world.player)
		),
		RegNames.Normal["I,11"]: ExitData()
	},
	RegNames.Normal["H,12"]: {
		RegNames.Normal["D,1"]: ExitData(),
		RegNames.Normal["I,11"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["H,12"], world.player))
		)
	},
	RegNames.Normal["I,2"]: {},
	RegNames.Normal["I,5"]: {
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		),
		RegNames.Normal["I,6"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["I,5"], world.player))
		),
		RegNames.Normal["J,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		)
	},
	RegNames.Normal["I,6"]: {},
	RegNames.Normal["I,11"]: {
		RegNames.Normal["H,11"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["I,11"], world.player))
		),
		RegNames.Normal["H,12"]: ExitData()
	},
	RegNames.Normal["I,14"]: {},
	RegNames.Normal["J,4"]: {
		RegNames.Normal["I,5"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		),
		RegNames.Normal["J,6"]: ExitData(),
		RegNames.Normal["L,5"]: ExitData()
	},
	RegNames.Normal["J,6"]: {},
	RegNames.Normal["J,7"]: {},
	RegNames.Normal["J,9"]: {},
	RegNames.Normal["J,10"]: {},
	RegNames.Normal["J,12"]: {},
	RegNames.Normal["J,14"]: {
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["I,15"], world.player))
		),
		RegNames.Normal["L,11"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["J,13"], world.player)
		)
	},
	RegNames.Normal["L,2"]: {},
	RegNames.Normal["L,4"]: {
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["K,4"], world.player)
		),
		RegNames.Normal["L,5"]: ExitData()
	},
	RegNames.Normal["L,5"]: {
		RegNames.Normal["J,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["L,5"], world.player))
		),
		RegNames.Normal["L,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["L,5"], world.player))
		),
		RegNames.Normal["M,5"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["L,5"], world.player))
		)
	},
	RegNames.Normal["L,11"]: {
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 1)
		),
		RegNames.Normal["J,14"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Doors["J,13"], world.player) or
								 (not world.options.doors and (world.options.expel_skips or state.has(ItemNames.Suit, world.player, 2))))
		),
		RegNames.Normal["N,6"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Blade, ItemNames.Barriers["M,11"]], world.player)
		),
		RegNames.Normal["M,11"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["L,11"], world.player))
		)
	},
	RegNames.Normal["L,13"]: {
		RegNames.Normal["J,14"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		),
		RegNames.Normal["L,11"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["L,13"], world.player))
		)
	},
	RegNames.Normal["M,4"]: {
		RegNames.Normal["O,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["N,4"], world.player))
		)
	},
	RegNames.Normal["M,5"]: {
		RegNames.Normal["L,5"]: ExitData(),
		RegNames.Normal["N,6"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Barriers["M,6"], world.player) or
								 state.has(ItemNames.Blade, world.player, 2))
		)
	},
	RegNames.Normal["M,6"]: {},
	RegNames.Normal["M,11"]: {},
	RegNames.Normal["N,6"]: {
		RegNames.Normal["D,1"]: ExitData(
			logic = lambda world, state: (state.has_any([ItemNames.Blade, ItemNames.Doors["M,10"]], world.player) or
								 (not world.options.doors and (world.options.expel_skips or state.has(ItemNames.Suit, world.player, 2))))
		),
		RegNames.Normal["L,11"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Blade, ItemNames.Barriers["M,11"]], world.player)
		),
		RegNames.Normal["M,5"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Barriers["M,6"], world.player) or
								 state.has(ItemNames.Blade, world.player, 2))
		),
		RegNames.Normal["M,6"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["M,7"], world.player))
		),
		RegNames.Normal["O,12"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		)
	},
	RegNames.Normal["O,4"]: {
		RegNames.Normal["M,5"]: ExitData()
	},
	RegNames.Normal["O,12"]: {}
}

region_exit_table_hard: Dict[str, Dict[str, ExitData]] = {
	RegNames.Menu: {
		RegNames.Hard["A,10"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["B,10"]], world.player)
		),
		RegNames.Hard["B,4"]: ExitData(
			logic = lambda world, state: state.has_any([
				ItemNames.Scanner,
				ItemNames.Saves["C,5"],
				ItemNames.Saves["E,8"],
				ItemNames.Saves["G,12"],
				ItemNames.Saves["H,6"],
				ItemNames.Saves["J,8"],
				ItemNames.Saves["J,11"]
			], world.player),
		),
		RegNames.Hard["D,14"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["D,14"]], world.player)
		),
		RegNames.Hard["E,10"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["E,11"]], world.player)
		),
		RegNames.Hard["G,1"]: ExitData(),
		RegNames.Hard["G,2"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["G,3"]], world.player)
		),
		RegNames.Hard["J,1"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["K,1"]], world.player)
		),
		RegNames.Hard["J,4"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["J,4"]], world.player)
		),
		RegNames.Hard["J,14"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["J,15"]], world.player)
		),
		RegNames.Hard["M,11"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["M,11"]], world.player)
		),
		RegNames.Hard["N,5"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["N,5"]], world.player)
		),
		RegNames.Hard["O,8"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Scanner, ItemNames.Saves["O,8"]], world.player)
		),
	},
	RegNames.Hard["A,4"]: {
		RegNames.Hard["A,6"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["A,5"], world.player))
		)
	},
	RegNames.Hard["A,6"]: {
		RegNames.Hard["A,4"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["A,5"], world.player)
		),
		RegNames.Hard["C,6"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["B,6"], world.player))
		)
	},
	RegNames.Hard["A,7"]: {
		RegNames.Hard["A,8"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["A,7"], world.player))
		)
	},
	RegNames.Hard["A,8"]: {
		RegNames.Hard["A,7"]: ExitData(),
		RegNames.Hard["A,9"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["A,8"], world.player))
		)
	},
	RegNames.Hard["A,9"]: {
		RegNames.Hard["A,8"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["A,8"], world.player)
		)
	},
	RegNames.Hard["A,10"]: {
		RegNames.Hard["A,11"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["A,9"], world.player)
		),
		RegNames.Hard["B,8"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["B,11"], world.player)
		),
		RegNames.Hard["C,10"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["C,10"], world.player)
		)
	},
	RegNames.Hard["A,11"]: {},
	RegNames.Hard["B,4"]: {
		RegNames.Hard["A,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["B,4"], world.player))
		),
		RegNames.Hard["B,5"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["C,6"], world.player)
		),
		RegNames.Hard["C,6"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["C,6"], world.player)
		),
		RegNames.Hard["D,14"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["F,14"], world.player))
		),
		RegNames.Hard["E,1"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Blade, ItemNames.Barriers["E,3"]], world.player)
		),
		RegNames.Hard["E,10"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		),
		RegNames.Hard["F,5"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,5"], world.player))
		),
		RegNames.Hard["G,5"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["G,6"], world.player))
		),
		RegNames.Hard["H,8"]: ExitData(
			logic = lambda world, state: state.has_all_counts({ItemNames.Barriers["I,7"]: 1,
													  ItemNames.Computer: world.options.goal_computers.value}, world.player)
		),
		RegNames.Hard["H,13"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["H,12"], world.player))
		),
		RegNames.Hard["I,7"]: ExitData(
			logic = lambda world, state: (not world.options.doors or
								 state.has_any([ItemNames.Doors["H,7"], ItemNames.Barriers["I,7"]], world.player))
		),
		RegNames.Hard["J,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 1)
		),
		RegNames.Hard["J,14"]: ExitData(
			logic = lambda world, state: (not world.options.doors or
								 state.has(ItemNames.Doors["K,14"], world.player) or
								 state.has(ItemNames.Blade, world.player, 3))
		),
		RegNames.Hard["K,7"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Battle_Doors["J,7"], world.player))
		),
		RegNames.Hard["K,12"]: ExitData(
			logic = lambda world, state: state.has_all_counts({ItemNames.Suit: 2, ItemNames.Blade: 3}, world.player)
		),
		RegNames.Hard["L,10"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Barriers["L,10"], ItemNames.Barriers["L,15"]], world.player)
		),
		RegNames.Hard["L,15"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["L,15"], world.player)
		),
		RegNames.Hard["N,9"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		)
	},
	RegNames.Hard["B,5"]: {},
	RegNames.Hard["B,8"]: {
		RegNames.Hard["A,7"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["C,8"], world.player))
		)
	},
	RegNames.Hard["B,11"]: {},
	RegNames.Hard["B,12"]: {},
	RegNames.Hard["C,6"]: {
		RegNames.Hard["A,6"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["B,6"], world.player)
		)
	},
	RegNames.Hard["C,10"]: {
		RegNames.Hard["A,10"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["C,10"], world.player))
		),
		RegNames.Hard["E,10"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		)
	},
	RegNames.Hard["C,11"]: {
		RegNames.Hard["B,11"]: ExitData(
			logic = lambda world, state: ((not world.options.doors or state.has(ItemNames.Doors["C,11"], world.player)) and
								 (state.has(ItemNames.Barriers["B,11"], world.player) or state.has(ItemNames.Blade, world.player, 2)))
		)
	},
	RegNames.Hard["C,12"]: {
		RegNames.Hard["B,12"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["C,12"], world.player))
		)
	},
	RegNames.Hard["D,1"]: {},
	RegNames.Hard["D,12"]: {
		RegNames.Hard["C,12"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["D,12"], world.player))
		)
	},
	RegNames.Hard["D,13"]: {
		RegNames.Hard["F,13"]: ExitData(
			logic = lambda world, state: ((not world.options.doors or state.has(ItemNames.Doors["E,13"], world.player)) and
								 state.has(ItemNames.Blade, world.player, 2))
		)
	},
	RegNames.Hard["D,14"]: {
		RegNames.Hard["B,4"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["F,14"], world.player)
		),
		RegNames.Hard["D,13"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		),
		RegNames.Hard["F,15"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,15"], world.player))
		)
	},
	RegNames.Hard["E,1"]: {
		RegNames.Hard["B,4"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Blade, ItemNames.Barriers["E,3"]], world.player)
		),
		RegNames.Hard["D,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		),
		RegNames.Hard["G,2"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,4"], world.player)
		)
	},
	RegNames.Hard["E,10"]: {
		RegNames.Hard["B,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		),
		RegNames.Hard["C,10"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		),
		RegNames.Hard["C,11"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 3)
		),
		RegNames.Hard["D,12"]: ExitData(
			logic = lambda world, state: ((not world.options.doors or state.has(ItemNames.Doors["E,12"], world.player)) and
								 state.has(ItemNames.Blade, world.player, 3))
		)
	},
	RegNames.Hard["F,5"]: {
		RegNames.Hard["F,6"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["F,5"], world.player))
		)
	},
	RegNames.Hard["F,6"]: {
		RegNames.Hard["F,7"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["F,6"], world.player))
		)
	},
	RegNames.Hard["F,7"]: {},
	RegNames.Hard["F,13"]: {},
	RegNames.Hard["F,15"]: {},
	RegNames.Hard["G,1"]: {
		RegNames.Hard["G,2"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["H,2"], world.player))
		)
	},
	RegNames.Hard["G,2"]: {
		RegNames.Hard["E,1"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Barriers["H,4"], world.player) or
								 state.has(ItemNames.Saves["E,2"], world.player))
		),
		RegNames.Hard["I,5"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Doors["I,4"], world.player) or
								 (not world.options.doors and (world.options.expel_skips or state.has(ItemNames.Suit, world.player))))
		),
		RegNames.Hard["J,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,4"], world.player)
		)
	},
	RegNames.Hard["G,5"]: {
		RegNames.Hard["B,4"]: ExitData(),
		RegNames.Hard["H,5"]: ExitData()
	},
	RegNames.Hard["H,5"]: {
		RegNames.Hard["G,5"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["H,5"], world.player))
		),
		RegNames.Hard["I,5"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["H,5"], world.player))
		)
	},
	RegNames.Hard["H,8"]: {},
	RegNames.Hard["H,13"]: {
		RegNames.Hard["I,13"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,14"], world.player)
		)
	},
	RegNames.Hard["I,5"]: {
		RegNames.Hard["G,2"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["I,4"], world.player)
		),
		RegNames.Hard["H,5"]: ExitData(),
		RegNames.Hard["I,6"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["I,5"], world.player))
		)
	},
	RegNames.Hard["I,6"]: {},
	RegNames.Hard["I,7"]: {},
	RegNames.Hard["I,12"]: {},
	RegNames.Hard["I,13"]: {
		RegNames.Hard["I,12"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["I,13"], world.player))
		),
		RegNames.Hard["I,14"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["I,13"], world.player))
		)
	},
	RegNames.Hard["I,14"]: {},
	RegNames.Hard["J,1"]: {
		RegNames.Hard["J,2"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["J,1"], world.player))
		),
		RegNames.Hard["L,2"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["L,1"], world.player))
		)
	},
	RegNames.Hard["J,2"]: {},
	RegNames.Hard["J,3"]: {},
	RegNames.Hard["J,4"]: {
		RegNames.Hard["B,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 1)
		),
		RegNames.Hard["G,2"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,4"], world.player)
		),
		RegNames.Hard["N,5"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Blade, world.player, 2) or
								 state.has(ItemNames.Barriers["M,4"], world.player))
		)
	},
	RegNames.Hard["J,14"]: {
		RegNames.Hard["B,4"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Blade, world.player, 3) or
								 state.has(ItemNames.Doors["K,14"], world.player))
		),
		RegNames.Hard["L,15"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["K,15"], world.player))
		)
	},
	RegNames.Hard["K,2"]: {
		RegNames.Hard["K,3"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["K,2"], world.player))
		)
	},
	RegNames.Hard["K,3"]: {
		RegNames.Hard["J,3"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["K,3"], world.player))
		)
	},
	RegNames.Hard["K,7"]: {
		RegNames.Hard["L,8"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["L,7"], world.player))
		)
	},
	RegNames.Hard["K,8"]: {},
	RegNames.Hard["K,12"]: {},
	RegNames.Hard["L,2"]: {
		RegNames.Hard["K,2"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["L,2"], world.player))
		)
	},
	RegNames.Hard["L,8"]: {
		RegNames.Hard["K,8"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["L,8"], world.player))
		)
	},
	RegNames.Hard["L,10"]: {
		RegNames.Hard["B,4"]: ExitData(
			logic = lambda world, state: state.has_any([ItemNames.Barriers["L,10"], ItemNames.Barriers["L,15"]], world.player)
		),
		RegNames.Hard["M,10"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Barriers["L,10"], world.player) and state.has(ItemNames.Blade, world.player, 2))
		),
		RegNames.Hard["M,11"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		)
	},
	RegNames.Hard["L,15"]: {
		RegNames.Hard["B,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["L,15"], world.player)
		),
		RegNames.Hard["J,14"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["K,15"], world.player)
		)
	},
	RegNames.Hard["M,10"]: {},
	RegNames.Hard["M,11"]: {
		RegNames.Hard["L,10"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Blade, world.player, 2)
		),
		RegNames.Hard["N,11"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["N,11"], world.player)
		),
		RegNames.Hard["O,11"]: ExitData()
	},
	RegNames.Hard["N,4"]: {},
	RegNames.Hard["N,5"]: {
		RegNames.Hard["J,4"]: ExitData(
			logic = lambda world, state: (state.has(ItemNames.Blade, world.player, 2) or
								 state.has(ItemNames.Barriers["M,4"], world.player))
		),
		RegNames.Hard["O,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["O,7"], world.player))
		),
		RegNames.Hard["O,8"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["N,8"], world.player))
		)
	},
	RegNames.Hard["N,9"]: {
		RegNames.Hard["B,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["N,9"], world.player))
		),
		RegNames.Hard["O,9"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["N,9"], world.player))
		)
	},
	RegNames.Hard["N,10"]: {
		RegNames.Hard["N,11"]: ExitData(),
		RegNames.Hard["O,10"]: ExitData()
	},
	RegNames.Hard["N,11"]: {
		RegNames.Hard["N,10"]: ExitData(),
		RegNames.Hard["N,12"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["N,11"], world.player))
		)
	},
	RegNames.Hard["N,12"]: {
		RegNames.Hard["O,12"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["N,12"], world.player))
		)
	},
	RegNames.Hard["O,4"]: {
		RegNames.Hard["N,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Battle_Doors["O,4"], world.player))
		)
	},
	RegNames.Hard["O,8"]: {
		RegNames.Hard["N,5"]: ExitData(),
		RegNames.Hard["O,9"]: ExitData()
	},
	RegNames.Hard["O,9"]: {
		RegNames.Hard["N,9"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["O,9"], world.player))
		),
		RegNames.Hard["O,8"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["O,9"], world.player))
		)
	},
	RegNames.Hard["O,10"]: {
		RegNames.Hard["N,10"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["O,10"], world.player))
		)
	},
	RegNames.Hard["O,11"]: {
		RegNames.Hard["O,10"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["O,11"], world.player))
		)
	},
	RegNames.Hard["O,12"]: {}
}

region_exit_table_annihilation: Dict[str, Dict[str, ExitData]] = {
	RegNames.Menu: {
		RegNames.Annihilation["A,3"]: ExitData(),
		RegNames.Annihilation["I,1"]: ExitData(
			valid = lambda world: world.options.save_points,
			logic = lambda world, state: state.has(ItemNames.Saves["I,1"], world.player)
		),
		RegNames.Annihilation["G,2"]: ExitData(
			valid = lambda world: world.options.save_points,
			logic = lambda world, state: state.has(ItemNames.Saves["G,3"], world.player)
		),
		RegNames.Annihilation["H,4"]: ExitData(
			valid = lambda world: world.options.save_points,
			logic = lambda world, state: state.has(ItemNames.Saves["L,4"], world.player)
		),
		RegNames.Annihilation["G,5"]: ExitData(
			valid = lambda world: world.options.save_points,
			logic = lambda world, state: state.has(ItemNames.Saves["G,5"], world.player)
		),
		RegNames.Annihilation["I,5"]: ExitData(
			valid = lambda world: world.options.save_points,
			logic = lambda world, state: state.has(ItemNames.Saves["J,5"], world.player)
		)
	},
	RegNames.Annihilation["A,3"]: {
		RegNames.Annihilation["E,3"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["D,3"], world.player))
		)
	},
	RegNames.Annihilation["D,4"]: {},
	RegNames.Annihilation["E,1"]: {
		RegNames.Annihilation["H,1"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["G,1"], world.player))
		)
	},
	RegNames.Annihilation["E,3"]: {
		RegNames.Annihilation["G,2"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Battle_Doors["E,3"], world.player))
		)
	},
	RegNames.Annihilation["E,4"]: {
		RegNames.Annihilation["D,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,4"], world.player))
		),
		RegNames.Annihilation["E,5"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,4"], world.player))
		),
		RegNames.Annihilation["F,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["E,4"], world.player))
		)
	},
	RegNames.Annihilation["E,5"]: {
		RegNames.Annihilation["E,4"]: ExitData(),
		RegNames.Annihilation["G,5"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["F,5"], world.player))
		)
	},
	RegNames.Annihilation["F,2"]: {
		RegNames.Annihilation["E,1"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["F,2"], world.player))
		)
	},
	RegNames.Annihilation["F,4"]: {
		RegNames.Annihilation["E,4"]: ExitData(),
		RegNames.Annihilation["G,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["G,4"], world.player)
		)
	},
	RegNames.Annihilation["G,2"]: {
		RegNames.Annihilation["E,3"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Battle_Doors["E,3"], world.player)
		),
		RegNames.Annihilation["F,2"]: ExitData(),
		RegNames.Annihilation["G,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["G,4"], world.player)
		),
		RegNames.Annihilation["H,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,1"], world.player)
		),
		RegNames.Annihilation["I,1"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,1"], world.player)
		),
		RegNames.Annihilation["K,3"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["J,2"], world.player)
		)
	},
	RegNames.Annihilation["G,4"]: {
		RegNames.Annihilation["F,4"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["G,4"], world.player)
		),
		RegNames.Annihilation["G,2"]:ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["G,4"], world.player)
		),
		RegNames.Annihilation["H,4"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["H,4"], world.player)
		)
	},
	RegNames.Annihilation["G,5"]: {
		RegNames.Annihilation["E,5"]: ExitData(),
		RegNames.Annihilation["H,6"]: ExitData()
	},
	RegNames.Annihilation["H,1"]: {
		RegNames.Annihilation["E,1"]: ExitData()
	},
	RegNames.Annihilation["H,4"]: {
		RegNames.Annihilation["G,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["H,4"], world.player))
		),
		RegNames.Annihilation["M,3"]: ExitData()
	},
	RegNames.Annihilation["H,6"]: {
		RegNames.Annihilation["G,5"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["H,6"], world.player))
		),
		RegNames.Annihilation["I,6"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["H,6"], world.player))
		)
	},
	RegNames.Annihilation["I,1"]: {
		RegNames.Annihilation["G,2"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Barriers["H,1"], world.player)
		),
		RegNames.Annihilation["J,2"]: ExitData(
			logic = lambda world, state: (not world.options.doors or
								 	state.has_any([ItemNames.Doors["K,2"], ItemNames.Barriers["J,2"]], world.player))
		)
	},
	RegNames.Annihilation["I,5"]: {
		RegNames.Annihilation["I,6"]: ExitData(),
		RegNames.Annihilation["L,5"]: ExitData(
			logic = lambda world, state: state.has(ItemNames.Computer, world.player, world.options.goal_computers.value)
		)
	},
	RegNames.Annihilation["I,6"]: {
		RegNames.Annihilation["H,6"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["I,6"], world.player))
		),
		RegNames.Annihilation["I,5"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["I,6"], world.player))
		)
	},
	RegNames.Annihilation["J,2"]: {},
	RegNames.Annihilation["K,3"]: {
		RegNames.Annihilation["G,2"]: ExitData(
			logic = lambda world, state: ((not world.options.doors or state.has(ItemNames.Doors["K,3"], world.player))
								 			and state.has(ItemNames.Barriers["J,2"], world.player))
		),
		RegNames.Annihilation["L,1"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["K,3"], world.player))
		)
	},
	RegNames.Annihilation["L,1"]: {
		RegNames.Annihilation["K,3"]: ExitData(
			valid = lambda world: world.options.doors,
			logic = lambda world, state: state.has(ItemNames.Doors["K,3"], world.player)
		),
		RegNames.Annihilation["M,3"]: ExitData(
			logic = lambda world, state: (not world.options.doors or 
								 (state.has_any([ItemNames.Doors["M,2"], ItemNames.Doors["M,3"]], world.player)))
		)
	},
	RegNames.Annihilation["L,5"]: {},
	RegNames.Annihilation["M,3"]: {
		RegNames.Annihilation["H,4"]: ExitData(
			logic = lambda world, state: (not world.options.doors or state.has(ItemNames.Doors["M,3"], world.player))
		),
		RegNames.Annihilation["L,1"]: ExitData()
	}
}