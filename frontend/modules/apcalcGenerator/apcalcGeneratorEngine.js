/**
 * APCalc v2 generation engine — JavaScript port of apcalc_generator/generator.py + export.py
 *
 * Generates a layered graph of target-number nodes organized into spheres.
 * Nodes are (value, layer) pairs. Multiple edges to the same node are encouraged.
 * Button presses are consumed per path; Clear restores all presses.
 */

const OPERATIONS = ['+', '-', '*', '/'];
const OPERATION_ORDER = ['+', '-', '*', '/'];
const TRASH_ITEM = 'Junk';

// --- Seedable RNG (mulberry32) ---
function createRng(seed) {
    let s = seed | 0;
    return {
        next() {
            s |= 0; s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        },
        randint(min, max) {
            return min + Math.floor(this.next() * (max - min + 1));
        },
        choice(arr) {
            return arr[Math.floor(this.next() * arr.length)];
        },
        shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(this.next() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        },
        random() { return this.next(); },
    };
}

// --- Counter helpers ---
function counterSubtract(a, b) {
    const result = { ...a };
    for (const [k, v] of Object.entries(b)) {
        result[k] = (result[k] || 0) - v;
    }
    return result;
}

function counterAdd(a, b) {
    const result = { ...a };
    for (const [k, v] of Object.entries(b)) {
        result[k] = (result[k] || 0) + v;
    }
    return result;
}

function counterGet(c, key) { return c[key] || 0; }
function counterInc(c, key, amount = 1) { c[key] = (c[key] || 0) + amount; }

// --- Core logic ---

function applyOp(parentValue, op, num) {
    switch (op) {
        case '+': return parentValue + num;
        case '-': return parentValue - num;
        case '*': return parentValue * num;
        case '/':
            if (num === 0) return null;
            if (parentValue % num !== 0) return null;
            return parentValue / num;
        default: return null;
    }
}

function reverseOp(parentValue, targetValue, op) {
    let operand;
    switch (op) {
        case '+': operand = targetValue - parentValue; break;
        case '-': operand = parentValue - targetValue; break;
        case '*':
            if (parentValue === 0) return targetValue === 0 ? 0 : null;
            if (targetValue % parentValue !== 0) return null;
            operand = targetValue / parentValue; break;
        case '/':
            if (targetValue === 0) return null;
            if (parentValue % targetValue !== 0) return null;
            operand = parentValue / targetValue;
            if (operand === 0) return null;
            break;
        default: return null;
    }
    return operand >= 0 ? operand : null;
}

function makeNode(index, value, layer, sphere, item = '') {
    return {
        index, value, layer, sphere, item,
        pathCosts: [],
        get regionName() {
            return this.layer === 0 ? `Node ${this.value}` : `Node ${this.value} L${this.layer}`;
        },
        get locationName() {
            return this.layer === 0 ? `Reach ${this.value}` : `Reach ${this.value} L${this.layer}`;
        },
    };
}

function makeEdge(index, sourceIndex, targetIndex, operation, operand, operandDigits, sphere) {
    return { index, sourceIndex, targetIndex, operation, operand, operandDigits, sphere, pathCosts: [] };
}

function composeOperand(availableDigits, rng, targetAvg, remaining) {
    if (!availableDigits.length) return null;

    let maxPossible = 0;
    for (const d of new Set(availableDigits)) maxPossible += counterGet(remaining, String(d));
    if (maxPossible === 0) return null;

    let numDigits;
    if (targetAvg <= 1) {
        numDigits = 1;
    } else {
        const upper = Math.min(maxPossible, targetAvg * 2);
        numDigits = rng.randint(1, Math.max(1, upper));
    }

    const chosen = [];
    const temp = { ...remaining };
    for (let i = 0; i < numDigits; i++) {
        const candidates = availableDigits.filter(d => counterGet(temp, String(d)) > 0);
        if (!candidates.length) break;
        const d = rng.choice(candidates);
        chosen.push(d);
        temp[String(d)] = (temp[String(d)] || 0) - 1;
    }

    if (!chosen.length) return null;

    // Avoid leading zeros
    if (chosen.length > 1 && chosen[0] === 0) {
        let swapped = false;
        for (let i = 1; i < chosen.length; i++) {
            if (chosen[i] !== 0) {
                [chosen[0], chosen[i]] = [chosen[i], chosen[0]];
                swapped = true;
                break;
            }
        }
        if (!swapped) chosen.splice(1); // all zeros → single 0
    }

    const operand = parseInt(chosen.map(String).join(''), 10);
    return [operand, chosen];
}

function operandDigitCost(digits) {
    const cost = {};
    for (const d of digits) counterInc(cost, String(d));
    return cost;
}

function nodeLookupKey(value, layer) { return `${value},${layer}`; }

// --- Item assignment ---

function assignItemsForSphere(sphere, count, config, rng) {
    const items = [];

    for (let i = 0; i < config.opsPerSphere; i++) {
        if (sphere < OPERATION_ORDER.length) {
            items.push(i === 0 ? OPERATION_ORDER[sphere] : rng.choice(OPERATION_ORDER.slice(0, sphere + 1)));
        } else {
            items.push(rng.choice(OPERATIONS));
        }
    }

    for (let i = 0; i < config.numsPerSphere; i++) items.push(String(rng.randint(0, 9)));
    for (let i = 0; i < config.trashPerSphere; i++) items.push(TRASH_ITEM);

    rng.shuffle(items);
    return items;
}

