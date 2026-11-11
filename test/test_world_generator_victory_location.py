"""world_generator/_victory_location.py (design-victory-location prototype)."""
import copy

import pytest

from world_generator._victory_location import VictoryLocationError, apply_victory_location


def _doc(cc, goal_item_id=None):
    return {
        'game_info': {'1': {'completion_condition': cc}},
        'items': {'1': {
            'Key': {'name': 'Key', 'id': 10, 'groups': ['Everything']},
            'Victory': {'name': 'Victory', 'id': goal_item_id, 'groups': ['Event'], 'event': True, 'type': 'Event'},
        }},
        'regions': {'1': {
            'Start': {'locations': [{'name': 'Chest', 'id': 100, 'item': {'name': 'Key', 'player': 1}}]},
            'End': {'locations': [{'name': 'Goal', 'id': None, 'locked': True, 'event': True,
                                   'item': {'name': 'Victory', 'player': 1, 'type': 'Event'}}]},
        }},
    }


@pytest.mark.parametrize('cc', [{'type': 'item_check', 'item': 'Victory'},
                                {'rule': 'Has', 'args': {'item_name': 'Victory'}}])
def test_event_goal_becomes_a_pinned_id_location(cc):
    d = _doc(cc)
    changes = apply_victory_location(d)
    goal = d['regions']['1']['End']['locations'][0]
    item = d['items']['1']['Victory']
    assert (goal['id'], goal['pinned'], goal['locked'], 'event' in goal) == (101, True, True, False)
    assert (item['id'], item['type'], item['groups'], 'event' in item) == (11, None, [], False)
    assert len(changes) == 2


def test_an_item_id_the_goal_already_has_is_kept():
    d = _doc({'type': 'item_check', 'item': 'Victory'}, goal_item_id=7)
    apply_victory_location(d)
    assert d['items']['1']['Victory']['id'] == 7
    assert d['regions']['1']['End']['locations'][0]['id'] == 101


def test_idempotent():
    d = _doc({'type': 'item_check', 'item': 'Victory'})
    apply_victory_location(d)
    again = copy.deepcopy(d)
    assert apply_victory_location(again) == []
    assert again == d


@pytest.mark.parametrize('cc', [{'rule': 'And', 'children': []}, {'type': 'constant', 'value': True}, None])
def test_a_goal_that_is_not_one_item_is_refused(cc):
    with pytest.raises(VictoryLocationError):
        apply_victory_location(_doc(cc))
