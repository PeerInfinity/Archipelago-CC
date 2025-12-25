"""Terraria game-specific export handler.

Terraria uses a custom DSV (Rules.dsv) rule system with special Condition objects.
This exporter converts those conditions to the standard JSON rule format.
"""

from typing import Dict, Any, List, Union, Tuple
from .generic import GenericGameExportHandler
from BaseClasses import ItemClassification
import logging

logger = logging.getLogger(__name__)

class TerrariaGameExportHandler(GenericGameExportHandler):
    """Terraria export handler with custom rule system support."""

    # Export settings at top level so they can be resolved by 'name' type rules
    COMPUTED_SETTINGS = {
        'calamity': lambda w, m, p: bool(w.options.calamity.value) if hasattr(w.options, 'calamity') else False,
        'grindy_achievements': lambda w, m, p: bool(w.options.grindy_achievements.value) if hasattr(w.options, 'grindy_achievements') else False,
        'getfixedboi': lambda w, m, p: bool(w.options.getfixedboi.value) if hasattr(w.options, 'getfixedboi') else False,
    }

    def __init__(self):
        super().__init__()
        # Import Terraria-specific constants and types
        from worlds.terraria.Checks import (
            COND_ITEM, COND_LOC, COND_FN, COND_GROUP,
            rules, rule_indices, npcs, pickaxes, hammers,
            mech_bosses, armor_minions, accessory_minions
        )

        self.COND_ITEM = COND_ITEM
        self.COND_LOC = COND_LOC
        self.COND_FN = COND_FN
        self.COND_GROUP = COND_GROUP
        self.rules = rules
        self.rule_indices = rule_indices
        self.npcs = npcs
        self.pickaxes = pickaxes
        self.hammers = hammers
        self.mech_bosses = mech_bosses
        self.armor_minions = armor_minions
        self.accessory_minions = accessory_minions

    def override_rule_analysis(self, rule_func, rule_target_name: str = None) -> Dict[str, Any]:
        """Override rule analysis for Terraria locations.

        Terraria uses a custom rule system with Condition objects. Instead of
        analyzing the lambda function, we directly access the rule data from
        the Terraria rule system.
        """
        try:
            # Extract location name from rule_target_name
            if not rule_target_name:
                return None

            # Get the rule data from Terraria's rule system
            if rule_target_name not in self.rule_indices:
                logger.debug(f"Location {rule_target_name} not found in Terraria rule_indices")
                return None

            rule = self.rules[self.rule_indices[rule_target_name]]

            # Convert the rule to JSON format
            result = self._convert_rule(rule.operator, rule.conditions)

            # IMPORTANT: We need to return a dict, not None, to signal that we handled this.
            # If result is None (always accessible), wrap it in a sentinel dict.
            if result is None:
                return {'__terraria_handled__': True, '__value__': None}
            return result

        except Exception as e:
            logger.error(f"Error in override_rule_analysis for {rule_target_name}: {e}", exc_info=True)
            return None

    def _convert_rule(self, operator: Union[bool, None], conditions: List) -> Dict[str, Any]:
        """Convert Terraria operator + conditions to JSON rule format.

        Args:
            operator: True = OR, False = AND, None = single condition or no conditions
            conditions: List of Condition objects
        """
        if not conditions:
            # No conditions means always accessible
            return None

        if operator is None:
            # Single condition or no conditions
            if len(conditions) == 0:
                return None
            elif len(conditions) == 1:
                return self._convert_condition(conditions[0])
            else:
                logger.error(f"Multiple conditions without operator: {len(conditions)}")
                # Default to AND
                return {
                    'type': 'and',
                    'conditions': [self._convert_condition(c) for c in conditions]
                }
        elif operator:
            # OR operator
            return {
                'type': 'or',
                'conditions': [self._convert_condition(c) for c in conditions]
            }
        else:
            # AND operator
            return {
                'type': 'and',
                'conditions': [self._convert_condition(c) for c in conditions]
            }

    def _convert_condition(self, condition) -> Dict[str, Any]:
        """Convert a single Terraria Condition object to JSON rule format.

        Condition types:
        - COND_ITEM (0): Check if player has an item
        - COND_LOC (1): Check if a location is accessible (recursively)
        - COND_FN (2): Call a special function (npc, pickaxe, etc.)
        - COND_GROUP (3): Check group conditions
        """
        # condition.sign: True = positive check, False = negated check
        # condition.type: 0=ITEM, 1=LOC, 2=FN, 3=GROUP
        # condition.condition: The condition data (name, tuple, etc.)
        # condition.argument: Optional argument for functions

        if condition.type == self.COND_ITEM:
            # Check for an item
            item_name = self._get_item_name(condition.condition)
            rule = {
                'type': 'item_check',
                'item': item_name
            }

            # Handle negation
            if not condition.sign:
                rule = {'type': 'not', 'condition': rule}

            return rule

        elif condition.type == self.COND_LOC:
            # Check if a location is accessible (recursive rule check)
            loc_name = condition.condition
            if loc_name not in self.rule_indices:
                logger.error(f"Location {loc_name} not found in rule_indices")
                return {'type': 'constant', 'value': False}

            loc_rule = self.rules[self.rule_indices[loc_name]]
            rule = self._convert_rule(loc_rule.operator, loc_rule.conditions)

            # Handle negation
            if not condition.sign:
                if rule:
                    rule = {'type': 'not', 'condition': rule}
                else:
                    # Negating "always accessible" means never accessible
                    return {'type': 'constant', 'value': False}

            return rule if rule else {'type': 'constant', 'value': True}

        elif condition.type == self.COND_FN:
            # Special function check
            fn_name = condition.condition
            fn_arg = condition.argument

            if fn_name == "npc":
                # Check if player has at least N NPCs
                rule = self._create_npc_check(fn_arg)
            elif fn_name == "calamity":
                # Check for calamity setting
                rule = self._create_setting_check("calamity")
            elif fn_name == "grindy":
                # Check for grindy achievements setting
                rule = self._create_setting_check("grindy_achievements")
            elif fn_name == "getfixedboi":
                # Check for getfixedboi setting
                rule = self._create_setting_check("getfixedboi")
            elif fn_name == "pickaxe":
                # Check if player has a pickaxe with at least N power
                rule = self._create_pickaxe_check(fn_arg)
            elif fn_name == "hammer":
                # Check if player has a hammer with at least N power
                rule = self._create_hammer_check(fn_arg)
            elif fn_name == "mech_boss":
                # Check if player has defeated at least N mechanical bosses
                rule = self._create_mech_boss_check(fn_arg)
            elif fn_name == "minions":
                # Check if player has at least N minion slots
                rule = self._create_minion_check(fn_arg)
            else:
                logger.error(f"Unknown function: {fn_name}")
                rule = {'type': 'constant', 'value': False}

            # Handle negation
            if not condition.sign:
                rule = {'type': 'not', 'condition': rule}

            return rule

        elif condition.type == self.COND_GROUP:
            # Group condition (operator, conditions)
            operator, conditions = condition.condition
            rule = self._convert_rule(operator, conditions)

            # Handle negation
            if not condition.sign:
                if rule:
                    rule = {'type': 'not', 'condition': rule}
                else:
                    return {'type': 'constant', 'value': False}

            return rule if rule else {'type': 'constant', 'value': True}

        else:
            logger.error(f"Unknown condition type: {condition.type}")
            return {'type': 'constant', 'value': False}

    def _get_item_name(self, condition_name: str) -> str:
        """Get the actual item name from a condition name.

        Some conditions have an "Item" flag that maps to a different item name.
        """
        if condition_name in self.rule_indices:
            rule = self.rules[self.rule_indices[condition_name]]
            if "Item" in rule.flags:
                return rule.flags.get("Item") or f"Post-{condition_name}"
        return condition_name

    def _create_npc_check(self, required_count: int) -> Dict[str, Any]:
        """Create a rule to check if player has at least N NPCs."""
        # Convert to: player has at least N items from the NPC list
        return {
            'type': 'helper',
            'name': 'has_n_from_list',
            'args': [
                {'type': 'constant', 'value': list(self.npcs)},
                {'type': 'constant', 'value': required_count}
            ]
        }

    def _create_setting_check(self, setting_name: str) -> Dict[str, Any]:
        """Create a rule to check a game setting.

        Uses 'setting_value' type rule which retrieves the setting from the
        exported options. The setting must be exported via the standard options
        system or COMPUTED_SETTINGS.
        """
        return {'type': 'setting_value', 'setting': setting_name}

    def _create_pickaxe_check(self, required_power: int) -> Dict[str, Any]:
        """Create a rule to check if player has a pickaxe with at least N power."""
        # Create OR condition for all pickaxes with sufficient power
        valid_pickaxes = [
            name for name, power in self.pickaxes.items()
            if power >= required_power
        ]

        if not valid_pickaxes:
            return {'type': 'constant', 'value': False}

        if len(valid_pickaxes) == 1:
            return {'type': 'item_check', 'item': valid_pickaxes[0]}

        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': name}
                for name in valid_pickaxes
            ]
        }

    def _create_hammer_check(self, required_power: int) -> Dict[str, Any]:
        """Create a rule to check if player has a hammer with at least N power."""
        # Create OR condition for all hammers with sufficient power
        valid_hammers = [
            name for name, power in self.hammers.items()
            if power >= required_power
        ]

        if not valid_hammers:
            return {'type': 'constant', 'value': False}

        if len(valid_hammers) == 1:
            return {'type': 'item_check', 'item': valid_hammers[0]}

        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': name}
                for name in valid_hammers
            ]
        }

    def _create_mech_boss_check(self, required_count: int) -> Dict[str, Any]:
        """Create a rule to check if player has defeated at least N mechanical bosses."""
        return {
            'type': 'helper',
            'name': 'has_n_from_list',
            'args': [
                {'type': 'constant', 'value': self.mech_bosses},
                {'type': 'constant', 'value': required_count}
            ]
        }

    def _create_minion_check(self, required_count: int) -> Dict[str, Any]:
        """Create a rule to check if player has at least N minion slots.

        This is complex because:
        - Base minion count is 1
        - Armor sets provide a fixed number of minions (and only the best one counts)
        - Accessories add their minion counts together
        """
        return {
            'type': 'helper',
            'name': 'has_minions',
            'args': [
                {'type': 'constant', 'value': required_count}
            ]
        }

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export Terraria-specific settings including minion equipment data."""
        settings = super().get_settings_data(world, multiworld, player)

        # Export armor minion data for has_minions helper
        settings['armor_minions'] = dict(self.armor_minions)

        # Export accessory minion data for has_minions helper
        settings['accessory_minions'] = dict(self.accessory_minions)

        return settings

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """Define computed helpers for Terraria.

        Provides rule-based definitions for:
        - has_n_from_list: Check if player has at least N items from a list
        - has_minions: Check if player has at least N minion slots
        """
        helper_defs = super().get_helper_definitions(world)

        # has_n_from_list(items, required_count)
        # Logic: sum(1 for item in items if has(item)) >= required_count
        helper_defs['has_n_from_list'] = {
            'params': ['items', 'required_count'],
            'body': {
                'type': 'compare',
                'op': '>=',
                'left': {
                    'type': 'sum_of',
                    'iterator_info': {
                        'target': {'type': 'name', 'name': 'item'},
                        'iterator': {'type': 'name', 'name': 'items'},
                        'condition': {
                            'type': 'item_check',
                            'item': {'type': 'name', 'name': 'item'}
                        }
                    },
                    'element_rule': {'type': 'constant', 'value': 1}
                },
                'right': {'type': 'name', 'name': 'required_count'}
            }
        }

        # has_minions(required_count)
        # Logic: (1 + max(armor bonuses) + sum(accessory bonuses)) >= required_count
        # Where:
        #   max(armor bonuses) = max(bonus for armor, bonus in armor_minions.items() if has(armor))
        #   sum(accessory bonuses) = sum(bonus for acc, bonus in accessory_minions.items() if has(acc))
        helper_defs['has_minions'] = {
            'params': ['required_count'],
            'body': {
                'type': 'compare',
                'op': '>=',
                'left': {
                    'type': 'binary_op',
                    'op': '+',
                    'left': {
                        'type': 'binary_op',
                        'op': '+',
                        'left': {'type': 'constant', 'value': 1},  # Base minion count
                        'right': {
                            # max(bonus for armor, bonus in armor_minions.items() if has(armor))
                            # Use conditional to handle empty case (return 0 if no armor found)
                            'type': 'conditional',
                            'test': {
                                # Check if any armor is owned: any(has(a) for a in armor_minions.keys())
                                'type': 'any_of',
                                'iterator_info': {
                                    'target': {'type': 'name', 'name': 'armor'},
                                    'iterator': {
                                        'type': 'method_call',
                                        'object': {'type': 'setting_value', 'setting': 'armor_minions'},
                                        'method': 'keys',
                                        'args': []
                                    }
                                },
                                'element_rule': {
                                    'type': 'item_check',
                                    'item': {'type': 'name', 'name': 'armor'}
                                }
                            },
                            'if_true': {
                                # max of bonuses for owned armor
                                'type': 'max',
                                'iterable': {
                                    'type': 'generator_expression',
                                    'element': {'type': 'name', 'name': 'bonus'},
                                    'comprehension': {
                                        'target': {
                                            'type': 'tuple',
                                            'elements': [
                                                {'type': 'name', 'name': 'armor'},
                                                {'type': 'name', 'name': 'bonus'}
                                            ]
                                        },
                                        'iterator': {
                                            'type': 'method_call',
                                            'object': {'type': 'setting_value', 'setting': 'armor_minions'},
                                            'method': 'items',
                                            'args': []
                                        },
                                        'conditions': [{
                                            'type': 'item_check',
                                            'item': {'type': 'name', 'name': 'armor'}
                                        }]
                                    }
                                }
                            },
                            'if_false': {'type': 'constant', 'value': 0}
                        }
                    },
                    'right': {
                        # sum(bonus for acc, bonus in accessory_minions.items() if has(acc))
                        'type': 'sum',
                        'iterable': {
                            'type': 'generator_expression',
                            'element': {'type': 'name', 'name': 'bonus'},
                            'comprehension': {
                                'target': {
                                    'type': 'tuple',
                                    'elements': [
                                        {'type': 'name', 'name': 'acc'},
                                        {'type': 'name', 'name': 'bonus'}
                                    ]
                                },
                                'iterator': {
                                    'type': 'method_call',
                                    'object': {'type': 'setting_value', 'setting': 'accessory_minions'},
                                    'method': 'items',
                                    'args': []
                                },
                                'conditions': [{
                                    'type': 'item_check',
                                    'item': {'type': 'name', 'name': 'acc'}
                                }]
                            }
                        }
                    }
                },
                'right': {'type': 'name', 'name': 'required_count'}
            }
        }

        return helper_defs
