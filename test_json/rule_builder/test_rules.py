"""
Tests for Rule Builder core rule types.

This module tests the Rule classes including Has, HasAll, HasAny, And, Or, etc.
"""

import pytest

from rule_builder import (
    RuleWorldMixin,
    True_, False_, Has, HasAll, HasAny, And, Or, Not, AtLeast,
    CanReachRegion, CanReachLocation, CanReachEntrance,
    HasGroup, HasAllCounts, HasAnyCount,
    Compare, Arithmetic, Conditional, CountItem, HelperCall,
)


class _StubWorld(RuleWorldMixin):
    """Minimal world stub carrying a `game` attribute for from_dict tests.

    `Rule.from_dict` reads `world_cls.game` (to resolve any FieldResolver args),
    so `None` can no longer be passed as a stand-in world class.
    """
    game = "Archipelago"


class TestBooleanConstants:
    """Tests for True_ and False_ rule classes."""

    def test_true_rule_to_dict(self):
        """Test serializing True_ rule."""
        rule = True_()
        result = rule.to_dict()

        assert result.get("rule") == "True_"

    def test_false_rule_to_dict(self):
        """Test serializing False_ rule."""
        rule = False_()
        result = rule.to_dict()

        assert result.get("rule") == "False_"

    def test_true_rule_from_dict(self):
        """Test deserializing True_ rule."""
        data = {"rule": "True_", "options": [], "args": {}}
        rule = True_.from_dict(data, _StubWorld)

        assert isinstance(rule, True_)

    def test_false_rule_from_dict(self):
        """Test deserializing False_ rule."""
        data = {"rule": "False_", "options": [], "args": {}}
        rule = False_.from_dict(data, _StubWorld)

        assert isinstance(rule, False_)


class TestHasRule:
    """Tests for the Has rule class."""

    def test_has_to_dict(self):
        """Test serializing Has rule."""
        rule = Has(item_name="Sword")
        result = rule.to_dict()

        assert result.get("rule") == "Has"
        assert result.get("args", {}).get("item_name") == "Sword"

    def test_has_with_count_to_dict(self):
        """Test serializing Has rule with count."""
        rule = Has(item_name="Key", count=5)
        result = rule.to_dict()

        assert result.get("rule") == "Has"
        assert result.get("args", {}).get("item_name") == "Key"
        assert result.get("args", {}).get("count") == 5

    def test_has_from_dict(self):
        """Test deserializing Has rule."""
        data = {"rule": "Has", "options": [], "args": {"item_name": "Sword", "count": 1}}
        rule = Has.from_dict(data, _StubWorld)

        assert isinstance(rule, Has)
        assert rule.item_name == "Sword"

    def test_has_and_operator(self):
        """Test combining Has rules with & operator."""
        rule1 = Has(item_name="A")
        rule2 = Has(item_name="B")
        combined = rule1 & rule2

        assert isinstance(combined, And)

    def test_has_or_operator(self):
        """Test combining Has rules with | operator."""
        rule1 = Has(item_name="A")
        rule2 = Has(item_name="B")
        combined = rule1 | rule2

        assert isinstance(combined, Or)


class TestHasAllRule:
    """Tests for the HasAll rule class."""

    def test_has_all_to_dict(self):
        """Test serializing HasAll rule."""
        rule = HasAll("Sword", "Shield", "Bow")
        result = rule.to_dict()

        assert result.get("rule") == "HasAll"

    def test_has_all_from_dict(self):
        """Test deserializing HasAll rule."""
        data = {
            "rule": "HasAll",
            "options": [],
            "args": {"item_names": ["A", "B", "C"]}
        }
        rule = HasAll.from_dict(data, _StubWorld)

        assert isinstance(rule, HasAll)


class TestHasAnyRule:
    """Tests for the HasAny rule class."""

    def test_has_any_to_dict(self):
        """Test serializing HasAny rule."""
        rule = HasAny("Sword", "Axe", "Mace")
        result = rule.to_dict()

        assert result.get("rule") == "HasAny"

    def test_has_any_from_dict(self):
        """Test deserializing HasAny rule."""
        data = {
            "rule": "HasAny",
            "options": [],
            "args": {"item_names": ["A", "B"]}
        }
        rule = HasAny.from_dict(data, _StubWorld)

        assert isinstance(rule, HasAny)


