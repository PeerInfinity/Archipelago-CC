"""The `_P<n>` files of the committed four-player fixture are what the
EXPORTER'S OWN slicing makes of its combined document.

APWORLD SUBSTRATE CHANGE P1b′ (plan §37.7 #2, §38.2 #2). Since P1a
`procgen_metadata` and `loop_costs` are per-player maps, and a per-player
export slices them like every other per-player key: slot p's `_P<p>` file
carries `{"<p>": block}` when the combined document has an entry for p, and NO
KEY at all when it has none. P1a's migration wrote the committed `_P3`/`_P4`
files without the key by its own table; until this row the only thing that
held that table to the exporter was a live `Generate.py` regeneration (P1a's
mutant M6: a `_P3` that KEEPS the key is schema-valid and no committed row saw
it).

`create_ordered_export_data`, `DESIRED_KEY_ORDER` and `PLAYER_SPECIFIC_KEYS`
were locals of `export_game_rules`; P1b′ lifted them to module scope (byte-inert,
measured by a `Generate.py` run before and after) so this row can reach them.

Every expectation is read off disk: the slots are the `_P<n>` files beside the
combined document, and which of them carry `procgen_metadata` is the combined
document's own map. Dict equality ignores key ORDER on purpose — the migrated
files keep their pre-P1a key positions, which a regeneration moves (P1a §37.x #2:
`_P1`/`_P2` 11/11, order only); the claim here is content, not layout.
"""
import json
import re
from pathlib import Path

import pytest

from exporter.exporter import create_ordered_export_data


ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "frontend/presets/multiworld/AP_05594871498841892311"
COMBINED = FIXTURE_DIR / "AP_05594871498841892311_rules.json"
# rules F3 adds `is_canonical`: the fixture's slots 3–4 (`bounce_worldgen`) carry
# it and slots 1–2 (`procgen_maze_worldgen`) do not.
PER_PLAYER_KEYS = ("procgen_metadata", "loop_costs", "is_canonical")


def _load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def _player_files():
    """`{"<p>": path}` for every `_P<p>_rules.json` beside the combined file."""
    out = {}
    for path in FIXTURE_DIR.glob("*_P*_rules.json"):
        match = re.search(r"_P([0-9]+)_rules\.json$", path.name)
        if match:
            out[match.group(1)] = path
    return dict(sorted(out.items(), key=lambda kv: int(kv[0])))


SLOTS = list(_player_files())


def test_the_fixture_has_slots_with_and_without_a_block():
    """The premise, read off the fixture: some slots carry `procgen_metadata`
    and some do not — else the rows below could not tell "sliced" from
    "dropped"."""
    combined = _load(COMBINED)
    carried = set(combined.get("procgen_metadata", {}))
    assert len(SLOTS) >= 2, SLOTS
    assert carried & set(SLOTS), (carried, SLOTS)
    assert set(SLOTS) - carried, (carried, SLOTS)


@pytest.mark.parametrize("slot", SLOTS)
def test_slicing_the_combined_document_gives_the_committed_player_file(slot):
    """Sliced through the exporter for `slot`: each per-player block is the
    slot's own entry alone, or ABSENT when the combined map has none (absent =
    absent, not `{}`), and the whole slice equals the committed `_P<slot>`
    file."""
    combined = _load(COMBINED)
    committed = _load(_player_files()[slot])
    sliced = create_ordered_export_data(combined, game_name=committed.get("game_name"), player_id=slot)

    for key in PER_PLAYER_KEYS:
        if slot in combined.get(key, {}):
            assert list(sliced[key]) == [slot], (key, list(sliced.get(key, {})))
            assert sliced[key][slot] == combined[key][slot], key
        else:
            assert key not in sliced, (key, list(sliced.get(key, {})))
        assert (key in sliced) == (key in committed), (key, slot)
        assert sliced.get(key) == committed.get(key), (key, slot)

    assert set(sliced) == set(committed), sorted(set(sliced) ^ set(committed))
    assert sliced == committed


