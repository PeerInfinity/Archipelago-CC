"""Vanilla-compatible port of the fork's RuleWorldMixin.

This module is a static template: world_generator copies it verbatim into each
generated world as ``_ext/world_mixin.py``. It is only imported when the
fork's extended ``rule_builder`` package is NOT available (see
``_ext/__init__.py``), i.e. on unmodified vanilla Archipelago.

Differences from the fork's ``rule_builder/world_mixin.py``:

- Subclasses the real ``worlds.AutoWorld.World`` directly (this module is only
  imported while a world package is loading, so there is no circular-import
  hazard; vanilla's own ``rule_builder.cached_world`` does the same).
- Rule-result state caching relies on vanilla's
  ``rule_builder.cached_world.CachedRuleBuilderLogicMixin`` (imported below for
  its LogicMixin registration) instead of the fork's RuleBuilderLogicMixin.
  Generated worlds ship with ``rule_caching_enabled = False`` either way.
- The AST-format branch of ``rule_from_dict`` raises on vanilla (the
  ``rule_builder.ast_format`` module is fork-only); generated worlds never
  call it.
- The fork's dead ``_simplify_and``/``_simplify_or`` helpers are dropped.
"""
from collections import defaultdict
from collections.abc import Mapping
from typing import Any, ClassVar

from BaseClasses import CollectionState, Entrance, Item, Location, MultiWorld, Region
from worlds.AutoWorld import World

# Imported for its side effect: defining CachedRuleBuilderLogicMixin registers
# the rule_builder_cache LogicMixin on CollectionState, which the caching
# paths below (only active when rule_caching_enabled is True) rely on.
import rule_builder.cached_world  # noqa: F401
from rule_builder.rules import CustomRuleRegister, False_, Rule, True_


