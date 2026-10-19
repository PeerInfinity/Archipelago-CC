# Substrate Registry Panel

The Substrate Registry lists every **substrate** — every kind of region a generated world can be built from, such as a maze, a text adventure, a bounce zone, Noiz2sa or a Seedling room — and says what each one can do: whether the Playback Bot can play it, whether it works in Loop mode, what the generator may do with it, whether it has an editor. It is the place to look before choosing substrates in the [Procgen Pipeline](procgenPipeline.md).

The panel only reads; the one thing it changes is the order substrates are listed in across the app (see *Columns*, below).

## The three views

The buttons at the top switch the view. The header line counts the entries.

### Plain (the first view)

One table per topic — **Play**, **Loop mode**, **Generate** and **Edit** — with a row per question ("You can play its regions by hand", "The Playback Bot can walk it", "What you can queue for it", …) and a column per substrate. Each cell answers:

| Mark | Means |
|---|---|
| **✓** | it can — often with a detail, such as the items it brings |
| **✗** | it cannot |
| **◐** | partly, with how |
| **n/a** | the question does not apply to it |

Hover a cell to see what the answer is based on, or a column's heading for a short description of that substrate. Click a topic's heading to fold it. Type in **filter statements** to show only the rows that match.

### Matrix

The same substrates against the raw fields they declare, for those who want to look underneath: **✓** carried, **✗** absent, a number for a value or a list's length. Hover a cell for the full value. **filter rows** narrows the list.

### Detail

One fold-out per substrate with every field and its value, plus what the substrate answers when the app asks it now. At the top, a check against the project's saved copy of the list: *No drift…* when they agree, or what has changed.

## Columns

In **Plain** and **Matrix**, the **Columns** fold-out chooses which substrates are shown:

- The tick beside each one shows or hides its column. **All** and **None** do it for every column. (This lasts until the page is reloaded.)
- **▲** and **▼** move a substrate up or down the order, and **Registry order** puts them back to the default. ⚠ This order is a setting, and the rest of the app follows it: the Procgen Pipeline's substrate lists and the [APWorld Editor](apworldEditor.md)'s use it too. It is kept in the Settings panel as *Substrate order*, under *substrateRegistryPanel*.

## The other buttons

- **Refresh** reads the list again.
- **snapshot reference ↗** opens the project's generated reference page for the registry, in a new tab.

## Learn more

- [The procgen substrates](../../features/procgen-substrates.md), with a table of what each one can do.
- For developers: [the substrate registry](../../developer/procgen/substrate-registry.md).
