"""Core APCalc v2 generation algorithm.

Generates a layered graph of target-number nodes organized into spheres.
Nodes are (value, layer) pairs. Multiple edges to the same node are encouraged.
Button presses are consumed per path; Clear restores all presses.

Key behaviors (v2):
- Layer-based structure: nodes gated by equals-press depth
- Multi-digit operands: digits composed from individual button items
- Multi-path nodes: same (value, layer) reachable via different routes
- One new operation per sphere for first four spheres (+, -, *, /)
- Reuse edges: after chains, add alternative paths to existing nodes
- Detailed logging via callback
"""

import random
from collections import Counter
from dataclasses import dataclass, field

OPERATIONS = ['+', '-', '*', '/']
OPERATION_ORDER = ['+', '-', '*', '/']  # introduction order across spheres 0-3
TRASH_ITEM = 'Junk'


@dataclass
class Node:
    index: int
    value: int
    layer: int                  # number of = presses from Start
    sphere: int                 # which generation sphere created this node
    item: str = ''
    path_costs: list = field(default_factory=list)  # list[Counter] full paths from Start

    @property
    def region_name(self):
        if self.layer == 0:
            return f"Node {self.value}"
        return f"Node {self.value} L{self.layer}"

    @property
    def location_name(self):
        if self.layer == 0:
            return f"Reach {self.value}"
        return f"Reach {self.value} L{self.layer}"


@dataclass
class Edge:
    index: int
    source_index: int | None    # None for Start → layer 0
    target_index: int
    operation: str | None       # None for layer 0 (digit entry)
    operand: int | None
    operand_digits: list[int]   # individual digits for cost
    sphere: int
    path_costs: list = field(default_factory=list)  # list[Counter]


@dataclass
class APCalcConfig:
    num_spheres: int = 8
    ops_per_sphere: int = 1
    nums_per_sphere: int = 2
    trash_per_sphere: int = 1
    max_branches: int = 5
    seed: int = 42
    reuse_attempts: int = 0     # reuse edges per sphere (0 = auto based on node count)


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def apply_op(parent_value: int, op: str, num: int) -> int | None:
    """Apply operation. Returns result or None if invalid."""
    if op == '+':
        return parent_value + num
    if op == '-':
        return parent_value - num
    if op == '*':
        return parent_value * num
    if op == '/':
        if num == 0:
            return None
        if parent_value % num != 0:
            return None
        return parent_value // num
    return None


def reverse_op(parent_value: int, target_value: int, op: str) -> int | None:
    """Compute operand such that parent OP operand = target.

    Returns non-negative int or None.
    """
    if op == '+':
        operand = target_value - parent_value
    elif op == '-':
        operand = parent_value - target_value
    elif op == '*':
        if parent_value == 0:
            return 0 if target_value == 0 else None
        if target_value % parent_value != 0:
            return None
        operand = target_value // parent_value
    elif op == '/':
        if target_value == 0:
            return None
        if parent_value % target_value != 0:
            return None
        operand = parent_value // target_value
        if operand == 0:
            return None
    else:
        return None

    return operand if operand >= 0 else None


def compose_operand(
    available_digits: list[int], rng: random.Random,
    target_avg: int, remaining: Counter,
) -> tuple[int, list[int]] | None:
    """Compose a multi-digit operand from available digits.

    Returns (operand_value, chosen_digits) or None.
    """
    if not available_digits:
        return None

    max_possible = sum(remaining[str(d)] for d in set(available_digits))
    if max_possible == 0:
        return None

    # Pick digit count: 1 to 2*target_avg, capped by budget
    if target_avg <= 1:
        num_digits = 1
    else:
        upper = min(max_possible, target_avg * 2)
        num_digits = rng.randint(1, max(1, upper))

    # Pick digits respecting budget
    chosen = []
    temp = Counter(remaining)
    for _ in range(num_digits):
        candidates = [d for d in available_digits if temp[str(d)] > 0]
        if not candidates:
            break
        d = rng.choice(candidates)
        chosen.append(d)
        temp[str(d)] -= 1

    if not chosen:
        return None

    # Avoid leading zeros for multi-digit operands
    if len(chosen) > 1 and chosen[0] == 0:
        for i in range(1, len(chosen)):
            if chosen[i] != 0:
                chosen[0], chosen[i] = chosen[i], chosen[0]
                break
        else:
            chosen = [0]  # all zeros → single 0

    operand = int(''.join(str(d) for d in chosen))
    return operand, chosen


