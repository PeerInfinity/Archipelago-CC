// Journey to Ascension integration client for Archipelago iframe adapter
// Connects the JTA game to the Archipelago eventBus via IframeClient
import { IframeClient } from '../iframe-base/iframeClient.js';

const LOG_PREFIX = '[JTAGameClient]';
const SAVE_KEY = 'incrementalGameSave';

/**
 * Update connection status bar in UI
 * @param {string} status - Status message
 * @param {string} type - Status type ('connecting', 'connected', 'error')
 */
function updateConnectionStatus(status, type = 'connecting') {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `connection-status ${type}`;
    }
}

/**
 * Trigger the game's save function to flush state to localStorage
 */
function triggerManualSave() {
    if (window.saveGame) {
        window.saveGame();
    }
}

/**
 * Wait for the game to initialize (game-area becomes visible)
 * @param {number} timeoutMs - Maximum wait time
 * @returns {Promise<void>}
 */
function waitForGameReady(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        function check() {
            const gameArea = document.getElementById('game-area');
            // Game removes 'hidden' class when ready
            if (gameArea && !gameArea.classList.contains('hidden')) {
                console.log(`${LOG_PREFIX} Game initialized (game-area visible)`);
                resolve();
                return;
            }
            // Also check if GAMESTATE is available on window
            if (window.getGamestate && typeof window.getGamestate === 'object') {
                console.log(`${LOG_PREFIX} Game initialized (GAMESTATE available)`);
                resolve();
                return;
            }
            if (Date.now() - startTime > timeoutMs) {
                reject(new Error('Timed out waiting for game initialization'));
                return;
            }
            setTimeout(check, 200);
        }

        check();
    });
}

/**
 * Read game state summary from the live GAMESTATE object
 * @returns {object|null}
 */
function readGameState() {
    const gs = window.getGamestate;
    if (!gs) return null;

    // Count perks (it's a Map<PerkType, boolean>)
    let perkCount = 0;
    if (gs.perks instanceof Map) {
        for (const [, owned] of gs.perks) {
            if (owned) perkCount++;
        }
    }

    return {
        currentZone: gs.current_zone,
        highestZone: gs.highest_zone,
        highestZoneEver: gs.highest_zone_ever,
        currentEnergy: gs.current_energy,
        maxEnergy: gs.max_energy,
        energyResetCount: gs.energy_reset_count,
        prestigeCount: gs.prestige_count,
        perkCount,
        isAtEndOfContent: gs.is_at_end_of_content,
    };
}

/**
 * Set up polling to detect game state changes and publish events
 * @param {IframeClient} client
 */
function setupStateChangeDetection(client) {
    let lastZone = -1;
    let lastResetCount = -1;
    let lastPrestigeCount = -1;
    let lastPerkCount = -1;

    // Initialize from current state
    const gs = window.getGamestate;
    if (gs) {
        lastZone = gs.current_zone;
        lastResetCount = gs.energy_reset_count;
        lastPrestigeCount = gs.prestige_count;
        if (gs.perks instanceof Map) {
            for (const [, owned] of gs.perks) {
                if (owned) lastPerkCount++;
            }
            if (lastPerkCount === -1) lastPerkCount = 0;
        }
    }

    setInterval(() => {
        const gs = window.getGamestate;
        if (!gs) return;

        // Zone change detection
        if (gs.current_zone !== lastZone) {
            const prevZone = lastZone;
            lastZone = gs.current_zone;
            if (prevZone >= 0) {
                console.log(`${LOG_PREFIX} Zone changed: ${prevZone} -> ${gs.current_zone}`);
                client.publishEventBus('jta:zoneChanged', {
                    previousZone: prevZone,
                    currentZone: gs.current_zone,
                    highestZone: gs.highest_zone,
                    timestamp: Date.now()
                });
            }
        }

        // Energy reset detection
        if (gs.energy_reset_count !== lastResetCount) {
            const prevCount = lastResetCount;
            lastResetCount = gs.energy_reset_count;
            if (prevCount >= 0) {
                console.log(`${LOG_PREFIX} Energy reset #${gs.energy_reset_count}`);
                client.publishEventBus('jta:energyReset', {
                    resetCount: gs.energy_reset_count,
                    timestamp: Date.now()
                });
            }
        }

        // Prestige detection
        if (gs.prestige_count !== lastPrestigeCount) {
            const prevCount = lastPrestigeCount;
            lastPrestigeCount = gs.prestige_count;
            if (prevCount >= 0) {
                console.log(`${LOG_PREFIX} Prestige #${gs.prestige_count}`);
                client.publishEventBus('jta:prestige', {
                    prestigeCount: gs.prestige_count,
                    timestamp: Date.now()
                });
            }
        }

        // Perk grant detection
        let currentPerkCount = 0;
        if (gs.perks instanceof Map) {
            for (const [, owned] of gs.perks) {
                if (owned) currentPerkCount++;
            }
        }
        if (currentPerkCount !== lastPerkCount && lastPerkCount >= 0) {
            lastPerkCount = currentPerkCount;
            console.log(`${LOG_PREFIX} Perk count changed to ${currentPerkCount}`);
            client.publishEventBus('jta:perkChanged', {
                perkCount: currentPerkCount,
                timestamp: Date.now()
            });
        }
        lastPerkCount = currentPerkCount;

    }, 500); // Poll every 500ms

    console.log(`${LOG_PREFIX} State change detection active`);
}

