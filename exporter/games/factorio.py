"""Factorio game-specific export handler.

Exports required_technologies dict and simplifies technology.name attribute access
in all_of rules. Progressive item mapping is auto-detected from progressive_technology_table.
"""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class FactorioGameExportHandler(GenericGameExportHandler):
    """Export handler for Factorio."""

    # Factorio rules use resolved technology names (e.g., "steel-processing", "military-2")
    # which come from progressive items (e.g., "progressive-processing", "progressive-military").
    USE_RESOLVED_ITEMS = True

    def get_game_info(self, world) -> Dict[str, Any]:
        """Get Factorio game information including required_technologies."""
        from worlds.factorio.Technologies import required_technologies

        game_info = super().get_game_info(world)

        # Convert required_technologies to a serializable format
        game_info["variables"] = {
            "required_technologies": {
                ingredient: [tech.name for tech in techs]
                for ingredient, techs in required_technologies.items()
            }
        }

        return game_info

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand rule functions with Factorio-specific logic.

        Simplifies 'technology.name' to just 'technology' when iterating over
        required_technologies, since exported JSON has tech names as strings.
        """
        if not rule:
            return rule

        # Handle all_of rules that iterate over required_technologies
        if rule.get('type') == 'all_of':
            iterator_info = rule.get('iterator_info', {})
            iterator = iterator_info.get('iterator', {})

            # Simplify technology.name to just technology when iterating over required_technologies
            if self._is_required_tech_iterator(iterator):
                element_rule = rule.get('element_rule', {})
                target_name = iterator_info.get('target', {}).get('name')
                simplified = self._simplify_technology_name_access(element_rule, target_name)
                if simplified:
                    rule['element_rule'] = simplified

        # Let base class handle all standard processing
        return super().expand_rule(rule, _depth)

    def _is_required_tech_iterator(self, iterator: Dict[str, Any]) -> bool:
        """Check if iterator is accessing required_technologies[something]."""
        if iterator.get('type') != 'subscript':
            return False
        value = iterator.get('value', {})
        # Case 1: required_technologies as name reference
        if value.get('type') == 'name' and value.get('name') == 'required_technologies':
            return True
        # Case 2: required_technologies inlined as constant dict
        if value.get('type') == 'constant' and isinstance(value.get('value'), dict):
            return True
        return False

    def _simplify_technology_name_access(self, rule: Dict[str, Any], iterator_var: str) -> Dict[str, Any]:
        """Simplify technology.name attribute access to just technology.

        In Python, 'technology' is a Technology object, so .name is needed.
        In JSON, 'technology' is already a string (the name), so .name is wrong.

        Returns simplified rule, or None if no simplification needed.
        """
        if not rule or not iterator_var:
            return None

        # Check for item_check with attribute access pattern:
        # {"type": "attribute", "object": {"type": "name", "name": "technology"}, "attr": "name"}
        if rule.get('type') == 'item_check':
            item = rule.get('item', {})
            if (item.get('type') == 'attribute' and
                item.get('attr') == 'name' and
                item.get('object', {}).get('type') == 'name' and
                item.get('object', {}).get('name') == iterator_var):
                # Replace attribute access with just the name reference
                return {
                    'type': 'item_check',
                    'item': {'type': 'name', 'name': iterator_var}
                }

        return None
