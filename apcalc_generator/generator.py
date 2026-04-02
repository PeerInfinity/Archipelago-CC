"""Core APCalc generation algorithm.

Generates a graph of target-number nodes organized into spheres.
Each node is a region with one location (check). Items are calculator buttons.
Button presses are consumed per path; Clear restores all presses.

Key behaviors:
- Path extension: chains extend until only 1 operation button remains
- Division planning: `/` is placed in a planned sphere with pre-built divisible paths
- Trash items: intermediate chain nodes get filler items
- Detailed logging via callback
"""

import random
from collections import Counter
from dataclasses import dataclass, field

OPERATIONS = ['+', '-', '*', '/']
TRASH_ITEM = 'Junk'


@dataclass
class Node:
    index: int
    value: int
    parent_index: int | None
    sphere: int
    operation: str | None       # op used from parent to reach this node
    operand: int | None         # number button used from parent to reach this node
    button_sequence: list[str]  # full sequence from Start, e.g. ["3", "=", "+", "7", "="]
    item: str = ''              # button awarded at this location, assigned after creation

    @property
    def region_name(self):
        return f"Node {self.value}"

    @property
    def location_name(self):
        return f"Reach {self.value}"


@dataclass
class APCalcConfig:
    num_spheres: int = 5
    ops_per_sphere: int = 1
    nums_per_sphere: int = 1
    trash_per_sphere: int = 1
    max_branches: int = 3
    seed: int = 42
    divide_sphere: int | None = None  # auto-pick if None (sphere 2+ preferred)


def compute_path_cost(node: Node, nodes: list[Node]) -> Counter:
    """Compute total button press counts for the entire path from Start to node."""
    cost = Counter()
    current = node
    while current is not None:
        if current.parent_index is None:
            cost[str(current.value)] += 1
        else:
            cost[current.operation] += 1
            cost[str(current.operand)] += 1
        current = nodes[current.parent_index] if current.parent_index is not None else None
    return cost


def apply_op(parent_value: int, op: str, num: int) -> int | None:
    """Apply operation. Returns result or None if invalid."""
    if op == '+':
        return parent_value + num
    elif op == '-':
        return parent_value - num
    elif op == '*':
        return parent_value * num
    elif op == '/':
        if num == 0:
            return None
        if parent_value % num != 0:
            return None
        return parent_value // num
    return None


