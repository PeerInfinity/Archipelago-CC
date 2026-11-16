"""The fields the add-on removes from every document it sends because the web client never reads them.

This is the ONE place the list lives. Each entry was shown safe by the strip spoiler sweep
(the strip spoiler sweep, sdc-strip-spoiler-sweep, 2026-11-16, CI run 43813833769): a spoiler
test of the stripped document passes wherever the unstripped one does. A field the client does read stays:
`option_definitions` (Kingdom Hearts 2's helpers read it) and item `type` (Super Metroid's logic reads it)
were known before the sweep.

Removing a field here changes only the size of what is sent. Adding one needs the sweep (or the standing
spoiler-test row, scripts/test/upstream_rules_addon_spoiler_row.py) to say it is safe.

The host chooses how much is stripped with ``host.yaml`` ``upstream_rules_addon.strip_level`` (Robert, 2026-11-16:
"I'll want an option somewhere for whether to keep them"):

- ``play`` (the default): every field below is removed. The client plays the room the same; panels that only show
  these fields (the APWorld Editor's classifications and meta rows, the procgen pipeline's locked/event flags) show
  them empty.
- ``editor``: these fields are kept, so the APWorld Editor opened on the server's document shows them.

Placements, the seed's facts and ``itempool_counts`` are removed at every level. A later level that keeps
everything needed to rebuild a rules.json and run it through the World Generator (Robert's, for later) is one more
entry in ``LEVELS``.
"""
from typing import Any, Dict

#: Top-level keys of the document.
TOP = ('canonical_placements', 'is_vanilla', 'is_canonical', 'preset_label', 'provenance', 'archipelago_version')
#: Keys of `world[<player>]`.
WORLD = ('world_class_name', 'web', 'world_description', 'world_directory', 'canonical_placements',
         'entrance_dependencies', 'exit_dependencies', 'location_dependencies', 'graph_structure', 'num_nodes',
         'rom_name', 'dungeons', 'is_vanilla', 'preset_label')
#: Keys of each `items[<player>][<name>]`.
ITEM = ('classification', 'classification_counts', 'hint_text')
#: Keys of each location in `regions[<player>][<region>].locations`.
LOCATION = ('locked', 'progress_type', 'show_in_spoiler', 'pinned', 'event', 'targets')


#: strip_level → (TOP, WORLD, ITEM, LOCATION) removed at that level.
LEVELS = {
    "play": (TOP, WORLD, ITEM, LOCATION),
    "editor": ((), (), (), ()),
}
DEFAULT_LEVEL = "play"


def strip_unused(doc: Dict[str, Any], level: str = DEFAULT_LEVEL) -> Dict[str, Any]:
    """Remove the fields the level strips, in place. Returns the document. An unknown level raises KeyError."""
    top, world_keys, item_keys, location_keys = LEVELS[level]
    for key in top:
        doc.pop(key, None)
    for world in (doc.get('world') or {}).values():
        if isinstance(world, dict):
            for key in world_keys:
                world.pop(key, None)
    for items in (doc.get('items') or {}).values():
        for item in (items.values() if isinstance(items, dict) else ()):
            if isinstance(item, dict):
                for key in item_keys:
                    item.pop(key, None)
    for regions in (doc.get('regions') or {}).values():
        for region in (regions.values() if isinstance(regions, dict) else regions or ()):
            for location in (region.get('locations') or ()) if isinstance(region, dict) else ():
                if isinstance(location, dict):
                    for key in location_keys:
                        location.pop(key, None)
    return doc
