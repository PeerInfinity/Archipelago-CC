/**
 * APCalc generation engine — JavaScript port of apcalc_generator/generator.py + export.py
 *
 * Generates a graph of target-number nodes organized into spheres,
 * then exports as a rules.json-compatible object.
 */

const OPERATIONS = ['+', '-', '*', '/'];
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
    };
}

// --- Counter (like Python's collections.Counter) ---
function counterSubtract(a, b) {
    const result = { ...a };
    for (const [k, v] of Object.entries(b)) {
        result[k] = (result[k] || 0) - v;
    }
    return result;
}

function counterGet(c, key) {
    return c[key] || 0;
}

function counterInc(c, key, amount = 1) {
    c[key] = (c[key] || 0) + amount;
}

// --- Core logic ---

function computePathCost(node, nodes) {
    const cost = {};
    let current = node;
    while (current) {
        if (current.parentIndex === null) {
            counterInc(cost, String(current.value));
        } else {
            counterInc(cost, current.operation);
            counterInc(cost, String(current.operand));
        }
        current = current.parentIndex !== null ? nodes[current.parentIndex] : null;
    }
    return cost;
}

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

function makeNode(index, value, parentIndex, sphere, operation, operand, buttonSequence, item = '') {
    return {
        index, value, parentIndex, sphere, operation, operand, buttonSequence, item,
        get regionName() { return `Node ${this.value}`; },
        get locationName() { return `Reach ${this.value}`; },
    };
}

// --- Main generation (async for UI responsiveness) ---

export async function generate(config, log) {
    const rng = createRng(config.seed);

    const nodes = [];
    const nodeValues = new Set();
    const inventory = {};
    const sphereItems = {};

    // Pre-plan division sphere
    let divideSphere = config.divideSphere;
    if (divideSphere === null || divideSphere === undefined) {
        divideSphere = config.numSpheres > 2 ? Math.min(2, config.numSpheres - 1) : null;
    }
    if (divideSphere !== null && divideSphere < 1) divideSphere = 1;

    log('=== Pre-planning ===');
    log(`  Divide sphere: ${divideSphere}`);
    log(`  Spheres: ${config.numSpheres}, ops/sphere: ${config.opsPerSphere}, `
        + `nums/sphere: ${config.numsPerSphere}, trash/sphere: ${config.trashPerSphere}`);

    // --- Sphere 0 ---
    let sphere0Count = config.opsPerSphere + config.numsPerSphere + config.trashPerSphere;
    sphere0Count = Math.min(sphere0Count, 10);

    log(`\n=== Sphere 0 (${sphere0Count} locations) ===`);

    const availableDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    rng.shuffle(availableDigits);

    for (let i = 0; i < sphere0Count; i++) {
        const value = availableDigits[i];
        const node = makeNode(nodes.length, value, null, 0, null, null, [String(value), '=']);
        nodes.push(node);
        nodeValues.add(value);
        counterInc(inventory, String(value));
        log(`  Node ${node.index}: value=${value}, sequence=[${value}, =], connected to Start`);
    }

    log(`  Starting inventory: ${JSON.stringify(inventory)}`);

    const s0Items = assignItemsForSphere(0, sphere0Count, config, divideSphere, rng);
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
            // Final sphere: all trash, focused on consuming remaining buttons
            realItems = [];
            trashCountTarget = 1;  // minimum; chains will extend to use all ops
            targetCount = trashCountTarget;
        } else {
            targetCount = config.opsPerSphere + config.numsPerSphere + config.trashPerSphere;
            const itemsForSphere = assignItemsForSphere(sphere, targetCount, config, divideSphere, rng);
            realItems = itemsForSphere.filter(it => it !== TRASH_ITEM);
            trashCountTarget = itemsForSphere.filter(it => it === TRASH_ITEM).length;
        }

        log(`\n=== Sphere ${sphere} (target: ${targetCount} locations, `
            + `real items: [${realItems.join(', ')}], trash: ${trashCountTarget}`
            + `${isFinal ? ', FINAL' : ''}) ===`);

        const sphereNodeIndices = [];
        let trashCreated = 0;

        // Division planning
        if (divideSphere !== null && sphere === divideSphere) {
            ensureDivisiblePaths(nodes, nodeValues, inventory, sphereItems, sphere, config, rng, log);
        }

        if (isFinal) {
            // Final sphere: keep generating chains (accepting partial) to consume all buttons
            log('  Generating final sphere chains to consume remaining buttons...');
            let consecutiveFailures = 0;
            const maxFailures = 500;
            while (consecutiveFailures < maxFailures) {
                const chain = generateChainPartial(
                    sphere, nodes, nodeValues, inventory, sphereItems, config, rng, log, true,
                );
                if (!chain.length) { consecutiveFailures++; continue; }
                consecutiveFailures = 0;
                for (const cn of chain) {
                    cn.item = TRASH_ITEM;
                    nodes.push(cn);
                    nodeValues.add(cn.value);
                    sphereNodeIndices.push(cn.index);
                    trashCreated++;
                }
            }
            log(`  Final sphere: created ${trashCreated} nodes`);
        } else {
            // Generate chains for each real item
            for (let itemIdx = 0; itemIdx < realItems.length; itemIdx++) {
                const realItem = realItems[itemIdx];
                log(`  --- Location ${itemIdx + 1}/${realItems.length} (item: ${realItem}) ---`);

                const chain = generateChain(
                    sphere, nodes, nodeValues, inventory, sphereItems, config, rng, log,
                    realItem,
                );

                for (const chainNode of chain) {
                    nodes.push(chainNode);
                    nodeValues.add(chainNode.value);
                    sphereNodeIndices.push(chainNode.index);
                    if (chainNode.item === TRASH_ITEM) trashCreated++;
                }
            }

            // Fill remaining trash
            while (trashCreated < trashCountTarget) {
                log(`  --- Filling trash slot ${trashCreated + 1}/${trashCountTarget} ---`);
                const chain = generateChain(
                    sphere, nodes, nodeValues, inventory, sphereItems, config, rng, log,
                    TRASH_ITEM,
                );
                for (const chainNode of chain) {
                    nodes.push(chainNode);
                    nodeValues.add(chainNode.value);
                    sphereNodeIndices.push(chainNode.index);
                    if (chainNode.item === TRASH_ITEM) trashCreated++;
                }
            }
        }

        const allItems = sphereNodeIndices.map(idx => nodes[idx].item);
        sphereItems[sphere] = allItems;
        for (const item of allItems) {
            if (item !== TRASH_ITEM) counterInc(inventory, item);
        }
        log(`  Sphere ${sphere} complete: ${sphereNodeIndices.length} nodes, items=[${allItems.join(', ')}]`);
        log(`  Inventory after sphere ${sphere}: ${JSON.stringify(inventory)}`);

        // Yield to browser
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Starting buttons
    const startingButtons = {};
    for (const node of nodes) {
        if (node.sphere === 0) {
            counterInc(startingButtons, String(node.value));
        }
    }

    log(`\n=== Generation complete: ${nodes.length} nodes ===`);

    return { nodes, startingButtons, sphereItems, config };
}