// --- Step picking ---

function pickStep(chainParent, chainRemaining, availableOps, availableDigits, config, rng) {
    const op = rng.choice(availableOps);
    const result = composeOperand(availableDigits, rng, config.numsPerSphere, chainRemaining);
    if (!result) return null;
    const [operand, opDigits] = result;

    // Budget check
    const test = { ...chainRemaining };
    test[op] = (test[op] || 0) - 1;
    if (test[op] < 0) return null;
    for (const d of opDigits) {
        test[String(d)] = (test[String(d)] || 0) - 1;
        if (test[String(d)] < 0) return null;
    }

    const targetValue = applyOp(chainParent.value, op, operand);
    if (targetValue === null) return null;

    return [op, operand, opDigits, targetValue];
}

// --- Chain generation ---

function generateChain(sphere, nodes, edges, nodeLookup, outgoingCounts,
    inventory, sphereItems, config, rng, log, realItem, isFinalSphere = false) {
    const maxAttempts = 500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const parent = rng.choice(nodes);
        if ((outgoingCounts[parent.index] || 0) >= config.maxBranches) continue;
        if (!parent.pathCosts.length) continue;

        const parentCost = rng.choice(parent.pathCosts);
        const remaining = counterSubtract(inventory, parentCost);

        const availableOps = OPERATIONS.filter(op => counterGet(remaining, op) > 0);
        const availableDigits = [];
        for (let d = 0; d < 10; d++) { if (counterGet(remaining, String(d)) > 0) availableDigits.push(d); }
        if (!availableOps.length || !availableDigits.length) continue;

        // Sphere constraint
        const prevItems = sphereItems[sphere - 1] || [];
        let firstOp, firstOperand, firstDigits;
        if (prevItems.length) {
            const prevOps = availableOps.filter(op => prevItems.includes(op));
            const prevDigits = availableDigits.filter(d => prevItems.includes(String(d)));
            if (!prevOps.length && !prevDigits.length) continue;
            if (prevOps.length && (!prevDigits.length || rng.random() < 0.5)) {
                firstOp = rng.choice(prevOps);
            } else {
                firstOp = rng.choice(availableOps);
            }
            const r = composeOperand(availableDigits, rng, config.numsPerSphere, remaining);
            if (!r) continue;
            [firstOperand, firstDigits] = r;
            if (!prevItems.includes(firstOp) && !firstDigits.some(d => prevItems.includes(String(d)))) continue;
        } else {
            firstOp = rng.choice(availableOps);
            const r = composeOperand(availableDigits, rng, config.numsPerSphere, remaining);
            if (!r) continue;
            [firstOperand, firstDigits] = r;
        }

        const firstValue = applyOp(parent.value, firstOp, firstOperand);
        if (firstValue === null) continue;

        // Chain target
        let totalOps = 0;
        for (const op of OPERATIONS) totalOps += counterGet(remaining, op);
        let totalDigits = 0;
        for (let d = 0; d < 10; d++) totalDigits += Math.max(0, counterGet(remaining, String(d)));

        const reserveOps = isFinalSphere ? 0 : 1;
        const avgDigitsPerStep = Math.max(1, config.numsPerSphere);
        const chainTarget = Math.max(1, Math.min(totalOps - reserveOps,
            Math.floor(totalDigits / avgDigitsPerStep)));

        log(`    Parent: ${parent.regionName} (sphere ${parent.sphere}, layer ${parent.layer})`);
        log(`    Path cost: ${JSON.stringify(parentCost)}`);
        log(`    Remaining: ops=${totalOps}, digits=${totalDigits}`);
        log(`    Chain target: ${chainTarget} nodes (${chainTarget - 1} trash + 1 real)`);

        // Build chain
        const chainNodes = [];
        const chainEdges = [];
        const chainRemaining = { ...remaining };
        let chainCost = { ...parentCost };
        let chainParent = parent;
        const chainUsedKeys = new Set();
        let success = true;

        for (let step = 0; step < chainTarget; step++) {
            const isLast = step === chainTarget - 1;

            const stepOps = OPERATIONS.filter(op => counterGet(chainRemaining, op) > 0);
            const stepDigits = [];
            for (let d = 0; d < 10; d++) { if (counterGet(chainRemaining, String(d)) > 0) stepDigits.push(d); }
            if (!stepOps.length || !stepDigits.length) {
                log(`    Chain broke at step ${step}: no ops/digits available`);
                success = false; break;
            }

            let op, operand, opDigits, targetValue;
            if (step === 0) {
                op = firstOp; operand = firstOperand; opDigits = firstDigits;
                targetValue = firstValue;
            } else {
                const sr = pickStep(chainParent, chainRemaining, stepOps, stepDigits, config, rng);
                if (!sr) { log(`    Chain broke at step ${step}: could not pick step`); success = false; break; }
                [op, operand, opDigits, targetValue] = sr;
            }

            const targetLayer = chainParent.layer + 1;
            let key = nodeLookupKey(targetValue, targetLayer);

            let stepRetries = 50;
            while ((nodeLookup.has(key) || chainUsedKeys.has(key)) && stepRetries > 0) {
                const sr = pickStep(chainParent, chainRemaining, stepOps, stepDigits, config, rng);
                if (!sr) break;
                [op, operand, opDigits, targetValue] = sr;
                key = nodeLookupKey(targetValue, chainParent.layer + 1);
                stepRetries--;
            }

            if (nodeLookup.has(key) || chainUsedKeys.has(key) || targetValue === null) {
                log(`    Chain broke at step ${step}: no unique value found`);
                success = false; break;
            }

            const incCost = { [op]: 1 };
            const dc = operandDigitCost(opDigits);
            const newPathCost = counterAdd(counterAdd(chainCost, incCost), dc);

            const item = isLast ? realItem : TRASH_ITEM;
            const newNode = makeNode(nodes.length + chainNodes.length, targetValue, targetLayer, sphere, item);
            newNode.pathCosts.push(newPathCost);
            chainNodes.push(newNode);
            chainUsedKeys.add(key);

            const newEdge = makeEdge(
                edges.length + chainEdges.length,
                step === 0 ? parent.index : chainNodes[chainNodes.length - 2].index,
                newNode.index, op, operand, [...opDigits], sphere,
            );
            newEdge.pathCosts.push(newPathCost);
            chainEdges.push(newEdge);

            chainRemaining[op] = (chainRemaining[op] || 0) - 1;
            for (const d of opDigits) chainRemaining[String(d)] = (chainRemaining[String(d)] || 0) - 1;
            chainCost = newPathCost;
            chainParent = newNode;

            const itemLabel = item === TRASH_ITEM ? item : `Button: ${item}`;
            log(`    Step ${step}: ${op} ${operand} (digits [${opDigits}]) = ${targetValue} L${targetLayer} (item: ${itemLabel})`);
        }

        if (success && chainNodes.length) {
            const baseNode = nodes.length;
            const baseEdge = edges.length;
            for (let i = 0; i < chainNodes.length; i++) chainNodes[i].index = baseNode + i;
            for (let i = 0; i < chainEdges.length; i++) {
                chainEdges[i].index = baseEdge + i;
                if (i > 0) chainEdges[i].sourceIndex = chainNodes[i - 1].index;
                chainEdges[i].targetIndex = chainNodes[i].index;
            }
            for (const cn of chainNodes) {
                nodes.push(cn);
                nodeLookup.set(nodeLookupKey(cn.value, cn.layer), cn.index);
            }
            for (const ce of chainEdges) {
                edges.push(ce);
                outgoingCounts[ce.sourceIndex] = (outgoingCounts[ce.sourceIndex] || 0) + 1;
            }
            return chainNodes;
        }
    }

    throw new Error(`Failed to generate chain for sphere ${sphere} after ${maxAttempts} attempts.`);
}

