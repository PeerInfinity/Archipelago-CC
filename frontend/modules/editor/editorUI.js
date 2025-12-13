/**
 * Editor UI - Textarea Implementation
 *
 * Provides a simple textarea-based editor UI.
 * Data management is handled by EditorDataService from editorCore module.
 */

import eventBus from '../../app/core/eventBus.js';
import { editorDataService, EDITOR_EVENTS } from '../editorCore/index.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('editorUI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[editorUI] ${message}`, ...data);
  }
}

class EditorUI {
  constructor(container, componentState) {
    log('info', 'EditorUI instance created with Textarea');
    this.container = container;
    this.componentState = componentState;

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('editor-panel-content');
    this.rootElement.style.width = '100%';
    this.rootElement.style.height = '100%';
    this.rootElement.style.display = 'flex';
    this.rootElement.style.flexDirection = 'column';

    this.textAreaElement = null;
    this.isInitialized = false;
    this.editorDropdown = null;
    this.autoUpdateCheckbox = null;
    this.updateNowButton = null;
    this.unsubscribeContentChanged = null;

    this._handleTextAreaInput = this._handleTextAreaInput.bind(this);

    this.container.element.appendChild(this.rootElement);

    // Defer full initialization until app is ready
    const readyHandler = () => {
      log('info', '[EditorUI] Received app:readyForUiDataLoad. Initializing editor.');
      this.initialize();
      eventBus.unsubscribe(EDITOR_EVENTS.APP_READY, readyHandler);
    };
    eventBus.subscribe(EDITOR_EVENTS.APP_READY, readyHandler, 'editor');

    this.container.on('destroy', () => {
      this.onPanelDestroy();
    });
  }

  getRootElement() {
    return this.rootElement;
  }

  initialize() {
    if (!this.isInitialized) {
      log('info', 'Initializing EditorUI (Textarea)...');
      this.initializeEditor();

      // Subscribe to data service content changes
      this.unsubscribeContentChanged = editorDataService.onContentChanged(
        (content, sourceKey) => {
          log('info', `[EditorUI] Content changed for source: ${sourceKey}`);
          this._displayCurrentSourceContent();

          // Update dropdown if source changed
          if (this.editorDropdown && this.editorDropdown.value !== sourceKey) {
            this.editorDropdown.value = sourceKey;
          }
        }
      );

      this.isInitialized = true;
    } else {
      log('info', 'EditorUI (Textarea) already initialized.');
      if (this.textAreaElement) {
        this._displayCurrentSourceContent();
      }
    }
  }

  _handleTextAreaInput(event) {
    // Update the data service with the new text
    editorDataService.updateCurrentContent(event.target.value);
  }

  initializeEditor() {
    if (this.textAreaElement) {
      log('info', 'Editor already initialized. Destroying previous instance components.');
      this.destroyEditor();
    }
    log('info', 'Creating editor chrome and <textarea> element...');

    // Create controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'editor-controls';
    controlsDiv.style.padding = '5px';
    controlsDiv.style.backgroundColor = '#222';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.alignItems = 'center';
    controlsDiv.style.gap = '10px';

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
    this.editorDropdown.addEventListener('change', this._handleSourceChange.bind(this));
    controlsDiv.appendChild(this.editorDropdown);

    // Create auto-update checkbox and label
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.alignItems = 'center';
    checkboxContainer.style.gap = '5px';

    this.autoUpdateCheckbox = document.createElement('input');
    this.autoUpdateCheckbox.type = 'checkbox';
    this.autoUpdateCheckbox.id = 'editor-auto-update';
    this.autoUpdateCheckbox.checked = editorDataService.getAutoUpdateEnabled();
    this.autoUpdateCheckbox.addEventListener('change', this._handleAutoUpdateChange.bind(this));

    const checkboxLabel = document.createElement('label');
    checkboxLabel.htmlFor = 'editor-auto-update';
    checkboxLabel.textContent = 'Auto-update';
    checkboxLabel.style.color = '#ccc';
    checkboxLabel.style.cursor = 'pointer';
    checkboxLabel.style.userSelect = 'none';

    checkboxContainer.appendChild(this.autoUpdateCheckbox);
    checkboxContainer.appendChild(checkboxLabel);
    controlsDiv.appendChild(checkboxContainer);

    // Create Update Now button
    this.updateNowButton = document.createElement('button');
    this.updateNowButton.textContent = 'Update Now';
    this.updateNowButton.style.padding = '2px 8px';
    this.updateNowButton.style.backgroundColor = '#444';
    this.updateNowButton.style.color = '#ccc';
    this.updateNowButton.style.border = '1px solid #666';
    this.updateNowButton.style.borderRadius = '3px';
    this.updateNowButton.style.cursor = 'pointer';
    this.updateNowButton.addEventListener('click', this._handleUpdateNowClick.bind(this));

    this.updateNowButton.addEventListener('mouseenter', () => {
      this.updateNowButton.style.backgroundColor = '#555';
    });
    this.updateNowButton.addEventListener('mouseleave', () => {
      this.updateNowButton.style.backgroundColor = '#444';
    });

    controlsDiv.appendChild(this.updateNowButton);
    this.rootElement.appendChild(controlsDiv);

    try {
      this.textAreaElement = document.createElement('textarea');
      this.textAreaElement.style.width = '100%';
      this.textAreaElement.style.height = 'calc(100% - 40px)';
      this.textAreaElement.style.border = 'none';
      this.textAreaElement.style.resize = 'none';
      this.textAreaElement.style.backgroundColor = '#000000';
      this.textAreaElement.style.color = '#FFFFFF';
      this.textAreaElement.classList.add('editor-textarea');
      this.textAreaElement.addEventListener('input', this._handleTextAreaInput);
      this.rootElement.appendChild(this.textAreaElement);

      this._displayCurrentSourceContent();

      log('info', 'Editor components created and attached successfully.');
    } catch (error) {
      log('error', 'Failed to initialize Textarea:', error);
      this.rootElement.textContent = 'Error loading Textarea.';
      this.textAreaElement = null;
    }
  }

  _handleSourceChange() {
    const newSourceKey = this.editorDropdown.value;
    editorDataService.setCurrentSourceKey(newSourceKey);
  }

  _handleAutoUpdateChange() {
    editorDataService.setAutoUpdateEnabled(this.autoUpdateCheckbox.checked);
  }

  async _handleUpdateNowClick() {
    log('info', '[EditorUI] Update Now button clicked');
    await editorDataService.updateNow();
  }

  _displayCurrentSourceContent() {
    if (!this.textAreaElement) {
      return;
    }

    const content = editorDataService.getContent();
    const currentSourceKey = editorDataService.getCurrentSourceKey();

    log('info', `[EditorUI] Displaying content for source: ${currentSourceKey}`);

    if (!content.loaded) {
      this.textAreaElement.value = 'Loading...';
      return;
    }

    try {
      // For mode data, add data sources information at the top
      if (currentSourceKey === 'localStorageMode' && content.text) {
        try {
          const data = JSON.parse(content.text);
          if (data.dataSources) {
            const sourcesInfo = Object.entries(data.dataSources)
              .map(([key, info]) => `${key}: ${info.source} (${info.details})`)
              .join('\n');

            const formattedJson = JSON.stringify(data, null, 2);
            this.textAreaElement.value = `// Data Sources:\n${sourcesInfo}\n\n${formattedJson}`;
            return;
          }
        } catch (e) {
          // If parsing fails, just display as-is
        }
      }

      this.textAreaElement.value = content.text;
    } catch (e) {
      log('error', '[EditorUI] Error displaying content:', e);
      this.textAreaElement.value = 'Error displaying content';
    }
  }

  onPanelResize(width, height) {
    log('info', `EditorUI (Textarea) resized to ${width}x${height}`);
  }

  destroyEditor() {
    if (this.textAreaElement) {
      log('info', 'Destroying <textarea> instance.');
      this.textAreaElement.removeEventListener('input', this._handleTextAreaInput);
      if (this.textAreaElement.parentNode === this.rootElement) {
        this.rootElement.removeChild(this.textAreaElement);
      }
      this.textAreaElement = null;
    }

    if (this.editorDropdown) {
      const controlsDiv = this.rootElement.querySelector('.editor-controls');
      if (controlsDiv && controlsDiv.parentNode === this.rootElement) {
        this.rootElement.removeChild(controlsDiv);
      }
      this.editorDropdown = null;
    }

    this.autoUpdateCheckbox = null;
    this.updateNowButton = null;
  }

  onPanelDestroy() {
    log('info', 'EditorUI (Textarea) destroyed');
    this.destroyEditor();

    // Unsubscribe from data service
    if (this.unsubscribeContentChanged) {
      this.unsubscribeContentChanged();
      this.unsubscribeContentChanged = null;
    }

    this.isInitialized = false;
  }

  dispose() {
    log('info', 'Disposing EditorUI (Textarea)...');
    this.onPanelDestroy();
  }

  // --- Legacy methods for backward compatibility ---

  loadJsonData(jsonData) {
    log('warn', '[EditorUI] loadJsonData is deprecated. Use editorDataService directly.');
    if (jsonData === null || typeof jsonData === 'undefined') {
      editorDataService.setContent('rules', '');
    } else {
      try {
        const text = JSON.stringify(jsonData, null, 2);
        editorDataService.setContent('rules', text);
      } catch (error) {
        editorDataService.setContent('rules', String(jsonData));
      }
    }
  }

  setContent(newContent) {
    log('warn', '[EditorUI] setContent is deprecated. Use editorDataService directly.');
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

  getContent() {
    // Sync textarea value to data service before returning
    if (this.textAreaElement) {
      editorDataService.updateCurrentContent(this.textAreaElement.value);
    }
    return editorDataService.getContent();
  }
}

export default EditorUI;
