// POSITIVE CONTROL for moduleImportOrder.test.js — a LIVE UI ⇄ index.js cycle.
// This index reads a UI export at evaluation (the shape P9 fixed in
// quickLaunch), so importing cycleUI.js FIRST evaluates this file before
// FIXTURE_ID exists and must throw a ReferenceError. Never import it from app code.
import { FIXTURE_ID } from './cycleUI.js';

export const moduleInfo = { name: FIXTURE_ID };
