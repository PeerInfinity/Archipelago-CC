"""
Journey to Ascension - Archipelago World

An incremental/idle game randomizer that shuffles perk placements
and uses post-hoc cost adjustment to make the resulting seed completable.
"""

import copy
import json
import os
from typing import Any, ClassVar, Dict

from BaseClasses import ItemClassification
from worlds.AutoWorld import WebWorld, World

from .Items import JTAItem, build_item_table, item_table
from .Locations import location_table
from .Options import JTAOptions
from .Regions import create_regions
from .Rules import set_rules
from .game_data import get_perk_tasks_for_goal


class JTAWeb(WebWorld):
    theme = "ocean"
    game_info_languages = []


class JTAWorld(World):
    """
    Journey to Ascension is an incremental/idle game where you progress
    through zones by completing tasks, leveling skills, and collecting perks.
    This randomizer shuffles perk placements across tasks.
    """

    game: ClassVar[str] = "Journey to Ascension"
    web: ClassVar[WebWorld] = JTAWeb()

    options_dataclass = JTAOptions
    options: JTAOptions

    item_name_to_id: ClassVar[Dict[str, int]] = {
        name: data.id for name, data in item_table.items() if data.id is not None
    }

    location_name_to_id: ClassVar[Dict[str, int]] = {
        name: data.location_id
        for name, data in location_table.items()
        if data.location_id is not None
    }

    def create_regions(self) -> None:
        goal_zone = self.options.goal_zone.value
        create_regions(self.multiworld, self.player, goal_zone)

    def create_items(self) -> None:
        goal_zone = self.options.goal_zone.value
        active_item_table = build_item_table(goal_zone)

        item_pool = []
        for item_name, item_data in active_item_table.items():
            item = JTAItem(item_name, item_data.classification, item_data.id, self.player)
            item_pool.append(item)

        self.multiworld.itempool += item_pool

    def set_rules(self) -> None:
        goal_zone = self.options.goal_zone.value
        set_rules(self.multiworld, self.player, goal_zone)

    def generate_basic(self) -> None:
        # Place victory event
        victory_location = self.multiworld.get_location("Reach Goal Zone", self.player)
        victory_item = JTAItem(
            "Victory", ItemClassification.progression, None, self.player
        )
        victory_location.place_locked_item(victory_item)

        self.multiworld.completion_condition[self.player] = lambda state: state.has(
            "Victory", self.player
        )

    def create_item(self, name: str) -> JTAItem:
        data = item_table.get(name)
        if data is None:
            return JTAItem(name, ItemClassification.progression, None, self.player)
        return JTAItem(name, data.classification, data.id, self.player)

    def generate_output(self, output_directory: str) -> None:
        goal_zone = self.options.goal_zone.value
        perk_tasks = get_perk_tasks_for_goal(goal_zone)

        # Load original game data
        game_data_path = os.path.join(os.path.dirname(__file__), "jta_game_data.json")
        with open(game_data_path, "r", encoding="utf-8") as f:
            game_data = json.load(f)

        # Build reverse map: perk display name -> perk type ID
        perk_name_to_id: Dict[str, int] = {}
        for perk_id_str, perk_info in game_data["perks"].items():
            perk_name_to_id[perk_info["name"]] = int(perk_id_str)

        # Build task_id -> new perk type ID from the fill
        perk_placement_by_task: Dict[int, int] = {}
        for task in perk_tasks:
            location = self.multiworld.get_location(task.task_name, self.player)
            if location.item is not None:
                perk_id = perk_name_to_id.get(location.item.name)
                if perk_id is not None:
                    perk_placement_by_task[task.task_id] = perk_id

        # Deep copy and apply randomized perk placements to zone task data
        modified_data = copy.deepcopy(game_data)
        for zone in modified_data["zones"]:
            for task in zone["tasks"]:
                if task["id"] in perk_placement_by_task:
                    task["perk"] = perk_placement_by_task[task["id"]]

        # Write modified game data
        filename_base = self.multiworld.get_out_file_name_base(self.player)
        output_path = os.path.join(output_directory, f"{filename_base}_gamedata.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(modified_data, f, indent=2)

    def fill_slot_data(self) -> Dict[str, Any]:
        goal_zone = self.options.goal_zone.value
        perk_tasks = get_perk_tasks_for_goal(goal_zone)

        # Build perk placement map: task_id -> perk that was placed there
        perk_placements: Dict[int, str] = {}
        for task in perk_tasks:
            location = self.multiworld.get_location(task.task_name, self.player)
            if location.item is not None:
                perk_placements[task.task_id] = location.item.name

        return {
            "game": "Journey to Ascension",
            "version": "0.5.0",
            "goalZone": goal_zone,
            "resetsPerSphere": self.options.resets_per_sphere.value,
            "costGenFactors": {
                "itemCollection": bool(self.options.costgen_item_collection.value),
                "pushCollect": bool(self.options.costgen_push_collect.value),
                "xpGrinding": bool(self.options.costgen_xp_grinding.value),
                "grindWithPushCollect": bool(
                    self.options.costgen_grind_with_push_collect.value
                ),
                "artifacts": bool(self.options.costgen_artifacts.value),
            },
            "automation": {
                "autoQueue": bool(self.options.automation_auto_queue.value),
                "autoReset": bool(self.options.automation_auto_reset.value),
                "drainStrategy": bool(self.options.automation_drain_strategy.value),
                "loadoutSequencing": bool(
                    self.options.automation_loadout_sequencing.value
                ),
            },
            "perkPlacements": perk_placements,
        }
