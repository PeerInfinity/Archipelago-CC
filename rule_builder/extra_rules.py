"""Fork-only Rule Builder rule types — an overlay on the official rule_builder.

These extend upstream rule_builder with AST-format support, numeric/counting
rules, comparisons, arithmetic, conditionals, helper calls and option access.
They live in a separate module so the upstream ``rules.py`` stays close to
vanilla; the broadened ``Rule.__init_subclass__`` guard in ``rules.py`` allows
base-game ("Archipelago") rules to be defined here.
"""
import dataclasses
from collections.abc import Callable, Iterable, Mapping
from typing import TYPE_CHECKING, Any, ClassVar, Self, cast

from typing_extensions import override

from BaseClasses import CollectionState, Entrance, Item, MultiWorld
from NetUtils import JSONMessagePart

from .rules import (
    And,
    CanReachRegion,
    False_,
    Has,
    OptionFilter,
    Rule,
    True_,
    TWorld,
    WrapperRule,
)

if TYPE_CHECKING:
    from worlds.AutoWorld import World


@dataclasses.dataclass()
class EntranceAccessRuleCall(Rule[TWorld], game="Archipelago"):
    """A rule that evaluates an entrance's access_rule.

    This is used for ALttP underworld glitch rules where dungeon_entrance.access_rule()
    is called, potentially with a fake pearl state. The entrance is looked up by name
    and its access_rule is evaluated.

    When fake_pearl is True, Moon Pearl is temporarily added to the state before
    evaluating the access rule. This simulates the "fake_pearl_state" function from
    ALttP UnderworldGlitchRules.py.
    """

    entrance_name: str
    """The name of the entrance whose access_rule to evaluate"""

    fake_pearl: bool = False
    """If True, evaluate the rule as if the player has Moon Pearl"""

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        return self.Resolved(
            self.entrance_name,
            self.fake_pearl,
            player=world.player,
            multiworld=world.multiworld,
            caching_enabled=getattr(world, "rule_caching_enabled", False),
        )

    @override
    def __str__(self) -> str:
        fp = ", fake_pearl=True" if self.fake_pearl else ""
        return f"{self.__class__.__name__}({self.entrance_name!r}{fp})"

    class Resolved(Rule.Resolved):
        entrance_name: str
        fake_pearl: bool
        multiworld: Any  # MultiWorld

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            try:
                entrance = self.multiworld.get_entrance(self.entrance_name, self.player)
            except KeyError:
                # Entrance not found - conservatively return True
                return True

            eval_state = state
            if self.fake_pearl:
                # Create a fake state with Moon Pearl
                if not state.has('Moon Pearl', self.player):
                    eval_state = state.copy()
                    eval_state.prog_items[self.player]['Moon Pearl'] += 1

            # Evaluate the entrance's access_rule
            return entrance.access_rule(eval_state)

        @override
        def entrance_dependencies(self) -> dict[str, set[int]]:
            return {self.entrance_name: {id(self)}}

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            fp_text = " (with fake pearl)" if self.fake_pearl else ""
            if state is None:
                verb = "Can access"
            elif self(state):
                verb = "Can access"
            else:
                verb = "Cannot access"
            return [
                {"type": "text", "text": f"{verb} entrance "},
                {"type": "entrance_name", "text": self.entrance_name, "player": self.player},
                {"type": "text", "text": f" access rule{fp_text}"},
            ]

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            fp_text = " (with fake pearl)" if self.fake_pearl else ""
            if state is None:
                return str(self)
            prefix = "Can access" if self(state) else "Cannot access"
            return f"{prefix} entrance {self.entrance_name} access rule{fp_text}"

        @override
        def __str__(self) -> str:
            fp_text = " (with fake pearl)" if self.fake_pearl else ""
            return f"Entrance {self.entrance_name} access rule{fp_text}"

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            result: dict[str, Any] = {"entrance_name": self.entrance_name}
            if self.fake_pearl:
                result["fake_pearl"] = True
            return result


# =============================================================================
# AST Format Support Classes
# =============================================================================


