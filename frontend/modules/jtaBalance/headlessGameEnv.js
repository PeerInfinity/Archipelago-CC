/**
 * Headless JtA engine environment — the one place that knows how to stand up
 * the fork's committed `build/` modules outside a real page.
 *
 * The fork is a browser game: `game.js` constructs a `Rendering` at module top
 * level, whose constructor calls `getElementById` and `addEventListener`. So
 * anything that wants the simulation without a page — the stats harness (Node)
 * and the Pass-B balance worker (a browser Web Worker, which has no `document`
 * and no `localStorage`) — has to stub just enough DOM first, in the right
 * import order.
 *
 * Both callers import THIS module. The stubs and the load-bearing import order
 * exist exactly once; only URL resolution differs, so each caller passes a
 * resolver. Nothing here reaches into the submodule's source — it only loads
 * the committed build, so no copy of the game lives outside the submodule.
 *
 * Stubbing `localStorage` is not incidental: it is what makes a balance pass
 * safe to run. The fork saves on every energy reset, and standalone/substrate
 * play share the `incrementalGameSave_substrate` slot. With the stub, the
 * solver's throwaway progression writes to a black hole instead of the
 * player's save.
 */

class FakeElement {
    constructor() {
        this.style = {};
        this.dataset = {};
        this.children = [];
        this.classList = {
            add() {},
            remove() {},
            toggle() {},
            contains: () => false,
        };
        this.innerHTML = '';
        this.textContent = '';
        this.value = '';
        this.checked = false;
    }

    addEventListener() {}
    removeEventListener() {}
    appendChild(c) { return c; }
    removeChild(c) { return c; }
    insertBefore(c) { return c; }
    remove() {}
    querySelector() { return new FakeElement(); }
    querySelectorAll() { return []; }
    setAttribute() {}
    getAttribute() { return null; }
    removeAttribute() {}
    closest() { return null; }
    focus() {}
    blur() {}
    click() {}
    getBoundingClientRect() {
        return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    }

    getElementsByClassName() { return []; }
    getElementsByTagName() { return []; }
}

/**
 * Install the minimal DOM the fork's build touches at import time, and return
 * the window stub. The build hangs its programmatic API (`initializeHeadless`,
 * `setInstantMode`, `stepTick`, `applyTaskPatches`, …) off `window`, so the
 * returned object IS the API surface once the build modules have been imported.
 *
 * Safe in both Node and a Web Worker: neither defines `window`, `document`, or
 * (in a worker) `localStorage`, so these are plain assignments.
 */
export function installDomStubs() {
    const documentStub = {
        addEventListener() {},
        removeEventListener() {},
        getElementById: () => new FakeElement(),
        querySelector: () => new FakeElement(),
        querySelectorAll: () => [],
        createElement: () => new FakeElement(),
        createTextNode: (t) => ({ textContent: t }),
        body: new FakeElement(),
        documentElement: new FakeElement(),
    };

    const windowStub = {
        location: { search: '', href: 'http://localhost/' },
        addEventListener() {},
        removeEventListener() {},
    };

    globalThis.window = windowStub;
    globalThis.document = documentStub;
    globalThis.HTMLElement = FakeElement;
    globalThis.localStorage = {
        getItem: () => null,
        setItem() {},
        removeItem() {},
        clear() {},
    };
    globalThis.alert = () => {};
    globalThis.confirm = () => true;

    return windowStub;
}

/**
 * Install the stubs, then load the build and return the driver `env`.
 *
 * `resolveModuleUrl(basename)` maps e.g. `'game.js'` to something `import()`
 * accepts — a `file://` URL under Node, a same-origin URL in a worker.
 *
 * game.js goes FIRST: it is the browser page's entry module, so importing it
 * first replicates the browser's evaluation order for the circular
 * game <-> simulation <-> rendering imports. Reordering these breaks the build.
 */
export async function loadJtaEnv(resolveModuleUrl) {
    const win = installDomStubs();
    const load = (name) => import(/* @vite-ignore */ resolveModuleUrl(name));
    const game = await load('game.js');
    const sim = await load('simulation.js');
    const zones = await load('zones.js');
    const prestige = await load('prestige_upgrades.js');
    const perks = await load('perks.js');
    const items = await load('items.js');
    const skills = await load('skills.js');
    return { sim, game, zones, prestige, perks, items, skills, win };
}

export { FakeElement };
