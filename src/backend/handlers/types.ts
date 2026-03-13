import type { AnalysisResult } from '../classifier/types';

/** executive-intervention instruction variants */
export type ExecutiveIntervention =
  | { type: 'show_panel'; warningMessage: string; suggestions: string[] }
  | { type: 'show_hint'; hintText: string }
  | { type: 'blur_response' }
  | { type: 'silent' };

/** adaptive-intervention instruction variants */
export type AdaptiveIntervention = { type: 'affirm'; message: string } | { type: 'silent' };

/** strategy abstraction for executive help-seeking responses */
export abstract class ExecutiveHandler {
  abstract handle(result: AnalysisResult): ExecutiveIntervention;

  get name(): string {
    return this.constructor.name;
  }
}

/** strategy abstraction for adaptive help-seeking responses */
export abstract class AdaptiveHandler {
  abstract handle(result: AnalysisResult): AdaptiveIntervention;

  get name(): string {
    return this.constructor.name;
  }
}
