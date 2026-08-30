"""Vanilla-compatible ports of the fork's extra Rule Builder rule types.

This module is a static template: world_generator copies it verbatim into each
generated world as ``_ext/extra_rules.py`` (alongside a generated ``_game.py``
holding GAME_NAME). It is only imported when the fork's extended
``rule_builder`` package is NOT available (see ``_ext/__init__.py``), i.e. on
unmodified vanilla Archipelago — source checkouts and frozen installs alike.

Differences from the fork's ``rule_builder/extra_rules.py``:

- Classes register under THIS WORLD'S game name (``game=GAME_NAME``) via
  vanilla's per-game ``CustomRuleRegister`` mechanism, instead of the fork's
  broadened ``game="Archipelago"`` guard (which vanilla rejects for modules
  outside ``rule_builder.rules``).
- Every ``Resolved`` class gets its ``__hash__`` re-assigned at the bottom of
  this module to a ``_make_hashable``-based implementation. Vanilla's
  ``CustomRuleRegister.__call__`` hashes every resolved rule at construction
  time, so unhashable field values (HelperCall's kwargs/body_data dicts) would
  otherwise crash.
- ``AtLeast`` is included here (the fork defines it in base ``rules.py``,
  which vanilla lacks), with the fork's ``And/Or.from_resolved`` reduction
  inlined.
- Resolved-level export serialization (``to_dict``/``_get_args_dict``) is
  omitted — rule_builder-format export is fork-only; the AST fallback covers
  vanilla installs.
- Only the rule types world_generator can emit are ported.
"""
import dataclasses
from collections.abc import Callable, Iterable, Mapping
from typing import TYPE_CHECKING, Any, ClassVar, Self, cast

from typing_extensions import override

from BaseClasses import CollectionState
from NetUtils import JSONMessagePart

from rule_builder.field_resolvers import FieldResolver, resolve_field
from rule_builder.rules import (
    And,
    False_,
    NestedRule,
    OptionFilter,
    Or,
    Rule,
    True_,
    TWorld,
    WrapperRule,
)

from ._game import GAME_NAME

if TYPE_CHECKING:
    from worlds.AutoWorld import World


def _make_hashable(value: Any) -> Any:
    """Convert a value to a hashable form, recursively handling dicts, lists,
    tuples, sets and dataclasses. Needed so rules with unhashable args
    (e.g. HelperCall body_data dicts/lists) can still be hashed for caching."""
    if isinstance(value, dict):
        d = cast(dict[Any, Any], value)
        return tuple(sorted((_make_hashable(k), _make_hashable(v)) for k, v in d.items()))
    elif isinstance(value, list):
        items = cast(list[Any], value)
        return tuple(_make_hashable(item) for item in items)
    elif isinstance(value, tuple):
        items = cast(tuple[Any, ...], value)
        return tuple(_make_hashable(item) for item in items)
    elif isinstance(value, set):
        items = cast(set[Any], value)
        return frozenset(_make_hashable(item) for item in items)
    elif dataclasses.is_dataclass(value) and not isinstance(value, type):
        # Include the class identity to distinguish rule types with identical field values
        return (type(value).__qualname__, *(_make_hashable(getattr(value, f.name)) for f in dataclasses.fields(value)))
    return value


