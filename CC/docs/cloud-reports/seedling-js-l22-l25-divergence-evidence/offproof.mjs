const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const run = async (file) => {
    const m = await import(D + file);
    const posted = [];
    const svc = m.createWorkerSolveService({ createWorker: () => ({ postMessage: (x) => posted.push(JSON.stringify(x)), terminate() {}, onmessage: null, onerror: null }) });
    const records = new Map([[22, { level: 22, foo: [1, 2] }]]);
    svc.start({ staging: { boot: { level: 22 } }, perTick: [[], ['right']], live: 'x', solverGoal: { kind: 'reach-exit' }, name: 'js-runtime-L22-exit', budgetWork: 640, upgradeWindowWork: 85, source: { records } }, { attempt: { retry: 0, budgets: [640] } });
    svc.start({ staging: { boot: { level: 40 } }, perTick: [], live: 'y', solverGoal: { kind: 'reach-location' }, name: 'js-runtime-L40-location', budgetWork: 0, source: { records } });
    return posted;
};
const a = await run('__offproof_main.tmp.js');
const b = await run('jsRuntimeSolveService.js');
console.log('messages', a.length, b.length, 'byte-identical:', JSON.stringify(a) === JSON.stringify(b));
// with the binding present but no ?measureCaptureService=, still OFF
globalThis.__measureCaptureAppend = () => { throw new Error('appended while OFF'); };
const c = await run('jsRuntimeSolveService.js');
console.log('binding present, no URL param: byte-identical:', JSON.stringify(a) === JSON.stringify(c));
