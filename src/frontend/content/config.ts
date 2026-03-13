/**
 * config — selectors and constants for the content script
 *
 * all the chatgpt dom selectors and timing constants live here
 * when chatgpt changes their ui you only touch this file (and maybe
 * add a fallback selector). keeps the rest of the content script
 * selector-agnostic
 */

import type { DOMSelectors } from './types';

/** dom selectors for chatgpts interface(s) */
export const SELECTORS: DOMSelectors = {
  promptInput: '#prompt-textarea, div.ProseMirror[contenteditable="true"]',
  userMessage: 'div[data-message-author-role="user"]',
  assistantMessage: 'div[data-message-author-role="assistant"]',
  messageContent: '.whitespace-pre-wrap, .markdown',
  conversationContainer: 'body',
};

/** how long to wait after user stops typing before analyzing (ms) */
export const DEBOUNCE_DELAY_MS = 1000;

/**
 * composer: the input area where the user types (before sending)
 *
 * chatgpt currently renders BOTH a hidden <textarea> and the real
 * <div id="prompt-textarea" class="ProseMirror" contenteditable="true">
 * we always target the div so we never attach to the wrong element
 */
export const COMPOSER_SELECTOR =
  'div#prompt-textarea.ProseMirror[contenteditable="true"], [class*="prosemirror-parent"]';

/**
 * returns the composer element we should observe and read text from
 * tries the real editable div first so we never grab the hidden textarea
 */
export function getComposerElement(): Element | null {
  const primary = document.querySelector('div#prompt-textarea.ProseMirror[contenteditable="true"]');
  if (primary) {
    return primary;
  }

  const parent = document.querySelector('[class*="prosemirror-parent"]');
  if (parent) {
    return parent;
  }

  const editable = document.querySelector('div.ProseMirror[contenteditable="true"]');
  if (editable) {
    return editable;
  }

  const fallback = document.querySelector(COMPOSER_SELECTOR);
  if (fallback) {
    return fallback;
  }
  return null;
}

/** reads the current text from the composer (for typing-hint and post-send) */
export function getComposerText(): string {
  const el = getComposerElement();
  return el?.textContent?.trim() ?? '';
}
