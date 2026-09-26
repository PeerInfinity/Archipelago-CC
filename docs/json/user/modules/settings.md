# Settings Panel

The Settings panel lets you view and edit all application settings as raw JSON. Changes take effect immediately across the entire application.

## Editing Settings

The panel displays the complete settings object in a JSON textarea. Edit the JSON directly to change any setting — colorblind mode, display preferences, module-specific options, and more.

## Applying Changes

- Click **Apply** or press **Ctrl+Enter** to push your changes to the application.
- On success, the button briefly flashes green with "Applied!" text.
- On failure (e.g., invalid JSON), the button flashes red with "Error!" and an alert shows the error details.

Changes are applied live — other panels react immediately to updated settings without needing to reload the page.

## Persistence

Applying also saves the settings to the current mode in your browser's localStorage, so they are still there after a reload. To save them to a file, or under another mode name, use the [JSON Panel](json.md).