class TestAndRule:
    """Tests for the And rule class."""

    def test_and_to_dict(self):
        """Test serializing And rule."""
        rule = And(Has(item_name="A"), Has(item_name="B"))
        result = rule.to_dict()

        assert result.get("rule") == "And"
        # Nested rules put children at top level, not in args
        assert "children" in result

    def test_and_from_dict(self):
        """Test deserializing And rule."""
        # Create a mock world class with rule_from_dict method
        class MockWorldClass:
            @staticmethod
            def rule_from_dict(data):
                from rule_builder import Has
                if data.get("rule") == "Has":
                    return Has(**data.get("args", {}))
                return None

        data = {
            "rule": "And",
            "children": [
                {"rule": "Has", "args": {"item_name": "A"}},
                {"rule": "Has", "args": {"item_name": "B"}}
            ]
        }
        rule = And.from_dict(data, MockWorldClass)

        assert isinstance(rule, And)

    def test_and_empty(self):
        """Test And with no children."""
        rule = And()
        result = rule.to_dict()

        assert result.get("rule") == "And"

    def test_and_single_child(self):
        """Test And with single child."""
        rule = And(Has(item_name="A"))
        result = rule.to_dict()

        assert result.get("rule") == "And"

    def test_and_flattening(self):
        """Test that nested Ands are flattened."""
        inner = And(Has(item_name="A"), Has(item_name="B"))
        outer = And(inner, Has(item_name="C"))

        # The outer And should potentially flatten the inner And


class TestOrRule:
    """Tests for the Or rule class."""

    def test_or_to_dict(self):
        """Test serializing Or rule."""
        rule = Or(Has(item_name="A"), Has(item_name="B"))
        result = rule.to_dict()

        assert result.get("rule") == "Or"
        # Nested rules put children at top level, not in args
        assert "children" in result

    def test_or_from_dict(self):
        """Test deserializing Or rule."""
        # Create a mock world class with rule_from_dict method
        class MockWorldClass:
            @staticmethod
            def rule_from_dict(data):
                from rule_builder import Has
                if data.get("rule") == "Has":
                    return Has(**data.get("args", {}))
                return None

        data = {
            "rule": "Or",
            "children": [
                {"rule": "Has", "args": {"item_name": "A"}},
                {"rule": "Has", "args": {"item_name": "B"}}
            ]
        }
        rule = Or.from_dict(data, MockWorldClass)

        assert isinstance(rule, Or)

    def test_or_empty(self):
        """Test Or with no children."""
        rule = Or()
        result = rule.to_dict()

        assert result.get("rule") == "Or"


class TestNotRule:
    """Tests for the Not rule class."""

    def test_not_to_dict(self):
        """Test serializing Not rule."""
        rule = Not(child=Has(item_name="Curse"))
        result = rule.to_dict()

        assert result.get("rule") == "Not"

    def test_not_from_dict(self):
        """Test deserializing Not rule."""
        # Create a mock world class with rule_from_dict method
        class MockWorldClass:
            @staticmethod
            def rule_from_dict(data):
                from rule_builder import Has
                if data.get("rule") == "Has":
                    return Has(**data.get("args", {}))
                return None

        data = {
            "rule": "Not",
            "child": {"rule": "Has", "args": {"item_name": "A"}}
        }
        rule = Not.from_dict(data, MockWorldClass)

        assert isinstance(rule, Not)

    def test_double_negation(self):
        """Test double negation behavior."""
        inner = Has(item_name="A")
        not1 = Not(child=inner)
        not2 = Not(child=not1)

        # Double negation should be representable


