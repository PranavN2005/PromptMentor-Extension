/**
 * POPUP SCRIPT
 * ============
 * 
 * This runs when the user clicks the extension icon in the toolbar.
 * 
 * KEY DIFFERENCE FROM CONTENT SCRIPT:
 * - Content script: Runs IN the webpage, can access page's DOM
 * - Popup script: Runs in separate context, can ONLY access popup's DOM
 * 
 * To share data between them, we use chrome.storage.
 * 
 * ASYNC/AWAIT PATTERN:
 * All chrome.storage operations are asynchronous (return Promises).
 * We use async/await for cleaner code instead of .then() chains.
 */

import type { StoredStats } from '../types';

/**
 * Initialize popup when DOM is ready.
 * 
 * DOMContentLoaded fires when HTML is parsed (before images load).
 * This is the earliest safe time to manipulate the popup's DOM.
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[PromptMentor Popup] Loaded');
  
  // Check if we're on ChatGPT
  await checkActiveTab();
  
  // Load and display stats (commented out - detection tracking disabled)
  // await loadStats();
});

/**
 * Checks if the current tab is ChatGPT and updates the status indicator.
 * 
 * CHROME TABS API:
 * - chrome.tabs.query() finds tabs matching criteria
 * - { active: true, currentWindow: true } gets the current tab
 * - Returns an array, so we destructure the first element
 */
async function checkActiveTab(): Promise<void> {
  try {
    // Get the currently active tab in the current window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if the URL matches ChatGPT domains
    const url = tab?.url ?? '';
    const isOnChatGPT = url.includes('chatgpt.com') || url.includes('chat.openai.com');
    
    // Get DOM elements
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.getElementById('status-text');
    const statusSection = document.querySelector('.status-section');
    
    if (statusIndicator && statusText && statusSection) {
      if (isOnChatGPT) {
        statusIndicator.classList.add('active');
        statusIndicator.classList.remove('inactive');
        statusSection.classList.remove('inactive');
        statusText.textContent = 'Active on ChatGPT';
      } else {
        statusIndicator.classList.remove('active');
        statusIndicator.classList.add('inactive');
        statusSection.classList.add('inactive');
        statusText.textContent = 'Not on ChatGPT';
      }
    }
  } catch (error) {
    console.error('[PromptMentor Popup] Error checking tab:', error);
  }
}

/**
 * Loads statistics from Chrome storage and updates the UI.
 * COMMENTED OUT: detection tracking disabled.
 */
// async function loadStats(): Promise<void> {
//   try {
//     const result = await chrome.storage.local.get(['promptMentorStats']);
//     const stats: StoredStats = result.promptMentorStats ?? {
//       executiveCount: 0,
//       adaptiveCount: 0,
//       lastSessionDate: new Date().toISOString()
//     };
//     const executiveEl = document.getElementById('executive-count');
//     const adaptiveEl = document.getElementById('adaptive-count');
//     if (executiveEl) executiveEl.textContent = stats.executiveCount.toString();
//     if (adaptiveEl) adaptiveEl.textContent = stats.adaptiveCount.toString();
//     const lastSessionEl = document.getElementById('last-session');
//     if (lastSessionEl && stats.lastSessionDate) {
//       lastSessionEl.textContent = new Date(stats.lastSessionDate).toLocaleDateString();
//     }
//   } catch (error) {
//     console.error('[PromptMentor Popup] Error loading stats:', error);
//   }
// }

/**
 * Resets all statistics. COMMENTED OUT: reset button disabled.
 */
// async function resetStats(): Promise<void> {
//   try {
//     const freshStats: StoredStats = {
//       executiveCount: 0,
//       adaptiveCount: 0,
//       lastSessionDate: new Date().toISOString()
//     };
//     await chrome.storage.local.set({ promptMentorStats: freshStats });
//     await loadStats();
//     console.log('[PromptMentor Popup] Stats reset');
//   } catch (error) {
//     console.error('[PromptMentor Popup] Error resetting stats:', error);
//   }
// }

// Reset button handler (commented out - detection tracking disabled)
// document.addEventListener('DOMContentLoaded', () => {
//   const resetBtn = document.getElementById('reset-stats');
//   if (resetBtn) resetBtn.addEventListener('click', resetStats);
// });

