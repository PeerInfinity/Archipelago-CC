import // REMOVE createJSONEditor, expandAll imports
'../../libs/vanilla-jsoneditor/standalone.js';
// Enable Dark theme CSS - REMOVED Import, will be loaded via <link> tag in HTML
// import '../../libs/vanilla-jsoneditor/themes/jse-theme-dark.css';

// --- ADD CodeMirror Imports ---
// Import Core CodeMirror FIRST
import '../../libs/codemirror/codemirror.min.js';
// Then import the mode (it attaches itself to the CodeMirror object)
// Note: Assumes codemirror.min.css and theme CSS are loaded globally via <link>
import '../../libs/codemirror/javascript.min.js'; // Import the JS mode (needed for JSON)
// --- END ADD ---

import eventBus from '../../app/core/eventBus.js'; // <<< Import eventBus
// REMOVE Import the function to get pending data
// import { getPendingJsonDataAndClear } from './index.js';
// Import the function to set the module instance
import { setEditorInstance } from './index.js';

class EditorUI {
  constructor() {
    console.log('EditorUI instance created');
    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('editor-panel-content'); // Add a class for styling if needed
    // Ensure container has explicit height, crucial for CodeMirror's 100% height
    this.rootElement.style.width = '100%'; // Ensure it fills container width
    this.rootElement.style.height = '100%'; // Ensure it fills container height
    this.rootElement.style.overflow = 'hidden'; // Prevent container scrollbars if CM spills
    this.editor = null; // Will hold the CodeMirror instance
    this.isInitialized = false; // Track initialization state
    this.unsubscribeHandle = null; // Store unsubscribe function
    // Flag to ensure initial refresh happens only once on first show
    this.hasRefreshedOnce = false;

    // Initial content - Storing as text now
    this.content = {
      // Start with empty text or some default placeholder
      text: '{\n  "greeting": "Hello World",\n  "value": 123\n}',
    };

    // Register this instance with the module logic
    setEditorInstance(this);
  }

  getRootElement() {
    return this.rootElement;
  }

  // Called when the panel is first opened or shown
  initialize() {
    if (!this.isInitialized) {
      console.log('Initializing EditorUI with CodeMirror...');
      this.initializeEditor(); // Creates this.editor
      this.subscribeToEvents(); // Subscribe to events on first init
      this.isInitialized = true;
      // Explicitly refresh *after* initialization, assuming the container might be sized now
      if (this.editor) {
        // Delay slightly to ensure DOM is ready after initialization sequence
        console.log(
          '[EditorUI Initialize] CodeMirror instance created, will refresh on show.'
        );
      }
    } else {
      console.log('EditorUI already initialized (panel reshown).');
      // Refresh CodeMirror instance if it exists when panel is reshown
      if (this.editor) {
        console.log(
          '[EditorUI Initialize] Refreshing CodeMirror on panel reshow.'
        );
        // Ensure content is up-to-date first. setContent calls refresh.
        this.setContent(this.content);
      }
    }
  }

  // Subscribe to relevant EventBus events
  subscribeToEvents() {
    if (this.unsubscribeHandle) {
      console.warn(
        'EditorUI already subscribed to events. Unsubscribing previous first.'
      );
      this.unsubscribeHandle();
    }
    console.log("EditorUI subscribing to 'editor:loadJsonData'");
    this.unsubscribeHandle = eventBus.subscribe(
      'editor:loadJsonData',
      (payload) => {
        if (!payload || !payload.data) {
          console.warn(
            "EditorUI received invalid payload for 'editor:loadJsonData'",
            payload
          );
          return;
        }
        console.log(
          `EditorUI received data from: ${payload.source || 'unknown'}`
        );
        // Data is expected to be JSON, stringify it for CodeMirror
        try {
          const textData = JSON.stringify(payload.data, null, 2); // Pretty print JSON
          this.setContent({ text: textData });
        } catch (error) {
          console.error(
            'Error stringifying received JSON data:',
            error,
            payload.data
          );
          // Fallback: display raw data as text if stringify fails
          this.setContent({ text: String(payload.data) });
        }
      }
    );
  }

  // Unsubscribe from EventBus events
  unsubscribeFromEvents() {
    if (this.unsubscribeHandle) {
      console.log('EditorUI unsubscribing from events.');
      this.unsubscribeHandle();
      this.unsubscribeHandle = null;
    }
  }

  initializeEditor() {
    if (this.editor) {
      console.log(
        'CodeMirror editor already exists. Destroying previous instance.'
      );
      this.destroyEditor(); // Clean up existing editor if any
    }
    console.log('Creating CodeMirror instance...');
    try {
      // Ensure the target element is empty before initializing
      while (this.rootElement.firstChild) {
        this.rootElement.removeChild(this.rootElement.firstChild);
      }

      // Ensure CodeMirror library is loaded globally (check console if errors occur)
      if (typeof CodeMirror === 'undefined') {
        console.error(
          'CodeMirror global object not found. Ensure codemirror.min.js is loaded.'
        );
        this.rootElement.textContent = 'Error: CodeMirror library not loaded.';
        return;
      }

      this.editor = CodeMirror(this.rootElement, {
        // Use CodeMirror constructor
        value: this.content.text || '', // Initial text content
        mode: { name: 'javascript', json: true }, // Use JS mode for JSON syntax highlighting
        theme: 'material-darker', // Apply the dark theme
        lineNumbers: true,
        // Add other CodeMirror options as needed
      });

      // Listen for changes in CodeMirror and update internal state
      this.editor.on('change', (instance) => {
        this.content = { text: instance.getValue() };
        // console.log('Editor content changed:', this.content.text); // Can be noisy
        // You might want to dispatch an event or update state elsewhere
      });

      console.log('CodeMirror instance created successfully.');
    } catch (error) {
      console.error('Failed to initialize CodeMirror:', error);
      // Display error in the panel
      this.rootElement.textContent =
        'Error loading CodeMirror Editor. Check console. Is CodeMirror library loaded?';
      // Fallback or error state
      this.editor = null; // Ensure editor is null on failure
    }
  }