function generateChainPartial(sphere, nodes, edges, nodeLookup, outgoingCounts,
    inventory, sphereItems, config, rng, log, isFinalSphere = false) {
    const parent = rng.choice(nodes);
    if ((outgoingCounts[parent.index] || 0) >= config.maxBranches) return [];
    if (!parent.pathCosts.length) return [];

    const parentCost = rng.choice(parent.pathCosts);
    const remaining = counterSubtract(inventory, parentCost);

    const availableOps = OPERATIONS.filter(op => counterGet(remaining, op) > 0);
    const availableDigits = [];
    for (let d = 0; d < 10; d++) { if (counterGet(remaining, String(d)) > 0) availableDigits.push(d); }
    if (!availableOps.length || !availableDigits.length) return [];

    // Sphere constraint
    const prevItems = sphereItems[sphere - 1] || [];
    let firstOp = rng.choice(availableOps);
    const r = composeOperand(availableDigits, rng, config.numsPerSphere, remaining);
    if (!r) return [];
    let [firstOperand, firstDigits] = r;
    if (prevItems.length) {
        if (!prevItems.includes(firstOp) && !firstDigits.some(d => prevItems.includes(String(d)))) return [];
    }

    const firstValue = applyOp(parent.value, firstOp, firstOperand);
    if (firstValue === null) return [];

    let totalOps = 0;
    for (const op of OPERATIONS) totalOps += Math.max(0, counterGet(remaining, op));
    let totalDigits = 0;
    for (let d = 0; d < 10; d++) totalDigits += Math.max(0, counterGet(remaining, String(d)));

    const reserveOps = isFinalSphere ? 0 : 1;
    const avgDigitsPerStep = Math.max(1, config.numsPerSphere);
    const chainTarget = Math.max(1, Math.min(totalOps - reserveOps,
        Math.floor(totalDigits / avgDigitsPerStep)));

    log(`    Parent: ${parent.regionName} (sphere ${parent.sphere}, layer ${parent.layer})`);
    log(`    Path cost: ${JSON.stringify(parentCost)}`);
    log(`    Remaining: ops=${totalOps}, digits=${totalDigits}`);
    log(`    Chain target: ${chainTarget} nodes`);

    const chainNodes = [];
    const chainEdges = [];
    const chainRemaining = { ...remaining };
    let chainCost = { ...parentCost };
    let chainParent = parent;
    const chainUsedKeys = new Set();

    for (let step = 0; step < chainTarget; step++) {
        const stepOps = OPERATIONS.filter(op => counterGet(chainRemaining, op) > 0);
        const stepDigits = [];
        for (let d = 0; d < 10; d++) { if (counterGet(chainRemaining, String(d)) > 0) stepDigits.push(d); }
        if (!stepOps.length || !stepDigits.length) {
            log(`    Chain broke at step ${step}: no ops/digits available`); break;
        }

        let op, operand, opDigits, targetValue;
        if (step === 0) {
            op = firstOp; operand = firstOperand; opDigits = firstDigits;
            targetValue = firstValue;
        } else {
            const sr = pickStep(chainParent, chainRemaining, stepOps, stepDigits, config, rng);
            if (!sr) { log(`    Chain broke at step ${step}: could not pick step`); break; }
            [op, operand, opDigits, targetValue] = sr;
        }

        const targetLayer = chainParent.layer + 1;
        let key = nodeLookupKey(targetValue, targetLayer);

        let stepRetries = 50;
        while ((nodeLookup.has(key) || chainUsedKeys.has(key)) && stepRetries > 0) {
            const sr = pickStep(chainParent, chainRemaining, stepOps, stepDigits, config, rng);
            if (!sr) break;
            [op, operand, opDigits, targetValue] = sr;
            key = nodeLookupKey(targetValue, chainParent.layer + 1);
            stepRetries--;
        }

        if (nodeLookup.has(key) || chainUsedKeys.has(key) || targetValue === null) {
            log(`    Chain broke at step ${step}: no unique value found`); break;
        }

        const incCost = { [op]: 1 };
        const dc = operandDigitCost(opDigits);
        const newPathCost = counterAdd(counterAdd(chainCost, incCost), dc);

        const newNode = makeNode(nodes.length + chainNodes.length, targetValue, targetLayer, sphere);
        newNode.pathCosts.push(newPathCost);
        chainNodes.push(newNode);
        chainUsedKeys.add(key);

        const newEdge = makeEdge(
            edges.length + chainEdges.length,
            step === 0 ? parent.index : chainNodes[chainNodes.length - 2].index,
            newNode.index, op, operand, [...opDigits], sphere,
        );
        newEdge.pathCosts.push(newPathCost);
        chainEdges.push(newEdge);

        chainRemaining[op] = (chainRemaining[op] || 0) - 1;
        for (const d of opDigits) chainRemaining[String(d)] = (chainRemaining[String(d)] || 0) - 1;
        chainCost = newPathCost;
        chainParent = newNode;

        log(`    Step ${step}: ${op} ${operand} (digits [${opDigits}]) = ${targetValue} L${targetLayer}`);
    }

    if (chainNodes.length) {
        const baseNode = nodes.length;
        const baseEdge = edges.length;
        for (let i = 0; i < chainNodes.length; i++) chainNodes[i].index = baseNode + i;
        for (let i = 0; i < chainEdges.length; i++) {
            chainEdges[i].index = baseEdge + i;
            if (i > 0) chainEdges[i].sourceIndex = chainNodes[i - 1].index;
            chainEdges[i].targetIndex = chainNodes[i].index;
        }
        for (const cn of chainNodes) {
            nodes.push(cn);
            nodeLookup.set(nodeLookupKey(cn.value, cn.layer), cn.index);
        }
        for (const ce of chainEdges) {
            edges.push(ce);
            outgoingCounts[ce.sourceIndex] = (outgoingCounts[ce.sourceIndex] || 0) + 1;
        }
        if (chainNodes.length < chainTarget) {
            log(`    Chain of ${chainNodes.length}/${chainTarget} from ${parent.regionName}: `
                + chainNodes.map(cn => `${cn.value}L${cn.layer}`).join(' → '));
        } else {
            log(`    Chain of ${chainNodes.length} from ${parent.regionName}: `
                + chainNodes.map(cn => `${cn.value}L${cn.layer}`).join(' → '));
        }
    } else {
        log(`    No chain produced from ${parent.regionName}`);
    }
    return chainNodes;
}

