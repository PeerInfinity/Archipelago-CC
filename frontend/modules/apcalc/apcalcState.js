/**
 * APCalc game state — tracks button presses, current node, discovered paths.
 *
 * The calculator starts blank. Pressing a number then = moves to that node
 * (if it's a neighbor of Start). From any node, pressing op, number, = moves
 * to the child node whose value matches the result.
 *
 * Button presses are consumed per path. Clear restores all presses and
 * returns to Start.
 */

export class APCalcState {
    constructor() {
        /** @type {Object<string, NodeInfo>} region_name → node info from slot_data */
        this.nodes = {};
        /** @type {Object<string, number>} button_label → total presses available */
        this.totalPresses = {};
        /** @type {Object<string, number>} button_label → presses remaining this path */
        this.remainingPresses = {};
        /** @type {string|null} current region name, null = Start */
        this.currentNode = null;
        /** @type {number|null} current calculator display value */
        this.displayValue = null;
        /** @type {string|null} pending operation (+, -, *, /) */
        this.pendingOp = null;
        /** @type {number|null} operand being entered */
        this.pendingNum = null;
        /** @type {string[]} button presses so far in this path */
        this.currentSequence = [];
        /** @type {string[]} buttons pressed since last = (for refund) */
        this.sinceLastEquals = [];
        /** @type {Array<{node: string, sequence: string[]}>} discovered paths */
        this.discoveredPaths = [];
        /** @type {Set<string>} checked location names */
        this.checkedLocations = new Set();
        /** @type {string[]} available operations */
        this.operations = ['+', '-', '*', '/'];
        /** @type {string|null} goal node region name */
        this.goalNode = null;
        /** @type {Function|null} callback when location should be checked */
        this.onLocationCheck = null;
        /** @type {Function|null} callback when state changes */
        this.onStateChanged = null;
    }

    loadFromSlotData(slotData) {
        this.nodes = slotData.nodes || {};
        this.operations = slotData.operations || ['+', '-', '*', '/'];
        this.goalNode = slotData.goal_node || null;

        // Starting buttons come from starting_buttons in slot_data
        this.totalPresses = {};
        const startingButtons = slotData.starting_buttons || {};
        for (const [label, count] of Object.entries(startingButtons)) {
            this.totalPresses[label] = (this.totalPresses[label] || 0) + count;
        }

        this.reset();
    }

    /** Sync with Archipelago inventory snapshot — add received button items.
     *  snapshot.inventory = { itemName: count, ... }
     *  snapshot.checkedLocations = [ locationName, ... ]
     *
     *  The inventory already includes starting items, so we don't need to
     *  add sphere 0 values separately.
     */
    syncFromSnapshot(snapshot) {
        if (!snapshot) return;

        // Rebuild totalPresses purely from inventory (includes starting items)
        this.totalPresses = {};
        const inventory = snapshot.inventory || {};
        for (const [itemName, count] of Object.entries(inventory)) {
            if (count <= 0) continue;
            const match = itemName.match(/^Button: (.+)$/);
            if (match) {
                const label = match[1];
                this.totalPresses[label] = (this.totalPresses[label] || 0) + count;
            }
        }

        // Update checked locations
        if (snapshot.checkedLocations) {
            this.checkedLocations = new Set(snapshot.checkedLocations);
        }

        // Recalculate remaining presses (preserve consumed state in current path)
        this._recalcRemaining();
        this._notify();
    }

    /** Reset calculator: return to Start, restore all presses. */
    reset() {
        this.currentNode = null;
        this.displayValue = null;
        this.pendingOp = null;
        this.pendingNum = null;
        this.currentSequence = [];
        this.sinceLastEquals = [];
        this.remainingPresses = { ...this.totalPresses };
        this._notify();
    }

    /** Press a number button (0-9). */
    pressNumber(num) {
        const label = String(num);
        if ((this.remainingPresses[label] || 0) <= 0) return false;

        this.remainingPresses[label]--;
        this.pendingNum = num;
        this.sinceLastEquals.push(label);
        this._notify();
        return true;
    }

    /** Press an operation button (+, -, *, /). */
    pressOperation(op) {
        if ((this.remainingPresses[op] || 0) <= 0) return false;
        if (this.displayValue === null && this.currentNode === null) return false;

        this.remainingPresses[op]--;
        this.pendingOp = op;
        this.pendingNum = null;
        this.sinceLastEquals.push(op);
        this._notify();
        return true;
    }