class AtLeast(NestedRule[TWorld], game=GAME_NAME):
    """A rule that returns true when at least N child rules evaluate as true"""

    count: int | FieldResolver

    def __init__(
        self,
        count: int | FieldResolver,
        *children: Rule[TWorld],
        options: Iterable[OptionFilter] = (),
        filtered_resolution: bool = False,
    ) -> None:
        super().__init__(*children, options=options, filtered_resolution=filtered_resolution)
        self.count = count

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        count = resolve_field(self.count, world, int)
        if count == 0:
            return True_().resolve(world)

        children_to_process = [c.resolve(world) for c in self.children]
        return AtLeast.from_resolved(count, world, children_to_process)

    @classmethod
    def from_resolved(cls, count: int, world: TWorld, children_to_process: "list[Rule.Resolved]") -> "Rule.Resolved":
        clauses: list[Rule.Resolved] = []

        while children_to_process:
            child = children_to_process.pop(0)
            if child.always_true:
                if count == 1:
                    return child
                count -= 1
                continue
            if child.always_false:
                # falses can be ignored
                continue

            clauses.append(child)

        if len(clauses) < count:
            return False_().resolve(world)
        caching_enabled = getattr(world, "rule_caching_enabled", False)
        if len(clauses) == 1:
            # count must be 1 here (count <= len(clauses) and count > 0)
            return clauses[0]
        if count == 1:
            # Vanilla lacks the fork's Or.from_resolved; an Or over the
            # already-simplified clauses is equivalent (minus Has-merging).
            return Or.Resolved(tuple(clauses), player=world.player, caching_enabled=caching_enabled)
        if count == len(clauses):
            return And.Resolved(tuple(clauses), player=world.player, caching_enabled=caching_enabled)
        return AtLeast.Resolved(
            tuple(clauses),
            count=count,
            player=world.player,
            caching_enabled=caching_enabled,
        )

    @override
    @classmethod
    def from_dict(cls, data: Mapping[str, Any], world_cls: "type[World]") -> Self:
        args = cls._parse_field_resolvers(data, world_cls.game)
        options = OptionFilter.multiple_from_dict(data.get("options", ()))
        children = [world_cls.rule_from_dict(c) for c in data.get("children", ())]
        return cls(
            args.pop("count"),
            *children,
            options=options,
            filtered_resolution=data.get("filtered_resolution", False),
        )

    class Resolved(NestedRule.Resolved):
        count: int

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            count = self.count
            for rule in self.children:
                if rule(state):
                    if count == 1:
                        return True
                    count -= 1
            return False

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            messages: list[JSONMessagePart] = []
            if state is None:
                messages = [
                    {"type": "text", "text": "At least "},
                    {"type": "color", "color": "cyan", "text": str(self.count)},
                    {"type": "text", "text": " of ("},
                ]
            else:
                satisfied_count = sum(1 if child(state) else 0 for child in self.children)
                messages = [
                    {"type": "text", "text": "At least "},
                    {"type": "color", "color": "cyan", "text": f"{satisfied_count}/{self.count}"},
                    {"type": "text", "text": " of ("},
                ]
            for i, child in enumerate(self.children):
                if i > 0:
                    messages.append({"type": "text", "text": ", "})
                messages.extend(child.explain_json(state))
            messages.append({"type": "text", "text": ")"})
            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            clauses = ", ".join([c.explain_str(state) for c in self.children])
            if state is None:
                return f"At least {self.count} of ({clauses})"
            satisfied_count = sum(1 if child(state) else 0 for child in self.children)
            return f"At least {satisfied_count}/{self.count} of ({clauses})"

        @override
        def __str__(self) -> str:
            clauses = ", ".join([str(c) for c in self.children])
            return f"At least {self.count} of ({clauses})"


@dataclasses.dataclass()
class Not(WrapperRule[TWorld], game=GAME_NAME):
    """
    Logical negation of a rule.

    Usage:
        rule = Not(Has("Sword"))  # True if player doesn't have Sword
    """

    @override
    def __str__(self) -> str:
        return f"NOT ({self.child})"

    class Resolved(WrapperRule.Resolved):
        @override
        def _evaluate(self, state: CollectionState) -> bool:
            return not self.child(state)

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            messages: list[JSONMessagePart] = [{"type": "text", "text": "NOT ("}]
            messages.extend(self.child.explain_json(state))
            messages.append({"type": "text", "text": ")"})
            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            return f"NOT ({self.child.explain_str(state)})"

        @override
        def __str__(self) -> str:
            return f"NOT ({self.child})"


@dataclasses.dataclass()
class CountItem(Rule[TWorld], game=GAME_NAME):
    """
    Returns the count of an item.

    When used as a boolean (in _evaluate), returns True if count > 0.
    Also provides get_count() for use in comparisons.

    Usage:
        rule = CountItem("Key")  # True if player has at least 1 Key
    """
    item_name: str = ""

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        return self.Resolved(
            self.item_name,
            player=world.player,
            caching_enabled=False,  # Count can change frequently
        )

    @override
    def __str__(self) -> str:
        return f"Count({self.item_name})"

    class Resolved(Rule.Resolved):
        item_name: str
        skip_cache: ClassVar[bool] = True

        def get_count(self, state: CollectionState) -> int:
            """Get the actual count of this item."""
            return state.count(self.item_name, self.player)

        def get_value(self, state: CollectionState) -> int:
            """Get the numeric value (count) for use in Compare/Arithmetic contexts."""
            return self.get_count(state)

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            # When used as boolean, true if count > 0
            return self.get_count(state) > 0

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            return {self.item_name: {id(self)}}

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            if state is not None:
                count = self.get_count(state)
                return [
                    {"type": "text", "text": "Count("},
                    {"type": "item_name", "text": self.item_name, "player": self.player, "flags": 0},
                    {"type": "text", "text": f"): {count}"},
                ]
            return [
                {"type": "text", "text": "Count("},
                {"type": "item_name", "text": self.item_name, "player": self.player, "flags": 0},
                {"type": "text", "text": ")"},
            ]

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            if state is not None:
                return f"Count({self.item_name}): {self.get_count(state)}"
            return f"Count({self.item_name})"

        @override
        def __str__(self) -> str:
            return f"Count({self.item_name})"