def generate(config: APCalcConfig, log=None) -> dict:
    """Generate APCalc game data.

    Args:
        config: Generation parameters.
        log: Optional callback(message: str) for detailed logging.

    Returns dict with keys: nodes, starting_buttons, sphere_items, config, log_entries.
    """
    if log is None:
        log_entries = []
        log = log_entries.append
    else:
        log_entries = None

    rng = random.Random(config.seed)

    nodes: list[Node] = []
    node_values: set[int] = set()
    inventory = Counter()
    sphere_items: dict[int, list[str]] = {}

    # --- Pre-plan division sphere ---
    divide_sphere = config.divide_sphere
    if divide_sphere is None:
        divide_sphere = min(2, config.num_spheres - 1) if config.num_spheres > 2 else None
    if divide_sphere is not None and divide_sphere < 1:
        divide_sphere = max(1, divide_sphere)  # never sphere 0
    log(f'=== Pre-planning ===')
    log(f'  Divide sphere: {divide_sphere}')
    log(f'  Spheres: {config.num_spheres}, ops/sphere: {config.ops_per_sphere}, '
        f'nums/sphere: {config.nums_per_sphere}, trash/sphere: {config.trash_per_sphere}')

    # --- Sphere 0: single-digit nodes ---
    sphere_0_count = config.ops_per_sphere + config.nums_per_sphere + config.trash_per_sphere
    sphere_0_count = min(sphere_0_count, 10)

    log(f'\n=== Sphere 0 ({sphere_0_count} locations) ===')

    available_digits = list(range(10))
    rng.shuffle(available_digits)

    for i in range(sphere_0_count):
        value = available_digits[i]
        node = Node(
            index=len(nodes), value=value, parent_index=None, sphere=0,
            operation=None, operand=None, button_sequence=[str(value), '='],
        )
        nodes.append(node)
        node_values.add(value)
        inventory[str(value)] += 1
        log(f'  Node {node.index}: value={value}, sequence=[{value}, =], connected to Start')

    log(f'  Starting inventory: {dict(inventory)}')

    # Assign sphere 0 items (no / allowed)
    s0_items = _assign_items_for_sphere(
        sphere=0, count=sphere_0_count, config=config,
        divide_sphere=divide_sphere, rng=rng, log=log,
    )
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
            # Final sphere: all trash, focused on consuming remaining buttons
            items_for_sphere = []
            real_items = []
            trash_count_target = 1  # minimum; chains will extend to use all ops
            target_count = trash_count_target
        else:
            # Determine items for this sphere
            target_count = config.ops_per_sphere + config.nums_per_sphere + config.trash_per_sphere
            items_for_sphere = _assign_items_for_sphere(
                sphere=sphere, count=target_count, config=config,
                divide_sphere=divide_sphere, rng=rng, log=log,
            )
            real_items = [it for it in items_for_sphere if it != TRASH_ITEM]
            trash_count_target = items_for_sphere.count(TRASH_ITEM)
        log(f'\n=== Sphere {sphere} (target: {target_count} locations, '
            f'real items: {real_items}, trash: {trash_count_target}'
            f'{", FINAL" if is_final else ""}) ===')

        sphere_node_indices = []
        trash_created = 0

        # Before the divide sphere, ensure divisible paths exist
        if divide_sphere is not None and sphere == divide_sphere:
            _ensure_divisible_paths(nodes, node_values, inventory,
                                    sphere_items, sphere, config, rng, log)

        if is_final:
            # Final sphere: keep generating single-step trash nodes until
            # no more can be created, to use up all remaining buttons
            log(f'  Generating final sphere chains to consume remaining buttons...')
            consecutive_failures = 0
            max_failures = 500
            while consecutive_failures < max_failures:
                chain = _generate_chain_partial(
                    sphere, nodes, node_values, inventory,
                    sphere_items, config, rng, log,
                    is_final_sphere=True,
                )
                if not chain:
                    consecutive_failures += 1
                    continue
                consecutive_failures = 0
                for chain_node in chain:
                    chain_node.item = TRASH_ITEM
                    nodes.append(chain_node)
                    node_values.add(chain_node.value)
                    sphere_node_indices.append(chain_node.index)
                    trash_created += 1
            log(f'  Final sphere: created {trash_created} nodes')
        else:
            # Generate chains for each real item
            for item_idx, real_item in enumerate(real_items):
                log(f'  --- Location {item_idx + 1}/{len(real_items)} (item: {real_item}) ---')

                chain = _generate_chain(
                    sphere=sphere, nodes=nodes, node_values=node_values,
                    inventory=inventory, sphere_items=sphere_items,
                    config=config, rng=rng, log=log,
                    real_item=real_item,
                )

                for i, chain_node in enumerate(chain):
                    nodes.append(chain_node)
                    node_values.add(chain_node.value)
                    sphere_node_indices.append(chain_node.index)
                    if chain_node.item == TRASH_ITEM:
                        trash_created += 1

            # Fill remaining trash slots
            while trash_created < trash_count_target:
                log(f'  --- Filling trash slot {trash_created + 1}/{trash_count_target} ---')
                chain = _generate_chain(
                    sphere=sphere, nodes=nodes, node_values=node_values,
                    inventory=inventory, sphere_items=sphere_items,
                    config=config, rng=rng, log=log,
                    real_item=TRASH_ITEM,
                )
                for chain_node in chain:
                    nodes.append(chain_node)
                    node_values.add(chain_node.value)
                    sphere_node_indices.append(chain_node.index)
                    if chain_node.item == TRASH_ITEM:
                        trash_created += 1

        # Record sphere items (all items for all nodes in this sphere)
        all_items = [nodes[idx].item for idx in sphere_node_indices]
        sphere_items[sphere] = all_items
        for item in all_items:
            if item != TRASH_ITEM:
                inventory[item] += 1
        log(f'  Sphere {sphere} complete: {len(sphere_node_indices)} nodes, items={all_items}')
        log(f'  Inventory after sphere {sphere}: {dict(inventory)}')

    # Build starting buttons
    starting_buttons: dict[str, int] = {}
    for node in nodes:
        if node.sphere == 0:
            key = str(node.value)
            starting_buttons[key] = starting_buttons.get(key, 0) + 1

    result = {
        'nodes': nodes,
        'starting_buttons': starting_buttons,
        'sphere_items': sphere_items,
        'config': config,
    }
    if log_entries is not None:
        result['log_entries'] = log_entries

    log(f'\n=== Generation complete: {len(nodes)} nodes ===')
    return result