    /** Press equals. Returns {success, value, moved, node} or {success: false, reason}. */
    pressEquals() {
        let result;

        if (this.currentNode === null && this.pendingNum !== null && this.pendingOp === null) {
            // From Start: just a number press → try to reach that sphere 0 node
            result = this.pendingNum;
        } else if (this.pendingOp !== null && this.pendingNum !== null) {
            // From a node: op + num
            const left = this.displayValue;
            result = this._compute(left, this.pendingOp, this.pendingNum);
            if (result === null) {
                this._refundSinceLastEquals();
                return { success: false, reason: 'Invalid operation' };
            }
        } else {
            // Nothing meaningful to compute
            return { success: false, reason: 'Incomplete input' };
        }

        // Check if result matches a neighbor
        const neighbor = this._findNeighbor(result);
        if (neighbor) {
            this.displayValue = result;
            this.currentNode = neighbor;
            this.pendingOp = null;
            this.pendingNum = null;
            this.currentSequence.push(...this.sinceLastEquals, '=');
            this.sinceLastEquals = [];

            // Record the path
            const seqCopy = [...this.currentSequence];
            const alreadyDiscovered = this.discoveredPaths.some(
                p => p.node === neighbor && p.sequence.join(',') === seqCopy.join(',')
            );
            if (!alreadyDiscovered) {
                this.discoveredPaths.push({ node: neighbor, sequence: seqCopy });
            }

            // Check the location
            const nodeInfo = this.nodes[neighbor];
            if (nodeInfo) {
                const locationName = `Reach ${nodeInfo.value}`;
                if (!this.checkedLocations.has(locationName) && this.onLocationCheck) {
                    this.onLocationCheck(locationName, neighbor);
                    this.checkedLocations.add(locationName);
                }
            }

            this._notify();
            return { success: true, value: result, moved: true, node: neighbor };
        } else {
            // No matching neighbor — refund presses
            this._refundSinceLastEquals();
            return { success: true, value: result, moved: false, node: null };
        }
    }

    /** Get list of neighbor nodes from current position. */
    getNeighbors() {
        if (this.currentNode === null) {
            // From Start: sphere 0 nodes
            return Object.entries(this.nodes)
                .filter(([_, info]) => info.sphere === 0)
                .map(([name, info]) => ({ name, value: info.value }));
        }
        // Children of current node
        return Object.entries(this.nodes)
            .filter(([_, info]) => info.parent === this.currentNode)
            .map(([name, info]) => ({ name, value: info.value }));
    }

    /** Get display string for the calculator. */
    getDisplayText() {
        if (this.pendingNum !== null) return String(this.pendingNum);
        if (this.displayValue !== null) return String(this.displayValue);
        return '';
    }

    /** Get the pending operation symbol, if any. */
    getPendingOpText() {
        return this.pendingOp || '';
    }

    // --- Private ---

    _compute(left, op, right) {
        switch (op) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/':
                if (right === 0) return null;
                if (left % right !== 0) return null;
                return left / right;
            default: return null;
        }
    }

    _findNeighbor(value) {
        if (this.currentNode === null) {
            // From Start: look for sphere 0 node with matching value
            for (const [name, info] of Object.entries(this.nodes)) {
                if (info.sphere === 0 && info.value === value) return name;
            }
        } else {
            // From a node: look for child with matching value
            for (const [name, info] of Object.entries(this.nodes)) {
                if (info.parent === this.currentNode && info.value === value) return name;
            }
        }
        return null;
    }

    _refundSinceLastEquals() {
        for (const label of this.sinceLastEquals) {
            this.remainingPresses[label] = (this.remainingPresses[label] || 0) + 1;
        }
        this.sinceLastEquals = [];
        this.pendingOp = null;
        this.pendingNum = null;
        this._notify();
    }

    _recalcRemaining() {
        // Count consumed presses in the current sequence
        const consumed = {};
        for (const label of this.currentSequence) {
            if (label !== '=') {
                consumed[label] = (consumed[label] || 0) + 1;
            }
        }
        for (const label of this.sinceLastEquals) {
            consumed[label] = (consumed[label] || 0) + 1;
        }

        this.remainingPresses = {};
        for (const [label, total] of Object.entries(this.totalPresses)) {
            this.remainingPresses[label] = total - (consumed[label] || 0);
        }
    }

    _notify() {
        if (this.onStateChanged) this.onStateChanged();
    }
}