// --- Reuse edges ---

function tryAddReuseEdge(nodes, edges, nodeLookup, outgoingCounts,
    inventory, sphereItems, sphere, config, rng, log) {
    if (nodes.length < 2) return false;

    const parent = rng.choice(nodes);
    if ((outgoingCounts[parent.index] || 0) >= config.maxBranches) return false;
    if (!parent.pathCosts.length) return false;

    const parentCost = rng.choice(parent.pathCosts);
    const remaining = counterSubtract(inventory, parentCost);
    const targetLayer = parent.layer + 1;

    const candidates = nodes.filter(n => n.layer === targetLayer);
    if (!candidates.length) return false;

    const target = rng.choice(candidates);

    // Check no existing edge from this parent to this target
    for (const e of edges) {
        if (e.sourceIndex === parent.index && e.targetIndex === target.index) return false;
    }

    const availableOps = OPERATIONS.filter(op => counterGet(remaining, op) > 0);
    rng.shuffle(availableOps);

    for (const op of availableOps) {
        const neededOperand = reverseOp(parent.value, target.value, op);
        if (neededOperand === null) continue;

        const opDigits = neededOperand > 0
            ? String(neededOperand).split('').map(Number)
            : [0];
        const digitCost = operandDigitCost(opDigits);

        const test = { ...remaining };
        test[op] = (test[op] || 0) - 1;
        if (test[op] < 0) continue;

        let canAfford = true;
        for (const [btn, cnt] of Object.entries(digitCost)) {
            test[btn] = (test[btn] || 0) - cnt;
            if (test[btn] < 0) { canAfford = false; break; }
        }
        if (!canAfford) continue;

        const check = applyOp(parent.value, op, neededOperand);
        if (check !== target.value) continue;

        const incCost = counterAdd({ [op]: 1 }, digitCost);
        const newPathCost = counterAdd(parentCost, incCost);

        const newEdge = makeEdge(edges.length, parent.index, target.index,
            op, neededOperand, opDigits, sphere);
        newEdge.pathCosts.push(newPathCost);
        edges.push(newEdge);
        outgoingCounts[parent.index] = (outgoingCounts[parent.index] || 0) + 1;
        target.pathCosts.push(newPathCost);

        log(`    Reuse edge: ${parent.regionName} ${op} ${neededOperand} → ${target.regionName}`);
        return true;
    }
    return false;
}

