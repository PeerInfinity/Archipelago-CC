"""world_generator option effects — ``world[p].option_effects`` (``_template_option_effects.py``).

The block is OPT-IN (no block = the generated text comes back unchanged; the package freshness check proves the
same over every committed package), and its first user is Seedling Playthrough: ``seals_required`` reads the
FinalDoor's Seal count, and ``boss_location_items: filler`` swaps the seven boss kills' Seals for ``Nothing``.
"""

import pytest

from world_generator._template_option_effects import (
    apply_option_effects,
    option_class_name,
    option_count_bindings,
)

EFFECTS = [
    {"kind": "item_count", "option": "seals_required", "item": "Seal", "count": 16},
    {"kind": "location_items", "option": "boss_location_items", "value": 1, "item": "Nothing",
     "locations": ["Level 112 - Owl"]},
]


def test_no_effects_is_byte_inert():
    text = "anything at all\n"
    assert apply_option_effects(text, [], "X") is text
    assert option_count_bindings([]) == {}


def test_count_binding_names_the_generated_option_class():
    assert option_class_name("seals_required") == "SealsRequired"
    assert option_count_bindings(EFFECTS) == {("Seal", 16): "SealsRequired"}


def test_unknown_kind_and_double_binding_refuse_by_name():
    with pytest.raises(ValueError, match="unknown kind 'pool_size'"):
        option_count_bindings([{"kind": "pool_size"}])
    with pytest.raises(ValueError, match="bound to two options"):
        option_count_bindings([EFFECTS[0], {**EFFECTS[0], "option": "other"}])


def test_a_moved_template_anchor_refuses_rather_than_skipping():
    with pytest.raises(ValueError, match="Options import anchor"):
        apply_option_effects("no anchors here", EFFECTS, "SeedlingPlaythrough")


def test_the_seedling_playthrough_package_carries_both_effects():
    from worlds.seedling_playthrough import OPTION_ITEM_COUNTS, OPTION_LOCATION_ITEMS
    from worlds.seedling_playthrough.Options import BossLocationItems, SealsRequired

    assert OPTION_ITEM_COUNTS == [("seals_required", "Seal")]
    [(option, value, item, locations)] = OPTION_LOCATION_ITEMS
    assert (option, value, item, len(locations)) == ("boss_location_items", BossLocationItems.option_filler, "Nothing", 7)
    assert (SealsRequired.range_start, SealsRequired.range_end, SealsRequired.default) == (1, 23, 16)
    assert BossLocationItems.default == BossLocationItems.option_seal
