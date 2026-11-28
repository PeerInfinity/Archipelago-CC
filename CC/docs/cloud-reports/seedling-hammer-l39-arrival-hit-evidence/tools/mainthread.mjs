// MEASUREMENT-ONLY: the page MAIN thread's read of HIT_PLAN_RETRY (pageSolverEnvSwitchOn) with and without the URL param.
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/user/Archipelago-CC/package.json')('playwright');
const b = await chromium.launch();
for (const q of ['', '?seedlingSolverEnv=SEEDLING_HIT_PLAN_RETRY%3D1', '?seedlingSolverEnv=SEEDLING_HIT_PLAN_RETRY%3D0']) {
    const p = await b.newPage();
    await p.goto(`http://localhost:8000/frontend/index.html${q}`, { waitUntil: 'domcontentloaded' });
    const r = await p.evaluate(async () => { const m = await import('/frontend/modules/seedlingDemo/wasmPlayback.js'); const h = await import('/frontend/modules/seedlingDemo/hitPlanRetry.js');
        const hit = { ok: true, kind: null, plan: { modelHits: { hits: 1, deaths: 0 } } };
        return { enabled: h.HIT_PLAN_RETRY.enabled, action: m.expiryAction({ provisional: hit, retries: 0, unanswered: true }) }; });
    console.log(JSON.stringify(q || '(none)'), JSON.stringify(r));
    await p.close();
}
await b.close();
