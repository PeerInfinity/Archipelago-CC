// Shared plain-Node environment for the JtA stats scripts: stubs just enough
// DOM for the build modules to import (game.js constructs a Rendering at
// module top-level, whose constructor does getElementById + addEventListener),
// then loads the committed build modules straight from disk. No browser.
//
// Extracted from run-node.mjs so profile-vanilla.mjs (and future scripts)
// share one copy of the stubs and the load-bearing import order.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const buildDir = path.join(
  repoRoot,
  "frontend/modules/journey-to-ascension/build"
);

// --- Minimal DOM stubs -----------------------------------------------------
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
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
  }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c) {
    return c;
  }
  removeChild(c) {
    return c;
  }
  insertBefore(c) {
    return c;
  }
  remove() {}
  querySelector() {
    return new FakeElement();
  }
  querySelectorAll() {
    return [];
  }
  setAttribute() {}
  getAttribute() {
    return null;
  }
  removeAttribute() {}
  closest() {
    return null;
  }
  focus() {}
  blur() {}
  click() {}
  getBoundingClientRect() {
    return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  getElementsByClassName() {
    return [];
  }
  getElementsByTagName() {
    return [];
  }
}

function installDomStubs() {
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
    location: { search: "", href: "http://localhost/" },
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

// Loads the build and returns the driver `env` plus extra data modules.
// game.js first: it is the browser page's entry module, so importing it
// first replicates the browser's evaluation order for the circular
// game <-> simulation <-> rendering imports.
export async function loadJtaEnv() {
  const win = installDomStubs();
  const game = await import(pathToFileURL(path.join(buildDir, "game.js")));
  const sim = await import(pathToFileURL(path.join(buildDir, "simulation.js")));
  const zones = await import(pathToFileURL(path.join(buildDir, "zones.js")));
  const prestige = await import(
    pathToFileURL(path.join(buildDir, "prestige_upgrades.js"))
  );
  const perks = await import(pathToFileURL(path.join(buildDir, "perks.js")));
  const items = await import(pathToFileURL(path.join(buildDir, "items.js")));
  const skills = await import(pathToFileURL(path.join(buildDir, "skills.js")));
  return { sim, game, zones, prestige, perks, items, skills, win };
}
