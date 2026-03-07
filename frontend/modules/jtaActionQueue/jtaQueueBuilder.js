// JTA Queue Builder - generates queue entries from game state + strategy config
// Converts simulator strategy logic into concrete QueueEntry arrays

import {
    ZONES, ENERGY_ITEMS, ITEM_SKILL_MODIFIERS, ARTIFACTS,
    getMandatoryTasks, TaskType, ItemType,
} from '../jta-randomizer/gameData.js';
import {
    getReachableZones, calcTaskEnergyCost, calcTaskEnergyCostSingleRep,
    calcZoneMandatoryEnergyCost, calcItemEnergy,
    getReachablePerkTasks, getReachableItemTasks, getReachableSkillBoostTasks,
    getReachableBossTasks, getBottleneckSkills, getBottleneckTrainingTasks,
    getAllReachableGrindableTasks, getItemType,
} from '../jta-randomizer/simulator.js';
import { JTAActionType } from './jtaActionDefs.js';
import { generateEntryId } from '../shared/actionQueue/actionTypes.js';

/**
 * Strategy types
 * @enum {string}
 */
export const StrategyType = Object.freeze({
    AUTO: 'auto',
    PUSH: 'push',
    COLLECT: 'collect',
    GRIND_XP: 'grindXp',
});

/**
 * @typedef {object} StrategyConfig
 * @property {StrategyType} type
 */

/**
 * Build queue entries for a strategy given current game state.
 *
 * @param {object} simState - Simulator-format state (from convertToSimState)
 * @param {StrategyConfig} strategy
 * @returns {import('../shared/actionQueue/actionTypes.js').QueueEntry[]}
 */
