"""World / LogicMixin overlay for the fork's Rule Builder.

Provides ``RuleWorldMixin`` (the world base the fork's worlds inherit) and
``RuleBuilderLogicMixin`` (CollectionState rule-result caching), kept in a
separate module so the upstream ``rules.py`` stays close to vanilla.

``World`` is bound to ``object`` at runtime and the real ``LogicMixin`` is
resolved lazily, to avoid a circular import when ``rule_builder`` is imported
before the ``worlds`` package (e.g. from ``world_generator``). The fork's
worlds inherit ``(RuleWorldMixin, World)`` so the real ``World`` base is still
present in their MRO.
"""
from collections import defaultdict
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, ClassVar, Self, cast

from typing_extensions import override

from BaseClasses import CollectionState, Entrance, Item, Location, MultiWorld, Region

from .rules import And, CustomRuleRegister, False_, Has, HasAll, HasAny, Or, Rule, True_

if TYPE_CHECKING:
    from worlds.AutoWorld import World
else:
    World = object


def _import_logic_mixin():
    """Import LogicMixin without triggering worlds auto-discovery.

    When rule_builder is imported before worlds (e.g., from world_generator),
    importing worlds.AutoWorld would trigger worlds/__init__.py which
    auto-discovers and loads all world packages. Those worldgen worlds
    import from rule_builder, creating a circular dependency.

    Fix: temporarily stub sys.modules['worlds'] so worlds.AutoWorld can
    be imported directly. worlds/AutoWorld.py has no relative imports
    and is safe to load standalone.
    """
    import sys
    if 'worlds' not in sys.modules:
        import os, types
        worlds_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'worlds'
        )
        stub = types.ModuleType('worlds')
        stub.__path__ = [worlds_dir]
        stub.__package__ = 'worlds'
        sys.modules['worlds'] = stub
        try:
            from worlds.AutoWorld import LogicMixin
        finally:
            del sys.modules['worlds']
        return LogicMixin
    else:
        from worlds.AutoWorld import LogicMixin
        return LogicMixin

def _get_logic_mixin():
    """Get LogicMixin lazily to avoid circular imports with AutoWorld."""
    global _LogicMixin
    if _LogicMixin is None:
        _LogicMixin = _import_logic_mixin()
    return _LogicMixin

_LogicMixin = None


class _LogicMixinMeta(type):
    """Metaclass that resolves LogicMixin as base class lazily."""
    _resolved = False

    @override
    def __instancecheck__(cls, instance: object) -> bool:
        cls._ensure_bases()
        return super().__instancecheck__(instance)

    def _ensure_bases(cls):
        if not cls._resolved:
            cls._resolved = True
            base = _get_logic_mixin()
            cls.__bases__ = (base,) + tuple(b for b in cls.__bases__ if b is not object)


