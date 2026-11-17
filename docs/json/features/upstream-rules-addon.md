# Upstream Rules Add-on

The Upstream Rules Add-on is an optional apworld for **people who generate rooms**. With it installed, every slot of a room carries its own rules document in the room's slot data. The web client reads it when a player connects. So a player can join a room of ordinary Archipelago games (TUNIC, Starcraft 2, A Link to the Past, …) and play it in the web client **with no preset file for that room**, at any slot.

Without it, the web client can only play an upstream game's room when it has that exact seed's preset, and otherwise asks for one.

## Where to get it

- **The add-on:** `apworlds/upstream_rules_addon.apworld` in this repository (about 450 KB). It's MIT licensed.
- **Install:** copy it into your Archipelago installation's `custom_worlds/` folder. Leave it zipped.
- **Who needs it:** only the person who **generates** the room. Players don't need it, and neither does the server. A room generated with it and then uploaded to a server (archipelago.gg included) still carries the documents, because they are in the room file.
- **Archipelago version:** 0.6.8 or later (`minimum_ap_version` in its manifest). It was tested on 0.6.8 and on upstream's 0.6.9 development version. CI generates rooms with it on both.
- **archipelago.gg's own generator** can't use it, because that generator takes no custom apworlds. Generate locally and upload the room instead.
- It adds no game. It's a hidden world: it has no YAML options and never appears as a player. If you list it as a player's game, generation stops with "Upstream Rules Addon is a helper for hosts, not a playable game."

## Settings (`host.yaml`)

Archipelago adds this section to your `host.yaml` the first time it loads the add-on:

```yaml
upstream_rules_addon:
  enabled: true
  max_kb: 1024
  exclude_games:
    - "APCalc"
    - "DepGraph"
    - "Metamath"
  strip_level: "play"
```

| Setting | Default | What it does |
|---|---|---|
| `enabled` | `true` | Installing the add-on turns it on. Set `false` to keep it installed but idle. |
| `max_kb` | `1024` | The largest document one slot may carry, in KB (compact JSON). A bigger one is not sent, and that slot gets the reason `over_cap` instead. All 73 upstream games that have presets here fit under 1024 KB at their default options; the largest is Stardew Valley at about 860 KB. |
| `exclude_games` | APCalc, DepGraph, Metamath | Games that never get a document. The three defaults build their rules in the client from the room itself. |
| `strip_level` | `play` | How much of each document is left out besides placements. `play` leaves out the fields the client never needs to play the room. `editor` keeps them (item classifications, location flags, the meta rows), so the APWorld Editor opened on a server-sent document shows them; documents are larger by a median of 11% (2–22% across the 73 upstream presets). Placements and the item pool counts are never sent, at any level. |

The setting applies to the whole room: every slot of every game that isn't excluded. A player can't turn it on or off from their YAML.

## What it costs

- **Generation time:** about 1–7 seconds more per room, for one export of every slot. A 3-player room of ChecksFinder, TUNIC and Starcraft 2 took about 7 seconds longer.
- **Room file:** the documents are stored in the room file, so it grows by about their compressed size (the 3-player room's grew to about 300 KB).
- **Network:** each player's document is sent once, when they connect. It's 5 KB to 860 KB of JSON, which the server compresses to 1–60 KB.

## What players see

Players connect as usual. When the room has no preset for their seed, the client prints *"Loaded the server-sent `<game>` rules (from the host's Upstream Rules Addon) with the server's placements"* and builds the room from the document.

A slot that didn't get a document carries a short reason (`worldgen_rules_omitted`) instead. The client prints one line naming the add-on and the reason, then asks for the room's preset file, as it does without the add-on. It sends no checks until it has rules; checks the game made meanwhile are held. The reasons, and the line the player sees:

| Reason | When | The player sees |
|---|---|---|
| `over_cap` | The document was over `max_kb`. It also carries `size_kb` and `cap_kb`. | *"The host's Upstream Rules Addon did not send this world's rules (290 KB, over its host.yaml max_kb of 100 KB)."* |
| `export_degraded` | The exporter couldn't fully read some of this game's rules (`unanalysed_rules`: how many), or it wrote them in its fallback format (`format_fallback`). The add-on sends nothing rather than rules that describe different logic. | *"… did not send this world's rules: 3 of its rules could not be analysed, so they would not match the game's logic."* (or *"the export fell back to an older rule format"*) |
| `export_failed` | The export failed (`error` says why). Generation itself still succeeds. | *"… did not send this world's rules: the export failed (`<error>`)."* The error is quoted on one line, cut to 160 characters. |

A reason this client doesn't know is quoted as is (*"… (reason: "`<reason>`")."*). When a room's world sent neither a document nor a reason (the add-on isn't installed), the request for a preset adds *"(a host can send them by installing the Upstream Rules Addon)"*; APCalc's never does.

A game whose own world already sends its rules is left alone: the World Generator packages, Baking Adventure and Coding Adventure.

### What the document contains, and what it doesn't

The document is the game's logic: its regions, locations, items, rules and options. It never contains placements (which item is at which location) or the seed's spoiler facts. Other players can read it, because every client in a room can read every slot's slot data. Two consequences follow:

- **Race rooms** (`--race`) get their documents too, because the document holds no placements.
- **Entrance randomizer:** the logic can't be built without the connections, so the document carries the seed's shuffled entrance layout. Anyone in the room can read that layout. TUNIC already sends its own pairing in its slot data, so for TUNIC nothing new is revealed.

At `strip_level: play` the add-on also leaves out fields the web client never reads to play, to save space. The list is `worlds/upstream_rules_addon/_unused_fields.py`; a spoiler-test sweep of every committed preset showed it safe. (Two fields on the original list stay because some games' logic reads them: `option_definitions`, read by Kingdom Hearts 2, and item `type`, read by Super Metroid.)

### Goals

The web client doesn't report the goal for these games. Their goals are events, which the server never delivers, so the game's own client reports it. Locations are still checked as usual.

## Games that need a ROM

Some games (A Link to the Past, Super Mario World, Secret of Evermore, …) need their base ROM even to generate. The add-on can't help a host who can't generate the game.

This repository's **romless patches** (`json_tools_patches/<version>/romless/`, applied by the JSON Tools Installer) let those games generate without a ROM. They work together with the add-on: an ALttP room generated on Archipelago 0.6.8 with the patches applied and the add-on installed carried ALttP's document, and a player connected at slot 2 from the server alone. Installing `json_tools_installer.apworld` and the add-on in the same `custom_worlds/` works too. The add-on ignores the `json_tools` section of `host.yaml`, so its documents are the same whatever that section says.

## When Archipelago changes

The add-on carries its own copy of this repository's rules exporter, made when it was packed. A newer Archipelago may change a world in a way that copy can't read. The add-on then marks that slot `export_degraded` and the player is asked for a preset, as without the add-on. If a future Archipelago stops calling the stages the add-on uses, the generator log says *"…the room carries no rules documents. This Archipelago version is not supported by this add-on version."*

For developers: the source is `worlds/upstream_rules_addon/`, packed (with the exporter vendored in) by `scripts/build/pack_upstream_rules_addon.py`. `.github/workflows/upstream-rules-addon.yml` generates rooms with it on pristine upstream Archipelago. In this repository's own `worlds/` the folder installs no hook, so this repository's own generation is unchanged.
