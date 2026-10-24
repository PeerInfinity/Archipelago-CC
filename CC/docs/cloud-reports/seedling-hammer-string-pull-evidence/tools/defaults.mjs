// Every boolean switch solverBot / botDriverV2 export, as `main` ships it.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const out = {};
for (const f of ['solverBot.js', 'botDriverV2.js']) {
    const m = await import(M + f);
    for (const [k, v] of Object.entries(m)) {
        if (typeof v === 'boolean') out[`${f}:${k}`] = v;
        else if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.enabled === 'boolean' && Object.keys(v).length <= 3) out[`${f}:${k}.enabled`] = v.enabled;
    }
}
const sp = await import(M + 'solveProgressTap.js').catch(() => ({}));
console.log(JSON.stringify(out, null, 0));
console.log('SOLVE_PROGRESS_INTERVAL_MS', sp.SOLVE_PROGRESS_INTERVAL_MS);