@dataclasses.dataclass(init=False)
class CountFromList(Rule[TWorld], game=GAME_NAME):
    """
    Returns the cumulative count of items from a list.

    This is the Rule Builder equivalent of state.count_from_list().
    For a list like ["Key", "Key", "Door"], if the player has 2 Keys and 1 Door,
    the count would be 2 + 2 + 1 = 5 (each occurrence in the list is counted).

    When used as a boolean (in _evaluate), returns True if count > 0.
    Also provides get_count() for use in comparisons.

    Usage:
        rule = CountFromList("Key", "Door", "Key")  # counts Key twice, Door once
    """
    item_names: tuple[str, ...] = ()

    def __init__(self, *item_names: str, options: OptionFilter | tuple[OptionFilter, ...] = ()):
        if isinstance(options, OptionFilter):
            options = (options,)
        super().__init__(options=options)
        self.item_names = item_names

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        return self.Resolved(
            self.item_names,
            player=world.player,
            caching_enabled=False,  # Count can change frequently
        )

    @override
    @classmethod
    def from_dict(cls, data: Mapping[str, Any], world_cls: "type[World]") -> Self:
        args = {**data.get("args", {})}
        item_names = args.pop("item_names", ())
        options = OptionFilter.multiple_from_dict(data.get("options", ()))
        return cls(*item_names, **args, options=options)

    @override
    def __str__(self) -> str:
        items = ", ".join(self.item_names)
        return f"CountFromList({items})"

    class Resolved(Rule.Resolved):
        item_names: tuple[str, ...]
        skip_cache: ClassVar[bool] = True

        def get_count(self, state: CollectionState) -> int:
            """Get the cumulative count of all items in the list."""
            return state.count_from_list(self.item_names, self.player)

        def get_value(self, state: CollectionState) -> int:
            """Get the numeric value (count) for use in Compare/Arithmetic contexts."""
            return self.get_count(state)

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            # When used as boolean, true if count > 0
            return self.get_count(state) > 0

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            return {item: {id(self)} for item in self.item_names}

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            messages: list[JSONMessagePart] = [{"type": "text", "text": "CountFromList("}]
            for i, item in enumerate(self.item_names):
                if i > 0:
                    messages.append({"type": "text", "text": ", "})
                messages.append({"type": "item_name", "text": item, "player": self.player, "flags": 0})
            messages.append({"type": "text", "text": ")"})
            if state is not None:
                count = self.get_count(state)
                messages.append({"type": "text", "text": f": {count}"})
            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            items = ", ".join(self.item_names)
            if state is not None:
                return f"CountFromList({items}): {self.get_count(state)}"
            return f"CountFromList({items})"

        @override
        def __str__(self) -> str:
            items = ", ".join(self.item_names)
            return f"CountFromList({items})"


@dataclasses.dataclass()
class CountGroup(Rule[TWorld], game=GAME_NAME):
    """
    Returns the count of items in a named group.

    When used as a boolean (in _evaluate), returns True if count > 0.
    Also provides get_count() for use in comparisons and arithmetic.

    This rule is used to count items that belong to a named item group,
    as defined by the world's item_name_groups.

    Usage:
        rule = CountGroup("Letters")  # True if player has at least 1 item from "Letters" group
        rule = Compare(CountGroup("Keys"), ">=", 3)  # True if player has 3+ items from "Keys"
    """
    group_name: str = ""

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        return self.Resolved(
            self.group_name,
            player=world.player,
            caching_enabled=False,  # Count can change frequently
        )

    @override
    def __str__(self) -> str:
        return f"CountGroup({self.group_name})"

    class Resolved(Rule.Resolved):
        group_name: str
        skip_cache: ClassVar[bool] = True

        def get_count(self, state: CollectionState) -> int:
            """Get the count of items in this group."""
            return state.count_group(self.group_name, self.player)

        def get_value(self, state: CollectionState) -> int:
            """Get the numeric value (count) for use in Compare/Arithmetic contexts."""
            return self.get_count(state)

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            # When used as boolean, true if count > 0
            return self.get_count(state) > 0

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            # Group dependencies are complex - items in the group may vary
            # Return empty as we can't easily determine item names from group
            return {}

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            if state is not None:
                count = self.get_count(state)
                return [
                    {"type": "text", "text": f"CountGroup({self.group_name}): {count}"},
                ]
            return [
                {"type": "text", "text": f"CountGroup({self.group_name})"},
            ]

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            if state is not None:
                return f"CountGroup({self.group_name}): {self.get_count(state)}"
            return f"CountGroup({self.group_name})"

        @override
        def __str__(self) -> str:
            return f"CountGroup({self.group_name})"


