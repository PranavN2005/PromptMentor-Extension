/**
 * promptmentor content script — entry point + pipeline orchestrator
 *
 * this is the only file compiled and injected into chatgpt by the extension
 * its two jobs:
 * 1. define the 3-strategy pipeline (classify → handle → apply)
 * 2. hold shared state and wire up the observer loops
 *
 * all heavy lifting lives elsewhere:
 * - config.ts          — selectors debounce delay composer helper
 * - overlay.ts         — Help Request Builder panel dom
 * - typing-hint.ts     — pre-send observer + debounce + hint dom
 * - post-send.ts       — post-send observer + debounce
 * - backend/classifier/detector.ts  — PromptClassifier (regex or future api)
 * - backend/handlers/handlers.ts    — ExecutiveHandler / AdaptiveHandler
 *
 * ─────────────────────────────────────────────────────────────────────
 * how the 3-strategy pipeline works (end to end)
 * ─────────────────────────────────────────────────────────────────────
 *
 *  user types in composer  ──► MutationObserver fires (typing-hint.ts)
 *                               └─ debounce (1s wait 3s maxWait)
 *                                    └─ runPipeline(draftText ...)
 *
 *  user hits send  ─────────► MutationObserver fires (post-send.ts)
 *                               └─ debounce (1s wait)
 *                                    └─ runPipeline(sentText ...)
 *
 *  runPipeline:
 *    getActiveClassifier().classify(text)  →  AnalysisResult
 *        │
 *        ├─ isExecutive? → getActiveExecutiveHandler().handle(result)
 *        │                      └─ ExecutiveIntervention
 *        │                           └─ applyExecutiveIntervention(...)  ← dom
 *        │
 *        └─ isAdaptive?  → getActiveAdaptiveHandler().handle(result)
 *                               └─ AdaptiveIntervention
 *                                    └─ applyAdaptiveIntervention(...)   ← dom
 *
 * to swap a strategy: change the return value of
 *   getActiveClassifier()        in backend/classifier/detector.ts
 *   getActiveExecutiveHandler()  in backend/handlers/handlers.ts
 *   getActiveAdaptiveHandler()   in backend/handlers/handlers.ts
 * content.ts never needs to change when you swap strategies
 *
 * ─────────────────────────────────────────────────────────────────────
 * dependency graph (no circular deps)
 * ─────────────────────────────────────────────────────────────────────
 *
 *  content.ts
 *    → overlay.ts
 *    → typing-hint.ts   (one-way: content passes runPipeline as callback)
 *    → post-send.ts     (one-way: content passes runPipeline as callback)
 *    → backend/handlers/handlers.ts
 *    → backend/classifier/detector.ts
 *    → shared/types.ts
 */

import type { AppState, ExecutiveIntervention, AdaptiveIntervention } from '../../shared/types';
import { createOverlayPanel, removeOverlayPanel } from './overlay';
import { showTypingHintText, removeTypingHint, initComposerObserver } from './typing-hint';
import { initMutationObserver } from './post-send';
import {
  getActiveExecutiveHandler,
  getActiveAdaptiveHandler,
} from '../../backend/handlers/handlers';
import { getActiveClassifier } from '../../backend/classifier/detector';

// shared state

/**
 * global state for this content script session
 * kept here so both the pre-send (typing-hint) and post-send paths share
 * the same truth about whether the overlay is currently on screen
 *
 * we also track which prompts weve already processed so the observer
 * loops can skip stale/duplicate firings
 */
const state: AppState = {
  lastAnalyzedPrompt: '',
  overlayVisible: false,
  processedMessages: new Set<string>(),
};

// intervention renderers — the ONLY place that touches the dom for interventions

/**
 * applyExecutiveIntervention
 * takes the instruction object returned by ExecutiveHandler.handle() and
 * performs the actual dom action
 *
 * switching on intervention.type is intentional — its an exhaustive
 * discriminated-union switch. if you add a new variant to ExecutiveIntervention
 * in shared/types.ts typescript will highlight this switch as incomplete until
 * you handle the new case here. thats the whole point
 *
 * @param intervention — what to do (returned by the active ExecutiveHandler)
 * @param promptText   — the original prompt text passed through to overlay for display
 */
