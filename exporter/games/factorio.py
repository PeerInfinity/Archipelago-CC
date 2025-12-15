"""Factorio game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class FactorioGameExportHandler(GenericGameExportHandler):
    """Export handler for Factorio.

    Inherits item data extraction from GenericGameExportHandler.
    Provides Factorio-specific rule simplification for technology names.
    """

    # Factorio rules use resolved technology names (e.g., "steel-processing", "military-2")
    # which come from progressive items (e.g., "progressive-processing", "progressive-military").
    USE_RESOLVED_ITEMS = True

    def get_game_info(self, world) -> Dict[str, Any]:
        """Get Factorio game information including required variables."""
        from worlds.factorio.Technologies import required_technologies

        # Get base game info first
        game_info = super().get_game_info(world)

        # Convert required_technologies to a serializable format
        required_tech_dict = {}
        for ingredient, techs in required_technologies.items():
            required_tech_dict[ingredient] = [tech.name for tech in techs]

        game_info["variables"] = {
            "required_technologies": required_tech_dict
        }

        return game_info

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand rule functions with Factorio-specific logic."""
        if not rule:
            return rule

        # Standard processing from base class
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule['name'])
            return expanded if expanded else rule

        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])]

        # Handle all_of rules that iterate over required_technologies
        # The Python code uses: all(state.has(technology.name, player) for technology in required_technologies[ingredient])
        # But the exported JSON already has technology names as strings, not Technology objects
        # So we need to simplify "technology.name" to just "technology"
        if rule.get('type') == 'all_of':
            iterator_info = rule.get('iterator_info', {})
            iterator = iterator_info.get('iterator', {})

            # Check if this is iterating over required_technologies[something]
            # Case 1: required_technologies is still a name reference
            is_required_tech_name = (iterator.get('type') == 'subscript' and
                iterator.get('value', {}).get('type') == 'name' and
                iterator.get('value', {}).get('name') == 'required_technologies')

            # Case 2: required_technologies has been inlined as a constant dictionary
            # This happens when the analyzer resolves the variable at export time
            is_required_tech_constant = (iterator.get('type') == 'subscript' and
                iterator.get('value', {}).get('type') == 'constant' and
                isinstance(iterator.get('value', {}).get('value'), dict))

            if is_required_tech_name or is_required_tech_constant:
                # The iterator is required_technologies[X], which yields Technology objects in Python
                # but yields name strings in the exported JSON
                # Simplify the element_rule to remove .name attribute access
                element_rule = rule.get('element_rule', {})
                simplified_element = self._simplify_technology_name_access(element_rule, iterator_info.get('target', {}).get('name'))
                if simplified_element:
                    rule['element_rule'] = self.expand_rule(simplified_element, _depth + 1)
                    logger.info(f"[Factorio Exporter] Simplified technology.name access in all_of rule")
                else:
                    # No simplification needed, just recursively expand
                    rule['element_rule'] = self.expand_rule(element_rule, _depth + 1)
            else:
                # Not a required_technologies iterator, just recursively expand
                rule['element_rule'] = self.expand_rule(rule.get('element_rule', {}), _depth + 1)

        return rule

    def _simplify_technology_name_access(self, rule: Dict[str, Any], iterator_var: str) -> Dict[str, Any]:
        """Simplify technology.name attribute access to just technology.

        In Python: technology is a Technology object, so technology.name is needed
        In JSON: technology is already a string (the name), so technology.name is wrong

        Args:
            rule: The rule that may contain technology.name attribute access
            iterator_var: The name of the iterator variable (e.g., "technology")

        Returns:
            Simplified rule, or None if no simplification needed
        """
        logger.info(f"[Factorio Exporter] _simplify_technology_name_access called with iterator_var={iterator_var}, rule type={rule.get('type') if rule else None}")

        if not rule or not iterator_var:
            logger.info(f"[Factorio Exporter] Skipping simplification: rule={bool(rule)}, iterator_var={iterator_var}")
            return None

        # Check if this is an item_check with an attribute access pattern
        if rule.get('type') == 'item_check':
            item = rule.get('item', {})
            logger.info(f"[Factorio Exporter] item_check found, item type={item.get('type')}")

            # Pattern: {"type": "attribute", "object": {"type": "name", "name": "technology"}, "attr": "name"}
            # Should become: {"type": "name", "name": "technology"}
            if (item.get('type') == 'attribute' and
                item.get('attr') == 'name' and
                item.get('object', {}).get('type') == 'name' and
                item.get('object', {}).get('name') == iterator_var):

                logger.info(f"[Factorio Exporter] Simplifying attribute access pattern!")
                # Replace the attribute access with just the name reference
                return {
                    'type': 'item_check',
                    'item': {
                        'type': 'name',
                        'name': iterator_var
                    }
                }

        logger.info(f"[Factorio Exporter] No simplification applied")
        return None

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Return Factorio-specific progression item mapping."""
        from worlds.factorio.Technologies import progressive_technology_table

        mapping_data = {}

        # Build progression mapping from progressive_technology_table
        for prog_name, tech_data in progressive_technology_table.items():
            if tech_data.progressive:
                mapping_data[prog_name] = {
                    'items': [],
                    'base_item': prog_name
                }

                # Add each level of the progressive tech
                for level, tech_name in enumerate(tech_data.progressive, start=1):
                    mapping_data[prog_name]['items'].append({
                        'name': tech_name,
                        'level': level
                    })

        return mapping_data
