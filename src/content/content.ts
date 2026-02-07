/**
 * PROMPTMENTOR CONTENT SCRIPT
 * ===========================
 * 
 * This TypeScript file is compiled to JavaScript and injected into ChatGPT.
 * 
 * KEY ARCHITECTURE:
 * -----------------
 * 1. MutationObserver watches for DOM changes
 * 2. Lodash debounce prevents excessive processing
 * 3. Pattern detector analyzes user prompts
 * 4. UI overlay shows warnings and suggestions
 * 
 * LODASH DEBOUNCE
 * ---------------
 * We import debounce from lodash-es (ES module version).
 * 
 * Why lodash-es instead of lodash?
 * - lodash: CommonJS, includes entire library (~70KB)
 * - lodash-es: ES modules, tree-shakeable (only what you import ~2KB)
 * 
 * The bundler (esbuild) will include only the debounce code in our output.
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { debounce } from 'lodash-es';
import { analyzePrompt } from './detector';
import type { AppState, DOMSelectors, AnalysisResult } from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * DOM Selectors for ChatGPT's interface.
 * 
 * UPDATED based on your screenshot showing:
 * - Input: div#prompt-textarea.ProseMirror with contenteditable="true"
 * - Text inside: <p> tags
 * 
 * DESIGN CHOICE: Centralized selectors
 * When ChatGPT updates their UI, we only need to change these values.
 */
const SELECTORS: DOMSelectors = {
  // The input area where users type (ProseMirror editor)
  promptInput: '#prompt-textarea, div.ProseMirror[contenteditable="true"]',
  
  // User messages in chat history
  userMessage: 'div[data-message-author-role="user"]',
  
  // AI responses
  assistantMessage: 'div[data-message-author-role="assistant"]',
  
  // Content within messages
  messageContent: '.whitespace-pre-wrap, .markdown',
  
  /**
   * Root node for MutationObserver.
   * 
   * NOTE: learned to use boduy instead of main since GPT's DOM was wrapping this in hella whitespace containers
   */
  conversationContainer: 'body'
};

/**
 * How long to wait after user stops typing before analyzing (in milliseconds).
 * 
 * DESIGN CHOICE: 500ms delay
 * - Too short (100ms): Triggers while still typing
 * - Too long (2000ms): Feels unresponsive
 * - 500ms is a good balance for typing detection
 */
const DEBOUNCE_DELAY_MS = 500;

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Application state - tracks what we've processed to avoid duplicates.
 * 
 * WHY TRACK STATE?
 * MutationObserver fires frequently on small changes.
 * Without state tracking, we'd show the same warning multiple times.
 */
const state: AppState = {
  lastAnalyzedPrompt: '',
  overlayVisible: false,
  processedMessages: new Set<string>()
};

// ============================================================================
// UI CREATION
// ============================================================================

/**
 * Creates the Help Request Builder overlay panel.
 * 
 * DESIGN CHOICE: Creating DOM elements via JavaScript
 * - More secure than innerHTML (no XSS risk with user content)
 * - But we use innerHTML here for template simplicity
 * - In production, you'd use a framework or sanitization
 * 
 * @param analysis - The analysis result from the detector
 * @param originalPrompt - The user's original prompt text
 */
function createOverlayPanel(analysis: AnalysisResult, originalPrompt: string): void {
  // Remove existing overlay if present
  removeOverlayPanel();

  // Create container element
  const overlay = document.createElement('div');
  overlay.id = 'promptmentor-overlay';
  overlay.className = 'promptmentor-overlay';

  // Get first suggestion or default
  const suggestion = analysis.suggestions[0] ?? 'Can you give me a hint about how to approach this problem?';
  const warningMessage = analysis.executivePatterns[0]?.message ?? 
    'This prompt might give you the answer without helping you learn.';

  // Build HTML content
  // Note: In TypeScript, template literals work the same as JavaScript
  overlay.innerHTML = `
    <div class="promptmentor-panel">
      <div class="promptmentor-header">
        <h3>🎓 Help Request Builder</h3>
        <button class="promptmentor-close" aria-label="Close">×</button>
      </div>
      
      <div class="promptmentor-content">
        <div class="promptmentor-warning">
          <strong>⚠️ Potential Executive Help-Seeking Detected</strong>
          <p>${warningMessage}</p>
        </div>
        
        <div class="promptmentor-questions">
          <p><strong>Did you first try to solve this on your own?</strong></p>
          <div class="promptmentor-button-group">
            <button class="promptmentor-btn promptmentor-btn-yes" data-response="yes">Yes, I tried</button>
            <button class="promptmentor-btn promptmentor-btn-no" data-response="no">No, not yet</button>
          </div>
        </div>
        
        <div class="promptmentor-suggestion">
          <p><strong>Try this learning-focused prompt instead:</strong></p>
          <div class="promptmentor-suggested-text">"${suggestion}"</div>
          <button class="promptmentor-btn promptmentor-btn-copy">📋 Copy Suggestion</button>
        </div>
        
        <div class="promptmentor-actions">
          <button class="promptmentor-btn promptmentor-btn-proceed">Show AI Response Anyway</button>
        </div>
      </div>
    </div>
  `;

  // Setup event handlers
  setupOverlayEventListeners(overlay, analysis, suggestion);

  // Add to page
  document.body.appendChild(overlay);
  state.overlayVisible = true;

  // Update stats (commented out - detection tracking disabled)
  // updateStats('executive');

  console.log('[PromptMentor] Overlay displayed for executive help-seeking');
}

