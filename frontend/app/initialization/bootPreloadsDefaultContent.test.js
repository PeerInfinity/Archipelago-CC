/**
 * ⛓ CONTENT SETS C4 — the boot preloads the default content packs AFTER the
 * modules register (phase 5: a substrate's entry registers in its module's
 * register()) and BEFORE any panel, the APWorld editor or a substrate can
 * generate (phases 6–10), and again after a module registers later.
 *
 * initializeApplication is the whole boot, so this pins the ORDER in its source
 * (the `settingsModeBeforeModules.test.js` precedent); the call's effect in the
 * running app — bundled and unbundled, `index.js` is the one boot both entries
 * call — is the in-app row `procgen-pipeline-boot-preloaded-default-content`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const src = read('./index.js');
const at = (needle, from = 0) => {
  const i = src.indexOf(needle, from);
  expect(i, `index.js no longer contains ${needle}`).toBeGreaterThan(-1);
  return i;
};
const CALL = 'await preloadBootContent(logger);';

describe('the boot preloads the default content packs', () => {
  it('after phase 5 (the registrations) and before phase 6 (data), phase 9 (initialise) and phase 10', () => {
    const call = at(CALL);
    expect(call).toBeGreaterThan(at("profiler.end('phase5:loadModules')"));
    expect(call).toBeLessThan(at("profiler.start('phase6:applyDataToModules')"));
    expect(call).toBeLessThan(at("profiler.start('phase9:initializeModules')"));
    expect(call).toBeLessThan(at("profiler.start('phase10:postInitializeModules')"));
  });

  it('again right after a module registered after boot', () => {
    const late = at('await actualModuleObject.register(registrationApi);');
    const next = at(CALL, late);
    expect(src.slice(late, next).split('\n').length).toBeLessThan(5);
  });

  it('through worldContent.preloadDefaultContent over the page\'s packs', () => {
    expect(src).toContain('await preloadDefaultContent(browserPackIo());');
  });

  it('both entries reach it: init.js and init-bundled.js call initializeApplication from this module', () => {
    for (const entry of ['../../init.js', '../../init-bundled.js']) {
      const text = read(entry);
      expect(text, entry).toContain("from './app/initialization/index.js'");
      expect(text, entry).toMatch(/initializeApplication\(/);
    }
  });
});
