/**
 * ⛓ REQUEST CAPTURE — a solve request as the WORKER receives it, to JSON and back. Shared by the divergence sweep's
 * in-page lab (`seedlingDivergenceLab.js`, `--capture-requests`) and `replay-seedling-solve-request.mjs`. Pure: no
 * browser, no node API.
 *
 * `captureRequest` drops the page's `levelSource` (a function) exactly as `createWorkerSolveService` does (the worker
 * rebuilds it from `source.records`), and TAGS what JSON would lose: a Map (`{__map}`), a Set (`{__set}`), a non-finite
 * number (`{__num}`), `undefined` in an array (`{__undef}`). `restoreRequest` is its inverse.
 */
export function captureRequest(request) {
    const { levelSource, ...tape } = request ?? {};
    return JSON.parse(JSON.stringify(tape, function tag(k, v) {
        if (v instanceof Map) return { __map: [...v] };
        if (v instanceof Set) return { __set: [...v] };
        if (typeof v === 'number' && !Number.isFinite(v)) return { __num: String(v) };
        if (v === undefined && Array.isArray(this)) return { __undef: true };
        return v;
    }));
}

const only = (o, k) => Object.keys(o).length === 1 && k in o;

/** The structured clone the worker got, back from `captureRequest`'s tagged JSON. */
export function restoreRequest(o) {
    if (Array.isArray(o)) return o.map(restoreRequest);
    if (o && typeof o === 'object') {
        if (only(o, '__map') && Array.isArray(o.__map)) return new Map(o.__map.map(([k, v]) => [restoreRequest(k), restoreRequest(v)]));
        if (only(o, '__set') && Array.isArray(o.__set)) return new Set(o.__set.map(restoreRequest));
        if (only(o, '__num') && typeof o.__num === 'string') return Number(o.__num);
        if (only(o, '__undef')) return undefined;
        return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, restoreRequest(v)]));
    }
    return o;
}
