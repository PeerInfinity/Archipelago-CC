/**
 * Maze playthrough visualizer — drives an automated tile-walk
 * through the loaded maze region, surfacing each step's outcome
 * (move, pickup, exit-cross, blocked) with rule-evaluation context
 * when blocked.
 *
 * Owns:
 *   - PlaybackClock (Phase 1.2)
 *   - Per-region simulated state: player position, inventory,
 *     checkedLocations. Independent of stateManager — the
 *     visualizer publishes `playback:snapshotUpdated` (Phase 1.1)
 *     for opt-in subscribers, NOT `stateManager:snapshotUpdated`.
 *   - A target source: for v1, the alphabetically-first
 *     uncollected item / unvisited exit in the current region.
 *     v1.1 will swap this for `pickNextTarget` from the forward
 *     simulator (or sphere-log replay when one is loaded).
 *
 * Plan reference:
 * NewDocs/plans/procedural-generation/debugging-tools.md (Phase 3)
 */

import {
    INPUT_N, INPUT_S, INPUT_E, INPUT_W,
    step,
    detectStepEvents,
    getObstacle,
    isFloor,
    createState,
} from './mazeRoomEngine.js';
import { isObstacleCleared } from '../shared/procgen/library.js';
import { PlaybackClock } from '../shared/playbackClock.js';

const INPUT_LIST = [INPUT_N, INPUT_S, INPUT_E, INPUT_W];

const STEP_DELTAS = {
    [INPUT_N]: { dx: 0,  dy: -1 },
    [INPUT_S]: { dx: 0,  dy: 1 },
    [INPUT_E]: { dx: 1,  dy: 0 },
    [INPUT_W]: { dx: -1, dy: 0 },
};

const DEFAULT_RATE_HZ = 4;

export class MazeRoomVisualizer {
    constructor({ eventBus = null, onStateChange = null } = {}) {
        this._eventBus = eventBus;
        this._onStateChange = onStateChange;
        this._clock = new PlaybackClock({ onTick: () => this._tick() });
        this._world = null;
        this._regionId = null;

        this._state = null;            // { player_pos: {x,y}, turn }
        this._inventory = new Set();   // Set<itemId>
        this._checkedLocations = new Set(); // Set<locationName>
        this._visitedItemPositions = new Set(); // Set<"x,y"> picked up
        this._visitedExits = new Set(); // Set<exit_id> already crossed
        this._target = null;           // { x, y, kind, name }
        this._plan = [];               // remaining inputs to reach target
        this._planIdx = 0;
        this._log = [];                // step entries
        this._completed = false;
        this._stuck = false;
    }

    setWorld(world, regionId) {
        const same = this._world === world && this._regionId === regionId;
        this._world = world ?? null;
        this._regionId = regionId ?? null;
        if (!same) this.reset({ silent: false });
    }

    reset({ silent = false } = {}) {
        this._clock.stop();
        this._state = this._world ? createState(this._world) : null;
        this._inventory = new Set();
        this._checkedLocations = new Set();
        this._visitedItemPositions = new Set();
        this._visitedExits = new Set();
        this._target = null;
        this._plan = [];
        this._planIdx = 0;
        this._log = [];
        this._completed = false;
        this._stuck = false;
        this._publishSnapshot();
        if (!silent) this._notifyChange();
    }

    play(rateHz = DEFAULT_RATE_HZ) {
        if (this._completed || this._stuck) return;
        this._clock.start(rateHz);
        this._notifyChange();
    }

    stop() {
        this._clock.stop();
        this._notifyChange();
    }

    step() {
        // Single-step regardless of clock state.
        this._tick();
    }

    setRate(rateHz) {
        this._clock.setRate(rateHz);
    }

    instant() {
        if (this._completed || this._stuck) return;
        const SAFETY = 5000;
        let i = 0;
        const wasRunning = this._clock.isRunning();
        if (wasRunning) this._clock.stop();
        while (!this._completed && !this._stuck && i++ < SAFETY) {
            this._tick();
        }
        this._notifyChange();
    }

    isRunning() { return this._clock.isRunning(); }
    isCompleted() { return this._completed; }
    isStuck() { return this._stuck; }

    getState() {
        return {
            player_pos: this._state ? { ...this._state.player_pos } : null,
            inventory: new Set(this._inventory),
            checkedLocations: new Set(this._checkedLocations),
            target: this._target ? { ...this._target } : null,
            log: this._log.slice(),
            completed: this._completed,
            stuck: this._stuck,
            running: this._clock.isRunning(),
        };
    }

