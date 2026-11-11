# Spoiler Export Hook

The Spoiler Export Hook is a small optional apworld. With it installed, a world that supports it can send its slot's **sphere order** inside the room's slot data. That is the same order the spoiler log's sphere file records: which of your locations come into logic at each step, and which items you receive along the way. The web client reads it when you connect. So the features that normally need a sphere log file, such as **Loop mode's cost planner** and the **region views**, work in a room you didn't generate yourself, with no spoiler file to load.

Worlds that support it work without it. If the hook isn't installed, generation still succeeds; those slots just get no spoiler data (see [What you see in the client](#what-you-see-in-the-client)).

## Where to get it

- **The hook:** `apworlds/spoiler_export_hook.apworld` in this repository. It's MIT licensed.
- **Install:** copy it into your Archipelago installation's `custom_worlds/` folder, beside the apworlds that use it. Only the person who **generates** the seed needs it. Players connecting to the room don't, and neither does the server.
- **Minimum Archipelago version:** 0.6.7 (`minimum_ap_version` in its manifest).
- It adds no game. It is a hidden world: it has no YAML options of its own and never appears as a player.

### Worlds that support it

- The hand-written worlds in this repository: **DepGraph**, **MetaMath**, **APCalc** and **APQuest ServerData**.
- Every world package made by the **World Generator** (the `*_worldgen` packages, and worlds built in the browser from a procgen design).
- Seedling does not use it yet.

A world supports it by carrying the two options below. A world that doesn't is unaffected: you can mix supporting and non-supporting games in one seed.

## The options

Set them in the YAML of each slot that wants spoiler data, under that slot's game:

```yaml
name: YourName
game: DepGraph
DepGraph:
  spoiler_data_in_slot_data: own_slot
  spoiler_data_include_regions: false
```

| Option | Values | Default | What it does |
|---|---|---|---|
| `spoiler_data_in_slot_data` | `off`, `own_slot`, `own_slot_with_senders` | `off` | `own_slot` sends your own locations in the order they come into logic, and when each of your items arrives. `own_slot_with_senders` also says, for each item you receive, which player's location sends it. |
| `spoiler_data_include_regions` | `true` / `false` | `false` | With spoiler data on, also sends the regions you can reach at the start and after each step, as the sphere file has them. This adds about 2–10 KB per slot. It does nothing while spoiler data is off. |

Neither option appears in the text spoiler (`_Spoiler.txt`) or in the exported rules, so turning them on changes no preset.

### ⚠ Who can read it: `own_slot_with_senders`

**Every client in the room can read every slot's slot data.** With `own_slot`, what is sent describes only your own world. With `own_slot_with_senders`, it also shows where your items sit **in other players' worlds**. Anyone in the room who looks can find that out. Use it only in rooms where everyone is fine with that, for example a solo seed, or friends who are not racing.

### Race mode

In a race seed (`--race`) the hook sends nothing, whatever the options say. The generator prints one warning, and the slot gets the "never sent in a race seed" reason.

## What you see in the client

When you connect, the client prints at most one line about it:

| The room has | The client |
|---|---|
| Spoiler data for your slot | Loads it as your sphere log. It says nothing in the console; Loop mode and the region views just work. |
| `spoiler_data_omitted` (asked for, but not sent) | One line, for example *"This room has no spoiler data: the generator did not have the Spoiler Export Hook."* Other reasons: the hook failed, the versions don't match, a race seed, or the record was over the 1 MiB cap. |
| Nothing (the option was off) | Nothing. |

**A spoiler file for the same seed still wins.** If a preset (or a log you loaded) is for this room's exact seed, the client keeps it and ignores the room's copy. If the loaded file is for a *different* seed, the room's data replaces it.

**Server version.** The client reads ids through the server's DataPackage. Since Archipelago 0.6.8, a server returns only the games the client names in its request. The client names the room's games, so it works with servers from before and after that change.

A copy of the client from before November 2026 sent the request without names. On a 0.6.8 or later server it gets an empty DataPackage, and it prints *"the server's DataPackage has no …"* instead of loading the data. That affects every server-data feature: rules built from the room, local presets with the room's placements, and spoiler data. If you see that line, update the client (or reload the site).

## See also

- [`json_tools.sphere_log_per_player`](../developer/reference/host-settings.md#sphere_log_per_player): the file-side equivalent, for people who generate with JSON Tools.
- [Developer notes](../developer/guides/spoiler-export-hook.md): how a world uses the hook, and how the client reads it.
