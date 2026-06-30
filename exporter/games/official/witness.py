"""The Witness game-specific export handler.

Handles unique patterns in The Witness's rule implementations:
1. Bound method references: region.can_reach passed directly in closures
2. Region reachability patterns: standard Archipelago region.can_reach AST pattern
3. Laser activation locations: event locations needing explicit region reachability
"""

from typing import Dict, Any, Optional, List
from ..base import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class WitnessGameExportHandler(GenericGameExportHandler):
    """Export handler for The Witness."""

    # Enable upfront item adding for sphere test compatibility
    ADD_SPHERE_ITEMS_UPFRONT = True

    # Easter Egg accumulator: items like "+1 Easter Egg", "+6 Easter Eggs"
    # add their numeric value to the "Egg" counter used by Has("Egg", count=N) rules
    ACCUMULATOR_RULES = [{
        'pattern': r'^\+(\d+) Easter Eggs?$',
        'extract_value': True,
        'target': 'Egg',
        'discriminator': None,
    }]

    PROG_ITEMS_INIT = {'Egg': 0}

    # Mapping of laser activation locations to the regions containing their panels
    LASER_ACTIVATION_TO_REGION = {
        'Bunker Laser Activated': 'Bunker Laser Platform',
        'Swamp Laser Activated': 'Swamp Laser Area',
        'Town Laser Activated': 'Town Tower Top',
        'Treehouse Laser Activated': 'Treehouse Laser Room',
        'Quarry Laser Activated': 'Outside Quarry',
        'Symmetry Island Laser Activated': 'Symmetry Island Upper',
        'Jungle Laser Activated': 'Jungle',
        'Monastery Laser Activated': 'Outside Monastery',
        'Shadows Laser Activated': 'Shadows Laser Room',
        'Desert Laser Activated': 'Desert Outside',
        'Keep Laser Activated': 'Keep Tower',  # Has two panels, both in Keep Tower
    }

    def set_context(self, location_name: Optional[str]):
        """Store the current location name for context-aware processing."""
        self._current_location_name = location_name

    # =========================================================================
    # Bound method detection and extraction
    # =========================================================================

    @staticmethod
    def _is_bound_method(v) -> bool:
        """Check if value is a bound method (object or string representation)."""
        if isinstance(v, str) and '<bound method' in v:
            return True
        return hasattr(v, '__self__') and hasattr(v, '__name__')

    @staticmethod
    def _extract_region_name(item) -> Optional[str]:
        """Extract region name from a bound method or its string representation."""
        # Actual bound method object
        if hasattr(item, '__self__') and hasattr(item.__self__, 'name'):
            if hasattr(item.__self__, 'entrances'):  # Verify it's a Region
                return item.__self__.name
        # String representation from serialization
        if isinstance(item, str) and '<bound method Region.can_reach of ' in item:
            try:
                return item.split(' of ')[1].rstrip('>')
            except (IndexError, AttributeError):
                pass
        return None

    # =========================================================================
    # Comprehension pattern handlers
    # =========================================================================

    def _handle_all_of_only_bound_methods(self, rule: Dict[str, Any]) -> bool:
        """Check if rule is all_of where ALL iterator values are bound methods."""
        if rule.get('type') != 'all_of':
            return False
        iterator_info = rule.get('iterator_info', {})
        if iterator_info.get('type') != 'comprehension_details':
            return False
        iterator = iterator_info.get('iterator', {})
        if iterator.get('type') != 'constant':
            return False
        values = iterator.get('value', [])
        if not isinstance(values, list) or not values:
            return False
        return all(self._is_bound_method(v) for v in values)

    def _handle_all_of_callables(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle all_of where the iterator values are CollectionRule lambdas.

        The Witness's ``_meets_item_requirements`` (worlds/witness/rules.py) builds
        rules of the form::

            lambda state: all(condition(state) for condition in sub_requirement)

        where ``sub_requirement`` is a list of ``CollectionRule`` lambdas produced by
        ``convert_requirement_option`` (e.g. ``state.has_all([...])``). The generic
        AST analyzer can't serialize these runtime lambda objects, so it emits a
        broken ``AST_all_of`` node whose iterator is the lambda's ``repr`` string.

        We instead recursively analyze each lambda and AND the results. Only the
        case where every iterator value is a plain callable is handled here; the
        bound-method variants are handled by the dedicated handlers above.
        """
        from exporter.analyzer import analyze_rule

        if rule.get('type') != 'all_of':
            return None
        iterator_info = rule.get('iterator_info', {})
        if iterator_info.get('type') != 'comprehension_details':
            return None
        iterator = iterator_info.get('iterator', {})
        if iterator.get('type') != 'constant':
            return None
        values = iterator.get('value', [])
        if not isinstance(values, list) or not values:
            return None

        # Bound-method iterators are handled by the dedicated handlers; only take
        # the case where every element is a plain callable (a convert_requirement_option lambda).
        if any(self._is_bound_method(v) for v in values):
            return None
        if not all(callable(v) for v in values):
            return None

        analyzed = []
        for cond in values:
            result = analyze_rule(rule_func=cond, game_handler=self)
            if not result or result.get('type') == 'error':
                return None
            analyzed.append(self._simplify_region_reachability(result))

        if not analyzed:
            return {'type': 'constant', 'value': True}
        if len(analyzed) == 1:
            return analyzed[0]
        return {'type': 'and', 'conditions': analyzed}

    def _handle_any_of_nested_bound_methods(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle any_of with nested lists containing bound methods."""
        if rule.get('type') != 'any_of':
            return None
        iterator_info = rule.get('iterator_info', {})
        if iterator_info.get('type') != 'comprehension_details':
            return None
        iterator = iterator_info.get('iterator', {})
        if iterator.get('type') != 'constant':
            return None
        values = iterator.get('value', [])
        if not isinstance(values, list) or not values:
            return None
        if not all(isinstance(item, (list, tuple)) for item in values):
            return None

        # Extract region names from bound methods in each inner list
        outer_conditions = []
        for inner_list in values:
            inner_can_reach = []
            for item in inner_list:
                region_name = self._extract_region_name(item)
                if region_name:
                    inner_can_reach.append({'type': 'can_reach', 'region': region_name})
                # Skip lambda functions
            if inner_can_reach:
                if len(inner_can_reach) == 1:
                    outer_conditions.append(inner_can_reach[0])
                else:
                    outer_conditions.append({'type': 'and', 'conditions': inner_can_reach})

        if not outer_conditions:
            return None
        if len(outer_conditions) == 1:
            return outer_conditions[0]
        return {'type': 'or', 'conditions': outer_conditions}

    def _handle_all_of_mixed_conditions(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle all_of with both bound methods and other conditions."""
        from exporter.analyzer import analyze_rule

        if rule.get('type') != 'all_of':
            return None
        iterator_info = rule.get('iterator_info', {})
        if iterator_info.get('type') != 'comprehension_details':
            return None
        iterator = iterator_info.get('iterator', {})
        if iterator.get('type') != 'constant':
            return None
        values = iterator.get('value', [])
        if not isinstance(values, list) or not values:
            return None

        bound_methods = [v for v in values if self._is_bound_method(v)]
        other_conditions = [v for v in values if not self._is_bound_method(v)]
        if not bound_methods or not other_conditions:
            return None

        analyzed = []
        # Convert bound methods to can_reach rules
        for bm in bound_methods:
            region_name = self._extract_region_name(bm)
            if not region_name:
                return None
            analyzed.append({'type': 'can_reach', 'region': region_name})

        # Analyze other conditions
        for cond in other_conditions:
            if callable(cond):
                result = analyze_rule(rule_func=cond, game_handler=self)
                if result and result.get('type') != 'error':
                    analyzed.append(result)
                else:
                    return None
            else:
                return None

        if not analyzed:
            return {'type': 'constant', 'value': True}
        if len(analyzed) == 1:
            return analyzed[0]
        return {'type': 'and', 'conditions': analyzed}

    # =========================================================================
    # Region reachability pattern handling
    # =========================================================================

    def _is_region_reachability_pattern(self, rule: Optional[Dict[str, Any]]) -> bool:
        """Check if rule matches the standard region.can_reach AST pattern."""
        if not rule or rule.get('type') != 'conditional':
            return False

        # Test: state.stale[player]
        test = rule.get('test', {})
        if test.get('type') != 'subscript':
            return False
        test_value = test.get('value', {})
        if (test_value.get('type') != 'attribute' or
            test_value.get('attr') != 'stale' or
            test_value.get('object', {}).get('name') != 'state'):
            return False

        # if_true: state.update_reachable_regions
        if_true = rule.get('if_true', {})
        if (if_true.get('type') != 'state_method' or
            if_true.get('method') != 'update_reachable_regions'):
            return False

        # if_false: self in state.reachable_regions[player]
        if_false = rule.get('if_false', {})
        if if_false.get('type') != 'compare' or if_false.get('op') != 'in':
            return False
        if if_false.get('left', {}).get('name') != 'self':
            return False
        right = if_false.get('right', {})
        if right.get('type') != 'subscript':
            return False
        right_value = right.get('value', {})
        if (right_value.get('type') != 'attribute' or
            right_value.get('attr') != 'reachable_regions'):
            return False

        return True

    def _simplify_region_reachability(self, rule: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Recursively simplify region reachability patterns."""
        if not rule or not isinstance(rule, dict):
            return rule

        # Handle the pattern itself
        if self._is_region_reachability_pattern(rule):
            if hasattr(self, '_exit_region_names') and self._exit_region_names:
                region_name = self._exit_region_names.pop(0)
                return {'type': 'can_reach', 'region': region_name}
            return {'type': 'constant', 'value': True}

        # Handle all_of where every iterator value is a region bound method.
        # Convert to the AND of the corresponding can_reach rules rather than
        # collapsing to True: dropping the region requirements over-permits these
        # locations once door shuffle gates the regions behind keys.
        if self._handle_all_of_only_bound_methods(rule):
            values = rule.get('iterator_info', {}).get('iterator', {}).get('value', [])
            conditions = []
            for v in values:
                region_name = self._extract_region_name(v)
                if region_name:
                    conditions.append({'type': 'can_reach', 'region': region_name})
            if not conditions:
                # Bound methods we couldn't resolve to regions (e.g. entrance
                # can_reach); preserve the previous conservative behavior.
                return {'type': 'constant', 'value': True}
            if len(conditions) == 1:
                return conditions[0]
            return {'type': 'and', 'conditions': conditions}

        # Handle all_of with mixed conditions
        result = self._handle_all_of_mixed_conditions(rule)
        if result is not None:
            return result

        # Handle all_of over plain CollectionRule lambdas (convert_requirement_option)
        result = self._handle_all_of_callables(rule)
        if result is not None:
            return result

        # Handle any_of with nested bound methods
        result = self._handle_any_of_nested_bound_methods(rule)
        if result is not None:
            return result

        # Recursively process compound rules
        rule_type = rule.get('type')

        if rule_type in ('and', 'or'):
            simplified = [self._simplify_region_reachability(c) for c in rule.get('conditions', [])]
            if rule_type == 'and':
                # Filter out True values
                simplified = [c for c in simplified
                              if c and (c.get('type') != 'constant' or c.get('value') is not True)]
                if not simplified:
                    return {'type': 'constant', 'value': True}
            else:  # or
                # Filter out False values
                simplified = [c for c in simplified
                              if c and (c.get('type') != 'constant' or c.get('value') is not False)]
                if any(c and c.get('type') == 'constant' and c.get('value') is True for c in simplified):
                    return {'type': 'constant', 'value': True}
                if not simplified:
                    return {'type': 'constant', 'value': False}
            if len(simplified) == 1:
                return simplified[0]
            return {**rule, 'conditions': simplified}

        if rule_type == 'not':
            simplified = self._simplify_region_reachability(rule.get('condition'))
            if simplified and simplified.get('type') == 'constant':
                return {'type': 'constant', 'value': not simplified.get('value')}
            return {**rule, 'condition': simplified}

        if rule_type in ('any_of', 'all_of'):
            element_rule = rule.get('element_rule')
            if element_rule:
                simplified = self._simplify_region_reachability(element_rule)
                if simplified != element_rule:
                    rule = {**rule, 'element_rule': simplified}

        return rule

    # =========================================================================
    # Progressive item mapping
    # =========================================================================

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Export The Witness's progressive symbol chains.

        The Witness resolves progressive items in its custom ``collect()`` override
        (not ``collect_item``), using per-item ``progressive_chain`` data taken from
        ``world.player_items.all_progressive_item_lists``. The base-class probe only
        inspects ``collect_item`` and module-level tables, so it can't see these
        instance-level chains and returns an empty mapping. Without it the frontend
        never learns that e.g. "Progressive Stars" grants "Stars", so access rules
        that check the resolved symbols (Has("Stars"), HasAll([...])) never unlock
        and the spoiler test diverges at the first such location.

        We build the mapping directly from ``all_progressive_item_lists`` (the same
        data ``collect()`` reads), producing the standard format:
        ``{progressive: {"base_item": progressive, "items": [{"name", "level"}, ...]}}``.
        Level N corresponds to the symbol granted by the Nth copy of the progressive
        item, matching the witness ``collect()`` chain-indexing behavior.
        """
        mapping: Dict[str, Any] = {}

        player_items = getattr(world, "player_items", None)
        progressive_lists = getattr(player_items, "all_progressive_item_lists", None)

        # ``all_progressive_item_lists`` is only present on the original Witness world.
        # This handler is also selected by name for generated "_worldgen" worlds (e.g.
        # "The Witness WorldGen"), which instead bake the resolved chains into a
        # ``progression_mapping`` ClassVar (``{name: [components]}``, already including
        # alias items). Both have the same shape, so reuse it directly; only the
        # original world needs the separate alias probe below.
        probe_aliases = bool(progressive_lists)
        if not progressive_lists:
            progressive_lists = getattr(world, "progression_mapping", None)
        if not progressive_lists:
            logger.info("The Witness: no progressive item data found; deferring to "
                        "base progression probe")
            return super().get_progression_mapping(world)

        for progressive_name, chain_items in progressive_lists.items():
            mapping[progressive_name] = {
                "base_item": progressive_name,
                "items": [
                    {"name": concrete_name, "level": level}
                    for level, concrete_name in enumerate(chain_items, start=1)
                ],
            }

        # Alias items: The Witness's collect() also resolves "alias" items via
        # ``item.is_alias_for`` (e.g. "Simple Stars" -> "Stars", "Sparse Dots" ->
        # "Dots"), granting one copy of the aliased symbol per collected alias. These
        # replacement items can appear in the pool for some option combinations, and
        # their target symbols are checked by access rules just like progressive ones.
        # We probe create_item (which sets ``is_alias_for`` from ALL_ITEM_ALIASES,
        # the same source collect() uses) so the resolution stays faithful without
        # hard-coding the alias table. (Generated _worldgen worlds already fold aliases
        # into their progression_mapping ClassVar, so this only runs for the original.)
        if probe_aliases:
            for item_name in getattr(world, "item_name_to_id", {}):
                if item_name in mapping:
                    continue
                try:
                    item = world.create_item(item_name)
                except Exception:
                    continue
                target = getattr(item, "is_alias_for", None)
                if target:
                    mapping[item_name] = {
                        "base_item": item_name,
                        "items": [{"name": target, "level": 1}],
                    }

        logger.info(f"Exported {len(mapping)} progressive/alias item types for The Witness")
        return mapping

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:  # noqa: ARG002
        """Convert pure region-reachability location rules to a can_reach rule.

        The Witness assigns some location access rules directly to a region's
        bound ``can_reach`` method, or to ``make_region_lambda``'s
        ``lambda state: region.can_reach(state)`` (rules.py). The generic analyzer
        can't recover source for a bound method and falls back to a permissive
        ``True``, which makes those locations reachable from sphere 0 in the
        frontend when they should be gated on reaching the region (this shows up
        under door shuffle, where the gating region needs a door key).

        Only the unambiguous "the whole rule is one region's reachability" case is
        handled here; anything else returns None so normal analysis runs.
        """
        rule = getattr(location, 'access_rule', None)
        if rule is None:
            return None

        # Laser activation locations have their own dedicated handling in
        # postprocess_rule (LASER_ACTIVATION_TO_REGION); leave them to it.
        if getattr(self, '_current_location_name', None) in self.LASER_ACTIVATION_TO_REGION:
            return None

        # Case 1: bare bound method ``region.can_reach``.
        region_name = self._extract_region_name(rule)
        if region_name:
            return {'type': 'can_reach', 'region': region_name}

        # Case 2: ``lambda state: region.can_reach(state)`` — exactly one closure
        # cell, and that cell is a Region. A combined rule would close over more.
        closure = getattr(rule, '__closure__', None)
        if closure and len(closure) == 1:
            try:
                value = closure[0].cell_contents
            except ValueError:
                value = None
            if (hasattr(value, 'name') and hasattr(value, 'entrances')
                    and hasattr(value, 'can_reach')):
                return {'type': 'can_reach', 'region': value.name}

        return None

    # =========================================================================
    # Complex helper resolution (expert pressure plates, theater->tunnels EP)
    # =========================================================================

    @staticmethod
    def _and(*conditions: Dict[str, Any]) -> Dict[str, Any]:
        return {'type': 'and', 'conditions': list(conditions)}

    @staticmethod
    def _or(*conditions: Dict[str, Any]) -> Dict[str, Any]:
        return {'type': 'or', 'conditions': list(conditions)}

    def _rule_for_callable(self, rule_func) -> Dict[str, Any]:
        """Best-effort conversion of a single CollectionRule callable to a rule dict."""
        from exporter.analyzer import analyze_rule

        if rule_func is None:
            return {'type': 'constant', 'value': True}

        # Bare bound method region.can_reach.
        region_name = self._extract_region_name(rule_func)
        if region_name:
            return {'type': 'can_reach', 'region': region_name}

        # lambda state: region.can_reach(state) (single-region closure).
        closure = getattr(rule_func, '__closure__', None)
        if closure and len(closure) == 1:
            try:
                value = closure[0].cell_contents
            except ValueError:
                value = None
            if (hasattr(value, 'name') and hasattr(value, 'entrances')
                    and hasattr(value, 'can_reach')):
                return {'type': 'can_reach', 'region': value.name}

        analyzed = analyze_rule(rule_func=rule_func, game_handler=self)
        if not analyzed or analyzed.get('type') == 'error':
            # Couldn't recover the requirement; treat the connection as open so we
            # don't under-permit (entrance rules are normally analyzable lambdas).
            return {'type': 'constant', 'value': True}
        return self._simplify_region_reachability(analyzed)

    def _two_way_term(self, region_a: str, region_b: str) -> Dict[str, Any]:
        """Build a rule for ``any(e.can_reach(state) for e in two_way[region_a, region_b])``.

        ``e.can_reach`` means the entrance's parent region is reachable AND its own
        access rule passes, so each entrance becomes ``And(can_reach(parent), rule)``
        and the term is the OR over the (bidirectional) entrances connecting the
        two regions.
        """
        register = getattr(getattr(self.world, 'player_regions', None),
                           'two_way_entrance_register', None)
        if register is None:
            return {'type': 'constant', 'value': False}

        seen = set()
        entrances = []
        for key in ((region_a, region_b), (region_b, region_a)):
            for e in register.get(key, []):
                if id(e) not in seen:
                    seen.add(id(e))
                    entrances.append(e)

        options = []
        for e in entrances:
            parent = getattr(getattr(e, 'parent_region', None), 'name', None)
            if parent is None:
                continue
            parent_reach = {'type': 'can_reach', 'region': parent}
            sub = self._rule_for_callable(getattr(e, 'access_rule', None))
            if sub.get('type') == 'constant':
                if sub.get('value') is True:
                    options.append(parent_reach)
                # value is False -> this entrance can never be used; skip it
                continue
            options.append(self._and(parent_reach, sub))

        if not options:
            return {'type': 'constant', 'value': False}
        if len(options) == 1:
            return options[0]
        return {'type': 'or', 'conditions': options}

    def _build_expert_pp2_rule(self) -> Dict[str, Any]:
        """Mirror worlds/witness/rules.py:_can_do_expert_pp2 as a concrete rule tree."""
        t = self._two_way_term
        return self._and(
            t("Keep 2nd Pressure Plate", "Keep"),
            {'type': 'can_reach', 'region': 'Keep'},
            t("Keep 3rd Pressure Plate", "Keep 4th Pressure Plate"),
            self._or(
                t("Keep 4th Pressure Plate", "Shadows"),
                self._and(
                    t("Keep 4th Pressure Plate", "Keep Tower"),
                    self._or(
                        t("Keep", "Keep Tower"),
                        self._and(
                            t("Keep 4th Maze", "Keep Tower"),
                            self._or(
                                t("Keep 4th Maze", "Keep"),
                                self._and(
                                    t("Keep 4th Maze", "Keep 3rd Maze"),
                                    self._or(
                                        t("Keep 3rd Maze", "Keep"),
                                        self._and(
                                            t("Keep 3rd Maze", "Keep 2nd Maze"),
                                            t("Keep 2nd Maze", "Keep"),
                                        ),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        )

    def _build_theater_to_tunnels_rule(self) -> Dict[str, Any]:
        """Mirror worlds/witness/rules.py:_can_do_theater_to_tunnels as a rule tree."""
        t = self._two_way_term
        return self._or(
            self._and(
                t("Tunnels", "Windmill Interior"),
                t("Theater", "Windmill Interior"),
            ),
            self._and(
                t("Tunnels", "Windmill Interior"),
                t("Outside Windmill", "Windmill Interior"),
            ),
            t("Tunnels", "Town"),
        )

    _HELPER_BUILDERS = {
        '_can_do_expert_pp2': '_build_expert_pp2_rule',
        '_can_do_theater_to_tunnels': '_build_theater_to_tunnels_rule',
    }

    def _resolve_witness_helpers(self, node: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Recursively replace unresolved witness helper references with rule trees.

        The exporter emits ``_can_do_expert_pp2`` / ``_can_do_theater_to_tunnels``
        as bare helper references because their Python bodies inspect runtime
        entrance objects (two_way_entrance_register). The frontend has no
        implementation, so it would evaluate them as False. We expand them here
        into concrete can_reach/and/or rules the frontend can evaluate.
        """
        if isinstance(node, list):
            return [self._resolve_witness_helpers(n) for n in node]
        if not isinstance(node, dict):
            return node

        if node.get('type') == 'helper':
            builder = self._HELPER_BUILDERS.get(node.get('name'))
            if builder and getattr(self, 'world', None) is not None:
                return getattr(self, builder)()
            return node

        return {k: self._resolve_witness_helpers(v) for k, v in node.items()}

    # =========================================================================
    # Public API
    # =========================================================================

    def postprocess_rule(self, rule: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Post-process rules to handle region reachability and laser activations."""
        simplified = self._simplify_region_reachability(rule)
        simplified = self._resolve_witness_helpers(simplified)

        # Handle laser activation locations.
        #
        # A laser activation event's real rule is a convert_requirement_option
        # lambda. When the analyzer can recover it (e.g. shuffle_lasers makes the
        # laser an item -> item_check "X Laser"; door shuffle makes it
        # item_check "X Laser Activation"; or an explicit multi-region reach), that
        # analyzed rule is the complete, option-correct requirement and we use it
        # verbatim. Only when the analysis collapses to a bare True / region-reach
        # AST pattern (which happens for the vanilla "just solve the panel" case,
        # where reaching the panel's region is the real gate) do we substitute the
        # known panel region. Previously this always AND'ed the panel region onto
        # the analyzed rule, which over-constrained shuffled-laser seeds (the laser
        # item alone activates the laser; reaching the panel region is not required).
        current_loc = getattr(self, '_current_location_name', None)
        if current_loc and current_loc in self.LASER_ACTIVATION_TO_REGION:
            region_name = self.LASER_ACTIVATION_TO_REGION[current_loc]
            can_reach = {'type': 'can_reach', 'region': region_name}

            if (simplified is None or
                    self._is_region_reachability_pattern(simplified) or
                    (simplified.get('type') == 'constant' and simplified.get('value') is True)):
                return can_reach
            return simplified

        return simplified

    def _extract_region_names_from_closure(self, rule_func) -> List[str]:
        """Extract region names from bound methods in a lambda's closure."""
        region_names = []
        if not hasattr(rule_func, '__closure__') or not rule_func.__closure__:
            return region_names

        def extract_from_list(lst, depth=0):
            if depth > 3:
                return
            for item in lst:
                if isinstance(item, (list, tuple)):
                    extract_from_list(item, depth + 1)
                else:
                    region_name = self._extract_region_name(item)
                    if region_name:
                        region_names.append(region_name)

        for cell in rule_func.__closure__:
            try:
                value = cell.cell_contents
                if isinstance(value, (list, tuple)):
                    extract_from_list(value)
            except ValueError:
                pass

        return region_names

    def handle_complex_exit_rule(self, exit_name: str, exit_rule) -> Optional[Dict[str, Any]]:  # noqa: ARG002
        """Handle complex exit rules with bound method patterns."""
        from exporter.analyzer import analyze_rule

        # Bare bound method ``region.can_reach`` (e.g. an elevator/shortcut exit
        # gated on reaching another region). The analyzer can't recover source for
        # a bound method and falls back to True, which over-permits the entrance
        # once door shuffle gates the source region; convert it directly.
        region_name = self._extract_region_name(exit_rule)
        if region_name:
            return {'type': 'can_reach', 'region': region_name}

        # Extract region names before analysis
        self._exit_region_names = self._extract_region_names_from_closure(exit_rule)

        # Analyze and post-process
        result = analyze_rule(rule_func=exit_rule, game_handler=self)
        if result and result.get('type') != 'error':
            result = self._simplify_region_reachability(result)

        self._exit_region_names = []
        return result
