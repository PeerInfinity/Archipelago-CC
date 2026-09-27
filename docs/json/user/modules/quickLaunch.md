# Quick Launch Panel

The Quick Launch panel is the first tab of the left column in the default layout. It lists every panel the app has registered, with a button to open each one, and links to the documentation.

The bar at the top has two rows. The first holds the header line, which counts what the panel lists — *N panels · M docs*, where *M* is the number of documents the Help group shows — and the filter box. The second holds the buttons: **Cards** (the two views), **Collapse all** / **Expand all** (folding), **Edit** (your own groups) and **Modules ⇄**, which opens the [Modules panel](modules.md). In a narrow column (a small window, or the column dragged narrower) the rows wrap: the filter box moves under the header, and the buttons continue on another line.

## All panels

One button per panel, sorted into one sub-group per category. The categories are the module sections of the [Frontend Module Reference](../../modules/README.md) (*Tracker Panels*, *Game Mode Panels*, *Procgen Substrate Panels*, *Procgen Infrastructure Panels*, and so on), in the order that page lists them; each panel declares its own. A panel that declares none, or a category that page does not list, appears under **Other**, last. A category with no panel in the current mode is not shown (the default mode has no *Non-procgen Games*, for example). Inside each category the panels keep the app's standard (load-priority) order. Each button shows the panel's icon and title, and a dot:

- **Filled green dot** — the panel's module is enabled, so its tab is open.
- **Hollow dot** — the panel is closed.

Clicking a button brings that panel's tab forward. If the panel was closed, it is reopened in its usual column — the same thing ticking its checkbox in the Modules panel does. Hover a button to read the panel's description.

A **?** after a button links to that panel's user guide, when it has one. The panel guides are reached only this way — the Help group does not list them again.

## Help

Links to the documentation, in one sub-group per section:

- **User Guides** — the overview, quick start, guided tour and the other general guides.
- **Features** — one page per major feature.
- **Playable Games** — one link per game; a game with more than one page gets a sub-group of its own.

The **Show developer docs** setting (see *Settings* below) adds four more sections after these: **Developer Guides**, **Developer Reference Documentation**, **Frontend Module Reference** and **Procedural Generation**. The first three are split into sub-groups by the headings of their own index page — the Frontend Module Reference by module category (*Tracker Panels*, *Core Service Modules*, …), the guides into *Core Architecture Guides*, *Development Guides* and so on — in the order that page lists them; a page the index does not list comes last, under **Unlisted**. Each section's count is in its heading. Every link opens in a new browser tab.

The sections are not a list kept in the panel: a documentation directory whose `README.md` carries a marker line joins Help, titled by that README's heading (see the [documentation index](../../README.md)).

## Two views: tree and cards

The **Cards** button switches between two views of the same groups:

- **Tree** (the default) — one compact row per item.
- **Cards** — every row also shows a line of text: a panel's description (or, if it has none, the first paragraph of its guide), and a guide's first paragraph. The button reads as pressed while cards are shown.

Everything else is the same in both views: the groups, the dots, the **?** links, clicking to open a panel, and edit mode.

## Filter

Type in the filter box to show only what matches: a panel whose title or description contains the text (upper or lower case alike), a guide whose title does, a web link whose label does, or a group whose name does — a Help section's or sub-group's name included (then everything in that group is shown). The groups holding a match are shown open, even ones you had folded shut; clearing the box puts every group back the way it was. A group with no match is hidden, and if nothing matches at all the panel says so.

While the box holds text, a count beside it reads *N of M*: the rows shown (panel buttons, guide links, web links and the greyed-out missing items), of all the rows the panel shows unfiltered. Press **Escape** in the box to clear it.

## Collapse all / Expand all

One button folds every group at once. It does what it says, whatever state the groups are in, and then offers the opposite: **Collapse all** folds every group shut — your own groups, the built-in ones and every sub-group — and the button then reads **Expand all**, which opens them all again. Every time the panel is opened the button starts at **Collapse all**; which way it points is not saved.

While the filter box holds text the button is disabled (hover it: *Clear the filter to fold*) — the filter shows every group holding a match open, so a fold would have nothing to show. Clearing the box enables it again, still pointing the way it did.

