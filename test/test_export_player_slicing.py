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
PER_PLAYER_KEYS = ("procgen_metadata", "loop_costs")


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