    // --- per-tick logic ---

    _tick() {
        if (!this._world || !this._state || this._completed || this._stuck) {
            this._clock.stop();
            return;
        }

        if (!this._target || this._planIdx >= this._plan.length) {
            this._pickAndPlan();
            if (!this._target) {
                this._completed = true;
                this._clock.stop();
                this._log.push({
                    type: 'done',
                    description: 'No further reachable targets in this region.',
                });
                this._notifyChange();
                return;
            }
        }

        const input = this._plan[this._planIdx];
        const oldPos = { ...this._state.player_pos };
        const next = step(this._world, this._state, input, this._inventory);

        if (next === null) {
            // Blocked — log with rule eval, then halt and let the
            // user inspect or reset.
            this._logBlockedStep(oldPos, input);
            this._stuck = true;
            this._clock.stop();
            this._notifyChange();
            return;
        }

        this._state = next;
        this._planIdx += 1;

        const events = detectStepEvents(this._world, oldPos, next.player_pos, this._inventory);
        const eventDescriptions = [];
        for (const ev of events) {
            const desc = this._handleEvent(ev);
            if (desc) eventDescriptions.push(desc);
        }

        this._log.push({
            type: 'step',
            input,
            from: oldPos,
            to: { ...next.player_pos },
            turn: next.turn,
            events: eventDescriptions,
            target: this._target ? { ...this._target } : null,
        });

        if (this._planIdx >= this._plan.length) {
            // Reached current target; drop it so the next tick replans.
            this._target = null;
        }

        this._publishSnapshot();
        this._notifyChange();
    }

    _handleEvent(ev) {
        if (ev.type === 'pickup') {
            const itemId = ev.itemId;
            this._inventory.add(itemId);
            const key = `${ev.position.x},${ev.position.y}`;
            this._visitedItemPositions.add(key);
            const locationName = this._world.itemLocationNames?.get(key);
            if (locationName) this._checkedLocations.add(locationName);
            this._log.push({
                type: 'pickup',
                itemId,
                locationName: locationName ?? null,
                position: { ...ev.position },
                description: `Picked up ${itemId}${locationName ? ` at "${locationName}"` : ''}.`,
            });
            return `pickup ${itemId}`;
        }
        if (ev.type === 'exit_cross') {
            const exit = this._world.exits?.get(ev.exit_id);
            this._visitedExits.add(ev.exit_id);
            this._log.push({
                type: 'exit_cross',
                exit_id: ev.exit_id,
                exitName: exit?.exitName ?? null,
                targetRegion: exit?.targetRegion ?? null,
                description: `Crossed exit ${exit?.exitName ?? ev.exit_id}${exit?.targetRegion ? ` → ${exit.targetRegion}` : ''}.`,
            });
            return `exit ${exit?.exitName ?? ev.exit_id}`;
        }
        return null;
    }

    _logBlockedStep(pos, input) {
        const delta = STEP_DELTAS[input];
        const nx = pos.x + delta.dx;
        const ny = pos.y + delta.dy;
        let reason = 'unknown';
        let detail = '';
        const obstacleId = getObstacle(this._world, nx, ny);
        if (!isFloor(this._world, nx, ny)) {
            reason = 'wall';
            detail = `Tile (${nx},${ny}) is a wall or out-of-bounds.`;
        } else if (obstacleId) {
            const obstacle = this._world.obstacleLib?.[obstacleId];
            const ruleStr = obstacle?.clear_rule ? describeRule(obstacle.clear_rule) : '(no clear_rule)';
            const inventoryList = [...this._inventory].sort().join(', ') || '(empty)';
            reason = 'obstacle';
            detail = `Blocked by ${obstacleId} — clear_rule: ${ruleStr}; inventory: {${inventoryList}}`;
        } else {
            detail = `Tile (${nx},${ny}) is floor but step refused (engine returned null).`;
        }
        this._log.push({
            type: 'blocked',
            input,
            from: { ...pos },
            attempted: { x: nx, y: ny },
            obstacleId: obstacleId ?? null,
            obstacleRule: obstacleId ? this._world.obstacleLib?.[obstacleId]?.clear_rule ?? null : null,
            inventory: [...this._inventory],
            reason,
            description: `Tried ${input} from (${pos.x},${pos.y}) — ${detail}`,
        });
    }

