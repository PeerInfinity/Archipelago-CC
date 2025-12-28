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
    # Disable automatic helper export (class methods can't be auto-exported)
    AUTO_EXPORT_DISCOVERED_HELPERS = False

    def preprocess_world_data(self, world, export_data, player):
        """Store world data needed for rule expansion."""
        super().preprocess_world_data(world, export_data, player)
        # Get the required epitaph pieces count from world (default: 9)
        self._required_epitaph_count = getattr(world, 'required_epitaph_pieces_count', 9)
        if hasattr(world, 'required_epitaph_pieces_count'):
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

        return rule

    def _camera_and_meat_rule(self) -> Dict[str, Any]:
        """Return the Camera Replica AND Pile Of Meat requirement."""
        return {
            'type': 'state_method',
            'method': 'has_all',
            'args': [{'type': 'constant', 'value': ['Camera Replica', 'Pile Of Meat']}]
        }

    def _epitaph_pieces_rule(self) -> Dict[str, Any]:
        """Return the Epitaph Piece count requirement."""
        return {
            'type': 'item_check',
            'item': 'Epitaph Piece',
            'count': {'type': 'constant', 'value': self._required_epitaph_count}
        }

    def _bridge_requirements_rule(self) -> Dict[str, Any]:
        """Return Camera+Meat OR All Epitaph Pieces."""
        return {
            'type': 'or',
            'conditions': [self._camera_and_meat_rule(), self._epitaph_pieces_rule()]
        }

    def _expand_pseudo_item(self, item: str) -> Dict[str, Any] | None:
        """Expand pseudo-items to their actual item checks."""
        item_lower = item.lower().replace('_', ' ').replace('-', ' ')

        # Camera_And_Meat -> Camera Replica AND Pile Of Meat
        if 'camera' in item_lower and 'meat' in item_lower:
            return self._camera_and_meat_rule()

        # All_Epitaph_Pieces -> Epitaph Piece (count)
        if 'epitaph' in item_lower and ('all' in item_lower or 'pieces' in item_lower):
            return self._epitaph_pieces_rule()

        # Act2_Bridge_Requirements -> Camera+Meat OR All Epitaph Pieces
        if 'bridge' in item_lower and 'requirements' in item_lower:
            return self._bridge_requirements_rule()

        # Tower_Requirements -> Monocle AND Bridge Requirements
        if 'tower' in item_lower and 'requirements' in item_lower:
            return {
                'type': 'and',
                'conditions': [{'type': 'item_check', 'item': 'Monocle'}, self._bridge_requirements_rule()]
            }

        # Transcendence_Requirements -> Quill AND Gems Module AND Inspectometer Battery
        if 'transcendence' in item_lower and 'requirements' in item_lower:
            return {
                'type': 'state_method',
                'method': 'has_all',
                'args': [{'type': 'constant', 'value': ['Quill', 'Gems Module', 'Inspectometer Battery']}]
            }

        # Inspectometer_Battery -> Inspectometer Battery
        if 'inspectometer' in item_lower and 'battery' in item_lower:
            return {'type': 'item_check', 'item': 'Inspectometer Battery'}

        # Gems_And_Battery -> Gems Module AND Inspectometer Battery
        if 'gems' in item_lower and 'battery' in item_lower:
            return {
                'type': 'state_method',
                'method': 'has_all',
                'args': [{'type': 'constant', 'value': ['Gems Module', 'Inspectometer Battery']}]
            }

        # Act2_Requirements -> Film Roll
        if 'act2' in item_lower and 'requirements' in item_lower and 'bridge' not in item_lower:
            return {'type': 'item_check', 'item': 'Film Roll'}

        # Act3_Requirements -> Film Roll + All Epitaph Pieces + Camera+Meat + Monocle
        if 'act3' in item_lower and 'requirements' in item_lower:
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'item_check', 'item': 'Film Roll'},
                    self._epitaph_pieces_rule(),
                    self._camera_and_meat_rule(),
                    {'type': 'item_check', 'item': 'Monocle'}
                ]
            }

        # Monocle -> Simple item check (not inferred)
        if item_lower == 'monocle':
            return {'type': 'item_check', 'item': 'Monocle'}

        return None
