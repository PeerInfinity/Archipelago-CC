# Discovery Panel

The Discovery panel controls discovery mode — a feature that hides parts of the game world until you explore them, simulating a blind playthrough where you don't know the full map.

## Settings

### Main Settings

| Setting | Description |
|---------|-------------|
| **Enable Discovery Mode** | Master toggle. When on, only discovered regions, locations, and exits are shown across all panels. |
| **Region Discovery Trigger** | When to mark a region as discovered: "When the region is first entered" or "When an exit leading to the region is discovered". |
| **Auto-discover Locations** | Automatically discover all locations in a region when that region is discovered. |
| **Auto-discover Exits** | Automatically discover all exits from a region when that region is discovered. |
| **Items in Undiscovered Regions** | Choose "Hide entirely" to remove undiscovered items from view, or "Show as '???'" to show placeholders. |
| **Show Undiscovered Region Names** | Show actual names instead of "???" for undiscovered regions that have a discovered exit leading to them. |
| **Click Discovers Region** | Clicking an undiscovered region in the Region Graph or Regions panel automatically discovers it. |
| **Disable Location Check UI** | Prevent location check actions when clicking locations (useful for entrance shuffle exploration). |
| **Show Debug Options** | Reveal the debug settings and discovery state lists below. |

### Debug Settings (Hidden by Default)

These appear when **Show Debug Options** is enabled:

| Setting | Description |
|---------|-------------|
| **Click Discovers Location** | Clicking an undiscovered location automatically discovers it. |
| **Show Undiscovered Details** | Show full details (region, rules, status) for undiscovered locations instead of minimal "???" info. |

## Loop Mode and a World's Own Discovery Mode

Some settings above can be set for you for the length of a session. They are never saved, so your own values come back when the session's reason for them ends or the page reloads:

- **Loop mode turns Discovery mode on.** While loop mode is on, Discovery mode is on with these values: regions are discovered when an exit leading to them is discovered, undiscovered items show as "???", undiscovered region names are hidden, auto-discover and click-discovers-region are off, and the location check UI is disabled. Leaving loop mode restores your settings. Unchecking **Enable Discovery Mode** in loop mode lasts only until loop mode is next switched on or the page reloads.
- **A generated world can choose its own Discovery mode.** The Procgen Pipeline's **Discovery mode** select (beside **Enable loop mode**) writes the choice into the world, so a saved world reopens the same way:

| Discovery mode | In loop mode | Without loop mode |
|---|---|---|
| **Same as loop mode** (default) | Discovery on, as above | Your own settings |
| **On** | Discovery on, as above | Walk-to-reveal: entering a region reveals it, its locations and its exits; undiscovered items show as "???"; clicking a discovered exit in the Regions or Exits panel moves you |
| **Off** | Discovery off, and every region, location and exit counts as discovered, so the Loops queue can be planned through any of them | Discovery off |

Clicking an exit with Discovery mode on otherwise only discovers it; the move happens only in a walk-to-reveal world.

## Discovery State Lists

When debug options are shown, three collapsible sections display everything that has been discovered:

- **Discovered Regions** — Checkboxes for each region. Start regions are shown in blue and cannot be unchecked. Discovered regions are green; undiscovered are gray. Shows "X / Y discovered" count.
- **Discovered Locations** — Checkboxes for each location with the same green/gray coloring and count.
- **Discovered Exits** — Checkboxes grouped by source region, showing each exit as "exitName -> connectedRegion".

Toggle any checkbox to manually mark items as discovered or undiscovered.

## Reset

The **Reset All Discoveries** button at the bottom clears all discovery state (with a confirmation dialog). This returns everything to the undiscovered starting state.

## How Other Panels Are Affected

When discovery mode is enabled:
- **Regions** and **Locations** panels hide or show placeholders for undiscovered items.
- **Region Graph** hides undiscovered nodes or shows them as "???".
- **Exits** panel filters by discovered/undiscovered state.
- **Text Adventure** only shows discovered locations and exits.
