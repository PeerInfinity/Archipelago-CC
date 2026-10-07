"""Static blast-radius scan: which committed .archipelago files carry a
multidata["spheres"] set whose pickled order depends on INSERTION order.

Upstream Main.py builds each sphere's set[int] by iterating a set[Location];
Location hashes by id(), so the insertion order varies per process. An int
set's iteration order is insertion-independent unless two members collide in
the hash table, so a set is drift-prone iff inserting its members one at a time
in different orders (sorted, reversed, 64 seeded shuffles) gives more than one
iteration order. Prints one line per drift-prone file.
Usage: python scripts/dev/scan-archipelago-sphere-order.py [paths...]
(default: every tracked frontend/presets/**/*.archipelago)
"""
import pickle
import random
import subprocess
import sys
import zlib


class _Stub:
    def __init__(self, *a, **k):
        pass

    def __setstate__(self, state):
        self.__dict__["state"] = state


class _Loader(pickle.Unpickler):
    def find_class(self, module, name):
        try:
            return super().find_class(module, name)
        except Exception:
            return type(name, (_Stub,), {})


def _built(order):
    s = set()
    for v in order:  # one add at a time, as Main.py builds it
        s.add(v)
    return tuple(s)


def order_sensitive(s):
    vals = sorted(s)
    rng = random.Random(0)
    orders = {_built(vals), _built(reversed(vals))}
    for _ in range(64):
        rng.shuffle(vals)
        orders.add(_built(vals))
    return len(orders) > 1


def main(paths):
    if not paths:
        out = subprocess.run(["git", "ls-files", "-z", "frontend/presets"], capture_output=True, text=True).stdout
        paths = [p for p in out.split("\0") if p.endswith(".archipelago")]
    hit = 0
    for p in paths:
        raw = open(p, "rb").read()
        try:
            md = _Loader(__import__("io").BytesIO(zlib.decompress(raw[1:]))).load()
        except Exception as e:
            print(f"UNREADABLE {p}: {e}")
            continue
        bad = []
        for i, sphere in enumerate(md.get("spheres", [])):
            for player, locs in sphere.items():
                if order_sensitive(locs):
                    bad.append(f"sphere{i}/p{player}(n={len(locs)})")
        if bad:
            hit += 1
            print(f"DRIFT-PRONE {p}: {' '.join(bad)}")
    print(f"{hit} of {len(paths)} files drift-prone")


if __name__ == "__main__":
    main(sys.argv[1:])