    // --- target picking + tile-level path planning ---

    _pickAndPlan() {
        const candidates = this._enumerateTargets();
        for (const target of candidates) {
            const plan = this._planTilePath(target);
            // Skip targets we're already standing on (empty plan) — they
            // have nothing to advance via step(). Locations clear via
            // checkedLocations on pickup; visited exits clear via
            // _visitedExits in _handleEvent.
            if (plan && plan.length > 0) {
                this._target = target;
                this._plan = plan;
                this._planIdx = 0;
                return;
            }
        }
        this._target = null;
        this._plan = [];
        this._planIdx = 0;
    }

    _enumerateTargets() {
        if (!this._world) return [];
        const items = [];
        for (const [posKey, itemId] of this._world.items ?? []) {
            if (this._visitedItemPositions.has(posKey)) continue;
            const [xs, ys] = posKey.split(',');
            const x = Number.parseInt(xs, 10);
            const y = Number.parseInt(ys, 10);
            const locationName = this._world.itemLocationNames?.get(posKey) ?? null;
            if (locationName && this._checkedLocations.has(locationName)) continue;
            items.push({
                x, y,
                kind: 'item',
                name: locationName ?? itemId,
                itemId,
                locationName,
            });
        }
        items.sort((a, b) => String(a.name).localeCompare(String(b.name)));

        const exits = [];
        for (const exit of this._world.exits?.values() ?? []) {
            if (this._visitedExits.has(exit.exit_id)) continue;
            exits.push({
                x: exit.x,
                y: exit.y,
                kind: 'exit',
                name: exit.exitName ?? exit.exit_id ?? '?',
                exit_id: exit.exit_id,
            });
        }
        exits.sort((a, b) => String(a.name).localeCompare(String(b.name)));

        return [...items, ...exits];
    }

    _planTilePath(target) {
        const start = this._state.player_pos;
        if (start.x === target.x && start.y === target.y) return [];
        const visited = new Set([`${start.x},${start.y}`]);
        const queue = [{ x: start.x, y: start.y, plan: [] }];
        const SAFETY = 10000;
        let expanded = 0;
        while (queue.length > 0 && expanded++ < SAFETY) {
            const { x, y, plan } = queue.shift();
            for (const input of INPUT_LIST) {
                const { dx, dy } = STEP_DELTAS[input];
                const nx = x + dx;
                const ny = y + dy;
                if (!isFloor(this._world, nx, ny)) continue;
                const key = `${nx},${ny}`;
                if (visited.has(key)) continue;
                const obstacleId = getObstacle(this._world, nx, ny);
                if (obstacleId && !isObstacleCleared(obstacleId, this._inventory, this._world.obstacleLib)) {
                    continue;
                }
                visited.add(key);
                const newPlan = plan.concat(input);
                if (nx === target.x && ny === target.y) return newPlan;
                queue.push({ x: nx, y: ny, plan: newPlan });
            }
        }
        return null;
    }

    // --- snapshot publishing ---

    _publishSnapshot() {
        if (!this._eventBus?.publish) return;
        this._eventBus.publish('playback:snapshotUpdated', {
            snapshot: {
                inventory: inventoryAsCounts(this._inventory),
                checkedLocations: [...this._checkedLocations],
            },
            source: 'mazeRoomVisualizer',
        }, 'mazeRoom');
    }

    _notifyChange() {
        if (this._onStateChange) this._onStateChange();
    }
}

function inventoryAsCounts(set) {
    const out = {};
    for (const id of set) out[id] = (out[id] ?? 0) + 1;
    return out;
}

function describeRule(rule) {
    if (!rule) return '(none)';
    if (rule.rule === 'True_') return 'True_';
    if (rule.rule === 'False_') return 'False_';
    if (rule.rule === 'Has') return `Has(${rule.args?.item_name ?? '?'})`;
    if (rule.rule === 'HasAll') return `HasAll(${(rule.args?.items ?? []).join(', ')})`;
    if (rule.rule === 'HasAny') return `HasAny(${(rule.args?.items ?? []).join(', ')})`;
    if (rule.rule === 'And') return `And(${(rule.children ?? []).map(describeRule).join(', ')})`;
    if (rule.rule === 'Or') return `Or(${(rule.children ?? []).map(describeRule).join(', ')})`;
    return rule.rule ?? JSON.stringify(rule);
}
