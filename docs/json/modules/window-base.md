# Window Base Module

**Module ID:** `window-base`

**Purpose:** Provides a communication client for standalone applications opened via `window.open()`. Uses `window.opener` for parent window communication, providing identical API to IframeClient.

## Key Files

- `frontend/modules/window-base/windowClient.js` - Main communication client
- `frontend/modules/window-base/standalone.js` - Standalone app entry point
- `frontend/modules/window-base/mockDependencies.js` - Mock implementations for testing
- `frontend/modules/window-base/index.html` - Example standalone page
- `frontend/modules/window-base/shared/` - Shared utilities (logger)

## Responsibilities

- **Connection Management:** Establishes connection with opener window
- **Event Bridging:** Forwards EventBus and EventDispatcher events between windows
- **State Caching:** Caches state snapshots and static data from opener
- **Heartbeat:** Periodic connection health checks

## WindowClient API

The API is identical to IframeClient (drop-in replacement):

```javascript
import { WindowClient } from './windowClient.js';

const client = new WindowClient({
    windowId: 'my-app',  // Optional, auto-generated if not provided
    heartbeatInterval: 30000  // Optional, default 30s
});

// Connect to opener window
await client.connect();

// Subscribe to events (same as IframeClient)
client.subscribeEventBus('stateManager:snapshotUpdated', (data) => {
    console.log('State updated:', data);
});

// Publish events
client.publishEventBus('myApp:customEvent', { value: 42 });

// Request/access data
await client.requestStaticData();
const snapshot = client.getStateSnapshot();

// Connection management
client.startHeartbeat();
client.disconnect();
```

## Key Differences from IframeClient

| Aspect | IframeClient | WindowClient |
|--------|--------------|--------------|
| Parent Reference | `window.parent` | `window.opener` |
| ID Parameter | `iframeId` | `windowId` (or `iframeId` for compat) |
| Connection Check | Parent exists | Opener exists and not closed |
| Window Relationship | Embedded | Separate browser window |

## Features

- **Auto ID Generation:** Generates unique window ID if not provided
- **Backward Compatibility:** Accepts both `windowId` and `iframeId` parameters
- **Opener Validation:** Verifies opener window exists before connection
- **Detailed Diagnostics:** Enhanced logging for window context debugging
- **Drop-in Replacement:** Same API as IframeClient

## Integration with windowAdapter

The `window-base` module is the client-side counterpart to the `windowAdapter` module:

```
┌─────────────────────┐     postMessage     ┌─────────────────────┐
│   Opener Window     │◄───────────────────►│   Popup Window      │
│   (windowAdapter)   │                     │   (WindowClient)    │
└─────────────────────┘                     └─────────────────────┘
```

## Usage Example

```javascript
// In popup window opened via window.open()
import { WindowClient } from './windowClient.js';

const client = new WindowClient();

try {
    await client.connect();
    console.log('Connected to opener');

    // Subscribe to state updates
    client.subscribeEventBus('stateManager:snapshotUpdated', updateUI);

    // Start heartbeat for connection health
    client.startHeartbeat();
} catch (error) {
    console.error('Failed to connect:', error);
}
```

## When to Use

Use `WindowClient` instead of `IframeClient` when:
- Your app is opened via `window.open()`
- You need a separate browser window (not embedded)
- Users may want to move the window to another monitor
- You need popup-style interaction

## Dependencies

- Uses communication protocol from `windowAdapter/communicationProtocol.js`
- Optional shared logger for debugging
- No external library dependencies
