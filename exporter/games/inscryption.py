"""Inscryption game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class InscryptionGameExportHandler(GenericGameExportHandler):
    """Inscryption game handler.

    Since Inscryption's helper functions are class methods (not module-level functions),
    they cannot be automatically exported. Instead, we expand the inferred pseudo-items
    (like Camera_And_Meat, All_Epitaph_Pieces) to their actual item checks.
    """
    GAME_NAME = 'Inscryption'

    # Disable automatic helper export (class methods can't be auto-exported)
    AUTO_EXPORT_DISCOVERED_HELPERS = False

    def __init__(self, world=None):
        """Initialize with world object to access game-specific data."""
        super().__init__()
        self.world = world
        self._required_epitaph_count = 9  # Default value

    def preprocess_world_data(self, world, export_data, player):
        """Store world data needed for rule expansion."""
        super().preprocess_world_data(world, export_data, player)
        self.world = world
        # Get the required epitaph pieces count from world
        if hasattr(world, 'required_epitaph_pieces_count'):
            self._required_epitaph_count = world.required_epitaph_pieces_count
            logger.debug(f"Required epitaph pieces count: {self._required_epitaph_count}")

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand Inscryption-specific rules.

        Handles:
        - Inferred pseudo-items like Camera_And_Meat, All_Epitaph_Pieces
        - Inferred pseudo-items like Act2_Bridge_Requirements, Tower_Requirements
        """
        if not rule:
            return rule

        # First let parent handle standard expansion and recursion
        rule = super().expand_rule(rule, _depth)

        # Handle inferred item_checks with pseudo-items
        if rule.get('type') == 'item_check' and rule.get('inferred'):
            item = rule.get('item', '')
            if isinstance(item, str):
                expanded = self._expand_pseudo_item(item)
                if expanded:
                    return expanded

        # Handle capability rules that should be item checks
        if rule.get('type') == 'capability' and rule.get('inferred'):
            capability = rule.get('capability', '')
            expanded = self._expand_capability(capability)
            if expanded:
                return expanded

        return rule

    def _expand_pseudo_item(self, item: str) -> Dict[str, Any] | None:
        """Expand pseudo-items to their actual item checks."""
        # Normalize the item name for comparison
        item_lower = item.lower().replace('_', ' ').replace('-', ' ')

        # Camera_And_Meat -> Camera Replica AND Pile Of Meat
        if 'camera' in item_lower and 'meat' in item_lower:
            logger.debug(f"Expanding '{item}' to Camera Replica AND Pile Of Meat")
            return {
                'type': 'state_method',
                'method': 'has_all',
                'args': [{'type': 'constant', 'value': ['Camera Replica', 'Pile Of Meat']}]
            }

        # All_Epitaph_Pieces -> Epitaph Piece (count)
        if 'epitaph' in item_lower and ('all' in item_lower or 'pieces' in item_lower):
            logger.debug(f"Expanding '{item}' to Epitaph Piece x{self._required_epitaph_count}")
            return {
                'type': 'item_check',
                'item': 'Epitaph Piece',
                'count': {'type': 'constant', 'value': self._required_epitaph_count}
            }

        # Act2_Bridge_Requirements -> Camera+Meat OR All Epitaph Pieces
        if 'bridge' in item_lower and 'requirements' in item_lower:
            logger.debug(f"Expanding '{item}' to bridge requirements")
            return {
                'type': 'or',
                'conditions': [
                    {
                        'type': 'state_method',
                        'method': 'has_all',
                        'args': [{'type': 'constant', 'value': ['Camera Replica', 'Pile Of Meat']}]
                    },
                    {
                        'type': 'item_check',
                        'item': 'Epitaph Piece',
                        'count': {'type': 'constant', 'value': self._required_epitaph_count}
                    }
                ]
            }

        # Tower_Requirements -> Monocle AND Bridge Requirements
        if 'tower' in item_lower and 'requirements' in item_lower:
            logger.debug(f"Expanding '{item}' to tower requirements")
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'item_check', 'item': 'Monocle'},
                    {
                        'type': 'or',
                        'conditions': [
                            {
                                'type': 'state_method',
                                'method': 'has_all',
                                'args': [{'type': 'constant', 'value': ['Camera Replica', 'Pile Of Meat']}]
                            },
                            {
                                'type': 'item_check',
                                'item': 'Epitaph Piece',
                                'count': {'type': 'constant', 'value': self._required_epitaph_count}
                            }
                        ]
                    }
                ]
            }

        # Transcendence_Requirements -> Quill AND Gems Module AND Inspectometer Battery
        if 'transcendence' in item_lower and 'requirements' in item_lower:
            logger.debug(f"Expanding '{item}' to transcendence requirements")
            return {
                'type': 'state_method',
                'method': 'has_all',
                'args': [{'type': 'constant', 'value': ['Quill', 'Gems Module', 'Inspectometer Battery']}]
            }

        # Inspectometer_Battery -> Inspectometer Battery
        if 'inspectometer' in item_lower and 'battery' in item_lower:
            logger.debug(f"Expanding '{item}' to Inspectometer Battery")
            return {'type': 'item_check', 'item': 'Inspectometer Battery'}

        # Gems_And_Battery -> Gems Module AND Inspectometer Battery
        if 'gems' in item_lower and 'battery' in item_lower:
            logger.debug(f"Expanding '{item}' to Gems Module AND Inspectometer Battery")
            return {
                'type': 'state_method',
                'method': 'has_all',
                'args': [{'type': 'constant', 'value': ['Gems Module', 'Inspectometer Battery']}]
            }

        # Act2_Requirements -> Film Roll
        if 'act2' in item_lower and 'requirements' in item_lower and 'bridge' not in item_lower:
            logger.debug(f"Expanding '{item}' to Film Roll")
            return {'type': 'item_check', 'item': 'Film Roll'}

        # Act3_Requirements -> Film Roll + All Epitaph Pieces + Camera+Meat + Monocle
        if 'act3' in item_lower and 'requirements' in item_lower:
            logger.debug(f"Expanding '{item}' to Act3 requirements")
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'item_check', 'item': 'Film Roll'},
                    {
                        'type': 'item_check',
                        'item': 'Epitaph Piece',
                        'count': {'type': 'constant', 'value': self._required_epitaph_count}
                    },
                    {
                        'type': 'state_method',
                        'method': 'has_all',
                        'args': [{'type': 'constant', 'value': ['Camera Replica', 'Pile Of Meat']}]
                    },
                    {'type': 'item_check', 'item': 'Monocle'}
                ]
            }

        # Monocle -> Simple item check (not inferred)
        if item_lower == 'monocle':
            return {'type': 'item_check', 'item': 'Monocle'}

        return None

    def _expand_capability(self, capability: str) -> Dict[str, Any] | None:
        """Expand capability rules to item checks."""
        # No capability expansions needed for Inscryption
        return None
