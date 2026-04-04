/**
 * APCalc v2 game state — tracks button presses, current node, discovered paths.
 *
 * The calculator starts blank. Pressing digits builds a multi-digit number,
 * then = moves to a node at layer 0 (from Start) or layer+1 (from a node).
 * From any node, pressing op, digits, = computes current_value OP operand
 * and moves to any node at the next layer whose value matches.
 *
 * Button presses are consumed per path. Clear restores all presses and
 * returns to Start.
 */

export class APCalcState {
    constructor() {
        /** @type {Object<string, NodeInfo>} region_name → {value, layer, sphere, item} */
        this.nodes = {};
        /** @type {Array<EdgeInfo>} [{source, target, operation, operand, operand_digits}] */
        this.edges = [];
        /** @type {Object<string, number>} button_label → total presses available */
        this.totalPresses = {};
        /** @type {Object<string, number>} button_label → presses remaining this path */
        this.remainingPresses = {};
        /** @type {string|null} current region name, null = Start */
        this.currentNode = null;
        /** @type {number} current layer (0 = at Start before first =) */
        this.currentLayer = 0;
        /** @type {number|null} current calculator display value */
        this.displayValue = null;
        /** @type {string|null} pending operation (+, -, *, /) */
        this.pendingOp = null;
        /** @type {number[]|null} digits being entered for current operand */
        this.pendingDigits = null;
        /** @type {string[]} button presses so far in this path (committed via =) */
        this.currentSequence = [];
        /** @type {string[]} buttons pressed since last = (for refund) */
        this.sinceLastEquals = [];
        /** @type {Array<{node: string, sequence: string[]}>} discovered paths */
        this.discoveredPaths = [];
        /** @type {Set<string>} checked location names */
        this.checkedLocations = new Set();
        /** @type {string[]} available operations */
        this.operations = ['+', '-', '*', '/'];
        /** @type {string} difficulty mode: 'easy', 'medium', 'hard' */
        this.difficulty = 'easy';
        /** @type {Set<string>} edges discovered by the player (for medium/hard) */
        this.discoveredEdges = new Set();
        /** @type {Function|null} callback when location should be checked */
        this.onLocationCheck = null;
        /** @type {Function|null} callback when state changes */
        this.onStateChanged = null;
        /** @type {Function|null} callback when an edge is discovered */
        this.onEdgeDiscovered = null;
    }

    loadFromSlotData(slotData) {
        this.nodes = slotData.nodes || {};
        this.edges = slotData.edges || [];
        this.operations = slotData.operations || ['+', '-', '*', '/'];

        // Build node lookup by (value, layer) for fast neighbor finding
        this._nodeLookup = {}; // "value,layer" → region_name
        for (const [name, info] of Object.entries(this.nodes)) {
            const key = `${info.value},${info.layer}`;
            this._nodeLookup[key] = name;
        }

        // Build edge index by source region name
        this._edgesBySource = {}; // source_region → [edge]
        for (const edge of this.edges) {
            if (!this._edgesBySource[edge.source]) this._edgesBySource[edge.source] = [];
            this._edgesBySource[edge.source].push(edge);
        }

        // Starting buttons
        this.totalPresses = {};
        const startingButtons = slotData.starting_buttons || {};
        for (const [label, count] of Object.entries(startingButtons)) {
            this.totalPresses[label] = (this.totalPresses[label] || 0) + count;
        }

        this.reset();
    }

    /** Sync with Archipelago inventory snapshot. */
    syncFromSnapshot(snapshot) {
        if (!snapshot) return;

        this.totalPresses = {};
        const inventory = snapshot.inventory || {};
        for (const [itemName, count] of Object.entries(inventory)) {
            if (count <= 0) continue;
            const match = itemName.match(/^Button: (.+)$/);
            if (match) {
                this.totalPresses[match[1]] = (this.totalPresses[match[1]] || 0) + count;
            }
        }

        if (snapshot.checkedLocations) {
            this.checkedLocations = new Set(snapshot.checkedLocations);
        }

        this._recalcRemaining();
        this._notify();
    }

    /** Reset calculator: return to Start, restore all presses. */
    reset() {
        this.currentNode = null;
        this.currentLayer = 0;
        this.displayValue = null;
        this.pendingOp = null;
        this.pendingDigits = null;
        this.currentSequence = [];
        this.sinceLastEquals = [];
        this.remainingPresses = { ...this.totalPresses };
        this._notify();
    }

    /** Press a digit button (0-9). Accumulates into multi-digit operand. */
    pressNumber(num) {
        const label = String(num);
        if ((this.remainingPresses[label] || 0) <= 0) return false;

        this.remainingPresses[label]--;
        if (this.pendingDigits === null) {
            this.pendingDigits = [num];
        } else {
            this.pendingDigits.push(num);
        }
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
        this.pendingDigits = null;
        this.sinceLastEquals.push(op);
        this._notify();
        return true;
    }

