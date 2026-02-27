/**
 * handlers — default executive + adaptive implementations
 *
 * this file has two jobs:
 * 1. provide default concrete implementations of ExecutiveHandler and AdaptiveHandler
 * 2. expose swap functions so content.ts can get the active handler without
 *    knowing which implementation is actually running
 *
 * current defaults:
 * - executive: DefaultExecutiveHandler → shows the full Help Request Builder panel
 * - adaptive:  SilentAdaptiveHandler   → does nothing (student is doing it right stay out of the way)
 *
 * to swap in a different handler:
 * just change what getActiveExecutiveHandler() or getActiveAdaptiveHandler() returns
 * content.ts dont care which handler it gets — it just calls handle() and acts
 * on the returned instruction object
 *
 * want to add a new handler?
 * 1. extend ExecutiveHandler or AdaptiveHandler (from shared/types.ts)
 * 2. implement handle()
 * 3. update getActiveExecutiveHandler() or getActiveAdaptiveHandler() below
 * thats literally it — nothing else in the codebase needs to change
 */

import {
  ExecutiveHandler,
  AdaptiveHandler,
  type AnalysisResult,
  type ExecutiveIntervention,
  type AdaptiveIntervention,
} from '../../shared/types';

// executive handlers

/**
 * DefaultExecutiveHandler
 * the standard intervention — opens the full Help Request Builder panel
 *
 * pulls the warning message from the first detected executive pattern and
 * passes all suggestions through so the panel can display them
 *
 * this is what students see when they ask something like "write me the code for X"
 */
export class DefaultExecutiveHandler extends ExecutiveHandler {
  handle(result: AnalysisResult): ExecutiveIntervention {
    // grab the most relevant warning message from the first matched pattern
    const warningMessage =
      result.executivePatterns[0]?.message ??
      'This prompt might give you the answer without helping you learn.';

    return {
      type: 'show_panel',
      warningMessage,
      suggestions: result.suggestions,
    };
  }
}

/**
 * MinimalHintExecutiveHandler
 * a lighter touch intervention — shows a small non-blocking hint above the composer
 * instead of the full side panel. good for a/b testing whether a subtle nudge is
 * as effective as the full panel without being as disruptive
 *
 * not the default yet but wired up and ready to swap in
 */
export class MinimalHintExecutiveHandler extends ExecutiveHandler {
  handle(result: AnalysisResult): ExecutiveIntervention {
    const hintText = result.suggestions[0] ?? 'Try asking for a hint instead of the full answer!';

    return {
      type: 'show_hint',
      hintText,
    };
  }
}

/**
 * SilentExecutiveHandler
 * does nothing on executive detection. useful as a control group in experiments —
 * "what happens to learning outcomes when we detect but dont intervene?"
 */
export class SilentExecutiveHandler extends ExecutiveHandler {
  handle(_result: AnalysisResult): ExecutiveIntervention {
    return { type: 'silent' };
  }
}

// adaptive handlers

/**
 * SilentAdaptiveHandler
 * current default — detects adaptive help-seeking but says nothing to the student
 * the detection still gets logged (once we wire up analytics) we just dont
 * show any ui. reasoning: dont interrupt students who are already doing it right
 */
export class SilentAdaptiveHandler extends AdaptiveHandler {
  handle(_result: AnalysisResult): AdaptiveIntervention {
    return { type: 'silent' };
  }
}

/**
 * AffirmationAdaptiveHandler
 * shows a small positive reinforcement message when adaptive help-seeking is detected
 * tied to the grants goal of motivating students to keep seeking adaptive help —
 * positive feedback loop stuff
 *
 * not the default yet — want to confirm the ux dont get annoying first
 */
export class AffirmationAdaptiveHandler extends AdaptiveHandler {
  handle(result: AnalysisResult): AdaptiveIntervention {
    // use the first adaptive patterns message or fall back to a generic one
    const message = result.adaptivePatterns[0]?.message ?? 'Nice work seeking adaptive help!';

    return { type: 'affirm', message };
  }
}

// active handler swap points

/**
 * getActiveExecutiveHandler()
 * returns the handler that runs when executive help-seeking is detected
 * change this to swap intervention style for the whole extension
 *
 * options:
 *   new DefaultExecutiveHandler()      ← full panel (current default)
 *   new MinimalHintExecutiveHandler()  ← subtle hint only
 *   new SilentExecutiveHandler()       ← control group (no intervention)
 */
export function getActiveExecutiveHandler(): ExecutiveHandler {
  return new DefaultExecutiveHandler();
}

/**
 * getActiveAdaptiveHandler()
 * returns the handler that runs when adaptive help-seeking is detected
 * change this to swap positive feedback style for the whole extension
 *
 * options:
 *   new SilentAdaptiveHandler()        ← do nothing (current default)
 *   new AffirmationAdaptiveHandler()   ← show positive message
 */
export function getActiveAdaptiveHandler(): AdaptiveHandler {
  return new SilentAdaptiveHandler();
}