function assignItemsForSphere(sphere, count, config, divideSphere, rng) {
    const items = [];

    for (let i = 0; i < config.opsPerSphere; i++) {
        if (sphere === 0) {
            items.push(rng.choice(['+', '-']));
        } else if (divideSphere !== null && sphere === divideSphere && i === 0) {
            items.push('/');
        } else if (i === 0) {
            items.push(rng.choice(['+', '-']));
        } else {
            items.push(rng.choice(OPERATIONS.filter(op => op !== '/')));
        }
    }

    for (let i = 0; i < config.numsPerSphere; i++) {
        items.push(String(rng.randint(0, 9)));
    }

    for (let i = 0; i < config.trashPerSphere; i++) {
        items.push(TRASH_ITEM);
    }

    rng.shuffle(items);
    return items;
}

function generateChain(sphere, nodes, nodeValues, inventory, sphereItems, config, rng, log, realItem, isFinalSphere = false) {
    const maxAttempts = 500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const parent = rng.choice(nodes);

        const childrenCount = nodes.filter(n => n.parentIndex === parent.index).length;
        if (childrenCount >= config.maxBranches) continue;

        const pathCost = computePathCost(parent, nodes);
        const remaining = counterSubtract(inventory, pathCost);

        const availableOps = OPERATIONS.filter(op => counterGet(remaining, op) > 0);
        const availableNums = [];
        for (let n = 0; n < 10; n++) {
            if (counterGet(remaining, String(n)) > 0) availableNums.push(n);
        }

        if (!availableOps.length || !availableNums.length) continue;

        // Sphere constraint
        const prevItems = sphereItems[sphere - 1] || [];
        const firstOp = rng.choice(availableOps);
        const firstNum = rng.choice(availableNums);
        if (!prevItems.includes(firstOp) && !prevItems.includes(String(firstNum))) continue;

        // Chain length
        let totalOps = 0;
        for (const op of OPERATIONS) totalOps += counterGet(remaining, op);
        let totalNums = availableNums.length;
        // Actually count total available num presses, not unique nums
        totalNums = 0;
        for (let n = 0; n < 10; n++) totalNums += Math.max(0, counterGet(remaining, String(n)));

        const reserveOps = isFinalSphere ? 0 : 1;
        let chainTarget = Math.max(1, Math.min(totalOps - reserveOps, totalNums));

        log(`    Parent: ${parent.regionName} (sphere ${parent.sphere})`);
        log(`    Path cost: ${JSON.stringify(pathCost)}`);
        log(`    Remaining: ops=${totalOps}, nums=${totalNums}`);
        log(`    Chain target: ${chainTarget} nodes (${chainTarget - 1} trash + 1 real)`);

        // Build chain
        const chainNodes = [];
        const chainRemaining = { ...remaining };
        let chainParent = parent;
        const chainValues = new Set(nodeValues);
        let success = true;

        for (let step = 0; step < chainTarget; step++) {
            const isLast = step === chainTarget - 1;

            const stepOps = OPERATIONS.filter(op => counterGet(chainRemaining, op) > 0);
            const stepNums = [];
            for (let n = 0; n < 10; n++) {
                if (counterGet(chainRemaining, String(n)) > 0) stepNums.push(n);
            }

            if (!stepOps.length || !stepNums.length) {
                log(`    Chain broke at step ${step}: no ops/nums available`);
                success = false;
                break;
            }

            let op, num, childValue;
            if (step === 0) {
                op = firstOp;
                num = firstNum;
                childValue = applyOp(chainParent.value, op, num);
            } else {
                op = rng.choice(stepOps);
                num = rng.choice(stepNums);
                childValue = applyOp(chainParent.value, op, num);
            }

            let stepRetries = 50;
            while ((childValue === null || chainValues.has(childValue)) && stepRetries > 0) {
                op = rng.choice(stepOps);
                num = rng.choice(stepNums);
                childValue = applyOp(chainParent.value, op, num);
                stepRetries--;
            }

            if (childValue === null || chainValues.has(childValue)) {
                log(`    Chain broke at step ${step}: no valid value found`);
                success = false;
                break;
            }

            const item = isLast ? realItem : TRASH_ITEM;
            const sequence = [...chainParent.buttonSequence, op, String(num), '='];
            const newNode = makeNode(
                nodes.length + chainNodes.length, childValue,
                step === 0 ? parent.index : chainNodes[chainNodes.length - 1].index,
                sphere, op, num, sequence, item,
            );
            chainNodes.push(newNode);
            chainValues.add(childValue);
            chainRemaining[op] = (chainRemaining[op] || 0) - 1;
            chainRemaining[String(num)] = (chainRemaining[String(num)] || 0) - 1;
            chainParent = newNode;

            const itemLabel = item === TRASH_ITEM ? item : `Button: ${item}`;
            log(`    Step ${step}: ${op} ${num} = ${childValue} (item: ${itemLabel})`);
        }

        if (success && chainNodes.length) {
            const baseIndex = nodes.length;
            for (let i = 0; i < chainNodes.length; i++) {
                chainNodes[i].index = baseIndex + i;
                if (i > 0) chainNodes[i].parentIndex = baseIndex + i - 1;
            }
            return chainNodes;
        }
    }

    throw new Error(
        `Failed to generate chain for sphere ${sphere} after ${maxAttempts} attempts. `
        + `inventory=${JSON.stringify(inventory)}, values=${[...nodeValues].sort((a, b) => a - b)}`
    );
}