@dataclasses.dataclass()
class Compare(Rule[TWorld], game=GAME_NAME):
    """
    Comparison between two values/rules.

    Supports operators: ==, !=, <, >, <=, >=, in, not in

    Usage:
        rule = Compare(CountItem("Key"), ">=", 3)
    """
    left: "Rule[TWorld] | int | float | str" = dataclasses.field(default_factory=lambda: True_())
    op: str = "=="
    right: "Rule[TWorld] | int | float | str" = dataclasses.field(default_factory=lambda: True_())

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        # Resolve left and right if they are rules
        resolved_left: Any
        resolved_right: Any

        if isinstance(self.left, Rule):
            resolved_left = self.left._instantiate(world)
        else:
            # Literals must stay hashable (vanilla hashes every resolved rule
            # at construction), so freeze lists/dicts to tuples.
            resolved_left = _make_hashable(self.left)

        if isinstance(self.right, Rule):
            resolved_right = self.right._instantiate(world)
        else:
            resolved_right = _make_hashable(self.right)

        return self.Resolved(
            resolved_left,
            self.op,
            resolved_right,
            player=world.player,
            caching_enabled=False,
        )

    @override
    def __str__(self) -> str:
        return f"({self.left} {self.op} {self.right})"

    class Resolved(Rule.Resolved):
        left: Any  # Rule.Resolved or literal value
        op: str
        right: Any  # Rule.Resolved or literal value
        skip_cache: ClassVar[bool] = True

        def _get_value(self, operand: Any, state: CollectionState) -> Any:
            """Get the value of an operand."""
            if isinstance(operand, Rule.Resolved):
                # Check for get_value (Arithmetic) or get_count (CountItem)
                if hasattr(operand, 'get_value'):
                    return operand.get_value(state)
                if hasattr(operand, 'get_count'):
                    return operand.get_count(state)
                # Otherwise evaluate as boolean
                return operand(state)
            return operand

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            left_val = self._get_value(self.left, state)
            right_val = self._get_value(self.right, state)

            if self.op == '==':
                return left_val == right_val
            elif self.op == '!=':
                return left_val != right_val
            elif self.op == '<':
                return left_val < right_val
            elif self.op == '>':
                return left_val > right_val
            elif self.op == '<=':
                return left_val <= right_val
            elif self.op == '>=':
                return left_val >= right_val
            elif self.op == 'in':
                return left_val in right_val
            elif self.op == 'not in':
                return left_val not in right_val
            else:
                return False

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            deps: dict[str, set[int]] = {}
            if isinstance(self.left, Rule.Resolved):
                for name, ids in self.left.item_dependencies().items():
                    deps.setdefault(name, set()).update(ids)
            if isinstance(self.right, Rule.Resolved):
                for name, ids in self.right.item_dependencies().items():
                    deps.setdefault(name, set()).update(ids)
            return deps

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            messages: list[JSONMessagePart] = []

            # Explain left side
            if isinstance(self.left, Rule.Resolved):
                messages.extend(self.left.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.left)})

            messages.append({"type": "text", "text": f" {self.op} "})

            # Explain right side
            if isinstance(self.right, Rule.Resolved):
                messages.extend(self.right.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.right)})

            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            left_str = self.left.explain_str(state) if isinstance(self.left, Rule.Resolved) else str(self.left)
            right_str = self.right.explain_str(state) if isinstance(self.right, Rule.Resolved) else str(self.right)
            return f"({left_str} {self.op} {right_str})"

        @override
        def __str__(self) -> str:
            return f"({self.left} {self.op} {self.right})"


