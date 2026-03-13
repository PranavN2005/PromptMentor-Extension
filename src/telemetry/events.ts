export type PromptAnalysisSource = 'draft' | 'post_send';

export interface TelemetryPayloadMap {
  content_script_initialized: {
    pageUrl: string;
    readyState: DocumentReadyState;
  };
  draft_observer_started: {
    debounceDelayMs: number;
    maxWaitMs: number;
  };
  conversation_observer_started: {
    debounceDelayMs: number;
  };
  conversation_container_unavailable: Record<string, never>;
  pipeline_executed: {
    source: PromptAnalysisSource;
    classifierName: string;
    promptLength: number;
    isExecutive: boolean;
    isAdaptive: boolean;
  };
  executive_intervention_selected: {
    handlerName: string;
    interventionType: 'show_panel' | 'show_hint' | 'blur_response' | 'silent';
  };
  adaptive_intervention_selected: {
    handlerName: string;
    interventionType: 'affirm' | 'silent';
  };
  overlay_displayed: {
    suggestionCount: number;
  };
  overlay_closed: {
    reason: 'replacement' | 'close_button' | 'proceed_button' | 'external';
  };
  overlay_question_answered: {
    response: 'yes' | 'no';
  };
  suggestion_copy_attempted: {
    success: boolean;
  };
  post_send_prompt_analyzed: {
    promptLength: number;
  };
  duplicate_post_send_prompt_skipped: Record<string, never>;
  typing_hint_displayed: {
    hintLength: number;
  };
  typing_hint_removed: Record<string, never>;
  blur_response_requested: Record<string, never>;
}

export type TelemetryEventName = keyof TelemetryPayloadMap;

export type TelemetryEvent<K extends TelemetryEventName = TelemetryEventName> = {
  name: K;
  payload: TelemetryPayloadMap[K];
};

export interface TelemetryRecord<
  K extends TelemetryEventName = TelemetryEventName,
> extends TelemetryEvent<K> {
  sessionId: string;
  timestamp: string;
}
