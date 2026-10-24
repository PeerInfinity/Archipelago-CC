from typing import List, Dict, TYPE_CHECKING, NamedTuple, Optional

from BaseClasses import Item, ItemClassification
from .Data.ItemData import item_table, items_normal, items_hard, items_annihilation, ItemInfo
from .Names import ItemNames

if TYPE_CHECKING:
    from . import HeroCoreWorld

class HeroCoreItem(Item):
    game = "Hero Core"

def create_itempool(world: "HeroCoreWorld") -> List[Item]:
    item_pool: List[Item] = []

    if world.options.difficulty.value == world.options.difficulty.option_normal:
        item_pool += create_item_set(world, items_normal)
    
    elif world.options.difficulty.value == world.options.difficulty.option_hard:
        item_pool += create_item_set(world, items_hard)
    
    elif world.options.difficulty.value == world.options.difficulty.option_annihilation:
        item_pool += create_item_set(world, items_annihilation)

    if world.options.computers:
        if world.options.goal_computers.value == 0:
            for i in range(10):
                item_pool.append(create_item(world, ItemNames.Computer, ItemClassification.filler))
        else:
            for i in range(world.options.goal_computers.value):
                item_pool.append(create_item(world, ItemNames.Computer, ItemClassification.progression_skip_balancing))
            for i in range(10 - world.options.goal_computers.value):
                item_pool.append(create_item(world, ItemNames.Computer, ItemClassification.useful))

    for i in range(len(world.multiworld.get_unfilled_locations(world.player)) - len(item_pool)):
        item_pool.append(create_item(world, ItemNames.Filler))

    return item_pool

def create_item(world: "HeroCoreWorld", name: str, progtype: ItemClassification = ItemClassification.filler):
    return HeroCoreItem(name, progtype, item_table[name], world.player)

def create_item_set(world: "HeroCoreWorld", item_set: List[ItemInfo]) -> List[Item]:
    item_list: List[Item] = []

    for item in item_set:
        if item.valid(world):
            for i in range(item.count):
                item_list.append(create_item(world, item.name, item.item_class))
    
    return item_list