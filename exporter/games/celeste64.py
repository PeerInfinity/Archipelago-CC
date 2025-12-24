"""Celeste 64 helper expander.

Inlines location and region rules from the logic mappings, eliminating
the need for JavaScript helper implementations.
"""

from typing import Dict, Any, List, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class Celeste64GameExportHandler(GenericGameExportHandler):
    """Celeste 64 expander that inlines rules from logic mappings."""

    # Simple world attributes that can be automatically exported via base class
    COMPUTED_SETTINGS = {
        'strawberries_required': lambda w, m, p: getattr(w, 'strawberries_required', 0),
    }

    def __init__(self, world=None):
        """Initialize with world instance to access options."""
        super().__init__(world=world)
        self._logic_difficulty = None
        self._location_logic = {}
        self._region_logic = {}

    def _load_logic_mappings(self, world) -> None:
        """Load and cache the logic mappings based on difficulty setting."""
        if self._location_logic:
            return  # Already loaded

        try:
            from worlds.celeste64 import Rules

            # Get logic difficulty from world options
            logic_difficulty = 'standard'
            if hasattr(world, 'options') and hasattr(world.options, 'logic_difficulty'):
                logic_difficulty = str(world.options.logic_difficulty.current_key)

            self._logic_difficulty = logic_difficulty

            if logic_difficulty == 'standard':
                self._location_logic = dict(Rules.location_standard_moves_logic)
                self._region_logic = {
                    f"{k[0]},{k[1]}": v for k, v in Rules.region_standard_moves_logic.items()
                }
            else:
                self._location_logic = dict(Rules.location_hard_moves_logic)
                self._region_logic = {
                    f"{k[0]},{k[1]}": v for k, v in Rules.region_hard_moves_logic.items()
                }

            logger.debug(f"Loaded Celeste 64 logic mappings for difficulty: {logic_difficulty}")

        except Exception as e:
            logger.warning(f"Could not load Celeste 64 logic mappings: {e}")

    def _expand_location_rule(self, location_name: str) -> Dict[str, Any]:
        """
        Expand a location rule to its actual rule structure.

        Converts the logic mapping for a location to an OR of ANDs of item_checks.
        If the location has no requirements, returns a constant true.
        """
        if location_name not in self._location_logic:
            return {'type': 'constant', 'value': True}

        possible_access_methods = self._location_logic[location_name]
        if not possible_access_methods:
            return {'type': 'constant', 'value': True}

        # Build OR of ANDs
        conditions = []
        for required_items in possible_access_methods:
            if len(required_items) == 1:
                # Single item - just item_check
                conditions.append({
                    'type': 'item_check',
                    'item': required_items[0]
                })
            else:
                # Multiple items - AND of item_checks
                conditions.append({
                    'type': 'and',
                    'conditions': [
                        {'type': 'item_check', 'item': item}
                        for item in required_items
                    ]
                })

        if len(conditions) == 1:
            return conditions[0]
        else:
            return {
                'type': 'or',
                'conditions': conditions
            }

    def _expand_region_rule(self, region_tuple: List[str]) -> Dict[str, Any]:
        """
        Expand a region connection rule to its actual rule structure.

        Converts the logic mapping for a region connection to an OR of ANDs of item_checks.
        Handles special "CANNOT ACCESS" case.
        """
        if not region_tuple or len(region_tuple) < 2:
            return {'type': 'constant', 'value': True}

        connection_key = f"{region_tuple[0]},{region_tuple[1]}"

        if connection_key not in self._region_logic:
            return {'type': 'constant', 'value': True}

        possible_access_methods = self._region_logic[connection_key]
        if not possible_access_methods:
            return {'type': 'constant', 'value': True}

        # Build OR of ANDs
        conditions = []
        for required_items in possible_access_methods:
            # Check for "CANNOT ACCESS" special case
            if len(required_items) == 1 and required_items[0] == 'CANNOT ACCESS':
                return {'type': 'constant', 'value': False}

            if len(required_items) == 1:
                # Single item - just item_check
                conditions.append({
                    'type': 'item_check',
                    'item': required_items[0]
                })
            else:
                # Multiple items - AND of item_checks
                conditions.append({
                    'type': 'and',
                    'conditions': [
                        {'type': 'item_check', 'item': item}
                        for item in required_items
                    ]
                })

        if len(conditions) == 1:
            return conditions[0]
        else:
            return {
                'type': 'or',
                'conditions': conditions
            }

    def _expand_goal_rule(self, world) -> Dict[str, Any]:
        """
        Expand the goal rule.

        The goal requires:
        1. Having enough strawberries
        2. Being able to reach Badeline Island
        """
        strawberries_required = 0
        if hasattr(world, 'strawberries_required'):
            strawberries_required = world.strawberries_required

        conditions = []

        # Strawberry requirement
        if strawberries_required > 0:
            conditions.append({
                'type': 'count_check',
                'item': 'Strawberry',
                'count': strawberries_required
            })

        # Region reachability - reaching Badeline Island
        conditions.append({
            'type': 'can_reach',
            'region': 'Badeline Island',
            'resolution': 'Region'
        })

        if len(conditions) == 1:
            return conditions[0]
        else:
            return {
                'type': 'and',
                'conditions': conditions
            }

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand rule functions, inlining Celeste 64 logic mappings."""
        if not rule:
            return rule

        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Expand helper calls to location_rule and region_connection_rule
        if rule_type == 'helper':
            helper_name = rule.get('name', '')
            args = rule.get('args', [])

            if helper_name == 'location_rule':
                # Get location name from args
                if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                    location_name = args[0].get('value')
                    if location_name:
                        return self._expand_location_rule(location_name)

            elif helper_name == 'region_connection_rule':
                # Get region tuple from args
                if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                    region_tuple = args[0].get('value')
                    if region_tuple:
                        return self._expand_region_rule(region_tuple)

            elif helper_name == 'goal_rule':
                if self.world:
                    return self._expand_goal_rule(self.world)

        # Let parent class handle recursive expansion
        return super().expand_rule(rule, _depth)

    def handle_special_function_call(self, func_name: str, processed_args: list) -> dict:
        """
        Handle Celeste 64 specific function calls.

        Convert calls to location_rule, region_connection_rule, and goal_rule into
        helper nodes. These will be expanded later by expand_rule using the logic mappings.
        """
        if func_name in ['location_rule', 'region_connection_rule', 'goal_rule']:
            return {
                'type': 'helper',
                'name': func_name,
                'args': processed_args
            }

        return None

    def preprocess_world_data(self, world, export_data: Dict[str, Any], player: int) -> None:
        """Load logic mappings before rule processing."""
        self._load_logic_mappings(world)
        # Store world reference for goal_rule expansion
        self.world = world

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Get Celeste 64 settings (no longer need logic mappings since rules are inlined)."""
        # Note: COMPUTED_SETTINGS handles strawberries_required export
        return super().get_settings_data(world, multiworld, player)
