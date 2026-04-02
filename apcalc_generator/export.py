"""Export APCalc game data to rules.json format."""

import json
from collections import Counter
from .generator import Node, compute_path_cost


def make_has_rule(item_name: str, count: int = 1) -> dict:
    rule = {'rule': 'Has', 'args': {'item_name': item_name}}
    if count > 1:
        rule['args']['count'] = count
    return rule


def make_and_rule(children: list[dict]) -> dict:
    if len(children) == 0:
        return {'rule': 'True_'}
    if len(children) == 1:
        return children[0]
    return {'rule': 'And', 'children': children}


def path_cost_to_rule(path_cost: Counter) -> dict:
    """Convert a button-press cost Counter to an access rule."""
    rules = []
    for button in sorted(path_cost):
        count = path_cost[button]
        rules.append(make_has_rule(f'Button: {button}', count))
    return make_and_rule(rules)


def button_item_name(button: str) -> str:
    return f'Button: {button}'


def export_rules_json(game_data: dict) -> dict:
    """Convert generated APCalc data to a complete rules.json dict."""
    nodes: list[Node] = game_data['nodes']
    starting_buttons: dict[str, int] = game_data['starting_buttons']

    # Collect all unique button items used in the game
    all_button_labels: set[str] = set()
    for node in nodes:
        if node.item:
            all_button_labels.add(node.item)
    for label in starting_buttons:
        all_button_labels.add(label)

    # Count item occurrences for the pool (excludes starting items)
    pool_counts: Counter = Counter()
    for node in nodes:
        if node.item:
            pool_counts[button_item_name(node.item)] += 1

    # Build regions
    regions = {}

    # Menu region: exits to all sphere 0 nodes
    menu_exits = []
    for node in nodes:
        if node.sphere == 0:
            cost = compute_path_cost(node, nodes)
            menu_exits.append({
                'name': f'Menu to {node.region_name}',
                'connected_region': node.region_name,
                'access_rule': path_cost_to_rule(cost),
            })
    regions['Menu'] = {
        'name': 'Menu',
        'exits': menu_exits,
        'locations': [],
    }

    # Build child index: parent_index -> list of child nodes
    children_by_parent: dict[int, list[Node]] = {}
    for node in nodes:
        if node.parent_index is not None:
            children_by_parent.setdefault(node.parent_index, []).append(node)

    # Determine the last node (Victory location)
    last_node = nodes[-1]

    # Node regions
    for node in nodes:
        exits = []
        children = children_by_parent.get(node.index, [])
        for child in children:
            cost = compute_path_cost(child, nodes)
            exits.append({
                'name': f'{node.region_name} to {child.region_name}',
                'connected_region': child.region_name,
                'access_rule': path_cost_to_rule(cost),
            })

        # Regular check location
        locations = [
            {
                'name': node.location_name,
                'id': node.index + 1,  # 1-based IDs
                'access_rule': {'rule': 'True_'},
                'item': {
                    'name': button_item_name(node.item),
                    'player': 1,
                    'advancement': True,
                    'type': 'None',
                },
                'locked': False,
            },
        ]

        # Victory event on the last node
        if node is last_node:
            locations.append({
                'name': 'Victory',
                'id': None,
                'access_rule': {'rule': 'True_'},
                'item': {
                    'name': 'Victory',
                    'player': 1,
                    'advancement': True,
                    'type': 'None',
                },
                'locked': True,
                'event': True,
            })

        regions[node.region_name] = {
            'name': node.region_name,
            'exits': exits,
            'locations': locations,
        }

    # Build items dict
    items = {}
    item_id = 1
    for label in sorted(all_button_labels):
        name = button_item_name(label)
        total_count = pool_counts.get(name, 0) + starting_buttons.get(label, 0)
        items[name] = {
            'name': name,
            'id': item_id,
            'groups': ['Buttons'],
            'classification': 'progression',
            'type': None,
            'max_count': max(total_count, 1),
        }
        item_id += 1

    items['Victory'] = {
        'name': 'Victory',
        'id': None,
        'groups': ['Event'],
        'classification': 'progression',
        'event': True,
        'type': 'Event',
        'max_count': 1,
    }

    # Build itempool_counts (pool items only, not starting items)
    itempool_counts = dict(pool_counts)
    itempool_counts['Victory'] = 1

    # Build starting_items list
    starting_items_list = []
    for label, count in sorted(starting_buttons.items()):
        for _ in range(count):
            starting_items_list.append(button_item_name(label))

    # Build slot_data with node info and button sequences
    slot_nodes = {}
    for node in nodes:
        slot_nodes[node.region_name] = {
            'value': node.value,
            'parent': nodes[node.parent_index].region_name if node.parent_index is not None else None,
            'sphere': node.sphere,
            'operation': node.operation,
            'operand': node.operand,
            'button_sequence': node.button_sequence,
            'item': node.item,
        }

    config = game_data['config']

    return {
        'schema_version': 3,
        'game_name': 'APCalc',
        'game_directory': 'apcalc',
        'archipelago_version': '0.6.7',
        'generation_seed': config.seed,
        'seed_name': str(config.seed),
        'player_names': {'1': 'Player1'},
        'regions': {'1': regions},
        'start_regions': {
            '1': {
                'default': ['Menu'],
                'available': [],
            },
        },
        'items': {'1': items},
        'item_groups': {'1': ['Buttons']},
        'itempool_counts': {'1': itempool_counts},
        'canonical_placements': {'1': {}},
        'progression_mapping': {'1': {}},
        'starting_items': {'1': starting_items_list},
        'world': {
            '1': {
                'game': 'APCalc',
                'world_class_name': 'APCalcWorld',
                'options': {},
                'option_definitions': {},
                'world_description': (
                    'APCalc is a calculator-themed puzzle game. '
                    'Collect number and operation buttons, then budget your presses '
                    'to navigate a graph of target numbers.'
                ),
                'slot_data': {
                    'nodes': slot_nodes,
                    'starting_buttons': starting_buttons,
                    'operations': ['+', '-', '*', '/'],
                    'num_spheres': config.num_spheres,
                    'goal_node': last_node.region_name,
                },
                'web': {
                    'theme': 'dirt',
                    'tutorials': [
                        {
                            'name': 'APCalc Setup Guide',
                            'description': 'A guide to setting up APCalc.',
                            'language': 'English',
                            'file_name': 'setup_en.md',
                            'link': 'setup/en',
                            'authors': ['PeerInfinity'],
                        },
                    ],
                },
                'world_directory': 'apcalc',
            },
        },
        'exporter': {},
        'game_info': {
            '1': {
                'completion_condition': {
                    'type': 'item_check',
                    'item': 'Victory',
                },
            },
        },
        'helpers': {},
    }


def write_rules_json(rules_data: dict, output_path: str) -> None:
    """Write rules.json to file."""
    with open(output_path, 'w') as f:
        json.dump(rules_data, f, indent=2)
    print(f'Wrote {output_path}')
