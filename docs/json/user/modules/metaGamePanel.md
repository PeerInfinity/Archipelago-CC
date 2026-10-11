# MetaGame Panel

The MetaGame panel lets you load and manage scripted scenarios (MetaGame configurations) that orchestrate automated sequences of events, progress bars, and other interactive experiences.

> ⚠ **Deprecated** (2026-10-11). The Meta Game and Progress Bars panels and their MetaGame / ProgressBar modules are kept in the code but disabled in every launch mode, and are no longer maintained. See [Deprecated Panels](../../modules/README.md#deprecated-panels).

## Loading a Configuration

Select a configuration from the dropdown (e.g., "Progress Bar Test") and press **Load Configuration** to load and activate it. The panel shows a status message confirming success or describing any error.

## Editing Configuration

Once a configuration is loaded, its JSON data appears in a textarea. You can edit the values and click **Apply JSON Configuration** to update the running scenario without reloading.

## Viewing Source

Click **View js file contents** to send the full JavaScript source of the selected configuration to the [Editor](editor.md) panel for inspection.

## Clearing

Click **Clear** to unload the current MetaGame scenario, removing its event handlers and returning to the default state.
