// JTA action definitions - enumerates all available actions from game data
import { generateEntryId } from '../shared/actionQueue/actionTypes.js';

/**
 * JTA action types
 * @enum {string}
 */
export const JTAActionType = Object.freeze({
    CLICK_TASK: 'clickTask',
    USE_ITEM: 'useItem',
    USE_ALL_ITEMS: 'useAllItems',
    PRESTIGE: 'prestige',
});

/**
 * Build the full catalog of available actions from game zone/task/item data.
 * Called once when game definitions are received.
 *
 * @param {object[]} zones - Array of zone objects from jta:gameDefsSnapshot
 * @param {{ items: object[], artifacts: number[] }|null} itemData - Item defs from jta:gameDefsSnapshot
 * @returns {{ tasks: object[], items: object[], prestige: object[] }}
 */
export function buildActionCatalog(zones, itemData) {
    const taskActions = [];
    const itemActions = [];

    // Build task actions from zone definitions
    if (Array.isArray(zones)) {
        for (const zone of zones) {
            const zoneName = zone.name;
            const zoneId = zone.zoneId;
            for (const task of zone.tasks) {
                taskActions.push({
                    actionType: JTAActionType.CLICK_TASK,
                    actionId: task.id,
                    label: task.name,
                    group: zoneName,
                    zoneId,
                    taskType: task.type,
                    maxReps: task.maxReps,
                });
            }
        }
    }

    // Build item actions from serialized item definitions
    if (itemData && Array.isArray(itemData.items)) {
        const artifacts = new Set(itemData.artifacts || []);
        for (const item of itemData.items) {
            const isArtifact = artifacts.has(item.enumValue);
            itemActions.push({
                actionType: JTAActionType.USE_ITEM,
                actionId: item.index,
                label: item.name,
                icon: item.icon || '',
                group: isArtifact ? 'Artifacts' : 'Items',
            });
        }
    }

    // Prestige action
    const prestigeActions = [{
        actionType: JTAActionType.PRESTIGE,
        actionId: 'prestige',
        label: 'Prestige',
        group: 'Special',
    }];

    return { tasks: taskActions, items: itemActions, prestige: prestigeActions };
}

/**
 * Build the catalog from a live "currently-loaded actions" report (substrate
 * path). Unlike buildActionCatalog (all zones, from a static gameDefs
 * snapshot), this reflects only the zone JtA currently has loaded — so it stays
 * correct under synthetic data, which can change what each zone contains. The
 * catalog is re-built whenever the loaded zone changes.
 *
 * Task entries are uniformly clickTask (a "travel" is just a clickTask on a
 * travel task, so the report needs no per-task action-type). Prestige is
 * dropped on the substrate (no window.doPrestige hook). Item labels are
 * best-effort (the fork reports held items by type without names).
 *
 * @param {{ zone: number, tasks: object[], items: object[] }|null} report
 * @returns {{ tasks: object[], items: object[], prestige: object[] }}
 */
export function buildCatalogFromReport(report) {
    const tasks = [];
    const items = [];
    if (report && Array.isArray(report.tasks)) {
        const zoneId = report.zone ?? 0;
        const group = `Zone ${zoneId + 1}`;
        for (const t of report.tasks) {
            tasks.push({
                actionType: JTAActionType.CLICK_TASK,
                actionId: t.id,
                label: t.name,
                group,
                zoneId,
                maxReps: t.maxReps,
            });
        }
    }
    if (report && Array.isArray(report.items)) {
        for (const it of report.items) {
            items.push({
                actionType: JTAActionType.USE_ITEM,
                actionId: it.type,
                label: `Item ${it.type}`,
                group: 'Items',
            });
        }
    }
    return { tasks, items, prestige: [] };
}

/**
 * Create a QueueEntry from a catalog action definition
 * @param {object} catalogEntry - Entry from buildActionCatalog()
 * @param {number} [loops=1] - Number of times to repeat
 * @returns {import('../shared/actionQueue/actionTypes.js').QueueEntry}
 */
export function createQueueEntry(catalogEntry, loops = 1) {
    return {
        entryId: generateEntryId(),
        actionType: catalogEntry.actionType,
        actionId: catalogEntry.actionId,
        label: catalogEntry.label,
        group: catalogEntry.group || '',
        zoneId: catalogEntry.zoneId,
        loops,
        disabled: false,
    };
}