// --- Division planning ---

function ensureDivisiblePaths(nodes, edges, nodeLookup, outgoingCounts,
    inventory, sphere, config, rng, log) {
    const availableDivisors = [];
    for (let n = 2; n < 10; n++) {
        if (counterGet(inventory, String(n)) > 0) availableDivisors.push(n);
    }
    if (!availableDivisors.length) {
        log('  Division planning: no useful divisors available, skipping');
        return;
    }

    const divisibleNodes = [];
    for (const node of nodes) {
        for (const d of availableDivisors) {
            if (node.value !== 0 && node.value % d === 0) {
                const result = node.value / d;
                if (!nodeLookup.has(nodeLookupKey(result, node.layer + 1))) {
                    divisibleNodes.push([node, d]);
                    break;
                }
            }
        }
    }

    log(`  Division planning: ${divisibleNodes.length} existing divisible nodes, `
        + `divisors available: [${availableDivisors.join(', ')}]`);

    if (divisibleNodes.length >= 2) {
        log('  Division planning: sufficient divisible paths already exist');
        for (const [node, d] of divisibleNodes.slice(0, 3)) {
            log(`    ${node.regionName} (value=${node.value}) divisible by ${d} → ${node.value / d}`);
        }
        return;
    }

    const needed = 2 - divisibleNodes.length;
    log(`  Division planning: need ${needed} more divisible paths`);

    for (let i = 0; i < needed; i++) {
        const targetDivisor = rng.choice(availableDivisors);
        let created = false;

        for (let attempt = 0; attempt < 200; attempt++) {
            const parent = rng.choice(nodes);
            if (!parent.pathCosts.length) continue;
            const parentCost = rng.choice(parent.pathCosts);
            const remaining = counterSubtract(inventory, parentCost);

            if (counterGet(remaining, '*') <= 0 && counterGet(remaining, '+') <= 0) continue;
            const tdDigits = String(targetDivisor).split('').map(Number);
            if (!tdDigits.every(d => counterGet(remaining, String(d)) > 0)) continue;

            if (counterGet(remaining, '*') > 0) {
                const candidate = parent.value * targetDivisor;
                const targetLayer = parent.layer + 1;
                const key = nodeLookupKey(candidate, targetLayer);
                if (candidate !== 0 && !nodeLookup.has(key)) {
                    const dc = operandDigitCost(tdDigits);
                    const incCost = counterAdd({ '*': 1 }, dc);
                    const newPathCost = counterAdd(parentCost, incCost);

                    const newNode = makeNode(nodes.length, candidate, targetLayer, sphere - 1, TRASH_ITEM);
                    newNode.pathCosts.push(newPathCost);
                    nodes.push(newNode);
                    nodeLookup.set(key, newNode.index);

                    const newEdge = makeEdge(edges.length, parent.index, newNode.index,
                        '*', targetDivisor, tdDigits, sphere - 1);
                    newEdge.pathCosts.push(newPathCost);
                    edges.push(newEdge);
                    outgoingCounts[parent.index] = (outgoingCounts[parent.index] || 0) + 1;

                    log(`  Division planning: created ${newNode.regionName} `
                        + `(= ${parent.value} * ${targetDivisor}, divisible by ${targetDivisor})`);
                    created = true;
                    break;
                }
            }

            if (counterGet(remaining, '+') > 0) {
                for (let num = 0; num < 10; num++) {
                    if (counterGet(remaining, String(num)) <= 0) continue;
                    const candidate = parent.value + num;
                    const targetLayer = parent.layer + 1;
                    const key = nodeLookupKey(candidate, targetLayer);
                    if (candidate !== 0 && candidate % targetDivisor === 0 && !nodeLookup.has(key)) {
                        const dc = operandDigitCost([num]);
                        const incCost = counterAdd({ '+': 1 }, dc);
                        const newPathCost = counterAdd(parentCost, incCost);

                        const newNode = makeNode(nodes.length, candidate, targetLayer, sphere - 1, TRASH_ITEM);
                        newNode.pathCosts.push(newPathCost);
                        nodes.push(newNode);
                        nodeLookup.set(key, newNode.index);

                        const newEdge = makeEdge(edges.length, parent.index, newNode.index,
                            '+', num, [num], sphere - 1);
                        newEdge.pathCosts.push(newPathCost);
                        edges.push(newEdge);
                        outgoingCounts[parent.index] = (outgoingCounts[parent.index] || 0) + 1;

                        log(`  Division planning: created ${newNode.regionName} `
                            + `(= ${parent.value} + ${num}, divisible by ${targetDivisor})`);
                        created = true;
                        break;
                    }
                }
                if (created) break;
            }
        }

        if (!created) {
            log(`  Division planning: WARNING - could not create divisible path for divisor ${targetDivisor}`);
        }
    }
}

// --- Main generation (async for UI responsiveness) ---