class TestReachabilityRules:
    """Tests for reachability rule classes."""

    def test_can_reach_region_to_dict(self):
        """Test serializing CanReachRegion rule."""
        rule = CanReachRegion(region_name="Castle")
        result = rule.to_dict()

        assert result.get("rule") == "CanReachRegion"
        assert result.get("args", {}).get("region_name") == "Castle"

    def test_can_reach_region_from_dict(self):
        """Test deserializing CanReachRegion rule."""
        data = {
            "rule": "CanReachRegion",
            "options": [],
            "args": {"region_name": "Castle"}
        }
        rule = CanReachRegion.from_dict(data, _StubWorld)

        assert isinstance(rule, CanReachRegion)
        assert rule.region_name == "Castle"

    def test_can_reach_location_to_dict(self):
        """Test serializing CanReachLocation rule."""
        rule = CanReachLocation(location_name="Chest")
        result = rule.to_dict()

        assert result.get("rule") == "CanReachLocation"

    def test_can_reach_entrance_to_dict(self):
        """Test serializing CanReachEntrance rule."""
        rule = CanReachEntrance(entrance_name="Door")
        result = rule.to_dict()

        assert result.get("rule") == "CanReachEntrance"


class TestGroupRules:
    """Tests for group-related rule classes."""

    def test_has_group_to_dict(self):
        """Test serializing HasGroup rule."""
        rule = HasGroup(item_name_group="Swords", count=1)
        result = rule.to_dict()

        assert result.get("rule") == "HasGroup"


class TestCompareRule:
    """Tests for the Compare rule class."""

    def test_compare_greater_than_to_dict(self):
        """Test serializing Compare rule with >."""
        rule = Compare(left=CountItem(item_name="Key"), op=">", right=5)
        result = rule.to_dict()

        assert result.get("rule") == "Compare"

    def test_compare_greater_equal_to_dict(self):
        """Test serializing Compare rule with >=."""
        rule = Compare(left=CountItem(item_name="Key"), op=">=", right=3)
        result = rule.to_dict()

        assert result.get("rule") == "Compare"

    def test_compare_equals_to_dict(self):
        """Test serializing Compare rule with ==."""
        rule = Compare(left=CountItem(item_name="Key"), op="==", right=5)
        result = rule.to_dict()

        assert result.get("rule") == "Compare"


class TestArithmeticRule:
    """Tests for the Arithmetic rule class."""

    def test_arithmetic_add_to_dict(self):
        """Test serializing Arithmetic rule with +."""
        rule = Arithmetic(left=CountItem(item_name="A"), op="+", right=CountItem(item_name="B"))
        result = rule.to_dict()

        assert result.get("rule") == "Arithmetic"

    def test_arithmetic_multiply_to_dict(self):
        """Test serializing Arithmetic rule with *."""
        rule = Arithmetic(left=CountItem(item_name="Key"), op="*", right=2)
        result = rule.to_dict()

        assert result.get("rule") == "Arithmetic"


class TestConditionalRule:
    """Tests for the Conditional rule class."""

    def test_conditional_to_dict(self):
        """Test serializing Conditional rule."""
        rule = Conditional(
            test=Has(item_name="B"),
            if_true=Has(item_name="A"),
            if_false=Has(item_name="C")
        )
        result = rule.to_dict()

        assert result.get("rule") == "Conditional"


class TestCountItemRule:
    """Tests for the CountItem rule class."""

    def test_count_item_to_dict(self):
        """Test serializing CountItem rule."""
        rule = CountItem(item_name="Arrow")
        result = rule.to_dict()

        assert result.get("rule") == "CountItem"
        assert result.get("args", {}).get("item_name") == "Arrow"


