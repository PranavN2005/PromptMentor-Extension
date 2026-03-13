/**
 * typing hint — pre-send feedback above the composer
 *
 * watches the composer div for changes debounces so we dont analyze every
 * keystroke then runs the full classifier → handler → intervention pipeline
 *
 * this file owns ONLY observer/debounce logic
 * the hint dom rendering/removal lives in typing-hint-view.ts
 *
 * design note — why analyzePromptAndApplyInterventions is passed in (not imported from content.ts):
 * content.ts imports this file so this file CANNOT import from content.ts
 * without creating a circular dependency. dependency injection (passing the
 * function as a parameter) sidesteps this cleanly
 *
 * debounce hardening (step 4):
 * - stale-result guard: we snapshot the composer text at the moment we schedule
 *   the check. when the debounce fires we compare to the current text. if they
 *   differ the user kept typing and the next debounce cycle will handle it
 * - minimum length gate: < 15 chars never triggers analysis
 * - maxWait: if the student keeps typing for more than MAX_WAIT_MS without pausing
 *   we run one check anyway so very long prompts still get feedback
 */

import { debounce } from 'lodash-es';
import type { AppState } from './types';
import { getComposerElement, getComposerText, DEBOUNCE_DELAY_MS } from './config';
import { debugLog, trackTelemetryEvent } from '../../telemetry';
import { removeTypingHint } from './typing-hint-view';

// fires analysis at most every DEBOUNCE_DELAY_MS after the last keystroke
// but guarantees a check at least once every MAX_WAIT_MS even while still typing
const MAX_WAIT_MS = 3000;

/** type alias for the pipeline runner injected from content.ts */
export type AnalyzePromptPipelineFn = (
  text: string,
  overlayVisible: boolean,
  promptText: string,
  source: 'draft' | 'post_send'
) => void;

// debounced composer check (with stale-result guard)

/**
 * closes over the injected analyzePromptAndApplyInterventions + state references
 * returns a debounced function that runs the pipeline when the user pauses
 *
 * factored out so startDraftPromptObserver can create it once and hold the reference
 * (important: debounce only works if you reuse the same debounced instance)
 */
function createDebouncedCheck(
  state: AppState,
  analyzePromptAndApplyInterventions: AnalyzePromptPipelineFn
) {
  /**
   * stale-result guard:
   * snapshotText is the text at scheduling time. currentText is at execution time
   * if they differ the user kept typing — bail and wait for the next cycle
   */
  function checkComposerDraft(snapshotText: string): void {
    const currentText = getComposerText();
    if (currentText !== snapshotText) {
      debugLog('Draft check stale result discarded', {
        snapshot: snapshotText.slice(0, 40),
        current: currentText.slice(0, 40),
      });
      return;
    }

    // minimum length gate
    if (currentText.length < 15) {
      removeTypingHint();
      return;
    }

    // run the full 3-strategy pipeline
    analyzePromptAndApplyInterventions(currentText, state.overlayVisible, currentText, 'draft');
  }

  return debounce(checkComposerDraft, DEBOUNCE_DELAY_MS, {
    leading: false,
    trailing: true,
    maxWait: MAX_WAIT_MS, // fire at least once every 3s even while still typing
  });
}

// composer observer setup

/**
 * waits for the composer to appear then attaches a MutationObserver to it
 * re-tries every 500ms until the composer div exists in the dom
 * (chatgpt loads the editor asynchronously)
 *
 * @param state       — shared app state (used to read overlayVisible guard)
 * @param analyzePromptAndApplyInterventions — injected from content.ts to avoid circular import
 */
export function startDraftPromptObserver(
  state: AppState,
  analyzePromptAndApplyInterventions: AnalyzePromptPipelineFn
): void {
  const composer = getComposerElement();

  if (!composer) {
    // composer not ready yet — retry in 500ms
    setTimeout(() => startDraftPromptObserver(state, analyzePromptAndApplyInterventions), 500);
    return;
  }

  // create the debounced checker once and hold onto the reference
  const debouncedCheck = createDebouncedCheck(state, analyzePromptAndApplyInterventions);

  const observerConfig: MutationObserverInit = {
    childList: true, // watch for child elements being added/removed (prosemirror paragraph changes)
    subtree: true, // watch all descendants not just direct children
    characterData: true, // watch for text node changes (keypresses)
  };

  const observer = new MutationObserver(() => {
    // fires on every dom change inside the composer — could be dozens per keystroke
    // snapshot the text NOW (at scheduling time) for the stale-result guard
    const snapshotText = getComposerText();
    if (snapshotText.length === 0) {
      removeTypingHint();
      return;
    }
    debouncedCheck(snapshotText);
  });

  observer.observe(composer, observerConfig);

  trackTelemetryEvent('draft_observer_started', {
    debounceDelayMs: DEBOUNCE_DELAY_MS,
    maxWaitMs: MAX_WAIT_MS,
  });
  debugLog('Draft observer attached', {
    observedNodeId: composer.id,
  });
}