class RuleBuilderLogicMixin(metaclass=_LogicMixinMeta):
    """A LogicMixin that adds rule caching support to CollectionState.

    This mixin is required for worlds that use the Rule Builder's caching system.
    It adds a `rule_builder_cache` attribute to CollectionState that stores the results
    of rule evaluations, keyed by player and rule id.

    Based on PR #5048 (https://github.com/ArchipelagoMW/Archipelago/pull/5048).
    """

    multiworld: MultiWorld
    rule_builder_cache: dict[int, dict[int, bool]]

    def init_mixin(self, multiworld: MultiWorld) -> None:
        players = multiworld.get_all_ids()
        self.rule_builder_cache = {player: {} for player in players}

    def copy_mixin(self, new_state: "RuleBuilderLogicMixin") -> "RuleBuilderLogicMixin":
        new_state.rule_builder_cache = {
            player: rule_results.copy() for player, rule_results in self.rule_builder_cache.items()
        }
        return new_state


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
    """A mapping of actual item name to logical item name.
    Useful when there are multiple versions of a collected item but the logic only uses one. For example:
    item = Item("Currency x500"), rule = Has("Currency", count=1000), item_mapping = {"Currency x500": "Currency"}"""

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

    @override
    @classmethod
    def get_rule_cls(cls, name: str) -> type["Rule[Self]"]:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Returns the world-registered or default rule with the given name"""
        return CustomRuleRegister.get_rule_cls(cls.game, name)

    @override
    @classmethod
    def rule_from_dict(cls, data: Mapping[str, Any]) -> "Rule[Self]":  # pyright: ignore[reportIncompatibleMethodOverride]
        """Create a rule instance from a serialized dict representation.

        Supports both Rule Builder format and AST format:
        - Rule Builder: {"rule": "Has", "options": [], "args": {"item_name": "Sword"}}
        - AST format: {"type": "item_check", "item": "Sword"}
        """
        # Check if this is AST format (has 'type' key, no 'rule' key)
        if 'type' in data and 'rule' not in data:
            from rule_builder.ast_format import parse_ast_rule
            return parse_ast_rule(data, cls)

        # Standard Rule Builder format
        name = data.get("rule", "")
        rule_class = cls.get_rule_cls(name)
        return rule_class.from_dict(data, cls)

    def resolve_rule(self, rule: "Rule[Self]") -> "Rule.Resolved":
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

    @override
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

    @override
    def set_rule(self, spot: Location | Entrance, rule: "Rule[Self]") -> None:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Resolve and set a rule on a location or entrance"""
        resolved_rule = self.resolve_rule(rule)
        self.register_rule_dependencies(resolved_rule)
        spot.access_rule = resolved_rule
        if self.explicit_indirect_conditions and isinstance(spot, Entrance):
            self.register_rule_connections(resolved_rule, spot)

    @override
    def create_entrance(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
        from_region: Region,
        to_region: Region,
        rule: "Rule[Self] | None" = None,
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

    @override
    def set_completion_rule(self, rule: "Rule[Self]") -> None:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Set the completion rule for this world"""
        resolved_rule = self.resolve_rule(rule)
        self.register_rule_dependencies(resolved_rule)
        self.multiworld.completion_condition[self.player] = resolved_rule
        self.completion_rule = resolved_rule

    def simplify_rule(self, rule: "Rule.Resolved") -> "Rule.Resolved":
        """Simplify and optimize a resolved rule.

        And/Or rules now self-simplify in their _instantiate methods,
        so this is a pass-through. Kept for API compatibility.
        """
        return rule

    def _simplify_and(self, rule: "And.Resolved") -> "Rule.Resolved":
        children_to_process = list(rule.children)
        clauses: list[Rule.Resolved] = []
        items: dict[str, int] = {}
        true_rule: Rule.Resolved | None = None

        while children_to_process:
            child = self.simplify_rule(children_to_process.pop(0))
            if child.always_false:
                # false always wins
                return child
            if child.always_true:
                # dedupe trues
                true_rule = child
                continue
            if isinstance(child, And.Resolved):
                children_to_process.extend(child.children)
                continue

            if isinstance(child, Has.Resolved) and isinstance(child.count, int):
                if child.item_name not in items or items[child.item_name] < child.count:
                    items[child.item_name] = child.count
            elif isinstance(child, HasAll.Resolved):
                for item in child.item_names:
                    if item not in items:
                        items[item] = 1
            else:
                clauses.append(child)

        if not clauses and not items:
            return true_rule or self.false_rule

        has_cls = cast(type[Has[Self]], self.get_rule_cls("Has"))
        has_all_cls = cast(type[HasAll[Self]], self.get_rule_cls("HasAll"))
        has_all_items: list[str] = []
        for item, count in items.items():
            if count == 1:
                has_all_items.append(item)
            else:
                clauses.append(
                    self.get_cached_rule(
                        has_cls.Resolved(item, count, player=rule.player, caching_enabled=self.rule_caching_enabled)
                    )
                )

        if len(has_all_items) == 1:
            clauses.append(
                self.get_cached_rule(
                    has_cls.Resolved(has_all_items[0], player=rule.player, caching_enabled=self.rule_caching_enabled)
                )
            )
        elif len(has_all_items) > 1:
            clauses.append(
                self.get_cached_rule(
                    has_all_cls.Resolved(
                        tuple(has_all_items),
                        player=rule.player,
                        caching_enabled=self.rule_caching_enabled,
                    )
                )
            )

        if len(clauses) == 1:
            return clauses[0]
        return And.Resolved(tuple(clauses), player=rule.player, caching_enabled=self.rule_caching_enabled)

    def _simplify_or(self, rule: "Or.Resolved") -> "Rule.Resolved":
        children_to_process = list(rule.children)
        clauses: list[Rule.Resolved] = []
        items: dict[str, int] = {}

        while children_to_process:
            child = self.simplify_rule(children_to_process.pop(0))
            if child.always_true:
                # true always wins
                return child
            if child.always_false:
                # falses can be ignored
                continue
            if isinstance(child, Or.Resolved):
                children_to_process.extend(child.children)
                continue

            if isinstance(child, Has.Resolved) and isinstance(child.count, int):
                if child.item_name not in items or child.count < items[child.item_name]:
                    items[child.item_name] = child.count
            elif isinstance(child, HasAny.Resolved):
                for item in child.item_names:
                    items[item] = 1
            else:
                clauses.append(child)

        if not clauses and not items:
            return self.false_rule

        has_cls = cast(type[Has[Self]], self.get_rule_cls("Has"))
        has_any_cls = cast(type[HasAny[Self]], self.get_rule_cls("HasAny"))
        has_any_items: list[str] = []
        for item, count in items.items():
            if count == 1:
                has_any_items.append(item)
            else:
                clauses.append(
                    self.get_cached_rule(
                        has_cls.Resolved(item, count, player=rule.player, caching_enabled=self.rule_caching_enabled)
                    )
                )

        if len(has_any_items) == 1:
            clauses.append(
                self.get_cached_rule(
                    has_cls.Resolved(has_any_items[0], player=rule.player, caching_enabled=self.rule_caching_enabled)
                )
            )
        elif len(has_any_items) > 1:
            clauses.append(
                self.get_cached_rule(
                    has_any_cls.Resolved(
                        tuple(has_any_items),
                        player=rule.player,
                        caching_enabled=self.rule_caching_enabled,
                    )
                )
            )

        if len(clauses) == 1:
            return clauses[0]
        return Or.Resolved(tuple(clauses), player=rule.player, caching_enabled=self.rule_caching_enabled)

    @override
    def collect(self, state: CollectionState, item: Item) -> bool:
        changed = super().collect(state, item)
        if changed and self.rule_caching_enabled and self.rule_item_dependencies:
            player_results = cast(dict[int, bool], state.rule_builder_cache[self.player])  # pyright: ignore[reportAttributeAccessIssue, reportUnknownMemberType]
            mapped_name = self.item_mapping.get(item.name, "")
            rule_ids = self.rule_item_dependencies[item.name] | self.rule_item_dependencies[mapped_name]
            for rule_id in rule_ids:
                if player_results.get(rule_id, None) is False:
                    del player_results[rule_id]

        return changed

    @override
    def remove(self, state: CollectionState, item: Item) -> bool:
        changed = super().remove(state, item)
        if not changed or not self.rule_caching_enabled:
            return changed

        player_results = cast(dict[int, bool], state.rule_builder_cache[self.player])  # pyright: ignore[reportAttributeAccessIssue, reportUnknownMemberType]
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

    @override
    def reached_region(self, state: CollectionState, region: Region) -> None:
        super().reached_region(state, region)
        if self.rule_caching_enabled and self.rule_region_dependencies:
            player_results = cast(dict[int, bool], state.rule_builder_cache[self.player])  # pyright: ignore[reportAttributeAccessIssue, reportUnknownMemberType]
            for rule_id in self.rule_region_dependencies[region.name]:
                player_results.pop(rule_id, None)

    @override
    def collect_item(self, state: CollectionState, item: Item, remove: bool = False) -> str | None:
        """Collect an item name into state.

        Only collects progression items (items with advancement=True) into state.
        """
        if item.advancement:
            return item.name
        return None
