"""The fields the add-on removes from every document it sends because the web client never reads them.

This is the ONE place the list lives. Each entry was shown safe by the strip spoiler sweep
(NewDocs-side report `server-data/strip-spoiler-sweep.md`, sdc-strip-spoiler-sweep, 2026-11-16): a spoiler
test of the stripped document passes wherever the unstripped one does. A field the client does read stays:
`option_definitions` (Kingdom Hearts 2's helpers read it) and item `type` (Super Metroid's logic reads it)
were known before the sweep.

Removing a field here changes only the size of what is sent. Adding one needs the sweep (or the standing
spoiler-test row, test/test_upstream_rules_addon_spoiler_row.py) to say it is safe.
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


def strip_unused(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Remove the fields above, in place. Returns the document."""
    for key in TOP:
        doc.pop(key, None)
    for world in (doc.get('world') or {}).values():
        if isinstance(world, dict):
            for key in WORLD:
                world.pop(key, None)
    for items in (doc.get('items') or {}).values():
        for item in (items.values() if isinstance(items, dict) else ()):
            if isinstance(item, dict):
                for key in ITEM:
                    item.pop(key, None)
    for regions in (doc.get('regions') or {}).values():
        for region in (regions.values() if isinstance(regions, dict) else regions or ()):
            for location in (region.get('locations') or ()) if isinstance(region, dict) else ():
                if isinstance(location, dict):
                    for key in LOCATION:
                        location.pop(key, None)
    return doc
