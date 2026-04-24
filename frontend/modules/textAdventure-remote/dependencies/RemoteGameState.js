// Remote Game State wrapper
// Provides gameState-compatible interface using a client (IframeClient or WindowClient)

/**
 * RemoteGameState wraps a client to provide the same interface as gameState
 * Used in remote contexts (iframe or separate window) to manage game state
 *
 * Note: Game state in remote context is managed locally within the remote instance
 * and synced with main app via dispatcher events
 */
export class RemoteGameState {
    constructor(client) {
        this.client = client;
        this.currentRegion = null;

        // Subscribe to region change events from main app
        this.client.subscribeEventBus('gameState:regionChanged', (data) => {
            console.log('[RemoteGameState] Received gameState:regionChanged:', data);
            if (data && data.newRegion) {
                this.currentRegion = data.newRegion;
                console.log('[RemoteGameState] Updated currentRegion to:', this.currentRegion);
            }
        });

        // Initialize current region from cached state if available
        this.initializeFromCache();

        // Request a fresh snapshot to trigger any recent events
        // This ensures we get the current region even if the event was published before we subscribed
        this.requestUpdate();
    }

    /**
     * Initialize current region from cached state snapshot
     */
    initializeFromCache() {
        const snapshot = this.client.getStateSnapshot();
        console.log('[RemoteGameState] initializeFromCache - snapshot:', snapshot);
        console.log('[RemoteGameState] snapshot?.currentRegion:', snapshot?.currentRegion);
        if (snapshot && snapshot.currentRegion) {
            this.currentRegion = snapshot.currentRegion;
            console.log('[RemoteGameState] Set currentRegion to:', this.currentRegion);
        } else {
            console.log('[RemoteGameState] No currentRegion in snapshot');

            // Try to get current region from main window's GameState
            if (window.parent && window.parent !== window) {
                try {
                    const parentGameState = window.parent.getGameStateSingleton?.();
                    if (parentGameState) {
                        this.currentRegion = parentGameState.getCurrentRegion();
                        console.log('[RemoteGameState] Got currentRegion from parent GameState:', this.currentRegion);
                    }
                } catch (e) {
                    console.log('[RemoteGameState] Could not access parent GameState:', e.message);
                }
            }
        }
    }

    /**
     * Get current region
     * @returns {string|null} Current region name
     */
    getCurrentRegion() {
        return this.currentRegion;
    }

    /**
     * Set current region
     * Note: This sets it locally and is typically followed by a dispatcher event
     * to sync with main app
     * @param {string} regionName - Region name to set
     */
    setCurrentRegion(regionName) {
        this.currentRegion = regionName;
    }

    /**
     * Request fresh game state from main app
     * This will trigger a region changed event if the region has changed
     */
    requestUpdate() {
        this.client.requestStateSnapshot();
    }
}