class RuleWorldMixin(World):
    """A World mixin that provides helpers for interacting with the rule builder"""

    rules_by_hash: dict[int, "Rule.Resolved"]
    """A mapping of hash values to resolved rules"""

    rule_item_dependencies: dict[str, set[int]]
    """A mapping of item name to set of rule ids"""

    rule_region_dependencies: dict[str, set[int]]
    """A mapping of region name to set of rule ids"""

    rule_location_dependencies: dict[str, set[int]]
    """A mapping of location name to set of rule ids"""

    rule_entrance_dependencies: dict[str, set[int]]
    """A mapping of entrance name to set of rule ids"""

    completion_rule: "Rule.Resolved | None" = None
    """The resolved rule used for the completion condition of this world"""

    true_rule: "Rule.Resolved"
    """A pre-initialized rule for this world that always returns True"""

    false_rule: "Rule.Resolved"
    """A pre-initialized rule for this world that always returns False"""

    item_mapping: ClassVar[dict[str, str]] = {}
    """A mapping of actual item name to logical item name."""

    rule_caching_enabled: ClassVar[bool] = True
    """Enable or disable the rule result caching system"""

    def __init__(self, multiworld: MultiWorld, player: int) -> None:
        super().__init__(multiworld, player)
        self.rules_by_hash = {}
        self.rule_item_dependencies = defaultdict(set)
        self.rule_region_dependencies = defaultdict(set)
        self.rule_location_dependencies = defaultdict(set)
        self.rule_entrance_dependencies = defaultdict(set)
        self.true_rule = self.resolve_rule(True_())
        self.false_rule = self.resolve_rule(False_())

    @classmethod
    def get_rule_cls(cls, name: str) -> type["Rule[Any]"]:
        """Returns the world-registered or default rule with the given name"""
        return CustomRuleRegister.get_rule_cls(cls.game, name)

    @classmethod
    def rule_from_dict(cls, data: Mapping[str, Any]) -> "Rule[Any]":
        """Create a rule instance from a serialized dict representation.

        Supports both Rule Builder format and (fork-only) AST format:
        - Rule Builder: {"rule": "Has", "options": [], "args": {"item_name": "Sword"}}
        - AST format: {"type": "item_check", "item": "Sword"}
        """
        # Check if this is AST format (has 'type' key, no 'rule' key)
        if 'type' in data and 'rule' not in data:
            try:
                from rule_builder.ast_format import parse_ast_rule
            except ImportError as e:
                raise ValueError(
                    "AST-format rules require the fork's rule_builder package"
                ) from e
            return parse_ast_rule(data, cls)  # pyright: ignore[reportArgumentType]

        # Standard Rule Builder format
        name = data.get("rule", "")
        rule_class = cls.get_rule_cls(name)
        return rule_class.from_dict(data, cls)

    def resolve_rule(self, rule: "Rule[Any]") -> "Rule.Resolved":
        """Returns a resolved rule registered with the caching system for this world"""
        resolved_rule = rule.resolve(self)
        resolved_rule = self.simplify_rule(resolved_rule)
        return self.get_cached_rule(resolved_rule)

    def get_cached_rule(self, resolved_rule: "Rule.Resolved") -> "Rule.Resolved":
        """Returns a cached instance of a resolved rule based on the hash"""
        # Skip caching for rules that have caching disabled (e.g., HelperCall with unhashable body_data)
        if not resolved_rule.caching_enabled:
            return resolved_rule
        rule_hash = hash(resolved_rule)
        if rule_hash in self.rules_by_hash:
            return self.rules_by_hash[rule_hash]
        self.rules_by_hash[rule_hash] = resolved_rule
        return resolved_rule

    def register_rule_dependencies(self, resolved_rule: "Rule.Resolved") -> None:
        """Registers a rule's item, region, location, and entrance dependencies to this world instance"""
        if not self.rule_caching_enabled:
            return
        for item_name, rule_ids in resolved_rule.item_dependencies().items():
            self.rule_item_dependencies[item_name] |= rule_ids
        for region_name, rule_ids in resolved_rule.region_dependencies().items():
            self.rule_region_dependencies[region_name] |= rule_ids
        for location_name, rule_ids in resolved_rule.location_dependencies().items():
            self.rule_location_dependencies[location_name] |= rule_ids
        for entrance_name, rule_ids in resolved_rule.entrance_dependencies().items():
            self.rule_entrance_dependencies[entrance_name] |= rule_ids

    def register_rule_connections(self, resolved_rule: "Rule.Resolved", entrance: Entrance) -> None:
        """Register indirect connections for this entrance based on the rule's dependencies"""
        for indirect_region in resolved_rule.region_dependencies().keys():
            self.multiworld.register_indirect_condition(self.get_region(indirect_region), entrance)

    def register_dependencies(self) -> None:
        """Register all rules that depend on locations or entrances with their dependencies"""
        if not self.rule_caching_enabled:
            return

        for location_name, rule_ids in self.rule_location_dependencies.items():
            try:
                location = self.get_location(location_name)
            except KeyError:
                continue
            if not isinstance(location.access_rule, Rule.Resolved):
                continue
            for item_name in location.access_rule.item_dependencies():
                self.rule_item_dependencies[item_name] |= rule_ids
            for region_name in location.access_rule.region_dependencies():
                self.rule_region_dependencies[region_name] |= rule_ids

        for entrance_name, rule_ids in self.rule_entrance_dependencies.items():
            try:
                entrance = self.get_entrance(entrance_name)
            except KeyError:
                continue
            if not isinstance(entrance.access_rule, Rule.Resolved):
                continue
            for item_name in entrance.access_rule.item_dependencies():
                self.rule_item_dependencies[item_name] |= rule_ids
            for region_name in entrance.access_rule.region_dependencies():
                self.rule_region_dependencies[region_name] |= rule_ids

    def set_rule(self, spot: Location | Entrance, rule: "Rule[Any]") -> None:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Resolve and set a rule on a location or entrance"""
        resolved_rule = self.resolve_rule(rule)
        self.register_rule_dependencies(resolved_rule)
        spot.access_rule = resolved_rule
        if self.explicit_indirect_conditions and isinstance(spot, Entrance):
            self.register_rule_connections(resolved_rule, spot)

    def create_entrance(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
        from_region: Region,
        to_region: Region,
        rule: "Rule[Any] | None" = None,
        name: str | None = None,
    ) -> Entrance | None:
        """Try to create an entrance between regions with the given rule, skipping it if the rule resolves to False"""
        resolved_rule = None
        if rule is not None:
            resolved_rule = self.resolve_rule(rule)
            if resolved_rule.always_false:
                return None
            self.register_rule_dependencies(resolved_rule)

        entrance = from_region.connect(to_region, name)
        if resolved_rule:
            entrance.access_rule = resolved_rule
        if resolved_rule is not None:
            self.register_rule_connections(resolved_rule, entrance)
        return entrance

    def set_completion_rule(self, rule: "Rule[Any]") -> None:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Set the completion rule for this world"""
        resolved_rule = self.resolve_rule(rule)
        self.register_rule_dependencies(resolved_rule)
        self.multiworld.completion_condition[self.player] = resolved_rule
        self.completion_rule = resolved_rule

    def simplify_rule(self, rule: "Rule.Resolved") -> "Rule.Resolved":
        """Simplify and optimize a resolved rule.

        And/Or rules self-simplify in their _instantiate methods, so this is a
        pass-through. Kept for API compatibility.
        """
        return rule

    def collect(self, state: CollectionState, item: Item) -> bool:
        changed = super().collect(state, item)
        if changed and self.rule_caching_enabled and self.rule_item_dependencies:
            player_results = state.rule_builder_cache[self.player]  # pyright: ignore[reportAttributeAccessIssue]
            mapped_name = self.item_mapping.get(item.name, "")
            rule_ids = self.rule_item_dependencies[item.name] | self.rule_item_dependencies[mapped_name]
            for rule_id in rule_ids:
                if player_results.get(rule_id, None) is False:
                    del player_results[rule_id]

        return changed

    def remove(self, state: CollectionState, item: Item) -> bool:
        changed = super().remove(state, item)
        if not changed or not self.rule_caching_enabled:
            return changed

        player_results = state.rule_builder_cache[self.player]  # pyright: ignore[reportAttributeAccessIssue]
        if self.rule_item_dependencies:
            mapped_name = self.item_mapping.get(item.name, "")
            rule_ids = self.rule_item_dependencies[item.name] | self.rule_item_dependencies[mapped_name]
            for rule_id in rule_ids:
                player_results.pop(rule_id, None)

        # clear all region dependent caches as none can be trusted
        if self.rule_region_dependencies:
            for rule_ids in self.rule_region_dependencies.values():
                for rule_id in rule_ids:
                    player_results.pop(rule_id, None)

        # clear all location dependent caches as they may have lost region access
        if self.rule_location_dependencies:
            for rule_ids in self.rule_location_dependencies.values():
                for rule_id in rule_ids:
                    player_results.pop(rule_id, None)

        # clear all entrance dependent caches as they may have lost region access
        if self.rule_entrance_dependencies:
            for rule_ids in self.rule_entrance_dependencies.values():
                for rule_id in rule_ids:
                    player_results.pop(rule_id, None)

        return changed

    def reached_region(self, state: CollectionState, region: Region) -> None:
        super().reached_region(state, region)
        if self.rule_caching_enabled and self.rule_region_dependencies:
            player_results = state.rule_builder_cache[self.player]  # pyright: ignore[reportAttributeAccessIssue]
            for rule_id in self.rule_region_dependencies[region.name]:
                player_results.pop(rule_id, None)

    def collect_item(self, state: CollectionState, item: Item, remove: bool = False) -> str | None:
        """Collect an item name into state.

        Only collects progression items (items with advancement=True) into state.
        """
        if item.advancement:
            return item.name
        return None