function applyExecutiveIntervention(intervention: ExecutiveIntervention, promptText: string): void {
  switch (intervention.type) {
    case 'show_panel':
      // full Help Request Builder side panel
      createOverlayPanel(
        {
          isExecutive: true,
          isAdaptive: false,
          executivePatterns: [{ type: 'solution_request', message: intervention.warningMessage }],
          adaptivePatterns: [],
          suggestions: intervention.suggestions,
        },
        promptText,
        {
          onOpen: () => {
            state.overlayVisible = true;
          },
          onClose: () => {
            state.overlayVisible = false;
          },
        }
      );
      break;

    case 'show_hint':
      // small non-blocking hint above the composer — lighter touch intervention
      showTypingHintText(intervention.hintText);
      break;

    case 'blur_response':
      // blur the latest ai response — implemented in step 5 (blur-reveal)
      // wired here so the type system stays exhaustive even before step 5 is done
      console.log('[PromptMentor] blur_response intervention — wired in Step 5');
      break;

    case 'silent':
      // control group — detect but intentionally do nothing
      console.log('[PromptMentor] executive detected but handler is silent (control group)');
      break;
  }
}

/**
 * applyAdaptiveIntervention
 * same pattern as above but for the adaptive (good behavior) case
 */
function applyAdaptiveIntervention(intervention: AdaptiveIntervention): void {
  switch (intervention.type) {
    case 'affirm':
      // future: show a small positive toast. logged for now
      console.log('[PromptMentor] Adaptive help-seeking — affirm:', intervention.message);
      break;

    case 'silent':
      // default: student is doing it right stay out of the way
      console.log('[PromptMentor] Adaptive help-seeking detected (silent handler)');
      break;
  }
}

// pipeline — classify → handle → apply

/**
 * runPipeline
 * the shared classification pipeline used by BOTH the typing-hint and post-send paths
 * this function is passed as a callback into initComposerObserver and initMutationObserver
 * to avoid circular imports (typing-hint/post-send dont import content.ts)
 *
 * @param text           — the text to classify (draft while typing or sent message)
 * @param overlayVisible — guard so we dont open a second panel on top of the first
 * @param promptText     — original text to pass to the overlay for display context
 */
function runPipeline(text: string, overlayVisible: boolean, promptText: string): void {
  const classifier = getActiveClassifier();
  const result = classifier.classify(text);

  console.log('[PromptMentor] Pipeline ran', {
    classifier: classifier.name,
    isExecutive: result.isExecutive,
    isAdaptive: result.isAdaptive,
    snippet: text.slice(0, 50),
  });

  if (result.isExecutive && !overlayVisible) {
    const executiveHandler = getActiveExecutiveHandler();
    const intervention = executiveHandler.handle(result);
    console.log('[PromptMentor] Executive handler:', executiveHandler.name, '→', intervention.type);
    applyExecutiveIntervention(intervention, promptText);
  }

  if (result.isAdaptive) {
    const adaptiveHandler = getActiveAdaptiveHandler();
    const intervention = adaptiveHandler.handle(result);
    applyAdaptiveIntervention(intervention);
  }

  if (!result.isExecutive && !result.isAdaptive) {
    console.log('[PromptMentor] No specific pattern detected');
    // clean up any old typing hint if the user edited the prompt to be non-executive
    removeTypingHint();
  }
}

// init

function init(): void {
  console.log('[PromptMentor] Content script loaded on:', window.location.href);
  console.log('[PromptMentor Debug] init started', {
    readyState: document.readyState,
    href: window.location.href,
  });

  // pass runPipeline as a callback — avoids circular imports
  initMutationObserver(state, runPipeline);
  initComposerObserver(state, runPipeline);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// re-export so external callers (tests other scripts) can close the overlay
export { removeOverlayPanel };
