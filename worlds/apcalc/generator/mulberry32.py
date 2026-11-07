"""A Python twin of the frontend's seedable PRNG (`frontend/modules/shared/rng.js`).

The frontend's APCalc generator (`frontend/modules/apcalcGenerator/apcalcGeneratorEngine.js`)
is a line-for-line port of `generator.py`. With this RNG passed as `generate(..., rng_factory=Mulberry32)`
the two produce the same puzzle for the same config, which is what the JS<->Python parity test
(`worlds/apcalc/test/test_generator_parity.py`) checks. The AP world itself never uses it: it keeps
`random.Random`, so its seeds are unchanged.

Every method reproduces rng.js bit for bit: the state is a 32-bit counter (JS `seed | 0`, i.e. the
seed modulo 2^32), `next()` is exactly k / 2^32 for an integer k, and `randint` / `choice` /
`shuffle` take `floor(next() * n)` in IEEE doubles, as JS does.
"""

import math

_MASK = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & _MASK


class Mulberry32:
    def __init__(self, seed: int):
        # JS: `let s = seed | 0` (ToInt32). Kept unsigned here; every operation below is
        # modulo 2^32, where the signed and unsigned forms agree.
        self._s = int(seed) & _MASK

    def next(self) -> float:
        s = (self._s + 0x6D2B79F5) & _MASK
        self._s = s
        t = _imul(s ^ (s >> 15), 1 | s)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & _MASK) ^ t
        return ((t ^ (t >> 14)) & _MASK) / 4294967296

    def random(self) -> float:
        return self.next()

    def randint(self, lo: int, hi: int) -> int:
        return lo + math.floor(self.next() * (hi - lo + 1))

    def choice(self, seq):
        return seq[math.floor(self.next() * len(seq))]

    def shuffle(self, seq) -> None:
        for i in range(len(seq) - 1, 0, -1):
            j = math.floor(self.next() * (i + 1))
            seq[i], seq[j] = seq[j], seq[i]
