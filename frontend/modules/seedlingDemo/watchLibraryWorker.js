/**
 * watchLibraryWorker — the module worker the Seedling lab saves through (document library B3).
 *
 * One per page, created at the FIRST save point (`watchLibrary.js`). Messages are handled strictly in
 * order (the engine's queue), so a draft posted before a save point is written before it, and the
 * lineage minted by the first save is the one every later save uses.
 *
 *   page → worker  {type: 'init', dbName, schemas, source}
 *                  {type: 'start', id, lineageId, parent}       a set was loaded (a new session)
 *                  {type: 'save', id, record, kind, savedBecause, failNext}
 *   worker → page  {id, answer}                                  answer = the save queue's
 */
import { createLibraryEngine } from './watchLibraryEngine.js';

let engine = null;

globalThis.onmessage = async (ev) => {
    const m = ev.data ?? {};
    try {
        if (m.type === 'init') {
            engine = createLibraryEngine({ dbName: m.dbName, schemas: m.schemas ?? {}, source: m.source });
            return;
        }
        if (!engine) throw new Error('the library worker was not initialised');
        if (m.type === 'start') {
            await engine.start({ lineageId: m.lineageId ?? null, parent: m.parent ?? null });
            globalThis.postMessage({ id: m.id, answer: { status: 'started' } });
            return;
        }
        if (m.type === 'save') {
            const t0 = globalThis.performance.now();
            const answer = await engine.save(m);
            globalThis.postMessage({ id: m.id, answer: { ...answer, worker_ms: globalThis.performance.now() - t0 } });
            return;
        }
        throw new Error(`unknown message ${JSON.stringify(m.type)}`);
    } catch (e) {
        globalThis.postMessage({ id: m.id ?? null, answer: { status: 'failed', why: `the library worker threw: ${e?.name ?? 'Error'}: ${e?.message ?? e}` } });
    }
};