@dataclasses.dataclass()
class ASTRule(Rule[TWorld], game="Archipelago"):
    """
    Wraps an AST format rule that can't be converted to a native Rule Builder class.

    This class provides explain support for complex AST format rules while
    delegating evaluation to either a pre-computed value or returning True
    as a fallback.
    """
    rule_data: dict[str, Any] = dataclasses.field(default_factory=lambda: dict[str, Any]())
    """The original AST format rule data"""

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        return self.Resolved(
            self.rule_data,
            player=world.player,
            caching_enabled=False,  # Bypass caching for AST rules
        )

    @override
    def __str__(self) -> str:
        rule_type = self.rule_data.get('type', 'unknown')
        return f"ASTRule({rule_type})"

    class Resolved(Rule.Resolved):
        rule_data: dict[str, Any]
        skip_cache: ClassVar[bool] = True

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            # AST rules currently return True as fallback
            # Future enhancement: implement AST rule evaluation
            return True

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            from rule_builder.ast_explain import explain_ast_rule
            return explain_ast_rule(self.rule_data, state, self.player)

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            rule_type = self.rule_data.get('type', 'unknown')
            return f"[AST:{rule_type}]"

        @override
        def __str__(self) -> str:
            rule_type = self.rule_data.get('type', 'unknown')
            return f"ASTRule({rule_type})"

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"rule_data": self.rule_data}


@dataclasses.dataclass()
class Not(WrapperRule[TWorld], game="Archipelago"):
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
class CountItem(Rule[TWorld], game="Archipelago"):
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

        @override
        def get_count(self, state: CollectionState) -> int:
            """Get the actual count of this item."""
            return state.count(self.item_name, self.player)

        @override
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

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"item_name": self.item_name}


@dataclasses.dataclass(init=False)
class CountFromList(Rule[TWorld], game="Archipelago"):
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

        @override
        def get_count(self, state: CollectionState) -> int:
            """Get the cumulative count of all items in the list."""
            return state.count_from_list(self.item_names, self.player)

        @override
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

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"item_names": self.item_names}


@dataclasses.dataclass()
class CountGroup(Rule[TWorld], game="Archipelago"):
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

        @override
        def get_count(self, state: CollectionState) -> int:
            """Get the count of items in this group."""
            return state.count_group(self.group_name, self.player)

        @override
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

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"group_name": self.group_name}


@dataclasses.dataclass()
class Compare(Rule[TWorld], game="Archipelago"):
    """
    Comparison between two values/rules.

    Supports operators: ==, !=, <, >, <=, >=, in, not in

    Usage:
        rule = Compare(CountItem("Key"), ">=", 3)
        rule = Compare(['Item', 1], "in", [['Item', 1], ['Other', 1]])
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

        def _serialize_operand(self, operand: Any) -> Any:
            """Serialize a compare operand for JSON export.

            Extracts raw values from simple rules (Constant, Tuple, List)
            to produce cleaner output matching the original exporter format.
            """
            if isinstance(operand, Rule.Resolved):
                # Check if this is a simple value-holding rule
                rule_name = operand._rule_class_name

                # Constant - extract the raw value
                if rule_name == 'Constant':
                    args = operand._get_args_dict()
                    return args.get('value')

                # Tuple - extract as Python tuple
                if rule_name == 'Tuple':
                    args = operand._get_args_dict()
                    value = args.get('value', args.get('elements', []))
                    return tuple(self._serialize_operand(v) for v in value)

                # List - extract as Python list
                if rule_name == 'List':
                    args = operand._get_args_dict()
                    value = args.get('value', args.get('elements', []))
                    return [self._serialize_operand(v) for v in value]

                # Complex rule - use to_dict()
                return operand.to_dict()

            # Already a primitive value
            return operand

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {
                "left": self._serialize_operand(self.left),
                "op": self.op,
                "right": self._serialize_operand(self.right)
            }


@dataclasses.dataclass()
class Arithmetic(Rule[TWorld], game="Archipelago"):
    """
    Arithmetic operation between two numeric values/rules.

    Supports operators: +, -, *, /, //, %, **

    Returns the computed numeric value via get_value().
    When used in Compare, enables expressions like:
        Compare(Arithmetic(CountItem("Puppy"), "*", 3), ">=", 10)

    Usage:
        # Puppy value calculation (each Puppy item worth 3)
        rule = Compare(Arithmetic(CountItem("Puppy"), "*", 3), ">=", 10)

        # Arrow capacity: 30 + (upgrades * 5)
        rule = Arithmetic(30, "+", Arithmetic(CountItem("Arrow +5"), "*", 5))
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

        @override
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

        def _serialize_operand(self, operand: Any) -> Any:
            """Serialize an arithmetic operand for JSON export.

            Extracts raw values from Constant rules to produce cleaner output.
            """
            if isinstance(operand, Rule.Resolved):
                rule_name = operand._rule_class_name
                if rule_name == 'Constant':
                    args = operand._get_args_dict()
                    return args.get('value')
                return operand.to_dict()
            return operand

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {
                "left": self._serialize_operand(self.left),
                "op": self.op,
                "right": self._serialize_operand(self.right)
            }


