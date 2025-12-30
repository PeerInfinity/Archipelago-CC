"""Factorio game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class FactorioGameExportHandler(GenericGameExportHandler):
    """Export handler for Factorio.

    This exporter requires custom methods that cannot be replaced with declarative
    class attributes:

    - get_game_info: Exports required_technologies dict from the Technologies module.
      This data is inlined into the rules and needed by the frontend to evaluate
      which technologies are required for each ingredient.

    - expand_rule: Transforms 'technology.name' attribute access to just 'technology'
      when iterating over required_technologies in all_of rules. This is needed because
      in Python, technologies are objects with a .name attribute, but in the exported
      JSON, they're already strings (the tech names).

    - get_progression_mapping: Builds the progressive technology mapping from
      progressive_technology_table. Each progressive item (e.g., progressive-military)
      maps to a sequence of technologies (military, military-2, military-3, military-4).
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
        """Expand rule functions with Factorio-specific logic.

        Handles all_of rules that iterate over required_technologies, simplifying
        'technology.name' to just 'technology' since exported JSON has tech names
        as strings, not Technology objects.
        """
        if not rule:
            return rule

        # Handle all_of rules that iterate over required_technologies
        if rule.get('type') == 'all_of':
            iterator_info = rule.get('iterator_info', {})
            iterator = iterator_info.get('iterator', {})

            # Check if iterating over required_technologies[ingredient] (as name ref or inlined dict)
            if self._is_required_tech_iterator(iterator):
                element_rule = rule.get('element_rule', {})
                target_name = iterator_info.get('target', {}).get('name')
                simplified = self._simplify_technology_name_access(element_rule, target_name)
                rule['element_rule'] = self.expand_rule(simplified or element_rule, _depth + 1)
            else:
                rule['element_rule'] = self.expand_rule(rule.get('element_rule', {}), _depth + 1)
            return rule

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
