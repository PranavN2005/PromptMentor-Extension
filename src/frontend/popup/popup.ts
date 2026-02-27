/**
 * popup script
 *
 * this runs when the user clicks the extension icon in the toolbar
 *
 * key difference from content script:
 * - content script: runs IN the webpage can access pages dom
 * - popup script: runs in separate context can ONLY access popups dom
 *
 * to share data between them we use chrome.storage
 *
 * async/await pattern:
 * all chrome.storage operations are asynchronous (return Promises)
 * we use async/await for cleaner code instead of .then() chains
 */

// StoredStats import lives in the commented-out loadStats() below — uncomment both together when re-enabling stats tracking
// import type { StoredStats } from '../../shared/types';

/**
 * initialize popup when dom is ready
 *
 * DOMContentLoaded fires when html is parsed (before images load)
 * this is the earliest safe time to manipulate the popups dom
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[PromptMentor Popup] Loaded');

  // check if were on chatgpt
  await checkActiveTab();

  // load and display stats (commented out - detection tracking disabled)
  // await loadStats();
});

/**
 * checks if the current tab is chatgpt and updates the status indicator
 *
 * chrome tabs api:
 * - chrome.tabs.query() finds tabs matching criteria
 * - { active: true currentWindow: true } gets the current tab
 * - returns an array so we destructure the first element
 */
async function checkActiveTab(): Promise<void> {
  try {
    // get the currently active tab in the current window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // check if the url matches chatgpt domains
    const url = tab?.url ?? '';
    const isOnChatGPT = url.includes('chatgpt.com') || url.includes('chat.openai.com');

    // get dom elements
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
 * loads statistics from chrome storage and updates the ui
 * COMMENTED OUT: detection tracking disabled
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
 * resets all statistics. COMMENTED OUT: reset button disabled
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

// reset button handler (commented out - detection tracking disabled)
// document.addEventListener('DOMContentLoaded', () => {
//   const resetBtn = document.getElementById('reset-stats');
//   if (resetBtn) resetBtn.addEventListener('click', resetStats);
// });