export async function generate(config, log) {
    const rng = createRng(config.seed);

    const nodes = [];
    const edges = [];
    const nodeLookup = new Map(); // "value,layer" → node index
    const outgoingCounts = {};
    const inventory = {};
    const sphereItems = {};

    log('=== Pre-planning ===');
    log(`  Spheres: ${config.numSpheres}, ops/sphere: ${config.opsPerSphere}, `
        + `nums/sphere: ${config.numsPerSphere}, trash/sphere: ${config.trashPerSphere}`);
    log(`  Operation order: [${OPERATION_ORDER.slice(0, Math.min(config.numSpheres, OPERATION_ORDER.length)).join(', ')}]`);

    // --- Sphere 0 ---
    let sphere0Count = config.opsPerSphere + config.numsPerSphere + config.trashPerSphere;
    sphere0Count = Math.min(sphere0Count, 10);

    log(`\n=== Sphere 0 (${sphere0Count} locations) ===`);

    const availableDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    rng.shuffle(availableDigits);

    for (let i = 0; i < sphere0Count; i++) {
        const value = availableDigits[i];
        const pathCost = { [String(value)]: 1 };

        const node = makeNode(nodes.length, value, 0, 0);
        node.pathCosts.push(pathCost);
        nodes.push(node);
        nodeLookup.set(nodeLookupKey(value, 0), node.index);

        const edge = makeEdge(edges.length, null, node.index, null, value, [value], 0);
        edge.pathCosts.push(pathCost);
        edges.push(edge);

        counterInc(inventory, String(value));
        log(`  Node ${node.index}: value=${value}, layer=0, connected to Start`);
    }

    log(`  Starting inventory: ${JSON.stringify(inventory)}`);

    const s0Items = assignItemsForSphere(0, sphere0Count, config, rng);
    sphereItems[0] = s0Items;
    for (const item of s0Items) counterInc(inventory, item);
    for (let i = 0; i < sphere0Count; i++) nodes[i].item = s0Items[i];
    log(`  Items assigned: [${s0Items.join(', ')}]`);
    log(`  Inventory after sphere 0: ${JSON.stringify(inventory)}`);

    // --- Spheres 1..N ---
    for (let sphere = 1; sphere < config.numSpheres; sphere++) {
        const isFinal = sphere === config.numSpheres - 1;
        let realItems, trashCountTarget, targetCount;

        if (isFinal) {
            realItems = [];
            trashCountTarget = 1;
            targetCount = 1;
        } else {
            targetCount = config.opsPerSphere + config.numsPerSphere + config.trashPerSphere;
            const itemsForSphere = assignItemsForSphere(sphere, targetCount, config, rng);
            realItems = itemsForSphere.filter(it => it !== TRASH_ITEM);
            trashCountTarget = itemsForSphere.filter(it => it === TRASH_ITEM).length;
        }

        log(`\n=== Sphere ${sphere} (target: ${targetCount} locations, `
            + `real items: [${realItems.join(', ')}], trash: ${trashCountTarget}`
            + `${isFinal ? ', FINAL' : ''}) ===`);

        const sphereNodeIndices = [];
        let trashCreated = 0;

        // Division planning before first sphere that can use /
        if (sphere === Math.min(4, config.numSpheres - 1) && OPERATION_ORDER.length >= 4) {
            ensureDivisiblePaths(nodes, edges, nodeLookup, outgoingCounts,
                inventory, sphere, config, rng, log);
        }

        if (isFinal) {
            const maxNewNodes = nodes.length;
            log(`  Generating final sphere (max ${maxNewNodes} new nodes)...`);
            log(`  Inventory at start: ${JSON.stringify(inventory)}`);

            // Phase 1: aggressive reuse edges
            let reuseAdded = 0;
            const reuseMaxAttempts = maxNewNodes * 10;
            for (let i = 0; i < reuseMaxAttempts; i++) {
                if (tryAddReuseEdge(nodes, edges, nodeLookup, outgoingCounts,
                    inventory, sphereItems, sphere, config, rng, log)) {
                    reuseAdded++;
                }
            }
            log(`  Final sphere reuse edges: ${reuseAdded}`);

            // Phase 2: new trash nodes up to cap
            let consecutiveFailures = 0;
            const maxFailures = 500;
            let totalAttempts = 0;
            let chainsCreated = 0;
            while (consecutiveFailures < maxFailures && trashCreated < maxNewNodes) {
                totalAttempts++;
                const chain = generateChainPartial(
                    sphere, nodes, edges, nodeLookup, outgoingCounts,
                    inventory, sphereItems, config, rng, log, true,
                );
                if (!chain.length) { consecutiveFailures++; continue; }
                consecutiveFailures = 0;
                chainsCreated++;
                for (const cn of chain) {
                    cn.item = TRASH_ITEM;
                    sphereNodeIndices.push(cn.index);
                    trashCreated++;
                    if (trashCreated >= maxNewNodes) break;
                }
            }
            log(`  Final sphere: created ${trashCreated} nodes in ${chainsCreated} chains `
                + `(${totalAttempts} attempts), ${reuseAdded} reuse edges`);
        } else {
            for (let itemIdx = 0; itemIdx < realItems.length; itemIdx++) {
                const realItem = realItems[itemIdx];
                log(`  --- Location ${itemIdx + 1}/${realItems.length} (item: ${realItem}) ---`);
                const chain = generateChain(
                    sphere, nodes, edges, nodeLookup, outgoingCounts,
                    inventory, sphereItems, config, rng, log, realItem,
                );
                for (const cn of chain) {
                    sphereNodeIndices.push(cn.index);
                    if (cn.item === TRASH_ITEM) trashCreated++;
                }
            }

            while (trashCreated < trashCountTarget) {
                log(`  --- Filling trash slot ${trashCreated + 1}/${trashCountTarget} ---`);
                const chain = generateChain(
                    sphere, nodes, edges, nodeLookup, outgoingCounts,
                    inventory, sphereItems, config, rng, log, TRASH_ITEM,
                );
                for (const cn of chain) {
                    sphereNodeIndices.push(cn.index);
                    if (cn.item === TRASH_ITEM) trashCreated++;
                }
            }

            // Add reuse edges
            let reuseCount = config.reuseAttempts || Math.max(1, Math.floor(sphereNodeIndices.length / 2));
            let reuseAdded = 0;
            for (let i = 0; i < reuseCount * 5; i++) {
                if (reuseAdded >= reuseCount) break;
                if (tryAddReuseEdge(nodes, edges, nodeLookup, outgoingCounts,
                    inventory, sphereItems, sphere, config, rng, log)) {
                    reuseAdded++;
                }
            }
            if (reuseAdded > 0) log(`  Reuse edges added: ${reuseAdded}`);
        }

        const allItems = sphereNodeIndices.map(idx => nodes[idx].item);
        sphereItems[sphere] = allItems;
        for (const item of allItems) {
            if (item !== TRASH_ITEM) counterInc(inventory, item);
        }
        const actualCount = sphereNodeIndices.length;
        if (actualCount !== targetCount) {
            log(`  Sphere ${sphere} complete: ${actualCount} nodes (target was ${targetCount}), items=[${allItems.join(', ')}]`);
        } else {
            log(`  Sphere ${sphere} complete: ${actualCount} nodes, items=[${allItems.join(', ')}]`);
        }
        log(`  Inventory after sphere ${sphere}: ${JSON.stringify(inventory)}`);

        await new Promise(resolve => setTimeout(resolve, 0));
    }

    const startingButtons = {};
    for (const node of nodes) {
        if (node.layer === 0 && node.sphere === 0) counterInc(startingButtons, String(node.value));
    }

    log(`\n=== Generation complete: ${nodes.length} nodes, ${edges.length} edges ===`);

    return { nodes, edges, startingButtons, sphereItems, config };
}

