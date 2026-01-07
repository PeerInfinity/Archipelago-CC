/**
 * CodeMirror 6 Editor UI
 *
 * Provides a CodeMirror 6 based editor UI with JSON support and folding.
 * Data management is handled by EditorDataService from editorCore module.
 */

import eventBus from '../../app/core/eventBus.js';
import { editorDataService, EDITOR_EVENTS } from '../editorCore/index.js';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  EditorState,
  Compartment,
  json,
  foldGutter,
  foldKeymap,
  foldAll,
  unfoldAll,
  basicSetup,
  oneDark,
  defaultKeymap,
  history,
  historyKeymap,
  searchKeymap,
  highlightSelectionMatches,
} from './codemirror6Imports.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('codeMirror6UI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[codeMirror6UI] ${message}`, ...data);
  }
}

// Configuration compartments for dynamic reconfiguration
const readOnlyCompartment = new Compartment();
const themeCompartment = new Compartment();

class CodeMirror6UI {
  constructor(container, componentState) {
    log('info', 'CodeMirror6UI instance created');
    this.container = container;
    this.componentState = componentState;

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('editor-panel-content', 'codemirror6-editor');
    this.rootElement.style.width = '100%';
    this.rootElement.style.height = '100%';
    this.rootElement.style.display = 'flex';
    this.rootElement.style.flexDirection = 'column';

    this.editorContainer = null;
    this.editorView = null;
    this.isInitialized = false;
    this.editorDropdown = null;
    this.autoUpdateCheckbox = null;
    this.updateNowButton = null;
    this.applyButton = null;
    this.foldAllButton = null;
    this.unfoldAllButton = null;
    this.unsubscribeContentChanged = null;
    this.isUpdatingFromService = false;

    this._handleApplyClick = this._handleApplyClick.bind(this);

    this.container.element.appendChild(this.rootElement);

    // Defer full initialization until app is ready
    const readyHandler = () => {
      log('info', '[CodeMirror6UI] Received app:readyForUiDataLoad. Initializing editor.');
      this.initialize();
      eventBus.unsubscribe(EDITOR_EVENTS.APP_READY, readyHandler);
    };
    eventBus.subscribe(EDITOR_EVENTS.APP_READY, readyHandler, 'editorCM6');

    this.container.on('destroy', () => {
      this.onPanelDestroy();
    });
  }

  getRootElement() {
    return this.rootElement;
  }

  initialize() {
    if (this.isInitialized) {
      log('info', 'CodeMirror6UI already initialized.');
      return;
    }

    log('info', 'Initializing CodeMirror6UI...');
    this._createControls();
    this._createEditor();

    // Subscribe to data service content changes
    this.unsubscribeContentChanged = editorDataService.onContentChanged(
      (content, sourceKey) => {
        log('info', `[CodeMirror6UI] Content changed for source: ${sourceKey}`);
        this._displayCurrentSourceContent();

        // Update dropdown if source changed
        if (this.editorDropdown && this.editorDropdown.value !== sourceKey) {
          this.editorDropdown.value = sourceKey;
        }

        // Update Apply button visibility when source changes
        this._updateApplyButtonVisibility();
      }
    );

    this.isInitialized = true;
    log('info', 'CodeMirror6UI initialized successfully');
  }

  _createControls() {
    // Create controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'editor-controls';
    controlsDiv.style.padding = '5px';
    controlsDiv.style.backgroundColor = '#222';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.alignItems = 'center';
    controlsDiv.style.gap = '10px';
    controlsDiv.style.flexWrap = 'wrap';

    // Create dropdown from data service content sources
    this.editorDropdown = document.createElement('select');
    const contentSources = editorDataService.getContentSources();
    for (const key in contentSources) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = contentSources[key].name;
      this.editorDropdown.appendChild(option);
    }
    this.editorDropdown.value = editorDataService.getCurrentSourceKey();
    this.editorDropdown.addEventListener('change', () => {
      editorDataService.setCurrentSourceKey(this.editorDropdown.value);
    });
    controlsDiv.appendChild(this.editorDropdown);

    // Create auto-update checkbox and label
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.alignItems = 'center';
    checkboxContainer.style.gap = '5px';

    this.autoUpdateCheckbox = document.createElement('input');
    this.autoUpdateCheckbox.type = 'checkbox';
    this.autoUpdateCheckbox.id = 'editor-cm6-auto-update';
    this.autoUpdateCheckbox.checked = editorDataService.getAutoUpdateEnabled();
    this.autoUpdateCheckbox.addEventListener('change', () => {
      editorDataService.setAutoUpdateEnabled(this.autoUpdateCheckbox.checked);
    });

    const checkboxLabel = document.createElement('label');
    checkboxLabel.htmlFor = 'editor-cm6-auto-update';
    checkboxLabel.textContent = 'Auto-update';
    checkboxLabel.style.color = '#ccc';
    checkboxLabel.style.cursor = 'pointer';
    checkboxLabel.style.userSelect = 'none';

    checkboxContainer.appendChild(this.autoUpdateCheckbox);
    checkboxContainer.appendChild(checkboxLabel);
    controlsDiv.appendChild(checkboxContainer);

    // Create Update Now button
    this.updateNowButton = this._createButton('Update Now', async () => {
      log('info', '[CodeMirror6UI] Update Now button clicked');
      await editorDataService.updateNow();
    });
    controlsDiv.appendChild(this.updateNowButton);

    // Create Apply button (only visible for 'rules' source)
    this.applyButton = this._createButton('Apply', this._handleApplyClick);
    this.applyButton.title = 'Apply edited rules (Ctrl+Enter)';
    controlsDiv.appendChild(this.applyButton);

    // Update Apply button visibility based on current source
    this._updateApplyButtonVisibility();

    // Create Fold All button
    this.foldAllButton = this._createButton('Fold All', () => {
      if (this.editorView) {
        foldAll(this.editorView);
      }
    });
    controlsDiv.appendChild(this.foldAllButton);

    // Create Unfold All button
    this.unfoldAllButton = this._createButton('Unfold All', () => {
      if (this.editorView) {
        unfoldAll(this.editorView);
      }
    });
    controlsDiv.appendChild(this.unfoldAllButton);

    this.rootElement.appendChild(controlsDiv);
  }

  _createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.padding = '2px 8px';
    button.style.backgroundColor = '#444';
    button.style.color = '#ccc';
    button.style.border = '1px solid #666';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#555';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#444';
    });
    return button;
  }

  _createEditor() {
    // Create editor container
    this.editorContainer = document.createElement('div');
    this.editorContainer.className = 'codemirror6-container';
    this.editorContainer.style.flex = '1';
    this.editorContainer.style.overflow = 'hidden';
    this.editorContainer.style.minHeight = '0';
    this.rootElement.appendChild(this.editorContainer);

    // Get initial content
    const content = editorDataService.getContent();
    const initialDoc = content.loaded ? content.text : '';

    // Create CodeMirror 6 editor
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !this.isUpdatingFromService) {
        // Sync changes back to data service
        const newText = update.state.doc.toString();
        editorDataService.updateCurrentContent(newText);
      }
    });

    // Custom keymap for Apply (Ctrl+Enter)
    const applyKeymap = keymap.of([
      {
        key: 'Ctrl-Enter',
        run: () => {
          const currentSourceKey = editorDataService.getCurrentSourceKey();
          if (currentSourceKey === 'rules') {
            log('info', '[CodeMirror6UI] Ctrl+Enter shortcut detected, applying rules...');
            this._handleApplyClick();
            return true;
          }
          return false;
        },
      },
    ]);

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      foldGutter(),
      json(),
      oneDark,
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
      ]),
      applyKeymap,
      highlightSelectionMatches(),
      updateListener,
      EditorView.lineWrapping,
      // Make editor fill container
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ];

    this.editorView = new EditorView({
      state: EditorState.create({
        doc: initialDoc,
        extensions,
      }),
      parent: this.editorContainer,
    });

    log('info', 'CodeMirror 6 editor created');
  }

  _displayCurrentSourceContent() {
    if (!this.editorView) {
      return;
    }

    const content = editorDataService.getContent();
    const currentSourceKey = editorDataService.getCurrentSourceKey();

    log('info', `[CodeMirror6UI] Displaying content for source: ${currentSourceKey}`);

    if (!content.loaded) {
      this._setEditorContent('Loading...');
      return;
    }

    // For mode data, add data sources information at the top
    let displayText = content.text;
    if (currentSourceKey === 'localStorageMode' && content.text) {
      try {
        const data = JSON.parse(content.text);
        if (data.dataSources) {
          const sourcesInfo = Object.entries(data.dataSources)
            .map(([key, info]) => `${key}: ${info.source} (${info.details})`)
            .join('\n');
          const formattedJson = JSON.stringify(data, null, 2);
          displayText = `// Data Sources:\n${sourcesInfo}\n\n${formattedJson}`;
        }
      } catch (e) {
        // If parsing fails, just display as-is
      }
    }

    this._setEditorContent(displayText);
  }

  _setEditorContent(text) {
    if (!this.editorView) return;

    this.isUpdatingFromService = true;
    try {
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: this.editorView.state.doc.length,
          insert: text,
        },
      });
    } finally {
      this.isUpdatingFromService = false;
    }
  }

  async _handleApplyClick() {
    if (!this.editorView || !this.applyButton) return;

    const currentSourceKey = editorDataService.getCurrentSourceKey();
    if (currentSourceKey !== 'rules') {
      log('warn', '[CodeMirror6UI] Apply clicked but not on rules source');
      return;
    }

    try {
      const jsonText = this.editorView.state.doc.toString();
      const rulesData = JSON.parse(jsonText);

      log('info', '[CodeMirror6UI] Applying edited rules...');

      // Publish the files:jsonLoaded event to trigger rules loading
      eventBus.publish('files:jsonLoaded', {
        jsonData: rulesData,
        selectedPlayerId: '1',
        sourceName: 'editorApply'
      }, 'editorCM6');

      // Visual feedback - success
      const originalText = this.applyButton.textContent;
      const originalBg = this.applyButton.style.backgroundColor;
      this.applyButton.textContent = 'Applied!';
      this.applyButton.style.backgroundColor = '#4CAF50';

      setTimeout(() => {
        if (this.applyButton) {
          this.applyButton.textContent = originalText;
          this.applyButton.style.backgroundColor = originalBg;
        }
      }, 1000);

      log('info', '[CodeMirror6UI] Rules applied successfully');
    } catch (error) {
      log('error', '[CodeMirror6UI] Error applying rules:', error);

      // Visual feedback - error
      const originalText = this.applyButton.textContent;
      const originalBg = this.applyButton.style.backgroundColor;
      this.applyButton.textContent = 'Error!';
      this.applyButton.style.backgroundColor = '#f44336';

      setTimeout(() => {
        if (this.applyButton) {
          this.applyButton.textContent = originalText;
          this.applyButton.style.backgroundColor = originalBg;
        }
      }, 2000);

      alert(`Error applying rules: ${error.message}`);
    }
  }

  _updateApplyButtonVisibility() {
    if (!this.applyButton) return;

    const currentSourceKey = editorDataService.getCurrentSourceKey();
    this.applyButton.style.display = currentSourceKey === 'rules' ? 'inline-block' : 'none';
  }

  onPanelResize(width, height) {
    log('info', `CodeMirror6UI resized to ${width}x${height}`);
    // CodeMirror 6 handles resize automatically with proper CSS
  }

  onPanelDestroy() {
    log('info', 'CodeMirror6UI destroyed');

    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }

    if (this.unsubscribeContentChanged) {
      this.unsubscribeContentChanged();
      this.unsubscribeContentChanged = null;
    }

    // Clear controls
    this.editorDropdown = null;
    this.autoUpdateCheckbox = null;
    this.updateNowButton = null;
    this.applyButton = null;
    this.foldAllButton = null;
    this.unfoldAllButton = null;
    this.editorContainer = null;

    this.isInitialized = false;
  }

  dispose() {
    log('info', 'Disposing CodeMirror6UI...');
    this.onPanelDestroy();
  }

  // --- Legacy methods for backward compatibility ---

  getContent() {
    if (this.editorView) {
      const text = this.editorView.state.doc.toString();
      editorDataService.updateCurrentContent(text);
    }
    return editorDataService.getContent();
  }

  setContent(newContent) {
    log('warn', '[CodeMirror6UI] setContent is deprecated. Use editorDataService directly.');
    let textToSet = '';
    if (newContent && typeof newContent.text === 'string') {
      textToSet = newContent.text;
    } else if (newContent && typeof newContent.json !== 'undefined') {
      try {
        textToSet = JSON.stringify(newContent.json, null, 2);
      } catch (error) {
        textToSet = '[Error displaying JSON]';
      }
    } else if (newContent) {
      textToSet = String(newContent);
    }

    const currentSourceKey = editorDataService.getCurrentSourceKey();
    editorDataService.setContent(currentSourceKey, textToSet);
  }
}

export default CodeMirror6UI;
