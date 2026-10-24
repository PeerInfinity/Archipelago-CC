from typing import Any, Dict, List
from BaseClasses import Item, ItemClassification, Location, MultiWorld, Tutorial
from worlds.AutoWorld import World, CollectionState, WebWorld
from worlds.generic.Rules import set_rule
from worlds.herocore.Options import HeroCoreOptions
from .Items import create_itempool, create_item
from .Regions import create_regions
from .Options import hero_core_option_groups
from .Names import ItemNames
from .Data.LocData import location_table, locations_normal, locations_hard, locations_annihilation, HeroCoreLocData
from .Data.ItemData import item_table
from .Maps.map_page_index import map_page_index

class HeroCoreWeb(WebWorld):
    theme = "stone"
    tutorials = [Tutorial(
        "Multiworld Setup Guide",
        "A guide to setting up the Hero Core randomizer connected to an Archipelago Multiworld",
        "English",
        "setup_en.md",
        "setup/en",
        ["Minish"]
    )]
    option_groups = hero_core_option_groups

class HeroCoreWorld(World):
    """
    Hero Core is a freeware action-exploration shooter developed by Daniel Remar, and released in 2010.
    """

    game="Hero Core"
    location_name_to_id = location_table
    item_name_to_id = item_table
    #item_name_groups = item_groups_table
    options_dataclass = HeroCoreOptions
    options: HeroCoreOptions
    web = HeroCoreWeb()

    ut_can_gen_without_yaml = True

    tracker_world = {
        "map_page_folder": "Maps",
        "map_page_maps": "maps.json",
        "map_page_locations": "locations.json",
        "map_page_index": map_page_index
    }


    def create_items(self):
        self.multiworld.itempool += create_itempool(self)

    def create_item(self, name: str) -> Item:
        return create_item(self, name)

    def get_filler_item_name(self) -> str:
        return ItemNames.Filler

    def create_regions(self):
        create_regions(self)

        lock_table: Dict[str, HeroCoreLocData] = None
        if self.options.difficulty.value == self.options.difficulty.option_normal:
            lock_table = locations_normal
        elif self.options.difficulty.value == self.options.difficulty.option_hard:
            lock_table = locations_hard
        elif self.options.difficulty.value == self.options.difficulty.option_annihilation:
            lock_table = locations_annihilation
            
        for loc in self.multiworld.get_locations(self.player):
            if lock_table[loc.name].locked_item(self) != None:
                loc.place_locked_item(create_item(self,
                                                  lock_table[loc.name].locked_item(self),
                                                  lock_table[loc.name].locked_item_class(self)))

    def fill_slot_data(self) -> Dict[str, Any]:
        return {
            "ModVersion": 2,
            "ModSemantic": "1.0.0 prerelease",
            "Difficulty": self.options.difficulty.value,
            "GoalComputers": self.options.goal_computers.value,

            "PowerUps": self.options.powerups.value,
            "LevelUps": self.options.level_ups.value,
            "Computers": self.options.computers.value,
            "Generators": self.options.generators.value,
            "SavePoints": self.options.save_points.value,
            "Doors": self.options.doors.value,

            "Miscellaneous": self.options.miscellaneous_locations.value,
            "ExpelSkips": self.options.expel_skips.value,
            "DeathLink": self.options.deathlink.value,
        }
    
    def generate_early(self):
        # If using Universal Tracker
        if hasattr(self.multiworld, "re_gen_passthrough"):
            if "Hero Core" in self.multiworld.re_gen_passthrough:
                passthrough = self.multiworld.re_gen_passthrough["Hero Core"]
                self.options.difficulty.value = passthrough["Difficulty"]
                self.options.goal_computers.value = passthrough["GoalComputers"]
                self.options.powerups.value = passthrough["PowerUps"]
                self.options.level_ups.value = passthrough["LevelUps"]
                self.options.computers.value = passthrough["Computers"]
                self.options.generators.value = passthrough["Generators"]
                self.options.save_points.value = passthrough["SavePoints"]
                self.options.doors.value = passthrough["Doors"]
                self.options.miscellaneous_locations.value = passthrough["Miscellaneous"]
                self.options.expel_skips.value = passthrough["ExpelSkips"]


    def set_rules(self):
        loc_table: Dict[str, HeroCoreLocData] = None
        if self.options.difficulty.value == self.options.difficulty.option_normal:
            loc_table = locations_normal
        elif self.options.difficulty.value == self.options.difficulty.option_hard:
            loc_table = locations_hard
        elif self.options.difficulty.value == self.options.difficulty.option_annihilation:
            loc_table = locations_annihilation
        for loc in self.multiworld.get_locations(self.player):
            set_rule(loc,lambda state, temploc=loc: loc_table[temploc.name].logic(self,state))

        self.multiworld.completion_condition[self.player] = lambda state: state.has(ItemNames.Victory, self.player)