@dataclasses.dataclass()
class Arithmetic(Rule[TWorld], game=GAME_NAME):
    """
    Arithmetic operation between two numeric values/rules.

    Supports operators: +, -, *, /, //, %, **

    Returns the computed numeric value via get_value().
    When used in Compare, enables expressions like:
        Compare(Arithmetic(CountItem("Puppy"), "*", 3), ">=", 10)
    """
    left: "Rule[TWorld] | int | float" = dataclasses.field(default=0)
    op: str = "+"
    right: "Rule[TWorld] | int | float" = dataclasses.field(default=0)

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        resolved_left: Any
        resolved_right: Any

        if isinstance(self.left, Rule):
            resolved_left = self.left._instantiate(world)
        else:
            resolved_left = self.left

        if isinstance(self.right, Rule):
            resolved_right = self.right._instantiate(world)
        else:
            resolved_right = self.right

        return self.Resolved(
            resolved_left,
            self.op,
            resolved_right,
            player=world.player,
            caching_enabled=False,
        )

    @override
    def __str__(self) -> str:
        return f"({self.left} {self.op} {self.right})"

    class Resolved(Rule.Resolved):
        left: Any  # Rule.Resolved or literal value
        op: str
        right: Any  # Rule.Resolved or literal value
        skip_cache: ClassVar[bool] = True

        def _get_operand_value(self, operand: Any, state: CollectionState) -> float | int:
            """Get the numeric value of an operand."""
            if isinstance(operand, Rule.Resolved):
                if hasattr(operand, 'get_value'):
                    return operand.get_value(state)
                if hasattr(operand, 'get_count'):
                    return operand.get_count(state)
                # Boolean rules: True=1, False=0
                return 1 if operand(state) else 0
            return operand

        def get_value(self, state: CollectionState) -> float | int:
            """Get the computed value of this arithmetic expression."""
            left_val = self._get_operand_value(self.left, state)
            right_val = self._get_operand_value(self.right, state)

            if self.op == '+':
                return left_val + right_val
            elif self.op == '-':
                return left_val - right_val
            elif self.op == '*':
                return left_val * right_val
            elif self.op == '/':
                return left_val / right_val if right_val != 0 else 0
            elif self.op == '//':
                return left_val // right_val if right_val != 0 else 0
            elif self.op == '%':
                return left_val % right_val if right_val != 0 else 0
            elif self.op == '**':
                return left_val ** right_val
            else:
                return left_val + right_val  # Default to addition

        # Alias for Compare compatibility
        get_count = get_value

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            # When used as boolean, true if value is truthy (non-zero)
            return bool(self.get_value(state))

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            deps: dict[str, set[int]] = {}
            if isinstance(self.left, Rule.Resolved):
                for name, ids in self.left.item_dependencies().items():
                    deps.setdefault(name, set()).update(ids)
            if isinstance(self.right, Rule.Resolved):
                for name, ids in self.right.item_dependencies().items():
                    deps.setdefault(name, set()).update(ids)
            return deps

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            messages: list[JSONMessagePart] = [{"type": "text", "text": "("}]

            if isinstance(self.left, Rule.Resolved):
                messages.extend(self.left.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.left)})

            messages.append({"type": "text", "text": f" {self.op} "})

            if isinstance(self.right, Rule.Resolved):
                messages.extend(self.right.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.right)})

            messages.append({"type": "text", "text": ")"})

            if state is not None:
                value = self.get_value(state)
                messages.append({"type": "text", "text": f" = {value}"})

            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            left_str = self.left.explain_str(state) if isinstance(self.left, Rule.Resolved) else str(self.left)
            right_str = self.right.explain_str(state) if isinstance(self.right, Rule.Resolved) else str(self.right)
            result = f"({left_str} {self.op} {right_str})"
            if state is not None:
                result += f" = {self.get_value(state)}"
            return result

        @override
        def __str__(self) -> str:
            return f"({self.left} {self.op} {self.right})"


