"""Raft game-specific export handler."""

import json
import logging
import os
import re
from typing import Any, Dict, Optional

from .generic import GenericGameExportHandler

logger = logging.getLogger(__name__)


def _camel_to_snake(s: str) -> str:
    """Convert CamelCase to snake_case and handle spaces."""
    s = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', s)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s).lower().replace(' ', '_')


def _helper(name: str) -> Dict[str, Any]:
    """Create a helper rule node."""
    return {'type': 'helper', 'name': name, 'args': []}


def _and(*helpers: str) -> Dict[str, Any]:
    """Create an AND rule combining multiple helpers."""
    return {'type': 'and', 'conditions': [_helper(h) for h in helpers]}


def _or(*helpers: str) -> Dict[str, Any]:
    """Create an OR rule combining multiple helpers."""
    return {'type': 'or', 'conditions': [_helper(h) for h in helpers]}


class RaftGameExportHandler(GenericGameExportHandler):
    """Export handler for Raft.

    Handles dictionary lookup patterns in Rules.py using locations.json data.
    """

    USE_RESOLVED_ITEMS = True
    ADD_SPHERE_ITEMS_UPFRONT = True

    # Item rules: None = always available, string = helper name, dict = complex rule
    _ITEM_RULES = {
        # Always available
        "Plank": None, "Plastic": None, "Clay": None, "Stone": None, "Rope": None,
        "Nail": None, "Scrap": None, "SeaVine": None, "Brick_Dry": None,
        "Thatch": None, "Placeable_GiantClam": None,
        # Smelted items
        "MetalIngot": "raft_can_smelt_items", "CopperIngot": "raft_can_smelt_items",
        "VineGoo": "raft_can_smelt_items", "Glass": "raft_can_smelt_items",
        # Simple helper items
        "Leather": "raft_big_islands_available", "Bolt": "raft_can_craft_bolt",
        "Hinge": "raft_can_craft_hinge", "CircuitBoard": "raft_can_craft_circuitBoard",
        "PlasticBottle_Empty": "raft_can_craft_plasticBottle",
        "HoneyComb": "raft_can_access_balboa_island", "Dirt": "raft_can_get_dirt",
        "Egg": "raft_can_capture_animals", "Machete": "raft_can_craft_machete",
        "Zipline tool": "raft_can_craft_ziplineTool",
    }

    # Complex item rules (compound conditions)
    _COMPLEX_ITEM_RULES = {
        "Feather": lambda: _or('raft_big_islands_available', 'raft_can_craft_birdNest'),
        "ExplosivePowder": lambda: _and('raft_big_islands_available', 'raft_can_smelt_items'),
        "Wool": lambda: _and('raft_can_capture_animals', 'raft_can_craft_shears'),
        "Jar_Bee": lambda: _and('raft_can_access_balboa_island', 'raft_can_smelt_items'),
        "TitaniumIngot": lambda: _and('raft_can_smelt_items', 'raft_can_find_titanium'),
    }

    def __init__(self):
        super().__init__()
        self.location_to_region: Dict[str, str] = {}
        self.location_to_items: Dict[str, list] = {}
        self.progressive_mapping: Dict[str, list] = {}
        self._load_data()

    def _load_data(self) -> None:
        """Load location and progression data from JSON files."""
        raft_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'worlds', 'raft')

        try:
            with open(os.path.join(raft_dir, 'locations.json'), 'r') as f:
                for loc in json.load(f):
                    self.location_to_region[loc['name']] = loc['region']
                    if 'requiresAccessToItems' in loc:
                        self.location_to_items[loc['name']] = loc['requiresAccessToItems']
        except Exception as e:
            logger.error(f"Error loading Raft locations: {e}")

        try:
            with open(os.path.join(raft_dir, 'progressives.json'), 'r') as f:
                for item_name, prog_name in json.load(f).items():
                    self.progressive_mapping.setdefault(prog_name, []).append(item_name)
        except Exception as e:
            logger.error(f"Error loading Raft progressives: {e}")

    def _get_region_rule(self, region: str) -> Dict[str, Any]:
        """Get access rule for a region."""
        if region in ("Raft", "ResearchTable"):
            return {'type': 'constant', 'value': True}
        if region == "Utopia":
            return _and('raft_can_complete_temperance', 'raft_can_access_utopia')
        return _helper(f"raft_can_access_{_camel_to_snake(region)}")

    def _get_item_rule(self, item_name: str) -> Optional[Dict[str, Any]]:
        """Get access rule for an item."""
        if item_name in self._COMPLEX_ITEM_RULES:
            return self._COMPLEX_ITEM_RULES[item_name]()
        rule = self._ITEM_RULES.get(item_name)
        if rule is None:
            return None  # Always available
        if isinstance(rule, str):
            return _helper(rule)
        return rule

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None):
        """Override rule analysis for Raft locations using regionChecks pattern."""
        if not rule_target_name or rule_target_name not in self.location_to_region:
            return None

        region = self.location_to_region[rule_target_name]
        region_rule = self._get_region_rule(region)
        is_always_accessible = region_rule.get('type') == 'constant'

        conditions = [] if is_always_accessible else [region_rule]
        for item in self.location_to_items.get(rule_target_name, []):
            item_rule = self._get_item_rule(item)
            if item_rule:
                conditions.append(item_rule)

        if not conditions:
            result = {'type': 'constant', 'value': True}
        elif len(conditions) == 1:
            result = conditions[0]
        else:
            result = {'type': 'and', 'conditions': conditions}

        self.register_helpers_from_rule(result)
        return result

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Return Raft-specific progression item mapping data."""
        return {
            prog_name: {
                'base_item': prog_name,
                'items': [{'name': item, 'level': i} for i, item in enumerate(items, 1)]
            }
            for prog_name, items in self.progressive_mapping.items()
        }
