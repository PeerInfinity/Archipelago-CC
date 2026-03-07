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
 * Read detailed game state for simulator comparison.
 * Extracts skill levels, perks, items, power/attunement, prestige, and
 * per-task computed values from the live GAMESTATE.
 * @returns {object|null}
 */
function readDetailedGameState() {
    const gs = window.getGamestate;
    if (!gs) return null;

    // Skills: array of {type, level, progress, speed_modifier}
    const skills = {};
    if (Array.isArray(gs.skills)) {
        for (const skill of gs.skills) {
            skills[skill.type] = {
                level: skill.level,
                xp: skill.progress,
                speedModifier: skill.speed_modifier,
            };
        }
    }

    // Perks: array of perk type IDs that are owned
    const perks = [];
    if (gs.perks instanceof Map) {
        for (const [perkType, owned] of gs.perks) {
            if (owned) perks.push(perkType);
        }
    }

    // Items: object of itemType -> count
    const items = {};
    if (gs.items instanceof Map) {
        for (const [itemType, count] of gs.items) {
            if (count > 0) items[itemType] = count;
        }
    }

    // Prestige unlocks and repeatables
    const prestigeUnlocks = Array.isArray(gs.prestige_unlocks) ? [...gs.prestige_unlocks] : [];
    const prestigeRepeatables = {};
    if (gs.prestige_repeatables instanceof Map) {
        for (const [type, level] of gs.prestige_repeatables) {
            prestigeRepeatables[type] = level;
        }
    }

    // Per-task data for current zone's tasks (Task objects with runtime state)
    const tasks = [];
    if (Array.isArray(gs.tasks)) {
        for (const task of gs.tasks) {
            const def = task.task_definition;
            tasks.push({
                id: def.id,
                name: def.name,
                type: def.type,
                zoneId: def.zone_id,
                costMult: def.cost_multiplier,
                skills: [...def.skills],
                xpMult: def.xp_mult,
                maxReps: def.max_reps,
                perk: def.perk,
                item: def.item,
                useItem: def.use_item,
                hidden: def.hidden_by_default,
                // Runtime state
                progress: task.progress,
                reps: task.reps,
                enabled: task.enabled,
                hasted: task.hasted,
                xpBoosted: task.xp_boosted,
                lightning: task.lightning,
            });
        }
    }

    return {
        // Zone/energy
        currentZone: gs.current_zone,
        highestZone: gs.highest_zone,
        highestZoneEver: gs.highest_zone_ever,
        highestZoneFullyCompleted: gs.highest_zone_fully_completed,
        highestZoneFullyCompletedEver: gs.highest_zone_fully_completed_ever,
        currentEnergy: gs.current_energy,
        maxEnergy: gs.max_energy,
        energyResetCount: gs.energy_reset_count,
        // Skills, perks, items
        skills,
        perks,
        items,
        // Power/attunement
        power: gs.power,
        attunement: gs.attunement,
        // Prestige
        prestigeCount: gs.prestige_count,
        prestigeUnlocks,
        prestigeRepeatables,
        // Artifacts
        queuedScrollsOfHaste: gs.queued_scrolls_of_haste,
        queuedMagicRings: gs.queued_magic_rings,
        queuedLightning: gs.queued_lightning,
        // Current zone tasks with runtime state
        tasks,
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
    let lastIsInEnergyReset = false;

    // Initialize from current state
    const gs = window.getGamestate;
    if (gs) {
        lastZone = gs.current_zone;
        lastResetCount = gs.energy_reset_count;
        lastPrestigeCount = gs.prestige_count;
        lastIsInEnergyReset = !!gs.is_in_energy_reset;
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

        // Energy depleted detection (game-over overlay showing, game paused)
        if (gs.is_in_energy_reset && !lastIsInEnergyReset) {
            console.log(`${LOG_PREFIX} Energy depleted — game-over overlay showing`);
            client.publishEventBus('jta:energyDepleted', {
                resetCount: gs.energy_reset_count,
                timestamp: Date.now()
            });
        }
        lastIsInEnergyReset = gs.is_in_energy_reset;

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
 * Patch the live game runtime state.
 * Accepts a partial state object matching the detailedGameState structure.
 * Only provided fields are modified; omitted fields are untouched.
 * @param {object} patch
 * @param {IframeClient} client
 */
function patchGameState(patch, client) {
    const gs = window.getGamestate;
    if (!gs) {
        console.error(`${LOG_PREFIX} patchGameState: no GAMESTATE`);
        return;
    }

    let changes = 0;

    // Energy
    if (patch.currentEnergy !== undefined) { gs.current_energy = patch.currentEnergy; changes++; }
    if (patch.maxEnergy !== undefined) { gs.max_energy = patch.maxEnergy; changes++; }

    // Zone tracking
    if (patch.currentZone !== undefined) { gs.current_zone = patch.currentZone; changes++; }
    if (patch.highestZone !== undefined) { gs.highest_zone = patch.highestZone; changes++; }
    if (patch.highestZoneEver !== undefined) { gs.highest_zone_ever = patch.highestZoneEver; changes++; }
    if (patch.highestZoneFullyCompleted !== undefined) { gs.highest_zone_fully_completed = patch.highestZoneFullyCompleted; changes++; }
    if (patch.highestZoneFullyCompletedEver !== undefined) { gs.highest_zone_fully_completed_ever = patch.highestZoneFullyCompletedEver; changes++; }
    if (patch.energyResetCount !== undefined) { gs.energy_reset_count = patch.energyResetCount; changes++; }

    // Skills: { skillType: { level, xp, speedModifier } }
    if (patch.skills && Array.isArray(gs.skills)) {
        for (const [skillTypeStr, data] of Object.entries(patch.skills)) {
            const skillType = Number(skillTypeStr);
            const skill = gs.skills[skillType];
            if (!skill) continue;
            if (data.level !== undefined) { skill.level = data.level; changes++; }
            if (data.xp !== undefined) { skill.progress = data.xp; changes++; }
            if (data.speedModifier !== undefined) { skill.speed_modifier = data.speedModifier; changes++; }
        }
    }

    // Perks: array of perk type IDs to set as owned (replaces current perks)
    if (Array.isArray(patch.perks) && gs.perks instanceof Map) {
        gs.perks.clear();
        for (const perkType of patch.perks) {
            gs.perks.set(perkType, true);
        }
        changes++;
    }

    // Items: { itemType: count }
    if (patch.items && gs.items instanceof Map) {
        for (const [itemTypeStr, count] of Object.entries(patch.items)) {
            gs.items.set(Number(itemTypeStr), count);
        }
        changes++;
    }

    // Power / Attunement
    if (patch.power !== undefined) { gs.power = patch.power; changes++; }
    if (patch.attunement !== undefined) { gs.attunement = patch.attunement; changes++; }

    // Artifacts
    if (patch.queuedScrollsOfHaste !== undefined) { gs.queued_scrolls_of_haste = patch.queuedScrollsOfHaste; changes++; }
    if (patch.queuedMagicRings !== undefined) { gs.queued_magic_rings = patch.queuedMagicRings; changes++; }
    if (patch.queuedLightning !== undefined) { gs.queued_lightning = patch.queuedLightning; changes++; }

    // Prestige unlocks: array of PrestigeUnlockType values (replaces current)
    if (Array.isArray(patch.prestigeUnlocks)) {
        gs.prestige_unlocks = [...patch.prestigeUnlocks];
        changes++;
    }

    // Prestige repeatables: { type: level }
    if (patch.prestigeRepeatables && gs.prestige_repeatables instanceof Map) {
        for (const [typeStr, level] of Object.entries(patch.prestigeRepeatables)) {
            gs.prestige_repeatables.set(Number(typeStr), level);
        }
        changes++;
    }

    if (patch.prestigeCount !== undefined) { gs.prestige_count = patch.prestigeCount; changes++; }

    // Optionally rebuild current zone tasks after state changes
    if (patch.resetTasks && window.resetTasks) {
        window.resetTasks();
        changes++;
    }

    console.log(`${LOG_PREFIX} patchGameState: ${changes} changes applied`);
    client.publishEventBus('jta:gameStatePatched', { changes, timestamp: Date.now() });
}

/**
 * Patch task definitions in the game's ZONES/TASK_LOOKUP data.
 * Each entry in the patches array targets a task by ID and modifies its fields.
 * After patching, optionally calls resetTasks() to rebuild current zone.
 *
 * @param {object} data - { patches: [{id, perk?, item?, skills?, costMult?, xpMult?, maxReps?, ...}], resetTasks? }
 * @param {IframeClient} client
 */
function patchTaskDefs(data, client) {
    const taskLookup = window.TASK_LOOKUP;
    if (!taskLookup) {
        console.error(`${LOG_PREFIX} patchTaskDefs: TASK_LOOKUP not available on window`);
        client.publishEventBus('jta:taskDefsPatched', { error: 'TASK_LOOKUP not available', timestamp: Date.now() });
        return;
    }

    const patches = data.patches || [];
    let patched = 0;
    let notFound = 0;

    for (const patch of patches) {
        const def = taskLookup.get(patch.id);
        if (!def) {
            console.warn(`${LOG_PREFIX} patchTaskDefs: task ${patch.id} not found`);
            notFound++;
            continue;
        }

        if (patch.perk !== undefined) def.perk = patch.perk;
        if (patch.item !== undefined) def.item = patch.item;
        if (patch.useItem !== undefined) def.use_item = patch.useItem;
        if (patch.skills !== undefined) def.skills = [...patch.skills];
        if (patch.costMult !== undefined) def.cost_multiplier = patch.costMult;
        if (patch.xpMult !== undefined) def.xp_mult = patch.xpMult;
        if (patch.maxReps !== undefined) def.max_reps = patch.maxReps;
        if (patch.type !== undefined) def.type = patch.type;
        if (patch.name !== undefined) def.name = patch.name;
        if (patch.hidden !== undefined) def.hidden_by_default = patch.hidden;

        patched++;
    }

    // Rebuild current zone tasks so active Task objects pick up changes
    if (data.resetTasks !== false && window.resetTasks) {
        window.resetTasks();
    }

    console.log(`${LOG_PREFIX} patchTaskDefs: ${patched} patched, ${notFound} not found`);
    client.publishEventBus('jta:taskDefsPatched', { patched, notFound, timestamp: Date.now() });
}

/**
 * Replace the game's complete task definition data from a game data JSON zones array.
 * This patches every task in the provided zones data, effectively replacing all task
 * definitions. Used when loading randomized or cost-adjusted game data.
 *
 * @param {object} data - { zones: [{id, name, tasks: [...]}], resetTasks? }
 * @param {IframeClient} client
 */
function replaceGameData(data, client) {
    const taskLookup = window.TASK_LOOKUP;
    if (!taskLookup) {
        console.error(`${LOG_PREFIX} replaceGameData: TASK_LOOKUP not available on window`);
        client.publishEventBus('jta:gameDataReplaced', { error: 'TASK_LOOKUP not available', timestamp: Date.now() });
        return;
    }

    const zones = data.zones || [];
    let patched = 0;
    let notFound = 0;

    for (const zone of zones) {
        for (const task of zone.tasks) {
            const def = taskLookup.get(task.id);
            if (!def) {
                console.warn(`${LOG_PREFIX} replaceGameData: task ${task.id} not found`);
                notFound++;
                continue;
            }

            if (task.perk !== undefined) def.perk = task.perk;
            if (task.item !== undefined) def.item = task.item;
            if (task.skills !== undefined) def.skills = [...task.skills];
            if (task.costMult !== undefined) def.cost_multiplier = task.costMult;
            if (task.xpMult !== undefined) def.xp_mult = task.xpMult;
            if (task.maxReps !== undefined) def.max_reps = task.maxReps;
            if (task.type !== undefined) def.type = task.type;
            if (task.name !== undefined) def.name = task.name;
            if (task.hidden !== undefined) def.hidden_by_default = task.hidden;

            patched++;
        }
    }

    if (data.resetTasks !== false && window.resetTasks) {
        window.resetTasks();
    }

    console.log(`${LOG_PREFIX} replaceGameData: ${patched} tasks patched, ${notFound} not found`);
    client.publishEventBus('jta:gameDataReplaced', { patched, notFound, timestamp: Date.now() });
}

/**
 * Read the game's full zone/task definition data (for comparison with our gameData.js)
 * @returns {object|null}
 */
function readGameDefinitions() {
    const zones = window.ZONES;
    if (!zones) return null;

    return zones.map((zone, zoneId) => ({
        name: zone.name,
        zoneId,
        tasks: zone.tasks.map(def => ({
            id: def.id,
            name: def.name,
            type: def.type,
            zoneId: def.zone_id,
            costMult: def.cost_multiplier,
            skills: [...def.skills],
            xpMult: def.xp_mult,
            maxReps: def.max_reps,
            perk: def.perk,
            item: def.item,
            useItem: def.use_item,
            hidden: def.hidden_by_default,
        })),
    }));
}

/**
 * Read the game's item definitions (ITEMS array + ARTIFACTS list)
 * @returns {{ items: object[], artifacts: number[] }|null}
 */
function readItemDefinitions() {
    const items = window.ITEMS;
    const artifacts = window.ARTIFACTS;
    if (!items) return null;

    const itemDefs = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || !item.name) continue;
        itemDefs.push({
            index: i,
            enumValue: item.enum,
            name: item.name,
            namePlural: item.name_plural,
            icon: item.icon || '',
        });
    }

    return {
        items: itemDefs,
        artifacts: artifacts ? [...artifacts] : [],
    };
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

    // Request game state snapshot (summary)
    client.subscribeEventBus('jta:requestState', () => {
        const state = readGameState();
        client.publishEventBus('jta:stateSnapshot', {
            state,
            timestamp: Date.now()
        });
    });

    // Request detailed game state for simulator comparison
    client.subscribeEventBus('jta:requestDetailedState', () => {
        const detailedState = readDetailedGameState();
        client.publishEventBus('jta:detailedStateSnapshot', {
            state: detailedState,
            timestamp: Date.now()
        });
    });

    // Request game zone/task definitions
    client.subscribeEventBus('jta:requestGameDefs', () => {
        const defs = readGameDefinitions();
        const items = readItemDefinitions();
        client.publishEventBus('jta:gameDefsSnapshot', {
            zones: defs,
            items: items,
            timestamp: Date.now()
        });
    });

    // Patch runtime game state
    client.subscribeEventBus('jta:patchGameState', (data) => {
        patchGameState(data, client);
    });

    // Patch task definitions
    client.subscribeEventBus('jta:patchTaskDefs', (data) => {
        patchTaskDefs(data, client);
    });

    // Replace all game data (full zones array from game data JSON)
    client.subscribeEventBus('jta:replaceGameData', (data) => {
        replaceGameData(data, client);
    });

    // Click a task by definition ID (sets it as active_task)
    client.subscribeEventBus('jta:clickTask', (data) => {
        const gs = window.getGamestate;
        if (!gs) {
            client.publishEventBus('jta:taskClicked', { success: false, error: 'No GAMESTATE', timestamp: Date.now() });
            return;
        }
        const taskId = data.taskId;
        const task = gs.tasks.find(t => t.task_definition.id === taskId);
        if (!task) {
            console.warn(`${LOG_PREFIX} clickTask: task ${taskId} not found in current zone ${gs.current_zone}`);
            client.publishEventBus('jta:taskClicked', {
                success: false,
                taskId,
                error: `Task ${taskId} not in current zone`,
                timestamp: Date.now()
            });
            return;
        }
        if (window.clickTask) {
            window.clickTask(task);
            console.log(`${LOG_PREFIX} clickTask: activated task ${taskId} "${task.task_definition.name}"`);
            client.publishEventBus('jta:taskClicked', {
                success: true,
                taskId,
                taskName: task.task_definition.name,
                timestamp: Date.now()
            });
        } else {
            client.publishEventBus('jta:taskClicked', { success: false, taskId, error: 'clickTask not on window', timestamp: Date.now() });
        }
    });

    // Use an item (clickItem)
    client.subscribeEventBus('jta:clickItem', (data) => {
        if (window.clickItem) {
            window.clickItem(data.itemType, !!data.useAll);
            console.log(`${LOG_PREFIX} clickItem: used item type ${data.itemType} (useAll: ${!!data.useAll})`);
            client.publishEventBus('jta:itemClicked', {
                success: true,
                itemType: data.itemType,
                useAll: !!data.useAll,
                timestamp: Date.now()
            });
        } else {
            client.publishEventBus('jta:itemClicked', { success: false, error: 'clickItem not on window', timestamp: Date.now() });
        }
    });

    // Trigger prestige
    client.subscribeEventBus('jta:doPrestige', () => {
        if (window.doPrestige) {
            window.doPrestige();
            console.log(`${LOG_PREFIX} doPrestige: triggered`);
            client.publishEventBus('jta:prestigeDone', { success: true, timestamp: Date.now() });
        } else {
            client.publishEventBus('jta:prestigeDone', { success: false, error: 'doPrestige not on window', timestamp: Date.now() });
        }
    });

    // Dismiss the game-over overlay and trigger energy reset
    client.subscribeEventBus('jta:dismissGameOver', () => {
        const gs = window.getGamestate;
        if (!gs || !gs.is_in_energy_reset) {
            client.publishEventBus('jta:gameOverDismissed', {
                success: false,
                error: 'Not in energy reset state',
                timestamp: Date.now()
            });
            return;
        }
        // Hide the overlay (same as clicking the dismiss button)
        const overlay = document.getElementById('game-over-overlay');
        if (overlay) overlay.classList.add('hidden');
        // Perform the actual energy reset
        if (window.doEnergyReset) {
            window.doEnergyReset();
            console.log(`${LOG_PREFIX} dismissGameOver: reset triggered`);
            client.publishEventBus('jta:gameOverDismissed', { success: true, timestamp: Date.now() });
        } else {
            client.publishEventBus('jta:gameOverDismissed', { success: false, error: 'doEnergyReset not on window', timestamp: Date.now() });
        }
    });

    // Request current task status (active task + all tasks in zone)
    client.subscribeEventBus('jta:requestTaskStatus', () => {
        const gs = window.getGamestate;
        if (!gs) {
            client.publishEventBus('jta:taskStatus', { error: 'No GAMESTATE', timestamp: Date.now() });
            return;
        }
        const tasks = (gs.tasks || []).map(t => ({
            id: t.task_definition.id,
            name: t.task_definition.name,
            type: t.task_definition.type,
            progress: t.progress,
            reps: t.reps,
            maxReps: t.task_definition.max_reps,
            enabled: t.enabled,
        }));
        client.publishEventBus('jta:taskStatus', {
            activeTaskId: gs.active_task ? gs.active_task.task_definition.id : null,
            currentZone: gs.current_zone,
            currentEnergy: gs.current_energy,
            maxEnergy: gs.max_energy,
            tasks,
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
