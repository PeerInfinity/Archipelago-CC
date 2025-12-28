"""Old School Runescape game-specific export handler.

Exports:
- qp_items: Mapping of quest item names to their QP values
- quest_points helper: Computed sum of QP values for items the player has

Note: The base class automatically converts self.quest_points() and
world.quest_points() method calls to helper function calls via
CONVERT_WORLD_METHODS_TO_HELPERS = True (the default).
"""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class OSRSGameExportHandler(GenericGameExportHandler):

    def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export OSRS-specific world data including QP location data."""
        settings = super().get_world_data(world, multiworld, player)

        # For worldgen worlds, qp_items is already loaded from _worldgen_settings.json
        # by the base exporter, so we don't need to compute it here
        module_path = type(world).__module__
        if module_path.endswith('_worldgen') or '_worldgen.' in module_path:
            return settings

        # Export quest point data as a mapping of item_name -> qp_value
        # This allows the computed quest_points helper to sum QP values
        qp_items = {}
        if hasattr(world, 'available_QP_locations'):
            for qp_event in world.available_QP_locations:
                # Extract QP value from item name (e.g., "1 QP (Cook's Assistant)" -> 1)
                try:
                    qp_value = int(qp_event[0])
                    qp_items[qp_event] = qp_value
                except (ValueError, IndexError):
                    logger.warning(f"Could not parse QP value from: {qp_event}")

        settings['qp_items'] = qp_items
        return settings

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """
        Get helper definitions including computed quest_points helper.

        The quest_points helper in Python iterates over available_QP_locations and
        sums QP values for items the player has. We define a computed helper that
        uses the exported qp_items data structure:

        Python: sum(int(qp_event[0]) for qp_event in available_QP_locations if state.has(qp_event, player))
        JSON:   sum_of(qp_value for [item, qp_value] in qp_items.items() if has(item))
        """
        helper_defs = super().get_helper_definitions(world)

        # Define computed helper for quest_points
        # Logic: iterate over qp_items, sum qp_value for each item the player has
        helper_defs['quest_points'] = {
            'params': [],
            'body': {
                'type': 'sum_of',
                'iterator_info': {
                    'target': {
                        'type': 'tuple',
                        'elements': [
                            {'type': 'name', 'name': 'item_name'},
                            {'type': 'name', 'name': 'qp_value'}
                        ]
                    },
                    'iterator': {
                        'type': 'method_call',
                        'object': {'type': 'setting_value', 'setting': 'qp_items'},
                        'method': 'items',
                        'args': []
                    }
                },
                'element_rule': {
                    'type': 'conditional',
                    'test': {
                        'type': 'item_check',
                        'item': {'type': 'name', 'name': 'item_name'}
                    },
                    'if_true': {'type': 'name', 'name': 'qp_value'},
                    'if_false': {'type': 'constant', 'value': 0}
                }
            }
        }

        return helper_defs