@dataclasses.dataclass()
class Conditional(Rule[TWorld], game=GAME_NAME):
    """
    Conditional (ternary) rule: if test then if_true else if_false.

    Usage:
        rule = Conditional(
            test=Has("Key"),
            if_true=Has("Door Open"),
            if_false=True_()
        )
    """
    test: "Rule[TWorld]" = dataclasses.field(default_factory=lambda: True_())
    if_true: "Rule[TWorld] | int | float" = dataclasses.field(default_factory=lambda: True_())
    if_false: "Rule[TWorld] | int | float" = dataclasses.field(default_factory=lambda: True_())

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        resolved_test = self.test._instantiate(world)

        # Handle if_true - can be a Rule or a numeric value
        if isinstance(self.if_true, Rule):
            resolved_if_true = self.if_true._instantiate(world)
        else:
            resolved_if_true = self.if_true

        # Handle if_false - can be a Rule or a numeric value
        if isinstance(self.if_false, Rule):
            resolved_if_false = self.if_false._instantiate(world)
        else:
            resolved_if_false = self.if_false

        return self.Resolved(
            resolved_test,
            resolved_if_true,
            resolved_if_false,
            player=world.player,
            caching_enabled=False,
        )

    @override
    def __str__(self) -> str:
        return f"If({self.test}) then ({self.if_true}) else ({self.if_false})"

    class Resolved(Rule.Resolved):
        test: "Rule.Resolved"
        if_true: Any  # Rule.Resolved or literal value
        if_false: Any  # Rule.Resolved or literal value
        skip_cache: ClassVar[bool] = True

        def _get_branch_value(self, branch: Any, state: CollectionState) -> float | int:
            """Get the numeric value of a branch."""
            if isinstance(branch, Rule.Resolved):
                if hasattr(branch, 'get_value'):
                    return branch.get_value(state)
                if hasattr(branch, 'get_count'):
                    return branch.get_count(state)
                # Boolean rules: True=1, False=0
                return 1 if branch(state) else 0
            return branch

        def get_value(self, state: CollectionState) -> float | int:
            """Get the numeric value based on condition."""
            if self.test(state):
                return self._get_branch_value(self.if_true, state)
            return self._get_branch_value(self.if_false, state)

        # Alias for Compare compatibility
        get_count = get_value

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            if self.test(state):
                if isinstance(self.if_true, Rule.Resolved):
                    return self.if_true(state)
                return bool(self.if_true)
            if isinstance(self.if_false, Rule.Resolved):
                return self.if_false(state)
            return bool(self.if_false)

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            deps: dict[str, set[int]] = {}
            for rule in [self.test, self.if_true, self.if_false]:
                if isinstance(rule, Rule.Resolved):
                    for name, ids in rule.item_dependencies().items():
                        deps.setdefault(name, set()).update(ids)
            return deps

        @override
        def region_dependencies(self) -> dict[str, set[int]]:
            deps: dict[str, set[int]] = {}
            for rule in [self.test, self.if_true, self.if_false]:
                if isinstance(rule, Rule.Resolved):
                    for name, ids in rule.region_dependencies().items():
                        deps.setdefault(name, set()).update(ids)
            return deps

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            messages: list[JSONMessagePart] = [{"type": "text", "text": "If ("}]
            messages.extend(self.test.explain_json(state))
            messages.append({"type": "text", "text": ") then ("})
            if isinstance(self.if_true, Rule.Resolved):
                messages.extend(self.if_true.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.if_true)})
            messages.append({"type": "text", "text": ") else ("})
            if isinstance(self.if_false, Rule.Resolved):
                messages.extend(self.if_false.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.if_false)})
            messages.append({"type": "text", "text": ")"})
            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            if_true_str = self.if_true.explain_str(state) if isinstance(self.if_true, Rule.Resolved) else str(self.if_true)
            if_false_str = self.if_false.explain_str(state) if isinstance(self.if_false, Rule.Resolved) else str(self.if_false)
            return f"If ({self.test.explain_str(state)}) then ({if_true_str}) else ({if_false_str})"

        @override
        def __str__(self) -> str:
            return f"If({self.test}) then ({self.if_true}) else ({self.if_false})"