function generateChainPartial(sphere, nodes, nodeValues, inventory, sphereItems, config, rng, log, isFinalSphere = false) {
    const parent = rng.choice(nodes);

    const childrenCount = nodes.filter(n => n.parentIndex === parent.index).length;
    if (childrenCount >= config.maxBranches) return [];

    const pathCost = computePathCost(parent, nodes);
    const remaining = counterSubtract(inventory, pathCost);

    const availableOps = OPERATIONS.filter(op => counterGet(remaining, op) > 0);
    const availableNums = [];
    for (let n = 0; n < 10; n++) {
        if (counterGet(remaining, String(n)) > 0) availableNums.push(n);
    }
    if (!availableOps.length || !availableNums.length) return [];

    const prevItems = sphereItems[sphere - 1] || [];
    let firstOp = rng.choice(availableOps);
    let firstNum = rng.choice(availableNums);
    if (prevItems.length && !prevItems.includes(firstOp) && !prevItems.includes(String(firstNum))) return [];

    let totalOps = 0;
    for (const op of OPERATIONS) totalOps += Math.max(0, counterGet(remaining, op));
    let totalNums = 0;
    for (let n = 0; n < 10; n++) totalNums += Math.max(0, counterGet(remaining, String(n)));

    const reserveOps = isFinalSphere ? 0 : 1;
    const chainTarget = Math.max(1, Math.min(totalOps - reserveOps, totalNums));

    const chainNodes = [];
    const chainRemaining = { ...remaining };
    let chainParent = parent;
    const chainValues = new Set(nodeValues);

    for (let step = 0; step < chainTarget; step++) {
        const stepOps = OPERATIONS.filter(op => counterGet(chainRemaining, op) > 0);
        const stepNums = [];
        for (let n = 0; n < 10; n++) {
            if (counterGet(chainRemaining, String(n)) > 0) stepNums.push(n);
        }
        if (!stepOps.length || !stepNums.length) break;

        let op, num, childValue;
        if (step === 0) {
            op = firstOp; num = firstNum;
            childValue = applyOp(chainParent.value, op, num);
        } else {
            op = rng.choice(stepOps); num = rng.choice(stepNums);
            childValue = applyOp(chainParent.value, op, num);
        }

        let stepRetries = 50;
        while ((childValue === null || chainValues.has(childValue)) && stepRetries > 0) {
            op = rng.choice(stepOps); num = rng.choice(stepNums);
            childValue = applyOp(chainParent.value, op, num);
            stepRetries--;
        }

        if (childValue === null || chainValues.has(childValue)) break;

        const sequence = [...chainParent.buttonSequence, op, String(num), '='];
        const newNode = makeNode(
            nodes.length + chainNodes.length, childValue,
            step === 0 ? parent.index : chainNodes[chainNodes.length - 1].index,
            sphere, op, num, sequence,
        );
        chainNodes.push(newNode);
        chainValues.add(childValue);
        chainRemaining[op] = (chainRemaining[op] || 0) - 1;
        chainRemaining[String(num)] = (chainRemaining[String(num)] || 0) - 1;
        chainParent = newNode;
    }

    if (chainNodes.length) {
        const baseIndex = nodes.length;
        for (let i = 0; i < chainNodes.length; i++) {
            chainNodes[i].index = baseIndex + i;
            if (i > 0) chainNodes[i].parentIndex = baseIndex + i - 1;
        }
        log(`    Chain of ${chainNodes.length} from ${parent.regionName}: `
            + chainNodes.map(cn => cn.value).join(' → '));
    }
    return chainNodes;
}

