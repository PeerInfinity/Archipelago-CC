"""Raft game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging
import json
import os

logger = logging.getLogger(__name__)

class RaftGameExportHandler(GenericGameExportHandler):
    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Module paths for helper functions
    HELPER_MODULES = ['worlds.raft.Rules']

    # Blacklist for helpers that cannot be exported
    # Previously blacklisted, now supported:
    # - raft_paddleboard_mode_enabled: Uses self.multiworld.worlds[player].options (now supported)
    # - raft_big_islands_available: Uses self.multiworld.worlds[player].options (now supported)
    HELPERS_TO_EXPORT_BLACKLIST = set()

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export Raft-specific settings."""
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Raft uses resolved_items instead of base_items for sphere inventory
        # This allows the generic has() function to find resolved progressive items
        # (e.g., "Smelter" instead of "progressive-metals") directly in inventory
        settings_dict['use_resolved_items'] = True

        # Add sphere items upfront so resolved items are added directly to inventory
        # Without this, checking locations would add base items (progressive-metals)
        # instead of resolved items (Smelter)
        settings_dict['add_sphere_items_upfront'] = True

        return settings_dict

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

    def __init__(self):
        super().__init__()
        # Load the locations.json file to get region information
        self.location_to_region = {}
        self.location_to_items = {}
        self.progressive_mapping = {}
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

            # Load the progressives.json file to get progressive item mapping
            progressives_file = os.path.join(raft_dir, 'progressives.json')
            if os.path.exists(progressives_file):
                with open(progressives_file, 'r') as f:
                    progressive_table = json.load(f)
                    # Build the mapping from progressive item to its constituent items
                    for item_name, progressive_name in progressive_table.items():
                        if progressive_name not in self.progressive_mapping:
                            self.progressive_mapping[progressive_name] = []
                        self.progressive_mapping[progressive_name].append(item_name)
                logger.info(f"Loaded {len(self.progressive_mapping)} Raft progressive items from progressives.json")
            else:
                logger.warning(f"Could not find Raft progressives.json at {progressives_file}")
        except Exception as e:
            logger.error(f"Error loading Raft data files: {e}")

    def _register_helpers_from_rule(self, rule: Dict[str, Any]) -> None:
        """Register all helpers referenced in a rule structure for export."""
        if rule is None:
            return
        rule_type = rule.get('type')
        if rule_type == 'helper':
            helper_name = rule.get('name')
            if helper_name:
                self.register_helper_usage(helper_name)
        elif rule_type in ('and', 'or'):
            for condition in rule.get('conditions', []):
                self._register_helpers_from_rule(condition)

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None):
        """
        Override rule analysis for Raft locations that use the regionChecks pattern.

        The Raft world uses this pattern:
        set_rule(locFromWorld, regionChecks[location["region"]])

        We need to resolve this to the actual access rule for the location's region.
        """
        if not rule_target_name or rule_target_name not in self.location_to_region:
            return None  # Let default analysis handle it

        # Get the region for this location
        region = self.location_to_region[rule_target_name]

        # Check if this location has specific item requirements
        if rule_target_name in self.location_to_items:
            # This location requires access to specific items
            # The rule is: regionCheck AND all itemChecks
            item_requirements = self.location_to_items[rule_target_name]
            region_rule = self._get_region_access_rule(region)

            # Build item check conditions using inline rules instead of helper calls
            item_conditions = []
            for item_name in item_requirements:
                # Get the item check rule from our mapping
                item_rule = self.ITEM_CHECK_RULES.get(item_name)
                if item_rule:
                    # Skip constant True rules - they don't add any constraints
                    if item_rule.get('type') == 'constant' and item_rule.get('value') is True:
                        continue
                    # Register any helpers referenced in this rule
                    self._register_helpers_from_rule(item_rule)
                    item_conditions.append(item_rule)
                else:
                    # Unknown item - log a warning
                    logger.warning(f"Unknown item check for '{item_name}' in location '{rule_target_name}'")

            # Register helpers in region rule
            self._register_helpers_from_rule(region_rule)

            # Combine region rule with item requirements
            if region_rule.get('value') is True:
                # Region is always accessible, just need items
                if len(item_conditions) == 0:
                    return {'type': 'constant', 'value': True}
                elif len(item_conditions) == 1:
                    return item_conditions[0]
                else:
                    return {'type': 'and', 'conditions': item_conditions}
            else:
                # Need both region access and items
                all_conditions = [region_rule] + item_conditions
                if len(all_conditions) == 1:
                    return all_conditions[0]
                return {'type': 'and', 'conditions': all_conditions}

        # Simple region check only
        result = self._get_region_access_rule(region)
        self._register_helpers_from_rule(result)
        return result

    def _get_region_access_rule(self, region: str) -> Dict[str, Any]:
        """
        Get the access rule for a given region based on the regionChecks mapping
        in the Raft world's Rules.py.
        """
        # From worlds/raft/Rules.py, the regionChecks mapping is:
        region_rules = {
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

        return region_rules.get(region, {'type': 'constant', 'value': True})

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Return Raft-specific progression item mapping data."""
        # Convert the simple list format to the proper schema format
        mapping_data = {}
        for progressive_name, item_list in self.progressive_mapping.items():
            mapping_data[progressive_name] = {
                'base_item': progressive_name,
                'items': []
            }
            for level, item_name in enumerate(item_list, start=1):
                mapping_data[progressive_name]['items'].append({
                    'name': item_name,
                    'level': level
                })
        return mapping_data
