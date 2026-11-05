#!/usr/bin/env python3
"""Sweep APCalc's generator over many seeds, comparing two versions of generator.py.

Built for the whole-generation retry (sdc-apcalc-parity, 2026-11-04): it shows that the
retry (a) removes the dead ends ("Failed to generate chain") and (b) leaves every seed
that already succeeded byte-identical. For each seed it runs the OLD and the NEW
generator.py (each loaded by file path, so a copy from `git show <base>:...` works) with
random.Random, as the AP world does, at one option set (default: the world's defaults).

Output: one JSON summary on stdout: seeds swept, OLD failures, NEW failures, seeds where
OLD passed but NEW differs (must be 0), and a sha256 over (seed, puzzle) of the seeds OLD
passed, from each side (equal iff nothing moved).

  python scripts/test/apcalc-seed-sweep.py --old /tmp/generator.old.py \\
      --count 40000 --shard 0/10

Seeds: `--count` random 20-digit seeds from random.Random(--sweep-seed) (AP multiworld
seeds are up to 20 digits), split into `--shard i/n` by position. CPU-heavy at 40k
(about 0.03 s per seed per side): run it on CI, sharded.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import random
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
NEW_DEFAULT = os.path.join(HERE, '..', '..', 'worlds', 'apcalc', 'generator', 'generator.py')


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None, path
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module  # dataclasses resolve annotations through sys.modules
    spec.loader.exec_module(module)
    return module


def canonical(result):
    def cost(pc):
        return sorted((k, v) for k, v in pc.items() if v > 0)
    return repr((
        [(n.index, n.value, n.layer, n.sphere, n.item, [cost(p) for p in n.path_costs]) for n in result['nodes']],
        [(e.index, e.source_index, e.target_index, e.operation, e.operand, list(e.operand_digits), e.sphere,
          [cost(p) for p in e.path_costs]) for e in result['edges']],
        sorted(result['starting_buttons'].items()),
    ))


def run(module, config_kwargs, seed):
    try:
        return canonical(module.generate(module.APCalcConfig(seed=seed, **config_kwargs), log=lambda _: None))
    except RuntimeError as error:
        return error


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--old', required=True, help='the generator.py to compare against (e.g. main\'s)')
    ap.add_argument('--new', default=NEW_DEFAULT, help='the generator.py under test (default: this tree\'s)')
    ap.add_argument('--count', type=int, default=40000)
    ap.add_argument('--sweep-seed', type=int, default=20261104)
    ap.add_argument('--shard', default='0/1', help='i/n: this run sweeps every n-th seed from i')
    ap.add_argument('--options', default='{}', help='APCalcConfig fields as JSON (default: the defaults)')
    args = ap.parse_args()

    shard, shards = (int(x) for x in args.shard.split('/'))
    config_kwargs = json.loads(args.options)
    old, new = load(args.old, 'apcalc_generator_old'), load(args.new, 'apcalc_generator_new')
    pick = random.Random(args.sweep_seed)
    seeds = [pick.randrange(10 ** 19, 10 ** 20) for _ in range(args.count)][shard::shards]

    started = time.time()
    old_fail, new_fail, moved = [], [], []
    old_digest, new_digest = hashlib.sha256(), hashlib.sha256()
    for seed in seeds:
        a, b = run(old, config_kwargs, seed), run(new, config_kwargs, seed)
        if isinstance(a, Exception):
            old_fail.append([seed, str(a).split(' inventory=')[0]])
        if isinstance(b, Exception):
            new_fail.append([seed, str(b).split(' inventory=')[0]])
        if not isinstance(a, Exception):
            old_digest.update(f'{seed}:{a}\n'.encode())
            new_digest.update(f'{seed}:{b}\n'.encode())
            if a != b:
                moved.append(seed)
    print(json.dumps({
        'shard': args.shard, 'options': config_kwargs, 'sweep_seed': args.sweep_seed, 'count': args.count,
        'swept': len(seeds), 'old_passed': len(seeds) - len(old_fail),
        'old_failures': old_fail, 'new_failures': new_fail, 'moved': moved,
        'old_digest': old_digest.hexdigest(), 'new_digest': new_digest.hexdigest(),
        'seconds': round(time.time() - started, 1),
    }, indent=1))
    return 1 if new_fail or moved else 0


if __name__ == '__main__':
    sys.exit(main())
