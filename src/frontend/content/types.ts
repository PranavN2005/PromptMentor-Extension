/** Content-script state model */
export interface AppState {
  lastAnalyzedPrompt: string;
  overlayVisible: boolean;
  processedMessages: Set<string>;
}

/** DOM selectors required for ChatGPT integration */
export interface DOMSelectors {
  promptInput: string;
  userMessage: string;
  assistantMessage: string;
  messageContent: string;
  conversationContainer: string;
}
