# Quick Launch Panel

The Quick Launch panel is the first tab of the left column in the default layout. It lists every panel the app has registered, with a button to open each one, and links to the user guides.

The header line counts what it lists: *N panels · M guides*. The **Modules ⇄** button opens the [Modules panel](modules.md).

## All panels

One button per panel, in the app's standard (load-priority) order. Each shows the panel's icon and title, and a dot:

- **Filled green dot** — the panel's module is enabled, so its tab is open.
- **Hollow dot** — the panel is closed.

Clicking a button brings that panel's tab forward. If the panel was closed, it is reopened in its usual column — the same thing ticking its checkbox in the Modules panel does. Hover a button to read the panel's description.

A **?** after a button links to that panel's user guide, when it has one.

## Help

Links to the user guides: the general guides first, then one per panel. Every link opens in a new browser tab.

## Reopening a closed panel

Closing a tab with its **×** disables its module. To get it back, click its button in **All panels** (or tick it in the Modules panel). If you closed the Quick Launch panel itself, reopen it from the Modules panel.

## Settings

**Docs link target** (Options panel, `quickLaunch` section):

- `github` (default) — guide links open on GitHub. Works everywhere.
- `local` — guide links open the copy served by this server. Works on the local dev server; on the published GitHub Pages site these links 404, because the Pages site does not include the user guides.

## Coming later

- **Your own groups** — arrange buttons and links into your own nested groups, with an edit mode; panels you have not placed stay listed in an *Unfiled* group.
- **A cards view** — the same groups with each panel's description shown, plus a filter box and category grouping.