def operand_digit_cost(digits: list[int]) -> Counter:
    """Compute button cost for an operand's digits."""
    cost = Counter()
    for d in digits:
        cost[str(d)] += 1
    return cost


# ---------------------------------------------------------------------------
# Main generation
# ---------------------------------------------------------------------------

def generate(config: APCalcConfig, log=None) -> dict:
    """Generate APCalc v2 game data.

    Returns dict with keys: nodes, edges, starting_buttons, sphere_items, config.
    """
    if log is None:
        log_entries = []
        log = log_entries.append
    else:
        log_entries = None

    rng = random.Random(config.seed)

    nodes: list[Node] = []
    edges: list[Edge] = []
    node_lookup: dict[tuple[int, int], int] = {}   # (value, layer) → node index
    outgoing_counts: Counter = Counter()             # node_index → count
    inventory = Counter()
    sphere_items: dict[int, list[str]] = {}

    log('=== Pre-planning ===')
    log(f'  Spheres: {config.num_spheres}, ops/sphere: {config.ops_per_sphere}, '
        f'nums/sphere: {config.nums_per_sphere}, trash/sphere: {config.trash_per_sphere}')
    log(f'  Operation order: {OPERATION_ORDER[:min(config.num_spheres, len(OPERATION_ORDER))]}')

    # --- Sphere 0: single-digit layer-0 nodes ---
    sphere_0_count = config.ops_per_sphere + config.nums_per_sphere + config.trash_per_sphere
    sphere_0_count = min(sphere_0_count, 10)

    log(f'\n=== Sphere 0 ({sphere_0_count} locations) ===')

    available_digits = list(range(10))
    rng.shuffle(available_digits)

    for i in range(sphere_0_count):
        value = available_digits[i]
        path_cost = Counter({str(value): 1})

        node = Node(index=len(nodes), value=value, layer=0, sphere=0)
        node.path_costs.append(path_cost)
        nodes.append(node)
        node_lookup[(value, 0)] = node.index

        edge = Edge(
            index=len(edges), source_index=None, target_index=node.index,
            operation=None, operand=value, operand_digits=[value], sphere=0,
        )
        edge.path_costs.append(path_cost)
        edges.append(edge)

        inventory[str(value)] += 1
        log(f'  Node {node.index}: value={value}, layer=0, connected to Start')

    log(f'  Starting inventory: {dict(inventory)}')

    # Assign sphere 0 items
    s0_items = _assign_items_for_sphere(0, sphere_0_count, config, rng)
    sphere_items[0] = s0_items
    for item in s0_items:
        inventory[item] += 1
    for i in range(sphere_0_count):
        nodes[i].item = s0_items[i]
    log(f'  Items assigned: {s0_items}')
    log(f'  Inventory after sphere 0: {dict(inventory)}')

    # --- Spheres 1..N ---
    for sphere in range(1, config.num_spheres):
        is_final = (sphere == config.num_spheres - 1)

        if is_final:
            real_items = []
            trash_count_target = 1
            target_count = 1
        else:
            target_count = config.ops_per_sphere + config.nums_per_sphere + config.trash_per_sphere
            items_for_sphere = _assign_items_for_sphere(sphere, target_count, config, rng)
            real_items = [it for it in items_for_sphere if it != TRASH_ITEM]
            trash_count_target = items_for_sphere.count(TRASH_ITEM)

        log(f'\n=== Sphere {sphere} (target: {target_count} locations, '
            f'real items: {real_items}, trash: {trash_count_target}'
            f'{", FINAL" if is_final else ""}) ===')

        sphere_node_indices = []
        trash_created = 0

        # Division planning: ensure divisible paths before first sphere that can use /
        # / is awarded in sphere 3 (index 3), first usable in sphere 4
        if sphere == min(4, config.num_spheres - 1) and len(OPERATION_ORDER) >= 4:
            _ensure_divisible_paths(
                nodes, edges, node_lookup, outgoing_counts,
                inventory, sphere, config, rng, log,
            )

        if is_final:
            max_new_nodes = len(nodes)  # don't more than double existing graph
            log(f'  Generating final sphere (max {max_new_nodes} new nodes)...')
            log(f'  Inventory at start: {dict(inventory)}')

            # Phase 1: aggressively add reuse edges to consume buttons
            reuse_added = 0
            reuse_max_attempts = max_new_nodes * 10
            for _ in range(reuse_max_attempts):
                if _try_add_reuse_edge(
                    nodes, edges, node_lookup, outgoing_counts,
                    inventory, sphere_items, sphere, config, rng, log,
                ):
                    reuse_added += 1
            log(f'  Final sphere reuse edges: {reuse_added}')

            # Phase 2: create new trash nodes up to the cap
            consecutive_failures = 0
            max_failures = 500
            total_attempts = 0
            chains_created = 0
            while consecutive_failures < max_failures and trash_created < max_new_nodes:
                total_attempts += 1
                chain = _generate_chain_partial(
                    sphere, nodes, edges, node_lookup, outgoing_counts,
                    inventory, sphere_items, config, rng, log,
                    is_final_sphere=True,
                )
                if not chain:
                    consecutive_failures += 1
                    continue
                consecutive_failures = 0
                chains_created += 1
                for cn in chain:
                    cn.item = TRASH_ITEM
                    sphere_node_indices.append(cn.index)
                    trash_created += 1
                    if trash_created >= max_new_nodes:
                        break
            log(f'  Final sphere: created {trash_created} nodes in {chains_created} chains '
                f'({total_attempts} attempts), {reuse_added} reuse edges')
        else:
            # Generate chains for each real item
            for item_idx, real_item in enumerate(real_items):
                log(f'  --- Location {item_idx + 1}/{len(real_items)} (item: {real_item}) ---')
                chain = _generate_chain(
                    sphere, nodes, edges, node_lookup, outgoing_counts,
                    inventory, sphere_items, config, rng, log,
                    real_item=real_item,
                )
                for cn in chain:
                    sphere_node_indices.append(cn.index)
                    if cn.item == TRASH_ITEM:
                        trash_created += 1

            # Fill remaining trash slots
            while trash_created < trash_count_target:
                log(f'  --- Filling trash slot {trash_created + 1}/{trash_count_target} ---')
                chain = _generate_chain(
                    sphere, nodes, edges, node_lookup, outgoing_counts,
                    inventory, sphere_items, config, rng, log,
                    real_item=TRASH_ITEM,
                )
                for cn in chain:
                    sphere_node_indices.append(cn.index)
                    if cn.item == TRASH_ITEM:
                        trash_created += 1

            # Add reuse edges for graph density
            reuse_count = config.reuse_attempts
            if reuse_count == 0:
                reuse_count = max(1, len(sphere_node_indices) // 2)
            reuse_added = 0
            for _ in range(reuse_count * 5):  # allow some failures
                if reuse_added >= reuse_count:
                    break
                if _try_add_reuse_edge(
                    nodes, edges, node_lookup, outgoing_counts,
                    inventory, sphere_items, sphere, config, rng, log,
                ):
                    reuse_added += 1
            if reuse_added > 0:
                log(f'  Reuse edges added: {reuse_added}')

        # Record sphere items
        all_items = [nodes[idx].item for idx in sphere_node_indices]
        sphere_items[sphere] = all_items
        for item in all_items:
            if item != TRASH_ITEM:
                inventory[item] += 1
        actual_count = len(sphere_node_indices)
        if actual_count != target_count:
            log(f'  Sphere {sphere} complete: {actual_count} nodes (target was {target_count}), '
                f'items={all_items}')
        else:
            log(f'  Sphere {sphere} complete: {actual_count} nodes, items={all_items}')
        log(f'  Inventory after sphere {sphere}: {dict(inventory)}')

    # Build starting buttons
    starting_buttons: dict[str, int] = {}
    for node in nodes:
        if node.layer == 0 and node.sphere == 0:
            key = str(node.value)
            starting_buttons[key] = starting_buttons.get(key, 0) + 1

    result = {
        'nodes': nodes,
        'edges': edges,
        'starting_buttons': starting_buttons,
        'sphere_items': sphere_items,
        'config': config,
    }
    if log_entries is not None:
        result['log_entries'] = log_entries

    log(f'\n=== Generation complete: {len(nodes)} nodes, {len(edges)} edges ===')
    return result


# ---------------------------------------------------------------------------
# Item assignment
# ---------------------------------------------------------------------------

def _assign_items_for_sphere(
    sphere: int, count: int, config: APCalcConfig, rng: random.Random,
) -> list[str]:
    """Assign button items for a sphere's locations.

    Spheres 0-3 each introduce one new operation in OPERATION_ORDER.
    Later spheres award random duplicate operations.
    """
    items = []

    for i in range(config.ops_per_sphere):
        if sphere < len(OPERATION_ORDER):
            if i == 0:
                items.append(OPERATION_ORDER[sphere])
            else:
                available = OPERATION_ORDER[:sphere + 1]
                items.append(rng.choice(available))
        else:
            items.append(rng.choice(OPERATIONS))

    for _ in range(config.nums_per_sphere):
        items.append(str(rng.randint(0, 9)))

    for _ in range(config.trash_per_sphere):
        items.append(TRASH_ITEM)

    rng.shuffle(items)
    return items


# ---------------------------------------------------------------------------
# Chain generation
# ---------------------------------------------------------------------------

def _pick_step(
    chain_parent: Node, chain_remaining: Counter,
    available_ops: list[str], available_digits: list[int],
    config: APCalcConfig, rng: random.Random,
) -> tuple[str, int, list[int], int | None] | None:
    """Pick an operation + operand for one chain step.

    Returns (op, operand, operand_digits, result_value) or None.
    """
    op = rng.choice(available_ops)
    result = compose_operand(available_digits, rng, config.nums_per_sphere, chain_remaining)
    if result is None:
        return None
    operand, operand_digits = result

    # Check we have budget for op + digits
    test_remaining = Counter(chain_remaining)
    test_remaining[op] -= 1
    if test_remaining[op] < 0:
        return None
    for d in operand_digits:
        test_remaining[str(d)] -= 1
        if test_remaining[str(d)] < 0:
            return None

    target_value = apply_op(chain_parent.value, op, operand)
    if target_value is None:
        return None

    return op, operand, operand_digits, target_value


def _generate_chain(
    sphere: int, nodes: list[Node], edges: list[Edge],
    node_lookup: dict, outgoing_counts: Counter,
    inventory: Counter, sphere_items: dict,
    config: APCalcConfig, rng: random.Random, log,
    real_item: str, is_final_sphere: bool = False,
) -> list[Node]:
    """Generate a chain of new nodes from a parent.

    Each step creates a new (value, layer) node. Intermediate nodes get trash;
    the final node gets real_item. Retries on (value, layer) collision.
    Returns list of newly created nodes.
    """
    max_attempts = 500

    for attempt in range(max_attempts):
        parent = rng.choice(nodes)

        if outgoing_counts[parent.index] >= config.max_branches:
            continue

        if not parent.path_costs:
            continue
        parent_cost = rng.choice(parent.path_costs)
        remaining = inventory - parent_cost

        available_ops = [op for op in OPERATIONS if remaining[op] > 0]
        available_digits = [d for d in range(10) if remaining[str(d)] > 0]
        if not available_ops or not available_digits:
            continue

        # Sphere constraint: first step must use item from previous sphere
        prev_items = sphere_items.get(sphere - 1, [])
        if prev_items:
            prev_ops = [op for op in available_ops if op in prev_items]
            prev_digits = [d for d in available_digits if str(d) in prev_items]
            if not prev_ops and not prev_digits:
                continue
            # Bias first step toward prev sphere items
            if prev_ops and (not prev_digits or rng.random() < 0.5):
                first_op = rng.choice(prev_ops)
            else:
                first_op = rng.choice(available_ops)
            first_result = compose_operand(available_digits, rng, config.nums_per_sphere, remaining)
            if first_result is None:
                continue
            first_operand, first_digits = first_result
            # Verify constraint
            has_prev = first_op in prev_items or any(str(d) in prev_items for d in first_digits)
            if not has_prev:
                continue
        else:
            first_op = rng.choice(available_ops)
            first_result = compose_operand(available_digits, rng, config.nums_per_sphere, remaining)
            if first_result is None:
                continue
            first_operand, first_digits = first_result

        # Check first step is valid
        first_value = apply_op(parent.value, first_op, first_operand)
        if first_value is None:
            continue

        # Compute chain length
        total_ops = sum(remaining[op] for op in OPERATIONS)
        total_digits = sum(max(0, remaining[str(d)]) for d in range(10))
        reserve_ops = 0 if is_final_sphere else 1
        avg_digits_per_step = max(1, config.nums_per_sphere)
        chain_target = max(1, min(total_ops - reserve_ops, total_digits // avg_digits_per_step))

        log(f'    Parent: {parent.region_name} (sphere {parent.sphere}, layer {parent.layer})')
        log(f'    Path cost: {dict(parent_cost)}')
        log(f'    Remaining: ops={total_ops}, digits={total_digits}')
        log(f'    Chain target: {chain_target} nodes '
            f'({chain_target - 1} trash + 1 real)')

        # Build chain
        chain_nodes = []
        chain_edges = []
        chain_remaining = Counter(remaining)
        chain_cost = Counter(parent_cost)
        chain_parent = parent
        chain_used_keys: set[tuple[int, int]] = set()  # (value, layer) created in this chain
        success = True

        for step in range(chain_target):
            is_last = (step == chain_target - 1)

            step_ops = [op for op in OPERATIONS if chain_remaining[op] > 0]
            step_digits = [d for d in range(10) if chain_remaining[str(d)] > 0]
            if not step_ops or not step_digits:
                log(f'    Chain broke at step {step}: no ops/digits available')
                success = False
                break

            # Pick op and operand
            if step == 0:
                op, operand, op_digits = first_op, first_operand, first_digits
                target_value = first_value
            else:
                step_result = _pick_step(
                    chain_parent, chain_remaining,
                    step_ops, step_digits, config, rng,
                )
                if step_result is None:
                    log(f'    Chain broke at step {step}: could not pick step')
                    success = False
                    break
                op, operand, op_digits, target_value = step_result

            target_layer = chain_parent.layer + 1
            key = (target_value, target_layer)

            # Retry if collision (must create new nodes)
            step_retries = 50
            while (key in node_lookup or key in chain_used_keys) and step_retries > 0:
                step_result = _pick_step(
                    chain_parent, chain_remaining,
                    step_ops, step_digits, config, rng,
                )
                if step_result is None:
                    break
                op, operand, op_digits, target_value = step_result
                key = (target_value, chain_parent.layer + 1)
                step_retries -= 1

            if key in node_lookup or key in chain_used_keys or target_value is None:
                log(f'    Chain broke at step {step}: no unique value found')
                success = False
                break

            # Compute costs
            inc_cost = Counter({op: 1})
            inc_cost += operand_digit_cost(op_digits)
            new_path_cost = chain_cost + inc_cost

            # Create tentative node and edge
            item = real_item if is_last else TRASH_ITEM
            new_node = Node(
                index=len(nodes) + len(chain_nodes),
                value=target_value, layer=target_layer, sphere=sphere,
                item=item,
            )
            new_node.path_costs.append(new_path_cost)
            chain_nodes.append(new_node)
            chain_used_keys.add(key)

            new_edge = Edge(
                index=len(edges) + len(chain_edges),
                source_index=chain_parent.index if step == 0 else chain_nodes[-2].index,
                target_index=new_node.index,
                operation=op, operand=operand, operand_digits=list(op_digits),
                sphere=sphere,
            )
            new_edge.path_costs.append(new_path_cost)
            chain_edges.append(new_edge)

            # Consume from budget
            chain_remaining[op] -= 1
            for d in op_digits:
                chain_remaining[str(d)] -= 1
            chain_cost = new_path_cost
            chain_parent = new_node

            item_label = item if item == TRASH_ITEM else f'Button: {item}'
            log(f'    Step {step}: {op} {operand} (digits {op_digits}) = {target_value} '
                f'L{target_layer} (item: {item_label})')

        if success and chain_nodes:
            # Fix indices and commit
            base_node = len(nodes)
            base_edge = len(edges)

            for i, cn in enumerate(chain_nodes):
                cn.index = base_node + i
            for i, ce in enumerate(chain_edges):
                ce.index = base_edge + i
                if ce.source_index is not None and ce.source_index >= base_node:
                    ce.source_index = base_node + (ce.source_index - (base_node - len(chain_nodes)) - len(chain_nodes))
                # Fix target index
                for j, cn in enumerate(chain_nodes):
                    if ce.target_index == base_node - len(chain_nodes) + len(chain_nodes) + j:
                        pass  # already correct if we used tentative indices

            # Simpler: rebuild references
            old_to_new = {}
            for i, cn in enumerate(chain_nodes):
                old_idx = len(nodes) - len(chain_nodes) + len(chain_nodes) + i  # tentative
                old_to_new[base_node - len(chain_nodes) + len(chain_nodes) + i] = base_node + i

            # Actually, tentative indices were already len(nodes) + i at creation time,
            # and len(nodes) hasn't changed yet, so they should be correct.
            # Just verify source_index references within the chain are correct.
            for i, ce in enumerate(chain_edges):
                if i > 0:
                    # Source should be the previous chain node
                    ce.source_index = chain_nodes[i - 1].index
                else:
                    # Source is the parent (already set correctly)
                    pass
                ce.target_index = chain_nodes[i].index

            # Commit nodes
            for cn in chain_nodes:
                nodes.append(cn)
                node_lookup[(cn.value, cn.layer)] = cn.index
            # Commit edges
            for ce in chain_edges:
                edges.append(ce)
                if ce.source_index is not None:
                    outgoing_counts[ce.source_index] += 1

            return chain_nodes

    raise RuntimeError(
        f"Failed to generate chain for sphere {sphere} after {max_attempts} attempts. "
        f"inventory={dict(inventory)}"
    )


def _generate_chain_partial(
    sphere: int, nodes: list[Node], edges: list[Edge],
    node_lookup: dict, outgoing_counts: Counter,
    inventory: Counter, sphere_items: dict,
    config: APCalcConfig, rng: random.Random, log,
    is_final_sphere: bool = False,
) -> list[Node]:
    """Like _generate_chain but accepts partial chains.

    Returns whatever new nodes were created (may be empty).
    """
    parent = rng.choice(nodes)

    if outgoing_counts[parent.index] >= config.max_branches:
        return []

    if not parent.path_costs:
        return []
    parent_cost = rng.choice(parent.path_costs)
    remaining = inventory - parent_cost

    available_ops = [op for op in OPERATIONS if remaining[op] > 0]
    available_digits = [d for d in range(10) if remaining[str(d)] > 0]
    if not available_ops or not available_digits:
        return []

    # Sphere constraint
    prev_items = sphere_items.get(sphere - 1, [])
    if prev_items:
        first_op = rng.choice(available_ops)
        first_result = compose_operand(available_digits, rng, config.nums_per_sphere, remaining)
        if first_result is None:
            return []
        first_operand, first_digits = first_result
        has_prev = first_op in prev_items or any(str(d) in prev_items for d in first_digits)
        if not has_prev:
            return []
    else:
        first_op = rng.choice(available_ops)
        first_result = compose_operand(available_digits, rng, config.nums_per_sphere, remaining)
        if first_result is None:
            return []
        first_operand, first_digits = first_result

    first_value = apply_op(parent.value, first_op, first_operand)
    if first_value is None:
        return []

    total_ops = sum(max(0, remaining[op]) for op in OPERATIONS)
    total_digits = sum(max(0, remaining[str(d)]) for d in range(10))
    reserve_ops = 0 if is_final_sphere else 1
    avg_digits_per_step = max(1, config.nums_per_sphere)
    chain_target = max(1, min(total_ops - reserve_ops, total_digits // avg_digits_per_step))

    log(f'    Parent: {parent.region_name} (sphere {parent.sphere}, layer {parent.layer})')
    log(f'    Path cost: {dict(parent_cost)}')
    log(f'    Remaining: ops={total_ops}, digits={total_digits}')
    log(f'    Chain target: {chain_target} nodes')

    chain_nodes = []
    chain_edges = []
    chain_remaining = Counter(remaining)
    chain_cost = Counter(parent_cost)
    chain_parent = parent
    chain_used_keys: set[tuple[int, int]] = set()

    for step in range(chain_target):
        step_ops = [op for op in OPERATIONS if chain_remaining[op] > 0]
        step_digits = [d for d in range(10) if chain_remaining[str(d)] > 0]
        if not step_ops or not step_digits:
            log(f'    Chain broke at step {step}: no ops/digits available')
            break

        if step == 0:
            op, operand, op_digits = first_op, first_operand, first_digits
            target_value = first_value
        else:
            step_result = _pick_step(
                chain_parent, chain_remaining, step_ops, step_digits, config, rng,
            )
            if step_result is None:
                log(f'    Chain broke at step {step}: could not pick step')
                break
            op, operand, op_digits, target_value = step_result

        target_layer = chain_parent.layer + 1
        key = (target_value, target_layer)

        # Retry if collision
        step_retries = 50
        while (key in node_lookup or key in chain_used_keys) and step_retries > 0:
            step_result = _pick_step(
                chain_parent, chain_remaining, step_ops, step_digits, config, rng,
            )
            if step_result is None:
                break
            op, operand, op_digits, target_value = step_result
            key = (target_value, chain_parent.layer + 1)
            step_retries -= 1

        if key in node_lookup or key in chain_used_keys or target_value is None:
            log(f'    Chain broke at step {step}: no unique value found')
            break

        inc_cost = Counter({op: 1}) + operand_digit_cost(op_digits)
        new_path_cost = chain_cost + inc_cost

        new_node = Node(
            index=len(nodes) + len(chain_nodes),
            value=target_value, layer=target_layer, sphere=sphere,
        )
        new_node.path_costs.append(new_path_cost)
        chain_nodes.append(new_node)
        chain_used_keys.add(key)

        new_edge = Edge(
            index=len(edges) + len(chain_edges),
            source_index=chain_parent.index if step == 0 else chain_nodes[-2].index,
            target_index=new_node.index,
            operation=op, operand=operand, operand_digits=list(op_digits),
            sphere=sphere,
        )
        new_edge.path_costs.append(new_path_cost)
        chain_edges.append(new_edge)

        chain_remaining[op] -= 1
        for d in op_digits:
            chain_remaining[str(d)] -= 1
        chain_cost = new_path_cost
        chain_parent = new_node

        log(f'    Step {step}: {op} {operand} (digits {op_digits}) = {target_value} L{target_layer}')

    if chain_nodes:
        # Fix indices and commit
        base_node = len(nodes)
        base_edge = len(edges)
        for i, cn in enumerate(chain_nodes):
            cn.index = base_node + i
        for i, ce in enumerate(chain_edges):
            ce.index = base_edge + i
            if i > 0:
                ce.source_index = chain_nodes[i - 1].index
            ce.target_index = chain_nodes[i].index

        for cn in chain_nodes:
            nodes.append(cn)
            node_lookup[(cn.value, cn.layer)] = cn.index
        for ce in chain_edges:
            edges.append(ce)
            if ce.source_index is not None:
                outgoing_counts[ce.source_index] += 1

        if len(chain_nodes) < chain_target:
            log(f'    Chain of {len(chain_nodes)}/{chain_target} from {parent.region_name}: '
                + ' → '.join(f'{cn.value}L{cn.layer}' for cn in chain_nodes))
        else:
            log(f'    Chain of {len(chain_nodes)} from {parent.region_name}: '
                + ' → '.join(f'{cn.value}L{cn.layer}' for cn in chain_nodes))
    else:
        log(f'    No chain produced from {parent.region_name}')

    return chain_nodes


# ---------------------------------------------------------------------------
# Reuse edges
# ---------------------------------------------------------------------------

def _try_add_reuse_edge(
    nodes: list[Node], edges: list[Edge],
    node_lookup: dict, outgoing_counts: Counter,
    inventory: Counter, sphere_items: dict,
    sphere: int, config: APCalcConfig,
    rng: random.Random, log,
) -> bool:
    """Try to add a reuse edge from a random parent to an existing node.

    Picks a random parent, picks a random target at parent.layer + 1,
    finds operation+operand to reach target, creates edge if valid.
    Returns True if edge was created.
    """
    if len(nodes) < 2:
        return False

    parent = rng.choice(nodes)
    if outgoing_counts[parent.index] >= config.max_branches:
        return False
    if not parent.path_costs:
        return False

    parent_cost = rng.choice(parent.path_costs)
    remaining = inventory - parent_cost

    target_layer = parent.layer + 1

    # Find existing nodes at target_layer
    candidates = [n for n in nodes if n.layer == target_layer]
    if not candidates:
        return False

    target = rng.choice(candidates)

    # Check we don't already have this exact edge
    for e in edges:
        if e.source_index == parent.index and e.target_index == target.index:
            return False  # edge already exists

    # Try each operation to see if it reaches target.value
    available_ops = [op for op in OPERATIONS if remaining[op] > 0]
    rng.shuffle(available_ops)

    for op in available_ops:
        needed_operand = reverse_op(parent.value, target.value, op)
        if needed_operand is None:
            continue

        # Check operand digits are in budget
        op_digits = [int(d) for d in str(needed_operand)] if needed_operand > 0 else [0]
        digit_cost = operand_digit_cost(op_digits)

        test_remaining = Counter(remaining)
        test_remaining[op] -= 1
        if test_remaining[op] < 0:
            continue
        can_afford = True
        for btn, cnt in digit_cost.items():
            test_remaining[btn] -= cnt
            if test_remaining[btn] < 0:
                can_afford = False
                break
        if not can_afford:
            continue

        # Verify the operation produces the expected result
        check = apply_op(parent.value, op, needed_operand)
        if check != target.value:
            continue

        # Create the reuse edge
        inc_cost = Counter({op: 1}) + digit_cost
        new_path_cost = parent_cost + inc_cost

        new_edge = Edge(
            index=len(edges),
            source_index=parent.index, target_index=target.index,
            operation=op, operand=needed_operand, operand_digits=op_digits,
            sphere=sphere,
        )
        new_edge.path_costs.append(new_path_cost)
        edges.append(new_edge)
        outgoing_counts[parent.index] += 1
        target.path_costs.append(new_path_cost)

        log(f'    Reuse edge: {parent.region_name} {op} {needed_operand} → {target.region_name}')
        return True

    return False


# ---------------------------------------------------------------------------
# Division planning
# ---------------------------------------------------------------------------

def _ensure_divisible_paths(
    nodes: list[Node], edges: list[Edge],
    node_lookup: dict, outgoing_counts: Counter,
    inventory: Counter, sphere: int,
    config: APCalcConfig, rng: random.Random, log,
):
    """Ensure at least 2 nodes have values divisible by available digits.

    Called before the first sphere that can use /.
    """
    available_divisors = [n for n in range(2, 10) if inventory[str(n)] > 0]
    if not available_divisors:
        log(f'  Division planning: no useful divisors available, skipping')
        return

    divisible_nodes = []
    for node in nodes:
        for d in available_divisors:
            if node.value != 0 and node.value % d == 0:
                result = node.value // d
                if (result, node.layer + 1) not in node_lookup:
                    divisible_nodes.append((node, d))
                    break

    log(f'  Division planning: {len(divisible_nodes)} existing divisible nodes, '
        f'divisors available: {available_divisors}')

    if len(divisible_nodes) >= 2:
        log(f'  Division planning: sufficient divisible paths already exist')
        for node, d in divisible_nodes[:3]:
            log(f'    {node.region_name} (value={node.value}) divisible by {d} '
                f'→ {node.value // d}')
        return

    needed = 2 - len(divisible_nodes)
    log(f'  Division planning: need {needed} more divisible paths')

    for _ in range(needed):
        target_divisor = rng.choice(available_divisors)
        created = False

        for attempt in range(200):
            parent = rng.choice(nodes)
            if not parent.path_costs:
                continue
            parent_cost = rng.choice(parent.path_costs)
            remaining = inventory - parent_cost

            if remaining['*'] <= 0 and remaining['+'] <= 0:
                continue

            td_digits = [int(d) for d in str(target_divisor)]
            can_afford_digits = all(remaining[str(d)] > 0 for d in td_digits)
            if not can_afford_digits:
                continue

            # Try multiplication first
            if remaining['*'] > 0:
                candidate = parent.value * target_divisor
                target_layer = parent.layer + 1
                key = (candidate, target_layer)
                if candidate != 0 and key not in node_lookup:
                    op_digits = td_digits
                    inc_cost = Counter({'*': 1}) + operand_digit_cost(op_digits)
                    new_path_cost = parent_cost + inc_cost

                    new_node = Node(
                        index=len(nodes), value=candidate,
                        layer=target_layer, sphere=sphere - 1,
                        item=TRASH_ITEM,
                    )
                    new_node.path_costs.append(new_path_cost)
                    nodes.append(new_node)
                    node_lookup[key] = new_node.index

                    new_edge = Edge(
                        index=len(edges), source_index=parent.index,
                        target_index=new_node.index,
                        operation='*', operand=target_divisor,
                        operand_digits=op_digits, sphere=sphere - 1,
                    )
                    new_edge.path_costs.append(new_path_cost)
                    edges.append(new_edge)
                    outgoing_counts[parent.index] += 1

                    log(f'  Division planning: created {new_node.region_name} '
                        f'(= {parent.value} * {target_divisor}, divisible by {target_divisor})')
                    created = True
                    break

            # Try addition to reach a multiple
            if remaining['+'] > 0:
                for num in range(10):
                    if remaining[str(num)] <= 0:
                        continue
                    candidate = parent.value + num
                    target_layer = parent.layer + 1
                    key = (candidate, target_layer)
                    if candidate != 0 and candidate % target_divisor == 0 and key not in node_lookup:
                        op_digits = [num]
                        inc_cost = Counter({'+': 1}) + operand_digit_cost(op_digits)
                        new_path_cost = parent_cost + inc_cost

                        new_node = Node(
                            index=len(nodes), value=candidate,
                            layer=target_layer, sphere=sphere - 1,
                            item=TRASH_ITEM,
                        )
                        new_node.path_costs.append(new_path_cost)
                        nodes.append(new_node)
                        node_lookup[key] = new_node.index

                        new_edge = Edge(
                            index=len(edges), source_index=parent.index,
                            target_index=new_node.index,
                            operation='+', operand=num,
                            operand_digits=op_digits, sphere=sphere - 1,
                        )
                        new_edge.path_costs.append(new_path_cost)
                        edges.append(new_edge)
                        outgoing_counts[parent.index] += 1

                        log(f'  Division planning: created {new_node.region_name} '
                            f'(= {parent.value} + {num}, divisible by {target_divisor})')
                        created = True
                        break
                if created:
                    break

        if not created:
            log(f'  Division planning: WARNING - could not create divisible path '
                f'for divisor {target_divisor}')
