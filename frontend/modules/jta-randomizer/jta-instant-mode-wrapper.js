/**
 * JTA Instant Mode Wrapper
 *
 * This script injects instant mode support into Journey to Ascension
 * WITHOUT modifying the original game code. It works by:
 *
 * 1. Intercepting window property assignments to capture GAMESTATE
 * 2. Monkey-patching the game loop to add instant mode behavior
 * 3. Providing APIs for external control (simulator, tests, etc.)
 *
 * Usage:
 *   - Inject this script BEFORE the game loads (via iframe postMessage or script tag)
 *   - Or call initWrapper() after the game has loaded
 */

(function() {
    'use strict';

    // State tracking
    let _gamestate = null;
    let _instantMode = false;
    let _gameLoopInterval = null;
    let _originalGameLoop = null;
    let _initialized = false;

    // Constants matching the game's internal values
    const BASE_COST = 10;
    const ZONE_EXPONENT = 2.2;
    const ZONE_SPEEDUP_BASE = 1.05;

    // Task types (matching game's TaskType enum)
    const TaskType = {
        Normal: 0,
        Mandatory: 1,
        Travel: 2,
        Boss: 3,
        Prestige: 4
    };

    /**
     * Calculate task cost (energy required to complete one rep)
     */
    function calcTaskCost(task, zoneId) {
        const costMult = task.task_definition?.cost_multiplier ?? task.costMult ?? 1;
        return BASE_COST * costMult * Math.pow(ZONE_EXPONENT, zoneId);
    }

    /**
     * Calculate progress per tick based on skill levels
     */
    function calcProgressPerTick(task, zoneId, gamestate) {
        if (!gamestate) return 1.0;

        const skills = task.task_definition?.skills ?? task.skills ?? [];
        let totalSpeedMod = 1.0;

        for (const skillType of skills) {
            const skill = gamestate.skills?.[skillType];
            if (skill) {
                // Each skill level adds 5% speed (matching game's SKILL_SPEED_BOOST)
                totalSpeedMod *= (1 + skill.level * 0.05);
                // Apply any speed modifiers on the skill
                totalSpeedMod *= (skill.speed_modifier ?? 1.0);
            }
        }

        // Zone speedup bonus
        const zoneSpeedup = Math.pow(ZONE_SPEEDUP_BASE, gamestate.highest_zone ?? 0);
        totalSpeedMod *= zoneSpeedup;

        return totalSpeedMod;
    }

    /**
     * Calculate number of ticks needed to complete one rep
     */
    function calcTaskTicks(task, zoneId, gamestate) {
        const cost = calcTaskCost(task, zoneId);
        const progressPerTick = calcProgressPerTick(task, zoneId, gamestate);
        return Math.ceil(cost / progressPerTick);
    }

    /**
     * Check if task completes in a single tick
     */
    function isSingleTick(task, zoneId, gamestate) {
        const cost = calcTaskCost(task, zoneId);
        const progressPerTick = calcProgressPerTick(task, zoneId, gamestate);
        return progressPerTick >= cost;
    }

    /**
     * Calculate energy drain per tick
     */
    function calcEnergyDrainPerTick(task, zoneId, gamestate, singleTick) {
        const cost = calcTaskCost(task, zoneId);
        const progressPerTick = calcProgressPerTick(task, zoneId, gamestate);

        if (singleTick) {
            // Single tick tasks drain the full cost as energy
            return cost;
        }

        // Multi-tick tasks drain progressPerTick energy per tick
        return progressPerTick;
    }

    /**
     * Calculate XP gained from task progress
     */
    function calcSkillXp(task, progress) {
        const xpMult = task.task_definition?.xp_multiplier ?? task.xpMult ?? 1;
        return progress * xpMult * 0.01; // Base XP rate
    }

    /**
     * Complete a task instantly (all remaining reps)
     * This replicates the game's completeTaskInstantly logic
     */
    function completeTaskInstantly(task, gamestate) {
        if (!task || !gamestate) return;

        const taskDef = task.task_definition;
        const maxReps = taskDef?.max_reps ?? task.maxReps ?? 1;
        const remainingReps = maxReps - task.reps;

        if (remainingReps <= 0) return;

        const zoneId = gamestate.current_zone ?? 0;
        const cost = calcTaskCost(task, zoneId);
        const progressPerTick = calcProgressPerTick(task, zoneId, gamestate);
        const singleTick = isSingleTick(task, zoneId, gamestate);

        // Process each remaining rep
        for (let rep = 0; rep < remainingReps; rep++) {
            const ticksForRep = calcTaskTicks(task, zoneId, gamestate);
            const energyPerTick = calcEnergyDrainPerTick(task, zoneId, gamestate, singleTick);
            const energyForRep = ticksForRep * energyPerTick;

            // Deduct energy
            gamestate.current_energy -= energyForRep;

            // Grant XP for each skill
            const skills = taskDef?.skills ?? [];
            const xpProgress = cost - (task.progress ?? 0);
            for (const skillType of skills) {
                const skill = gamestate.skills?.[skillType];
                if (skill) {
                    const xp = calcSkillXp(task, xpProgress);
                    skill.progress += xp;
                    // Level up if enough XP (simplified - game has more complex formula)
                    while (skill.progress >= getXpForLevel(skill.level + 1)) {
                        skill.progress -= getXpForLevel(skill.level + 1);
                        skill.level++;
                    }
                }
            }

            // Reset progress for next rep
            task.progress = 0;

            // Apply item drops, perk unlocks, etc. (simplified)
            if (taskDef?.item && rep === remainingReps - 1) {
                const itemType = taskDef.item;
                const currentCount = gamestate.items?.get(itemType) ?? 0;
                gamestate.items?.set(itemType, currentCount + 1);
            }
        }

        // Mark task as complete
        task.reps = maxReps;

        // Update enabled tasks (Travel tasks become available when mandatory tasks done)
        updateEnabledTasks(gamestate);

        // Check if zone is complete (all mandatory tasks done)
        const allMandatoryDone = gamestate.tasks?.every(t => {
            const type = t.task_definition?.type ?? TaskType.Normal;
            if (type === TaskType.Mandatory || type === TaskType.Prestige) {
                return t.reps >= (t.task_definition?.max_reps ?? 1);
            }
            return true;
        });

        // Enable Travel tasks if all mandatory done
        if (allMandatoryDone) {
            for (const t of gamestate.tasks ?? []) {
                const type = t.task_definition?.type ?? TaskType.Normal;
                if (type === TaskType.Travel) {
                    t.enabled = true;
                }
            }
        }
    }

    /**
     * Get XP required for a skill level
     */
    function getXpForLevel(level) {
        // Simplified formula - actual game may differ
        return Math.pow(level, 2) * 10;
    }

    /**
     * Update which tasks are enabled based on game state
     */
    function updateEnabledTasks(gamestate) {
        if (!gamestate?.tasks) return;

        let hasUnfinishedMandatory = false;

        for (const task of gamestate.tasks) {
            const taskDef = task.task_definition;
            const maxReps = taskDef?.max_reps ?? 1;
            const finished = task.reps >= maxReps;
            const type = taskDef?.type ?? TaskType.Normal;

            // Check for unfinished mandatory/prestige tasks
            if ((type === TaskType.Mandatory || type === TaskType.Prestige) && !finished) {
                hasUnfinishedMandatory = true;
            }

            // Boss tasks have special enabling logic (simplified)
            task.enabled = !finished;
        }

        // Disable Travel tasks if mandatory tasks remain
        if (hasUnfinishedMandatory) {
            for (const task of gamestate.tasks) {
                const type = task.task_definition?.type ?? TaskType.Normal;
                if (type === TaskType.Travel) {
                    task.enabled = false;
                }
            }
        }
    }

    /**
     * Get the current GAMESTATE, handling the stale reference issue
     */
    function getGamestate() {
        // Try multiple ways to get the current gamestate
        if (window._jta_current_gamestate) {
            return window._jta_current_gamestate;
        }
        if (_gamestate) {
            return _gamestate;
        }
        // Fallback to window.getGamestate (may be stale after reset)
        return window.getGamestate;
    }

    /**
     * Set up interception for GAMESTATE updates
     */
    function setupGamestateInterception() {
        // Store original descriptor
        const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'getGamestate');

        // Create a proxy to intercept GAMESTATE assignments
        let currentGamestate = window.getGamestate;

        Object.defineProperty(window, 'getGamestate', {
            get() {
                return currentGamestate;
            },
            set(value) {
                currentGamestate = value;
                _gamestate = value;
                window._jta_current_gamestate = value;
                console.log('[JTA Wrapper] GAMESTATE updated');
            },
            configurable: true
        });

        // If already set, capture it
        if (window.getGamestate) {
            _gamestate = window.getGamestate;
            window._jta_current_gamestate = window.getGamestate;
        }
    }

    /**
     * Wrap the game's updateGamestate function to add instant mode
     */
    function wrapUpdateGamestate() {
        // Wait for the game to expose updateGamestate
        const checkInterval = setInterval(() => {
            // The game exposes stepTick which calls updateGamestate internally
            // We need to intercept the active task processing

            const gs = getGamestate();
            if (!gs) return;

            // Clear interval once we've set up
            clearInterval(checkInterval);

            console.log('[JTA Wrapper] Gamestate available, instant mode ready');
            _initialized = true;
        }, 100);
    }

    /**
     * Initialize the wrapper
     * Call this after the game has loaded, or let it auto-initialize
     */
    function initWrapper() {
        if (_initialized) return;

        console.log('[JTA Wrapper] Initializing...');

        // Set up GAMESTATE interception
        setupGamestateInterception();

        // Set up updateGamestate wrapper
        wrapUpdateGamestate();

        // Expose our APIs on window
        exposeAPIs();

        console.log('[JTA Wrapper] APIs exposed');
    }

    /**
     * Expose wrapper APIs on window for external use
     */
    function exposeAPIs() {
        // Instant mode control
        window.jta = window.jta || {};

        window.jta.setInstantMode = function(enabled) {
            _instantMode = enabled;
            return _instantMode;
        };

        window.jta.isInstantMode = function() {
            return _instantMode;
        };

        // Manual tick with instant mode support
        window.jta.stepTick = function() {
            const gs = getGamestate();
            if (!gs) return { error: 'No gamestate' };

            // Check for energy reset
            if (gs.is_in_energy_reset) {
                return {
                    energy: gs.current_energy,
                    zone: gs.current_zone,
                    isInEnergyReset: true
                };
            }

            // If instant mode and there's an active task, complete it instantly
            if (_instantMode && gs.active_task) {
                completeTaskInstantly(gs.active_task, gs);
                gs.active_task = null;
            } else if (window.updateGamestate) {
                // Use game's own updateGamestate if available
                window.updateGamestate();
            }

            // Check for energy depletion
            if (gs.current_energy <= 0) {
                gs.is_in_energy_reset = true;
            }

            return {
                energy: gs.current_energy,
                zone: gs.current_zone,
                isInEnergyReset: gs.is_in_energy_reset ?? false
            };
        };

        // Perform a specific task by ID
        window.jta.performTask = function(taskId) {
            const gs = getGamestate();
            if (!gs) return { success: false, error: 'No gamestate' };

            const task = gs.tasks?.find(t =>
                (t.task_definition?.id ?? t.id) === taskId
            );

            if (!task) {
                return { success: false, error: `Task ${taskId} not found in current zone` };
            }
            if (!task.enabled) {
                return { success: false, error: `Task ${taskId} is not enabled` };
            }

            const maxReps = task.task_definition?.max_reps ?? task.maxReps ?? 1;
            if (task.reps >= maxReps) {
                return { success: false, error: `Task ${taskId} is already completed` };
            }

            gs.active_task = task;
            return {
                success: true,
                taskName: task.task_definition?.name ?? task.name
            };
        };

        // Get full serialized state
        window.jta.getFullState = function() {
            const gs = getGamestate();
            if (!gs) return null;

            return {
                currentEnergy: gs.current_energy,
                maxEnergy: gs.max_energy,
                isInEnergyReset: gs.is_in_energy_reset ?? false,
                energyResetCount: gs.energy_reset_count ?? 0,
                currentZone: gs.current_zone ?? 0,
                highestZone: gs.highest_zone ?? 0,
                highestZoneFullyCompleted: gs.highest_zone_fully_completed ?? -1,
                skills: (gs.skills ?? []).map(s => ({
                    type: s.type,
                    level: s.level,
                    progress: s.progress
                })),
                perks: Array.from(gs.perks?.entries?.() ?? [])
                    .filter(([_, active]) => active)
                    .map(([perkType, _]) => perkType),
                items: Array.from(gs.items?.entries?.() ?? [])
                    .filter(([_, count]) => count > 0)
                    .map(([itemType, count]) => ({ type: itemType, count })),
                tasks: (gs.tasks ?? []).map(t => ({
                    id: t.task_definition?.id ?? t.id,
                    name: t.task_definition?.name ?? t.name,
                    reps: t.reps,
                    maxReps: t.task_definition?.max_reps ?? t.maxReps ?? 1,
                    progress: t.progress ?? 0,
                    enabled: t.enabled ?? false,
                    completed: t.reps >= (t.task_definition?.max_reps ?? t.maxReps ?? 1)
                })),
                power: gs.power ?? 0,
                attunement: gs.attunement ?? 0,
                prestigeCount: gs.prestige_count ?? 0
            };
        };

        // Get available (enabled, incomplete) tasks
        window.jta.getAvailableTasks = function() {
            const gs = getGamestate();
            if (!gs?.tasks) return [];

            return gs.tasks
                .filter(t => t.enabled && t.reps < (t.task_definition?.max_reps ?? t.maxReps ?? 1))
                .map(t => ({
                    id: t.task_definition?.id ?? t.id,
                    name: t.task_definition?.name ?? t.name,
                    type: t.task_definition?.type ?? TaskType.Normal,
                    reps: t.reps,
                    maxReps: t.task_definition?.max_reps ?? t.maxReps ?? 1,
                    costMult: t.task_definition?.cost_multiplier ?? t.costMult ?? 1,
                    skills: t.task_definition?.skills ?? [],
                    enabled: t.enabled
                }));
        };

        // Set energy (for testing)
        window.jta.setEnergy = function(current, max) {
            const gs = getGamestate();
            if (!gs) return { error: 'No gamestate' };

            gs.current_energy = current;
            if (max !== undefined) {
                gs.max_energy = max;
            }
            return { current: gs.current_energy, max: gs.max_energy };
        };

        // Pause/resume game loop
        window.jta.pauseGameLoop = function() {
            // Try to use the game's own pause if available
            if (window.pauseGameLoop) {
                return window.pauseGameLoop();
            }
            // Otherwise try to clear the interval ourselves
            // This is tricky without access to the game's internal interval ID
            console.warn('[JTA Wrapper] Cannot pause - game pauseGameLoop not available');
            return false;
        };

        window.jta.resumeGameLoop = function() {
            if (window.resumeGameLoop) {
                return window.resumeGameLoop();
            }
            console.warn('[JTA Wrapper] Cannot resume - game resumeGameLoop not available');
            return false;
        };

        // Initialize headless (create fresh game state)
        window.jta.initializeHeadless = function() {
            if (window.initializeHeadless) {
                const result = window.initializeHeadless();
                // Re-capture the new gamestate
                setTimeout(() => {
                    const gs = window.getGamestate;
                    if (gs) {
                        _gamestate = gs;
                        window._jta_current_gamestate = gs;
                    }
                }, 10);
                return result;
            }
            console.warn('[JTA Wrapper] Cannot initialize headless - game API not available');
            return false;
        };

        // Also expose under the original names for compatibility
        window.setInstantMode = window.jta.setInstantMode;
        window.isInstantMode = window.jta.isInstantMode;
        window.stepTick = window.jta.stepTick;
        window.performTask = window.jta.performTask;
        window.getFullState = window.jta.getFullState;
        window.getAvailableTasks = window.jta.getAvailableTasks;
        window.setEnergy = window.jta.setEnergy;
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWrapper);
    } else {
        // DOM already loaded, initialize now
        initWrapper();
    }

    // Also try to initialize when the game's script loads
    window.addEventListener('load', () => {
        setTimeout(initWrapper, 100);
    });

    // Expose init function for manual initialization
    window.initJTAWrapper = initWrapper;

    console.log('[JTA Wrapper] Script loaded, waiting for game...');
})();
