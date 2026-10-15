# SCRATCH (seedling-hammer-sf2 D1): on top of make-lab2.py, lab shape `e` — shape a with BOUNDED previews.
# A pair at tick i only asks "does the walk arrive within i − 1 samples?", so the bounded pass previews a cell only to
# that many samples (`previewWalk`'s own `stopWhen` option; its body untouched); a later pair at a larger tick deepens
# the cached walk (to max(need, 2·bound)). Kept pairs' walks arrived inside the bound, so they are the full walks:
# every returned field should equal shape a's. Also composable: `e` + lab cap (`ec<K>` = co<K> with bounded previews).
import sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (n, old[:80])
    s = s.replace(old, new)

rep("""    const walkTo = (cell) => {
        if (walks.has(cell)) return walks.get(cell);
        const walk = previewWalk(run, [{ x: cell.x, y: cell.y }], DEFAULT_TOLERANCE);""",
"""    const walkTo = (cell, need = Infinity) => {
        const had = walks.get(cell);
        if (had !== undefined && !(had.bound < need)) return had;
        const bound = need === Infinity ? Infinity : Math.max(need, 2 * (had?.bound ?? 0));
        let taken = 0;
        const walk = bound === Infinity ? previewWalk(run, [{ x: cell.x, y: cell.y }], DEFAULT_TOLERANCE)
            : previewWalk(run, [{ x: cell.x, y: cell.y }], DEFAULT_TOLERANCE, { stopWhen: () => (taken += 1) > bound });
        if (had !== undefined) globalThis.__SF_DEEPEN?.(run);""")
rep("""        const out = { walk, eta: walk.samples.length, unsafe };
        walks.set(cell, out);""", """        const out = { walk, eta: walk.samples.length, unsafe,
            ...(walk.truncated?.kind === 'stopped' && bound !== Infinity ? { bound } : {}) };
        walks.set(cell, out);""")
# the bounded pass: shape e deepens a bounded cell before a's known test, and previews new cells to i − 1
rep("""    const measuredPair = (i, c, mine) => {
        const known = walks.get(c);""", """    const BOUNDED = LAB?.shape === 'e' || LAB?.shape === 'ec';
    const measuredPair = (i, c, mine) => {
        let known = walks.get(c);
        if (BOUNDED && known !== undefined && known.bound < i - 1) known = walkTo(c, i - 1);""")
rep("""            if (LAB.shape === 'co' && scanned >= LAB.K) {""", """            if ((LAB.shape === 'co' || LAB.shape === 'ec') && scanned >= LAB.K) {""")
rep("""            scanned += 1;
            if (walkRefuses(walkTo(c), i)) { etaSkipped += 1; return false; }""", """            scanned += 1;
            if (walkRefuses(walkTo(c, BOUNDED ? i - 1 : Infinity), i)) { etaSkipped += 1; return false; }""")
# the continuation: deepen a bounded cell (not counted: shape a knew it), and bound its previews to i − 1
rep("""            const known = walks.get(c);
            if (known && (known.walk.truncated || known.unsafe || known.eta > i - 1)) continue;""", """            let known = walks.get(c);
            if (BOUNDED && known !== undefined && known.bound < i - 1) known = walkTo(c, i - 1);
            if (known && (known.walk.truncated || known.unsafe || known.eta > i - 1)) continue;""")
rep("""            const { walk, eta, unsafe } = walkTo(c);
            if (walk.truncated || unsafe || eta > i - 1) continue;""", """            const { walk, eta, unsafe } = walkTo(c, BOUNDED ? i - 1 : Infinity);
            if (walk.truncated || unsafe || eta > i - 1) continue;""")
# the lab's knob: e and ec<K>
rep("""    const m = /^(cf|cs|co)(\\d+)$/.exec(v);""", """    if (v === 'e') return { enabled: true, lab: { shape: 'e' } };
    const m = /^(cf|cs|co|ec)(\\d+)$/.exec(v);""")
# count deepenings and the samples previewed (the walk's cost) per variant
rep("""        let previews = 0;
        globalThis.__SF_WALK = (r) => { if (r === run) previews += 1; };""", """        let previews = 0; let deepened = 0; let samples = 0;
        globalThis.__SF_WALK = (r, cell, out) => { if (r === run) { previews += 1; samples += out.walk.samples.length; } };
        globalThis.__SF_DEEPEN = (r) => { if (r === run) deepened += 1; };""")
rep("""        rec.V[v] = { res: err ? { threw: String(err?.message).slice(0, 120) } : sfRes(res), ms: +ms.toFixed(2), previews };""",
    """        globalThis.__SF_DEEPEN = undefined;
        rec.V[v] = { res: err ? { threw: String(err?.message).slice(0, 120) } : sfRes(res), ms: +ms.toFixed(2), previews,
            deepened, samples, full: err ? null : sfFull(res) };""")
rep("""export function deriveStrike(run, bodyId, contacts, notBefore = 0, opts = {}) {
    if (SF_LAB === 'count')""", """// every returned field but the walk objects, as a digest (shape e must equal shape a here)
const sfFull = (r) => {
    if (r === null) return null;
    const j = JSON.stringify(r, (k, v) => (k === 'walk' ? undefined : v instanceof Set ? [...v] : v));
    let h = 0;
    for (let i = 0; i < j.length; i += 1) h = (h * 31 + j.charCodeAt(i)) | 0;
    return h;
};
export function deriveStrike(run, bodyId, contacts, notBefore = 0, opts = {}) {
    if (SF_LAB === 'count')""")
open(p, 'w').write(s)
print('lab3 ok')
