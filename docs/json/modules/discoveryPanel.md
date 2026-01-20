# Discovery Panel Module

**Module ID:** `discoveryPanel`

**Purpose:** Provides a UI panel for managing discovery mode settings and displaying discovered items. Allows users to enable/configure discovery mode, view lists of discovered regions/locations/exits, and perform debug operations.

## Key Files

- `frontend/modules/discoveryPanel/index.js` - Module entry point and registration
- `frontend/modules/discoveryPanel/discoveryPanelUI.js` - UI component implementation

## Responsibilities

- **Discovery Mode Toggle:** Checkbox to enable/disable discovery mode
- **Region Discovery Settings:** Configure when regions are marked discovered (on enter, etc.)
- **Auto-Discovery Options:** Automatically discover locations and exits when regions are entered
- **Undiscovered Display Settings:** Choose how undiscovered items appear (hidden, placeholders, with/without details)
- **Discovered Items Display:** Shows organized lists of discovered regions, locations, and exits
- **Section Collapsing:** Collapse/expand sections for regions, locations, and exits
- **Location Click Discovery:** Option to mark locations as discovered when clicked
- **Debug Operations:** Bulk mark all items as discovered or reset all
- **Settings Persistence:** Loads/saves discovery settings to settings manager
- **Real-Time Updates:** Updates UI when discovery state changes

## Events Published

This module does not publish any events. It is a consumer of discovery events.

## Events Subscribed To

| Event | Handler |
|-------|---------|
| `app:readyForUiDataLoad` | Defers initialization until app is ready |
| `discovery:changed` | Refreshes displayed lists when discovery state changes |
| `settings:changed` | Updates UI when settings change |
| `stateManager:rulesLoaded` | Resets panel when new rules are loaded |

## Public Functions

This module does not register public functions. It is purely a UI panel component.

## Dependencies & Interactions

- **`discoveryStateSingleton`:** Queries discovery state; calls mark functions for bulk discovery
- **`stateManager`:** Gets current game data (regions, locations, exits)
- **`settingsManager`:** Loads and persists discovery mode settings
- **`eventBus`:** Subscribes to discovery and state manager events
- **`commonUI`:** Uses debounce utility for performance

## UI Sections

### Settings Section

Controls for discovery mode behavior:

- **Enable Discovery Mode** - Master toggle
- **Region Discovery Trigger** - When to mark regions discovered
- **Auto-discover Locations** - Mark locations when region entered
- **Auto-discover Exits** - Mark exits when region entered
- **Undiscovered Display** - Hidden, visible as "???", or with details
- **Click to Discover** - Mark locations discovered on click

### Discovered Regions

Lists all regions marked as discovered:
- Colored indicators showing accessibility status
- Click to navigate to region in other panels

### Discovered Locations

Lists discovered locations grouped by region:
- Shows parent region for each location
- Color indicates accessibility status

### Discovered Exits

Lists discovered exits grouped by source region:
- Shows source → target region connection
- Color indicates accessibility status

### Debug Section

Bulk operations for testing:
- **Mark All Discovered** - Discover all regions, locations, exits
- **Reset All** - Clear all discovery state

## Settings Keys

The module manages these settings:

| Setting | Type | Description |
|---------|------|-------------|
| `discoveryMode.enabled` | `boolean` | Master enable/disable |
| `discoveryMode.regionTrigger` | `string` | When regions are discovered |
| `discoveryMode.autoDiscoverLocations` | `boolean` | Auto-discover locations |
| `discoveryMode.autoDiscoverExits` | `boolean` | Auto-discover exits |
| `discoveryMode.undiscoveredDisplay` | `string` | How to show undiscovered items |
| `discoveryMode.clickToDiscover` | `boolean` | Click marks as discovered |

## Integration with Discovery System

The Discovery Panel is the primary UI for the discovery feature:

1. **Discovery Module** (`discovery`) - Core state management for discovered items
2. **Discovery Panel** (`discoveryPanel`) - This module; UI for settings and display
3. **Region Graph** - Respects discovery mode for node visibility
4. **Locations Panel** - Respects discovery mode for location visibility
5. **Text Adventure** - Respects discovery mode for descriptions

When discovery mode is enabled:
- Only discovered regions appear in navigation
- Only discovered locations can be checked
- Undiscovered items show as "???" or are hidden based on settings