@dataclasses.dataclass()
class MinValue(Rule[TWorld], game="Archipelago"):
    """
    Returns the minimum of two numeric values/rules.

    Used in arithmetic expressions where a cap is needed.
    Returns the minimum value via get_value().

    Usage:
        # Cap item contribution at 9
        rule = MinValue(CountItem("Orichalcum"), 9)

        # Combined with Arithmetic for complex rules
        rule = Compare(
            Arithmetic(MinValue(CountItem("Orichalcum"), 9), "+", MinValue(CountItem("Mythril"), 9)),
            ">=", 15
        )
    """
    left: "Rule[TWorld] | int | float" = dataclasses.field(default=0)
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
            resolved_right,
            player=world.player,
            caching_enabled=False,
        )

    @override
    def __str__(self) -> str:
        return f"min({self.left}, {self.right})"

    class Resolved(Rule.Resolved):
        left: Any  # Rule.Resolved or literal value
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

        @override
        def get_value(self, state: CollectionState) -> float | int:
            """Get the minimum of the two operands."""
            left_val = self._get_operand_value(self.left, state)
            right_val = self._get_operand_value(self.right, state)
            return min(left_val, right_val)

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
            messages: list[JSONMessagePart] = [{"type": "text", "text": "min("}]

            if isinstance(self.left, Rule.Resolved):
                messages.extend(self.left.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.left)})

            messages.append({"type": "text", "text": ", "})

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
            result = f"min({left_str}, {right_str})"
            if state is not None:
                result += f" = {self.get_value(state)}"
            return result

        @override
        def __str__(self) -> str:
            return f"min({self.left}, {self.right})"

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"left": self.left, "right": self.right}


@dataclasses.dataclass()
class MaxValue(Rule[TWorld], game="Archipelago"):
    """
    Returns the maximum of two numeric values/rules.

    Used in arithmetic expressions where the largest value is needed.
    Returns the maximum value via get_value().

    Usage:
        # Get maximum depth from multiple sources
        rule = MaxValue(seamoth_depth, cyclops_depth)

        # Combined with Arithmetic for complex rules
        rule = Compare(
            Arithmetic(swim_depth, "+", MaxValue(seamoth_depth, cyclops_depth)),
            ">=", 1444
        )
    """
    left: "Rule[TWorld] | int | float" = dataclasses.field(default=0)
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
            resolved_right,
            player=world.player,
            caching_enabled=False,
        )

    @override
    def __str__(self) -> str:
        return f"max({self.left}, {self.right})"

    class Resolved(Rule.Resolved):
        left: Any  # Rule.Resolved or literal value
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

        @override
        def get_value(self, state: CollectionState) -> float | int:
            """Get the maximum of the two operands."""
            left_val = self._get_operand_value(self.left, state)
            right_val = self._get_operand_value(self.right, state)
            return max(left_val, right_val)

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
            messages: list[JSONMessagePart] = [{"type": "text", "text": "max("}]

            if isinstance(self.left, Rule.Resolved):
                messages.extend(self.left.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.left)})

            messages.append({"type": "text", "text": ", "})

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
            result = f"max({left_str}, {right_str})"
            if state is not None:
                result += f" = {self.get_value(state)}"
            return result

        @override
        def __str__(self) -> str:
            return f"max({self.left}, {self.right})"

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"left": self.left, "right": self.right}


@dataclasses.dataclass()
class Conditional(Rule[TWorld], game="Archipelago"):
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

        @override
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

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"test": self.test, "if_true": self.if_true, "if_false": self.if_false}


