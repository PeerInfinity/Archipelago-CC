"""Tests for serializing Rule Builder rules from a *foreign* (vendored upstream) rule_builder.

The synthetic rules below are built with plain ``dataclasses`` and a ``rule_name``
classvar - exactly what upstream's CustomRuleRegister produces - and deliberately
do NOT import this fork's ``rule_builder`` package, because a vendored copy is a
different module object and duck-typing is the whole contract under test.
"""

import dataclasses
import logging
from enum import Enum
from typing import Any, ClassVar, Optional, Tuple

import pytest

from exporter.foreign_rule_builder import (
    ForeignRuleSerializationError,
    is_foreign_resolved_rule,
    serialize_foreign_resolved_rule,
)


def foreign_resolved(rule_name: str):
    """Decorator mimicking upstream's CustomRuleRegister: frozen dataclass + rule_name."""
    def wrap(cls):
        cls.rule_name = rule_name
        return dataclasses.dataclass(frozen=True)(cls)
    return wrap


@foreign_resolved("Has")
class ForeignHas:
    item_name: str = ""
    count: int = 1
    player: int = 1
    caching_enabled: bool = False


@foreign_resolved("HasAll")
class ForeignHasAll:
    item_names: Tuple[str, ...] = ()
    player: int = 1
    caching_enabled: bool = False


@foreign_resolved("HasAllCounts")
class ForeignHasAllCounts:
    item_counts: Tuple[Tuple[str, int], ...] = ()
    player: int = 1
    caching_enabled: bool = False


@foreign_resolved("HasGroup")
class ForeignHasGroup:
    item_name_group: str = ""
    item_names: Tuple[str, ...] = ()
    count: int = 1
    player: int = 1
    caching_enabled: bool = False


@foreign_resolved("CanReachLocation")
class ForeignCanReachLocation:
    location_name: str = ""
    parent_region_name: str = ""
    player: int = 1
    caching_enabled: bool = False


@foreign_resolved("And")
class ForeignAnd:
    children: Tuple[Any, ...] = ()
    player: int = 1
    caching_enabled: bool = False


@foreign_resolved("Or")
class ForeignOr:
    children: Tuple[Any, ...] = ()
    player: int = 1
    caching_enabled: bool = False


@foreign_resolved("AtLeast")
class ForeignAtLeast:
    children: Tuple[Any, ...] = ()
    count: int = 1
    player: int = 1
    caching_enabled: bool = False


@foreign_resolved("CanReachHeight")
class ForeignCanReachHeight:
    """A game-specific custom rule, like SuprAP's CanReachHeight."""
    target_height: int = 1
    player: int = 1
    caching_enabled: bool = False


class ItemName(Enum):
    SWORD = "Progressive Sword"
    CUBE = "Progressive Cube"


@foreign_resolved("NeedsGear")
class ForeignEnumRule:
    item: ItemName = ItemName.SWORD
    player: int = 1
    caching_enabled: bool = False


class Unserializable:
    """Not a scalar, not a rule, not a container."""


@foreign_resolved("Weird")
class ForeignWeirdRule:
    thing: Optional[Unserializable] = None
    player: int = 1
    caching_enabled: bool = False


class ForkStyleRule:
    """An object carrying the fork's own to_dict(); must never enter the fallback."""

    rule_name: ClassVar[str] = "Has"

    def to_dict(self):
        return {"rule": "Has", "args": {"item_name": "Fork Sword"}}


class TestDetection:
    def test_detects_foreign_resolved(self):
        assert is_foreign_resolved_rule(ForeignHas(item_name="Sword"))

    def test_rejects_lambda(self):
        assert not is_foreign_resolved_rule(lambda state: True)

    def test_rejects_none_and_classes(self):
        assert not is_foreign_resolved_rule(None)
        assert not is_foreign_resolved_rule(ForeignHas)

    def test_rejects_plain_dataclass_without_rule_name(self):
        @dataclasses.dataclass
        class NotARule:
            value: int = 1

        assert not is_foreign_resolved_rule(NotARule())

    def test_rejects_objects_with_to_dict(self):
        # The fork's own Resolved objects are handled by the to_dict fast path
        assert not is_foreign_resolved_rule(ForkStyleRule())


