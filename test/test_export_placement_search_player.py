"""`item_name_in_location_names` exports as a `placement_search` whose player is
the exporting world's player, not a constant 1.

The call's `player` argument is filtered out with state/player/world before the
game handler sees it; the handler used to put back `1`. For ALttP as player 2 of
a multiworld the GT Big Key (a player-2 item) then never matched, the 5-key
branch of the GT Bottom entrance was always false, and the P2 spoiler test of
every committed multiworld seed failed in Ganon's Tower.
"""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from exporter.games.base.handler import BaseGameExportHandler

ROOT = Path(__file__).resolve().parent.parent
LOCS = {'type': 'constant', 'value': [['Ganons Tower - Big Chest', 2]]}
ITEM = {'type': 'constant', 'value': 'Big Key (Ganons Tower)'}


@pytest.mark.parametrize('world, expected', [
    (SimpleNamespace(player=2), 2),
    (SimpleNamespace(player=1), 1),
    (None, 1),  # no world (cleanup / helper paths): the old single-player default
])
def test_placement_search_player_is_the_worlds(world, expected):
    rule = BaseGameExportHandler(world).handle_special_function_call(
        'item_name_in_location_names', [ITEM, LOCS])
    assert rule['type'] == 'placement_search'
    assert rule['player'] == {'type': 'constant', 'value': expected}


def _placement_search_players(node, out):
    if isinstance(node, dict):
        if node.get('rule') == 'AST_placement_search':
            out.append(node['args']['player'])
        for v in node.values():
            _placement_search_players(v, out)
    elif isinstance(node, list):
        for v in node:
            _placement_search_players(v, out)
    return out


def test_committed_multiworld_alttp_slots_search_their_own_items():
    """Every committed multiworld ALttP slot document searches for its own
    player's items — the slot and its id are read off disk, not assumed."""
    docs = []
    for doc in sorted((ROOT / 'frontend/presets/multiworld').glob('AP_*/AP_*_P[0-9]*_rules.json')):
        data = json.loads(doc.read_text(encoding='utf-8'))
        if data.get('game_name') == 'A Link to the Past':
            docs.append((doc, data))
    assert docs, 'no committed multiworld A Link to the Past slot documents'
    for doc, data in docs:
        players = _placement_search_players(data, [])
        assert players, f'{doc.name}: no placement_search rules'
        assert set(players) == {int(data['playerId'])}, f'{doc.name}: {sorted(set(players))}'
