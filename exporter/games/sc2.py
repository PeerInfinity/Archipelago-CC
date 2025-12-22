"""Starcraft 2 game-specific export handler."""

from typing import Dict, Any, Optional, Callable
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

# Import SC2 rating dictionaries for export
try:
    from worlds.sc2.rules import (
        tvx_defense_ratings, tvz_defense_ratings, tvx_air_defense_ratings,
        zvx_defense_ratings, zvx_air_defense_ratings,
        pvx_defense_ratings, pvz_defense_ratings,
        terran_passive_ratings, zerg_passive_ratings, protoss_passive_ratings,
        soa_energy_ratings, soa_passive_ratings, soa_ultimate_ratings
    )
    SC2_RATING_DICTS_AVAILABLE = True
except ImportError:
    SC2_RATING_DICTS_AVAILABLE = False
    logger.debug("Could not import SC2 rating dictionaries - static data export disabled")

# Import SC2 item groups for kerrigan helpers
try:
    from worlds.sc2.item.item_groups import (
        kerrigan_non_ulimates, kerrigan_logic_active_abilities,
        kerrigan_abilities, kerrigan_passives, kerrigan_active_abilities
    )
    SC2_KERRIGAN_GROUPS_AVAILABLE = True
except ImportError:
    SC2_KERRIGAN_GROUPS_AVAILABLE = False
    logger.debug("Could not import SC2 kerrigan item groups - kerrigan helper export disabled")

