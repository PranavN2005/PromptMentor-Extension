/**
 * TYPE DEFINITIONS + CLASSIFIER CONTRACT
 * =======================================
 *
 * hey! if you're new here, this is where ALL the shared types live.
 * TypeScript uses these to yell at you (nicely) when you use the
 * wrong shape of data. trust me, it saves so much debugging time.
 *
 * INTERFACES vs TYPES (quick cheat sheet):
 * - interface: great for object shapes, can be extended later
 * - type: more flexible, good for unions like "this OR that"
 * - abstract class: used for PromptClassifier below — lets us define
 *   a contract AND enforce it without locking in the implementation
 *
 * THE BIG IDEA (re: PromptClassifier):
 * we want the detection brain to be swappable. right now it's regex.
 * later it might be Gemini or some other LLM. the abstract class below
 * is the "plug" — any classifier just has to implement classify() and
 * the rest of the extension doesn't care what's inside.
 */

// ============================================================================
// CORE ANALYSIS TYPES
// ============================================================================

/**
 * one detected pattern — executive or adaptive.
 * type tells you the category, message is what we show the student.
 */
export interface DetectedPattern {
  type: PatternType;
  message: string;
}

/**
 * all the valid pattern category names.
 * using a union type here so typescript screams if you typo one
 * (e.g. 'solution_requets' vs 'solution_request')
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
 * config for a single regex pattern we're looking for.
 * suggestion is optional because adaptive patterns don't redirect —
 * they just affirm the student is doing the right thing.
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
 * (e.g. "I tried X, can you just give me the answer?" — mixed signal)
 */
export interface AnalysisResult {
  isExecutive: boolean;
  isAdaptive: boolean;
  executivePatterns: DetectedPattern[];
  adaptivePatterns: DetectedPattern[];
  suggestions: string[];
}

// ============================================================================
// PROMPT CLASSIFIER — THE SWAPPABLE PLUGIN SEAM
// ============================================================================

/**
 * PromptClassifier — abstract base class for all classifiers.
 *
 * this is THE key extensibility point in the whole project.
 * want to swap in Gemini? extend this. want to A/B test two
 * different regex rule sets? make two subclasses of this.
 *
 * HOW TO ADD A NEW CLASSIFIER:
 * 1. extend PromptClassifier
 * 2. implement classify(submission: string): AnalysisResult
 * 3. swap it in wherever getActiveClassifier() is called in content.ts
 *
 * that's it. nothing else in the codebase needs to change.
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
   * classify a student's submission.
   * returns an AnalysisResult describing executive/adaptive signals found.
   * @param submission - the raw text the student typed
   */
  abstract classify(submission: string): AnalysisResult;

  /**
   * optional: give this classifier a human-readable name.
   * useful for logging/debugging so you know which implementation ran.
   */
  get name(): string {
    return this.constructor.name;
  }
}

// ============================================================================
// RESPONSE CLASSIFIER CONTRACT
// ============================================================================

/**
 * used for checking if the AI's response looks like it contains a solution.
 * kept separate from PromptClassifier since it operates on different input
 * (the assistant's output, not the student's input).
 */
export interface ResponseAnalysisResult {
  containsCode: boolean;
  containsSolution: boolean; // future: distinguish code snippets vs full solutions
}

// ============================================================================
// APP STATE
// ============================================================================

/**
 * tracks what the extension has already done this session.
 * mainly used to prevent showing the same warning twice for the same prompt.
 */
export interface AppState {
  lastAnalyzedPrompt: string;
  overlayVisible: boolean;
  processedMessages: Set<string>;
}

/**
 * stats we persist to chrome.storage between sessions.
 * currently commented out in popup.ts but the shape is here when we need it.
 */
export interface StoredStats {
  executiveCount: number;
  adaptiveCount: number;
  lastSessionDate: string;
}

// ============================================================================
// DOM SELECTORS
// ============================================================================

/**
 * all the CSS selectors we use to find ChatGPT DOM elements.
 * centralized here so when ChatGPT inevitably changes their UI,
 * you only have to update ONE place. (we've already been burned once lol)
 */
export interface DOMSelectors {
  promptInput: string;
  userMessage: string;
  assistantMessage: string;
  messageContent: string;
  conversationContainer: string;
}
