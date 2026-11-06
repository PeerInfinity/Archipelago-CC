"""The rules document a generated world sends its client in slot_data (``worldgen_rules``).

A world_generator package is built FROM a rules.json, so it can carry that document and send it to the
client in ``fill_slot_data``. The client then needs no local copy of the rules for this world (it still
prefers an exact-seed preset; see ``frontend/modules/client/core/localRulesOverlay.js``).

The document is written once, at build time, as ``_worldgen_rules.json`` in the package. It is the source
document after ``--apply-name-substitutions`` and the ``--game-name`` rename: the BUILT world's identity
(game, every location and item name -> id, the region set), which is what the client's ID check compares.
The research measured that identity equal to the exporter's export of the same world for all 16 committed
packages that have one (slice sdc-research-embedded-rules, §1).

slot_data is readable by every client in the room, so the document carries no placement: every field that
pairs a location with the item placed there is stripped (``strip_placements``), as are the seed- and
export-specific keys. The per-room facts (placements, rolled options) reach the client by other paths:
LocationInfo scouting and the server's own slot_data.

The file holds a small envelope, ``{"format": N, "player": "<p>", "doc": {...}}``:

``format``
    ``WORLDGEN_RULES_FORMAT``. Bump it whenever the frontend retires a rules.json shape (its
    ``RETIRED_TOP_LEVEL_KEYS`` grows): a frontend newer than the package then names the cause ("built by an
    older generator") and falls back to a local document, instead of a generic refusal.
``player``
    The player key the document's per-player maps use (the source slot). The client lays the document over
    its own slot.
"""

import copy
import json
import re
from typing import Any, Dict

#: Bumped whenever the frontend retires a rules.json shape (stateManager's RETIRED_TOP_LEVEL_KEYS grows).
#: The frontend's own copy is WORLDGEN_RULES_FORMAT in frontend/modules/client/core/localRulesOverlay.js.
WORLDGEN_RULES_FORMAT = 1

#: The package file holding the envelope.
WORLDGEN_RULES_FILE = '_worldgen_rules.json'

#: The slot_data keys (the client and the exporter read these names).
SLOT_DATA_KEY = 'worldgen_rules'
OMITTED_KEY = 'worldgen_rules_omitted'

#: The per-player option that caps the document's size in slot_data.
CAP_OPTION = 'rules_in_slot_data_max_kb'
CAP_DEFAULT_KB = 1024
CAP_MAX_KB = 8192

#: Top-level keys that describe one seed or one export, not the world.
SEED_KEYS = ('canonical_placements', 'is_canonical', 'generation_seed', 'seed_name', 'player_names',
             'provenance', 'sphere_log')

#: world[p] keys that do the same. `slot_data` is the source's own (the server sends the real one).
WORLD_SEED_KEYS = ('slot_data', 'canonical_placements', 'is_vanilla', 'preset_label', 'er_seed', 'rom_name')

#: Top-level keys kept as they are (not per-player maps).
SCALAR_KEYS = ('schema_version', 'game_name', 'game_directory', 'archipelago_version')

#: The options every world_generator package defines itself (``_template_options``), as the exporter
#: writes their definitions. CAP_OPTION is not among them: the exporter does not export it
#: (exporter/games/base/world_data.py TRANSPORT_ONLY_OPTIONS), so the document matches an export.
WORLDGEN_OPTION_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    'randomize_items': {'type': 'toggle', 'default': True, 'display_name': 'Randomize Items'},
    'use_canonical_options': {'type': 'toggle', 'default': True, 'display_name': 'Use Canonical Options'},
}


def strip_placements(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Remove (in place) every field of ``doc`` that pairs a location with its placed item, and the seed
    and export keys. Returns ``doc``.

    The fields (research §1, measured clean after this strip by a placement leak scan):
    ``regions[p][r].locations[].item``; top-level and ``world[p].canonical_placements``;
    ``preset_sidecars[p][r].playable_payload.items[].id`` (a procgen pickup's item, beside its
    ``locationName``) and ``.locations[].item``. ``procgen_metadata.sphere_plan`` is KEPT (⚖ Robert
    2026-11-06): it names items per sphere, not per location.
    """
    for key in SEED_KEYS:
        doc.pop(key, None)
    for world in (doc.get('world') or {}).values():
        if isinstance(world, dict):
            for key in WORLD_SEED_KEYS:
                world.pop(key, None)
    for regions in (doc.get('regions') or {}).values():
        for region in (regions.values() if isinstance(regions, dict) else regions or []):
            for location in region.get('locations') or []:
                if isinstance(location, dict):
                    location.pop('item', None)
    for sidecars in (doc.get('preset_sidecars') or {}).values():
        for sidecar in (sidecars.values() if isinstance(sidecars, dict) else []):
            payload = (sidecar or {}).get('playable_payload') if isinstance(sidecar, dict) else None
            if not isinstance(payload, dict):
                continue
            for item in payload.get('items') or []:
                if isinstance(item, dict):
                    item.pop('id', None)
            for location in payload.get('locations') or []:
                if isinstance(location, dict):
                    location.pop('item', None)
    return doc


def build_embedded_rules_doc(substituted: Dict[str, Any], player_id: str, game_name: str,
                             package_directory: str) -> Dict[str, Any]:
    """The document a package ships: ``substituted`` (the source after name substitution) with the built
    world's identity and no placement.

    ``substituted`` is not modified. ``package_directory`` is the package's directory name (the world's
    module), which the exporter writes as ``game_directory`` and ``world[p].world_directory``.
    """
    p = str(player_id)
    src = copy.deepcopy(substituted)
    doc: Dict[str, Any] = {}
    for key, value in src.items():
        if key in SCALAR_KEYS:
            doc[key] = value
        elif isinstance(value, dict) and p in value:
            doc[key] = {p: value[p]}          # a per-player map: this slot only
        elif isinstance(value, dict) and value and all(k.isdigit() for k in value):
            continue                           # a per-player map without this slot
        else:
            doc[key] = value
    doc['game_name'] = game_name
    doc['game_directory'] = package_directory

    world = doc.setdefault('world', {}).setdefault(p, {})
    world['game'] = game_name
    world['world_directory'] = package_directory
    options = world.setdefault('options', {})
    definitions = world.setdefault('option_definitions', {})
    for name, definition in WORLDGEN_OPTION_DEFINITIONS.items():
        options.setdefault(name, definition['default'])
        definitions[name] = dict(definition)
    # The exporter's rule (exporter/games/base/world_data.py): a `_worldgen` module's Has() counts every
    # copy of an item, as the generated Python's state.has() does.
    if re.search(r'_worldgen\d*$', package_directory):
        world['count_non_advancement_items'] = True

    for name, item in (doc.get('items') or {}).get(p, {}).items():
        if not isinstance(item, dict):
            continue
        item['name'] = name                    # the substitution renames the keys, not the inner name
        if isinstance(item.get('id'), list):   # world_generator makes a list-valued id an event
            item['id'] = None
            item['event'] = True

    return strip_placements(doc)


def embedded_rules_file_bytes(doc: Dict[str, Any], player_id: str) -> bytes:
    """The ``_worldgen_rules.json`` bytes: the envelope, compact (the cap measures these bytes)."""
    envelope = {'format': WORLDGEN_RULES_FORMAT, 'player': str(player_id), 'doc': doc}
    return json.dumps(envelope, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
