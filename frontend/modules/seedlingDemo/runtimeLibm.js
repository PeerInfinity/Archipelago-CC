/**
 * seedlingDemo/runtimeLibm — ⛓⛓⛓ SEEDLING FIDELITY LIGHTS (wave 20, D2): `Math.cos`, `Math.sin` and `Math.atan2` AS THE
 * RECOMPILED RUNTIME COMPUTES THEM — musl's libm (emscripten's libc), transcribed.
 *
 * ⛔ V8's `Math.cos`/`Math.sin` are fdlibm's (`ieee754::cos` → `__kernel_cos`), and musl's kernels evaluate the same
 * minimax polynomials in a DIFFERENT ORDER (`__cos`: `r = z·(C1+z·(C2+z·C3)) + w·w·(C4+z·(C5+z·C6))`, `w = 1 − hz`,
 * `w + (((1 − w) − hz) + (z·r − x·y))`; fdlibm's `__kernel_cos` uses the `qx` split instead), so the two round
 * differently on some arguments. MEASURED on the game (p4g, L69, `lights-stand`): flier 3's velocity at t71 is the
 * model's with `cos(0.7799440094849661)` ONE ULP ABOVE V8's — exactly musl's `__cos`. An exact model of a fight steered
 * by `cos`/`sin` of an unbounded spin therefore uses these.
 *
 * Source: musl 1.2.x `src/math/{__cos,__sin,cos,sin,__rem_pio2,atan,atan2}.c` (FreeBSD msun lineage), with
 * `FLT_EVAL_METHOD == 0` (wasm: every `double_t` is a `double`, no FMA contraction). `__rem_pio2_large` (|x| ≥
 * 2^20·π/2) is refused by name: no argument this model computes is that large.
 *
 * ⚠ A transcription module: every operation is the C source's, in its order. Do not "simplify" an expression here.
 */

export class RuntimeLibmError extends Error {
    constructor(message) { super(message); this.name = 'RuntimeLibmError'; }
}

const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);
/** little-endian: U32[1] is the high word. */
const hiWord = (x) => { F64[0] = x; return U32[1]; };
const fromWords = (hi, lo) => { U32[1] = hi >>> 0; U32[0] = lo >>> 0; return F64[0]; };

// ── __cos / __sin (musl `src/math/__cos.c`, `__sin.c`) ──────────────────────────────────────────────────────────────
const C1 = fromWords(0x3FA55555, 0x5555554C);
const C2 = fromWords(0xBF56C16C, 0x16C15177);
const C3 = fromWords(0x3EFA01A0, 0x19CB1590);
const C4 = fromWords(0xBE927E4F, 0x809C52AD);
const C5 = fromWords(0x3E21EE9E, 0xBDB4B1C4);
const C6 = fromWords(0xBDA8FAE9, 0xBE8838D4);

function kcos(x, y) {
    const z = x * x;
    let w = z * z;
    const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
    const hz = 0.5 * z;
    w = 1.0 - hz;
    return w + (((1.0 - w) - hz) + (z * r - x * y));
}

const S1 = fromWords(0xBFC55555, 0x55555549);
const S2 = fromWords(0x3F811111, 0x1110F8A6);
const S3 = fromWords(0xBF2A01A0, 0x19C161D5);
const S4 = fromWords(0x3EC71DE3, 0x57B1FE7D);
const S5 = fromWords(0xBE5AE5E6, 0x8A2B9CEB);
const S6 = fromWords(0x3DE5D93A, 0x5ACFD57C);

function ksin(x, y, iy) {
    const z = x * x;
    const w = z * z;
    const r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6);
    const v = z * x;
    if (iy === 0) return x + v * (S1 + z * r);
    return x - ((z * (0.5 * y - v * r) - y) - v * S1);
}

// ── __rem_pio2 (musl `src/math/__rem_pio2.c`) ──────────────────────────────────────────────────────────────────────
const EPS = 2.220446049250313e-16; // DBL_EPSILON
const TOINT = 1.5 / EPS;
const PIO4 = fromWords(0x3FE921FB, 0x54442D18);
const INVPIO2 = fromWords(0x3FE45F30, 0x6DC9C883);
const PIO2_1 = fromWords(0x3FF921FB, 0x54400000);
const PIO2_1T = fromWords(0x3DD0B461, 0x1A626331);
const PIO2_2 = fromWords(0x3DD0B461, 0x1A600000);
const PIO2_2T = fromWords(0x3BA3198A, 0x2E037073);
const PIO2_3 = fromWords(0x3BA3198A, 0x2E000000);
const PIO2_3T = fromWords(0x397B839A, 0x252049C1);