/**
 * Sets up click handlers for the overlay buttons.
 * 
 * EVENT LISTENERS EXPLAINED:
 * - addEventListener('click', callback) - runs callback when clicked
 * - The callback receives an Event object with details
 * - We use arrow functions to preserve 'this' context
 * 
 * ASYNC/AWAIT:
 * - navigator.clipboard.writeText returns a Promise
 * - We use async/await to handle it cleanly
 * - try/catch handles potential errors
 */
function setupOverlayEventListeners(
  overlay: HTMLElement, 
  analysis: AnalysisResult,
  suggestion: string
): void {
  // Close button
  const closeBtn = overlay.querySelector('.promptmentor-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      removeOverlayPanel();
    });
  }

  // "Yes, I tried" button
  const yesBtn = overlay.querySelector('.promptmentor-btn-yes');
  if (yesBtn) {
    yesBtn.addEventListener('click', () => {
      const questionsDiv = overlay.querySelector('.promptmentor-questions');
      if (questionsDiv) {
        questionsDiv.innerHTML = `
          <p class="promptmentor-positive">
            ✅ Great! Consider asking for <strong>hints</strong> rather than solutions to maximize your learning.
          </p>
        `;
      }
    });
  }

  // "No, not yet" button
  const noBtn = overlay.querySelector('.promptmentor-btn-no');
  if (noBtn) {
    noBtn.addEventListener('click', () => {
      const questionsDiv = overlay.querySelector('.promptmentor-questions');
      if (questionsDiv) {
        questionsDiv.innerHTML = `
          <p class="promptmentor-encouragement">
            💡 Try spending 5-10 minutes on it first. You'll learn more even if you don't fully solve it!
          </p>
          <p>Then come back and ask for a <strong>hint</strong> rather than a solution.</p>
        `;
      }
    });
  }

  // Copy suggestion button
  const copyBtn = overlay.querySelector('.promptmentor-btn-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        // ASYNC OPERATION: Writing to clipboard
        // This is a Promise-based API - it might fail if permissions denied
        await navigator.clipboard.writeText(suggestion);
        
        // Update button text temporarily
        copyBtn.textContent = '✓ Copied!';
        
        // Reset after 2 seconds
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Suggestion';
        }, 2000);
      } catch (error) {
        console.error('[PromptMentor] Failed to copy:', error);
        copyBtn.textContent = 'Failed to copy';
      }
    });
  }

  // "Show AI Response Anyway" button
  const proceedBtn = overlay.querySelector('.promptmentor-btn-proceed');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      removeOverlayPanel();
    });
  }
}

/**
 * Removes the overlay from the page.
 */
function removeOverlayPanel(): void {
  const existing = document.getElementById('promptmentor-overlay');
  if (existing) {
    existing.remove();
    state.overlayVisible = false;
  }
}

// ============================================================================
// DETECTION LOGIC
// ============================================================================

/**
 * Main detection function - finds and analyzes user prompts.
 * 
 * This is the function we debounce to avoid running on every keystroke.
 */
