"""An exported ``id`` is an int or ``None`` — never a ROM-byte list (server-data slice sdc-nonint-item-ids).

A Link to the Past's prizes (Crystal 1–7, the three Pendants) carry a tuple of ROM bytes as
``ItemData.item_code``; the exporter copied it into ``items[p][name].id`` (``"id": [2, 52, 100, 64, 127, 6]``).
They are events on ID-less prize locations (ALttP gives an AP id only to int codes,
``worlds/alttp/__init__.py``), so the exporter now writes ``null``, through one helper,
``exporter.games.base.utilities.int_id_or_none``. An int id is unchanged.
"""

import pytest

from exporter.games.base.utilities import int_id_or_none

@pytest.mark.parametrize("value, expected", [
    (7, 7), (0, 0), (-3, -3), (None, None),
    ((2, 52, 100, 64, 127, 6), None), ([1, 2], None), (True, None), (False, None), ("12", None), (1.0, None),
])
def test_int_id_or_none(value, expected):
    assert int_id_or_none(value) == expected
    assert type(int_id_or_none(value)) is type(expected)


@pytest.fixture(scope="module")
def room():
    """An APQuest world, filled, with two ALttP-shaped items injected: a placed prize whose ``code`` is a tuple
    of ROM bytes (the location path) and a precollected one whose ``code`` is a list (the precollected path).
    ALttP itself is not registered under pytest (conftest.py drops upstream worlds), so the shape is synthetic."""
    from BaseClasses import Item, ItemClassification
    from worlds import AutoWorldRegister
    from test.general import setup_multiworld
    from Fill import distribute_items_restrictive
    import exporter.exporter as ex
    from exporter.games import clear_handler_cache

    multiworld = setup_multiworld([AutoWorldRegister.world_types["APQuest"]], seed=1)
    distribute_items_restrictive(multiworld)
    location = next(loc for loc in multiworld.get_locations(1) if loc.item is not None and loc.address is not None)
    location.item = Item("Fake Crystal", ItemClassification.progression, (2, 52, 100, 64, 127, 6), 1)
    multiworld.precollected_items[1].append(Item("Fake Pendant", ItemClassification.progression, [1, 50, 96], 1))
    try:
        items = ex.process_items(multiworld, 1, {})
    finally:
        ex.clear_rule_cache()
        clear_handler_cache()
    return multiworld, items


def test_a_placed_tuple_coded_item_exports_a_null_id(room):
    _, items = room
    assert items["Fake Crystal"]["id"] is None


def test_a_precollected_list_coded_item_exports_a_null_id(room):
    _, items = room
    assert items["Fake Pendant"]["id"] is None


def test_every_exported_item_id_is_int_or_null(room):
    _, items = room
    bad = {n: d["id"] for n, d in items.items() if not (d["id"] is None or type(d["id"]) is int)}
    assert bad == {}


def test_int_ids_are_unchanged(room):
    multiworld, items = room
    table = multiworld.worlds[1].item_name_to_id
    assert table
    for name, code in table.items():
        if name in items:
            assert items[name]["id"] == code, name