// --- Export to rules.json ---

function buttonItemName(button) { return `Button: ${button}`; }

function makeHasRule(itemName, count = 1) {
    const rule = { rule: 'Has', args: { item_name: itemName } };
    if (count > 1) rule.args.count = count;
    return rule;
}

function makeAndRule(children) {
    if (!children.length) return { rule: 'True_' };
    if (children.length === 1) return children[0];
    return { rule: 'And', children };
}

function makeOrRule(children) {
    if (!children.length) return { rule: 'True_' };
    if (children.length === 1) return children[0];
    return { rule: 'Or', children };
}

function pathCostToRule(pathCost) {
    const rules = [];
    for (const button of Object.keys(pathCost).sort()) {
        const count = pathCost[button];
        if (count > 0) rules.push(makeHasRule(`Button: ${button}`, count));
    }
    return makeAndRule(rules);
}

function pathCostsToRule(pathCosts) {
    if (!pathCosts.length) return { rule: 'True_' };
    if (pathCosts.length === 1) return pathCostToRule(pathCosts[0]);

    const seen = new Set();
    const unique = [];
    for (const pc of pathCosts) {
        const key = Object.entries(pc).sort().map(([k, v]) => `${k}:${v}`).join(',');
        if (!seen.has(key)) { seen.add(key); unique.push(pc); }
    }
    if (unique.length === 1) return pathCostToRule(unique[0]);
    return makeOrRule(unique.map(pc => pathCostToRule(pc)));
}

