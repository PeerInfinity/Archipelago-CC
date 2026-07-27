"""Serialization for Rule Builder ``Resolved`` rules that come from a *foreign* Rule Builder.

Third-party apworlds (first seen: SuprAP) vendor the upstream ``rule_builder``
package inside their own apworld. Their resolved access rules are frozen
dataclass instances that look exactly like this fork's ``Rule.Resolved``
objects, but upstream ``Resolved`` has no ``to_dict()`` - that serializer is a
fork-only addition. Without this module those rules fall through to AST source
analysis, where ``inspect.getfile()`` on a dataclass instance raises and every
location/exit exports ``"access_rule": null``.

Detection and serialization are deliberately duck-typed: a vendored copy of
``rule_builder`` is a different module object, so ``isinstance`` against this
fork's classes can never match a foreign rule.

The output shape mirrors ``rule_builder/rules.py`` exactly
(``Rule.Resolved.to_dict`` / ``_get_args_dict`` at ~line 334 and
``NestedRule.Resolved.to_dict`` at ~line 517), so downstream consumers - the
frontend rule evaluator, ``frontend/schema/rules.schema.json`` and the
world_generator round-trip - see the structure they already handle:

    {"rule": "Has", "args": {"item_name": "Sword", "count": 2}}
    {"rule": "And", "children": [...]}
"""

import dataclasses
import logging
from collections.abc import Mapping
from enum import Enum
from typing import Any, Dict, Tuple

logger = logging.getLogger(__name__)

# Fields every Resolved rule carries for bookkeeping; the fork's _get_args_dict
# excludes these from the exported args.
BOOKKEEPING_FIELDS = frozenset({"player", "caching_enabled"})

# Arg keys emitted per base (Archipelago) rule, mirroring the _get_args_dict
# overrides in rule_builder/rules.py. Upstream Resolved rules carry extra
# resolution bookkeeping (HasGroup.item_names, CanReachLocation.parent_region_name,
# ...) that the fork deliberately keeps out of rules.json, so base rules use this
# whitelist instead of "every dataclass field". Rule names absent from this table
# are treated as game-specific custom rules and auto-serialize their own fields,
# which is what the fork's default _get_args_dict does for custom rules.
_BASE_RULE_ARGS: Dict[str, Tuple[str, ...]] = {
    "True_": (),
    "False_": (),
    "And": (),
    "Or": (),
    "AtLeast": (),  # "count" is emitted at the top level, like the fork's AtLeast.Resolved
    "WrapperRule": (),
    "Filtered": (),
    "Has": ("item_name", "count"),
    "HasAll": ("item_names",),
    "HasAny": ("item_names",),
    "HasAllCounts": ("item_counts",),
    "HasAnyCount": ("item_counts",),
    "HasFromList": ("item_names", "count"),
    "HasFromListUnique": ("item_names", "count"),
    "HasGroup": ("item_name_group", "count"),
    "HasGroupUnique": ("item_name_group", "count"),
    "CanReachLocation": ("location_name",),
    "CanReachRegion": ("region_name",),
    "CanReachEntrance": ("entrance_name",),
}

# Rules whose resolved form serializes "count" next to "children" instead of
# inside "args" (see AtLeast.Resolved.to_dict in rule_builder/rules.py).
_TOP_LEVEL_COUNT_RULES = frozenset({"AtLeast"})

_SCALAR_TYPES = (str, bool, int, float)

_MAX_DEPTH = 200


class ForeignRuleSerializationError(Exception):
    """A foreign Resolved rule held a value we cannot safely serialize."""


def get_rule_name(rule_obj: Any) -> str:
    """Returns the rule name for a Resolved rule object.

    Upstream's CustomRuleRegister metaclass sets a ``rule_name`` classvar to the
    class ``__qualname__`` minus the trailing ``.Resolved``; fall back to
    deriving it the same way if the classvar is missing.
    """
    rule_name = getattr(type(rule_obj), 'rule_name', None)
    if isinstance(rule_name, str) and rule_name:
        return rule_name
    qualname = type(rule_obj).__qualname__
    if qualname.endswith('.Resolved'):
        return qualname[:-len('.Resolved')]
    return qualname


def is_foreign_resolved_rule(rule_obj: Any) -> bool:
    """True if this looks like a Rule Builder Resolved rule from a foreign copy.

    Duck-typed on purpose: a vendored rule_builder is a different module object,
    so isinstance against this fork's Rule.Resolved would never match. Objects
    carrying the fork's own ``to_dict()`` are handled by the fast path in the
    exporter and are explicitly excluded here.
    """
    if rule_obj is None or isinstance(rule_obj, type):
        return False
    if hasattr(rule_obj, 'to_dict') and callable(getattr(rule_obj, 'to_dict')):
        return False
    if not dataclasses.is_dataclass(rule_obj):
        return False
    rule_name = getattr(type(rule_obj), 'rule_name', None)
    return isinstance(rule_name, str) and bool(rule_name)


