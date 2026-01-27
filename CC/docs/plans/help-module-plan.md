# Help Module Plan

**Created:** 2026-01-19
**Status:** Pending
**Priority:** Medium

## Overview

Create a multi-page `help` module that serves as both a first-visit intro panel and an always-accessible help resource. The module will display a localStorage notice on first visit and provide quick-start guidance and documentation links.

## Goals

1. Inform users about localStorage usage on first visit
2. Provide essential getting-started information
3. Link to detailed documentation on GitHub
4. Create a foundation for future demo/configuration links
5. Keep the module lightweight (don't embed full documentation)

## Design

### Module Structure

```
frontend/modules/help/
├── index.js           # Module registration and lifecycle
├── helpUI.js          # Main UI component (Golden Layout panel)
├── helpPages.js       # Page content definitions
└── helpStyles.css     # Module-specific styles (optional)
```

### Page Structure

| Page | ID | Purpose | Content |
|------|----|---------|---------|
| Welcome | `welcome` | First-visit intro + localStorage notice | Brief intro, localStorage notice, acknowledgment button |
| Quick Start | `quickstart` | Essential getting-started tips | 5-10 bullet points on basic usage |
| Documentation | `docs` | Links to detailed docs | Links to GitHub documentation |
| Demos | `demos` | Configuration links (future) | Deferred - placeholder or hidden initially |

### Welcome Page Content

```
Welcome to the Archipelago JSON Tools Web Client

This application provides advanced tracking and analysis tools for
Archipelago multiworld randomizer games.

--- localStorage Notice ---
This application stores your settings, layout preferences, and game
state in your browser's localStorage. No data is sent to any server.

[x] Don't show this on startup

[Continue]
```

### Quick Start Page Content

- How to load a game preset (Presets panel → select game)
- How to load your own rules.json file
- How to connect to an Archipelago server
- Basic panel interaction (drag, drop, resize)
- How to check locations and add items
- How to use path analysis
- Link to full Quick Start guide on GitHub

### Documentation Page Content

Links to:
- [User Overview](docs/json/user/overview.md)
- [Quick Start Guide](docs/json/user/quick-start.md)
- [Tips & Tricks / FAQ](docs/json/user/tips-and-tricks.md)
- [Project Roadmap](docs/json/project-roadmap.md)
- [Report an Issue](https://github.com/PeerInfinity/Archipelago-CC/issues)

## Technical Implementation

### Settings Integration

Add to `settings.schema.json`:
```json
{
  "help": {
    "showWelcomeOnStartup": {
      "type": "boolean",
      "default": true,
      "description": "Show welcome page when app loads"
    },
    "hasSeenWelcome": {
      "type": "boolean",
      "default": false,
      "description": "User has seen the welcome page at least once"
    }
  }
}
```

### Module Registration

```javascript
export const moduleInfo = {
    name: 'help',
    displayName: 'Help',
    componentType: 'helpPanel',
    description: 'Help and documentation'
};

export function register(api) {
    api.registerPanelComponent('helpPanel', HelpUI);
}

export function initialize(api) {
    // Check if should show welcome on startup
    const settings = api.getSettings();
    if (settings.help?.showWelcomeOnStartup !== false &&
        !settings.help?.hasSeenWelcome) {
        api.openPanel('helpPanel', { page: 'welcome' });
    }
}
```

### Panel State

The panel should remember which page the user was on:
- Store current page in panel state
- Default to 'welcome' if `hasSeenWelcome` is false
- Default to 'quickstart' otherwise

### UI Components

**Navigation**: Simple tab bar or sidebar with page links
```
[Welcome] [Quick Start] [Documentation] [Demos]
```

**Page Container**: Scrollable content area that renders the current page

**Footer** (Welcome page only):
```
[x] Don't show on startup    [Continue →]
```

### Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `help:pageChanged` | Published | Notify when user navigates to different page |
| `help:welcomeAcknowledged` | Published | User clicked Continue on welcome page |

### CSS Considerations

- Use existing app styles where possible
- Welcome page should feel slightly different (centered, modal-like feel within the panel)
- Quick Start and Docs pages should be readable with good typography
- Links should be clearly styled

## Implementation Steps

### Phase 1: Basic Module Setup
- [ ] Create module directory structure
- [ ] Implement basic module registration
- [ ] Create simple panel that displays static welcome content
- [ ] Add to modules.json (disabled by default initially for testing)

### Phase 2: Multi-Page Navigation
- [ ] Implement page switching logic
- [ ] Add navigation UI (tabs or sidebar)
- [ ] Create content for all initial pages
- [ ] Style the pages

### Phase 3: Settings Integration
- [ ] Add settings to schema
- [ ] Implement "Don't show on startup" checkbox
- [ ] Implement auto-open on first visit
- [ ] Test persistence across sessions

### Phase 4: Polish
- [ ] Refine content and wording
- [ ] Test on different screen sizes
- [ ] Add keyboard navigation (optional)
- [ ] Enable module by default
- [ ] Update modules.json default layout to include help panel (or not - TBD)

### Phase 5: Documentation (Future)
- [ ] Create module documentation (docs/json/modules/help.md)
- [ ] Add Demos page content when configurations are ready

## Open Questions

1. **Default layout position**: Should the help panel be in the default layout, or only accessible via Modules panel?

2. **Auto-open behavior**: Should it open as a modal overlay, or as a regular panel? Regular panel is simpler and consistent with the app.

3. **Welcome page timing**: Should it open immediately on load, or after a short delay to let the UI settle?

4. **Demos page**: Include as placeholder now, or add later when we have configurations to link to?

5. **Keyboard shortcut**: Should there be a shortcut to open help (e.g., F1 or `?`)?

## Dependencies

- `settingsManager` - For storing/retrieving help preferences
- `panelManager` - For opening the panel programmatically
- Golden Layout - For panel integration

## Related Documents

- [Module System Guide](../../docs/json/developer/guides/module-system.md)
- [Creating Modules Guide](../../docs/json/developer/guides/creating-modules.md)
- [User Quick Start](../../docs/json/user/quick-start.md)
- [Tips & Tricks](../../docs/json/user/tips-and-tricks.md)
