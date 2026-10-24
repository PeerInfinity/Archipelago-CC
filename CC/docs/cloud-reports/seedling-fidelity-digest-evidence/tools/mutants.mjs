// SCRATCH (seedling-fidelity-digest D3.3): one mutant per field. The tree at REPO is a SCRATCH copy whose levelRun.js
// carries the hook (made by mutant-hook.py); `globalThis.__MUT = {apply, restore}` is eval'd inside the run's own
// closure around ONE stateDigest() call (copy + restore of the field, in place or by rebinding).
//   REPO=<scratch tree> node mutants.mjs <predictions.json> <tape> <tick>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.env.REPO; const M = join(R, 'frontend/modules/seedlingDemo');
const [predPath, tapeName, tickStr] = process.argv.slice(2);
const pred = JSON.parse(readFileSync(predPath, 'utf8'));
const { loadTape } = await import(join(M, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(M, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
const { heldKeysAt } = await import(join(M, 'tapeFormat.js'));
const tape = loadTape(tapeName);
const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
for (let t = 0; t < Number(tickStr); t += 1) run.advance(heldKeysAt(tape, t));
// a perturbation that reads as a different value to a canonical serialiser, and its exact undo
globalThis.__perturb = (v) => {
    if (v instanceof Map) { v.set('__mut', 1); return { inPlace: true, undo: () => v.delete('__mut') }; }
    if (v instanceof Set) { v.add('__mut'); return { inPlace: true, undo: () => v.delete('__mut') }; }
    if (Array.isArray(v)) {
        if (!Object.isExtensible(v)) return { inPlace: false, value: [...v, '__mut'] };
        v.push('__mut'); return { inPlace: true, undo: () => v.pop() };
    }
    if (v !== null && typeof v === 'object') {
        if (Object.isFrozen(v) || !Object.isExtensible(v)) return { inPlace: false, value: { ...v, __mut: 1 } };
        v.__mut = 1; return { inPlace: true, undo: () => { delete v.__mut; } };
    }
    if (typeof v === 'number') return { inPlace: false, value: v + 1 };
    if (typeof v === 'boolean') return { inPlace: false, value: !v };
    if (typeof v === 'string') return { inPlace: false, value: `${v}_` };
    if (typeof v === 'function') return { inPlace: false, value: (...a) => v(...a) };
    return { inPlace: false, value: { __mut: 1 } };
};
const mutate = (name) => ({
    apply: `globalThis.__p = globalThis.__perturb(${name}); if (!globalThis.__p.inPlace) { globalThis.__sv = ${name}; ${name} = globalThis.__p.value; }`,
    restore: `if (globalThis.__p.inPlace) globalThis.__p.undo(); else ${name} = globalThis.__sv;`,
});
// `clock` is a const of closures: its `now` is rebound on the object instead
const special = {
    // a REBUILT world (what every world change is): a new object
    world: { apply: 'globalThis.__sv = world; world = { ...world, __mut: 1 };', restore: 'world = globalThis.__sv;' },
    // ⚠ an IN-PLACE edit of the world: the memo cannot see it (the claim the memo rests on); `fresh` must
    'world (in place; memo)': { apply: 'world.__mut = 1;', restore: 'delete world.__mut;' },
    'world (in place; fresh)': { apply: 'world.__mut = 1;', restore: 'delete world.__mut;', fresh: true },
    clock: { apply: 'globalThis.__sv = clock.now; clock.now = () => (globalThis.__sv() ?? 0) + 1;',
    restore: 'clock.now = globalThis.__sv;' } };
const base = run.stateDigest({ parts: true });
const rows = [];
const check = (name, expect, component) => {
    globalThis.__MUT = special[name] ?? mutate(name);
    let got; let err = null;
    const fresh = globalThis.__MUT.fresh === true;
    try { got = run.stateDigest({ parts: true, fresh }); } catch (e) { err = String(e.message).slice(0, 120); }
    globalThis.__MUT = null;
    const after = run.stateDigest();
    const flipped = got ? Object.keys(base.parts).filter((k) => base.parts[k] !== got.parts[k]) : null;
    if (err && /Assignment to constant|not extensible/.test(err)) { rows.push({ name, expect, component: component ?? null, flipped: null, restored: after === base.digest, err: `IMMUTABLE: ${err}`, ok: expect === 'equal' }); return; }
    const ok = err === null && after === base.digest
        && (expect === 'flip' ? got.digest !== base.digest && flipped.length === 1 && flipped[0] === component
            : got.digest === base.digest);
    rows.push({ name, expect, component: component ?? null, flipped, restored: after === base.digest, err, ok });
};
for (const [component, names] of Object.entries(pred.flip)) for (const n of names) check(n, 'flip', component);
for (const names of Object.values(pred.equal)) for (const n of names) check(n, 'equal');
check('world (in place; memo)', 'equal');
check('world (in place; fresh)', 'flip', 'place');
const bad = rows.filter((r) => !r.ok);
console.log(JSON.stringify({ tape: tapeName, tick: Number(tickStr), level: run.level, mutants: rows.length,
    asPredicted: rows.length - bad.length, bad }, null, 1));
for (const r of rows) console.log(`${r.ok ? 'OK ' : 'BAD'} ${r.expect.padEnd(5)} ${r.name.padEnd(28)} predicted ${String(r.component).padEnd(8)} flipped [${r.flipped}] restored ${r.restored}${r.err ? ` ERR ${r.err}` : ''}`);
