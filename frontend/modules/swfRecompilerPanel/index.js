/**
 * swfRecompilerPanel — the SWF Recompiler panel: SWFRecomp-CC's in-browser
 * recompiler (the `swfrecomp-browser` submodule at `browser/`), driven from the
 * app. Pick a SWF, then Recompile (SWF → C), Compile (C → WebAssembly) and Run,
 * in the panel where the browser allows it and in a new tab where it does not.
 * See swfRecompilerUI.js for the routes and walkClient.js for the message API.
 */
import { COMPONENT_TYPE, MODULE_ID, SwfRecompilerUI } from './swfRecompilerUI.js';

export const moduleInfo = {
    name: MODULE_ID,
    title: 'SWF Recompiler',
    componentType: COMPONENT_TYPE,
    icon: '🛠️',
    column: 2,
    category: 'Embedding and Windows',
    description: 'Recompile a Flash SWF to WebAssembly in your browser (SWFRecomp: SWF → C → WebAssembly) and run it.',
    docs: 'docs/json/user/modules/swfRecompilerPanel.md',
    requires: [],
};

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/swfRecompilerPanel/swfRecompilerPanel.css';
        document.head.appendChild(link);
    }
    registrationApi.registerPanelComponent(moduleInfo.componentType, SwfRecompilerUI);
}