export function exportRulesJson(gameData) {
    const { nodes, edges, startingButtons, config } = gameData;

    const allButtonLabels = new Set();
    let trashCount = 0;
    for (const node of nodes) {
        if (node.item && node.item !== TRASH_ITEM) allButtonLabels.add(node.item);
        else if (node.item === TRASH_ITEM) trashCount++;
    }
    for (const label of Object.keys(startingButtons)) allButtonLabels.add(label);

    const poolCounts = {};
    for (const node of nodes) {
        if (node.item && node.item !== TRASH_ITEM) {
            const name = buttonItemName(node.item);
            poolCounts[name] = (poolCounts[name] || 0) + 1;
        }
    }
    if (trashCount > 0) poolCounts[TRASH_ITEM] = trashCount;

    // Index edges by source
    const edgesBySource = {};
    for (const edge of edges) {
        const key = edge.sourceIndex === null ? 'null' : edge.sourceIndex;
        if (!edgesBySource[key]) edgesBySource[key] = [];
        edgesBySource[key].push(edge);
    }

    // Regions
    const regions = {};

    // Start region
    const menuExits = [];
    for (const edge of (edgesBySource['null'] || [])) {
        const target = nodes[edge.targetIndex];
        menuExits.push({
            name: `C to ${target.regionName}`,
            connected_region: target.regionName,
            access_rule: pathCostsToRule(edge.pathCosts),
        });
    }
    regions['C'] = { name: 'C', exits: menuExits, locations: [] };

    // Node regions
    const allCheckedEvents = [];
    for (const node of nodes) {
        const exits = [];
        // Group edges by target
        const targetEdges = {};
        for (const edge of (edgesBySource[node.index] || [])) {
            if (!targetEdges[edge.targetIndex]) targetEdges[edge.targetIndex] = [];
            targetEdges[edge.targetIndex].push(edge);
        }
        for (const [targetIdx, tedges] of Object.entries(targetEdges)) {
            const target = nodes[targetIdx];
            const allCosts = [];
            for (const te of tedges) allCosts.push(...te.pathCosts);
            exits.push({
                name: `${node.regionName} to ${target.regionName}`,
                connected_region: target.regionName,
                access_rule: pathCostsToRule(allCosts),
            });
        }

        const isTrash = node.item === TRASH_ITEM;
        const itemName = isTrash ? TRASH_ITEM : buttonItemName(node.item);
        const eventName = `Checked ${node.locationName}`;
        allCheckedEvents.push(eventName);

        const locations = [
            {
                name: node.locationName, id: node.index + 1,
                access_rule: { rule: 'True_' },
                item: { name: itemName, player: 1, advancement: !isTrash, type: 'None' },
                locked: false,
            },
            {
                name: eventName, id: null,
                access_rule: { rule: 'True_' },
                item: { name: eventName, player: 1, advancement: true, type: 'None' },
                locked: true, event: true,
            },
        ];

        regions[node.regionName] = { name: node.regionName, exits, locations };
    }

    // Victory
    const goalRule = makeAndRule(allCheckedEvents.map(evt => makeHasRule(evt)));
    regions['C'].locations.push({
        name: 'Victory', id: null, access_rule: goalRule,
        item: { name: 'Victory', player: 1, advancement: true, type: 'None' },
        locked: true, event: true,
    });

    // Items
    const items = {};
    let itemId = 1;
    for (const label of [...allButtonLabels].sort()) {
        const name = buttonItemName(label);
        const total = (poolCounts[name] || 0) + (startingButtons[label] || 0);
        items[name] = {
            name, id: itemId++, groups: ['Buttons'],
            classification: 'progression', type: null, max_count: Math.max(total, 1),
        };
    }
    if (trashCount > 0) {
        items[TRASH_ITEM] = {
            name: TRASH_ITEM, id: itemId++, groups: ['Filler'],
            classification: 'filler', type: null, max_count: trashCount,
        };
    }
    for (const evt of allCheckedEvents) {
        items[evt] = {
            name: evt, id: null, groups: ['Event'],
            classification: 'progression', event: true, type: 'Event', max_count: 1,
        };
    }
    items['Victory'] = {
        name: 'Victory', id: null, groups: ['Event'],
        classification: 'progression', event: true, type: 'Event', max_count: 1,
    };

    const itemPoolCounts = { ...poolCounts };
    for (const evt of allCheckedEvents) itemPoolCounts[evt] = 1;
    itemPoolCounts['Victory'] = 1;

    const startingItemsList = [];
    for (const [label, count] of Object.entries(startingButtons).sort()) {
        for (let i = 0; i < count; i++) startingItemsList.push(buttonItemName(label));
    }

    // Slot data
    const slotNodes = {};
    for (const node of nodes) {
        slotNodes[node.regionName] = {
            value: node.value, layer: node.layer, sphere: node.sphere, item: node.item,
        };
    }

    const slotEdges = [];
    for (const edge of edges) {
        slotEdges.push({
            source: edge.sourceIndex !== null ? nodes[edge.sourceIndex].regionName : 'C',
            target: nodes[edge.targetIndex].regionName,
            operation: edge.operation, operand: edge.operand,
            operand_digits: edge.operandDigits,
        });
    }

    return {
        schema_version: 3,
        game_name: 'APCalc',
        game_directory: 'apcalc',
        archipelago_version: '0.6.7',
        generation_seed: config.seed,
        seed_name: String(config.seed),
        player_names: { '1': 'Player1' },
        regions: { '1': regions },
        start_regions: { '1': { default: ['C'], available: [] } },
        items: { '1': items },
        item_groups: { '1': ['Buttons'] },
        itempool_counts: { '1': itemPoolCounts },
        canonical_placements: { '1': {} },
        progression_mapping: { '1': {} },
        starting_items: { '1': startingItemsList },
        world: {
            '1': {
                game: 'APCalc',
                world_class_name: 'APCalcWorld',
                options: {}, option_definitions: {},
                world_description: 'APCalc is a calculator-themed puzzle game. '
                    + 'Collect number and operation buttons, then budget your presses '
                    + 'to navigate a graph of target numbers.',
                slot_data: {
                    nodes: slotNodes,
                    edges: slotEdges,
                    starting_buttons: startingButtons,
                    operations: ['+', '-', '*', '/'],
                    num_spheres: config.numSpheres,
                    goal: 'all_locations',
                },
                web: {
                    theme: 'dirt',
                    tutorials: [{
                        name: 'APCalc Setup Guide',
                        description: 'A guide to setting up APCalc.',
                        language: 'English',
                        file_name: 'setup_en.md',
                        link: 'setup/en',
                        authors: ['PeerInfinity'],
                    }],
                },
                world_directory: 'apcalc',
            },
        },
        exporter: {},
        game_info: {
            '1': { completion_condition: { type: 'item_check', item: 'Victory' } },
        },
        helpers: {},
    };
}
