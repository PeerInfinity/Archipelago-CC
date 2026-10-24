"""
Pins for exporting region-local NESTED helper defs (jakanddaxter's shape).

jakanddaxter's region builders define helpers inside the builder and call them
from location/exit lambdas:

    def build_regions(level_name, world):
        player = world.player
        def can_jump_higher(state: CollectionState, p: int) -> bool:
            return state.has("Double Jump", p) or state.has_all(("Crouch", "Crouch Jump"), p)
        region.add_cell_locations([39], access_rule=lambda state: can_jump_higher(state, player))

The analyzer inlines such a call, then auto-preserves it as a helper reference
(HELPER_INLINE_THRESHOLD = 0) and caches the inlined body for the `helpers` block,
because a nested def is not a module attribute that get_helper_definitions can find.
Before this pin the player parameter's NAME (`p`, not `player`) broke both halves:
the cache refused ("has params ['p']") so the body was never exported, and inside
the body `state.has(item, p)` read `p` as the item COUNT (player 2 -> needs 2).
Players 2+ are used here so that the count defect is visible.
"""

import types

import pytest

from exporter.analyzer import analyze_rule, clear_caches, reset_analyze_rule_counter
from exporter.games.base import GenericGameExportHandler


def _export(rule, player, handler):
    """Analyze one access rule the way the exporter does, then read the helpers block."""
    result = analyze_rule(rule, closure_vars={'player': player}, game_handler=handler, player_context=player)
    helpers = handler.get_helper_definitions(types.SimpleNamespace(player=player, multiworld=None))
    return result, helpers


@pytest.fixture(autouse=True)
def _fresh_caches():
    clear_caches()
    reset_analyze_rule_counter()


def _builder(player):
    """A region builder with a nested `(state, p)` helper, returning its location rule."""
    def can_jump_higher(state, p):
        return (state.has("Double Jump", p)
                or state.has_all(("Crouch", "Crouch Jump"), p))
    return lambda state: can_jump_higher(state, player)


class TestPlayerAliasedNestedDef:
    """Shape 1: nested `def f(state, p)`, called as `f(state, player)` (all 8 jakanddaxter defs)."""

    def test_reference_is_a_helper_and_its_body_is_exported(self):
        handler = GenericGameExportHandler()
        result, helpers = _export(_builder(2), 2, handler)
        assert result == {'type': 'helper', 'name': 'can_jump_higher'}
        assert 'can_jump_higher' in helpers, 'nested helper body missing from the helpers block'

    def test_player_parameter_is_not_read_as_an_item_count(self):
        handler = GenericGameExportHandler()
        _, helpers = _export(_builder(2), 2, handler)
        # Raw analyzer shapes (the generic handler does not expand has_all); the
        # point is that neither call carries the player: no `count` 2, no trailing arg.
        assert helpers['can_jump_higher'] == {'type': 'or', 'conditions': [
            {'type': 'item_check', 'item': 'Double Jump'},
            {'type': 'state_method', 'method': 'has_all', 'args': [
                {'type': 'tuple', 'elements': [
                    {'type': 'constant', 'value': 'Crouch'},
                    {'type': 'constant', 'value': 'Crouch Jump'},
                ]},
            ]},
        ]}

    def test_exported_body_takes_no_params(self):
        """The call site drops the player, so the body must not declare `p` as a param."""
        handler = GenericGameExportHandler()
        _, helpers = _export(_builder(3), 3, handler)
        assert 'params' not in helpers['can_jump_higher']


class TestBuilderLocalsAreBound:
    """Shape 2: the nested def also closes over a builder local. The export binds it
    the way the inlined body sees it: the closure cell's value at export time,
    folded into the per-player body (the helpers block is per player)."""

    def test_closed_over_builder_local_is_folded_into_the_body(self):
        def build(player, cells_needed):
            def has_enough_cells(state, p):
                return state.has("Power Cell", p, cells_needed)
            return lambda state: has_enough_cells(state, player)

        handler = GenericGameExportHandler()
        result, helpers = _export(build(2, 72), 2, handler)
        assert result == {'type': 'helper', 'name': 'has_enough_cells'}
        assert helpers['has_enough_cells'] == {'type': 'item_check', 'item': 'Power Cell',
                                               'count': {'type': 'constant', 'value': 72}}


class TestSameNameInTwoBuilders:
    """Shape 3: two builders define a nested helper under the SAME name
    (jakanddaxter: `can_jump_farther` in Boggy Swamp and Gol and Maia's Citadel)."""

    @staticmethod
    def _farther(items):
        def build(player):
            def can_jump_farther(state, p):
                return state.has_any(items, p)
            return lambda state: can_jump_farther(state, player)
        return build

    # Each test holds its rules in locals: the analyzer caches closures by id(),
    # and the exporter's regions keep every rule alive, so a collected rule whose
    # id is reused would be an artifact of the test, not of an export.
    def test_identical_bodies_share_one_helper(self):
        handler = GenericGameExportHandler()
        rule_a = self._farther(("Double Jump", "Jump Kick"))(2)
        rule_b = self._farther(("Double Jump", "Jump Kick"))(2)
        first, _ = _export(rule_a, 2, handler)
        second, helpers = _export(rule_b, 2, handler)
        assert first == second == {'type': 'helper', 'name': 'can_jump_farther'}
        assert 'can_jump_farther' in helpers

    def test_a_different_body_is_inlined_not_overwritten(self):
        handler = GenericGameExportHandler()
        rule_a = self._farther(("Double Jump", "Jump Kick"))(2)
        rule_b = self._farther(("Roll", "Roll Jump"))(2)
        first, _ = _export(rule_a, 2, handler)
        second, helpers = _export(rule_b, 2, handler)
        assert first == {'type': 'helper', 'name': 'can_jump_farther'}
        # The shared name keeps the FIRST body; the second call site carries its own.
        assert helpers['can_jump_farther'] == {'type': 'state_method', 'method': 'has_any', 'args': [
            {'type': 'constant', 'value': ['Double Jump', 'Jump Kick']}]}
        assert second.get('type') != 'helper'
        assert 'Roll' in repr(second) and 'Double Jump' not in repr(second)

