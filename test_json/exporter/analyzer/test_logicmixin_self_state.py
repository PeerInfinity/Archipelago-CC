"""
Pins: inside a LogicMixin method, ``self`` IS the CollectionState (rule-node R2c).

AutoLogicRegister merges a LogicMixin subclass's methods onto CollectionState, so raft's

    class RaftLogic(LogicMixin):
        def raft_can_smelt_items(self, player):
            return self.has("Smelter", player)

is ``state.has("Smelter", player)``. The analyzer treated every ``self.X(...)`` as a helper
call, so raft's 26 ``self.has`` calls exported as ``{type: helper, name: has}`` with the player
dropped: world_generator had no ``has`` helper to generate (strict failure), and the JS read it
only through genericLogic's ``has`` fallback. The mixin's own methods stay helper calls, and a
``self.has`` on a class that is NOT a LogicMixin (soe's logic class defines its own ``has``)
stays a helper too.
"""

import pytest

from exporter.analyzer import analyze_rule, clear_caches, reset_analyze_rule_counter
from exporter.analyzer.ast_visitors.call_visitor import self_is_collection_state


class NotAMixin:
    """A logic class with its own ``has`` (soe's shape): ``self`` is not the state."""

    def has(self, item, player):
        return False

    def can_open(self, player):
        return self.has("Key", player)


@pytest.fixture(autouse=True)
def _fresh_caches():
    clear_caches()
    reset_analyze_rule_counter()


def _analyze(func):
    return analyze_rule(rule_func=func, player_context=1, preserve_parameter_names=True)


def test_a_logicmixin_self_has_is_an_item_check():
    from worlds.raft.Rules import RaftLogic
    assert _analyze(RaftLogic.raft_can_smelt_items) == {'type': 'item_check', 'item': 'Smelter'}


def test_the_mixins_own_methods_stay_helper_calls():
    from worlds.raft.Rules import RaftLogic
    rule = _analyze(RaftLogic.raft_can_craft_bolt)
    assert rule['type'] == 'and'
    assert rule['conditions'][0]['type'] == 'helper'
    assert rule['conditions'][0]['name'] == 'raft_can_smelt_items'
    assert rule['conditions'][1] == {'type': 'item_check', 'item': 'Bolt'}


def test_self_on_a_class_that_is_not_a_logicmixin_stays_a_helper():
    rule = _analyze(NotAMixin.can_open)
    assert rule['type'] == 'helper' and rule['name'] == 'has'


def test_the_predicate():
    from worlds.raft.Rules import RaftLogic
    assert self_is_collection_state(RaftLogic.raft_can_smelt_items, 'has')
    assert self_is_collection_state(RaftLogic.raft_can_smelt_items, 'can_reach')
    # a mixin method merged onto CollectionState is not a CollectionState method
    assert not self_is_collection_state(RaftLogic.raft_can_craft_bolt, 'raft_can_smelt_items')
    assert not self_is_collection_state(NotAMixin.can_open, 'has')

    def nested(self, player):
        return self.has("X", player)
    assert not self_is_collection_state(nested, 'has')
    assert not self_is_collection_state(None, 'has')
