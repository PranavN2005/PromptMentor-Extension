/**
 * overlay — Help Request Builder panel ui
 *
 * builds and shows the side panel when we detect executive help-seeking
 * all dom for the panel lives here; content.ts just calls createOverlayPanel
 * and passes callbacks so it can keep overlayVisible in sync
 */

import type { AnalysisResult } from '../../shared/types';

export interface OverlayCallbacks {
  onOpen?: () => void;
  onClose: () => void;
}

/**
 * removes the overlay from the page. call onClose so the owner can update state
 */
export function removeOverlayPanel(callbacks?: OverlayCallbacks): void {
  const existing = document.getElementById('promptmentor-overlay');
  if (existing) {
    existing.remove();
    callbacks?.onClose();
  }
}

/**
 * creates and shows the Help Request Builder panel
 * uses onOpen/onClose so the owner (content.ts) can keep overlayVisible in sync
 */
export function createOverlayPanel(
  analysis: AnalysisResult,
  _originalPrompt: string,
  callbacks: OverlayCallbacks
): void {
  removeOverlayPanel(callbacks);

  const overlay = document.createElement('div');
  overlay.id = 'promptmentor-overlay';
  overlay.className = 'promptmentor-overlay';

  const suggestion =
    analysis.suggestions[0] ?? 'Can you give me a hint about how to approach this problem?';
  const warningMessage =
    analysis.executivePatterns[0]?.message ??
    'This prompt might give you the answer without helping you learn.';

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

  setupOverlayEventListeners(overlay, analysis, suggestion, callbacks);

  document.body.appendChild(overlay);
  callbacks.onOpen?.();

  console.log('[PromptMentor] Overlay displayed for executive help-seeking');
}

function setupOverlayEventListeners(
  overlay: HTMLElement,
  analysis: AnalysisResult,
  suggestion: string,
  callbacks: OverlayCallbacks
): void {
  const close = () => removeOverlayPanel(callbacks);

  const closeBtn = overlay.querySelector('.promptmentor-close');
  if (closeBtn) closeBtn.addEventListener('click', close);

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

  const copyBtn = overlay.querySelector('.promptmentor-btn-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(suggestion);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Suggestion';
        }, 2000);
      } catch (error) {
        console.error('[PromptMentor] Failed to copy:', error);
        copyBtn.textContent = 'Failed to copy';
      }
    });
  }

  const proceedBtn = overlay.querySelector('.promptmentor-btn-proceed');
  if (proceedBtn) proceedBtn.addEventListener('click', close);
}