@dataclasses.dataclass()
class HelperCall(Rule[TWorld], game=GAME_NAME):
    """
    Calls a helper function with explain support.

    This class supports three tiers of helper integration:
    1. body_rule set: Full Rule Builder evaluation and explain (best)
    2. helper_func + body_data set: Python evaluation, AST format explain
    3. helper_func only: Python evaluation, helper name display

    Usage:
        # Tier 1: Rule Builder body
        rule = HelperCall(helper_name="can_swim", body_rule=Has("Flippers"))

        # Tier 2/3: Python function
        rule = HelperCall(
            helper_func=_game_can_swim,
            helper_name="can_swim",
            args=(),
            body_data={"type": "item_check", "item": "Flippers"}
        )
    """
    helper_func: Callable[..., bool] | None = None
    helper_name: str = ""
    args: tuple[Any, ...] = ()
    kwargs: dict[str, Any] | None = None
    body_rule: "Rule[TWorld] | None" = None
    body_data: dict[str, Any] | None = None

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        # Instantiate the body_rule if present
        resolved_body_rule = None
        if self.body_rule is not None:
            resolved_body_rule = self.body_rule._instantiate(world)

        return self.Resolved(
            self.helper_func,
            self.helper_name,
            self.args,
            self.kwargs or {},
            resolved_body_rule,
            self.body_data,
            player=world.player,
            caching_enabled=False,  # Helpers may have complex dependencies
        )

    @override
    def __str__(self) -> str:
        parts: list[str] = []
        if self.args:
            parts.append(", ".join(repr(a) for a in self.args))
        if self.kwargs:
            parts.append(", ".join(f"{k}={repr(v)}" for k, v in self.kwargs.items()))
        if parts:
            return f"Helper:{self.helper_name}({', '.join(parts)})"
        return f"Helper:{self.helper_name}"

    class Resolved(Rule.Resolved):
        helper_func: Callable[..., bool] | None
        helper_name: str
        args: tuple[Any, ...]
        kwargs: dict[str, Any]
        body_rule: "Rule.Resolved | None"
        body_data: dict[str, Any] | None
        skip_cache: ClassVar[bool] = True

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            # Tier 1: Use Rule Builder evaluation (preferred)
            if self.body_rule is not None:
                return self.body_rule(state)

            # Tier 2/3: Fall back to Python function
            if self.helper_func is not None:
                return self.helper_func(state, self.player, *self.args, **self.kwargs)

            # No evaluation available
            return True

        def get_value(self, state: CollectionState) -> int | float:
            """Get the numeric value from this helper for use in Arithmetic.

            Some helpers return integer counts rather than booleans. When used
            in Arithmetic expressions, we need the actual numeric value.
            """
            # Tier 1: Check if body_rule has get_value
            if self.body_rule is not None:
                if hasattr(self.body_rule, 'get_value'):
                    return self.body_rule.get_value(state)
                if hasattr(self.body_rule, 'get_count'):
                    return self.body_rule.get_count(state)
                # Fall back to boolean conversion
                return 1 if self.body_rule(state) else 0

            # Tier 2/3: Call helper function and return its value
            if self.helper_func is not None:
                result = self.helper_func(state, self.player, *self.args, **self.kwargs)
                # If result is numeric, return it directly
                if isinstance(result, (int, float)):
                    return result
                # Otherwise treat as boolean
                return 1 if result else 0

            return 0

        # Alias for Arithmetic compatibility
        get_count = get_value

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            if self.body_rule is not None:
                return self.body_rule.item_dependencies()
            return {}

        @override
        def region_dependencies(self) -> dict[str, set[int]]:
            if self.body_rule is not None:
                return self.body_rule.region_dependencies()
            return {}

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            # Tier 1: Use Rule Builder explain (best - shows actual state)
            if self.body_rule is not None:
                return self.body_rule.explain_json(state)

            # Tier 2: Use AST format explain (fork-only module; skip on vanilla)
            if self.body_data is not None:
                try:
                    from rule_builder.ast_explain import explain_ast_rule
                except ImportError:
                    pass
                else:
                    return explain_ast_rule(self.body_data, state, self.player)

            # Tier 3: Fallback - just show helper name and args
            messages: list[JSONMessagePart] = [
                {"type": "text", "text": "Helper: "},
                {"type": "color", "color": "magenta", "text": self.helper_name},
            ]
            if self.args:
                args_str = ", ".join(repr(a) for a in self.args)
                messages.append({"type": "text", "text": f"({args_str})"})
            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            if self.body_rule is not None:
                return self.body_rule.explain_str(state)
            if self.args:
                args_str = ", ".join(repr(a) for a in self.args)
                return f"Helper:{self.helper_name}({args_str})"
            return f"Helper:{self.helper_name}"

        @override
        def __str__(self) -> str:
            if self.args:
                args_str = ", ".join(repr(a) for a in self.args)
                return f"Helper:{self.helper_name}({args_str})"
            return f"Helper:{self.helper_name}"


@dataclasses.dataclass()
class WeightedSum(Rule[TWorld], game=GAME_NAME):
    """
    Check if the weighted sum of collected items meets or exceeds a threshold.

    Each item contributes its weight multiplied by the count of that item collected.
    For example, if threshold is 1.0 and items is [("Sword", 0.4), ("Shield", 0.6)],
    then having 1 Sword (0.4) and 1 Shield (0.6) would give 1.0 >= 1.0 = True.

    Usage:
        rule = WeightedSum(
            threshold=1.0,
            items=[("Progressive Dash", 0.35), ("Sharp Knife", 0.3), ...]
        )
    """
    threshold: float = 1.0
    items: list[tuple[str, float]] = dataclasses.field(default_factory=lambda: list[tuple[str, float]]())

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        return self.Resolved(
            self.threshold,
            tuple(self.items),
            player=world.player,
            caching_enabled=False,
        )

    @override
    def __str__(self) -> str:
        item_strs = [f"{name}:{weight}" for name, weight in self.items]
        return f"WeightedSum({self.threshold}, [{', '.join(item_strs)}])"

    class Resolved(Rule.Resolved):
        threshold: float
        items: tuple[tuple[str, float], ...]
        skip_cache: ClassVar[bool] = True

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            total = 0.0
            for item_name, weight in self.items:
                count = state.count(item_name, self.player)
                total += count * weight
                # Early exit optimization
                if total >= self.threshold - 0.001:
                    return True
            return total >= self.threshold - 0.001

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            return {item_name: {id(self)} for item_name, _ in self.items}

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            messages: list[JSONMessagePart] = []
            if state is not None:
                total = 0.0
                for item_name, weight in self.items:
                    count = state.count(item_name, self.player)
                    total += count * weight
                messages.append({
                    "type": "text",
                    "text": f"Weighted sum: {total:.2f}/{self.threshold:.2f}"
                })
            else:
                messages.append({
                    "type": "text",
                    "text": f"Weighted sum >= {self.threshold}"
                })
            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            if state is not None:
                total = 0.0
                for item_name, weight in self.items:
                    count = state.count(item_name, self.player)
                    total += count * weight
                return f"Weighted sum: {total:.2f}/{self.threshold:.2f}"
            return f"Weighted sum >= {self.threshold}"

        @override
        def __str__(self) -> str:
            return f"WeightedSum({self.threshold})"


