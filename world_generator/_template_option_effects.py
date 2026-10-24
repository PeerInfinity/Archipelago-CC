"""Option effects: what a generated world's OWN options do to its rules, pool and placements.

A rules.json may carry ``world[player].option_effects``, a list of declarative effects, alongside the
``option_definitions`` that make the options exist. The rules in the document stay the DEFAULT, literally
(every frontend evaluator reads them as they are); the effects act only inside the generated world, at
generation time, and the export resolves them to constants like any other option.

⛔ OPT-IN. With no block, ``option_count_bindings`` is empty and ``apply_option_effects`` returns the text it
was given unchanged, so every existing package generates byte for byte as before.

Two kinds:

``item_count`` ``{option, item, count}``
    Every ``Has(item, count)`` in the rules (the document's default count) becomes
    ``Has(item, FromOption(<Option>))``, and ``generate_early`` REFUSES, by name, an option value larger than
    the number of ``item`` the pool holds under the chosen options.

``location_items`` ``{option, value, item, locations}``
    While ``option`` == ``value``, each listed location's vanilla item is ``item`` instead: the pool loses one
    of the location's canonical item and gains one ``item`` per location, and a non-randomized fill places
    ``item`` there.

First user: Seedling Playthrough (``seals_required``, ``boss_location_items``).
"""

from typing import Any, Dict, List


def option_class_name(option: str) -> str:
    """The Options class world_generator emits for an option (``_template_options``'s own spelling)."""
    return ''.join(word.capitalize() for word in option.split('_'))


def _effects(effects: List[Dict[str, Any]], kind: str) -> List[Dict[str, Any]]:
    out = [e for e in effects or [] if e.get('kind') == kind]
    for e in effects or []:
        if e.get('kind') not in ('item_count', 'location_items'):
            raise ValueError(f"option_effects: unknown kind {e.get('kind')!r} (known: item_count, location_items)")
    return out


def option_count_bindings(effects: List[Dict[str, Any]]) -> Dict[Any, str]:
    """``(item, default count) -> Options class`` for every ``item_count`` effect."""
    out = {}
    for e in _effects(effects, 'item_count'):
        key = (e['item'], int(e['count']))
        if key in out:
            raise ValueError(f"option_effects: Has({e['item']!r}, {e['count']}) is bound to two options")
        out[key] = option_class_name(e['option'])
    return out


def _replace_once(text: str, old: str, new: str, what: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"option_effects: the generated __init__.py has {text.count(old)} copies of the "
                         f"{what} anchor, expected exactly 1 — the template moved under this effect")
    return text.replace(old, new, 1)


def apply_option_effects(init_py: str, effects: List[Dict[str, Any]], class_name: str) -> str:
    """Weave the effects into a generated ``__init__.py``. No effects: the text comes back unchanged."""
    if not effects:
        return init_py
    counts = _effects(effects, 'item_count')
    swaps = _effects(effects, 'location_items')

    count_rows = '\n'.join(f'    ({e["option"]!r}, {e["item"]!r}),' for e in counts)
    swap_rows = []
    for e in swaps:
        locs = ''.join(f'        {loc!r},\n' for loc in e['locations'])
        swap_rows.append(f'    ({e["option"]!r}, {e["value"]!r}, {e["item"]!r}, [\n{locs}    ]),')
    swap_rows = '\n'.join(swap_rows)
    constants = f'''
# Option effects (world[p].option_effects): an option whose value bounds a Has() count, by the item it counts
OPTION_ITEM_COUNTS: List[tuple] = [
{count_rows}
]

# Option effects: (option, value, item, locations) — while the option holds that value, those locations hold item
OPTION_LOCATION_ITEMS: List[tuple] = [
{swap_rows}
]
'''
    methods = '''
    def _option_location_items(self) -> Dict[str, str]:
        """Location -> item for every OPTION_LOCATION_ITEMS row whose option holds its value."""
        out: Dict[str, str] = {}
        for option, value, item, locations in OPTION_LOCATION_ITEMS:
            if getattr(self.options, option).value == value:
                for location in locations:
                    out[location] = item
        return out

    def _option_item_pool_counts(self) -> Dict[str, int]:
        """ITEMPOOL_COUNTS under the chosen options: each swapped location trades its canonical item."""
        counts = dict(ITEMPOOL_COUNTS)
        for location, item in self._option_location_items().items():
            canonical = self.canonical_placements.get(location)
            if canonical is None or counts.get(canonical, 0) <= 0:
                raise OptionError(f"{self.player_name}: option effect on {location!r} has no canonical item "
                                  f"in the pool to replace")
            counts[canonical] -= 1
            counts[item] = counts.get(item, 0) + 1
        return counts

    def _check_option_effects(self) -> None:
        """Refuse, by name, a count option the pool cannot meet under the chosen options."""
        counts = self._option_item_pool_counts()
        for option, item in OPTION_ITEM_COUNTS:
            needed = getattr(self.options, option).value
            held = counts.get(item, 0)
            if needed > held:
                swapped = ', '.join(f"{o} = {getattr(self.options, o).current_key}"
                                    for o, _v, _i, _l in OPTION_LOCATION_ITEMS)
                raise OptionError(f"{self.player_name}: {option} = {needed} needs {needed} {item!r}, but the "
                                  f"pool holds only {held}" + (f" with {swapped}" if swapped else ""))
'''

    text = init_py
    text = _replace_once(text, f'from .Options import {class_name}Options\n',
                         f'from .Options import {class_name}Options\nfrom Options import OptionError\n',
                         'Options import')
    text = _replace_once(text, f'\n\nclass {class_name}Web(WebWorld):',
                         f'\n{constants}\n\nclass {class_name}Web(WebWorld):', 'WebWorld class')
    # generate_early ends by checking the effects (after any canonical options are loaded)
    start = text.index('    def generate_early(self) -> None:')
    end = text.index('\n    def ', start + 1)
    text = text[:end] + '        self._check_option_effects()\n' + text[end:]
    text = _replace_once(text, '    def create_regions(self) -> None:',
                         methods.lstrip('\n') + '\n    def create_regions(self) -> None:', 'create_regions')
    text = _replace_once(text, '        for item_name, count in ITEMPOOL_COUNTS.items():',
                         '        for item_name, count in self._option_item_pool_counts().items():',
                         'item pool loop')
    anchor = '        for location_name, item_name in sorted_placements:\n'
    if anchor in text:
        text = _replace_once(text, anchor,
                             '        option_items = self._option_location_items()\n' + anchor
                             + '            item_name = option_items.get(location_name, item_name)\n',
                             'original placement loop')
    return text