def serialize_foreign_resolved_rule(rule_obj: Any) -> Dict[str, Any]:
    """Serializes a foreign Resolved rule to the fork's Rule Builder dict shape.

    Raises ForeignRuleSerializationError if any field holds a value we cannot
    represent; callers should treat that as "fall back to the normal path".
    """
    return _serialize_rule(rule_obj, 0)


def _serialize_rule(rule_obj: Any, depth: int) -> Dict[str, Any]:
    if depth > _MAX_DEPTH:
        raise ForeignRuleSerializationError("Rule nesting exceeded the maximum supported depth")

    rule_name = get_rule_name(rule_obj)
    result: Dict[str, Any] = {"rule": rule_name}

    try:
        fields = dataclasses.fields(rule_obj)
    except TypeError as exc:
        raise ForeignRuleSerializationError(f"{rule_name} is not a dataclass instance") from exc

    allowed_args = _BASE_RULE_ARGS.get(rule_name)
    args: Dict[str, Any] = {}

    for field in fields:
        name = field.name
        if name in BOOKKEEPING_FIELDS:
            continue
        try:
            value = getattr(rule_obj, name)
        except AttributeError as exc:
            raise ForeignRuleSerializationError(f"{rule_name} is missing field '{name}'") from exc

        # NestedRule-like rules serialize their children at the top level
        if name == "children" and _is_rule_sequence(value):
            result["children"] = [_serialize_rule(child, depth + 1) for child in value]
            continue
        if name == "count" and rule_name in _TOP_LEVEL_COUNT_RULES:
            result["count"] = _serialize_value(value, depth + 1)
            continue
        if allowed_args is not None and name not in allowed_args:
            continue

        args[name] = _serialize_value(value, depth + 1)

    # Match the fork's per-rule arg conventions
    if rule_name in ("HasAllCounts", "HasAnyCount") and "item_counts" in args:
        args["item_counts"] = _as_count_mapping(args["item_counts"], rule_name)
    if rule_name == "Has" and args.get("count") == 1:
        del args["count"]

    if args:
        result["args"] = args
    return result


def _is_rule_sequence(value: Any) -> bool:
    # An empty tuple counts: NestedRule.Resolved.to_dict() still emits "children": []
    return (
        isinstance(value, (list, tuple))
        and all(is_foreign_resolved_rule(item) for item in value)
    )


def _serialize_value(value: Any, depth: int) -> Any:
    if depth > _MAX_DEPTH:
        raise ForeignRuleSerializationError("Rule nesting exceeded the maximum supported depth")

    if value is None or isinstance(value, _SCALAR_TYPES):
        return value
    if isinstance(value, Enum):
        # SuprAP and friends use enums for item/region names; the frontend wants
        # the underlying string, which is what their own as_str() helper emits.
        inner = value.value
        return inner if isinstance(inner, _SCALAR_TYPES) else value.name
    if hasattr(value, 'to_dict') and callable(getattr(value, 'to_dict')):
        # A rule (or field resolver) from this fork nested inside a foreign tree
        return value.to_dict()
    if is_foreign_resolved_rule(value):
        return _serialize_rule(value, depth + 1)
    if isinstance(value, Mapping):
        return {_serialize_key(key): _serialize_value(item, depth + 1) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialize_value(item, depth + 1) for item in value]
    raise ForeignRuleSerializationError(
        f"Unsupported value of type {type(value).__name__} in a foreign Rule Builder rule"
    )


def _serialize_key(key: Any) -> str:
    if isinstance(key, Enum):
        inner = key.value
        return str(inner) if isinstance(inner, _SCALAR_TYPES) else key.name
    if isinstance(key, _SCALAR_TYPES):
        return str(key)
    raise ForeignRuleSerializationError(
        f"Unsupported mapping key of type {type(key).__name__} in a foreign Rule Builder rule"
    )


def _as_count_mapping(value: Any, rule_name: str) -> Dict[str, Any]:
    """Converts a resolved item_counts value to the mapping the fork exports."""
    if isinstance(value, Mapping):
        return {_serialize_key(key): item for key, item in value.items()}
    if isinstance(value, list):
        try:
            return {_serialize_key(pair[0]): pair[1] for pair in value}
        except (TypeError, IndexError) as exc:
            raise ForeignRuleSerializationError(f"{rule_name} has malformed item_counts") from exc
    raise ForeignRuleSerializationError(f"{rule_name} has an unsupported item_counts value")