def _assign_items_for_sphere(
    sphere: int, count: int, config: APCalcConfig,
    divide_sphere: int | None, rng: random.Random, log,
) -> list[str]:
    """Assign button items for a sphere's locations.

    Returns list of item labels. Guaranteed at least 1 operation (+ or -).
    Division (/) only appears in the designated divide_sphere.
    """
    items = []

    # Operations
    ops_count = config.ops_per_sphere
    for i in range(ops_count):
        if sphere == 0:
            # Sphere 0: only + or -
            items.append(rng.choice(['+', '-']))
        elif divide_sphere is not None and sphere == divide_sphere and i == 0:
            # Divide sphere: first op is /
            items.append('/')
        else:
            # Guarantee first op is + or - for reliability
            if i == 0:
                items.append(rng.choice(['+', '-']))
            else:
                items.append(rng.choice([op for op in OPERATIONS if op != '/']))

    # Numbers
    for _ in range(config.nums_per_sphere):
        items.append(str(rng.randint(0, 9)))

    # Trash
    for _ in range(config.trash_per_sphere):
        items.append(TRASH_ITEM)

    rng.shuffle(items)
    return items


def _generate_chain(
    sphere: int, nodes: list[Node], node_values: set[int],
    inventory: Counter, sphere_items: dict[int, list[str]],
    config: APCalcConfig, rng: random.Random, log,
    real_item: str,
    is_final_sphere: bool = False,
) -> list[Node]:
    """Generate a chain of nodes from a parent.

    Extends until only 1 operation button remains in the path budget
    (or 0 if is_final_sphere, to use all remaining buttons).
    Intermediate nodes get trash items; the final node gets real_item.
    """
    max_attempts = 500

    for attempt in range(max_attempts):
        parent = rng.choice(nodes)

        # Respect max branches
        children_count = sum(1 for n in nodes if n.parent_index == parent.index)
        if children_count >= config.max_branches:
            continue

        path_cost = compute_path_cost(parent, nodes)
        remaining = inventory - path_cost

        available_ops = [op for op in OPERATIONS if remaining[op] > 0]
        available_nums = [n for n in range(10) if remaining[str(n)] > 0]

        if not available_ops or not available_nums:
            continue

        # Sphere constraint: first step must use an item from previous sphere
        prev_items = sphere_items.get(sphere - 1, [])
        first_op = rng.choice(available_ops)
        first_num = rng.choice(available_nums)
        if first_op not in prev_items and str(first_num) not in prev_items:
            continue

        # Compute chain length: extend until 1 op remains
        total_ops = sum(remaining[op] for op in OPERATIONS)
        total_nums = sum(remaining[str(n)] for n in range(10) if remaining[str(n)] > 0)
        # We use (total_ops - 1) ops in the chain, but need at least 1 step
        reserve_ops = 0 if is_final_sphere else 1
        chain_target = max(1, min(total_ops - reserve_ops, total_nums))

        log(f'    Parent: {parent.region_name} (sphere {parent.sphere})')
        log(f'    Path cost: {dict(path_cost)}')
        log(f'    Remaining: ops={total_ops}, nums={total_nums}')
        log(f'    Chain target: {chain_target} nodes '
            f'({chain_target - 1} trash + 1 real)')

        # Try to build the chain
        chain_nodes = []
        chain_remaining = remaining.copy()
        chain_parent = parent
        chain_values = set(node_values)
        success = True

        for step in range(chain_target):
            is_last = (step == chain_target - 1)

            # Pick op and num from chain_remaining
            step_ops = [op for op in OPERATIONS if chain_remaining[op] > 0]
            step_nums = [n for n in range(10) if chain_remaining[str(n)] > 0]

            if not step_ops or not step_nums:
                log(f'    Chain broke at step {step}: no ops/nums available')
                success = False
                break

            # For the first step, use the pre-validated op/num
            if step == 0:
                op, num = first_op, first_num
            else:
                op = rng.choice(step_ops)
                num = rng.choice(step_nums)

            child_value = apply_op(chain_parent.value, op, num)

            # Retry this step if invalid
            step_retries = 50
            while (child_value is None or child_value in chain_values) and step_retries > 0:
                op = rng.choice(step_ops)
                num = rng.choice(step_nums)
                child_value = apply_op(chain_parent.value, op, num)
                step_retries -= 1

            if child_value is None or child_value in chain_values:
                log(f'    Chain broke at step {step}: no valid value found')
                success = False
                break

            item = real_item if is_last else TRASH_ITEM
            sequence = chain_parent.button_sequence + [op, str(num), '=']
            new_node = Node(
                index=len(nodes) + len(chain_nodes),
                value=child_value,
                parent_index=chain_parent.index if step == 0 else chain_nodes[-1].index,
                sphere=sphere,
                operation=op,
                operand=num,
                button_sequence=sequence,
                item=item,
            )
            chain_nodes.append(new_node)
            chain_values.add(child_value)
            chain_remaining[op] -= 1
            chain_remaining[str(num)] -= 1
            chain_parent = new_node

            item_label = item if item == TRASH_ITEM else f'Button: {item}'
            log(f'    Step {step}: {op} {num} = {child_value} '
                f'(item: {item_label})')

        if success and chain_nodes:
            # Fix indices (they were tentative)
            base_index = len(nodes)
            for i, cn in enumerate(chain_nodes):
                cn.index = base_index + i
                if i > 0:
                    cn.parent_index = base_index + i - 1
            return chain_nodes

    raise RuntimeError(
        f"Failed to generate chain for sphere {sphere} after {max_attempts} attempts. "
        f"inventory={dict(inventory)}, existing_values={sorted(node_values)}"
    )


