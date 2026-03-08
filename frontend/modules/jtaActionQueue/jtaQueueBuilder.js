// JTA Queue Builder - generates queue entries from game state + strategy config
// Converts simulator strategy logic into concrete QueueEntry arrays
//
// Strategy levels (composable, each builds on the previous):
//   baseline         - mandatory zone traversal + perk tasks + XP grinding
//   itemCollection   - baseline + collect & immediately use items
//   pushCollect      - itemCollection + push/collect alternation
//   grindPushCollect - (not yet implemented)
//   artifactUsage    - (not yet implemented)

import {
    ZONES, ENERGY_ITEMS, ITEM_SKILL_MODIFIERS, ARTIFACTS,
    getMandatoryTasks, TaskType, ItemType,
} from '../jta-randomizer/gameData.js';
import {
    getReachableZones, calcZoneMandatoryEnergyCost, calcItemEnergy,
    getReachablePerkTasks, getReachableItemTasks, getReachableSkillBoostTasks,
    getReachableBossTasks, getAllReachableGrindableTasks, getItemType,
} from '../jta-randomizer/simulator.js';
import { JTAActionType } from './jtaActionDefs.js';
import { generateEntryId } from '../shared/actionQueue/actionTypes.js';

/**
 * Strategy levels — each level enables all factors up to that point.
 * @enum {string}
 */
export const StrategyLevel = Object.freeze({
    BASELINE: 'baseline',
    ITEM_COLLECTION: 'itemCollection',
    PUSH_COLLECT: 'pushCollect',
    GRIND_PUSH_COLLECT: 'grindPushCollect',
    ARTIFACT_USAGE: 'artifactUsage',
});

// Keep StrategyType for backward compat with loadout storage
export const StrategyType = Object.freeze({
    AUTO: 'auto',
    PUSH: 'push',
    COLLECT: 'collect',
    GRIND_XP: 'grindXp',
});

/**
 * Determine whether the given strategy level enables a factor.
 */
function hasItemCollection(level) {
    return level === StrategyLevel.ITEM_COLLECTION
        || level === StrategyLevel.PUSH_COLLECT
        || level === StrategyLevel.GRIND_PUSH_COLLECT
        || level === StrategyLevel.ARTIFACT_USAGE;
}

function hasPushCollect(level) {
    return level === StrategyLevel.PUSH_COLLECT
        || level === StrategyLevel.GRIND_PUSH_COLLECT
        || level === StrategyLevel.ARTIFACT_USAGE;
}

/**
 * Build queue entries for a strategy given current game state.
 *
 * @param {object} simState - Simulator-format state (from convertToSimState)
 * @param {object} strategy - { type: 'auto' } (from loadout)
 * @param {string} [strategyLevel] - Strategy level from settings (defaults to 'pushCollect' for backward compat)
 * @returns {import('../shared/actionQueue/actionTypes.js').QueueEntry[]}
 */
export function buildQueueForStrategy(simState, strategy, strategyLevel) {
    const level = strategyLevel || StrategyLevel.PUSH_COLLECT;

    // Push/collect: decide whether this run should push or collect
    if (hasPushCollect(level)) {
        if (wouldAutoPush(simState)) {
            return buildItemCollectionQueue(simState, true);
        }
        return buildItemCollectionQueue(simState, false);
    }

    // Item collection: always use items immediately
    if (hasItemCollection(level)) {
        return buildItemCollectionQueue(simState, true);
    }

    // Baseline: mandatory zones + perks + XP grinding, no items
    return buildBaselineQueue(simState);
}

/**
 * Determine whether the auto strategy would push or collect,
 * mirroring simulateRun's decision logic.
 */
export function wouldAutoPush(simState) {
    const energy = simState.maxEnergy;
    const itemEnergy = calcItemEnergy(simState);
    if (itemEnergy <= 0) return false;

    const nextNewZone = simState.highestZone + 1;
    let totalCostToNextNewZone = 0;
    for (let z = 0; z <= nextNewZone && z < ZONES.length; z++) {
        totalCostToNextNewZone += calcZoneMandatoryEnergyCost(z, simState);
    }

    const itemsCouldReachNewZone = energy + itemEnergy >= totalCostToNextNewZone * 0.9;
    const itemsAreRipe = itemEnergy >= energy * 0.2;
    return itemsCouldReachNewZone || itemsAreRipe;
}

// ============================================================================
// Strategy: Baseline
// ============================================================================

/**
 * Baseline queue: mandatory zone traversal + perk tasks + XP grinding.
 * No item collection or consumption.
 */
function buildBaselineQueue(simState) {
    const energy = simState.maxEnergy;

    // Pass 1: traverse without grind tasks to determine remaining energy
    const plan = planZoneProgression(simState, energy, false, false);

    // Plan grind tasks with the remaining energy budget
    const grindByZone = plan.maxReachableZone >= 0
        ? planXpGrindingByZone(simState, plan.maxReachableZone, plan.remainingEnergy)
        : new Map();

    // Pass 2: re-traverse with grind tasks interleaved
    const finalPlan = planZoneProgression(simState, energy, false, false, grindByZone);
    return finalPlan.entries;
}