class TestHelperCallRule:
    """Tests for the HelperCall rule class."""

    def test_helper_call_to_dict(self):
        """Test serializing HelperCall rule."""
        rule = HelperCall(helper_name="can_fight", args=[])
        result = rule.to_dict()

        # HelperCall uses helper name as rule, not "HelperCall" (for frontend compatibility)
        assert result.get("rule") == "can_fight"
        assert result.get("_original_ast_type") == "helper"

    def test_helper_call_with_args_to_dict(self):
        """Test serializing HelperCall with arguments."""
        rule = HelperCall(
            helper_name="check_item",
            args=["Sword"]  # Args should be simple values, not Rules
        )
        result = rule.to_dict()

        # HelperCall uses helper name as rule, not "HelperCall" (for frontend compatibility)
        assert result.get("rule") == "check_item"
        assert result.get("_original_ast_type") == "helper"

    def test_helper_call_without_body_has_no_rb_flags(self):
        """Test that HelperCall without body omits legacy _rb_helper flags."""
        rule = HelperCall(helper_name="can_fight", args=[])
        result = rule.to_dict()

        assert "_rb_helper" not in result
        assert "_rb_helper_defined" not in result

    def test_helper_call_with_body_rule_to_dict(self):
        """Test that HelperCall with body_rule produces rb_defined_helper type."""
        rule = HelperCall(
            helper_name="can_swim",
            body_rule=Has("Flippers"),
        )
        result = rule.to_dict()

        assert result.get("rule") == "can_swim"
        assert result.get("_original_ast_type") == "rb_defined_helper"
        assert "_rb_helper" not in result
        assert "_rb_helper_defined" not in result

    def test_helper_call_with_helper_func_to_dict(self):
        """Test that HelperCall with helper_func produces rb_defined_helper type."""
        rule = HelperCall(
            helper_name="can_swim",
            helper_func=lambda state, player: True,
        )
        result = rule.to_dict()

        assert result.get("rule") == "can_swim"
        assert result.get("_original_ast_type") == "rb_defined_helper"
        assert "_rb_helper" not in result
        assert "_rb_helper_defined" not in result


class TestHelperCallResolvedToDict:
    """Tests for HelperCall.Resolved.to_dict() _original_ast_type values."""

    def test_resolved_without_body_produces_rb_helper(self):
        """Resolved helper without body_rule/helper_func produces rb_helper type."""
        resolved = HelperCall.Resolved(
            helper_func=None,
            helper_name="can_fight",
            args=(),
            kwargs={},
            body_rule=None,
            body_data=None,
            player=1,
            caching_enabled=False,
        )
        result = resolved.to_dict()

        assert result.get("rule") == "can_fight"
        assert result.get("_original_ast_type") == "rb_helper"
        assert "_rb_helper" not in result
        assert "_rb_helper_defined" not in result

    def test_resolved_with_body_rule_produces_rb_defined_helper(self):
        """Resolved helper with body_rule produces rb_defined_helper type."""
        body = Has("Flippers")
        # Resolved body_rule needs a Resolved rule, but to_dict() only checks `is not None`
        resolved = HelperCall.Resolved(
            helper_func=None,
            helper_name="can_swim",
            args=(),
            kwargs={},
            body_rule=body,  # Not truly resolved, but to_dict() only checks `is not None`
            body_data=None,
            player=1,
            caching_enabled=False,
        )
        result = resolved.to_dict()

        assert result.get("rule") == "can_swim"
        assert result.get("_original_ast_type") == "rb_defined_helper"
        assert "_rb_helper" not in result
        assert "_rb_helper_defined" not in result

    def test_resolved_with_helper_func_produces_rb_defined_helper(self):
        """Resolved helper with helper_func produces rb_defined_helper type."""
        resolved = HelperCall.Resolved(
            helper_func=lambda state, player: True,
            helper_name="can_swim",
            args=(),
            kwargs={},
            body_rule=None,
            body_data=None,
            player=1,
            caching_enabled=False,
        )
        result = resolved.to_dict()

        assert result.get("rule") == "can_swim"
        assert result.get("_original_ast_type") == "rb_defined_helper"
        assert "_rb_helper" not in result
        assert "_rb_helper_defined" not in result


class TestRuleOperatorComposition:
    """Tests for composing rules with operators."""

    def test_chain_and(self):
        """Test chaining multiple rules with &."""
        rule = Has("A") & Has("B") & Has("C")

        # Should produce a single And with all children
        assert isinstance(rule, And)

    def test_chain_or(self):
        """Test chaining multiple rules with |."""
        rule = Has("A") | Has("B") | Has("C")

        # Should produce a single Or with all children
        assert isinstance(rule, Or)

    def test_mixed_and_or(self):
        """Test mixing & and | operators."""
        rule = (Has("A") & Has("B")) | Has("C")

        assert isinstance(rule, Or)

    def test_complex_composition(self):
        """Test complex rule composition."""
        rule = (Has("A") & Has("B")) | (Has("C") & Has("D"))

        assert isinstance(rule, Or)