## Your own groups

Above the built-in groups you can keep your own arrangement: groups (nested as deep as you like), panel buttons, guide links and web links. Press **Edit** in the header to change it; press it again to finish.

In edit mode:

- **+ group** and **+ url** (at the top, and on every group) add a group or a web link there. Each opens a small form at the end of that list: a name box for a group; an address box, a label box and an **Add** button for a link (the label is optional — the address is used when it is empty). **Enter** adds, **Escape** cancels, and clicking elsewhere adds what you typed (an empty name or address adds nothing). A form stays open with what you typed even when the panel redraws under it — for instance when you open one straight after committing another.
- **add to ▾** on every row of *Unfiled*, *All panels* and *Help* files that panel or guide into one of your groups (or the top level). The row stays where it is: the built-in groups never change. A row already filed shows how many times, as a small badge before it — **2×** when it is in your groups twice.
- On your own items: **▲ ▼** move an item within its group, **move to ▾** puts it in another group, **✎** turns a group's name into a text box (**Enter** or clicking elsewhere keeps the new name, **Escape** keeps the old one), **✕** removes an item. Removing a group removes everything in it, and the panel asks first unless the group is empty.

Your groups hold *references*, so the same panel can appear in several of them, and every copy opens the same tab. If something you filed no longer exists (a guide was removed, or the panel belongs to a module this mode does not load), it stays in your group, greyed out with its name, until you remove it.

## Unfiled

Once you have your own groups, *Unfiled* lists every panel and every document Help shows that none of them contains, so a panel added to the app later still shows up. It is hidden when there is nothing left to file, and while you have no groups at all (then *All panels* and *Help* already show everything).

## Where the arrangement is saved

The arrangement is a setting, **Arrangement** (`moduleSettings.quickLaunch.tree`), saved with the rest of your settings for the current mode. So each mode has its own arrangement, and a fresh mode starts with none.

Two more settings are saved the same way:

- **View** (`moduleSettings.quickLaunch.view`) — `tree` or `cards`, whichever the **Cards** button last chose.
- **Collapsed groups** (`moduleSettings.quickLaunch.collapsedGroups`) — which groups are folded shut: your own and the built-in ones alike (*All panels*, a category, *Help*, a Help section or sub-group, *Unfiled*). Folding or unfolding one, or **Collapse all** / **Expand all**, writes it, so a group you folded is still folded after a reload. A developer section you folded stays folded while *Show developer docs* is off and on again. The text in the filter box is never saved.

- The Options panel's *All Settings* view shows it as JSON (filter for `quickLaunch`); you can edit it there. Each item is `{id, kind, ...}` with `kind` one of `group` (`label`, `children`), `panel` (`ref`: the panel's component type), `doc` (`ref`: the guide's path) or `url` (`href`, `label`).
- The JSON panel's settings export and import carry it too.
- **Reset to Defaults** in the Options panel empties it (and sets the view back to tree, with no groups folded).
- Saved settings are reloaded while **Auto-load Mode** is on in the Options panel (the default), or when the page address names the mode (for example `?mode=default`). If you turn Auto-load off, a plain address starts from the default settings and your groups are not shown. They are still saved, and they come back when you turn it on again: changing some other setting meanwhile leaves them alone, but editing the groups in that session saves the edited (default-based) tree over them. See [Saved Settings and Auto-load Mode](../tips-and-tricks.md#saved-settings-and-auto-load-mode).

## Reopening a closed panel

Closing a tab with its **×** disables its module. To get it back, click its button in **All panels** (or tick it in the Modules panel). If you closed the Quick Launch panel itself, reopen it from the Modules panel.

## Settings

**Show developer docs** (Options panel, `quickLaunch` section; `moduleSettings.quickLaunch.showDeveloperDocs`, off by default) — also list the four developer documentation sections in Help. Changing it redraws the panel at once; it is saved per mode like the settings above.

**Docs link target** (Options panel, `quickLaunch` section):

- `github` (default) — guide links open on GitHub. Works everywhere.
- `local` — guide links open the copy served by this server. Works on the local dev server; on the published GitHub Pages site these links 404, because the Pages site does not include the user guides.