  // Called when the panel container is resized
  onPanelResize(width, height) {
    console.log(
      `EditorUI resized to ${width}x${height}. Refreshing CodeMirror.`
    );
    // Remove direct style manipulation, let GoldenLayout/CSS handle the container size.
    // this.rootElement.style.width = `${width}px`;
    // this.rootElement.style.height = `${height}px`;
    if (this.editor) {
      // Tell CodeMirror its container might have resized. Setting size to null lets it adapt.
      // REVERTED: Let CSS/container drive the size. Just refresh.
      this.editor.refresh(); // Refresh to redraw correctly within the new container size
    }
  }

  destroyEditor() {
    // CodeMirror doesn't have a dedicated destroy method.
    // We need to remove its DOM element and clear the reference.
    if (this.editor) {
      console.log('Destroying CodeMirror instance.');
      const editorWrapper = this.editor.getWrapperElement();
      if (editorWrapper && editorWrapper.parentNode) {
        editorWrapper.parentNode.removeChild(editorWrapper);
      }
      this.editor = null;
    }
    // Also clear the root element just in case
    while (this.rootElement.firstChild) {
      this.rootElement.removeChild(this.rootElement.firstChild);
    }
  }

  // Called when the panel is about to be destroyed by Golden Layout
  onPanelDestroy() {
    console.log('EditorUI destroyed');
    this.destroyEditor();
    this.unsubscribeFromEvents(); // <<< Unsubscribe on destroy
    this.isInitialized = false;
  }

  // Optional: General cleanup method
  dispose() {
    console.log('Disposing EditorUI...');
    this.onPanelDestroy(); // Call destroy logic
    // Any other cleanup specific to EditorUI itself
  }

  // Method to load JSON data into the editor
  loadJsonData(jsonData) {
    if (jsonData === null || typeof jsonData === 'undefined') {
      console.warn(
        '[EditorUI] loadJsonData called with null or undefined data.'
      );
      // Optionally set empty content or keep existing
      // this.setContent({ text: '' });
      return;
    }
    console.log('[EditorUI] Loading JSON data into editor...');
    try {
      // Stringify the JSON data with pretty printing (2 spaces)
      const textData = JSON.stringify(jsonData, null, 2);
      this.setContent({ text: textData });
    } catch (error) {
      console.error(
        'Error stringifying JSON data for editor:',
        error,
        jsonData
      );
      // Fallback: Display raw data as string if stringify fails
      this.setContent({ text: String(jsonData) });
    }
  }

  // --- Methods to interact with the editor ---
  setContent(newContent) {
    // Expect newContent to be in { text: "..." } format
    if (!newContent || typeof newContent.text === 'undefined') {
      console.warn(
        '[EditorUI] setContent called with invalid format:',
        newContent
      );
      // Decide on fallback: clear editor, keep existing, or throw error
      // For now, let's clear it if invalid content is provided
      this.content = { text: '' };
    } else {
      this.content = { text: String(newContent.text) }; // Ensure it's a string
    }

    if (this.editor) {
      const oldScrollInfo = this.editor.getScrollInfo(); // Preserve scroll position
      console.log('Setting CodeMirror editor content.');
      // CodeMirror expects a string value
      this.editor.setValue(this.content.text);
      // Moving cursor might not be desired on every setContent
      // this.editor.setCursor({ line: 0, ch: 0 });
      this.editor.refresh(); // Refresh to ensure rendering updates
      this.editor.scrollTo(oldScrollInfo.left, oldScrollInfo.top); // Restore scroll position
    } else {
      console.log(
        'CodeMirror editor not initialized yet. Content will be set on initialization.'
      );
    }
  }

  getContent() {
    if (this.editor) {
      // Return content in the { text: "..." } format
      return { text: this.editor.getValue() };
    }
    // Return stored content if editor isn't ready
    return this.content;
  }

  // --- ADDED: Called when the panel becomes visible ---
  onPanelShow() {
    console.log('[EditorUI] Panel shown.');
    if (this.editor && !this.hasRefreshedOnce) {
      console.log(
        '[EditorUI] Performing initial CodeMirror refresh on first show.'
      );
      // Use a minimal timeout JUST IN CASE the 'show' event fires slightly too early
      setTimeout(() => {
        if (this.editor) {
          // Check again in case destroyed during timeout
          this.editor.refresh();
          this.hasRefreshedOnce = true; // Mark as done
        }
      }, 0);
    } else if (this.editor) {
      console.log(
        '[EditorUI] Panel shown again, ensuring editor is refreshed.'
      );
      // Refresh again on subsequent shows if needed, e.g., if content changed while hidden
      this.editor.refresh();
    }
  }
}

export default EditorUI;