F2_KEYS = ("provenance", "region_atlas", "flash_panel")


@pytest.mark.parametrize("slot", ["1", "2", "3"])
def test_a_slice_carries_only_its_own_f2_blocks(slot):
    """rules F2: `region_atlas`, `flash_panel` and `provenance` are per-player
    maps, so a `_P<n>` slice carries ONLY slot n's entry — never slot 1's wiring
    — and no key at all for a slot with none. The combined export keeps every
    slot's entry. A synthetic three-slot document: slots 1 and 2 are Seedling
    slots with DIFFERENT blocks, slot 3 carries none."""
    blocks = {
        "1": {"provenance": {"generator": "g1"},
              "region_atlas": {"atlas_id": "seedling-aaaa", "game": "seedling"},
              "flash_panel": {"config": "seedling.json", "wasm": "a/game.html"}},
        "2": {"provenance": {"generator": "g2"},
              "region_atlas": {"atlas_id": "seedling-bbbb", "game": "seedling"},
              "flash_panel": {"config": "seedling.json", "wasm": "b/game.html"}},
    }
    doc = {
        "schema_version": 3,
        "player_names": {"1": "A", "2": "B", "3": "C"},
        "regions": {"1": {}, "2": {}, "3": {}},
        **{key: {p: blocks[p][key] for p in blocks} for key in F2_KEYS},
    }
    combined = create_ordered_export_data(doc)
    for key in F2_KEYS:
        assert combined[key] == doc[key], key

    sliced = create_ordered_export_data(doc, player_id=slot)
    for key in F2_KEYS:
        if slot in blocks:
            assert sliced[key] == {slot: blocks[slot][key]}, (key, sliced.get(key))
        else:
            assert key not in sliced, (key, sliced.get(key))


F3_KEYS = ("is_vanilla", "is_canonical", "preset_label")


def test_the_fixture_marks_only_its_canonical_slots():
    """rules F3, measured: only `bounce_worldgen` (slots 3–4) declares
    `is_canonical`; the old exporter OR'd it over every slot, so `_P1`/`_P2`
    of the non-canonical `procgen_maze_worldgen` said `true`."""
    combined = _load(COMBINED)
    assert combined["is_canonical"] == {"3": True, "4": True}
    for slot, path in _player_files().items():
        doc = _load(path)
        if slot in ("3", "4"):
            assert doc["is_canonical"] == {slot: True}, slot
        else:
            assert "is_canonical" not in doc, slot


@pytest.mark.parametrize("slot", ["1", "2", "3"])
def test_a_slice_carries_only_its_own_f3_flags(slot):
    """rules F3: `is_vanilla` / `is_canonical` / `preset_label` are per-player
    maps, so a `_P<n>` slice carries ONLY slot n's entry, and no key for a slot
    that declares none. Synthetic: slot 1 vanilla+canonical with a label, slot 2
    a label only, slot 3 nothing."""
    values = {
        "is_vanilla": {"1": True},
        "is_canonical": {"1": True},
        "preset_label": {"1": "canth v", "2": "canth s4"},
    }
    doc = {
        "schema_version": 3,
        "player_names": {"1": "A", "2": "B", "3": "C"},
        "regions": {"1": {}, "2": {}, "3": {}},
        "helpers": {},
        **values,
    }
    combined = create_ordered_export_data(doc)
    for key in F3_KEYS:
        assert combined[key] == values[key], key
    # After `helpers` — where the flat keys sat, so the move changed no key order.
    assert list(combined)[-3:] == list(F3_KEYS), list(combined)

    sliced = create_ordered_export_data(doc, player_id=slot)
    for key in F3_KEYS:
        if slot in values[key]:
            assert sliced[key] == {slot: values[key][slot]}, (key, sliced.get(key))
        else:
            assert key not in sliced, (key, sliced.get(key))
