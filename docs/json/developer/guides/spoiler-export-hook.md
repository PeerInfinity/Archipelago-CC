# Spoiler Export Hook: developer notes

How a world sends its sphere order through the optional Spoiler Export Hook, and how the client reads it. For what it is and how to use it, see the [user page](../../features/spoiler-export-hook.md).

## The pieces

| Piece | Where | Role |
|---|---|---|
| The hook | `worlds/spoiler_export_hook/` (packed: `apworlds/spoiler_export_hook.apworld`) | A hidden world with no stage hook of its own. `prepare(multiworld)` does ONE sphere walk per seed for every slot that asks and caches it on the multiworld; `slot_data_for(multiworld, player)` returns that slot's record or a reason. |
| The client file | `_spoiler_hook_client.py`, a byte-identical copy inside each world that uses the hook | The only code a world calls. It holds the two option classes, the call-time import, and every failure path: nothing it does can fail generation. |
| A caller world | DepGraph, MetaMath, APCalc, APQuest ServerData, and every World Generator package (`world_generator/ext_template/_spoiler_hook_client.py` is the generator's copy) | Re-homes the options, calls `prepare` from `stage_pre_output`, and merges `slot_data(self)` into `fill_slot_data`. |
| The web client | `frontend/modules/client/core/spoilerData.js`, `messageHandler._publishRoomSpoilerData`, `sphereState` | Expands the record into sphere-log lines on `Connected`, and loads them as the log when no file for the room's seed is loaded. |

Why there is a hook at all: AP runs `stage_*` methods only for world classes that have a player in the seed, and a hidden world never has one. So the hook can't act by itself, and each caller's `stage_pre_output` asks it on that world's behalf. The hook's cache makes the walk happen once, however many caller classes ask.

## Using the hook from a world

Copy `worlds/spoiler_export_hook/_spoiler_hook_client.py` **byte for byte** into the world package, then:

```python
# Options.py: re-home both option classes (see "The per-world option subclass" below)
from . import _spoiler_hook_client

class SpoilerDataInSlotData(_spoiler_hook_client.SpoilerDataInSlotData):
    __doc__ = _spoiler_hook_client.SpoilerDataInSlotData.__doc__

class SpoilerDataIncludeRegions(_spoiler_hook_client.SpoilerDataIncludeRegions):
    __doc__ = _spoiler_hook_client.SpoilerDataIncludeRegions.__doc__

@dataclass
class MyOptions(PerGameCommonOptions):
    ...
    spoiler_data_in_slot_data: SpoilerDataInSlotData
    spoiler_data_include_regions: SpoilerDataIncludeRegions
```

```python
# __init__.py
from . import _spoiler_hook_client

class MyWorld(World):
    @classmethod
    def stage_pre_output(cls, multiworld) -> None:
        _spoiler_hook_client.prepare(cls, multiworld)

    def fill_slot_data(self):
        return {..., **_spoiler_hook_client.slot_data(self)}
```

Don't put the options in an OptionGroup. Add both names to the exporter's `TRANSPORT_ONLY_OPTIONS` if the world is exported (`exporter/games/base/world_data.py` already lists them), so they never reach `rules.json`. Their `visibility` already leaves them out of `_Spoiler.txt`.

### The call-time import

The client imports the hook inside `_load_hook()`, at call time, never at module level. A folder world loads before every `.apworld`, and an `.apworld`'s import spec is registered only just before that apworld loads. So a module-level `import worlds.spoiler_export_hook` depends on load order. When the hook loads later, it fails the **whole caller world**, not only the spoiler data (design note scenario 9; it still fails in the scenario harness, by design). The one module-level core import is `from Options import Choice, Toggle, Visibility`, which is safe in any order.

At call time, the client turns every failure into a reason: `hook_absent`, `hook_broken`, `hook_failed` (the walk raised), or `api_mismatch` (the hook's `SUPPORTED_CLIENT_APIS` lacks the client's `CLIENT_API`). Each reason is logged once per seed. The hook adds `race` (never sent in a race seed) and `over_cap` (the record is over `MAX_SLOT_BYTES`, 1 MiB). The asking slot then gets `spoiler_data_omitted: {reason, …}` instead of `spoiler_data`. With the option off, nothing is added and nothing is logged, even with the hook absent.

### The per-world option subclass

The option classes live in the client file, so their text and `visibility` sit under the byte pin. But a world must not use them **directly** in its options dataclass. AP's `Utils.RestrictedUnpickler`, used by WebHost generation and by `test/general/test_options.py::test_pickle_dumps_default`, loads Option classes only from a module whose name ends in `options`. A class whose module is `worlds.<w>._spoiler_hook_client` is refused with `global '…SpoilerDataInSlotData' is forbidden`. So each world subclasses both in its own options module. A subclass doesn't inherit `__doc__` (which is the option's description), so `__doc__` is the only attribute it defines. `test/test_spoiler_hook_callers.py` (hand-written worlds) and `test/test_spoiler_hook_generated.py` (generator packages) pin that every attribute a subclass defines equals the client class's own, plus a restricted pickle round trip. The generator's `_template_options.py` writes the same two subclasses.

### The `__slotnames__` exclusion

Those subclass checks skip `__slotnames__`. `copyreg` caches it on a class the first time an instance is pickled. So whether it is there depends on which test ran first: on the Windows 3.13 leg, `test/general`'s pickle test ran first and 34 checks failed with `KeyError: '__slotnames__'`. It is a test artifact, not a product fault. Any new "the subclass defines nothing else" check needs the same exclusion.

### The byte-identical pin, and LF line endings

`test/test_spoiler_export_hook.py` finds every copy of `_spoiler_hook_client.py`, tracked or untracked, plain or inside an `.apworld`, and requires it to be byte-identical to `worlds/spoiler_export_hook/`'s. That covers the caller worlds, the generator copy, and every recipe package. To change the client, change the hook's copy and run the copy step for every caller (regenerate the World Generator packages, repack the packed `.apworld`s); the pin reports the ones you missed. A byte pin means line endings matter: `.gitattributes` holds every copy at LF with one rule, `**/_spoiler_hook_client.py text eol=lf` (plus `worlds/spoiler_export_hook/** text=auto eol=lf`). Without it, a Windows checkout writes CRLF and the pin fails there only. Both pin tests say so in their failure message when CRLF is the cause.

## The record

`spoiler_data` is a compact record, `format: 1`:

- `seed_name`, `player`, `start` (precollected items), `unreachable`.
- `steps`: rows `[walk label, own location or null, item received or null]`.
  - The label is `"<sphere>.<index>"`.
  - With `own_slot_with_senders`, a row whose item comes from another player's location gains a 4th element, `[sender player, sender location]`.
- With `spoiler_data_include_regions`, `regions: {start, steps: [[row index, [names]]]}`: the regions this slot first reaches at the start and after that row. They are read from `CollectionState`'s own reachable-region cache during the walk.

Each location or item is its AP id **only where that game's DataPackage gives back this exact name**, and otherwise the name itself. Events have no id; some ids are absent from the package (OoT's Skull Mask); and some ids resolve to a different name (ALttP's Progressive Bow comes back as `Progressive Bow (Alt)`). A sender's location is checked against the sender's own package.

## The file writer: `sphere_log_per_player`

`json_tools.sphere_log_per_player` (default off, in no preset; see [host settings](../reference/host-settings.md#sphere_log_per_player)) is the file side of the same data. When it is on and the seed has more than one player, `exporter/sphere_logger.py` also writes `AP_<seed>_P<n>_sphere_log.jsonl` for each player (`per_player_log_filename`).

- Each file holds the metadata line plus `filtered_to_player`, sphere 0 with only player n, and then only the lines about n.
- On those lines, each other world whose location gives n an item appears with an entry limited to those locations, with empty deltas.
- The combined file is unchanged, byte for byte.

The room's lines, expanded by the client, equal the per-player file's lines for the same seed. `frontend/modules/client/core/spoilerData.logFormat.test.js` compares them line for line. It compares sphere_index, the player's own `sphere_locations`, `base_items` and sorted `new_accessible_regions`, and every other world's entry whole. It doesn't compare the metadata line or the player's `resolved_items` / `new_accessible_locations`. The test runs at all-locations, fractional, incremental. The same equality was measured on a real server for a DepGraph + Bounce WorldGen + APQuest room, on both boots.

## Where room spoiler data enters the client

1. **DataPackage.** On `RoomInfo`, `messageHandler._requestDataPackage(roomInfo)` sends `GetDataPackage` with `games` = the room's games plus `Archipelago` (`dataPackageRequestFor`). This list is required on an upstream 0.6.8+ server: since #5981, MultiServer answers only the games named in `games`, and a bare request gets `{"games":{}}`. In that case, server-data rules, local-overlay placements and room spoiler data all fail with "the server's DataPackage has no <game>". Older servers, including this fork's MultiServer, answer either form.
2. **Expansion.** On `Connected`, `_publishRoomSpoilerData` calls `readRoomSpoilerData(slotData, {dataPackage, slotInfo, slot, seedName})`. It returns one of three things:
   - a log, published as `client:roomSpoilerData` `{source: "room:<seed>:P<slot>", text, entries}`;
   - one console line, for `spoiler_data_omitted`;
   - nothing, when neither key is present.

   A `format` not in `SPOILER_DATA_FORMATS`, another slot's or another seed's record, or a game missing from the DataPackage gives one warning and no log. `expandSpoilerData` writes the per-player file's line shape: own entry, senders as the sending world's entries, regions in `new_accessible_regions`.
3. **The origin rule** (`sphereState`). `SphereState.logOrigin` is `'file'` or `'room'`. When a file's log and the room's compete, `_rivalDecision` compares the `seed_name` on each log's metadata line (`peekSeedName`):
   - Same seed: the file wins, in either order.
   - Another seed: the room wins, in either order.
   - Either seed unknown: the file wins.
   - No room data: the file is used, whatever its seed.

   `reset()` bumps `generation` on every `stateManager:rulesLoaded`, so a file fetch started for earlier rules is dropped when it lands. Details are in [sphereState](../modules/sphereState.md), and the client side is in [client](../modules/client.md#the-rooms-spoiler-data).

Readers of the log that look only at the current player's entry ignore the senders' entries. Those readers are sphereState, the Loop cost planner, JTA balance and the JTA cost generator.

`regions` feed the region views (`sphereState.getAccessibleRegions`, the Loops cost debugger's raw view), **not** Loop prices: `CostPlanner` copies the region lists, but nothing reads them, and costs are identical with them emptied.
