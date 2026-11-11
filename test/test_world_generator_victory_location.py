"""world_generator/_victory_location.py (design-victory-location; the recipe field ``victory_location``).

Unit cases on a small document, plus pins over every committed package whose recipe sets the field:
the goal is an ID-bearing, pinned location, the package still sets a completion condition (the TOEM rule
builder's ``Has`` goal lost it once, sdc-victory-build 2026-11-11), and ``compare_rules_json.py
--victory-location`` cancels exactly the transform's changes.
"""
import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

from world_generator._template_init import _generate_completion_lambda
from world_generator._victory_location import VictoryLocationError, apply_victory_location

REPO = Path(__file__).resolve().parents[1]
RECIPES = json.loads((REPO / 'scripts' / 'data' / 'worldgen-package-recipes.json').read_text(encoding='utf-8'))['packages']
VICTORY = sorted(p for p, r in RECIPES.items() if r.get('victory_location'))
SEED_ID = 'AP_14089154938208861744'


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


@pytest.mark.parametrize('cc,body', [
    ({'rule': 'Has', 'args': {'item_name': 'Victory'}}, 'state.has("Victory", self.player)'),
    ({'rule': 'Has', 'args': {'item_name': 'Gem', 'count': 3}}, 'state.has("Gem", self.player, 3)'),
    ({'type': 'item_check', 'item': 'Victory'}, 'state.has("Victory", self.player)'),
])
def test_the_completion_lambda_reads_both_goal_forms(cc, body):
    assert _generate_completion_lambda(cc) == body


def test_the_eight_event_goal_recipes_set_the_field():
    assert len(VICTORY) == 8, VICTORY


def _preset_rules(package):
    return json.loads((REPO / 'frontend' / 'presets' / package / SEED_ID / f'{SEED_ID}_rules.json')
                      .read_text(encoding='utf-8'))


@pytest.mark.parametrize('package', VICTORY)
def test_a_victory_package_keeps_its_goal_and_has_an_id_location(package):
    init = (REPO / 'worlds' / package / '__init__.py').read_text(encoding='utf-8')
    assert 'self.multiworld.completion_condition[self.player]' in init
    doc = _preset_rules(package)
    cc = doc['game_info']['1'].get('completion_condition')
    assert cc, f'{package}: the export has no completion_condition'
    goal = cc.get('item') or (cc.get('args') or {}).get('item_name')
    goal_locs = [loc for r in doc['regions']['1'].values() for loc in r.get('locations') or []
                 if (loc.get('item') or {}).get('name') == goal]
    assert len(goal_locs) == 1
    loc = goal_locs[0]
    assert isinstance(loc['id'], int) and loc.get('pinned') is True and not loc.get('event')
    assert isinstance(doc['items']['1'][goal]['id'], int)


def test_compare_rules_json_cancels_exactly_the_expected_changes():
    original = f'frontend/presets/bakingadventure/{SEED_ID}/{SEED_ID}_rules.json'
    worldgen = f'frontend/presets/bakingadventure_worldgen/{SEED_ID}/{SEED_ID}_rules.json'
    def run(*flags):
        return subprocess.run([sys.executable, 'scripts/test/compare_rules_json.py', *flags, original, worldgen],
                              cwd=REPO, capture_output=True, text=True, timeout=120).stdout
    assert 'Files are identical' in run('--ignore-canonical', '--victory-location')
    without = run('--ignore-canonical')
    assert 'Found 4 difference(s)' in without, without[-800:]
