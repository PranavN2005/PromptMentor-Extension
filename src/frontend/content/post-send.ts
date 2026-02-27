/**
 * post-send — detect executive help-seeking after the user sends a message
 *
 * watches the chat thread for new user message bubbles debounces the check
 * then runs the full classifier → handler → intervention pipeline
 *
 * design note — why runPipeline is passed in (not imported from content.ts):
 * same reason as typing-hint.ts: content.ts imports this file so this file
 * CANNOT import from content.ts without a circular dependency. we inject it
 *
 * debounce hardening (step 4):
 * - duplicate-message guard: state.lastAnalyzedPrompt tracks the last text
 *   we passed to the pipeline. same text re-appearing (e.g from chatgpts
 *   streaming dom updates) is skipped without running analysis again
 * - processedMessages Set: stronger guard — every unique prompt weve ever
 *   processed this session lives here. protects against scroll-up re-triggering
 *   on old history messages that come back into the dom
 * - minimum length gate: < 15 chars never triggers
 */

import { debounce } from 'lodash-es';
import type { AppState } from '../../shared/types';
import type { RunPipelineFn } from './typing-hint';
import { SELECTORS, DEBOUNCE_DELAY_MS } from './config';

// post-send check (with duplicate + stale guards)

/**
 * finds the last user message in the thread checks if its new and runs the pipeline
 *
 * @param state       — shared app state (reads lastAnalyzedPrompt processedMessages; mutates them)
 * @param runPipeline — injected from content.ts to avoid circular import
 */
export function checkForExecutiveHelpSeeking(state: AppState, runPipeline: RunPipelineFn): void {
  const userMessages = document.querySelectorAll(SELECTORS.userMessage);
  if (userMessages.length === 0) return;

  const lastMessage = userMessages[userMessages.length - 1];
  const messageContent = lastMessage.querySelector(SELECTORS.messageContent);
  if (!messageContent) return;

  const promptText = messageContent.textContent?.trim() ?? '';
  if (promptText.length < 15) return;

  // duplicate-message guard: same text as the last time we ran → skip
  if (promptText === state.lastAnalyzedPrompt) return;

  // processedMessages guard: we already handled this exact text this session
  // (protects against scroll-up re-triggering on history messages)
  if (state.processedMessages.has(promptText)) {
    console.log('[PromptMentor Debug] post-send: skipping already-processed message', {
      snippet: promptText.slice(0, 40),
    });
    return;
  }

  // commit the new prompt to state before running the pipeline
  state.lastAnalyzedPrompt = promptText;
  state.processedMessages.add(promptText);

  console.log('[PromptMentor] Post-send analyzing:', promptText.substring(0, 50) + '...');

  runPipeline(promptText, state.overlayVisible, promptText);
}

// mutation observer setup

/**
 * starts the mutation observer on the conversation container and wires the debounced checker
 * retries every 1s until the container appears
 *
 * @param state       — shared app state
 * @param runPipeline — injected from content.ts to avoid circular import
 */
export function initMutationObserver(state: AppState, runPipeline: RunPipelineFn): void {
  const targetNode = document.querySelector(SELECTORS.conversationContainer);
  if (!targetNode) {
    console.log('[PromptMentor] Waiting for conversation container...');
    setTimeout(() => initMutationObserver(state, runPipeline), 1000);
    return;
  }

  const debouncedCheck = debounce(
    () => checkForExecutiveHelpSeeking(state, runPipeline),
    DEBOUNCE_DELAY_MS,
    {
      leading: false,
      trailing: true,
      // no maxWait here — we only care about the final settled dom state
      // not intermediate streaming steps. contrast with typing-hint which uses
      // maxWait so very long prompts still get pre-send feedback
    }
  );

  const observerConfig: MutationObserverInit = {
    childList: true,
    subtree: true,
    characterData: true,
  };

  const observer = new MutationObserver((_mutationsList: MutationRecord[]) => {
    debouncedCheck();
  });

  observer.observe(targetNode, observerConfig);
  console.log('[PromptMentor] MutationObserver initialized');
}
