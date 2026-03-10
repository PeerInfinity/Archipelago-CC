/**
 * Cost Debugger Panel UI
 *
 * GoldenLayout panel component that displays step-by-step
 * cost generation reasoning. Each step = one action queue (one loop).
 */

import { getCostPlanner, getModuleEventBus, getSphereLog } from './index.js';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('costDebuggerUI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[costDebuggerUI] ${message}`, ...data);
  }
}

/**
 * CostDebuggerUI - GoldenLayout panel component
 */
export class CostDebuggerUI {
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState;
    Object.defineProperty(this, 'eventBus', {
      get: () => getModuleEventBus(),
      configurable: true,
    });

    this.selectedStepIndex = -1;
    this.subscriptions = [];

    this.rootElement = this._createRootElement();
    this.container.element.appendChild(this.rootElement);

    this._subscribeToEvents();

    this.container.on('destroy', () => this._onDestroy());

    log('info', 'CostDebuggerUI initialized');
  }

  getRootElement() {
    return this.rootElement;
  }

  // =========================================================================
  // DOM Creation
  // =========================================================================

  _createRootElement() {
    const el = document.createElement('div');
    el.className = 'cost-debugger-panel';

    el.innerHTML = `
      <div class="cd-controls">
        <button class="cd-btn-load" title="Load sphere log data">Load</button>
        <button class="cd-btn-plan-step" disabled title="Plan next action queue">Plan Step</button>
        <button class="cd-btn-plan-all" disabled title="Plan all remaining steps">Plan All</button>
        <button class="cd-btn-reset" disabled title="Reset to initial state">Reset</button>
        <span class="cd-status">No sphere log loaded</span>
      </div>
      <div class="cd-step-list-container">
        <div class="cd-step-list">
          <div class="cd-step-list-empty">Click "Load" to load sphere log data, then "Plan Step" to begin.</div>
        </div>
      </div>
      <div class="cd-resize-handle"></div>
      <div class="cd-detail-container" style="height: 250px;">
        <div class="cd-detail-empty">Select a step to view details</div>
      </div>
      <div class="cd-summary">
        <span class="cd-summary-item">
          <span class="cd-summary-label">Loops:</span>
          <span class="cd-summary-value cd-summary-steps">0</span>
        </span>
        <span class="cd-summary-item">
          <span class="cd-summary-label">Entries:</span>
          <span class="cd-summary-value cd-summary-entries">0 / 0</span>
        </span>
        <span class="cd-summary-item">
          <span class="cd-summary-label">Regions:</span>
          <span class="cd-summary-value cd-summary-regions">0</span>
        </span>
        <span class="cd-summary-item">
          <span class="cd-summary-label">Locations:</span>
          <span class="cd-summary-value cd-summary-locations">0</span>
        </span>
      </div>
    `;

    this._attachControlListeners(el);
    this._attachResizeHandle(el);

    return el;
  }

  _attachControlListeners(el) {
    el.querySelector('.cd-btn-load').addEventListener('click', () => this._handleLoad());
    el.querySelector('.cd-btn-plan-step').addEventListener('click', () => this._handlePlanStep());
    el.querySelector('.cd-btn-plan-all').addEventListener('click', () => this._handlePlanAll());
    el.querySelector('.cd-btn-reset').addEventListener('click', () => this._handleReset());
  }

  _attachResizeHandle(el) {
    const handle = el.querySelector('.cd-resize-handle');
    const detailContainer = el.querySelector('.cd-detail-container');
    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e) => {
      const delta = startY - e.clientY;
      detailContainer.style.height = Math.max(100, startHeight + delta) + 'px';
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startHeight = detailContainer.offsetHeight;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });
  }

  // =========================================================================
  // Event Subscriptions
  // =========================================================================

  _subscribeToEvents() {
    const subscribe = (eventName, handler) => {
      const unsub = this.eventBus.subscribe(eventName, handler.bind(this));
      this.subscriptions.push(unsub);
    };

    subscribe('costDebugger:stepPlanned', this._handleStepPlannedEvent);
    subscribe('costDebugger:allPlanned', this._handleAllPlannedEvent);
    subscribe('costDebugger:reset', this._handleResetEvent);
  }

  _handleStepPlannedEvent(data) {
    this._refreshStepList();
    this._updateSummary();
    this._updateStatus();
    this._updateButtons();
    this.selectedStepIndex = data.stepIndex;
    this._refreshDetailView();
    this._scrollToStep(data.stepIndex);
  }

  _handleAllPlannedEvent() {
    this._refreshStepList();
    this._updateSummary();
    this._updateStatus();
    this._updateButtons();
  }

  _handleResetEvent() {
    this.selectedStepIndex = -1;
    this._refreshStepList();
    this._refreshDetailView();
    this._updateSummary();
    this._updateStatus();
    this._updateButtons();
  }

  // =========================================================================
  // Button Handlers
  // =========================================================================

  _handleLoad() {
    const planner = getCostPlanner();
    if (!planner) {
      log('warn', 'CostPlanner not available');
      return;
    }

    const sphereLog = getSphereLog();
    if (!sphereLog || sphereLog.length === 0) {
      this._setStatus('No sphere log available. Load a game with sphere data first.');
      return;
    }

    const result = planner.loadSphereLog(sphereLog);
    log('info', `Loaded sphere log: ${result.entryCount} entries, start region: ${result.startRegion}`);

    this.selectedStepIndex = -1;
    this._refreshStepList();
    this._refreshDetailView();
    this._updateSummary();
    this._updateStatus();
    this._updateButtons();
  }

  _handlePlanStep() {
    const planner = getCostPlanner();
    if (!planner || !planner.isLoaded() || planner.isComplete()) return;
    planner.planNextStep();
  }

  _handlePlanAll() {
    const planner = getCostPlanner();
    if (!planner || !planner.isLoaded() || planner.isComplete()) return;
    planner.planAll();
  }

  _handleReset() {
    const planner = getCostPlanner();
    if (!planner || !planner.isLoaded()) return;
    planner.reset();
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  _setStatus(text) {
    const statusEl = this.rootElement.querySelector('.cd-status');
    if (statusEl) statusEl.textContent = text;
  }

  _updateStatus() {
    const planner = getCostPlanner();
    if (!planner || !planner.isLoaded()) {
      this._setStatus('No sphere log loaded');
      return;
    }
    const steps = planner.getPlannedSteps().length;
    const entries = planner.getTotalEntries();
    if (planner.isComplete()) {
      this._setStatus(`Complete: ${steps} loops, ${entries} entries`);
    } else {
      this._setStatus(`${steps} loops planned`);
    }
  }

  _updateButtons() {
    const planner = getCostPlanner();
    const loaded = planner?.isLoaded() || false;
    const complete = planner?.isComplete() || false;
    const hasSteps = (planner?.getPlannedSteps().length || 0) > 0;

    const btnPlanStep = this.rootElement.querySelector('.cd-btn-plan-step');
    const btnPlanAll = this.rootElement.querySelector('.cd-btn-plan-all');
    const btnReset = this.rootElement.querySelector('.cd-btn-reset');

    if (btnPlanStep) btnPlanStep.disabled = !loaded || complete;
    if (btnPlanAll) btnPlanAll.disabled = !loaded || complete;
    if (btnReset) btnReset.disabled = !loaded || !hasSteps;
  }

  _updateSummary() {
    const planner = getCostPlanner();
    const steps = planner?.getPlannedSteps() || [];
    const totalEntries = planner?.getTotalEntries() || 0;

    const stepsEl = this.rootElement.querySelector('.cd-summary-steps');
    const entriesEl = this.rootElement.querySelector('.cd-summary-entries');
    const regionsEl = this.rootElement.querySelector('.cd-summary-regions');
    const locationsEl = this.rootElement.querySelector('.cd-summary-locations');

    if (stepsEl) stepsEl.textContent = String(steps.length);

    // Count completed sphere entries (CHECK steps)
    const completedEntries = steps.filter(s => s.phase === 'CHECK').length;
    if (entriesEl) entriesEl.textContent = `${completedEntries} / ${totalEntries}`;

    const costData = planner?.getCostData();
    if (regionsEl) regionsEl.textContent = costData ? Object.keys(costData.regions).length : '0';
    if (locationsEl) locationsEl.textContent = costData ? Object.keys(costData.locations).length : '0';
  }

  _refreshStepList() {
    const listEl = this.rootElement.querySelector('.cd-step-list');
    if (!listEl) return;

    const planner = getCostPlanner();
    const steps = planner?.getPlannedSteps() || [];

    if (steps.length === 0) {
      const msg = planner?.isLoaded()
        ? 'Sphere log loaded. Click "Plan Step" to begin.'
        : 'Click "Load" to load sphere log data, then "Plan Step" to begin.';
      listEl.innerHTML = `<div class="cd-step-list-empty">${msg}</div>`;
      return;
    }

    listEl.innerHTML = steps.map(step => {
      const selected = step.stepIndex === this.selectedStepIndex ? ' cd-selected' : '';
      const hasDeficit = step.simulatedResults.manaRemaining < 0;
      const hasWarning = step.notes.some(n => !n.includes('fully explored') && !n.includes('discovered') && !n.includes('Ready'));
      const warnClass = hasDeficit ? ' cd-has-error' : hasWarning ? ' cd-has-warning' : '';

      const phaseBadge = step.phase === 'EXPLORE'
        ? '<span class="cd-phase-badge cd-phase-explore">EXP</span>'
        : '<span class="cd-phase-badge cd-phase-check">CHK</span>';

      let detail = '';
      if (step.phase === 'EXPLORE' && step.exploreProgress) {
        const p = step.exploreProgress;
        detail = `<span class="cd-step-progress">${p.discovered}/${p.total}</span>`;
      } else if (step.phase === 'CHECK') {
        detail = `<span class="cd-step-new-costs">cost=${step.costAssignments.find(a => a.type === 'location')?.cost || '?'}</span>`;
      }

      const truncName = step.phase === 'EXPLORE'
        ? truncate(step.targetRegion, 24)
        : truncate(step.locationName, 24);

      return `
        <div class="cd-step-row${selected}${warnClass}" data-index="${step.stepIndex}">
          <span class="cd-step-index">${step.stepIndex + 1}</span>
          <span class="cd-step-sphere">S${step.sphereIndex}</span>
          ${phaseBadge}
          <span class="cd-step-name" title="${escapeHtml(step.phase === 'EXPLORE' ? step.targetRegion : step.locationName)}">${escapeHtml(truncName)}</span>
          <span class="cd-step-summary">${detail}</span>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.cd-step-row').forEach(row => {
      row.addEventListener('click', () => {
        this.selectedStepIndex = parseInt(row.dataset.index, 10);
        this._refreshStepList();
        this._refreshDetailView();
      });
    });
  }

  _scrollToStep(stepIndex) {
    const row = this.rootElement.querySelector(`.cd-step-row[data-index="${stepIndex}"]`);
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  _refreshDetailView() {
    const container = this.rootElement.querySelector('.cd-detail-container');
    if (!container) return;

    const planner = getCostPlanner();
    const steps = planner?.getPlannedSteps() || [];
    const step = steps[this.selectedStepIndex];

    if (!step) {
      container.innerHTML = '<div class="cd-detail-empty">Select a step to view details</div>';
      return;
    }

    container.innerHTML = `<div class="cd-detail-inner">${this._renderStepDetail(step)}</div>`;
  }

  // =========================================================================
  // Detail Rendering
  // =========================================================================

  _renderStepDetail(step) {
    const sections = [];
    const pad = (str, len) => String(str).padEnd(len);
    const rpad = (str, len) => String(str).padStart(len);
    const pre = (html) => `<pre style="margin:0; font-size:inherit; font-family:inherit; white-space:pre;">${html}</pre>`;

    // Header
    const phaseLabel = step.phase === 'EXPLORE' ? 'Explore' : 'Check';
    const target = step.phase === 'EXPLORE' ? step.targetRegion : step.locationName;
    sections.push(`<div class="cd-reason-header">Step ${step.stepIndex + 1} [${phaseLabel}]: ${escapeHtml(target)}</div>`);

    // Sphere entry context
    const entryIdx = step.sphereEntryIndex != null ? step.sphereEntryIndex + 1 : '?';
    const planner = getCostPlanner();
    const totalEntries = planner?.getTotalEntries() || '?';
    sections.push(`<div class="cd-reason-subheader">Sphere entry ${entryIdx}/${totalEntries} (sphere ${step.sphereIndex}): ${escapeHtml(step.locationName)}</div>`);

    // State before
    const s = step.stateBefore;
    const xpParts = [];
    if (s.regionXP) {
      for (const [region, data] of s.regionXP) {
        if (data.level > 0) xpParts.push(`${region}:L${data.level}`);
      }
    }
    sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">State Before</div><div class="cd-reason-grid">` +
      `<span>Mana: ${fmtMana(s.currentMana)} / ${fmtMana(s.maxMana)}</span>` +
      `<span>Explored: ${s.exploredRegions.size} regions | Checked: ${s.checkedLocations.size} locations</span>` +
      (xpParts.length > 0 ? `<span>XP Levels: ${xpParts.join(', ')}</span>` : '') +
      `</div></div>`);

    // Path
    if (step.path && step.path.steps.length > 0) {
      const pathStr = step.path.steps.map(s => s.region).join(' \u2192 ');
      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Path (${step.path.steps.length - 1} steps)</div><div class="cd-reason-grid">` +
        `<span>${escapeHtml(pathStr)}</span>` +
        `</div></div>`);
    }

    // Explore Progress (EXPLORE phase only)
    if (step.phase === 'EXPLORE' && step.exploreProgress) {
      const p = step.exploreProgress;
      const barLen = 20;
      const filled = Math.round((p.discovered / p.total) * barLen);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);
      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Explore Progress: ${step.targetRegion}</div><div class="cd-reason-grid">` +
        `<span>[${bar}] ${p.discovered} / ${p.total} (${p.remaining} remaining)</span>` +
        (step.discoveries && step.discoveries.length > 0
          ? `<span>Discovered this loop: ${step.discoveries.map(d => `${d.name} (${d.type})`).join(', ')}</span>`
          : '') +
        `</div></div>`);
    }

    // Cost Assignments
    if (step.costAssignments && step.costAssignments.length > 0) {
      const NW = 28;
      const rows = [];
      rows.push(`${pad('Target', NW)} ${rpad('Type', 8)} ${rpad('Cost', 6)}  Formula`);
      rows.push('\u2500'.repeat(NW + 50));

      for (const ca of step.costAssignments) {
        const cls = 'cd-reason-new';
        const name = truncate(ca.name, NW - 2);
        const typeLabel = ca.type === 'region' ? 'region' : 'location';
        rows.push(`<span class="${cls}">\u2713 ${pad(name, NW)} ${rpad(typeLabel, 8)} ${rpad(ca.cost, 6)}  ${ca.formula}</span>`);
      }

      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Cost Assignments (${step.costAssignments.length})</div>${pre(rows.join('\n'))}</div>`);
    }

    // Simulated Queue
    if (step.queue.length > 0) {
      const NW = 28;
      const rows = [];
      rows.push(`${pad('Action', 12)} ${pad('Target', NW)} ${rpad('Base', 6)} ${rpad('Lvl', 4)} ${rpad('Cost', 8)}`);
      rows.push('\u2500'.repeat(NW + 34));

      let runningMana = step.stateBefore.currentMana;
      for (const q of step.queue) {
        let actionLabel, targetStr;
        if (q.type === 'explore') {
          actionLabel = 'Explore';
          const discType = q.discovered ? ` (${q.discovered.type})` : '';
          targetStr = q.discovered ? q.discovered.name + discType : q.region;
        } else if (q.type === 'move') {
          actionLabel = 'Move';
          targetStr = `${q.from} \u2192 ${q.to}`;
        } else {
          actionLabel = 'Check';
          targetStr = q.location || '?';
        }

        const truncTarget = truncate(targetStr, NW);
        runningMana -= q.cost;
        const manaClass = runningMana < 0 ? 'cd-reason-mana-deficit'
          : runningMana < step.stateBefore.maxMana * 0.2 ? 'cd-reason-mana-low'
          : '';

        const costStr = q.cost.toFixed(1);
        const remaining = `\u2192 ${runningMana.toFixed(1)}`;
        rows.push(`${pad(actionLabel, 12)} ${pad(truncTarget, NW)} ${rpad(q.baseCost.toFixed(0), 6)} ${rpad('L' + q.level, 4)} <span class="${manaClass}">${rpad(costStr, 8)} ${remaining}</span>`);
      }

      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Action Queue (${step.queue.length} actions)</div>${pre(rows.join('\n'))}</div>`);
    }

    // Results
    const r = step.simulatedResults;
    const manaClass = r.manaRemaining < 0 ? 'cd-reason-mana-deficit'
      : r.manaRemaining < step.stateBefore.maxMana * 0.2 ? 'cd-reason-mana-low'
      : 'cd-reason-mana-ok';

    const xpEntries = Object.entries(r.xpGained);
    const xpStr = xpEntries.length > 0
      ? xpEntries.map(([region, xp]) => `${region}: +${xp.toFixed(1)}`).join(', ')
      : 'none';

    sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Results</div><div class="cd-reason-grid">` +
      `<span>Mana consumed: ${r.manaConsumed.toFixed(1)}</span>` +
      `<span>Mana remaining: <span class="${manaClass}">${r.manaRemaining.toFixed(1)}</span> (then reset to ${step.stateAfter.maxMana.toFixed(1)})</span>` +
      `<span>XP gained: ${xpStr}</span>` +
      `</div></div>`);

    // Notes
    if (step.notes.length > 0) {
      const noteRows = step.notes.map(n => {
        const cls = n.includes('deficit') || n.includes('No path') || n.includes('No explores')
          ? 'cd-reason-error'
          : n.includes('fully explored') || n.includes('Ready')
            ? 'cd-reason-success'
            : 'cd-reason-warning';
        return `<span class="${cls}">${escapeHtml(n)}</span>`;
      }).join('');
      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Notes</div><div class="cd-reason-grid">${noteRows}</div></div>`);
    }

    return sections.join('');
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  _onDestroy() {
    this.subscriptions.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.subscriptions = [];
    log('info', 'CostDebuggerUI destroyed');
  }
}

// =========================================================================
// Helpers
// =========================================================================

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtMana(n) {
  if (n === null || n === undefined) return '?';
  return Number(n).toFixed(1);
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen - 1) + '\u2026' : str;
}

export default CostDebuggerUI;