@dataclasses.dataclass()
class HelperCall(Rule[TWorld], game="Archipelago"):
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

        # With keyword arguments
        rule = HelperCall(
            helper_func=_game_enough_cats,
            helper_name="enough_cats",
            args=(walls_table, 1),
            kwargs={"strange": True}
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

    @override
    def to_dict(self) -> dict[str, Any]:
        """Returns a JSON compatible dict representation of this helper call.

        This outputs the format expected by the frontend, matching the AST exporter format.
        Empty 'options', 'args', and 'kwargs' are omitted.

        Uses _original_ast_type to encode the helper source and expansion behavior:
        - "rb_defined_helper": has body_rule or helper_func, skip all expansion
        - "helper": no body, allow full (pattern + standard) expansion
        """
        # Helpers with a defined body get "rb_defined_helper" to skip all expansion
        ast_type = "rb_defined_helper" if (self.body_rule is not None or self.helper_func is not None) else "helper"
        result: dict[str, Any] = {
            "rule": self.helper_name,
            "_original_ast_type": ast_type,
        }
        if self.options:
            result["options"] = [o.to_dict() for o in self.options]
        if self.filtered_resolution:
            result["filtered_resolution"] = self.filtered_resolution
        if self.args:
            # Convert boolean args to AST format for frontend compatibility
            exported_args: list[Any] = []
            for arg in self.args:
                if arg is True:
                    exported_args.append({"rule": "True_"})
                elif arg is False:
                    exported_args.append({"rule": "False_"})
                else:
                    exported_args.append(arg)
            result["args"] = exported_args
        if self.kwargs:
            # Convert boolean kwargs to AST format for frontend compatibility
            exported_kwargs: dict[str, Any] = {}
            for k, v in self.kwargs.items():
                if v is True:
                    exported_kwargs[k] = {"rule": "True_"}
                elif v is False:
                    exported_kwargs[k] = {"rule": "False_"}
                else:
                    exported_kwargs[k] = v
            result["kwargs"] = exported_kwargs
        return result

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

        @override
        def get_value(self, state: CollectionState) -> int | float:
            """Get the numeric value from this helper for use in Arithmetic.

            Some helpers (like double_jump_height) return integer counts rather than
            booleans. When used in Arithmetic expressions, we need the actual numeric
            value, not a boolean conversion.
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
                if isinstance(result, (int, float)):  # pyright: ignore[reportUnnecessaryIsInstance]
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

            # Tier 2: Use AST format explain
            if self.body_data is not None:
                from rule_builder.ast_explain import explain_ast_rule
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

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            # Note: body_data is intentionally NOT included here.
            # Helper bodies should be looked up from the helpers section in the export data.
            # This avoids duplicating helper bodies at every call site.
            return {
                "helper_name": self.helper_name,
                "args": self.args,
            }

        @override
        def to_dict(self) -> dict[str, Any]:
            """Returns a JSON compatible dict representation of this resolved helper call.

            This outputs the format expected by the frontend, matching the AST exporter format.
            Empty 'options' and 'args' are omitted.

            Uses _original_ast_type to encode the helper source and expansion behavior:
            - "rb_defined_helper": has body_rule or helper_func, skip all expansion
            - "rb_helper": Rule Builder native, skip pattern expansion only
            """
            # Helpers with a defined body skip all expansion; others skip only pattern expansion
            if self.body_rule is not None or self.helper_func is not None:
                ast_type = "rb_defined_helper"
            else:
                ast_type = "rb_helper"
            result: dict[str, Any] = {
                "rule": self.helper_name,
                "_original_ast_type": ast_type,
            }
            if self.args:
                # Convert args to proper rule format for frontend compatibility
                converted_args: list[Any] = []
                for arg in self.args:
                    if arg is True:
                        # Booleans use True_/False_ rules (required by shapez and others)
                        converted_args.append({"rule": "True_"})
                    elif arg is False:
                        converted_args.append({"rule": "False_"})
                    elif isinstance(arg, (int, float, str)):
                        # Other primitives wrap in Constant
                        converted_args.append({
                            "rule": "Constant",
                            "args": {"value": arg},
                        })
                    elif isinstance(arg, dict):
                        # Already a rule dict
                        converted_args.append(arg)
                    else:
                        # Fallback for other types
                        converted_args.append(arg)
                result["args"] = converted_args
            return result


@dataclasses.dataclass()
class WeightedSum(Rule[TWorld], game="Archipelago"):
    """
    Check if the weighted sum of collected items meets or exceeds a threshold.

    Each item contributes its weight multiplied by the count of that item collected.
    For example, if threshold is 1.0 and items is [("Sword", 0.4), ("Shield", 0.6)],
    then having 1 Sword (0.4) and 1 Shield (0.6) would give 1.0 >= 1.0 = True.
    Having 3 Swords would give 1.2 >= 1.0 = True.

    This is commonly used for star-based progression where multiple powerups
    contribute fractionally toward meeting a score threshold.

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

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"threshold": self.threshold, "items": list(self.items)}

        @override
        def to_dict(self) -> dict[str, Any]:
            """Returns a JSON compatible dict that matches the weighted_sum helper format.

            This outputs the format expected by the frontend JavaScript evaluator.
            """
            return {
                "rule": "weighted_sum",
                "_original_ast_type": "helper",
                "_converted_from_ast": True,
                "args": [
                    {
                        "rule": "Constant",
                        "args": {"value": self.threshold},
                        "_converted_from_ast": True,
                    },
                    {
                        "rule": "Constant",
                        "args": {"value": list(self.items)},
                        "_converted_from_ast": True,
                    }
                ]
            }