class TestLeafRules:
    def test_has_omits_count_of_one(self):
        result = serialize_foreign_resolved_rule(ForeignHas(item_name="Sword"))
        assert result == {"rule": "Has", "args": {"item_name": "Sword"}}

    def test_has_keeps_count_above_one(self):
        result = serialize_foreign_resolved_rule(ForeignHas(item_name="Beam", count=3))
        assert result == {"rule": "Has", "args": {"item_name": "Beam", "count": 3}}

    def test_bookkeeping_fields_excluded(self):
        result = serialize_foreign_resolved_rule(ForeignHas(item_name="Sword", player=7, caching_enabled=True))
        assert "player" not in result["args"]
        assert "caching_enabled" not in result["args"]

    def test_tuple_field_becomes_list(self):
        result = serialize_foreign_resolved_rule(ForeignHasAll(item_names=("A", "B")))
        assert result == {"rule": "HasAll", "args": {"item_names": ["A", "B"]}}

    def test_item_counts_become_mapping(self):
        result = serialize_foreign_resolved_rule(ForeignHasAllCounts(item_counts=(("A", 2), ("B", 3))))
        assert result == {"rule": "HasAllCounts", "args": {"item_counts": {"A": 2, "B": 3}}}

    def test_resolution_bookkeeping_fields_dropped_for_base_rules(self):
        group = ForeignHasGroup(item_name_group="Weapons", item_names=("A", "B"), count=2)
        result = serialize_foreign_resolved_rule(group)
        assert result == {"rule": "HasGroup", "args": {"item_name_group": "Weapons", "count": 2}}

        location = ForeignCanReachLocation(location_name="Chest", parent_region_name="Cave")
        assert serialize_foreign_resolved_rule(location) == {
            "rule": "CanReachLocation",
            "args": {"location_name": "Chest"},
        }

    def test_custom_rule_auto_serializes_its_fields(self):
        result = serialize_foreign_resolved_rule(ForeignCanReachHeight(target_height=4))
        assert result == {"rule": "CanReachHeight", "args": {"target_height": 4}}

    def test_enum_field_serializes_to_its_value(self):
        result = serialize_foreign_resolved_rule(ForeignEnumRule(item=ItemName.CUBE))
        assert result == {"rule": "NeedsGear", "args": {"item": "Progressive Cube"}}


class TestNestedRules:
    def test_nested_and_or_tree(self):
        rule = ForeignAnd(children=(
            ForeignHasAll(item_names=("Strong", "ProgSword")),
            ForeignOr(children=(
                ForeignCanReachHeight(target_height=4),
                ForeignHas(item_name="Buckle"),
            )),
        ))
        assert serialize_foreign_resolved_rule(rule) == {
            "rule": "And",
            "children": [
                {"rule": "HasAll", "args": {"item_names": ["Strong", "ProgSword"]}},
                {
                    "rule": "Or",
                    "children": [
                        {"rule": "CanReachHeight", "args": {"target_height": 4}},
                        {"rule": "Has", "args": {"item_name": "Buckle"}},
                    ],
                },
            ],
        }

    def test_empty_children_still_emitted(self):
        assert serialize_foreign_resolved_rule(ForeignAnd()) == {"rule": "And", "children": []}

    def test_at_least_emits_count_beside_children(self):
        rule = ForeignAtLeast(children=(ForeignHas(item_name="A"), ForeignHas(item_name="B")), count=2)
        assert serialize_foreign_resolved_rule(rule) == {
            "rule": "AtLeast",
            "count": 2,
            "children": [
                {"rule": "Has", "args": {"item_name": "A"}},
                {"rule": "Has", "args": {"item_name": "B"}},
            ],
        }

    def test_nested_rule_as_a_custom_rule_arg(self):
        @foreign_resolved("Wrapped")
        class ForeignWrapper:
            child: Any = None
            player: int = 1
            caching_enabled: bool = False

        result = serialize_foreign_resolved_rule(ForeignWrapper(child=ForeignHas(item_name="Sword")))
        assert result == {
            "rule": "Wrapped",
            "args": {"child": {"rule": "Has", "args": {"item_name": "Sword"}}},
        }


class TestSoftFailure:
    def test_unknown_field_type_raises(self):
        with pytest.raises(ForeignRuleSerializationError):
            serialize_foreign_resolved_rule(ForeignWeirdRule(thing=Unserializable()))

    def test_unknown_field_type_inside_a_tree_raises(self):
        rule = ForeignAnd(children=(ForeignWeirdRule(thing=Unserializable()),))
        with pytest.raises(ForeignRuleSerializationError):
            serialize_foreign_resolved_rule(rule)


class TestExporterIntegration:
    """The fallback must sit between the to_dict fast path and AST analysis."""

    def test_fork_to_dict_is_preferred(self):
        obj = ForkStyleRule()
        assert not is_foreign_resolved_rule(obj)
        assert obj.to_dict() == {"rule": "Has", "args": {"item_name": "Fork Sword"}}

    def test_lambda_is_not_claimed_by_the_fallback(self):
        def rule(state):
            return state.has("Sword", 1)

        assert not is_foreign_resolved_rule(rule)

    def test_warning_is_logged_once_per_bad_rule(self, caplog):
        with caplog.at_level(logging.WARNING):
            try:
                serialize_foreign_resolved_rule(ForeignWeirdRule(thing=Unserializable()))
            except ForeignRuleSerializationError as exc:
                assert "Unserializable" in str(exc)
