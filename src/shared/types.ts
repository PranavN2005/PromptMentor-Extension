/**
 * type definitions + classifier contract
 *
 * where ALL the shared types live
 *
 * abstract class is used for PromptClassifier below — lets us define
 * a contract and enforce it without locking in the implementation
 *
 * the big idea (re: PromptClassifier):
 * want the detection logic to be swappable/modular. right now its regex.
 * later it might be gemini or some other llm. the abstract class below
 * is the "plug" — any classifier just has to implement classify() and
 * the rest of the extension dont care whats inside.
 * trying to follow the strategy design pattern
 */

// core analysis types

/**
 * one detected pattern — executive or adaptive.
 * type tells you the category message is what we show the student
 */
export interface DetectedPattern {
  type: PatternType;
  message: string;
}

/**
 * all the valid pattern category names.
 * using a union type here so typescript screams if you typo one
 * (e.g solution_requets vs solution_request)
 */
export type PatternType =
  | 'solution_request'
  | 'implementation_request'
  | 'answer_request'
  | 'assignment_paste'
  | 'hint_request'
  | 'shows_attempt'
  | 'conceptual_question'
  | 'verification_request';

/**
 * config for a single regex pattern were looking for.
 * suggestion is optional cause adaptive patterns dont redirect —
 * they just affirm the student is doing the right thing
 */
export interface PatternConfig {
  pattern: RegExp;
  type: PatternType;
  message: string;
  suggestion?: string; // only executive patterns have these
}

/**
 * the full result of running a classifier on a prompt.
 * both isExecutive and isAdaptive can be true at the same time
 * (e.g "I tried X can you just give me the answer?" — mixed signal)
 */
export interface AnalysisResult {
  isExecutive: boolean;
  isAdaptive: boolean;
  executivePatterns: DetectedPattern[];
  adaptivePatterns: DetectedPattern[];
  suggestions: string[];
}

// prompt classifier — the swappable plugin seam

/**
 * PromptClassifier — abstract base class for all classifiers
 *
 * this is THE key extensibility point in the whole project
 * want to swap in gemini? extend this. want to a/b test two
 * different regex rule sets? make two subclasses of this
 *
 * how to add a new classifier:
 * 1. extend PromptClassifier
 * 2. implement classify(submission: string): AnalysisResult
 * 3. swap it in wherever getActiveClassifier() is called in content.ts
 *
 * thats it. nothing else in the codebase needs to change
 *
 * @example
 * class MyCustomClassifier extends PromptClassifier {
 *   classify(submission: string): AnalysisResult {
 *     // your logic here
 *   }
 * }
 */
export abstract class PromptClassifier {
  /**
   * classify a students submission.
   * returns an AnalysisResult describing executive/adaptive signals found
   * @param submission - the raw text the student typed
   */
  abstract classify(submission: string): AnalysisResult;

  /**
   * optional: give this classifier a human readable name.
   * useful for logging/debugging so you know which implementation ran
   */
  get name(): string {
    return this.constructor.name;
  }
}

// response classifier contract

/**
 * used for checking if the ai's response looks like it contains a solution.
 * kept separate from PromptClassifier since it operates on different input
 * (the assistants output not the students input)
 */
export interface ResponseAnalysisResult {
  containsCode: boolean;
  containsSolution: boolean; // future: distinguish code snippets vs full solutions
}

// intervention types — what handlers return

/**
 * ExecutiveIntervention — what to do when executive help-seeking is detected
 *
 * this is a discriminated union — content.ts switches on the type field
 * and renders accordingly. adding a new intervention style = add a new variant
 * here + handle it in content.ts. nothing else needs to change
 *
 * variants:
 * - show_panel:      open the full Help Request Builder side panel
 * - show_hint:       show a small inline hint above the composer (non-blocking)
 * - blur_response:   blur the ai response after it comes back
 * - silent:          do nothing (useful for a/b testing a control group)
 */
export type ExecutiveIntervention =
  | { type: 'show_panel'; warningMessage: string; suggestions: string[] }
  | { type: 'show_hint'; hintText: string }
  | { type: 'blur_response' }
  | { type: 'silent' };

/**
 * AdaptiveIntervention — what to do when adaptive help-seeking is detected
 *
 * currently simpler than ExecutiveIntervention since adaptive is the "good" case
 * and we mainly want to either affirm the student or just stay out of the way
 *
 * variants:
 * - affirm:  show a small positive message (nice youre doing it right!)
 * - silent:  do nothing (current default)
 */
export type AdaptiveIntervention = { type: 'affirm'; message: string } | { type: 'silent' };

// handler strategies — the second + third swappable plugin seams

/**
 * ExecutiveHandler — abstract base for "what do we do about executive help-seeking?"
 *
 * takes the full AnalysisResult from the classifier and decides what intervention
 * to trigger. returns an ExecutiveIntervention instruction object — content.ts
 * is the one that actually renders it
 *
 * how to add a new executive intervention style:
 * 1. add a new variant to ExecutiveIntervention above
 * 2. extend ExecutiveHandler and implement handle()
 * 3. swap it in via getActiveExecutiveHandler() in handlers.ts
 * 4. handle the new type in content.ts renderExecutiveIntervention()
 *
 * @example
 * class MinimalHintHandler extends ExecutiveHandler {
 *   handle(result: AnalysisResult): ExecutiveIntervention {
 *     return { type: 'show_hint', hintText: result.suggestions[0] ?? '...' };
 *   }
 * }
 */
export abstract class ExecutiveHandler {
  abstract handle(result: AnalysisResult): ExecutiveIntervention;

  get name(): string {
    return this.constructor.name;
  }
}

/**
 * AdaptiveHandler — abstract base for "what do we do about adaptive help-seeking?"
 *
 * same idea as ExecutiveHandler but for the good behavior case.
 * currently the default just stays silent but future implementations could
 * show positive reinforcement messages tied to the grants metacognitive goals
 *
 * @example
 * class AffirmationAdaptiveHandler extends AdaptiveHandler {
 *   handle(result: AnalysisResult): AdaptiveIntervention {
 *     return { type: 'affirm', message: 'Nice! Asking for hints builds real understanding.' };
 *   }
 * }
 */
export abstract class AdaptiveHandler {
  abstract handle(result: AnalysisResult): AdaptiveIntervention;

  get name(): string {
    return this.constructor.name;
  }
}

// app state

/**
 * tracks what the extension has already done this session.
 * mainly used to prevent showing the same warning twice for the same prompt
 */
export interface AppState {
  lastAnalyzedPrompt: string;
  overlayVisible: boolean;
  processedMessages: Set<string>;
}

/**
 * stats we persist to chrome.storage between sessions.
 * currently commented out in popup.ts, its here if well need it
 */
export interface StoredStats {
  executiveCount: number;
  adaptiveCount: number;
  lastSessionDate: string;
}

// dom selectors

/**
 * all the css selectors we use to find chatgpt dom elements.
 * centralized here so when chatgpt inevitably changes their ui,
 * you only have to update ONE place. (weve already been burned once lol)
 */
export interface DOMSelectors {
  promptInput: string;
  userMessage: string;
  assistantMessage: string;
  messageContent: string;
  conversationContainer: string;
}
