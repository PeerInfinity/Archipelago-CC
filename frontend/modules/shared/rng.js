// Seedable PRNG (mulberry32). Fast, 2^32 period, adequate for
// procedural generation and test shuffling. Not cryptographic.

export function createRng(seed) {
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
