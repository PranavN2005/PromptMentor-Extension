/**
 * Classifier-domain contracts.
 * Owns prompt analysis shapes and classifier strategy abstraction.
 */

/** one detected signal in a student prompt */
export interface DetectedPattern {
  type: PatternType;
  message: string;
}

/** supported prompt signal categories */
export type PatternType =
  | 'solution_request'
  | 'implementation_request'
  | 'answer_request'
  | 'assignment_paste'
  | 'hint_request'
  | 'shows_attempt'
  | 'conceptual_question'
  | 'verification_request';

/** regex rule configuration used by RegexPromptClassifier */
export interface PatternConfig {
  pattern: RegExp;
  type: PatternType;
  message: string;
  suggestion?: string;
}

/** complete classification output for a prompt */
export interface AnalysisResult {
  isExecutive: boolean;
  isAdaptive: boolean;
  executivePatterns: DetectedPattern[];
  adaptivePatterns: DetectedPattern[];
  suggestions: string[];
}

/** strategy abstraction for prompt classification */
export abstract class PromptClassifier {
  abstract classify(submission: string): AnalysisResult;

  get name(): string {
    return this.constructor.name;
  }
}

/** response-level analysis contract (assistant output, not user prompt) */
export interface ResponseAnalysisResult {
  containsCode: boolean;
  containsSolution: boolean;
}
