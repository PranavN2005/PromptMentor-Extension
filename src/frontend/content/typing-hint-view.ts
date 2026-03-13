import { getComposerElement } from './config';
import { trackTelemetryEvent } from '../../telemetry';

/**
 * removes the current typing hint from the dom if present
 */
export function removeTypingHint(): void {
  const hint = document.getElementById('promptmentor-typing-hint');
  if (hint) {
    hint.remove();
    trackTelemetryEvent('typing_hint_removed', {});
  }
}

/**
 * shows a small yellow hint bar above the composer with the given text
 */
export function showTypingHintText(hintText: string): void {
  removeTypingHint();
  const composer = getComposerElement();
  if (!composer) return;

  // walk up to find a stable container above the form so we insert outside the input
  const form = composer.closest('form');
  const container = form?.parentElement ?? composer.parentElement;
  if (!container) return;

  const hint = document.createElement('div');
  hint.id = 'promptmentor-typing-hint';
  hint.className = 'promptmentor-typing-hint';
  hint.innerHTML = `
    <span class="promptmentor-typing-hint-icon">⚠️</span>
    <span class="promptmentor-typing-hint-text">${hintText.substring(0, 100)}${hintText.length > 100 ? '…' : ''}</span>
  `;
  container.insertBefore(hint, form ?? composer);
  trackTelemetryEvent('typing_hint_displayed', {
    hintLength: hintText.length,
  });
}
