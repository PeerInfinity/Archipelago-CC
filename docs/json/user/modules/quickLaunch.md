# Quick Launch Panel

The Quick Launch panel is the first tab of the left column in the default layout. It lists every panel the app has registered, with a button to open each one, and links to the user guides.

The header line counts what it lists: *N panels · M guides*. Beside it are the filter box, the **Cards** button (the two views), **Edit** (your own groups) and **Modules ⇄**, which opens the [Modules panel](modules.md).

## All panels

One button per panel, sorted into one sub-group per category. The categories are the module sections of the [Frontend Module Reference](../../modules/README.md) (*Tracker Panels*, *Game Mode Panels*, *Procgen Substrate Panels*, *Procgen Infrastructure Panels*, and so on), in the order that page lists them; each panel declares its own. A panel that declares none, or a category that page does not list, appears under **Other**, last. A category with no panel in the current mode is not shown (the default mode has no *Non-procgen Games*, for example). Inside each category the panels keep the app's standard (load-priority) order. Each button shows the panel's icon and title, and a dot:

- **Filled green dot** — the panel's module is enabled, so its tab is open.
- **Hollow dot** — the panel is closed.

Clicking a button brings that panel's tab forward. If the panel was closed, it is reopened in its usual column — the same thing ticking its checkbox in the Modules panel does. Hover a button to read the panel's description.

A **?** after a button links to that panel's user guide, when it has one.

## Help

Links to the user guides: the general guides first, then one per panel. Every link opens in a new browser tab.

## Two views: tree and cards

The **Cards** button switches between two views of the same groups:

- **Tree** (the default) — one compact row per item.
- **Cards** — every row also shows a line of text: a panel's description (or, if it has none, the first paragraph of its guide), and a guide's first paragraph. The button reads as pressed while cards are shown.

Everything else is the same in both views: the groups, the dots, the **?** links, clicking to open a panel, and edit mode.

## Filter

Type in the filter box to show only what matches: a panel whose title or description contains the text (upper or lower case alike), a guide whose title does, a web link whose label does, or a group whose name does (then everything in that group is shown). The groups holding a match are shown open, even ones you had folded shut; clearing the box puts every group back the way it was. A group with no match is hidden, and if nothing matches at all the panel says so.

## Your own groups

Above the built-in groups you can keep your own arrangement: groups (nested as deep as you like), panel buttons, guide links and web links. Press **Edit** in the header to change it; press it again to finish.

In edit mode:

- **+ group** and **+ url** (at the top, and on every group) add a group or a web link there. The panel asks for the name, or for the link's address and label.
- **add to ▾** on every row of *Unfiled*, *All panels* and *Help* files that panel or guide into one of your groups (or the top level). The row stays where it is: the built-in groups never change.
- On your own items: **▲ ▼** move an item within its group, **move to ▾** puts it in another group, **✎** renames a group, **✕** removes an item. Removing a group removes everything in it, and the panel asks first unless the group is empty.

Your groups hold *references*, so the same panel can appear in several of them, and every copy opens the same tab. If something you filed no longer exists (a guide was removed, or the panel belongs to a module this mode does not load), it stays in your group, greyed out with its name, until you remove it.

## Unfiled

Once you have your own groups, *Unfiled* lists every panel and guide that none of them contains, so a panel added to the app later still shows up. It is hidden when there is nothing left to file, and while you have no groups at all (then *All panels* and *Help* already show everything).

## Where the arrangement is saved

The arrangement is a setting, **Arrangement** (`moduleSettings.quickLaunch.tree`), saved with the rest of your settings for the current mode. So each mode has its own arrangement, and a fresh mode starts with none.

Two more settings are saved the same way:

- **View** (`moduleSettings.quickLaunch.view`) — `tree` or `cards`, whichever the **Cards** button last chose.
- **Collapsed groups** (`moduleSettings.quickLaunch.collapsedGroups`) — which of *your own* groups are folded shut. Folding a built-in group (*All panels*, a category, *Help*, *Unfiled*) lasts until the page is reloaded, and is not saved. The text in the filter box is never saved.

- The Options panel's *All Settings* view shows it as JSON (filter for `quickLaunch`); you can edit it there. Each item is `{id, kind, ...}` with `kind` one of `group` (`label`, `children`), `panel` (`ref`: the panel's component type), `doc` (`ref`: the guide's path) or `url` (`href`, `label`).
- The JSON panel's settings export and import carry it too.
- **Reset to Defaults** in the Options panel empties it (and sets the view back to tree, with no groups folded).
- ⚠ Saved settings are only reloaded when the page address names the mode (for example `?mode=default`) or when **Auto-load Mode** is on in the Options panel. Without either, the page starts from the default settings: your groups are not shown, and the next setting you change is saved over them.

## Reopening a closed panel

Closing a tab with its **×** disables its module. To get it back, click its button in **All panels** (or tick it in the Modules panel). If you closed the Quick Launch panel itself, reopen it from the Modules panel.

## Settings

**Docs link target** (Options panel, `quickLaunch` section):

- `github` (default) — guide links open on GitHub. Works everywhere.
- `local` — guide links open the copy served by this server. Works on the local dev server; on the published GitHub Pages site these links 404, because the Pages site does not include the user guides.
