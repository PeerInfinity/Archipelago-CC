import logging
from typing import Dict, List, TYPE_CHECKING, Callable
from BaseClasses import CollectionState, MultiWorld, Region, Entrance
from worlds.generic.Rules import CollectionRule
from .Data.RegData import ExitData, region_exit_table_normal, region_exit_table_hard, region_exit_table_annihilation
from .Names import RegNames
from .Locations import HeroCoreLocation
from .Data.LocData import HeroCoreLocData, location_table, locations_normal, locations_hard, locations_annihilation

if TYPE_CHECKING:
    from . import HeroCoreWorld

def create_regions(world: "HeroCoreWorld"):

    existing_regions: List[str] = []
    if world.options.difficulty.value == world.options.difficulty.option_normal:
        create_region(world, RegNames.Menu, existing_regions, region_exit_table_normal, locations_normal)
    elif world.options.difficulty.value == world.options.difficulty.option_hard:
        create_region(world, RegNames.Menu, existing_regions, region_exit_table_hard, locations_hard)
    elif world.options.difficulty.value == world.options.difficulty.option_annihilation:
        create_region(world, RegNames.Menu, existing_regions, region_exit_table_annihilation, locations_annihilation)



def create_region(world: "HeroCoreWorld",
                  name: str,
                  existing_regions: List[str],
                  region_exit_table: Dict[str, Dict[str, ExitData]],
                  location_group: Dict[str, HeroCoreLocData]) -> Region:
    
    tempregion = Region(name, world.player, world.multiworld)
    #logging.warning(f"Created Region: {name}")
    tempregion.add_locations(
        {
            location_name: location_data for location_name, location_data in location_table.items()
            if (
                location_name in location_group.keys() and
                location_group[location_name].region == tempregion.name and
                location_group[location_name].valid(world)
            )
        }, HeroCoreLocation
    )

    exitregion: Region = None
    world.multiworld.regions.append(tempregion)
    existing_regions.append(name)

    for key, exitdata in region_exit_table[name].items():
        if (exitdata.valid(world)):
            if key not in existing_regions:
                exitregion = create_region(world, key, existing_regions, region_exit_table, location_group)
            else: exitregion = world.get_region(key)

            tempregion.connect(exitregion, None, lambda state, tempdata = exitdata: (tempdata.logic(world, state)))

    return tempregion