class TestResolvedToDictArgs:
    """Regression guard: a resolved rule's to_dict() must preserve its args.

    The exporter serializes *resolved* access rules via Resolved.to_dict()
    (which delegates to each rule's _get_args_dict()) to produce rules.json,
    which world_generator and the frontend then consume. If a rule omits its
    _get_args_dict() override, the args silently vanish — e.g. CanReachRegion
    serializes to `{"rule": "CanReachRegion"}` with no region_name, and the
    round-trip through world_generator produces CanReachRegion('') -> KeyError.
    See the rule_builder upstream re-base regression (worldgen2 failures).
    """

    @pytest.mark.parametrize("resolved, expected_args", [
        (CanReachRegion.Resolved(region_name="Castle", player=1),
         {"region_name": "Castle"}),
        (CanReachLocation.Resolved(location_name="Loc", parent_region_name="R", player=1),
         {"location_name": "Loc"}),
        (CanReachEntrance.Resolved(entrance_name="E", parent_region_name="R", player=1),
         {"entrance_name": "E"}),
        (HasAll.Resolved(item_names=("A", "B"), player=1),
         {"item_names": ["A", "B"]}),
        (HasAny.Resolved(item_names=("A", "B"), player=1),
         {"item_names": ["A", "B"]}),
        (HasGroup.Resolved(item_name_group="G", item_names=("A",), count=2, player=1),
         {"item_name_group": "G", "count": 2}),
        (HasAllCounts.Resolved(item_counts=(("A", 2), ("B", 3)), player=1),
         {"item_counts": {"A": 2, "B": 3}}),
        (HasAnyCount.Resolved(item_counts=(("A", 2),), player=1),
         {"item_counts": {"A": 2}}),
    ])
    def test_resolved_to_dict_preserves_args(self, resolved, expected_args):
        result = resolved.to_dict()
        assert result["args"] == expected_args, (
            f"{type(resolved).__qualname__}.to_dict() dropped/altered args: "
            f"{result.get('args')!r} != {expected_args!r}"
        )


class TestNestedResolvedToDict:
    """Regression guard: a resolved And/Or must serialize its children.

    NestedRule.Resolved.to_dict() emits {"rule": ..., "children": [...]} instead
    of args. Without that override the base Resolved.to_dict() emits an argless
    `{"rule": "Or"}`, which world_generator reads as an empty Or -> False_() (or
    empty And -> True_()), silently making locations permanently unreachable ->
    worldgen2 "Could not access required locations" FillError. See the
    rule_builder upstream re-base regression (worldgen2 failures).
    """

    @pytest.mark.parametrize("rule_cls", [And, Or])
    def test_nested_resolved_to_dict_serializes_children(self, rule_cls):
        children = (
            Has.Resolved(item_name="Sword", count=1, player=1),
            CanReachRegion.Resolved(region_name="Castle", player=1),
        )
        resolved = rule_cls.Resolved(children, player=1)
        result = resolved.to_dict()
        assert result["rule"] == rule_cls.__name__
        assert result.get("children") == [c.to_dict() for c in children], (
            f"{rule_cls.__name__}.Resolved.to_dict() dropped children: "
            f"{result.get('children')!r}"
        )

    def test_atleast_resolved_to_dict_serializes_children_and_count(self):
        # AtLeast also carries a count; its resolved to_dict() must keep both.
        children = (
            Has.Resolved(item_name="Sword", count=1, player=1),
            Has.Resolved(item_name="Shield", count=1, player=1),
            CanReachRegion.Resolved(region_name="Castle", player=1),
        )
        resolved = AtLeast.Resolved(children, count=2, player=1)
        result = resolved.to_dict()
        assert result["rule"] == "AtLeast"
        assert result.get("count") == 2
        assert result.get("children") == [c.to_dict() for c in children]
