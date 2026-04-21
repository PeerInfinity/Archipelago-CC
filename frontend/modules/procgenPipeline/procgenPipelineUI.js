/**
 * procgenPipeline UI — panel shell for the grid-growth pipeline.
 *
 * v1 starts as a placeholder. As the engine lands (scenario pool,
 * grid model, growth loop, compile), the panel grows the two-section
 * library/scenario-pool picker, the generate button, and the grid
 * renderer.
 */

import { setPanelInstance, getModuleApis } from './index.js';

export class ProcgenPipelineUI {
    static moduleApis = null;
    static setModuleApis(apis) { ProcgenPipelineUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'procgen-pipeline-panel';
        setPanelInstance(this);
        this.render();
    }

    get apis() { return ProcgenPipelineUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }
    destroy() { setPanelInstance(null); }
    onPanelShow() { this.render(); }
    onPanelResize() {}

    render() {
        this.rootElement.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'procgen-pipeline-section-title';
        header.textContent = 'Procgen Pipeline';
        this.rootElement.appendChild(header);

        const placeholder = document.createElement('div');
        placeholder.className = 'procgen-pipeline-placeholder';
        placeholder.textContent = 'Pipeline UI is not yet wired. See NewDocs/plans/procedural-generation/grid-growth-pipeline.md for the v1 scope.';
        this.rootElement.appendChild(placeholder);
    }
}