export function buildQueueForStrategy(simState, strategy) {
    switch (strategy.type) {
        case StrategyType.AUTO:
            return buildAutoQueue(simState);
        case StrategyType.PUSH:
            return buildPushQueue(simState);
        case StrategyType.COLLECT:
            return buildCollectQueue(simState);
        case StrategyType.GRIND_XP:
            return buildGrindXpQueue(simState);
        default:
            return [];
    }
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

/**
 * Auto strategy: mirrors simulateRun's push/collect decision,
 * then delegates to push or collect builder.
 */
function buildAutoQueue(simState) {
    if (wouldAutoPush(simState)) {
        return buildPushQueue(simState);
    }
    return buildCollectQueue(simState);
}

// --- Push Strategy ---

function buildPushQueue(simState) {
    const entries = [];
    const energy = simState.maxEnergy;

    // Step 1: Use all energy items at start
    addUseAllItemEntries(entries, simState);

    // Calculate effective energy after items
    const itemEnergy = calcItemEnergy(simState);
    const effectiveEnergy = energy + itemEnergy;

    // Step 2: Plan zone progression with perk/item/boss collection
    const plan = planZoneProgression(simState, effectiveEnergy, true);
    entries.push(...plan.entries);

    // Step 3: Fill remaining energy with XP grinding
    if (plan.remainingEnergy > 1) {
        const grindEntries = planXpGrinding(simState, plan.maxReachableZone);
        entries.push(...grindEntries);
    }

    return entries;
}

// --- Collect Strategy ---

function buildCollectQueue(simState) {
    const entries = [];
    const energy = simState.maxEnergy;

    // No item consumption — plan progression with base energy
    const plan = planZoneProgression(simState, energy, false);
    entries.push(...plan.entries);

    // Fill remaining energy with XP grinding
    if (plan.remainingEnergy > 1) {
        const grindEntries = planXpGrinding(simState, plan.maxReachableZone);
        entries.push(...grindEntries);
    }

    return entries;
}

// --- Grind XP Strategy ---

function buildGrindXpQueue(simState) {
    const entries = [];
    const energy = simState.maxEnergy;
    const reachable = getReachableZones(energy, simState);
    const maxReachable = Math.max(...reachable.filter(z => z.canComplete).map(z => z.zoneId), -1);

    // Get grind tasks grouped by zone
    const grindByZone = planXpGrindingByZone(simState, Math.max(maxReachable, 0));

    // Build zone-by-zone: mandatory → grind tasks → travel
    if (maxReachable >= 0) {
        for (let z = 0; z <= maxReachable; z++) {
            addZoneEntries(entries, z, grindByZone.get(z) || []);
        }
    }

    return entries;
}

// --- Shared Building Blocks ---

/**
 * Plan zone progression: mandatory tasks + perks + items + bosses.
 * Returns the entries and estimated remaining energy.
 */
function planZoneProgression(simState, totalEnergy, consumeItems) {
    const entries = [];
    let energy = totalEnergy;
    const zonesTraversed = new Set();
    const tasksPlanned = new Set();

    const reachable = getReachableZones(energy, simState);
    const maxReachable = Math.max(...reachable.filter(z => z.canComplete).map(z => z.zoneId), -1);

    if (maxReachable < 0) {
        return { entries, remainingEnergy: energy, maxReachableZone: 0 };
    }

    // Priority 1: Perks — interleaved with zone navigation
    const perkTasks = getReachablePerkTasks(reachable, simState);
    for (const pt of perkTasks) {
        if (pt.totalEnergyNeeded > energy) continue;
        // Navigate to the zone
        for (let z = 0; z < pt.zoneId; z++) {
            if (!zonesTraversed.has(z)) {
                addZoneEntries(entries, z);
                energy -= calcZoneMandatoryEnergyCost(z, simState);
                zonesTraversed.add(z);
            }
        }
        // Add the perk task
        if (!tasksPlanned.has(pt.task.id)) {
            entries.push(makeTaskEntry(pt.task, pt.zoneId));
            energy -= pt.fullCost;
            tasksPlanned.add(pt.task.id);
        }
    }

    // Priority 2: Energy items (on all runs, not just push)
    const itemTasks = getReachableItemTasks(reachable, simState);
    for (const it of itemTasks) {
        if (it.totalCost > energy || tasksPlanned.has(it.task.id)) continue;
        // Navigate
        for (let z = 0; z < it.zoneId; z++) {
            if (!zonesTraversed.has(z)) {
                addZoneEntries(entries, z);
                energy -= calcZoneMandatoryEnergyCost(z, simState);
                zonesTraversed.add(z);
            }
        }
        entries.push(makeTaskEntry(it.task, it.zoneId));
        energy -= it.fullCost;
        tasksPlanned.add(it.task.id);
    }

    // Priority 3: Skill boost items
    const boostTasks = getReachableSkillBoostTasks(reachable, simState);
    for (const bt of boostTasks) {
        if (bt.totalCost > energy || tasksPlanned.has(bt.task.id)) continue;
        for (let z = 0; z < bt.zoneId; z++) {
            if (!zonesTraversed.has(z)) {
                addZoneEntries(entries, z);
                energy -= calcZoneMandatoryEnergyCost(z, simState);
                zonesTraversed.add(z);
            }
        }
        entries.push(makeTaskEntry(bt.task, bt.zoneId));
        energy -= bt.fullCost;
        tasksPlanned.add(bt.task.id);
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
        if (!zonesTraversed.has(z)) {
            const cost = calcZoneMandatoryEnergyCost(z, simState);
            if (cost <= energy) {
                addZoneEntries(entries, z);
                energy -= cost;
                zonesTraversed.add(z);
            }
        }
    }

    return { entries, remainingEnergy: energy, maxReachableZone: maxReachable };
}

/**
 * Pick the top grinding tasks, returned as a flat list of entries.
 */
function planXpGrinding(simState, maxReachableZone) {
    const byZone = planXpGrindingByZone(simState, maxReachableZone);
    const entries = [];
    for (const zoneEntries of byZone.values()) {
        entries.push(...zoneEntries);
    }
    return entries;
}

/**
 * Pick top grinding tasks, grouped by zone.
 * @returns {Map<number, QueueEntry[]>} zoneId -> entries for that zone
 */
function planXpGrindingByZone(simState, maxReachableZone) {
    const result = new Map();
    const maxZone = Math.max(maxReachableZone, 0);
    const bottleneckSkills = getBottleneckSkills(simState, simState.maxEnergy, maxZone);
    let tasksToFarm = [];

    if (bottleneckSkills.size > 0) {
        tasksToFarm = getBottleneckTrainingTasks(maxZone, simState, bottleneckSkills);
    }

    if (tasksToFarm.length === 0) {
        tasksToFarm = getAllReachableGrindableTasks(maxZone, simState);
        tasksToFarm.sort((a, b) => b.totalXpPerEnergy - a.totalXpPerEnergy);
    }

    // Add top 1-3 grinding tasks grouped by zone
    const seen = new Set();
    for (const gt of tasksToFarm) {
        if (seen.has(gt.task.id)) continue;
        seen.add(gt.task.id);

        const loops = Math.max(1, Math.ceil(3 / gt.task.maxReps));
        const entry = makeTaskEntry(gt.task, gt.zoneId, loops);

        if (!result.has(gt.zoneId)) result.set(gt.zoneId, []);
        result.get(gt.zoneId).push(entry);

        if (seen.size >= 3) break;
    }

    return result;
}

// --- Entry Creation Helpers ---

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
 * Add all tasks for a zone: mandatory first, then extras, then travel (which leaves the zone).
 * @param {Array} entries - queue entries to append to
 * @param {number} zoneId
 * @param {Array} [extraEntries] - additional entries to insert before the travel task
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
    switch (strategyType) {
        case StrategyType.AUTO:
            return {
                loadouts: [{
                    name: '[Auto]',
                    strategy: { type: StrategyType.AUTO },
                    repeatCount: 0, // infinite
                    nextLoadout: -1,
                }],
            };

        case StrategyType.PUSH:
            return {
                loadouts: [{
                    name: '[Push]',
                    strategy: { type: StrategyType.PUSH },
                    repeatCount: 0,
                    nextLoadout: -1,
                }],
            };

        case StrategyType.COLLECT:
            return {
                loadouts: [{
                    name: '[Collect]',
                    strategy: { type: StrategyType.COLLECT },
                    repeatCount: 0,
                    nextLoadout: -1,
                }],
            };

        case StrategyType.GRIND_XP:
            return {
                loadouts: [{
                    name: '[Grind XP]',
                    strategy: { type: StrategyType.GRIND_XP },
                    repeatCount: 0,
                    nextLoadout: -1,
                }],
            };

        default:
            return { loadouts: [] };
    }
}