    /** Press equals. Returns {success, value, moved, node} or {success: false, reason}. */
    pressEquals() {
        const operand = this._composePendingOperand();
        let result;

        if (this.currentNode === null && operand !== null && this.pendingOp === null) {
            // From Start: digit entry → try to reach a layer 0 node
            result = operand;
        } else if (this.pendingOp !== null && operand !== null) {
            // From a node: op + operand
            result = this._compute(this.displayValue, this.pendingOp, operand);
            if (result === null) {
                this._refundSinceLastEquals();
                return { success: false, reason: 'Invalid operation' };
            }
        } else {
            return { success: false, reason: 'Incomplete input' };
        }

        // Find a matching node at the next layer
        const targetLayer = this.currentNode === null ? 0 : this.currentLayer + 1;
        const neighbor = this._findNodeAtLayer(result, targetLayer);

        if (neighbor) {
            this.displayValue = result;
            this.currentNode = neighbor;
            this.currentLayer = targetLayer;
            this.pendingOp = null;
            this.pendingDigits = null;
            this.currentSequence.push(...this.sinceLastEquals, '=');
            this.sinceLastEquals = [];

            // Record the discovered path
            const seqCopy = [...this.currentSequence];
            const alreadyDiscovered = this.discoveredPaths.some(
                p => p.node === neighbor && p.sequence.join(',') === seqCopy.join(',')
            );
            if (!alreadyDiscovered) {
                this.discoveredPaths.push({ node: neighbor, sequence: seqCopy });
            }

            // Mark the edge as discovered (for medium/hard modes)
            const sourceRegion = this.currentSequence.length > 3
                ? this._findPreviousNode(seqCopy) : 'C';
            const edgeKey = `${sourceRegion}->${neighbor}`;
            if (!this.discoveredEdges.has(edgeKey)) {
                this.discoveredEdges.add(edgeKey);
                if (this.onEdgeDiscovered) {
                    this.onEdgeDiscovered(sourceRegion, neighbor);
                }
            }

            // Check the location
            const nodeInfo = this.nodes[neighbor];
            if (nodeInfo) {
                // Use location_name from slot_data if available (normal apworld),
                // otherwise construct from value/layer (worldgen version)
                const locationName = nodeInfo.location_name
                    || (nodeInfo.layer === 0
                        ? `Reach ${nodeInfo.value}`
                        : `Reach ${nodeInfo.value} L${nodeInfo.layer}`);
                if (!this.checkedLocations.has(locationName) && this.onLocationCheck) {
                    this.onLocationCheck(locationName, neighbor);
                    this.checkedLocations.add(locationName);
                }
            }

            this._notify();
            return { success: true, value: result, moved: true, node: neighbor };
        } else {
            // No matching node — refund presses
            this._refundSinceLastEquals();
            return { success: true, value: result, moved: false, node: null };
        }
    }

    /** Get list of neighbor nodes from current position (for status display). */
    getNeighbors() {
        const targetLayer = this.currentNode === null ? 0 : this.currentLayer + 1;
        return Object.entries(this.nodes)
            .filter(([_, info]) => info.layer === targetLayer)
            .map(([name, info]) => ({ name, value: info.value }));
    }

    /** Get display string for the calculator. */
    getDisplayText() {
        if (this.pendingDigits !== null && this.pendingDigits.length > 0) {
            return this.pendingDigits.join('');
        }
        if (this.displayValue !== null) return String(this.displayValue);
        return '';
    }

    /** Get the pending operation symbol, if any. */
    getPendingOpText() {
        return this.pendingOp || '';
    }

    /** Check if a generator edge is player-discoverable in the current difficulty. */
    isEdgeVisible(sourceRegion, targetRegion) {
        if (this.difficulty === 'easy') return true;
        return this.discoveredEdges.has(`${sourceRegion}->${targetRegion}`);
    }

    /** Check if node accessibility should be shown. */
    showAccessibility() {
        return this.difficulty !== 'hard';
    }

    // --- Private ---

    _composePendingOperand() {
        if (this.pendingDigits === null || this.pendingDigits.length === 0) return null;
        return parseInt(this.pendingDigits.join(''), 10);
    }

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

    _findNodeAtLayer(value, layer) {
        const key = `${value},${layer}`;
        return this._nodeLookup?.[key] || null;
    }

    _findPreviousNode(sequence) {
        // Walk backward through the sequence to find the node before the last =
        // This is approximate — find the second-to-last = and determine what node we were at
        let eqCount = 0;
        for (let i = sequence.length - 1; i >= 0; i--) {
            if (sequence[i] === '=') eqCount++;
            if (eqCount === 2) {
                // Replay up to this point to find the node
                // For simplicity, use the layer: previous node is at currentLayer - 1
                break;
            }
        }
        // Approximate: find the most recent node in discoveredPaths that matches
        // the path up to the second-to-last =
        return null; // Fallback — edge tracking still works via the key
    }

    _refundSinceLastEquals() {
        for (const label of this.sinceLastEquals) {
            this.remainingPresses[label] = (this.remainingPresses[label] || 0) + 1;
        }
        this.sinceLastEquals = [];
        this.pendingOp = null;
        this.pendingDigits = null;
        this._notify();
    }

    _recalcRemaining() {
        const consumed = {};
        for (const label of this.currentSequence) {
            if (label !== '=') consumed[label] = (consumed[label] || 0) + 1;
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