function checkForExecutiveHelpSeeking(): void {
  // Find all user messages in the chat
  const userMessages = document.querySelectorAll(SELECTORS.userMessage);
  
  if (userMessages.length === 0) {
    return;
  }

  // Get the most recent user message
  const lastMessage = userMessages[userMessages.length - 1];
  const messageContent = lastMessage.querySelector(SELECTORS.messageContent);
  
  if (!messageContent) {
    return;
  }

  // Get text content, trim whitespace
  const promptText = messageContent.textContent?.trim() ?? '';

  // Skip if already analyzed this prompt (prevents duplicate warnings)
  if (promptText === state.lastAnalyzedPrompt) {
    return;
  }

  // Skip very short prompts (likely not complete thoughts)
  if (promptText.length < 15) {
    return;
  }

  // Update state to mark this as analyzed
  state.lastAnalyzedPrompt = promptText;

  console.log('[PromptMentor] Analyzing:', promptText.substring(0, 50) + '...');

  // Run analysis
  const analysis = analyzePrompt(promptText);

  // Only show overlay for executive patterns
  if (analysis.isExecutive && !state.overlayVisible) {
    createOverlayPanel(analysis, promptText);
  } else if (analysis.isAdaptive) {
    console.log('[PromptMentor] Adaptive help-seeking detected - good job!');
    // updateStats('adaptive'); // Detection tracking commented out
  } else {
    console.log('[PromptMentor] No specific pattern detected');
  }
}

/**
 * DEBOUNCED VERSION OF OUR CHECKER
 * 
 * This is where we use Lodash's debounce function.
 * 
 * How it works:
 * 1. Call debouncedCheck() many times rapidly
 * 2. Lodash waits DEBOUNCE_DELAY_MS after the LAST call
 * 3. Then executes checkForExecutiveHelpSeeking() once
 * 
 * Options we could pass to debounce:
 * - { leading: true }  - Execute immediately on first call
 * - { trailing: true } - Execute after delay (default)
 * - { maxWait: 1000 }  - Max time to wait before executing
 */
const debouncedCheck = debounce(checkForExecutiveHelpSeeking, DEBOUNCE_DELAY_MS);

// ============================================================================
// MUTATION OBSERVER
// ============================================================================

/**
 * Initializes the MutationObserver to watch for DOM changes.
 * 
 * WHY MUTATIONOBSERVER?
 * ChatGPT is a Single Page Application (SPA). It loads content dynamically
 * without full page refreshes. Our content script runs once when injected,
 * but new messages appear later via JavaScript.
 * 
 * MutationObserver watches for these dynamic changes and notifies us.
 * 
 * ANALOGY: Like a security camera that alerts you when something moves.
 */
function initMutationObserver(): void {
  // Find the container to observe
  const targetNode = document.querySelector(SELECTORS.conversationContainer);
  
  if (!targetNode) {
    // Container doesn't exist yet - ChatGPT might still be loading
    console.log('[PromptMentor] Waiting for conversation container...');
    // Retry after 1 second
    setTimeout(initMutationObserver, 1000);
    return;
  }

  // Configuration: what types of mutations to observe
  const config: MutationObserverInit = {
    childList: true,      // Watch for added/removed child elements
    subtree: true,        // Watch entire subtree, not just direct children
    characterData: true   // Watch for text content changes
  };

  // Create observer with callback
  const observer = new MutationObserver((mutationsList: MutationRecord[]) => {
    // This fires on EVERY mutation - could be hundreds per second
    // That's why we debounce our actual analysis logic
    debouncedCheck();
  });

  // Start observing
  observer.observe(targetNode, config);
  console.log('[PromptMentor] MutationObserver initialized');
}

// ============================================================================
// CHROME STORAGE
// ============================================================================

/**
 * Updates usage statistics in Chrome storage.
 * COMMENTED OUT: detection count tracking disabled.
 *
 * @param type - 'executive' or 'adaptive'
 */
// async function updateStats(type: 'executive' | 'adaptive'): Promise<void> {
//   try {
//     const result = await chrome.storage.local.get(['promptMentorStats']);
//     const stats: StoredStats = result.promptMentorStats ?? {
//       executiveCount: 0,
//       adaptiveCount: 0,
//       lastSessionDate: new Date().toISOString()
//     };
//     if (type === 'executive') {
//       stats.executiveCount++;
//     } else {
//       stats.adaptiveCount++;
//     }
//     await chrome.storage.local.set({ promptMentorStats: stats });
//     console.log('[PromptMentor] Stats updated:', stats);
//   } catch (error) {
//     console.error('[PromptMentor] Error updating stats:', error);
//   }
// }

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Main entry point - runs when content script loads.
 */
function init(): void {
  console.log('[PromptMentor] Content script loaded on:', window.location.href);
  
  // Start watching for DOM changes
  initMutationObserver();
  
  // Do an initial check (in case there's already content)
  setTimeout(checkForExecutiveHelpSeeking, 1000);
}

/**
 * WHEN TO RUN INIT:
 * 
 * document.readyState can be:
 * - "loading": HTML still being parsed
 * - "interactive": DOM ready, but resources loading
 * - "complete": Everything loaded
 * 
 * Since manifest uses run_at: "document_idle", we're usually at "complete".
 * But we check just to be safe.
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM already ready, run immediately
  init();
}

