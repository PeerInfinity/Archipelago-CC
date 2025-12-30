"""Inscryption game-specific export handler.

Inscryption's helper functions are class methods (not module-level functions),
so they cannot be automatically exported. Instead, we expand the inferred pseudo-items
(like Camera_And_Meat, All_Epitaph_Pieces) to their actual item checks.
"""

from typing import Any, Dict, List
from .generic import GenericGameExportHandler


class InscryptionGameExportHandler(GenericGameExportHandler):
    """Inscryption game handler - expands pseudo-items to actual rule checks."""

    # Disable automatic helper export (class methods can't be auto-exported)
    AUTO_EXPORT_DISCOVERED_HELPERS = False

    def preprocess_world_data(self, world, export_data, player):
        """Store world data needed for rule expansion."""
        super().preprocess_world_data(world, export_data, player)
        self._required_epitaph_count = getattr(world, 'required_epitaph_pieces_count', 9)

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand Inscryption-specific rules."""
        if not rule:
            return rule

        rule = super().expand_rule(rule, _depth)

        # Handle inferred item_checks with pseudo-items
        if rule.get('type') == 'item_check' and rule.get('inferred'):
            item = rule.get('item', '')
            if isinstance(item, str):
                expanded = self._expand_pseudo_item(item)
                if expanded:
                    return expanded

        return rule

    # ==========================================================================
    # Rule construction helpers
    # ==========================================================================

    def _has_all_items(self, items: List[str]) -> Dict[str, Any]:
        """Create a has_all rule for multiple items."""
        return {
            'type': 'state_method',
            'method': 'has_all',
            'args': [{'type': 'constant', 'value': items}]
        }

    def _item_check(self, item: str, count: int = None) -> Dict[str, Any]:
        """Create an item_check rule."""
        rule = {'type': 'item_check', 'item': item}
        if count is not None:
            rule['count'] = {'type': 'constant', 'value': count}
        return rule

    # ==========================================================================
    # Composite requirement rules (reused across multiple patterns)
    # ==========================================================================

    def _camera_and_meat_rule(self) -> Dict[str, Any]:
        """Camera Replica AND Pile Of Meat."""
        return self._has_all_items(['Camera Replica', 'Pile Of Meat'])

    def _epitaph_pieces_rule(self) -> Dict[str, Any]:
        """Epitaph Piece with required count."""
        return self._item_check('Epitaph Piece', self._required_epitaph_count)

    def _bridge_requirements_rule(self) -> Dict[str, Any]:
        """Camera+Meat OR All Epitaph Pieces."""
        return {
            'type': 'or',
            'conditions': [self._camera_and_meat_rule(), self._epitaph_pieces_rule()]
        }

    # ==========================================================================
    # Pseudo-item expansion
    # ==========================================================================

    def _expand_pseudo_item(self, item: str) -> Dict[str, Any] | None:
        """Expand pseudo-items to their actual item checks."""
        item_lower = item.lower().replace('_', ' ').replace('-', ' ')

        # Simple item mappings (exact or near-exact)
        if item_lower == 'monocle':
            return self._item_check('Monocle')
        if 'inspectometer' in item_lower and 'battery' in item_lower:
            return self._item_check('Inspectometer Battery')

        # Composite item requirements (has_all patterns)
        if 'camera' in item_lower and 'meat' in item_lower:
            return self._camera_and_meat_rule()
        if 'epitaph' in item_lower and ('all' in item_lower or 'pieces' in item_lower):
            return self._epitaph_pieces_rule()
        if 'gems' in item_lower and 'battery' in item_lower:
            return self._has_all_items(['Gems Module', 'Inspectometer Battery'])
        if 'transcendence' in item_lower and 'requirements' in item_lower:
            return self._has_all_items(['Quill', 'Gems Module', 'Inspectometer Battery'])

        # Complex requirements (using composite rules)
        if 'bridge' in item_lower and 'requirements' in item_lower:
            return self._bridge_requirements_rule()
        if 'tower' in item_lower and 'requirements' in item_lower:
            return {
                'type': 'and',
                'conditions': [self._item_check('Monocle'), self._bridge_requirements_rule()]
            }

        # Act progression requirements
        if 'act2' in item_lower and 'requirements' in item_lower and 'bridge' not in item_lower:
            return self._item_check('Film Roll')
        if 'act3' in item_lower and 'requirements' in item_lower:
            return {
                'type': 'and',
                'conditions': [
                    self._item_check('Film Roll'),
                    self._epitaph_pieces_rule(),
                    self._camera_and_meat_rule(),
                    self._item_check('Monocle')
                ]
            }

        return None
