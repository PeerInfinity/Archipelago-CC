// A-Mazing-Idle integration client for Archipelago iframe adapter
// Connects the maze game to the Archipelago eventBus via IframeClient
import { IframeClient } from '../iframe-base/iframeClient.js';

const LOG_PREFIX = '[MazeGameClient]';

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
 * Wait for the game to initialize (maze tbody has child rows)
 * @param {number} timeoutMs - Maximum wait time
 * @returns {Promise<void>}
 */
function waitForGameReady(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        function check() {
            const tbody = document.querySelector('#maze tbody');
            if (tbody && tbody.children.length > 0) {
                console.log(`${LOG_PREFIX} Game initialized (maze has ${tbody.children.length} rows)`);
                resolve();
                return;
            }
            if (Date.now() - startTime > timeoutMs) {
                reject(new Error('Timed out waiting for game initialization'));
                return;
            }
            setTimeout(check, 100);
        }

        check();
    });
}

/**
 * Set up MutationObserver on #maze to detect maze completions.
 * The game rebuilds the maze DOM on completion, producing many childList mutations.
 * @param {IframeClient} client
 */
function setupMazeCompletionDetection(client) {
    const mazeElement = document.querySelector('#maze');
    if (!mazeElement) {
        console.warn(`${LOG_PREFIX} #maze element not found, skipping completion detection`);
        return;
    }

    let completionCount = 0;
    // Debounce: maze rebuild produces ~63 mutations at once for a 5x5 maze.
    // We batch them and fire one event per rebuild.
    let debounceTimer = null;

    const observer = new MutationObserver((mutations) => {
        const childChanges = mutations.filter(m => m.type === 'childList');
        if (childChanges.length === 0) return;

        // Debounce: wait for the batch of mutations to settle
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            completionCount++;
            console.log(`${LOG_PREFIX} Maze completed (#${completionCount}, ${childChanges.length} DOM changes)`);

            client.publishEventBus('amazingIdle:mazeCompleted', {
                completionCount,
                mutationCount: childChanges.length,
                timestamp: Date.now()
            });
        }, 50);
    });

    observer.observe(mazeElement, { childList: true, subtree: true });
    console.log(`${LOG_PREFIX} Maze completion observer active`);
}

/**
 * Export the current game save from localStorage
 * @param {IframeClient} client
 */
function exportSave(client) {
    const saveData = localStorage.getItem('a-mazing-idle');
    if (saveData) {
        console.log(`${LOG_PREFIX} Exporting save (${saveData.length} chars)`);
        client.publishEventBus('amazingIdle:saveExported', {
            saveJson: saveData,
            timestamp: Date.now()
        });
    } else {
        console.warn(`${LOG_PREFIX} No save data found in localStorage`);
        client.publishEventBus('amazingIdle:saveExported', {
            saveJson: null,
            error: 'No save data found',
            timestamp: Date.now()
        });
    }
}

/**
 * Import a save by blocking the game's setItem, writing directly, and reloading
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
    origSetItem('a-mazing-idle', saveJson);

    // Reload to apply
    location.reload();
}

/**
 * Set up eventBus subscriptions for save import/export
 * @param {IframeClient} client
 */
function setupSaveSubscriptions(client) {
    // Listen for save export requests from the parent
    client.subscribeEventBus('amazingIdle:exportSave', () => {
        exportSave(client);
    });

    // Listen for save import requests from the parent
    client.subscribeEventBus('amazingIdle:importSave', (data) => {
        if (data && data.saveJson) {
            importSave(data.saveJson);
        } else {
            console.warn(`${LOG_PREFIX} importSave event received without saveJson`);
        }
    });

    console.log(`${LOG_PREFIX} Save subscriptions active`);
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
        window.mazeGameClient = client;

        // 3. Set up maze completion detection
        setupMazeCompletionDetection(client);

        // 4. Set up save import/export subscriptions
        setupSaveSubscriptions(client);

        // 5. Notify adapter that we're fully ready
        client.notifyAppReady();

        updateConnectionStatus('Ready - A-Mazing-Idle loaded', 'connected');
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