// ============================================================================
// Strategy: Item Collection (also used by Push/Collect)
// ============================================================================

/**
 * Item collection queue. When consumeItems=true (push or standalone item collection),
 * uses all items at start and collects along the way. When consumeItems=false (collect
 * run in push/collect mode), collects items but doesn't consume stockpiled ones.
 */
function buildItemCollectionQueue(simState, consumeItems) {
    const entries = [];
    const energy = simState.maxEnergy;

    if (consumeItems) {
        // Use all stockpiled items at start of run
        addUseAllItemEntries(entries, simState);
    }

    // Calculate effective energy (with or without item energy)
    const itemEnergy = consumeItems ? calcItemEnergy(simState) : 0;
    const effectiveEnergy = energy + itemEnergy;

    // Pass 1: traverse without grind tasks to determine remaining energy
    const plan = planZoneProgression(simState, effectiveEnergy, consumeItems, true);

    // Plan grind tasks with the remaining energy budget
    const grindByZone = plan.maxReachableZone >= 0
        ? planXpGrindingByZone(simState, plan.maxReachableZone, plan.remainingEnergy)
        : new Map();

    // Pass 2: re-traverse with grind tasks interleaved
    const finalPlan = planZoneProgression(simState, effectiveEnergy, consumeItems, true, grindByZone);
    entries.push(...finalPlan.entries);

    return entries;
}

// ============================================================================
// Shared Building Blocks
// ============================================================================

/**
 * Plan zone progression: mandatory tasks + perks, optionally + items + bosses.
 * Returns the entries and estimated remaining energy.
 *
 * @param {object} simState
 * @param {number} totalEnergy
 * @param {boolean} consumeItems - Whether items are being consumed (affects energy budget)
 * @param {boolean} collectItems - Whether to include item/boost collection tasks
 * @param {Map<number, QueueEntry[]>} [grindByZone] - Grind tasks grouped by zone to interleave
 */
function planZoneProgression(simState, totalEnergy, consumeItems, collectItems, grindByZone) {
    const entries = [];
    let energy = totalEnergy;
    const zonesTraversed = new Set();
    const tasksPlanned = new Set();

    const reachable = getReachableZones(energy, simState);
    const maxReachable = Math.max(...reachable.filter(z => z.canComplete).map(z => z.zoneId), -1);

    if (maxReachable < 0) {
        return { entries, remainingEnergy: energy, maxReachableZone: 0 };
    }

    // Helper: traverse a zone with its grind tasks interleaved
    const traverseZone = (z) => {
        if (zonesTraversed.has(z)) return;
        const extras = grindByZone ? (grindByZone.get(z) || []) : [];
        addZoneEntries(entries, z, extras);
        energy -= calcZoneMandatoryEnergyCost(z, simState);
        zonesTraversed.add(z);
    };

    // Priority 1: Perks — interleaved with zone navigation
    const perkTasks = getReachablePerkTasks(reachable, simState);
    for (const pt of perkTasks) {
        if (pt.totalEnergyNeeded > energy) continue;
        // Navigate to the zone
        for (let z = 0; z < pt.zoneId; z++) {
            traverseZone(z);
        }
        // Add the perk task
        if (!tasksPlanned.has(pt.task.id)) {
            entries.push(makeTaskEntry(pt.task, pt.zoneId));
            energy -= pt.fullCost;
            tasksPlanned.add(pt.task.id);
        }
    }

    // Priority 2: Energy items (only when item collection is enabled)
    if (collectItems) {
        const itemTasks = getReachableItemTasks(reachable, simState);
        for (const it of itemTasks) {
            if (it.totalCost > energy || tasksPlanned.has(it.task.id)) continue;
            for (let z = 0; z < it.zoneId; z++) {
                traverseZone(z);
            }
            entries.push(makeTaskEntry(it.task, it.zoneId));
            energy -= it.fullCost;
            tasksPlanned.add(it.task.id);
        }
    }

    // Priority 3: Skill boost items (only when item collection is enabled)
    if (collectItems) {
        const boostTasks = getReachableSkillBoostTasks(reachable, simState);
        for (const bt of boostTasks) {
            if (bt.totalCost > energy || tasksPlanned.has(bt.task.id)) continue;
            for (let z = 0; z < bt.zoneId; z++) {
                traverseZone(z);
            }
            entries.push(makeTaskEntry(bt.task, bt.zoneId));
            energy -= bt.fullCost;
            tasksPlanned.add(bt.task.id);
        }
    }

    // Priority 4: Bosses
    const bossTasks = getReachableBossTasks(maxReachable, simState);
    for (const bt of bossTasks) {
        if (bt.fullCost > energy || tasksPlanned.has(bt.task.id)) continue;
        entries.push(makeTaskEntry(bt.task, bt.zoneId));
        energy -= bt.fullCost;
        tasksPlanned.add(bt.task.id);
    }

    // Priority 5: Complete remaining zones (mandatory tasks)
    for (let z = 0; z <= maxReachable; z++) {
        const cost = calcZoneMandatoryEnergyCost(z, simState);
        if (!zonesTraversed.has(z) && cost <= energy) {
            traverseZone(z);
        }
    }

    return { entries, remainingEnergy: energy, maxReachableZone: maxReachable };
}

