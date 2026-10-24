"""rules F3 — `is_vanilla` / `is_canonical` / `preset_label` are PER-PLAYER maps.

⚖ user 2026-10-03: *"`is_vanilla`: This should also be per player. This should
not be folder level. I want to fix this in the schema."* The exporter used to OR
the two flags over every slot and take the first slot world's label, and
`world_generator` read the document-level value while extracting ONE slot, so a
slot generated from a multi-slot document inherited another slot's facts.
"""

import copy
import json
from pathlib import Path

from world_generator.extractors import extract_all


ROOT = Path(__file__).resolve().parent.parent
VANILLA = ROOT / "frontend/presets/metamath_vanilla/AP_14089154938208861744/AP_14089154938208861744_rules.json"


def _two_slot_document():
    """The committed one-slot metamath_vanilla document with its slot copied to
    slot 2 — and the F3 maps left naming slot 1 only."""
    doc = json.loads(VANILLA.read_text(encoding="utf-8"))
    for key, value in list(doc.items()):
        if isinstance(value, dict) and "1" in value and key not in ("is_vanilla", "is_canonical", "preset_label"):
            value["2"] = copy.deepcopy(value["1"])
    doc["player_names"]["2"] = "Player2"
    return doc


def test_the_committed_document_holds_slot_maps():
    doc = json.loads(VANILLA.read_text(encoding="utf-8"))
    assert doc["is_vanilla"] == {"1": True}
    assert doc["preset_label"] == {"1": "2p2e4 v"}


def test_world_generator_extracts_the_slots_own_flags():
    doc = _two_slot_document()
    one = extract_all(doc, player_id="1")
    assert one.is_vanilla is True
    assert one.preset_label == "2p2e4 v"


def test_world_generator_never_inherits_another_slots_flags():
    """The defect: slot 2 declares neither, so it extracts neither — before F3
    it read the document-level `is_vanilla: true` and `preset_label`."""
    doc = _two_slot_document()
    two = extract_all(doc, player_id="2")
    assert two.is_vanilla is False
    assert two.preset_label == ""
