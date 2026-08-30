"""Targeted regression guards for the rule_builder constructs this world exists
to exercise. The full export→frontend round-trip is covered by the in-app spoiler
test; these are fast Python-side checks for the two fixes the world surfaced:
custom-rule arg serialization and OptionValue arg serialization.
"""

from test.bases import WorldTestBase

from rule_builder import OptionValue

from ..custom_rules import HasTreasure


class RuleBuilderTestBase(WorldTestBase):
    game = "Rule Builder Test"

    def test_all_gates_satisfiable(self) -> None:
        """With every item collected, all feature gates open and the goal is met.

        Proves the rule graph has a solution (fill-beatability itself is covered by
        the general test suite). Guards against a rule that can never be satisfied.
        """
        state = self.multiworld.get_all_state(False)
        self.assertTrue(self.multiworld.completion_condition[self.player](state))
        unreachable = [loc.name for loc in self.multiworld.get_locations(self.player)
                       if loc.address is not None and not loc.can_reach(state)]
        self.assertEqual(unreachable, [])

    def test_optionvalue_resolved_roundtrips(self) -> None:
        """A resolved OptionValue must serialize its option name.

        Regression: OptionValue.Resolved previously had no _get_args_dict override,
        so the resolved rule serialized to a bare {"rule": "OptionValue"} and the
        frontend could not evaluate it.
        """
        resolved = OptionValue("hard_mode")._instantiate(self.world)
        self.assertEqual(
            resolved.to_dict(),
            {"rule": "OptionValue", "args": {"option": "hard_mode"}},
        )

    def test_custom_rule_resolved_roundtrips(self) -> None:
        """A resolved custom Rule subclass must serialize its dataclass fields.

        Regression: the base Resolved._get_args_dict now auto-emits a custom
        rule's fields, so HasTreasure(count=2) carries its count to rules.json.
        """
        resolved = HasTreasure(count=2)._instantiate(self.world)
        self.assertEqual(
            resolved.to_dict(),
            {"rule": "HasTreasure", "args": {"count": 2}},
        )
