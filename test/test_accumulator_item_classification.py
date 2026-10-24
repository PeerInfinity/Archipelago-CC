"""rules S6 — the exporter's synthetic accumulator items carry `classification`.

`make_accumulator_item` (exporter/games/base/handler.py) runs in
`post_process_data`, AFTER the items step that converts a handler's legacy
`advancement`/`useful`/`trap` flags, so it must write the one shape itself. It
wrote the flags until S6; dlcquest's ` coins` / ` coins freemium` were the only
committed items without a `classification`, and the schema now refuses the flags
by name.
"""

import json
from pathlib import Path

from exporter.games.official.dlcquest import DLCQuestGameExportHandler
from world_generator.extractors import extract_items


ROOT = Path(__file__).resolve().parent.parent
DLCQUEST = ROOT / "frontend/presets/dlcquest/AP_14089154938208861744/AP_14089154938208861744_rules.json"
LEGACY = {"advancement", "useful", "trap"}


def _post_processed():
    data = {"regions": {"1": {"Shore": {"locations": [{"name": "Behind Tree coins", "item": {"name": "60 coins"}}]}}},
            "items": {"1": {}}}
    return DLCQuestGameExportHandler().post_process_data(data)["items"]["1"]


def test_accumulator_items_are_progression_by_classification():
    items = _post_processed()
    assert set(items) == {" coins", " coins freemium", "60 coins"}
    for name, item in items.items():
        assert item["classification"] == "progression", name
        assert not (LEGACY & set(item)), name


def test_the_committed_dlcquest_items_carry_no_legacy_flag():
    doc = json.loads(DLCQUEST.read_text(encoding="utf-8"))
    for name in (" coins", " coins freemium"):
        item = doc["items"]["1"][name]
        assert item["classification"] == "progression"
        assert not (LEGACY & set(item))


def test_world_generator_reads_the_classification():
    doc = json.loads(DLCQUEST.read_text(encoding="utf-8"))
    items, _, _ = extract_items(doc, player_id="1")
    assert items[" coins"].classification == "progression"