/** @returns {[number, number, number]} `[n, y0, y1]` */
function remPio2(x) {
    F64[0] = x;
    const sign = U32[1] >>> 31;
    const ix = U32[1] & 0x7fffffff;
    let z;
    let y0;
    const small = (k) => {
        // `z = x ∓ k*pio2_1; y[0] = z ∓ k*pio2_1t; y[1] = (z - y[0]) ∓ k*pio2_1t; return ±k`
        if (!sign) {
            z = x - k * PIO2_1;
            y0 = z - k * PIO2_1T;
            return [k, y0, (z - y0) - k * PIO2_1T];
        }
        z = x + k * PIO2_1;
        y0 = z + k * PIO2_1T;
        return [-k, y0, (z - y0) + k * PIO2_1T];
    };
    let medium = false;
    if (ix <= 0x400f6a7a) {
        if ((ix & 0xfffff) === 0x921fb) medium = true;
        else if (ix <= 0x4002d97c) return small(1);
        else return small(2);
    } else if (ix <= 0x401c463b) {
        if (ix <= 0x4015fdbc) {
            if (ix === 0x4012d97c) medium = true;
            else return small(3);
        } else if (ix === 0x401921fb) medium = true;
        else return small(4);
    } else if (ix < 0x413921fb) {
        medium = true;
    }
    if (!medium) {
        throw new RuntimeLibmError(`runtimeLibm: |${x}| >= 2^20·π/2 needs musl's __rem_pio2_large, which is not `
            + 'transcribed (no argument this model computes is that large). Refused by name.');
    }
    let fn = x * INVPIO2 + TOINT - TOINT;
    let n = fn | 0;
    let r = x - fn * PIO2_1;
    let w = fn * PIO2_1T;
    if (r - w < -PIO4) {
        n -= 1; fn -= 1;
        r = x - fn * PIO2_1;
        w = fn * PIO2_1T;
    } else if (r - w > PIO4) {
        n += 1; fn += 1;
        r = x - fn * PIO2_1;
        w = fn * PIO2_1T;
    }
    y0 = r - w;
    let ey = (hiWord(y0) >>> 20) & 0x7ff;
    const ex = ix >>> 20;
    if (ex - ey > 16) {
        let t = r;
        w = fn * PIO2_2;
        r = t - w;
        w = fn * PIO2_2T - ((t - r) - w);
        y0 = r - w;
        ey = (hiWord(y0) >>> 20) & 0x7ff;
        if (ex - ey > 49) {
            t = r;
            w = fn * PIO2_3;
            r = t - w;
            w = fn * PIO2_3T - ((t - r) - w);
            y0 = r - w;
        }
    }
    return [n, y0, (r - y0) - w];
}

// ── cos / sin (musl `src/math/cos.c`, `sin.c`) ─────────────────────────────────────────────────────────────────────
export function cos(x) {
    const ix = hiWord(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb) {
        if (ix < 0x3e46a09e) return 1.0;
        return kcos(x, 0);
    }
    if (ix >= 0x7ff00000) return x - x;
    const [n, y0, y1] = remPio2(x);
    switch (n & 3) {
    case 0: return kcos(y0, y1);
    case 1: return -ksin(y0, y1, 1);
    case 2: return -kcos(y0, y1);
    default: return ksin(y0, y1, 1);
    }
}

export function sin(x) {
    const ix = hiWord(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb) {
        if (ix < 0x3e500000) return x;
        return ksin(x, 0.0, 0);
    }
    if (ix >= 0x7ff00000) return x - x;
    const [n, y0, y1] = remPio2(x);
    switch (n & 3) {
    case 0: return ksin(y0, y1, 1);
    case 1: return kcos(y0, y1);
    case 2: return -ksin(y0, y1, 1);
    default: return -kcos(y0, y1);
    }
}

