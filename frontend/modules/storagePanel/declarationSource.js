/**
 * declarationSource — collect every module's `moduleInfo.storage` at runtime.
 *
 * The origin's keys belong to the modules of EVERY mode, not only the ones this
 * mode loaded (a save written in `?mode=loops` is still here in `default`), so
 * the panel reads the declarations of every module any mode config names:
 *   1. modules this page already imported (the module manager's states);
 *   2. the bundled boot's module map (`window.__BUNDLED_MODULES__`) — it holds
 *      every module, enabled or not;
 *   3. unbundled only: the module configs every mode in modes.json names; each
 *      module not yet seen is imported by its config path — the same URL the
 *      module loader uses, so the module instance is the loader's own. Nothing is
 *      registered or initialised; only `moduleInfo` is read.
 * A module that fails to import is listed, not fatal: its keys show as Unknown.
 */
import { normalizeDeclarations } from './storageModel.js';

let cached = null;

/** Forget the collected declarations (a test, or a Refresh after enabling a module). */
export function resetDeclarationCache() {
    cached = null;
}

function infoOf(moduleObject) {
    return moduleObject?.moduleInfo || moduleObject?.default?.moduleInfo || null;
}

async function moduleConfigPaths(win) {
    let modes = win.G_modesConfig;
    if (!modes) {
        const res = await fetch(new URL('./modes.json', win.location.href));
        modes = await res.json();
    }
    const paths = new Set();
    for (const mode of Object.values(modes || {})) {
        const path = mode?.moduleConfig?.path;
        if (typeof path === 'string') paths.add(path);
    }
    return [...paths];
}

async function collect(moduleManager, win) {
    const infos = new Map(); // moduleId → moduleInfo
    const failures = [];
    const states = moduleManager?.getAllModuleStates?.() ?? {};
    for (const [moduleId, state] of Object.entries(states)) {
        // A module the manager never imported gets a stand-in definition ("Definition N/A …"): skip it, so
        // step 3 imports the real one.
        const def = state?.definition;
        if (def && !String(def.description ?? '').startsWith('Definition N/A')) infos.set(moduleId, def);
    }
    const bundled = win.__BUNDLED_MODULES__;
    if (bundled) {
        for (const [moduleId, moduleObject] of Object.entries(bundled)) {
            const info = infoOf(moduleObject);
            if (info && !infos.has(moduleId)) infos.set(moduleId, info);
        }
    } else {
        const definitions = new Map(); // moduleId → path
        for (const configPath of await moduleConfigPaths(win)) {
            try {
                const res = await fetch(new URL(configPath, win.location.href));
                const config = await res.json();
                for (const [moduleId, def] of Object.entries(config.moduleDefinitions || {})) {
                    if (def?.path && !definitions.has(moduleId)) definitions.set(moduleId, def.path);
                }
            } catch (e) {
                failures.push(`${configPath}: ${e.message}`);
            }
        }
        const missing = [...definitions].filter(([moduleId]) => !infos.has(moduleId));
        const results = await Promise.allSettled(
            missing.map(([, path]) => import(new URL(path, win.location.href).href)),
        );
        results.forEach((r, i) => {
            const [moduleId] = missing[i];
            if (r.status === 'fulfilled' && infoOf(r.value)) infos.set(moduleId, infoOf(r.value));
            else if (r.status === 'rejected') failures.push(`${moduleId}: ${r.reason?.message ?? r.reason}`);
        });
    }
    const modules = [...infos].map(([moduleId, info]) => ({
        moduleId, owner: info.title || info.name || moduleId, storage: info.storage,
    }));
    const { declarations, errors } = normalizeDeclarations(modules);
    return { declarations, errors, failures, moduleCount: modules.length };
}

/**
 * { declarations, errors, failures, moduleCount } — collected once per page
 * (declarations live in code, so they cannot change without a reload).
 */
export function collectDeclarations({ moduleManager = null, win = globalThis.window } = {}) {
    if (!cached) cached = collect(moduleManager, win).catch((e) => { cached = null; throw e; });
    return cached;
}
