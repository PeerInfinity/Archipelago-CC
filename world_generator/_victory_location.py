"""The goal as a real Victory location (design-victory-location, 2026-11-11; PROTOTYPE).

An event goal (the item ``completion_condition`` names sits at an ID-less, auto-collected
location) becomes what upstream worlds such as SMW (``Bowser`` -> ``The Princess``) and
Lufia II (``Boss`` -> ``Ancient key``) do: an ID-bearing location holding an ID-bearing goal
item, placed with ``place_locked_item`` on every seed. The player finishes by checking the
location; the server records the check and sends the goal item back.

Data-driven, no game names. For the slot:
- the goal items are the item names ``completion_condition`` names (``item_check`` or a
  ``Has`` rule; anything else is refused, naming the rule);
- each location of the slot whose placed item is a goal item of the slot and has no ID gets
  ``max(location ids of the slot) + 1`` (in document order), ``event`` dropped, ``pinned: true``
  (``locked`` already true) — without the pin, seed 7 moves Victory into the pool
  (design-finished-signal, measured);
- each such goal item keeps an ID it already has (ALttP's Triforce is 106) or gets
  ``max(item ids of the slot) + 1``; ``event`` dropped, type None, the ``Event`` group removed.

Idempotent: a document whose goal location already has an ID is returned unchanged, so a
package regenerated from its own exported rules allocates nothing new, and the IDs a room
holds stay valid across regenerations of the same source.
"""

from typing import Any, Dict, List, Set


class VictoryLocationError(ValueError):
    pass


def _goal_items(cc: Any) -> Set[str]:
    if not isinstance(cc, dict):
        raise VictoryLocationError(f'completion_condition is not a rule: {cc!r}')
    if cc.get('type') == 'item_check' and isinstance(cc.get('item'), str):
        return {cc['item']}
    if cc.get('rule') == 'Has' and isinstance((cc.get('args') or {}).get('item_name'), str):
        return {cc['args']['item_name']}
    raise VictoryLocationError(
        'victory_location supports a single-item goal (item_check or Has); '
        f'completion_condition is {cc!r}')


def apply_victory_location(json_data: Dict[str, Any], player_id: str = '1') -> List[str]:
    """Rewrite ``json_data`` in place; return one line per change (empty = already done)."""
    p = str(player_id)
    gi = (json_data.get('game_info') or {}).get(p) or {}
    goals = _goal_items(gi.get('completion_condition'))
    items = (json_data.get('items') or {}).get(p) or {}
    locs = [loc for r in ((json_data.get('regions') or {}).get(p) or {}).values()
            for loc in (r.get('locations') or [])]

    targets = [loc for loc in locs
               if (loc.get('item') or {}).get('name') in goals
               and str((loc.get('item') or {}).get('player')) == p]
    if not targets:
        raise VictoryLocationError(f'P{p}: no location of the slot holds the goal item(s) {sorted(goals)}')
    pending = [loc for loc in targets if not isinstance(loc.get('id'), int)]
    if not pending:
        return []

    next_loc = max([loc['id'] for loc in locs if isinstance(loc.get('id'), int)] or [0]) + 1
    next_item = max([v['id'] for v in items.values() if isinstance(v.get('id'), int)] or [0]) + 1
    changes = []
    for name in sorted({loc['item']['name'] for loc in pending}):
        it = items.get(name)
        if it is None:
            raise VictoryLocationError(f'P{p}: goal item {name!r} is not in items')
        if not isinstance(it.get('id'), int):
            it['id'] = next_item
            next_item += 1
            changes.append(f'P{p}: item {name!r} -> id {it["id"]}')
        it.pop('event', None)
        if it.get('type') == 'Event':
            it['type'] = None
        if 'groups' in it:
            it['groups'] = [g for g in it['groups'] if g != 'Event']
    for loc in pending:
        loc['id'] = next_loc
        next_loc += 1
        loc.pop('event', None)
        loc['locked'] = True
        loc['pinned'] = True
        if loc['item'].get('type') == 'Event':
            loc['item']['type'] = 'Item'
        changes.append(f'P{p}: location {loc["name"]!r} -> id {loc["id"]}, pinned')
    # The item group table, when present, must not list the goal under Event any more.
    groups = (json_data.get('item_groups') or {}).get(p)
    if isinstance(groups, dict) and 'Event' in groups:
        groups['Event'] = [n for n in groups['Event'] if n not in goals]
    return changes
