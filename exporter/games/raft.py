"""Raft game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging
import json
import os

logger = logging.getLogger(__name__)

class RaftGameExportHandler(GenericGameExportHandler):
    """Export handler for Raft."""

    # Raft uses resolved_items instead of base_items for sphere inventory
    # This allows the generic has() function to find resolved progressive items
    # (e.g., "Smelter" instead of "progressive-metals") directly in inventory
    USE_RESOLVED_ITEMS = True

    # Add sphere items upfront so resolved items are added directly to inventory
    # Without this, checking locations would add base items (progressive-metals)
    # instead of resolved items (Smelter)
    ADD_SPHERE_ITEMS_UPFRONT = True

    # Item check rules - maps item names to their access rule structures
    # Based on the itemChecks dictionary in worlds/raft/Rules.py
    ITEM_CHECK_RULES = {
        # Basic materials - always available
        "Plank": {'type': 'constant', 'value': True},
        "Plastic": {'type': 'constant', 'value': True},
        "Clay": {'type': 'constant', 'value': True},
        "Stone": {'type': 'constant', 'value': True},
        "Rope": {'type': 'constant', 'value': True},
        "Nail": {'type': 'constant', 'value': True},
        "Scrap": {'type': 'constant', 'value': True},
        "SeaVine": {'type': 'constant', 'value': True},
        "Brick_Dry": {'type': 'constant', 'value': True},
        "Thatch": {'type': 'constant', 'value': True},  # Palm Leaf
        "Placeable_GiantClam": {'type': 'constant', 'value': True},
        # Materials from big islands
        "Leather": {'type': 'helper', 'name': 'raft_big_islands_available', 'args': []},
        "Feather": {
            'type': 'or',
            'conditions': [
                {'type': 'helper', 'name': 'raft_big_islands_available', 'args': []},
                {'type': 'helper', 'name': 'raft_can_craft_birdNest', 'args': []}
            ]
        },
        # Smelted items
        "MetalIngot": {'type': 'helper', 'name': 'raft_can_smelt_items', 'args': []},
        "CopperIngot": {'type': 'helper', 'name': 'raft_can_smelt_items', 'args': []},
        "VineGoo": {'type': 'helper', 'name': 'raft_can_smelt_items', 'args': []},
        "ExplosivePowder": {
            'type': 'and',
            'conditions': [
                {'type': 'helper', 'name': 'raft_big_islands_available', 'args': []},
                {'type': 'helper', 'name': 'raft_can_smelt_items', 'args': []}
            ]
        },
        "Glass": {'type': 'helper', 'name': 'raft_can_smelt_items', 'args': []},
        # Crafted items
        "Bolt": {'type': 'helper', 'name': 'raft_can_craft_bolt', 'args': []},
        "Hinge": {'type': 'helper', 'name': 'raft_can_craft_hinge', 'args': []},
        "CircuitBoard": {'type': 'helper', 'name': 'raft_can_craft_circuitBoard', 'args': []},
        "PlasticBottle_Empty": {'type': 'helper', 'name': 'raft_can_craft_plasticBottle', 'args': []},
        "Wool": {
            'type': 'and',
            'conditions': [
                {'type': 'helper', 'name': 'raft_can_capture_animals', 'args': []},
                {'type': 'helper', 'name': 'raft_can_craft_shears', 'args': []}
            ]
        },
        "HoneyComb": {'type': 'helper', 'name': 'raft_can_access_balboa_island', 'args': []},
        "Jar_Bee": {
            'type': 'and',
            'conditions': [
                {'type': 'helper', 'name': 'raft_can_access_balboa_island', 'args': []},
                {'type': 'helper', 'name': 'raft_can_smelt_items', 'args': []}
            ]
        },
        "Dirt": {'type': 'helper', 'name': 'raft_can_get_dirt', 'args': []},
        "Egg": {'type': 'helper', 'name': 'raft_can_capture_animals', 'args': []},
        "TitaniumIngot": {
            'type': 'and',
            'conditions': [
                {'type': 'helper', 'name': 'raft_can_smelt_items', 'args': []},
                {'type': 'helper', 'name': 'raft_can_find_titanium', 'args': []}
            ]
        },
        # Specific items for story island location checks
        "Machete": {'type': 'helper', 'name': 'raft_can_craft_machete', 'args': []},
        "Zipline tool": {'type': 'helper', 'name': 'raft_can_craft_ziplineTool', 'args': []},
    }

    # Region access rules - maps region names to their access rule structures
    # Based on the regionChecks dictionary in worlds/raft/Rules.py
    REGION_ACCESS_RULES = {
        "Raft": {'type': 'constant', 'value': True},
        "ResearchTable": {'type': 'constant', 'value': True},
        "RadioTower": {'type': 'helper', 'name': 'raft_can_access_radio_tower', 'args': []},
        "Vasagatan": {'type': 'helper', 'name': 'raft_can_access_vasagatan', 'args': []},
        "BalboaIsland": {'type': 'helper', 'name': 'raft_can_access_balboa_island', 'args': []},
        "CaravanIsland": {'type': 'helper', 'name': 'raft_can_access_caravan_island', 'args': []},
        "Tangaroa": {'type': 'helper', 'name': 'raft_can_access_tangaroa', 'args': []},
        "Varuna Point": {'type': 'helper', 'name': 'raft_can_access_varuna_point', 'args': []},
        "Temperance": {'type': 'helper', 'name': 'raft_can_access_temperance', 'args': []},
        "Utopia": {
            'type': 'and',
            'conditions': [
                {'type': 'helper', 'name': 'raft_can_complete_temperance', 'args': []},
                {'type': 'helper', 'name': 'raft_can_access_utopia', 'args': []}
            ]
        }
    }

    def __init__(self):
        super().__init__()
        # Load the locations.json file to get region information
        self.location_to_region = {}
        self.location_to_items = {}
        try:
            # Find the raft world directory
            raft_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'worlds', 'raft')
            locations_file = os.path.join(raft_dir, 'locations.json')

            if os.path.exists(locations_file):
                with open(locations_file, 'r') as f:
                    location_table = json.load(f)
                    for loc in location_table:
                        self.location_to_region[loc['name']] = loc['region']
                        if 'requiresAccessToItems' in loc:
                            self.location_to_items[loc['name']] = loc['requiresAccessToItems']
                logger.info(f"Loaded {len(self.location_to_region)} Raft locations from locations.json")
            else:
                logger.warning(f"Could not find Raft locations.json at {locations_file}")
        except Exception as e:
            logger.error(f"Error loading Raft data files: {e}")

        # Progressive item mapping is auto-detected by the base handler from
        # worlds.raft.Items.progressive_item_list

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None):
        """
        Override rule analysis for Raft locations that use the regionChecks pattern.

        Raft's Rules.py uses: set_rule(locFromWorld, regionChecks[location["region"]])
        This dictionary lookup pattern can't be analyzed by the standard AST analyzer,
        so we resolve it here using the location-to-region mapping from locations.json.
        """
        if not rule_target_name or rule_target_name not in self.location_to_region:
            return None  # Let default analysis handle it

        region = self.location_to_region[rule_target_name]
        region_rule = self.REGION_ACCESS_RULES.get(region, {'type': 'constant', 'value': True})
        is_region_always_accessible = region_rule.get('value') is True

        # Build item check conditions (skip constant True rules)
        item_conditions = []
        for item_name in self.location_to_items.get(rule_target_name, []):
            item_rule = self.ITEM_CHECK_RULES.get(item_name)
            if item_rule:
                if not (item_rule.get('type') == 'constant' and item_rule.get('value') is True):
                    item_conditions.append(item_rule)
            else:
                logger.warning(f"Unknown item check for '{item_name}' in location '{rule_target_name}'")

        # Combine region rule with item conditions
        conditions = item_conditions if is_region_always_accessible else [region_rule] + item_conditions

        # Build final result based on number of conditions
        if len(conditions) == 0:
            result = {'type': 'constant', 'value': True}
        elif len(conditions) == 1:
            result = conditions[0]
        else:
            result = {'type': 'and', 'conditions': conditions}

        # Register all helpers in the result (recursive, handles nested rules)
        self.register_helpers_from_rule(result)
        return result

    # Progressive item mapping is auto-detected by the base handler from
    # worlds.raft.Items.progressive_item_list - no manual override needed