def _generate_chain_partial(
    sphere: int, nodes: list[Node], node_values: set[int],
    inventory: Counter, sphere_items: dict[int, list[str]],
    config: APCalcConfig, rng: random.Random, log,
    is_final_sphere: bool = False,
) -> list[Node]:
    """Like _generate_chain but accepts partial chains on break.

    Returns whatever nodes were successfully built (may be empty).
    Used by the final sphere to greedily extend paths.
    """
    parent = rng.choice(nodes)

    children_count = sum(1 for n in nodes if n.parent_index == parent.index)
    if children_count >= config.max_branches:
        return []

    path_cost = compute_path_cost(parent, nodes)
    remaining = inventory - path_cost

    available_ops = [op for op in OPERATIONS if remaining[op] > 0]
    available_nums = [n for n in range(10) if remaining[str(n)] > 0]
    if not available_ops or not available_nums:
        return []

    # Sphere constraint
    prev_items = sphere_items.get(sphere - 1, [])
    first_op = rng.choice(available_ops)
    first_num = rng.choice(available_nums)
    if prev_items and first_op not in prev_items and str(first_num) not in prev_items:
        return []

    total_ops = sum(remaining[op] for op in OPERATIONS)
    total_nums = sum(remaining[str(n)] for n in range(10) if remaining[str(n)] > 0)
    reserve_ops = 0 if is_final_sphere else 1
    chain_target = max(1, min(total_ops - reserve_ops, total_nums))

    # Build chain, keeping whatever succeeds
    chain_nodes = []
    chain_remaining = remaining.copy()
    chain_parent = parent
    chain_values = set(node_values)

    for step in range(chain_target):
        step_ops = [op for op in OPERATIONS if chain_remaining[op] > 0]
        step_nums = [n for n in range(10) if chain_remaining[str(n)] > 0]
        if not step_ops or not step_nums:
            break

        if step == 0:
            op, num = first_op, first_num
        else:
            op = rng.choice(step_ops)
            num = rng.choice(step_nums)

        child_value = apply_op(chain_parent.value, op, num)

        step_retries = 50
        while (child_value is None or child_value in chain_values) and step_retries > 0:
            op = rng.choice(step_ops)
            num = rng.choice(step_nums)
            child_value = apply_op(chain_parent.value, op, num)
            step_retries -= 1

        if child_value is None or child_value in chain_values:
            break  # Accept what we have so far

        sequence = chain_parent.button_sequence + [op, str(num), '=']
        new_node = Node(
            index=len(nodes) + len(chain_nodes),
            value=child_value,
            parent_index=chain_parent.index if step == 0 else chain_nodes[-1].index,
            sphere=sphere,
            operation=op,
            operand=num,
            button_sequence=sequence,
        )
        chain_nodes.append(new_node)
        chain_values.add(child_value)
        chain_remaining[op] -= 1
        chain_remaining[str(num)] -= 1
        chain_parent = new_node

    if chain_nodes:
        base_index = len(nodes)
        for i, cn in enumerate(chain_nodes):
            cn.index = base_index + i
            if i > 0:
                cn.parent_index = base_index + i - 1
        log(f'    Chain of {len(chain_nodes)} from {parent.region_name}: '
            + ' → '.join(str(cn.value) for cn in chain_nodes))

    return chain_nodes


