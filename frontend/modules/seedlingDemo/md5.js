/**
 * seedlingDemo/md5 — a small, dependency-free MD5 (RFC 1321) over a string's
 * UTF-8 bytes, returning 32 lowercase hex digits.
 *
 * It exists for one caller, `seedlingProfile.profileMd5()`, which must run in
 * the browser as well as under node: `node:crypto` is not available to a page,
 * and `crypto.subtle` has no MD5 (and is async). `md5.test.js` pins it against
 * `node:crypto` on the RFC's own vectors and on a 1,000-byte string, which
 * spans more than one 64-byte block and the length-padding edge.
 *
 * Not a security primitive: the profile's md5 is an IDENTITY for a table of
 * numbers (the tape envelope's `profile.md5`), not a signature.
 */

/** Per-round left-rotation amounts (RFC 1321 §3.4). */
const SHIFTS = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

/**
 * `K[i] = floor(|sin(i + 1)| * 2^32)` (RFC 1321 §3.4), TABLED rather than
 * computed: `Math.sin` is not required to be correctly rounded, so a computed
 * table could differ between engines in its last bit.
 */
const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

/** The UTF-8 bytes of `s`. */
function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    const bin = unescape(encodeURIComponent(s));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/**
 * MD5 of `input` (a string, hashed as UTF-8, or a `Uint8Array`).
 * @returns {string} 32 lowercase hex digits
 */
export function md5(input) {
    const bytes = typeof input === 'string' ? utf8(input) : input;
    const n = bytes.length;
    // pad: 0x80, zeros to 56 mod 64, then the bit length as 64-bit little-endian
    const padded = new Uint8Array((((n + 8) >>> 6) + 1) << 6);
    padded.set(bytes);
    padded[n] = 0x80;
    const bitsLo = (n << 3) >>> 0;
    const bitsHi = Math.floor(n / 0x20000000) >>> 0;
    const end = padded.length;
    for (let i = 0; i < 4; i++) {
        padded[end - 8 + i] = (bitsLo >>> (8 * i)) & 0xff;
        padded[end - 4 + i] = (bitsHi >>> (8 * i)) & 0xff;
    }

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < end; off += 64) {
        for (let j = 0; j < 16; j++) {
            const p = off + j * 4;
            M[j] = (padded[p] | (padded[p + 1] << 8) | (padded[p + 2] << 16) | (padded[p + 3] << 24)) >>> 0;
        }
        let A = a0;
        let B = b0;
        let C = c0;
        let D = d0;
        for (let i = 0; i < 64; i++) {
            let F;
            let g;
            if (i < 16) { F = (B & C) | (~B & D); g = i; }
            else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * i) % 16; }
            F = (F + A + K[i] + M[g]) >>> 0;
            A = D;
            D = C;
            C = B;
            B = (B + ((F << SHIFTS[i]) | (F >>> (32 - SHIFTS[i])))) >>> 0;
        }
        a0 = (a0 + A) >>> 0;
        b0 = (b0 + B) >>> 0;
        c0 = (c0 + C) >>> 0;
        d0 = (d0 + D) >>> 0;
    }
    let hex = '';
    for (const w of [a0, b0, c0, d0]) {
        for (let i = 0; i < 4; i++) hex += ((w >>> (8 * i)) & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
}