/**
 * Export the current game save from localStorage
 * @param {IframeClient} client
 */
function exportSave(client) {
    triggerManualSave();
    const saveData = localStorage.getItem(SAVE_KEY);
    if (saveData) {
        console.log(`${LOG_PREFIX} Exporting save (${saveData.length} chars)`);
        client.publishEventBus('jta:saveExported', {
            saveJson: saveData,
            timestamp: Date.now()
        });
    } else {
        console.warn(`${LOG_PREFIX} No save data found in localStorage`);
        client.publishEventBus('jta:saveExported', {
            saveJson: null,
            error: 'No save data found',
            timestamp: Date.now()
        });
    }
}

/**
 * Import a save by writing to localStorage and reloading
 * @param {string} saveJson - JSON string of the save data
 */
function importSave(saveJson) {
    console.log(`${LOG_PREFIX} Importing save (${saveJson.length} chars)`);

    // Validate JSON
    try {
        JSON.parse(saveJson);
    } catch (e) {
        console.error(`${LOG_PREFIX} Invalid save JSON:`, e.message);
        return;
    }

    // Block the game's own saves during import
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function() {};

    // Write the save data directly
    origSetItem(SAVE_KEY, saveJson);

    // Reload to apply
    location.reload();
}

/**
 * Set up eventBus subscriptions for save import/export and game commands
 * @param {IframeClient} client
 */
function setupSubscriptions(client) {
    // Save export requests
    client.subscribeEventBus('jta:exportSave', () => {
        exportSave(client);
    });

    // Save import requests
    client.subscribeEventBus('jta:importSave', (data) => {
        if (data && data.saveJson) {
            importSave(data.saveJson);
        } else {
            console.warn(`${LOG_PREFIX} importSave event received without saveJson`);
        }
    });

    // Request game state snapshot
    client.subscribeEventBus('jta:requestState', () => {
        const state = readGameState();
        client.publishEventBus('jta:stateSnapshot', {
            state,
            timestamp: Date.now()
        });
    });

    console.log(`${LOG_PREFIX} Subscriptions active`);
}

/**
 * Main initialization flow
 */
async function initialize() {
    try {
        console.log(`${LOG_PREFIX} Starting initialization...`);

        // Hide connection status when embedded in iframe panel
        if (window.self !== window.top) {
            document.body.classList.add('iframe-embedded');
        }

        updateConnectionStatus('Waiting for game to load...');

        // 1. Wait for game DOM ready
        await waitForGameReady();

        updateConnectionStatus('Connecting to Archipelago...');

        // 2. Create IframeClient and connect
        const client = new IframeClient();
        const connected = await client.connect();

        if (!connected) {
            throw new Error('Failed to establish connection with Archipelago adapter');
        }

        console.log(`${LOG_PREFIX} Connected to Archipelago adapter`);
        updateConnectionStatus('Connected', 'connected');

        // Make client available for debugging
        window.jtaGameClient = client;

        // 3. Set up state change detection (zone changes, resets, perks)
        setupStateChangeDetection(client);

        // 4. Set up save import/export and command subscriptions
        setupSubscriptions(client);

        // 5. Notify adapter that we're fully ready
        client.notifyAppReady();

        updateConnectionStatus('Ready - Journey to Ascension loaded', 'connected');
        console.log(`${LOG_PREFIX} Initialization complete`);

    } catch (error) {
        console.error(`${LOG_PREFIX} Initialization failed:`, error);
        updateConnectionStatus(`Error: ${error.message}`, 'error');
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