def _try_single_step(
    sphere: int, nodes: list[Node], node_values: set[int],
    inventory: Counter, sphere_items: dict[int, list[str]],
    config: APCalcConfig, rng: random.Random,
) -> Node | None:
    """Try to create a single new node from a random parent. Returns None on failure."""
    parent = rng.choice(nodes)

    children_count = sum(1 for n in nodes if n.parent_index == parent.index)
    if children_count >= config.max_branches:
        return None

    path_cost = compute_path_cost(parent, nodes)
    remaining = inventory - path_cost

    available_ops = [op for op in OPERATIONS if remaining[op] > 0]
    available_nums = [n for n in range(10) if remaining[str(n)] > 0]

    if not available_ops or not available_nums:
        return None

    # Sphere constraint for final sphere: need item from previous sphere
    prev_items = sphere_items.get(sphere - 1, [])
    op = rng.choice(available_ops)
    num = rng.choice(available_nums)
    if prev_items and op not in prev_items and str(num) not in prev_items:
        return None

    child_value = apply_op(parent.value, op, num)
    if child_value is None or child_value in node_values:
        return None

    sequence = parent.button_sequence + [op, str(num), '=']
    return Node(
        index=len(nodes), value=child_value, parent_index=parent.index,
        sphere=sphere, operation=op, operand=num, button_sequence=sequence,
    )


def _ensure_divisible_paths(
    nodes: list[Node], node_values: set[int], inventory: Counter,
    sphere_items: dict[int, list[str]], sphere: int,
    config: APCalcConfig, rng: random.Random, log,
):
    """Ensure at least 2 existing nodes have values divisible by available number buttons.

    Called just before the divide sphere generates its nodes, to guarantee
    that / will be usable in future spheres.
    """
    # Find which number buttons are available (excluding 0 and 1 which are trivial)
    available_divisors = [n for n in range(2, 10) if inventory[str(n)] > 0]
    if not available_divisors:
        log(f'  Division planning: no useful divisors available, skipping')
        return

    # Count existing divisible nodes
    divisible_nodes = []
    for node in nodes:
        for d in available_divisors:
            if node.value != 0 and node.value % d == 0 and node.value // d not in node_values:
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

    # Need to create more divisible nodes in earlier spheres
    # We do this by adding nodes using * to create multiples
    needed = 2 - len(divisible_nodes)
    log(f'  Division planning: need {needed} more divisible paths')

    for _ in range(needed):
        target_divisor = rng.choice(available_divisors)
        # Find a parent where parent_value * target_divisor (or similar) gives a new value
        created = False
        for attempt in range(200):
            parent = rng.choice(nodes)
            path_cost = compute_path_cost(parent, nodes)
            remaining = inventory - path_cost

            if remaining['*'] <= 0 and remaining['+'] <= 0:
                continue
            if remaining[str(target_divisor)] <= 0:
                continue

            # Try multiplication first (creates clean multiples)
            if remaining['*'] > 0:
                candidate = parent.value * target_divisor
                if candidate != 0 and candidate not in node_values:
                    sequence = parent.button_sequence + ['*', str(target_divisor), '=']
                    new_node = Node(
                        index=len(nodes), value=candidate,
                        parent_index=parent.index, sphere=sphere - 1,
                        operation='*', operand=target_divisor,
                        button_sequence=sequence, item=TRASH_ITEM,
                    )
                    nodes.append(new_node)
                    node_values.add(candidate)
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
                    if candidate != 0 and candidate % target_divisor == 0 and candidate not in node_values:
                        sequence = parent.button_sequence + ['+', str(num), '=']
                        new_node = Node(
                            index=len(nodes), value=candidate,
                            parent_index=parent.index, sphere=sphere - 1,
                            operation='+', operand=num,
                            button_sequence=sequence, item=TRASH_ITEM,
                        )
                        nodes.append(new_node)
                        node_values.add(candidate)
                        log(f'  Division planning: created {new_node.region_name} '
                            f'(= {parent.value} + {num}, divisible by {target_divisor})')
                        created = True
                        break
                if created:
                    break

        if not created:
            log(f'  Division planning: WARNING - could not create divisible path '
                f'for divisor {target_divisor}')