/**
 * Pick grinding tasks to fill the energy budget.
 * Tasks are selected by XP/energy efficiency, each with 1 loop (tasks
 * can only be performed once per reset). The last task included may cost
 * more than the remaining budget — we'll run out of energy during it.
 *
 * @param {object} simState
 * @param {number} maxReachableZone
 * @param {number} energyBudget - remaining energy after mandatory traversal
 * @returns {Map<number, QueueEntry[]>} zoneId -> entries for that zone
 */
function planXpGrindingByZone(simState, maxReachableZone, energyBudget) {
    const result = new Map();
    if (energyBudget <= 0 || maxReachableZone < 0) return result;

    const maxZone = Math.max(maxReachableZone, 0);
    const candidates = getAllReachableGrindableTasks(maxZone, simState);
    candidates.sort((a, b) => b.totalXpPerEnergy - a.totalXpPerEnergy);

    // Select tasks in efficiency order, 1 loop each.
    // Include the first task that exceeds the budget (we'll drain during it).
    let remaining = energyBudget;
    const seen = new Set();

    for (const gt of candidates) {
        if (remaining <= 0) break;
        if (seen.has(gt.task.id)) continue;
        if (gt.fullCost <= 0) continue;
        seen.add(gt.task.id);
        remaining -= gt.fullCost;

        const entry = makeTaskEntry(gt.task, gt.zoneId, 1);
        if (!result.has(gt.zoneId)) result.set(gt.zoneId, []);
        result.get(gt.zoneId).push(entry);
    }

    return result;
}

// ============================================================================
// Entry Creation Helpers
// ============================================================================

function makeTaskEntry(task, zoneId, loops = 1) {
    const zone = ZONES[zoneId];
    return {
        entryId: generateEntryId(),
        actionType: JTAActionType.CLICK_TASK,
        actionId: task.id,
        label: task.name,
        group: zone ? zone.name : `Zone ${zoneId}`,
        loops,
        disabled: false,
    };
}

/**
 * Add all tasks for a zone: extras (e.g. grind), then mandatory non-travel, then travel.
 * @param {Array} entries - queue entries to append to
 * @param {number} zoneId
 * @param {Array} [extraEntries] - additional entries to insert before mandatory tasks
 */
function addZoneEntries(entries, zoneId, extraEntries = []) {
    const zone = ZONES[zoneId];
    if (!zone) return;
    const mandatory = getMandatoryTasks(zone);
    // Extra tasks first (e.g. grind tasks chosen for XP)
    entries.push(...extraEntries);
    // Mandatory (non-travel) tasks
    for (const task of mandatory) {
        if (task.type !== TaskType.Travel) {
            entries.push(makeTaskEntry(task, zoneId));
        }
    }
    // Travel task last (leaves the zone)
    for (const task of mandatory) {
        if (task.type === TaskType.Travel) {
            entries.push(makeTaskEntry(task, zoneId));
        }
    }
}

function addUseAllItemEntries(entries, simState) {
    // Energy items
    for (const [itemType, count] of simState.items) {
        if (count <= 0) continue;
        if (ENERGY_ITEMS[itemType] !== undefined) {
            entries.push({
                entryId: generateEntryId(),
                actionType: JTAActionType.USE_ALL_ITEMS,
                actionId: itemType,
                label: getItemName(itemType),
                group: 'Items',
                loops: 1,
                disabled: false,
            });
        }
    }

    // Skill boost items
    for (const [itemType, count] of simState.items) {
        if (count <= 0) continue;
        if (ITEM_SKILL_MODIFIERS[itemType]) {
            entries.push({
                entryId: generateEntryId(),
                actionType: JTAActionType.USE_ALL_ITEMS,
                actionId: itemType,
                label: getItemName(itemType),
                group: 'Items',
                loops: 1,
                disabled: false,
            });
        }
    }
}

// Simple reverse lookup for item names
const ITEM_NAMES = {};
for (const [name, value] of Object.entries(ItemType)) {
    ITEM_NAMES[value] = name;
}

function getItemName(itemType) {
    return ITEM_NAMES[itemType] || `Item ${itemType}`;
}

/**
 * Generate a set of strategy-backed loadouts for a multi-queue strategy.
 *
 * @param {StrategyType} strategyType
 * @returns {{ loadouts: Array<{name: string, strategy: StrategyConfig, repeatCount: number, nextLoadout: number}> }}
 */
export function generateStrategyLoadouts(strategyType) {
    return {
        loadouts: [{
            name: '[Auto]',
            strategy: { type: StrategyType.AUTO },
            repeatCount: 0, // infinite
            nextLoadout: -1,
        }],
    };
}