function trySingleStep(sphere, nodes, nodeValues, inventory, sphereItems, config, rng) {
    const parent = rng.choice(nodes);

    const childrenCount = nodes.filter(n => n.parentIndex === parent.index).length;
    if (childrenCount >= config.maxBranches) return null;

    const pathCost = computePathCost(parent, nodes);
    const remaining = counterSubtract(inventory, pathCost);

    const availableOps = OPERATIONS.filter(op => counterGet(remaining, op) > 0);
    const availableNums = [];
    for (let n = 0; n < 10; n++) {
        if (counterGet(remaining, String(n)) > 0) availableNums.push(n);
    }
    if (!availableOps.length || !availableNums.length) return null;

    const prevItems = sphereItems[sphere - 1] || [];
    const op = rng.choice(availableOps);
    const num = rng.choice(availableNums);
    if (prevItems.length && !prevItems.includes(op) && !prevItems.includes(String(num))) return null;

    const childValue = applyOp(parent.value, op, num);
    if (childValue === null || nodeValues.has(childValue)) return null;

    const sequence = [...parent.buttonSequence, op, String(num), '='];
    return makeNode(nodes.length, childValue, parent.index, sphere, op, num, sequence);
}

function ensureDivisiblePaths(nodes, nodeValues, inventory, sphereItems, sphere, config, rng, log) {
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
            if (node.value !== 0 && node.value % d === 0 && !nodeValues.has(node.value / d)) {
                divisibleNodes.push([node, d]);
                break;
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
            const pathCost = computePathCost(parent, nodes);
            const remaining = counterSubtract(inventory, pathCost);

            if (counterGet(remaining, '*') <= 0 && counterGet(remaining, '+') <= 0) continue;
            if (counterGet(remaining, String(targetDivisor)) <= 0) continue;

            if (counterGet(remaining, '*') > 0) {
                const candidate = parent.value * targetDivisor;
                if (candidate !== 0 && !nodeValues.has(candidate)) {
                    const sequence = [...parent.buttonSequence, '*', String(targetDivisor), '='];
                    const newNode = makeNode(
                        nodes.length, candidate, parent.index, sphere - 1,
                        '*', targetDivisor, sequence, TRASH_ITEM,
                    );
                    nodes.push(newNode);
                    nodeValues.add(candidate);
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
                    if (candidate !== 0 && candidate % targetDivisor === 0 && !nodeValues.has(candidate)) {
                        const sequence = [...parent.buttonSequence, '+', String(num), '='];
                        const newNode = makeNode(
                            nodes.length, candidate, parent.index, sphere - 1,
                            '+', num, sequence, TRASH_ITEM,
                        );
                        nodes.push(newNode);
                        nodeValues.add(candidate);
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

// --- Export to rules.json ---

function buttonItemName(button) {
    return `Button: ${button}`;
}

function makeHasRule(itemName, count = 1) {
    const rule = { rule: 'Has', args: { item_name: itemName } };
    if (count > 1) rule.args.count = count;
    return rule;
}

function makeAndRule(children) {
    if (children.length === 0) return { rule: 'True_' };
    if (children.length === 1) return children[0];
    return { rule: 'And', children };
}

function pathCostToRule(pathCost) {
    const rules = [];
    for (const button of Object.keys(pathCost).sort()) {
        const count = pathCost[button];
        if (count > 0) rules.push(makeHasRule(`Button: ${button}`, count));
    }
    return makeAndRule(rules);
}

export function exportRulesJson(gameData) {
    const { nodes, startingButtons, config } = gameData;

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

    // Regions
    const regions = {};

    // Start region
    const menuExits = [];
    for (const node of nodes) {
        if (node.sphere === 0) {
            const cost = computePathCost(node, nodes);
            menuExits.push({
                name: `C to ${node.regionName}`,
                connected_region: node.regionName,
                access_rule: pathCostToRule(cost),
            });
        }
    }
    regions['C'] = { name: 'C', exits: menuExits, locations: [] };

    // Child index
    const childrenByParent = {};
    for (const node of nodes) {
        if (node.parentIndex !== null) {
            if (!childrenByParent[node.parentIndex]) childrenByParent[node.parentIndex] = [];
            childrenByParent[node.parentIndex].push(node);
        }
    }

    // Node regions — each gets a check location + a locked "Checked" event
    const allCheckedEvents = [];
    for (const node of nodes) {
        const exits = [];
        for (const child of (childrenByParent[node.index] || [])) {
            const cost = computePathCost(child, nodes);
            exits.push({
                name: `${node.regionName} to ${child.regionName}`,
                connected_region: child.regionName,
                access_rule: pathCostToRule(cost),
            });
        }

        const isTrash = node.item === TRASH_ITEM;
        const itemName = isTrash ? TRASH_ITEM : buttonItemName(node.item);
        const eventName = `Checked ${node.locationName}`;
        allCheckedEvents.push(eventName);

        const locations = [
            {
                name: node.locationName,
                id: node.index + 1,
                access_rule: { rule: 'True_' },
                item: { name: itemName, player: 1, advancement: !isTrash, type: 'None' },
                locked: false,
            },
            {
                name: eventName,
                id: null,
                access_rule: { rule: 'True_' },
                item: { name: eventName, player: 1, advancement: true, type: 'None' },
                locked: true,
                event: true,
            },
        ];

        regions[node.regionName] = { name: node.regionName, exits, locations };
    }

    // Victory event on start region, requiring all locations checked
    const goalRule = makeAndRule(allCheckedEvents.map(evt => makeHasRule(evt)));
    regions['C'].locations.push({
        name: 'Victory', id: null,
        access_rule: goalRule,
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

    // Itempool counts
    const itemPoolCounts = { ...poolCounts };
    for (const evt of allCheckedEvents) itemPoolCounts[evt] = 1;
    itemPoolCounts['Victory'] = 1;

    // Starting items
    const startingItemsList = [];
    for (const [label, count] of Object.entries(startingButtons).sort()) {
        for (let i = 0; i < count; i++) startingItemsList.push(buttonItemName(label));
    }

    // Slot data
    const slotNodes = {};
    for (const node of nodes) {
        slotNodes[node.regionName] = {
            value: node.value,
            parent: node.parentIndex !== null ? nodes[node.parentIndex].regionName : null,
            sphere: node.sphere,
            operation: node.operation,
            operand: node.operand,
            button_sequence: node.buttonSequence,
            item: node.item,
        };
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
