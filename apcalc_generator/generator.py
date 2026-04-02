"""Core APCalc generation algorithm.

Generates a graph of target-number nodes organized into spheres.
Each node is a region with one location (check). Items are calculator buttons.
Button presses are consumed per path; Clear restores all presses.
"""

import random
from collections import Counter
from dataclasses import dataclass, field

OPERATIONS = ['+', '-', '*', '/']


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
    locations_per_sphere: list[int] = field(default_factory=lambda: [4, 4, 4, 4, 4])
    max_branches: int = 3
    seed: int = 42


def compute_path_cost(node: Node, nodes: list[Node]) -> Counter:
    """Compute total button press counts for the entire path from Start to node."""
    cost = Counter()
    current = node
    while current is not None:
        if current.parent_index is None:
            # Sphere 0: just the number button
            cost[str(current.value)] += 1
        else:
            cost[current.operation] += 1
            cost[str(current.operand)] += 1
        current = nodes[current.parent_index] if current.parent_index is not None else None
    return cost


def apply_op(parent_value: int, op: str, num: int) -> int | None:
    """Apply operation. Returns result or None if invalid (div by zero, non-integer)."""
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


def generate(config: APCalcConfig) -> dict:
    """Generate APCalc game data.

    Returns dict with keys: nodes, starting_buttons, sphere_items, config.
    """
    rng = random.Random(config.seed)

    nodes: list[Node] = []
    node_values: set[int] = set()
    inventory = Counter()            # button_label -> count
    sphere_items: dict[int, list[str]] = {}  # sphere -> items placed at that sphere

    # --- Sphere 0: single-digit nodes, directly reachable from Start ---
    available_digits = list(range(10))
    rng.shuffle(available_digits)
    sphere_0_count = min(config.locations_per_sphere[0], 10)

    for i in range(sphere_0_count):
        value = available_digits[i]
        node = Node(
            index=len(nodes),
            value=value,
            parent_index=None,
            sphere=0,
            operation=None,
            operand=None,
            button_sequence=[str(value), '='],
        )
        nodes.append(node)
        node_values.add(value)
        inventory[str(value)] += 1  # starting inventory

    # Assign items to sphere 0 locations
    s0_items = _assign_items(sphere_0_count, rng)
    sphere_items[0] = s0_items
    for item in s0_items:
        inventory[item] += 1
    for i in range(sphere_0_count):
        nodes[i].item = s0_items[i]

    # --- Spheres 1..N ---
    for sphere in range(1, config.num_spheres):
        sphere_count = (
            config.locations_per_sphere[sphere]
            if sphere < len(config.locations_per_sphere)
            else config.locations_per_sphere[-1]
        )
        sphere_node_indices = []

        for _ in range(sphere_count):
            node = _generate_node(
                sphere, nodes, node_values, inventory,
                sphere_items[sphere - 1], config, rng,
            )
            nodes.append(node)
            node_values.add(node.value)
            sphere_node_indices.append(node.index)

        # Assign items to this sphere's locations
        items = _assign_items(sphere_count, rng)
        sphere_items[sphere] = items
        for item in items:
            inventory[item] += 1
        for i, idx in enumerate(sphere_node_indices):
            nodes[idx].item = items[i]

    # Build starting buttons
    starting_buttons: dict[str, int] = {}
    for node in nodes:
        if node.sphere == 0:
            key = str(node.value)
            starting_buttons[key] = starting_buttons.get(key, 0) + 1

    return {
        'nodes': nodes,
        'starting_buttons': starting_buttons,
        'sphere_items': sphere_items,
        'config': config,
    }


def _generate_node(
    sphere: int,
    nodes: list[Node],
    node_values: set[int],
    inventory: Counter,
    prev_sphere_items: list[str],
    config: APCalcConfig,
    rng: random.Random,
) -> Node:
    """Generate a single node for the given sphere, respecting all constraints."""
    max_attempts = 500

    for _ in range(max_attempts):
        parent = rng.choice(nodes)

        # Respect max branches per parent
        children_count = sum(1 for n in nodes if n.parent_index == parent.index)
        if children_count >= config.max_branches:
            continue

        path_cost = compute_path_cost(parent, nodes)
        remaining = inventory - path_cost

        available_ops = [op for op in OPERATIONS if remaining[op] > 0]
        available_nums = [n for n in range(10) if remaining[str(n)] > 0]

        if not available_ops or not available_nums:
            continue

        op = rng.choice(available_ops)
        num = rng.choice(available_nums)

        # Sphere constraint (Option A): at least one of op/num from previous sphere
        if op not in prev_sphere_items and str(num) not in prev_sphere_items:
            continue

        child_value = apply_op(parent.value, op, num)
        if child_value is None:
            continue

        if child_value in node_values:
            continue

        sequence = parent.button_sequence + [op, str(num), '=']
        return Node(
            index=len(nodes),
            value=child_value,
            parent_index=parent.index,
            sphere=sphere,
            operation=op,
            operand=num,
            button_sequence=sequence,
        )

    raise RuntimeError(
        f"Failed to generate node for sphere {sphere} after {max_attempts} attempts. "
        f"inventory={dict(inventory)}, prev_sphere_items={prev_sphere_items}, "
        f"existing_values={sorted(node_values)}"
    )


def _assign_items(count: int, rng: random.Random) -> list[str]:
    """Assign button items for a sphere's locations. At least 1 must be an operation.

    The guaranteed operation is always + or - (never * or /) because
    addition and subtraction always produce valid integers, ensuring
    reliable progression to the next sphere.
    """
    items = []
    # Guarantee at least one reliable operation (+ or -)
    items.append(rng.choice(['+', '-']))
    # Fill the rest with a mix of numbers and operations
    while len(items) < count:
        if rng.random() < 0.5:
            items.append(str(rng.randint(0, 9)))
        else:
            items.append(rng.choice(OPERATIONS))
    rng.shuffle(items)
    return items
