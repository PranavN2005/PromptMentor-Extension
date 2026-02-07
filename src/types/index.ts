/**
 * TYPE DEFINITIONS
 * =================
 * 
 * TypeScript uses TYPES to describe the shape of data.
 * This catches bugs at compile time and provides autocomplete.
 * 
 * INTERFACES vs TYPES:
 * - interface: Best for object shapes, can be extended
 * - type: More flexible, can represent unions, primitives
 * 
 * For this project, we use interfaces for objects.
 */

/**
 * Represents a detected help-seeking pattern.
 * 
 * @example
 * {
 *   type: 'solution_request',
 *   message: 'Asking for complete code reduces learning.'
 * }
 */
export interface DetectedPattern {
  type: PatternType;
  message: string;
}

/**
 * Union type - can ONLY be one of these specific strings.
 * TypeScript will error if you try to use any other string.
 * 
 * This is safer than just using `string` because it prevents typos.
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
 * Configuration for a pattern we want to detect.
 */
export interface PatternConfig {
  pattern: RegExp;          // The regex to match
  type: PatternType;        // Category of this pattern
  message: string;          // Message to show user
  suggestion?: string;      // Optional alternative prompt (undefined for adaptive patterns)
}

/**
 * Result of analyzing a prompt.
 */
export interface AnalysisResult {
  isExecutive: boolean;     // Did we find executive help-seeking?
  isAdaptive: boolean;      // Did we find adaptive help-seeking?
  executivePatterns: DetectedPattern[];
  adaptivePatterns: DetectedPattern[];
  suggestions: string[];
}

/**
 * Application state - what we're tracking.
 */
export interface AppState {
  lastAnalyzedPrompt: string;
  overlayVisible: boolean;
  processedMessages: Set<string>;
}

/**
 * Stats we store in chrome.storage.
 */
export interface StoredStats {
  executiveCount: number;
  adaptiveCount: number;
  lastSessionDate: string;
}

/**
 * Selectors for finding elements in ChatGPT's DOM.
 * Centralized here so they're easy to update if ChatGPT changes.
 */
export interface DOMSelectors {
  promptInput: string;
  userMessage: string;
  assistantMessage: string;
  messageContent: string;
  conversationContainer: string;
}