@dataclasses.dataclass()
class UniqueCount(Rule[TWorld], game="Archipelago"):
    """
    Check if the count of unique items collected meets or exceeds a threshold.

    Unlike WeightedSum which counts total items (count * weight), this counts
    unique item types only (1 * weight if count > 0, else 0).

    This is used for rules like A Hat in Time's Enemy counter which only
    increments once per enemy type, regardless of how many of that enemy
    are collected.

    Usage:
        rule = UniqueCount(
            threshold=12,
            items=[("Mafia Goon", 1.0), ("Crow", 1.0), ...]
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
        return f"UniqueCount({self.threshold}, [{', '.join(item_strs)}])"

    class Resolved(Rule.Resolved):
        threshold: float
        items: tuple[tuple[str, float], ...]
        skip_cache: ClassVar[bool] = True

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            total = 0.0
            for item_name, weight in self.items:
                count = state.count(item_name, self.player)
                if count > 0:
                    total += weight
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
                    if count > 0:
                        total += weight
                messages.append({
                    "type": "text",
                    "text": f"Unique count: {total:.0f}/{self.threshold:.0f}"
                })
            else:
                messages.append({
                    "type": "text",
                    "text": f"Unique count >= {self.threshold}"
                })
            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            if state is not None:
                total = 0.0
                for item_name, weight in self.items:
                    count = state.count(item_name, self.player)
                    if count > 0:
                        total += weight
                return f"Unique count: {total:.0f}/{self.threshold:.0f}"
            return f"Unique count >= {self.threshold}"

        @override
        def __str__(self) -> str:
            return f"UniqueCount({self.threshold})"

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"threshold": self.threshold, "items": list(self.items)}

        @override
        def to_dict(self) -> dict[str, Any]:
            """Returns a JSON compatible dict that matches the unique_count helper format.

            This outputs the format expected by the frontend JavaScript evaluator.
            """
            return {
                "rule": "unique_count",
                "_original_ast_type": "helper",
                "_converted_from_ast": True,
                "args": [
                    {
                        "rule": "Constant",
                        "args": {"value": self.threshold},
                        "_converted_from_ast": True,
                    },
                    {
                        "rule": "Constant",
                        "args": {"value": list(self.items)},
                        "_converted_from_ast": True,
                    }
                ]
            }


@dataclasses.dataclass()
class OptionValue(Rule[TWorld], game="Archipelago"):
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

    @override
    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "rule": "OptionValue",
            "args": {"option": self.option_name}
        }
        if self.filtered_resolution:
            result["filtered_resolution"] = self.filtered_resolution
        return result

    class Resolved(Rule.Resolved):
        option_name: str
        skip_cache: ClassVar[bool] = True

        def _get_option(self, state: CollectionState) -> Any:
            """Get the raw option object from the world."""
            world = state.multiworld.worlds[self.player]
            return getattr(world.options, self.option_name, None)

        @override
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



# ── Boolean-vs-numeric classification + registry wiring ─────────────────────
# Rule types that produce boolean expressions (as opposed to numeric values).
# Used by world_generator to identify rules that can be used directly in boolean contexts.
# Excludes numeric rules like CountItem, CountFromList, CountGroup, Arithmetic,
# MinValue, MaxValue, WeightedSum, UniqueCount, and OptionValue.
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

# Register these fork-only rule types into the shared DEFAULT_RULES registry so
# RuleWorldMixin.get_rule_class / from_dict dispatch (Phase 3) finds them by
# name alongside the base rules. Only classes defined in THIS module are added.
from . import rules as _rules  # noqa: E402

_rules.DEFAULT_RULES.update({
    _name: _cls
    for _name, _cls in dict(globals()).items()
    if isinstance(_cls, type) and issubclass(_cls, _rules.Rule) and _cls.__module__ == __name__
})