class SC2GameExportHandler(GenericGameExportHandler):
    """Export handler for Starcraft 2 game-specific rules and items."""

    # AUTO_EXPORT_DISCOVERED_HELPERS is True by default in GenericGameExportHandler

    # Module containing helper functions
    HELPER_MODULES = ['worlds.sc2.rules']

    # Helpers too complex for automatic export (loops, closures, complex calculations)
    # NOTE: defense_rating helpers now work with game_info export for rating dictionaries
    # power_rating helpers call soa_power_rating which has complex iteration with break statements
    HELPERS_TO_EXPORT_BLACKLIST = {
        # weapon_armor_upgrade_count - references item_groups module which isn't available in frontend
        'weapon_armor_upgrade_count',
        # is_item_placement - state check method, not applicable in frontend
        'is_item_placement',
        # competent_comp helpers - complex conditional logic, but could work if dependencies are met
        'terran_competent_comp', 'protoss_competent_comp', 'zerg_competent_comp',
        # defense_rating helpers - now exported with game_info support
        # 'terran_defense_rating', 'protoss_defense_rating', 'zerg_defense_rating',
        # power_rating helpers - testing export (uses soa_power_rating with loops/break)
        # 'terran_power_rating', 'protoss_power_rating', 'zerg_power_rating',
        # Mission requirements that call power_rating or other complex helpers
        'terran_havens_fall_requirement', 'terran_great_train_robbery_train_stopper',
        'terran_welcome_to_the_jungle_requirement', 'zerg_welcome_to_the_jungle_requirement',
        'protoss_welcome_to_the_jungle_requirement', 'terran_night_terrors_requirement',
        'terran_engine_of_destruction_requirement', 'engine_of_destruction_requirement',
        'terran_trouble_in_paradise_requirement', 'terran_media_blitz_requirement',
        'terran_gates_of_hell_requirement', 'terran_all_in_requirement',
        # Kerrigan helpers - kerrigan_levels uses get_full_item_list(), two_kerrigan_actives has a bug
        'kerrigan_levels', 'two_kerrigan_actives',
        # basic_kerrigan - testing if it can be exported (iterates over imported list)
        # Helpers that call other blacklisted helpers
        'terran_competent_ground_to_air', 'protoss_competent_ground_to_air',
        'zerg_competent_ground_to_air', 'terran_beats_protoss_deathball',
        'terran_base_trasher',  # calls terran_competent_comp
        'terran_respond_to_colony_infestations',  # calls terran_havens_fall_requirement
        # Simple helpers - now exported (just boolean logic):
        # 'terran_can_rescue',  # just has_any + advanced_tactics
        # 'terran_cliffjumper',  # just has/has_all
        # 'terran_sustainable_mech_heal',  # just boolean logic
        # 'terran_able_to_snipe_defiler',  # just has/has_any/has_all
    }

    def _extract_closure_vars(self, rule_func: Callable) -> Dict[str, Any]:
        """Extract closure variables from a function."""
        closure_vars = {}
        if hasattr(rule_func, '__closure__') and rule_func.__closure__:
            if hasattr(rule_func, '__code__'):
                freevars = rule_func.__code__.co_freevars
                for i, var_name in enumerate(freevars):
                    if i < len(rule_func.__closure__):
                        cell = rule_func.__closure__[i]
                        try:
                            closure_vars[var_name] = cell.cell_contents
                        except ValueError:
                            pass
        return closure_vars

    def _get_simplified_helper(self, helper_name: str) -> Optional[Dict[str, Any]]:
        """
        Get simplified logic for blacklisted helpers.

        Some helpers can't be fully exported because they call other blacklisted helpers
        or use complex patterns. For these, we provide simplified approximations that
        capture the most common accessibility paths.

        Returns:
            Simplified rule dict if available, None otherwise
        """
        # terran_competent_ground_to_air: Common paths include having Goliath or Cyclone
        # Full logic: has(Goliath) OR (has_any(Marine, Dominion Trooper) AND bio_heal AND weapons >= 2)
        #             OR (advanced_tactics AND (has(Cyclone) OR has_all(Thor, Payload)))
        # We use has_any(Goliath, Cyclone, Thor) to cover multiple progression paths
        if helper_name == 'terran_competent_ground_to_air':
            return {
                'type': 'or',
                'conditions': [
                    {'type': 'item_check', 'item': 'Goliath'},
                    {'type': 'item_check', 'item': 'Cyclone'},
                    {'type': 'item_check', 'item': 'Thor'}
                ]
            }

        # protoss_competent_ground_to_air: Common path is Dragoon or Stalker
        if helper_name == 'protoss_competent_ground_to_air':
            return {
                'type': 'or',
                'conditions': [
                    {'type': 'item_check', 'item': 'Dragoon'},
                    {'type': 'item_check', 'item': 'Stalker'}
                ]
            }

        # zerg_competent_ground_to_air: Common path is Hydralisk
        if helper_name == 'zerg_competent_ground_to_air':
            return {'type': 'item_check', 'item': 'Hydralisk'}

        # terran_base_trasher: Requires competent_comp (complex) but simplified to
        # having siege tank with jump jets as the most common path
        if helper_name == 'terran_base_trasher':
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'item_check', 'item': 'Siege Tank'},
                    {'type': 'item_check', 'item': 'Jump Jets (Siege Tank)'}
                ]
            }

        # No simplified version available
        return None

    def override_rule_analysis(self, rule_func: Callable, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Override rule analysis for SC2 mission entry rules.

        SC2 uses complex entry rule patterns that the generic analyzer can't handle:
        - CountMissionsEntryRule: count_missions closure with target_amount and beat_items list
        - SubRuleEntryRule: count_rules closure with sub_lambdas
        - BeatMissionsEntryRule: has_all closure with missions_to_beat
        - Complex helper methods: should be kept as helper calls, not expanded
        """
        func_name = getattr(rule_func, '__name__', '')
        logger.debug(f"[SC2] override_rule_analysis called for '{rule_target_name}' with func_name='{func_name}'")

        # Check if this is a complex helper method that should not be expanded
        # For blacklisted helpers, use custom simplified logic where available,
        # otherwise return True_ (overly permissive is safer than blocking progression)
        if func_name in self.HELPERS_TO_EXPORT_BLACKLIST:
            simplified = self._get_simplified_helper(func_name)
            if simplified:
                logger.debug(f"[SC2] Blacklisted helper '{func_name}' - using simplified export")
                return simplified
            logger.debug(f"[SC2] Blacklisted helper '{func_name}' - returning True_ (no simplified version)")
            return {'type': 'constant', 'value': True}

        # Handle count_missions pattern (from CountMissionsEntryRule.to_lambda)
        if func_name == 'count_missions':
            return self._handle_count_missions_rule(rule_func, rule_target_name)

        # Handle count_rules pattern (from SubRuleEntryRule.to_lambda)
        if func_name == 'count_rules':
            return self._handle_count_rules_rule(rule_func, rule_target_name)

        # Handle lambda patterns - could be BeatMissionsEntryRule or combined rules
        if func_name == '<lambda>':
            # First try BeatMissionsEntryRule pattern (lambda with self.missions_to_beat)
            result = self._handle_beat_missions_lambda(rule_func, rule_target_name)
            if result:
                logger.debug(f"[SC2] BeatMissionsEntryRule handler returned result for '{rule_target_name}'")
                return result

            # Then try combined rules that contain count_missions patterns
            result = self._handle_lambda_with_count_missions(rule_func, rule_target_name)
            if result:
                logger.debug(f"[SC2] lambda handler returned result for '{rule_target_name}'")
                return result

        return None

    def _handle_count_missions_rule(self, rule_func: Callable, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Handle the count_missions closure function from CountMissionsEntryRule.

        The function has closure variables:
        - beat_items: list of item names to check
        - self: the CountMissionsEntryRule object which has target_amount
        """
        closure_vars = self._extract_closure_vars(rule_func)

        beat_items = closure_vars.get('beat_items', [])
        entry_rule = closure_vars.get('self')

        if not beat_items:
            logger.warning(f"[SC2] count_missions rule missing beat_items for '{rule_target_name}'")
            return None

        target_amount = getattr(entry_rule, 'target_amount', len(beat_items)) if entry_rule else len(beat_items)

        if target_amount == 0:
            return {'type': 'constant', 'value': True}

        # Use count_true rule type - counts how many conditions are true
        return {
            'type': 'count_true',
            'conditions': [{'type': 'item_check', 'item': item} for item in beat_items],
            'count': target_amount
        }

    def _handle_count_rules_rule(self, rule_func: Callable, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Handle the count_rules closure function from SubRuleEntryRule.

        The function has closure variables:
        - sub_lambdas: list of rule functions to evaluate
        - self: the SubRuleEntryRule object which has target_amount
        """
        closure_vars = self._extract_closure_vars(rule_func)

        sub_lambdas = closure_vars.get('sub_lambdas', [])
        entry_rule = closure_vars.get('self')

        if not sub_lambdas:
            logger.warning(f"[SC2] count_rules rule missing sub_lambdas for '{rule_target_name}'")
            return None

        target_amount = getattr(entry_rule, 'target_amount', len(sub_lambdas)) if entry_rule else len(sub_lambdas)

        if target_amount == 0:
            return {'type': 'constant', 'value': True}

        # Recursively process each sub_lambda
        sub_rules = []
        for i, sub_lambda in enumerate(sub_lambdas):
            sub_rule = self._process_sub_rule(sub_lambda, f"{rule_target_name}:sub{i}")
            if sub_rule:
                sub_rules.append(sub_rule)
            else:
                logger.warning(f"[SC2] Failed to process sub_rule {i} for '{rule_target_name}'")

        if not sub_rules:
            return {'type': 'constant', 'value': True}

        if len(sub_rules) == 1 and target_amount == 1:
            return sub_rules[0]

        return {
            'type': 'count_true',
            'conditions': sub_rules,
            'count': target_amount
        }

    def _process_sub_rule(self, rule_func: Callable, context: str) -> Optional[Dict[str, Any]]:
        """Process a sub-rule function, dispatching to appropriate handler."""
        func_name = getattr(rule_func, '__name__', '')

        if func_name == 'count_missions':
            return self._handle_count_missions_rule(rule_func, context)
        elif func_name == 'count_rules':
            return self._handle_count_rules_rule(rule_func, context)
        elif func_name == '<lambda>':
            # Try BeatMissionsEntryRule pattern first
            result = self._handle_beat_missions_lambda(rule_func, context)
            if result:
                return result
            # Then try lambda with count patterns
            return self._handle_lambda_with_count_missions(rule_func, context)

        return None

    def _handle_beat_missions_lambda(self, rule_func: Callable, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Handle lambdas from BeatMissionsEntryRule.to_lambda.

        The lambda is: lambda state: state.has_all([mission.beat_item() for mission in self.missions_to_beat], player)
        Closure has 'self' which is the BeatMissionsEntryRule with missions_to_beat attribute.
        """
        closure_vars = self._extract_closure_vars(rule_func)
        entry_rule = closure_vars.get('self')

        if not entry_rule:
            return None

        missions_to_beat = getattr(entry_rule, 'missions_to_beat', None)
        if not missions_to_beat:
            return None

        try:
            beat_items = [mission.beat_item() for mission in missions_to_beat]
        except Exception as e:
            logger.warning(f"[SC2] Could not extract beat items from BeatMissionsEntryRule for '{rule_target_name}': {e}")
            return None

        if len(beat_items) == 0:
            return {'type': 'constant', 'value': True}

        return {
            'type': 'state_method',
            'method': 'has_all',
            'args': [{'type': 'constant', 'value': beat_items}]
        }

    def _handle_lambda_with_count_missions(self, rule_func: Callable, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Handle lambdas that combine count_missions with other rules.

        These typically look like:
        lambda state, campaign_rule=..., layout_rule=..., mission_rule=...:
            campaign_rule(state) and layout_rule(state) and mission_rule(state)
        """
        closure_vars = self._extract_closure_vars(rule_func)

        # Check if any closure vars are count_missions or other handled functions
        handled_rules = []

        for var_name, var_value in closure_vars.items():
            if callable(var_value):
                func_name = getattr(var_value, '__name__', '')
                if func_name == 'count_missions':
                    result = self._handle_count_missions_rule(var_value, f"{rule_target_name}:{var_name}")
                    if result:
                        handled_rules.append(result)
                elif func_name == 'count_rules':
                    result = self._handle_count_rules_rule(var_value, f"{rule_target_name}:{var_name}")
                    if result:
                        handled_rules.append(result)
                elif func_name == '<lambda>':
                    # Try BeatMissionsEntryRule pattern
                    result = self._handle_beat_missions_lambda(var_value, f"{rule_target_name}:{var_name}")
                    if result:
                        handled_rules.append(result)

        if not handled_rules:
            return None

        if len(handled_rules) == 1:
            return handled_rules[0]

        return {
            'type': 'and',
            'conditions': handled_rules
        }

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """
        Recursively expand rule functions with SC2-specific logic pattern recognition.

        SC2 uses a logic object with helper methods (e.g., logic.terran_early_tech())
        and attributes (e.g., logic.take_over_ai_allies, logic.advanced_tactics).
        These need to be converted to helper calls or settings access.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Check for helper AST nodes with blacklisted helper names
        # The analyzer may create these directly before expand_rule is called
        if rule.get('type') == 'helper':
            helper_name = rule.get('name', '')
            if helper_name in self.HELPERS_TO_EXPORT_BLACKLIST:
                simplified = self._get_simplified_helper(helper_name)
                if simplified:
                    logger.debug(f"[SC2] Blacklisted helper AST node '{helper_name}' - using simplified export")
                    return simplified
                logger.debug(f"[SC2] Blacklisted helper AST node '{helper_name}' - returning True_")
                return {'type': 'constant', 'value': True}

        # Check for the pattern: function_call with function being attribute access on "logic"
        # This pattern looks like:
        # {
        #   "type": "function_call",
        #   "function": {
        #     "type": "attribute",
        #     "object": {"type": "name", "name": "logic"},
        #     "attr": "method_name"
        #   },
        #   "args": [...]
        # }
        if rule.get('type') == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                if obj.get('type') == 'name' and obj.get('name') == 'logic':
                    # This is a logic.method_name() call - convert to helper
                    method_name = function.get('attr')
                    # Recursively process args first
                    args = [self.expand_rule(arg, _depth + 1) for arg in rule.get('args', [])]

                    # Check if this helper is blacklisted
                    if method_name in self.HELPERS_TO_EXPORT_BLACKLIST:
                        simplified = self._get_simplified_helper(method_name)
                        if simplified:
                            logger.debug(f"[SC2] Blacklisted helper '{method_name}' - using simplified export")
                            return simplified
                        logger.debug(f"[SC2] Blacklisted helper '{method_name}' - returning True_")
                        return {'type': 'constant', 'value': True}

                    logger.debug(f"[SC2] Converting logic.{method_name}() to helper call")

                    # Register the helper usage for automatic discovery
                    self.register_helper_usage(method_name)

                    # Convert to helper format
                    converted_rule = {
                        'type': 'helper',
                        'name': method_name,
                        'args': args
                    }

                    # Continue expanding the converted rule
                    return super().expand_rule(converted_rule, _depth)

            # For other function_calls, recursively process args
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg, _depth + 1) for arg in rule['args']]

        # Check for the pattern: attribute access on "logic" (not a function call)
        # This pattern looks like:
        # {
        #   "type": "attribute",
        #   "object": {"type": "name", "name": "logic"},
        #   "attr": "attribute_name"
        # }
        # These could be either:
        # 1. SC2Logic helper methods accessed without parentheses (should become helper calls)
        # 2. SC2Logic instance attributes that map to world settings (should become self.attribute)
        if rule.get('type') == 'attribute':
            obj = rule.get('object', {})
            obj_name = obj.get('name') if obj.get('type') == 'name' else None

            # Handle both "logic.attr" and "self.attr" patterns
            # - "logic" appears when accessing the logic object passed to rules
            # - "self" appears in helper method bodies (methods on SC2Logic class)
            if obj_name in ('logic', 'self'):
                attr_name = rule.get('attr')

                # List of known helper method names that might be accessed without parentheses
                # These should be converted to helper calls, not settings
                known_helpers = {
                    'terran_common_unit', 'terran_early_tech', 'terran_air', 'terran_air_anti_air',
                    'terran_competent_ground_to_air', 'terran_competent_anti_air', 'terran_bio_heal',
                    'terran_basic_anti_air', 'terran_defense_rating', 'terran_competent_comp',
                    'terran_mobile_detector', 'terran_beats_protoss_deathball', 'terran_base_trasher',
                    'terran_can_rescue', 'terran_cliffjumper', 'terran_able_to_snipe_defiler',
                    'terran_respond_to_colony_infestations', 'terran_survives_rip_field',
                    'terran_sustainable_mech_heal',
                    'protoss_common_unit', 'protoss_basic_anti_air', 'protoss_competent_anti_air',
                    'protoss_basic_splash', 'protoss_anti_armor_anti_air', 'protoss_anti_light_anti_air',
                    'protoss_can_attack_behind_chasm', 'protoss_has_blink', 'protoss_heal',
                    'protoss_stalker_upgrade', 'protoss_static_defense', 'protoss_fleet',
                    'protoss_competent_comp', 'protoss_hybrid_counter',
                    'zerg_common_unit', 'zerg_competent_anti_air', 'zerg_basic_anti_air',
                    'zerg_competent_comp', 'zerg_competent_defense', 'zerg_pass_vents',
                    'spread_creep', 'morph_brood_lord', 'morph_impaler_or_lurker', 'morph_viper',
                    'basic_kerrigan', 'kerrigan_levels', 'two_kerrigan_actives',
                    'marine_medic_upgrade', 'can_nuke'
                }

                if attr_name in known_helpers:
                    # Check if this helper is blacklisted
                    if attr_name in self.HELPERS_TO_EXPORT_BLACKLIST:
                        simplified = self._get_simplified_helper(attr_name)
                        if simplified:
                            logger.debug(f"[SC2] Blacklisted helper '{attr_name}' - using simplified export")
                            return simplified
                        logger.debug(f"[SC2] Blacklisted helper '{attr_name}' - returning True_")
                        return {'type': 'constant', 'value': True}

                    # This is a helper method accessed without parentheses
                    # Convert to a helper call
                    logger.debug(f"[SC2] Converting {obj_name}.{attr_name} to helper call (method accessed as attribute)")

                    # Register the helper usage for automatic discovery
                    self.register_helper_usage(attr_name)

                    converted_rule = {
                        'type': 'helper',
                        'name': attr_name,
                        'args': []
                    }

                    # Continue expanding the converted rule
                    return super().expand_rule(converted_rule)
                else:
                    # This is a settings attribute - resolve to a constant value
                    # This allows the world generator to use the value without game-specific code
                    resolved_value = self._resolve_logic_attribute(attr_name)
                    if resolved_value is not None:
                        logger.debug(f"[SC2] Resolving {obj_name}.{attr_name} to constant: {resolved_value}")
                        # Convert sets to lists for JSON serialization
                        if isinstance(resolved_value, (set, frozenset)):
                            resolved_value = sorted(list(resolved_value))
                        return {'type': 'constant', 'value': resolved_value}
                    else:
                        # Fallback: keep as self.attribute_name if we can't resolve
                        logger.debug(f"[SC2] Could not resolve {obj_name}.{attr_name}, keeping as self.{attr_name}")
                        converted_rule = {
                            'type': 'attribute',
                            'object': {'type': 'name', 'name': 'self'},
                            'attr': attr_name
                        }
                        return super().expand_rule(converted_rule)

        # Handle compare operations - recursively process left and right operands
        if rule.get('type') == 'compare':
            if 'left' in rule:
                rule['left'] = self.expand_rule(rule['left'])
            if 'right' in rule:
                rule['right'] = self.expand_rule(rule['right'])

        # Recursively expand nested structures that may contain self.attr patterns
        # This ensures helper bodies with if_statement, block, etc. get fully expanded
        rule_type = rule.get('type')

        if rule_type == 'block':
            if 'statements' in rule:
                rule['statements'] = [self.expand_rule(stmt) for stmt in rule['statements']]

        elif rule_type == 'if_statement':
            if 'test' in rule:
                rule['test'] = self.expand_rule(rule['test'])
            if 'body' in rule:
                rule['body'] = [self.expand_rule(stmt) for stmt in rule['body']]
            if 'orelse' in rule:
                rule['orelse'] = [self.expand_rule(stmt) for stmt in rule['orelse']]

        elif rule_type == 'assign':
            if 'value' in rule:
                rule['value'] = self.expand_rule(rule['value'])

        elif rule_type == 'return':
            if 'value' in rule:
                rule['value'] = self.expand_rule(rule['value'])

        elif rule_type in ('and', 'or'):
            if 'conditions' in rule:
                rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]

        elif rule_type == 'conditional':
            if 'test' in rule:
                rule['test'] = self.expand_rule(rule['test'])
            if 'if_true' in rule:
                rule['if_true'] = self.expand_rule(rule['if_true'])
            if 'if_false' in rule:
                rule['if_false'] = self.expand_rule(rule['if_false'])

        elif rule_type == 'sum_of':
            if 'element_rule' in rule:
                rule['element_rule'] = self.expand_rule(rule['element_rule'])
            if 'iterator_info' in rule:
                iterator_info = rule['iterator_info']
                if 'iterator' in iterator_info:
                    iterator_info['iterator'] = self.expand_rule(iterator_info['iterator'])
                if 'condition' in iterator_info:
                    iterator_info['condition'] = self.expand_rule(iterator_info['condition'])

        elif rule_type == 'helper':
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]

        # For all other rule types, use the parent class's expand_rule
        return super().expand_rule(rule)

    def _resolve_logic_attribute(self, attr: str) -> Any:
        """
        Resolve a SC2Logic attribute to its actual value based on world options.

        This handles attributes from SC2Logic that are computed from world options
        at runtime. By resolving them at export time, the world generator can use
        the values without any SC2-specific code.

        Args:
            attr: The attribute name (e.g., 'advanced_tactics', 'basic_terran_units')

        Returns:
            The resolved value, or None if the attribute cannot be resolved.
        """
        if not self.world or not hasattr(self.world, 'options'):
            return None

        options = self.world.options

        # Direct option lookups - attributes that map directly to option values
        direct_options = {
            'spear_of_adun_presence': 'spear_of_adun_presence',
            'spear_of_adun_passive_presence': 'spear_of_adun_passive_ability_presence',
            'kerrigan_presence': 'kerrigan_presence',
            'logic_level': 'required_tactics',
            'kerrigan_levels_per_mission_completed': 'kerrigan_levels_per_mission_completed',
            'kerrigan_levels_per_mission_completed_cap': 'kerrigan_levels_per_mission_completed_cap',
            'kerrigan_total_level_cap': 'kerrigan_total_level_cap',
            'grant_story_tech': 'grant_story_tech',
            'generic_upgrade_missions': 'generic_upgrade_missions',
            'all_in_map': 'all_in_map',
            'mission_order': 'mission_order',
        }

        if attr in direct_options:
            option_name = direct_options[attr]
            if hasattr(options, option_name):
                option = getattr(options, option_name)
                return option.value if hasattr(option, 'value') else option

        # Computed attributes - derived from other options
        if attr == 'advanced_tactics':
            # advanced_tactics = required_tactics != RequiredTactics.option_standard (which is 0)
            if hasattr(options, 'required_tactics'):
                return options.required_tactics.value != 0
            return False

        if attr == 'base_power_rating':
            # base_power_rating = 2 if advanced_tactics else 0
            if hasattr(options, 'required_tactics'):
                advanced_tactics = options.required_tactics.value != 0
                return 2 if advanced_tactics else 0
            return 0

        if attr == 'take_over_ai_allies':
            if hasattr(options, 'take_over_ai_allies'):
                return bool(options.take_over_ai_allies.value)
            return False

        if attr == 'kerrigan_unit_available':
            # Complex computation - use exported setting if available, else True for safety
            return True

        if attr == 'morphling_enabled':
            # morphling_enabled = enable_morphling == 1 (option_true)
            if hasattr(options, 'enable_morphling'):
                return options.enable_morphling.value == 1
            return False

        if attr == 'story_levels_granted':
            # story_levels_granted = grant_story_levels != 0 (disabled)
            if hasattr(options, 'grant_story_levels'):
                return options.grant_story_levels.value != 0
            return False

        if attr == 'war_council_upgrades':
            # war_council_upgrades = not war_council_nerfs
            if hasattr(options, 'war_council_nerfs'):
                return not bool(options.war_council_nerfs.value)
            return True

        # Boolean attributes that default to True for safety (won't block progression)
        safe_true_attrs = {
            'nova_used', 'has_barracks_unit', 'has_factory_unit', 'has_starport_unit',
            'has_zerg_melee_unit', 'has_zerg_ranged_unit', 'has_zerg_air_unit',
            'has_protoss_gateway_unit', 'has_protoss_core_unit', 'has_protoss_robo_unit',
            'has_protoss_stargate_unit'
        }
        if attr in safe_true_attrs:
            return True

        if attr == 'total_mission_count':
            return 1  # Safe default

        # Unit lists - computed based on required_tactics option
        required_tactics = 0
        if hasattr(options, 'required_tactics'):
            required_tactics = options.required_tactics.value

        if attr == 'basic_terran_units':
            # Standard units (required_tactics == 0)
            base_units = {'Marine', 'Marauder', 'Dominion Trooper', 'Goliath', 'Hellion', 'Vulture', 'Warhound'}
            if required_tactics >= 1:  # Advanced tactics
                base_units.update({'Reaper', 'Diamondback', 'Viking', 'Siege Tank', 'Banshee'})
            if required_tactics >= 2:  # No logic
                base_units.update({'Firebat', 'Medic', 'Medivac', 'Wraith', 'Thor', 'Liberator',
                                  'Raven', 'Cyclone', 'Widow Mine', 'Ghost', 'Spectre', 'Battlecruiser'})
            return base_units

        if attr == 'basic_zerg_units':
            base_units = {'Swarm Queen', 'Roach', 'Hydralisk'}
            if required_tactics >= 1:
                base_units.update({'Zergling', 'Infestor', 'Aberration', 'Mutalisk', 'Corruptor'})
            if required_tactics >= 2:
                base_units.update({'Swarm Host', 'Ultralisk', 'Brood Lord', 'Viper', 'Ravager',
                                  'Lurker', 'Impaler', 'Guardian', 'Devourer', 'Brutalisk', 'Leviathan'})
            return base_units

        if attr == 'basic_protoss_units':
            base_units = {'Zealot', 'Centurion', 'Sentinel', 'Stalker', 'Instigator', 'Slayer', 'Adept'}
            if required_tactics >= 1:
                base_units.update({'Dragoon', 'Sentry', 'High Templar', 'Dark Templar', 'Immortal',
                                  'Annihilator', 'Vanguard', 'Reaver', 'Phoenix', 'Mirage', 'Corsair'})
            if required_tactics >= 2:
                base_units.update({'Archon', 'Colossus', 'Wrathwalker', 'Ascendant', 'Dark Archon',
                                  'Supplicant', 'Tempest', 'Arbiter', 'Carrier', 'Mothership'})
            return base_units

        # Attribute not recognized
        return None

    def expand_helper(self, helper_name: str):
        """Expand Starcraft 2-specific helper functions."""
        # For now, just use the generic implementation
        # We'll add specific helper expansions as needed during testing
        # Most helpers will be implemented in the JavaScript helper file
        return super().expand_helper(helper_name)

    def get_settings_data(self, world, multiworld, player: int) -> Dict[str, Any]:
        """Extract Starcraft 2 settings for export."""
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Export all SC2 options
        if hasattr(world, 'options'):
            for option_name in dir(world.options):
                # Skip private attributes and methods
                if option_name.startswith('_'):
                    continue

                option = getattr(world.options, option_name, None)
                if option is None:
                    continue

                # Extract the value from the option
                # Options typically have a 'value' attribute
                if hasattr(option, 'value'):
                    settings_dict[option_name] = option.value
                elif isinstance(option, (bool, int, str, float)):
                    settings_dict[option_name] = option

        # Also export computed logic properties that are used in rules
        # These are computed from options but accessed as attributes on the logic object
        try:
            from worlds.sc2.rules import SC2Logic
            logic = SC2Logic(world)

            # Export computed boolean properties that are referenced in access rules
            logic_properties = [
                'advanced_tactics',
                'story_tech_granted',
                'story_levels_granted',
                'take_over_ai_allies',
                'kerrigan_unit_available'
            ]

            for prop_name in logic_properties:
                if hasattr(logic, prop_name):
                    prop_value = getattr(logic, prop_name)
                    # Only export simple types
                    if isinstance(prop_value, (bool, int, str, float)):
                        settings_dict[prop_name] = prop_value

            # Export unit lists that are computed from required_tactics option
            # These are used in helper functions like terran_common_unit
            unit_list_properties = [
                'basic_terran_units',
                'basic_zerg_units',
                'basic_protoss_units'
            ]

            for prop_name in unit_list_properties:
                if hasattr(logic, prop_name):
                    prop_value = getattr(logic, prop_name)
                    # Convert sets to sorted lists for JSON serialization
                    if isinstance(prop_value, (set, frozenset)):
                        settings_dict[prop_name] = sorted(list(prop_value))
                    elif isinstance(prop_value, (list, tuple)):
                        settings_dict[prop_name] = list(prop_value)
        except Exception as e:
            logger.warning(f"Could not export SC2 logic properties: {e}")

        return settings_dict

    def get_game_info(self, world) -> Dict[str, Any]:
        """
        Get SC2 game info including rating dictionaries.

        Exports the defense/power rating dictionaries so they can be
        used by helpers at runtime in the frontend.
        """
        game_info = super().get_game_info(world)

        # Export rating dictionaries if available
        if SC2_RATING_DICTS_AVAILABLE:
            rating_dicts = {
                'tvx_defense_ratings': dict(tvx_defense_ratings),
                'tvz_defense_ratings': dict(tvz_defense_ratings),
                'tvx_air_defense_ratings': dict(tvx_air_defense_ratings),
                'zvx_defense_ratings': dict(zvx_defense_ratings),
                'zvx_air_defense_ratings': dict(zvx_air_defense_ratings),
                'pvx_defense_ratings': dict(pvx_defense_ratings),
                'pvz_defense_ratings': dict(pvz_defense_ratings),
                'terran_passive_ratings': dict(terran_passive_ratings),
                'zerg_passive_ratings': dict(zerg_passive_ratings),
                'protoss_passive_ratings': dict(protoss_passive_ratings),
                'soa_energy_ratings': dict(soa_energy_ratings),
                'soa_passive_ratings': dict(soa_passive_ratings),
                'soa_ultimate_ratings': dict(soa_ultimate_ratings),
            }
            game_info['rating_tables'] = rating_dicts
            logger.debug(f"[SC2] Exported {len(rating_dicts)} rating dictionaries to game_info")

        # Export kerrigan item groups for kerrigan helpers
        if SC2_KERRIGAN_GROUPS_AVAILABLE:
            kerrigan_groups = {
                'kerrigan_non_ulimates': list(kerrigan_non_ulimates),
                'kerrigan_logic_active_abilities': list(kerrigan_logic_active_abilities),
                'kerrigan_abilities': list(kerrigan_abilities),
                'kerrigan_passives': list(kerrigan_passives),
                'kerrigan_active_abilities': list(kerrigan_active_abilities),
            }
            game_info['kerrigan_groups'] = kerrigan_groups
            logger.debug(f"[SC2] Exported {len(kerrigan_groups)} kerrigan item groups to game_info")

        return game_info
