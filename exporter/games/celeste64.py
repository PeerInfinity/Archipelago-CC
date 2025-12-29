"""Celeste 64 helper expander.

Inlines location and region rules from the logic mappings, eliminating
the need for JavaScript helper implementations.
"""

from typing import Dict, Any, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class Celeste64GameExportHandler(GenericGameExportHandler):
    """Celeste 64 expander that inlines rules from logic mappings."""

    def __init__(self, world=None):
        """Initialize with world instance to access options."""
        super().__init__(world=world)
        self._logic_difficulty = None
        self._location_logic = {}
        self._region_logic = {}

    def _ensure_logic_loaded(self) -> None:
        """Lazily load logic mappings when needed."""
        if self._location_logic:
            return  # Already loaded

        if not self.world:
            return

        try:
            from worlds.celeste64 import Rules

            logic_difficulty = 'standard'
            if hasattr(self.world, 'options') and hasattr(self.world.options, 'logic_difficulty'):
                logic_difficulty = str(self.world.options.logic_difficulty.current_key)

            self._logic_difficulty = logic_difficulty

            if logic_difficulty == 'standard':
                self._location_logic = dict(Rules.location_standard_moves_logic)
                self._region_logic = {
                    (k[0], k[1]): v for k, v in Rules.region_standard_moves_logic.items()
                }
            else:
                self._location_logic = dict(Rules.location_hard_moves_logic)
                self._region_logic = {
                    (k[0], k[1]): v for k, v in Rules.region_hard_moves_logic.items()
                }

            logger.debug(f"Loaded Celeste 64 logic mappings for difficulty: {logic_difficulty}")
        except Exception as e:
            logger.warning(f"Could not load Celeste 64 logic mappings: {e}")

    def _build_or_of_ands(self, access_methods: List[List[str]]) -> Dict[str, Any]:
        """
        Build an OR of ANDs rule structure from access methods.

        Each access method is a list of required items (AND).
        Multiple access methods are combined with OR.
        Handles "CANNOT ACCESS" special case.
        """
        if not access_methods:
            return {'type': 'constant', 'value': True}

        conditions = []
        for required_items in access_methods:
            # Check for "CANNOT ACCESS" special case
            if len(required_items) == 1 and required_items[0] == 'CANNOT ACCESS':
                return {'type': 'constant', 'value': False}

            if len(required_items) == 1:
                conditions.append({
                    'type': 'item_check',
                    'item': required_items[0]
                })
            else:
                conditions.append({
                    'type': 'and',
                    'conditions': [
                        {'type': 'item_check', 'item': item}
                        for item in required_items
                    ]
                })

        if len(conditions) == 1:
            return conditions[0]
        return {'type': 'or', 'conditions': conditions}

    def _extract_value_from_arg(self, arg: dict) -> Any:
        """Extract the actual value from a processed argument."""
        if not isinstance(arg, dict):
            return arg
        if arg.get('type') == 'constant':
            return arg.get('value')
        if arg.get('type') == 'name':
            return arg.get('name')
        return None

    def handle_special_function_call(self, func_name: str, processed_args: list) -> dict:
        """
        Handle Celeste 64 specific function calls by directly expanding them.

        Converts location_rule, region_connection_rule, and goal_rule calls
        directly into their expanded rule structures.
        """
        self._ensure_logic_loaded()

        if func_name == 'location_rule':
            if processed_args:
                location_name = self._extract_value_from_arg(processed_args[0])
                if location_name:
                    if location_name not in self._location_logic:
                        return {'type': 'constant', 'value': True}
                    return self._build_or_of_ands(self._location_logic[location_name])

        elif func_name == 'region_connection_rule':
            if processed_args:
                region_tuple = self._extract_value_from_arg(processed_args[0])
                if region_tuple and len(region_tuple) >= 2:
                    key = (region_tuple[0], region_tuple[1])
                    if key not in self._region_logic:
                        return {'type': 'constant', 'value': True}
                    return self._build_or_of_ands(self._region_logic[key])

        elif func_name == 'goal_rule':
            strawberries_required = 0
            if self.world and hasattr(self.world, 'strawberries_required'):
                strawberries_required = self.world.strawberries_required

            conditions = []
            if strawberries_required > 0:
                conditions.append({
                    'type': 'count_check',
                    'item': 'Strawberry',
                    'count': strawberries_required
                })
            conditions.append({
                'type': 'can_reach',
                'region': 'Badeline Island',
                'resolution': 'Region'
            })

            if len(conditions) == 1:
                return conditions[0]
            return {'type': 'and', 'conditions': conditions}

        return None

    def preprocess_world_data(self, world, export_data: Dict[str, Any], player: int) -> None:
        """Store world reference for lazy logic loading."""
        self.world = world