@dataclasses.dataclass()
class OptionValue(Rule[TWorld], game=GAME_NAME):
    """A rule that evaluates to the truthiness of a world option at runtime.

    This is used in Conditional tests to check option values dynamically,
    allowing rules to adapt based on the player's option settings.

    Usage:
        rule = Conditional(
            test=OptionValue('puzzle_hints_required'),
            if_true=And(CanReachRegion('Theater'), Has('Key')),
            if_false=True_()
        )
    """

    option_name: str
    """The name of the option to check"""

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        return self.Resolved(
            self.option_name,
            player=world.player,
            caching_enabled=False,
        )

    @override
    def __str__(self) -> str:
        return f"OptionValue({self.option_name})"

    class Resolved(Rule.Resolved):
        option_name: str
        skip_cache: ClassVar[bool] = True

        def _get_option(self, state: CollectionState) -> Any:
            """Get the raw option object from the world."""
            world = state.multiworld.worlds[self.player]
            return getattr(world.options, self.option_name, None)

        def get_value(self, state: CollectionState) -> int | float:
            """Get the numeric value of the option for Compare/Arithmetic contexts."""
            option = self._get_option(state)
            if option is None:
                return 0
            # Handle Option objects that have a .value attribute
            if hasattr(option, 'value'):
                value = option.value
                if isinstance(value, (int, float)):
                    return value
                return 1 if value else 0
            if isinstance(option, (int, float)):
                return option
            return 1 if option else 0

        # Alias for Compare compatibility
        get_count = get_value

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            option = self._get_option(state)
            if option is None:
                return True  # Default to true if option not found
            # Handle Option objects that have a .value attribute
            if hasattr(option, 'value'):
                return bool(option.value)
            return bool(option)

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            if state:
                result = self(state)
                color = "green" if result else "salmon"
                return [{"type": "color", "color": color, "text": f"Option: {self.option_name}"}]
            return [{"type": "text", "text": f"Option: {self.option_name}"}]

        @override
        def __str__(self) -> str:
            return f"OptionValue({self.option_name})"


# Rule types that produce boolean expressions (as opposed to numeric values).
# Mirrors the fork's rule_builder.extra_rules.BOOLEAN_RULE_TYPES.
BOOLEAN_RULE_TYPES: frozenset[str] = frozenset({
    # Reachability rules
    'CanReachEntrance', 'CanReachRegion', 'CanReachLocation', 'EntranceAccessRuleCall',
    # Item rules
    'Has', 'HasAll', 'HasAny', 'HasAllCounts', 'HasAnyCount',
    'HasFromList', 'HasFromListUnique', 'HasGroup', 'HasGroupUnique',
    # Logic rules
    'And', 'Or', 'Not',
    # Boolean constants
    'True_', 'False_',
    # Comparison and conditional (produce booleans)
    'Compare', 'Conditional',
    # Helper calls
    'HelperCall',
    # Wrapper rules
    'Filtered', 'ASTRule',
})


# ── Hash hardening ───────────────────────────────────────────────────────────
# Vanilla's CustomRuleRegister.__call__ computes hash(rule) for EVERY resolved
# rule at construction time (to intern singletons). Vanilla's generated
# __hash__ hashes raw field values, which crashes for unhashable fields
# (HelperCall's kwargs/body_data dicts). Re-assign a _make_hashable-based
# implementation — the same shape the fork uses — to every Resolved class
# defined in this module. This runs at import time, before any rule is
# instantiated.

def _create_ext_hash_fn(resolved_rule_cls: type) -> Callable[..., int]:
    def hash_impl(self: "Rule.Resolved") -> int:
        return hash(
            (
                self.__class__.__module__,
                self.rule_name,
                *[_make_hashable(getattr(self, f.name)) for f in dataclasses.fields(self)],
            )
        )

    hash_impl.__qualname__ = f"{resolved_rule_cls.__qualname__}.__hash__"
    return hash_impl


for _rule_cls in (
    AtLeast, Not, CountItem, CountFromList, CountGroup,
    Compare, Arithmetic, Conditional, HelperCall, WeightedSum, OptionValue,
):
    _rule_cls.Resolved.__hash__ = _create_ext_hash_fn(_rule_cls.Resolved)
del _rule_cls
