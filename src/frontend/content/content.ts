/**
 * THE BELOW COMMENTS WERE MADE BY AI BASED ON A PICTURE OF MY NOTES ON MY WHITEBOARD.
 *
 * promptmentor content script — entry point + pipeline orchestrator
 *
 * this is the only file compiled and injected into chatgpt by the extension
 * its two jobs:
 * 1. define the 3-strategy pipeline (classify then handle then apply)
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
 *  user types in composer  ──> MutationObserver fires (typing-hint.ts)
 *                               └─ debounce (1s wait 3s maxWait)
 *                                    └─ analyzePromptAndApplyInterventions(draftText ...)
 *
 *  user hits send  ─────────► MutationObserver fires (post-send.ts)
 *                               └─ debounce (1s wait)
 *                                    └─ analyzePromptAndApplyInterventions(sentText ...)
 *
 *  analyzePromptAndApplyInterventions:
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
 * dependency graph
 * ─────────────────────────────────────────────────────────────────────
 *
 *  content.ts
 *    → overlay.ts
 *    → typing-hint.ts   (one-way: content passes analyzePromptAndApplyInterventions as callback)
 *    → post-send.ts     (one-way: content passes analyzePromptAndApplyInterventions as callback)
 *    → backend/handlers/handlers.ts
 *    → backend/classifier/detector.ts
 *    → frontend/content/types.ts
 *    → backend/handlers/types.ts
 */

import type { AppState } from './types';
import type { ExecutiveIntervention, AdaptiveIntervention } from '../../backend/handlers/types';
import { createOverlayPanel, removeOverlayPanel } from './overlay';
import { startDraftPromptObserver } from './typing-hint';
import { showTypingHintText, removeTypingHint } from './typing-hint-view';
import { startConversationObserver } from './post-send';
import {
  getActiveExecutiveHandler,
  getActiveAdaptiveHandler,
} from '../../backend/handlers/handlers';
import { getActiveClassifier } from '../../backend/classifier/detector';
import { configureTelemetry, trackTelemetryEvent, debugLog } from '../../telemetry';
import type { PromptAnalysisSource } from '../../telemetry';

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
 * in backend/handlers/types.ts typescript will highlight this switch as incomplete until
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
      trackTelemetryEvent('blur_response_requested', {});
      debugLog('blur_response intervention selected (not implemented yet)');
      break;

    case 'silent':
      // control group — detect but intentionally do nothing
      debugLog('Executive help-seeking detected but intervention is silent');
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
      debugLog('Adaptive affirm intervention selected');
      break;

    case 'silent':
      // default: student is doing it right stay out of the way
      debugLog('Adaptive help-seeking detected with silent intervention');
      break;
  }
}

// pipeline — classify → handle → apply

/**
 * analyzePromptAndApplyInterventions
 * the shared classification pipeline used by BOTH the typing-hint and post-send paths
 * this function is passed as a callback into startDraftPromptObserver and startConversationObserver
 * to avoid circular imports (typing-hint/post-send dont import content.ts)
 *
 * @param text           — the text to classify (draft while typing or sent message)
 * @param overlayVisible — guard so we dont open a second panel on top of the first
 * @param promptText     — original text to pass to the overlay for display context
 * @param source         — indicates whether analysis came from draft typing or a sent message
 */
function analyzePromptAndApplyInterventions(
  text: string,
  overlayVisible: boolean,
  promptText: string,
  source: PromptAnalysisSource
): void {
  const classifier = getActiveClassifier();
  const result = classifier.classify(text);

  trackTelemetryEvent('pipeline_executed', {
    source,
    classifierName: classifier.name,
    promptLength: text.length,
    isExecutive: result.isExecutive,
    isAdaptive: result.isAdaptive,
  });

  if (result.isExecutive && !overlayVisible) {
    const executiveHandler = getActiveExecutiveHandler();
    const intervention = executiveHandler.handle(result);
    trackTelemetryEvent('executive_intervention_selected', {
      handlerName: executiveHandler.name,
      interventionType: intervention.type,
    });
    applyExecutiveIntervention(intervention, promptText);
  }

  if (result.isAdaptive) {
    const adaptiveHandler = getActiveAdaptiveHandler();
    const intervention = adaptiveHandler.handle(result);
    trackTelemetryEvent('adaptive_intervention_selected', {
      handlerName: adaptiveHandler.name,
      interventionType: intervention.type,
    });
    applyAdaptiveIntervention(intervention);
  }

  if (!result.isExecutive && !result.isAdaptive) {
    // clean up any old typing hint if the user edited the prompt to be non-executive
    removeTypingHint();
  }
}

// init

function init(): void {
  configureTelemetry({
    destination: 'storage',
    mirrorToConsole: false,
    debugEnabled: false,
  });

  trackTelemetryEvent('content_script_initialized', {
    pageUrl: window.location.href,
    readyState: document.readyState,
  });

  // pass analyzePromptAndApplyInterventions as callback — avoids circular imports
  startConversationObserver(state, analyzePromptAndApplyInterventions);
  startDraftPromptObserver(state, analyzePromptAndApplyInterventions);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// re-export so external callers (tests other scripts) can close the overlay
export { removeOverlayPanel };
