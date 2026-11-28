// MEASUREMENT-ONLY: HIT_PLAN_RETRY on the page's MAIN thread, for A1's own ?seedlingSolverEnv= (no mode= → no test run)
const { chromium } = require('playwright');
(async () => {
  const search = process.argv[2];
  const env = new URLSearchParams(search).get('seedlingSolverEnv');
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [tag, q] of [['A1-env', '?seedlingSolverEnv=' + encodeURIComponent(env)], ['none', '']]) {
    await p.goto('http://localhost:8000/frontend/modules/seedlingDemo/solverEnvChannel.js' + q);
    const r = await p.evaluate(async () => {
      const h = await import('/frontend/modules/seedlingDemo/hitPlanRetry.js' + location.search);
      const c = await import('/frontend/modules/seedlingDemo/solverEnvChannel.js');
      const w = await import('/frontend/modules/seedlingDemo/wasmPlayback.js' + location.search).catch((e) => ({ err: String(e) }));
      const cut = { ok: true, kind: 'budget', plan: { modelHits: { hits: 1, deaths: 0 } } };
      return { search: location.search.slice(0, 80), HPR: h.HIT_PLAN_RETRY.enabled, switchOn: c.pageSolverEnvSwitchOn('SEEDLING_HIT_PLAN_RETRY'),
        asks: h.hitPlanRetryAsks(cut), expiryAction: w.expiryAction ? w.expiryAction({ provisional: cut, retries: 0, unanswered: true }) : w.err };
    });
    console.log('HPR-PAGE', tag, JSON.stringify(r));
  }
  await b.close();
})();