// ── atan / atan2 (musl `src/math/atan.c`, `atan2.c`) ───────────────────────────────────────────────────────────────
const ATANHI = [fromWords(0x3FDDAC67, 0x0561BB4F), fromWords(0x3FE921FB, 0x54442D18),
    fromWords(0x3FEF730B, 0xD281F69B), fromWords(0x3FF921FB, 0x54442D18)];
const ATANLO = [fromWords(0x3C7A2B7F, 0x222F65E2), fromWords(0x3C81A626, 0x33145C07),
    fromWords(0x3C700788, 0x7AF0CBBD), fromWords(0x3C91A626, 0x33145C07)];
const AT = [fromWords(0x3FD55555, 0x5555550D), fromWords(0xBFC99999, 0x9998EBC4), fromWords(0x3FC24924, 0x920083FF),
    fromWords(0xBFBC71C6, 0xFE231671), fromWords(0x3FB745CD, 0xC54C206E), fromWords(0xBFB3B0F2, 0xAF749A6D),
    fromWords(0x3FB10D66, 0xA0D03D51), fromWords(0xBFADDE2D, 0x52DEFD9A), fromWords(0x3FA97B4B, 0x24760DEB),
    fromWords(0xBFA2B444, 0x2C6A6C2F), fromWords(0x3F90AD3A, 0xE322DA11)];

export function atan(x0) {
    let x = x0;
    let ix = hiWord(x);
    const sign = ix >>> 31;
    ix &= 0x7fffffff;
    let id;
    if (ix >= 0x44100000) {
        if (Number.isNaN(x)) return x;
        const z = ATANHI[3] + 7.52316384526264e-37; // 0x1p-120f
        return sign ? -z : z;
    }
    if (ix < 0x3fdc0000) {
        if (ix < 0x3e400000) return x;
        id = -1;
    } else {
        x = Math.abs(x);
        if (ix < 0x3ff30000) {
            if (ix < 0x3fe60000) { id = 0; x = (2.0 * x - 1.0) / (2.0 + x); } else { id = 1; x = (x - 1.0) / (x + 1.0); }
        } else if (ix < 0x40038000) {
            id = 2; x = (x - 1.5) / (1.0 + 1.5 * x);
        } else {
            id = 3; x = -1.0 / x;
        }
    }
    let z = x * x;
    const w = z * z;
    const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
    const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    if (id < 0) return x - x * (s1 + s2);
    z = ATANHI[id] - (x * (s1 + s2) - ATANLO[id] - x);
    return sign ? -z : z;
}

const PI = fromWords(0x400921FB, 0x54442D18);
const PI_LO = fromWords(0x3CA1A626, 0x33145C07);

export function atan2(y, x) {
    if (Number.isNaN(x) || Number.isNaN(y)) return x + y;
    F64[0] = x;
    let ix = U32[1];
    const lx = U32[0];
    F64[0] = y;
    let iy = U32[1];
    const ly = U32[0];
    if ((((ix - 0x3ff00000) >>> 0) | lx) === 0) return atan(y);
    const m = ((iy >>> 31) & 1) | ((ix >>> 30) & 2);
    ix &= 0x7fffffff;
    iy &= 0x7fffffff;
    if ((iy | ly) === 0) {
        switch (m) {
        case 0: case 1: return y;
        case 2: return PI;
        default: return -PI;
        }
    }
    if ((ix | lx) === 0) return m & 1 ? -PI / 2 : PI / 2;
    if (ix === 0x7ff00000) {
        if (iy === 0x7ff00000) {
            switch (m) {
            case 0: return PI / 4;
            case 1: return -PI / 4;
            case 2: return 3 * PI / 4;
            default: return -3 * PI / 4;
            }
        }
        switch (m) {
        case 0: return 0.0;
        case 1: return -0.0;
        case 2: return PI;
        default: return -PI;
        }
    }
    if (ix + (64 << 20) < iy || iy === 0x7ff00000) return m & 1 ? -PI / 2 : PI / 2;
    let z;
    if ((m & 2) && iy + (64 << 20) < ix) z = 0;
    else z = atan(Math.abs(y / x));
    switch (m) {
    case 0: return z;
    case 1: return -z;
    case 2: return PI - (z - PI_LO);
    default: return (z - PI_LO) - PI;
    }
}
